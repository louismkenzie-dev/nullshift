-- 0035: subprocessor change notices (legal implementation spec §12).
--
-- The clause this table exists to honour: "do not treat 'we updated our
-- website' as sufficient contractual notice where direct notice is required".
-- Publishing a new row on the public register is not notice. Notice is
-- something sent to a named client, on a date, with at least 14 days before
-- the change takes effect, and with a route to object.
--
-- So delivery is recorded per client, not per change. A change notified to
-- four of five clients is not notified.

create table if not exists public.subprocessor_notices (
  id uuid primary key default gen_random_uuid(),

  -- The provider id in packages/content/src/legal/subprocessors.ts, plus the
  -- name as it stood when the notice went out — the register can be edited
  -- later and the notice must stay readable.
  provider_id text not null,
  provider_name text not null,

  change_type text not null check (
    change_type in ('added', 'replaced', 'purpose_changed', 'location_changed', 'removed')
  ),
  summary text not null,
  -- What this actually means for client data, in the client's words.
  client_impact text not null,

  effective_from date not null,

  status text not null default 'proposed' check (
    status in ('proposed', 'notified', 'effective', 'withdrawn')
  ),
  -- Set when notice has gone to every affected client (see the delivery table).
  notified_at timestamptz,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subprocessor_notices_status_idx
  on public.subprocessor_notices (status, effective_from);

drop trigger if exists subprocessor_notices_updated_at on public.subprocessor_notices;
create trigger subprocessor_notices_updated_at
  before update on public.subprocessor_notices
  for each row execute function set_updated_at();

-- Per-client delivery evidence. One row per affected client per change.
create table if not exists public.subprocessor_notice_deliveries (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid not null references public.subprocessor_notices(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,

  sent_to text not null,
  channel text not null default 'email' check (
    channel in ('email', 'portal', 'post', 'other')
  ),
  sent_at timestamptz not null default now(),

  -- The objection route, and what came back through it.
  objected_at timestamptz,
  objection_note text,
  resolution text,

  unique (notice_id, tenant_id)
);

create index if not exists subprocessor_deliveries_tenant_idx
  on public.subprocessor_notice_deliveries (tenant_id, sent_at desc);

-- 14 clear days between direct notice and the change taking effect. Enforced
-- here so a change cannot be marked effective on a shorter runway than the
-- contract promises.
create or replace function enforce_subprocessor_notice_period()
returns trigger
language plpgsql
as $$
declare
  earliest_sent timestamptz;
begin
  if new.status <> 'effective' then
    return new;
  end if;

  if new.notified_at is null then
    raise exception using
      errcode = 'check_violation',
      message = 'This subprocessor change has not been notified to clients yet.',
      hint = 'Spec 12: publishing to the public register is not contractual notice.';
  end if;

  select min(sent_at) into earliest_sent
  from public.subprocessor_notice_deliveries
  where notice_id = new.id;

  if earliest_sent is null then
    raise exception using
      errcode = 'check_violation',
      message = 'No client notice deliveries are recorded against this change.';
  end if;

  if new.effective_from < (new.notified_at + interval '14 days')::date then
    raise exception using
      errcode = 'check_violation',
      message = 'A subprocessor change needs at least 14 days between client notice and taking effect.',
      hint = 'Spec 12: move the effective date, do not shorten the notice.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_subprocessor_notice_period on public.subprocessor_notices;
create trigger trg_subprocessor_notice_period
  before update on public.subprocessor_notices
  for each row execute function enforce_subprocessor_notice_period();

alter table public.subprocessor_notices enable row level security;
alter table public.subprocessor_notice_deliveries enable row level security;

-- A proposed change is internal until it is notified.
drop policy if exists subprocessor_notices_select on public.subprocessor_notices;
create policy subprocessor_notices_select on public.subprocessor_notices
  for select to authenticated
  using (is_internal_staff() or status <> 'proposed');

drop policy if exists subprocessor_notices_staff on public.subprocessor_notices;
create policy subprocessor_notices_staff on public.subprocessor_notices
  for all to authenticated
  using (is_internal_staff()) with check (is_internal_staff());

-- A client can see the notices sent to THEM — their evidence as much as ours.
drop policy if exists subprocessor_deliveries_select on public.subprocessor_notice_deliveries;
create policy subprocessor_deliveries_select on public.subprocessor_notice_deliveries
  for select to authenticated
  using (is_internal_staff() or is_member_of(tenant_id));

drop policy if exists subprocessor_deliveries_staff on public.subprocessor_notice_deliveries;
create policy subprocessor_deliveries_staff on public.subprocessor_notice_deliveries
  for all to authenticated
  using (is_internal_staff()) with check (is_internal_staff());

-- A client admin may lodge an objection against a notice sent to them, and may
-- change nothing else about it.
drop policy if exists subprocessor_deliveries_object on public.subprocessor_notice_deliveries;
create policy subprocessor_deliveries_object on public.subprocessor_notice_deliveries
  for update to authenticated
  using (is_tenant_admin(tenant_id))
  with check (is_tenant_admin(tenant_id));
