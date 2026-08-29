-- ============================================================
--  0020 — AI Workspace Phases 2–5: approvals, escalations,
--  routines (idempotent firings), feedback, org policy limits.
--  Additive; staff-only RLS; runtime writes via service role.
--  Idempotent — safe to re-run.
-- ============================================================

-- ── Phase 2: proposed actions awaiting a named human ──
create table if not exists public.agent_approvals (
  id            uuid primary key default gen_random_uuid(),
  agent_id      uuid references public.agents(id),
  task_id       uuid references public.agent_tasks(id),
  tenant_id     uuid references public.tenants(id),
  proposed      text not null,              -- what + why, plain English
  preview       text,                       -- exact proposed content (safe to render)
  risk_tier     int not null default 2 check (risk_tier between 0 and 4),
  evidence      jsonb not null default '{}',-- source record refs + data freshness
  status        text not null default 'pending'
    check (status in ('pending','approved','rejected','changes_requested','expired')),
  approver_email text,
  decision_note  text,
  decided_at     timestamptz,
  expires_at     timestamptz not null default (now() + interval '7 days'),
  created_at     timestamptz not null default now()
);
create index if not exists agent_approvals_status_idx on public.agent_approvals (status, created_at desc);
create index if not exists agent_approvals_task_idx on public.agent_approvals (task_id);

-- ── Phase 2: escalations to accountable humans ──
create table if not exists public.agent_escalations (
  id          uuid primary key default gen_random_uuid(),
  agent_id    uuid references public.agents(id),
  task_id     uuid references public.agent_tasks(id),
  tenant_id   uuid references public.tenants(id),
  reason      text not null,
  severity    text not null default 'normal' check (severity in ('low','normal','high','critical')),
  owner_email text,
  status      text not null default 'open' check (status in ('open','acknowledged','resolved')),
  sla_due_at  timestamptz,
  resolution  text,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists agent_escalations_status_idx on public.agent_escalations (status, created_at desc);

-- ── Phase 2/4: human feedback on outcomes ──
create table if not exists public.agent_feedback (
  id         uuid primary key default gen_random_uuid(),
  agent_id   uuid references public.agents(id),
  task_id    uuid references public.agent_tasks(id),
  run_id     uuid references public.agent_runs(id),
  rating     text not null check (rating in ('good','acceptable','poor')),
  note       text,
  author     text,
  created_at timestamptz not null default now()
);

-- ── Phase 4: routines (schedule/event driven, idempotent) ──
create table if not exists public.agent_routines (
  key              text primary key,          -- 'morning-briefing'
  name             text not null,
  purpose          text not null,
  agent_key        text not null references public.agents(key),
  cadence          text not null,             -- 'workdays' | 'daily' | 'weekly_mon' | 'event'
  enabled          boolean not null default false,
  risk_limit       int not null default 1 check (risk_limit between 0 and 2),
  budget_usd_daily numeric(10,2) not null default 2.00,
  failure_behaviour text not null default 'escalate',  -- escalate | silent
  last_fired_at    timestamptz,
  created_at       timestamptz not null default now()
);

-- One row per (routine, fire key) — the idempotency lock: repeated ticks and
-- repeated event deliveries cannot double-fire.
create table if not exists public.agent_routine_runs (
  id         uuid primary key default gen_random_uuid(),
  routine_key text not null references public.agent_routines(key),
  fire_key    text not null,                 -- e.g. 'morning-briefing:2026-08-18'
  task_id     uuid references public.agent_tasks(id),
  outcome     text not null default 'fired', -- fired | skipped_inactive | skipped_budget | error
  detail      text,
  created_at  timestamptz not null default now(),
  unique (routine_key, fire_key)
);

-- ── Org-wide workspace limits (structured policy, evaluated in code) ──
insert into public.ops_settings (key, value)
values ('ai_workspace_policy', '{
  "max_delegation_depth": 2,
  "max_children_per_task": 5,
  "max_task_budget_usd": 5,
  "org_daily_budget_usd": 25,
  "approval_expiry_days": 7
}'::jsonb)
on conflict (key) do nothing;

-- ── RLS ──
alter table public.agent_approvals    enable row level security;
alter table public.agent_escalations  enable row level security;
alter table public.agent_feedback     enable row level security;
alter table public.agent_routines     enable row level security;
alter table public.agent_routine_runs enable row level security;

drop policy if exists "agent_approvals_staff" on public.agent_approvals;
create policy "agent_approvals_staff" on public.agent_approvals
  for all using (is_internal_staff()) with check (is_internal_staff());
drop policy if exists "agent_escalations_staff" on public.agent_escalations;
create policy "agent_escalations_staff" on public.agent_escalations
  for all using (is_internal_staff()) with check (is_internal_staff());
drop policy if exists "agent_feedback_staff" on public.agent_feedback;
create policy "agent_feedback_staff" on public.agent_feedback
  for all using (is_internal_staff()) with check (is_internal_staff());
drop policy if exists "agent_routines_staff" on public.agent_routines;
create policy "agent_routines_staff" on public.agent_routines
  for all using (is_internal_staff()) with check (is_internal_staff());
drop policy if exists "agent_routine_runs_staff_read" on public.agent_routine_runs;
create policy "agent_routine_runs_staff_read" on public.agent_routine_runs
  for select using (is_internal_staff());
-- routine_runs writes: service role only (the cron tick).

-- ── Seed the initial routines (disabled until a human enables them) ──
insert into public.agent_routines (key, name, purpose, agent_key, cadence, enabled, risk_limit)
values
 ('morning-briefing','Morning operations briefing',
  'Each workday, assemble an internal briefing: open issues by severity, batches in flight, overdue invoices, unowned work. Internal only; draft output.',
  'operations-manager','workdays',false,1),
 ('project-risk-scan','Daily project-risk scan',
  'Identify late milestones, blocked issues, missing client inputs and unowned items across active projects. Internal only.',
  'operations-manager','daily',false,1),
 ('invoice-watch','Invoice watch',
  'Flag overdue and near-due invoices and queue reminder-draft tasks for the finance assistant. Nothing sends without approval.',
  'finance-assistant','daily',false,1),
 ('weekly-update-drafts','Weekly project-update drafts',
  'Each Monday, queue an internal client-update draft task per active project for human review.',
  'project-coordinator','weekly_mon',false,1),
 ('onboarding-scan','Onboarding completeness scan',
  'Identify build projects missing passport facts (repo, env, contacts) before build begins.',
  'operations-manager','daily',false,1),
 ('compliance-screening','Compliance screening',
  'Flag projects at build/live without a signed DPA or with children''s/special-category data markers; escalate to a human.',
  'privacy-review','daily',false,1)
on conflict (key) do nothing;
