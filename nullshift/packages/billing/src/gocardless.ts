import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Server-only GoCardless client for care-plan Direct Debits (Bacs) — the
 * alternative rail to the Stripe card subscription. Plain REST via fetch (no
 * SDK). Mirrors stripe.ts house style: helpers return null when unconfigured
 * so callers can degrade gracefully. NEVER import from client components.
 *
 * Flow: startCareDirectDebit() creates a billing request + hosted flow and the
 * client authorises the mandate on GoCardless's page; the webhook
 * (apps/web/app/api/gocardless/webhook) then calls createCareSubscription()
 * against the new mandate and activates our subscriptions row.
 */

const GOCARDLESS_VERSION = "2015-07-06";

function gcBaseUrl(): string {
  return process.env.GOCARDLESS_ENVIRONMENT === "live"
    ? "https://api.gocardless.com"
    : "https://api-sandbox.gocardless.com";
}

export function isGoCardlessConfigured(): boolean {
  return !!process.env.GOCARDLESS_ACCESS_TOKEN;
}

/**
 * POST to the GoCardless API; throws with the API's error message on failure.
 * Pass an idempotencyKey for any create that must survive retries without
 * duplicating (GoCardless replays the original response for a reused key).
 */
async function gcPost<T>(
  path: string,
  body: Record<string, unknown>,
  idempotencyKey?: string
): Promise<T> {
  const res = await fetch(`${gcBaseUrl()}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GOCARDLESS_ACCESS_TOKEN}`,
      "GoCardless-Version": GOCARDLESS_VERSION,
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const payload = (await res.json()) as {
        error?: {
          message?: string;
          errors?: { message?: string; field?: string }[];
        };
      };
      const details = payload.error?.errors
        ?.map((e) => (e.field ? `${e.field} ${e.message}` : e.message))
        .filter(Boolean)
        .join("; ");
      message =
        [payload.error?.message, details].filter(Boolean).join(": ") || message;
    } catch {
      // Non-JSON error body — keep the status line.
    }
    throw new Error(`GoCardless ${path} failed: ${message}`);
  }
  return (await res.json()) as T;
}

/**
 * Start the Direct Debit sign-up for a care plan: creates a billing request
 * with a Bacs mandate request (metadata carries tenant_id + plan so the
 * webhook can map it back), then a hosted billing request flow the client
 * opens to authorise the mandate. Returns the authorisation URL plus the
 * billing request id — persist the id (subscriptions.gc_billing_request_id)
 * so the `billing_requests.fulfilled` webhook can find the pending row.
 * Null when unconfigured; throws on GoCardless API errors.
 */
export async function startCareDirectDebit(opts: {
  tenantId: string;
  plan: string;
  amountPence: number;
  description: string;
  email: string;
  name?: string | null;
  origin: string;
}): Promise<{ url: string; billingRequestId: string } | null> {
  if (!isGoCardlessConfigured()) return null;

  const br = await gcPost<{ billing_requests: { id: string } }>(
    "/billing_requests",
    {
      billing_requests: {
        mandate_request: { scheme: "bacs", currency: "GBP", verify: "recommended" },
        metadata: { tenant_id: opts.tenantId, plan: opts.plan },
      },
    }
  );
  const billingRequestId = br.billing_requests.id;

  // Prefill what we know so the client only confirms bank details. The stored
  // name may be a person or a company — offer it as both.
  const prefilled: Record<string, string> = { email: opts.email };
  const name = opts.name?.trim();
  if (name) {
    const parts = name.split(/\s+/);
    prefilled.given_name = parts[0]!;
    if (parts.length > 1) prefilled.family_name = parts.slice(1).join(" ");
    prefilled.company_name = name;
  }

  const flow = await gcPost<{
    billing_request_flows: { authorisation_url: string };
  }>("/billing_request_flows", {
    billing_request_flows: {
      redirect_uri: `${opts.origin}/portal/plan?dd=authorised`,
      exit_uri: `${opts.origin}/portal/plan?dd=exit`,
      prefilled_customer: prefilled,
      lock_currency: true,
      links: { billing_request: billingRequestId },
    },
  });

  return { url: flow.billing_request_flows.authorisation_url, billingRequestId };
}

/**
 * Create the monthly GoCardless subscription against an authorised mandate —
 * called by the webhook once `billing_requests.fulfilled` arrives. Amount in
 * PENCE. Null when unconfigured; throws on GoCardless API errors.
 */
export async function createCareSubscription(opts: {
  mandateId: string;
  plan: string;
  amountPence: number;
  description: string;
  /**
   * Stable key across webhook re-deliveries (use the billing request id) so a
   * retried create can never double-bill the same mandate.
   */
  idempotencyKey?: string;
}): Promise<{ subscriptionId: string } | null> {
  if (!isGoCardlessConfigured()) return null;

  const sub = await gcPost<{ subscriptions: { id: string } }>(
    "/subscriptions",
    {
      subscriptions: {
        amount: Math.round(opts.amountPence),
        currency: "GBP",
        interval_unit: "monthly",
        name: opts.description,
        metadata: { plan: opts.plan },
        links: { mandate: opts.mandateId },
      },
    },
    opts.idempotencyKey
  );
  return { subscriptionId: sub.subscriptions.id };
}

/**
 * Cancel a billing request whose authorisation link is being superseded, so
 * the OLD emailed/open link can no longer be completed into a mandate we've
 * stopped tracking. Best-effort by design: an already-completed or already-
 * cancelled request 4xxes, which callers treat as "nothing to cancel".
 */
export async function cancelBillingRequest(id: string): Promise<boolean> {
  if (!isGoCardlessConfigured()) return false;
  try {
    await gcPost(`/billing_requests/${id}/actions/cancel`, { data: {} });
    return true;
  } catch (e) {
    console.warn(`cancelBillingRequest(${id}):`, (e as Error).message);
    return false;
  }
}

/**
 * Fetch a billing request — the webhook's fallback for mapping a fulfilled
 * request back to a tenant via its metadata when our pending row is missing
 * (e.g. it was superseded after the client had already opened the old link).
 */
export async function getBillingRequest(id: string): Promise<{
  id: string;
  status: string;
  metadata: Record<string, string>;
  mandateId: string | null;
} | null> {
  if (!isGoCardlessConfigured()) return null;
  const res = await fetch(`${gcBaseUrl()}/billing_requests/${id}`, {
    headers: {
      Authorization: `Bearer ${process.env.GOCARDLESS_ACCESS_TOKEN}`,
      "GoCardless-Version": GOCARDLESS_VERSION,
    },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    billing_requests: {
      id: string;
      status: string;
      metadata?: Record<string, string>;
      links?: { mandate_request_mandate?: string };
    };
  };
  const br = data.billing_requests;
  return {
    id: br.id,
    status: br.status,
    metadata: br.metadata ?? {},
    mandateId: br.links?.mandate_request_mandate ?? null,
  };
}

/**
 * Verify a GoCardless webhook: HMAC-SHA256 hex digest of the raw body with
 * GOCARDLESS_WEBHOOK_SECRET, compared timing-safe against the
 * Webhook-Signature header. False when the secret or header is missing.
 */
export function verifyGoCardlessWebhook(
  rawBody: string,
  signatureHeader: string | null
): boolean {
  const secret = process.env.GOCARDLESS_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signatureHeader.trim(), "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
