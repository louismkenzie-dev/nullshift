-- Client economics: tracks the missing cost side of Nullshift's existing revenue data.
-- Revenue continues to come from subscriptions, invoices and Stripe Connect fees.

create table if not exists public.economics_time_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  category text not null check (category in ('build','bug_fix','support','meeting','training','content','feature','admin','other')),
  description text,
  hours numeric(8,2) not null check (hours > 0),
  internal_hourly_cost numeric(10,2) not null default 40 check (internal_hourly_cost >= 0),
  occurred_on date not null default current_date,
  source text not null default 'manual',
  created_at timestamptz not null default now()
);

create index if not exists economics_time_entries_tenant_date_idx
  on public.economics_time_entries(tenant_id, occurred_on desc);
create index if not exists economics_time_entries_project_idx
  on public.economics_time_entries(project_id);
alter table public.economics_time_entries enable row level security;
revoke all on public.economics_time_entries from anon, authenticated;

create table if not exists public.economics_cost_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  category text not null check (category in ('hosting','api','email','ai','payments','software','contractor','other')),
  description text not null,
  amount numeric(10,2) not null check (amount >= 0),
  occurred_on date not null default current_date,
  recurring boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists economics_cost_entries_tenant_date_idx
  on public.economics_cost_entries(tenant_id, occurred_on desc);
create index if not exists economics_cost_entries_project_idx
  on public.economics_cost_entries(project_id);
alter table public.economics_cost_entries enable row level security;
revoke all on public.economics_cost_entries from anon, authenticated;

create table if not exists public.quote_assessments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete set null,
  prospect_name text not null,
  complexity_score integer not null check (complexity_score between 0 and 100),
  risk_level text not null check (risk_level in ('low','medium','high')),
  recommended_build_fee numeric(10,2) not null check (recommended_build_fee >= 0),
  recommended_monthly_fee numeric(10,2) not null check (recommended_monthly_fee >= 0),
  recommended_transaction_fee_bps integer not null check (recommended_transaction_fee_bps between 0 and 1000),
  predicted_support_hours numeric(8,2) not null check (predicted_support_hours >= 0),
  inputs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists quote_assessments_created_idx
  on public.quote_assessments(created_at desc);
alter table public.quote_assessments enable row level security;
revoke all on public.quote_assessments from anon, authenticated;

create or replace view public.client_economics_summary with (security_invoker = true) as
with revenue as (
  select t.id as tenant_id,
         coalesce((select sum(s.mrr) from public.subscriptions s where s.tenant_id=t.id and s.status::text in ('active','trialing')),0)::numeric as mrr,
         coalesce((select sum(i.amount) from public.invoices i where i.tenant_id=t.id and i.status::text='paid'),0)::numeric as paid_invoice_revenue,
         coalesce((select sum((caf.amount-caf.amount_refunded))/100.0 from public.connect_application_fees caf where caf.tenant_id=t.id and caf.livemode=true),0)::numeric as application_fee_revenue
  from public.tenants t
), time_costs as (
  select tenant_id,
         coalesce(sum(hours),0)::numeric as tracked_hours,
         coalesce(sum(hours*internal_hourly_cost),0)::numeric as labour_cost
  from public.economics_time_entries
  group by tenant_id
), direct_costs as (
  select tenant_id,
         coalesce(sum(amount),0)::numeric as direct_cost
  from public.economics_cost_entries
  group by tenant_id
), support as (
  select tenant_id,
         count(*) filter (where kind::text='bug')::int as bug_count,
         count(*)::int as issue_count
  from public.issues
  group by tenant_id
)
select t.id as tenant_id,
       t.name,
       t.vertical,
       r.mrr,
       r.paid_invoice_revenue,
       r.application_fee_revenue,
       (r.paid_invoice_revenue+r.application_fee_revenue) as lifetime_cash_revenue,
       coalesce(tc.tracked_hours,0) as tracked_hours,
       coalesce(tc.labour_cost,0) as labour_cost,
       coalesce(dc.direct_cost,0) as direct_cost,
       (coalesce(tc.labour_cost,0)+coalesce(dc.direct_cost,0)) as tracked_delivery_cost,
       (r.paid_invoice_revenue+r.application_fee_revenue-coalesce(tc.labour_cost,0)-coalesce(dc.direct_cost,0)) as tracked_contribution,
       case when coalesce(tc.tracked_hours,0) > 0 then (r.paid_invoice_revenue+r.application_fee_revenue)/tc.tracked_hours else null end as effective_revenue_per_hour,
       coalesce(s.issue_count,0) as issue_count,
       coalesce(s.bug_count,0) as bug_count
from public.tenants t
join revenue r on r.tenant_id=t.id
left join time_costs tc on tc.tenant_id=t.id
left join direct_costs dc on dc.tenant_id=t.id
left join support s on s.tenant_id=t.id;

revoke all on public.client_economics_summary from anon, authenticated;
