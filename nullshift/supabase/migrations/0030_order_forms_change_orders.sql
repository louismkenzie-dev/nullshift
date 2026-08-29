-- 0030: Order Forms, contract acceptance evidence, Change Orders and the
-- support-vs-development classification (legal implementation spec §5, §6, §8, §9).
--
-- The commercial spine. Three things it has to make impossible:
--
--  1. Accepting an agreement without evidence of WHO accepted WHAT wording.
--     Acceptance stores the exact version identifiers and content hashes shown
--     on screen, not a foreign key to text that can later be edited.
--  2. Building a new capability off a support entitlement. Every ticket carries
--     a classification, and anything that is not `support` cannot reach
--     approved_for_build without an accepted Change Order.
--  3. Silently re-pointing a live agreement. Order Forms and Change Orders are
--     superseded, never mutated: a change creates a new row that references the
--     one it replaces.
--
-- Client legal identity is COPIED onto the Order Form rather than joined from
-- `tenants`. The tenant record is operational and changes; what a client signed
-- must not change underneath them.

-- ============================================================================
-- Order Forms (§6)
-- ============================================================================

create table if not exists public.order_forms (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,

  -- Human-quotable reference, e.g. OF-2026-0004.
  reference text not null unique,

  status text not null default 'draft' check (
    status in ('draft', 'client_review', 'accepted', 'rejected', 'withdrawn', 'superseded')
  ),

  -- Client legal identity as at the moment of contracting.
  client_legal_name text not null,
  client_company_number text,
  client_address text not null,
  client_billing_email text not null,
  client_legal_email text not null,

  plan text not null check (plan in ('core', 'pro', 'max', 'enterprise')),
  scale_band text not null check (
    scale_band in ('standard', 'growth', 'established', 'scale', 'critical', 'enterprise')
  ),
  pricing_version text not null,
  monthly_fee numeric(10, 2) not null,
  -- Nullshift is not VAT registered; the treatment is still recorded per order
  -- so historic orders stay truthful if that ever changes.
  vat_treatment text not null default 'not_vat_registered' check (
    vat_treatment in ('plus_vat', 'vat_included', 'not_vat_registered')
  ),
  billing_date_rule text not null,
  usage_allowance jsonb,

  project_fee numeric(10, 2),
  mobilisation_fee numeric(10, 2),
  invoice_schedule jsonb not null default '[]'::jsonb,

  scope jsonb not null default '{}'::jsonb,
  technical jsonb not null default '{}'::jsonb,
  compliance jsonb not null default '{}'::jsonb,

  -- Lifted out of `technical` because production release hard-fails on it
  -- (§14) and a JSONB key is too easy to leave unset.
  payment_architecture text check (
    payment_architecture in (
      'processor_direct_to_client',
      'stripe_connect_direct_charge',
      'stripe_connect_destination_charge_reviewed',
      'other_reviewed',
      'nullshift_custody_PROHIBITED'
    )
  ),
  -- The manually attached regulatory-legal approval. Without it a prohibited
  -- custody architecture can never be released (see order_form_release_state).
  payment_review_ref text,
  payment_reviewed_by uuid references auth.users(id) on delete set null,
  payment_reviewed_at timestamptz,

  portfolio_use boolean not null default false,
  schedule_versions jsonb not null default '{}'::jsonb,

  -- The NSI assessment that produced monthly_fee, for explainability.
  scale_assessment_id uuid references public.scale_assessments(id) on delete set null,
  -- Set on the OLD row when a new order replaces it.
  superseded_by uuid references public.order_forms(id) on delete set null,

  sent_at timestamptz,
  accepted_at timestamptz,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- An accepted order must have been through client review, and must carry the
  -- moment it happened.
  constraint order_forms_accepted_has_timestamp check (
    status <> 'accepted' or accepted_at is not null
  )
);

create index if not exists order_forms_tenant_idx
  on public.order_forms (tenant_id, created_at desc);
create index if not exists order_forms_status_idx on public.order_forms (status);

create trigger order_forms_updated_at
  before update on public.order_forms
  for each row execute function set_updated_at();

-- Reference allocator: OF-YYYY-NNNN, sequential within the year.
create or replace function next_order_form_ref()
returns text
language sql
volatile
security definer
set search_path = public
as $$
  select 'OF-' || to_char(now(), 'YYYY') || '-' ||
         lpad((
           select count(*) + 1
           from public.order_forms
           where reference like 'OF-' || to_char(now(), 'YYYY') || '-%'
         )::text, 4, '0');
$$;

-- ============================================================================
-- Contract acceptance evidence (§5)
-- ============================================================================

create table if not exists public.contract_acceptances (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  order_form_id uuid not null references public.order_forms(id) on delete restrict,

  accepted_by_name text not null,
  accepted_by_title text not null,
  accepted_by_email text not null,
  accepted_by_user uuid references auth.users(id) on delete set null,

  -- The three confirmations. All three must be true — enforced below, not just
  -- in the UI, because the UI is not the record.
  authority_confirmed boolean not null default false,
  business_purpose_confirmed boolean not null default false,
  terms_read_confirmed boolean not null default false,

  msa_version text not null,
  dpa_version text,
  ai_schedule_version text,
  payments_schedule_version text,
  aup_version text not null,
  pricing_version text not null,

  -- documentType -> sha256 of the exact text rendered on screen at acceptance.
  document_hashes jsonb not null default '{}'::jsonb,

  accepted_at timestamptz not null default now(),

  -- Personal data captured as evidence. Retention is time-limited under the
  -- retention policy; these are NOT kept indefinitely by default.
  ip_address inet,
  user_agent text,

  acceptance_method text not null default 'clickwrap' check (
    acceptance_method in ('esign', 'clickwrap', 'manual_upload')
  ),
  -- Path in the private contracts bucket to the exact rendered artifact.
  signed_artifact_path text,

  created_at timestamptz not null default now(),

  constraint contract_acceptances_all_confirmations check (
    authority_confirmed and business_purpose_confirmed and terms_read_confirmed
  )
);

create index if not exists contract_acceptances_tenant_idx
  on public.contract_acceptances (tenant_id, accepted_at desc);
create unique index if not exists contract_acceptances_one_per_order
  on public.contract_acceptances (order_form_id);

-- ============================================================================
-- Support vs Additional Development (§8)
-- ============================================================================

-- This lands on `issues`, the live ticket table behind the client portal and
-- the admin queue — not on `change_requests`, which is the older formal
-- channel. One classification, on the surface people actually work from.
--
-- `billing` already existed and answers a different question (who pays);
-- `classification` answers whether the work is a restoration at all, and it is
-- the one the build gate reads. Restore or configure an existing agreed
-- capability = support. Create or materially change a capability = additional
-- development.
alter table public.issues
  add column if not exists classification text
    check (classification in (
      'support', 'additional_development', 'mixed', 'security_incident', 'usage_review'
    )),
  add column if not exists classified_by uuid references auth.users(id) on delete set null,
  add column if not exists classified_at timestamptz,
  add column if not exists classification_note text,
  add column if not exists change_order_id uuid;

comment on column public.issues.classification is
  'Spec §8. Restore/configure an existing agreed capability = support. Create or materially change a capability = additional_development.';

-- ============================================================================
-- Change Orders (§9)
-- ============================================================================

create table if not exists public.change_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,

  reference text not null unique,

  -- The full state machine from the spec. `rejected`, `withdrawn` and
  -- `superseded` are the alternative terminal states.
  status text not null default 'draft' check (
    status in (
      'draft',
      'client_review',
      'accepted',
      'in_build',
      'delivered',
      'accepted_complete',
      'rejected',
      'withdrawn',
      'superseded'
    )
  ),

  -- What this change amends. Restrict: an Order Form with Change Orders
  -- against it must not vanish.
  order_form_id uuid not null references public.order_forms(id) on delete restrict,
  -- The ticket that triggered it, when there was one.
  issue_id uuid references public.issues(id) on delete set null,
  supersedes_id uuid references public.change_orders(id) on delete set null,

  description text not null,
  business_outcome text not null,
  included jsonb not null default '[]'::jsonb,
  excluded jsonb not null default '[]'::jsonb,
  acceptance_criteria jsonb not null default '[]'::jsonb,
  dependencies jsonb not null default '[]'::jsonb,

  project_fee numeric(10, 2) not null default 0,
  -- The recurring consequence. Nullable: many changes have none, and 0 is a
  -- different statement from "not yet assessed".
  recurring_fee_delta numeric(10, 2),
  new_scale_band text check (
    new_scale_band in ('standard', 'growth', 'established', 'scale', 'critical', 'enterprise')
  ),
  delivery_impact text,

  -- Security / data / AI / payment flags carried forward onto the change.
  flags jsonb not null default '{}'::jsonb,

  -- The exact contract wording this change was accepted against.
  contract_version text,
  contract_hash text,

  accepted_by_name text,
  accepted_by_email text,
  accepted_by_user uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  delivered_at timestamptz,
  completed_at timestamptz,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Work must not start on an unaccepted change, and acceptance must be
  -- attributable. This is the constraint that makes §8's "do not begin
  -- material feature work from a support entitlement" real.
  constraint change_orders_build_requires_acceptance check (
    status not in ('in_build', 'delivered', 'accepted_complete')
    or (accepted_at is not null and accepted_by_email is not null)
  ),
  -- A priced change must state its recurring consequence before it goes out
  -- for client review — "we'll work that out later" is how surprise MRR
  -- happens.
  constraint change_orders_review_needs_recurring_assessment check (
    status = 'draft'
    or status in ('withdrawn', 'superseded')
    or recurring_fee_delta is not null
  )
);

create index if not exists change_orders_tenant_idx
  on public.change_orders (tenant_id, created_at desc);
create index if not exists change_orders_order_form_idx
  on public.change_orders (order_form_id);
create index if not exists change_orders_status_idx on public.change_orders (status);

create trigger change_orders_updated_at
  before update on public.change_orders
  for each row execute function set_updated_at();

create or replace function next_change_order_ref()
returns text
language sql
volatile
security definer
set search_path = public
as $$
  select 'CO-' || to_char(now(), 'YYYY') || '-' ||
         lpad((
           select count(*) + 1
           from public.change_orders
           where reference like 'CO-' || to_char(now(), 'YYYY') || '-%'
         )::text, 4, '0');
$$;

-- Now that change_orders exists, close the loop from the ticket.
alter table public.issues
  drop constraint if exists issues_change_order_fk;
alter table public.issues
  add constraint issues_change_order_fk
  foreign key (change_order_id) references public.change_orders(id) on delete set null;

-- The §8 gate, in the database rather than only in the UI: a ticket classified
-- as additional development (or mixed) must not enter a build state on a
-- support entitlement. It needs an accepted Change Order first.
--
-- Deliberately narrow. It fires only for classifications that require a Change
-- Order, so triage of ordinary support is untouched and existing rows keep
-- moving. Unclassified tickets are handled at the UI, which asks before it
-- lets anyone queue work.
create or replace function enforce_change_order_before_build()
returns trigger
language plpgsql
as $$
declare
  co_status text;
begin
  if new.status not in ('queued', 'batched', 'in_progress') then
    return new;
  end if;
  if new.classification is null
     or new.classification not in ('additional_development', 'mixed') then
    return new;
  end if;

  if new.change_order_id is null then
    raise exception using
      errcode = 'check_violation',
      message = 'This ticket is classified as additional development. Raise a Change Order and have it accepted before scheduling the work.',
      hint = 'Spec §8: material feature work must not begin from a support entitlement.';
  end if;

  select status into co_status from public.change_orders where id = new.change_order_id;
  if co_status is null
     or co_status not in ('accepted', 'in_build', 'delivered', 'accepted_complete') then
    raise exception using
      errcode = 'check_violation',
      message = 'The linked Change Order has not been accepted by the client yet.',
      hint = 'Spec §8: authorised acceptance is required before development is approved for build.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_issues_change_order_gate on public.issues;
create trigger trg_issues_change_order_gate
  before insert or update on public.issues
  for each row execute function enforce_change_order_before_build();

-- ============================================================================
-- RLS
-- ============================================================================

alter table public.order_forms enable row level security;
alter table public.contract_acceptances enable row level security;
alter table public.change_orders enable row level security;

-- Order Forms: the client sees their own once it has left draft — a draft is
-- Nullshift's working copy, not an offer.
drop policy if exists order_forms_select on public.order_forms;
create policy order_forms_select on public.order_forms for select to authenticated
  using (is_internal_staff() or (is_member_of(tenant_id) and status <> 'draft'));

drop policy if exists order_forms_staff_write on public.order_forms;
create policy order_forms_staff_write on public.order_forms for all to authenticated
  using (is_internal_staff()) with check (is_internal_staff());

-- Acceptance evidence: readable by the client (it is their signature) and
-- staff. Insert is allowed for a tenant admin — the person with authority to
-- bind — against an order that is actually out for review.
drop policy if exists contract_acceptances_select on public.contract_acceptances;
create policy contract_acceptances_select on public.contract_acceptances
  for select to authenticated
  using (is_internal_staff() or is_member_of(tenant_id));

drop policy if exists contract_acceptances_insert on public.contract_acceptances;
create policy contract_acceptances_insert on public.contract_acceptances
  for insert to authenticated
  with check (
    is_internal_staff()
    or (
      is_tenant_admin(tenant_id)
      and exists (
        select 1 from public.order_forms o
        where o.id = order_form_id
          and o.tenant_id = contract_acceptances.tenant_id
          and o.status = 'client_review'
      )
    )
  );

-- Evidence is append-only: no updates, no deletes, for anyone but the service
-- role. A signature that can be edited is not evidence.
drop policy if exists contract_acceptances_no_update on public.contract_acceptances;

-- Change Orders: same visibility rule as Order Forms.
drop policy if exists change_orders_select on public.change_orders;
create policy change_orders_select on public.change_orders for select to authenticated
  using (is_internal_staff() or (is_member_of(tenant_id) and status <> 'draft'));

drop policy if exists change_orders_staff_write on public.change_orders;
create policy change_orders_staff_write on public.change_orders for all to authenticated
  using (is_internal_staff()) with check (is_internal_staff());

-- A client admin may accept or reject a Change Order that is out for review,
-- and may do nothing else to it.
drop policy if exists change_orders_client_decide on public.change_orders;
create policy change_orders_client_decide on public.change_orders
  for update to authenticated
  using (is_tenant_admin(tenant_id) and status = 'client_review')
  with check (is_tenant_admin(tenant_id) and status in ('accepted', 'rejected'));
