-- 0049: second-person review gate for legal documents.
--
-- A proposal, an Order Form or a Change Order may only be SENT to a client
-- once a staff member OTHER THAN its author has approved the draft — the same
-- reviewer ≠ performer rule the SOC 2 pages already use. Until now nothing
-- recorded who drafted the proposal at all, and nothing recorded a human
-- approval on any of the three; the only "reviewed" stamp was the §14 payment
-- review on order_forms.
--
-- order_forms and change_orders already carry created_by (migration 0030),
-- which is the author for the gate — no drafted_by is added there. projects
-- has no author column for the proposal, so proposal_drafted_by is added: it
-- is stamped by whoever last saved the draft (overview, payment terms or the
-- module list), because that is the person whose work the reviewer is
-- checking. Every save of a draft clears its approval, so a document edited
-- after approval is re-approved before it goes out.
--
-- The approval is ALSO appended to document_events (event 'approved',
-- actor_kind 'staff') so the read-receipt ledger shows it next to sent /
-- viewed / signed; the columns here are the fast path the send actions and
-- the ReviewGate read.

alter table public.projects
  add column if not exists proposal_drafted_by uuid references auth.users(id) on delete set null,
  add column if not exists proposal_reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists proposal_reviewed_at timestamptz;

alter table public.order_forms
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

alter table public.change_orders
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

comment on column public.projects.proposal_drafted_by is
  'Staff user who last saved the proposal draft — the author for the review gate.';
comment on column public.projects.proposal_reviewed_by is
  'Staff user (≠ author) who approved the proposal draft for sending. Cleared on every draft save.';
comment on column public.projects.proposal_reviewed_at is
  'When the proposal draft was approved for sending.';
comment on column public.order_forms.reviewed_by is
  'Staff user (≠ created_by) who approved the draft for sending. Cleared on every draft save.';
comment on column public.order_forms.reviewed_at is
  'When the Order Form draft was approved for sending.';
comment on column public.change_orders.reviewed_by is
  'Staff user (≠ created_by) who approved the draft for client review. Cleared on every draft save.';
comment on column public.change_orders.reviewed_at is
  'When the Change Order draft was approved for client review.';
