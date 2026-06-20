-- Live Stripe invoicing: customer reuse + webhook idempotency.

-- One Stripe customer per tenant, shared by the build invoice and the recurring
-- care subscription, so a single client isn't fragmented across multiple Stripe
-- customers (and the webhook can map customer -> tenant when needed).
alter table public.tenants add column if not exists stripe_customer_id text;

-- Webhook idempotency: every processed Stripe event id is recorded so a retry or
-- double-delivery can't double-apply (e.g. flip an invoice twice / dupe a row).
-- Service-role only — RLS denies everyone else; the webhook writes via the
-- service client (which bypasses RLS).
create table if not exists public.stripe_events (
  id text primary key,
  type text,
  received_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;
