-- STATUS: NOT YET APPLIED. Number the ledger entry against `schema_migrations`
-- before applying (Phase 0 decision N-h).
-- 0075 — Nullshift Watch: external website monitoring.
--
-- Additive only. Depends on 0072.
--
--   1. `monitored_sites` — one row per URL a workspace watches. Carries the
--      current rolled-up state (status, consecutive failures, SSL expiry,
--      latest speed scores, broken links) so the console never has to
--      aggregate `site_checks` on render.
--   2. `site_checks` — the raw log, one row per check. Pruned to 90 days by
--      the tick cron.
--
-- Checks run from /api/cron/watch-tick (every 15 minutes) under the service
-- role; members read their own rows. Nothing is installed on the watched site.
--
-- Rollback:
--   drop table if exists public.site_checks;
--   drop table if exists public.monitored_sites;

create table if not exists public.monitored_sites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  url text not null,
  label text not null,
  client_email text,
  alert_email text,
  checks jsonb not null default '{"uptime":true,"ssl":true,"links":true,"speed":true}'::jsonb,
  active boolean not null default true,
  status text not null default 'unknown' check (status in ('up', 'down', 'unknown')),
  consecutive_failures integer not null default 0,
  last_checked_at timestamptz,
  last_down_at timestamptz,
  last_alert_at timestamptz,
  ssl_expires_at timestamptz,
  ssl_checked_at timestamptz,
  ssl_alerted_at timestamptz,
  speed_mobile integer,
  speed_desktop integer,
  speed_checked_at timestamptz,
  links_checked_at timestamptz,
  broken_links jsonb not null default '[]'::jsonb,
  last_report_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists monitored_sites_tenant_idx on public.monitored_sites (tenant_id);
create index if not exists monitored_sites_active_idx on public.monitored_sites (active) where active;

drop trigger if exists monitored_sites_updated_at on public.monitored_sites;
create trigger monitored_sites_updated_at
  before update on public.monitored_sites
  for each row execute function public.set_updated_at();

alter table public.monitored_sites enable row level security;
drop policy if exists monitored_sites_member_all on public.monitored_sites;
create policy monitored_sites_member_all on public.monitored_sites
  for all to authenticated
  using (public.is_member_of(tenant_id) or public.is_internal_staff())
  with check (public.is_member_of(tenant_id) or public.is_internal_staff());

create table if not exists public.site_checks (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.monitored_sites (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  kind text not null check (kind in ('uptime', 'ssl', 'links', 'speed')),
  ok boolean not null,
  status_code integer,
  ms integer,
  details jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now()
);
create index if not exists site_checks_site_idx on public.site_checks (site_id, kind, checked_at desc);
create index if not exists site_checks_checked_idx on public.site_checks (checked_at);

alter table public.site_checks enable row level security;
drop policy if exists site_checks_member_select on public.site_checks;
create policy site_checks_member_select on public.site_checks
  for select to authenticated
  using (public.is_member_of(tenant_id) or public.is_internal_staff());

comment on table public.monitored_sites is 'Nullshift Watch (self-serve product): URLs under external monitoring with rolled-up state.';
comment on table public.site_checks is 'Raw check log for Nullshift Watch; pruned to 90 days.';
