-- 0027: the usage footprint's "requests" signal now counts the live intake
-- (issues, migration 0014) instead of the legacy change_requests table, which
-- reads 0 for every client using the current portal. Same function shape —
-- the change_requests column name is kept for compatibility and simply
-- carries the issues count now (relabelled in the UI).

create or replace function tenant_footprint()
returns table (
  tenant_id uuid,
  name text,
  documents bigint,
  change_requests bigint,
  tasks bigint,
  invoices bigint,
  audit_rows bigint,
  mrr numeric
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not is_internal_staff() then
    return;
  end if;
  return query
    select
      t.id,
      t.name,
      (select count(*) from documents d where d.tenant_id = t.id),
      (select count(*) from issues iss where iss.tenant_id = t.id),
      (select count(*) from tasks k where k.tenant_id = t.id),
      (select count(*) from invoices i where i.tenant_id = t.id),
      (select count(*) from audit_log a where a.tenant_id = t.id),
      coalesce((select sum(s.mrr) from subscriptions s where s.tenant_id = t.id and s.status in ('active','trialing')), 0)
    from tenants t
    where t.type = 'client'
    order by t.name;
end;
$$;
