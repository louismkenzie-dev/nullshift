# Operations Hub — Current-State Audit & Phased Backlog

_Date: 2026-08-18. Method: 13-area parallel code audit + adversarial completeness critic + live-DB
verification pass against the production Supabase project (Nullshift Ops). Scope: apps/web
`/admin` + `/portal` + `/api`, packages/\*, supabase/\*. This is deliverables 1–2 of the
refinement brief (`null-shift-operations-hub-refinement-prompt.md`)._

---

## 1. Executive summary — the five findings a partner needs first

1. **Money paths have real holes (mostly latent at today's volume).** "Cancelling" a
   Direct-Debit subscription only cancels Stripe — a GoCardless client would keep being charged
   (no `cancelGoCardlessSubscription` exists). The still-public `/onboard` checkout takes Stripe
   money the webhook cannot reconcile (userId sent where tenant_id is expected). Billable client
   changes can be batched, built, shipped and auto-announced with **no approval and no invoice**
   (`compileBatch` has no billing gate; `quoted_price` never reaches any invoice). Invoices carry
   no due date anywhere (live DB: 3/3 invoices `due_at IS NULL`) and no reminder machinery exists.
2. **The business cannot rebuild its own system.** Two hand-applied migration series
   (`supabase/0NN_*.sql` and `supabase/migrations/0NNN_*.sql`) with no ledger; `schema.sql` fails
   fresh replay; and two load-bearing columns (`projects.dpa_client_company_name`,
   `dpa_client_submitted_at`) exist **in production but in zero SQL files** — verified live. Any
   rebuild breaks the whole contract-signing flow. DEPLOY.md's env list omits `ANTHROPIC_API_KEY`,
   `GOCARDLESS_*`, `XERO_*`, `CRON_SECRET`.
3. **A coherent UK legal-exposure cluster.** The signed contract is mutable after signature
   (staff can edit `project_items` post-acceptance and the "signed" PDF re-renders from live
   rows; `removeItem` isn't even audit-logged). Marketing affirmatively claims "GDPR-compliant"
   and "we carry the liability… watertight" — exactly what the brief prohibits. Specific £
   savings reach prospects unreviewed via both the AI consultation and the deterministic
   `packages/content/src/savings.ts` estimator. The SAR export omits calls, notes, issues, and
   lead/funnel PII. Anthropic is missing from the sub-processor register despite transcripts and
   client repos flowing to its API.
4. **Public, unmetered cost/attack surface.** Anyone can mint leads via POST `/api/funnel`
   (honeypot + 1.5 s trap only) and trigger ~3 Opus calls per lead (~$1–2, retryable) with no
   rate limit, spend cap, or alerting; `agent_runs` is written but never read.
   `/api/auth/verify-code` accepts unlimited guesses at a 6-digit code.
5. **The client-consent loop is broken across every tool generation at once.** The only
   client approve/decline, decisions, and work-in-progress UIs live on `/portal/project/[id]` —
   a page nothing links to. The live issues pipeline has no client approval or payment step. The
   admin dashboard never queries `change_requests`, `invoices.due_at`, or past-due anything. So
   unapproved work can ship, commitments can rot, and no surface on either side would show it.

**Overall shape:** the platform is far more real than a greenfield assumption would suggest —
multi-tenant RLS core, DPA-gated proposal signing with auto-invoice, Stripe/GoCardless/Xero
rails, an issue-bank ops engine with AI intake and Claude-Code dispatch, and a polished portal.
The problems are (a) a legacy stratum of dead-but-deployed flows that duplicate and sometimes
bypass the live ones, (b) missing connective tissue (owners, milestones, health, due dates,
approval/payment gates), and (c) schema/deploy reproducibility.

## 2. Live-DB verification (what the file audit got wrong or couldn't know)

| Claim from file audit                                                                 | Live-DB result                                                                                                                                       |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dpa_client_*` columns exist in no SQL file                                           | **Confirmed present in prod** (8 `dpa_*` columns on `projects`) — hand-applied DDL; migration now committed (0020)                                   |
| "Any authenticated user can read enquiries/clients/proposals" (schema.sql `auth all`) | **Already fixed in prod** — staff-only policies live (0014 §8 ran); `anon insert enquiries` and legacy public-role `project_updates` policies remain |
| GoCardless clients keep being charged after "cancel"                                  | **Latent** — subscriptions table is currently empty; the code bug is real                                                                            |
| Invoice due dates never set                                                           | **Confirmed** — 3/3 invoices have `due_at IS NULL`                                                                                                   |
| `project-updates` bucket public                                                       | **Confirmed** `public=true` (deliverables + issue-attachments are private)                                                                           |
| Data scale                                                                            | 6 tenants, 5 projects, 4 leads, 3 invoices, 0 issues/CRs/tasks, 2 legacy proposals, 6 agent_runs — migrations and cleanups are low-risk right now    |

## 3. Current state by area (condensed)

Legend: ✅ working end-to-end · 🟡 present but partial/unreliable · ❌ missing · 👻 dead-but-deployed.

### 3.1 Dashboard & operational visibility

- ✅ Mission-control home is a real issue-triage cockpit (fix-first rail, blocked-on-client,
  promise ledger, batches, calls, MRR) — not a generic task list.
- 🟡 It only sees the issues slice: never queries projects, tasks, change_requests, invoices, or
  audit_log. Unreviewed AI inbox drafts inflate its counts (no `client_visible` filter).
- ❌ Project health model (on-track/watch/at-risk/blocked), partner-decision queue, "my actions"
  (no assignee is ever read/written anywhere), milestones, overdue-invoice detection, activity
  feed (audit_log is written everywhere, read nowhere), risk register.
- 👻 `/admin/tasks` and `/admin/enquiries` are nav-orphaned; MRR computed twice (dashboard inline
  vs `getMrrSummary`).

### 3.2 Leads & discovery

- ✅ One live coherent path: /start funnel → `leads` (dedupe/merge by email) → /plan Agent
  Consultation (research, plan, mockup, CRM enrichment, cost-logged) → /admin/pipeline board →
  openLead creates/reuses tenant + project → portal acceptance promotes lead to won. No duplicate
  data entry at the win moment.
- 🟡 Lead record is thin as a CRM: no owner, decision-maker, next-action; `leads.notes` never
  used; phone + UTM silently dropped at capture; nurture collapses into "new"; no manual Won
  button (only Lost/Delete); discovery data (budget/pain/enrichment/draftReply) never surfaces on
  the client hub; proposal items not seeded from funnel answers.
- 👻 `enquiries` table + `/api/enquiries` + `/admin/enquiries` page: nothing posts to them; the
  prod DB still allows anon inserts into a table nobody reads.

### 3.3 Proposal, scope, contract, deposit

- ✅ Live flow works: admin composes modules (`project_items`) + overview + payment terms →
  DPA-gated send → portal typed-signature acceptance (compare-and-set) → stage→build, DPA
  compliance record, auto-generated itemised Stripe invoice + Xero mirror, lead→won, audit trail.
  Server-rendered A4 proposal/DPA PDFs.
- 🟡 **Accepted scope is not locked**: `addItem`/`removeItem` have no status guard; the signed
  PDF re-renders from live rows; `removeItem` unaudited. No versioning/snapshot. No deposit
  mechanics — "50% deposit" is unenforced prose; acceptance auto-invoices **100%**; work starts
  (stage→build) before any money moves. Post-accept side effects (DPA record, invoice, emails)
  are best-effort in one try/catch. Proposal lacks exclusions/assumptions/client-responsibilities/
  change-control sections; timeline is a hardcoded generic 6-phase list.
- 👻 Entire second proposal system (legacy `proposals` table, marketing `/proposal/[id]` +
  unauthenticated `/api/proposals/accept`) — orphaned but live, bypasses DPA/compliance entirely.

### 3.4 Project record & stages

- ✅ One `projects` row per tenant read by three complementary surfaces (admin client hub,
  system passport, portal). DPA-before-live DB trigger. Proposal-send gate.
- 🟡 Stage enum is just discovery/build/review/live/care — no onboarding, launch-prep, or
  complete. The go-live gate is ceremonial (its DPA record is auto-written at acceptance, months
  before launch). setStage is a free dropdown; trigger errors are console-only. Health is a
  manually-set uptime dropdown on the passport, shown nowhere else.
- ❌ Owner fields (account/delivery/technical/finance/next-action) exist nowhere. No goal/success
  measures, milestone, next-action, risks, blockers fields. `tenants.status='prospect'` lanes can
  never populate (no code sets it). `packages/db/src/types.ts` is badly stale (misses most live
  columns — which is exactly how untracked DDL went unnoticed).
- 👻 Fourth dead project record: `clients.project_phase` + client_id-keyed project-updates API.

### 3.5 Tasks, milestones, decisions, risks, handovers

- ✅ Issue bank end-to-end (intake→AI triage→due dates→batches→dispatch→shipped→client feed +
  credit burn). System passport is a genuine half-handover (infra refs, runbook, quirks,
  features).
- 🟡 Tasks table is a nav-orphaned Kanban with no owner/priority/due date — **yet it is what the
  portal renders as "What we're working on"**, so clients see a board staff never touch, and its
  RLS exposes every internal task column to tenant members. Decisions resolution works but no UI
  can create decisions (only a dead legacy API that writes rows the portal can't match).
  markShipped is a non-transactional multi-write loop.
- ❌ Milestones entity, risk register, decision log with rationale/approver, compact handover
  view (purpose/scope/decisions/risks/preferences).

### 3.6 Client onboarding & portal

- ✅ Three live signup paths all converge on tenants/memberships + idempotent
  `ensureClientWorkspace`; mandatory DPA-details gate; polished portal (home, proposal, payments,
  plan + GoCardless DD, requests, updates, deliverables); genuine row-level tenant isolation.
- 🟡 No self-service password reset. `verify-code` lookup breaks past 1000 auth users (admin
  path past 50). Column-level leaks: clients can read `tasks.detail/estimate_hours`,
  `issues.ai/quoted_price/billing/promised_note/resolution_note` via the REST API; tenant admins
  can UPDATE any change_requests column incl. their own quote. Unescaped `.ilike(email)` in
  workspace provisioning could match the wrong tenant.
- ❌ Onboarding checklist (brand assets, access, integrations, data sources, cadence, kickoff) —
  never captured anywhere. Goal/milestone/key-dates fields don't exist for the portal to show.
- 👻 `/onboard` + `signup-with-plan` (built on the dead user-keyed subscriptions schema),
  `/api/admin/create-client-account`, `/api/client/choose`.

### 3.7 Change requests & scope control (brief's high-priority area)

- 🟡 Two parallel live systems: legacy `change_requests` (proper submitted→…→awaiting_approval→
  approved workflow with a real client approve step — but its portal UI is unreachable) and
  `issues` (live intake, AI triage — but **no client accept/decline, no payment step, no
  scheduling gate**). Admin counters (clients list, billing footprint) count the legacy table, so
  they read 0 for live intake.
- ❌ Impact statement to the client, quote→invoice conversion, approval-before-build gate,
  completion email + testing evidence link, "not proceeding" disposition. Request form lacks
  urgency/outcome/project picker/multi-file.

### 3.8 Invoicing & payments

- ✅ Itemised build invoice (dedupe-guarded, Stripe hosted + bank fallback, Xero mirror);
  signature-verified idempotent Stripe webhook; GoCardless DD rail with HMAC webhook and
  cross-rail guards; portal payments page; project finance rollup (quoted/invested/outstanding).
- 🟡 Due dates never set/read (Xero even gets due=issue date); manual billing-page invoices are
  bare rows (no items/email/Stripe/Xero, invisible on the client hub); the billing-page
  `markInvoicePaid` is a weaker duplicate that leaves the Stripe invoice collectible (double-pay
  risk); GC/Stripe payment failures die in console (the "Friday pulse picks it up" comments are
  false — the pulse reads only issues); the 0013 unique index makes deposit+milestone+final
  sequences structurally impossible; approved CR quotes never become invoices.
- ❌ Reminders of any kind, overdue escalation to a finance owner, pause-with-reason. (Brief's
  "no aggressive auto-chasing" is satisfied vacuously.)
- 👻 `/onboard` Stripe rail (charges into a void), user-keyed `subscriptions.ts`, Connect fee
  scaffold, retired edge function.

### 3.9 Communications & WhatsApp capture

- ✅ Deliberately-manual WhatsApp capture exists and is good: paste into /admin/inbox → AI splits
  into draft issues (client_visible=false, verbatim source_quote, promise detection) → human
  Confirm/Confirm-private/Discard. Manual quick-add with WhatsApp source. Friday pulse digest.
- 🟡 Taxonomy is bug/change/question/task only (no decision/feedback/risk/general); no owner on
  captured items; inbox actions don't re-verify a row is an ingest draft before hard-delete;
  clients get no notification when updates/decisions post; outbound email is never persisted.
- ❌ Unified per-project timeline (notes, updates, issues, calls, documents, invoices all render
  as separate panels; nothing merges them). Email ingestion.

### 3.10 Playbooks

- ❌ No playbook mechanism at all. "Templates" are system/code blueprints (repo stamps), not
  playbooks. Three unrelated hard-coded checklists (env_checklist, compliance CHECKS, feature
  list). Stage changes trigger nothing. The referenced "go-live checklist" doesn't exist. Ops
  playbook lives only in docs/OPERATIONS.md prose. Projects created outside template-stamping get
  no checklist at all. No close/retro stage.

### 3.11 AI assistance

- ✅ Two stacks: prospect-facing Agent Consultation (researched plan + sandboxed mockup,
  cost-logged to agent_runs, defense-in-depth CSP sandbox) and internal ops AI (classification,
  ingest parsing, three Claude-Code dispatch transports) — internal AI consistently human-gated.
- 🟡 agent_runs is never read (no cost panel/alerting); ops AI (`lib/ops/claude.ts`) logs no
  usage at all; costUsd undercounts (cache-creation + search fees); `draftReply` and research
  brief are stored but never rendered; CASE_STUDIES is an empty placeholder feeding the plan's
  "proof" section; portal shows AI-set kind/severity unlabeled.
- ❌ Of the brief's seven assistants: proposal drafter, project-health assistant, handover
  assistant, daily briefing don't exist; discovery/change-request/client-update are partial.
- ⚠️ The consultation delivers specific £ figures to prospects with zero human review; the
  deterministic `savings.ts` estimator does the same on the funnel result screens.

### 3.12 UK compliance

- ✅ Real but thin: compliance_records checklist page, DPA-before-live trigger, portal DPA
  declaration + signing, staff-only SAR JSON export, tenant hard-delete, TOTP MFA step-up.
- 🟡 SAR export covers only the ten 0001-era tables (misses calls, notes, invoice_items, issues,
  leads/funnel PII). Erasure leaves auth users, lead rows, legacy rows, processor data. "Mark
  done" compliance records carry no evidence. Special-category flag is captured then wired to
  nothing. Two admin one-click paths satisfy the DPA gate with no evidence.
- ❌ The compliance-review assistant (intake, review pack, escalation, children's-data checklist,
  wording guardrails) — none of it exists.
- ⚠️ Marketing claims "GDPR-compliant" / "we carry the liability… watertight" — the exact
  prohibited claims, with no process behind them.

### 3.13 Security & data platform

- ✅ Strong core: default-deny memberships RLS, SECURITY DEFINER helpers with locked
  search_path, composite tenant FKs, guard triggers, user_metadata escalation fix, signed
  idempotent webhooks, RLS-read-then-guarded-service-write pattern, broad audit_log writes,
  private deliverables/attachments buckets, env-only provider secrets, admin MFA step-up.
- 🟡 Roles are owner/staff/client_admin only — staff is monolithic (no finance/delivery/technical
  split); ADMIN_EMAILS allowlist still auto-provisions staff. Validation is ad-hoc (no zod, no
  length caps). Rate limiting effectively absent (in-memory, per-instance, one endpoint).
  RLS isolation test exists but silently skips without a DB URL. No security headers, no error
  monitoring, no notifications entity, no payments table.
- ⚠️ Plaintext bearer tokens in DB (`system_profiles.routine_token`, `calls.meeting_password`);
  verify-code brute-forceable; public bucket writable/deletable by any authenticated user.

## 4. Feature-to-requirement matrix (brief § → status)

| Brief requirement                                                                                                                                          | Status                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| §1 Dashboard: projects by health / partner queue / my+overdue+waiting actions / milestones / payments due / CR queue / activity+risks / explainable health | ❌❌🟡❌🟡🟡❌❌                                                                    |
| §2 Lead record fields / 9-stage progression / win → client+project without re-entry                                                                        | 🟡 / 🟡 (5 coarse stages) / ✅ mostly                                               |
| §3 Proposal content fields / versioning+locked baseline / accept→deposit→pay→onboard→build / partner override                                              | 🟡 / ❌ / 🟡 (order differs, no deposit) / ❌                                       |
| §4 One authoritative overview / 12-stage language / stage gates / named owners                                                                             | 🟡 / 🟡 (5 stages) / 🟡 (gates ceremonial) / ❌                                     |
| §5 Tasks / milestones / risks / decisions / handover view                                                                                                  | 🟡 / ❌ / ❌ / 🟡 (creation broken) / 🟡 (passport ≈ half)                          |
| §6 Onboarding checklist / client project page contents / no internal leakage                                                                               | ❌ / 🟡 / 🟡 (column-level leaks)                                                   |
| §7 CR form / classification / billable capture / full assess→approve→pay→schedule→complete flow                                                            | 🟡 / 🟡 / 🟡 / ❌                                                                   |
| §8 Invoice types / dependable status+due+reminders / finance summary / humane overdue handling                                                             | 🟡 / 🟡 (no due dates, no reminders) / 🟡 (no approved-changes line) / ❌ (vacuous) |
| §9 WhatsApp quick-log / unified timeline / no unsafe auto-ingestion                                                                                        | 🟡 / ❌ / ✅                                                                        |
| §10 Eleven playbooks + stage-entry offering                                                                                                                | ❌ (0 of 11 as playbooks)                                                           |
| §AI Seven assistants + safety rails per function                                                                                                           | 🟡 (3 partial, 4 missing; rails partial)                                            |
| §Compliance intake / review pack / escalation+block / children's checklist / wording guardrails                                                            | 🟡 / ❌ / ❌ / ❌ / ❌ (site violates)                                              |
| §Data: roles / stamps+audit / linked entities / security checklist / no plaintext creds                                                                    | 🟡 / 🟡 / 🟡 / 🟡 / 🟡                                                              |

## 5. Phased backlog (ranked by impact × risk × dependency)

### Phase 0 — Stop-the-bleeding safety batch (no behaviour redesign) — **implemented, see §6**

0.1 Commit the untracked DPA columns as a migration; document the two-series apply order.
0.2 `cancelGoCardlessSubscription` helper, called from both cancel actions.
0.3 Gate `compileBatch` — never batch unclassified/out_of_scope issues.
0.4 Lock accepted scope: guard `addItem`/`removeItem` on `proposal_status='accepted'`; audit `removeItem`.
0.5 verify-code: paginating user lookup + 5-attempt cap; ditto admin account-detection lookup.
0.6 Retire dead-but-live public surfaces: legacy proposal accept flow + pages, `/onboard` +
checkout route, create-client-account, client/choose, legacy project-updates API, enquiries API.
0.7 Dashboard correctness: exclude unreviewed inbox drafts; stop leaking internal tasks to the
portal (client-visible issues instead); fix dead `revalidatePath`; escape `.ilike` emails.
0.8 Surface the DPA-gate trigger error in the stage control instead of console.
0.9 DEPLOY.md env list corrected; stale HANDOFF.md retired.

### Phase 1 — Make the core workflow trustworthy

1.1 **One migration-series consolidation** (fold 3-digit + untracked DDL into
`supabase/migrations/`, regenerate types.ts, wire the RLS test to a shadow DB). Everything
else depends on this being safe.
1.2 **Owners + next action on projects** (account/delivery/technical/finance owner, next_action,
next_action_owner) shown on hub + dashboard.
1.3 **Stage model**: extend enum (onboarding, launch_prep, complete), map the brief's 12-stage
language across lead_status → proposal_status → project_stage, real launch gate (checklist +
recorded approval, not the auto-satisfied DPA trigger), deposit-paid gate before build with
Partner-override-with-reason.
1.4 **Dashboard v2 panels**: CR queue, payments due/overdue (needs due_at set at generation),
awaiting-partner-decision, recent activity from audit_log, first-cut explainable health chip
derived from existing signals (overdue issues, awaiting_client, past-due subs).
1.5 Lead record CRM upgrade: owner, next action, manual Won, persist phone/UTM, surface
discovery/enrichment data on the hub, seed project_items from funnel answers.

### Phase 2 — Protect scope and cash flow

2.1 **Single change-request system**: converge on issues + port the legacy approve/decline into
/portal/requests (client-visible quote + plain-English impact statement + accept/decline),
retire the orphaned page, repoint admin counters.
2.2 **Quote→invoice**: approved billable issue generates an invoice line/invoice; schedulable
only after approval (and payment where policy requires); completion email with evidence link.
2.3 **Invoice hygiene**: due dates everywhere, overdue detection, weekly-pulse finance section
(open >N days, past-due subs, failed collections), GC payments.failed → past_due,
per-invoice bank references, deposit/milestone/final sequencing (drop the one-invoice index).
2.4 Proposal integrity: accepted-version snapshot served as the signed PDF; authored sections for
exclusions/assumptions/responsibilities/change-control.
2.5 Durable rate limiting + zod validation on public endpoints; funnel/consult spend caps.

### Phase 3 — Handover & collaboration

3.1 Unified project timeline (merge notes/updates/issues/calls/documents/invoices; all queries
already exist). 3.2 Onboarding checklist entity + portal intake. 3.3 Decisions creatable from
the hub; decision log with rationale/approver. 3.4 Milestones + risks entities, portal
key-dates. 3.5 Handover view = passport + purpose/scope/decisions/risks/preferences +
completeness check. 3.6 Playbook/checklist-template mechanism + stage-entry offering; go-live
checklist. 3.7 Issue kinds decision/feedback/risk/general + owner field; client notification
emails on ship/update.

### Phase 4 — Operational intelligence

4.1 AI cost ledger read-side (panel + daily cap + alert); log ops-AI usage into agent_runs.
4.2 Assistants in priority order: client-update drafter, change-request assistant (impact
statement draft), discovery analyst (internal), handover assistant, daily ops briefing,
proposal drafter, health assistant — each: source records shown, draft-labeled, cost-logged,
human-approved sends. 4.3 Compliance-review assistant per brief (intake at discovery/scope
change/pre-launch, evidence-linked review pack, mandatory Partner escalation blocking
"compliance ready", children's-data checklist, wording guardrails). 4.4 SAR export
completeness + erasure report; sub-processor register update (Anthropic). 4.5 Role split
(finance/delivery/technical owner permissions), retire ADMIN_EMAILS.

## 6. Decisions Null Shift must make (flagged, not made silently)

1. **Marketing legal claims** — "GDPR-compliant", "we carry the liability", "watertight"
   (faq, homepage, about, packages/content/marketing.ts, blueprint.ts) should be softened or
   solicitor-reviewed. Client-facing copy: not changed without sign-off.
2. **Savings figures shown to prospects** — both the AI plan and `savings.ts` (KEEP_PCT=0.7,
   default £120–200/mo when "not sure") assert £ outcomes. Decide the substantiation posture;
   fill `CASE_STUDIES` with real, consented results.
3. **tasks vs issues** — recommend: retire the tasks Kanban, make issues the only work tracker,
   portal shows client_visible issues (Phase 0 already repoints the portal read).
4. **change_requests vs issues** — recommend: converge on issues (Phase 2.1); the legacy table's
   approve/decline semantics get ported, then the table is retired.
5. **Deposit policy** — the machinery should enforce what the proposal says. Decide: fixed 50%
   deposit invoice at acceptance + balance at launch, or per-proposal schedule. (Phase 2.3.)
6. **`anon insert enquiries`** — the API route is retired in Phase 0; decide whether to drop the
   DB policy + table or keep them for a future contact form.
7. **Legacy data** — 2 legacy `proposals` rows, 1 `enquiries` row, 4 funnel leads: migrate or
   archive before the Phase 1.1 consolidation.
8. **Repo topology** — git root is the parent dir; untracked client work (`House Of Gino/`) sits
   in the same tree; stray root `index.mjs` + KYMA template folder in the deployable repo.

## 7a. Live 8-stage lifecycle walkthrough — VERIFIED 2026-08-18

Executed against the production database with a disposable tenant
("ZZ OPS VERIFICATION", deleted afterwards with zero residue):

| Step                                                  | Result                                                                                                          |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| discovery → onboarding → build → review → launch_prep | ✅ every transition accepted (enum + triggers)                                                                  |
| launch_prep → live **without** a signed DPA           | ✅ **BLOCKED** by trigger 0005 — stage stayed launch_prep                                                       |
| live after `dpa_signed` compliance record             | ✅ admitted                                                                                                     |
| live → care → complete                                | ✅ accepted; `complete` is a real terminal stage                                                                |
| RLS shape on delivery tables                          | ✅ risks / decisions / compliance_reviews have **no** member policy; milestones + checklists member-SELECT only |
| Cleanup                                               | ✅ cascade delete left 0 tenants / 0 projects / 0 records                                                       |

App-level gates aren't reachable via SQL, so they're pinned in the test suite
instead: `canEnterBuild` (deposit-or-override, `tests/stage-gates.test.ts`),
`isBatchable` (quote acceptance), and the compliance escalation gate
(`tests/compliance.test.ts`). All 8 stages now offer at least one playbook
(planning covers build; client_review covers review).

## 7. Verification scenarios (brief §"Required verification scenarios") — current status

1. Lead → client/project via acceptance + deposit, no duplicates: 🟡 works except no deposit
   step; payment confirms nothing.
2. Staff can read next action/owner/blockers/baseline/payment from one page: ❌ owners and next
   action don't exist; data split across hub + passport.
3. CR assessed→approved→paid→scheduled→completed with audit trail: ❌ approval unreachable,
   payment absent, scheduling ungated.
4. New team member uses handover view: 🟡 passport covers infra/runbook; no purpose/scope/
   decisions/risks.
5. Client cannot see internal notes/risks/estimates/other tenants: 🟡 rows isolated; column-level
   leaks exist (Phase 0/2 items).
6. AI output stays a reviewable draft: 🟡 internal yes; prospect-facing plan is unreviewed by
   design (decision #2).
7. Children's-data/high-risk flag requires recorded escalation: ❌ nothing exists yet (Phase 4.3).
