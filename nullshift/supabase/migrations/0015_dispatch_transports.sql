-- 0015_dispatch_transports.sql
-- Two additional fix-batch dispatch transports beyond the GitHub @claude issue:
--   1) Claude Code Routines (research preview) — per-system fire endpoint + token,
--      fired with the compiled work order as the run's text payload.
--   2) Managed Agents API (beta) — Anthropic-hosted sandbox sessions spawned by the
--      backend with the repo mounted; agent/environment ids persist in ops_settings.
-- Apply AFTER 0014.

alter table public.system_profiles
  add column routine_fire_url text,
  add column routine_token text;

alter table public.fix_batches
  add column routine_session_url text,
  add column routine_fired_at timestamptz,
  add column ma_session_id text,
  add column ma_session_url text;

-- Small server-side key/value store for ops singletons (Managed Agent ids etc).
-- RLS enabled with no policies: service-role access only, never client-readable.
create table public.ops_settings (
  key        text primary key,
  value      jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.ops_settings enable row level security;
