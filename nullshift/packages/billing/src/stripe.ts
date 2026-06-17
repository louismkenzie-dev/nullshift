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
