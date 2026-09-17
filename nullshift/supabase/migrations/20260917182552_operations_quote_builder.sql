-- Requires 0057_opportunities_quotes.sql. No billing, client repricing or contract changes.
-- The staff-only draft save is atomic; a stale tab cannot overwrite another edit.
grant select, insert, update, delete on public.opportunities, public.quotes, public.quote_versions to authenticated;
grant select, insert on public.quote_approvals to authenticated;
revoke all on public.opportunities, public.quotes, public.quote_versions, public.quote_approvals from anon;
revoke update, delete on public.quote_approvals from authenticated;

create or replace function public.ops_save_quote_draft(
  p_id uuid, p_expected_updated_at timestamptz, p_tenant_id uuid,
  p_business text, p_email text, p_title text,
  p_brief jsonb, p_scope jsonb, p_estimate jsonb, p_commercial jsonb, p_internal jsonb
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v public.quote_versions%rowtype;
  q public.quotes%rowtype;
  opportunity_id uuid;
  quote_id uuid;
begin
  if auth.uid() is null or not public.is_internal_staff() then
    raise exception 'Staff access required' using errcode = '42501';
  end if;
  if p_id is null or nullif(trim(p_business),'') is null or nullif(trim(p_title),'') is null
    or length(p_business)>250 or length(p_title)>250
    or jsonb_typeof(p_commercial->'builder') is distinct from 'object'
    or jsonb_typeof(p_internal->'builderCosts') is distinct from 'object'
    or pg_column_size(p_commercial)>150000 then
    raise exception 'Invalid quote draft';
  end if;
  if p_tenant_id is not null and not exists(select 1 from public.tenants where id=p_tenant_id and type='client') then
    raise exception 'Client not found';
  end if;
  -- Stable draft ID makes the initial save retry-safe, including concurrent requests.
  perform pg_advisory_xact_lock(hashtextextended(p_id::text, 0));
  select * into v from public.quote_versions where id=p_id for update;
  if found then
    select * into q from public.quotes where id=v.quote_id for update;
    if q.tenant_id is distinct from p_tenant_id then raise exception 'Quote identity cannot change'; end if;
    if v.status not in ('draft','internal_review') then raise exception 'Quote content is frozen'; end if;
    if p_expected_updated_at is null then
      if v.author=auth.uid() and v.commercial=p_commercial and v.internal=p_internal and v.scope=p_scope and v.brief=p_brief and v.estimate=p_estimate then
        return jsonb_build_object('id',v.id,'updated_at',v.updated_at);
      end if;
      raise exception 'Stale quote draft';
    end if;
    if v.updated_at is distinct from p_expected_updated_at then raise exception 'Stale quote draft'; end if;
    update public.quote_versions set brief=p_brief, scope=p_scope, estimate=p_estimate, commercial=p_commercial, internal=p_internal where id=p_id returning * into v;
    update public.quotes set project_label=p_title where id=v.quote_id;
    update public.opportunities set legal_name=p_business, contact_email=p_email where id=q.opportunity_id;
  else
    if p_expected_updated_at is not null then raise exception 'Stale quote draft'; end if;
    insert into public.opportunities(tenant_id,legal_name,contact_email,stage,source,created_by)
      values(p_tenant_id,p_business,p_email,'scope_ready','operations_quote_builder',auth.uid()) returning id into opportunity_id;
    insert into public.quotes(opportunity_id,tenant_id,project_label)
      values(opportunity_id,p_tenant_id,p_title) returning id into quote_id;
    insert into public.quote_versions(id,quote_id,version_no,status,currency,brief,scope,estimate,commercial,internal,author,formula_version,policy_version)
      values(p_id,quote_id,1,'draft','GBP',p_brief,p_scope,p_estimate,p_commercial,p_internal,auth.uid(),'cost-plus-margin-v1','manually-entered-per-quote') returning * into v;
  end if;
  insert into public.audit_log(tenant_id,actor,action,target,metadata)
    values(p_tenant_id,auth.uid(),'quote.draft_saved',p_id::text,jsonb_build_object('version',v.version_no,'billing_changed',false));
  return jsonb_build_object('id',v.id,'updated_at',v.updated_at);
end;
$$;
revoke all on function public.ops_save_quote_draft(uuid,timestamptz,uuid,text,text,text,jsonb,jsonb,jsonb,jsonb,jsonb) from public, anon;
grant execute on function public.ops_save_quote_draft(uuid,timestamptz,uuid,text,text,text,jsonb,jsonb,jsonb,jsonb,jsonb) to authenticated;
revoke execute on function public.quote_versions_guard_frozen_content() from public, anon;
revoke execute on function public.quote_approvals_guard_separation() from public, anon;
create index if not exists quote_versions_author_idx on public.quote_versions(author);
create index if not exists quote_versions_superseded_idx on public.quote_versions(superseded_by);
create index if not exists quotes_current_version_idx on public.quotes(current_version_id);
create index if not exists opportunities_created_by_idx on public.opportunities(created_by);
create index if not exists quote_approvals_approver_idx on public.quote_approvals(approver);
