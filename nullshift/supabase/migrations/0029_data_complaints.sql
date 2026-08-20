-- 0029: data-protection complaints (legal implementation spec §11).
--
-- The obligation is to provide a clear ELECTRONIC route for complaints, to
-- acknowledge within 30 days of receipt, and to investigate and respond without
-- undue delay. Note the distinction the spec insists on: 30 days is the
-- acknowledgement deadline, NOT a resolution deadline — `acknowledge_due_at`
-- is what the alert fires against.
--
-- Investigation notes are deliberately separated from the complaint body:
-- ordinary support staff must not see them (§21), so they live in their own
-- table with its own staff-only policy and are never selected by the intake
-- surface.

create table if not exists public.data_complaints (
  id uuid primary key default gen_random_uuid(),
  -- Human-quotable case reference, e.g. DPC-2026-0007.
  case_ref text not null unique,

  complainant_name text not null,
  complainant_email text not null,
  -- How they relate to us: client, client's customer, website visitor, other.
  relationship text not null,
  nature text not null,
  relevant_dates text,
  related_client text,
  -- Storage paths in the private complaint-attachments bucket.
  attachment_paths jsonb not null default '[]'::jsonb,

  status text not null default 'received' check (
    status in (
      'received',
      'acknowledged',
      'investigating',
      'awaiting_info',
      'outcome_sent',
      'closed'
    )
  ),

  received_at timestamptz not null default now(),
  -- The statutory acknowledgement clock. Alert BEFORE this, not on it.
  acknowledge_due_at timestamptz not null default now() + interval '30 days',
  acknowledged_at timestamptz,
  outcome_sent_at timestamptz,
  closed_at timestamptz,

  created_ip inet,
  created_at timestamptz not null default now()
);

create index if not exists data_complaints_status_due_idx
  on public.data_complaints (status, acknowledge_due_at);

-- Restricted investigation file — never exposed on the intake surface.
create table if not exists public.data_complaint_notes (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.data_complaints(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  note text not null,
  created_at timestamptz not null default now()
);

create index if not exists data_complaint_notes_complaint_idx
  on public.data_complaint_notes (complaint_id, created_at desc);

-- Complaints are staff-read only. Submission goes through the service role
-- after rate limiting, so there is deliberately no public insert policy: an
-- anonymous INSERT policy on this table would let anyone write unbounded rows.
alter table public.data_complaints enable row level security;
alter table public.data_complaint_notes enable row level security;

drop policy if exists data_complaints_staff_read on public.data_complaints;
create policy data_complaints_staff_read on public.data_complaints
  for select using (is_internal_staff());

drop policy if exists data_complaints_staff_update on public.data_complaints;
create policy data_complaints_staff_update on public.data_complaints
  for update using (is_internal_staff()) with check (is_internal_staff());

drop policy if exists data_complaint_notes_staff_read on public.data_complaint_notes;
create policy data_complaint_notes_staff_read on public.data_complaint_notes
  for select using (is_internal_staff());

drop policy if exists data_complaint_notes_staff_write on public.data_complaint_notes;
create policy data_complaint_notes_staff_write on public.data_complaint_notes
  for insert with check (is_internal_staff());

-- Next case reference in the year's sequence, e.g. DPC-2026-0007.
create or replace function public.next_complaint_ref()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  yr text := to_char(now(), 'YYYY');
  n integer;
begin
  select count(*) + 1 into n
    from data_complaints
    where case_ref like 'DPC-' || yr || '-%';
  return 'DPC-' || yr || '-' || lpad(n::text, 4, '0');
end;
$$;

revoke all on function public.next_complaint_ref() from public;
