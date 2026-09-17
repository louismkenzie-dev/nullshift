-- ============================================================================
-- Legacy client invariant snapshot (admin redesign Phase 5, brief §14.1).
--
-- READ-ONLY. Every statement below is a SELECT (plus one set_config call that
-- stores the parameter in the session; it writes nothing to any table). Run it
-- once BEFORE and once AFTER any redesign migration (0057–0065) for each of the
-- three protected clients, save both outputs, and diff them. Expected change
-- from the redesign migration: NONE, except the two additive identity fields
-- listed in section 12 (invoices.obligation_id set by the documented 0062
-- backfill for live legacy build_milestone invoices; order_forms.
-- commercial_version defaulting to 'v1' from 0059).
--
-- Parameter: the tenant id (tenants.id) of the client. Set it in ONE place —
-- the set_config line under "PARAMETER" — then run the whole file. Works in
-- psql and in the Supabase SQL editor (the editor runs the block in one
-- session). With psql you can instead run:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 \
--     -c "select set_config('ns.tenant_id', '<uuid>', false)" -f legacy-invariants.sql
-- (the placeholder line below is then harmless because it only re-sets the
-- same setting when you leave it edited to the same value).
--
-- Tenant ids are read from the admin (the client workspace URL) and are never
-- written into this file or into any document. The output prints NO secrets
-- and NO provider identifiers in clear: provider/customer/invoice/mandate ids,
-- emails and hosted URLs are reduced to a 12-character md5 fingerprint (enough
-- to prove "unchanged" in a diff, useless to anyone else). Amounts and dates
-- are printed because that is what the invariant is about.
--
-- Schema tolerance: columns added by 0059/0062/0064 are read through
-- to_jsonb(row) ->> 'column' so the same file runs before and after the
-- migrations without editing.
--
-- Output: one result set per section, each with a `section` column and a
-- stable ORDER BY, so `diff before.txt after.txt` is meaningful.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- PARAMETER — replace the placeholder with the client's tenant id (uuid).
-- ---------------------------------------------------------------------------
select set_config('ns.tenant_id', '00000000-0000-0000-0000-000000000000', false) as tenant_id_set;

-- Helper expression used everywhere: current_setting('ns.tenant_id', true)::uuid
-- Fingerprint expression: left(md5(coalesce(value, '')), 12), or null when null.

-- ---------------------------------------------------------------------------
-- 0. Sanity: the tenant exists and is a client. Stops early if not.
-- ---------------------------------------------------------------------------
select
  '00_tenant_exists' as section,
  count(*) as tenant_rows,
  bool_and(type = 'client') as is_client
from public.tenants
where id = current_setting('ns.tenant_id', true)::uuid;

-- ---------------------------------------------------------------------------
-- 1. Identity and legacy commercial state on the tenant row
-- ---------------------------------------------------------------------------
select
  '01_tenant_identity' as section,
  t.id,
  t.name,
  t.type::text,
  t.status,
  t.vertical,
  t.created_at,
  -- Legacy care-plan state (0017, 0046). Must not change.
  to_jsonb(t) ->> 'care_plan_choice' as care_plan_choice,
  to_jsonb(t) ->> 'care_plan_terms_version' as care_plan_terms_version,
  to_jsonb(t) ->> 'care_plan_terms_accepted_at' as care_plan_terms_accepted_at,
  -- Provider / accounting links as fingerprints (0012, 0018, 0051, 0055).
  case when to_jsonb(t) ->> 'stripe_customer_id' is null then null else left(md5(to_jsonb(t) ->> 'stripe_customer_id'), 12) end as stripe_customer_fp,
  case when to_jsonb(t) ->> 'xero_contact_id' is null then null else left(md5(to_jsonb(t) ->> 'xero_contact_id'), 12) end as xero_contact_fp,
  case when to_jsonb(t) ->> 'stripe_connect_account_id' is null then null else left(md5(to_jsonb(t) ->> 'stripe_connect_account_id'), 12) end as stripe_connect_account_fp,
  to_jsonb(t) ->> 'stripe_connect_status' as stripe_connect_status,
  to_jsonb(t) ->> 'stripe_connect_livemode' as stripe_connect_livemode,
  -- Application fee configuration on the tenant, if the column exists (0053).
  to_jsonb(t) ->> 'application_fee_percent' as application_fee_percent,
  -- The legacy marker the Phase 0 report asks for (N-g). Null until hand-set.
  to_jsonb(t) ->> 'legacy_model' as legacy_model,
  -- Whole-row fingerprint over the legacy columns only (new columns excluded).
  left(md5(
    coalesce(t.name, '') || '|' || t.type::text || '|' || coalesce(t.status, '') || '|' ||
    coalesce(t.vertical, '') || '|' ||
    coalesce(to_jsonb(t) ->> 'care_plan_choice', '') || '|' ||
    coalesce(to_jsonb(t) ->> 'care_plan_terms_version', '') || '|' ||
    coalesce(to_jsonb(t) ->> 'care_plan_terms_accepted_at', '') || '|' ||
    coalesce(to_jsonb(t) ->> 'stripe_customer_id', '') || '|' ||
    coalesce(to_jsonb(t) ->> 'xero_contact_id', '') || '|' ||
    coalesce(to_jsonb(t) ->> 'stripe_connect_account_id', '') || '|' ||
    coalesce(to_jsonb(t) ->> 'application_fee_percent', '')
  ), 16) as legacy_columns_fp
from public.tenants t
where t.id = current_setting('ns.tenant_id', true)::uuid;

-- ---------------------------------------------------------------------------
-- 2. Memberships (who can sign in for this client), by role. No emails.
-- ---------------------------------------------------------------------------
select
  '02_memberships' as section,
  m.role::text as role,
  count(*) as members,
  min(m.created_at) as first_created_at,
  max(m.created_at) as last_created_at
from public.memberships m
where m.tenant_id = current_setting('ns.tenant_id', true)::uuid
group by m.role
order by m.role;

-- ---------------------------------------------------------------------------
-- 3. Projects: stage, fees, proposal snapshot, owners and next action
-- ---------------------------------------------------------------------------
select
  '03_projects' as section,
  p.id,
  p.name,
  p.stage::text as stage,
  p.build_fee,
  p.started_at,
  p.created_at,
  to_jsonb(p) ->> 'account_owner' as account_owner,
  to_jsonb(p) ->> 'delivery_owner' as delivery_owner,
  to_jsonb(p) ->> 'technical_owner' as technical_owner,
  to_jsonb(p) ->> 'finance_owner' as finance_owner,
  to_jsonb(p) ->> 'next_action' as next_action,
  to_jsonb(p) ->> 'next_action_owner' as next_action_owner,
  -- Accepted proposal snapshot (0025): fingerprint only; it must never change.
  case when to_jsonb(p) -> 'accepted_snapshot' is null then null else left(md5((to_jsonb(p) -> 'accepted_snapshot')::text), 12) end as accepted_snapshot_fp,
  (to_jsonb(p) -> 'accepted_snapshot') is not null as has_accepted_snapshot,
  -- DPA evidence (legacy 015/016/018 and 0019): presence and timestamps only.
  to_jsonb(p) ->> 'dpa_client_submitted_at' as dpa_client_submitted_at,
  (to_jsonb(p) ->> 'dpa_client_company_name') is not null as has_dpa_company_name
from public.projects p
where p.tenant_id = current_setting('ns.tenant_id', true)::uuid
order by p.created_at, p.id;

-- ---------------------------------------------------------------------------
-- 4. System profiles (one per project): existence and health only
-- ---------------------------------------------------------------------------
select
  '04_system_profiles' as section,
  s.project_id,
  to_jsonb(s) ->> 'created_at' as created_at,
  to_jsonb(s) ->> 'health' as health,
  (to_jsonb(s) ->> 'repo_full_name') is not null as has_repo,
  (to_jsonb(s) ->> 'vercel_project') is not null as has_vercel_ref,
  (to_jsonb(s) ->> 'supabase_ref') is not null as has_supabase_ref,
  left(md5(coalesce(to_jsonb(s) ->> 'stack', '')), 12) as stack_fp
from public.system_profiles s
where s.tenant_id = current_setting('ns.tenant_id', true)::uuid
order by s.project_id;

-- ---------------------------------------------------------------------------
-- 5. Order Forms (0030, 0053): prices, plan, versions, fee, status
--    commercial_version (0059) is expected to read null BEFORE and 'v1' AFTER.
-- ---------------------------------------------------------------------------
select
  '05_order_forms' as section,
  o.id,
  o.reference,
  o.status,
  o.plan,
  o.scale_band,
  o.pricing_version,
  o.monthly_fee,
  o.project_fee,
  o.mobilisation_fee,
  o.vat_treatment,
  o.billing_date_rule,
  o.payment_architecture,
  to_jsonb(o) ->> 'application_fee_enabled' as application_fee_enabled,
  to_jsonb(o) ->> 'application_fee_percent' as application_fee_percent,
  o.sent_at,
  o.accepted_at,
  o.superseded_by,
  o.scale_assessment_id,
  left(md5(o.invoice_schedule::text), 12) as invoice_schedule_fp,
  left(md5(o.scope::text), 12) as scope_fp,
  left(md5(o.schedule_versions::text), 12) as schedule_versions_fp,
  left(md5(coalesce(o.client_legal_name, '') || '|' || coalesce(o.client_company_number, '') || '|' || coalesce(o.client_address, '')), 12) as client_identity_fp,
  -- New in 0059 (expected: null before, 'v1' after; never 'v2' on a legacy row)
  to_jsonb(o) ->> 'commercial_version' as commercial_version_0059
from public.order_forms o
where o.tenant_id = current_setting('ns.tenant_id', true)::uuid
order by o.created_at, o.id;

-- ---------------------------------------------------------------------------
-- 6. Contract acceptances (0030): versions and evidence hashes; snapshot cols
--    added by 0059 are expected null on legacy rows before AND after.
-- ---------------------------------------------------------------------------
select
  '06_contract_acceptances' as section,
  a.id,
  a.order_form_id,
  a.msa_version,
  a.dpa_version,
  a.ai_schedule_version,
  a.payments_schedule_version,
  a.aup_version,
  a.pricing_version,
  a.acceptance_method,
  a.accepted_at,
  left(md5(a.document_hashes::text), 12) as document_hashes_fp,
  left(md5(coalesce(a.accepted_by_name, '') || '|' || coalesce(a.accepted_by_title, '') || '|' || coalesce(a.accepted_by_email, '')), 12) as signatory_fp,
  (a.signed_artifact_path is not null) as has_signed_artifact,
  to_jsonb(a) ->> 'snapshot_hash' as snapshot_hash_0059
from public.contract_acceptances a
where a.tenant_id = current_setting('ns.tenant_id', true)::uuid
order by a.accepted_at, a.id;

-- ---------------------------------------------------------------------------
-- 7. Care-plan terms and subscriptions (0001, 0014, 0017, 0046):
--    plan, MRR, provider, status, terms version, mandate/subscription refs.
--    0064 columns are expected null before AND after on legacy rows.
-- ---------------------------------------------------------------------------
select
  '07_subscriptions' as section,
  s.id,
  s.plan::text as plan,
  s.mrr,
  s.status::text as status,
  s.started_at,
  s.created_at,
  to_jsonb(s) ->> 'provider' as provider,
  to_jsonb(s) ->> 'terms_version' as terms_version,
  to_jsonb(s) ->> 'terms_accepted_at' as terms_accepted_at,
  case when s.stripe_subscription_id is null then null else left(md5(s.stripe_subscription_id), 12) end as stripe_subscription_fp,
  case when to_jsonb(s) ->> 'gc_billing_request_id' is null then null else left(md5(to_jsonb(s) ->> 'gc_billing_request_id'), 12) end as gc_billing_request_fp,
  case when to_jsonb(s) ->> 'gc_mandate_id' is null then null else left(md5(to_jsonb(s) ->> 'gc_mandate_id'), 12) end as gc_mandate_fp,
  case when to_jsonb(s) ->> 'gc_subscription_id' is null then null else left(md5(to_jsonb(s) ->> 'gc_subscription_id'), 12) end as gc_subscription_fp,
  -- New in 0064 (expected null on every legacy row, before and after)
  to_jsonb(s) ->> 'activation_id' as activation_id_0064,
  to_jsonb(s) ->> 'arrangement_id' as arrangement_id_0064,
  to_jsonb(s) ->> 'environment' as environment_0064
from public.subscriptions s
where s.tenant_id = current_setting('ns.tenant_id', true)::uuid
order by s.created_at, s.id;

-- ---------------------------------------------------------------------------
-- 8. Scale assessments (0028, 0044, 0047): the pricing evidence behind the
--    contracted MRR. Must not change.
-- ---------------------------------------------------------------------------
select
  '08_scale_assessments' as section,
  a.id,
  a.pricing_version,
  a.plan,
  a.nsi,
  a.scale_band,
  a.multiplier,
  a.base_plan_price,
  a.scaled_plan_price,
  a.recommended_mrr,
  a.override_mrr,
  (a.override_reason is not null) as has_override_reason,
  to_jsonb(a) ->> 'agreed_mrr' as agreed_mrr,
  left(md5(coalesce(to_jsonb(a) ->> 'plan_prices', '')), 12) as plan_prices_fp,
  left(md5(a.inputs::text), 12) as inputs_fp,
  a.created_at
from public.scale_assessments a
where a.tenant_id = current_setting('ns.tenant_id', true)::uuid
order by a.created_at, a.id;

-- ---------------------------------------------------------------------------
-- 9. Invoices (0001, 0009, 0013, 0018, 0025, 0045): amounts, status, dates,
--    provider / accounting links, and the ONE documented change:
--    obligation_id (0062) — null before; set AFTER for live build_milestone rows.
-- ---------------------------------------------------------------------------
select
  '09_invoices' as section,
  i.id,
  i.project_id,
  i.type::text as type,
  i.amount,
  i.status::text as status,
  i.due_at,
  i.paid_at,
  i.created_at,
  case when i.stripe_invoice_id is null then null else left(md5(i.stripe_invoice_id), 12) end as stripe_invoice_fp,
  case when to_jsonb(i) ->> 'xero_invoice_id' is null then null else left(md5(to_jsonb(i) ->> 'xero_invoice_id'), 12) end as xero_invoice_fp,
  case when to_jsonb(i) ->> 'gc_payment_id' is null then null else left(md5(to_jsonb(i) ->> 'gc_payment_id'), 12) end as gc_payment_fp,
  (to_jsonb(i) ->> 'hosted_invoice_url') is not null as has_hosted_url,
  to_jsonb(i) ->> 'issue_id' as issue_id,
  -- 0062: the only expected AFTER-difference on legacy invoice rows.
  to_jsonb(i) ->> 'obligation_id' as obligation_id_0062,
  (select count(*) from public.invoice_items ii where ii.invoice_id = i.id) as item_count,
  (select left(md5(coalesce(string_agg(ii.id::text || ':' || ii.name || ':' || ii.amount::text || 'x' || ii.quantity::text, ',' order by ii.id), '')), 12)
     from public.invoice_items ii where ii.invoice_id = i.id) as items_fp
from public.invoices i
where i.tenant_id = current_setting('ns.tenant_id', true)::uuid
order by i.created_at, i.id;

-- ---------------------------------------------------------------------------
-- 10. Invoice balances by status (the client's receivable position)
-- ---------------------------------------------------------------------------
select
  '10_invoice_balances' as section,
  i.status::text as status,
  i.type::text as type,
  count(*) as invoices,
  sum(i.amount) as total_amount,
  sum(case when i.paid_at is not null then i.amount else 0 end) as amount_with_paid_at,
  min(i.due_at) as earliest_due,
  max(i.due_at) as latest_due
from public.invoices i
where i.tenant_id = current_setting('ns.tenant_id', true)::uuid
group by i.status, i.type
order by i.status, i.type;

-- ---------------------------------------------------------------------------
-- 11. Accounting and provider linkage counts (are the links still there?)
-- ---------------------------------------------------------------------------
select
  '11_link_counts' as section,
  (select count(*) from public.invoices i where i.tenant_id = current_setting('ns.tenant_id', true)::uuid and to_jsonb(i) ->> 'xero_invoice_id' is not null) as invoices_with_xero_id,
  (select count(*) from public.invoices i where i.tenant_id = current_setting('ns.tenant_id', true)::uuid and i.stripe_invoice_id is not null) as invoices_with_stripe_id,
  (select count(*) from public.invoices i where i.tenant_id = current_setting('ns.tenant_id', true)::uuid and to_jsonb(i) ->> 'gc_payment_id' is not null) as invoices_with_gc_payment,
  (select count(*) from public.subscriptions s where s.tenant_id = current_setting('ns.tenant_id', true)::uuid and to_jsonb(s) ->> 'gc_mandate_id' is not null) as subscriptions_with_gc_mandate,
  (select count(*) from public.subscriptions s where s.tenant_id = current_setting('ns.tenant_id', true)::uuid and s.stripe_subscription_id is not null) as subscriptions_with_stripe_id,
  (select count(*) from public.subscriptions s where s.tenant_id = current_setting('ns.tenant_id', true)::uuid and s.status::text in ('active', 'trialing', 'past_due')) as live_subscriptions,
  (select count(*) from public.order_forms o where o.tenant_id = current_setting('ns.tenant_id', true)::uuid and o.status = 'accepted') as accepted_order_forms,
  (select count(*) from public.contract_acceptances a where a.tenant_id = current_setting('ns.tenant_id', true)::uuid) as contract_acceptances,
  (select count(*) from public.issues x where x.tenant_id = current_setting('ns.tenant_id', true)::uuid) as issues,
  (select count(*) from public.document_events d where d.tenant_id = current_setting('ns.tenant_id', true)::uuid) as document_events,
  (select count(*) from public.audit_log l where l.tenant_id = current_setting('ns.tenant_id', true)::uuid) as audit_rows_never_fewer;

-- ---------------------------------------------------------------------------
-- 12. Redesign-table footprint for this tenant. BEFORE the migrations these
--     tables do not exist, so this section is guarded: it reports which of the
--     new tables exist and, for those that do, how many rows reference the
--     tenant. Expected AFTER apply, flags off: billing_obligations = number of
--     live legacy build_milestone invoices (0062 backfill); every other = 0.
-- ---------------------------------------------------------------------------
-- Only tables that carry tenant_id are counted. service_schedules and
-- handover_schedules hang off service_arrangements (counted below), and
-- service_activations off the arrangement too; integration_events /
-- integration_operations have no tenant column at all.
with new_tables(name) as (
  values ('opportunities'), ('quotes'), ('client_next_actions'),
         ('service_arrangements'),
         ('build_acceptances'), ('checklist_tasks'), ('handover_tasks'),
         ('billing_obligations'), ('provider_payments'), ('payment_allocations'),
         ('mandates'), ('finance_exceptions')
)
select
  '12_redesign_footprint' as section,
  n.name as table_name,
  exists (
    select 1 from information_schema.tables t
    where t.table_schema = 'public' and t.table_name = n.name
  ) as table_exists,
  case
    when exists (select 1 from information_schema.tables t where t.table_schema = 'public' and t.table_name = n.name)
    then (xpath(
      '/row/c/text()',
      query_to_xml(
        format('select count(*) as c from public.%I where tenant_id = %L::uuid',
               n.name, current_setting('ns.tenant_id', true)),
        false, true, ''
      )
    ))[1]::text::bigint
    else null
  end as rows_for_tenant
from new_tables n
order by n.name;

-- ---------------------------------------------------------------------------
-- 13. Expected differences (documentation row, so the diff reader sees it)
-- ---------------------------------------------------------------------------
select
  '13_expected_after_diff' as section,
  unnest(array[
    '09_invoices.obligation_id_0062: null -> uuid for every non-void build_milestone invoice (0062 backfill; amount/status/ids/dates unchanged)',
    '05_order_forms.commercial_version_0059: null -> v1 (column default; never v2 on a legacy row)',
    '12_redesign_footprint.billing_obligations: rows_for_tenant = live legacy build_milestone invoices; all other new tables 0',
    'Everything else in sections 01-11: identical. Any other difference is a defect to investigate before flags are enabled.'
  ]) as expectation;
