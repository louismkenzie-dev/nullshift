-- STATUS: NOT YET APPLIED. Number the ledger entry against `schema_migrations`
-- before applying (Phase 0 decision N-h).
-- 0076 — Nullshift Plans: white-label AI systems-plan lead magnet.
--
-- Additive only. Depends on 0072.
--
--   1. `plan_embeds` — one per questionnaire a partner publishes. `brand`
--      holds the partner's name, services, colour and tone; the plan is
--      written in THEIR voice. `public_key` goes in the embed tag.
--   2. `plan_leads` — a visitor who completed the questionnaire. `plan` is
--      the generated JSON; `token` is the capability that opens the hosted
--      plan page (/p/<key>/plan/<token>). Cost is logged per lead so the
--      monthly allowance and overage can be reported.
--
-- RLS: members read/write their own. Public routes use the service role
-- after resolving the key and checking the partner's entitlement.
--
-- Rollback:
--   drop table if exists public.plan_leads;
--   drop table if exists public.plan_embeds;

create table if not exists public.plan_embeds (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  public_key text not null unique,
  name text not null default 'Systems plan',
  brand jsonb not null default '{}'::jsonb,
  intro text,
  notify_email text,
  active boolean not null default true,
  hide_powered_by boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists plan_embeds_tenant_idx on public.plan_embeds (tenant_id);

drop trigger if exists plan_embeds_updated_at on public.plan_embeds;
create trigger plan_embeds_updated_at
  before update on public.plan_embeds
  for each row execute function public.set_updated_at();

alter table public.plan_embeds enable row level security;
drop policy if exists plan_embeds_member_all on public.plan_embeds;
create policy plan_embeds_member_all on public.plan_embeds
  for all to authenticated
  using (public.is_member_of(tenant_id) or public.is_internal_staff())
  with check (public.is_member_of(tenant_id) or public.is_internal_staff());

create table if not exists public.plan_leads (
  id uuid primary key default gen_random_uuid(),
  embed_id uuid not null references public.plan_embeds (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  token text not null unique,
  name text not null,
  email text not null,
  phone text,
  business_name text not null,
  answers jsonb not null default '{}'::jsonb,
  plan jsonb,
  status text not null default 'pending' check (status in ('pending', 'generating', 'ready', 'failed')),
  error text,
  model text,
  input_tokens integer,
  output_tokens integer,
  cost_usd numeric(10, 4),
  lead_status text not null default 'new' check (lead_status in ('new', 'contacted', 'meeting', 'won', 'lost')),
  source_url text,
  ip_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists plan_leads_tenant_idx on public.plan_leads (tenant_id, created_at desc);
create index if not exists plan_leads_embed_idx on public.plan_leads (embed_id, created_at desc);

drop trigger if exists plan_leads_updated_at on public.plan_leads;
create trigger plan_leads_updated_at
  before update on public.plan_leads
  for each row execute function public.set_updated_at();

alter table public.plan_leads enable row level security;
drop policy if exists plan_leads_member_all on public.plan_leads;
create policy plan_leads_member_all on public.plan_leads
  for all to authenticated
  using (public.is_member_of(tenant_id) or public.is_internal_staff())
  with check (public.is_member_of(tenant_id) or public.is_internal_staff());

comment on table public.plan_embeds is 'Nullshift Plans (self-serve product): white-label questionnaire + brand for AI-written systems plans.';
comment on table public.plan_leads is 'Visitors who completed a Plans questionnaire; generated plan JSON + token for the hosted plan page.';
