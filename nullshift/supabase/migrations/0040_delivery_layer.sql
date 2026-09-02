-- 0040 (was 0028 on the local ops branch): the delivery layer the audit found missing (Phase 3) — the entities a
-- new employee needs to understand a project without a verbal briefing:
-- milestones (dates clients can see), a risk register (internal), a decision
-- log with rationale/approver (internal), and generic checklists that turn
-- the playbook templates in code into per-project working lists. Plus the
-- issue-bank gaps: an owner, and kinds for decision/feedback/risk/general.

-- ── Milestones — target dates with owners; the portal's "key dates" ─────────
create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null,
  target_date date,
  owner text,
  acceptance_criteria text,
  health text not null default 'on_track'
    check (health in ('on_track', 'watch', 'at_risk', 'done')),
  billing_note text,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists milestones_project_idx on public.milestones (project_id);
alter table public.milestones enable row level security;
create policy milestones_staff_all on public.milestones
  for all to authenticated
  using (public.is_internal_staff()) with check (public.is_internal_staff());
-- Clients see their milestones (key dates on the portal project page).
create policy milestones_member_select on public.milestones
  for select to authenticated
  using (public.is_member_of(tenant_id));
create trigger trg_milestones_updated
  before update on public.milestones
  for each row execute function public.set_updated_at();

-- ── Risk register — internal only (the brief: never exposed to clients) ─────
create table if not exists public.risks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null,
  impact text,
  owner text,
  mitigation text,
  review_date date,
  status text not null default 'open'
    check (status in ('open', 'mitigated', 'closed')),
  resolution text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists risks_project_idx on public.risks (project_id);
alter table public.risks enable row level security;
create policy risks_staff_all on public.risks
  for all to authenticated
  using (public.is_internal_staff()) with check (public.is_internal_staff());
create trigger trg_risks_updated
  before update on public.risks
  for each row execute function public.set_updated_at();

-- ── Decision log — what was decided, why, by whom, at what cost. Internal.
--    (Client-facing choice cards remain project_updates type='decision'.) ────
create table if not exists public.decisions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  decision text not null,
  rationale text,
  approver text,
  source text,
  impact text,
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists decisions_project_idx on public.decisions (project_id);
alter table public.decisions enable row level security;
create policy decisions_staff_all on public.decisions
  for all to authenticated
  using (public.is_internal_staff()) with check (public.is_internal_staff());

-- ── Checklists — playbook instances. Templates live in code (lib/playbooks);
--    a row is one project's working copy. Items are [{name, done}] toggled BY
--    NAME (the env_checklist index-toggle hazard, not repeated). ─────────────
create table if not exists public.checklists (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  kind text not null,
  title text not null,
  items jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, kind)
);
alter table public.checklists enable row level security;
create policy checklists_staff_all on public.checklists
  for all to authenticated
  using (public.is_internal_staff()) with check (public.is_internal_staff());
-- Clients may read their onboarding checklist ("what we need from you").
create policy checklists_member_select on public.checklists
  for select to authenticated
  using (public.is_member_of(tenant_id) and kind = 'onboarding');
create trigger trg_checklists_updated
  before update on public.checklists
  for each row execute function public.set_updated_at();

-- ── Issue bank: an owner, and the missing capture kinds ─────────────────────
alter table public.issues add column if not exists assignee text;
alter type public.issue_kind add value if not exists 'decision';
alter type public.issue_kind add value if not exists 'feedback';
alter type public.issue_kind add value if not exists 'risk';
alter type public.issue_kind add value if not exists 'general';

-- ── Handover: client preferences live on the system passport ────────────────
alter table public.system_profiles
  add column if not exists client_preferences text;
