-- 0034: marketing permission and suppression (legal implementation spec §15).
--
-- The rule that needs a table behind it: marketing consent is never inferred
-- from the existence of an account. A client having signed a contract, booked
-- a call or been invoiced says nothing about whether they agreed to be
-- marketed to — so a permission has to be recorded as its own act, with the
-- source and the wording, or it does not exist.
--
-- Suppression is separate from permission and always wins. An unsubscribe, a
-- bounce or a complaint must stop mail even if a permission row still says
-- yes, and must survive that permission being re-granted by a data import.

create table if not exists public.marketing_permissions (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  tenant_id uuid references public.tenants(id) on delete set null,

  -- How the permission was actually obtained. There is no "existing customer"
  -- value on purpose: soft opt-in is a decision to be recorded explicitly as
  -- `soft_optin_existing_customer`, with the sale it relates to.
  source text not null check (
    source in (
      'website_form',
      'event_signup',
      'soft_optin_existing_customer',
      'written_confirmation',
      'imported_with_evidence'
    )
  ),
  -- The exact words the person agreed to. Without this the permission cannot
  -- be evidenced, which is the same as not having one.
  consent_wording text not null,
  evidence_ref text,

  granted_at timestamptz not null default now(),
  withdrawn_at timestamptz,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists marketing_permissions_email_idx
  on public.marketing_permissions (lower(email));

create table if not exists public.email_suppressions (
  email text primary key,
  reason text not null check (
    reason in ('unsubscribed', 'bounced', 'complained', 'manual')
  ),
  detail text,
  created_at timestamptz not null default now()
);

-- One question, one answer, used by the send path: may we send marketing to
-- this address right now? Suppression wins, then a live permission, else no.
create or replace function marketing_allowed(addr text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    not exists (
      select 1 from public.email_suppressions s
      where lower(s.email) = lower(addr)
    )
    and exists (
      select 1 from public.marketing_permissions p
      where lower(p.email) = lower(addr)
        and p.withdrawn_at is null
    );
$$;

alter table public.marketing_permissions enable row level security;
alter table public.email_suppressions enable row level security;

drop policy if exists marketing_permissions_staff on public.marketing_permissions;
create policy marketing_permissions_staff on public.marketing_permissions
  for all to authenticated
  using (is_internal_staff()) with check (is_internal_staff());

drop policy if exists email_suppressions_staff on public.email_suppressions;
create policy email_suppressions_staff on public.email_suppressions
  for all to authenticated
  using (is_internal_staff()) with check (is_internal_staff());
