// Supabase Edge Function — Stripe webhook consumer (brief §7).
//
// Keeps invoices/subscriptions live so the admin MRR-to-£8k tracker is always
// current. Verifies the Stripe signature, then on:
//   - invoice.paid / invoice.payment_succeeded → mark the matching invoices row paid
//   - customer.subscription.created|updated|deleted → upsert the subscriptions row
//   - payment_intent.succeeded (with application_fee_amount) → record the 2% skim
//
// Deploy:  supabase functions deploy stripe-webhook --no-verify-jwt
// Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_URL,
//          SUPABASE_SERVICE_ROLE_KEY  (set with `supabase secrets set`).
//
// Runs on Deno (Supabase Edge runtime); the imports below resolve there.
// @ts-nocheck
import Stripe from "https://esm.sh/stripe@22.2.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.107.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const PLAN_MRR: Record<string, number> = {
  care_basic: 49,
  care_pro: 149,
  transaction: 39,
};

Deno.serve(async (req) => {
  const sig = req.headers.get("stripe-signature");
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig!, webhookSecret);
  } catch (err) {
    return new Response(`Webhook signature failed: ${(err as Error).message}`, {
      status: 400,
    });
  }

  try {
    switch (event.type) {
      case "invoice.paid":
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        await supabase
          .from("invoices")
          .update({ status: "paid", paid_at: new Date().toISOString() })
          .eq("stripe_invoice_id", invoice.id);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const plan = (sub.metadata?.plan as string) || "care_basic";
        const status =
          sub.status === "active" || sub.status === "trialing" ? sub.status : "canceled";
        const tenantId = sub.metadata?.tenant_id as string | undefined;
        if (tenantId) {
          await supabase.from("subscriptions").upsert(
            {
              tenant_id: tenantId,
              plan,
              mrr: PLAN_MRR[plan] ?? 49,
              stripe_subscription_id: sub.id,
              status:
                event.type === "customer.subscription.deleted" ? "canceled" : status,
            },
            { onConflict: "stripe_subscription_id" }
          );
        }
        break;
      }
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        if (pi.application_fee_amount) {
          await supabase.from("audit_log").insert({
            action: "connect.application_fee",
            target: `payment_intent:${pi.id}`,
            metadata: {
              amount: pi.amount,
              application_fee_amount: pi.application_fee_amount,
              currency: pi.currency,
            },
          });
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error("webhook handler error:", err);
    return new Response("handler error", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
