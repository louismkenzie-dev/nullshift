-- Business vault (2026-09-11)  [file 0052; applied as business_records + business_records_vault_functions]
--
-- Null Shift's own sensitive references — HMRC UTR, Companies House auth
-- code, insurance policy numbers, account references. Name and value.
--
-- The value is NEVER stored in this table. It goes into Supabase Vault, whose
-- encryption key lives outside the database, so a database dump (or anyone
-- reading this table) yields ciphertext and nothing else. This table holds
-- only the label, an optional note, and a four-character hint so a person can
-- tell two records apart without revealing either.
--
-- Deliberately different from system_profiles.routine_token and
-- calls.meeting_password, which are plaintext columns — those are on the
-- backlog to move here (OPS-HUB-AUDIT-2026-09-04 §B.5).
create table if not exists public.business_records (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  note          text,
  -- The Vault row holding the value. Null only if a Vault write failed, in
  -- which case the record shows as broken rather than silently empty.
  secret_id     uuid,
  -- Last four characters of the value, for identification only.
  hint          text,
  created_by    text,
  updated_by    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  last_revealed_at timestamptz,
  last_revealed_by text
);

-- One record per label, case-insensitively: "HMRC UTR" and "hmrc utr" are the
-- same thing, and a duplicate is how the wrong number gets filed.
create unique index if not exists business_records_name_key
  on public.business_records (lower(name));

alter table public.business_records enable row level security;

-- Staff only. No client, no anon, ever.
create policy business_records_staff_all on public.business_records
  for all using (is_internal_staff()) with check (is_internal_staff());

create trigger trg_business_records_updated
  before update on public.business_records
  for each row execute function public.set_updated_at();

-- Reveal is a privileged act, so it is a function rather than a view: the
-- caller must be internal staff AND hold an aal2 (two-factor) session. The
-- aal claim is read from the caller's own JWT, so this cannot be bypassed by
-- calling the REST API directly with an aal1 token.
create or replace function public.reveal_business_record(record_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid;
  val text;
begin
  if not is_internal_staff() then
    raise exception 'forbidden: staff only';
  end if;
  if coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception 'forbidden: two-factor authentication required to reveal a value';
  end if;

  select secret_id into sid from public.business_records where id = record_id;
  if sid is null then
    return null;
  end if;

  select decrypted_secret into val from vault.decrypted_secrets where id = sid;
  return val;
end;
$$;

revoke all on function public.reveal_business_record(uuid) from public, anon;
grant execute on function public.reveal_business_record(uuid) to authenticated;

-- PostgREST cannot reach the `vault` schema, so writes go through these
-- wrappers. They are service-role only: the app calls them from a server
-- action that has already passed requireStaff. None of them can read a value
-- back — reading is reveal_business_record above, which demands aal2.
create or replace function public.create_vault_secret(
  new_secret text, new_name text, new_description text
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare sid uuid;
begin
  select vault.create_secret(new_secret, new_name, new_description) into sid;
  return sid;
end;
$$;

create or replace function public.update_vault_secret(secret_id uuid, new_secret text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform vault.update_secret(secret_id, new_secret);
end;
$$;

create or replace function public.delete_vault_secret(secret_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  delete from vault.secrets where id = secret_id;
end;
$$;

revoke all on function public.create_vault_secret(text, text, text) from public, anon, authenticated;
revoke all on function public.update_vault_secret(uuid, text) from public, anon, authenticated;
revoke all on function public.delete_vault_secret(uuid) from public, anon, authenticated;
grant execute on function public.create_vault_secret(text, text, text) to service_role;
grant execute on function public.update_vault_secret(uuid, text) to service_role;
grant execute on function public.delete_vault_secret(uuid) to service_role;
