-- Connected account labels + assignment (2026-09-13)
--
-- Application fees were already being collected through connected accounts set
-- up directly in Stripe, long before the OAuth flow in 0051 existed — so
-- tenants.stripe_connect_account_id is null for those clients and every fee
-- ingested lands unattributed.
--
-- A Stripe Application Fee object names only the account id (acct_...), never
-- the business. Caching the account's own label at sync time is what lets a
-- person recognise "Suffolk Tennis LTA" rather than acct_1Q7xR2... and assign
-- it to the right client from the dashboard.
alter table public.connect_application_fees
  add column if not exists stripe_account_name text;
