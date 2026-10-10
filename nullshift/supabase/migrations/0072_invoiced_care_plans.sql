-- 0072: invoiced care plans — a monthly invoice as the collection route for a
-- care plan, for the client who will not (or cannot) set up a Direct Debit.
--
-- STATUS: see the ledger (supabase_migrations.schema_migrations); applied via
-- MCP in small chunks, name `invoiced_care_plans`.
--
-- PURPOSE
--   1. `subscriptions.invoicing` — 'monthly' marks a plan that is billed by
--      raising an invoice each period rather than by a provider schedule. It
--      rides on provider = 'manual' (0017: "standing-order retainers recorded
--      by hand") so every existing read of provider keeps its meaning.
--      `invoiced_from` anchors the periods (the first period starts on that
--      date and each later one on the same day of the month, clamped);
--      `invoice_terms_days` sets each invoice's due date; `invoice_note`
--      records why this route was chosen, for the history.
--   2. `invoices.subscription_id` + `period_start` / `period_end` — which plan
--      period an invoice covers. `invoices_one_per_subscription_period` makes
--      raising idempotent: a re-run, a cron and a page load can all try to
--      raise October and exactly one row results. Void rows are excluded so a
--      voided invoice can be re-raised.
--
-- No provider call, no email, no backfill: existing rows keep
-- invoicing = 'none' and are untouched.
--
-- ROLLBACK
--   begin;
--   drop index if exists public.invoices_one_per_subscription_period;
--   drop index if exists public.invoices_subscription_idx;
--   alter table public.invoices drop column if exists period_end, drop column if exists period_start, drop column if exists subscription_id;
--   alter table public.subscriptions drop constraint if exists subscriptions_invoicing_has_start;
--   alter table public.subscriptions drop column if exists invoice_note, drop column if exists invoice_terms_days, drop column if exists invoiced_from, drop column if exists invoicing;
--   commit;

begin;

alter table public.subscriptions
  add column if not exists invoicing text not null default 'none'
    check (invoicing in ('none', 'monthly')),
  add column if not exists invoiced_from date,
  add column if not exists invoice_terms_days smallint not null default 14
    check (invoice_terms_days between 0 and 90),
  add column if not exists invoice_note text;

alter table public.subscriptions
  drop constraint if exists subscriptions_invoicing_has_start;
alter table public.subscriptions
  add constraint subscriptions_invoicing_has_start
    check (invoicing <> 'monthly' or invoiced_from is not null);

comment on column public.subscriptions.invoicing is
  'none = collected by the provider on the row; monthly = an invoice is raised each period (0072). Rides on provider = manual.';
comment on column public.subscriptions.invoiced_from is
  'First period start for a monthly-invoiced plan; later periods start on the same day of each month, clamped to month length.';

alter table public.invoices
  add column if not exists subscription_id uuid references public.subscriptions(id) on delete set null,
  add column if not exists period_start date,
  add column if not exists period_end date;

comment on column public.invoices.subscription_id is
  'The monthly-invoiced plan this invoice bills (0072). Null for build, one-off and provider-collected care-plan invoices.';

create index if not exists invoices_subscription_idx
  on public.invoices (subscription_id)
  where subscription_id is not null;

-- One live invoice per plan period: the idempotency key for raising.
create unique index if not exists invoices_one_per_subscription_period
  on public.invoices (subscription_id, period_start)
  where subscription_id is not null and status <> 'void';

commit;
