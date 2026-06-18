-- ============================================================================
-- Client lifecycle: proposals, project notes, itemised invoicing.
--
-- The lifecycle is: inquiry (lead) → call → client portal (tenant + membership)
-- → we suggest a PROJECT made of itemised build modules (project_items) → the
-- client accepts the proposal + signs the DPA → they suggest build edits
-- (change_requests) → admin keeps a notes timeline + status per project. An
-- itemised INVOICE is generated from the build modules and sent to collect
-- payment.
-- ============================================================================

create type project_item_status as enum ('proposed', 'accepted', 'built');

-- Itemised build modules per project — these are BOTH the proposal lines and the
-- source of invoice line items (e.g. "Booking system £500", "Records £500").
create table project_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  project_id uuid not null,
  name text not null,
  description text,
  amount numeric(10, 2) not null default 0,
  status project_item_status not null default 'proposed',
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_items_project_tenant_fk
    foreign key (project_id, tenant_id) references projects (id, tenant_id) on delete cascade
);
create index project_items_project_idx on project_items (project_id);
create index project_items_tenant_idx on project_items (tenant_id);
create trigger trg_project_items_updated before update on project_items
  for each row execute function set_updated_at();

-- Admin notes timeline per project (internal — clients never see these).
create table project_notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  project_id uuid not null,
  author uuid references auth.users (id) on delete set null,
  body text not null,
  created_at timestamptz not null default now(),
  constraint project_notes_project_tenant_fk
    foreign key (project_id, tenant_id) references projects (id, tenant_id) on delete cascade
);
create index project_notes_project_idx on project_notes (project_id);

-- Invoice line items — an invoice is now itemised.
create table invoice_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  invoice_id uuid not null references invoices (id) on delete cascade,
  name text not null,
  amount numeric(10, 2) not null default 0,
  quantity int not null default 1,
  created_at timestamptz not null default now()
);
create index invoice_items_invoice_idx on invoice_items (invoice_id);
create index invoice_items_tenant_idx on invoice_items (tenant_id);

-- Proposal state on the project itself.
alter table projects add column proposal_status text not null default 'draft'
  check (proposal_status in ('draft', 'sent', 'accepted', 'declined'));
alter table projects add column proposal_sent_at timestamptz;

-- Itemised invoices: a Stripe hosted payment URL to send the client, and a count.
alter table invoices add column if not exists hosted_invoice_url text;
alter table invoices add column if not exists project_item_count int;

-- ── RLS ────────────────────────────────────────────────────────────────────
alter table project_items enable row level security;
alter table project_notes enable row level security;
alter table invoice_items enable row level security;

-- project_items: client sees their tenant's (the proposal); staff full.
create policy project_items_select on project_items for select to authenticated
  using (is_member_of(tenant_id) or is_internal_staff());
create policy project_items_write_staff on project_items for all to authenticated
  using (is_internal_staff()) with check (is_internal_staff());

-- project_notes: internal staff only.
create policy project_notes_staff_all on project_notes for all to authenticated
  using (is_internal_staff()) with check (is_internal_staff());

-- invoice_items: client sees their tenant's; staff full.
create policy invoice_items_select on invoice_items for select to authenticated
  using (is_member_of(tenant_id) or is_internal_staff());
create policy invoice_items_write_staff on invoice_items for all to authenticated
  using (is_internal_staff()) with check (is_internal_staff());
