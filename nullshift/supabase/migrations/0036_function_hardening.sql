-- 0036: function hardening (legal implementation spec §19).
--
-- Findings from the Supabase security linter, fixed rather than filed:
--
--  1. `marketing_allowed(addr)` was executable by anon and by any signed-in
--     user. That is an email-enumeration oracle: anyone could ask the API
--     whether a given address is on our marketing list. Only the server
--     (service role) ever needs to ask, so the grant goes.
--
--  2. The `next_*_ref()` reference allocators were executable by anon. They
--     leak a count — how many Order Forms, Change Orders, complaints or
--     terminations exist this year — to anyone who calls them, and they are
--     volatile, so calling them repeatedly is a cheap way to probe. All four
--     are only ever called through the service role.
--
--  3. Trigger functions added in 0030–0035 had a mutable search_path. They are
--     SECURITY INVOKER, so the exposure is smaller than a definer function's,
--     but a trigger that resolves `public.change_orders` through whatever
--     search_path the caller happens to have set is not a control worth
--     relying on.
--
-- The `rls_enabled_no_policy` notices on email_verifications, ops_settings,
-- rate_limits and stripe_events are NOT defects: RLS on with no policy is
-- default-deny, which is exactly right for tables only the service role
-- touches.

-- ── 1 & 2: revoke the grants ───────────────────────────────────
--
-- Revoking from anon and authenticated alone does nothing: both inherit
-- EXECUTE from PUBLIC, which Postgres grants on every new function. PUBLIC is
-- the grant that has to go. `service_role` keeps its explicit grant, which is
-- the only caller these have.

revoke all on function public.marketing_allowed(text) from public, anon, authenticated;
revoke all on function public.next_order_form_ref() from public, anon, authenticated;
revoke all on function public.next_change_order_ref() from public, anon, authenticated;
revoke all on function public.next_termination_ref() from public, anon, authenticated;
revoke all on function public.next_price_notice_ref() from public, anon, authenticated;
revoke all on function public.next_complaint_ref() from public, anon, authenticated;
grant execute on function public.marketing_allowed(text) to service_role;
grant execute on function public.next_order_form_ref() to service_role;
grant execute on function public.next_change_order_ref() to service_role;
grant execute on function public.next_termination_ref() to service_role;
grant execute on function public.next_price_notice_ref() to service_role;
grant execute on function public.next_complaint_ref() to service_role;

-- NOT revoked: is_internal_staff(), is_member_of(), is_tenant_admin(). Every
-- RLS policy in the schema calls them, and a policy expression runs as the
-- invoking role — revoking EXECUTE would take the whole database offline for
-- clients. They answer only about the caller's own memberships, so being
-- callable leaks nothing.

-- ── 3: pin the search_path on the trigger functions ────────────

alter function public.enforce_change_order_before_build() set search_path = public;
alter function public.freeze_confirmed_termination() set search_path = public;
alter function public.enforce_subprocessor_notice_period() set search_path = public;
alter function public.set_updated_at() set search_path = public;
