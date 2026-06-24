// DEPRECATED — do NOT subscribe a Stripe endpoint to this function.
//
// The single authoritative Stripe webhook consumer is the Next.js route:
//   apps/web/app/api/stripe/webhook/route.ts
//   → https://nullshift.co.uk/api/stripe/webhook
// It handles the full invoice lifecycle, checkout.session.completed and
// subscription sync (using the shared carePlan() mapping). Running this edge
// function alongside it double-processes subscription events with a DIFFERENT
// plan/MRR mapping, so it has been retired ahead of the live-mode switch.
//
// The one capability that lived ONLY here was logging the Stripe Connect 2%
// application fee (payment_intent.succeeded → audit_log). That path is not yet
// live (STRIPE_CONNECT_CLIENT_ID is unset; clinic Connect is a Phase-6
// scaffold). Before Connect goes live, port that handler into the Next route
// instead of re-enabling this. The original implementation is in git history.
//
// @ts-nocheck
Deno.serve(
  () =>
    new Response(
      "Gone — Stripe webhooks are handled at /api/stripe/webhook. See file header.",
      { status: 410 }
    )
);
