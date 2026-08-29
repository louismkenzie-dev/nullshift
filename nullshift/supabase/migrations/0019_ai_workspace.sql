-- ============================================================
--  0019 — AI Workspace, Phase 1: visibility, hierarchy, records
--  Agents are software agents (never legal "employees"): each has a
--  runtime, an accountable human owner, a manager agent, a lifecycle
--  and a maximum autonomous risk tier. Additive only; the existing
--  agent_runs table (consultation cost log) is EXTENDED, not replaced.
--  Idempotent — safe to re-run.
-- ============================================================

-- ── Departments ──
create table if not exists public.agent_departments (
  id         uuid primary key default gen_random_uuid(),
  key        text not null unique,
  name       text not null,
  mission    text,
  sort       int not null default 100,
  created_at timestamptz not null default now()
);

-- ── Agents ──
create table if not exists public.agents (
  id               uuid primary key default gen_random_uuid(),
  key              text not null unique,          -- stable slug, e.g. 'consultation'
  name             text not null,
  role_title       text not null,                 -- plain-English job, e.g. 'Client consultation'
  purpose          text not null,
  department_id    uuid references public.agent_departments(id),
  manager_agent_id uuid references public.agents(id),
  owner_email      text,                          -- accountable human (transitional, ADMIN_EMAILS era)
  runtime          text not null default 'none'
    check (runtime in ('internal_call','managed_agents','github_action','routine','none')),
  lifecycle        text not null default 'draft'
    check (lifecycle in ('draft','under_review','test','active','paused','needs_attention','archived')),
  max_risk_tier    int not null default 0 check (max_risk_tier between 0 and 4),
  may_delegate     boolean not null default false,
  capabilities     jsonb not null default '[]',   -- ["classify issues", ...]
  tool_grants      jsonb not null default '[]',   -- ["web_search", "supabase:issues:read", ...]
  data_scopes      jsonb not null default '[]',   -- ["leads", "issues", ...]
  human_gates      jsonb not null default '[]',   -- ["every client message", ...]
  current_version  int not null default 1,
  last_activity_at timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists agents_department_idx on public.agents (department_id);
create index if not exists agents_manager_idx on public.agents (manager_agent_id);
create index if not exists agents_lifecycle_idx on public.agents (lifecycle);

-- ── Versioned configuration history ──
create table if not exists public.agent_versions (
  id           uuid primary key default gen_random_uuid(),
  agent_id     uuid not null references public.agents(id) on delete cascade,
  version      int not null,
  instructions text,
  snapshot     jsonb not null default '{}',       -- full config at this version
  reason       text,
  author_email text,
  created_at   timestamptz not null default now(),
  unique (agent_id, version)
);

-- ── Tasks delegated to agents (records first; execution wiring = Phase 4) ──
create table if not exists public.agent_tasks (
  id              uuid primary key default gen_random_uuid(),
  agent_id        uuid references public.agents(id),
  parent_task_id  uuid references public.agent_tasks(id),
  tenant_id       uuid references public.tenants(id),
  project_id      uuid references public.projects(id),
  objective       text not null,
  detail          text,
  status          text not null default 'proposed'
    check (status in ('proposed','queued','planning','awaiting_start_approval','running',
                      'waiting_info','waiting_approval','waiting_external','blocked',
                      'quality_review','complete','failed','cancelled')),
  priority        text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  risk_tier       int not null default 0 check (risk_tier between 0 and 4),
  execution_mode  text not null default 'draft_only'
    check (execution_mode in ('draft_only','approve_before_action','approved_low_risk')),
  source          text not null default 'manual'
    check (source in ('manual','routine','event','delegated','system')),
  requested_by    text,                            -- human email (or agent key when delegated)
  deadline        timestamptz,
  budget_usd      numeric(10,2),
  result_summary  text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists agent_tasks_agent_idx on public.agent_tasks (agent_id, status);
create index if not exists agent_tasks_status_idx on public.agent_tasks (status);
create index if not exists agent_tasks_parent_idx on public.agent_tasks (parent_task_id);

-- ── Append-only activity ledger (normalised, provider-agnostic) ──
create table if not exists public.agent_events (
  id         uuid primary key default gen_random_uuid(),
  agent_id   uuid references public.agents(id),
  task_id    uuid references public.agent_tasks(id),
  run_id     uuid references public.agent_runs(id),
  type       text not null,                        -- 'lifecycle.changed' | 'task.created' | 'run.completed' | ...
  summary    text not null,                        -- plain-English, safe for the feed
  detail     jsonb not null default '{}',
  actor      text,                                 -- human email or agent key
  created_at timestamptz not null default now()
);
create index if not exists agent_events_agent_idx on public.agent_events (agent_id, created_at desc);
create index if not exists agent_events_created_idx on public.agent_events (created_at desc);

-- ── Link the existing runs table into the workspace model ──
alter table public.agent_runs add column if not exists agent_id uuid references public.agents(id);
alter table public.agent_runs add column if not exists task_id uuid references public.agent_tasks(id);
create index if not exists agent_runs_agent_id_idx on public.agent_runs (agent_id, created_at desc);

-- ── RLS: staff read everything; staff write config/tasks; runtime writes via service role ──
alter table public.agent_departments enable row level security;
alter table public.agents            enable row level security;
alter table public.agent_versions    enable row level security;
alter table public.agent_tasks       enable row level security;
alter table public.agent_events      enable row level security;

drop policy if exists "agent_departments_staff" on public.agent_departments;
create policy "agent_departments_staff" on public.agent_departments
  for all using (is_internal_staff()) with check (is_internal_staff());

drop policy if exists "agents_staff" on public.agents;
create policy "agents_staff" on public.agents
  for all using (is_internal_staff()) with check (is_internal_staff());

drop policy if exists "agent_versions_staff" on public.agent_versions;
create policy "agent_versions_staff" on public.agent_versions
  for all using (is_internal_staff()) with check (is_internal_staff());

drop policy if exists "agent_tasks_staff" on public.agent_tasks;
create policy "agent_tasks_staff" on public.agent_tasks
  for all using (is_internal_staff()) with check (is_internal_staff());

-- Ledger: staff may read + append; never update/delete (append-only).
drop policy if exists "agent_events_staff_read" on public.agent_events;
create policy "agent_events_staff_read" on public.agent_events
  for select using (is_internal_staff());
drop policy if exists "agent_events_staff_insert" on public.agent_events;
create policy "agent_events_staff_insert" on public.agent_events
  for insert with check (is_internal_staff());

-- ── updated_at triggers (shared helper from 0001) ──
drop trigger if exists agents_updated_at on public.agents;
create trigger agents_updated_at before update on public.agents
  for each row execute function set_updated_at();
drop trigger if exists agent_tasks_updated_at on public.agent_tasks;
create trigger agent_tasks_updated_at before update on public.agent_tasks
  for each row execute function set_updated_at();
