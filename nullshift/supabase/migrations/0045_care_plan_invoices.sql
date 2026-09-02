-- 0045: care-plan invoices — every confirmed GoCardless collection becomes a
-- paid invoice here and in Xero, so recurring revenue reconciles like build
-- work does instead of arriving in the bank as an anonymous GoCardless payout.

alter type invoice_type add value if not exists 'care_plan';

-- The GoCardless payment that raised the invoice. One invoice per payment,
-- whatever order (or how many times) the webhook events arrive.
alter table public.invoices add column if not exists gc_payment_id text;
create unique index if not exists invoices_one_per_gc_payment
  on public.invoices (gc_payment_id)
  where gc_payment_id is not null;
