-- 0029: the compliance-review assistant's record (brief §"UK compliance-review
-- assistant", audit Phase 4.3). One row per structured review — intake answers,
-- derived mandatory-escalation flags, the editable evidence-linked pack, and
-- the Administrator decision that escalated reviews REQUIRE before they can be
-- marked recorded. Status vocabulary deliberately avoids "compliant":
--   draft → escalated (flags present) → decision_recorded → recorded
--   draft → recorded (no flags)
-- Staff-only: clients never see the issue register.

create table if not exists public.compliance_reviews (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  trigger text not null check (trigger in ('discovery', 'scope_change', 'pre_launch')),
  answers jsonb not null default '{}',
  flags jsonb not null default '[]',
  status text not null default 'draft'
    check (status in ('draft', 'escalated', 'decision_recorded', 'recorded')),
  pack text,
  decision text,
  decided_by text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists compliance_reviews_tenant_idx
  on public.compliance_reviews (tenant_id);
alter table public.compliance_reviews enable row level security;
create policy compliance_reviews_staff_all on public.compliance_reviews
  for all to authenticated
  using (public.is_internal_staff()) with check (public.is_internal_staff());
create trigger trg_compliance_reviews_updated
  before update on public.compliance_reviews
  for each row execute function public.set_updated_at();
