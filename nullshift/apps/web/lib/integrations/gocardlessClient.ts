/**
 * GoCardless port over the live API (server only; never import from client
 * components). Reads are authoritative resource fetches; the two writes are
 * the subscription create (with a START DATE, an Idempotency-Key and 409
 * adoption of the resource a crashed earlier attempt created) and the
 * payment cancellation.
 *
 * `packages/billing/src/gocardless.ts` is reused for `getPayment` and
 * `getBillingRequest`. Mandate and subscription reads, and a subscription
 * create that honours `start_date`, do not exist there yet and are
 * implemented here against the same environment variables (a later change
 * to packages/billing can absorb them; see the task doc's gaps).
 */

import {
  getBillingRequest,
  getPayment,
  isGoCardlessConfigured,
} from "@nullshift/billing/gocardless";
import { gocardlessEnvironment } from "./inbox";
import { ProviderError, type GoCardlessPort } from "./types";

const VERSION = "2015-07-06";

function baseUrl(): string {
  return process.env.GOCARDLESS_ENVIRONMENT === "live"
    ? "https://api.gocardless.com"
    : "https://api-sandbox.gocardless.com";
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.GOCARDLESS_ACCESS_TOKEN ?? ""}`,
    "GoCardless-Version": VERSION,
    ...extra,
  };
}

function classify(status: number, detail: string): ProviderError {
  const safe = detail.replace(/bearer\s+\S+/gi, "[redacted]").slice(0, 300);
  if (status === 429 || status >= 500)
    return new ProviderError("outage", `GoCardless → ${status}: ${safe}`, status);
  return new ProviderError("rejected", `GoCardless → ${status}: ${safe}`, status);
}

async function gcGet<T>(path: string): Promise<T | null> {
  if (!isGoCardlessConfigured())
    throw new ProviderError("unconfigured", "GoCardless is not configured.");
  let res: Response;
  try {
    res = await fetch(`${baseUrl()}${path}`, { headers: headers() });
  } catch (e) {
    throw new ProviderError(
      "outage",
      `GoCardless network error: ${(e as Error).message.slice(0, 120)}`
    );
  }
  if (res.status === 404) return null;
  if (!res.ok) throw classify(res.status, await res.text().catch(() => ""));
  return (await res.json()) as T;
}

type ConflictShape = {
  error?: {
    errors?: { reason?: string; links?: { conflicting_resource_id?: string } }[];
  };
};

async function gcPost<T>(
  path: string,
  body: Record<string, unknown>,
  idempotencyKey?: string
): Promise<{ data: T; conflictId: null } | { data: null; conflictId: string }> {
  if (!isGoCardlessConfigured())
    throw new ProviderError("unconfigured", "GoCardless is not configured.");
  let res: Response;
  try {
    res = await fetch(`${baseUrl()}${path}`, {
      method: "POST",
      headers: headers({
        "Content-Type": "application/json",
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      }),
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new ProviderError(
      "outage",
      `GoCardless network error: ${(e as Error).message.slice(0, 120)}`
    );
  }
  const text = await res.text().catch(() => "");
  if (res.status === 409) {
    try {
      const payload = JSON.parse(text) as ConflictShape;
      const conflict = payload.error?.errors?.find(
        (e) => e.reason === "idempotent_creation_conflict"
      )?.links?.conflicting_resource_id;
      if (conflict) return { data: null, conflictId: conflict };
    } catch {
      /* fall through */
    }
  }
  if (!res.ok) throw classify(res.status, text);
  return { data: JSON.parse(text) as T, conflictId: null };
}

/** The live port. `environment` is read from configuration once, at construction. */
export function liveGoCardlessPort(): GoCardlessPort {
  return {
    environment: gocardlessEnvironment(),
    async getPayment(ref) {
      if (!isGoCardlessConfigured())
        throw new ProviderError("unconfigured", "GoCardless is not configured.");
      const p = await getPayment(ref);
      if (!p) return null;
      return {
        id: p.id,
        status: p.status,
        amountMinor: p.amountPence,
        currency: "GBP",
        chargeDate: p.chargeDate,
        subscriptionRef: p.subscriptionId,
        mandateRef: p.mandateId,
      };
    },
    async getMandate(ref) {
      const data = await gcGet<{
        mandates: {
          id: string;
          status: string;
          links?: { customer?: string; new_mandate?: string };
        };
      }>(`/mandates/${encodeURIComponent(ref)}`);
      if (!data) return null;
      const m = data.mandates;
      return {
        id: m.id,
        status: m.status,
        customerRef: m.links?.customer ?? null,
        nextMandateRef: m.links?.new_mandate ?? null,
      };
    },
    async getBillingRequest(ref) {
      if (!isGoCardlessConfigured())
        throw new ProviderError("unconfigured", "GoCardless is not configured.");
      const br = await getBillingRequest(ref);
      if (!br) return null;
      return {
        id: br.id,
        status: br.status,
        mandateRef: br.mandateId,
        metadata: br.metadata,
      };
    },
    async getSubscription(ref) {
      const data = await gcGet<{
        subscriptions: {
          id: string;
          status: string;
          amount: number;
          currency: string;
          start_date?: string;
          upcoming_payments?: { charge_date: string }[];
          links?: { mandate?: string };
        };
      }>(`/subscriptions/${encodeURIComponent(ref)}`);
      if (!data) return null;
      const s = data.subscriptions;
      return {
        id: s.id,
        status: s.status,
        amountMinor: s.amount,
        currency: s.currency,
        startDate: s.start_date ?? null,
        nextChargeDate: s.upcoming_payments?.[0]?.charge_date ?? null,
        mandateRef: s.links?.mandate ?? null,
      };
    },
    async createSubscription(opts) {
      const r = await gcPost<{ subscriptions: { id: string } }>(
        "/subscriptions",
        {
          subscriptions: {
            amount: Math.round(opts.amountMinor),
            currency: opts.currency,
            interval_unit: opts.intervalUnit,
            interval: opts.intervalCount,
            start_date: opts.startDate,
            name: opts.name,
            metadata: opts.metadata,
            links: { mandate: opts.mandateRef },
          },
        },
        opts.idempotencyKey
      );
      if (r.data === null) return { subscriptionRef: r.conflictId, adopted: true };
      return { subscriptionRef: r.data.subscriptions.id, adopted: false };
    },
    async cancelPayment(ref) {
      try {
        await gcPost(`/payments/${encodeURIComponent(ref)}/actions/cancel`, { data: {} });
        return { ok: true };
      } catch (e) {
        if (e instanceof ProviderError && e.kind === "rejected") return { ok: false };
        throw e;
      }
    },
  };
}
