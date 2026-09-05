-- Outcome review (2026-09-04)
--
-- What a Claude Code session did for each issue comes back in the pull
-- request. Before this, that text lived only on GitHub and the client's feed
-- got a bare "Fixed: <title>" the moment a batch shipped — a question was
-- announced as "fixed" and its answer never reached anyone.
--
-- Outcomes now land here first as staff-only drafts, are reviewed and edited
-- by a person, and only then reach the client (as "Fixed" or "Answered").
-- Deliberately NOT on public.issues: the member SELECT policies there are
-- column-blind, so an unapproved draft on an issue row would be readable by
-- the client it is about.
create table if not exists public.batch_outcomes (
  batch_id      uuid not null references public.fix_batches(id) on delete cascade,
  issue_id      uuid not null references public.issues(id) on delete cascade,
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  -- fixed: it works now · answered: a question, answered in words ·
  -- not_done: explicitly not done, with the reason (never sent to a client).
  outcome       text not null default 'fixed'
                check (outcome in ('fixed', 'answered', 'not_done')),
  note          text not null default '',
  -- Where the draft came from, so review knows how much to trust it.
  source        text not null default 'manual' check (source in ('pr', 'manual')),
  approved_at   timestamptz,
  approved_by   text,
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (batch_id, issue_id)
);

create index if not exists batch_outcomes_issue_idx on public.batch_outcomes (issue_id);
create index if not exists batch_outcomes_tenant_idx on public.batch_outcomes (tenant_id);

alter table public.batch_outcomes enable row level security;

-- Staff only, both ways: this is the review desk, not client-facing.
create policy batch_outcomes_staff_all on public.batch_outcomes
  for all using (is_internal_staff()) with check (is_internal_staff());

create trigger trg_batch_outcomes_updated
  before update on public.batch_outcomes
  for each row execute function public.set_updated_at();
