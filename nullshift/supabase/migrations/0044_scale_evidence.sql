-- 0044: scale evidence — the machine-gathered half of a scale assessment.
--
-- Once a system is built we can read most of the Nullshift Scale Index inputs
-- straight off it: monthly active users from the production database, the
-- dependency count and external integrations from the repository, whether it
-- takes payments, holds PII, has an admin area with roles, and so on. A scan
-- stores what it found (evidence), what it derived from that (derived), and
-- which fields a person still has to supply (field_states). The assessment a
-- person then saves links back to the scan it was built on, so a quote can
-- always be traced to the evidence behind it.

create table if not exists public.scale_evidence (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,

  -- What started the scan: a button on the pricing page, a project reaching
  -- live/care, or the periodic re-scan.
  trigger text not null default 'manual' check (trigger in ('manual', 'stage', 'cron')),
  pricing_version text not null,

  -- Per-source outcome: { repo: {ok, ref, error}, database: {ok, ref, error} }.
  sources jsonb not null default '{}'::jsonb,
  -- Raw findings (RepoEvidence / DatabaseEvidence in lib/scoring/types.ts).
  evidence jsonb not null default '{}'::jsonb,
  -- The ScaleInput proposed from the evidence.
  derived jsonb not null default '{}'::jsonb,
  -- field → 'auto' | 'estimated' | 'human'.
  field_states jsonb not null default '{}'::jsonb,
  -- Plain-English lines explaining each derived value.
  notes jsonb not null default '[]'::jsonb,

  -- The score the derived inputs produce BEFORE a person fills the human
  -- fields. Never billed from — a saved scale_assessments row is what
  -- contractedMrr() reads.
  provisional_nsi integer check (provisional_nsi between 0 and 100),
  provisional_band text,
  provisional_mrr numeric(10, 2),

  collected_by uuid references auth.users(id) on delete set null,
  collected_at timestamptz not null default now()
);

create index if not exists scale_evidence_tenant_collected_idx
  on public.scale_evidence (tenant_id, collected_at desc);

alter table public.scale_evidence enable row level security;

drop policy if exists scale_evidence_staff_read on public.scale_evidence;
create policy scale_evidence_staff_read on public.scale_evidence
  for select using (is_internal_staff());

drop policy if exists scale_evidence_staff_write on public.scale_evidence;
create policy scale_evidence_staff_write on public.scale_evidence
  for insert with check (is_internal_staff());

-- An assessment remembers the scan it was completed from and which of its
-- inputs were machine-derived vs typed by a person.
alter table public.scale_assessments
  add column if not exists evidence_id uuid references public.scale_evidence(id) on delete set null;
alter table public.scale_assessments
  add column if not exists field_states jsonb not null default '{}'::jsonb;
