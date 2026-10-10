-- STATUS: APPLIED to Nullshift Ops (cweftpoaojwzllzficgt) on 2026-10-09 as partner_applications.
-- 0069: partner programme applications (docs/partners/PROGRAMME-BRIEF-2026-10-09.md).
--
-- An agency applying to the referral / white-label programme from /partners.
-- One row per application; the partner relationship itself (acceptance,
-- model chosen, agreement version signed) is set up by staff afterwards and
-- is deliberately NOT modelled here — this is the intake, nothing more.
--
-- Submission goes through the service role after rate limiting, so there is
-- no anonymous insert policy (same shape as data_complaints / 0029): an open
-- INSERT policy would let anyone write unbounded rows. Staff read and
-- triage; nobody else sees applications.

create table if not exists public.partner_applications (
  id uuid primary key default gen_random_uuid(),

  agency_name text not null,
  website text,
  country text not null,
  contact_name text not null,
  role text,
  email text not null,
  -- growth_consultancy | marketing_seo_ppc | design_brand | social | accountancy | other
  agency_type text not null,
  -- 1 | 2-5 | 6-20 | 21+
  team_size text not null,
  -- referral | white_label | both
  model_interest text not null check (model_interest in ('referral', 'white_label', 'both')),
  client_types text,
  message text,

  status text not null default 'new' check (
    status in ('new', 'reviewing', 'accepted', 'declined', 'archived')
  ),
  notes text,

  created_ip inet,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists partner_applications_status_created_idx
  on public.partner_applications (status, created_at desc);

create index if not exists partner_applications_email_idx
  on public.partner_applications (lower(email));

alter table public.partner_applications enable row level security;

drop policy if exists partner_applications_staff_read on public.partner_applications;
create policy partner_applications_staff_read on public.partner_applications
  for select using (is_internal_staff());

drop policy if exists partner_applications_staff_update on public.partner_applications;
create policy partner_applications_staff_update on public.partner_applications
  for update using (is_internal_staff()) with check (is_internal_staff());
