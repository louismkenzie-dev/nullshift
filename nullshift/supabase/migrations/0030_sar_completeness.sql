-- 0030: complete the SAR export (audit Phase 4.4). The 0006 version covered
-- only the ten 0001-era tables — a real subject-access response built from it
-- would under-disclose. Now covers every live personal-data-bearing table,
-- including funnel leads matched by the tenant's contact email (name, quiz
-- answers, agent research enrichment are all personal data).

create or replace function export_tenant_data(tid uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
  contact text;
begin
  if not is_internal_staff() then
    raise exception 'forbidden: staff only';
  end if;

  select lower(t.contact_email) into contact from tenants t where t.id = tid;

  select jsonb_build_object(
    'tenant', (select to_jsonb(t) from tenants t where t.id = tid),
    'memberships', (select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) from memberships m where m.tenant_id = tid),
    'projects', (select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) from projects p where p.tenant_id = tid),
    'tasks', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from tasks x where x.tenant_id = tid),
    'change_requests', (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) from change_requests c where c.tenant_id = tid),
    'documents', (select coalesce(jsonb_agg(to_jsonb(d)), '[]'::jsonb) from documents d where d.tenant_id = tid),
    'invoices', (select coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb) from invoices i where i.tenant_id = tid),
    'invoice_items', (select coalesce(jsonb_agg(to_jsonb(ii)), '[]'::jsonb) from invoice_items ii where ii.tenant_id = tid),
    'subscriptions', (select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) from subscriptions s where s.tenant_id = tid),
    'compliance_records', (select coalesce(jsonb_agg(to_jsonb(cr)), '[]'::jsonb) from compliance_records cr where cr.tenant_id = tid),
    'compliance_reviews', (select coalesce(jsonb_agg(to_jsonb(cv)), '[]'::jsonb) from compliance_reviews cv where cv.tenant_id = tid),
    'audit_log', (select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) from audit_log a where a.tenant_id = tid),
    'calls', (select coalesce(jsonb_agg(to_jsonb(cl)), '[]'::jsonb) from calls cl where cl.tenant_id = tid),
    'project_notes', (select coalesce(jsonb_agg(to_jsonb(pn)), '[]'::jsonb) from project_notes pn where pn.tenant_id = tid),
    'project_items', (select coalesce(jsonb_agg(to_jsonb(pi)), '[]'::jsonb) from project_items pi where pi.tenant_id = tid),
    'project_updates', (select coalesce(jsonb_agg(to_jsonb(pu)), '[]'::jsonb) from project_updates pu where pu.tenant_id = tid),
    'issues', (select coalesce(jsonb_agg(to_jsonb(iss)), '[]'::jsonb) from issues iss where iss.tenant_id = tid),
    'fix_batches', (select coalesce(jsonb_agg(to_jsonb(fb)), '[]'::jsonb) from fix_batches fb where fb.tenant_id = tid),
    'build_credit_events', (select coalesce(jsonb_agg(to_jsonb(bc)), '[]'::jsonb) from build_credit_events bc where bc.tenant_id = tid),
    'system_profiles', (select coalesce(jsonb_agg(to_jsonb(sp)), '[]'::jsonb) from system_profiles sp where sp.tenant_id = tid),
    'milestones', (select coalesce(jsonb_agg(to_jsonb(ml)), '[]'::jsonb) from milestones ml where ml.tenant_id = tid),
    'risks', (select coalesce(jsonb_agg(to_jsonb(rk)), '[]'::jsonb) from risks rk where rk.tenant_id = tid),
    'decisions', (select coalesce(jsonb_agg(to_jsonb(dc)), '[]'::jsonb) from decisions dc where dc.tenant_id = tid),
    'checklists', (select coalesce(jsonb_agg(to_jsonb(ck)), '[]'::jsonb) from checklists ck where ck.tenant_id = tid),
    'leads_by_contact_email', (
      select coalesce(jsonb_agg(to_jsonb(l)), '[]'::jsonb)
      from leads l where contact is not null and lower(l.email) = contact
    ),
    'exported_at', now()
  ) into result;

  return result;
end;
$$;

revoke all on function export_tenant_data(uuid) from public, anon;
grant execute on function export_tenant_data(uuid) to authenticated;
