# Revolut Business bank feed (read-only) — operator guide

Status: code on `feat/admin-redesign`; migration `0067_revolut_bank_feed.sql` **not applied**; no env set on Vercel yet. The Finance page will link to `/admin/bank` in a later slice.

## What it does

- Pulls accounts, balances and transactions from Revolut Business every 30 minutes (`/api/cron/revolut-sync`) and stores them in `bank_transactions` (one row per transaction leg, idempotent on `provider, environment, provider_tx_id, provider_leg_id`).
- Runs a pure matcher (`apps/web/lib/revolut/match.ts`) that writes **suggestions only** to `bank_matches`. Nothing is confirmed automatically.
- `/admin/bank` shows connection health, balances, a paginated transaction list (all / matched / unmatched) and the suggestions with Confirm / Reject. Confirming a match for an invoice that has an `obligation_id` records a `provider_payments` row (provider `bank`) and `payment_allocations` rows through the Phase 4 helpers (`spreadPayment`, `allocationCeiling`; the database trigger stays the authority). It never edits `invoices.status` — a bank movement is evidence, not an issuer (brief §10.1).
- Read-only by construction (brief §10.4): `apps/web/lib/revolut/client.ts` has one `apiGet` for business endpoints and one private `token()` for `POST /auth/token`. There is no helper for any other write. A test pins the prototype's method list.

## Files

| Path | Role |
|---|---|
| `supabase/migrations/0067_revolut_bank_feed.sql` | `revolut_connections`, `revolut_secrets` (RLS on, **no policies** → service role only), `bank_transactions`, `bank_matches`; staff RLS elsewhere |
| `apps/web/lib/revolut/jwt.ts` | RS256 client assertion: `iss` = `REVOLUT_ISSUER`, `sub` = client id, `aud` = `https://revolut.com`, `exp` ≤ 40 min (we use 20) |
| `apps/web/lib/revolut/crypto.ts` | AES-256-GCM at rest, keyed by `REVOLUT_TOKEN_ENCRYPTION_KEY`, AAD = connection id; `sanitiseError` strips tokens |
| `apps/web/lib/revolut/state.ts` | Signed, expiring OAuth `state` (15 min), bound to the staff user and environment |
| `apps/web/lib/revolut/client.ts` | `exchangeCode`, `refreshAccessToken`, `listAccounts`, `listTransactions` (paginated) |
| `apps/web/lib/revolut/sync.ts` | Window arithmetic, leg → row mapping, upsert model, health rule |
| `apps/web/lib/revolut/match.ts` | Matching rules (pure, tested) |
| `apps/web/lib/revolut/store.ts` | Service-role persistence and `runSync()`; the only module that reads `revolut_secrets` |
| `apps/web/lib/revolut/actions.ts` | Staff server actions: confirm / reject / disconnect, each with an `audit_log` row |
| `apps/web/app/api/revolut/{connect,callback,disconnect}/route.ts` | Consent round trip |
| `apps/web/app/api/cron/revolut-sync/route.ts` | Cron (guarded by `CRON_SECRET`) |
| `apps/web/app/admin/(dashboard)/bank/*` | Page, loading, error, stylesheet |
| `apps/web/tests/revolut.test.ts` | JWT, encryption, state, client read-only shape, pagination, sync arithmetic, matching |

## Environment variables (names only)

| Name | Value |
|---|---|
| `REVOLUT_ENVIRONMENT` | `production` or `sandbox` (default `sandbox`). Production base `https://b2b.revolut.com/api/1.0`, sandbox `https://sandbox-b2b.revolut.com/api/1.0` |
| `REVOLUT_CLIENT_ID` | The client id Revolut shows after you upload the certificate (Business → Settings → APIs → Business API) |
| `REVOLUT_ISSUER` | The **bare domain** that hosts the redirect URI, e.g. `nullshift.co.uk` (no scheme, no path). Revolut calls this the JWT issuer |
| `REVOLUT_PRIVATE_KEY` | PEM private key (PKCS#8 or PKCS#1). Escaped `\n` newlines are accepted |
| `REVOLUT_TOKEN_ENCRYPTION_KEY` | 32 bytes as 64 hex chars: `openssl rand -hex 32` |
| `REVOLUT_STATE_SECRET` | Optional; HMAC key for the consent state. Falls back to the encryption key |
| `CRON_SECRET` | Already set; guards the cron route |

Never put these in a commit. `REVOLUT_PRIVATE_KEY` is only ever used to sign assertions; it is not the encryption key.

## Operator steps

### 1. Certificate

```sh
openssl genrsa -out revolut-private.pem 2048
openssl req -new -x509 -key revolut-private.pem -out revolut-public.cer -days 1825 -subj "/CN=nullshift.co.uk"
```

Keep `revolut-private.pem` out of the repo (it becomes `REVOLUT_PRIVATE_KEY`).

### 2. Register the API certificate in Revolut Business

Revolut Business → Settings → APIs → Business API → Add certificate:

- Certificate: paste `revolut-public.cer`.
- Redirect URL: `https://nullshift.co.uk/api/revolut/callback` (for the sandbox app, the preview/sandbox host you will test from).
- Revolut shows the **Client ID** → `REVOLUT_CLIENT_ID`, and the domain of the redirect URL is your **issuer** → `REVOLUT_ISSUER`.

Sandbox: the same steps at `https://sandbox-business.revolut.com` with `REVOLUT_ENVIRONMENT=sandbox`.

### 3. Set the env on Vercel, then apply the migration

Set the five `REVOLUT_*` names (production scope) and apply `0067` in Supabase. Both are additive; nothing changes for existing pages.

### 4. First consent

1. Sign in as staff, open `/admin/bank`, press **Connect Revolut**.
2. `/api/revolut/connect` redirects to `https://business.revolut.com/app-confirm?client_id=…&redirect_uri=…&response_type=code&state=…` (sandbox: `sandbox-business.revolut.com`).
3. Approve. Revolut redirects to `/api/revolut/callback?code=…&state=…`; the route verifies the state (same staff user, same environment, < 15 minutes), exchanges the code at `POST {base}/auth/token` with `grant_type=authorization_code` + the client assertion, encrypts the tokens into `revolut_secrets`, writes `audit_log` `revolut.connected`, and returns you to `/admin/bank?notice=connected`.
4. Access tokens live 40 minutes; the sync refreshes with `grant_type=refresh_token` when fewer than 5 minutes remain. If Revolut revokes the consent (certificate change, manual revocation, or its periodic re-authorisation), the sync records `Consent no longer valid: …` and you repeat this step.

### 5. Cron

`vercel.json` runs `/api/cron/revolut-sync` every 30 minutes. First run imports 90 days; later runs import from (last sync − 2 days) and upsert, so re-running is harmless. To trigger manually:

```sh
curl -H "Authorization: Bearer $CRON_SECRET" https://nullshift.co.uk/api/cron/revolut-sync
```

Outcomes: `{ok:true, accounts, transactions, legs, suggestions}`, `{ok:false, skipped:"not_configured"|"not_connected"}`, or `{ok:false, error, reconsent?}` (also written to `revolut_connections.last_error`, sanitised).

### 6. Reconciling

Open `/admin/bank`. The **Connection** card only says *Healthy* when the last sync succeeded within 2 hours. Review each suggestion's explanation, then Confirm or Reject; both write `audit_log` (`bank_match.confirmed` / `bank_match.rejected`). **Disconnect** revokes the connection and deletes the secrets row (`revolut.disconnected`).

## Matching rules (summary)

| Rule | Kind | Confidence |
|---|---|---|
| Amount equals an open/paid invoice **and** the invoice id prefix, obligation label or client name appears in the reference/counterparty | invoice | 0.95 |
| Amount equals exactly one invoice due within ±14 days | invoice | 0.60 |
| Amount equals several invoices due in the window (one suggestion each) | invoice | 0.40 |
| Several open invoices sum to the transfer | invoice (split) | 0.30 |
| Reference/counterparty contains “GoCardless” / “Stripe” | payout | 0.90 |
| Transaction type `fee` | fee | 0.90 |

Only completed, inbound transactions in the invoice's currency are considered; a transaction with a confirmed or rejected match is skipped.

## What the Revolut docs changed in the design

- The docs site (`developer.revolut.com`) blocks non-browser fetchers, so the endpoint facts were taken from the API reference as mirrored by client libraries and integration write-ups, and cross-checked: consent at `business.revolut.com/app-confirm` with `client_id`, `redirect_uri`, `response_type=code`; token endpoint `POST /auth/token` with `client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer`; JWT `iss` is the redirect domain, `sub` the client id, `aud` `https://revolut.com`, assertion lifetime capped at 40 minutes; access tokens expire after 40 minutes. **Verify these against the live docs before production consent** and treat any mismatch as a bug here.
- `GET /transactions` pages by `count` (max 1000) newest-first, and the next page is fetched by moving `to` to the oldest `created_at` seen — so the client walks pages that way, de-duplicating by id, capped at 20 pages per run.
- Transactions carry **legs** (one per own account touched, each with its own `leg_id`, `amount`, `fee`, `currency`, `counterparty`), so the unique key includes the leg id and an exchange between two own accounts imports as two rows.
- Balances come from `GET /accounts`; they are stored as a snapshot on the connection row (`accounts_snapshot`) and shown read-only.
- Invoices in this schema have no invoice number column; reference matching uses the invoice id prefix, the obligation label and the client name. If a numbering scheme lands later, add it to `references` in `store.loadInvoiceCandidates`.
