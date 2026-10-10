-- STATUS: NOT YET APPLIED. Number the ledger entry against `schema_migrations`
-- before applying (Phase 0 decision N-h).
-- 0073 — Nullshift Quote: embeddable instant-quote widget for trades.
--
-- Additive only. Depends on 0072 (self-serve foundation).
--
--   1. `quote_widgets` — one row per widget a workspace publishes. `config`
--      is the validated WidgetConfig (apps/web/lib/quote-widget/engine.ts):
--      services, questions, margins, branding. `public_key` is the embed key
--      carried in the script tag; it grants read of the config only.
--   2. `widget_leads` — a customer who answered the questions and left their
--      details. The price range is computed server-side at insert and frozen.
--
-- RLS: members read/write their own tenant's widgets and leads. Public
-- visitors never hold a session: the widget routes use the service role after
-- resolving the public key and checking the owner's entitlement.
--
-- Rollback:
--   drop table if exists public.widget_leads;
--   drop table if exists public.quote_widgets;

create table if not exists public.quote_widgets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  public_key text not null unique,
  name text not null default 'My quote widget',
  config jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  notify_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists quote_widgets_tenant_idx on public.quote_widgets (tenant_id);

drop trigger if exists quote_widgets_updated_at on public.quote_widgets;
create trigger quote_widgets_updated_at
  before update on public.quote_widgets
  for each row execute function public.set_updated_at();

alter table public.quote_widgets enable row level security;
drop policy if exists quote_widgets_member_all on public.quote_widgets;
create policy quote_widgets_member_all on public.quote_widgets
  for all to authenticated
  using (public.is_member_of(tenant_id) or public.is_internal_staff())
  with check (public.is_member_of(tenant_id) or public.is_internal_staff());

create table if not exists public.widget_leads (
  id uuid primary key default gen_random_uuid(),
  widget_id uuid not null references public.quote_widgets (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  email text not null,
  phone text,
  postcode text,
  message text,
  service_id text not null,
  service_name text not null,
  quantity integer not null default 1,
  answers jsonb not null default '[]'::jsonb,
  low_pence integer not null,
  base_pence integer not null,
  high_pence integer not null,
  status text not null default 'new' check (status in ('new', 'contacted', 'quoted', 'won', 'lost')),
  source_url text,
  ip_hash text,
  created_at timestamptz not null default now()
);
create index if not exists widget_leads_tenant_idx on public.widget_leads (tenant_id, created_at desc);
create index if not exists widget_leads_widget_idx on public.widget_leads (widget_id, created_at desc);

alter table public.widget_leads enable row level security;
drop policy if exists widget_leads_member_all on public.widget_leads;
create policy widget_leads_member_all on public.widget_leads
  for all to authenticated
  using (public.is_member_of(tenant_id) or public.is_internal_staff())
  with check (public.is_member_of(tenant_id) or public.is_internal_staff());

comment on table public.quote_widgets is 'Nullshift Quote widgets (self-serve product). config = validated WidgetConfig.';
comment on table public.widget_leads is 'Leads captured by a quote widget; price range frozen at insert from the server-side estimate.';
