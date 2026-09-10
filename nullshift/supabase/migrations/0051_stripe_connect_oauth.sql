-- Stripe Connect OAuth — an EXISTING client Stripe account, authorised (2026-09-10)
--
-- The 2% platform fee (packages/billing/src/fees.ts, createConnectPaymentIntent)
-- has always needed one thing the schema could not hold: WHICH connected account
-- a client's payments route through. Until now the answer lived nowhere, so the
-- Connect half of billing was scaffolding with no wiring.
--
-- These columns are that wiring, on tenants alongside stripe_customer_id (0012)
-- and xero_contact_id (0018) — one integration id per client, same shape, no new
-- table for a one-to-one fact.
--
--   stripe_connect_account_id — the `acct_…` Stripe returns as stripe_user_id
--     when the client authorises us against their OWN account (Standard, full
--     dashboard). Not an account we created; not one we can delete.
--   stripe_connect_status     — 'connected' after a successful handshake,
--     'revoked' once the client disconnects us from their Stripe dashboard.
--   stripe_connected_at       — when the authorisation completed.
--   stripe_connect_livemode   — whether the token exchange ran against live
--     keys. A test-mode connection that looks live is the exact failure that
--     sends real money nowhere, so it is recorded rather than assumed.
--
-- Deliberately NOT stored: the OAuth access token. With a Standard account the
-- platform acts via `stripeAccount: <acct_…>` and its own secret key, so keeping
-- a second live credential per client would be pure liability. Apply AFTER 0050.

alter table public.tenants
  add column if not exists stripe_connect_account_id text,
  add column if not exists stripe_connect_status text
    check (stripe_connect_status in ('connected', 'revoked')),
  add column if not exists stripe_connected_at timestamptz,
  add column if not exists stripe_connect_livemode boolean;

-- One connected account belongs to one client. Without this a mis-sent link
-- could quietly point two tenants at the same Stripe account, and every
-- application fee after that would be charged against the wrong client.
create unique index if not exists tenants_stripe_connect_account_unique
  on public.tenants (stripe_connect_account_id)
  where stripe_connect_account_id is not null;
