-- 0059: service arrangements, service schedules, handover schedules and
-- acceptance snapshots (admin redesign Phase 3, task p3-arrangements;
-- brief §2.1, §3.3 #1, §8.1, §8.3, §8.4, §9, §17.1 rows 1, 4, 6, 7, 8).
--
-- STATUS: APPLIED to Nullshift Ops (cweftpoaojwzllzficgt) on 2026-09-20 (0057 on 2026-09-17). Authored 2026-09-17 against the live
-- schema described in docs/ADMIN-REDESIGN-PHASE0-2026-09-17.md §11. Number
-- the ledger entry against `schema_migrations`, not this directory, before
-- applying (Phase 0 decision N-h). Nothing reads or writes these objects
-- unless OPS_V2_FLAGS contains `commercialV2`.
--
-- PURPOSE
--   The current Order Form requires a plan and a monthly fee (0030:43-48), so
--   it cannot represent "Managed selected, tier pending" (Phase 0 §8 #1). This
--   file adds a versioned representation alongside it — never a dummy £0 price
--   or a default plan:
--
--   order_forms.commercial_version
--       'v1' for every existing row (the default; no row is rewritten). A
--       form drafted from the OrderFormV2 type carries 'v2', which means its
--       route election and any package live in service_arrangements, not in
--       the v1 plan/monthly_fee columns.
--
--   service_arrangements
--       The route election (managed | independent | unresolved), the package
--       state (pending | accepted | not_applicable) and the contractual
--       billing-start arrangement (exact_date | conditional_wording |
--       unresolved). Selecting Managed is NOT consent to an amount: the later
--       package, price, currency, cadence, start and terms are a separately
--       accepted service schedule (brief §2.1 "Consent matters"). A change
--       after signature is a new row that supersedes the old one; the old
--       row is preserved (§17.1 "Route changes after signature").
--
--   service_schedules
--       Versioned managed service schedules (brief §9 item 3). Content is
--       frozen by trigger once the row leaves draft; issue requires a second
--       person's review (reviewed_by <> issued_by); acceptance records the
--       signatory, method, IP/UA and the sha256 of the frozen snapshot. Money
--       is integer minor units with an explicit currency column.
--
--   handover_schedules
--       The independent handover schedule (brief §9 item 4): the £600 fee as
--       a confirmed commercial decision, tax basis 'pending' until decision
--       18.3, included work, dependencies, cost responsibility and the
--       application-fee disposition (decision 18.4). Cannot be issued while
--       the tax basis is pending (brief §6.5).
--
--   contract_acceptances.order_form_snapshot / snapshot_hash /
--   rendered_snapshot_path
--       The exact Order Form content the client accepted, so an accepted
--       document is never regenerated from today's mutable catalogue
--       (brief §9). Additive; the existing hashes column is untouched.
--
-- WHAT THIS FILE DOES NOT DO
--   It does not relax any existing NOT NULL (order_forms.plan, monthly_fee,
--   scale_band, pricing_version stay as they are — a v2 form must still be
--   written with those columns until a later, separately approved migration).
--   It does not create subscriptions, obligations or collections; activation
--   gates are code (apps/web/lib/legal/arrangements.ts) behind
--   `billingActivation`, which is off. No existing row is mutated; there is
--   no backfill. The three legacy clients are untouched.
--
-- DEPENDENCIES
--   0001 (tenants, projects, memberships, is_internal_staff(), is_member_of(),
--   set_updated_at()), 0030 (order_forms, contract_acceptances), auth.users.
--   No dependency on 0056 (PR #20) or any side-branch file.
--
-- ACCESS
--   RLS enabled on the three new tables. Staff (is_internal_staff()) read and
--   write. Tenant members never touch the tables directly: they read their
--   own issued/accepted schedules through the two *_client views below,
--   which project only client-safe columns (no reviewer ids, no IP/UA, no
--   internal refs). Client acceptance is written by trusted server code with
--   the service role after an explicit membership + role check.
--
-- ROLLBACK (manual, in this order; loses only data written under the flag)
--   drop view if exists public.handover_schedules_client;
--   drop view if exists public.service_schedules_client;
--   drop table if exists public.handover_schedules;
--   drop table if exists public.service_schedules;
--   drop table if exists public.service_arrangements;
--   drop function if exists public.schedules_guard_frozen_content();
--   drop function if exists public.supersede_service_arrangement(uuid, text, text);
--   alter table public.contract_acceptances
--     drop column if exists rendered_snapshot_path,
--     drop column if exists snapshot_hash,
--     drop column if exists order_form_snapshot;
--   alter table public.order_forms drop column if exists commercial_version;

-- ============================================================================
-- order_forms.commercial_version (additive, default 'v1', no row rewritten)
-- ============================================================================

alter table public.order_forms
  add column if not exists commercial_version text not null default 'v1';

alter table public.order_forms
  drop constraint if exists order_forms_commercial_version_check;
alter table public.order_forms
  add constraint order_forms_commercial_version_check
  check (commercial_version in ('v1', 'v2'));

comment on column public.order_forms.commercial_version is
  'v1 = plan/monthly_fee columns govern (every pre-0059 row). v2 = route election and any package live in service_arrangements / service_schedules; the v1 columns are legacy-shaped placeholders that must not be billed from.';

-- ============================================================================
-- contract_acceptances: the exact accepted Order Form content (brief §9)
-- ============================================================================

alter table public.contract_acceptances
  add column if not exists order_form_snapshot jsonb,
  add column if not exists snapshot_hash text,
  add column if not exists rendered_snapshot_path text;

comment on column public.contract_acceptances.order_form_snapshot is
  'Canonical JSON of the Order Form commercial content as accepted. Never regenerated from the live order_forms row or the catalogue.';
comment on column public.contract_acceptances.snapshot_hash is
  'sha256 (hex) of the canonical JSON in order_form_snapshot (apps/web/lib/legal/acceptanceSnapshot.ts).';
comment on column public.contract_acceptances.rendered_snapshot_path is
  'Path in the private contracts bucket to the rendered document the client saw, when one was stored.';

-- ============================================================================
-- service_arrangements (§8.1 route election, §2.1 consent)
-- ============================================================================

create table if not exists public.service_arrangements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  -- The system this arrangement covers. Null while the billing unit for a
  -- multi-system client is undecided (Phase 0 decision 18.7).
  project_id uuid references public.projects(id) on delete set null,
  -- The Order Form that elected the route. Null for an arrangement recorded
  -- ahead of a v2 form (e.g. staff-recorded from a legacy proposal).
  order_form_id uuid references public.order_forms(id) on delete set null,

  route text not null default 'unresolved' check (
    route in ('managed', 'independent', 'unresolved')
  ),
  -- Managed: pending until a service schedule is accepted. Independent: not
  -- applicable — there is no ongoing Nullshift management service.
  package_state text not null default 'pending' check (
    package_state in ('pending', 'accepted', 'not_applicable')
  ),
  -- The contractual billing-start term (§8.1). 'unresolved' is an explicit,
  -- owned exception, never a silently invented date.
  billing_start_arrangement text not null default 'unresolved' check (
    billing_start_arrangement in ('exact_date', 'conditional_wording', 'unresolved')
  ),
  billing_start_date date,
  -- Reference to the approved conditional wording (solicitor-reviewed), when
  -- the exact date is not yet known.
  approved_wording_ref text,

  state text not null default 'active' check (state in ('active', 'superseded')),
  -- Variation chain: a route change after signature is a new row.
  supersedes_id uuid references public.service_arrangements(id) on delete set null,
  superseded_by uuid references public.service_arrangements(id) on delete set null,
  variation_reason text,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint service_arrangements_exact_date_has_date check (
    billing_start_arrangement <> 'exact_date' or billing_start_date is not null
  ),
  constraint service_arrangements_conditional_has_wording check (
    billing_start_arrangement <> 'conditional_wording' or approved_wording_ref is not null
  ),
  -- Independent ⇔ no package; Managed / unresolved ⇔ pending or accepted.
  constraint service_arrangements_route_package_consistent check (
    (route = 'independent') = (package_state = 'not_applicable')
  ),
  constraint service_arrangements_superseded_has_successor check (
    state <> 'superseded' or superseded_by is not null
  ),
  constraint service_arrangements_no_self_supersede check (
    supersedes_id is null or supersedes_id <> id
  )
);

create index if not exists service_arrangements_tenant_idx
  on public.service_arrangements (tenant_id, created_at desc);
create index if not exists service_arrangements_order_form_idx
  on public.service_arrangements (order_form_id);
-- One active arrangement per service unit (tenant + project, or the tenant
-- alone while project_id is null). A variation supersedes before it activates.
create unique index if not exists service_arrangements_one_active_per_unit
  on public.service_arrangements (tenant_id, coalesce(project_id, tenant_id))
  where state = 'active';

drop trigger if exists trg_service_arrangements_updated on public.service_arrangements;
create trigger trg_service_arrangements_updated
  before update on public.service_arrangements
  for each row execute function public.set_updated_at();

-- A route change after signature: one transaction that inserts the successor,
-- marks the old row superseded and activates the successor, so the partial
-- unique index, the FK and the "superseded has successor" CHECK all hold at
-- every statement boundary and no half-variation can be observed. SECURITY
-- INVOKER: the staff RLS policy applies; created_by is the caller.
create or replace function public.supersede_service_arrangement(
  p_old_id uuid,
  p_route text,
  p_reason text
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_old public.service_arrangements%rowtype;
  v_new_id uuid;
  v_package_state text;
begin
  if p_route not in ('managed', 'independent', 'unresolved') then
    raise exception 'service_arrangements: unknown route %', p_route using errcode = 'check_violation';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'service_arrangements: a variation needs a reason' using errcode = 'check_violation';
  end if;

  select * into v_old
  from public.service_arrangements
  where id = p_old_id and state = 'active'
  for update;
  if not found then
    raise exception 'service_arrangements: % is not an active arrangement', p_old_id
      using errcode = 'no_data_found';
  end if;
  if v_old.route = p_route then
    raise exception 'service_arrangements: route is already %', p_route using errcode = 'check_violation';
  end if;

  v_package_state := case when p_route = 'independent' then 'not_applicable' else 'pending' end;

  -- Successor enters as a superseded placeholder pointing at the old row so
  -- the CHECK/FK are satisfied before the old row can reference it.
  insert into public.service_arrangements (
    tenant_id, project_id, order_form_id, route, package_state,
    billing_start_arrangement, billing_start_date, approved_wording_ref,
    state, supersedes_id, superseded_by, variation_reason, created_by
  ) values (
    v_old.tenant_id, v_old.project_id, v_old.order_form_id, p_route, v_package_state,
    'unresolved', null, null,
    'superseded', v_old.id, v_old.id, p_reason, auth.uid()
  ) returning id into v_new_id;

  update public.service_arrangements
     set state = 'superseded', superseded_by = v_new_id
   where id = v_old.id;

  update public.service_arrangements
     set state = 'active', superseded_by = null
   where id = v_new_id;

  return v_new_id;
end;
$$;

revoke all on function public.supersede_service_arrangement(uuid, text, text) from public, anon;
grant execute on function public.supersede_service_arrangement(uuid, text, text) to authenticated;

-- ============================================================================
-- Shared trigger: schedule content is frozen once it leaves draft
-- ============================================================================

-- Used by both schedule tables. Once OLD.status is not 'draft' the commercial
-- content and the frozen snapshot/hash cannot change; an edit is a new
-- version. arrangement_id and version_no never change at all. Acceptance
-- evidence may be written exactly once (from null) and never overwritten.
create or replace function public.schedules_guard_frozen_content()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  frozen_cols text[];
  col text;
  changed boolean;
begin
  frozen_cols := tg_argv;

  if new.arrangement_id <> old.arrangement_id or new.version_no <> old.version_no then
    raise exception '%: arrangement_id and version_no are immutable (id %)', tg_table_name, old.id
      using errcode = 'check_violation';
  end if;

  if old.status = 'superseded' and new.status <> 'superseded' then
    raise exception '%: a superseded schedule cannot be revived (id %)', tg_table_name, old.id
      using errcode = 'check_violation';
  end if;

  if old.status <> 'draft' then
    foreach col in array frozen_cols loop
      execute format('select ($1).%1$I is distinct from ($2).%1$I', col)
        into changed using new, old;
      if changed then
        raise exception
          '%: % is frozen once status is % (id %); create a new version',
          tg_table_name, col, old.status, old.id
          using errcode = 'check_violation';
      end if;
    end loop;
  end if;

  if old.accepted_at is not null and (
       new.accepted_at       is distinct from old.accepted_at
    or new.accepted_by_user  is distinct from old.accepted_by_user
    or new.accepted_by_name  is distinct from old.accepted_by_name
    or new.accepted_role     is distinct from old.accepted_role
    or new.acceptance_method is distinct from old.acceptance_method
    or new.document_hash     is distinct from old.document_hash
  ) then
    raise exception '%: acceptance evidence is append-only (id %)', tg_table_name, old.id
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- ============================================================================
-- service_schedules (§9 item 3, §8.3 step 2–3)
-- ============================================================================

create table if not exists public.service_schedules (
  id uuid primary key default gen_random_uuid(),
  arrangement_id uuid not null references public.service_arrangements(id) on delete restrict,
  version_no integer not null check (version_no > 0),

  -- Which draft catalogue item this was drafted from — evidence of origin
  -- only. The accepted terms are the columns and snapshot below, never a
  -- lookup into the catalogue (brief §9).
  package_code text not null,
  catalogue_ref text,
  inclusions jsonb not null default '[]'::jsonb,
  exclusions jsonb not null default '[]'::jsonb,
  usage_policy jsonb not null default '{}'::jsonb,

  -- Nullable while drafting; an issued schedule must state every one.
  amount_minor integer check (amount_minor is null or amount_minor >= 0),
  currency text not null default 'GBP' check (currency = upper(currency) and length(currency) = 3),
  tax_basis text not null default 'pending' check (
    tax_basis in ('pending', 'standard_vat', 'exempt', 'zero_rated')
  ),
  cadence text check (cadence is null or cadence in ('monthly', 'quarterly', 'annual')),
  start_date date,
  notice_days integer check (notice_days is null or notice_days >= 0),
  cancellation_terms_ref text,
  response_targets jsonb not null default '{}'::jsonb,

  status text not null default 'draft' check (
    status in ('draft', 'issued', 'accepted', 'superseded')
  ),

  -- Second-person review: the reviewer must differ from the issuer.
  created_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  issued_by uuid references auth.users(id) on delete set null,
  issued_at timestamptz,

  -- Acceptance evidence (§9). Personal data; retention is time-limited under
  -- the retention policy.
  accepted_at timestamptz,
  accepted_by_user uuid references auth.users(id) on delete set null,
  accepted_by_name text,
  accepted_role text,
  acceptance_method text check (
    acceptance_method is null or acceptance_method in ('esign', 'clickwrap', 'manual_upload')
  ),
  ip_address inet,
  user_agent text,

  -- Frozen at issue: canonical JSON of the commercial content and its sha256.
  document_snapshot jsonb,
  document_hash text,
  superseded_by uuid references public.service_schedules(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (arrangement_id, version_no),

  -- An issued schedule states exact amount, cadence, start, notice and an
  -- approved tax basis; "we'll confirm the price later" is a draft.
  constraint service_schedules_issued_is_exact check (
    status not in ('issued', 'accepted')
    or (
      amount_minor is not null
      and cadence is not null
      and start_date is not null
      and notice_days is not null
      and tax_basis <> 'pending'
      and document_snapshot is not null
      and document_hash is not null
      and issued_at is not null
      and issued_by is not null
      and reviewed_by is not null
      and reviewed_at is not null
    )
  ),
  constraint service_schedules_second_person check (
    status = 'draft' or reviewed_by is distinct from issued_by
  ),
  constraint service_schedules_accepted_has_evidence check (
    status <> 'accepted'
    or (
      accepted_at is not null
      and accepted_by_name is not null
      and acceptance_method is not null
      and (accepted_by_user is not null or acceptance_method = 'manual_upload')
    )
  ),
  constraint service_schedules_superseded_has_successor check (
    status <> 'superseded' or superseded_by is not null
  )
);

create index if not exists service_schedules_arrangement_idx
  on public.service_schedules (arrangement_id, version_no desc);
create index if not exists service_schedules_status_idx
  on public.service_schedules (status, updated_at desc);
-- At most one accepted schedule per arrangement at a time.
create unique index if not exists service_schedules_one_accepted
  on public.service_schedules (arrangement_id)
  where status = 'accepted';

drop trigger if exists trg_service_schedules_updated on public.service_schedules;
create trigger trg_service_schedules_updated
  before update on public.service_schedules
  for each row execute function public.set_updated_at();

drop trigger if exists trg_service_schedules_frozen on public.service_schedules;
create trigger trg_service_schedules_frozen
  before update on public.service_schedules
  for each row execute function public.schedules_guard_frozen_content(
    'package_code', 'catalogue_ref', 'inclusions', 'exclusions', 'usage_policy',
    'amount_minor', 'currency', 'tax_basis', 'cadence', 'start_date',
    'notice_days', 'cancellation_terms_ref', 'response_targets',
    'document_snapshot', 'document_hash', 'issued_by', 'issued_at',
    'reviewed_by', 'reviewed_at'
  );

-- ============================================================================
-- handover_schedules (§9 item 4, §8.5, decisions 18.3 / 18.4)
-- ============================================================================

create table if not exists public.handover_schedules (
  id uuid primary key default gen_random_uuid(),
  arrangement_id uuid not null references public.service_arrangements(id) on delete restrict,
  version_no integer not null default 1 check (version_no > 0),

  -- £600 is a confirmed commercial decision (brief §2.1); its tax basis is
  -- not (18.3). The default is the decision, the pending basis blocks issue.
  fee_minor integer not null default 60000 check (fee_minor >= 0),
  currency text not null default 'GBP' check (currency = upper(currency) and length(currency) = 3),
  tax_basis text not null default 'pending' check (
    tax_basis in ('pending', 'standard_vat', 'exempt', 'zero_rated')
  ),
  included_work jsonb not null default '[]'::jsonb,
  dependencies jsonb not null default '[]'::jsonb,
  -- Who pays for which third-party service after handover. Third-party
  -- services are not free (brief §2.1).
  cost_responsibility jsonb not null default '{}'::jsonb,
  -- Stripe Connect application fee after handover (decision 18.4).
  fee_disposition text not null default 'pending' check (
    fee_disposition in ('pending', 'continue', 'stop')
  ),

  status text not null default 'draft' check (
    status in ('draft', 'issued', 'accepted', 'superseded')
  ),

  created_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  issued_by uuid references auth.users(id) on delete set null,
  issued_at timestamptz,

  accepted_at timestamptz,
  accepted_by_user uuid references auth.users(id) on delete set null,
  accepted_by_name text,
  accepted_role text,
  acceptance_method text check (
    acceptance_method is null or acceptance_method in ('esign', 'clickwrap', 'manual_upload')
  ),
  ip_address inet,
  user_agent text,

  document_snapshot jsonb,
  document_hash text,
  superseded_by uuid references public.handover_schedules(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (arrangement_id, version_no),

  -- Block real issuance until tax basis and fee disposition are decided
  -- (brief §6.5, §8.1 "resolve whether any Transact agreement continues").
  constraint handover_schedules_issued_is_decided check (
    status not in ('issued', 'accepted')
    or (
      tax_basis <> 'pending'
      and fee_disposition <> 'pending'
      and document_snapshot is not null
      and document_hash is not null
      and issued_at is not null
      and issued_by is not null
      and reviewed_by is not null
      and reviewed_at is not null
    )
  ),
  constraint handover_schedules_second_person check (
    status = 'draft' or reviewed_by is distinct from issued_by
  ),
  constraint handover_schedules_accepted_has_evidence check (
    status <> 'accepted'
    or (
      accepted_at is not null
      and accepted_by_name is not null
      and acceptance_method is not null
      and (accepted_by_user is not null or acceptance_method = 'manual_upload')
    )
  ),
  constraint handover_schedules_superseded_has_successor check (
    status <> 'superseded' or superseded_by is not null
  )
);

create index if not exists handover_schedules_arrangement_idx
  on public.handover_schedules (arrangement_id, version_no desc);
create unique index if not exists handover_schedules_one_accepted
  on public.handover_schedules (arrangement_id)
  where status = 'accepted';

drop trigger if exists trg_handover_schedules_updated on public.handover_schedules;
create trigger trg_handover_schedules_updated
  before update on public.handover_schedules
  for each row execute function public.set_updated_at();

drop trigger if exists trg_handover_schedules_frozen on public.handover_schedules;
create trigger trg_handover_schedules_frozen
  before update on public.handover_schedules
  for each row execute function public.schedules_guard_frozen_content(
    'fee_minor', 'currency', 'tax_basis', 'included_work', 'dependencies',
    'cost_responsibility', 'fee_disposition', 'document_snapshot',
    'document_hash', 'issued_by', 'issued_at', 'reviewed_by', 'reviewed_at'
  );

-- ============================================================================
-- Row Level Security — staff read/write; clients via column-safe views
-- ============================================================================

alter table public.service_arrangements enable row level security;
alter table public.service_schedules enable row level security;
alter table public.handover_schedules enable row level security;

drop policy if exists service_arrangements_staff_all on public.service_arrangements;
create policy service_arrangements_staff_all on public.service_arrangements
  for all to authenticated
  using (is_internal_staff()) with check (is_internal_staff());

drop policy if exists service_schedules_staff_all on public.service_schedules;
create policy service_schedules_staff_all on public.service_schedules
  for all to authenticated
  using (is_internal_staff()) with check (is_internal_staff());

drop policy if exists handover_schedules_staff_all on public.handover_schedules;
create policy handover_schedules_staff_all on public.handover_schedules
  for all to authenticated
  using (is_internal_staff()) with check (is_internal_staff());

-- Tenant members may SELECT their own issued/accepted schedules only, and
-- only the client-safe columns. The views run as their owner (no
-- security_invoker), so the base tables need no member policy; the WHERE
-- clause is the tenant filter and security_barrier stops leaky predicates.
-- Reviewer ids, IP/UA, catalogue refs and internal audit columns are not
-- projected.
create or replace view public.service_schedules_client
  with (security_barrier = true)
as
  select
    s.id,
    a.tenant_id,
    a.project_id,
    s.arrangement_id,
    s.version_no,
    s.package_code,
    s.inclusions,
    s.exclusions,
    s.usage_policy,
    s.amount_minor,
    s.currency,
    s.tax_basis,
    s.cadence,
    s.start_date,
    s.notice_days,
    s.cancellation_terms_ref,
    s.response_targets,
    s.status,
    s.issued_at,
    s.accepted_at,
    s.accepted_by_name,
    s.accepted_role,
    s.document_snapshot,
    s.document_hash
  from public.service_schedules s
  join public.service_arrangements a on a.id = s.arrangement_id
  where s.status in ('issued', 'accepted')
    and is_member_of(a.tenant_id);

create or replace view public.handover_schedules_client
  with (security_barrier = true)
as
  select
    h.id,
    a.tenant_id,
    a.project_id,
    h.arrangement_id,
    h.version_no,
    h.fee_minor,
    h.currency,
    h.tax_basis,
    h.included_work,
    h.dependencies,
    h.cost_responsibility,
    h.fee_disposition,
    h.status,
    h.issued_at,
    h.accepted_at,
    h.accepted_by_name,
    h.accepted_role,
    h.document_snapshot,
    h.document_hash
  from public.handover_schedules h
  join public.service_arrangements a on a.id = h.arrangement_id
  where h.status in ('issued', 'accepted')
    and is_member_of(a.tenant_id);

revoke all on public.service_schedules_client from public, anon;
revoke all on public.handover_schedules_client from public, anon;
grant select on public.service_schedules_client to authenticated;
grant select on public.handover_schedules_client to authenticated;

comment on view public.service_schedules_client is
  'Client-safe projection of service_schedules (issued/accepted, own tenant only). Tenant members read here, never the base table.';
comment on view public.handover_schedules_client is
  'Client-safe projection of handover_schedules (issued/accepted, own tenant only). Tenant members read here, never the base table.';
