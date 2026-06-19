-- 015_proposed_care_plan.sql
-- The care plan is now part of the proposal: the admin sets a proposed plan on
-- the project, the client accepts/declines it with the proposal in their portal,
-- and on acceptance it becomes an active subscription. Nullable — a proposal may
-- include no ongoing care plan.
alter table public.projects
  add column if not exists proposed_plan text;
