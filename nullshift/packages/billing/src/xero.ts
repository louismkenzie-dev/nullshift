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
    throw new Error(
      `Xero ${init?.method ?? "GET"} ${path} → ${res.status}: ${text.slice(0, 500)}`
    );
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

/**
 * Xero as the invoice rail (not just the mirror). When configured, invoices
 * are raised in Xero first and the client gets Xero's online invoice link —
 * which carries a "Pay now" button once a payment service (Stripe, GoCardless)
 * is connected to the organisation in Xero. Set INVOICE_RAIL=stripe to keep
 * Stripe hosted invoices as the client-facing document while still mirroring.
 */
export function isXeroPrimary(): boolean {
  return isXeroConfigured() && (process.env.INVOICE_RAIL || "xero") !== "stripe";
}

type OnlineInvoiceResponse = { OnlineInvoices?: { OnlineInvoiceUrl?: string }[] };

/** The shareable online-invoice URL for an AUTHORISED sales invoice. */
export async function getXeroOnlineInvoiceUrl(
  xeroInvoiceId: string
): Promise<string | null> {
  if (!isXeroConfigured()) return null;
  const res = await xeroFetch<OnlineInvoiceResponse>(
    `/Invoices/${encodeURIComponent(xeroInvoiceId)}/OnlineInvoice`
  );
  return res?.OnlineInvoices?.[0]?.OnlineInvoiceUrl ?? null;
}

export type XeroInvoiceStatus = {
  status: string;
  invoiceNumber: string | null;
  amountDue: number;
  amountPaid: number;
  fullyPaidOnDate: string | null;
};

type InvoiceDetailResponse = {
  Invoices?: {
    Status?: string;
    InvoiceNumber?: string;
    AmountDue?: number;
    AmountPaid?: number;
    FullyPaidOnDate?: string;
  }[];
};

/** Xero /Date(1693526400000+0000)/ → ISO; ISO passes through. */
function xeroDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const m = raw.match(/\/Date\((-?\d+)/);
  if (m) return new Date(Number(m[1])).toISOString();
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Current status of a Xero invoice — used to notice payments taken in Xero. */
export async function getXeroInvoiceStatus(
  xeroInvoiceId: string
): Promise<XeroInvoiceStatus | null> {
  if (!isXeroConfigured()) return null;
  const res = await xeroFetch<InvoiceDetailResponse>(
    `/Invoices/${encodeURIComponent(xeroInvoiceId)}`
  );
  const inv = res?.Invoices?.[0];
  if (!inv?.Status) return null;
  return {
    status: inv.Status,
    invoiceNumber: inv.InvoiceNumber ?? null,
    amountDue: Number(inv.AmountDue ?? 0),
    amountPaid: Number(inv.AmountPaid ?? 0),
    fullyPaidOnDate: xeroDate(inv.FullyPaidOnDate),
  };
}

/* ── Setup status — answers "have I wired Xero up right?" in-product ── */

export type XeroAccountInfo = {
  code: string;
  name: string;
  type: string;
  status: string;
  /** Bank accounts only: sort code + account number as Xero holds them. */
  bankAccountNumber: string | null;
};

export type XeroSetupStatus = {
  configured: boolean;
  /** Xero raises the invoices clients receive (vs. Stripe with Xero as mirror). */
  primary: boolean;
  organisation: { name: string; shortCode: string | null } | null;
  paymentAccountCode: string | null;
  paymentAccount: XeroAccountInfo | null;
  salesAccountCode: string;
  salesAccount: XeroAccountInfo | null;
  /** The custom connection lacks accounting.settings.read — accounts can't be checked. */
  needsSettingsScope: boolean;
  error: string | null;
};

type OrganisationResponse = { Organisations?: { Name?: string; ShortCode?: string }[] };
type AccountsResponse = {
  Accounts?: {
    Code?: string;
    Name?: string;
    Type?: string;
    Status?: string;
    BankAccountNumber?: string;
  }[];
};

async function accountByCode(code: string): Promise<XeroAccountInfo | null> {
  const res = await xeroFetch<AccountsResponse>(
    `/Accounts?where=${encodeURIComponent(`Code=="${code.replace(/"/g, "")}"`)}`
  );
  const a = res?.Accounts?.[0];
  if (!a?.Code) return null;
  return {
    code: a.Code,
    name: a.Name ?? "",
    type: a.Type ?? "",
    status: a.Status ?? "",
    bankAccountNumber: a.BankAccountNumber ?? null,
  };
}

/**
 * Live check of the Xero wiring: token exchange, which organisation the
 * custom connection is bound to, and whether the configured payment and
 * sales account codes resolve to real, active accounts. Never throws — the
 * billing page renders whatever could be established plus the error.
 */
export async function getXeroSetupStatus(): Promise<XeroSetupStatus> {
  const paymentAccountCode = process.env.XERO_PAYMENT_ACCOUNT_CODE || null;
  const salesAccountCode = process.env.XERO_SALES_ACCOUNT_CODE || "200";
  const base: XeroSetupStatus = {
    configured: isXeroConfigured(),
    primary: isXeroPrimary(),
    organisation: null,
    paymentAccountCode,
    paymentAccount: null,
    salesAccountCode,
    salesAccount: null,
    needsSettingsScope: false,
    error: null,
  };
  if (!base.configured) return base;
  // The token exchange is the credentials test. Past it, a 401 or 403 on a
  // resource means the token lacks a scope (Xero answers 401
  // "AuthorizationUnsuccessful" for a missing scope, not 403).
  try {
    await getToken();
  } catch (e) {
    return { ...base, error: (e instanceof Error ? e.message : String(e)).slice(0, 300) };
  }
  const scopeProblem = (msg: string) => /→ 40[13]\b/.test(msg);
  try {
    // Organisation needs accounting.settings(.read).
    const org = await xeroFetch<OrganisationResponse>("/Organisation");
    const o = org?.Organisations?.[0];
    if (o?.Name) base.organisation = { name: o.Name, shortCode: o.ShortCode ?? null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!scopeProblem(msg)) return { ...base, error: msg.slice(0, 300) };
    base.needsSettingsScope = true;
    // Prove the connection with a scope we do have (accounting.transactions).
    // If that fails too, the app is not authorised for the organisation.
    try {
      await xeroFetch("/Invoices?page=1&pageSize=1");
    } catch (e2) {
      const msg2 = e2 instanceof Error ? e2.message : String(e2);
      return {
        ...base,
        needsSettingsScope: false,
        error: scopeProblem(msg2)
          ? "the custom connection is not authorised for the organisation — open it at developer.xero.com and Connect"
          : msg2.slice(0, 300),
      };
    }
    return base;
  }
  try {
    base.salesAccount = await accountByCode(salesAccountCode);
    if (paymentAccountCode) base.paymentAccount = await accountByCode(paymentAccountCode);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (scopeProblem(msg)) base.needsSettingsScope = true;
    else base.error = msg.slice(0, 300);
  }
  return base;
}
