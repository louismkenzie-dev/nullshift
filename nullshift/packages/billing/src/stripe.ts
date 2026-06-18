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
  customerEmail: string;
  customerName?: string;
  items: { name: string; amountPence: number; quantity?: number }[];
  currency?: string;
}): Promise<{ id: string; url: string | null } | null> {
  const stripe = getStripe();
  if (!stripe || params.items.length === 0) return null;
  const currency = params.currency ?? "gbp";

  const found = await stripe.customers.list({ email: params.customerEmail, limit: 1 });
  const customer =
    found.data[0] ??
    (await stripe.customers.create({
      email: params.customerEmail,
      name: params.customerName,
    }));

  const invoice = await stripe.invoices.create({
    customer: customer.id,
    collection_method: "send_invoice",
    days_until_due: 14,
    auto_advance: false,
  });
  if (!invoice.id) return null;

  for (const it of params.items) {
    await stripe.invoiceItems.create({
      customer: customer.id,
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
