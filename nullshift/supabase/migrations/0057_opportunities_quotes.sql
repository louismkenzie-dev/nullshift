-- 0057: Opportunities, quotes, immutable quote versions and approval evidence
-- (admin redesign Phase 2, brief §5.2, §5.3, §12.1, §12.2, §12.5).
--
-- STATUS: APPLIED to Nullshift Ops (cweftpoaojwzllzficgt) on 2026-09-20 (0057 on 2026-09-17). Authored 2026-09-17 against the live
-- schema described in docs/ADMIN-REDESIGN-PHASE0-2026-09-17.md §11. Number
-- the ledger entry against `schema_migrations`, not this directory, before
-- applying (Phase 0 decision N-h).
--
-- Purpose
--   Introduce the commercial pipeline the brief asks for without touching
--   `projects`, `order_forms`, `subscriptions` or any legacy row:
--
--   opportunities   a prospect or an existing client's next project, with a
--                   pipeline stage that is separate from delivery and billing
--   quotes          one commercial thread per opportunity/project label; points
--                   at its current version
--   quote_versions  the document version. Status runs
--                   draft → internal_review → approved_to_issue → issued →
--                   accepted | declined | expired | superseded | withdrawn.
--                   Content columns (brief/scope/estimate/commercial/internal)
--                   are frozen by trigger once the row leaves draft or
--                   internal_review: an issued offer is never mutated, an edit
--                   creates the next version and supersedes the old one on issue
--   quote_approvals append-only approval evidence. The approver must differ
--                   from the version's author (separation of duties, §12.5) and
--                   a below-floor approval must carry a reason
--
-- Money inside the jsonb payloads is integer minor units (pence); the currency
-- is an explicit column on quote_versions. Nothing here is an approved price
-- list: policy_version / formula_version record which draft policy produced
-- the numbers.
--
-- Dependencies
--   0001 (tenants, is_internal_staff(), set_updated_at()), auth.users.
--   No dependency on 0056 (client_economics, PR #20) or any side-branch file.
--
-- Access
--   RLS enabled on all four tables. Staff only (is_internal_staff()); there are
--   no client policies yet — the portal reads quotes in a later phase through
--   a projection that excludes `internal`. quote_approvals has no update or
--   delete policy for anyone but the service role.
--
-- Rollback
--   drop table if exists public.quote_approvals;
--   alter table if exists public.quotes drop constraint if exists quotes_current_version_fk;
--   drop table if exists public.quote_versions;
--   drop table if exists public.quotes;
--   drop table if exists public.opportunities;
--   drop function if exists public.quote_versions_guard_frozen_content();
--   drop function if exists public.quote_approvals_guard_separation();
--   No existing table or row is altered by this file, so rollback loses only
--   data written to these four tables.

-- ============================================================================
-- Opportunities (§5.2 pipeline)
-- ============================================================================

create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  -- Null for a prospect that is not yet a client. Winning an opportunity for an
  -- existing client links it here; it never creates a second billing identity.
  tenant_id uuid references public.tenants(id) on delete set null,

  legal_name text not null,
  trading_name text,
  contact_name text,
  contact_email text,
  contact_phone text,

  stage text not null default 'new_enquiry' check (
    stage in (
      'new_enquiry', 'qualified', 'discovery', 'scope_ready',
      'quote_in_review', 'sent', 'negotiation', 'won', 'lost'
    )
  ),
  owner text,
  next_action text,
  next_action_due date,
  -- Weighted pipeline is shown only when this is explicitly set (§5.2).
  probability_pct integer check (
    probability_pct is null or (probability_pct >= 0 and probability_pct <= 100)
  ),
  source text,
  decision_rationale text,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists opportunities_stage_idx
  on public.opportunities (stage, updated_at desc);
create index if not exists opportunities_tenant_idx
  on public.opportunities (tenant_id);

drop trigger if exists trg_opportunities_updated on public.opportunities;
create trigger trg_opportunities_updated
  before update on public.opportunities
  for each row execute function public.set_updated_at();

-- ============================================================================
-- Quotes (one thread per opportunity + project label)
-- ============================================================================

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete restrict,
  tenant_id uuid references public.tenants(id) on delete set null,
  project_label text not null,
  -- The version the business currently stands behind (set on issue). FK added
  -- below once quote_versions exists.
  current_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quotes_opportunity_idx on public.quotes (opportunity_id);
create index if not exists quotes_tenant_idx on public.quotes (tenant_id);

drop trigger if exists trg_quotes_updated on public.quotes;
create trigger trg_quotes_updated
  before update on public.quotes
  for each row execute function public.set_updated_at();

-- ============================================================================
-- Quote versions (§5.2 states, §12.1 "Quote / document version")
-- ============================================================================

create table if not exists public.quote_versions (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete restrict,
  version_no integer not null check (version_no > 0),

  status text not null default 'draft' check (
    status in (
      'draft', 'internal_review', 'approved_to_issue', 'issued',
      'accepted', 'declined', 'expired', 'superseded', 'withdrawn'
    )
  ),
  currency text not null default 'GBP' check (currency = upper(currency) and length(currency) = 3),
  expires_at timestamptz,

  -- Step payloads (§5.3). Money inside is integer minor units in `currency`.
  brief jsonb not null default '{}'::jsonb,
  scope jsonb not null default '{}'::jsonb,
  estimate jsonb not null default '{}'::jsonb,
  commercial jsonb not null default '{}'::jsonb,
  -- Never leaves the staff surface: rates, margins, floor, checks, overrides.
  internal jsonb not null default '{}'::jsonb,

  policy_version text,
  formula_version text,

  author uuid references auth.users(id) on delete set null,
  issued_at timestamptz,
  accepted_at timestamptz,
  superseded_by uuid references public.quote_versions(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (quote_id, version_no),
  constraint quote_versions_issued_has_time check (status <> 'issued' or issued_at is not null),
  constraint quote_versions_accepted_has_time check (status <> 'accepted' or accepted_at is not null),
  constraint quote_versions_superseded_has_successor check (
    status <> 'superseded' or superseded_by is not null
  )
);

create index if not exists quote_versions_quote_idx
  on public.quote_versions (quote_id, version_no desc);
create index if not exists quote_versions_status_idx
  on public.quote_versions (status, updated_at desc);

alter table public.quotes
  drop constraint if exists quotes_current_version_fk;
alter table public.quotes
  add constraint quotes_current_version_fk
  foreign key (current_version_id) references public.quote_versions(id) on delete set null;

drop trigger if exists trg_quote_versions_updated on public.quote_versions;
create trigger trg_quote_versions_updated
  before update on public.quote_versions
  for each row execute function public.set_updated_at();

-- Issued content is immutable. Once a version has left draft / internal_review
-- its five content payloads cannot change; an edit is a new version. The check
-- reads OLD.status so "approve and edit in one statement" is refused too.
-- quote_id and version_no never change at all.
create or replace function public.quote_versions_guard_frozen_content()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.quote_id <> old.quote_id or new.version_no <> old.version_no then
    raise exception 'quote_versions: quote_id and version_no are immutable (id %)', old.id
      using errcode = 'check_violation';
  end if;

  if old.status not in ('draft', 'internal_review') and (
       new.brief      is distinct from old.brief
    or new.scope      is distinct from old.scope
    or new.estimate   is distinct from old.estimate
    or new.commercial is distinct from old.commercial
    or new.internal   is distinct from old.internal
  ) then
    raise exception
      'quote_versions: content is frozen once status is % (id %); create a new version',
      old.status, old.id
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_quote_versions_frozen on public.quote_versions;
create trigger trg_quote_versions_frozen
  before update on public.quote_versions
  for each row execute function public.quote_versions_guard_frozen_content();

-- ============================================================================
-- Quote approvals (append-only evidence, §12.5 separation of duties)
-- ============================================================================

create table if not exists public.quote_approvals (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.quote_versions(id) on delete cascade,
  approver uuid references auth.users(id) on delete set null,
  decision text not null check (decision in ('approve', 'reject')),
  reason text,
  below_floor boolean not null default false,
  created_at timestamptz not null default now(),
  -- A below-floor approval without a written reason is not an approval.
  constraint quote_approvals_below_floor_reason check (
    decision <> 'approve' or not below_floor or (reason is not null and length(trim(reason)) > 0)
  )
);

create index if not exists quote_approvals_version_idx
  on public.quote_approvals (version_id, created_at desc);

-- The author of a version cannot approve it. Enforced here as well as in the
-- server action so a direct PostgREST call cannot bypass it.
create or replace function public.quote_approvals_guard_separation()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_author uuid;
begin
  select author into v_author from public.quote_versions where id = new.version_id;
  if new.approver is not null and v_author is not null and new.approver = v_author then
    raise exception 'quote_approvals: approver must differ from the version author (version %)',
      new.version_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_quote_approvals_separation on public.quote_approvals;
create trigger trg_quote_approvals_separation
  before insert on public.quote_approvals
  for each row execute function public.quote_approvals_guard_separation();

-- ============================================================================
-- Row Level Security — staff only, no client policies yet
-- ============================================================================

alter table public.opportunities enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_versions enable row level security;
alter table public.quote_approvals enable row level security;

drop policy if exists opportunities_staff_all on public.opportunities;
create policy opportunities_staff_all on public.opportunities
  for all to authenticated
  using (is_internal_staff()) with check (is_internal_staff());

drop policy if exists quotes_staff_all on public.quotes;
create policy quotes_staff_all on public.quotes
  for all to authenticated
  using (is_internal_staff()) with check (is_internal_staff());

drop policy if exists quote_versions_staff_all on public.quote_versions;
create policy quote_versions_staff_all on public.quote_versions
  for all to authenticated
  using (is_internal_staff()) with check (is_internal_staff());

-- Evidence is append-only: staff may read and insert; nobody but the service
-- role may update or delete.
drop policy if exists quote_approvals_staff_select on public.quote_approvals;
create policy quote_approvals_staff_select on public.quote_approvals
  for select to authenticated
  using (is_internal_staff());

drop policy if exists quote_approvals_staff_insert on public.quote_approvals;
create policy quote_approvals_staff_insert on public.quote_approvals
  for insert to authenticated
  with check (is_internal_staff());
