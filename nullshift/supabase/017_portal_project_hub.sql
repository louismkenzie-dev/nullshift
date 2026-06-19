-- 017_portal_project_hub.sql
-- The client portal becomes project-centric. Add the deployed-site link the admin
-- sets + the client views, and re-key the team "updates" feed to the tenant so the
-- new portal can show it under proper RLS.
alter table public.projects
  add column if not exists live_url text;

alter table public.project_updates
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade,
  add column if not exists project_id uuid references public.projects(id) on delete set null;
-- Tenant-keyed updates don't carry a legacy client_id; make it nullable.
alter table public.project_updates alter column client_id drop not null;
create index if not exists project_updates_tenant_id_idx on public.project_updates(tenant_id);

-- Drop the legacy permissive policy (USING true) — it let any authenticated user
-- read every tenant's updates. Replace with staff-full + member-read-own-tenant.
-- The legacy client_id-based policies stay (harmless for any old rows).
drop policy if exists "auth all project_updates" on public.project_updates;

drop policy if exists project_updates_staff_all on public.project_updates;
create policy project_updates_staff_all on public.project_updates
  for all to authenticated
  using (public.is_internal_staff())
  with check (public.is_internal_staff());

drop policy if exists project_updates_member_select on public.project_updates;
create policy project_updates_member_select on public.project_updates
  for select to authenticated
  using (tenant_id is not null and public.is_member_of(tenant_id));
