# NullShift Operations Playbook

How the agency runs on the ops system built into `/admin` and `/portal`. Written so a new
team member (or a Claude Code session) can operate the agency cold.

## The model

```
Client channels (portal, WhatsApp, Zoom, email)
        │
        ▼
   ISSUE BANK (issues table) ── AI triage classifies kind/severity/billing
        │
        ▼  admin queues issues per system
   FIX BATCH (fix_batches) ── compiler assembles a context-complete work order
        │
        ▼  one click
   CLAUDE CODE ── GitHub issue with @claude → claude-code-action → PR
        │
        ▼  review + merge + "Mark shipped"
   CLIENT FEED (project_updates) + ALLOWANCE LEDGER (build_credit_events)
```

Everything the client asks for lands in **one place** (the issue bank), gets fixed in
**batches** (one compiled prompt, one PR), and flows back out as **client-visible updates**
and **billing events** automatically.

## Recurring plans + scale pricing

Two independent axes. The **plan** answers "what service does this system
need?"; the **scale band** answers "how much commercial, technical and
operational load does this client place on Nullshift?".

Plan catalogue — `apps/web/lib/carePlans.ts` (base "from" price):

| Plan id       | Label      | From £/mo | Response target     | Adds                                                                                                 |
| ------------- | ---------- | --------- | ------------------- | ---------------------------------------------------------------------------------------------------- |
| `hosting`     | Core       | 40        | 2 UK business days  | Hosting, DB, SSL, backups, monitoring, bug fixes                                                     |
| `hosting_api` | Pro        | 80        | 1 UK business day   | + managed AI/API + transactional email + enhanced monitoring                                         |
| `build_3`     | Max        | 120       | 4 UK business hours | + named technical owner, quarterly roadmap, monthly health review, free scoping, priority scheduling |
| `build_10`    | Enterprise | quoted    | Contracted SLA      | + contracted SLAs, security/procurement, dedicated environments, optional reserved capacity          |

Plan **ids** are DB values (`subscriptions_plan_check`) and keep their original
names. **No plan includes feature development** — every `buildAllowance` is 0.
New capabilities are always separately quoted fixed-price projects. Never write
"unlimited development", "unlimited changes" or "developer on demand".

**Support vs development:** if the request changes what the product can do it is
development; if it keeps an existing capability working, or configures it within
its original design, it is support. Bugs in our own signed-off implementation are
always support.

### What a client actually pays

`final_mrr = ceil_to_5( max( base_plan × scale_multiplier, vendor_cost / 0.25 ) )`

The Nullshift Scale Index (`apps/web/lib/pricing/nsi.ts`, version
`NSI_v1_2026_08`) scores five dimensions out of 100 — audience 25, commercial
criticality 25, technical load 20, organisation reach 15, complexity/risk 15 —
and maps the total to a band: Standard ×1.0 (0–29), Growth ×1.5 (30–44),
Established ×2.5 (45–59), Scale ×4.0 (60–74), Critical ×5.5 (75–84), Enterprise
(85+, always a manual quote). The cost floor holds a minimum 75% gross margin on
attributable vendor spend, so a usage spike can never leave a plan underwater.

Score a client at **/admin/clients/[id]/pricing**. Each save stores the raw
inputs, component scores, band, multiplier, floor, recommendation and pricing
version in `scale_assessments` (migration 0028), so any quote can be explained
months later. Overrides require a reason and record who made them.

`contractedMrr()` (`apps/web/lib/pricing/contracted.ts`) resolves what to charge
— agreed → override → recommended → base — and **every** billing path goes
through it: Direct Debit set-up (admin + portal), the GoCardless webhook, Stripe
checkout and manually recorded plans.

### Review cadence

- Shadow-score monthly; do **not** move the invoice automatically.
- Formal review every 6 months, or straight after a material change.
- Increase: two consecutive months in the higher band + 30 days' notice.
- Decrease: three consecutive months lower, applied at the 6-month review.
- A client cannot drop below the plan their live dependencies require (managed
  AI/API or email keeps them on Pro as a minimum).

## Daily loop

1. **`/admin`** (Mission Control) — the one screen: critical/overdue issues, batches in
   flight, promises coming due, items blocked on clients.
2. **`/admin/inbox`** — paste any WhatsApp export / call transcript. Claude splits it into
   draft issues (deduped against open ones) and flags promises you made. Confirm or discard
   each draft.
3. **`/admin/issues`** — triage: confirm kind/severity/billing, queue what's next.
4. **`/admin/batches`** — pick a system, "Compile batch". Review the work order, then either
   **Dispatch to Claude** (creates the @claude GitHub issue) or **Copy** it into a Claude
   Code cloud session. When the PR is merged and deployed, **Mark shipped** — issues close,
   the client's feed gets a plain-English entry per fix, allowance is decremented.

## Weekly loop

- **Friday pulse** — a Vercel cron (`/api/cron/weekly-pulse`, Fridays 08:00 UTC) emails a
  per-client digest (shipped / up next / blocked-on-you) to the agency inbox for review and
  forwarding. Requires `CRON_SECRET` set in Vercel.

## System passports (`/admin/systems`)

One page per client system = the team-handoff surface. It holds: repo / Vercel / Supabase
refs, stack, the **feature checklist** (built / in progress / planned — what's actually done),
the runbook, known footguns, provisioning checklist, open issues and batch history. Rule:
**if you learned something operating a system, it goes in the passport**, not in your head.

## Template bank (`/admin/templates`)

Proven system skeletons (e.g. "Bookings + Stripe Connect" extracted from The Dance
Exclusive). "Stamp a new system" creates the tenant, project and passport pre-filled with
the template's features and a provisioning checklist. v1 provisioning is checklist-guided
(create repo from the GitHub template, Supabase project, Vercel project); API-automated
provisioning (Supabase Management API / Vercel API / GitHub repo-from-template) is the
planned upgrade.

## Claude Code dispatch — setup per client repo

The "Dispatch to Claude" button posts the compiled work order as a GitHub issue mentioning
`@claude`. For that to become a PR automatically, each client repo needs:

1. `anthropics/claude-code-action@v1` installed as a workflow (`.github/workflows/claude.yml`).
2. `ANTHROPIC_API_KEY` in the repo's Actions secrets.
3. This app's `GITHUB_DISPATCH_TOKEN` env var: a GitHub token with `issues:write` on the
   client repos (fine-grained PAT recommended).

Without the token, the button hides and you copy-paste the work order into a Claude Code
session instead — same prompt, manual transport.

### Transport 2 — Routines (research preview): "Fire routine"

Runs the batch as a Claude Code cloud session on Anthropic's infrastructure via a
pre-configured routine's HTTP fire endpoint. Uses your Claude subscription (routines draw
subscription usage + a daily run cap). Setup per system, once:

1. At [claude.ai/code/routines](https://claude.ai/code/routines) create a routine with the
   system's repo attached and an **API trigger**; copy the fire URL and generated token.
2. Set the routine's saved prompt to opt in to the fire payload (fire text arrives wrapped
   as untrusted data — the saved prompt is what authorises acting on it). Recommended:

   > You are NullShift's fix-batch runner for this repository. Work through the fix batch
   > described in the routine-fire-payload block: fix every issue with minimal
   > production-quality changes, run the project's typecheck/build, push a branch and open
   > a pull request whose description lists each issue with a one-line plain-English
   > summary. If an issue can't be fixed, say so under a "Not fixed" heading.

3. Paste the fire URL + token into the system passport (`/admin/systems/[id]` → Facts).

"Fire routine" on a compiled batch then POSTs the work order as the run's `text` and stores
the returned live session URL on the batch ("Routine run" button). The endpoint ships under
the `experimental-cc-routine-2026-04-01` beta header and may change during the preview.

### Transport 3 — Managed Agents (beta): "Run managed agent"

Spawns an Anthropic-hosted sandbox session from our own backend: mounts the repo, works the
batch, pushes a `claude/fix-batch-<id>` branch. No runner timeouts; API-metered billing on
`ANTHROPIC_API_KEY`. Requirements: `ANTHROPIC_API_KEY` + `GITHUB_DISPATCH_TOKEN` with
**Contents: Read and write** on the repo (the token is injected by Anthropic's git proxy —
it never enters the sandbox).

The agent ("NullShift Fix Batch Runner") and its cloud environment are created lazily on
first dispatch and persisted in `ops_settings` — never per run. The batch page shows the
live session status (refreshes on load), the agent's latest summary, a Console link, and a
**Compare branch / open PR** button once the branch is pushed. v1 deliberately stops at
branch-push; adding the GitHub MCP server + vault credentials to the agent would let it
open the PR itself (documented upgrade).

Pick per batch: GitHub issue (visible in the repo, subscription-billed via the Action),
routine (subscription-billed, watchable at claude.ai), or managed agent (API-billed,
fastest to start, status polled into the admin). All three consume the same compiled work
order — the compiler doesn't care about the transport.

## Intake rules (how WhatsApp dies)

- Clients are steered to `/portal/requests` — three friendly buttons (broken / change /
  question), optional screenshot. Their requests get honest statuses ("Queued for the next
  fix batch", "Waiting on you") and expected-by dates, which kills "any update?" pings.
- Anything that still arrives via WhatsApp/voice/Zoom goes through `/admin/inbox` the same
  day. The issue bank is only trustworthy if it's complete.
- Promises you make in chat ("I'll sort that by Friday") are extracted into the promise
  ledger and surface on Mission Control before they're late.

## Environment variables (ops additions)

| Var                     | Purpose                                                           |
| ----------------------- | ----------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`     | Intake triage classifier + inbox ingest parsing (`claude-opus-5`) |
| `GITHUB_DISPATCH_TOKEN` | "Dispatch to Claude" GitHub issue creation                        |
| `CRON_SECRET`           | Protects `/api/cron/*`; Vercel sends it as a Bearer token         |

All are optional — every AI/automation feature degrades to a manual path when unset.

## Data model quick reference (migration `supabase/migrations/0014_operations_core.sql`)

- `issues` — the bank. Status flow: `new → triaged → queued → batched → in_progress →
fixed → shipped` (+ `awaiting_client`, `closed`). Client-visible rows appear in the portal.
- `fix_batches` — compiled work orders: `draft → compiled → dispatched → pr_open → shipped`.
- `system_profiles` — one per project: the passport.
- `system_templates` — the template bank.
- `build_credit_events` — allowance ledger, keyed by `(tenant, period)`.
- `subscriptions.plan` — text: `hosting | hosting_api | build_3 | build_10`.

## Team access

Admin access = a `staff` membership on the internal tenant (preferred) **or** an entry in
`ADMIN_EMAILS` (transitional). Every admin mutation is audit-logged (`audit_log`).

## Client portal access links (invite / reset)

Every "choose your password" link we email — the invite from the client hub, the
self-serve `/portal/forgot` reset, the admin "Send password reset link" — is built by
`apps/web/lib/portalAccess.ts` and lands on **`/portal/reset?token_hash=…&type=invite|recovery`**.
The page renders the form immediately; on submit `portal/reset/actions.ts` verifies the
hashed token **server-side** (`auth.verifyOtp`) with the cookie-writing Supabase client,
sets the password, audits `portal.password_set_via_link`, and redirects to `next`
(portal-internal paths only — see `lib/portalLinks.ts`).

Why not Supabase's `action_link`: the browser client is PKCE-only (`@supabase/ssr`) and
rejects the implicit `#access_token=` fragment those links redirect with, so the old page
waited forever. `/portal/reset` keeps a client-side fallback that adopts a legacy fragment
session or explains an expired link and offers a new one.

Three-branch rule (`ensurePortalAccess`): no account → invite link; account never signed
in → fresh recovery link; account in use → membership only, never a reset. Links are
single-use and expire after one hour. Supabase Auth → URL Configuration must have Site URL
`https://nullshift.co.uk` and `https://nullshift.co.uk/**` in Redirect URLs (fixed
2026-09-02); without it GoTrue silently redirects to the Site URL. Portal emails set
`Reply-To` to `ENQUIRY_NOTIFY_EMAIL` so client replies reach a read inbox.

## Direct Debits board (`/admin/billing/direct-debits`)

The owner's surface for recurring billing — one row per client:

1. **Bracket.** The client's scale band from their latest `scale_assessments` row
   (set on `/admin/clients/[id]/pricing`). Unscored clients show "Not scored" and the
   portal shows them **no plan options** until you score them — the bracket is set first.
2. **Their three options.** Core / Pro / Max at the client's contracted price. Enterprise
   is never offered; it appears only once an enterprise assessment carries an agreed or
   override figure. Prices come from `apps/web/lib/pricing/contractedPrice.ts`
   (agreed → override → formula for the scored plan; the band multiplier × base price,
   floored by vendor cost, for sibling plans). The same function prices the portal
   chooser and the Direct Debit charge, so the figure shown is the figure collected.
3. **Portal** — no account / never signed in / signed in, with "Send portal invite",
   "Send sign-in link" or "Send password reset" (all via `lib/portalAccess.ts`).
4. **Direct Debit** — not started / awaiting mandate / active / past due, with
   "Send plan options" (emails the three prices + a link into `/portal/plan`) and
   "Send Direct Debit link" (emails the GoCardless authorisation for a chosen plan,
   gated on: rail configured, client scored, an email on file, and a signed proposal
   or a paid invoice). Both start through `lib/directDebit.ts`, as does the portal.

A rail-status panel at the top says Live / Sandbox / Not configured from the
`GOCARDLESS_*` env; when not configured every Direct Debit button is disabled and the
missing variables are named. Audit actions: `care_plan.plan_invite_sent`,
`care_plan.dd_setup_sent` / `dd_started` (with amount, band, pricing version and
assessment id), `care_plan.dd_activated`, `care_plan.dd_cancelled`,
`care_plan.payment_failed` / `payment_recovered`, `gocardless.mandate_orphaned`.

## GoCardless Direct Debit (care plans)

Monthly care plans can be collected by Bacs Direct Debit through GoCardless as an
alternative to the Stripe card checkout. Same graceful degradation as Stripe: with no env
vars set, every helper no-ops (`@nullshift/billing/gocardless`).

| Var                         | Purpose                                                               |
| --------------------------- | --------------------------------------------------------------------- |
| `GOCARDLESS_ACCESS_TOKEN`   | API access token (from the GoCardless dashboard → Developers)         |
| `GOCARDLESS_ENVIRONMENT`    | `live` or `sandbox` — anything other than `live` uses the sandbox API |
| `GOCARDLESS_WEBHOOK_SECRET` | Webhook endpoint secret (HMAC-SHA256 signature verification)          |

**Webhook endpoint:** `https://nullshift.co.uk/api/gocardless/webhook` — add it in the
GoCardless dashboard (Developers → Webhook endpoints) with the secret above. GoCardless
sends all events to the endpoint; the handler acts on these and 200-acks the rest:

- `billing_requests` / `fulfilled` — mandate authorised → creates the monthly GoCardless
  subscription and activates our `subscriptions` row (`provider='gocardless'`).
- `mandates` / `cancelled`, `expired`, `failed` — row → `canceled`.
- `subscriptions` / `cancelled`, `finished` — row → `canceled`.
- `payments` / `failed`, `late_failure_settled`, `charged_back` — the row → `past_due`
  (the payment is fetched to find its subscription); `confirmed` / `paid_out` → back to
  `active`. A reused Idempotency-Key returns 409 `idempotent_creation_conflict`, which the
  client adopts rather than failing (`GoCardlessConflictError`).

**The flow:** client chooses a plan in the portal → `startCareDirectDebit()` creates a
GoCardless billing request (Bacs mandate, metadata carries tenant + plan) plus a hosted
flow, and the pending `subscriptions` row stores `gc_billing_request_id` → the client
authorises the mandate on GoCardless's page (returned to `/portal/plan?dd=authorised`,
or `?dd=exit` if they bail) → the `billing_requests.fulfilled` webhook creates the
subscription against the new mandate and flips the row to active.

**Sandbox testing:** leave `GOCARDLESS_ENVIRONMENT` unset (or `sandbox`) and use a
sandbox access token — the client targets `api-sandbox.gocardless.com`. In the sandbox
authorisation flow use GoCardless's test bank details (sort code `20-00-00`, account
`55779911`); mandates activate within minutes and webhooks fire for the full lifecycle,
so the whole choose → authorise → activate loop is testable without moving money.

## Xero invoice sync

Every invoice the system creates is mirrored into Xero as an authorised ACCREC
sales invoice against the client's Xero contact (found or created by email/name
on first sync, cached on the tenant). Payments are recorded in Xero when the
invoice is paid — by card (Stripe webhook) or by bank transfer ("Mark paid —
transfer" in the client hub). Older invoices can be pushed on demand with the
"→ Xero" button on the client hub's invoice rows.

**Setup (Xero custom connection — machine-to-machine, one organisation):**

1. developer.xero.com → New app → **Custom connection**.
2. Scopes: `accounting.transactions` + `accounting.contacts`. Authorise it
   against the Nullshift organisation (Xero bills custom connections as a
   small monthly add-on in the UK).
3. Vercel env vars:
   - `XERO_CLIENT_ID` / `XERO_CLIENT_SECRET` — from the custom connection.
   - `XERO_SALES_ACCOUNT_CODE` — revenue account for invoice lines
     (default `200`, Xero's standard Sales account).
   - `XERO_PAYMENT_ACCOUNT_CODE` — the bank account payments are recorded
     against (tick "Enable payments to this account" on it in Xero).
     Optional: leave unset and invoices sync as AUTHORISED but payments
     stay manual in Xero.
   - `XERO_TAX_TYPE` — line tax type; default `NONE` (not VAT-registered).
     Set `OUTPUT2` (20% VAT) if/when VAT registration happens.

Unconfigured = fully inert: no env vars, no Xero calls, no UI buttons.
