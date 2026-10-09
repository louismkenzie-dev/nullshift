-- STATUS: NOT YET APPLIED. Number the ledger entry against `schema_migrations`
-- before applying (Phase 0 decision N-h).
-- 0072 — Self-serve products foundation (docs/products/PROGRAMME-2026-10-09.md).
--
-- Additive only. Nothing here touches bespoke client tables, billing
-- obligations or delivery.
--
--   1. `tenants.self_serve` — true for a workspace created by signing up at
--      /app for an off-the-shelf product (as opposed to a bespoke client the
--      studio opened). Lets admin and reporting tell the two apart without a
--      new tenant_type enum value (which would ripple through every policy).
--   2. `product_subscriptions` — one row per (tenant, product). Mirrors the
--      Stripe subscription state for the five catalogue products. Deliberately
--      SEPARATE from `subscriptions` (bespoke care plans): different lifecycle,
--      different webhook branch (metadata.product), different reporting.
--
-- RLS: members read their own tenant's rows; writes are service-role only
-- (Stripe webhook + checkout bootstrap) and staff.
--
-- Rollback:
--   drop table if exists public.product_subscriptions;
--   alter table public.tenants drop column if exists self_serve;

alter table public.tenants
  add column if not exists self_serve boolean not null default false;

create index if not exists tenants_self_serve_idx
  on public.tenants (self_serve) where self_serve;

create table if not exists public.product_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  product text not null check (product in ('quote', 'legal', 'watch', 'plans', 'studio')),
  status text not null default 'trialing'
    check (status in ('trialing', 'active', 'past_due', 'canceled', 'incomplete', 'unpaid', 'expired')),
  stripe_customer_id text,
  stripe_subscription_id text unique,
  price_pence integer not null default 0,
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, product)
);

create index if not exists product_subscriptions_tenant_idx
  on public.product_subscriptions (tenant_id);
create index if not exists product_subscriptions_status_idx
  on public.product_subscriptions (status);

drop trigger if exists product_subscriptions_updated_at on public.product_subscriptions;
create trigger product_subscriptions_updated_at
  before update on public.product_subscriptions
  for each row execute function public.set_updated_at();

alter table public.product_subscriptions enable row level security;

drop policy if exists product_subscriptions_select on public.product_subscriptions;
create policy product_subscriptions_select on public.product_subscriptions
  for select to authenticated
  using (public.is_member_of(tenant_id) or public.is_internal_staff());

drop policy if exists product_subscriptions_write_staff on public.product_subscriptions;
create policy product_subscriptions_write_staff on public.product_subscriptions
  for all to authenticated
  using (public.is_internal_staff())
  with check (public.is_internal_staff());

comment on table public.product_subscriptions is
  'Self-serve product subscriptions (Quote, Legal, Watch, Plans, Studio). Mirrors Stripe; written by the webhook and checkout bootstrap via the service role.';
