-- STATUS: NOT YET APPLIED. Number the ledger entry against `schema_migrations`
-- before applying (Phase 0 decision N-h).
-- 0074 — Nullshift Legal: generated, hosted Privacy / Cookie / Terms documents.
--
-- Additive only. Depends on 0072.
--
--   `legal_sites` — one row per website a workspace covers. `facts` is the
--   LegalFacts answer set (apps/web/lib/legal-docs/facts.ts); documents are
--   generated from it at request time, so a template fix reaches every
--   customer at once. `version` increments and `content_hash` changes
--   whenever the generated text changes; `history` keeps the last entries.
--   `slug` is the public path (/l/<slug>/privacy …).
--
-- RLS: members manage their own; the hosted pages read via service role after
-- checking the owner's entitlement.
--
-- Rollback: drop table if exists public.legal_sites;

create table if not exists public.legal_sites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,47}$'),
  facts jsonb not null default '{}'::jsonb,
  brand jsonb not null default '{"colour":"#10b981"}'::jsonb,
  version integer not null default 1,
  content_hash text,
  template_version text,
  published boolean not null default false,
  history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists legal_sites_tenant_idx on public.legal_sites (tenant_id);

drop trigger if exists legal_sites_updated_at on public.legal_sites;
create trigger legal_sites_updated_at
  before update on public.legal_sites
  for each row execute function public.set_updated_at();

alter table public.legal_sites enable row level security;
drop policy if exists legal_sites_member_all on public.legal_sites;
create policy legal_sites_member_all on public.legal_sites
  for all to authenticated
  using (public.is_member_of(tenant_id) or public.is_internal_staff())
  with check (public.is_member_of(tenant_id) or public.is_internal_staff());

comment on table public.legal_sites is 'Nullshift Legal (self-serve product): facts → generated hosted legal documents at /l/<slug>/.';
