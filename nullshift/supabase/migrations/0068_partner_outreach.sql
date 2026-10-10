-- STATUS: APPLIED to Nullshift Ops (cweftpoaojwzllzficgt) on 2026-10-09 as partner_outreach.
-- 0068 — Partner-agency outreach pipeline (/admin/outreach).
--
-- Partner programme (docs/partners/PROGRAMME-BRIEF-2026-10-09.md): a small
-- CRM for the agencies we want as referral / white-label partners. Additive
-- only: nothing here touches leads, opportunities, tenants or billing. A
-- prospect that agrees to partner is converted by staff into whatever the
-- partner agreement needs later; this migration records the outreach only.
--
--   1. `partner_prospects` — one row per agency we are courting. Status is
--      the outreach state (sourced → verified → queued → contacted → replied
--      → call_booked → agreed | declined | parked | unsubscribed).
--      `next_touch_at` drives the "Due today" queue; `parked_until` is set
--      when a sequence ends without a reply (90 days) and the row is parked.
--   2. `partner_touches` — every email / LinkedIn / Instagram message,
--      meeting or internal note, outbound or inbound, against a prospect.
--
-- RLS: staff-only (is_internal_staff()) on both tables, matching 0057/0067;
-- the service role bypasses RLS for the loader reads.
--
-- Rollback:
--   drop table if exists public.partner_touches;
--   drop table if exists public.partner_prospects;

-- ============================================================================
-- partner_prospects
-- ============================================================================

create table if not exists public.partner_prospects (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  website text,
  country text,
  region text,
  agency_type text check (
    agency_type is null
    or agency_type in (
      'growth_consultant',
      'marketing_agency',
      'seo_ppc',
      'design_studio',
      'social_media',
      'accountant',
      'other'
    )
  ),
  -- Free-text size band, e.g. '2-5', '6-10', '11-20'.
  staff_band text,
  contact_name text,
  contact_role text,
  email text,
  linkedin_url text,
  instagram_handle text,
  phone text,
  -- How we found them (directory, referral, LinkedIn search, ...).
  source text,
  fit_notes text,
  -- Staff confirmed the contact details and fit before the sequence starts.
  verified_at timestamptz,
  verified_by text,
  status text not null default 'sourced' check (
    status in (
      'sourced',
      'verified',
      'queued',
      'contacted',
      'replied',
      'call_booked',
      'agreed',
      'declined',
      'parked',
      'unsubscribed'
    )
  ),
  next_touch_at timestamptz,
  parked_until timestamptz,
  owner text,
  tags text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.partner_prospects is
  'Partner-agency outreach prospects (0068). Outreach state only; never a client or billing identity.';

-- One prospect per email address (case-insensitive); rows without an email
-- are allowed and are not deduplicated.
create unique index if not exists partner_prospects_email_unique
  on public.partner_prospects (lower(email))
  where email is not null;

create index if not exists partner_prospects_status_idx
  on public.partner_prospects (status);
create index if not exists partner_prospects_next_touch_idx
  on public.partner_prospects (next_touch_at);

drop trigger if exists trg_partner_prospects_updated on public.partner_prospects;
create trigger trg_partner_prospects_updated
  before update on public.partner_prospects
  for each row execute function public.set_updated_at();

alter table public.partner_prospects enable row level security;

drop policy if exists partner_prospects_staff_all on public.partner_prospects;
create policy partner_prospects_staff_all on public.partner_prospects
  for all to authenticated
  using (public.is_internal_staff())
  with check (public.is_internal_staff());

-- ============================================================================
-- partner_touches
-- ============================================================================

create table if not exists public.partner_touches (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.partner_prospects(id) on delete cascade,
  channel text not null check (
    channel in ('email', 'linkedin', 'instagram', 'meeting', 'note')
  ),
  direction text not null check (direction in ('outbound', 'inbound')),
  subject text,
  body text,
  sent_at timestamptz not null default now(),
  -- Short free-text outcome: 'no reply', 'bounced', 'interested', ...
  outcome text,
  created_by text,
  created_at timestamptz not null default now()
);

comment on table public.partner_touches is
  'Outreach touches against a partner prospect (0068): messages, meetings and notes.';

create index if not exists partner_touches_prospect_idx
  on public.partner_touches (prospect_id, sent_at desc);

alter table public.partner_touches enable row level security;

drop policy if exists partner_touches_staff_all on public.partner_touches;
create policy partner_touches_staff_all on public.partner_touches
  for all to authenticated
  using (public.is_internal_staff())
  with check (public.is_internal_staff());
