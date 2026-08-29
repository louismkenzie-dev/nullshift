-- ============================================================
--  019 — Agent Consultation
--  The /start funnel becomes the "Agent Consultation": after
--  contact capture, an agent generates a tailored plan + a live
--  frontend mockup (rendered on /plan/[token]) and enriches the
--  CRM lead. Idempotent — safe to re-run.
--  Apply in Supabase: SQL Editor → New query → Run.
-- ============================================================

-- ── Every agent invocation, for cost + audit. ──
create table if not exists public.agent_runs (
  id            uuid primary key default gen_random_uuid(),
  agent         text not null,             -- 'consultation.plan' | 'consultation.mockup' | ...
  trigger       text not null,             -- 'plan_view' | 'admin' | 'cron'
  plan_token    text,                      -- ties consultation runs to a lead
  model         text not null,
  status        text not null default 'running',  -- running | ok | error
  input_tokens  int,
  output_tokens int,
  cache_read_tokens int,
  cost_usd      numeric(10,4),
  duration_ms   int,
  error         text,
  created_at    timestamptz not null default now()
);
create index if not exists agent_runs_agent_idx on public.agent_runs (agent, created_at desc);
create index if not exists agent_runs_token_idx on public.agent_runs (plan_token);

-- Staff read their own tenant-less ops data; runs are internal-only.
alter table public.agent_runs enable row level security;
drop policy if exists "agent_runs_staff_read" on public.agent_runs;
create policy "agent_runs_staff_read" on public.agent_runs
  for select using (is_internal_staff());
-- Writes go through the service role only (no insert/update policies).

-- ── The consultation artifact: agent plan + mockup, keyed by the
--    same unguessable plan_token as the /plan page. One row per lead. ──
create table if not exists public.agent_consultations (
  plan_token  text primary key,
  status      text not null default 'pending',  -- pending | generating | ready | failed
  plan        jsonb,                            -- structured agent plan (validated server-side)
  mockup_html text,                             -- self-contained sandboxed document
  enrichment  jsonb,                            -- CRM extraction (also copied onto leads)
  error       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.agent_consultations enable row level security;
drop policy if exists "agent_consultations_staff_read" on public.agent_consultations;
create policy "agent_consultations_staff_read" on public.agent_consultations
  for select using (is_internal_staff());
-- Public reads go through the service role in the /plan route (token = capability).

-- ── CRM enrichment on the canonical lead row (pipeline reads `leads`). ──
alter table public.leads add column if not exists agent_enrichment jsonb;
