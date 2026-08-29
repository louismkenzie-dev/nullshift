-- ============================================================
--  0037 — SOC 2 readiness: governance, controls, evidence,
--  exceptions, incidents, access reviews, change records,
--  review periods and the audit pack.
--
--  Language contract (mirrors the product): these tables record
--  that a CONTROL IS IMPLEMENTED, EVIDENCE WAS COLLECTED, or an
--  EXCEPTION NEEDS REVIEW. Nothing here — and nothing built on
--  top of it — declares the company "SOC 2 compliant" or
--  "certified". SOC 2 is an independent auditor's report; this
--  schema exists to run the controls and keep the receipts.
--
--  Additive only. Reuses: audit_log (global trail, unchanged),
--  ops_settings (engine config), system_profiles (asset seed),
--  the AI Workspace tables (governance signals), and the legal
--  subprocessor register (vendor seed). Idempotent — safe to
--  re-run.
-- ============================================================

-- ── Programme roles ─────────────────────────────────────────
-- Who is accountable for what in the programme. Staff-gated
-- pages additionally check these rows server-side: being staff
-- lets you into /admin; a programme role is what lets you into
-- Security & SOC 2 Readiness. Client users have no path here at
-- all (staff-only RLS below).
create table if not exists public.soc2_programme_roles (
  id          uuid primary key default gen_random_uuid(),
  user_email  text not null,
  role        text not null check (role in (
    'programme_owner',    -- owns scope, risk acceptance, control design, auditor liaison
    'control_owner',      -- performs/ensures specific controls
    'evidence_reviewer',  -- checks evidence completeness/relevance
    'system_owner',       -- responsible for an in-scope service/integration
    'staff',              -- can complete assigned attestations/remediation only
    'auditor'             -- read-only, time-limited, explicit invitation
  )),
  scope_note  text,                       -- e.g. which systems a system_owner owns
  granted_by  text,
  expires_at  timestamptz,                -- mandatory for 'auditor' (enforced below)
  created_at  timestamptz not null default now(),
  unique (user_email, role)
);

create or replace function public.enforce_auditor_expiry()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.role = 'auditor' and new.expires_at is null then
    raise exception using
      errcode = 'check_violation',
      message = 'Auditor access must be time-limited: set expires_at.',
      hint = 'Read-only, time-limited access after explicit Administrator invitation.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_soc2_auditor_expiry on public.soc2_programme_roles;
create trigger trg_soc2_auditor_expiry
  before insert or update on public.soc2_programme_roles
  for each row execute function public.enforce_auditor_expiry();

-- ── Scope of System (versioned, approved) ───────────────────
-- One row per scope version. Readiness is only reported against
-- an APPROVED scope; a draft scope is a proposal.
create table if not exists public.soc2_scopes (
  id                  uuid primary key default gen_random_uuid(),
  version             int not null unique,
  service_description text not null,
  -- Which Trust Services categories this scope takes on, e.g.
  -- ["security","availability","confidentiality"]. Security is
  -- always required; the app refuses to save a scope without it.
  tsc_categories      jsonb not null default '["security"]',
  rationale           text,             -- why these categories, incl. narrow PI / excluded Privacy
  status              text not null default 'draft'
    check (status in ('draft', 'approved', 'superseded')),
  created_by          text,
  approved_by         text,
  approved_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

drop trigger if exists soc2_scopes_updated_at on public.soc2_scopes;
create trigger soc2_scopes_updated_at
  before update on public.soc2_scopes
  for each row execute function public.set_updated_at();

-- An approved scope must actually have been approved by someone.
create or replace function public.enforce_scope_approval()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'approved' and (new.approved_by is null or new.approved_at is null) then
    raise exception using
      errcode = 'check_violation',
      message = 'A scope cannot be approved without a named approver and time.',
      hint = 'An Administrator must approve every scope version.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_soc2_scope_approval on public.soc2_scopes;
create trigger trg_soc2_scope_approval
  before insert or update on public.soc2_scopes
  for each row execute function public.enforce_scope_approval();

-- The itemised contents of a scope version: in-scope services,
-- systems, environments, repositories, cloud accounts, client
-- data categories, staff/contractors, third parties — and the
-- explicit exclusions, with reasons. Exclusions are first-class:
-- an auditor reads what was left out before what was put in.
create table if not exists public.soc2_scope_items (
  id        uuid primary key default gen_random_uuid(),
  scope_id  uuid not null references public.soc2_scopes(id) on delete cascade,
  kind      text not null check (kind in (
    'service', 'system', 'environment', 'repository', 'cloud_account',
    'data_category', 'people', 'third_party', 'exclusion'
  )),
  label     text not null,
  detail    text,
  asset_id  uuid,                        -- linked after soc2_assets exists (FK added below)
  sort      int not null default 100,
  created_at timestamptz not null default now()
);
create index if not exists soc2_scope_items_scope_idx on public.soc2_scope_items (scope_id, kind, sort);

-- ── Asset / system inventory ────────────────────────────────
-- Everything the programme needs to know exists: applications,
-- repositories, cloud accounts, databases, environments, data
-- stores, integrations. An asset with no owner, classification
-- or review date is a standing flag (rules engine).
create table if not exists public.soc2_assets (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  kind              text not null check (kind in (
    'application', 'repository', 'cloud_account', 'database', 'device',
    'environment', 'data_store', 'integration', 'service'
  )),
  description       text,
  owner_email       text,
  classification    text check (classification in ('public', 'internal', 'confidential', 'restricted')),
  criticality       text check (criticality in ('low', 'medium', 'high', 'critical')),
  -- Where the asset already lives elsewhere in the platform. System passports
  -- are keyed by project (one passport per project), hence the FK target.
  system_profile_id uuid references public.system_profiles(project_id) on delete set null,
  tenant_id         uuid references public.tenants(id) on delete set null,
  vendor_id         uuid,                -- FK added after soc2_vendors below
  in_scope          boolean not null default true,
  review_due_at     date,
  retention_note    text,               -- retention/deletion decision for the data it holds
  status            text not null default 'active' check (status in ('active', 'retired')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists soc2_assets_kind_idx on public.soc2_assets (kind, status);
create index if not exists soc2_assets_owner_idx on public.soc2_assets (owner_email);

drop trigger if exists soc2_assets_updated_at on public.soc2_assets;
create trigger soc2_assets_updated_at
  before update on public.soc2_assets
  for each row execute function public.set_updated_at();

-- ── Vendor / sub-processor register ─────────────────────────
-- Seeded from packages/content legal subprocessors + the live
-- integration list, then maintained here. The legal register
-- remains the client-facing publication; this is the risk and
-- review side.
create table if not exists public.soc2_vendors (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  service            text not null,      -- what we use them for
  subprocessor_id    text,               -- id in packages/content/src/legal/subprocessors.ts, when client-facing
  data_access        text not null default 'none' check (data_access in (
    'none', 'internal', 'confidential', 'personal', 'special_category'
  )),
  service_dependency text check (service_dependency in ('low', 'medium', 'high', 'critical')),
  owner_email        text,
  risk_level         text check (risk_level in ('low', 'medium', 'high', 'critical')),
  -- Security/SOC documentation held about THEM: e.g.
  -- [{"kind":"soc2_report","reference":"<where it is filed>","expires_on":"2027-01-31"}]
  -- References only — never paste report contents or secrets here.
  security_docs      jsonb not null default '[]',
  dpa_status         text not null default 'unknown'
    check (dpa_status in ('unknown', 'not_required', 'pending', 'in_place')),
  contract_status    text not null default 'unknown'
    check (contract_status in ('unknown', 'none', 'standard_terms', 'negotiated')),
  transfer_note      text,               -- hosting/processing location + transfer mechanism
  status             text not null default 'proposed'
    check (status in ('proposed', 'approved', 'conditional', 'rejected', 'offboarded')),
  approved_by        text,
  approved_at        timestamptz,
  last_review_at     date,
  review_due_at      date,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists soc2_vendors_status_idx on public.soc2_vendors (status, review_due_at);

drop trigger if exists soc2_vendors_updated_at on public.soc2_vendors;
create trigger soc2_vendors_updated_at
  before update on public.soc2_vendors
  for each row execute function public.set_updated_at();

-- Late FKs now both sides exist.
do $$ begin
  alter table public.soc2_assets
    add constraint soc2_assets_vendor_fk
    foreign key (vendor_id) references public.soc2_vendors(id) on delete set null;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.soc2_scope_items
    add constraint soc2_scope_items_asset_fk
    foreign key (asset_id) references public.soc2_assets(id) on delete set null;
exception when duplicate_object then null; end $$;

-- ── Policy register ─────────────────────────────────────────
-- The policy row is the stable identity; versions carry the
-- text. Drafts are marked for human/legal review — the system
-- never approves a policy by itself.
create table if not exists public.soc2_policies (
  id                       uuid primary key default gen_random_uuid(),
  key                      text not null unique,   -- e.g. 'information_security'
  title                    text not null,
  owner_email              text,
  approver_email           text,
  status                   text not null default 'draft'
    check (status in ('draft', 'in_review', 'approved', 'retired')),
  current_version          int not null default 1,
  effective_date           date,
  review_due_at            date,
  requires_acknowledgement boolean not null default false,
  acknowledgement_audience text not null default 'all_staff'
    check (acknowledgement_audience in ('all_staff', 'engineering', 'admins', 'none')),
  legal_review_required    boolean not null default false,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

drop trigger if exists soc2_policies_updated_at on public.soc2_policies;
create trigger soc2_policies_updated_at
  before update on public.soc2_policies
  for each row execute function public.set_updated_at();

create table if not exists public.soc2_policy_versions (
  id           uuid primary key default gen_random_uuid(),
  policy_id    uuid not null references public.soc2_policies(id) on delete cascade,
  version      int not null,
  body_md      text not null,
  changelog    text,
  status       text not null default 'draft'
    check (status in ('draft', 'approved', 'superseded')),
  approved_by  text,
  approved_at  timestamptz,
  created_by   text,
  created_at   timestamptz not null default now(),
  unique (policy_id, version)
);

-- Approving a policy version needs a named approver — and the
-- approver may not be the person who wrote the draft, unless a
-- solo-operator compensating exception is recorded (app-level;
-- the DB enforces the named-approver minimum).
create or replace function public.enforce_policy_approval()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'approved' and (new.approved_by is null or new.approved_at is null) then
    raise exception using
      errcode = 'check_violation',
      message = 'A policy version cannot be approved without a named approver and time.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_soc2_policy_approval on public.soc2_policy_versions;
create trigger trg_soc2_policy_approval
  before insert or update on public.soc2_policy_versions
  for each row execute function public.enforce_policy_approval();

create table if not exists public.soc2_policy_acknowledgements (
  id                uuid primary key default gen_random_uuid(),
  policy_version_id uuid not null references public.soc2_policy_versions(id) on delete cascade,
  user_email        text not null,
  acknowledged_at   timestamptz not null default now(),
  unique (policy_version_id, user_email)
);

-- ── Risk register ───────────────────────────────────────────
create table if not exists public.soc2_risks (
  id                  uuid primary key default gen_random_uuid(),
  ref                 text not null unique,      -- RSK-2026-0001
  title               text not null,
  description         text,
  category            text not null default 'security' check (category in (
    'security', 'availability', 'processing_integrity', 'confidentiality',
    'privacy', 'commercial', 'operational'
  )),
  likelihood          int not null check (likelihood between 1 and 5),
  impact              int not null check (impact between 1 and 5),
  treatment           text not null default 'undecided'
    check (treatment in ('undecided', 'accept', 'mitigate', 'transfer', 'avoid')),
  treatment_plan      text,
  owner_email         text,
  linked_control_keys jsonb not null default '[]',
  residual_likelihood int check (residual_likelihood between 1 and 5),
  residual_impact     int check (residual_impact between 1 and 5),
  status              text not null default 'open'
    check (status in ('open', 'treated', 'accepted', 'closed')),
  accepted_by         text,               -- risk acceptance is a named decision
  accepted_at         timestamptz,
  review_due_at       date,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists soc2_risks_status_idx on public.soc2_risks (status, review_due_at);

drop trigger if exists soc2_risks_updated_at on public.soc2_risks;
create trigger soc2_risks_updated_at
  before update on public.soc2_risks
  for each row execute function public.set_updated_at();

create or replace function public.next_soc2_risk_ref()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  yr text := to_char(now(), 'YYYY');
  n integer;
begin
  select count(*) + 1 into n from soc2_risks where ref like 'RSK-' || yr || '-%';
  return 'RSK-' || yr || '-' || lpad(n::text, 4, '0');
end;
$$;
-- Supabase grants EXECUTE to anon/authenticated via default privileges at
-- creation, so revoking from PUBLIC alone is not enough (advisor lint 0028):
revoke execute on function public.next_soc2_risk_ref() from public, anon, authenticated;

-- Accepting a risk requires a named acceptor: risk acceptance is
-- a management decision, not a status change.
create or replace function public.enforce_risk_acceptance()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'accepted' and (new.accepted_by is null or new.accepted_at is null) then
    raise exception using
      errcode = 'check_violation',
      message = 'Accepting a risk requires a named acceptor and time.',
      hint = 'Risk acceptance sits with the Programme Owner.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_soc2_risk_acceptance on public.soc2_risks;
create trigger trg_soc2_risk_acceptance
  before insert or update on public.soc2_risks
  for each row execute function public.enforce_risk_acceptance();

-- ── Control library ─────────────────────────────────────────
-- Seeded from code (lib/soc2/library.ts) by an explicit, audited
-- action — installing the library is itself a recorded decision.
-- Every control is editable; "not applicable" needs a reason and
-- a named approver, because N/A is a scope claim an auditor will
-- test.
create table if not exists public.soc2_controls (
  id                    uuid primary key default gen_random_uuid(),
  key                   text not null unique,     -- e.g. 'IAM-02'
  tsc_category          text not null check (tsc_category in (
    'security', 'availability', 'processing_integrity', 'confidentiality', 'privacy'
  )),
  tsc_refs              jsonb not null default '[]',   -- e.g. ["CC6.1","CC6.2"]
  name                  text not null,
  objective             text not null,
  description           text,
  owner_email           text,
  frequency             text not null default 'quarterly' check (frequency in (
    'continuous', 'per_change', 'weekly', 'monthly', 'quarterly', 'semiannual', 'annual', 'event'
  )),
  test_procedure        text,
  evidence_requirements text,
  policy_key            text,             -- source policy (soc2_policies.key)
  automation            text not null default 'manual'
    check (automation in ('manual', 'automated', 'hybrid')),
  applicability         text not null default 'applicable'
    check (applicability in ('applicable', 'not_applicable')),
  na_reason             text,
  na_approved_by        text,
  status                text not null default 'active' check (status in ('active', 'retired')),
  next_due_at           date,             -- maintained by the scheduler
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists soc2_controls_category_idx on public.soc2_controls (tsc_category, status);
create index if not exists soc2_controls_due_idx on public.soc2_controls (next_due_at);

drop trigger if exists soc2_controls_updated_at on public.soc2_controls;
create trigger soc2_controls_updated_at
  before update on public.soc2_controls
  for each row execute function public.set_updated_at();

create or replace function public.enforce_control_na()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.applicability = 'not_applicable'
     and (new.na_reason is null or new.na_approved_by is null) then
    raise exception using
      errcode = 'check_violation',
      message = 'Marking a control not applicable needs a documented reason and a named approver.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_soc2_control_na on public.soc2_controls;
create trigger trg_soc2_control_na
  before insert or update on public.soc2_controls
  for each row execute function public.enforce_control_na();

-- ── Control runs (scheduled/manual performances) ────────────
create table if not exists public.soc2_control_runs (
  id            uuid primary key default gen_random_uuid(),
  control_id    uuid not null references public.soc2_controls(id) on delete cascade,
  -- Idempotency: the scheduler derives 'control_key:2026-09' style
  -- keys so a re-run can never double-create the same due run.
  fire_key      text unique,
  due_at        date not null,
  period_start  date,
  period_end    date,
  status        text not null default 'scheduled'
    check (status in ('scheduled', 'in_progress', 'complete', 'failed', 'skipped')),
  result        text check (result in ('pass', 'fail', 'partial')),
  performed_by  text,
  performed_at  timestamptz,
  summary       text,
  reviewer_email text,
  reviewed_at   timestamptz,
  review_result text check (review_result in ('accepted', 'returned')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists soc2_control_runs_control_idx on public.soc2_control_runs (control_id, due_at desc);
create index if not exists soc2_control_runs_due_idx on public.soc2_control_runs (status, due_at);

drop trigger if exists soc2_control_runs_updated_at on public.soc2_control_runs;
create trigger soc2_control_runs_updated_at
  before update on public.soc2_control_runs
  for each row execute function public.set_updated_at();

-- Completing a run requires a performer and a result; a FAILED
-- result is fine — honesty is the point — but it must say who
-- found it and what happened.
create or replace function public.enforce_control_run_completion()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'complete' then
    if new.performed_by is null or new.performed_at is null or new.result is null then
      raise exception using
        errcode = 'check_violation',
        message = 'A control run cannot be completed without performer, time and result.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_soc2_control_run_completion on public.soc2_control_runs;
create trigger trg_soc2_control_run_completion
  before insert or update on public.soc2_control_runs
  for each row execute function public.enforce_control_run_completion();

-- ── Evidence items ──────────────────────────────────────────
-- Text fields hold references and descriptions, never secrets.
-- Files live in the private 'soc2-evidence' bucket; downloads go
-- through short-lived signed URLs only.
create table if not exists public.soc2_evidence_items (
  id              uuid primary key default gen_random_uuid(),
  control_id      uuid references public.soc2_controls(id) on delete set null,
  control_run_id  uuid references public.soc2_control_runs(id) on delete set null,
  exception_id    uuid,                   -- FK added after soc2_exceptions below
  title           text not null,
  source          text not null default 'manual_upload' check (source in (
    'manual_upload', 'system_record', 'integration', 'acknowledgement',
    'access_review', 'deployment_record', 'repository_record', 'backup_report',
    'restore_test', 'vendor_review', 'incident_review', 'training', 'attestation'
  )),
  -- Immutable pointer into the source system where one exists,
  -- e.g. 'audit_log:<id>', 'agent_events:<id>', a PR URL.
  source_ref      text,
  capture_date    date not null default (now() at time zone 'utc')::date,
  period_start    date,
  period_end      date,
  collected_by    text,
  reviewer_email  text,
  reviewed_at     timestamptz,
  review_result   text check (review_result in ('accepted', 'returned')),
  review_note     text,
  classification  text not null default 'internal'
    check (classification in ('internal', 'confidential', 'restricted')),
  retention_until date,
  -- Uploaded file (optional): object path in the soc2-evidence
  -- bucket + integrity metadata recorded at upload time.
  file_path       text,
  file_bytes      bigint,
  file_mime       text,
  content_sha256  text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists soc2_evidence_control_idx on public.soc2_evidence_items (control_id, capture_date desc);
create index if not exists soc2_evidence_run_idx on public.soc2_evidence_items (control_run_id);

drop trigger if exists soc2_evidence_updated_at on public.soc2_evidence_items;
create trigger soc2_evidence_updated_at
  before update on public.soc2_evidence_items
  for each row execute function public.set_updated_at();

-- Once a reviewer has ACCEPTED evidence, its substance is frozen:
-- the file pointer, hash, source and period can no longer be
-- edited (review metadata can). Fixing bad evidence means adding
-- a new item, not rewriting the accepted one.
create or replace function public.enforce_evidence_immutability()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.review_result = 'accepted' and (
    new.file_path       is distinct from old.file_path or
    new.content_sha256  is distinct from old.content_sha256 or
    new.source          is distinct from old.source or
    new.source_ref      is distinct from old.source_ref or
    new.capture_date    is distinct from old.capture_date or
    new.period_start    is distinct from old.period_start or
    new.period_end      is distinct from old.period_end or
    new.title           is distinct from old.title
  ) then
    raise exception using
      errcode = 'check_violation',
      message = 'Accepted evidence is immutable. Add a superseding item instead of editing.',
      hint = 'Reviewed evidence is part of the historical trail.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_soc2_evidence_immutability on public.soc2_evidence_items;
create trigger trg_soc2_evidence_immutability
  before update on public.soc2_evidence_items
  for each row execute function public.enforce_evidence_immutability();

-- ── Exceptions ──────────────────────────────────────────────
-- An exception means "a configured control may not have been
-- performed, may have failed, or needs review" — never a
-- declaration of non-compliance.
create table if not exists public.soc2_exceptions (
  id                    uuid primary key default gen_random_uuid(),
  ref                   text not null unique,     -- EXC-2026-0001
  control_id            uuid references public.soc2_controls(id) on delete set null,
  rule_key              text,                     -- rules-engine rule that raised it (null = declared by a human)
  -- Idempotency for detected exceptions: rule + subject. While an
  -- exception for the same fire_key is open, the sweep updates it
  -- rather than raising a duplicate.
  fire_key              text,
  title                 text not null,
  detail                text,
  severity              text not null check (severity in ('critical', 'high', 'medium', 'low')),
  severity_rationale    text,
  status                text not null default 'detected' check (status in (
    'detected', 'triage_required', 'in_remediation', 'awaiting_evidence',
    'awaiting_risk_acceptance', 'resolved_pending_verification', 'closed', 'not_applicable'
  )),
  source                text not null default 'rule'
    check (source in ('rule', 'manual', 'integration', 'ai_workspace', 'incident')),
  trigger_ref           text,                     -- what tripped it: 'agent_events:<id>', 'soc2_control_runs:<id>'…
  detected_at           timestamptz not null default now(),
  -- Affected records, by reference — kept as ids so notification
  -- previews can stay terse and secret-free.
  affected              jsonb not null default '{}',  -- {assets:[],tenants:[],projects:[],vendors:[],users:[]}
  owner_email           text,
  due_at                date,
  recommended_action    text,
  compensating_control  text,
  triage_decision       text,
  triaged_by            text,
  triaged_at            timestamptz,
  remediation_plan      text,
  resolution_note       text,
  resolved_by           text,
  resolved_at           timestamptz,
  verified_by           text,
  verified_at           timestamptz,
  verification_note     text,
  na_reason             text,                     -- for false-positive / not-applicable closure
  risk_id               uuid references public.soc2_risks(id) on delete set null,
  incident_id           uuid,                     -- FK added after soc2_incidents below
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create unique index if not exists soc2_exceptions_fire_key_open_idx
  on public.soc2_exceptions (fire_key)
  where fire_key is not null and status not in ('closed', 'not_applicable');
create index if not exists soc2_exceptions_status_idx on public.soc2_exceptions (status, severity, due_at);
create index if not exists soc2_exceptions_control_idx on public.soc2_exceptions (control_id, status);

drop trigger if exists soc2_exceptions_updated_at on public.soc2_exceptions;
create trigger soc2_exceptions_updated_at
  before update on public.soc2_exceptions
  for each row execute function public.set_updated_at();

create or replace function public.next_soc2_exception_ref()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  yr text := to_char(now(), 'YYYY');
  n integer;
begin
  select count(*) + 1 into n from soc2_exceptions where ref like 'EXC-' || yr || '-%';
  return 'EXC-' || yr || '-' || lpad(n::text, 4, '0');
end;
$$;
-- Supabase grants EXECUTE to anon/authenticated via default privileges at
-- creation, so revoking from PUBLIC alone is not enough (advisor lint 0028):
revoke execute on function public.next_soc2_exception_ref() from public, anon, authenticated;

-- The exception lifecycle's two hard gates:
--   · closed        → needs resolution (who/what) AND independent
--                     verification by a DIFFERENT person. If the
--                     company is genuinely one person, the record
--                     stays at resolved_pending_verification —
--                     which is the honest state, not a bug.
--   · not_applicable→ needs a documented reason and a named triager.
create or replace function public.enforce_exception_closure()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'closed' then
    if new.resolution_note is null or new.resolved_by is null then
      raise exception using
        errcode = 'check_violation',
        message = 'An exception cannot close without the owner''s resolution details.',
        hint = 'Record what was done and by whom (resolution_note, resolved_by).';
    end if;
    if new.verified_by is null or new.verified_at is null then
      raise exception using
        errcode = 'check_violation',
        message = 'An exception cannot close without reviewer verification.',
        hint = 'A reviewer must verify the resolution (verified_by, verified_at).';
    end if;
    if new.verified_by = new.resolved_by then
      raise exception using
        errcode = 'check_violation',
        message = 'Verification must come from someone other than the resolver.',
        hint = 'Leave it at resolved_pending_verification until an independent reviewer confirms.';
    end if;
  end if;
  if new.status = 'not_applicable' and (new.na_reason is null or new.triaged_by is null) then
    raise exception using
      errcode = 'check_violation',
      message = 'False positive / not applicable needs a documented reason and a named triager.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_soc2_exception_closure on public.soc2_exceptions;
create trigger trg_soc2_exception_closure
  before insert or update on public.soc2_exceptions
  for each row execute function public.enforce_exception_closure();

do $$ begin
  alter table public.soc2_evidence_items
    add constraint soc2_evidence_exception_fk
    foreign key (exception_id) references public.soc2_exceptions(id) on delete set null;
exception when duplicate_object then null; end $$;

-- ── Security incidents ──────────────────────────────────────
create table if not exists public.soc2_incidents (
  id                     uuid primary key default gen_random_uuid(),
  ref                    text not null unique,    -- INC-2026-0001
  title                  text not null,
  classification         text not null default 'security' check (classification in (
    'security', 'availability', 'confidentiality', 'integrity', 'privacy_adjacent'
  )),
  severity               text not null check (severity in ('critical', 'high', 'medium', 'low')),
  status                 text not null default 'open'
    check (status in ('open', 'contained', 'recovering', 'resolved', 'closed')),
  detected_at            timestamptz not null default now(),
  reported_by            text,
  owner_email            text,
  acknowledged_at        timestamptz,
  impact_summary         text,
  containment_summary    text,
  -- The notification decision is recorded, never automated: legal
  -- and contractual notification conclusions need a person (and
  -- where flagged, specialist advice).
  notification_decision  text not null default 'undecided' check (notification_decision in (
    'undecided', 'not_required', 'specialist_advice_needed', 'clients_notified', 'regulator_and_clients_notified'
  )),
  notification_note      text,
  affected               jsonb not null default '{}',
  lessons_learned        text,
  post_review_due_at     date,
  post_review_done_at    timestamptz,
  post_review_by         text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index if not exists soc2_incidents_status_idx on public.soc2_incidents (status, severity);

drop trigger if exists soc2_incidents_updated_at on public.soc2_incidents;
create trigger soc2_incidents_updated_at
  before update on public.soc2_incidents
  for each row execute function public.set_updated_at();

create or replace function public.next_soc2_incident_ref()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  yr text := to_char(now(), 'YYYY');
  n integer;
begin
  select count(*) + 1 into n from soc2_incidents where ref like 'INC-' || yr || '-%';
  return 'INC-' || yr || '-' || lpad(n::text, 4, '0');
end;
$$;
-- Supabase grants EXECUTE to anon/authenticated via default privileges at
-- creation, so revoking from PUBLIC alone is not enough (advisor lint 0028):
revoke execute on function public.next_soc2_incident_ref() from public, anon, authenticated;

-- Append-only incident timeline (detection → assessment →
-- containment → investigation → recovery → communication).
create table if not exists public.soc2_incident_events (
  id          uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.soc2_incidents(id) on delete cascade,
  at          timestamptz not null default now(),
  phase       text not null check (phase in (
    'detection', 'assessment', 'containment', 'investigation',
    'recovery', 'communication', 'review', 'note'
  )),
  entry       text not null,
  actor       text,
  created_at  timestamptz not null default now()
);
create index if not exists soc2_incident_events_idx on public.soc2_incident_events (incident_id, at);

do $$ begin
  alter table public.soc2_exceptions
    add constraint soc2_exceptions_incident_fk
    foreign key (incident_id) references public.soc2_incidents(id) on delete set null;
exception when duplicate_object then null; end $$;

-- ── Access reviews ──────────────────────────────────────────
create table if not exists public.soc2_access_reviews (
  id            uuid primary key default gen_random_uuid(),
  ref           text not null unique,      -- ACR-2026-0001
  title         text not null,
  scope_note    text,                      -- which providers/systems this review covers
  status        text not null default 'open'
    check (status in ('open', 'in_progress', 'complete')),
  due_at        date not null,
  started_by    text,
  reviewer_email text,
  completed_at  timestamptz,
  summary       text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists soc2_access_reviews_updated_at on public.soc2_access_reviews;
create trigger soc2_access_reviews_updated_at
  before update on public.soc2_access_reviews
  for each row execute function public.set_updated_at();

create or replace function public.next_soc2_access_review_ref()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  yr text := to_char(now(), 'YYYY');
  n integer;
begin
  select count(*) + 1 into n from soc2_access_reviews where ref like 'ACR-' || yr || '-%';
  return 'ACR-' || yr || '-' || lpad(n::text, 4, '0');
end;
$$;
-- Supabase grants EXECUTE to anon/authenticated via default privileges at
-- creation, so revoking from PUBLIC alone is not enough (advisor lint 0028):
revoke execute on function public.next_soc2_access_review_ref() from public, anon, authenticated;

create table if not exists public.soc2_access_review_items (
  id                  uuid primary key default gen_random_uuid(),
  review_id           uuid not null references public.soc2_access_reviews(id) on delete cascade,
  asset_id            uuid references public.soc2_assets(id) on delete set null,
  system_label        text not null,       -- e.g. 'Supabase (prod)', 'GitHub org'
  account_identifier  text not null,       -- the account/email under review
  person              text,                -- who it belongs to (null = unknown/service)
  privilege           text not null default 'standard'
    check (privilege in ('standard', 'privileged', 'admin', 'service', 'break_glass')),
  -- Shared credentials are prohibited outside documented break-glass; marking
  -- one here is a declaration the rules engine turns into an exception unless
  -- an approved exception already covers it.
  is_shared           boolean not null default false,
  mfa_status          text not null default 'unknown'
    check (mfa_status in ('enabled', 'disabled', 'unknown', 'not_supported')),
  decision            text not null default 'pending'
    check (decision in ('pending', 'retain', 'modify', 'revoke', 'investigate')),
  decision_note       text,
  decided_by          text,
  decided_at          timestamptz,
  action_completed_at timestamptz,         -- when the modify/revoke was actually done
  created_at          timestamptz not null default now()
);
create index if not exists soc2_access_review_items_idx on public.soc2_access_review_items (review_id, decision);

-- An access review cannot be silently marked complete: every item
-- needs a decision, and every revoke/modify needs its completion
-- recorded. Overdue-and-open is the rules engine's job to flag.
create or replace function public.enforce_access_review_completion()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  undecided integer;
  unactioned integer;
begin
  if new.status = 'complete' then
    select count(*) into undecided
      from soc2_access_review_items
      where review_id = new.id and decision = 'pending';
    if undecided > 0 then
      raise exception using
        errcode = 'check_violation',
        message = format('This access review still has %s undecided account(s).', undecided),
        hint = 'Every account needs a retain/modify/revoke/investigate decision before completion.';
    end if;
    select count(*) into unactioned
      from soc2_access_review_items
      where review_id = new.id
        and decision in ('modify', 'revoke')
        and action_completed_at is null;
    if unactioned > 0 then
      raise exception using
        errcode = 'check_violation',
        message = format('%s modify/revoke decision(s) have not been actioned yet.', unactioned),
        hint = 'Record when each access change was actually completed.';
    end if;
    if new.reviewer_email is null or new.completed_at is null then
      raise exception using
        errcode = 'check_violation',
        message = 'Completion needs a named reviewer and completion time.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_soc2_access_review_completion on public.soc2_access_reviews;
create trigger trg_soc2_access_review_completion
  before update on public.soc2_access_reviews
  for each row execute function public.enforce_access_review_completion();

-- Joiner/mover/leaver + break-glass access changes, as records.
create table if not exists public.soc2_access_changes (
  id           uuid primary key default gen_random_uuid(),
  person       text not null,
  asset_id     uuid references public.soc2_assets(id) on delete set null,
  system_label text not null,
  change       text not null check (change in (
    'granted', 'modified', 'revoked', 'break_glass_used'
  )),
  privilege    text,
  reason       text,
  approved_by  text,
  occurred_at  timestamptz not null default now(),
  source       text not null default 'manual'
    check (source in ('manual', 'onboarding', 'offboarding', 'access_review', 'break_glass')),
  created_at   timestamptz not null default now()
);
create index if not exists soc2_access_changes_idx on public.soc2_access_changes (person, occurred_at desc);

-- Break-glass: emergency privileged access with explicit
-- approval, a short expiry and a mandatory post-use review. The
-- platform cannot technically fence provider consoles, so this is
-- the record + review control; the rules engine flags any event
-- that is unreviewed or ran past its expiry.
create table if not exists public.soc2_break_glass_events (
  id            uuid primary key default gen_random_uuid(),
  system_label  text not null,
  asset_id      uuid references public.soc2_assets(id) on delete set null,
  used_by       text not null,
  approved_by   text not null,
  reason        text not null,
  started_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  ended_at      timestamptz,
  review_due_at date not null,
  reviewed_by   text,
  reviewed_at   timestamptz,
  review_note   text,
  created_at    timestamptz not null default now()
);

-- Break-glass must actually be short: cap the window at 24 hours.
create or replace function public.enforce_break_glass_window()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.expires_at > new.started_at + interval '24 hours' then
    raise exception using
      errcode = 'check_violation',
      message = 'Break-glass access must expire within 24 hours.',
      hint = 'Grant again (with approval) if more time is genuinely needed.';
  end if;
  if new.approved_by = new.used_by then
    raise exception using
      errcode = 'check_violation',
      message = 'Break-glass access cannot be self-approved.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_soc2_break_glass_window on public.soc2_break_glass_events;
create trigger trg_soc2_break_glass_window
  before insert or update on public.soc2_break_glass_events
  for each row execute function public.enforce_break_glass_window();

-- ── Change & release records ────────────────────────────────
-- Production changes with their review/test/approval/rollback
-- trail. Self-approved changes are visible as such — for a small
-- team they are a fact to manage with a compensating control, not
-- a fact to hide.
create table if not exists public.soc2_change_records (
  id             uuid primary key default gen_random_uuid(),
  ref            text not null unique,     -- CHG-2026-0001
  title          text not null,
  asset_id       uuid references public.soc2_assets(id) on delete set null,
  project_id     uuid references public.projects(id) on delete set null,
  change_ref     text,                     -- PR URL / fix_batches:<id> / commit range
  ticket_ref     text,                     -- issues:<id> / order_forms:<id> / change_orders:<id>
  requested_by   text,
  reviewed_by    text,
  approved_by    text,
  test_evidence  text,                     -- what was run and its outcome (reference, not log dumps)
  rollback_plan  text,
  deployed_at    timestamptz,
  deploy_ref     text,                     -- Vercel deployment / release tag
  status         text not null default 'draft'
    check (status in ('draft', 'approved', 'deployed', 'rolled_back')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists soc2_change_records_idx on public.soc2_change_records (status, deployed_at desc);

drop trigger if exists soc2_change_records_updated_at on public.soc2_change_records;
create trigger soc2_change_records_updated_at
  before update on public.soc2_change_records
  for each row execute function public.set_updated_at();

create or replace function public.next_soc2_change_ref()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  yr text := to_char(now(), 'YYYY');
  n integer;
begin
  select count(*) + 1 into n from soc2_change_records where ref like 'CHG-' || yr || '-%';
  return 'CHG-' || yr || '-' || lpad(n::text, 4, '0');
end;
$$;
-- Supabase grants EXECUTE to anon/authenticated via default privileges at
-- creation, so revoking from PUBLIC alone is not enough (advisor lint 0028):
revoke execute on function public.next_soc2_change_ref() from public, anon, authenticated;

-- ── Management reviews ──────────────────────────────────────
-- The periodic management look at readiness, risks, incidents and
-- open exceptions — with its decisions, so the dashboard can show
-- "most recent management review and what was decided".
create table if not exists public.soc2_management_reviews (
  id          uuid primary key default gen_random_uuid(),
  held_at     date not null,
  attendees   text not null,
  summary     text,
  decisions   jsonb not null default '[]',   -- [{"decision":"...","owner":"...","due":"..."}]
  next_due_at date,
  recorded_by text,
  created_at  timestamptz not null default now()
);

-- ── Review periods & audit packs ────────────────────────────
create table if not exists public.soc2_review_periods (
  id        uuid primary key default gen_random_uuid(),
  label     text not null unique,        -- e.g. 'Readiness Q4 2026'
  kind      text not null default 'readiness'
    check (kind in ('readiness', 'type1_prep', 'type2_period')),
  starts_on date not null,
  ends_on   date not null,
  status    text not null default 'open' check (status in ('open', 'closed')),
  notes     text,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

-- Generated auditor packs: what was exported, by whom, over which
-- period and scope. The pack content itself is written to the
-- private soc2-evidence bucket; this row is the controlled index
-- entry (and the thing the audit trail points at).
create table if not exists public.soc2_audit_packs (
  id               uuid primary key default gen_random_uuid(),
  review_period_id uuid not null references public.soc2_review_periods(id) on delete restrict,
  scope_id         uuid not null references public.soc2_scopes(id) on delete restrict,
  generated_by     text not null,
  generated_at     timestamptz not null default now(),
  sections         jsonb not null default '[]',  -- which sections were included
  file_path        text,                          -- object in soc2-evidence bucket
  content_sha256   text,
  recipient_note   text,                          -- who this pack is being prepared for
  created_at       timestamptz not null default now()
);

-- ── Domain trail (append-only) ──────────────────────────────
-- Every material SOC 2 action writes here AND to the global
-- audit_log. This one is queryable per record ("the complete
-- historical trail of control operation, review, exception,
-- remediation and approval") without trawling the global log.
-- Append-only is enforced by policy shape: insert + select only.
create table if not exists public.soc2_events (
  id          uuid primary key default gen_random_uuid(),
  record_type text not null,               -- 'control' | 'control_run' | 'exception' | ...
  record_id   uuid not null,
  type        text not null,               -- 'created' | 'status.changed' | 'approved' | ...
  summary     text not null,               -- plain-English, secret-free
  detail      jsonb not null default '{}', -- before/after state where appropriate
  actor       text,                        -- email of the human (or 'system:sweep')
  actor_id    uuid default auth.uid(),
  created_at  timestamptz not null default now()
);
create index if not exists soc2_events_record_idx on public.soc2_events (record_type, record_id, created_at desc);
create index if not exists soc2_events_created_idx on public.soc2_events (created_at desc);

-- ── Evidence bucket ─────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('soc2-evidence', 'soc2-evidence', false)
on conflict (id) do nothing;

-- Staff-only object access; the app additionally checks programme
-- roles server-side and only ever hands out short-lived signed
-- URLs for downloads.
drop policy if exists soc2_evidence_select on storage.objects;
create policy soc2_evidence_select on storage.objects for select to authenticated
  using (bucket_id = 'soc2-evidence' and is_internal_staff());

-- No insert/update/delete policies for authenticated: uploads and
-- retention deletion run through the service role after the app's
-- guard; evidence objects are replaced by new uploads, never
-- edited in place.
drop policy if exists soc2_evidence_insert on storage.objects;

-- ── RLS ─────────────────────────────────────────────────────
-- Internal security records: staff may READ; writes happen only
-- through the application's service role after its programme-role
-- guard (requireSoc2 + WRITE_ROLES). Keeping the authenticated
-- role select-only means a person whose only in-app standing is a
-- read-only auditor login cannot write these tables even with raw
-- REST access — the app layer's read-only promise holds at the
-- data layer too. The two deliberate user-session write paths are
-- soc2_events inserts (the actor-stamped trail) and nothing else.
-- Client portal users must never see any of this — there is
-- deliberately no is_member_of() path on any soc2_* table.
alter table public.soc2_programme_roles       enable row level security;
alter table public.soc2_scopes                enable row level security;
alter table public.soc2_scope_items           enable row level security;
alter table public.soc2_assets                enable row level security;
alter table public.soc2_vendors               enable row level security;
alter table public.soc2_policies              enable row level security;
alter table public.soc2_policy_versions       enable row level security;
alter table public.soc2_policy_acknowledgements enable row level security;
alter table public.soc2_risks                 enable row level security;
alter table public.soc2_controls              enable row level security;
alter table public.soc2_control_runs          enable row level security;
alter table public.soc2_evidence_items        enable row level security;
alter table public.soc2_exceptions            enable row level security;
alter table public.soc2_incidents             enable row level security;
alter table public.soc2_incident_events       enable row level security;
alter table public.soc2_access_reviews        enable row level security;
alter table public.soc2_access_review_items   enable row level security;
alter table public.soc2_access_changes        enable row level security;
alter table public.soc2_break_glass_events    enable row level security;
alter table public.soc2_change_records        enable row level security;
alter table public.soc2_management_reviews    enable row level security;
alter table public.soc2_review_periods        enable row level security;
alter table public.soc2_audit_packs           enable row level security;
alter table public.soc2_events                enable row level security;

drop policy if exists soc2_programme_roles_staff on public.soc2_programme_roles;
drop policy if exists soc2_programme_roles_select on public.soc2_programme_roles;
create policy soc2_programme_roles_select on public.soc2_programme_roles
  for select to authenticated using (is_internal_staff());

drop policy if exists soc2_scopes_staff on public.soc2_scopes;
drop policy if exists soc2_scopes_select on public.soc2_scopes;
create policy soc2_scopes_select on public.soc2_scopes
  for select to authenticated using (is_internal_staff());

drop policy if exists soc2_scope_items_staff on public.soc2_scope_items;
drop policy if exists soc2_scope_items_select on public.soc2_scope_items;
create policy soc2_scope_items_select on public.soc2_scope_items
  for select to authenticated using (is_internal_staff());

drop policy if exists soc2_assets_staff on public.soc2_assets;
drop policy if exists soc2_assets_select on public.soc2_assets;
create policy soc2_assets_select on public.soc2_assets
  for select to authenticated using (is_internal_staff());

drop policy if exists soc2_vendors_staff on public.soc2_vendors;
drop policy if exists soc2_vendors_select on public.soc2_vendors;
create policy soc2_vendors_select on public.soc2_vendors
  for select to authenticated using (is_internal_staff());

drop policy if exists soc2_policies_staff on public.soc2_policies;
drop policy if exists soc2_policies_select on public.soc2_policies;
create policy soc2_policies_select on public.soc2_policies
  for select to authenticated using (is_internal_staff());

drop policy if exists soc2_policy_versions_staff on public.soc2_policy_versions;
drop policy if exists soc2_policy_versions_select on public.soc2_policy_versions;
create policy soc2_policy_versions_select on public.soc2_policy_versions
  for select to authenticated using (is_internal_staff());

drop policy if exists soc2_policy_acknowledgements_staff on public.soc2_policy_acknowledgements;
drop policy if exists soc2_policy_acknowledgements_select on public.soc2_policy_acknowledgements;
create policy soc2_policy_acknowledgements_select on public.soc2_policy_acknowledgements
  for select to authenticated using (is_internal_staff());

drop policy if exists soc2_risks_staff on public.soc2_risks;
drop policy if exists soc2_risks_select on public.soc2_risks;
create policy soc2_risks_select on public.soc2_risks
  for select to authenticated using (is_internal_staff());

drop policy if exists soc2_controls_staff on public.soc2_controls;
drop policy if exists soc2_controls_select on public.soc2_controls;
create policy soc2_controls_select on public.soc2_controls
  for select to authenticated using (is_internal_staff());

drop policy if exists soc2_control_runs_staff on public.soc2_control_runs;
drop policy if exists soc2_control_runs_select on public.soc2_control_runs;
create policy soc2_control_runs_select on public.soc2_control_runs
  for select to authenticated using (is_internal_staff());

drop policy if exists soc2_evidence_items_staff on public.soc2_evidence_items;
drop policy if exists soc2_evidence_items_select on public.soc2_evidence_items;
create policy soc2_evidence_items_select on public.soc2_evidence_items
  for select to authenticated using (is_internal_staff());

drop policy if exists soc2_exceptions_staff on public.soc2_exceptions;
drop policy if exists soc2_exceptions_select on public.soc2_exceptions;
create policy soc2_exceptions_select on public.soc2_exceptions
  for select to authenticated using (is_internal_staff());

drop policy if exists soc2_incidents_staff on public.soc2_incidents;
drop policy if exists soc2_incidents_select on public.soc2_incidents;
create policy soc2_incidents_select on public.soc2_incidents
  for select to authenticated using (is_internal_staff());

-- Incident timeline: staff read; the app writes entries through
-- the service role. (Service role bypasses RLS by design; that is
-- the platform trust boundary, same as audit_log.)
drop policy if exists soc2_incident_events_insert on public.soc2_incident_events;
drop policy if exists soc2_incident_events_select on public.soc2_incident_events;
create policy soc2_incident_events_select on public.soc2_incident_events
  for select to authenticated using (is_internal_staff());

drop policy if exists soc2_access_reviews_staff on public.soc2_access_reviews;
drop policy if exists soc2_access_reviews_select on public.soc2_access_reviews;
create policy soc2_access_reviews_select on public.soc2_access_reviews
  for select to authenticated using (is_internal_staff());

drop policy if exists soc2_access_review_items_staff on public.soc2_access_review_items;
drop policy if exists soc2_access_review_items_select on public.soc2_access_review_items;
create policy soc2_access_review_items_select on public.soc2_access_review_items
  for select to authenticated using (is_internal_staff());

drop policy if exists soc2_access_changes_staff on public.soc2_access_changes;
drop policy if exists soc2_access_changes_select on public.soc2_access_changes;
create policy soc2_access_changes_select on public.soc2_access_changes
  for select to authenticated using (is_internal_staff());

drop policy if exists soc2_break_glass_events_staff on public.soc2_break_glass_events;
drop policy if exists soc2_break_glass_events_select on public.soc2_break_glass_events;
create policy soc2_break_glass_events_select on public.soc2_break_glass_events
  for select to authenticated using (is_internal_staff());

drop policy if exists soc2_change_records_staff on public.soc2_change_records;
drop policy if exists soc2_change_records_select on public.soc2_change_records;
create policy soc2_change_records_select on public.soc2_change_records
  for select to authenticated using (is_internal_staff());

drop policy if exists soc2_management_reviews_staff on public.soc2_management_reviews;
drop policy if exists soc2_management_reviews_select on public.soc2_management_reviews;
create policy soc2_management_reviews_select on public.soc2_management_reviews
  for select to authenticated using (is_internal_staff());

drop policy if exists soc2_review_periods_staff on public.soc2_review_periods;
drop policy if exists soc2_review_periods_select on public.soc2_review_periods;
create policy soc2_review_periods_select on public.soc2_review_periods
  for select to authenticated using (is_internal_staff());

drop policy if exists soc2_audit_packs_staff on public.soc2_audit_packs;
drop policy if exists soc2_audit_packs_select on public.soc2_audit_packs;
create policy soc2_audit_packs_select on public.soc2_audit_packs
  for select to authenticated using (is_internal_staff());

drop policy if exists soc2_events_insert on public.soc2_events;
create policy soc2_events_insert on public.soc2_events
  for insert to authenticated with check (is_internal_staff());
drop policy if exists soc2_events_select on public.soc2_events;
create policy soc2_events_select on public.soc2_events
  for select to authenticated using (is_internal_staff());
