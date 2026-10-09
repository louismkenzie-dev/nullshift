import Stripe from "stripe";
import { createServiceClient } from "@nullshift/db";
import { stripeConfig } from "@nullshift/billing/config";
import { findOrCreateCustomer, getStripe } from "@nullshift/billing/stripe";
import { PRODUCTS, type ProductSlug } from "@nullshift/content/products";
import { entitlementFor } from "./entitlement";

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/**
 * Hosted Stripe Checkout for a self-serve product. Subscription mode, monthly,
 * `metadata.product` + `metadata.tenant_id` on the subscription so the webhook
 * can route the event to `product_subscriptions` and never to the bespoke
 * care-plan table.
 *
 * Any remaining trial carries over: Stripe starts billing when our trial would
 * have ended, so adding a card on day 3 does not charge on day 3.
 */
export async function createProductCheckoutUrl(opts: {
  tenantId: string;
  tenantName: string;
  email: string;
  product: ProductSlug;
}): Promise<{ url: string } | { error: string }> {
  const stripe = getStripe();
  if (!stripe)
    return {
      error:
        "Card payments are not configured yet. Email hello@nullshift.co.uk and we will set you up by hand.",
    };

  const p = PRODUCTS[opts.product];
  const current = await entitlementFor(opts.tenantId, opts.product);
  if (current.row?.stripe_subscription_id && current.entitled) {
    return { error: "This product already has a card on file. Manage it from Billing." };
  }

  const service = createServiceClient();
  const customerId =
    current.row?.stripe_customer_id ??
    (await findOrCreateCustomer({
      email: opts.email,
      name: opts.tenantName,
      idempotencyKey: `product-customer/${opts.tenantId}`,
    }));
  if (!customerId) return { error: "Could not create a billing customer." };

  const trialEnd = current.row?.trial_ends_at
    ? new Date(current.row.trial_ends_at)
    : null;
  const trialEndUnix =
    trialEnd && trialEnd.getTime() > Date.now() + 2 * 86_400_000
      ? Math.floor(trialEnd.getTime() / 1000)
      : undefined;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: opts.tenantId,
    allow_promotion_codes: true,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "gbp",
          product_data: {
            name: p.title,
            description: p.tagline,
            metadata: { product: p.slug },
          },
          recurring: { interval: "month" },
          unit_amount: p.pricePence,
        },
      },
    ],
    subscription_data: {
      metadata: { product: p.slug, tenant_id: opts.tenantId },
      ...(trialEndUnix ? { trial_end: trialEndUnix } : {}),
    },
    metadata: { product: p.slug, tenant_id: opts.tenantId },
    success_url: `${siteUrl()}/app/billing?checkout=success&product=${p.slug}`,
    cancel_url: `${siteUrl()}/app/billing?checkout=cancelled&product=${p.slug}`,
  });

  // Remember the customer so a second product reuses it.
  await service.from("product_subscriptions").upsert(
    {
      tenant_id: opts.tenantId,
      product: p.slug,
      stripe_customer_id: customerId,
      price_pence: p.pricePence,
      ...(current.row ? {} : { status: "incomplete" }),
    },
    { onConflict: "tenant_id,product" }
  );

  return session.url
    ? { url: session.url }
    : { error: "Stripe did not return a checkout link." };
}

/** Stripe's hosted billing portal — update card, cancel, download invoices. */
export async function createBillingPortalUrl(opts: {
  tenantId: string;
}): Promise<{ url: string } | { error: string }> {
  const stripe = getStripe();
  if (!stripe) return { error: "Billing portal is not configured." };
  const service = createServiceClient();
  const { data } = await service
    .from("product_subscriptions")
    .select("stripe_customer_id")
    .eq("tenant_id", opts.tenantId)
    .not("stripe_customer_id", "is", null)
    .limit(1)
    .maybeSingle();
  const customerId = (data as { stripe_customer_id: string | null } | null)
    ?.stripe_customer_id;
  if (!customerId) return { error: "No card on file yet." };
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${siteUrl()}/app/billing`,
  });
  return { url: session.url };
}

export function stripeStatusToProduct(s: Stripe.Subscription.Status): string {
  switch (s) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "unpaid":
      return "unpaid";
    case "incomplete":
    case "incomplete_expired":
      return "incomplete";
    case "canceled":
    case "paused":
    default:
      return "canceled";
  }
}

/**
 * Webhook helper: mirror a Stripe subscription that carries
 * `metadata.product` into product_subscriptions. Returns false when the
 * subscription is not one of ours (no product metadata), so the caller can
 * fall through to the bespoke care-plan branch.
 */
export async function syncProductSubscription(
  sub: Stripe.Subscription
): Promise<boolean> {
  const product = sub.metadata?.product;
  const tenantId = sub.metadata?.tenant_id;
  if (!product || !tenantId || !(product in PRODUCTS)) return false;
  const service = createServiceClient();
  const customerId =
    typeof sub.customer === "string" ? sub.customer : (sub.customer?.id ?? null);
  const item = sub.items?.data?.[0];
  const periodEnd =
    (item as unknown as { current_period_end?: number } | undefined)
      ?.current_period_end ??
    (sub as unknown as { current_period_end?: number }).current_period_end;
  await service.from("product_subscriptions").upsert(
    {
      tenant_id: tenantId,
      product,
      status: stripeStatusToProduct(sub.status),
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      price_pence:
        item?.price?.unit_amount ?? PRODUCTS[product as ProductSlug].pricePence,
      trial_ends_at: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: sub.cancel_at_period_end ?? false,
      canceled_at: sub.canceled_at
        ? new Date(sub.canceled_at * 1000).toISOString()
        : null,
    },
    { onConflict: "tenant_id,product" }
  );
  return true;
}

export function stripeReady(): boolean {
  return Boolean(stripeConfig.secretKey);
}
