-- 0058: client next actions and §7 work class on issues
-- Admin redesign Phase 2, task p2-intake (brief §5.4 owners/next actions, §7,
-- §11 "Request submitted", §17.1 rows 9–11).
--
-- STATUS: NOT APPLIED to any database. Written additively against the live
-- schema as read in docs/ADMIN-REDESIGN-PHASE0-2026-09-17.md §11. Apply only
-- after ledger reconciliation (Phase 0 decision N-h) and with OPS_V2_FLAGS
-- still excluding `workIntake`, so nothing reads or writes the new columns
-- until the flag is switched on deliberately.
--
-- PURPOSE
--   1. `client_next_actions` — the persisted, owned next action per client that
--      the §5.4 next-action strip reads. Today `projects.next_action` is free
--      text on the newest project (0022); this table is client-level, has an
--      owner, a due date and a state, and keeps history: a replaced action is
--      marked `superseded`, never overwritten. A partial unique index enforces
--      at most one `open` row per tenant, so "set next action" can never
--      duplicate.
--   2. Four additive columns on `issues` for the §7 work class and coverage
--      decision, alongside (not replacing) the existing `billing` (0014) and
--      `classification` (0030) columns. Nothing here changes the 0030
--      `trg_issues_change_order_gate` trigger or any existing row. Legacy
--      tickets keep working unchanged: every new column is nullable and unread
--      unless `workIntake` is on.
--
-- DEPENDENCIES
--   0001 (tenants, projects, set_updated_at(), is_internal_staff()),
--   0014 (issues), 0030 (issues.classification et al. — left untouched).
--
-- NO BACKFILL. No existing row is mutated. The brief does not describe a
-- backfill for these columns and the vocabulary decision (Phase 0 N-b) is open.
--
-- ROLLBACK (manual, in this order; loses only data written under the flag)
--   drop table if exists public.client_next_actions;
--   alter table public.issues
--     drop column if exists split_from_issue_id,
--     drop column if exists coverage_evidence,
--     drop column if exists coverage_decision,
--     drop column if exists work_class;
--   drop type if exists public.coverage_decision;
--   drop type if exists public.work_class;

-- ============================================================================
-- Enums (§7 table, snake_case; the UI shows the brief's labels)
-- ============================================================================

do $$
begin
  create type public.work_class as enum (
    'defect',
    'support',
    'maintenance',
    'change_feature',
    'content_training',
    'data_integration_expansion',
    'transaction'
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.coverage_decision as enum (
    'included_managed',   -- "Included — Managed Platform"
    'included_warranty',  -- "Included — build warranty"
    'chargeable_grow',    -- "Chargeable Grow request — quote required."
    'needs_review'        -- "Coverage needs review"
  );
exception
  when duplicate_object then null;
end
$$;

-- ============================================================================
-- Client next actions (§5.4)
-- ============================================================================

create table if not exists public.client_next_actions (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  project_id         uuid references public.projects(id) on delete set null,
  -- The action itself, e.g. "Chase signed DPA before build start".
  text               text not null check (length(btrim(text)) > 0),
  -- Display owner as entered (brief keeps free-text owners for now) plus the
  -- optional staff user it resolves to.
  owner              text not null check (length(btrim(owner)) > 0),
  owner_user         uuid references auth.users(id) on delete set null,
  due_at             date,
  state              text not null default 'open'
                     check (state in ('open', 'done', 'superseded')),
  -- Where the action came from: 'manual', 'automation:<id>', 'fixture', ...
  source             text not null default 'manual',
  created_by         uuid references auth.users(id) on delete set null,
  completed_at       timestamptz,
  -- Lineage when a newer action replaced this one (set after the replacement
  -- row exists, so the partial unique index below is never violated).
  superseded_by_id   uuid references public.client_next_actions(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.client_next_actions is
  'Brief §5.4: one open, owned next action per client with history. Replaced actions are superseded, never edited. Read only when OPS_V2_FLAGS includes workIntake.';
comment on column public.client_next_actions.source is
  'Origin of the action: manual, fixture, or automation:<workflow id> (brief §11).';

-- At most one open next action per client. "Set next action" supersedes the
-- open row before inserting; a second concurrent writer gets a unique
-- violation instead of a duplicate.
create unique index if not exists client_next_actions_one_open_per_tenant
  on public.client_next_actions (tenant_id)
  where state = 'open';

create index if not exists client_next_actions_tenant_idx
  on public.client_next_actions (tenant_id, created_at desc);

create index if not exists client_next_actions_project_idx
  on public.client_next_actions (project_id)
  where project_id is not null;

drop trigger if exists trg_client_next_actions_updated on public.client_next_actions;
create trigger trg_client_next_actions_updated
  before update on public.client_next_actions
  for each row execute function public.set_updated_at();

alter table public.client_next_actions enable row level security;

-- Staff-only. Clients never see internal next actions; the service role
-- bypasses RLS for the audit/service paths as elsewhere.
drop policy if exists client_next_actions_staff_all on public.client_next_actions;
create policy client_next_actions_staff_all on public.client_next_actions
  for all to authenticated
  using (public.is_internal_staff()) with check (public.is_internal_staff());

-- ============================================================================
-- §7 work class and coverage on issues (additive; 0030 columns untouched)
-- ============================================================================

alter table public.issues
  add column if not exists work_class public.work_class,
  add column if not exists coverage_decision public.coverage_decision,
  -- Evidence the coverage decision rests on: reproduction, agreed behaviour,
  -- affected version, governing agreement reference, entitlement snapshot.
  add column if not exists coverage_evidence jsonb,
  -- For a mixed request split into linked items (§7): the parent request.
  add column if not exists split_from_issue_id uuid
    references public.issues(id) on delete set null;

create index if not exists issues_split_from_idx
  on public.issues (split_from_issue_id)
  where split_from_issue_id is not null;

comment on column public.issues.work_class is
  'Brief §7 class. Classification does not itself create an entitlement; coverage is a separate decision.';
comment on column public.issues.coverage_decision is
  'Brief §7 coverage: included_managed | included_warranty | chargeable_grow | needs_review. Independent of `billing` (0014) and `classification` (0030), which are left unchanged.';
comment on column public.issues.coverage_evidence is
  'jsonb evidence behind coverage_decision: reproduction, agreed behaviour, affected version, governing agreement, entitlement snapshot, reasons.';
comment on column public.issues.split_from_issue_id is
  'Parent request when this issue is one part of a mixed request split into linked items (brief §7).';
