import Stripe from "stripe";
import { stripeConfig } from "@nullshift/billing/config";
import { createServiceClient } from "@nullshift/db";
import { mapStripeSubStatus } from "@/lib/careSubscription";

/**
 * Stripe webhook — the single authoritative consumer (point the Stripe dashboard
 * endpoint here). Records payment + subscription state back into our DB:
 *   • invoice.paid / invoice.payment_succeeded → invoices.status='paid' + paid_at
 *     (matched by stripe_invoice_id) — this is what makes "invested" update.
 *   • invoice.voided / .marked_uncollectible   → reflect the terminal state.
 *   • customer.subscription.*                   → keep the care plan status in sync.
 * Signature-verified. Idempotent via the stripe_events table (the underlying
 * writes are idempotent too, so a re-delivery is harmless).
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!stripeConfig.secretKey || !stripeConfig.webhookSecret) {
    return new Response("Stripe is not configured.", { status: 503 });
  }
  const stripe = new Stripe(stripeConfig.secretKey);
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing signature", { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, stripeConfig.webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(`Webhook Error: ${msg}`, { status: 400 });
  }

  const supabase = createServiceClient();

  // Idempotency: skip events we've already handled. The writes below are
  // themselves idempotent, so this is a best-effort dedupe + an audit trail.
  const { data: seen } = await supabase
    .from("stripe_events")
    .select("id")
    .eq("id", event.id)
    .maybeSingle();
  if (seen) return new Response(null, { status: 200 });

  try {
    switch (event.type) {
      case "invoice.paid":
      case "invoice.payment_succeeded": {
        const inv = event.data.object as Stripe.Invoice;
        if (inv.id) {
          const paidAt = inv.status_transitions?.paid_at ?? event.created;
          await supabase
            .from("invoices")
            .update({
              status: "paid",
              paid_at: new Date(paidAt * 1000).toISOString(),
            })
            .eq("stripe_invoice_id", inv.id);
        }
        break;
      }
      case "invoice.voided": {
        const inv = event.data.object as Stripe.Invoice;
        if (inv.id)
          await supabase
            .from("invoices")
            .update({ status: "void" })
            .eq("stripe_invoice_id", inv.id);
        break;
      }
      case "invoice.marked_uncollectible": {
        const inv = event.data.object as Stripe.Invoice;
        if (inv.id)
          await supabase
            .from("invoices")
            .update({ status: "uncollectible" })
            .eq("stripe_invoice_id", inv.id);
        break;
      }
      case "invoice.payment_failed": {
        // Keep the invoice 'open' — Stripe duns + re-emails the client.
        console.warn(
          "stripe invoice.payment_failed",
          (event.data.object as Stripe.Invoice).id
        );
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        await supabase
          .from("subscriptions")
          .update({ status: mapStripeSubStatus(sub.status) })
          .eq("stripe_subscription_id", sub.id);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await supabase
          .from("subscriptions")
          .update({ status: "canceled" })
          .eq("stripe_subscription_id", sub.id);
        break;
      }
      default:
        // Acknowledge unhandled types (200) so Stripe doesn't keep retrying.
        break;
    }
  } catch (e) {
    console.error("stripe webhook processing error:", e);
    // 500 → Stripe retries; we haven't recorded the event id yet, so the retry
    // will reprocess.
    return new Response("processing error", { status: 500 });
  }

  // Record as processed (dupe-safe; a unique-violation just means a concurrent
  // delivery already recorded it).
  await supabase.from("stripe_events").insert({ id: event.id, type: event.type });
  return new Response(null, { status: 200 });
}
