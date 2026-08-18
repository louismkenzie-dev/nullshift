-- 0023: make the lead a usable CRM record (audit Phase 1.5). Phone and UTM
-- were captured by the funnel and silently dropped; owner / next action /
-- decision-maker had no home at all.

alter table public.leads
  add column if not exists phone text,
  add column if not exists utm jsonb,
  add column if not exists owner text,
  add column if not exists next_action text,
  add column if not exists decision_maker text;
