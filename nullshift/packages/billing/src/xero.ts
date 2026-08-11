/**
 * Xero accounting sync — a thin REST client for a Xero CUSTOM CONNECTION
 * (machine-to-machine OAuth client_credentials, bound to one organisation, so
 * there is no interactive consent and no Xero-tenant-id header). Mirrors the
 * Stripe/GoCardless house style: null / no-op when unconfigured so callers can
 * degrade gracefully, throw with the API's message on real errors.
 *
 * Env:
 *   XERO_CLIENT_ID / XERO_CLIENT_SECRET — from developer.xero.com → New app →
 *     Custom connection, scopes accounting.transactions + accounting.contacts,
 *     authorised against the Nullshift organisation.
 *   XERO_SALES_ACCOUNT_CODE   — revenue account for invoice lines (default 200).
 *   XERO_PAYMENT_ACCOUNT_CODE — bank account (with "enable payments") used when
 *     recording payments. Optional: unset = invoices sync but payments don't.
 *   XERO_TAX_TYPE — line tax type (default "NONE"; set e.g. "OUTPUT2" for 20%
 *     VAT once VAT-registered).
 */

const TOKEN_URL = "https://identity.xero.com/connect/token";
const API = "https://api.xero.com/api.xro/2.0";

export function isXeroConfigured(): boolean {
  return !!(process.env.XERO_CLIENT_ID && process.env.XERO_CLIENT_SECRET);
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string | null> {
  if (!isXeroConfigured()) return null;
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000)
    return cachedToken.token;
  const basic = Buffer.from(
    `${process.env.XERO_CLIENT_ID}:${process.env.XERO_CLIENT_SECRET}`
  ).toString("base64");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Xero token request failed (${res.status}): ${detail.slice(0, 300)}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return data.access_token;
}

async function xeroFetch<T>(
  path: string,
  init?: { method?: "GET" | "POST" | "PUT"; body?: unknown }
): Promise<T | null> {
  const token = await getToken();
  if (!token) return null;
  const res = await fetch(`${API}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(init?.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Xero ${init?.method ?? "GET"} ${path} → ${res.status}: ${text.slice(0, 500)}`);
  }
  return text ? (JSON.parse(text) as T) : null;
}

type ContactsResponse = {
  Contacts?: { ContactID: string; Name: string; EmailAddress?: string }[];
};

/**
 * Resolve a Xero contact for a client: reuse a stored id, else match by email,
 * else by exact name (Xero names are unique), else create. Returns null when
 * Xero is unconfigured.
 */
export async function findOrCreateXeroContact(opts: {
  name: string;
  email?: string | null;
  existingContactId?: string | null;
}): Promise<string | null> {
  if (!isXeroConfigured()) return null;
  if (opts.existingContactId) return opts.existingContactId;

  const esc = (s: string) => s.replace(/"/g, '\\"');
  if (opts.email) {
    const byEmail = await xeroFetch<ContactsResponse>(
      `/Contacts?where=${encodeURIComponent(`EmailAddress=="${esc(opts.email)}"`)}`
    );
    const hit = byEmail?.Contacts?.[0];
    if (hit) return hit.ContactID;
  }
  const byName = await xeroFetch<ContactsResponse>(
    `/Contacts?where=${encodeURIComponent(`Name=="${esc(opts.name)}"`)}`
  );
  const nameHit = byName?.Contacts?.[0];
  if (nameHit) return nameHit.ContactID;

  const created = await xeroFetch<ContactsResponse>("/Contacts", {
    method: "POST",
    body: {
      Contacts: [
        {
          Name: opts.name,
          ...(opts.email ? { EmailAddress: opts.email } : {}),
        },
      ],
    },
  });
  return created?.Contacts?.[0]?.ContactID ?? null;
}

type InvoicesResponse = { Invoices?: { InvoiceID: string; InvoiceNumber?: string }[] };

/**
 * Create an authorised ACCREC (sales) invoice. Line amounts are gross (no tax
 * added — LineAmountTypes NoTax with the configured TaxType, default NONE).
 * Negative lines (e.g. "Less: deposit received") are fine as long as the
 * invoice total stays positive.
 */
export async function createXeroInvoice(opts: {
  contactId: string;
  reference: string;
  dateISO?: string;
  dueDateISO?: string | null;
  lineItems: { description: string; amount: number }[];
}): Promise<{ invoiceId: string; invoiceNumber: string | null } | null> {
  if (!isXeroConfigured()) return null;
  const accountCode = process.env.XERO_SALES_ACCOUNT_CODE || "200";
  const taxType = process.env.XERO_TAX_TYPE || "NONE";
  const date = (opts.dateISO ?? new Date().toISOString()).slice(0, 10);
  const res = await xeroFetch<InvoicesResponse>("/Invoices", {
    method: "POST",
    body: {
      Invoices: [
        {
          Type: "ACCREC",
          Contact: { ContactID: opts.contactId },
          Date: date,
          DueDate: (opts.dueDateISO ?? opts.dateISO ?? new Date().toISOString()).slice(
            0,
            10
          ),
          Reference: opts.reference,
          Status: "AUTHORISED",
          LineAmountTypes: "NoTax",
          CurrencyCode: "GBP",
          LineItems: opts.lineItems.map((l) => ({
            Description: l.description,
            Quantity: 1,
            UnitAmount: l.amount,
            AccountCode: accountCode,
            TaxType: taxType,
          })),
        },
      ],
    },
  });
  const inv = res?.Invoices?.[0];
  return inv
    ? { invoiceId: inv.InvoiceID, invoiceNumber: inv.InvoiceNumber ?? null }
    : null;
}

/**
 * Record a payment against a Xero invoice (marks it paid in Xero). Requires
 * XERO_PAYMENT_ACCOUNT_CODE — a bank account with "enable payments to this
 * account" ticked. No-op (null) when that or Xero itself is unconfigured.
 */
export async function recordXeroPayment(opts: {
  xeroInvoiceId: string;
  amount: number;
  dateISO?: string;
}): Promise<{ ok: boolean } | null> {
  if (!isXeroConfigured()) return null;
  const account = process.env.XERO_PAYMENT_ACCOUNT_CODE;
  if (!account) return null;
  await xeroFetch("/Payments", {
    method: "PUT",
    body: {
      Payments: [
        {
          Invoice: { InvoiceID: opts.xeroInvoiceId },
          Account: { Code: account },
          Date: (opts.dateISO ?? new Date().toISOString()).slice(0, 10),
          Amount: opts.amount,
        },
      ],
    },
  });
  return { ok: true };
}
