-- 0016_review_hardening.sql
-- Fixes confirmed by the adversarial review of the ops rebuild:
--   1) Client issue INSERT policy must bind project_id to the client's own tenant —
--      previously a member could inject an issue carrying another tenant's project_id,
--      landing it in another system's batch work orders.
--   2) Legacy plan ids in projects.proposed_plan were never remapped in 0014, so
--      in-flight proposals rendered an unknown plan.
--   3) Allowance debits were guarded only by app-level check-then-insert — enforce
--      one debit per issue at the database level.
-- Apply AFTER 0015.

drop policy if exists issues_insert_client on public.issues;
create policy issues_insert_client on public.issues
  for insert to authenticated
  with check (
    public.is_member_of(tenant_id)
    and submitted_by = auth.uid()
    and status = 'new'
    and billing = 'unclassified'
    and quoted_price is null
    and build_items is null
    and batch_id is null
    and client_visible
    and (
      project_id is null
      or exists (
        select 1 from public.projects p
        where p.id = issues.project_id and p.tenant_id = issues.tenant_id
      )
    )
  );

update public.projects set proposed_plan = case proposed_plan
  when 'care_basic'  then 'hosting'
  when 'care_pro'    then 'build_3'
  when 'transaction' then 'hosting'
  else proposed_plan end
where proposed_plan in ('care_basic', 'care_pro', 'transaction');

create unique index build_credit_events_one_debit_per_issue
  on public.build_credit_events (issue_id)
  where issue_id is not null and delta < 0;
