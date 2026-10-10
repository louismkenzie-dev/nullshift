-- STATUS: NOT YET APPLIED. Number the ledger entry against `schema_migrations`
-- before applying (Phase 0 decision N-h).
-- 0077 — Nullshift Studio: white-label proposals, acceptance and invoices.
--
-- Additive only. Depends on 0072. A simplified, self-serve cousin of the
-- bespoke lifecycle (0009/0030) — deliberately its own tables so the two can
-- never bleed into each other.
--
--   1. `studio_profiles` — one per workspace: brand, default terms, bank
--      details or a payment link, VAT, invoice numbering.
--   2. `studio_clients` — the agency's clients. `token` is the private link
--      (/c/<token>) a client opens; no account needed. Regenerating it
--      revokes the old link.
--   3. `studio_notes` — private notes against a client.
--   4. `studio_proposals` — line items + scope + terms. On acceptance the
--      exact content is frozen into `snapshot` with a SHA-256 over canonical
--      JSON (lib/legal/acceptanceSnapshot.ts), with the typed name, time and
--      hashed IP — the evidence an e-signature needs.
--   5. `studio_invoices` — generated from an accepted proposal or by hand.
--      Money never passes through Nullshift: bank transfer or the agency's
--      own payment link.
--
-- RLS: members manage their own tenant's rows. Client-link pages use the
-- service role after resolving the token and checking the owner's entitlement.
--
-- Rollback:
--   drop table if exists public.studio_invoices;
--   drop table if exists public.studio_proposals;
--   drop table if exists public.studio_notes;
--   drop table if exists public.studio_clients;
--   drop table if exists public.studio_profiles;

create table if not exists public.studio_profiles (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,
  brand jsonb not null default '{}'::jsonb,
  default_terms text,
  bank jsonb not null default '{}'::jsonb,
  payment_link_url text,
  vat jsonb not null default '{"registered":false,"ratePct":20,"number":""}'::jsonb,
  invoice_prefix text not null default 'INV-',
  next_invoice_no integer not null default 1,
  proposal_prefix text not null default 'P-',
  next_proposal_no integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists studio_profiles_updated_at on public.studio_profiles;
create trigger studio_profiles_updated_at before update on public.studio_profiles for each row execute function public.set_updated_at();
alter table public.studio_profiles enable row level security;
drop policy if exists studio_profiles_member_all on public.studio_profiles;
create policy studio_profiles_member_all on public.studio_profiles for all to authenticated
  using (public.is_member_of(tenant_id) or public.is_internal_staff())
  with check (public.is_member_of(tenant_id) or public.is_internal_staff());

create table if not exists public.studio_clients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  token text not null unique,
  name text not null,
  company text,
  email text not null,
  phone text,
  address text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists studio_clients_tenant_idx on public.studio_clients (tenant_id);
drop trigger if exists studio_clients_updated_at on public.studio_clients;
create trigger studio_clients_updated_at before update on public.studio_clients for each row execute function public.set_updated_at();
alter table public.studio_clients enable row level security;
drop policy if exists studio_clients_member_all on public.studio_clients;
create policy studio_clients_member_all on public.studio_clients for all to authenticated
  using (public.is_member_of(tenant_id) or public.is_internal_staff())
  with check (public.is_member_of(tenant_id) or public.is_internal_staff());

create table if not exists public.studio_notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  client_id uuid not null references public.studio_clients (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists studio_notes_client_idx on public.studio_notes (client_id, created_at desc);
alter table public.studio_notes enable row level security;
drop policy if exists studio_notes_member_all on public.studio_notes;
create policy studio_notes_member_all on public.studio_notes for all to authenticated
  using (public.is_member_of(tenant_id) or public.is_internal_staff())
  with check (public.is_member_of(tenant_id) or public.is_internal_staff());

create table if not exists public.studio_proposals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  client_id uuid not null references public.studio_clients (id) on delete cascade,
  number text not null,
  title text not null default 'Proposal',
  intro text,
  scope text,
  items jsonb not null default '[]'::jsonb,
  terms text,
  valid_until date,
  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'declined', 'expired')),
  sent_at timestamptz,
  accepted_at timestamptz,
  accepted_name text,
  accepted_ip_hash text,
  accepted_hash text,
  snapshot jsonb,
  declined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists studio_proposals_tenant_idx on public.studio_proposals (tenant_id, created_at desc);
create index if not exists studio_proposals_client_idx on public.studio_proposals (client_id);
drop trigger if exists studio_proposals_updated_at on public.studio_proposals;
create trigger studio_proposals_updated_at before update on public.studio_proposals for each row execute function public.set_updated_at();
alter table public.studio_proposals enable row level security;
drop policy if exists studio_proposals_member_all on public.studio_proposals;
create policy studio_proposals_member_all on public.studio_proposals for all to authenticated
  using (public.is_member_of(tenant_id) or public.is_internal_staff())
  with check (public.is_member_of(tenant_id) or public.is_internal_staff());

create table if not exists public.studio_invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  client_id uuid not null references public.studio_clients (id) on delete cascade,
  proposal_id uuid references public.studio_proposals (id) on delete set null,
  number text not null,
  items jsonb not null default '[]'::jsonb,
  notes text,
  issued_on date not null default current_date,
  due_on date,
  vat_pct numeric(5, 2) not null default 0,
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid', 'void')),
  sent_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists studio_invoices_tenant_idx on public.studio_invoices (tenant_id, created_at desc);
create index if not exists studio_invoices_client_idx on public.studio_invoices (client_id);
drop trigger if exists studio_invoices_updated_at on public.studio_invoices;
create trigger studio_invoices_updated_at before update on public.studio_invoices for each row execute function public.set_updated_at();
alter table public.studio_invoices enable row level security;
drop policy if exists studio_invoices_member_all on public.studio_invoices;
create policy studio_invoices_member_all on public.studio_invoices for all to authenticated
  using (public.is_member_of(tenant_id) or public.is_internal_staff())
  with check (public.is_member_of(tenant_id) or public.is_internal_staff());

comment on table public.studio_proposals is 'Nullshift Studio (self-serve product): proposals; accepted content frozen in snapshot + accepted_hash.';
comment on table public.studio_invoices is 'Nullshift Studio invoices; money is settled outside Nullshift (bank transfer or the agency''s own payment link).';
