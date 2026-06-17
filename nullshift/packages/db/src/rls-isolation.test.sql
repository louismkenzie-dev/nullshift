-- Cross-tenant RLS isolation test (the Phase 1 compliance control, brief §3/§9).
-- Run inside a transaction that is ROLLED BACK so no fixtures persist. Creates two
-- client tenants + users, impersonates each via JWT claims + the `authenticated`
-- role, and asserts a client of Tenant A cannot read Tenant B's rows; staff can.
-- Raises an exception (aborting the tx) on any isolation failure.
do $$
declare
  tn uuid; ta uuid; tb uuid;
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); us uuid := gen_random_uuid();
  cnt int;
begin
  select id into tn from tenants where type = 'internal' limit 1;
  if tn is null then raise exception 'RLS TEST: no internal tenant seeded'; end if;

  insert into tenants(name, type) values ('RLS Test A', 'client') returning id into ta;
  insert into tenants(name, type) values ('RLS Test B', 'client') returning id into tb;

  insert into auth.users(id, instance_id, aud, role, email, encrypted_password, created_at, updated_at, email_confirmed_at)
  values
    (ua, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-a@test.local', 'x', now(), now(), now()),
    (ub, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-b@test.local', 'x', now(), now(), now()),
    (us, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-staff@test.local', 'x', now(), now(), now());

  insert into memberships(user_id, tenant_id, role)
  values (ua, ta, 'client_admin'), (ub, tb, 'client_admin'), (us, tn, 'staff');
  insert into projects(tenant_id, name) values (ta, 'A project'), (tb, 'B project');

  -- Impersonate client A: must see only Tenant A.
  perform set_config('request.jwt.claims', json_build_object('sub', ua::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into cnt from projects where tenant_id = tb;
  if cnt <> 0 then raise exception 'ISOLATION FAIL: client A read % Tenant-B projects (want 0)', cnt; end if;
  select count(*) into cnt from projects;
  if cnt <> 1 then raise exception 'LEAK FAIL: client A saw % projects total (want 1)', cnt; end if;
  reset role;

  -- Impersonate internal staff: must see across tenants.
  perform set_config('request.jwt.claims', json_build_object('sub', us::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into cnt from projects where tenant_id in (ta, tb);
  if cnt < 2 then raise exception 'STAFF FAIL: staff saw % cross-tenant projects (want >= 2)', cnt; end if;
  reset role;

  raise notice 'RLS ISOLATION TEST PASSED';
end $$;
