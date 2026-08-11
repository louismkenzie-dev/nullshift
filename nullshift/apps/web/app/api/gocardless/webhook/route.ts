import {
  createCareSubscription,
  verifyGoCardlessWebhook,
} from "@nullshift/billing/gocardless";
import { createServiceClient } from "@nullshift/db";
import { carePlan } from "@/lib/carePlans";

/**
 * GoCardless webhook (point the dashboard endpoint at /api/gocardless/webhook).
 * Records Direct Debit mandate + subscription state back into our DB:
 *   • billing_requests fulfilled → the client authorised the mandate: create the
 *     monthly GoCardless subscription against it and flip our pending
 *     subscriptions row (matched by gc_billing_request_id) to active.
 *   • mandates cancelled/expired/failed → subscription row → canceled.
 *   • subscriptions cancelled/finished  → subscription row → canceled.
 *   • payments failed → logged only (the Friday pulse picks it up).
 * HMAC signature-verified. Verified events always get a 200 — even when no row
 * matched (logged) — so GoCardless doesn't retry forever; a processing error
 * returns 500 so it does retry (the writes are re-delivery safe).
 */
export const dynamic = "force-dynamic";

type GoCardlessEvent = {
  id: string;
  resource_type: string;
  action: string;
  links?: Record<string, string | undefined>;
};

export async function POST(req: Request) {
  if (!process.env.GOCARDLESS_WEBHOOK_SECRET) {
    return new Response("GoCardless is not configured.", { status: 503 });
  }
  const body = await req.text();
  if (!verifyGoCardlessWebhook(body, req.headers.get("webhook-signature"))) {
    return new Response("Invalid signature", { status: 401 });
  }

  let events: GoCardlessEvent[];
  try {
    events = (JSON.parse(body) as { events?: GoCardlessEvent[] }).events ?? [];
  } catch {
    return new Response("Invalid payload", { status: 400 });
  }

  const supabase = createServiceClient();

  try {
    for (const event of events) {
      switch (event.resource_type) {
        case "billing_requests": {
          if (event.action !== "fulfilled") break;
          const billingRequestId = event.links?.billing_request;
          const mandateId = event.links?.mandate_request_mandate;
          if (!billingRequestId || !mandateId) {
            console.error(
              "gocardless billing_requests.fulfilled missing links",
              event.id
            );
            break;
          }
          const { data: pending } = await supabase
            .from("subscriptions")
            .select("id, tenant_id, plan, gc_subscription_id")
            .eq("gc_billing_request_id", billingRequestId)
            .maybeSingle();
          if (!pending) {
            console.error(
              "gocardless billing_requests.fulfilled: no subscription row for",
              billingRequestId
            );
            break;
          }
          // Re-delivery: the GoCardless subscription already exists — done.
          if (pending.gc_subscription_id) break;
          const plan = carePlan(pending.plan);
          if (!plan) {
            console.error(
              `gocardless billing_requests.fulfilled: unknown plan '${pending.plan}' on subscription ${pending.id} (tenant ${pending.tenant_id})`
            );
            break;
          }
          const created = await createCareSubscription({
            mandateId,
            plan: plan.id,
            amountPence: plan.mrr * 100,
            description: `Nullshift ${plan.label} care plan`,
          });
          await supabase
            .from("subscriptions")
            .update({
              status: "active",
              provider: "gocardless",
              gc_mandate_id: mandateId,
              gc_subscription_id: created?.subscriptionId ?? null,
              mrr: plan.mrr,
              started_at: new Date().toISOString(),
            })
            .eq("id", pending.id);
          break;
        }
        case "mandates": {
          if (!["cancelled", "expired", "failed"].includes(event.action)) break;
          const mandateId = event.links?.mandate;
          if (!mandateId) break;
          const { data: updated } = await supabase
            .from("subscriptions")
            .update({ status: "canceled" })
            .eq("gc_mandate_id", mandateId)
            .select("id");
          if (!updated?.length)
            console.warn(
              `gocardless mandates.${event.action}: no subscription row for mandate`,
              mandateId
            );
          break;
        }
        case "subscriptions": {
          if (!["cancelled", "finished"].includes(event.action)) break;
          const subscriptionId = event.links?.subscription;
          if (!subscriptionId) break;
          const { data: updated } = await supabase
            .from("subscriptions")
            .update({ status: "canceled" })
            .eq("gc_subscription_id", subscriptionId)
            .select("id");
          if (!updated?.length)
            console.warn(
              `gocardless subscriptions.${event.action}: no subscription row for`,
              subscriptionId
            );
          break;
        }
        case "payments": {
          // No DB write — the Friday pulse picks this out of the logs.
          if (event.action === "failed")
            console.error(
              "gocardless payment failed for subscription",
              event.links?.subscription ?? "(no subscription link)"
            );
          break;
        }
        default:
          // Acknowledge everything else (200) so GoCardless doesn't retry.
          break;
      }
    }
  } catch (e) {
    console.error("gocardless webhook processing error:", e);
    // 500 → GoCardless retries; the fulfilled handler skips rows that already
    // have a gc_subscription_id, so the retry can't double-create.
    return new Response("processing error", { status: 500 });
  }

  return Response.json({ received: true });
}
