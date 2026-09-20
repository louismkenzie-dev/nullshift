-- STATUS: APPLIED to Nullshift Ops (cweftpoaojwzllzficgt) on 2026-09-20 as revolut_bank_feed.
-- 0067 — Revolut Business bank feed (read-only) and bank-match suggestions.
--
-- Admin redesign, Finance follow-on (brief §5.6 "linked to bank evidence";
-- §10.1 "bank movement is evidence, not an issuer"; §10.4 read-only bank
-- access). Additive only: nothing here touches invoices, subscriptions,
-- billing_obligations, provider_payments or payment_allocations.
--
--   1. `revolut_connections` — one row per consent (environment + client id).
--      Holds NO token material.
--   2. `revolut_secrets` — the encrypted refresh/access tokens for a
--      connection. RLS enabled with NO policies: only the service role can
--      read or write it. The application encrypts with AES-256-GCM
--      (REVOLUT_TOKEN_ENCRYPTION_KEY) before the row is written, so even the
--      service role sees ciphertext.
--   3. `bank_transactions` — imported transaction legs. Idempotent on
--      (provider, environment, provider_tx_id, provider_leg_id); the sync
--      upserts on that key and can be re-run at any time.
--   4. `bank_matches` — suggestions and staff decisions. A suggestion is
--      never applied by the sync; confirming one is a staff action that (when
--      the invoice carries an obligation) records a provider_payments +
--      payment_allocations pair through the Phase 4 helpers. At most one
--      confirmed match per transaction.
--
-- RLS: staff-only (is_internal_staff()) on connections, transactions and
-- matches; service role for the cron importer and the OAuth callback.
--
-- Rollback:
--   drop table if exists public.bank_matches;
--   drop table if exists public.bank_transactions;
--   drop table if exists public.revolut_secrets;
--   drop table if exists public.revolut_connections;

-- ============================================================================
-- revolut_connections
-- ============================================================================

create table if not exists public.revolut_connections (
  id uuid primary key default gen_random_uuid(),
  environment text not null check (environment in ('production', 'sandbox')),
  client_id text not null,
  connected_by uuid references auth.users(id) on delete set null,
  connected_at timestamptz not null default now(),
  -- Last sync outcome. `last_error` is sanitised by the application before
  -- it is written (never token material, never a raw provider body).
  last_sync_at timestamptz,
  last_sync_status text check (last_sync_status in ('ok', 'error')),
  last_error text,
  -- Access-token expiry is kept here (not the token) so the page can say
  -- "token expires in N minutes" without touching the secrets table.
  access_expires_at timestamptz,
  -- Accounts and balances as of the last sync (read-only display; the API
  -- is the source of truth). [{id, name, currency, balance_minor, state}]
  accounts_snapshot jsonb not null default '[]'::jsonb,
  accounts_snapshot_at timestamptz,
  status text not null default 'active' check (status in ('active', 'revoked')),
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.revolut_connections is
  'Revolut Business consent records (0067). Token material lives in revolut_secrets, never here.';

-- One ACTIVE connection per environment; revoked rows keep their history.
create unique index if not exists revolut_connections_one_active_per_env
  on public.revolut_connections (environment)
  where status = 'active';

drop trigger if exists trg_revolut_connections_updated on public.revolut_connections;
create trigger trg_revolut_connections_updated
  before update on public.revolut_connections
  for each row execute function public.set_updated_at();

alter table public.revolut_connections enable row level security;

drop policy if exists revolut_connections_staff on public.revolut_connections;
create policy revolut_connections_staff on public.revolut_connections
  for all to authenticated
  using (public.is_internal_staff())
  with check (public.is_internal_staff());

-- ============================================================================
-- revolut_secrets — service role only
-- ============================================================================

create table if not exists public.revolut_secrets (
  connection_id uuid primary key references public.revolut_connections(id) on delete cascade,
  -- AES-256-GCM ciphertext (see apps/web/lib/revolut/crypto.ts): iv.tag.data, base64url.
  encrypted_refresh_token text not null,
  encrypted_access_token text,
  access_expires_at timestamptz,
  updated_at timestamptz not null default now()
);

comment on table public.revolut_secrets is
  'Encrypted Revolut tokens (0067). RLS on, NO policies: service role only. Ciphertext at rest.';

-- RLS on with no policies: authenticated / anon can neither read nor write.
alter table public.revolut_secrets enable row level security;

revoke all on public.revolut_secrets from anon, authenticated;

-- ============================================================================
-- bank_transactions
-- ============================================================================

create table if not exists public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid references public.revolut_connections(id) on delete set null,
  provider text not null default 'revolut' check (provider in ('revolut')),
  environment text not null check (environment in ('production', 'sandbox')),
  provider_tx_id text not null,
  -- A Revolut transaction has one or more legs (one per account touched);
  -- each leg is a row so an exchange between two own accounts is two rows.
  provider_leg_id text not null,
  account_id text not null,
  account_name text,
  currency text not null check (currency = upper(currency) and length(currency) = 3),
  -- SIGNED integer minor units: positive = money in, negative = money out.
  amount_minor integer not null,
  fee_minor integer not null default 0,
  state text not null check (state in ('pending', 'completed', 'declined', 'failed', 'reverted')),
  -- Revolut transaction type as given (transfer, card_payment, fee, exchange, topup, ...).
  type text not null,
  reference text,
  counterparty_name text,
  counterparty_account text,
  created_at_provider timestamptz not null,
  completed_at_provider timestamptz,
  raw jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now(),

  unique (provider, environment, provider_tx_id, provider_leg_id)
);

comment on table public.bank_transactions is
  'Imported bank transaction legs (0067). Evidence only: nothing here issues, pays or voids an invoice.';

create index if not exists bank_transactions_env_created_idx
  on public.bank_transactions (environment, created_at_provider desc);
create index if not exists bank_transactions_state_idx
  on public.bank_transactions (environment, state);

alter table public.bank_transactions enable row level security;

drop policy if exists bank_transactions_staff on public.bank_transactions;
create policy bank_transactions_staff on public.bank_transactions
  for all to authenticated
  using (public.is_internal_staff())
  with check (public.is_internal_staff());

-- ============================================================================
-- bank_matches
-- ============================================================================

create table if not exists public.bank_matches (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.bank_transactions(id) on delete cascade,
  kind text not null check (kind in ('invoice', 'collection', 'payout', 'fee', 'other')),
  invoice_id uuid references public.invoices(id) on delete set null,
  obligation_id uuid references public.billing_obligations(id) on delete set null,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  -- For a split suggestion (several invoices in one transfer) the extra
  -- invoice ids are listed here; `invoice_id` carries the first.
  split_invoice_ids uuid[] not null default '{}'::uuid[],
  confidence numeric(4, 3) not null check (confidence >= 0 and confidence <= 1),
  explanation text not null,
  -- Stable rule identity so a re-run of the matcher can upsert instead of
  -- duplicating (see apps/web/lib/revolut/match.ts `suggestionKey`).
  rule_key text not null,
  state text not null default 'suggested' check (state in ('suggested', 'confirmed', 'rejected')),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  -- The payment_allocations rows created on confirmation, if any (evidence).
  allocation_ids uuid[] not null default '{}'::uuid[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.bank_matches is
  'Bank-match suggestions and staff decisions (0067). The matcher only ever writes state=suggested; confirmed/rejected are staff decisions.';

-- One suggestion per (transaction, rule) so the matcher is idempotent.
create unique index if not exists bank_matches_rule_unique
  on public.bank_matches (transaction_id, rule_key);

-- At most one CONFIRMED match per transaction.
create unique index if not exists bank_matches_one_confirmed
  on public.bank_matches (transaction_id)
  where state = 'confirmed';

create index if not exists bank_matches_state_idx
  on public.bank_matches (state, created_at desc);
create index if not exists bank_matches_invoice_idx
  on public.bank_matches (invoice_id);

drop trigger if exists trg_bank_matches_updated on public.bank_matches;
create trigger trg_bank_matches_updated
  before update on public.bank_matches
  for each row execute function public.set_updated_at();

alter table public.bank_matches enable row level security;

drop policy if exists bank_matches_staff on public.bank_matches;
create policy bank_matches_staff on public.bank_matches
  for all to authenticated
  using (public.is_internal_staff())
  with check (public.is_internal_staff());
