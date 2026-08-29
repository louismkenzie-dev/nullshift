-- ============================================================
--  020 — Agent Consultation: online research + phase split
--  The consultation now researches the business online before
--  planning, and generation runs in two phases (plan → mockup)
--  so neither exceeds one serverless invocation window.
--  Idempotent — safe to re-run.
-- ============================================================

-- Research brief produced by the web-search phase (markdown).
alter table public.agent_consultations add column if not exists research text;

-- The mockup brief must survive between the plan phase and the mockup
-- phase (separate invocations), so it's persisted alongside the plan.
alter table public.agent_consultations add column if not exists mockup_spec jsonb;

-- status gains two intermediate values:
--   pending → generating → plan_ready → building → ready | failed
-- (text column — no constraint change needed.)
