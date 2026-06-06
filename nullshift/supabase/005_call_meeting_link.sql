-- ============================================================
--  Migration 005 — Add meeting link to calls
--  Run in Supabase: SQL Editor → New query → paste → Run
-- ============================================================

alter table public.calls add column if not exists meeting_link     text;
alter table public.calls add column if not exists meeting_id       text;
alter table public.calls add column if not exists meeting_password text;
