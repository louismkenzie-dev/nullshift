-- 0011_lead_plan
-- The "Get my free plan" lead magnet persists an auto-generated Build Blueprint
-- on the lead so it can be reached at a permanent, unguessable URL
-- (/plan/[token]). plan_token is the public key for that page (read via the
-- service role, single-row by token); plan holds the generated blueprint payload
-- ({ blueprint, businessName, name, segment }). leads stays staff-only under RLS;
-- the public plan page reads by token through the trusted server client.
alter table public.leads add column if not exists plan_token uuid unique;
alter table public.leads add column if not exists plan jsonb;
create index if not exists leads_plan_token_idx on public.leads (plan_token);
