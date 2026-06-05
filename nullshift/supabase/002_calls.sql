-- ============================================================
--  Migration 002 — Booked calls (Call Calendar)
--  Run this in Supabase: SQL Editor → New query → paste → Run
-- ============================================================

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

-- ---------- Row Level Security ----------
alter table public.calls enable row level security;

-- Authenticated admins have full access; the server also uses the
-- service-role key which bypasses RLS.
drop policy if exists "auth all calls" on public.calls;
create policy "auth all calls"
  on public.calls for all
  to authenticated
  using (true) with check (true);
