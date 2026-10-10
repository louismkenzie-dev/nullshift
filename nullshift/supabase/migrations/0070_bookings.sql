-- STATUS: APPLIED to Nullshift Ops (cweftpoaojwzllzficgt) on 2026-10-09 as bookings.
-- 0070 — Call booking (replaces the external Cal.com link).
--
-- Louis sets his availability in the admin app (/admin/calendar/availability);
-- clients and partner agencies pick a slot on the website (/book/call,
-- /book/partner). Additive only: the legacy `calls` table (002, re-keyed to
-- tenants) is untouched and is still read as "busy" when slots are generated.
--
--   1. `availability_rules`      — weekly windows (Mon=0 … Sun=6), London time.
--   2. `availability_exceptions` — blocked dates or partial-day blocks.
--   3. `booking_settings`        — single row: timezone, notice, horizon, buffer,
--                                  the meeting link pasted into confirmations.
--   4. `bookings`                — confirmed slots booked from the website.
--
-- RLS: staff-only (is_internal_staff()) on every table; the public never reads
-- any of them. Website inserts and slot queries go through the service role
-- in apps/web/app/api/bookings/*. Cancellation is by unguessable cancel_token.
--
-- Rollback:
--   drop table if exists public.bookings;
--   drop table if exists public.booking_settings;
--   drop table if exists public.availability_exceptions;
--   drop table if exists public.availability_rules;

-- ============================================================================
-- availability_rules
-- ============================================================================

create table if not exists public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  -- 0 = Monday … 6 = Sunday (ISO order, matching the admin calendar grid).
  weekday integer not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  slot_minutes integer not null default 30 check (slot_minutes between 5 and 480),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);

comment on table public.availability_rules is
  'Weekly booking windows in Europe/London wall-clock time (0070). weekday 0 = Monday.';

create index if not exists availability_rules_weekday_idx
  on public.availability_rules (weekday) where active;

alter table public.availability_rules enable row level security;

drop policy if exists availability_rules_staff on public.availability_rules;
create policy availability_rules_staff on public.availability_rules
  for all to authenticated
  using (public.is_internal_staff())
  with check (public.is_internal_staff());

-- ============================================================================
-- availability_exceptions
-- ============================================================================

create table if not exists public.availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  -- Both null = the whole day is blocked. Otherwise the [start, end) window is.
  start_time time,
  end_time time,
  reason text,
  created_at timestamptz not null default now(),
  check ((start_time is null and end_time is null) or (start_time is not null and end_time is not null and end_time > start_time))
);

comment on table public.availability_exceptions is
  'Dates (or part-days) removed from booking availability (0070). London wall-clock.';

create index if not exists availability_exceptions_date_idx
  on public.availability_exceptions (date);

alter table public.availability_exceptions enable row level security;

drop policy if exists availability_exceptions_staff on public.availability_exceptions;
create policy availability_exceptions_staff on public.availability_exceptions
  for all to authenticated
  using (public.is_internal_staff())
  with check (public.is_internal_staff());

-- ============================================================================
-- booking_settings — single row
-- ============================================================================

create table if not exists public.booking_settings (
  id integer primary key default 1 check (id = 1),
  timezone text not null default 'Europe/London',
  min_notice_hours integer not null default 12 check (min_notice_hours between 0 and 720),
  max_days_ahead integer not null default 30 check (max_days_ahead between 1 and 365),
  buffer_minutes integer not null default 15 check (buffer_minutes between 0 and 240),
  -- Teams / Meet link pasted by Louis; sent in every confirmation.
  meeting_link text,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

comment on table public.booking_settings is
  'Single-row booking configuration (0070). active=false hides every slot on the website.';

drop trigger if exists trg_booking_settings_updated on public.booking_settings;
create trigger trg_booking_settings_updated
  before update on public.booking_settings
  for each row execute function public.set_updated_at();

alter table public.booking_settings enable row level security;

drop policy if exists booking_settings_staff on public.booking_settings;
create policy booking_settings_staff on public.booking_settings
  for all to authenticated
  using (public.is_internal_staff())
  with check (public.is_internal_staff());

insert into public.booking_settings (id) values (1) on conflict (id) do nothing;

-- ============================================================================
-- bookings
-- ============================================================================

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('client', 'partner')),
  name text not null,
  email text not null,
  company text,
  website text,
  phone text,
  notes text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'confirmed'
    check (status in ('confirmed', 'cancelled', 'completed', 'no_show')),
  -- Unguessable token in the cancellation link; never shown in the admin.
  cancel_token text not null unique,
  source text,
  -- Outreach prospect this booking came from (0068 may not exist yet: no FK).
  prospect_id uuid,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

comment on table public.bookings is
  'Calls booked from the website (0070). Inserted by the service role; staff read/update.';

create index if not exists bookings_starts_at_idx on public.bookings (starts_at);
create index if not exists bookings_email_idx on public.bookings (lower(email));

drop trigger if exists trg_bookings_updated on public.bookings;
create trigger trg_bookings_updated
  before update on public.bookings
  for each row execute function public.set_updated_at();

alter table public.bookings enable row level security;

drop policy if exists bookings_staff on public.bookings;
create policy bookings_staff on public.bookings
  for all to authenticated
  using (public.is_internal_staff())
  with check (public.is_internal_staff());

-- ============================================================================
-- Seed: Mon–Fri 10:00–12:00 and 14:00–17:00, 30-minute slots. Louis edits these.
-- ============================================================================

insert into public.availability_rules (weekday, start_time, end_time, slot_minutes)
select d, t.s, t.e, 30
from generate_series(0, 4) as d
cross join (values ('10:00'::time, '12:00'::time), ('14:00'::time, '17:00'::time)) as t(s, e)
where not exists (select 1 from public.availability_rules);
