-- 0014_operations_core.sql
-- Operations rebuild: the four retainer tiers, the issue bank (WhatsApp replacement),
-- fix batches (Claude Code work orders), system passports (fleet registry / team handoff),
-- the template bank, and the build-credit allowance ledger.
-- Apply AFTER 0013. Paste into the Supabase SQL editor or apply via MCP.

-- ============================================================
-- 1) RETAINER PLANS — subscriptions.plan enum -> text + check
--    New ladder (single source of truth in apps/web/lib/retainerPlans.ts):
--      hosting     £40/mo  — hosting + paid Supabase
--      hosting_api £80/mo  — + API usage (Resend, OpenAI)
--      build_3     £120/mo — + 3 build items per month
--      build_10    £180/mo — + 10 build items per month
-- ============================================================

alter table public.subscriptions
  alter column plan type text using plan::text;

update public.subscriptions set plan = case plan
  when 'care_basic'  then 'hosting'
  when 'care_pro'    then 'build_3'
  when 'transaction' then 'hosting'
  else plan end;

alter table public.subscriptions
  add constraint subscriptions_plan_check
  check (plan in ('hosting','hosting_api','build_3','build_10'));

drop type if exists public.subscription_plan;

-- ============================================================
-- 2) TEMPLATE BANK — proven system skeletons to stamp new clients from
-- ============================================================

create table public.system_templates (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  slug               text unique,
  description        text,
  features           jsonb not null default '[]',
  stack              jsonb not null default '{}',
  repo_template      text,
  origin_project_id  uuid references public.projects(id) on delete set null,
  status             text not null default 'ready' check (status in ('draft','ready','retired')),
  times_used         int not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table public.system_templates enable row level security;
create policy system_templates_staff_all on public.system_templates
  for all to authenticated
  using (public.is_internal_staff()) with check (public.is_internal_staff());

create trigger trg_system_templates_updated
  before update on public.system_templates
  for each row execute function public.set_updated_at();

-- ============================================================
-- 3) SYSTEM PASSPORTS — one per project: everything a teammate
--    (human or Claude session) needs to pick the system up cold
-- ============================================================

create table public.system_profiles (
  project_id       uuid primary key references public.projects(id) on delete cascade,
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  template_id      uuid references public.system_templates(id) on delete set null,
  repo_full_name   text,
  default_branch   text not null default 'main',
  vercel_project   text,
  supabase_ref     text,
  stack            jsonb not null default '{}',
  env_checklist    jsonb not null default '[]',
  features         jsonb not null default '[]',
  runbook          text,
  quirks           text,
  health           text not null default 'unknown' check (health in ('ok','warning','down','unknown')),
  last_deploy_sha  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index system_profiles_tenant_idx on public.system_profiles (tenant_id);

alter table public.system_profiles enable row level security;
-- Contains repo/env/infra detail: staff only. Clients see curated views elsewhere.
create policy system_profiles_staff_all on public.system_profiles
  for all to authenticated
  using (public.is_internal_staff()) with check (public.is_internal_staff());

create trigger trg_system_profiles_updated
  before update on public.system_profiles
  for each row execute function public.set_updated_at();

-- ============================================================
-- 4) FIX BATCHES — compiled Claude Code work orders
-- ============================================================

create type public.batch_status as enum
  ('draft','compiled','dispatched','pr_open','shipped','cancelled');

create table public.fix_batches (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  project_id        uuid references public.projects(id) on delete set null,
  title             text not null,
  status            public.batch_status not null default 'draft',
  prompt            text,
  github_issue_url  text,
  pr_url            text,
  dispatched_at     timestamptz,
  shipped_at        timestamptz,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index fix_batches_tenant_idx on public.fix_batches (tenant_id);
create index fix_batches_status_idx on public.fix_batches (status);

alter table public.fix_batches enable row level security;
create policy fix_batches_staff_all on public.fix_batches
  for all to authenticated
  using (public.is_internal_staff()) with check (public.is_internal_staff());

create trigger trg_fix_batches_updated
  before update on public.fix_batches
  for each row execute function public.set_updated_at();

-- ============================================================
-- 5) ISSUE BANK — every bug/change/question, from any channel
-- ============================================================

create type public.issue_kind     as enum ('bug','change','question','task');
create type public.issue_severity as enum ('critical','high','normal','low');
create type public.issue_status   as enum
  ('new','triaged','queued','batched','in_progress','awaiting_client','fixed','shipped','closed');
create type public.issue_billing  as enum ('unclassified','covered','build_item','out_of_scope');
create type public.issue_source   as enum ('portal','whatsapp','email','zoom','phone','internal','monitor');

create table public.issues (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  project_id      uuid references public.projects(id) on delete set null,
  batch_id        uuid references public.fix_batches(id) on delete set null,
  submitted_by    uuid references auth.users(id) on delete set null,
  source          public.issue_source not null default 'internal',
  kind            public.issue_kind not null default 'bug',
  severity        public.issue_severity not null default 'normal',
  billing         public.issue_billing not null default 'unclassified',
  status          public.issue_status not null default 'new',
  title           text not null,
  description     text,
  repro           text,
  source_quote    text,
  image_urls      text[] not null default '{}',
  client_visible  boolean not null default true,
  quoted_price    numeric(10,2),
  build_items     numeric(4,1),
  due_at          timestamptz,
  promised_at     timestamptz,
  promised_note   text,
  ai              jsonb,
  resolution_note text,
  resolved_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index issues_tenant_idx  on public.issues (tenant_id);
create index issues_status_idx  on public.issues (status);
create index issues_batch_idx   on public.issues (batch_id);
create index issues_project_idx on public.issues (project_id);

alter table public.issues enable row level security;

-- Clients see their own visible issues; staff see everything.
create policy issues_select on public.issues
  for select to authenticated
  using (public.is_internal_staff() or (client_visible and public.is_member_of(tenant_id)));

-- Clients may open an issue, but never pre-set triage/billing/pricing fields.
create policy issues_insert_client on public.issues
  for insert to authenticated
  with check (
    public.is_member_of(tenant_id)
    and submitted_by = auth.uid()
    and status = 'new'
    and billing = 'unclassified'
    and quoted_price is null
    and build_items is null
    and batch_id is null
    and client_visible
  );

create policy issues_write_staff on public.issues
  for all to authenticated
  using (public.is_internal_staff()) with check (public.is_internal_staff());

create trigger trg_issues_updated
  before update on public.issues
  for each row execute function public.set_updated_at();

-- ============================================================
-- 6) BUILD-CREDIT LEDGER — allowance consumption/top-ups by month
--    Meter = plan allowance + sum(delta) for the period.
-- ============================================================

create table public.build_credit_events (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  issue_id   uuid references public.issues(id) on delete set null,
  period     date not null,
  delta      numeric(4,1) not null,
  reason     text not null,
  created_at timestamptz not null default now()
);

create index build_credit_events_tenant_period_idx
  on public.build_credit_events (tenant_id, period);

alter table public.build_credit_events enable row level security;

-- Clients can see their own meter; only staff write it.
create policy build_credit_events_select on public.build_credit_events
  for select to authenticated
  using (public.is_member_of(tenant_id) or public.is_internal_staff());

create policy build_credit_events_write_staff on public.build_credit_events
  for all to authenticated
  using (public.is_internal_staff()) with check (public.is_internal_staff());

-- ============================================================
-- 7) ISSUE ATTACHMENTS — private bucket, tenant-scoped by folder
--    Path convention: <tenant_id>/<uuid>-<safeName>
-- ============================================================

insert into storage.buckets (id, name, public)
values ('issue-attachments', 'issue-attachments', false)
on conflict (id) do nothing;

create policy issue_attachments_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'issue-attachments'
    and (public.is_internal_staff()
         or public.is_member_of(((storage.foldername(name))[1])::uuid))
  );

create policy issue_attachments_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'issue-attachments'
    and (public.is_internal_staff()
         or public.is_member_of(((storage.foldername(name))[1])::uuid))
  );

create policy issue_attachments_delete_staff on storage.objects
  for delete to authenticated
  using (bucket_id = 'issue-attachments' and public.is_internal_staff());

-- ============================================================
-- 8) LEGACY POLICY HARDENING — the loop-generated "auth all <table>"
--    policies let ANY signed-in portal client read/write every
--    enquiry, client and proposal row. Replace with staff-only.
--    (Anon enquiry INSERT for the public contact form is preserved.)
-- ============================================================

drop policy if exists "auth all enquiries" on public.enquiries;
drop policy if exists "auth all clients" on public.clients;
drop policy if exists "auth all proposals" on public.proposals;
drop policy if exists "auth all brand_guidelines" on public.brand_guidelines;

create policy enquiries_staff_all on public.enquiries
  for all to authenticated
  using (public.is_internal_staff()) with check (public.is_internal_staff());
create policy clients_staff_all on public.clients
  for all to authenticated
  using (public.is_internal_staff()) with check (public.is_internal_staff());
create policy proposals_staff_all on public.proposals
  for all to authenticated
  using (public.is_internal_staff()) with check (public.is_internal_staff());
create policy brand_guidelines_staff_all on public.brand_guidelines
  for all to authenticated
  using (public.is_internal_staff()) with check (public.is_internal_staff());
