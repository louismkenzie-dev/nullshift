-- Stripe Connect application fee, agreed on the Order Form (2026-09-12)
--
-- The platform fee used to be a global constant (packages/billing/src/fees.ts,
-- 2%) with nowhere to say whether a given client had agreed to it. That is
-- backwards: the fee is a commercial term, so it belongs on the Order Form
-- the client signs, and no money may move through Connect until that
-- signature exists.
--
--   order_forms.application_fee_enabled — the owner ticked "this project takes
--     an application fee via Stripe".
--   order_forms.application_fee_percent — the agreed percentage of each
--     payment, 0.01–100, two decimals. Required when enabled (constraint).
--   contract_acceptances.application_fee_percent — what the client actually
--     signed against, copied at acceptance so the signed record stands alone
--     even if the order row were ever edited. Null = no fee was agreed.
--
-- The disclaimer that the fee EXCLUDES Stripe's own processing fees is not a
-- column: it is fixed wording (apps/web/lib/legal/applicationFee.ts) whose hash
-- is stored in contract_acceptances.document_hashes at signature.
alter table public.order_forms
  add column if not exists application_fee_enabled boolean not null default false,
  add column if not exists application_fee_percent numeric(5,2)
    check (application_fee_percent is null
           or (application_fee_percent >= 0.01 and application_fee_percent <= 100));

alter table public.order_forms
  drop constraint if exists order_forms_application_fee_consistent;
alter table public.order_forms
  add constraint order_forms_application_fee_consistent
  check (not application_fee_enabled or application_fee_percent is not null);

alter table public.contract_acceptances
  add column if not exists application_fee_percent numeric(5,2)
    check (application_fee_percent is null
           or (application_fee_percent >= 0.01 and application_fee_percent <= 100));
