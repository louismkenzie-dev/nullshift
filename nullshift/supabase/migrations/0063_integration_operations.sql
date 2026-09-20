-- 0063: integration inbox and outbox — durable provider events and retryable
-- operations (admin redesign Phase 4, task p4-ops; brief §3.3 #2, #6, #7,
-- §10.2 "persist a deduplicated event durably, and process through retryable
-- operations", §10.3 "durable invoice-create and payment-allocation
-- operations, separately retryable", §12.4 "inbox/outbox or equivalent
-- durable architecture … stable operation keys, transactional reservation,
-- bounded retries and recovery after ambiguous remote success", §17.2 rows on
-- duplicate webhooks, out-of-order events, crash after remote create, Xero
-- outage, retry-allocation-only, provider timeout / worker crash and sandbox
-- isolation).
--
-- STATUS: APPLIED to Nullshift Ops (cweftpoaojwzllzficgt) on 2026-09-20 (0057 on 2026-09-17). Authored 2026-09-17 against the live
-- schema described in docs/ADMIN-REDESIGN-PHASE0-2026-09-17.md §11 (there is
-- no event table for GoCardless; `stripe_events` is (id, type, received_at)
-- inserted AFTER processing; no outbox, lease or retry table exists). Number
-- the ledger entry against `schema_migrations`, not this directory, before
-- applying (Phase 0 decision N-h). Nothing reads or writes these tables
-- unless OPS_V2_FLAGS contains `integrationWorkers`; with the flag off the
-- GoCardless webhook, the Stripe webhook and every Xero sync path behave
-- exactly as today.
--
-- PURPOSE
--   integration_events (the INBOX)
--       One row per provider event, inserted BEFORE any processing and before
--       the provider is acknowledged. Identity is (provider, environment,
--       event_ref): a redelivered event is a unique violation the code reports
--       as "duplicate" and never processes twice; a sandbox event can never
--       collide with, or be mistaken for, a live one (§12.3 "test and live
--       records cannot mix"; "account IDs are part of identity" — hence
--       account_ref for connected-account providers). `payload` holds the
--       event body as received; processing never trusts it for state — it
--       re-reads the provider resource (§10.2 "derive state from
--       authoritative resource state, not only the last event received").
--
--   integration_operations (the OUTBOX)
--       One row per unit of provider work, keyed by a stable idempotency_key
--       (unique). The worker claims a bounded batch with a lease
--       (`integration_operations_claim` below), runs the handler, and either
--       records success, requeues with exponential backoff, or — after
--       max_attempts — parks the row in `dead_letter` and opens a
--       finance_exceptions row (0065) so a person owns it (§12.4 "a
--       dead-letter/review state must have a visible owner and runbook").
--       `attempts` is incremented AT CLAIM, so a handler that crashes the
--       process still consumes an attempt and the loop is bounded even when
--       nothing ever reports back. `subject` names what the operation is
--       about (obligation_id / invoice_id / activation_id / tenant_id /
--       allocation_id …) so the Finance surface can show correlation ids and
--       sanitised errors per record (§12.4). `last_error` is sanitised by the
--       code before it is written; never a token, bank detail or full payload.
--
-- WHAT THIS FILE DOES NOT DO
--   No backfill; no UPDATE of any existing row; no change to any existing
--   table, CHECK, index, trigger or policy. No provider call. `stripe_events`
--   is left exactly as it is (the Stripe webhook is not migrated here).
--
-- DEPENDENCIES
--   0001 (set_updated_at() is not needed; nothing else). pgcrypto
--   gen_random_uuid(). The code that writes finance_exceptions on dead-letter
--   needs 0065; this file does not reference it.
--
-- ACCESS
--   RLS enabled on both tables with NO policies: default-deny for anon and
--   authenticated, exactly like rate_limits / stripe_events (see the note in
--   0036). Only the service role (the webhook route and the ops-worker cron)
--   reads or writes. Staff visibility of run history / exceptions is
--   projected by server code with the service client; a staff read policy is
--   a deliberate later addition once the capability model (18.11) exists.
--   The claim function is SECURITY DEFINER, revoked from PUBLIC / anon /
--   authenticated and granted to service_role only (0036 pattern).
--
-- ROLLBACK (loses only inbox/outbox history written under the flag)
--   begin;
--   drop function if exists public.integration_operations_claim(text, integer, timestamptz, integer);
--   drop table if exists public.integration_operations;
--   drop table if exists public.integration_events;
--   commit;

begin;

-- ============================================================================
-- integration_events — the inbox
-- ============================================================================

create table if not exists public.integration_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('gocardless', 'stripe', 'xero')),
  -- Part of identity: a sandbox event never touches a live row.
  environment text not null check (environment in ('sandbox', 'live')),
  -- Connected-account id for providers that deliver on behalf of accounts
  -- (Stripe Connect). Null for a single-account provider.
  account_ref text,
  -- The provider's own event id (GoCardless EV…, Stripe evt_…).
  event_ref text not null,
  -- "<resource_type>.<action>" for GoCardless, `type` for Stripe.
  event_type text not null,
  resource_type text,
  resource_ref text,
  -- The body as received. Evidence only; never the source of state.
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  status text not null default 'received' check (
    status in ('received', 'processed', 'failed', 'ignored')
  ),
  -- Sanitised by the code before writing.
  error text,

  unique (provider, environment, event_ref),

  constraint integration_events_processed_has_stamp check (
    status not in ('processed', 'ignored') or processed_at is not null
  )
);

comment on table public.integration_events is
  'Provider webhook inbox (0063). Inserted before acknowledgement; unique per (provider, environment, event_ref) so duplicates are refused and sandbox never mixes with live. Processing re-reads the provider resource; the payload is evidence only.';

create index if not exists integration_events_pending_idx
  on public.integration_events (status, received_at)
  where status in ('received', 'failed');
create index if not exists integration_events_resource_idx
  on public.integration_events (provider, environment, resource_type, resource_ref);

-- ============================================================================
-- integration_operations — the outbox
-- ============================================================================

create table if not exists public.integration_operations (
  id uuid primary key default gen_random_uuid(),
  -- 'xero.create_invoice' | 'xero.allocate_payment' |
  -- 'gocardless.schedule_activation' | 'gocardless.cancel_pending' | 'notify'
  -- (open text: a later kind must not need a migration; the code's registry
  -- refuses unknown kinds).
  kind text not null,
  -- The stable identity of the unit of work; a second enqueue is a no-op.
  idempotency_key text not null unique,
  -- { tenant_id, obligation_id, invoice_id, activation_id, allocation_id,
  --   collection_ref, exception_id } — whichever apply.
  subject jsonb not null default '{}'::jsonb check (jsonb_typeof(subject) = 'object'),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  state text not null default 'queued' check (
    state in ('queued', 'leased', 'succeeded', 'failed', 'dead_letter')
  ),
  -- Incremented at CLAIM (see header); bounded by max_attempts.
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 8 check (max_attempts >= 1),
  next_attempt_at timestamptz not null default now(),
  leased_until timestamptz,
  lease_owner text,
  -- Sanitised by the code (no tokens, no bank details, no full payloads).
  last_error text,
  -- Ties the operation to the inbox event / staff action that produced it.
  correlation_id text,
  created_at timestamptz not null default now(),
  succeeded_at timestamptz,

  constraint integration_operations_leased_has_lease check (
    state <> 'leased' or (leased_until is not null and lease_owner is not null)
  ),
  constraint integration_operations_succeeded_has_stamp check (
    (state = 'succeeded') = (succeeded_at is not null)
  )
);

comment on table public.integration_operations is
  'Durable outbox (0063). One row per unit of provider work keyed by idempotency_key; claimed with a lease by integration_operations_claim(); exponential backoff; dead_letter after max_attempts opens a finance_exceptions row.';

create index if not exists integration_operations_due_idx
  on public.integration_operations (state, next_attempt_at)
  where state in ('queued', 'leased');
create index if not exists integration_operations_correlation_idx
  on public.integration_operations (correlation_id)
  where correlation_id is not null;
create index if not exists integration_operations_subject_gin
  on public.integration_operations using gin (subject);

-- ============================================================================
-- integration_operations_claim — the bounded, leased batch claim
-- ============================================================================
--
-- UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED) RETURNING: two
-- workers running at once never claim the same row; a row whose lease has
-- expired (the worker died or timed out) is claimable again; attempts is
-- consumed at claim so every claim counts against max_attempts.

create or replace function public.integration_operations_claim(
  p_owner text,
  p_limit integer,
  p_now timestamptz,
  p_lease_seconds integer
)
returns setof public.integration_operations
language sql
security definer
set search_path = public
as $$
  update public.integration_operations o
     set state = 'leased',
         lease_owner = p_owner,
         leased_until = p_now + make_interval(secs => greatest(30, least(p_lease_seconds, 3600))),
         attempts = o.attempts + 1
   where o.id in (
     select i.id
       from public.integration_operations i
      where (i.state = 'queued' and i.next_attempt_at <= p_now)
         or (i.state = 'leased' and i.leased_until is not null and i.leased_until < p_now)
      order by i.next_attempt_at asc, i.created_at asc
      limit greatest(1, least(coalesce(p_limit, 25), 100))
      for update skip locked
   )
  returning o.*;
$$;

revoke all on function public.integration_operations_claim(text, integer, timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.integration_operations_claim(text, integer, timestamptz, integer)
  to service_role;

comment on function public.integration_operations_claim(text, integer, timestamptz, integer) is
  'Claim up to p_limit due or lease-expired operations for p_owner with a lease of p_lease_seconds (30–3600). Increments attempts at claim. Service role only.';

-- ============================================================================
-- Row Level Security — service role only (RLS on, no policies = default deny)
-- ============================================================================

alter table public.integration_events enable row level security;
alter table public.integration_operations enable row level security;

commit;
