-- 0046: care-plan terms — the client agrees to the subscription terms before a
-- Direct Debit is set up, and the agreement travels with the subscription.
--
-- The choice itself is the client's, made in the portal once their system is
-- live; staff never pick a plan on a client's behalf (Enterprise, quoted and
-- contracted separately, is the exception).

alter table public.tenants
  add column if not exists care_plan_terms_version text,
  add column if not exists care_plan_terms_accepted_at timestamptz,
  add column if not exists care_plan_terms_accepted_by uuid references auth.users(id) on delete set null;

alter table public.subscriptions
  add column if not exists terms_version text,
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_accepted_by uuid references auth.users(id) on delete set null;
