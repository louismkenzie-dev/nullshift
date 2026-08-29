-- 0020: commit the two hand-applied production columns the DPA/proposal-signing
-- flow depends on (verified live 2026-08-18: present in prod, absent from every
-- SQL file in the repo). Without these, a fresh environment breaks
-- dpaReadyToSend, the portal DPA declaration, proposal acceptance, and the
-- proposal/DPA PDF routes.
--
-- Types match production exactly (both nullable, no defaults).

alter table public.projects
  add column if not exists dpa_client_company_name text,
  add column if not exists dpa_client_submitted_at timestamptz;
