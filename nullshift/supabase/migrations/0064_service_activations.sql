-- 0064: mandates, service activations and the per-arrangement subscription
-- guard (admin redesign Phase 4, task p4-activation; brief §3.3 #2 and #4,
-- §8.3–8.4, §10.2, §12.3, §17.2 rows 1–2 and 5, "bank transfer before Direct
-- Debit", "orphan mandate").
--
-- STATUS: NOT APPLIED to any database. Authored 2026-09-17 additively against
-- the live schema as read in docs/ADMIN-REDESIGN-PHASE0-2026-09-17.md §11.
-- Number the ledger entry against `schema_migrations`, not this directory,
-- before applying (Phase 0 decision N-h). Nothing reads or writes these
-- objects unless OPS_V2_FLAGS contains `billingActivation`; the legacy
-- GoCardless webhook, `lib/directDebit.ts` and the two live subscription rows
-- are untouched and keep their tenant-wide guards.
--
-- PURPOSE
--   Today `billing_requests.fulfilled` creates a monthly subscription in the
--   same request as the mandate is recorded (Phase 0 §8 #2), and every
--   duplicate-subscription check is tenant-wide and read-then-write (§8 #4).
--   This file separates the three things the brief keeps apart — mandate
--   authorisation, commercial approval and scheduled activation — and gives
--   the activation a transactional reservation:
--
--   mandates
--       Provider-confirmed collection authority, one row per provider mandate
--       (unique on provider + environment + mandate_ref). Sandbox and live
--       never share a row. Consent evidence (terms version + acceptance ref)
--       is stored with the mandate; a mandate that arrives without it, or
--       without a tenant it can be tied to, is HELD FOR REVIEW and can never
--       satisfy an activation gate. A mandate row is never a subscription and
--       never an activation (§10.2 "mandate authorisation is not payment").
--
--   service_activations
--       The reservation of ONE activation for a billable service (§8.3 step
--       5). `service_activations_one_live_per_arrangement` is a partial unique
--       index on (arrangement_id) while state is reserved | scheduled |
--       active, so two concurrent callers cannot both reserve: the second
--       insert fails with 23505 and the code reports `duplicate`. The
--       contractual start date and the provider's charge date are separate
--       columns (§8.3 "do not quietly shift the commercial date"); the
--       provider call itself happens only in the worker, and the
--       provider-confirmed charge date is written back afterwards.
--
--   subscriptions.activation_id / arrangement_id / environment
--       Nullable, additive. Legacy rows keep null and are not touched. A new
--       partial unique index on (arrangement_id) where status is active |
--       trialing | past_due AND arrangement_id is not null adds a per-service
--       guard for new-model rows only; the existing tenant-wide code checks
--       stay in force (§3.3 #4 "without weakening legacy guards").
--
-- WHAT THIS FILE DOES NOT DO
--   No backfill; no UPDATE of any existing row; no change to any existing
--   CHECK, NOT NULL, index or trigger. No obligation, collection-attempt or
--   payout tables (later tasks). No price or catalogue.
--
-- DEPENDENCIES
--   0001 (tenants, subscriptions, is_internal_staff(), set_updated_at()),
--   0059 (service_arrangements, service_schedules), auth.users.
--
-- ACCESS
--   RLS enabled on both new tables; staff (is_internal_staff()) read/write.
--   Webhooks and the ops worker write with the service role. Tenant members
--   never read these tables directly; a client-facing "collection expected
--   on" date is projected by server code.
--
-- ROLLBACK (manual, in this order; loses only data written under the flag)
--   drop index if exists public.subscriptions_one_live_per_arrangement;
--   drop index if exists public.subscriptions_activation_unique;
--   alter table public.subscriptions
--     drop constraint if exists subscriptions_environment_check,
--     drop column if exists environment,
--     drop column if exists arrangement_id,
--     drop column if exists activation_id;
--   drop table if exists public.service_activations;
--   drop function if exists public.service_activations_guard();
--   drop table if exists public.mandates;

-- ============================================================================
-- mandates — provider-confirmed collection authority (§8.3 step 4, §10.2)
-- ============================================================================

create table if not exists public.mandates (
  id uuid primary key default gen_random_uuid(),
  -- Null = orphan: the provider resource could not be tied to a client. Such
  -- a row is always held_for_review and never satisfies a gate.
  tenant_id uuid references public.tenants(id) on delete set null,
  provider text not null check (provider in ('gocardless', 'stripe')),
  environment text not null check (environment in ('sandbox', 'live')),
  customer_ref text,
  billing_request_ref text,
  -- Null only while the setup request is pending (no mandate exists yet).
  mandate_ref text,
  status text not null default 'pending' check (
    status in ('pending', 'authorised', 'active', 'cancelled', 'failed', 'replaced')
  ),
  -- Consent evidence captured at setup (the hosted flow's terms wording and
  -- the acceptance it was linked to). Both are required for a mandate to be
  -- usable; without them the row is held (§10.2 "do not reconstruct
  -- permission to charge").
  consent_terms_version text,
  consent_acceptance_ref text,
  held_for_review boolean not null default false,
  hold_reason text,
  authorised_at timestamptz,
  cancelled_at timestamptz,
  replaced_by uuid references public.mandates(id) on delete set null,
  -- The provider's own status string as last confirmed by a resource fetch
  -- (never taken from an event body alone).
  raw_status text,
  last_provider_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (provider, environment, mandate_ref),

  constraint mandates_usable_has_ref check (
    status not in ('authorised', 'active') or mandate_ref is not null
  ),
  constraint mandates_replaced_has_successor check (
    status <> 'replaced' or replaced_by is not null
  ),
  constraint mandates_no_self_replace check (
    replaced_by is null or replaced_by <> id
  ),
  constraint mandates_held_has_reason check (
    not held_for_review or hold_reason is not null
  ),
  constraint mandates_orphan_is_held check (
    tenant_id is not null or held_for_review
  )
);

create index if not exists mandates_tenant_idx
  on public.mandates (tenant_id, created_at desc);
create unique index if not exists mandates_billing_request_unique
  on public.mandates (provider, environment, billing_request_ref)
  where billing_request_ref is not null;
create index if not exists mandates_held_idx
  on public.mandates (held_for_review)
  where held_for_review;

drop trigger if exists trg_mandates_updated on public.mandates;
create trigger trg_mandates_updated
  before update on public.mandates
  for each row execute function public.set_updated_at();

comment on table public.mandates is
  'Provider-confirmed Direct Debit / payment-method mandates. Authorisation is not payment and never creates a subscription or activation. held_for_review rows (orphans, missing consent evidence) can never satisfy an activation gate.';
comment on column public.mandates.environment is
  'sandbox or live. Test and live records never share a row, a unique key or a total (brief §12.3).';

-- ============================================================================
-- service_activations — the transactional reservation (§8.3 step 5)
-- ============================================================================

create table if not exists public.service_activations (
  id uuid primary key default gen_random_uuid(),
  arrangement_id uuid not null references public.service_arrangements(id) on delete restrict,
  schedule_id uuid not null references public.service_schedules(id) on delete restrict,
  mandate_id uuid references public.mandates(id) on delete set null,
  requested_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  -- The agreed commercial start (copied from the accepted schedule at
  -- reservation; preserved verbatim, never shifted by provider timing).
  contractual_start_date date not null,
  -- What we asked the provider for (>= contractual start; never earlier).
  requested_charge_date date,
  -- What the provider confirmed, written by the worker after the call.
  provider_confirmed_charge_date date,
  provider_subscription_ref text,
  environment text not null check (environment in ('sandbox', 'live')),
  state text not null default 'reserved' check (
    state in ('reserved', 'scheduled', 'active', 'cancelled', 'failed')
  ),
  failure_reason text,
  scheduled_at timestamptz,
  activated_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint service_activations_no_backdated_charge check (
    requested_charge_date is null or requested_charge_date >= contractual_start_date
  ),
  constraint service_activations_scheduled_is_complete check (
    state not in ('scheduled', 'active')
    or (mandate_id is not null and requested_charge_date is not null and approved_by is not null)
  ),
  constraint service_activations_active_has_ref check (
    state <> 'active' or provider_subscription_ref is not null
  ),
  constraint service_activations_failed_has_reason check (
    state <> 'failed' or failure_reason is not null
  )
);

-- THE reservation: at most one live activation per arrangement. A second
-- concurrent insert raises unique_violation (23505); the code maps it to
-- { ok: false, reason: 'duplicate' } and never retries by relaxing a gate.
create unique index if not exists service_activations_one_live_per_arrangement
  on public.service_activations (arrangement_id)
  where state in ('reserved', 'scheduled', 'active');
create unique index if not exists service_activations_provider_ref_unique
  on public.service_activations (environment, provider_subscription_ref)
  where provider_subscription_ref is not null;
create index if not exists service_activations_schedule_idx
  on public.service_activations (schedule_id);
create index if not exists service_activations_mandate_idx
  on public.service_activations (mandate_id)
  where mandate_id is not null;

drop trigger if exists trg_service_activations_updated on public.service_activations;
create trigger trg_service_activations_updated
  before update on public.service_activations
  for each row execute function public.set_updated_at();

-- Environment and tenant consistency at the database, not only in code: an
-- activation may only bind a mandate of the same environment and the same
-- tenant as its arrangement, and its schedule must belong to its arrangement.
-- A held-for-review mandate can never be bound.
create or replace function public.service_activations_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_tenant uuid;
  v_mandate public.mandates%rowtype;
  v_schedule_arrangement uuid;
begin
  select tenant_id into v_tenant
    from public.service_arrangements where id = new.arrangement_id;
  if v_tenant is null then
    raise exception 'service_activations: arrangement % not found', new.arrangement_id
      using errcode = 'foreign_key_violation';
  end if;

  select arrangement_id into v_schedule_arrangement
    from public.service_schedules where id = new.schedule_id;
  if v_schedule_arrangement is distinct from new.arrangement_id then
    raise exception 'service_activations: schedule % belongs to a different arrangement', new.schedule_id
      using errcode = 'check_violation';
  end if;

  if new.mandate_id is not null then
    select * into v_mandate from public.mandates where id = new.mandate_id;
    if not found then
      raise exception 'service_activations: mandate % not found', new.mandate_id
        using errcode = 'foreign_key_violation';
    end if;
    if v_mandate.environment <> new.environment then
      raise exception 'service_activations: % mandate cannot satisfy a % activation',
        v_mandate.environment, new.environment using errcode = 'check_violation';
    end if;
    if v_mandate.tenant_id is distinct from v_tenant then
      raise exception 'service_activations: mandate % belongs to a different tenant', new.mandate_id
        using errcode = 'check_violation';
    end if;
    if v_mandate.held_for_review then
      raise exception 'service_activations: mandate % is held for review', new.mandate_id
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_service_activations_guard on public.service_activations;
create trigger trg_service_activations_guard
  before insert or update on public.service_activations
  for each row execute function public.service_activations_guard();

comment on table public.service_activations is
  'One reserved/scheduled/active activation per service arrangement (partial unique index). Contractual start and provider charge dates are separate columns; the provider call runs only in the worker.';

-- ============================================================================
-- subscriptions — additive links for new-model rows only
-- ============================================================================

alter table public.subscriptions
  add column if not exists activation_id uuid references public.service_activations(id) on delete set null,
  add column if not exists arrangement_id uuid references public.service_arrangements(id) on delete set null,
  add column if not exists environment text;

alter table public.subscriptions
  drop constraint if exists subscriptions_environment_check;
alter table public.subscriptions
  add constraint subscriptions_environment_check
  check (environment is null or environment in ('sandbox', 'live'));

-- Per-service guard for new-model rows. Legacy rows have arrangement_id null
-- and are excluded by the predicate, so the index can be created even if two
-- legacy live rows exist for one tenant; the tenant-wide code checks remain.
create unique index if not exists subscriptions_one_live_per_arrangement
  on public.subscriptions (arrangement_id)
  where status in ('active', 'trialing', 'past_due') and arrangement_id is not null;
create unique index if not exists subscriptions_activation_unique
  on public.subscriptions (activation_id)
  where activation_id is not null;

comment on column public.subscriptions.activation_id is
  'The service_activations row that created this subscription (new model only; legacy rows null).';
comment on column public.subscriptions.arrangement_id is
  'The service_arrangements row this subscription bills (new model only; legacy rows null).';
comment on column public.subscriptions.environment is
  'sandbox or live for rows created under the new model; null on legacy rows. Never mix in totals.';

-- ============================================================================
-- Row Level Security — staff only; service role for webhooks and the worker
-- ============================================================================

alter table public.mandates enable row level security;
alter table public.service_activations enable row level security;

drop policy if exists mandates_staff_all on public.mandates;
create policy mandates_staff_all on public.mandates
  for all to authenticated
  using (is_internal_staff()) with check (is_internal_staff());

drop policy if exists service_activations_staff_all on public.service_activations;
create policy service_activations_staff_all on public.service_activations
  for all to authenticated
  using (is_internal_staff()) with check (is_internal_staff());
