import {
  findOrCreateCustomer,
  createSubscriptionCheckoutUrl,
} from "@nullshift/billing/stripe";
import { createServiceClient } from "@nullshift/db";
import { carePlan } from "./carePlans";
import { sendEmail } from "./sendEmail";
import { subscriptionSignupEmail } from "./clientEmails";

type Service = ReturnType<typeof createServiceClient>;

export type SubStatus = "trialing" | "active" | "past_due" | "canceled" | "incomplete";

/** Map a Stripe subscription status onto our subscription_status enum. */
export function mapStripeSubStatus(s: string): SubStatus {
  switch (s) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
      return "canceled";
    default:
      // incomplete, incomplete_expired, paused
      return "incomplete";
  }
}

/**
 * Email the client a Stripe Checkout sign-up for their care plan — they open it,
 * enter their card and authorise the recurring monthly plan. Mirrors the build-
 * invoice flow: the admin sends it, the client completes it, and the webhook
 * flips it to active. Records a local 'incomplete' subscription row so the admin
 * sees "awaiting completion" until they sign up. Idempotent: a no-op if already
 * actively subscribed. Best-effort. Service-role only.
 */
export async function sendCareSubscriptionSignup(
  service: Service,
  opts: { tenantId: string; planId: string; siteUrl: string }
): Promise<{ ok: boolean; emailed: boolean; alreadyActive?: boolean }> {
  const plan = carePlan(opts.planId);
  if (!plan) return { ok: false, emailed: false };

  // Already actively subscribed? no-op (don't double-bill).
  const { data: active } = await service
    .from("subscriptions")
    .select("id")
    .eq("tenant_id", opts.tenantId)
    .in("status", ["active", "trialing", "past_due"])
    .not("stripe_subscription_id", "is", null)
    .limit(1);
  if (active?.length) return { ok: true, emailed: false, alreadyActive: true };

  // Resolve the client's email + the tenant's shared Stripe customer.
  const { data: tenantRow } = await service
    .from("tenants")
    .select("name, contact_name, stripe_customer_id")
    .eq("id", opts.tenantId)
    .maybeSingle();
  const { data: membership } = await service
    .from("memberships")
    .select("user_id")
    .eq("tenant_id", opts.tenantId)
    .eq("role", "client_admin")
    .limit(1)
    .maybeSingle();
  let email: string | null = null;
  if (membership?.user_id) {
    const { data: u } = await service.auth.admin.getUserById(membership.user_id);
    email = u.user?.email ?? null;
  }
  if (!email) return { ok: false, emailed: false };

  const customerId = await findOrCreateCustomer({
    email,
    name: tenantRow?.name ?? undefined,
    existingCustomerId: tenantRow?.stripe_customer_id ?? null,
    idempotencyKey: `customer:${opts.tenantId}`,
  });
  if (!customerId) return { ok: false, emailed: false };
  if (customerId !== tenantRow?.stripe_customer_id) {
    await service
      .from("tenants")
      .update({ stripe_customer_id: customerId })
      .eq("id", opts.tenantId)
      .is("stripe_customer_id", null);
  }

  const checkout = await createSubscriptionCheckoutUrl({
    customerId,
    tenantId: opts.tenantId,
    planId: plan.id,
    planLabel: plan.label,
    amountPence: Math.round(plan.mrr * 100),
    successUrl: `${opts.siteUrl}/portal?care=active`,
    cancelUrl: `${opts.siteUrl}/portal`,
  });
  if (!checkout) return { ok: false, emailed: false };
  if (checkout.alreadyActive) return { ok: true, emailed: false, alreadyActive: true };
  if (!checkout.url) return { ok: false, emailed: false };

  // Record/keep a pending 'incomplete' row so the admin sees "awaiting completion"
  // until the client finishes the Checkout (the webhook flips it to active).
  const { data: pending } = await service
    .from("subscriptions")
    .select("id")
    .eq("tenant_id", opts.tenantId)
    .is("stripe_subscription_id", null)
    .neq("status", "canceled")
    .limit(1)
    .maybeSingle();
  if (pending) {
    await service
      .from("subscriptions")
      .update({ plan: plan.id, mrr: plan.mrr, status: "incomplete" })
      .eq("id", pending.id);
  } else {
    await service.from("subscriptions").insert({
      tenant_id: opts.tenantId,
      plan: plan.id,
      mrr: plan.mrr,
      status: "incomplete",
      stripe_subscription_id: null,
      started_at: new Date().toISOString(),
    });
  }

  const mail = subscriptionSignupEmail({
    name: tenantRow?.contact_name ?? tenantRow?.name ?? "there",
    planLabel: plan.label,
    mrr: plan.mrr,
    url: checkout.url,
  });
  const sent = await sendEmail({
    to: email,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
  });
  return { ok: true, emailed: sent };
}
