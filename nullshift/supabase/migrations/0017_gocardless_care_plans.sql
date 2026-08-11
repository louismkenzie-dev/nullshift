-- 0017_gocardless_care_plans.sql
-- GoCardless Direct Debit (Bacs) as a second rail for care-plan subscriptions,
-- alongside the Stripe card checkout:
--   1) subscriptions.provider — which rail bills the row. Defaults to 'stripe'
--      so every existing row keeps its meaning; 'manual' covers standing-order
--      retainers recorded by hand.
--   2) subscriptions.gc_* — the GoCardless billing request / mandate /
--      subscription ids, written by /api/gocardless/webhook as the mandate is
--      authorised and the subscription created. Partial indexes because the
--      columns are null on every non-GoCardless row.
--   3) tenants.care_plan_choice — the plan the client picked in the portal
--      before their Direct Debit is authorised ('none' = explicitly declined).
-- Apply AFTER 0016. Paste into the Supabase SQL editor or apply via MCP.

alter table public.subscriptions
  add column if not exists provider text not null default 'stripe'
    check (provider in ('stripe', 'gocardless', 'manual'));

alter table public.subscriptions
  add column if not exists gc_billing_request_id text,
  add column if not exists gc_mandate_id text,
  add column if not exists gc_subscription_id text;

create index if not exists subscriptions_gc_billing_request_idx
  on public.subscriptions (gc_billing_request_id)
  where gc_billing_request_id is not null;

create index if not exists subscriptions_gc_mandate_idx
  on public.subscriptions (gc_mandate_id)
  where gc_mandate_id is not null;

create index if not exists subscriptions_gc_subscription_idx
  on public.subscriptions (gc_subscription_id)
  where gc_subscription_id is not null;

alter table public.tenants
  add column if not exists care_plan_choice text
    check (care_plan_choice in ('none', 'hosting', 'hosting_api', 'build_3', 'build_10'));
