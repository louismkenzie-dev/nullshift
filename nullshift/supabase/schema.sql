-- ============================================================
--  Nullshift admin portal — database schema
--  Run this in your Supabase project: SQL Editor → New query → paste → Run
-- ============================================================

-- Extensions
create extension if not exists "pgcrypto";

-- ---------- ENQUIRIES (public contact + booking forms) ----------
create table if not exists public.enquiries (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  source        text not null default 'contact',  -- 'contact' | 'booking' | 'brief'
  name          text not null,
  business_name text,
  email         text not null,
  phone         text,
  message       text,
  -- booking-only fields
  preferred_date text,
  preferred_time text,
  referral       text,
  -- 5-step client brief (intake form) submission
  brief_data    jsonb,
  -- Optional link to an existing client (when admin invites them to fill the brief).
  client_id     uuid references public.clients(id) on delete set null,
  status        text not null default 'new'        -- new | in_progress | quoted | won | lost
);

-- Idempotent column additions for existing deployments.
alter table public.enquiries add column if not exists brief_data jsonb;
alter table public.enquiries add column if not exists client_id uuid references public.clients(id) on delete set null;

-- ---------- CLIENTS ----------
create table if not exists public.clients (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  name          text not null,
  business_name text,
  email         text,
  phone         text,
  notes         text,
  status        text not null default 'lead',      -- lead | active | complete
  -- Preferred call slot carried over when an enquiry is converted.
  requested_date text,                              -- "YYYY-MM-DD"
  requested_time text,                              -- "morning" | "afternoon" | "evening"
  -- Stamped when the client submits the brief intake form.
  brief_completed_at timestamptz
);

-- Idempotent column addition for existing deployments.
alter table public.clients add column if not exists brief_completed_at timestamptz;

-- ---------- PROPOSALS / QUOTES ----------
create table if not exists public.proposals (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  client_id     uuid references public.clients(id) on delete set null,
  enquiry_id    uuid references public.enquiries(id) on delete set null,
  title         text not null,
  summary       text,
  line_items    jsonb not null default '[]'::jsonb, -- [{label, qty, unit_price}]
  currency      text not null default 'GBP',
  total         numeric not null default 0,
  status        text not null default 'draft',      -- draft | sent | accepted | declined
  sent_to       text,
  sent_at       timestamptz
);

-- ---------- BRAND GUIDELINES (per client) ----------
create table if not exists public.brand_guidelines (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  client_id     uuid references public.clients(id) on delete cascade,
  brand_name    text,
  tagline       text,
  mission       text,
  -- flexible JSON blobs so the form can grow without migrations
  colours       jsonb not null default '[]'::jsonb,  -- [{name, hex, role}]
  typography    jsonb not null default '[]'::jsonb,  -- [{role, font, weights, usage}]
  voice         text,
  dos_donts     jsonb not null default '{"dos":[],"donts":[]}'::jsonb,
  notes         text
);

-- ---------- CALLS (discovery calls booked from a client profile) ----------
create table if not exists public.calls (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  client_id    uuid references public.clients(id) on delete cascade,
  -- Stored as London (Europe/London) wall-clock values — Nullshift is UK-based.
  call_date    date not null,          -- YYYY-MM-DD
  call_time    text not null,          -- "HH:MM" 24h, London local
  duration_min int  not null default 30,
  status       text not null default 'confirmed',  -- confirmed | completed | cancelled
  notes        text
);
create index if not exists calls_client_id_idx on public.calls (client_id);
create index if not exists calls_date_idx       on public.calls (call_date);

-- ============================================================
--  Row Level Security
--  Public can INSERT enquiries (the website forms). Everything else is
--  locked to authenticated admins only. The server uses the service-role
--  key for trusted reads/writes, which bypasses RLS.
-- ============================================================
alter table public.enquiries        enable row level security;
alter table public.clients          enable row level security;
alter table public.proposals        enable row level security;
alter table public.brand_guidelines enable row level security;
alter table public.calls            enable row level security;

-- Anonymous visitors may submit an enquiry, nothing else.
drop policy if exists "anon insert enquiries" on public.enquiries;
create policy "anon insert enquiries"
  on public.enquiries for insert
  to anon
  with check (true);

-- Authenticated (logged-in admin) users have full access to everything.
do $$
declare t text;
begin
  foreach t in array array['enquiries','clients','proposals','brand_guidelines','calls']
  loop
    execute format('drop policy if exists "auth all %1$s" on public.%1$s;', t);
    execute format(
      'create policy "auth all %1$s" on public.%1$s for all to authenticated using (true) with check (true);',
      t
    );
  end loop;
end $$;
