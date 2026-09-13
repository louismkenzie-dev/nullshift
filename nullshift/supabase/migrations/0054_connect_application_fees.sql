-- Application fees collected via Stripe Connect (2026-09-13)
--
-- Stripe's own dashboard shows fee revenue mixed into the platform balance
-- with no per-client rollup. This is the ledger that answers "how much have
-- we actually collected, and from whom": one row per Stripe Application Fee
-- object, upserted by the webhook as fees are created/refunded and by the
-- admin "Sync now" reconciliation against the Stripe API.
--
-- Deliberately keyed on the Stripe fee id (fee id is globally unique and
-- stable), not on our tenant id, because a fee must still be recorded even if
-- the connected account is later disconnected or reassigned — the money was
-- still collected. `tenant_id` is a best-effort resolution at ingest time
-- (matched via tenants.stripe_connect_account_id) and is nulled, not deleted,
-- if that link later breaks, so the row never silently vanishes from a total.
create table if not exists public.connect_application_fees (
  id                    text primary key, -- Stripe fee id, e.g. fee_xxx
  tenant_id             uuid references public.tenants(id) on delete set null,
  stripe_account_id     text not null,    -- the connected account, acct_xxx
  stripe_charge_id      text,
  stripe_payment_intent text,
  amount                integer not null check (amount >= 0),        -- pence
  amount_refunded       integer not null default 0 check (amount_refunded >= 0), -- pence
  currency              text not null default 'gbp',
  livemode              boolean not null default true,
  stripe_created_at     timestamptz not null, -- Stripe's own `created` on the fee
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists connect_application_fees_tenant_idx
  on public.connect_application_fees (tenant_id);
create index if not exists connect_application_fees_account_idx
  on public.connect_application_fees (stripe_account_id);
create index if not exists connect_application_fees_created_idx
  on public.connect_application_fees (stripe_created_at);

alter table public.connect_application_fees enable row level security;

-- Staff-only: this is agency revenue, not a client-facing figure.
create policy connect_application_fees_staff_read on public.connect_application_fees
  for select using (is_internal_staff());

-- Writes only ever come from the webhook / sync action, both service-role.
-- No insert/update/delete policy — service role bypasses RLS entirely.

create trigger trg_connect_application_fees_updated
  before update on public.connect_application_fees
  for each row execute function public.set_updated_at();
