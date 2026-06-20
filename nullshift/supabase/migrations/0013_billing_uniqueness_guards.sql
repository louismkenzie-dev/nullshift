-- Billing integrity guards exposed by the live-Stripe review.

-- At most one non-void build invoice per project — makes the generate-invoice
-- dedupe atomic (a concurrent second generate hits this index instead of minting
-- a second Stripe invoice + charge).
create unique index if not exists invoices_one_build_per_project
  on public.invoices (project_id)
  where type = 'build_milestone' and status <> 'void';

-- One local row per Stripe subscription (prevents duplicate subscription rows and
-- lets the webhook reconcile by a stable key).
create unique index if not exists subscriptions_stripe_sub_unique
  on public.subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;
