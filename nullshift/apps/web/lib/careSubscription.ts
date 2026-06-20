import {
  findOrCreateCustomer,
  createCareSubscriptionInvoiced,
} from "@nullshift/billing/stripe";
import { createServiceClient } from "@nullshift/db";
import { carePlan } from "./carePlans";

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
 * Activate the client's care plan as a REAL recurring Stripe subscription, billed
 * by an emailed invoice each month (no saved card needed — Stripe emails the
 * client). Records it locally with the Stripe id + status. Idempotent: a no-op if
 * the tenant already has a real (non-terminal) Stripe subscription. Best-effort —
 * if Stripe isn't configured or the call fails it writes a local 'incomplete'
 * record (not counted as MRR) that a later run can complete. Service-role only.
 */
export async function ensureCareSubscription(
  service: Service,
  opts: { tenantId: string; planId: string }
): Promise<{ ok: boolean; stripe: boolean }> {
  const plan = carePlan(opts.planId);
  if (!plan) return { ok: false, stripe: false };

  // Don't double-subscribe: skip only if there's already a REAL Stripe
  // subscription in a non-terminal state. A local-only "incomplete" row (Stripe
  // failed earlier) must NOT suppress a retry. (createCareSubscriptionInvoiced
  // also reuses an existing Stripe sub, as a second line of defence.)
  const { data: existing } = await service
    .from("subscriptions")
    .select("id")
    .eq("tenant_id", opts.tenantId)
    .in("status", ["active", "trialing", "past_due"])
    .not("stripe_subscription_id", "is", null)
    .limit(1);
  if (existing?.length) return { ok: true, stripe: false };

  // Resolve the client's email + the tenant's shared Stripe customer.
  const { data: tenantRow } = await service
    .from("tenants")
    .select("name, stripe_customer_id")
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

  let stripeSubId: string | null = null;
  // Default to 'incomplete' — only a real Stripe subscription flips this to a
  // billable status. This keeps unbilled rows out of MRR and lets a later run
  // retry the Stripe creation (the dedupe above ignores incomplete rows).
  let status: SubStatus = "incomplete";
  if (email) {
    try {
      const customerId = await findOrCreateCustomer({
        email,
        name: tenantRow?.name ?? undefined,
        existingCustomerId: tenantRow?.stripe_customer_id ?? null,
        idempotencyKey: `customer:${opts.tenantId}`,
      });
      if (customerId) {
        if (customerId !== tenantRow?.stripe_customer_id) {
          await service
            .from("tenants")
            .update({ stripe_customer_id: customerId })
            .eq("id", opts.tenantId)
            .is("stripe_customer_id", null);
        }
        const sub = await createCareSubscriptionInvoiced({
          customerId,
          planId: plan.id,
          planLabel: plan.label,
          amountPence: Math.round(plan.mrr * 100),
        });
        if (sub) {
          stripeSubId = sub.id;
          status = mapStripeSubStatus(sub.status);
        }
      }
    } catch (e) {
      console.error("care subscription (Stripe) failed — recording local-only:", e);
    }
  }

  const { error } = await service.from("subscriptions").insert({
    tenant_id: opts.tenantId,
    plan: plan.id,
    mrr: plan.mrr,
    status,
    stripe_subscription_id: stripeSubId,
    started_at: new Date().toISOString(),
  });
  if (error) {
    console.error("care subscription local insert failed:", error.message);
    return { ok: false, stripe: !!stripeSubId };
  }
  return { ok: true, stripe: !!stripeSubId };
}
