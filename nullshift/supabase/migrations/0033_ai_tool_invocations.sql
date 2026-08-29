-- 0033: AI tool-invocation log (legal implementation spec §13).
--
-- What has to be reconstructable after the fact: which tool an agent called,
-- who it was acting for, what the model request was, whether a human confirmed
-- it, and what happened. Without the confirmation column the log cannot answer
-- the only question that matters after an incident — "did anyone approve this?"
--
-- Arguments and results are stored REDACTED. The redaction happens in
-- application code before the insert, because a log that has to be trusted not
-- to contain secrets is not a control.

create table if not exists public.ai_tool_invocations (
  id uuid primary key default gen_random_uuid(),

  agent_id uuid references public.agents(id) on delete set null,
  task_id uuid references public.agent_tasks(id) on delete set null,
  run_id uuid references public.agent_runs(id) on delete set null,
  -- Which client this was done for, when it was done for one.
  tenant_id uuid references public.tenants(id) on delete set null,

  tool text not null,
  -- low | medium | high. High-impact or irreversible actions require
  -- confirmation by default (see confirmed_* below).
  impact text not null default 'high' check (impact in ('low', 'medium', 'high')),

  -- The human on whose behalf the agent acted. Null for a scheduled routine,
  -- which is itself a fact worth being able to see.
  initiating_user uuid references auth.users(id) on delete set null,
  initiating_email text,

  -- Provider request id where the SDK exposes one, for correlating with the
  -- model provider's own records.
  model_request_id text,

  -- Redacted before insert. Never raw.
  arguments jsonb not null default '{}'::jsonb,
  result_summary text,

  outcome text not null default 'pending' check (
    outcome in ('pending', 'succeeded', 'failed', 'refused', 'cancelled')
  ),
  error_message text,

  -- The confirmation event, inline rather than in a side table: the question
  -- "was this confirmed?" must be answerable from the row itself.
  confirmation_required boolean not null default false,
  confirmed_at timestamptz,
  confirmed_by uuid references auth.users(id) on delete set null,
  confirmed_by_email text,

  started_at timestamptz not null default now(),
  finished_at timestamptz,

  constraint ai_tool_invocation_high_impact_needs_confirmation check (
    -- A high-impact action may be pending or refused without confirmation;
    -- it may not have SUCCEEDED without one.
    outcome <> 'succeeded'
    or confirmation_required = false
    or confirmed_at is not null
  )
);

create index if not exists ai_tool_invocations_started_idx
  on public.ai_tool_invocations (started_at desc);
create index if not exists ai_tool_invocations_agent_idx
  on public.ai_tool_invocations (agent_id, started_at desc);
create index if not exists ai_tool_invocations_tenant_idx
  on public.ai_tool_invocations (tenant_id, started_at desc);

alter table public.ai_tool_invocations enable row level security;

-- Staff read; the runtime writes through the service role. No client-side
-- write path exists at all.
drop policy if exists ai_tool_invocations_staff on public.ai_tool_invocations;
create policy ai_tool_invocations_staff on public.ai_tool_invocations
  for select to authenticated using (is_internal_staff());
