-- 0060: explicit build acceptance, checklist tasks and handover tasks
-- Admin redesign Phase 3, task p3-acceptance (brief §5.5 acceptance, §5.10
-- later checklist, §8.2, §8.5–8.6, §3.3 #3, §17.1 rows 2, 3, 5, 11, 12).
--
-- STATUS: APPLIED to Nullshift Ops (cweftpoaojwzllzficgt) on 2026-09-20 (0057 on 2026-09-17). Written additively against the live
-- schema as read in docs/ADMIN-REDESIGN-PHASE0-2026-09-17.md §11. Number the
-- ledger entry against `schema_migrations`, not this directory, before
-- applying (Phase 0 decision N-h), and apply only with OPS_V2_FLAGS still
-- excluding `acceptanceGate`: nothing reads or writes these tables until that
-- flag is switched on deliberately.
--
-- PURPOSE
--   1. `build_acceptances` — the explicit acceptance record the plan gate,
--      Managed start and independent handover read instead of the stage label
--      (Phase 0 §8 #3: "do not confuse stage labels with evidence"). One row per
--      acceptance event: who accepted (a client signatory through the portal,
--      or staff recording an acceptance given by email/meeting/document, with a
--      reason), against which scope version, with evidence per deliverable
--      (criteria, evidence, client comment), outstanding defects, and the
--      partial / disputed markers the brief wants handled explicitly (§5.5).
--      A partial unique index allows ONE non-disputed, non-partial acceptance
--      per (project, scope version); partial and disputed rows are history and
--      may repeat. Acceptance never selects a Run package, never marks an
--      invoice paid and never records a signature: none of those columns exist
--      here, on purpose.
--   2. `checklist_tasks` — the §8.6 task record (requirement source, owner,
--      due date, state, evidence, completion time, waiver with reason and
--      approver) for the §5.10 initial and later client journeys. The existing
--      `checklists.items` jsonb (0040) is untouched; this is the owned,
--      stateful replacement, keyed (project, journey, key) so a checklist can
--      be re-published without duplicating tasks.
--   3. `handover_tasks` — the §8.5 independent-handover transfer checklist per
--      service arrangement, keyed (arrangement, key).
--
--   A waiver is a state with a reason and an approver. It is not completion
--   evidence: `completed_at` stays null on a waived task, and nothing here can
--   mark a payment or a signature.
--
-- DEPENDENCIES
--   0001 (tenants, projects, memberships, is_internal_staff(), is_member_of(),
--   is_tenant_admin(), set_updated_at()), auth.users.
--   `arrangement_id` is a plain uuid with NO foreign key: the service
--   arrangement table belongs to a sibling redesign migration that may not be
--   applied yet. Add the FK in a later migration once both are in the ledger.
--
-- ACCESS
--   RLS enabled on all three tables.
--   Staff: full access (is_internal_staff()).
--   Tenant members: SELECT their own tenant's rows. A tenant admin (the closest
--   thing to a signatory today — Phase 0 §3 notes only client_admin is ever
--   minted) may INSERT a build acceptance for their own tenant, as themselves,
--   through the portal. Clients never UPDATE or DELETE any row directly: the
--   only client write to a task is through portal_update_checklist_task() /
--   portal_update_handover_task(), SECURITY DEFINER functions that check
--   membership, accept only client-owned tasks, allow only state and evidence
--   to change, and refuse `waived`, `not_applicable`, `blocked` and
--   `awaiting_client` (those are Nullshift decisions).
--
-- NO BACKFILL. No existing row is mutated. Nothing references the three legacy
-- clients; `projects.stage`, `checklists`, `tenants.care_plan_choice` and
-- `subscriptions` are left exactly as they are.
--
-- ROLLBACK (manual, in this order; loses only data written under the flag)
--   drop function if exists public.portal_update_handover_task(uuid, text, jsonb);
--   drop function if exists public.portal_update_checklist_task(uuid, text, jsonb);
--   drop table if exists public.handover_tasks;
--   drop table if exists public.checklist_tasks;
--   drop table if exists public.build_acceptances;

-- ============================================================================
-- Build acceptances (§5.5, §8.2)
-- ============================================================================

create table if not exists public.build_acceptances (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  -- The governing scope version the acceptance is against, e.g.
  -- 'order_form:OF-2026-0004' or 'proposal:<project uuid>:v1'. Text, so a
  -- later document model can point here without a schema change.
  scope_version_ref text not null,

  -- Who accepted. `accepted_by_user` is null when staff record an acceptance
  -- given outside the portal (email, meeting, signed document).
  accepted_by_user uuid references auth.users (id) on delete set null,
  accepted_by_name text not null,
  accepted_role text not null check (accepted_role in ('client_signatory', 'staff')),
  method text not null check (
    method in ('portal', 'staff_recorded', 'email', 'meeting', 'document')
  ),
  accepted_at timestamptz not null default now(),

  -- Per deliverable: [{ deliverable, criteria, met, evidence, client_comment }]
  evidence jsonb not null default '[]'::jsonb,
  partial boolean not null default false,
  disputed boolean not null default false,
  -- [{ ref, summary, owner }] — defects the client accepts the build WITH.
  defects_outstanding jsonb not null default '[]'::jsonb,
  notes text,

  -- The staff member who recorded it (null for a portal acceptance).
  recorded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- A staff-recorded acceptance must say why it was recorded on the client's
  -- behalf and what the evidence is (Phase 0 §7 "staff-recorded with reason").
  constraint build_acceptances_staff_reason check (
    accepted_role <> 'staff' or (notes is not null and length(btrim(notes)) > 0)
  ),
  -- A portal acceptance is always bound to the signed-in user.
  constraint build_acceptances_portal_has_user check (
    method <> 'portal' or accepted_by_user is not null
  ),
  -- Accepting WITH exceptions means listing them: a partial acceptance must
  -- carry at least one outstanding defect or an unmet deliverable.
  -- (No subquery: CHECK constraints cannot contain one, so containment is used.)
  constraint build_acceptances_partial_lists_exceptions check (
    not partial
    or jsonb_array_length(defects_outstanding) > 0
    or evidence @> '[{"met": false}]'::jsonb
  )
);

comment on table public.build_acceptances is
  'Explicit build acceptance evidence (brief §5.5, §8.2). Never selects a package, marks payment or records a signature.';

-- One clean acceptance per (project, scope version). Partial and disputed rows
-- are history and may repeat; the next clean acceptance supersedes them by
-- existing, never by editing them.
create unique index if not exists build_acceptances_one_clean_per_scope
  on public.build_acceptances (project_id, scope_version_ref)
  where not disputed and not partial;

create index if not exists build_acceptances_tenant_idx
  on public.build_acceptances (tenant_id, accepted_at desc);
create index if not exists build_acceptances_project_idx
  on public.build_acceptances (project_id, accepted_at desc);

drop trigger if exists trg_build_acceptances_updated on public.build_acceptances;
create trigger trg_build_acceptances_updated
  before update on public.build_acceptances
  for each row execute function public.set_updated_at();

-- ============================================================================
-- Checklist tasks (§5.10 initial / later journeys, §8.6 task record)
-- ============================================================================

create table if not exists public.checklist_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  -- Service arrangement (sibling migration); no FK yet, see header.
  arrangement_id uuid,
  journey text not null check (journey in ('initial', 'later')),
  key text not null,
  label text not null,
  -- Why the item is required — always shown to the client (§5.10).
  why text,
  owner_kind text not null check (owner_kind in ('nullshift', 'client')),
  state text not null default 'not_started' check (
    state in (
      'not_started', 'in_progress', 'awaiting_client', 'blocked',
      'complete', 'not_applicable', 'waived'
    )
  ),
  waived_by uuid references auth.users (id) on delete set null,
  waiver_reason text,
  waiver_approver uuid references auth.users (id) on delete set null,
  -- [{ kind, ref, note, at, by }] — what shows the task was done.
  evidence jsonb not null default '[]'::jsonb,
  due_at timestamptz,
  requirement_source text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint checklist_tasks_has_parent check (
    project_id is not null or arrangement_id is not null
  ),
  -- A waiver needs a reason and an approver; a waiver is never completion.
  constraint checklist_tasks_waiver_evidence check (
    state <> 'waived'
    or (waiver_reason is not null and length(btrim(waiver_reason)) > 0
        and waiver_approver is not null)
  ),
  constraint checklist_tasks_waiver_not_completion check (
    state <> 'waived' or completed_at is null
  ),
  constraint checklist_tasks_complete_has_time check (
    state <> 'complete' or completed_at is not null
  )
);

comment on table public.checklist_tasks is
  'Owned, stateful checklist tasks per client journey (brief §5.10, §8.6). Waived is not complete.';

create unique index if not exists checklist_tasks_project_journey_key
  on public.checklist_tasks (project_id, journey, key)
  where project_id is not null;
create unique index if not exists checklist_tasks_arrangement_journey_key
  on public.checklist_tasks (arrangement_id, journey, key)
  where project_id is null and arrangement_id is not null;
create index if not exists checklist_tasks_tenant_idx
  on public.checklist_tasks (tenant_id, journey, created_at);

drop trigger if exists trg_checklist_tasks_updated on public.checklist_tasks;
create trigger trg_checklist_tasks_updated
  before update on public.checklist_tasks
  for each row execute function public.set_updated_at();

-- ============================================================================
-- Handover tasks (§8.5)
-- ============================================================================

create table if not exists public.handover_tasks (
  id uuid primary key default gen_random_uuid(),
  -- tenant_id is required for RLS even though the brief lists the row by
  -- arrangement only; it is copied from the arrangement at creation.
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  arrangement_id uuid not null,
  key text not null,
  label text not null,
  why text,
  owner_kind text not null check (owner_kind in ('nullshift', 'client')),
  state text not null default 'not_started' check (
    state in (
      'not_started', 'in_progress', 'awaiting_client', 'blocked',
      'complete', 'not_applicable', 'waived'
    )
  ),
  waived_by uuid references auth.users (id) on delete set null,
  waiver_reason text,
  waiver_approver uuid references auth.users (id) on delete set null,
  evidence jsonb not null default '[]'::jsonb,
  due_at timestamptz,
  requirement_source text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint handover_tasks_waiver_evidence check (
    state <> 'waived'
    or (waiver_reason is not null and length(btrim(waiver_reason)) > 0
        and waiver_approver is not null)
  ),
  constraint handover_tasks_waiver_not_completion check (
    state <> 'waived' or completed_at is null
  ),
  constraint handover_tasks_complete_has_time check (
    state <> 'complete' or completed_at is not null
  ),
  unique (arrangement_id, key)
);

comment on table public.handover_tasks is
  'Independent handover transfer checklist per service arrangement (brief §8.5). No subscription is created by any row here.';

create index if not exists handover_tasks_tenant_idx
  on public.handover_tasks (tenant_id, created_at);

drop trigger if exists trg_handover_tasks_updated on public.handover_tasks;
create trigger trg_handover_tasks_updated
  before update on public.handover_tasks
  for each row execute function public.set_updated_at();

-- ============================================================================
-- Row level security
-- ============================================================================

alter table public.build_acceptances enable row level security;
alter table public.checklist_tasks enable row level security;
alter table public.handover_tasks enable row level security;

-- Staff: everything (0030 / 0053 pattern).
drop policy if exists build_acceptances_staff_all on public.build_acceptances;
create policy build_acceptances_staff_all on public.build_acceptances
  for all to authenticated
  using (public.is_internal_staff()) with check (public.is_internal_staff());

drop policy if exists checklist_tasks_staff_all on public.checklist_tasks;
create policy checklist_tasks_staff_all on public.checklist_tasks
  for all to authenticated
  using (public.is_internal_staff()) with check (public.is_internal_staff());

drop policy if exists handover_tasks_staff_all on public.handover_tasks;
create policy handover_tasks_staff_all on public.handover_tasks
  for all to authenticated
  using (public.is_internal_staff()) with check (public.is_internal_staff());

-- Tenant members read their own rows.
drop policy if exists build_acceptances_member_select on public.build_acceptances;
create policy build_acceptances_member_select on public.build_acceptances
  for select to authenticated
  using (public.is_member_of(tenant_id));

drop policy if exists checklist_tasks_member_select on public.checklist_tasks;
create policy checklist_tasks_member_select on public.checklist_tasks
  for select to authenticated
  using (public.is_member_of(tenant_id));

drop policy if exists handover_tasks_member_select on public.handover_tasks;
create policy handover_tasks_member_select on public.handover_tasks
  for select to authenticated
  using (public.is_member_of(tenant_id));

-- A tenant admin accepts the build for their own tenant, as themselves, via
-- the portal, against a project that belongs to that tenant. Nothing else:
-- no update, no delete, no staff-style recording.
drop policy if exists build_acceptances_client_insert on public.build_acceptances;
create policy build_acceptances_client_insert on public.build_acceptances
  for insert to authenticated
  with check (
    public.is_tenant_admin(tenant_id)
    and accepted_by_user = auth.uid()
    and accepted_role = 'client_signatory'
    and method = 'portal'
    and recorded_by is null
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.tenant_id = build_acceptances.tenant_id
    )
  );

-- ============================================================================
-- Client task updates: state and evidence only, on client-owned tasks, never
-- a waiver. SECURITY DEFINER so the client needs no UPDATE policy at all.
-- ============================================================================

create or replace function public.portal_update_checklist_task(
  task_id uuid,
  new_state text,
  new_evidence jsonb default null
)
returns public.checklist_tasks
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  t public.checklist_tasks;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if new_state not in ('not_started', 'in_progress', 'complete') then
    -- waived, not_applicable, blocked and awaiting_client are Nullshift
    -- decisions; a client can never waive their own task.
    raise exception 'state % is not available to the client', new_state
      using errcode = '42501';
  end if;

  select * into t from public.checklist_tasks where id = task_id for update;
  if not found then
    raise exception 'task not found' using errcode = 'P0002';
  end if;
  if not public.is_member_of(t.tenant_id) then
    raise exception 'not a member of this tenant' using errcode = '42501';
  end if;
  if t.owner_kind <> 'client' then
    raise exception 'task is owned by Nullshift' using errcode = '42501';
  end if;
  if t.state in ('waived', 'not_applicable', 'blocked') then
    raise exception 'task is % and cannot be changed by the client', t.state
      using errcode = '42501';
  end if;
  if new_state = 'complete'
     and (new_evidence is null or jsonb_typeof(new_evidence) <> 'array'
          or jsonb_array_length(new_evidence) = 0)
     and jsonb_array_length(t.evidence) = 0 then
    raise exception 'completing a task needs evidence' using errcode = '22023';
  end if;

  update public.checklist_tasks
     set state = new_state,
         evidence = case
           when new_evidence is null or jsonb_typeof(new_evidence) <> 'array' then evidence
           else evidence || new_evidence
         end,
         completed_at = case when new_state = 'complete' then coalesce(completed_at, now()) else null end
   where id = task_id
   returning * into t;
  return t;
end;
$$;

revoke all on function public.portal_update_checklist_task(uuid, text, jsonb) from public;
revoke all on function public.portal_update_checklist_task(uuid, text, jsonb) from anon;
grant execute on function public.portal_update_checklist_task(uuid, text, jsonb) to authenticated;

create or replace function public.portal_update_handover_task(
  task_id uuid,
  new_state text,
  new_evidence jsonb default null
)
returns public.handover_tasks
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  t public.handover_tasks;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if new_state not in ('not_started', 'in_progress', 'complete') then
    raise exception 'state % is not available to the client', new_state
      using errcode = '42501';
  end if;

  select * into t from public.handover_tasks where id = task_id for update;
  if not found then
    raise exception 'task not found' using errcode = 'P0002';
  end if;
  if not public.is_member_of(t.tenant_id) then
    raise exception 'not a member of this tenant' using errcode = '42501';
  end if;
  if t.owner_kind <> 'client' then
    raise exception 'task is owned by Nullshift' using errcode = '42501';
  end if;
  if t.state in ('waived', 'not_applicable', 'blocked') then
    raise exception 'task is % and cannot be changed by the client', t.state
      using errcode = '42501';
  end if;
  if new_state = 'complete'
     and (new_evidence is null or jsonb_typeof(new_evidence) <> 'array'
          or jsonb_array_length(new_evidence) = 0)
     and jsonb_array_length(t.evidence) = 0 then
    raise exception 'completing a task needs evidence' using errcode = '22023';
  end if;

  update public.handover_tasks
     set state = new_state,
         evidence = case
           when new_evidence is null or jsonb_typeof(new_evidence) <> 'array' then evidence
           else evidence || new_evidence
         end,
         completed_at = case when new_state = 'complete' then coalesce(completed_at, now()) else null end
   where id = task_id
   returning * into t;
  return t;
end;
$$;

revoke all on function public.portal_update_handover_task(uuid, text, jsonb) from public;
revoke all on function public.portal_update_handover_task(uuid, text, jsonb) from anon;
grant execute on function public.portal_update_handover_task(uuid, text, jsonb) to authenticated;
