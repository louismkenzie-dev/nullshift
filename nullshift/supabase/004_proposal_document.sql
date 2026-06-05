-- ============================================================
--  Migration 004 — Proposal document + client acceptance
--  Extends the existing `proposals` row (which already holds the
--  quote / line_items) with the full proposal document fields and
--  the client's signature/acceptance.
--  Run this in Supabase: SQL Editor → New query → paste → Run
-- ============================================================

alter table public.proposals
  add column if not exists project_name      text,
  add column if not exists duration          text,
  add column if not exists platform          text,
  add column if not exists team_size         text,
  add column if not exists overview          text,
  add column if not exists scope             jsonb not null default '[]'::jsonb,  -- [{ phase, items: [] }]
  add column if not exists deliverables      jsonb not null default '[]'::jsonb,  -- [ "..." ]
  add column if not exists timeline          jsonb not null default '[]'::jsonb,  -- [{ week, title, description }]
  add column if not exists accepted_at       timestamptz,
  add column if not exists accepted_name     text,
  add column if not exists accepted_signature text;
