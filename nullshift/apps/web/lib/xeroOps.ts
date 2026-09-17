/**
 * Xero operations wrapper — the `XeroPort` the ops worker uses, over the
 * existing `packages/billing/src/xero.ts` client plus the two RECOVERY
 * LOOKUPS the brief requires (§10.3 "remote-create/local-save crash recovery
 * without duplicate invoices or payment entries"; §3.3 #6; §12.4 "when a
 * provider call times out, investigate/recover the original operation before
 * creating a replacement"):
 *
 *   findXeroInvoiceByReference(reference)   GET /Invoices?where=Reference==…
 *   listXeroInvoicePayments(xeroInvoiceId)  GET /Invoices/{id} → Payments[]
 *
 * and sanitised, classified errors (`ProviderError`: outage | rejected |
 * unconfigured) so the worker can tell a retry from a dead letter without
 * ever storing a token or a full payload.
 *
 * packages/billing is not edited. The two lookups need a bearer token that
 * module keeps private, so this file performs its own client_credentials
 * exchange against the same XERO_CLIENT_ID / XERO_CLIENT_SECRET (cached).
 * Moving them into packages/billing is listed as a gap in the task doc.
 *
 * Nothing here is called unless `integrationWorkers` is on (the worker is
 * the only caller); the legacy `lib/xeroSync.ts` path is untouched.
 */

import {
  createXeroInvoice,
  findOrCreateXeroContact,
  getXeroOnlineInvoiceUrl,
  isXeroConfigured,
  recordXeroPayment,
} from "@nullshift/billing/xero";
import { ProviderError, type XeroPort } from "@/lib/integrations/types";

const TOKEN_URL = "https://identity.xero.com/connect/token";
const API = "https://api.xero.com/api.xro/2.0";

/* ── Error sanitising / classification ───────────────────────────────────── */

const REDACT = [
  /bearer\s+[a-z0-9._-]+/gi,
  /(access_token|client_secret|secret|token)"?\s*[=:]\s*"?[^\s,&"']+/gi,
];

/** Any thrown value → a ProviderError with a bounded, token-free message. */
export function sanitiseXeroError(e: unknown): ProviderError {
  if (e instanceof ProviderError) return e;
  let msg = e instanceof Error ? e.message : String(e);
  for (const r of REDACT) msg = msg.replace(r, "[redacted]");
  msg = msg.slice(0, 300);
  const status = Number(
    msg.match(/→\s*(\d{3})\b/)?.[1] ?? msg.match(/\((\d{3})\)/)?.[1] ?? NaN
  );
  if (/not configured|unconfigured/i.test(msg))
    return new ProviderError("unconfigured", msg, null);
  if (Number.isFinite(status)) {
    if (status === 429 || status >= 500) return new ProviderError("outage", msg, status);
    return new ProviderError("rejected", msg, status);
  }
  if (/fetch failed|ECONN|ETIMEDOUT|socket|network|timeout/i.test(msg))
    return new ProviderError("outage", msg, null);
  // Unknown shape: treat as transient so a person is not woken for a blip,
  // bounded by max_attempts.
  return new ProviderError("outage", msg, null);
}

async function guarded<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    throw sanitiseXeroError(e);
  }
}

/* ── Read-only lookups (own token; same credentials) ─────────────────────── */

let cached: { token: string; expiresAt: number } | null = null;

async function token(): Promise<string> {
  if (!isXeroConfigured())
    throw new ProviderError("unconfigured", "Xero is not configured.");
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const basic = Buffer.from(
    `${process.env.XERO_CLIENT_ID}:${process.env.XERO_CLIENT_SECRET}`
  ).toString("base64");
  let res: Response;
  try {
    res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
  } catch (e) {
    throw new ProviderError(
      "outage",
      `Xero token request failed: ${(e as Error).message.slice(0, 120)}`
    );
  }
  if (!res.ok)
    throw sanitiseXeroError(new Error(`Xero token request failed (${res.status})`));
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

async function xeroGet<T>(path: string): Promise<T | null> {
  const t = await token();
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      headers: { Authorization: `Bearer ${t}`, Accept: "application/json" },
    });
  } catch (e) {
    throw new ProviderError(
      "outage",
      `Xero network error: ${(e as Error).message.slice(0, 120)}`
    );
  }
  const text = await res.text();
  if (!res.ok)
    throw sanitiseXeroError(
      new Error(`Xero GET ${path} → ${res.status}: ${text.slice(0, 200)}`)
    );
  return text ? (JSON.parse(text) as T) : null;
}

/** Xero /Date(1693526400000+0000)/ → YYYY-MM-DD; ISO passes through. */
function xeroDate(raw: string | undefined): string {
  if (!raw) return "";
  const m = raw.match(/\/Date\((-?\d+)/);
  if (m) return new Date(Number(m[1])).toISOString().slice(0, 10);
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

type InvoiceListResponse = {
  Invoices?: {
    InvoiceID: string;
    InvoiceNumber?: string;
    Status?: string;
    Type?: string;
  }[];
};

/** Our reference → the live (non-void, non-deleted) ACCREC invoice, if Xero already has it. */
export async function findXeroInvoiceByReference(
  reference: string
): Promise<{ invoiceId: string; invoiceNumber: string | null; status: string } | null> {
  const esc = reference.replace(/"/g, '\\"');
  const res = await xeroGet<InvoiceListResponse>(
    `/Invoices?where=${encodeURIComponent(`Reference=="${esc}"&&Type=="ACCREC"`)}`
  );
  const hit = (res?.Invoices ?? []).find(
    (i) => i.Status !== "VOIDED" && i.Status !== "DELETED"
  );
  return hit
    ? {
        invoiceId: hit.InvoiceID,
        invoiceNumber: hit.InvoiceNumber ?? null,
        status: hit.Status ?? "",
      }
    : null;
}

type InvoiceDetailResponse = {
  Invoices?: {
    Payments?: {
      PaymentID: string;
      Amount?: number;
      Date?: string;
      Reference?: string;
    }[];
  }[];
};

/** Payments already recorded against a Xero invoice (the allocation recovery lookup). */
export async function listXeroInvoicePayments(
  xeroInvoiceId: string
): Promise<
  { paymentId: string; amountMinor: number; dateISO: string; reference: string | null }[]
> {
  const res = await xeroGet<InvoiceDetailResponse>(
    `/Invoices/${encodeURIComponent(xeroInvoiceId)}`
  );
  return (res?.Invoices?.[0]?.Payments ?? []).map((p) => ({
    paymentId: p.PaymentID,
    amountMinor: Math.round(Number(p.Amount ?? 0) * 100),
    dateISO: xeroDate(p.Date),
    reference: p.Reference ?? null,
  }));
}

/* ── The port ────────────────────────────────────────────────────────────── */

export function liveXeroPort(): XeroPort {
  return {
    configured: () => isXeroConfigured(),
    findInvoiceByReference: (reference) =>
      guarded(() => findXeroInvoiceByReference(reference)),
    findOrCreateContact: (opts) =>
      guarded(() =>
        findOrCreateXeroContact({
          name: opts.name,
          email: opts.email,
          existingContactId: opts.existingContactId,
        })
      ),
    createInvoice: (opts) =>
      guarded(() =>
        createXeroInvoice({
          contactId: opts.contactId,
          reference: opts.reference,
          dateISO: opts.dateISO,
          dueDateISO: opts.dueDateISO,
          lineItems: opts.lineItems.map((l) => ({
            description: l.description,
            amount: l.amountMinor / 100,
          })),
        })
      ),
    getOnlineInvoiceUrl: (id) => guarded(() => getXeroOnlineInvoiceUrl(id)),
    listInvoicePayments: (id) => guarded(() => listXeroInvoicePayments(id)),
    // packages/billing's recordXeroPayment sets no Reference; the recovery
    // lookup therefore also matches on amount + date (see handlers.ts).
    // Adding Reference support to packages/billing is listed as a gap.
    recordPayment: (opts) =>
      guarded(async () => {
        const r = await recordXeroPayment({
          xeroInvoiceId: opts.xeroInvoiceId,
          amount: opts.amountMinor / 100,
          dateISO: opts.dateISO,
          accountCode:
            opts.accountCode ?? process.env.XERO_GOCARDLESS_ACCOUNT_CODE ?? undefined,
        });
        return r ? { ok: true as const } : null;
      }),
  };
}
