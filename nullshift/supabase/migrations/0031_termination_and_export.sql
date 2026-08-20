-- 0031: termination, handover and data export (legal implementation spec §18).
--
-- The distinction this schema exists to hold: a client asking us to delete
-- their application data is NOT asking us to erase the evidence that they were
-- ever a client. Processor Client Data goes on the deletion schedule; the
-- controller records Nullshift must keep for accounting, tax and legal defence
-- do not. Conflating the two either breaks the law or destroys our own record,
-- so the termination record carries both dates and says which is which.
--
-- The termination record is immutable once confirmed: no update policy, and
-- the confirmed columns are set once by the service role. What actually
-- happened at handover has to still be true a year later.

create table if not exists public.data_export_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,

  requested_by uuid references auth.users(id) on delete set null,
  requested_by_email text,

  -- A standard export is included. Migration assistance — us moving the system
  -- into someone else's hands, reconfiguring, re-platforming — is a project,
  -- and the form says so rather than letting the client assume otherwise.
  kind text not null default 'standard_export' check (
    kind in ('standard_export', 'migration_assistance')
  ),
  scope_note text,

  status text not null default 'received' check (
    status in ('received', 'in_progress', 'ready', 'delivered', 'declined')
  ),
  -- Where the export was put, once produced (private bucket path or a link we
  -- sent). Never the data itself.
  delivery_note text,

  requested_at timestamptz not null default now(),
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists data_export_requests_tenant_idx
  on public.data_export_requests (tenant_id, requested_at desc);

drop trigger if exists data_export_requests_updated_at on public.data_export_requests;
create trigger data_export_requests_updated_at
  before update on public.data_export_requests
  for each row execute function set_updated_at();

create table if not exists public.termination_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  order_form_id uuid references public.order_forms(id) on delete set null,

  reference text not null unique,

  requested_by uuid references auth.users(id) on delete set null,
  requested_by_email text,
  requested_by_name text,
  initiated_by text not null default 'client' check (
    initiated_by in ('client', 'nullshift', 'mutual')
  ),
  reason text,

  status text not null default 'requested' check (
    status in ('requested', 'acknowledged', 'in_handover', 'completed', 'withdrawn')
  ),

  -- 1. Effective date, derived from the notice rule on the Order Form. Stored
  --    with the rule it came from so the calculation can be explained.
  notice_rule text,
  effective_date date,

  -- 2/3. What the client is left holding, captured at the point of exit.
  outstanding_balance numeric(10, 2),
  client_owned_accounts jsonb not null default '[]'::jsonb,

  -- 6/7/8. The handover schedule.
  access_revoked_at timestamptz,
  active_data_deletion_due date,
  backup_expiry_due date,
  backup_policy_id text,

  -- 9. The controller records that survive, and why.
  retained_records_note text not null default
    'Contract, invoicing and accounting records are retained under the Nullshift retention policy for legal, tax and defence purposes. This is separate from Client Data held as processor, which is deleted on the schedule above.',

  -- 10. Immutable once confirmed.
  confirmed_at timestamptz,
  confirmed_by uuid references auth.users(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists termination_records_tenant_idx
  on public.termination_records (tenant_id, created_at desc);

drop trigger if exists termination_records_updated_at on public.termination_records;
create trigger termination_records_updated_at
  before update on public.termination_records
  for each row execute function set_updated_at();

create or replace function next_termination_ref()
returns text
language sql
volatile
security definer
set search_path = public
as $$
  select 'TRM-' || to_char(now(), 'YYYY') || '-' ||
         lpad((
           select count(*) + 1
           from public.termination_records
           where reference like 'TRM-' || to_char(now(), 'YYYY') || '-%'
         )::text, 4, '0');
$$;

-- A confirmed termination record must not be edited afterwards. This is the
-- "immutable termination record" the spec asks for, enforced rather than
-- promised.
create or replace function freeze_confirmed_termination()
returns trigger
language plpgsql
as $$
begin
  if old.confirmed_at is not null then
    raise exception using
      errcode = 'check_violation',
      message = 'This termination record is confirmed and cannot be changed.',
      hint = 'Spec 18: the termination record is immutable once confirmed. Add a new record instead.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_termination_immutable on public.termination_records;
create trigger trg_termination_immutable
  before update on public.termination_records
  for each row execute function freeze_confirmed_termination();

-- ── RLS ────────────────────────────────────────────────────────

alter table public.data_export_requests enable row level security;
alter table public.termination_records enable row level security;

drop policy if exists data_export_select on public.data_export_requests;
create policy data_export_select on public.data_export_requests
  for select to authenticated
  using (is_internal_staff() or is_member_of(tenant_id));

-- Any member may ask for their own data back. Requiring an admin to request an
-- export is a way of making a right harder to exercise than it should be.
drop policy if exists data_export_insert on public.data_export_requests;
create policy data_export_insert on public.data_export_requests
  for insert to authenticated
  with check (
    is_internal_staff()
    or (is_member_of(tenant_id) and status = 'received')
  );

drop policy if exists data_export_staff_write on public.data_export_requests;
create policy data_export_staff_write on public.data_export_requests
  for update to authenticated
  using (is_internal_staff()) with check (is_internal_staff());

drop policy if exists termination_select on public.termination_records;
create policy termination_select on public.termination_records
  for select to authenticated
  using (is_internal_staff() or is_member_of(tenant_id));

-- Ending the agreement binds the company, so it takes someone who can bind it.
drop policy if exists termination_insert on public.termination_records;
create policy termination_insert on public.termination_records
  for insert to authenticated
  with check (
    is_internal_staff()
    or (is_tenant_admin(tenant_id) and status = 'requested' and confirmed_at is null)
  );

drop policy if exists termination_staff_write on public.termination_records;
create policy termination_staff_write on public.termination_records
  for update to authenticated
  using (is_internal_staff()) with check (is_internal_staff());
