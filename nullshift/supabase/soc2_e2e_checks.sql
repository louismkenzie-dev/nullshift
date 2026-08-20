-- Executable E2E checks for 0037's enforcement triggers (docs/SOC2-OPERATIONS.md
-- §Testing). Run against a STAGING/local replica, never production:
--   psql "$SUPABASE_DB_URL" --single-transaction -f supabase/soc2_e2e_checks.sql
-- Everything runs inside one transaction and rolls back at the end — the
-- script leaves no rows behind. Each check prints "<id> PASS" or "<id> FAIL".
-- Last full run: 2026-08-20 against the complete migration chain (schema.sql +
-- legacy series + migrations/0001–0037) on Postgres 16 — all checks PASS.
-- The final RLS block needs Supabase's default grants (authenticated role);
-- on a bare local Postgres, grant all on public tables to authenticated first.
\set QUIET on
set client_min_messages = notice;

-- Fixtures
insert into soc2_controls (key, tsc_category, name, objective) values ('TST-01','security','Test control','obj')
  on conflict (key) do nothing;

do $$
declare cid uuid; rid uuid; eid uuid; evid uuid; arid uuid; itemid uuid;
begin
  select id into cid from soc2_controls where key='TST-01';

  -- E2E-2a: closure without resolution refused
  insert into soc2_exceptions (ref, title, severity, status) values ('EXC-9999-0001','t','high','in_remediation') returning id into eid;
  begin
    update soc2_exceptions set status='closed' where id=eid;
    raise notice 'E2E-2a FAIL — closed without resolution';
  exception when check_violation then raise notice 'E2E-2a PASS'; end;

  -- E2E-2b: same-person verification refused
  begin
    update soc2_exceptions set status='closed', resolution_note='n', resolved_by='a@x', resolved_at=now(),
      verified_by='a@x', verified_at=now() where id=eid;
    raise notice 'E2E-2b FAIL — self-verified closure allowed';
  exception when check_violation then raise notice 'E2E-2b PASS'; end;

  -- E2E-2c: proper two-person closure allowed
  begin
    update soc2_exceptions set status='closed', resolution_note='n', resolved_by='a@x', resolved_at=now(),
      verified_by='b@x', verified_at=now() where id=eid;
    raise notice 'E2E-2c PASS';
  exception when others then raise notice 'E2E-2c FAIL — legitimate closure refused: %', sqlerrm; end;

  -- E2E-2d: not_applicable needs reason
  insert into soc2_exceptions (ref, title, severity, status) values ('EXC-9999-0002','t2','low','detected') returning id into eid;
  begin
    update soc2_exceptions set status='not_applicable' where id=eid;
    raise notice 'E2E-2d FAIL — N/A without reason allowed';
  exception when check_violation then raise notice 'E2E-2d PASS'; end;

  -- E2E-3: control N/A gate
  begin
    update soc2_controls set applicability='not_applicable' where id=cid;
    raise notice 'E2E-3 FAIL — control N/A without reason/approver allowed';
  exception when check_violation then raise notice 'E2E-3 PASS'; end;

  -- E2E-1: access review completion gates
  insert into soc2_access_reviews (ref, title, due_at) values ('ACR-9999-0001','t','2026-08-01') returning id into arid;
  insert into soc2_access_review_items (review_id, system_label, account_identifier, decision)
    values (arid,'sys','acct','pending') returning id into itemid;
  begin
    update soc2_access_reviews set status='complete', reviewer_email='r@x', completed_at=now() where id=arid;
    raise notice 'E2E-1a FAIL — completed with undecided items';
  exception when check_violation then raise notice 'E2E-1a PASS'; end;
  update soc2_access_review_items set decision='revoke', decided_by='r@x', decided_at=now() where id=itemid;
  begin
    update soc2_access_reviews set status='complete', reviewer_email='r@x', completed_at=now() where id=arid;
    raise notice 'E2E-1b FAIL — completed with unactioned revoke';
  exception when check_violation then raise notice 'E2E-1b PASS'; end;
  update soc2_access_review_items set action_completed_at=now() where id=itemid;
  begin
    update soc2_access_reviews set status='complete', reviewer_email='r@x', completed_at=now() where id=arid;
    raise notice 'E2E-1c PASS';
  exception when others then raise notice 'E2E-1c FAIL — legitimate completion refused: %', sqlerrm; end;

  -- E2E-4: accepted evidence immutable
  insert into soc2_control_runs (control_id, due_at, status) values (cid,'2026-08-01','scheduled') returning id into rid;
  insert into soc2_evidence_items (control_id, control_run_id, title, review_result, reviewer_email, reviewed_at, content_sha256)
    values (cid, rid, 'ev', 'accepted', 'r@x', now(), 'abc') returning id into evid;
  begin
    update soc2_evidence_items set content_sha256='tampered' where id=evid;
    raise notice 'E2E-4 FAIL — accepted evidence mutated';
  exception when check_violation then raise notice 'E2E-4 PASS'; end;

  -- E2E-5: break-glass gates
  begin
    insert into soc2_break_glass_events (system_label, used_by, approved_by, reason, expires_at, review_due_at)
      values ('sys','a@x','a@x','r', now() + interval '1 hour', '2026-08-23');
    raise notice 'E2E-5a FAIL — self-approved break-glass allowed';
  exception when check_violation then raise notice 'E2E-5a PASS'; end;
  begin
    insert into soc2_break_glass_events (system_label, used_by, approved_by, reason, expires_at, review_due_at)
      values ('sys','a@x','b@x','r', now() + interval '48 hours', '2026-08-23');
    raise notice 'E2E-5b FAIL — 48h break-glass window allowed';
  exception when check_violation then raise notice 'E2E-5b PASS'; end;

  -- E2E-7: auditor expiry mandatory
  begin
    insert into soc2_programme_roles (user_email, role) values ('aud@x','auditor');
    raise notice 'E2E-7 FAIL — auditor without expiry allowed';
  exception when check_violation then raise notice 'E2E-7 PASS'; end;

  -- Scope approval gate
  begin
    insert into soc2_scopes (version, service_description, status) values (99,'d','approved');
    raise notice 'E2E-scope FAIL — approved scope without approver allowed';
  exception when check_violation then raise notice 'E2E-scope PASS'; end;

  -- Run completion gate
  begin
    update soc2_control_runs set status='complete' where id=rid;
    raise notice 'E2E-run FAIL — completed run without performer/result allowed';
  exception when check_violation then raise notice 'E2E-run PASS'; end;
end $$;

-- E2E-6 (RLS smoke): a client-tenant member sees zero soc2 rows; internal staff sees them.
do $$
declare
  client_user uuid := gen_random_uuid();
  staff_user uuid := gen_random_uuid();
  client_tenant uuid; internal_tenant uuid; n int;
begin
  insert into auth.users (id, email) values (client_user,'client@e2e.test'), (staff_user,'staff@e2e.test');
  select id into internal_tenant from tenants where type='internal' limit 1;
  insert into tenants (name, type) values ('E2E client tenant','client') returning id into client_tenant;
  insert into memberships (user_id, tenant_id, role) values
    (client_user, client_tenant, 'client_admin'),
    (staff_user, internal_tenant, 'staff');

  perform set_config('request.jwt.claim.sub', client_user::text, true);
  perform set_config('role', 'authenticated', true);
  set local role authenticated;
  select count(*) into n from soc2_controls;
  reset role;
  if n = 0 then raise notice 'E2E-6a PASS (client user sees zero soc2 rows)';
  else raise notice 'E2E-6a FAIL — client user sees % soc2 rows', n; end if;

  perform set_config('request.jwt.claim.sub', staff_user::text, true);
  set local role authenticated;
  select count(*) into n from soc2_controls;
  reset role;
  if n > 0 then raise notice 'E2E-6b PASS (staff member sees soc2 rows)';
  else raise notice 'E2E-6b FAIL — staff member sees nothing'; end if;
end $$;

rollback;
