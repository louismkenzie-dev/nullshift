import {
  createCareSubscription,
  getBillingRequest,
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
          let { data: pending } = await supabase
            .from("subscriptions")
            .select("id, tenant_id, plan, gc_subscription_id")
            .eq("gc_billing_request_id", billingRequestId)
            .maybeSingle();
          // Orphan rescue: our pending row was superseded (a newer link was
          // issued) but the client completed THIS link anyway. The billing
          // request's own metadata carries tenant_id + plan — recreate the
          // tracking row so the live mandate is never left orphaned.
          if (!pending) {
            const br = await getBillingRequest(billingRequestId);
            const tenantId = br?.metadata?.tenant_id;
            const planId = br?.metadata?.plan ?? "";
            if (!tenantId || !carePlan(planId)) {
              console.error(
                "gocardless billing_requests.fulfilled: no subscription row and no usable metadata for",
                billingRequestId
              );
              break;
            }
            const { data: recreated, error: recreateErr } = await supabase
              .from("subscriptions")
              .insert({
                tenant_id: tenantId,
                plan: planId,
                mrr: carePlan(planId)!.mrr,
                status: "incomplete",
                provider: "gocardless",
                gc_billing_request_id: billingRequestId,
              })
              .select("id, tenant_id, plan, gc_subscription_id")
              .single();
            if (recreateErr || !recreated) {
              console.error("gocardless orphan-rescue insert failed:", recreateErr);
              return new Response("db error", { status: 500 });
            }
            pending = recreated;
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
          // Cross-rail guard: if this tenant already has a LIVE subscription
          // (e.g. a Stripe card plan completed meanwhile), do NOT start a
          // second recurring charge. Park this row and shout for follow-up.
          const { data: live, error: liveErr } = await supabase
            .from("subscriptions")
            .select("id")
            .eq("tenant_id", pending.tenant_id)
            .in("status", ["active", "trialing", "past_due"])
            .neq("id", pending.id)
            .limit(1);
          if (liveErr) {
            console.error("gocardless live-check failed:", liveErr);
            return new Response("db error", { status: 500 });
          }
          if (live && live.length > 0) {
            console.error(
              `gocardless billing_requests.fulfilled: tenant ${pending.tenant_id} already has a live subscription — NOT creating a second one. Mandate ${mandateId} is authorised but unused; cancel it in the GoCardless dashboard.`
            );
            const { error } = await supabase
              .from("subscriptions")
              .update({ status: "canceled", gc_mandate_id: mandateId })
              .eq("id", pending.id);
            if (error) return new Response("db error", { status: 500 });
            break;
          }
          // Record the mandate BEFORE creating the GC subscription, so a
          // later mandates.cancelled event can always match this row no
          // matter where the flow stops.
          const { error: mandateErr } = await supabase
            .from("subscriptions")
            .update({ gc_mandate_id: mandateId, provider: "gocardless" })
            .eq("id", pending.id);
          if (mandateErr) {
            console.error("gocardless mandate-record failed:", mandateErr);
            return new Response("db error", { status: 500 });
          }
          // Idempotency-Key = billing request id: a webhook re-delivery after
          // a crash replays the SAME GoCardless subscription instead of
          // creating a second one against the mandate.
          const created = await createCareSubscription({
            mandateId,
            plan: plan.id,
            amountPence: plan.mrr * 100,
            description: `Nullshift ${plan.label} care plan`,
            idempotencyKey: billingRequestId,
          });
          if (!created) {
            console.error("gocardless createCareSubscription returned null mid-flow");
            return new Response("unconfigured", { status: 500 });
          }
          const { error: activateErr } = await supabase
            .from("subscriptions")
            .update({
              status: "active",
              gc_subscription_id: created.subscriptionId,
              mrr: plan.mrr,
              started_at: new Date().toISOString(),
            })
            .eq("id", pending.id);
          if (activateErr) {
            // 500 → GoCardless redelivers; the idempotency key makes the
            // repeated create safe and the row activates on the retry.
            console.error("gocardless activation update failed:", activateErr);
            return new Response("db error", { status: 500 });
          }
          break;
        }
        case "mandates": {
          if (!["cancelled", "expired", "failed"].includes(event.action)) break;
          const mandateId = event.links?.mandate;
          if (!mandateId) break;
          const { data: updated, error } = await supabase
            .from("subscriptions")
            .update({ status: "canceled" })
            .eq("gc_mandate_id", mandateId)
            .select("id");
          // A DB failure must NOT ack — 500 so GoCardless redelivers (the
          // cancel update is idempotent). "No row" is a real ack-able outcome.
          if (error) {
            console.error(`gocardless mandates.${event.action} update failed:`, error);
            return new Response("db error", { status: 500 });
          }
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
          const { data: updated, error } = await supabase
            .from("subscriptions")
            .update({ status: "canceled" })
            .eq("gc_subscription_id", subscriptionId)
            .select("id");
          if (error) {
            console.error(
              `gocardless subscriptions.${event.action} update failed:`,
              error
            );
            return new Response("db error", { status: 500 });
          }
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
