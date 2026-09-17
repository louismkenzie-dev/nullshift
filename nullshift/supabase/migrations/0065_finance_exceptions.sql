-- 0065: finance exceptions — the owned, retryable, evidenced queue behind the
-- Finance › Exceptions tab (admin redesign Phase 4, task p4-ledger; brief §5.6
-- Exceptions, §3.3 #6–#7, §10.2 "create an urgent owned exception", §10.3
-- "show and retry the closure. Do not hide a remaining double-payment risk
-- behind Paid", §12.3, §17.2 "Mark-paid plus payment-link-close failure
-- becomes a visible exception until resolved").
--
-- STATUS: NOT APPLIED to any database. Authored 2026-09-17 against the live
-- schema described in docs/ADMIN-REDESIGN-PHASE0-2026-09-17.md §11. Number the
-- ledger entry against `schema_migrations`, not this directory, before
-- applying (Phase 0 decision N-h). Nothing reads or writes this table unless
-- OPS_V2_FLAGS contains `billingActivation`.
--
-- PURPOSE
--   `finance_exceptions` — one row per thing a human must own until it is
--   resolved: missing consent, cancelled mandate, failed collection, Xero
--   outage, duplicate warning, balance mismatch, payment-link closure failure,
--   unmatched payout, missing activation gate, other. Each carries an owner,
--   an attempt history (jsonb array, append-only by convention and by the
--   `attempts` trigger below), the ONE safe retry operation it proposes, and
--   resolution evidence.
--
--   A retry must say what it will do and must never collect money (§5.6:
--   "it must not accidentally charge again while retrying an accounting
--   sync"). `safe_retry_op` is therefore restricted by CHECK to accounting /
--   linkage operations; no value in that list moves money, and the TypeScript
--   layer (apps/web/lib/billing/exceptions.ts) enforces the same list before a
--   retry is even proposed.
--
-- DEPENDENCIES
--   0001 (tenants, is_internal_staff(), set_updated_at(), invoices,
--   subscriptions), auth.users.
--   `obligation_id` references billing_obligations from 0062. `activation_id`
--   is a plain uuid with NO foreign key: billing activations belong to a
--   sibling Phase 4 migration that may not be in the ledger yet (same
--   convention as 0060 / 0062 for arrangement_id). Add the FK later.
--
-- ACCESS
--   RLS enabled. Staff: for all using/with check is_internal_staff(). No
--   client policy: an exception is an internal operational record. The
--   service role (webhook inbox, ops worker) bypasses RLS to open rows.
--
-- NO BACKFILL. No existing row is mutated. No provider call.
--
-- ROLLBACK
--   begin;
--   drop trigger if exists trg_finance_exceptions_guard on public.finance_exceptions;
--   drop trigger if exists trg_finance_exceptions_updated on public.finance_exceptions;
--   drop function if exists public.finance_exceptions_guard();
--   drop table if exists public.finance_exceptions;
--   commit;

begin;

create table if not exists public.finance_exceptions (
  id uuid primary key default gen_random_uuid(),
  -- Null for an exception that is not yet attributable to a client (an
  -- unmatched payout, a Xero outage).
  tenant_id uuid references public.tenants(id) on delete set null,

  kind text not null check (
    kind in (
      'missing_consent',
      'cancelled_mandate',
      'failed_collection',
      'xero_outage',
      'duplicate_warning',
      'balance_mismatch',
      'link_closure_failed',
      'unmatched_payout',
      'missing_activation_gate',
      'other'
    )
  ),
  -- Urgency for the queue; 'urgent' is what §10.2 asks for when a Direct
  -- Debit is already submitted and another payment arrives.
  severity text not null default 'normal' check (severity in ('normal', 'urgent')),

  -- What it is about. All optional; at least one is normally set.
  obligation_id uuid references public.billing_obligations(id) on delete set null,
  invoice_id uuid references public.invoices(id) on delete set null,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  activation_id uuid,
  -- Free reference for things without a row yet (a provider payout id, a
  -- bank line reference).
  external_ref text,

  title text not null,
  detail text,

  -- Owner: a staff email or name. Free text on purpose — there is no staff
  -- capability model yet (Phase 0 §3, decision 18.11).
  owner text,
  state text not null default 'open' check (state in ('open', 'in_progress', 'resolved')),

  -- Append-only attempt history:
  --   [{ at, by, action, outcome, note? }]
  attempts jsonb not null default '[]'::jsonb check (jsonb_typeof(attempts) = 'array'),

  -- The single safe retry this exception proposes. Every allowed value is an
  -- accounting or linkage operation; NONE collects money.
  safe_retry_op text check (
    safe_retry_op is null or safe_retry_op in (
      'xero_create_invoice',
      'xero_allocate_payment',
      'close_payment_link',
      'refresh_mandate_state',
      'refresh_payout_state',
      'rematch_payout',
      'recompute_balance',
      'request_consent'
    )
  ),
  -- What the retry will do, in words, shown before anyone presses it.
  safe_retry_summary text,

  -- Evidence that closed it: [{ at, by, kind, ref?, note }]. Required to
  -- resolve (trigger below).
  resolution_evidence jsonb not null default '[]'::jsonb check (jsonb_typeof(resolution_evidence) = 'array'),

  opened_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint finance_exceptions_resolved_has_stamp check (
    (state = 'resolved') = (resolved_at is not null)
  ),
  constraint finance_exceptions_retry_has_summary check (
    safe_retry_op is null or safe_retry_summary is not null
  )
);

comment on table public.finance_exceptions is
  'Owned finance exceptions (0065): missing consent, cancelled mandate, failed collection, Xero outage, duplicate warning, balance mismatch, link-closure failure, unmatched payout, missing activation gate. A retry never collects money.';

create index if not exists finance_exceptions_open_idx
  on public.finance_exceptions (state, severity, opened_at)
  where state <> 'resolved';
create index if not exists finance_exceptions_tenant_idx
  on public.finance_exceptions (tenant_id, opened_at desc);
create index if not exists finance_exceptions_obligation_idx
  on public.finance_exceptions (obligation_id);
create index if not exists finance_exceptions_invoice_idx
  on public.finance_exceptions (invoice_id);

-- One OPEN exception per (kind, subject) so a retried webhook or a repeated
-- page action does not pile up duplicates; resolved rows are history.
create unique index if not exists finance_exceptions_one_open_per_subject
  on public.finance_exceptions (
    kind,
    coalesce(obligation_id::text, ''),
    coalesce(invoice_id::text, ''),
    coalesce(subscription_id::text, ''),
    coalesce(activation_id::text, ''),
    coalesce(external_ref, '')
  )
  where state <> 'resolved';

drop trigger if exists trg_finance_exceptions_updated on public.finance_exceptions;
create trigger trg_finance_exceptions_updated
  before update on public.finance_exceptions
  for each row execute function public.set_updated_at();

-- Guard: attempts are append-only (existing entries never change), a row
-- cannot be resolved without evidence, opened_at and kind are immutable, and
-- a resolved row cannot be reopened by editing state back (open a new one).
create or replace function public.finance_exceptions_guard()
returns trigger
language plpgsql
as $$
begin
  if new.kind <> old.kind then
    raise exception 'finance_exceptions: kind is immutable' using errcode = 'check_violation';
  end if;
  if new.opened_at <> old.opened_at then
    raise exception 'finance_exceptions: opened_at is immutable' using errcode = 'check_violation';
  end if;

  if jsonb_array_length(new.attempts) < jsonb_array_length(old.attempts)
     or (new.attempts -> 0 is distinct from old.attempts -> 0 and jsonb_array_length(old.attempts) > 0)
     or (
       jsonb_array_length(old.attempts) > 0
       and (select jsonb_agg(e) from jsonb_array_elements(new.attempts) with ordinality as t(e, n)
             where n <= jsonb_array_length(old.attempts))
           is distinct from old.attempts
     )
  then
    raise exception 'finance_exceptions: attempts is append-only' using errcode = 'check_violation';
  end if;

  if new.state = 'resolved' and old.state <> 'resolved' then
    if jsonb_array_length(new.resolution_evidence) = 0 then
      raise exception 'finance_exceptions: resolving requires resolution_evidence'
        using errcode = 'check_violation';
    end if;
  end if;

  if old.state = 'resolved' and new.state <> 'resolved' then
    raise exception 'finance_exceptions: a resolved exception cannot be reopened; open a new one'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke all on function public.finance_exceptions_guard() from public, anon;

drop trigger if exists trg_finance_exceptions_guard on public.finance_exceptions;
create trigger trg_finance_exceptions_guard
  before update on public.finance_exceptions
  for each row execute function public.finance_exceptions_guard();

alter table public.finance_exceptions enable row level security;

drop policy if exists finance_exceptions_staff_all on public.finance_exceptions;
create policy finance_exceptions_staff_all on public.finance_exceptions
  for all to authenticated
  using (is_internal_staff()) with check (is_internal_staff());

commit;
