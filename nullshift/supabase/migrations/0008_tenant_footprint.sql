-- ============================================================================
-- Phase 7 — Per-tenant usage footprint (brief §8 cost guardrail). A lean proxy
-- for a tenant's resource footprint (row counts across its data) so the admin can
-- spot a client whose usage is large relative to its recurring fee — a pricing
-- trigger, not a cost to absorb. Real storage/egress metering layers on later via
-- the Supabase usage API (see docs/runbook-compliance.md). Staff-only.
-- ============================================================================
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
      (select count(*) from change_requests c where c.tenant_id = t.id),
      (select count(*) from tasks k where k.tenant_id = t.id),
      (select count(*) from invoices i where i.tenant_id = t.id),
      (select count(*) from audit_log a where a.tenant_id = t.id),
      coalesce((select sum(s.mrr) from subscriptions s where s.tenant_id = t.id and s.status in ('active','trialing')), 0)
    from tenants t
    where t.type = 'client'
    order by t.name;
end;
$$;

revoke all on function tenant_footprint() from public, anon;
grant execute on function tenant_footprint() to authenticated;
