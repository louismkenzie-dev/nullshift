# Nullshift admin redesign — Phase 0 evidence and architecture report

## 1. Baseline

| Item | Value |
|---|---|
| Date | 2026-09-17 |
| App root | `/Users/louismckenzie/Desktop/Claude Code/nullshift` (git root is the parent directory) |
| Branch / commit | `feat/admin-redesign` @ `2a52c7151423ba607d3bfadd6c27175f85c6be97` |
| Relationship to main | Byte-identical to `origin/main`; also the HEAD of the Codex worktree branch `claude/direct-debits-portal-handoff-g3bg7p` |
| Live deployment | Vercel project `nullshift` (`prj_6LbXDCPUzTK8aIc3nSptHnKIxj9Z`); newest READY production deployment `dpl_GdCKotaVQDS87UmDmVNmYiBc12Fb` built from GitHub `main` @ `2a52c71`. An earlier production deployment today (`dpl_7BGhSGE6opCdmHJDZqjACzvatRyh`) was uploaded from a no-git snapshot; its marketing-only differences versus main are being reconciled separately and are out of scope here |
| Typecheck / tests | `pnpm -C apps/web typecheck` clean; vitest 44 files, 532 tests passed on this commit |
| Legacy clients | Amy / The Dance Exclusive, Suffolk Tennis, New Future Therapy must not be migrated, repriced or rewritten |

**Overlapping in-progress work**

| Work | State | Relevance |
|---|---|---|
| PR #20 `feat/client-economics-final` | Open, 12 ahead / 14 behind main | `/admin/economics`, `lib/economics/quote-model.ts`, migration `0056_client_economics.sql`, a three-file MFA-ordering fix (`a426c87`), one nav line, an unrelated SpeedInsights mount. Textually clean against main today (`git log 284b459..origin/main` on the contested paths is empty) |
| Codex worktree `~/.codex/worktrees/7c21` | Uncommitted, detached at `cc447cd`; captured as local branch `codex/brgt-worktree-7c21-wip` | BUILD/RUN/GROW/TRANSACT model: 55 modified + 3 new files including `packages/content/src/commercial.ts` and migration `0052_commercial_model_v2.sql`; 14 files collide with main; migration number 0052 already taken on main |
| Local branch `codex/build-run-grow-transact` @ `b858367` | Based on `c272b7e` (2026-09-13) | Earlier, divergent BRGT iteration with migration `20260913130631_commercial_model_v2.sql`; not a subset or rebase of the worktree; 22 files collide with main |
| `feat/direct-debits` | Fully merged (0 ahead) | No action |

**Evidence caveat.** Everything below is drawn from eleven domain audits (shell, client workspace, pricing/plans, agreements/legal, Direct Debit, Xero/Stripe/invoices, schema/tenancy, auth/side-effects, portal/onboarding, PR #20, BRGT/Codex). Their `path:line` claims were not independently re-verified for this report; where two audits agreed the claim is treated as confirmed code, and where a claim depends on Vercel env, Supabase ledger state, provider dashboards or row counts it is marked **unverified live state**. Nothing in this report asserts that a live integration works.

## 2. Route inventory

Purpose and side effects on a plain authenticated GET render. "None found" means the audit traced the render path and found only reads.

| Route | Area | Purpose | GET render side effects |
|---|---|---|---|
| `/admin/login` | admin | Client-side password sign-in; proxy bounces signed-in users to `/admin` | None found. `?next=` is honoured unvalidated (`admin/login/page.tsx:37,54`) |
| `/admin/security` | admin | TOTP enrolment / aal2 step-up; outside `(dashboard)` group | None found; gate is `ADMIN_EMAILS` only (`admin/security/page.tsx:23`) |
| `/admin/(dashboard)/*` layout | admin | Env check, auth, aal2 redirect, staff check, Atmosphere canvas, AdminNav, OperationOverlay | **Writes**: service-role upsert of `memberships{user, internal tenant, role:'staff'}` for allowlisted users without membership (`(dashboard)/layout.tsx:81-99`). Runs `mfa.getAuthenticatorAssuranceLevel()` and `rpc('is_internal_staff')` per request |
| `/admin` | admin | Client grid: one block per client tenant coloured by signature state, seven tile dots, Enquiries and Platform rows | None found: 13 service-role bulk selects + `auth.admin.listUsers` (`lib/hub/load.ts:585-597`). Enquiry block posts `openLead`, which has no `requireStaff` (`pipeline/actions.ts:17-20`) |
| `/admin/overview` | admin | Former Mission Control (960 lines; moved from `/admin` at `a58642c`, 2026-09-03) | None found (RLS selects) |
| `/admin/clients` | admin | Client list: Client/Contact/Stage/Compliance/MRR + inline create | None found; no page-level `requireStaff` (`clients/page.tsx:93-133`) |
| `/admin/clients/[id]` | admin | Client block: header chip, StageStepper of newest project, seven tiles, "Needs you" | None found (`lib/hub/load.ts:653-694`) |
| `/admin/clients/[id]/account` | admin | Calls, portal access, stage select, owners/next action, notes | None found |
| `/admin/clients/[id]/agreement` | admin | Order Forms, Change Orders, review gate, acceptance evidence | None found (`agreement/page.tsx:516-556`) |
| `/admin/clients/[id]/billing` | admin | Invoices, build modules, subscriptions, Stripe Connect panel | **Writes + provider call**: `reconcileXeroInvoices(service,{tenantId,limit:10})` calls Xero and flips `invoices.status` to `paid` with audit rows (`billing/page.tsx:71`; `lib/xeroSync.ts:155-215`). Dormant only if Xero env absent (unverified) |
| `/admin/clients/[id]/care-plan` | admin | Plan state, contracted prices, send options / DD link, history parsed from `audit_log` | None found (`care-plan/page.tsx:127-216`) |
| `/admin/clients/[id]/docs` | admin | Proposal, Order Form, Change Orders, receipts, approvals | None found |
| `/admin/clients/[id]/documents` | admin | Legacy proposal/DPA render | None found |
| `/admin/clients/[id]/issues` | admin | Issues, change requests, fix batches, tasks | None found |
| `/admin/clients/[id]/passport` | admin | Redirects to `/admin/systems/[projectId]` when exactly one project | None found (redirect only) |
| `/admin/clients/[id]/pricing` | admin | Scale assessment cockpit, overrides, reband snapshots | None found (`pricing/page.tsx:466-507`) |
| `/admin/clients/[id]/preview` | admin (GET route) | Start "view portal as client" | **Writes**: sets httpOnly `ns_client_preview` cookie (2 h, `/portal`) and inserts `audit_log 'client_preview.started'` (`preview/route.ts:58-71`). No client data changed |
| `/admin/billing` | admin | Money cockpit: MRR, subscriptions, invoices, Xero status strip | **Writes + provider calls**: `reconcileXeroInvoices(service,{limit:10})` tenant-wide (touches legacy rows) and `getXeroSetupStatus()` (token exchange + `/Organisation` + `/Accounts`) on every render (`billing/page.tsx:293-300`) |
| `/admin/billing/direct-debits` | admin | DD board: rail status (Not configured/Sandbox/Live), per-client state | None found (env reads only, `direct-debits/page.tsx:83-85`) |
| `/admin/billing/fees` | admin | Connect application-fee ledger | None found (`fees/page.tsx:93-101`); Stripe calls only in `syncNow` / `assignAccount` actions |
| `/admin/systems/[id]/handover` | admin | Eight-boolean handover rail + AI draft note action | None found |
| `/admin/systems/[id]/plan` | admin | Build plan / fix batches (not a care-plan surface) | None found |
| `/admin/economics` | admin (PR #20 only) | Revenue vs tracked labour/cost, quote-intelligence form | None found on page; inherits layout upsert |
| `/portal/login`, `/signup`, `/forgot`, `/reset`, `/signout` | portal | Auth surfaces | None on render except `/portal/signout` runs `signOut()` on mount; `/portal/login` honours unsanitised `?next=` (`portal/login/page.tsx:52,80`; `lib/authDestination.ts:17-24`) |
| `/portal/(dashboard)/*` layout | portal | Client gate, staff bounce, DPA/entity hard gate | **Writes**: `ensureClientWorkspace` may insert tenant, `client_admin` membership, discovery project; may DELETE a race-losing tenant; may auto-join by `contact_email ilike` (`portal/(dashboard)/layout.tsx:48-50`; `lib/ensureClientWorkspace.ts:41-115`). Skipped under preview |
| `/portal` | portal | Home: proposal CTA, six tiles, systems, requests, plan meter, payments | None found |
| `/portal/proposal` | portal | Review/sign proposal + DPA + Service Terms | **Writes** `document_events 'viewed'` via `recordClientViews` (`proposal/page.tsx:362`) |
| `/portal/legal` | portal | Order Form clickwrap, Change Order decisions, subprocessors | **Writes** read receipts (`legal/page.tsx:302`); `select('*')` on `order_forms` exposes internal columns (`legal/page.tsx:257`) |
| `/portal/legal/close` | portal | Data export and termination request | None found on render; sums draft invoices as owed (`close/page.tsx:207`) |
| `/portal/plan` | portal | Care-plan chooser gated by `planChoiceOpen(stage)` | None found |
| `/portal/plan/confirm` | portal | Terms summary → `choosePlan` → GoCardless redirect | **Writes** `document_events 'viewed'` for `care_plan_terms` (`plan/confirm/page.tsx:60-67`) |
| `/portal/payments`, `/updates`, `/requests`, `/project/[id]` | portal | Invoices/balance; updates and decisions; issue intake; system page | None found |
| `/portal/deliverables` | portal | Documents with signed URLs | **Writes** read receipts (`deliverables/page.tsx:55`) |
| `/portal/exit-preview` | portal (GET) | End preview | Clears preview cookie (`route.ts:22`) |
| `/api/documents/[kind]/[projectId]` | API GET | A4 PDF for proposal / dpa / terms (no Order Form or Change Order PDF exists) | **Writes** read receipts (`route.ts:104`); renders live `project_items` while status is `sent` (`route.ts:137-144`) |
| `/api/sar/[tenantId]` | API GET | Staff SAR export | **Writes** `audit_log 'sar.exported'` + `compliance_records` (`route.ts:21-27`) |
| `/api/auth/confirm-email` | API GET | Verify emailed OTP link | Creates a session (cookies) then origin-allowlisted redirect (`route.ts:38-78`) |
| `/api/auth/client-signup`, `/verify-code`, `/resend-confirmation`, `/signout` | API POST | Public signup/verification via service role | n/a (POST). `resend-confirmation` rate limit is an in-process `Map` (`resend-rate-limit.ts:4`) |
| `/api/client-onboard`, `/api/funnel` | API POST | Lead capture | n/a (POST); `/api/funnel/preview` GET is disabled in production |
| `/api/stripe/webhook` | API POST | invoice.paid/payment_succeeded/voided, checkout.session.completed, subscription.*, application_fee.* | n/a. Dedupe is check-then-insert on `stripe_events` (`route.ts:42-47,181`); Xero payment PUT fired per event with no guard |
| `/api/gocardless/webhook` | API POST | billing_requests.fulfilled → create GC subscription + activate; mandates/subscriptions cancel; payments → invoice + Xero | n/a. No event ledger; 503 without `GOCARDLESS_WEBHOOK_SECRET` (`route.ts:38-39`) |
| `/api/cron/ai-tick` (07:00 Mon–Fri) | cron GET | Fire AI Workspace routines | Writes `agent_routine_runs` / `agent_tasks` (fire_key unique) |
| `/api/cron/legal-deadlines` (06:00) | cron GET | Complaint/subprocessor/termination deadline alerts | One Resend email; no DB writes |
| `/api/cron/soc2-sweep` (06:30) | cron GET | SOC 2 control runs and exceptions | Inserts `soc2_*` rows (fire_key idempotent); alert emails |
| `/api/cron/weekly-pulse` (08:00 Fri) | cron GET | Per-client digest + open-invoice chase list to agency inbox | One email; no writes. **No billing/reconciliation cron exists** (`vercel.json`) |

## 3. Schema, permissions and tenancy

**What exists.** A single Supabase project; 55 numbered migrations `0001–0055` layered on a still load-bearing legacy 3-digit series plus `schema.sql` (`supabase/README.md:3`). Tenancy is `tenants → memberships` with `is_member_of` / `is_internal_staff` SECURITY DEFINER helpers (`0001:66,256-268`). The client is a `tenants` row (`type='client'`, `status` free text default `'active'`); `projects` carry stage (8-value enum, `0001:18`, `0024:9-11`), proposal status, DPA fields, four free-text owners and `next_action` (`0022:6-12`); `system_profiles.project_id` is 1:1 with a project (`0014:64-66`). Order Forms, subscriptions, scale assessments, invoices (partly) and `care_plan_choice` are tenant-level (`0030:26-27`, `0017:37-38`), so there is one billable unit per legal client.

**Roles and capabilities.** Staff = membership `owner|staff` on the internal tenant OR email in `ADMIN_EMAILS` (`packages/auth/src/guards.ts:34-38`; `admin.ts:3`). `requireStaff()` is the only gate across 54 admin files; there is no capability model, so any staff member can cancel subscriptions, insert invoices and send agreements. Eleven client-hub actions (`setStage`, `recordDpa`, `ensureProject`, …) skip `requireStaff` and rely on RLS through the cookie client (`clients/[id]/actions.ts:512-518,909-915`). MFA (TOTP) is voluntary, checked only as a layout redirect (`layout.tsx:72-77`); `requireStaff`, proxy, server actions and API routes are AAL-blind. On main the aal2 redirect runs before the staff check and `/admin/security` accepts the allowlist only, so a membership-only staff user (or any non-staff user) with a TOTP factor loops dashboard → security → login → dashboard; PR #20's `a426c87` fixes the ordering. Portal roles are nominal: only `client_admin` is ever minted (`ensureClientWorkspace.ts:88`; `portalAccess.ts:103-104`), any member can accept an Order Form via RLS read then service-role write (`portal/legal/page.tsx:116-141`, bypassing `0030:401` `is_tenant_admin`), and `requireTenantMember` passes staff as members (`guards.ts:57`). The SOC 2 guard (`lib/soc2/guard.ts:32-78`, role-based `anyOf`) is the only capability precedent.

**Durability primitives.** Partial uniques: one non-void `build_milestone` per project and unique `stripe_subscription_id` (`0013:6-14`); one invoice per issue (`0025:17`); one per GoCardless payment (`0045:10`); one acceptance per order (`0030`); `pricing_snapshots (tenant, period)` (`0032:42`). GoCardless `gc_*` indexes are non-unique (`0017:24-28`); nothing guards one live subscription per tenant. No outbox/inbox/lease/retry table exists; `stripe_events` is `(id, type, received_at)` inserted after processing (`0012:12`); GoCardless has no event table. `audit_log` is six columns with freeform metadata, readable by every tenant member (`0001:198,358`). Migration hygiene: two `0020` files, `0040–0043` renumbered after apply, `0052` applied under two ledger names, SQL-editor/MCP apply with no `config.toml` — the live ledger, not the directory, is the source of truth (unverified live state).

**§12.1 concept mapping**

| Concept | Status | Where it lives today | Gap |
|---|---|---|---|
| Legal client / organisation | Partial | `tenants` (name, type, vertical, contact_*, `stripe_customer_id`, `xero_contact_id`, `stripe_connect_*`, `care_plan_*`); legal identity only as copies on `order_forms` | No legal/trading split, no tax details, no legacy marker, no client-level owners |
| Contact / role assignment | Partial | `memberships (user_id, tenant_id, role)`; enum `owner/staff/client_admin/client_member` (`0001:16`) | No signatory/billing/project flags, no invitation state; only `client_admin` minted |
| Opportunity | Partial | `leads` (status new→lost, `lead_score`, `plan` jsonb) on the internal tenant; `openLead` never writes `leads.tenant_id` | No quote-version link; email-string merge only |
| Project and system | Exists | `projects` (+ owners, `next_action`), `system_profiles` (repo/vercel/supabase refs, health) | Owners are free text with no FK or due date; "newest project wins" everywhere |
| Quote assessment | Exists | `scale_assessments` (`pricing_version`, inputs, component scores, `override_mrr`+reason, `agreed_mrr`, `plan_prices`) + `scale_evidence` (`0028`, `0044`, `0047`) | No cost-to-serve, floor/target split, confidence or approver; always saved as `plan='core'` |
| Quote / document version | Partial | `order_forms` / `change_orders` with `superseded_by` / `supersedes_id` (never written); proposals freeze `projects.accepted_snapshot` | No Order Form snapshot or PDF; no withdraw/supersede writer; hard-required plan/fee |
| Acceptance | Exists | `contract_acceptances` (versions, `document_hashes`, method, IP/UA, three confirmations) (`0030:132-173`) | Hashes cover policy texts + fee clause only, never the Order Form's commercial content; `signed_artifact_path` never written |
| Service arrangement | Missing | Route implied by `tenants.care_plan_choice` (`none` or legacy plan id) + `projects.stage` | No managed/independent/unresolved election, agreed dates or handover terms |
| Plan acceptance | Partial | `tenants`/`subscriptions` `terms_version`, `terms_accepted_at/by` (`0046:13`); `document_events 'signed'` for `care_plan_terms` | No inclusions snapshot, tax/currency, usage schedule or governing document link |
| Mandate / setup request | Partial | Three text columns on `subscriptions` (`gc_billing_request_id`, `gc_mandate_id`, `gc_subscription_id`, `0017:19`) | No status, environment, consent reference or history; `mandates.replaced` overwrites |
| Billing obligation | Missing | — | Nothing joins agreement + milestone/period to an amount with an orchestration owner |
| Invoice projection | Partial | `invoices` (type `build_milestone/one_off/care_plan`, `amount` numeric(10,2), `stripe_invoice_id`, `xero_invoice_id`, `gc_payment_id`, one `hosted_invoice_url`) + `invoice_items` | No net/tax/gross, currency, allocations, issuer column or sync metadata |
| Collection attempt | Missing | Paid `care_plan` invoice keyed on `gc_payment_id` is the only per-collection record | No attempt identity, scheduled vs actual dates, outcome |
| Payout / allocation / bank match | Missing | `connect_application_fees` is a fee ledger only (`0054`) | No payout, bank evidence or match state |
| Request / work item | Exists | `issues` (`status`, `billing`, `classification`, `change_order_id`, DB gate trigger `0030:334-349`) | Three overlapping vocabularies; `change_order_id` never written; brief's categories absent |
| Checklist task | Partial | `checklists.items` jsonb `[{name, done}]` unique `(project_id, kind)` (`0040:86-95`) | No owner, state, due date, waiver, evidence |
| Integration event / operation | Partial | `stripe_events` only | No payload ref, environment, attempts, lease, error state; nothing for GoCardless or Xero |
| Audit event | Exists (thin) | `audit_log` + stamp trigger (`0003:95`) | No reason, before/after, correlation id; client-readable |

## 4. Integration configuration

Env var names only; live values are not visible from source.

| Provider | Confirmed in code | Unverified live state |
|---|---|---|
| **Xero** | Reads `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`, `XERO_SALES_ACCOUNT_CODE` (default `200`), `XERO_PAYMENT_ACCOUNT_CODE`, `XERO_GOCARDLESS_ACCOUNT_CODE`, `XERO_TAX_TYPE` (default `NONE`), `INVOICE_RAIL`. `isXeroConfigured()` = id + secret present (`packages/billing/src/xero.ts:24-26`); Xero is primary unless `INVOICE_RAIL=stripe` (`xero.ts:217`). Invoice create precedes local save (`lib/xeroSync.ts:97-124`); contact matched by cached id → `contact_email` → exact name → create (`xero.ts:96-123`); `LineAmountTypes 'NoTax'`, GBP hard-coded (`xero.ts:159-160`); `order_forms.vat_treatment` never read at issuance. Payment PUT has no idempotency and returns no Xero PaymentID; null payment account silently disables recording (`xero.ts:191-192`). Status strip distinguishes "configured" from "connection verified" but has no "last sync succeeded" (`billing/page.tsx:238-240`) | Whether Xero env is set on Vercel (decides whether page-load reconciliation is live); account codes 090/091 claimed in HANDOFF; whether a payment service is connected inside Xero (Pay-now overlap with DD/bank transfer); whether legacy tenants carry `xero_contact_id`; orphaned AUTHORISED invoices from failed syncs or unmirrored voids |
| **GoCardless** | Reads `GOCARDLESS_ACCESS_TOKEN` (configured iff present, `gocardless.ts:24`), `GOCARDLESS_ENVIRONMENT` (`'live'` else sandbox), `GOCARDLESS_WEBHOOK_SECRET` (webhook 503 without it). Raw-body HMAC `timingSafeEqual` verify (`gocardless.ts:361-372`); `Idempotency-Key` + 409 adoption for subscription create (`gocardless.ts:91-93,212-214`) but not for billing-request create (`lib/directDebit.ts:142-152`). Fulfilled handler activates immediately with `started_at=now()` and no `start_date` (`api/gocardless/webhook/route.ts:173-190`; `gocardless.ts:197-204`). `.env.example` omits the three `GOCARDLESS_*` names | Which environment production uses (HANDOFF, OPS audit and memory disagree); whether the dashboard webhook points at production; whether migrations `0045–0047` are applied; Suffolk Tennis' incomplete billing request and its `metadata.amount_pence` |
| **Stripe + Connect** | Reads `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_CLIENT_ID`, `STRIPE_CONNECT_REDIRECT_URI`, `STRIPE_CONNECT_STATE_SECRET`, `STRIPE_PRICE_ID_{CORE,GROW,PRO,PARTNER,MAINTENANCE}`. Webhook verifies on raw body, dedupes check-then-insert (`route.ts:42-47,181`); `checkout.session.completed` inserts an active row at catalogue `plan.mrr` with no terms (`route.ts:131-138`). Connect fee gate requires `stripe_connect_status='connected'` + newest accepted Order Form with a signed percent (`lib/legal/applicationFee.ts:95`; `0053:29`). `chargeThroughConnect` has no caller and would create destination charges (`stripe.ts:238`), contradicting the documented direct-charge model (`connect.ts:17`). Fee ledger `connect_application_fees` keyed on Stripe fee id, live/test split (`0054:16-24`). Edge function `stripe-webhook` is a 410 stub | Whether "Listen to events on Connected accounts" is enabled (otherwise ledger fills only via Sync now); how the live fees were actually charged (code outside this repo); whether `0054`/`0055` are applied; `tenants.stripe_customer_id` on legacy tenants |
| **Revolut** | No domain audit reported any Revolut code path, env var or table in `apps/web` or `packages/*`. Bank-transfer details rendered on `/portal/payments` and invoice emails are static content | Native Revolut→Xero bank feed status is a Xero/bank-side configuration (§18 item 8); nothing in source can confirm it. No bank-match record exists to receive it |
| **Resend** | `sendEmail` guards only on `RESEND_API_KEY` presence and a marketing-permission RPC; `RESEND_FROM_EMAIL` sets the sender (`lib/sendEmail.ts:82-90`). No environment allowlist; only the signup code carries an `idempotencyKey` (`client-signup.ts:86`); invites, plan invites, DD links and documents-ready can be re-sent freely | Whether preview/staging deployments share the production key (fixtures with real addresses would email real clients) |
| **Supabase** | `SUPABASE_SERVICE_ROLE_KEY` (`packages/db/src/server.ts:39`) used inside portal request handling, webhooks, crons, provisioning and acceptance writes; `ADMIN_EMAILS`; `CRON_SECRET` (crons fail closed); `SUPABASE_DB_URL` gates the RLS test, which SKIPs in CI (`rls.test.mjs:18-29`; `ci.yml:50-52`); `NEXT_PUBLIC_LEGAL_EFFECTIVE_DATE` defaults to `20 August 2026`, so `bindingAcceptanceEnabled()` is true on every deploy (`legal/config.ts:80,159`) | Live ledger contents (`supabase_migrations.schema_migrations`); whether `017_portal_project_hub.sql` policies exist in production; Auth dashboard settings (MFA enforcement, leaked-password protection, redirect allow-list); whether any staff has a verified TOTP factor; whether `contact_email` is populated/unique on legacy tenants; whether `060`/`0056` economics tables exist |

## 5. Calculator, PR #20, Codex BRGT implementation and the brief's model

**Comparison**

| Dimension | Main (NSI_v1_2026_08) | PR #20 `quote-model.ts` | Codex worktree (BRGT) | Branch `b858367` | Brief §6 |
|---|---|---|---|---|---|
| Recurring price basis | Catalogue base £40/£80/£120 × band multiplier (×1.0–×5.5), 75% floor on one vendor-cost input (`nsi.ts:25,28,250-255`) | `clamp(costToServe×1.75, 80, 900)`; £40/hr fixed (`quote-model.ts:84-85`) | Fixed £149/£249/£399 (`carePlans.ts:62,81,98`) | Fixed £149/£249/£399 written onto legacy ids (`carePlans.ts:56-91`) | Cost-to-serve + margin policy; floor = cost/(1−min margin), no hard maximum, versioned |
| Build price | None; `order_forms.project_fee` free numeric (`0030:56`) | `roundTo(clamp(baseBuild,1800,15000),100)` (`:80`) | Discovery £350–£750, launch packs, Grow price list (`commercial.ts:14,34`) | Same idea, different identifiers | Work breakdown, loaded rates, contingency, scenarios |
| Transaction fee | Signed percent on Order Form, no default (`0053`; `stripe.ts:220-227`) | 150→75 bps volume ladder (`:87-93`) | `DEFAULT_TRANSACTION_FEE_RATE 0.015` + parallel column (`fees.ts:7`) | `TRANSACTION_FEE_RATE 0.015` | Separately agreed, never derived |
| Versioning | `PRICING_VERSION` stamped on assessments, snapshots, notices, order forms | None | `COMMERCIAL_MODEL_VERSION` string | `COMMERCIAL_MODEL_ID` | Formula/policy version + effective date + draft/published |
| Tier-pending / route / start date | Not representable (`0030:43-48`) | n/a | Not representable; defaults £149 (`agreement/page.tsx:195-284`) | Not representable | Required |
| Legacy handling | Tenant-agnostic actions can re-score/re-price anyone | Lists all tenants; writes only new tables | Subscription-row guards (gap: tenant without a row) | SQL `UPDATE tenants set commercial_model='legacy'` | Never migrate, reprice or rewrite |
| Tests | nsi-pricing, contracted-prices, reband, plan-gate, pricing-visibility | `quote-model.test.ts` locks in bps ladder | Tests assert prices | — | Tested calculations, worked examples |

**Verdict.** None of the four is the brief's model. Main's NSI engine has the right *persistence pattern* (versioned inputs + component scores + override-with-reason + agreed separate from recommended) but the wrong *formula* (caps, multiplier of a marketing from-price, double-counted vendor cost, plan coupling). PR #20's model is rejected outright. Both BRGT implementations hard-code unapproved prices and neither addresses incompatibilities #1–#3.

**Per-file recommendation**

| File | Source | Recommendation | Reason |
|---|---|---|---|
| `packages/auth/src/admin.ts` (`adminAccessDecision`), `(dashboard)/layout.tsx` reorder, `admin/security/page.tsx` → `requireStaff`, `tests/admin-auth-routing.test.ts` | PR #20 `a426c87` | **Reuse — cherry-pick first** | Fixes a loop reproducible from source; self-contained; conflicts only with the redesign's own layout rewrite if delayed. Follow-up: add AAL inside `requireStaff` |
| `supabase/migrations/0056_client_economics.sql` (`economics_time_entries`, `economics_cost_entries`, `client_economics_summary`) | PR #20 | **Rework** (re-author) | Shape fits §6.4 actuals capture; replace £40 column default with a versioned role-rate table, store pence, add owner/role; verify ledger for `060`/`0056` first |
| `apps/web/lib/economics/quote-model.ts`, `quote_assessments` table, `tests/quote-model.test.ts` | PR #20 | **Discard** | Caps, markup labelled margin, bps discount, no version |
| `economics/actions.ts`, `economics/page.tsx` | PR #20 | **Discard** | Duplicate `assertStaff`, zero-defaults for missing inputs, contribution framed as profitability |
| `AdminNav.tsx` one-liner, `app/layout.tsx` SpeedInsights | PR #20 | **Drop** | Redesign owns nav; SpeedInsights is a cookie-policy decision |
| `packages/content/src/commercial.ts` — `OpsClassification` enum, treatment mapping, labels | Worktree | **Reuse (rework)** | Matches §7 vocabulary; add "Included — build warranty" and "Coverage needs review"; strip prices |
| `lib/ops/classify.ts` billing-from-treatment, `lib/ops/buildAll.ts` no auto-promotion, `IssueRow` queue gate | Worktree | **Reuse** | Deterministic; removes "unclassified→covered" |
| `lib/directDebit.ts` legacy amount-preservation guard (`priceSource 'stored_incomplete_legacy'`) | Worktree | **Reuse (rework)** | Right intent; key on a tenant-level legacy marker, not a subscription row |
| `packages/billing/src/stripe.ts` `connectPaymentIntentRequest` (direct charge default) | Worktree | **Reuse** | Fixes destination-charge default; keep main's signed-percent requirement |
| Portal `decideChangeOrder` → issue link + `generateQuoteInvoice` | Worktree | **Rework** | Correct linkage; invoice step must become a recoverable operation (#6) |
| `0052_commercial_model_v2.sql` | Worktree | **Discard** (mine the nullable-column pattern) | Number taken; global trigger freezes unclassified issues; rewrites `enforce_change_order_before_build` and client insert RLS |
| Prices, `fees.ts` default, legal version bumps, Service Terms templates, marketing/llms/FAQ copy | Worktree | **Discard** | Unapproved prices, republishes withheld figures, MSA version bump without body change |
| `carePlans.ts` repricing, timestamp migration, `commercial_model` NOT NULL backfill | `b858367` | **Discard** | Reprices legacy ids in place; writes to legacy rows |
| `work.ts` `commercialDefaults`, `tenants.commercial_model='legacy'` flag idea | `b858367` | **Reuse shape** | Tenant-level legacy marker is the right protection, applied without NOT NULL default |
| `lib/pricing/nsi.ts`, `contractedPrice.ts`, `reband.ts`, `planGate.ts`, `carePlanTerms.ts` + tests | Main | **Reuse (freeze)** | Pin `NSI_v1_2026_08` for legacy tenants; new policy version is additive |
| `scale_assessments` / `pricing_snapshots` / `price_change_notices` schema | Main | **Extend** | Add `policy_version`, floor/target/recommended/approved, approver |

## 6. Proposed client / legal entity / project / system / billable-service mapping

Grounded in current tables; all additions are additive and nullable for legacy rows.

| Brief concept | Current table | Proposal |
|---|---|---|
| Client (relationship) | `tenants` (`type='client'`) | Keep as the client. Add `tenants.legacy_model` (nullable text, set by hand for the three legacy tenants only), `relationship_state` (`prospect/active/paused/offboarded`, replacing free-text `status` semantics without dropping the column), and client-level `account_owner` + `next_action` (currently on `projects`, `0022`) |
| Legal entity | Copies on `order_forms` (`client_legal_*`) + `tenants.xero_contact_id` | New `legal_entities` (tenant_id, legal name, trading name, company number, VAT status, billing email/address, `xero_contact_id` moved by copy not migration). One tenant may have several; Order Forms reference `legal_entity_id`. Legacy tenants get a row created from their accepted snapshot, read-only |
| Contact / role | `memberships` | Add `membership_flags` (or columns) `is_signatory`, `is_billing_contact`, `is_project_contact`, `invited_at/accepted_at`; keep enum. `ensurePortalAccess` becomes the only minting path; `ensureClientWorkspace` moves off GET |
| Project | `projects` | Keep. Stage stays as a delivery label; add `build_accepted_at`, `build_accepted_by` (or a `project_acceptances` record with evidence) so gates read evidence, not stage |
| System | `system_profiles` (1:1 project) | Keep. Add `service_arrangements` (project_id, route `managed/independent/unresolved`, tier `core/pro/max/pending`, agreed billing start, handover terms, state) — this is the §12.1 service arrangement and the home of "Managed, tier pending" |
| Billable service | `subscriptions` (tenant-level) + `invoices` | New `billing_obligations` (tenant_id, legal_entity_id, `service_arrangement_id` or `milestone_id`, kind `milestone/period/one_off`, net/tax/gross pence, currency, issue/due, orchestrator `xero/gocardless/stripe/manual`, state). `subscriptions` gains nullable `service_arrangement_id`; new partial unique on `(service_arrangement_id) where status in ('active','trialing','past_due')` alongside a kept tenant-wide guard for rows with null arrangement (legacy). Milestone identity replaces `0013`'s index with `unique (project_id, milestone_id) where status<>'void'`, created only after `milestone_id` is backfilled for existing rows |

Recurring unit answer (§18 item 7) is a decision, but the schema above supports either "one arrangement per system" or "one per tenant" without rework: the tenant-level path is an arrangement with `project_id null`.

## 7. State transitions

**Existing vs proposed**

| Flow | Existing | Proposed |
|---|---|---|
| Agreement | `order_forms.status` draft → client_review → accepted/rejected; `withdrawn`/`superseded` exist in the CHECK (`0030:33`) but no writer; second-person review gate (`lib/legal/review.ts:44`); proposal path is a parallel regime (`portal/proposal/page.tsx:72`) | Draft → Needs internal review → Ready to issue → Awaiting client → Accepted / Rejected / Withdrawn / Superseded. Issue freezes a rendered snapshot + hash of commercial content; supersede creates a new version row and writes `superseded_by`; legacy accepted proposals map to Accepted without re-signing |
| Delivery / acceptance | `projects.stage` only; DPA trigger blocks `live` (`0005:11`); admin select can regress; `planChoiceOpen` = stage ∈ live/care/complete (`planGate.ts:7`) | Stage remains a label. New build-acceptance record (client signatory or staff-recorded with reason) is the gate for plan choice, handover and Managed start; `planChoiceOpen` reads it, with a per-tenant legacy bypass for rows already on `care` |
| Service route | `tenants.care_plan_choice` `none` or legacy plan id; "Continue without a plan" writes `none` (`plan/actions.ts:76-85`) | `service_arrangements.route` unresolved → managed (tier pending → tier chosen) or independent (handover obligation raised, £600 terms per decision). Route election recorded with document evidence |
| Billing activation | GoCardless fulfilled → create subscription + `active` + `started_at=now()` in one request (`webhook/route.ts:173-190`); Stripe checkout path bypasses terms and gate (`careSubscription.ts:41-63`) | Mandate authorised (record) → commercially approved (accepted arrangement + terms version current) → scheduled (agreed start date, provider `start_date`) → active on first successful collection. Orphan rescue creates a mandate record, never a chargeable row |
| Collection | `payments.*` flip `subscriptions.status`, mint paid `care_plan` invoice keyed on `gc_payment_id` (`carePlanInvoice.ts:71-80`); Xero mirror best-effort | `collection_attempts` per obligation (scheduled/actual, provider id, outcome); Xero invoice-create and payment-allocate as separate `integration_operations` with lease/retry; page loads never reconcile |

**Migration risk register**

| Risk | Evidence | Mitigation | Blocks |
|---|---|---|---|
| Ledger names ≠ file names; new migration numbered against directory not ledger | `supabase/README.md:49`; `0052_business_records.sql:1`; worktree also uses `0052`; PR #20 first authored as `060_` | Read `schema_migrations` before numbering; adopt one ledger contract (CLI) for the redesign series | Any migration |
| `0013` index replacement corrupts or blocks legacy invoices | `0013:6-8`; legacy build invoices exist (claim) | Add `milestone_id` nullable, backfill legacy rows with a synthetic id, create new index, only then drop old — in one transaction, rehearsed on a branch DB | Billing activation |
| New NOT NULL or CHECK widening rewrites legacy subscriptions/tenants | `0014:19-27`; `0017:37-38`; `b858367` backfills | Only nullable columns; never `UPDATE` legacy rows; add the tenant-level `legacy_model` marker by hand | Document issuance, billing activation |
| Duplicate-subscription partial unique cannot be created if two live rows already exist | `0013:12-14`; guards are read-then-write (`directDebit.ts:78-84`) | Query production for duplicates and shared `gc_mandate_id` first (unverified) | Billing activation |
| `0052`-style trigger freezes existing unclassified issues | worktree `0052:108-117` | Never add status-change triggers without a backfill; classification required only for issues created after the flag date | Prototype (if merged) |
| `ensureClientWorkspace` auto-joins a signup to a legacy tenant | `ensureClientWorkspace.ts:41-48,86-88` | Move provisioning off GET; join only via `ensurePortalAccess` invite; confirm legacy `contact_email` state | Prototype browser testing |
| Page-load Xero reconciliation flips legacy invoices during redesign testing | `billing/page.tsx:294`; `xeroSync.ts:189-209` | Feature-flag the reconcile off on the new routes; new routes never import `reconcileXeroInvoices` | Prototype |
| Newest Order Form drives the Connect fee gate | `connectCharge.ts:19-46`; `applicationFee.ts:95` | Gate reads the arrangement's linked Order Form, not "newest accepted"; Suffolk's form untouched | Document issuance |
| Legal version bump without body change breaks version→wording evidence | worktree `legal/config.ts:68`; main hashes from live sources (`versions.ts:61`) | Persist rendered wording at acceptance; bump versions only with solicitor-reviewed text | Document issuance |
| Email sends from prototype/staging reach real clients | `sendEmail.ts:82-90`; no allowlist | Fixtures with `@example.test` addresses only; add an environment allowlist before any fixture carries a real domain | Prototype |
| Card rail (`sendSubscriptionSignup`) activates at base price without terms | `stripe/webhook/route.ts:131-138` | Retire or gate the card rail behind the same activation rules before enabling any new activation | Billing activation |

## 8. Verified incompatibilities

| # | Brief claim | Verdict | Evidence |
|---|---|---|---|
| 1 | Order Form requires plan + monthly fee; cannot represent "Managed, tier pending" | **Confirmed** | `0030:43-48` NOT NULL plan/scale_band/pricing_version/monthly_fee; `acceptance.ts:81-84`; `createOrderForm` prefills `plan:'core'`, `monthly_fee:0` (`agreement/page.tsx:96`); `tenants.care_plan_choice` and `subscriptions.plan` CHECKs admit only legacy ids (`0017:37-38`; `0014:25-27`) |
| 2 | `billing_requests.fulfilled` creates the subscription immediately | **Confirmed** | `api/gocardless/webhook/route.ts:173-190` (`status:'active'`, `started_at: now`); `gocardless.ts:197-204` no `start_date`; portal copy promises it (`plan/page.tsx:408`) |
| 3 | Plan gate relies on stage labels | **Confirmed** | `planGate.ts:7-10`; `plan/actions.ts:58-65` newest project by `created_at`; no DD/pricing file references `order_forms.accepted_at`; admin `setStage` allows regression |
| 4 | Duplicate checks tenant-wide, read-then-write | **Confirmed** | Four sites (`directDebit.ts:78-84`; `webhook/route.ts:125-131`; `careSubscription.ts:57-63`; portal `choosePlan`); only DB uniques are `stripe_subscription_id` and `gc_payment_id`; `gc_*` indexes non-unique (`0017:24-28`) |
| 5 | `0013` permits one non-void build_milestone per project | **Confirmed** | `0013:6-8`; never altered by a later migration; `one_off` unconstrained; `care_plan` rows have `project_id null` |
| 6 | Xero remote-create/local-save window | **Confirmed, and wider than stated** | `xeroSync.ts:97-124` (create → online URL → save); retry guard `if (inv.xero_invoice_id)` (`:41`) with no lookup; Xero-ok-but-URL-null falls through to a Stripe hosted invoice for the same debt (`projectInvoice.ts:126-133`); payment PUT never retried and fired up to three times (`stripe/webhook/route.ts:51-66`; `markInvoicePaid.ts:36,55`) |
| 7 | Reconciliation on page open | **Confirmed** | `billing/page.tsx:293-300` (10 newest open, any tenant) and `clients/[id]/billing/page.tsx:71`; no billing cron in `vercel.json`; `getXeroSetupStatus` token exchange per view |
| 8 | Dashboard colours by signature state | **Confirmed verbatim** | `lib/hub/rules.ts:81-85`; page lead "Green = signed…" (`(dashboard)/page.tsx:103`); count strip `ClientGrid.tsx:284-286`; header chip `clients/[id]/page.tsx:152`. Note the brief's "937-line page.tsx" describes the pre-`a58642c` Mission Control now at `/admin/overview` — **superseded** as a source map, the finding stands |
| 9 | Authenticated GET provisions or syncs | **Confirmed, inventory in §2** | Admin layout membership upsert (`layout.tsx:81-99`); portal layout tenant/project/membership create + delete (`ensureClientWorkspace.ts:69-113`); Xero reconcile on two billing pages; read receipts on five portal surfaces + PDF route; preview cookie + audit; SAR audit + compliance insert |
| 10 | Legacy build-credit language | **Confirmed** | `build_credit_events` still debited on shipped `build_item` (`issues/actions.ts:192`); `grantTopUp` (`billing/page.tsx:123`); meters on portal/admin pages; AI prompt "consume the monthly build allowance" (`classify.ts:43,51`); proposal template "Billed monthly · cancel any time"; three classification vocabularies (`ops/issues.ts:34`; `work.ts:16`) |

**New incompatibilities found**

| Id | Finding | Evidence |
|---|---|---|
| N1 | Every client-wide signal keys on the newest project (block colour, tiles, owners, portal DPA gate, plan gate); a second project for a live client closes the client's chooser | `load.ts:289`; `_shared.tsx:306`; `plan/actions.ts:60-65` |
| N2 | Admin MFA redirect loop on main (AAL before authorisation; security page allowlist-only) | `layout.tsx:74-77`; `security/page.tsx:23`; `proxy.ts:59-64` |
| N3 | Staff binary with no capabilities; eleven hub actions and `openLead` lack `requireStaff`; all writes AAL-blind | `guards.ts:34-38`; `clients/[id]/actions.ts:512-518`; `pipeline/actions.ts:17-20` |
| N4 | Only `client_admin` minted; any member accepts Order Forms via service-role write bypassing `is_tenant_admin`; `requireTenantMember` passes staff | `legal/page.tsx:116-141`; `0030:401`; `guards.ts:57` |
| N5 | Assessments always saved as `plan='core'`, so `agreed_mrr`/`override_mrr` never bind Pro/Max/Enterprise; sibling prices recomputed from the catalogue constant on every read; webhook fallbacks bill catalogue base | `pricing/page.tsx:75`; `contractedPrice.ts:81-124`; `gc webhook route.ts:172`; `stripe route.ts:133` |
| N6 | `issues.change_order_id` never written, so `additional_development` tickets can never pass the DB trigger or `buildAll` | `actions.ts:1257`; `0030:349`; `buildAll.ts:57` |
| N7 | No Order Form withdraw/supersede/new-version writer; one live form per client; Connect fee gate reads newest accepted form | `agreement/page.tsx:546`; `connectCharge.ts:19-46` |
| N8 | Care-plan "options sent / DD link sent" state is parsed from `audit_log` with a 1000-row cap | `load.ts:171-174,525-531`; `rules.ts:195-205` |
| N9 | Stripe card rail activates at base price without terms or gate | `careSubscription.ts:41-63`; `stripe/webhook/route.ts:131-138` |
| N10 | Shell is marketing motion: 1 s clock, pulsing "Live" dot with no data, Atmosphere canvas, Reveal blur, ScrambleHover, CountUp money, full-bleed loader on 60 SubmitButton importers; `--k-*` tokens over Halo | `AdminNav.tsx:115-129,214`; `layout.tsx:150-166`; `OperationOverlay.tsx:15`; `globals.css:644-655` vs `packages/ui/src/tokens.ts:7-8` |
| N11 | `deleteClient` hard-deletes tenant, leads, enquiries and auth users by email with no legacy guard or provider cleanup | `clients/[id]/actions.ts:1151-1205` |
| N12 | Open redirects: admin and portal login honour unvalidated `?next=` | `admin/login/page.tsx:37,54`; `authDestination.ts:17-24` |
| N13 | Legal pack "in force" by hard-coded default; MSA hash is of acknowledgement strings, not a canonical text; DPA unhashed | `legal/config.ts:80,159`; `versions.ts:61-101` |
| N14 | No test covers `directDebit.ts`, the GoCardless webhook, `xero.ts`, `xeroSync.ts`, `markInvoicePaid.ts` or the Stripe webhook; RLS test skips in CI | test listing; `rls.test.mjs:18-29` |

## 9. Decision register

Owner for every item: Louis. Status: **Open** unless stated. "Blocks" uses P = prototype, D = document issuance, B = billing activation.

| # | Decision | Evidence / current state | Blocks |
|---|---|---|---|
| 18.1 | Final recurring tiers/prices and inclusions after calculator review | Main withholds prices (`PRICING_PUBLIC=false`, `pricing.ts:39`); worktree/branch hard-code £149/£249/£399; Max response target coded as 4 h vs brief's one business day (`carePlans.ts:97`) | D, B |
| 18.2 | Internal loaded rates, margin targets, contingency, approval thresholds | Only a hard-coded 75% floor constant (`nsi.ts:28`); PR #20's £40/hr and ×1.75 rejected | D (quote issuance), B |
| 18.3 | £600 handover tax basis, due date, scope, exceptions, later offboarding | Marketing copy only (`pricing.ts:99-110`); no invoice type or obligation | D, B |
| 18.4 | Application fee after independent handover; removing operational dependence | Fee lives on the Order Form (`0053`); gate reads newest accepted form; Suffolk's signed form must not change | D, B |
| 18.5 | Who pays/operates between launch, acceptance and Managed billing date; max gap | Today activation is on mandate (`webhook/route.ts:186-190`); no start-date column | B |
| 18.6 | Warranty duration/start, partial acceptance, disputes, client delays | Main 60 days from go-live (content only, `pricing.ts:69,506`); worktree 30 days; no schema | D |
| 18.7 | Recurring billing unit for multi-system clients; shared-cost allocation | Tenant-wide today; §6 schema supports either answer | B |
| 18.8 | Revolut–Xero feed, Xero primary-invoice config, accountant-approved tax/clearing mappings | No Revolut code; tax `NONE`/`NoTax` env constants (`xero.ts:142-159`); codes 090/091 unverified | B |
| 18.9 | Initial mandate timing, charge notice, scheduling behaviour vs provider docs | No `start_date` sent; provider picks first charge | B |
| 18.10 | Deposit/milestone templates, discounts, cancellation, refunds, retry, suspension | `0013` one milestone; no credit notes/allocations; no retry ledger | D, B |
| 18.11 | Staff capabilities; who approves commercial/financial exceptions | Binary staff; same role drafts and approves prices (`pricing/page.tsx:204`); review gate is any-other-staff | D, B |
| 18.12 | Pilot client/cohort and production cutover authority | Three legacy tenants excluded by rule; no other client identified | B |
| N-a | Cherry-pick `a426c87` (MFA loop fix) as a standalone hotfix before the shell rewrite | Loop reproducible from source (`layout.tsx:74-77`; `security/page.tsx:23`) | P (recommended before any staff tests) |
| N-b | Canonical work-classification vocabulary (worktree UPPERCASE `commercial_classification` vs `b858367` lowercase `commercial_type` vs existing `classification`) | Three existing vocabularies; two proposed | P (Quote Studio and intake fixtures need one) |
| N-c | Retire or gate the Stripe card rail for care plans | `careSubscription.ts:41-63` | B |
| N-d | Freeze `NSI_v1_2026_08` per legacy tenant before any v2 constants change | `contractedPrice.ts:119-124` recomputes from `BASE_PLAN_PRICE` | B |
| N-e | Governing regime for the three legacy accepted proposals once Order Forms are master (no re-signing) | `rules.ts:82`; `accepted_snapshot` | D |
| N-f | Whether accepted portal quotes (`issues.quote_accepted_at`) remain valid Grow authority alongside Change Orders | worktree removes `sendQuote`; `0052` trigger honours quotes | D |
| N-g | Legacy tenant marker: hand-set `tenants.legacy_model` for TDE, STL, NFT before any new pricing path ships | Worktree guards key on subscription rows (gap for Amie, never signed in) | D, B |
| N-h | Ledger reconciliation: read `schema_migrations`, decide fate of `060`/`0056`, two `0020`s, `0052` names | `supabase/README.md:49`; PR #20 rename | P (first redesign migration) |
| N-i | Suffolk Tennis' open incomplete billing request: cancel and re-issue or leave as legacy record (never auto) | `directDebit.ts:160-175` supersede path would delete it | B |
| N-j | SpeedInsights and cookie policy | PR #20 `6f381ad` | none (separate) |

## 10. Proposed first slice

Scope per §19 item 4: dark app shell, Today, one client workspace, Quote Studio — fictional fixtures only, no writes to production tables, no email, no provider calls.

**Routes (new, coexisting with the current admin)**

| Route | Content |
|---|---|
| `/admin/next` | Today: four §5.1 cards (contracted fees, outstanding balance with overdue subset, scheduled collections, projects needing action), needs-attention list, all from fixtures; "Fictional demo data" banner |
| `/admin/next/clients` | Client list with the brief's columns and filters (relationship, owner, active projects, next action, agreement, billing, route) |
| `/admin/next/clients/[fixtureId]` | One client workspace: six independent facets in the header (relationship, agreement, billing, delivery, service route, service health), owners + next action with due date, projects/systems list, agreements, obligations, requests — one fixture client with two systems, one on a pending tier, one independent |
| `/admin/next/quote` and `/admin/next/quote/[fixtureId]` | Quote Studio: inputs, work breakdown, cost-to-serve, floor/target/recommended with policy version and confidence, low/base/high, override with reason, "recommended ≠ approved" labelling; pure calculator behind a versioned policy fixture with unapproved placeholder constants clearly labelled |
| `/admin/next/agreement/[fixtureId]` (stretch, only if the above land) | Agreement review states from §7 with the second-person gate reused |

The `apps/web/app/admin/(dashboard)/next/` and `apps/web/lib/next/` directories already exist untracked on this branch; the slice lives there so the existing shell, `AdminNav` and every current page remain untouched and reachable.

**Files to add**

- `apps/web/lib/next/tokens.ts` — alias layer mapping the brief's §4.2 Halo table to CSS variables scoped to `[data-app="next"]`, sourced from `packages/ui/src/tokens.ts:5-88` (already matches) so pages stop reading `--k-*`.
- `apps/web/lib/next/fixtures/*.ts` — fictional clients (`@example.test` emails, no real names), projects, systems, arrangements, obligations, quotes, integration operation states; includes deliberately hard cases (two systems, tier pending, overdue collection, failed Xero allocation, orphaned mandate).
- `apps/web/lib/next/model.ts` — TypeScript types for the §6 concepts (legal entity, service arrangement, billing obligation, collection attempt, integration operation) as the contract the later migration will implement.
- `apps/web/lib/next/facets.ts` — pure facet derivation replacing `blockColour` for the new surface; unit-tested in `apps/web/tests/next-facets.test.ts`, leaving `hub-rules.test.ts` intact.
- `apps/web/lib/next/quote/policy.ts`, `quote/calc.ts` — versioned policy fixture (`policy_version`, effective date, `status: 'draft'`), cost-derived floor (`cost/(1−min margin)` rounded up), no caps, scenarios; `apps/web/tests/next-quote.test.ts` with worked examples.
- `apps/web/components/next/{Shell,Rail,Header,Panel,Facet,StatCard,DataTable,EmptyState,ErrorState,Skeleton}.tsx` — server-safe primitives: 64 px header, 248 px rail with core/advanced split, radius 0, no CountUp/Reveal/Scramble/Atmosphere/OperationOverlay; loading via `loading.tsx` skeletons only.
- `apps/web/app/admin/(dashboard)/next/layout.tsx` — nested layout that renders the new Shell inside the existing `(dashboard)` gate (so auth, aal2 and `requireStaff` are unchanged) and sets `data-app="next"`.
- `docs/admin-redesign/PHASE-1-WALKTHROUGH.md`, token-mapping and accessibility notes.

**Existing files to leave untouched**

`AdminNav.tsx`, `(dashboard)/layout.tsx`, `(dashboard)/page.tsx`, `ClientGrid.tsx`, `lib/hub/*`, `lib/pricing/*`, `lib/directDebit.ts`, `lib/xeroSync.ts`, every `actions.ts`, every migration, `packages/content/*`, `packages/billing/*`, `packages/auth/*` (except the `a426c87` cherry-pick if approved under N-a), the three legacy tenants' data and every email template.

**Feature flag / coexistence**

- Routes under `/admin/next/*` are reachable only by URL for staff; no link is added to `AdminNav` until visual review. A `NEXT_PUBLIC_ADMIN_NEXT` env flag (default off in production) gates the nested layout with `notFound()` so the prototype never ships to the live URL by accident; preview deployments set it on.
- Fixtures are compiled in; the slice imports no Supabase client and no provider SDK, which is enforced by a vitest import-boundary test over `lib/next/**` and `app/admin/(dashboard)/next/**`.
- Because the nested layout sits inside the existing `(dashboard)` layout, the membership upsert on GET (`layout.tsx:81-99`) still runs for allowlisted users; it is documented as the one inherited side effect and touches only the internal tenant.

**Explicitly out of scope for the slice**

Any migration; any change to `order_forms`, `subscriptions`, `invoices` or triggers; new plan prices or catalogue edits; email sends; GoCardless/Stripe/Xero calls; document issuance or signature; activation logic; the client portal; Finance/collection detail and mobile onboarding (Phase 1 follow-ons); replacing `/admin`, `/admin/overview` or the seven tiles; merging PR #20 beyond the auth cherry-pick; merging any BRGT code; touching Amy / The Dance Exclusive, Suffolk Tennis or New Future Therapy in any way.

**Verification before broadening.** Typecheck and the existing 532 tests remain green; new tests for facets, quote policy and the import boundary; desktop and mobile screenshots of the four routes with loading/empty/error states; a preview deployment with the flag on; confirmation that the preview produced no rows in `audit_log`, `document_events`, `memberships` (beyond the inherited internal-tenant upsert) or provider dashboards.

## 11. Live configuration verification (read-only, performed directly)

These checks were made through the Vercel and Supabase management APIs and the Vercel CLI. They are the only
claims in this report about live state; everything else is source inspection. No values, secrets or client
records were read or changed.

### Deployment

| Fact | Evidence |
|---|---|
| `nullshift.co.uk` resolves to deployment `dpl_GdCKotaVQDS87UmDmVNmYiBc12Fb` | Vercel `get_deployment(nullshift.co.uk)`: alias list includes `nullshift.co.uk`, `source: git`, `target: production`, `readyState: READY` |
| That deployment is built from GitHub `main` @ `2a52c7151423ba607d3bfadd6c27175f85c6be97` | `meta.githubCommitSha`, `meta.githubCommitRef = main` |
| The audit checkout (`feat/admin-redesign`) is that same commit | `git rev-parse HEAD` = 2a52c71; `git status` clean |
| An earlier production deployment today (`dpl_7BGhSGE6opCdmHJDZqjACzvatRyh`, 11:23 BST) was uploaded from a no-git snapshot directory | `docs/DEPLOY-2026-09-17-production.md`; Vercel meta has no git fields |
| Two later git-triggered production deploys (0d3819d 11:43, 2a52c71 13:33) replaced it; `main` carries later edits of every file the snapshot changed | three-way `git merge-tree` of the snapshot commit against `origin/main`: 13 files conflict; snapshot file mtimes 00:08–11:17 vs 11:27–13:32 in the worktree that produced `main`; the snapshot still contains the "Agent Consultation" links and old contact email that 2a52c71 removed |
| Snapshot preserved as local branch `release/2026-09-17-codex-snapshot` (3afd818) | not pushed |
| Project `nullshift` (`prj_6LbXDCPUzTK8aIc3nSptHnKIxj9Z`), team `Nullshift Development Ltd` (`team_hb7Wfv3KcTvMMx7msG8QdP0p`), Node 24.x | Vercel `get_project` |

### Production environment variable NAMES (values never read)

Present in Production: `ADMIN_EMAILS`, `ANTHROPIC_API_KEY`, `CRON_SECRET`, `ENQUIRY_NOTIFY_EMAIL`,
`GOCARDLESS_ACCESS_TOKEN`, `GOCARDLESS_ENVIRONMENT`, `GOCARDLESS_WEBHOOK_SECRET`, `NEXT_PUBLIC_SITE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`,
`STRIPE_CONNECT_CLIENT_ID`, `STRIPE_CONNECT_REDIRECT_URI`, `STRIPE_CONNECT_STATE_SECRET`, `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, `VERCEL_DEPLOY_HOOK_SECRET`,
`XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`, `XERO_PAYMENT_ACCOUNT_CODE`.

Observations:

- `NEXT_PUBLC_STRIPE_PUBLISHABLE_KEY` is misspelt (missing the I). The code reads
  `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (`packages/config/src/env.ts:64`, declared `.optional()`), so the
  publishable key is undefined in production. Harmless today: nothing client-side calls `loadStripe`
  (grep of `apps/` and `packages/`), but any future Payment Element / Stripe.js work would silently fail.
- `GOCARDLESS_ENVIRONMENT` exists, but whether it is `live` or `sandbox` is not visible. The board's
  Sandbox/Live badge must be read in the running app, not inferred here.
- `SUPABASE_ACCESS_TOKEN` is present (the 2026-09-02 handoff listed it as still to configure).
- Existence of a variable proves configuration only. No Xero, GoCardless, Stripe or Resend call was made
  from this audit, so "connection verified" and "sync succeeded" remain unverified.
- The Xero MCP connector failed to connect in this session (auth server incompatibility), so no read-only
  Xero check was possible.

### Production database (Supabase project "Nullshift Ops", `cweftpoaojwzllzficgt`, eu-west-1, Postgres 17)

Migration ledger: 71 applied versions (name-based) versus 56 files in `supabase/migrations/`. Last applied:
`20260916112233 client_economics` — PR #20's `0056_client_economics.sql` IS applied in production, as the PR
claims. No `commercial_model_v2` migration has ever been applied (the Codex BUILD/RUN/GROW/TRANSACT work never
touched the live schema).

Applied on production with no file on `main` (18): `proposal_dpa`, `rls_isolation_test_fn`, `unify_clients`,
`unify_clients_drop_permissive_calls_policy`, `proposed_care_plan`, `proposal_document`, `portal_project_hub`,
`portal_project_hub_client_id_nullable`, `client_entity_type`, `dpa_client_company_name_and_submitted_at`,
`agent_consultation`, `agent_research`, `ai_workspace_phase1`, `work_classification_on_issues`,
`function_hardening_revoke_public`, `soc2_ref_allocator_hardening`, `business_records_vault_functions`,
`client_economics` (file exists only on the PR branch).

Files on `main` with no matching ledger name (3): `0010_rls_user_metadata_fix.sql`, `0011_lead_plan.sql`,
`0019_ai_workspace.sql` (the latter is probably `ai_workspace_phase1` under another name; the first two may have
been applied under other names or never applied — treat as unknown).

Consequence for the redesign: the schema is not reproducible from the repository alone. Any new migration must
be written additively against the LIVE schema (inspect with read-only tools first), and the migration-number
collisions on side branches (`0052_commercial_model_v2.sql` vs `main`'s `0052_business_records.sql`;
`0056_client_economics.sql`) must be resolved before anything is applied.

Tables: 98 in `public`, RLS enabled on all. Row counts that matter for the redesign (live, 2026-09-17):
`tenants` 7 · `memberships` 6 · `projects` 7 · `system_profiles` 4 · `leads` 3 · `subscriptions` 2 · `invoices` 5 ·
`invoice_items` 10 · `order_forms` 1 · `contract_acceptances` 0 · `change_orders` 0 · `change_requests` 0 ·
`issues` 16 · `scale_assessments` 4 · `scale_evidence` 7 · `pricing_snapshots` 0 · `price_change_notices` 0 ·
`document_events` 2 · `build_credit_events` 0 · `connect_application_fees` 288 · `stripe_events` 14 ·
`quote_assessments` 1 · `economics_time_entries` 0 · `economics_cost_entries` 0 · `audit_log` 385 ·
`milestones` 0 · `tasks` 0 · `checklists` 3.

Read: the commercial spine the brief wants (order forms, acceptances, change orders, milestones, pricing
snapshots) is almost empty in production, so an additive model can be introduced without a data migration for
new clients; the two live subscriptions and five invoices are the legacy records that must remain untouched.

## 12. Prototype delivered with this report

Commit `07bfbdd` on `feat/admin-redesign` (local, not pushed) adds the first slice from §10 as
`apps/web/app/admin/(dashboard)/next/*` with fixtures in `apps/web/lib/next/fixtures.ts` and a test in
`apps/web/tests/next-fixtures.test.ts`:

- `/admin/next` — Today: four defined metrics, the prioritised Needs-attention queue, This week, approvals and exceptions.
- `/admin/next/clients` — clients list with the §5.4 columns.
- `/admin/next/clients/[id]` — one client workspace with the next-action strip and six independent facets (all ten §16 fixtures resolve).
- `/admin/next/quotes/[id]` — Quote Studio with the six steps, BUILD/RUN/GROW/TRANSACT summary, "Managed route selected; package to be agreed after build acceptance" as a first-class state, and an internal-only review box whose floor and target derive from cost and margin (no cap).

It is mounted inside the existing `(dashboard)` group so login, MFA step-up and the staff check are inherited unchanged; the shell paints over the legacy top bar with a fixed container until the design is approved. No database reads, provider calls or writes. Verified: typecheck clean, eslint clean, 7 new tests pass, rendered at 1440px, pane width and 375px with no console errors. Not deployed.

## 13. Workflow provenance

Eleven read-only domain audits and one synthesis agent (Claude workflow `wf_76d0dcfc-797`, 12 agents, ~417k subagent tokens). The adversarial verification stage was removed to stay within the session's usage budget; the caveat in §1 applies.
