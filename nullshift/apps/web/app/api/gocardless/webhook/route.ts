import {
  cancelMandate,
  createCareSubscription,
  getBillingRequest,
  getPayment,
  verifyGoCardlessWebhook,
} from "@nullshift/billing/gocardless";
import { createServiceClient } from "@nullshift/db";
import { logAuditAsService } from "@nullshift/db/audit";
import { carePlan } from "@/lib/carePlans";
import { contractedMrr } from "@/lib/pricing/contracted";
import { recordCarePlanPayment } from "@/lib/carePlanInvoice";
import { classifyCollection } from "@/lib/billing/directDebit";
import {
  auditDirectDebits,
  planSubscriptionFromRow,
  recordUnexpectedCollection,
} from "@/lib/billing/directDebitRun";
import { flagOn } from "@/lib/flags";
import { handleGoCardlessWebhookInbox } from "@/lib/integrations/webhook";

/**
 * GoCardless webhook (point the dashboard endpoint at /api/gocardless/webhook).
 * Records Direct Debit mandate + subscription state back into our DB:
 *   • billing_requests fulfilled → the client authorised the mandate: create the
 *     monthly GoCardless subscription against it and flip our pending
 *     subscriptions row (matched by gc_billing_request_id) to active.
 *   • mandates cancelled/expired/failed → subscription row → canceled.
 *   • subscriptions cancelled/finished  → subscription row → canceled.
 *   • payments failed → subscription row → past_due (recovers to active on a
 *     later confirmed/paid_out payment).
 *   • payments created/confirmed → checked against the plan FIRST (our
 *     subscription id, the contracted amount): only the plan is booked as a
 *     care-plan invoice; anything else opens an urgent exception and alerts
 *     staff, while it can still be cancelled when the event is `created`.
 *   • subscriptions amended → the live amount is re-read and compared.
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
  // Admin redesign Phase 4 (brief §10.2, §12.4): with OPS_V2_FLAGS containing
  // `integrationWorkers` the durable inbox handles the request — verify on
  // the raw body, capture every event, acknowledge, then process from
  // authoritative resource reads. billing_requests.fulfilled then records a
  // mandate and NEVER creates a subscription. With the flag off (the
  // default) everything below runs exactly as before.
  if (flagOn("integrationWorkers")) return handleGoCardlessWebhookInbox(req);

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
            .select("id, tenant_id, plan, mrr, gc_subscription_id")
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
            // The amount the client was shown travels in the billing request's
            // metadata; recompute only for links minted before that existed.
            const stamped = Number(br?.metadata?.amount_pence ?? NaN);
            const rescuedMrr = Number.isFinite(stamped)
              ? stamped / 100
              : (await contractedMrr(tenantId, planId)).mrr;
            const { data: recreated, error: recreateErr } = await supabase
              .from("subscriptions")
              .insert({
                tenant_id: tenantId,
                plan: planId,
                mrr: rescuedMrr,
                status: "incomplete",
                provider: "gocardless",
                gc_billing_request_id: billingRequestId,
              })
              .select("id, tenant_id, plan, mrr, gc_subscription_id")
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
            // Don't leave an authorised-but-unused Direct Debit on the client's
            // bank account, and don't rely on a console line nobody reads.
            const mandateCancelled = await cancelMandate(mandateId);
            console.error(
              `gocardless billing_requests.fulfilled: tenant ${pending.tenant_id} already has a live subscription — NOT creating a second one. Mandate ${mandateId} ${mandateCancelled ? "cancelled" : "could NOT be cancelled — cancel it in the GoCardless dashboard"}.`
            );
            const { error } = await supabase
              .from("subscriptions")
              .update({ status: "canceled", gc_mandate_id: mandateId })
              .eq("id", pending.id);
            if (error) return new Response("db error", { status: 500 });
            await logAuditAsService({
              action: "gocardless.mandate_orphaned",
              target: `tenant:${pending.tenant_id}`,
              tenantId: pending.tenant_id,
              metadata: { mandateId, billingRequestId, mandateCancelled },
            });
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
          // The pending row carries the client's contracted rate (scale
          // multiplier + margin floor); the catalogue base is only a fallback.
          const chargeMrr = Number(pending.mrr ?? 0) || plan.mrr;
          const created = await createCareSubscription({
            mandateId,
            plan: plan.id,
            amountPence: Math.round(chargeMrr * 100),
            description: `Nullshift ${plan.label} plan`,
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
              mrr: chargeMrr,
              started_at: new Date().toISOString(),
            })
            .eq("id", pending.id);
          if (activateErr) {
            // 500 → GoCardless redelivers; the idempotency key makes the
            // repeated create safe and the row activates on the retry.
            console.error("gocardless activation update failed:", activateErr);
            return new Response("db error", { status: 500 });
          }
          await logAuditAsService({
            action: "care_plan.dd_activated",
            target: `tenant:${pending.tenant_id}`,
            tenantId: pending.tenant_id,
            metadata: {
              plan: plan.id,
              billingRequestId,
              mandateId,
              gcSubscriptionId: created.subscriptionId,
              amountPence: Math.round(Number(pending.mrr) * 100),
            },
          });
          break;
        }
        case "mandates": {
          const mandateId = event.links?.mandate;
          if (!mandateId) break;
          // A bank switch replaces the mandate id; follow it or a later
          // cancellation of the new mandate would match nothing.
          if (event.action === "replaced" && event.links?.new_mandate) {
            const { error } = await supabase
              .from("subscriptions")
              .update({ gc_mandate_id: event.links.new_mandate })
              .eq("gc_mandate_id", mandateId);
            if (error) return new Response("db error", { status: 500 });
            break;
          }
          if (!["cancelled", "expired", "failed"].includes(event.action)) break;
          const { data: updated, error } = await supabase
            .from("subscriptions")
            .update({ status: "canceled" })
            .eq("gc_mandate_id", mandateId)
            .select("id, tenant_id");
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
          for (const row of updated ?? [])
            await logAuditAsService({
              action: "care_plan.dd_cancelled",
              target: `tenant:${row.tenant_id}`,
              tenantId: row.tenant_id,
              metadata: { mandateId, cause: `mandates.${event.action}` },
            });
          break;
        }
        case "subscriptions": {
          const subscriptionId = event.links?.subscription;
          if (!subscriptionId) break;
          // The amount (or schedule) was changed outside this system: re-read
          // what GoCardless will now collect and compare it with the plan.
          // Drift opens an urgent exception and alerts staff; agreement
          // resolves any earlier drift exception.
          if (event.action === "amended") {
            const { data: amended } = await supabase
              .from("subscriptions")
              .select("tenant_id")
              .eq("gc_subscription_id", subscriptionId)
              .limit(1)
              .maybeSingle();
            if (amended?.tenant_id)
              await auditDirectDebits(supabase, {
                tenantId: amended.tenant_id,
                source: "webhook subscriptions.amended",
              }).catch((e) => console.error("dd audit after amendment failed:", e));
            break;
          }
          if (!["cancelled", "finished"].includes(event.action)) break;
          const { data: updated, error } = await supabase
            .from("subscriptions")
            .update({ status: "canceled" })
            .eq("gc_subscription_id", subscriptionId)
            .select("id, tenant_id");
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
          for (const row of updated ?? [])
            await logAuditAsService({
              action: "care_plan.dd_cancelled",
              target: `tenant:${row.tenant_id}`,
              tenantId: row.tenant_id,
              metadata: {
                gcSubscriptionId: subscriptionId,
                cause: `subscriptions.${event.action}`,
              },
            });
          break;
        }
        case "payments": {
          // A failed collection flips the row to past_due so it surfaces on
          // the billing page's past-due rail and the dashboard Money panel.
          // Payment events carry only `links.payment` — the subscription (and
          // mandate) come from the payment itself.
          const FAILS = ["failed", "late_failure_settled", "charged_back"];
          const RECOVERS = ["confirmed", "paid_out"];
          // `created` arrives days before the bank submission — the one
          // moment an off-plan collection can still be cancelled.
          const CREATED = ["created"];
          if (
            !FAILS.includes(event.action) &&
            !RECOVERS.includes(event.action) &&
            !CREATED.includes(event.action)
          )
            break;
          const paymentId = event.links?.payment;
          if (!paymentId) break;
          const payment = await getPayment(paymentId);
          const gcSubId = payment?.subscriptionId ?? event.links?.subscription ?? null;
          const mandateId = payment?.mandateId ?? null;
          if (!gcSubId && !mandateId) break;
          // The plan this payment lands on: by our subscription id first, else
          // by the mandate (a one-off payment carries no subscription link).
          const subQuery = supabase
            .from("subscriptions")
            .select("id, tenant_id, plan, mrr, status, gc_subscription_id, gc_mandate_id, tenants(name)")
            .in("status", ["active", "trialing", "past_due"])
            .limit(1);
          const { data: subRow } = await (
            gcSubId ? subQuery.eq("gc_subscription_id", gcSubId) : subQuery.eq("gc_mandate_id", mandateId!)
          ).maybeSingle();
          const { data: byMandate } =
            !subRow && gcSubId && mandateId
              ? await supabase
                  .from("subscriptions")
                  .select("id, tenant_id, plan, mrr, status, gc_subscription_id, gc_mandate_id, tenants(name)")
                  .in("status", ["active", "trialing", "past_due"])
                  .eq("gc_mandate_id", mandateId)
                  .limit(1)
                  .maybeSingle()
              : { data: null };
          const sub = subRow ?? byMandate;
          const tenantOf = (s: { tenants?: { name: string | null } | { name: string | null }[] | null }) => {
            const t = Array.isArray(s.tenants) ? s.tenants[0] : s.tenants;
            return t?.name ?? "Client";
          };

          // THE guard: is this payment the plan we hold — our subscription,
          // at the contracted amount? Anything else is never booked as the
          // plan; it becomes an urgent exception with a staff alert.
          const verdict = sub && payment ? classifyCollection(payment, planSubscriptionFromRow(sub)) : null;
          if (sub && payment && verdict?.kind === "off_plan" && payment.amountPence > 0) {
            try {
              await recordUnexpectedCollection(supabase, {
                sub: planSubscriptionFromRow(sub),
                tenantName: tenantOf(sub),
                payment,
                verdict,
                source: `webhook payments.${event.action}`,
              });
            } catch (e) {
              console.error("unexpected collection record failed:", e);
            }
          }
          if (CREATED.includes(event.action)) break;

          // Only the plan's own payment moves the plan between active and
          // past_due.
          const { data: updated, error } =
            verdict?.kind === "plan" || !sub
              ? await (() => {
                  const target = supabase.from("subscriptions").update({
                    status: FAILS.includes(event.action) ? "past_due" : "active",
                  });
                  const scoped = gcSubId
                    ? target.eq("gc_subscription_id", gcSubId)
                    : target.eq("gc_mandate_id", mandateId!);
                  return scoped
                    .eq("status", FAILS.includes(event.action) ? "active" : "past_due")
                    .select("id, tenant_id");
                })()
              : { data: [] as { id: string; tenant_id: string }[], error: null };
          if (error) {
            console.error(`gocardless payments.${event.action} update failed:`, error);
            return new Response("db error", { status: 500 });
          }
          // A confirmed PLAN collection is revenue: raise the paid care-plan
          // invoice here and in Xero (idempotent on the payment id, so the
          // later paid_out event and any retry are no-ops).
          if (RECOVERS.includes(event.action) && payment && payment.amountPence > 0 && sub && verdict?.kind === "plan") {
            try {
              await recordCarePlanPayment(supabase, {
                tenantId: sub.tenant_id,
                subscriptionId: sub.id,
                plan: sub.plan,
                paymentId,
                amountPence: payment.amountPence,
                chargeDate: payment.chargeDate,
                paymentSubscriptionId: payment.subscriptionId,
                paymentMandateId: payment.mandateId,
                paymentStatus: payment.status,
                paymentDescription: payment.description,
                source: `webhook payments.${event.action}`,
              });
            } catch (e) {
              console.error("care plan invoice failed:", e);
            }
          }
          for (const row of updated ?? [])
            await logAuditAsService({
              action: FAILS.includes(event.action)
                ? "care_plan.payment_failed"
                : "care_plan.payment_recovered",
              target: `tenant:${row.tenant_id}`,
              tenantId: row.tenant_id,
              metadata: {
                paymentId,
                action: event.action,
                amountPence: payment?.amountPence ?? null,
                chargeDate: payment?.chargeDate ?? null,
              },
            });
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
