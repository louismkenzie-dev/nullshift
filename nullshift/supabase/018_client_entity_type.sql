-- 018_client_entity_type.sql
-- Before signing, the client declares whether they're a limited company. Limited
-- companies must provide their company number + registered office and sign the DPA;
-- sole traders / others sign the proposal only (no separate DPA). null = not asked.
alter table public.projects
  add column if not exists client_entity_type text;
