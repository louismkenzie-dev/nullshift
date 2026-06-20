import Stripe from "stripe";
import { applicationFeePence } from "./fees";

/**
 * Server-only Stripe client + thin helpers for Nullshift's two revenue lines:
 * build-milestone invoices, care subscriptions, and the clinic patient-payment
 * skim via Stripe Connect (2% application fee). Returns null when unconfigured so
 * callers can degrade gracefully. NEVER import from client components.
 */
let cached: Stripe | null = null;

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!cached) cached = new Stripe(key);
  return cached;
}

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

/**
 * Resolve a single Stripe customer for a client. Reuses a stored customer id if
 * it still exists (so the build invoice + care subscription share one customer),
 * else finds one by email, else creates it. Returns null when Stripe is
 * unconfigured. Callers should persist the returned id (tenants.stripe_customer_id).
 */
export async function findOrCreateCustomer(params: {
  email: string;
  name?: string;
  existingCustomerId?: string | null;
  /** Stable key (e.g. tenant id) so a racing create can't duplicate the customer. */
  idempotencyKey?: string;
}): Promise<string | null> {
  const stripe = getStripe();
  if (!stripe) return null;
  if (params.existingCustomerId) {
    try {
      const c = await stripe.customers.retrieve(params.existingCustomerId);
      if (c && !(c as Stripe.DeletedCustomer).deleted) return params.existingCustomerId;
    } catch {
      // Stored id no longer valid — fall through to find/create.
    }
  }
  const found = await stripe.customers.list({ email: params.email, limit: 1 });
  if (found.data[0]) return found.data[0].id;
  const created = await stripe.customers.create(
    { email: params.email, name: params.name },
    params.idempotencyKey ? { idempotencyKey: params.idempotencyKey } : undefined
  );
  return created.id;
}

/** Create + finalize a one-off / build-milestone invoice for a Stripe customer. */
export async function createBuildInvoice(params: {
  customerId: string;
  amountPence: number;
  description: string;
  currency?: string;
}): Promise<Stripe.Invoice | null> {
  const stripe = getStripe();
  if (!stripe) return null;
  const currency = params.currency ?? "gbp";
  await stripe.invoiceItems.create({
    customer: params.customerId,
    amount: params.amountPence,
    currency,
    description: params.description,
  });
  const invoice = await stripe.invoices.create({
    customer: params.customerId,
    collection_method: "send_invoice",
    days_until_due: 14,
    auto_advance: true,
  });
  if (invoice.id) await stripe.invoices.finalizeInvoice(invoice.id);
  return invoice;
}

/**
 * Create + finalize + send an ITEMISED invoice (one line per build module) to a
 * client by email — the "compile the builds into an invoice and send it" flow.
 * Finds or creates the Stripe customer, adds a line item per module, finalizes
 * and emails it. Returns the Stripe id + hosted payment URL. Amounts in PENCE.
 */
export async function createItemisedStripeInvoice(params: {
  customerId: string;
  items: { name: string; amountPence: number; quantity?: number }[];
  currency?: string;
}): Promise<{ id: string; url: string | null } | null> {
  const stripe = getStripe();
  if (!stripe || params.items.length === 0) return null;
  const currency = params.currency ?? "gbp";

  const invoice = await stripe.invoices.create({
    customer: params.customerId,
    collection_method: "send_invoice",
    days_until_due: 14,
    auto_advance: false,
  });
  if (!invoice.id) return null;

  for (const it of params.items) {
    await stripe.invoiceItems.create({
      customer: params.customerId,
      invoice: invoice.id,
      amount: Math.round(it.amountPence) * (it.quantity ?? 1),
      currency,
      description: it.name,
    });
  }

  await stripe.invoices.finalizeInvoice(invoice.id);
  await stripe.invoices.sendInvoice(invoice.id);
  const fresh = await stripe.invoices.retrieve(invoice.id);
  return { id: invoice.id, url: fresh.hosted_invoice_url ?? null };
}

/** Create a care subscription (recurring MRR) for a customer on a price. */
export async function createCareSubscription(params: {
  customerId: string;
  priceId: string;
}): Promise<Stripe.Subscription | null> {
  const stripe = getStripe();
  if (!stripe) return null;
  return stripe.subscriptions.create({
    customer: params.customerId,
    items: [{ price: params.priceId }],
  });
}

/**
 * Create a recurring monthly care-plan subscription billed by emailed invoice
 * (no saved card needed) — Stripe generates + emails an invoice each month. Uses
 * inline price_data so we don't need a pre-created Stripe Price per plan. The
 * plan id is stamped in metadata so the webhook can map it back. Amount in PENCE.
 */
export async function createCareSubscriptionInvoiced(params: {
  customerId: string;
  planId: string;
  planLabel: string;
  amountPence: number;
  currency?: string;
}): Promise<{ id: string; status: string } | null> {
  const stripe = getStripe();
  if (!stripe) return null;
  const currency = params.currency ?? "gbp";

  // Never double-bill: if this customer already has a non-terminal subscription,
  // reuse it instead of creating a second one.
  const existingSubs = await stripe.subscriptions.list({
    customer: params.customerId,
    status: "all",
    limit: 20,
  });
  const live = existingSubs.data.find((s) =>
    ["active", "trialing", "past_due", "unpaid"].includes(s.status)
  );
  if (live) return { id: live.id, status: live.status };

  // Subscription price_data needs a Product *id* (inline product_data isn't
  // allowed here, unlike invoice items). Reuse one Product per plan, keyed by
  // metadata, creating it once if absent.
  let productId: string | null = null;
  try {
    const found = await stripe.products.search({
      query: `active:'true' AND metadata['nullshift_plan']:'${params.planId}'`,
      limit: 1,
    });
    productId = found.data[0]?.id ?? null;
  } catch {
    // Product search unavailable — fall through to create.
  }
  if (!productId) {
    const product = await stripe.products.create({
      name: `Nullshift ${params.planLabel} care plan`,
      metadata: { nullshift_plan: params.planId },
    });
    productId = product.id;
  }

  const sub = await stripe.subscriptions.create({
    customer: params.customerId,
    collection_method: "send_invoice",
    days_until_due: 14,
    items: [
      {
        price_data: {
          currency,
          product: productId,
          recurring: { interval: "month" },
          unit_amount: Math.round(params.amountPence),
        },
      },
    ],
    metadata: { plan: params.planId },
  });
  return { id: sub.id, status: sub.status };
}

/**
 * Take a patient payment through a clinic's connected account, skimming the 2%
 * Nullshift application fee (the "Stripe + 2%" mechanism). Only for clients who
 * take patient payments through the system.
 */
export async function createConnectPaymentIntent(params: {
  amountPence: number;
  connectedAccountId: string;
  currency?: string;
  description?: string;
}): Promise<Stripe.PaymentIntent | null> {
  const stripe = getStripe();
  if (!stripe) return null;
  return stripe.paymentIntents.create({
    amount: params.amountPence,
    currency: params.currency ?? "gbp",
    description: params.description,
    application_fee_amount: applicationFeePence(params.amountPence),
    transfer_data: { destination: params.connectedAccountId },
  });
}
