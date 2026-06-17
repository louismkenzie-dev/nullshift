-- ============================================================================
-- Phase 5 — Subject Access Request export (brief §9). Gathers a tenant's full
-- data set as one JSON document. SECURITY DEFINER so it can read across the
-- tenant's tables, but guarded to internal staff only. Called via RPC by the
-- authenticated staff client.
-- ============================================================================
create or replace function export_tenant_data(tid uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not is_internal_staff() then
    raise exception 'forbidden: staff only';
  end if;

  select jsonb_build_object(
    'tenant', (select to_jsonb(t) from tenants t where t.id = tid),
    'memberships', (select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) from memberships m where m.tenant_id = tid),
    'projects', (select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) from projects p where p.tenant_id = tid),
    'tasks', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from tasks x where x.tenant_id = tid),
    'change_requests', (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) from change_requests c where c.tenant_id = tid),
    'documents', (select coalesce(jsonb_agg(to_jsonb(d)), '[]'::jsonb) from documents d where d.tenant_id = tid),
    'invoices', (select coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb) from invoices i where i.tenant_id = tid),
    'subscriptions', (select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) from subscriptions s where s.tenant_id = tid),
    'compliance_records', (select coalesce(jsonb_agg(to_jsonb(cr)), '[]'::jsonb) from compliance_records cr where cr.tenant_id = tid),
    'audit_log', (select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) from audit_log a where a.tenant_id = tid),
    'exported_at', now()
  ) into result;

  return result;
end;
$$;

revoke all on function export_tenant_data(uuid) from public, anon;
grant execute on function export_tenant_data(uuid) to authenticated;
