-- ============================================================================
-- Phase 1 — Multi-tenant core
-- ----------------------------------------------------------------------------
-- One Supabase project serves ALL tenants. Isolation is enforced by RLS on a
-- tenant_id column carried by every client-data table — never by per-client
-- projects. Internal Nullshift staff get explicit cross-tenant read; clients see
-- only their own tenant. Default-deny: RLS is enabled with no blanket policy.
--
-- These tables live ALONGSIDE the legacy single-tenant tables
-- (enquiries/clients/proposals/...), which keep the deployed apps working until
-- they are migrated onto this schema in Phases 2–3.
-- ============================================================================

-- === Enums ===================================================================
create type tenant_type as enum ('internal', 'client');
create type membership_role as enum ('owner', 'staff', 'client_admin', 'client_member');
create type lead_status as enum ('new', 'qualified', 'call_booked', 'won', 'lost');
create type project_stage as enum ('discovery', 'build', 'review', 'live', 'care');
create type task_status as enum ('backlog', 'scoped', 'approved', 'in_progress', 'review', 'shipped');
create type task_origin as enum ('internal', 'client');
create type change_request_status as enum (
  'submitted', 'triaged', 'scoped', 'awaiting_approval', 'approved', 'rejected', 'shipped'
);
create type document_kind as enum ('asset', 'contract', 'dpa', 'consent', 'brief');
create type invoice_type as enum ('build_milestone', 'one_off');
create type invoice_status as enum ('draft', 'open', 'paid', 'void', 'uncollectible');
create type subscription_plan as enum ('care_basic', 'care_pro', 'transaction');
create type subscription_status as enum (
  'trialing', 'active', 'past_due', 'canceled', 'incomplete'
);
create type compliance_kind as enum ('dpa_signed', 'data_register', 'breach', 'sar', 'backup_check');

-- === updated_at trigger helper ==============================================
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- === Tables ==================================================================

-- Tenants. Nullshift itself is one tenant of type 'internal'.
create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type tenant_type not null default 'client',
  status text not null default 'active',
  vertical text,                       -- clinic | trades | wellness | other (clinic-first, not clinic-only)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Profiles mirror auth.users (1:1). id == auth.users.id.
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Memberships drive every RLS policy: a user sees a tenant's rows only via a row here.
create table memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tenant_id uuid not null references tenants (id) on delete cascade,
  role membership_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, tenant_id)
);
create index memberships_user_idx on memberships (user_id);
create index memberships_tenant_idx on memberships (tenant_id);

-- Leads belong to the internal Nullshift tenant (it's Nullshift's pipeline).
create table leads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  name text,
  email text,
  source text,
  vertical text,                       -- business type captured by the funnel (clinic-first, not clinic-only)
  status lead_status not null default 'new',
  notes text,
  quiz_answers jsonb,                  -- incl. current software spend + biggest admin pain
  lead_score int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index leads_tenant_idx on leads (tenant_id);
create index leads_status_idx on leads (tenant_id, status);

-- Projects are per client tenant.
create table projects (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  name text not null,
  stage project_stage not null default 'discovery',
  build_fee numeric(10, 2),
  started_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_tenant_idx on projects (tenant_id);

-- Tasks (internal delivery). tenant_id denormalized for simple RLS.
create table tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  project_id uuid not null references projects (id) on delete cascade,
  title text not null,
  detail text,
  status task_status not null default 'backlog',
  assignee uuid references auth.users (id) on delete set null,
  estimate_hours numeric(6, 2),
  origin task_origin not null default 'internal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_project_idx on tasks (project_id);
create index tasks_tenant_idx on tasks (tenant_id);

-- Change requests: the formal client channel. Scoped + approved before work starts.
create table change_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  project_id uuid not null references projects (id) on delete cascade,
  submitted_by uuid references auth.users (id) on delete set null,
  description text not null,
  status change_request_status not null default 'submitted',
  estimate_hours numeric(6, 2),
  quoted_price numeric(10, 2),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index change_requests_project_idx on change_requests (project_id);
create index change_requests_tenant_idx on change_requests (tenant_id);

-- Documents: version-controlled index over Supabase Storage objects.
create table documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  project_id uuid references projects (id) on delete set null,
  kind document_kind not null,
  storage_path text not null,
  version int not null default 1,
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index documents_tenant_idx on documents (tenant_id);
create index documents_project_idx on documents (project_id);

-- Invoices (Nullshift's build/one-off revenue per client tenant).
create table invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  project_id uuid references projects (id) on delete set null,
  type invoice_type not null,
  amount numeric(10, 2) not null,
  status invoice_status not null default 'draft',
  stripe_invoice_id text,
  due_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index invoices_tenant_idx on invoices (tenant_id);

-- Subscriptions (recurring MRR per client tenant — the £8k moat).
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  plan subscription_plan not null,
  mrr numeric(10, 2) not null default 0,
  stripe_subscription_id text,
  status subscription_status not null default 'active',
  started_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subscriptions_tenant_idx on subscriptions (tenant_id);

-- Compliance records per tenant (DPA, data register, breach, SAR, backup checks).
create table compliance_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  kind compliance_kind not null,
  detail jsonb,
  recorded_at timestamptz not null default now()
);
create index compliance_tenant_idx on compliance_records (tenant_id);

-- Audit log — append-only. Every client-data write + admin action lands here.
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants (id) on delete set null,
  actor uuid,
  action text not null,
  target text,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index audit_tenant_idx on audit_log (tenant_id);
create index audit_created_idx on audit_log (created_at desc);

-- updated_at triggers
create trigger trg_tenants_updated before update on tenants for each row execute function set_updated_at();
create trigger trg_profiles_updated before update on profiles for each row execute function set_updated_at();
create trigger trg_leads_updated before update on leads for each row execute function set_updated_at();
create trigger trg_projects_updated before update on projects for each row execute function set_updated_at();
create trigger trg_tasks_updated before update on tasks for each row execute function set_updated_at();
create trigger trg_change_requests_updated before update on change_requests for each row execute function set_updated_at();
create trigger trg_invoices_updated before update on invoices for each row execute function set_updated_at();
create trigger trg_subscriptions_updated before update on subscriptions for each row execute function set_updated_at();

-- ============================================================================
-- RLS helper functions (SECURITY DEFINER so policies can read memberships
-- without recursive RLS). search_path locked to public for safety.
-- ============================================================================

-- Is the caller a member of this tenant?
create or replace function is_member_of(tid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from memberships m
    where m.user_id = auth.uid() and m.tenant_id = tid
  );
$$;

-- Does the caller hold a client-admin role in this tenant (can approve scope etc.)?
create or replace function is_tenant_admin(tid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from memberships m
    where m.user_id = auth.uid()
      and m.tenant_id = tid
      and m.role in ('owner', 'client_admin')
  );
$$;

-- Is the caller internal Nullshift staff (owner/staff on an internal tenant)?
create or replace function is_internal_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from memberships m
    join tenants t on t.id = m.tenant_id
    where m.user_id = auth.uid()
      and t.type = 'internal'
      and m.role in ('owner', 'staff')
  );
$$;

-- ============================================================================
-- RLS — enable everywhere (default deny), then add explicit policies.
-- The service-role key (server-only) bypasses RLS for trusted server routes.
-- ============================================================================
alter table tenants enable row level security;
alter table profiles enable row level security;
alter table memberships enable row level security;
alter table leads enable row level security;
alter table projects enable row level security;
alter table tasks enable row level security;
alter table change_requests enable row level security;
alter table documents enable row level security;
alter table invoices enable row level security;
alter table subscriptions enable row level security;
alter table compliance_records enable row level security;
alter table audit_log enable row level security;

-- tenants: members can read their tenant; staff read all; only staff write.
create policy tenants_select on tenants for select to authenticated
  using (is_member_of(id) or is_internal_staff());
create policy tenants_write_staff on tenants for all to authenticated
  using (is_internal_staff()) with check (is_internal_staff());

-- profiles: a user sees/edits their own; staff read all.
create policy profiles_select_self on profiles for select to authenticated
  using (id = auth.uid() or is_internal_staff());
create policy profiles_upsert_self on profiles for insert to authenticated
  with check (id = auth.uid());
create policy profiles_update_self on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- memberships: a user sees their own; staff manage all.
create policy memberships_select on memberships for select to authenticated
  using (user_id = auth.uid() or is_internal_staff());
create policy memberships_write_staff on memberships for all to authenticated
  using (is_internal_staff()) with check (is_internal_staff());

-- leads: Nullshift's pipeline — staff only (writes by marketing route via service role).
create policy leads_staff_all on leads for all to authenticated
  using (is_internal_staff()) with check (is_internal_staff());

-- projects: clients read their tenant; staff full.
create policy projects_select on projects for select to authenticated
  using (is_member_of(tenant_id) or is_internal_staff());
create policy projects_write_staff on projects for all to authenticated
  using (is_internal_staff()) with check (is_internal_staff());

-- tasks: clients read their tenant; staff full.
create policy tasks_select on tasks for select to authenticated
  using (is_member_of(tenant_id) or is_internal_staff());
create policy tasks_write_staff on tasks for all to authenticated
  using (is_internal_staff()) with check (is_internal_staff());

-- change_requests: clients submit + read + update (approve) their tenant; staff full.
create policy change_requests_select on change_requests for select to authenticated
  using (is_member_of(tenant_id) or is_internal_staff());
create policy change_requests_insert_client on change_requests for insert to authenticated
  with check (is_member_of(tenant_id));
create policy change_requests_update_client on change_requests for update to authenticated
  using (is_tenant_admin(tenant_id)) with check (is_tenant_admin(tenant_id));
create policy change_requests_write_staff on change_requests for all to authenticated
  using (is_internal_staff()) with check (is_internal_staff());

-- documents: clients read their tenant; staff full.
create policy documents_select on documents for select to authenticated
  using (is_member_of(tenant_id) or is_internal_staff());
create policy documents_write_staff on documents for all to authenticated
  using (is_internal_staff()) with check (is_internal_staff());

-- invoices: clients read their tenant; staff full.
create policy invoices_select on invoices for select to authenticated
  using (is_member_of(tenant_id) or is_internal_staff());
create policy invoices_write_staff on invoices for all to authenticated
  using (is_internal_staff()) with check (is_internal_staff());

-- subscriptions: clients read their tenant; staff full.
create policy subscriptions_select on subscriptions for select to authenticated
  using (is_member_of(tenant_id) or is_internal_staff());
create policy subscriptions_write_staff on subscriptions for all to authenticated
  using (is_internal_staff()) with check (is_internal_staff());

-- compliance_records: internal staff only.
create policy compliance_staff_all on compliance_records for all to authenticated
  using (is_internal_staff()) with check (is_internal_staff());

-- audit_log: staff + own-tenant members read; insert by members/staff; never update/delete.
create policy audit_select on audit_log for select to authenticated
  using (is_internal_staff() or (tenant_id is not null and is_member_of(tenant_id)));
create policy audit_insert on audit_log for insert to authenticated
  with check (is_internal_staff() or (tenant_id is not null and is_member_of(tenant_id)));
