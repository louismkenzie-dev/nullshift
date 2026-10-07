-- 0068: signature requests — Nullshift's own e-signature envelope.
--
-- STATUS: see the ledger (supabase_migrations.schema_migrations); applied to
-- Nullshift Ops (cweftpoaojwzllzficgt) as `signature_requests` on 2026-10-07.
--
-- WHY
--   Until now a client could only "sign" the documents the system already
--   knew how to draw: the proposal, the Order Form, a structured Change Order.
--   The moment Louis needed a bespoke document signed — a proposal follow-up
--   with a Q&A table and a costing — the only options were an email thread
--   ("please reply to confirm") or a third-party e-signature product. An email
--   reply is evidence of a sort; it is not a signature with a record behind it.
--
--   This is the general case: any document staff compose, frozen and hashed
--   at issue, sent to a named signer through a single-use link, signed with a
--   typed signature and four explicit confirmations, countersigned by
--   Nullshift, and recorded with an append-only evidence trail — who, when,
--   from where, against exactly which bytes. It is what people mean when they
--   say "DocuSign", and it holds up for the same reasons DocuSign does: under
--   the Electronic Communications Act 2000 s.7 and UK eIDAS a simple
--   electronic signature is admissible, and its weight is the evidence.
--
-- THREE THINGS IT MAKES IMPOSSIBLE
--   1. Signing something other than what was sent. The content is frozen in a
--      canonical snapshot with a sha256 at issue; the signer sees the snapshot,
--      never the live row, and the trigger below refuses any edit to the
--      frozen columns once the document has left draft.
--   2. Editing the evidence. signature_events has no UPDATE or DELETE path for
--      anyone, service role included — a trigger raises. A signature that can
--      be edited is not evidence.
--   3. A client minting their own tick. Nothing here is writable through RLS
--      by a tenant member; every write comes from server code that has already
--      verified the signing token or the member's session.
--
-- RELATIONSHIP TO WHAT EXISTS
--   Order Forms and the structured Change Orders keep their own acceptance
--   paths (0030). A signature request can point at a change_orders row; when
--   the request completes, server code marks that Change Order accepted so
--   the §8 build gate (trg_issues_change_order_gate) sees it. The receipts
--   ledger (0048) gains a document_type for these.

-- ============================================================================
-- signature_requests — the envelope
-- ============================================================================

create table if not exists public.signature_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,

  -- Human-quotable, e.g. SR-2026-0001.
  reference text not null unique,

  kind text not null default 'other' check (
    kind in ('change_order', 'proposal_addendum', 'agreement', 'letter', 'other')
  ),
  title text not null,

  status text not null default 'draft' check (
    status in ('draft', 'issued', 'signed', 'completed', 'declined', 'voided', 'expired')
  ),

  -- What staff typed (a small markdown-like dialect, parsed by
  -- apps/web/lib/signing/blocks.ts) and the blocks it parsed to. The blocks
  -- are what is rendered and what is hashed; the source is kept so a draft
  -- can be re-edited without a lossy round-trip.
  body_source text not null default '',
  body_blocks jsonb not null default '[]'::jsonb,
  -- Money, structured so it can be totalled and shown the same way everywhere:
  -- { lines: [{ label, amountMinor }], totalMinor, currency, note }.
  commercial jsonb not null default '{}'::jsonb,

  -- Frozen at issue (apps/web/lib/legal/acceptanceSnapshot.ts): the canonical
  -- JSON the signer is shown and its sha256. Null while a draft.
  document_snapshot jsonb,
  document_hash text,
  -- The legal pack versions in force at issue (MSA etc.) so the signed
  -- document can be read against the terms that governed it.
  incorporated_versions jsonb not null default '{}'::jsonb,

  -- The one person asked to sign for the client. Copied here, not joined from
  -- tenants: who was asked must not change if the contact record does.
  signer_name text not null,
  signer_email text not null,
  signer_role text,

  -- Single-use signing link: sha256 of the token in the URL. The token itself
  -- is never stored — possession of the link is part of the evidence, so the
  -- database must not be able to reproduce it. Re-sending rotates it.
  token_hash text unique,

  issued_at timestamptz,
  issued_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz,

  signed_at timestamptz,
  countersigned_at timestamptz,
  countersigned_by uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  declined_at timestamptz,
  decline_reason text,
  voided_at timestamptz,
  void_reason text,

  -- Optional link to the structured Change Order this document stands for.
  change_order_id uuid references public.change_orders(id) on delete set null,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Anything that has left draft carries the frozen document and a link.
  constraint signature_requests_issued_is_frozen check (
    status = 'draft'
    or (
      document_snapshot is not null
      and document_hash is not null
      and issued_at is not null
      and token_hash is not null
      and expires_at is not null
    )
  ),
  constraint signature_requests_signed_has_time check (
    status not in ('signed', 'completed') or signed_at is not null
  ),
  constraint signature_requests_completed_has_countersign check (
    status <> 'completed' or (countersigned_at is not null and completed_at is not null)
  ),
  constraint signature_requests_declined_has_time check (
    status <> 'declined' or declined_at is not null
  ),
  constraint signature_requests_voided_has_time check (
    status <> 'voided' or voided_at is not null
  ),
  constraint signature_requests_signer_email_shape check (
    signer_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  )
);

create index if not exists signature_requests_tenant_idx
  on public.signature_requests (tenant_id, created_at desc);
create index if not exists signature_requests_status_idx
  on public.signature_requests (status);

drop trigger if exists signature_requests_updated_at on public.signature_requests;
create trigger signature_requests_updated_at
  before update on public.signature_requests
  for each row execute function set_updated_at();

-- Reference allocator: SR-YYYY-NNNN, sequential within the year.
create or replace function public.next_signature_request_ref()
returns text
language sql
volatile
security definer
set search_path = public
as $$
  select 'SR-' || to_char(now(), 'YYYY') || '-' ||
         lpad((
           select count(*) + 1
           from public.signature_requests
           where reference like 'SR-' || to_char(now(), 'YYYY') || '-%'
         )::text, 4, '0');
$$;
revoke all on function public.next_signature_request_ref() from public, anon;
grant execute on function public.next_signature_request_ref() to authenticated, service_role;

-- Once a request has left draft, the document and the signer are frozen.
-- An edit is a new request. Evidence timestamps are append-once.
create or replace function public.signature_requests_guard_frozen()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status <> 'draft' then
    if new.title                 is distinct from old.title
    or new.kind                  is distinct from old.kind
    or new.body_blocks           is distinct from old.body_blocks
    or new.commercial            is distinct from old.commercial
    or new.document_snapshot     is distinct from old.document_snapshot
    or new.document_hash         is distinct from old.document_hash
    or new.incorporated_versions is distinct from old.incorporated_versions
    or new.signer_name           is distinct from old.signer_name
    or new.signer_email          is distinct from old.signer_email
    or new.signer_role           is distinct from old.signer_role
    or new.issued_at             is distinct from old.issued_at
    or new.issued_by             is distinct from old.issued_by
    or new.tenant_id             is distinct from old.tenant_id
    or new.project_id            is distinct from old.project_id
    or new.change_order_id       is distinct from old.change_order_id
    then
      raise exception 'signature_requests: % is frozen once issued (id %); issue a new request',
        'the document', old.id using errcode = 'check_violation';
    end if;
  end if;

  if old.signed_at is not null and new.signed_at is distinct from old.signed_at then
    raise exception 'signature_requests: signed_at is append-only (id %)', old.id
      using errcode = 'check_violation';
  end if;
  if old.countersigned_at is not null
     and (new.countersigned_at is distinct from old.countersigned_at
          or new.countersigned_by is distinct from old.countersigned_by) then
    raise exception 'signature_requests: countersignature is append-only (id %)', old.id
      using errcode = 'check_violation';
  end if;

  -- Terminal states stay terminal.
  if old.status in ('completed', 'declined', 'voided') and new.status is distinct from old.status then
    raise exception 'signature_requests: % is terminal (id %)', old.status, old.id
      using errcode = 'check_violation';
  end if;
  -- Nothing goes back to draft.
  if old.status <> 'draft' and new.status = 'draft' then
    raise exception 'signature_requests: cannot return to draft (id %)', old.id
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_signature_requests_frozen on public.signature_requests;
create trigger trg_signature_requests_frozen
  before update on public.signature_requests
  for each row execute function public.signature_requests_guard_frozen();

-- ============================================================================
-- signature_events — the append-only evidence trail
-- ============================================================================

create table if not exists public.signature_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.signature_requests(id) on delete restrict,
  tenant_id uuid not null references public.tenants(id) on delete cascade,

  kind text not null check (
    kind in (
      'issued',        -- link minted and emailed
      'resent',        -- link rotated and emailed again
      'link_opened',   -- the signer followed the link (first time)
      'viewed',        -- the document was rendered to the signer
      'signed',        -- the client's signature
      'countersigned', -- Nullshift's signature
      'declined',
      'voided',
      'reminder_sent',
      'expired'
    )
  ),
  actor_kind text not null check (actor_kind in ('client', 'staff', 'system')),
  -- The session user when there was one. A signer following an emailed link
  -- without a portal session has none; the link possession + email identify
  -- them, and that is recorded in actor_email.
  actor_user uuid references auth.users(id) on delete set null,
  actor_name text,
  actor_email text,
  actor_role text,

  -- For 'signed' / 'countersigned': the adopted (typed) signature, the four
  -- confirmations as ticked, and the hash of the document as presented at
  -- that moment — which must equal the request's document_hash.
  signature_text text,
  consent jsonb,
  document_hash text,

  -- Personal data captured as evidence. Retention is time-limited under the
  -- retention policy; these are not kept indefinitely by default.
  ip_address inet,
  user_agent text,

  at timestamptz not null default now(),
  meta jsonb not null default '{}'::jsonb,

  constraint signature_events_signature_has_evidence check (
    kind not in ('signed', 'countersigned')
    or (
      signature_text is not null
      and actor_name is not null
      and actor_email is not null
      and document_hash is not null
      and consent is not null
    )
  )
);

create index if not exists signature_events_request_idx
  on public.signature_events (request_id, at asc);
create index if not exists signature_events_tenant_idx
  on public.signature_events (tenant_id, at desc);

-- Append-only for everyone, the service role included. The trigger is what
-- makes "evidence" mean something: a row, once written, is the record.
create or replace function public.signature_events_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'signature_events is append-only (% refused)', tg_op
    using errcode = 'check_violation';
end;
$$;

drop trigger if exists trg_signature_events_no_update on public.signature_events;
create trigger trg_signature_events_no_update
  before update or delete on public.signature_events
  for each row execute function public.signature_events_immutable();

-- ============================================================================
-- Receipts ledger: these documents get Sent / Viewed / Signed ticks too
-- ============================================================================

alter table public.document_events
  drop constraint if exists document_events_document_type_check;
alter table public.document_events
  add constraint document_events_document_type_check check (
    document_type in (
      'proposal',
      'dpa',
      'order_form',
      'change_order',
      'care_plan_terms',
      'deliverable',
      'signature_request'
    )
  );

-- ============================================================================
-- RLS
-- ============================================================================

alter table public.signature_requests enable row level security;
alter table public.signature_events enable row level security;

-- Staff read and write requests (drafting). A tenant member sees their own
-- once it has left draft — a draft is Nullshift's working copy, not an offer.
drop policy if exists signature_requests_select on public.signature_requests;
create policy signature_requests_select on public.signature_requests
  for select to authenticated
  using (is_internal_staff() or (is_member_of(tenant_id) and status <> 'draft'));

drop policy if exists signature_requests_staff_write on public.signature_requests;
create policy signature_requests_staff_write on public.signature_requests
  for all to authenticated
  using (is_internal_staff()) with check (is_internal_staff());

-- Evidence: staff read. No client policy — a signer reads their own evidence
-- through the completion certificate, which server code renders after
-- checking the link or the membership. Nobody writes through RLS: every
-- insert comes from server code holding the service role.
drop policy if exists signature_events_staff_read on public.signature_events;
create policy signature_events_staff_read on public.signature_events
  for select to authenticated
  using (is_internal_staff());

comment on table public.signature_requests is
  'E-signature envelopes: a staff-composed document frozen and hashed at issue, signed by a named client signatory through a single-use link, countersigned by Nullshift.';
comment on table public.signature_events is
  'Append-only evidence trail for signature_requests (issued, opened, viewed, signed, countersigned, declined, voided). No UPDATE/DELETE path for any role.';
