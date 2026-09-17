-- 0062: billing obligations, invoice ↔ obligation identity, provider payments
-- and payment allocations (admin redesign Phase 4, task p4-ledger; brief
-- §3.3 #5–#7, §5.6 Finance, §10.1 ownership of facts, §10.3 Xero, §12.3
-- monetary invariants, §14.2 additive rollout, §17.2 milestone / rounding /
-- partial-payment / reconciliation rows).
--
-- STATUS: NOT APPLIED to any database. Authored 2026-09-17 against the live
-- schema described in docs/ADMIN-REDESIGN-PHASE0-2026-09-17.md §11 (invoices:
-- 5 rows, `amount numeric(10,2)`, `type invoice_type`, `status invoice_status`,
-- no currency / net / tax columns). Number the ledger entry against
-- `schema_migrations`, not this directory, before applying (Phase 0 decision
-- N-h). Nothing reads or writes these objects unless OPS_V2_FLAGS contains
-- `billingActivation`; with the flag off the only observable change is the
-- backfill described below, which is a pure identity link.
--
-- PURPOSE
--   1. `billing_obligations` — ONE stable identity per commercial debt (brief
--      §10.1: "one commercial obligation has one stable identity through
--      invoice, collection, payout allocation and accounting projection").
--      A build milestone, the £600 independent handover fee, a service period,
--      a Grow item or a one-off each become one row with net / tax / gross in
--      integer minor units, an explicit currency, a tax-code reference
--      snapshot, issue and due timestamps, the collection policy and — the
--      duplicate-collection guard the brief insists on (§10.1, §12.3) — the
--      single collection ORCHESTRATOR that owns it. "One provider" is not
--      enough: a Xero-native GoCardless workflow and a Nullshift-created
--      GoCardless schedule are different orchestrators on the same rail.
--   2. `invoices.obligation_id` — the additive link from today's invoice
--      projection to its obligation, with `invoices_one_per_obligation`
--      (one non-void invoice per obligation) replacing the project-wide
--      `invoices_one_build_per_project` from 0013 (brief §3.3 #5: multiple
--      milestone invoices need a stable milestone identity and a SAFE
--      constraint migration, "dropping the old index without a replacement is
--      not an acceptable fix", §14.2).
--   3. `provider_payments` — the recorded amount of each provider money
--      movement (a GoCardless payment, a Stripe charge, a bank transfer, a
--      refund, a chargeback, a bank return) so an allocation always has a
--      ceiling. Nothing here calls a provider; rows are written by the
--      integration inbox (a sibling task) or by staff recording a bank
--      transfer.
--   4. `payment_allocations` — the typed application of a provider payment
--      to an obligation (and, when issued, its invoice). Payments, refunds,
--      credits, chargebacks and bank returns are DISTINCT kinds, never
--      unexplained negative price edits (§12.3). A trigger refuses any
--      allocation that would take the total allocated from one provider
--      payment above its recorded amount ("one provider payment cannot be
--      allocated twice beyond its available amount"). Partial payments,
--      split transfers and several invoices paid in one transfer are all
--      just several allocation rows against one provider payment.
--
-- DESIGN NOTES (deviations from the task sketch, on purpose)
--   * The allocation uniqueness is (provider, provider_payment_id, kind,
--     obligation_id), not (provider, provider_payment_id, kind). The brief
--     requires one bank transfer to settle several invoices (§5.6
--     Reconciliation), which is several allocation rows for one provider
--     payment; the over-allocation trigger is what stops the SAME payment
--     being applied twice beyond its amount. One row per (payment, kind,
--     obligation) still makes a replayed webhook idempotent.
--   * The recorded amount the trigger compares against lives in
--     `provider_payments`; without that table "exceeding its recorded amount"
--     has nothing to read. An allocation for a payment that has not been
--     recorded is refused outright.
--   * `arrangement_id` is a plain uuid with NO foreign key, exactly as 0060
--     did: `service_arrangements` belongs to 0059, which may not be in the
--     ledger yet. Add the FK in a later migration once both are applied.
--
-- BACKFILL (the only mutation of existing rows, brief §14.2 step 2 and Phase
-- 0 §7 risk register "0013 index replacement")
--   For every existing non-void `build_milestone` invoice: create exactly one
--   obligation (kind build_milestone, milestone_key 'legacy-1', amounts
--   copied from the invoice, currency GBP, tax_code_ref 'legacy_no_tax',
--   orchestrator 'manual') and set `invoices.obligation_id`. A pre-check
--   raises — aborting the whole transaction — if any project would receive
--   two obligations with the same key. Only after the backfill is the old
--   index dropped. The invoice rows are otherwise untouched: amount, status,
--   Stripe / Xero / GoCardless ids and dates are not rewritten. The three
--   legacy clients keep their invoices exactly as they are; they merely gain
--   an obligation identity so the new Finance surface can list them.
--
-- EQUIVALENT PROTECTION AFTER DROPPING invoices_one_build_per_project
--   (a) `invoices_one_per_obligation`: one non-void invoice per obligation.
--   (b) `billing_obligations_milestone_key_unique`: one obligation per
--       (project, kind, milestone_key). Together: one live invoice per
--       project milestone — the 0013 rule generalised from "one milestone"
--       to "one per milestone key".
--   (c) `invoices_one_legacy_build_per_project`: the 0013 rule kept verbatim
--       for invoices WITHOUT an obligation, so the legacy generate path in
--       apps/web/lib/projectInvoice.ts (read, insert, catch the unique
--       violation) stays atomic and unchanged. New-model invoices always
--       carry an obligation and are not touched by (c).
--
-- DEPENDENCIES
--   0001 (tenants, projects, invoices, is_internal_staff(), set_updated_at()),
--   0013 (the index being replaced), auth.users. pgcrypto gen_random_uuid().
--
-- ACCESS
--   RLS enabled on every new table. Staff: for all using/with check
--   is_internal_staff(). No client policy: clients see money through the
--   existing invoice surfaces, never these ledgers. The service role bypasses
--   RLS as usual (webhook inbox writes to provider_payments).
--
-- NO provider call, no email, no invoice issuance, no mandate, no
-- subscription activation happens here (brief §14.2 "Migration dry-runs have
-- zero provider writes").
--
-- ROLLBACK (reverse order; the backfilled obligations are pure identity rows)
--   begin;
--   create unique index if not exists invoices_one_build_per_project
--     on public.invoices (project_id)
--     where type = 'build_milestone' and status <> 'void';
--   drop index if exists public.invoices_one_legacy_build_per_project;
--   drop index if exists public.invoices_one_per_obligation;
--   drop trigger if exists trg_payment_allocations_guard on public.payment_allocations;
--   drop function if exists public.payment_allocations_guard_amount();
--   drop table if exists public.payment_allocations;
--   drop table if exists public.provider_payments;
--   alter table public.invoices drop column if exists obligation_id;
--   drop table if exists public.billing_obligations;
--   commit;
--   (Recreating the 0013 index fails if a project has since gained two live
--   build invoices; resolve those by hand first — that is the point of it.)

begin;

-- ============================================================================
-- billing_obligations
-- ============================================================================

create table if not exists public.billing_obligations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  -- The system the debt belongs to. Null for a tenant-level obligation (a
  -- service period while the billing unit is tenant-wide, decision 18.7).
  project_id uuid references public.projects(id) on delete set null,
  -- The service arrangement (0059) that authorises a service_period or
  -- handover_fee. Plain uuid, no FK (see header).
  arrangement_id uuid,

  kind text not null check (
    kind in ('build_milestone', 'handover_fee', 'service_period', 'grow_item', 'one_off')
  ),
  -- Stable milestone identity within a project ('m1', 'deposit', 'legacy-1').
  -- Required for a build milestone; the uniqueness below keys on it.
  milestone_key text,
  -- Stable period identity for a service_period (§12.1 "a billing period
  -- needs a stable identity; never derive all history from a mutable next
  -- payment date").
  period_start date,
  period_end date,

  -- Money: integer minor units, net / tax / gross kept separately with the
  -- tax basis SNAPSHOT that produced them (§12.3). Never recomputed from a
  -- live catalogue.
  amount_net_minor integer not null check (amount_net_minor >= 0),
  tax_minor integer not null default 0 check (tax_minor >= 0),
  amount_gross_minor integer not null check (amount_gross_minor >= 0),
  currency text not null default 'GBP' check (currency = upper(currency) and length(currency) = 3),
  -- 'pending_decision' blocks issue; the handover fee carries it until 18.3.
  tax_code_ref text not null default 'pending_decision',

  -- When the invoice may be issued and when payment is due (UTC instants;
  -- the contractual local date lives on the schedule that authorised it).
  issue_at timestamptz,
  due_at timestamptz,
  -- How it is meant to be collected: 'invoice_terms' (client pays an issued
  -- invoice), 'direct_debit' (scheduled collection against a mandate),
  -- 'manual' (bank transfer recorded by staff), 'none' (informational).
  collection_policy text not null default 'invoice_terms' check (
    collection_policy in ('invoice_terms', 'direct_debit', 'manual', 'none')
  ),
  -- THE collection orchestrator. Exactly one per obligation (§10.1).
  orchestrator text not null default 'manual' check (
    orchestrator in ('xero_native', 'nullshift_gocardless', 'stripe', 'manual')
  ),
  state text not null default 'pending' check (
    state in ('pending', 'issued', 'part_paid', 'paid', 'void', 'disputed')
  ),

  -- Human label and the accepted record that authorises the debt
  -- ('order_form', 'service_schedule', 'handover_schedule', 'change_order',
  -- 'invoice' for the 0062 backfill). Evidence of origin, never a lookup
  -- that can change the amount.
  label text,
  source_kind text,
  source_id uuid,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint billing_obligations_gross_is_net_plus_tax check (
    amount_gross_minor = amount_net_minor + tax_minor
  ),
  constraint billing_obligations_milestone_has_key check (
    kind <> 'build_milestone' or milestone_key is not null
  ),
  constraint billing_obligations_period_has_dates check (
    kind <> 'service_period' or (period_start is not null and period_end is not null)
  ),
  constraint billing_obligations_period_ordered check (
    period_start is null or period_end is null or period_end > period_start
  ),
  constraint billing_obligations_service_period_has_arrangement check (
    kind <> 'service_period' or arrangement_id is not null
  )
);

comment on table public.billing_obligations is
  'One stable identity per commercial debt (brief §10.1). Invoice, collection, allocation and accounting rows point here; they are projections, not separate sales.';
comment on column public.billing_obligations.orchestrator is
  'The single collection orchestrator for this debt (§10.1). A Xero-native and a Nullshift GoCardless schedule must never both own one obligation.';
comment on column public.billing_obligations.tax_code_ref is
  'Snapshot of the approved tax code / basis used for tax_minor. pending_decision = cannot be issued (decision 18.3 / 18.8).';

create index if not exists billing_obligations_tenant_idx
  on public.billing_obligations (tenant_id, created_at desc);
create index if not exists billing_obligations_project_idx
  on public.billing_obligations (project_id);
create index if not exists billing_obligations_state_idx
  on public.billing_obligations (state, due_at);

-- One obligation per (project, kind, milestone key). Void rows keep their
-- identity: a reissue voids the INVOICE and raises a new one for the same
-- obligation (invoices_one_per_obligation excludes void), it does not mint a
-- second obligation for the same milestone.
create unique index if not exists billing_obligations_milestone_key_unique
  on public.billing_obligations (project_id, kind, milestone_key)
  where milestone_key is not null;

-- One service-period obligation per (arrangement, period start).
create unique index if not exists billing_obligations_service_period_unique
  on public.billing_obligations (arrangement_id, period_start)
  where kind = 'service_period';

drop trigger if exists trg_billing_obligations_updated on public.billing_obligations;
create trigger trg_billing_obligations_updated
  before update on public.billing_obligations
  for each row execute function public.set_updated_at();

-- ============================================================================
-- invoices.obligation_id + one live invoice per obligation
-- ============================================================================

alter table public.invoices
  add column if not exists obligation_id uuid references public.billing_obligations(id) on delete restrict;

comment on column public.invoices.obligation_id is
  'The billing obligation this invoice projects (0062). Null only for legacy invoices that predate obligations and were not build milestones.';

create index if not exists invoices_obligation_idx
  on public.invoices (obligation_id);

create unique index if not exists invoices_one_per_obligation
  on public.invoices (obligation_id)
  where obligation_id is not null and status <> 'void';

-- ============================================================================
-- provider_payments — the recorded amount of each provider money movement
-- ============================================================================

create table if not exists public.provider_payments (
  id uuid primary key default gen_random_uuid(),
  -- Null until matched to a client (an unmatched payout / bank credit).
  tenant_id uuid references public.tenants(id) on delete set null,
  provider text not null check (
    provider in ('gocardless', 'stripe', 'xero', 'bank', 'manual')
  ),
  -- The provider's own id (GoCardless PM…, Stripe pi_/ch_/re_…, a bank
  -- transaction reference, or a staff-minted reference for a manual record).
  provider_payment_id text not null,
  kind text not null check (
    kind in ('payment', 'refund', 'credit', 'chargeback', 'bank_return')
  ),
  -- Always positive; the sign is the kind.
  amount_minor integer not null check (amount_minor > 0),
  currency text not null default 'GBP' check (currency = upper(currency) and length(currency) = 3),
  -- live | test segregation (§12.3): test records never join live totals.
  environment text not null default 'live' check (environment in ('live', 'test')),
  received_at timestamptz not null default now(),
  -- The provider payload / bank line that proves the amount.
  evidence jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),

  unique (provider, provider_payment_id)
);

comment on table public.provider_payments is
  'Recorded provider money movements (0062). The ceiling every payment_allocations row is checked against; never a provider call.';

create index if not exists provider_payments_tenant_idx
  on public.provider_payments (tenant_id, received_at desc);

-- ============================================================================
-- payment_allocations — typed application of a provider payment to a debt
-- ============================================================================

create table if not exists public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete set null,
  obligation_id uuid not null references public.billing_obligations(id) on delete restrict,
  provider text not null check (
    provider in ('gocardless', 'stripe', 'xero', 'bank', 'manual')
  ),
  provider_payment_id text not null,
  kind text not null check (
    kind in ('payment', 'refund', 'credit', 'chargeback', 'bank_return')
  ),
  -- Always positive; the sign is the kind (§12.3 "refunds/credits are
  -- distinct typed operations").
  amount_minor integer not null check (amount_minor > 0),
  currency text not null default 'GBP' check (currency = upper(currency) and length(currency) = 3),
  allocated_at timestamptz not null default now(),
  -- Why this amount went to this obligation: match explanation, reviewer,
  -- bank line, provider event id.
  evidence jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),

  -- Idempotent per (payment, kind, obligation): a replayed webhook or a
  -- double-click cannot apply the same payment to the same debt twice. One
  -- payment may still be split across SEVERAL obligations (split transfer,
  -- several invoices in one transfer); the trigger below caps the total.
  unique (provider, provider_payment_id, kind, obligation_id)
);

comment on table public.payment_allocations is
  'Typed allocations of recorded provider payments to obligations (0062). Sum per (provider, payment, kind) can never exceed provider_payments.amount_minor.';

create index if not exists payment_allocations_obligation_idx
  on public.payment_allocations (obligation_id, allocated_at);
create index if not exists payment_allocations_invoice_idx
  on public.payment_allocations (invoice_id);
create index if not exists payment_allocations_payment_idx
  on public.payment_allocations (provider, provider_payment_id);

-- Guard: the provider payment must be recorded, must match kind and currency,
-- and the running total of allocations against it (same kind) must not exceed
-- its recorded amount. The provider_payments row is locked FOR UPDATE so two
-- concurrent allocations serialise instead of both passing the sum check.
create or replace function public.payment_allocations_guard_amount()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recorded public.provider_payments%rowtype;
  already integer;
  obligation_currency text;
begin
  select * into recorded
    from public.provider_payments p
   where p.provider = new.provider
     and p.provider_payment_id = new.provider_payment_id
   for update;

  if not found then
    raise exception 'payment_allocations: no recorded provider payment %/% — record it in provider_payments first',
      new.provider, new.provider_payment_id
      using errcode = 'foreign_key_violation';
  end if;

  if recorded.kind <> new.kind then
    raise exception 'payment_allocations: kind % does not match recorded provider payment kind %',
      new.kind, recorded.kind
      using errcode = 'check_violation';
  end if;

  if recorded.currency <> new.currency then
    raise exception 'payment_allocations: currency % does not match recorded provider payment currency %',
      new.currency, recorded.currency
      using errcode = 'check_violation';
  end if;

  select o.currency into obligation_currency
    from public.billing_obligations o
   where o.id = new.obligation_id;
  if obligation_currency is distinct from new.currency then
    raise exception 'payment_allocations: currency % does not match obligation currency %',
      new.currency, obligation_currency
      using errcode = 'check_violation';
  end if;

  select coalesce(sum(a.amount_minor), 0) into already
    from public.payment_allocations a
   where a.provider = new.provider
     and a.provider_payment_id = new.provider_payment_id
     and a.kind = new.kind
     and a.id <> new.id;

  if already + new.amount_minor > recorded.amount_minor then
    raise exception 'payment_allocations: allocating % would take provider payment %/% to % of a recorded %',
      new.amount_minor, new.provider, new.provider_payment_id,
      already + new.amount_minor, recorded.amount_minor
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke all on function public.payment_allocations_guard_amount() from public, anon;

drop trigger if exists trg_payment_allocations_guard on public.payment_allocations;
create trigger trg_payment_allocations_guard
  before insert or update of amount_minor, provider, provider_payment_id, kind, currency, obligation_id
  on public.payment_allocations
  for each row execute function public.payment_allocations_guard_amount();

-- ============================================================================
-- Row Level Security — staff only
-- ============================================================================

alter table public.billing_obligations enable row level security;
alter table public.provider_payments enable row level security;
alter table public.payment_allocations enable row level security;

drop policy if exists billing_obligations_staff_all on public.billing_obligations;
create policy billing_obligations_staff_all on public.billing_obligations
  for all to authenticated
  using (is_internal_staff()) with check (is_internal_staff());

drop policy if exists provider_payments_staff_all on public.provider_payments;
create policy provider_payments_staff_all on public.provider_payments
  for all to authenticated
  using (is_internal_staff()) with check (is_internal_staff());

drop policy if exists payment_allocations_staff_all on public.payment_allocations;
create policy payment_allocations_staff_all on public.payment_allocations
  for all to authenticated
  using (is_internal_staff()) with check (is_internal_staff());

-- ============================================================================
-- BACKFILL + index replacement (same transaction; see header)
-- ============================================================================

do $$
declare
  duplicate_projects integer;
  linked integer;
begin
  -- Pre-check 1: no project may end up with two 'legacy-1' obligations. The
  -- 0013 index should make this impossible, but the ledger is not reproducible
  -- from the directory (Phase 0 §11), so prove it rather than assume it.
  select count(*) into duplicate_projects
    from (
      select i.project_id
        from public.invoices i
       where i.type = 'build_milestone'
         and i.status <> 'void'
         and i.project_id is not null
         and i.obligation_id is null
       group by i.project_id
      having count(*) > 1
    ) d;
  if duplicate_projects > 0 then
    raise exception '0062 backfill aborted: % project(s) have more than one live build_milestone invoice; resolve by hand before applying',
      duplicate_projects;
  end if;

  -- Pre-check 2: a project that already carries a 'legacy-1' obligation (a
  -- partial earlier run) must not receive a second one.
  select count(*) into duplicate_projects
    from public.invoices i
    join public.billing_obligations o
      on o.project_id = i.project_id
     and o.kind = 'build_milestone'
     and o.milestone_key = 'legacy-1'
   where i.type = 'build_milestone'
     and i.status <> 'void'
     and i.obligation_id is null;
  if duplicate_projects > 0 then
    raise exception '0062 backfill aborted: % invoice(s) would collide with an existing legacy-1 obligation',
      duplicate_projects;
  end if;

  -- One obligation per live legacy build invoice. Amounts copied from the
  -- invoice (numeric(10,2) → integer pence); the legacy rail recorded no tax
  -- (Xero NoTax / NONE, which does NOT establish a VAT policy — Phase 0 §8
  -- #6, brief §10.3), so net = gross and the tax code is marked legacy.
  -- source_kind/source_id point back at the invoice so the UPDATE below and
  -- any re-run can find their own rows.
  insert into public.billing_obligations (
    tenant_id, project_id, kind, milestone_key,
    amount_net_minor, tax_minor, amount_gross_minor, currency, tax_code_ref,
    issue_at, due_at, collection_policy, orchestrator, state,
    label, source_kind, source_id, created_at
  )
  select
    i.tenant_id,
    i.project_id,
    'build_milestone',
    'legacy-1',
    round(i.amount * 100)::integer,
    0,
    round(i.amount * 100)::integer,
    'GBP',
    'legacy_no_tax',
    i.created_at,
    i.due_at,
    'manual',
    'manual',
    case i.status
      when 'paid' then 'paid'
      when 'draft' then 'pending'
      else 'issued'
    end,
    'Legacy build invoice (pre-0062)',
    'invoice',
    i.id,
    i.created_at
  from public.invoices i
  where i.type = 'build_milestone'
    and i.status <> 'void'
    and i.obligation_id is null;

  update public.invoices i
     set obligation_id = o.id
    from public.billing_obligations o
   where o.source_kind = 'invoice'
     and o.source_id = i.id
     and i.obligation_id is null;

  get diagnostics linked = row_count;

  -- Post-check: every live build invoice now has an obligation.
  if exists (
    select 1 from public.invoices i
     where i.type = 'build_milestone' and i.status <> 'void' and i.obligation_id is null
  ) then
    raise exception '0062 backfill aborted: a live build_milestone invoice is still without an obligation';
  end if;

  raise notice '0062 backfill linked % legacy build invoice(s) to obligations', linked;
end;
$$;

-- Equivalent protection for obligation-less invoices (the legacy generate
-- path), then — and only then — retire the 0013 project-wide rule.
create unique index if not exists invoices_one_legacy_build_per_project
  on public.invoices (project_id)
  where type = 'build_milestone' and status <> 'void' and obligation_id is null;

drop index if exists public.invoices_one_build_per_project;

commit;
