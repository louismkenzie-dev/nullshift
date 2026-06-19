-- 014_unify_clients.sql
-- Unify the client into the multi-tenant model. The admin "Client" hub is now the
-- tenant (type='client'); this adds the two things the legacy `clients` profile had
-- that the tenant lacked: contact details, and tenant-scoped call bookings (reusing
-- the existing `calls` table). No data migration — legacy rows are abandoned.

-- 1) Contact + free-text notes on the tenant (previously only on legacy `clients`).
alter table public.tenants
  add column if not exists contact_name text,
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists notes text;

-- 2) Scope call bookings to the tenant (and optionally a project). `calls.client_id`
--    is already nullable, so legacy rows are untouched.
alter table public.calls
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade,
  add column if not exists project_id uuid references public.projects(id) on delete set null;

create index if not exists calls_tenant_id_idx on public.calls(tenant_id);

-- RLS on calls: internal staff get full access; a tenant member may read their own
-- tenant's calls (so the portal can later surface an upcoming call). Service role
-- bypasses RLS as usual.
alter table public.calls enable row level security;

-- Drop the legacy permissive policy (USING true) that predated tenant scoping —
-- once RLS is on it would let any authenticated user read every tenant's calls.
drop policy if exists "auth all calls" on public.calls;

drop policy if exists calls_staff_all on public.calls;
create policy calls_staff_all on public.calls
  for all to authenticated
  using (public.is_internal_staff())
  with check (public.is_internal_staff());

drop policy if exists calls_member_select on public.calls;
create policy calls_member_select on public.calls
  for select to authenticated
  using (tenant_id is not null and public.is_member_of(tenant_id));
