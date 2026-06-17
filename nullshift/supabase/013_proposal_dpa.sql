-- ============================================================
--  Migration 013 — Data Processing Agreement fields on proposals
--  A DPA is per-engagement, so its variable fields live on the
--  proposal. The client signs the proposal once; that signature
--  also accepts the attached DPA (rendered at /proposal/<id>/dpa).
--
--  Pre-populated automatically (no column needed): the effective
--  date (= acceptance date) and the five authorised sub-processors
--  (Supabase, AWS, Stripe, Vercel, Resend) — see lib/legalEntity.ts.
--
--  Run this in Supabase: SQL Editor → New query → paste → Run
-- ============================================================

alter table public.proposals
  add column if not exists dpa_enabled                 boolean not null default true,
  add column if not exists dpa_client_country          text not null default 'United Kingdom',
  add column if not exists dpa_client_company_number   text,
  add column if not exists dpa_client_registered_address text,
  add column if not exists dpa_personal_data           text,   -- Annex 1: types of personal data
  add column if not exists dpa_special_category        boolean not null default false,
  add column if not exists dpa_special_category_detail text;   -- which data + category, when special = true
