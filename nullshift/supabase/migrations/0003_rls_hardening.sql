-- ============================================================================
-- Phase 1 — RLS hardening. Closes four real holes found by adversarial audit of
-- the column-blind policies in 0001:
--   1+2. change_requests INSERT: a client could self-approve (status='approved',
--        zero price) and stitch a foreign tenant's project_id onto their row.
--   3.   change_requests UPDATE: a client_admin could rewrite staff-owned
--        scoping/quoting/approval columns.
--   4.   audit_log INSERT: a client could forge/backdate entries (any actor/time).
-- Plus: structural composite FKs (project_id must match tenant_id) and the
-- staff/client membership backfill the guard triggers rely on.
-- ============================================================================

-- --- Fix 1+2: lock down the client INSERT on change_requests --------------
drop policy if exists change_requests_insert_client on change_requests;
create policy change_requests_insert_client on change_requests
  for insert to authenticated
  with check (
    is_member_of(tenant_id)
    and status = 'submitted'
    and approved_at is null
    and quoted_price is null
    and estimate_hours is null
    and submitted_by = auth.uid()
    and exists (
      select 1 from projects p
      where p.id = change_requests.project_id
        and p.tenant_id = change_requests.tenant_id
    )
  );

-- --- Fix 2 (structural): a row's project_id must belong to its tenant_id ---
alter table projects add constraint projects_id_tenant_uniq unique (id, tenant_id);

alter table change_requests drop constraint if exists change_requests_project_id_fkey;
alter table change_requests
  add constraint change_requests_project_tenant_fk
  foreign key (project_id, tenant_id) references projects (id, tenant_id) on delete cascade;

alter table tasks drop constraint if exists tasks_project_id_fkey;
alter table tasks
  add constraint tasks_project_tenant_fk
  foreign key (project_id, tenant_id) references projects (id, tenant_id) on delete cascade;

alter table documents drop constraint if exists documents_project_id_fkey;
alter table documents
  add constraint documents_project_tenant_fk
  foreign key (project_id, tenant_id) references projects (id, tenant_id) on delete set null;

alter table invoices drop constraint if exists invoices_project_id_fkey;
alter table invoices
  add constraint invoices_project_tenant_fk
  foreign key (project_id, tenant_id) references projects (id, tenant_id) on delete set null;

-- --- Fix 3: clients may not rewrite staff-owned fields on a change_request -
-- Trusted server writes use the service role (auth.uid() is null) and pass.
create or replace function guard_change_request_update()
returns trigger
language plpgsql
as $$
begin
  if is_internal_staff() or auth.uid() is null then
    return new;  -- staff or trusted server context
  end if;
  -- client path: scoping/quoting fields are staff-owned and immutable here
  if new.quoted_price is distinct from old.quoted_price
     or new.estimate_hours is distinct from old.estimate_hours
     or new.project_id is distinct from old.project_id
     or new.tenant_id is distinct from old.tenant_id
     or new.description is distinct from old.description
     or new.submitted_by is distinct from old.submitted_by then
    raise exception 'clients may not modify scoping/quoting fields on a change request';
  end if;
  -- clients may only approve/reject a request that staff put up for approval
  if new.status is distinct from old.status
     and not (old.status = 'awaiting_approval' and new.status in ('approved', 'rejected')) then
    raise exception 'clients may only approve or reject a request awaiting approval';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_change_request_update on change_requests;
create trigger trg_guard_change_request_update
  before update on change_requests
  for each row execute function guard_change_request_update();

-- --- Fix 4: audit_log entries are stamped, never forged --------------------
-- For real end-users (authenticated, auth.uid() not null) bind actor + time.
-- Server routes use the service role (auth.uid() is null) and are trusted.
create or replace function stamp_audit_row()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null then
    new.actor := auth.uid();
    new.created_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_stamp_audit on audit_log;
create trigger trg_stamp_audit
  before insert on audit_log
  for each row execute function stamp_audit_row();

-- --- Membership backfill (staff + client) ---------------------------------
-- Staff owner membership for the admin allowlist user into the internal tenant.
insert into memberships (user_id, tenant_id, role)
select u.id, (select id from tenants where type = 'internal' limit 1), 'owner'
from auth.users u
where u.email = 'louismkenzie@gmail.com'
on conflict (user_id, tenant_id) do nothing;

-- client_admin membership for each legacy client (matched by tenant name).
insert into memberships (user_id, tenant_id, role)
select c.auth_user_id, t.id, 'client_admin'
from clients c
join tenants t
  on t.type = 'client'
  and t.name = coalesce(nullif(c.business_name, ''), c.name, 'Client')
where c.auth_user_id is not null
on conflict (user_id, tenant_id) do nothing;
