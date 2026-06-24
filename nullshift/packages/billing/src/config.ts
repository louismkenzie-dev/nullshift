// Server-only Stripe config for the Nullshift web app.
//
// The test→live switch is purely a matter of which keys these env vars hold
// (sk_live_… / whsec_… from the LIVE dashboard) — nothing here is mode-specific.
//
// The publishable key is intentionally absent: the app has no client-side
// Stripe.js, so it's never read. If that changes, read it as
// NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY — the canonical name used in
// packages/config env.ts, .env.example and DEPLOY.md.

export const stripeConfig = {
  secretKey: process.env.STRIPE_SECRET_KEY!,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
  // Internal plan tier → Stripe Price ID (live-mode price_… in production).
  // Only the /onboard tiered-plan checkout uses these; the invoice and care-plan
  // checkout flows build prices inline via price_data and need none of them.
  priceIds: {
    core: process.env.STRIPE_PRICE_ID_CORE!,
    grow: process.env.STRIPE_PRICE_ID_GROW!,
    pro: process.env.STRIPE_PRICE_ID_PRO!,
    partner: process.env.STRIPE_PRICE_ID_PARTNER!,
    maintenance: process.env.STRIPE_PRICE_ID_MAINTENANCE!,
  },
};
