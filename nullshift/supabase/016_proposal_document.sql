-- 016_proposal_document.sql
-- The proposal is now a proper, signable document. Add the light authoring fields
-- the admin fills (overview + payment terms), the DPA detail fields that prepopulate
-- the Data Processing Agreement, and the client's typed signature on acceptance.
alter table public.projects
  add column if not exists overview text,
  add column if not exists payment_terms text,
  add column if not exists dpa_client_country text default 'United Kingdom',
  add column if not exists dpa_client_company_number text,
  add column if not exists dpa_client_registered_address text,
  add column if not exists dpa_personal_data text,
  add column if not exists dpa_special_category boolean default false,
  add column if not exists dpa_special_category_detail text,
  add column if not exists accepted_name text,
  add column if not exists accepted_signature text,
  add column if not exists accepted_at timestamptz;
