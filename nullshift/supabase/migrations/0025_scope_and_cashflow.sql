-- 0025: scope control + cash flow (audit Phase 2). Three connected gaps:
-- quoted work had no client-facing impact statement or approval record, an
-- approved quote never became an invoice, and the signed proposal document
-- re-rendered from mutable rows. All additive.

-- The quote a client actually decides on: staff write a plain-English impact
-- statement alongside the price; the client's decision is stamped, not implied.
alter table public.issues
  add column if not exists quote_note text,
  add column if not exists quote_accepted_at timestamptz,
  add column if not exists quote_declined_at timestamptz;

-- Link an invoice to the issue it bills so an accepted quote generates exactly
-- one live invoice (mirrors invoices_one_build_per_project from 0013).
alter table public.invoices
  add column if not exists issue_id uuid references public.issues (id) on delete set null;
create unique index if not exists invoices_one_per_issue
  on public.invoices (issue_id)
  where issue_id is not null and status <> 'void';

-- The accepted proposal, frozen at signature: items, overview, payment terms,
-- care plan, totals. The "signed" PDF renders from this — never from live rows.
alter table public.projects
  add column if not exists accepted_snapshot jsonb;
