# Operations Hub — Live Audit 2026-09-04

_Date: 2026-09-04. Method: nine parallel read-only code audits (dashboard/projects; leads, proposal & legal
docs; portal & column exposure; issues, batches & dispatch; billing & care plans; communications & AI;
UK compliance & SOC 2; security & data platform; backlog progress vs the 18 August audit) + a live-database
verification pass against the production Supabase project (Nullshift Ops, `cweftpoaojwzllzficgt`) + the
Supabase security advisor. Scope: apps/web `/admin` + `/portal` + `/api`, packages/\*, supabase/\*.
Baseline: `OPS-HUB-AUDIT-2026-08-18.md`, `SOC2-READINESS-AUDIT-2026-08-20.md`. 67 commits and 12
migrations (0038–0049) have landed since the baseline._

Legend: ✅ working end-to-end · 🟡 present but partial/unreliable · ❌ missing · 👻 dead-but-deployed.

---

## 1. Executive summary — the five findings a partner needs first

1. **The commercial gate for feature work is broken in both directions, and the new one-click builder
   routes around it.** `issues.change_order_id` is never written anywhere (`clients/[id]/actions.ts:1257`
   sets only `change_orders.issue_id`), so a ticket classified _additional development_ can never be
   built through the Change Order path: the UI gate and the DB trigger both block it forever. Meanwhile
   `compileBatch` filters on billing only and the attach at `batches/page.tsx:294` is unchecked, so a
   CO-gated issue can ride a dispatched work order with zero linked issues; and **Build everything**
   (`lib/ops/buildAll.ts:56-66`) marks every _unclassified_ change request `covered` and builds it. On
   the live DB **14/14 issues have `classification = NULL`**: the §8 rule ("a human classifies") has not
   been exercised once. Questions are compiled as work and announced to clients as "Fixed" on ship.
2. **Legal documents can be edited after approval and signed unreviewed.** The second-approver gate is
   real on every send path, but `scopeIsLocked` only bites at `accepted`: a proposal in `sent` can be
   edited (`actions.ts:200-214`) and the portal + PDF render live rows, so the snapshot at signature
   freezes text nobody reviewed. Change orders keep their approval through `client_review` edits by
   design; contract/consent uploads bypass review entirely; a document whose author is NULL (all six
   live proposals — every one pre-dates migration 0049) can be self-approved. Marketing still claims
   "we carry the liability… watertight" and "GDPR-compliant" while the DPA caps liability.
3. **Clients can read internal columns over REST, and one policy lets them rewrite a Change Order's
   fees while accepting it.** Every tenant-member SELECT policy is column-blind: `issues.ai /
quoted_price / promised_note / resolution_note`, `projects.build_fee` + owner fields +
   `accepted_snapshot`, `tenants.notes / stripe_customer_id / xero_contact_id`, `order_forms.reviewed_by /
payment_review_ref`, `milestones.billing_note`. Narrowing is code-only, and two portal pages still
   `select("*")`. `change_orders_client_decide` (0030:432) is a column-blind UPDATE. Verified live:
   `enquiries` still accepts anonymous inserts and the legacy `project_updates` client policies remain.
4. **Money paths are sound at today's volume but have four latent mis-billing holes.** The Stripe
   checkout fallback inserts the catalogue base MRR, not the contracted price
   (`stripe/webhook/route.ts:123-136`); the Stripe care-plan rail never checks terms acceptance or the
   go-live gate; an admin re-send reuses a stale terms version after a bump; Stripe `invoice.paid` +
   `payment_succeeded` + the out-of-band echo each re-post the Xero payment. Live: 2/4 invoices still
   have no due date, Suffolk Tennis' Direct Debit is `incomplete` (no mandate) two days on, card-rail
   care-plan revenue is never invoiced or mirrored, and there is no reminder/dunning machinery at all.
5. **The staff cookie is the whole system, and the schema is still not reproducible.** `requireStaff`
   never checks aal2 (MFA is a page redirect only), then nearly every admin action runs the service
   role. Two migration series must both be applied, `0020` is duplicated, 0040–0043 were renumbered
   after apply (ledger 63 versions vs 50 files), 48 of 60 tables are absent from `types.ts`, and the
   RLS test is skipped in CI because no `SUPABASE_DB_URL` is set. No security headers, no error
   monitoring, and one plaintext routine token in `system_profiles`.

**Overall shape:** substantially further on than 18 August — Phase 0 is done, Phase 3 nearly so, the
grid/tiles hub, Xero-first invoicing, GoCardless care-plan collections, auto-scoring, the review gate,
read receipts and one-click dispatch are all real and mostly well-built (webhook signatures, atomic
claims, preview isolation, pure tested rules). The remaining problems cluster in three places: the
Change Order → build hand-off (never finished, now bypassed), review/exposure gaps in the legal and
portal layers, and platform reproducibility/observability.

## 2. Live-DB verification (what the code audit got wrong or couldn't know)

Scale: 6 tenants (5 client), 6 projects (2 discovery / 2 live / 2 care), 3 leads, 14 issues (all open; 14/14 classification NULL; 1 still billing=unclassified after the 13 Dance Exclusive ones were marked covered), 0 change_requests, 0 change_orders, 0 order_forms, 2 fix_batches, 4 invoices (4 paid; 2/4 due_at NULL), 2 subscriptions, 21 agent_runs, 361 audit_log rows (37 in last 24h), 2 document_events, 3 scale_assessments, 6 scale_evidence, 4 compliance_records, 0 tasks, 6 memberships (owner:2, client_admin:4).

Security shape: 92 public tables, RLS enabled on all 92. Four tables RLS-on with no policy (service-role only, by design): email_verifications, stripe_events, ops_settings, rate_limits. All SECURITY DEFINER functions have search_path pinned. Triggers in force: trg_issues_change_order_gate, trg_enforce_dpa (projects).

Still-open legacy policies (verified live): `enquiries.anon insert enquiries` (INSERT, with_check=true, role anon) and `project_updates.client_read_own_updates` / `client_update_choice` (public role, keyed on the legacy `clients` table by auth.email()). Buckets: project-updates is PUBLIC (public_read_update_images); deliverables, issue-attachments, soc2-evidence private.

Secrets at rest: 1 plaintext `system_profiles.routine_token` (The Dance Exclusive); 0 `calls.meeting_password`.

Money: subscriptions — The Dance Exclusive build_3 £180 active (GoCardless mandate MD…, subscription SB…, terms CARE_TERMS_2026_09_v1 accepted 2026-09-02); Suffolk Tennis build_3 £160 **incomplete** (billing request BRQ01M1K6EVZWCHHEJ48ABK8RVD0W, no mandate, terms accepted 2026-09-03). care_plan_choice set for both; NULL for New Future Therapy / NewFuture Therapy (duplicate tenant names) / House of Gino. Invoices: NFT build_milestone £0.00 paid (due set), TDE build_milestone £1,000 paid (due set), TDE one_off £1,000 paid (due NULL), STL build_milestone £2,000 paid (due NULL). No overdue.

Legal: 3 accepted proposals (TDE, STL, NFT) all pre-date the review gate — proposal_drafted_by / reviewed_by NULL; 3 drafts (House of Gino, NewFuture Therapy, Null Shift Ops) likewise NULL. document_events holds 2 client views (dpa, proposal — TDE, 2026-09-03), 0 sent, 0 signed rows: signatures before 0048 are not back-filled.

Dispatch: batch "Fix batch — 2 Sept 2026" compiled, never fired; "Everything outstanding — 2026-09-04" dispatched 13:15 UTC, routine session blocked on push (repo not in the session's authorised set), no PR.

Migration ledger: 63 versions applied in `supabase_migrations.schema_migrations` vs 50 files in `supabase/migrations/` — the ledger carries the legacy 3-digit series and the renumbered 0028–0031→0040–0043 set under their original names (e.g. `0028_scale_assessments`, `0029_data_complaints`), so file names and ledger names no longer match one-to-one; fresh replay order is by file only.

Data hygiene: two tenants named "New Future Therapy" and "NewFuture Therapy" (one accepted proposal + £0 invoice, one draft) — likely a duplicate client record.

Supabase security advisor (run 2026-09-04 14:10 UTC): 0 errors. WARN: `guard_change_request_update`, `stamp_audit_row`, `enforce_dpa_before_live` have a mutable search_path (trigger functions, not SECURITY DEFINER — low risk, one-line fix each); `is_internal_staff`, `is_member_of`, `is_tenant_admin` are SECURITY DEFINER and callable by anon/authenticated via RPC (boolean helpers, leak only "am I staff" — acceptable); `export_tenant_data` and `tenant_footprint` callable by any signed-in user via RPC, but both **check `is_internal_staff()` inside the body** (verified from `pg_get_functiondef`) so a client gets an exception / empty set — acceptable, revoke EXECUTE from authenticated for defence in depth; **Leaked-password protection is disabled** in Auth (one toggle in the dashboard). INFO: four service-role-only tables with RLS and no policy (by design).

| Claim from code audit                                                         | Live-DB result                                                                                                                                       |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Column-blind member policies                                                  | **Confirmed** — no column grants or views exist; 92 tables, RLS on all, 4 policy-less service-only tables                                            |
| `enquiries` anon insert / legacy `project_updates` client policies still live | **Confirmed present in prod** (`anon insert enquiries` with_check=true; `client_read_own_updates`, `client_update_choice` keyed on legacy `clients`) |
| `change_order_id` never written                                               | **Consistent** — 0 change_orders, 0 order_forms, 14/14 issues unclassified                                                                           |
| Review gate untested on live documents                                        | **Confirmed** — all 6 proposals have `proposal_drafted_by` / `reviewed_by` NULL (3 accepted pre-gate, 3 drafts)                                      |
| Read receipts thin                                                            | **Confirmed** — 2 `viewed` rows, 0 `sent`, 0 `signed`; pre-0048 signatures not back-filled                                                           |
| Invoice due dates                                                             | **2/4 NULL** (Dance Exclusive one_off £1,000; Suffolk Tennis build £2,000)                                                                           |
| Plaintext routine token                                                       | **1 row** (The Dance Exclusive)                                                                                                                      |
| Supabase advisor                                                              | 0 errors; 3 trigger functions with mutable search_path; leaked-password protection **off**                                                           |
| Data hygiene                                                                  | Two tenants "New Future Therapy" / "NewFuture Therapy" — probable duplicate                                                                          |

## 3. Progress since 18 August (backlog verified in code)

#### Phase 0

| Item                                     | Status  | Evidence                                                                                                                                         | Gap remaining                                                                 |
| ---------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| 0.1 DPA columns migration                | DONE    | `0020_untracked_dpa_columns.sql`; apply order in `supabase/README.md:30-60`                                                                      | —                                                                             |
| 0.2 `cancelGoCardlessSubscription`       | DONE    | `packages/billing/src/gocardless.ts`; called from `billing/page.tsx:101` and `clients/[id]/actions.ts:1035`                                      | —                                                                             |
| 0.3 Gate `compileBatch`                  | DONE    | `batches/page.tsx:78-109` filters `isBatchable`; `tests/workflow-gates.test.ts:19`                                                               | (see §3.7: still no §8 classification check)                                  |
| 0.4 Lock accepted scope                  | DONE    | `clients/[id]/actions.ts:81-91` (`scopeIsLocked`), guarded in `addItem`/`removeItem`; audit logged                                               | —                                                                             |
| 0.5 verify-code cap + paginating lookups | PARTIAL | `packages/auth/src/routes/verify-code.ts:10,35,70-89`; `0021_verify_code_attempts.sql`                                                           | `billing/direct-debits/page.tsx:145` still single `listUsers({perPage:1000})` |
| 0.6 Retire dead public surfaces          | DONE    | `app/onboard`, `app/client`, `app/proposal`, `api/enquiries`, `api/project-updates`, `api/checkout`, `api/create-client-account` all absent      | —                                                                             |
| 0.7 Dashboard correctness                | DONE    | `lib/hub/load.ts:330-332`, `overview/page.tsx:168-170` (`isUnreviewedDraft`); portal reads `client_visible` issues; `escapeLike` on all `.ilike` | —                                                                             |
| 0.8 Surface DPA-gate error               | DONE    | `clients/[id]/actions.ts:536-548` redirects with `?stage_blocked=`                                                                               | —                                                                             |
| 0.9 DEPLOY.md / HANDOFF.md               | DONE    | `DEPLOY.md:44-80`; no `HANDOFF.md` in tree                                                                                                       | —                                                                             |

#### Phase 1

| Item                        | Status  | Evidence                                                                                                                               | Gap remaining                                                                                                                                                                                                                                                                     |
| --------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1 Migration consolidation | PARTIAL | Numbered series 0001–0049; replay order documented; `packages/db/src/rls.test.mjs` exists                                              | Legacy `supabase/002–020.sql` + `schema.sql` still separate; `packages/db/src/types.ts` stale (12 tables, `projects` Row lacks owners/snapshot/dpa cols, lines 286-318); RLS test skips without `SUPABASE_DB_URL` and the root CI (`../.github/workflows/ci.yml:50-52`) sets none |
| 1.2 Owners + next action    | DONE    | `0022`; `lib/hub/load.ts:71-77,191-197`; `account/page.tsx:302-305`; `saveOwnership`                                                   | —                                                                                                                                                                                                                                                                                 |
| 1.3 Stage model             | PARTIAL | `0024` adds onboarding/launch_prep/complete; `lib/stageGates.ts:14` deposit gate with override reason; `tests/stage-gates.test.ts`     | Launch gate still only the DPA trigger — no checklist + recorded approval before `live`; 12-stage mapping not modelled                                                                                                                                                            |
| 1.4 Dashboard v2 panels     | DONE    | `overview/page.tsx`: Scope control :597, Payments :661, Waiting on them :709, Recent activity :161,832; health chip `rules.ts:405-434` | Health still passport-driven, not derived from overdue issues/past-due subs                                                                                                                                                                                                       |
| 1.5 Lead CRM upgrade        | PARTIAL | `0023_lead_crm_columns.sql`; funnel persists phone/utm; manual Won `pipeline/page.tsx:361-365`; enrichment on hub                      | Owner/next_action not editable on pipeline page; no seeding of `project_items` from funnel answers                                                                                                                                                                                |

#### Phase 2

| Item                                  | Status  | Evidence                                                                                                                                                          | Gap remaining                                                                                                                                               |
| ------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1 Single CR system                  | PARTIAL | Quote accept/decline in `portal/requests/page.tsx:215-250`; legacy portal CR panel removed                                                                        | `change_requests` still read by `overview/page.tsx:151`, `clients/[id]/issues/page.tsx:164`, `advanceCr`; no plain-English impact statement shown to client |
| 2.2 Quote→invoice                     | PARTIAL | `0025` (`issue_id`, one invoice per issue); `lib/quoteInvoice.ts:22-56` with `due_at`; batching gated on `quote_accepted_at`                                      | No completion/ship email with evidence link                                                                                                                 |
| 2.3 Invoice hygiene                   | PARTIAL | `due_at` on generation; overdue detection `hub/load.ts:354`; weekly-pulse money section; GC failed→past_due `gocardless/webhook/route.ts:286-306`; bank reference | `invoices_one_build_per_project` (0013) never dropped; no deposit/milestone/final sequencing                                                                |
| 2.4 Proposal integrity                | PARTIAL | `accepted_snapshot` (0025) written on signing, served by the PDF route                                                                                            | No authored exclusions/assumptions/responsibilities/change-control sections                                                                                 |
| 2.5 Rate limiting + validation + caps | PARTIAL | `0026_rate_limits.sql`; `rateLimitAllow` in funnel, client-onboard, verify-code, client-signup; consult daily cap                                                 | No zod on public endpoints; consult route has no per-IP rate limit                                                                                          |

#### Phase 3

| Item                                     | Status  | Evidence                                                      | Gap remaining                                    |
| ---------------------------------------- | ------- | ------------------------------------------------------------- | ------------------------------------------------ |
| 3.1 Unified timeline                     | DONE    | `clients/[id]/TimelinePanel.tsx`, `account/page.tsx:49`       | —                                                |
| 3.2 Onboarding checklist + portal intake | PARTIAL | `checklists` table (0040:86); portal reads                    | Portal read-only — no client intake form         |
| 3.3 Decisions from hub                   | DONE    | `delivery-actions.ts:153` `addDecision`                       | —                                                |
| 3.4 Milestones + risks, portal key-dates | DONE    | 0040; `addMilestone`, `addRisk`; portal milestones surfaced   | —                                                |
| 3.5 Handover view                        | DONE    | `systems/[id]/handover/page.tsx:46-75,222`                    | —                                                |
| 3.6 Playbook mechanism                   | DONE    | `lib/playbooks.ts:102-113,166,173`; `tests/playbooks.test.ts` | —                                                |
| 3.7 Issue kinds + owner + notifications  | PARTIAL | 0040:110-114 (`assignee`, kinds); `postUpdate` emails client  | No client email on issue shipped outside a batch |

#### Phase 4

| Item                                       | Status      | Evidence                                                                                                     | Gap remaining                                                       |
| ------------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| 4.1 AI cost ledger                         | PARTIAL     | `admin/ai/page.tsx:47-142`; daily budget block `aiw-runtime.ts:168-180`; ops assistants log to `agent_runs`  | Budget "alert" is status text, no notification                      |
| 4.2 Assistants                             | PARTIAL     | `lib/ops/assistants.ts`: client update, impact statement, discovery brief, handover summary; AI DRAFT prefix | Daily ops briefing, proposal drafter, health assistant absent       |
| 4.3 Compliance-review assistant            | DONE        | `0041`; `lib/compliance.ts:172-285`; `compliance/[tenantId]/page.tsx:97-126`; tests                          | —                                                                   |
| 4.4 SAR completeness + erasure + Anthropic | PARTIAL     | `0042` (`export_tenant_data`); `subprocessors.ts:113` Anthropic                                              | No erasure report artefact; SAR misses ~17 newer tables (see §3.12) |
| 4.5 Role split / retire ADMIN_EMAILS       | NOT STARTED | `packages/auth/src/guards.ts:35` still allowlists via `isAdminEmail`; roles remain owner/staff/client\_\*    | Finance/delivery/technical permissions not enforced                 |

#### Verification scenarios

| #                                                 | Status      | Evidence                                                                                                | Gap                                                                               |
| ------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1 Lead→client+deposit, no dupes                   | PARTIAL     | Signing raises deposit invoice `portal/proposal/page.tsx:108`; Stripe `invoice.paid` → paid; lead merge | Payment still advances nothing (build gate is manual `setStage`)                  |
| 2 One page for owner/next action/blockers/payment | DONE        | `account/page.tsx:47,302-305,402`                                                                       | —                                                                                 |
| 3 CR assessed→approved→paid→scheduled→completed   | PARTIAL     | Quote accept → `queued` + invoice; `isBatchable` gate                                                   | Not gated on payment; no completion email; `change_order_id` never written (§3.7) |
| 4 Handover for new team member                    | DONE        | `handover/page.tsx`                                                                                     | —                                                                                 |
| 5 Client cannot see internals                     | DONE (rows) | RLS `0014:180` (`client_visible`); portal selects narrow columns                                        | Column-level exposure re-checked in §3.6                                          |
| 6 AI output stays a draft                         | PARTIAL     | `AI DRAFT` note prefix; `tests/ai-gates.test.ts`                                                        | Prospect plan still unreviewed (decision #2 open)                                 |
| 7 Children's-data escalation                      | DONE        | `compliance/[tenantId]/page.tsx:97-126`; `compliance.test.ts`                                           | —                                                                                 |

#### Summary

- Phase 0: 8 DONE / 1 PARTIAL. Phase 1: 2 DONE / 3 PARTIAL. Phase 2: 0 DONE / 5 PARTIAL. Phase 3: 5 DONE / 2 PARTIAL. Phase 4: 1 DONE / 3 PARTIAL / 1 NOT STARTED. Scenarios: 4 DONE / 3 PARTIAL.
- Decisions §6 not acted on: #3 (tasks Kanban still live), #4 (`change_requests` still read in 3 places), #6 (`anon insert enquiries` policy still live — verified in prod), #8 (git root still the parent dir).
- Most consequential open items: (1) 1.1 — `types.ts` stale and the RLS test never runs in CI, so schema safety is unproven; (2) 1.3/2.3 — no launch checklist gate and no deposit/balance sequencing; (3) 4.5 — `ADMIN_EMAILS` remains the staff authority with no role split.

## 4. Current state by area

### 4.1 Dashboard, client grid & project record

#### 1. Working end-to-end (✅)

- Grid is one bulk load: `lib/hub/load.ts:440-572` runs 10 parallel `.in("tenant_id")` queries + one profiles query, folds in memory; `page.tsx:80` → `ClientGrid.tsx`. No per-client I/O.
- Colour/tile rules are pure and tested: `lib/hub/rules.ts:80-93` (`blockColour`), `133-228` (`carePlanState`), `401-606` (`tileStates`); 29 cases in `apps/web/tests/hub-rules.test.ts`. Grid dots and hub tiles use the same function, so they cannot disagree.
- Client hub `clients/[id]/page.tsx:88-476`: header chip, StageStepper, owners/next-action facts, seven tiles, "Needs you" list of every amber/red tile with reason.
- Stage model: enum extended to 8 values (`0024_project_stage_lifecycle.sql`), ordered list `lib/projectStage.ts:7-16`; forward-only signing advance `advanceOnly` used by portal accept; deposit-before-build gate `lib/stageGates.ts:14` enforced in `setStage` (`clients/[id]/actions.ts:523-534`) with override reason audit-logged; DPA-before-live enforced in DB trigger `0005` and surfaced via `?stage_blocked=`.
- Owners + next action persisted (`0022`), edited in `saveOwnership` (`actions.ts:578-600`), rendered on the hub and drive the Account tile (`rules.ts:533-575`).
- Per-client activity feed: `account/page.tsx:120-125` reads `audit_log` filtered by tenant; agency-wide last-10 on `overview/page.tsx:160-164`. Unified TimelinePanel merges 7 sources (`TimelinePanel.tsx:42-195`).
- Systems list derives explainable delivery health from evidence (`systems/page.tsx:137-160`), separate from manual uptime.

#### 2. Partial / unreliable (🟡)

- **Care-plan amber/red flips with log growth.** `optionsSentAt`/`ddLinkSentAt` come from `audit_log … .limit(1000)` across all tenants (`load.ts:515-521`). Older clients silently lose the timestamp → "Options sent" regresses to red "Options not sent".
- **Audit-derived timestamps never expire.** `rules.ts:194-195`: any DD link ever sent → "Awaiting mandate" forever; the `canceled` branches at `206-221` become unreachable once a link was sent.
- **Newest project wins.** `load.ts:285` keys colour, passport, stage and care-plan on `projects[0]`. Add a second discovery project to a live, proposal-signed client (no Order Form) and the block turns red "Not sent" and the care-plan tile goes grey.
- **Green needs no Order Form.** `rules.ts:82-84`: `proposal_status='accepted'` alone is "Active" even with Order Form draft/rejected/absent. Order Form `rejected` is unhandled and falls to "Not sent" (`rules.ts:92`).
- **Enquiries row is email-matching, not linkage.** `load.ts:609-617` hides a lead only if its email equals a tenant `contact_email`; `openLead` never updates `leads.status`/`tenant_id` (`pipeline/actions.ts:16-115`). Won leads with a changed email, and every email-less lead, sit as red "Enquiry" forever.
- **`tenantStatus === "prospect"` branch is dead** (`rules.ts:91`): nothing writes `prospect`.
- **setStage allows regression and skips.** No `advanceOnly`; any of 8 stages settable backwards (`actions.ts:517,537-540`). `care` is manual only — subscribing never moves stage.
- **Passport health is manual and defaults `unknown`**, treated as green (`rules.ts:421-428`); nothing automated writes `system_profiles.health`.
- **Count strip ignores the search filter** (`ClientGrid.tsx:272-274`).
- `packages/db/src/types.ts:469` still types `project_stage` as the 5-value enum; `setStage` casts `as never`.
- `listUsers({perPage:1000})` (`load.ts:588`) — portal state silently wrong past 1000 auth users.
- **Stale docs:** `docs/OPERATIONS.md:122` "`/admin` (Mission Control)" contradicts `:91`.

#### 3. Missing (❌)

- No stage timestamps/history (`stage_changed_at`), so days-in-stage, SLA and stall detection are impossible.
- No due date on `next_action`; owners are free text (no staff FK), so "my clients / overdue actions" cannot exist.
- No sort/filter on the grid beyond a name substring.
- No unified health score per client; `deliveryHealth` not reused by grid or hub.
- Timeline excludes audit_log, order forms, change orders, subscriptions and stage changes; no pagination beyond `limit 25`.
- No test covers `load.ts` folding.

#### 4. Dead-but-deployed (👻)

- `blockColour` `prospect` branch and `systems/page.tsx` prospects section.
- `BlockProject.proposalSentAt/acceptedAt/liveUrl` and `Block.tenant.carePlanTermsAcceptedAt/createdAt` loaded but unread.
- Tables with no app reader: `agent_feedback`, `data_complaint_notes`, `email_suppressions`, `marketing_permissions`, `rate_limits`.

#### 5. Top 3 risks

1. Care-plan colour depends on a capped, unfiltered audit query and never-expiring timestamps — the grid will show wrong amber/red as data grows.
2. "Newest project = the project" turns a live, paying client red/grey the moment a second project is created.
3. Stage can be set backwards or skipped, with no history column — the stage record is not a trustworthy delivery audit.

### 4.2 Leads, proposal/scope/contract & Docs and Legal

#### 1. Working end-to-end (✅)

- **/start → /api/funnel**: honeypot, time-trap, per-IP rate limit, server-side re-score, `recordLead` upsert, plan token + `/plan/[token]` (token is the capability, `robots: noindex`) — `api/funnel/route.ts:47-115`, `(marketing)/plan/[token]/page.tsx:112-122`.
- **Lead scoring**: single source `scoreLead` (`lib/funnel.ts:363-379`), unit-tested; pipeline sorts by `lead_score`.
- **Review rule** is pure and shared (`lib/legal/review.ts:44-92`); `approveDocument` refuses self-approval server-side and only on drafts (`lib/legalReview.ts:271-322`).
- **All three send paths are gated**: proposal `saveDocsAndSend` (`clients/[id]/actions.ts:244`), `sendOrderForm` (`agreement/page.tsx:268`), `advanceChangeOrder → client_review` (`agreement/page.tsx:410`). No API route or email-resend path sends a legal doc; RLS hides drafts from members (`0030:385-386, 422-423`).
- **Approval reset on edit**: proposal (`actions.ts:98-112, 207-212`), order form (`agreement/page.tsx:223-227`), change-order drafts (`agreement/page.tsx:366-370`).
- **Staff previews excluded from receipts**: `recordDocumentEvent` drops client events under the preview cookie (`lib/documentEvents.ts:71`); `recordClientViews` additionally requires a client membership (`:126-134`). Preview actions bail (`proposal/page.tsx:76`, `legal/page.tsx:84,177`, `dpa-actions.ts:16`).
- **Signed events** recorded for proposal+DPA (`proposal/page.tsx:134-143`), order form (`legal/page.tsx:153`), change order (`:216`), care-plan terms (`plan/actions.ts:116`).
- **Accepted proposal PDF is a snapshot**: `accepted_snapshot` frozen at signature (`proposal/page.tsx:148-170`) and used by the PDF route once accepted (`api/documents/.../route.ts:136-164`).
- **Scope lock after acceptance** (`actions.ts:81-91, 123, 150`); **deposit gate** `canEnterBuild` enforced in `setStage` with audited override.

#### 2. Partial / unreliable (🟡)

- **Post-send edits bypass the review gate (proposal)**: `scopeIsLocked` only locks on `accepted`, and `saveDocsAndSend` writes `overview/payment_terms` with no status guard (`actions.ts:200-214`). While `sent`, the portal (`proposal/page.tsx:619-632`) and PDF (`route.ts:142-152`) render live rows, and the snapshot at signing captures the edited rows. Approve → send → edit = client signs unreviewed content.
- **Same for change orders, by design**: `saveChangeOrder` accepts edits in `client_review` and explicitly keeps the approval (`agreement/page.tsx:363-370`).
- **Null author = single-person send**: `reviewState` only blocks when `author && reviewedBy === author` (`review.ts:58`); `legal-review.test.ts:37` enshrines it. Pre-0049 drafts, or rows whose author was deleted (`on delete set null`, `0049:24`), can be approved and sent by their real author.
- **Contract uploads skip review entirely**: `uploadDoc` (no `requireStaff`, `actions.ts:661`) puts `kind=contract/consent` files in front of the client immediately; receipts call this "sent" at upload (`documentEvents.ts:490-500`).
- **DPA/Terms PDFs are live re-renders**, not snapshots (`route.ts:168-200`); only `SERVICE_TERMS_VERSION` + acknowledgement strings are hashed (`lib/legal/agreement.ts:203-212`).
- **`proposed_plan` has no writer** anywhere in app code — the proposal's care-plan section can never be populated for new projects.
- **Change-order "sent" fact is audit-derived** (`documentEvents.ts:443-456`) — no `sent_at` column.
- `openLead`, `uploadDoc`, `ensureProject`, `setStage`, `bookCall`, `recordDpa` rely solely on RLS, no `requireStaff` (`pipeline/actions.ts:16`).

#### 3. Missing (❌)

- No `signed` receipt path for uploaded contracts.
- No hash/snapshot of the Order Form content in `contract_acceptances`.
- No scope lock in the `sent` state.
- No unit test for the edit-after-send scenario.

#### 4. Dead-but-deployed (👻)

- Legacy `public.proposals` table (`supabase/schema.sql:55`, policy re-created in `0014:281`) — zero app references; the marketing `/proposal/[id]` route is gone.
- `/api/funnel/preview` (dev-only, 404 in prod).
- Loose SQL files `supabase/0xx_*.sql` outside `migrations/` (drift risk vs `0016` which assumes `proposed_plan`).
- `projects.proposed_plan` column + `carePlan` PDF section (unwritable).

#### 5. Top 3 risks

1. **Approved-then-edited proposals/change orders reach and get signed by clients without re-review** — defeats the gate's purpose.
2. **Null-author documents can be self-approved and sent** (legacy rows, deleted staff).
3. **Contract/consent uploads bypass review and go live on upload** with no signature record possible.

### 4.3 Client onboarding, portal & column-level exposure

#### 1. Working end-to-end ✅

- Password sign-in with staff/client routing (`portal/login/page.tsx:75-81` → `lib/authDestination.ts:11-25`); staff without preview cookie bounced server-side (`portal/(dashboard)/layout.tsx:38-42`).
- Sign-up + 6-digit code: durable per-IP limits and 5-attempt burn (`packages/auth/src/routes/client-signup.ts:17`, `verify-code.ts:25,70-96`); email confirmed only via service `updateUserById`.
- Invite/recovery links carry `token_hash`, verified server-side, `next` sanitised (`lib/portalAccess.ts:22-42`, `portal/reset/actions.ts:39-52`, `lib/portalLinks.ts:28-37`). Forgot flow is oracle-safe + rate-limited.
- `ensureClientWorkspace` idempotent with race settlement (`lib/ensureClientWorkspace.ts:96-113`), skipped in preview.
- Preview: staff-gated, audited, `/portal`-scoped httpOnly cookie, `Cache-Control: no-store` on entry and exit; `scopedReadOnlyDb` force-filters tenant and throws on writes (`lib/clientPreview.ts:50-77`); all 11 portal actions call `isClientPreview()`; `recordDocumentEvent`/`recordClientViews` drop preview; header uses `preview.contactEmail`.
- DPA gate before portal (`layout.tsx:78-86`); `acceptProposal` guarded compare-and-set (`proposal/page.tsx:116-128`).
- `issues_insert_client` (0016) binds tenant/project/status; `issues_select` (0014:178) enforces `client_visible`.
- PDF route reads via RLS + status gate; SAR export staff-only.

#### 2. Partial / unreliable 🟡

- **Column-blind SELECT policies; zero column grants/views in any migration.** Via PostgREST a tenant member reads every column of: `issues` (`issues_select` 0014:178) → `ai`, `quoted_price`, `promised_note`, `resolution_note`, `repro`, `source_quote`, `classification_note`, `assignee`; `tasks` (0001:320) → `detail`, `estimate_hours`, `assignee`; `change_requests` (0001:326) → `estimate_hours`, `quoted_price`; `projects` (0001:314) → `build_fee`, all four owner fields, `next_action(_owner)`, `accepted_snapshot`, `proposal_drafted_by/reviewed_by`, `accepted_signature`; `tenants` (0001:290) → `notes`, `contact_phone`, `stripe_customer_id`, `xero_contact_id`; `invoices` → `stripe_invoice_id`, `xero_invoice_id`, `gc_payment_id`; `subscriptions` → `gc_mandate_id`; `milestones` (0040:30) → `billing_note`, `acceptance_criteria`; `order_forms` (0030:385) → `payment_review_ref`, `payment_reviewed_by`, `scale_assessment_id`, `schedule_versions`, `reviewed_by`. Portal code narrows selects but `legal/page.tsx:242-245` and `legal/close/page.tsx:195-205` use `select("*")`. `scale_assessments`/`plan_prices`/`document_events` are correctly staff-only.
- **`change_orders_client_decide` (0030:432) is column-blind UPDATE**: a client_admin can PATCH `project_fee`, `recurring_fee_delta`, `included`, `acceptance_criteria` while setting `status='accepted'` — the same hole 0003 closed for `change_requests`.
- **Legacy `project_updates`**: tenant policy lives only in unledgered `supabase/017_portal_project_hub.sql:27`; `client_update_choice` still grants full-column UPDATE to email-matched legacy `clients`; bucket `project-updates` is public-read.
- **Schema drift**: `tenants.contact_email/contact_name`, `projects.proposed_plan/overview/payment_terms/dpa_*/accepted_*/client_entity_type/live_url` and `project_updates` exist only in legacy `supabase/0xx` files.
- **Open redirect on login**: raw `?next` → `router.replace` (`login/page.tsx:52,80`, `authDestination.ts:24`), no `safePortalNext`.
- **Role blindness**: `acceptProposal`, `acceptOrder`, `requestTermination` read via member RLS then write with service role, bypassing `is_tenant_admin` in `contract_acceptances_insert` (0030:401) / `termination_insert` (0031:175). Latent (only `client_admin` is ever minted).
- `resend-confirmation` rate limit is in-memory per instance.
- `requireTenantMember` ignores `ADMIN_EMAILS` while `getPortalClient`/`requireStaff` honour it.
- `ensureClientWorkspace` auto-joins any verified signup whose email `ilike`-matches a tenant's free-text `contact_email` (`ensureClientWorkspace.ts:42-48`); no uniqueness on `contact_email`.

#### 3. Missing ❌

- No client-side brand-asset upload or access/credential capture; onboarding checklist is staff-inserted, portal renders it read-only.
- No client emails for: project update posted, issue status change, quote issued (`issues/actions.ts:323-343` sets `awaiting_client` with no `sendEmail`), order form/change order sent to `client_review`.
- No column-level RLS test — `rls-isolation.test.sql` asserts row counts on `projects` only.

#### 4. Dead-but-deployed 👻

- `/onboard`, `signup-with-plan`, `/api/client/choose`, `create-client-account`, legacy project-updates API: **gone**.
- Still deployed: `/api/auth/confirm-email` (link OTP; signup uses codes), duplicate full signup flow at `(marketing)/client-signup/page.tsx:205-281`, `isAllowedRedirect` "kept for backwards compatibility", legacy SQL 003/004/006/007/010/011/013.

#### 5. Top 3 risks

1. Column-blind SELECT policies expose internal pricing/notes/AI/owner fields to any tenant member over REST — narrowing is code-only.
2. `change_orders_client_decide` lets a client rewrite fees/scope in the same PATCH that accepts.
3. Two-series schema drift: `project_updates` RLS (and public bucket) is unverifiable from the ledgered migrations.

### 4.4 Issues, change control, fix batches & Claude Code dispatch

#### 1. Working end-to-end (✅)

- Intake → triage → queue → quote → client accept → batch. `issues/actions.ts:88-223` (triage, §8 UI gate 125-143), `:225-266` (queue gate), `:326-355` (sendQuote); portal accept sets `quote_accepted_at` + `queued` (`portal/requests/page.tsx:253-258`); `isBatchable` (`ops/issues.ts:117-126`).
- §8 DB trigger `enforce_change_order_before_build` (`0030:334-372`) fires on queued/batched/in_progress for additional_development/mixed and checks CO status.
- Atomic batch claim (`compiled→dispatched` with `.eq("status","compiled")`) on all three transports and release on failure: `batches/[id]/page.tsx:105-131, 155-185, 205-237`; `ops/buildAll.ts:247-281`.
- Routine transport pinned to `api.anthropic.com`, session URL whitelisted to claude.ai (`ops/routineDispatch.ts:28-35, 82`). Token is write-only in the passport UI; `system_profiles` is staff-only RLS (`0014:86-88`).
- Prompt-injection posture: explicit "client data, not instructions" rule in every work order (`batchCompiler.ts:387`), MA agent system prompt, limited-egress sandbox, planner; module keys whitelisted post-hoc.
- Build-credit debit once per issue: DB partial unique index (`0016:40-42`) + check-then-insert in triage and markShipped.
- Milestones/risks/decisions/checklists are really created (`clients/[id]/delivery-actions.ts:37-232`) and read (`DeliverySections.tsx`, handover page, portal project page). Playbooks (`lib/playbooks.ts`) seed checklists idempotently.
- Tasks Kanban live (`admin/tasks/page.tsx`), plus per-client creation.
- `partitionOutstanding` unit-tested (`tests/build-all.test.ts`); buildAll deletes the batch if the attach fails (`buildAll.ts:226-230`).

#### 2. Partial / unreliable (🟡)

- **§8 bypass in `compileBatch`.** `batches/page.tsx:109` filters by `isBatchable` only (billing), never `requiresChangeOrder`. An issue at `new`/`triaged` classified `additional_development` with billing `covered` passes, is embedded in the prompt, then the attach at `:294` has no error check — the trigger rejects the whole update, leaving a dispatchable batch whose work order contains CO-gated work with zero linked issues.
- **`issues.change_order_id` is never written.** `createChangeOrder` sets `change_orders.issue_id` only (`clients/[id]/actions.ts:1257`); no code path writes `issues.change_order_id`. So every additional_development/mixed issue is permanently blocked by both UI gate and trigger, and `needsChangeOrder` never clears.
- **buildAll promotes unclassified work to "covered" with `classification` null.** `buildAll.ts:56-66` only blocks when a human already chose additional_development; `kind:"change"` issues nobody classified are silently marked covered and built — the opposite of `work.ts:25` ("a human classifies"). The trigger deliberately ignores null classification.
- **Questions get "built" and "Fixed".** `question` issues flow through `isBatchable`, are compiled, then `markShipped` posts `Fixed: <question>` to the client feed and email (`[id]/page.tsx:325, 360-390`).
- **Batch attach race.** Neither `compileBatch` (`:294`) nor buildAll (`:219-225`) guards with `.is("batch_id", null)`; two concurrent compiles both fire, the later one steals the issues.
- **markShipped non-transactional.** Batch flipped to shipped first (`:312`), then per-issue loop with no error handling; a mid-loop failure strands issues in `batched`. Also allowed from `draft`/`compiled` (`:297`).
- **cancelBatch silent failure.** `:433` update to `queued` re-fires the §8 trigger; if it raises, `:436` clears `batch_id` anyway and `:454` cancels — issue left `batched` with no batch.
- **Triage of an already-batched issue as additional_development silently fails** (`issues/actions.ts:141` → trigger raises → `:182` unchecked → audit logged anyway).
- **redispatch** (`batches/actions.ts`) has no atomic claim (two clicks = two sessions), keeps `pr_url` while resetting `pr_open→dispatched`, and fires the routine even if the batch was originally dispatched via GitHub/MA (parallel runs).
- **Internal staff issues look like AI drafts.** `isUnreviewedDraft` = `new && !client_visible` (`ops/issues.ts:103-108`); a staff-logged hidden issue is excluded from batches and counts. The client tile works around it with `ai.from === "ingest"`; the bank and buildAll do not.

#### 3. Missing (❌)

- Any writer for `issues.change_order_id` / CO-acceptance back-link.
- Classification prompt before buildAll promotion; trigger coverage for null classification.
- Cancel/ship for MA and GitHub transports never closes the remote session/issue.
- Encryption of `routine_token` (plaintext `text`, `0015:11`) — returned in full to server components (`buildAll.ts:172`, `clients/[id]/issues/page.tsx:233`).

#### 4. Dead-but-deployed (👻)

- `admin/issues/page.tsx:70-420` re-implements all six issue actions inline while `IssueRow.tsx` imports `./actions` — two divergent triage code paths.
- Legacy `change_requests` table still read/written (`overview/page.tsx:151`, `clients/[id]/actions.ts:628-652`, `clients/[id]/issues/page.tsx:164`) alongside `issues`; nothing retires it.
- `fix_batches.status="draft"` exists in the enum but no code creates one.

#### 5. Top 3 risks

1. `compileBatch` can dispatch Change-Order-gated work to Claude Code with no linked issues (silent trigger rejection) — a direct §8 breach with no audit trail.
2. `change_order_id` is never set, so the whole CO → build flow is a dead end in production; operators will route around it via buildAll's auto-"covered" promotion, building unquoted features for free.
3. Non-atomic markShipped/cancelBatch plus unchecked updates leave issues stranded in `batched` and post "Fixed" notices for questions/unfixed work to clients.

### 4.5 Invoicing, payments, care plans, Direct Debits, pricing & auto-scoring

#### 1. Working end-to-end ✅

- **GoCardless webhook**: HMAC timing-safe verify (`packages/billing/src/gocardless.ts:361-372`), 503 when unconfigured, 500-on-DB-error so GC retries, orphan-rescue from billing-request metadata, cross-rail guard cancels the mandate (`api/gocardless/webhook/route.ts:38-44, 78-112, 122-155`). Subscription create uses `Idempotency-Key = billingRequestId` (`gocardless.ts:180-216`).
- **Care-plan invoice per GC payment**: `recordCarePlanPayment` keyed on `gc_payment_id` with partial unique index (`lib/carePlanInvoice.ts:69-104`, `0045:10-12`), so `confirmed`+`paid_out` yield one paid invoice, then Xero invoice + payment against `XERO_GOCARDLESS_ACCOUNT_CODE`.
- **Stripe webhook**: signature verified, `stripe_events` dedupe, care-plan status sync (`api/stripe/webhook/route.ts:29-46, 141-157`).
- **Price seen == price charged**: `quoted_pence` round-trip, `priced` gate, terms version check, gate-by-stage (`portal/plan/actions.ts:65, 88-105`); one DD starter for all entry points with contracted price + already_live guard + stale-link cancel (`lib/directDebit.ts:77-84, 118-123, 158-175`).
- **Plan gate**: `planChoiceOpen` enforced in portal action, confirm page, board `sendPlanInvite`, hub tile (`lib/planGate.ts:9`).
- **Overrides with client-visible reason**: `setPlanPrices` refuses a price without a reason; note surfaces on the confirm page (`pricing/page.tsx:200-207`, `contractedPrice.ts:91-100`, `confirm/page.tsx:137-162`).
- **Due dates**: set on all generation paths (`projectInvoice.ts:52`, `quoteInvoice.ts:46`, `billing/actions.ts:49`), overdue computed on `/admin/billing` (`billing/page.tsx:363-365`).
- **Mark-paid out-of-band** settles the Stripe hosted invoice + CAS flip + Xero mirror (`lib/markInvoicePaid.ts:33-55`).
- **Cancel** propagates to Stripe and GoCardless before the local flip (`billing/page.tsx:80-113`, `clients/[id]/actions.ts:1006-1048`).
- **Cron auth**: all 4 routes require `Bearer CRON_SECRET`.
- **NSI engine + auto-score** pure, versioned, identifier-validated SQL (`nsi.ts`, `dbAnalysis.ts:15,184-228`); tests: nsi-pricing, contracted-prices, care-plan-invoice, reband, auto-score.

#### 2. Partial / unreliable 🟡

- **Stripe checkout fallback bills base price**: when no pending row, the webhook inserts `mrr: plan.mrr` (catalogue "from" price), not `contractedMrr`, and sets no `provider` (`stripe/webhook/route.ts:123-136`).
- **Terms version drift on admin re-send**: `directDebit.ts:105-114` reuses `tenants.care_plan_terms_version` without comparing to `CARE_PLAN_TERMS_VERSION`; after a bump, a mandate starts on stale terms.
- **Stripe rail bypasses terms**: `sendCareSubscriptionSignup` never checks terms acceptance or `planChoiceOpen` (`lib/careSubscription.ts:41-163`); only the UI disables the button.
- **Enterprise DD bypasses the go-live gate**: `sendDirectDebitLink` and `clientChosenPlan` accept `quotedOnly` plans without `systemIsBuilt` (`direct-debits/actions.ts:147-150`, `clients/[id]/actions.ts:937`).
- **Double Xero payment attempts**: `invoice.paid` handler updates without `.eq("status","open")`, so `invoice.paid` + `invoice.payment_succeeded` and the `paid_out_of_band` echo each call `recordXeroPayment` again (`stripe/webhook/route.ts:55-66`). Xero rejects overpayment, but every paid invoice logs errors.
- **Xero retry gap**: if the Xero invoice was created but the payment PUT failed, `syncInvoiceToXero` early-returns on `xero_invoice_id` and never records the payment (`xeroSync.ts:41-48`, `carePlanInvoice.ts:99-103`).
- **reconcileXeroInvoices** checks only the 10 newest open invoices, page-load only, 8s race; does not settle a Stripe hosted invoice when `INVOICE_RAIL=stripe` (client could pay twice) (`xeroSync.ts:161-167, 189-197`).
- **Card-rail care-plan revenue never invoiced**: Stripe subscription invoices have no `invoices` row / Xero mirror; only GC collections do.
- **Cross-rail guard race**: `startDirectDebitForTenant` checks live subs before creating the billing request but does not lock.
- **Audit metadata wrong**: `amountPence` logged from `pending.mrr`, not `chargeMrr` (`gocardless/webhook/route.ts:208`).
- **Env docs**: `.env.example` lacks `GOCARDLESS_ACCESS_TOKEN/WEBHOOK_SECRET/ENVIRONMENT`; `packages/config/src/env.ts` has no GoCardless/Xero/`INVOICE_RAIL`/`SUPABASE_ACCESS_TOKEN`; `DEPLOY.md:76` says `CRON_SECRET` gates only weekly-pulse (it gates 4 crons).

#### 3. Missing ❌

- Client payment reminders / dunning and overdue escalation — only the Friday pulse chase list.
- Portal self-service cancel, despite terms promising it (`carePlanTerms.ts:19`).
- Scheduled auto-score re-scan (`trigger:"cron"` type exists, no caller) and monthly reband snapshots (manual only).
- Finance summary/export (revenue by month, VAT, aged debtors); MRR only.
- Deposit sequencing: only a "paid invoice or override" build gate; no deposit → balance invoice chain.
- GoCardless event-id dedupe table (relies on idempotent writes).
- Xero VOIDED/DELETED status mirror-back.

#### 4. Dead-but-deployed 👻

- `stripeConfig.priceIds` (`STRIPE_PRICE_ID_*` with `!`) for the retired `/onboard` (`packages/billing/src/config.ts:17-23`).
- `createConnectPaymentIntent`, `fees.ts`, `STRIPE_CONNECT_CLIENT_ID`, `apps/clinic` scaffold (`stripe.ts:216-231`).
- `createBuildInvoice`, `createCareSubscription` (Stripe) — no callers.
- Legacy user-keyed `supabase/006_subscriptions.sql`, `007_*`, `schema.sql`; retired edge function `supabase/functions/stripe-webhook` (410 stub).

#### 5. Top 3 risks

1. Stripe checkout fallback charges catalogue base price instead of the contracted price — undercharges scale-band clients silently.
2. Terms-version drift + Stripe-rail/Enterprise paths skipping terms and go-live gates — the contract evidence chain breaks after any terms bump.
3. No reminders/overdue escalation and Xero reconciliation bounded to 10 rows on page load — old open invoices go unnoticed.

### 4.6 Communications, WhatsApp capture & AI assistance

#### 1. Working end-to-end (✅)

- **WhatsApp/Zoom ingest → draft issues → human confirm.** Paste form → `parseIngest` (`lib/ops/ingest.ts:67-96`) → hidden `status:new`, `ai:{from:"ingest"}` rows; Confirm / Confirm-private / Discard re-verify the row is a genuine draft (`inbox/actions.ts:107-160`). No-key fallback files the raw paste as one issue. Cost-logged as `ops.ingest`.
- **Portal-submitted issue triage.** `classifyIssue` runs on client submit, stored in `issues.ai`, pre-fills kind/severity/due (`portal/requests/page.tsx:171-186`); billing suggestion stays advisory.
- **Four of the seven assistants exist, all draft-only, cost-logged, human-gated:** client-update drafter (`clients/[id]/actions.ts:381-431`), impact statement (`issues/actions.ts:275-317`, editable `quote_note`), discovery brief and handover summary (saved as `project_notes` prefixed `AI DRAFT —`). Every call goes through `claudeJson` with `logAs` → `agent_runs` (`lib/ops/claude.ts:44-47`).
- **agent_runs is read:** AI office dashboard (today/30-day spend, `ai/page.tsx:44-69`), agent directory 7-day cost, per-agent page; the AIW runtime enforces `org_daily_budget_usd` (25 USD) and per-routine budgets (`aiw-runtime.ts:167-180,457-464`).
- **Agent Consultation (/plan)** sandboxed: research/plan/mockup logged with usage; iframe `sandbox="allow-scripts"` without same-origin; mockup served with `default-src 'none'; connect-src 'none'` CSP; AI-generated badge shown. Untrusted answers wrapped as data-not-instructions (`packages/agents/src/consultation.ts:215-236`).
- **Client notifications:** ship email on batch ship (`batches/[id]/page.tsx:360-410`), update (`postUpdate`), documents-ready — all `purpose:"service_relationship"` via `sendEmail`, which makes purpose mandatory (`lib/sendEmail.ts:13-48`).
- **Unified timeline exists:** `TimelinePanel.tsx:42-195` merges notes, updates, issues, calls, documents, invoices, decisions.
- **Friday pulse** cron (`weekly-pulse/route.ts`), CRON_SECRET-gated, agency inbox only.
- **Model ids:** every call site uses `claude-opus-5` — current; pricing constants match. No stale ids.

#### 2. Partial / unreliable (🟡)

- **Duplicate inbox implementation.** `/admin/inbox/page.tsx:39-182` re-declares the ingest/confirm/discard actions inline instead of importing `inbox/actions.ts`; already drifted (page version doesn't revalidate the client tile). Same for `draftImpact` (`issues/page.tsx:308` vs `issues/actions.ts:275`).
- **Ops runs never attach to an agent.** `logOpsRun` looks up `agents.key in ('issue-classifier','inbox-parser')` (`claude.ts:84-89`) but no migration seeds those rows; assistant spend never shows in the per-agent cost column.
- **Consult daily cap counts the wrong thing.** `DAILY_CONSULT_CAP=40` counts all `agent_runs` rows (`consult/[token]/route.ts:121-128`) including admin runs — a busy admin day silently breaks the prospect funnel; three rows per consult means ~13 prospects/day max.
- **Prompt-injection posture is uneven.** `parseIngest` drops the pasted transcript after `--- RAW SOURCE ---` with no "treat as data" instruction (`ingest.ts:91`); `classifyIssue` pastes client text bare (`classify.ts:56`). Schema-constrained output limits blast radius to mis-triage.
- **Outbound mail is not persisted.** No sent-mail table; callers only `console.error` (`sendEmail.ts:91-112`). The timeline has no "email sent" entries.
- **Three senders bypass `sendEmail`/purpose:** `api/funnel/route.ts:149-203` (also adds the lead to a Resend audience with `unsubscribed:false` — a marketing list without a `marketing_permissions` row), `api/client-onboard/route.ts:107`, `packages/auth/src/confirmation-email.ts:34`.
- **Rate limiting fails open** (`packages/db/src/rateLimit.ts:29-36`); `/api/consult` POST has no per-IP limit.
- **Decision notifications:** timeline renders `project_updates.type==='decision'` but nothing inserts that type; no client email for decisions.
- **`postUpdate`, `addNote`, `bookCall` lack `requireStaff()`** (`clients/[id]/actions.ts:321,604,851`) — rely solely on the layout/proxy guard.

#### 3. Missing (❌)

- Proposal drafter (AI), daily briefing and health assistant as live assistants: `morning-briefing` exists only as a seeded-disabled AIW routine (`0020:122-126`); no health/portfolio assistant.
- Spend alerts (dashboards only).
- Persisted sent-mail log; call transcript ingestion tied to `calls.notes`.

#### 4. Dead-but-deployed (👻)

- `IngestPanels.tsx` used only by the client Issues tile; the global inbox carries its own copy.
- `api/funnel/preview/route.ts` (dev-only).
- `CrmEnrichment.draftReply` generated and stored on `leads.agent_enrichment` but never rendered or sent.

#### 5. Top 3 risks

1. Consult cap keyed to total `agent_runs` — prospect funnel fails on any busy admin day, with no alert.
2. Funnel route auto-enrols leads into a Resend audience outside the `marketing_permissions` control.
3. No persistence of outbound client mail + failing-open rate limiter → no evidence of what clients were told, unmetered public endpoints if the RPC errors.

### 4.7 UK compliance, SOC 2 readiness & marketing claims

#### 1. Working end-to-end (✅)

- **Compliance-review assistant escalation gate.** Flags derived deterministically from bool intake fields (`lib/compliance.ts:172-184`); `saveIntake` re-derives flags and sets `escalated` (`compliance/[tenantId]/page.tsx:89-100`); `markRecorded` refuses unless no flags or `decision_recorded` (`:197-206`); `recordDecision` only transitions from `escalated`. New escalations email partners. Children flag seeds a `children_data` checklist idempotently. Wording guardrails covered by `tests/compliance.test.ts:42-67`.
- **SAR export route.** Staff-guarded, SECURITY DEFINER RPC re-checks `is_internal_staff()` (`0042:16-18`), audit-logged and records `compliance_records.kind='sar'` (`api/sar/[tenantId]/route.ts:365-379`). 27 tables covered.
- **Subprocessor notice period** enforced in DB: trigger blocks `effective` without `notified_at`, ≥1 delivery and 14 clear days (`0035:75-117`); UI `sendNotice` emails all active client tenants and upserts deliveries.
- **Data-complaint intake**: rate-limited insert, complainant ack + team alert; 30-day acknowledgement warning in the `legal-deadlines` cron.
- **Cookies**: inventory is necessary-only; no analytics/marketing scripts anywhere — the "no banner" statement is true.
- **SOC 2 engine**: `requireSoc2` two-layer guard; auditor rows must carry `expires_at` (trigger `0037:44-63`) and are filtered on read; auditors blocked from `restricted` evidence; evidence/pack downloads are short-lived signed URLs, event-logged. Sweep idempotent, Vercel cron `30 6 * * *`, CRON_SECRET-guarded. Exception closure requires a separate verify step with named `verified_by`. Rule `governance.control_unowned` raises exceptions for unowned/unscheduled controls.

#### 2. Partial / unreliable (🟡)

- **SAR omits personal-data tables** created before/after 0042: `enquiries`, `document_events` (0048), `scale_evidence` (0044), `scale_assessments`, `data_complaints`, `data_export_requests`, `termination_records`, `contract_acceptances`, `order_forms`, `change_orders`, `marketing_permissions`, `email_suppressions`, `ai_tool_invocations`, `agent_*`, `price_change_notices`, `profiles`, `stripe_events`. No auth.users row, no storage file listing.
- **Erasure incomplete.** `deleteClient` (`clients/[id]/actions.ts:1151-1233`) cascades the tenant, deletes leads/enquiries by email and auth users — but never touches storage objects (no `.remove(` call exists), nor Stripe customers, GoCardless mandates/customers, Xero contacts, or Resend logs. `audit_log`/`marketing_permissions`/`ai_tool_invocations` are `on delete set null` so rows survive with email in `metadata`.
- **Two divergent sub-processor lists.** Public register `packages/content/src/legal/subprocessors.ts` — all 7 entries `legalName: null`, `processingCountries: ["VERIFY"]`, `verified: false` (Anthropic IS listed at :112-124). DPA Annex 3 instead renders `SUB_PROCESSORS` from `packages/content/src/legalEntity.ts:42-73` with confident legal names, includes AWS, but omits GoCardless and Xero. Clients sign one list; the public page publishes another. `hasUnverifiedSubprocessors()` only renders a banner; it blocks nothing.
- **DPA versioning.** `recordDpa` writes `compliance_records{kind:'dpa_signed', detail:{via:'admin'}}` with no version/hash; only portal `contract_acceptances` capture `dpaVersion`. Legal pack is "active" with effective date 20 Aug 2026 without solicitor review (`legal/config.ts:70-80` comment).
- **"Administrator decision"** is `requireStaff()` + free-text `decided_by`; no admin role exists in `packages/auth/src/guards.ts`.
- **SOC 2 controls seeded with no owner** (`seed.ts:71-84`); 46 controls ship unowned and immediately fire `control_unowned` exceptions.
- **Special-category DPA declaration** (`dpa_special_category`) is only printed into the DPA; nothing escalates it or opens a compliance review.
- **No CI**: `.github` does not exist; the legal/cookie assertions and all test files run only when someone runs them locally.

#### 3. Missing (❌)

- Client-facing self-service SAR/erasure (portal has none).
- Processor-side deletion (Stripe/GoCardless/Xero/storage) on erasure; retention scheduler for `active_data_deletion_due`.
- Any GDPR "controls" beyond 3 hand-ticked kinds (`lib/compliance/controls.ts`).
- Privacy notice never names Anthropic/model providers.

#### 4. Dead-but-deployed (👻)

- `compliance_kind 'breach'` enum value — no writer.
- `supabase/soc2_e2e_checks.sql` — manual script, not run by anything.
- `legal/subprocessors.ts` `retiredAt`/`dpaUrl` fields — never rendered or set.

#### 5. Top 3 risks

1. **Marketing over-claims vs contract**: "We carry the liability… data breaches, security and compliance" / "watertight" (`(marketing)/page.tsx:158-159, 227, 232`; `faq/page.tsx:43, 63`; `about/page.tsx:109`) and "GDPR-compliant" (`marketing.ts:352, 439`; `blueprint.ts:56, 88` "GDPR-safe") while the DPA/terms cap liability. No "SOC 2 certified" claim found (good).
2. **Erasure & SAR under-deliver** — a real request would leave files, processor records and ~17 tables untouched.
3. **Published sub-processor register is all placeholders** and contradicts the signed DPA Annex 3 — an Art. 28 transparency defect clients can point to.

### 4.8 Security & data platform

#### 1. Working end-to-end (✅)

- **Webhook signatures**: Stripe `constructEvent` (`api/stripe/webhook/route.ts:31`); GoCardless HMAC-SHA256 with `timingSafeEqual` (`gocardless.ts:361-372`); Vercel deploy hook HMAC-SHA1 + `timingSafeEqual` (`lib/soc2/deployMirror.ts:27-37`), deduped by partial unique index (0038).
- **Cron gating**: all four `/api/cron/*` check `Authorization: Bearer CRON_SECRET` and refuse when unset.
- **Durable rate limiting**: `rate_limit_hit` is SECURITY DEFINER, `search_path=public`, execute revoked from anon/authenticated (`0026:21-48`); applied on signup (5/h), verify-code (20/15m + 5-attempt burn), client-onboard, funnel, data-complaint, portal password reset.
- **RLS helpers hardened**: `is_internal_staff`/`is_member_of` are `stable security definer set search_path=public`; 0036 revokes PUBLIC execute on ref-allocators and pins trigger `search_path`; every post-0036 definer function sets `search_path`.
- **SAR export**: `/api/sar/[tenantId]` requires `requireStaff` and `export_tenant_data` re-checks `is_internal_staff()` inside the function.
- **Portal documents**: cookie session + RLS-scoped project read, 404 on miss, only sent/accepted proposals; service role used only for the read receipt.
- **Admin actions guard pattern**: every `"use server"` file under `app/admin` calls `requireStaff` before `createServiceClient`; SOC 2 area double-gated by `requireSoc2` (`lib/soc2/guard.ts:34-37`), including the two download route handlers.
- **Portal actions** read via RLS client first, then service-write only the row RLS returned (`dpa-actions.ts:27-64`, `plan/actions.ts:45-61`).
- **Mockup sandbox**: LLM-generated HTML served with `default-src 'none'` CSP.
- **Redirect safety**: confirm-email origin allowlist; signout rejects `//`.
- **Storage**: `deliverables`, `issue-attachments`, `soc2-evidence` private; `project-updates` (public, legacy) write/delete restricted to staff (`0043:9-16`).
- **CI** (git-root `.github/workflows/ci.yml`): typecheck, lint, build, test on push/PR.

#### 2. Partial / unreliable (🟡)

- **MFA step-up is page-only**: aal2 redirect lives in `admin/(dashboard)/layout.tsx:74-77`; `requireStaff` (`packages/auth/src/guards.ts:25-41`) never checks AAL, so every server action and `/api/sar`, `/admin/clients/[id]/preview` accept an aal1 session. Enrolment is optional.
- **Resend-confirmation limiter is in-memory** (`packages/auth/src/resend-rate-limit.ts:4`), per-instance, per-email only.
- **Rate limiter fails open** on any RPC error (`packages/db/src/rateLimit.ts:27-35`).
- **Consult generation unmetered per caller**: `POST /api/consult/[token]` has no IP limit, only the global 40 runs/day cap — one prospect can exhaust it for everyone.
- **Webhook idempotency**: Stripe is check-then-insert, non-atomic (`stripe/webhook/route.ts:41-46` vs `:175`); GoCardless has no event ledger — relies on state-based writes.
- **RLS test never runs in CI**: `ci.yml` sets no `SUPABASE_DB_URL`, so `rls.test.mjs:23-30` exits 0 with SKIP; the fixture asserts only the `projects` table.
- **Migration series inconsistency**: two series must both be applied (`supabase/README.md:3-6`); `migrations/` has a duplicate prefix (`0020_ai_workspace_phases2_5.sql`, `0020_untracked_dpa_columns.sql`); 0040–0043 were renumbered post-apply. `agent_consultations`, `leads.agent_enrichment`, `calls.meeting_password`, `email_verifications` exist only in legacy `supabase/0NN_*.sql`. Sampled new columns all have DDL.
- **`packages/db/src/types.ts` badly stale**: 48 of 60 `create table`s absent.
- **Plaintext secrets**: `system_profiles.routine_token` (`0015:11`) and `calls.meeting_password` stored unencrypted; token masked in UI but password rendered as `defaultValue` (`clients/[id]/account/page.tsx:798`). No pgsodium/vault anywhere.
- **client-onboard** interpolates unescaped `name`/`business_name` into the admin HTML email (`route.ts:100-101,119`); no email-format check.
- **`pipeline/actions.ts`** has no `requireStaff`; relies purely on RLS.
- **`.env.example` gaps** — read in code but absent: `GOCARDLESS_ACCESS_TOKEN`, `GOCARDLESS_ENVIRONMENT`, `GOCARDLESS_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_*`, `ANTHROPIC_WORKSPACE_SLUG`, `GITHUB_TOKEN`, `SUPABASE_DB_URL`/`DATABASE_URL`/`POSTGRES_URL`, `NEXT_PUBLIC_LEGAL_{NAME,EMAIL,EFFECTIVE_DATE}`. `DEPLOY.md` says `CRON_SECRET` gates only weekly-pulse (four crons now). `turbo.json globalEnv` omits GoCardless/Xero/deploy-hook vars.
- **Husky**: hooks only active after manual `pnpm hooks:install`; lint-staged runs Prettier only.

#### 3. Missing (❌)

- Security headers: no `headers()` in `next.config.ts`, none in `vercel.json`, no HSTS/CSP/X-Frame-Options except the mockup route.
- Error monitoring: no Sentry, `instrumentation.ts`, `global-error.tsx`, or `error.tsx`.
- Enforced staff MFA (enrolment + AAL check inside `requireStaff`).
- Encryption at rest for stored third-party tokens.
- DB credentials in CI for the RLS test; RLS coverage beyond `projects`.
- Single ledger-tracked migration series / `supabase/config.toml`.

#### 4. Dead-but-deployed (👻)

- `packages/config/src/env.ts` zod schemas — never imported.
- `STRIPE_CONNECT_CLIENT_ID` in `.env.example` + config schema, never read.
- `/api/funnel/preview` — hard 404 in production.
- Legacy `supabase/003,004,006,007,010,011,013*.sql` (006/007 error on fresh replay).

#### 5. Top 3 risks

1. Staff session cookie = full service-role admin: aal2 is never checked in `requireStaff`, MFA optional, and nearly every admin action runs `createServiceClient` after it.
2. Schema is not reproducible: two migration series, duplicate `0020`, renumbered files, 80% of tables missing from `types.ts` — typecheck cannot catch DB drift.
3. Abuse surface with no observability: fail-open limiter, in-memory resend limiter, unmetered consult POST (LLM spend), no security headers, no error monitoring.

### 6. API route table

| path                                                             | auth                       | rate-limit           | notes                                            |
| ---------------------------------------------------------------- | -------------------------- | -------------------- | ------------------------------------------------ |
| POST /api/auth/client-signup                                     | public                     | 5/h/IP (DB)          | service-role `createUser`; no email format check |
| GET /api/auth/confirm-email                                      | token_hash                 | none                 | `verifyOtp`; redirect allowlisted                |
| POST /api/auth/resend-confirmation                               | public                     | 3/h/email in-memory  | enumeration-safe; limiter non-durable            |
| POST /api/auth/signout                                           | cookie                     | none                 | open-redirect guarded                            |
| POST /api/auth/verify-code                                       | public                     | 20/15m/IP + 5/code   | confirms email via admin API                     |
| POST /api/client-onboard                                         | public                     | 5/h/IP               | lead insert + staff email (unescaped HTML)       |
| GET/POST /api/consult/[token]                                    | plan_token capability      | none (global 40/day) | service-role writes; SSE 300s                    |
| GET /api/consult/[token]/mockup                                  | plan_token                 | none                 | LLM HTML under strict CSP                        |
| GET /api/cron/ai-tick, legal-deadlines, soc2-sweep, weekly-pulse | Bearer CRON_SECRET         | n/a                  |                                                  |
| GET /api/documents/[kind]/[projectId]                            | cookie + RLS               | none                 | PDF; service-role only for receipt               |
| POST /api/funnel                                                 | public                     | 5/h/IP (silent 200)  | lead insert, Resend audience                     |
| GET /api/funnel/preview                                          | dev only                   | n/a                  | 404 in prod                                      |
| POST /api/gocardless/webhook                                     | HMAC-SHA256                | n/a                  | mutates `subscriptions`; no event ledger         |
| GET /api/sar/[tenantId]                                          | requireStaff + fn re-check | none                 | full tenant export                               |
| POST /api/stripe/webhook                                         | Stripe signature           | n/a                  | `stripe_events` dedupe non-atomic                |
| POST /api/vercel/deploy-hook                                     | HMAC-SHA1                  | n/a                  | unique `deploy_ref`                              |

## 5. Feature-to-requirement matrix (brief § → status, change since 18 Aug)

| Brief requirement                                                                                                     | 18 Aug                    | 4 Sep                                                                    |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------ |
| §1 Dashboard: health / partner queue / actions / milestones / payments due / CR queue / activity / explainable health | ❌❌🟡❌🟡🟡❌❌          | 🟡✅🟡✅✅🟡✅🟡 (health passport-driven; grid colours fragile)          |
| §2 Lead record / progression / win without re-entry                                                                   | 🟡 / 🟡 / ✅              | 🟡 / 🟡 / ✅ (owner/next action not editable on pipeline)                |
| §3 Proposal content / locked baseline / accept→deposit→build / override                                               | 🟡 / ❌ / 🟡 / ❌         | 🟡 / 🟡 (snapshot at signature, no lock while sent) / 🟡 / ✅            |
| §4 One overview / 12-stage language / gates / owners                                                                  | 🟡 / 🟡 / 🟡 / ❌         | ✅ / 🟡 (8 stages) / 🟡 (launch gate = DPA only, stage can regress) / ✅ |
| §5 Tasks / milestones / risks / decisions / handover                                                                  | 🟡 / ❌ / ❌ / 🟡 / 🟡    | 🟡 / ✅ / ✅ / ✅ / ✅                                                   |
| §6 Onboarding checklist / client page / no internal leakage                                                           | ❌ / 🟡 / 🟡              | 🟡 (staff-seeded, read-only) / ✅ / 🟡 (column-level leaks remain)       |
| §7 CR form / classification / billable capture / assess→approve→pay→schedule→complete                                 | 🟡 / 🟡 / 🟡 / ❌         | ✅ / 🟡 (never used; CO link dead) / ✅ / 🟡                             |
| §8 Invoice types / status+due+reminders / finance summary / humane overdue                                            | 🟡 / 🟡 / 🟡 / ❌         | 🟡 / 🟡 (due on generation, no reminders) / 🟡 / ❌                      |
| §9 WhatsApp quick-log / unified timeline / no unsafe auto-ingestion                                                   | 🟡 / ❌ / ✅              | ✅ / ✅ / ✅                                                             |
| §10 Playbooks + stage-entry offering                                                                                  | ❌                        | ✅                                                                       |
| §AI Seven assistants + rails                                                                                          | 🟡 (3 partial, 4 missing) | 🟡 (4 live and gated, 3 missing; cost ledger read)                       |
| §Compliance intake / review pack / escalation / children / wording guardrails                                         | 🟡 / ❌ / ❌ / ❌ / ❌    | ✅ / 🟡 / ✅ / ✅ / 🟡 (marketing still violates)                        |
| §Data: roles / stamps+audit / linked entities / security checklist / no plaintext creds                               | 🟡 ×5                     | 🟡 / ✅ / ✅ / 🟡 / 🟡                                                   |
| **New:** Docs & Legal review gate + read receipts                                                                     | —                         | 🟡 (gate real; edit-after-send and null-author holes)                    |
| **New:** Care plans → GoCardless → Xero                                                                               | —                         | ✅ for GC; 🟡 Stripe rail; ❌ dunning                                    |
| **New:** Auto-scoring + bracket + per-plan overrides                                                                  | —                         | ✅ (no scheduled re-scan)                                                |
| **New:** One-click build + redispatch                                                                                 | —                         | 🟡 (works; bypasses classification; no atomic claim on redispatch)       |

## 6. Phased backlog (ranked by impact × risk × dependency)

### Phase A — Stop-the-bleeding (correctness only, no redesign)

A.1 **Write `issues.change_order_id`** when a Change Order is raised from an issue, and clear the UI gate on
acceptance; add `.is("batch_id", null)` + error checks to both attach paths; make `compileBatch` apply
`requiresChangeOrder` exactly as `partitionOutstanding` does.
A.2 **Classification before build.** Build everything must not promote `classification = NULL` change
requests silently: require a one-click classify (support / additional development) per issue, or hold
`kind = change` items with NULL classification and list them. Exclude `kind = question` from work orders'
"Fixed" announcements (route them to an "Answers" client update instead).
A.3 **Lock proposals and change orders while `sent` / `client_review`**, or reset review on any edit and
re-block send; require review for uploaded contract/consent documents; treat NULL author as "unknown =
needs a second approver".
A.4 **Column-level exposure.** Create `*_client` views (or column grants) for issues, projects, tenants,
invoices, subscriptions, milestones, order*forms; replace the two `select("*")` portal reads; rewrite
`change_orders_client_decide` to allow only the status/decision columns; drop `anon insert enquiries` and
the legacy `project_updates` client policies; fold the `project_updates` policy + bucket into a ledgered
migration.
A.5 **Money correctness.** Stripe fallback uses the contracted MRR; terms-version check on every DD start
and on the Stripe rail; `invoice.paid` handler guarded by `.eq("status","open")`; Xero payment retry when
the invoice exists but the payment failed; back-fill `due_at` on the 2 live invoices.
A.6 **Staff authority.** Check aal2 inside `requireStaff` (with a 30-day enrolment grace and a hard date);
add `requireStaff` to `pipeline/actions.ts`, `postUpdate`, `addNote`, `bookCall`, `uploadDoc`; turn on
leaked-password protection; pin `search_path` on the three trigger functions; revoke `authenticated`
EXECUTE on `export_tenant_data` / `tenant_footprint`.
A.7 **Grid trust.** Query `audit_log` per tenant (or persist `options_sent_at` / `dd_link_sent_at` on
`tenants`) so care-plan colour cannot regress with log growth; expire "awaiting mandate" after N days;
pick the \_live* project, not the newest, for block colour; treat a rejected Order Form as red.
A.8 Redispatch: atomic claim, clear `pr_url`, refuse when the batch was dispatched via GitHub/MA.

### Phase B — Make the platform reproducible and observable

B.1 Single migration series: fold the legacy `supabase/0NN_*.sql` DDL that still has no ledgered twin
(`agent_consultations`, `leads.agent_enrichment`, `calls`, `email_verifications`, `project_updates`,
`tenants.contact_*`, `projects.proposed_plan/overview/payment_terms/dpa_*/accepted_*/live_url`) into
`migrations/`; renumber the duplicate `0020`; regenerate `packages/db/src/types.ts` from the live schema;
add `supabase/config.toml`.
B.2 Run the RLS isolation test in CI against a shadow DB and extend it to column-level assertions on the
tables in A.4.
B.3 Security headers (HSTS, frame-ancestors, referrer, permissions) in `next.config.ts`; `error.tsx` /
`global-error.tsx` + an error monitor; persist outbound email (`emails_sent`) and surface it on the
timeline.
B.4 Rate limiting: fail closed on RPC error for public writes; per-IP limit on `/api/consult` POST; count
the consult cap on `logAs = consult.*` runs only; move the resend limiter to `rate_limit_hit`.
B.5 Encrypt `routine_token` / `meeting_password` with Vault or pgsodium; stop rendering the password as a
form default.
B.6 `.env.example`, `DEPLOY.md`, `turbo.json globalEnv` reconciled with every `process.env` read; delete
the unused `packages/config/src/env.ts` schemas or wire them in.

### Phase C — Finish the commercial spine

C.1 Dunning: reminder at due, +7, +14 with a humane template; overdue escalation to the finance owner;
portal self-service cancel (the terms promise it).
C.2 Card-rail care-plan invoices + Xero mirror on Stripe `invoice.paid` for subscriptions; GoCardless
event ledger; Xero VOIDED/DELETED mirror-back; scheduled `reconcileXeroInvoices` (cron, not page load).
C.3 Deposit → balance sequencing (drop `invoices_one_build_per_project`); launch checklist + recorded
approval before `live`; `stage_changed_at` history; forward-only `setStage` with an audited override.
C.4 Converge the legacy `change_requests` table into issues; retire the tasks Kanban (decision #3);
retire the duplicate inline action copies in `admin/issues/page.tsx` and `admin/inbox/page.tsx`.
C.5 Erasure that reaches storage objects and processors (Stripe, GoCardless, Xero, Resend) with an
erasure report; SAR extended to the 17 newer tables; one sub-processor list (fill the register, drop the
DPA Annex 3 duplicate, add GoCardless + Xero); name model providers in the privacy notice.
C.6 Client notifications: quote issued, order form / change order sent, issue shipped, decision posted.

### Phase D — Operational intelligence

D.1 Seed `agents` rows so ops/assistant spend attributes per agent; spend alert email at 80 % of budget.
D.2 Daily ops briefing (enable the seeded `morning-briefing` routine with a human-review step), AI proposal
drafter, health assistant that derives health from overdue issues / past-due subscriptions / stalled stages.
D.3 Scheduled auto-score re-scan + monthly reband snapshot; automated `system_profiles.health` writer.
D.4 Role split (finance / delivery / technical) and retire `ADMIN_EMAILS` auto-provisioning.

## 7. Decisions Null Shift must make (flagged, not made silently)

1. **Marketing legal claims** — still live: "we carry the liability… watertight" (`(marketing)/page.tsx:158-159,
227, 232`; `faq/page.tsx:43, 63`; `about/page.tsx:109`), "GDPR-compliant" (`marketing.ts:352, 439`),
   "GDPR-safe" (`blueprint.ts:56, 88`). Same decision as 18 Aug, unmade. Recommend solicitor review before
   the next client signs.
2. **What "Build everything" may build.** Today it treats every unclassified change request as covered.
   Options: (a) keep, accepting that unquoted features get built free; (b) require classification first
   (A.2, recommended); (c) auto-classify with AI and require a human tick.
3. **Questions in work orders** — answer-only (client update) vs build-if-UX-flaw. Recommend answer-only by
   default with a staff "convert to change" action.
4. **Second-approver rule with one staff member.** With two `owner` memberships live the gate is workable;
   if it becomes one, decide between a named external reviewer account and a time-delay self-approval.
5. **Pre-gate documents** — back-fill `document_events.signed` for the three accepted proposals from
   `contract_acceptances`/`accepted_at`, or accept that receipts start on 3 Sep.
6. **Duplicate tenant** "New Future Therapy" / "NewFuture Therapy" — merge or delete before either signs.
7. **Sub-processor list** — the DPA Annex 3 (`legalEntity.ts`) and the public register disagree; pick one
   and verify legal names, countries and transfer mechanisms.
8. **Suffolk Tennis Direct Debit** — `incomplete` since 3 Sep with no mandate: chase or cancel the billing
   request (`BRQ01M1K6EVZWCHHEJ48ABK8RVD0W`).
9. **Repo topology** — CI lives at the parent git root; the deployable `nullshift/` has no `.github`. Fine,
   but document it (two auditors reached opposite conclusions).

## 8. Verification scenarios (brief) — current status

1. Lead → client/project via acceptance + deposit, no duplicates: 🟡 signing raises the deposit invoice;
   payment still advances nothing (manual `setStage`).
2. Staff read owner / next action / blockers / baseline / payment from one page: ✅ Account tile.
3. CR assessed → approved → paid → scheduled → completed with audit trail: ❌ the Change Order link is never
   written; quotes work, CO-gated work cannot be scheduled.
4. New team member uses the handover view: ✅.
5. Client cannot see internal notes / risks / estimates / other tenants: 🟡 rows isolated; columns leak (A.4).
6. AI output stays a reviewable draft: 🟡 internal yes; prospect plan unreviewed by design (decision from
   18 Aug still open).
7. Children's-data / high-risk flag requires recorded escalation: ✅.
