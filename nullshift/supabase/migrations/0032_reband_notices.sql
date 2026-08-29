-- 0032: pricing shadow scores and re-band notices (legal implementation spec §7).
--
-- The rule this schema exists to enforce: a score is not a price. A monthly
-- snapshot records what the NSI formula WOULD say today and changes nothing.
-- Moving a client's recurring fee needs a human decision, a notice record, and
-- 30 days between telling them and charging them.
--
-- Asymmetry is deliberate and in the client's favour. Going UP needs two
-- consecutive snapshots in the higher band; coming DOWN needs three, but only
-- at a six-month review — so a quiet month never inflates a bill, and a genuine
-- fall is not undone by one busy week.

create table if not exists public.pricing_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,

  -- The month this snapshot speaks for (first of the month).
  period date not null,
  pricing_version text not null,

  -- The shadow calculation. Recorded in full so a later decision can be
  -- explained from the same inputs that produced it.
  inputs jsonb not null default '{}'::jsonb,
  component_scores jsonb not null default '{}'::jsonb,
  nsi integer not null check (nsi between 0 and 100),
  scale_band text check (
    scale_band in ('standard', 'growth', 'established', 'scale', 'critical')
  ),
  multiplier numeric(4, 2),
  recommended_mrr numeric(10, 2),
  direct_vendor_cost numeric(10, 2),
  enterprise_review_required boolean not null default false,

  -- What they are actually paying at the moment of the snapshot. The gap
  -- between this and recommended_mrr is the whole point of the record.
  current_mrr numeric(10, 2),

  created_at timestamptz not null default now(),

  -- One snapshot per client per month: a shadow score is a monthly statement,
  -- not a stream.
  unique (tenant_id, period)
);

create index if not exists pricing_snapshots_tenant_period_idx
  on public.pricing_snapshots (tenant_id, period desc);

create table if not exists public.price_change_notices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  order_form_id uuid references public.order_forms(id) on delete set null,

  reference text not null unique,

  direction text not null check (direction in ('increase', 'decrease')),
  reason text not null,

  old_mrr numeric(10, 2) not null,
  new_mrr numeric(10, 2) not null,
  old_band text,
  new_band text,
  pricing_version text not null,

  -- The snapshots that justified it, by id. Evidence, not narrative.
  evidence_snapshot_ids jsonb not null default '[]'::jsonb,

  status text not null default 'proposed' check (
    status in ('proposed', 'approved', 'notice_sent', 'effective', 'withdrawn')
  ),

  -- A human has to approve before a client is ever told, let alone charged.
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,

  -- Notice evidence: when it went, to whom, and by what route.
  notice_sent_at timestamptz,
  notice_sent_to text,
  notice_channel text check (notice_channel in ('email', 'portal', 'post', 'other')),

  -- Never earlier than 30 days after the notice actually went out — enforced
  -- below rather than left to whoever fills the form in.
  effective_date date,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint price_change_notice_needs_approval_before_notice check (
    notice_sent_at is null or approved_at is not null
  ),
  constraint price_change_notice_30_day_minimum check (
    effective_date is null
    or notice_sent_at is null
    or effective_date >= (notice_sent_at + interval '30 days')::date
  ),
  constraint price_change_notice_effective_needs_notice check (
    status <> 'effective' or (notice_sent_at is not null and effective_date is not null)
  )
);

create index if not exists price_change_notices_tenant_idx
  on public.price_change_notices (tenant_id, created_at desc);

drop trigger if exists price_change_notices_updated_at on public.price_change_notices;
create trigger price_change_notices_updated_at
  before update on public.price_change_notices
  for each row execute function set_updated_at();

create or replace function next_price_notice_ref()
returns text
language sql
volatile
security definer
set search_path = public
as $$
  select 'PCN-' || to_char(now(), 'YYYY') || '-' ||
         lpad((
           select count(*) + 1
           from public.price_change_notices
           where reference like 'PCN-' || to_char(now(), 'YYYY') || '-%'
         )::text, 4, '0');
$$;

-- ── RLS ────────────────────────────────────────────────────────

-- Shadow scores are internal: the formula, the component scores and the margin
-- floor are Nullshift's, and showing a client a score that has not become a
-- price would invite an argument about a number that means nothing to them yet.
alter table public.pricing_snapshots enable row level security;

drop policy if exists pricing_snapshots_staff on public.pricing_snapshots;
create policy pricing_snapshots_staff on public.pricing_snapshots
  for all to authenticated
  using (is_internal_staff()) with check (is_internal_staff());

-- A notice, by contrast, is the client's business the moment it is sent to
-- them — and never before.
alter table public.price_change_notices enable row level security;

drop policy if exists price_change_notices_select on public.price_change_notices;
create policy price_change_notices_select on public.price_change_notices
  for select to authenticated
  using (
    is_internal_staff()
    or (is_member_of(tenant_id) and notice_sent_at is not null)
  );

drop policy if exists price_change_notices_staff_write on public.price_change_notices;
create policy price_change_notices_staff_write on public.price_change_notices
  for all to authenticated
  using (is_internal_staff()) with check (is_internal_staff());
