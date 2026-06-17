-- ============================================================================
-- Phase 1 — Seed the internal Nullshift tenant + best-effort backfill from the
-- legacy single-tenant tables. Idempotent-ish: guarded so re-running is safe.
-- ============================================================================

-- Internal tenant (Nullshift itself). Referenced by subquery — never hardcode ids.
insert into tenants (name, type, status, vertical)
select 'Nullshift', 'internal', 'active', null
where not exists (select 1 from tenants where type = 'internal');

-- Backfill leads from funnel/enquiry rows into the internal pipeline.
insert into leads (tenant_id, name, email, source, vertical, status, notes, quiz_answers, lead_score, created_at)
select
  (select id from tenants where type = 'internal' limit 1),
  e.name,
  e.email,
  coalesce(e.source, 'enquiry'),
  nullif(e.funnel_data -> 'answers' ->> 'industry', ''),
  case e.status
    when 'new' then 'new'::lead_status
    when 'in_progress' then 'qualified'::lead_status
    when 'quoted' then 'qualified'::lead_status
    when 'won' then 'won'::lead_status
    when 'lost' then 'lost'::lead_status
    else 'new'::lead_status
  end,
  null,
  e.funnel_data,
  e.lead_score,
  e.created_at
from enquiries e
where not exists (
  -- don't double-import on re-run (match on email + created_at)
  select 1 from leads l
  where l.email is not distinct from e.email and l.created_at = e.created_at
);

-- Backfill a client tenant per legacy client.
insert into tenants (name, type, status, created_at)
select coalesce(nullif(c.business_name, ''), c.name, 'Client'), 'client', 'active', c.created_at
from clients c
where not exists (
  select 1 from tenants t where t.type = 'client' and t.name = coalesce(nullif(c.business_name, ''), c.name, 'Client')
);
