-- 0048: document events — read receipts for everything a client signs.
--
-- The proposal, the DPA, the Order Form (and the terms it incorporates), each
-- Change Order and the care-plan terms all go out to the client and come back
-- signed, but until now the only trace was the columns on each row
-- (proposal_sent_at, accepted_at, ...) and the staff-side audit trail. Nothing
-- said WHEN the client first opened a document, and nothing recorded that a
-- second staff member approved it before it went out.
--
-- One append-only ledger fixes that: a row per (document, event). The four
-- events are the WhatsApp ticks — sent, viewed, signed — plus the review-gate
-- approval that must precede a send. Rows are written by trusted server code
-- through the service client (the portal pages record a client's view; the
-- staff actions record sends and approvals), never by a client directly, and
-- a staff "view as client" preview is excluded in code before it gets here.
--
-- document_id is text, not a foreign key: the documents live in five tables
-- (projects for the proposal + DPA, order_forms, change_orders, tenants for
-- the care-plan terms by version, documents for uploads) and a receipt must
-- outlive a re-drafted row.

create table if not exists public.document_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,

  document_type text not null check (
    document_type in (
      'proposal',
      'dpa',
      'order_form',
      'change_order',
      'care_plan_terms',
      'deliverable'
    )
  ),
  -- projects.id / order_forms.id / change_orders.id / the terms version /
  -- documents.id — whatever identifies the document within its type.
  document_id text not null,

  event text not null check (event in ('sent', 'viewed', 'signed', 'approved')),

  -- Who did it. Null when the actor is a system process (a webhook, a cron)
  -- or the user has since been deleted.
  actor uuid references auth.users(id) on delete set null,
  actor_kind text not null check (actor_kind in ('client', 'staff', 'system')),

  at timestamptz not null default now(),
  -- Free-form context: the reference sent, the email it went to, the
  -- approver's note, the version viewed.
  meta jsonb not null default '{}'::jsonb
);

create index if not exists document_events_document_idx
  on public.document_events (tenant_id, document_type, document_id, event, at desc);

alter table public.document_events enable row level security;

-- Staff read the receipts. Nobody writes through RLS: every insert comes from
-- server code holding the service role, which is what keeps a client from
-- minting their own "viewed" or "signed" tick. There is deliberately no
-- client policy — the receipts are an internal record, not a portal feature.
drop policy if exists document_events_staff_read on public.document_events;
create policy document_events_staff_read on public.document_events
  for select using (is_internal_staff());
