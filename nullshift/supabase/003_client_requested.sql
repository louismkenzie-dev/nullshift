-- ============================================================
--  Migration 003 — Carry the enquiry's requested call slot onto
--  the client, so the Book Call panel can pre-fill it.
--  Run this in Supabase: SQL Editor → New query → paste → Run
-- ============================================================

alter table public.clients
  add column if not exists requested_date text,   -- "YYYY-MM-DD" from the booking form
  add column if not exists requested_time text;   -- "morning" | "afternoon" | "evening" (or free text)
