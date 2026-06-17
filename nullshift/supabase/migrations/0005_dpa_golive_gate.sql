-- ============================================================================
-- Phase 5 — DPA go-live gate (brief §5/§9). A clinic project cannot move to
-- 'live' until its tenant has a signed-DPA compliance record. Enforced in the DB
-- so it holds regardless of which app or API path attempts the transition.
-- ============================================================================
create or replace function enforce_dpa_before_live()
returns trigger
language plpgsql
as $$
begin
  if new.stage = 'live' and (tg_op = 'INSERT' or old.stage is distinct from 'live') then
    if not exists (
      select 1 from compliance_records
      where tenant_id = new.tenant_id and kind = 'dpa_signed'
    ) then
      raise exception 'Cannot take project live: tenant DPA is not signed and logged';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_dpa on projects;
create trigger trg_enforce_dpa
  before insert or update on projects
  for each row execute function enforce_dpa_before_live();
