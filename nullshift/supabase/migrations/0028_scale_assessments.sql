-- 0028: Nullshift Scale Index (NSI) assessments — the audit trail behind every
-- recurring price. The public site advertises one "from" price per plan; what a
-- client is actually charged comes from scoring their scale, commercial
-- criticality and technical load, then applying a band multiplier and a
-- direct-cost margin floor.
--
-- Every row stores the RAW INPUTS alongside the component scores, band,
-- multiplier, floor and final figure, plus the pricing version that produced
-- them — so a quote can always be explained, and a future formula change never
-- rewrites historic logic. Manual overrides are allowed but must carry a reason
-- and the person who made them.

create table if not exists public.scale_assessments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,

  -- Which formula produced this row (e.g. NSI_v1_2026_08).
  pricing_version text not null,
  plan text not null check (plan in ('core', 'pro', 'max', 'enterprise')),

  -- Raw inputs, exactly as scored.
  inputs jsonb not null default '{}'::jsonb,

  -- Component scores (the five NSI dimensions) + the total.
  score_audience integer not null default 0,
  score_commercial integer not null default 0,
  score_technical integer not null default 0,
  score_reach integer not null default 0,
  score_risk integer not null default 0,
  nsi integer not null default 0 check (nsi between 0 and 100),

  -- Pricing outcome. Nullable throughout: an Enterprise review (or missing
  -- vendor cost) deliberately yields no automatic price.
  scale_band text check (
    scale_band in ('standard', 'growth', 'established', 'scale', 'critical')
  ),
  multiplier numeric(4, 2),
  base_plan_price numeric(10, 2),
  scaled_plan_price numeric(10, 2),
  direct_cost_floor numeric(10, 2),
  recommended_mrr numeric(10, 2),
  enterprise_review_required boolean not null default false,
  data_quality text not null default 'ok' check (data_quality in ('ok', 'low')),
  review_flags jsonb not null default '[]'::jsonb,

  -- Commercial flexibility without losing auditability: an override needs a
  -- reason and an owner, enforced below.
  override_mrr numeric(10, 2),
  override_reason text,
  overridden_by uuid references auth.users(id) on delete set null,

  -- What the client is actually billed once agreed (null until adopted).
  agreed_mrr numeric(10, 2),
  agreed_at timestamptz,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),

  constraint scale_assessments_override_needs_reason check (
    override_mrr is null
    or (override_reason is not null and length(btrim(override_reason)) > 0)
  )
);

create index if not exists scale_assessments_tenant_created_idx
  on public.scale_assessments (tenant_id, created_at desc);

-- Staff-only: the formula, the scores and the margin floor are internal.
-- Clients see their agreed monthly figure on their subscription, never this.
alter table public.scale_assessments enable row level security;

drop policy if exists scale_assessments_staff_read on public.scale_assessments;
create policy scale_assessments_staff_read on public.scale_assessments
  for select using (is_internal_staff());

drop policy if exists scale_assessments_staff_write on public.scale_assessments;
create policy scale_assessments_staff_write on public.scale_assessments
  for insert with check (is_internal_staff());

drop policy if exists scale_assessments_staff_update on public.scale_assessments;
create policy scale_assessments_staff_update on public.scale_assessments
  for update using (is_internal_staff()) with check (is_internal_staff());
