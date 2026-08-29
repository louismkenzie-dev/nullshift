# SOC 2 Readiness — Current-State Audit, Gap Matrix & Scope Proposal

_Date: 2026-08-20. Method: multi-area parallel code audit over apps/web `/admin` + `/portal` +
`/api`, packages/\*, supabase/\* (36 tracked migrations + legacy series), plus the prior
current-state audits (`OPS-HUB-AUDIT-2026-08-18.md`, `ai-workspace/AUDIT.md`) and the §19
security baseline (`SECURITY-BASELINE.md`, verified 2026-08-20 against the live project).
Framework: AICPA Trust Services Criteria (2017, with revised points of focus 2022)._

**Language rule for everything below and for the product built from it:** Null Shift is not
"SOC 2 certified" and cannot be — SOC 2 is an independent CPA's examination report, not a
self-awarded status. This programme produces **controls implemented**, **evidence
collected**, **exceptions detected**, and a **readiness status** for management. Only a
qualified independent SOC auditor determines scope, sufficiency and the report conclusion.

---

## 1. Executive summary — where Null Shift actually stands

1. **The Security baseline is unusually strong for an agency this size, and it is
   *provable from the codebase*.** RLS is enabled on all 46 tables in `public` (verified
   live); staff TOTP + aal2 step-up gates `/admin`; every admin mutation writes an
   append-only, DB-stamped `audit_log`; webhooks are signature-verified and idempotent;
   AI tool logs redact secrets by key and value shape; outbound email cannot be sent
   without a declared purpose. These are real controls — but almost none of them has
   **an owner, a frequency, or collected evidence**, which is what separates "control
   exists" from "control operates" in a SOC 2 examination.
2. **Evidence is the biggest gap, not controls.** Nothing schedules control performance
   (access reviews, backup/restore checks, vendor reviews, policy reviews); nothing
   records who performed what and when; there is no evidence store, no review-period
   concept, and no exception process. The audit trail (`audit_log`) is written everywhere
   and read nowhere.
3. **Vendor management is half-built and knowingly wrong.** A subprocessor register
   exists (`packages/content/src/legal/subprocessors.ts` + change-notice machinery in
   migration 0035) but all 7 entries are placeholders "pending confirmation" and
   Anthropic was, at the last audit, missing entirely despite transcripts and client
   repositories flowing to its API. There is no vendor risk review, no DPA/contract
   status tracking, no review cadence.
4. **People/process controls exist only as prose.** `runbook-compliance.md` sketches a
   breach protocol and an offboarding gap; the security baseline's ⬜ rows (backup
   policy evidence, offboarding checklist, provider-account MFA confirmation,
   leaked-password toggle) all need a human to act and a place to record the action.
   There are no approved written policies, no acknowledgement tracking, no training
   record, no risk register.
5. **The AI estate is governable — the rails already exist.** The AI Workspace has
   lifecycle-gated agents, risk tiers, tool grants, budgets, approvals, escalations,
   policy-checked delegation and idempotent routines. What is missing for SOC 2
   readiness: named accountable owners on every agent (currently nullable), manager
   approval records, denied-access → exception routing, and heartbeat/stale flags
   surfaced as control exceptions rather than dashboard cosmetics.

**Overall:** technical Security (CC6) and much of Change Management (CC8) can be
evidenced largely from what already runs. Governance (CC1–CC5), Vendor (CC9),
Availability (A1) and Confidentiality (C1) need the operating layer this build adds:
owners, cadences, evidence, exceptions, and honest reporting.

## 2. The system, as found

### 2.1 Environments and providers

| Layer            | Provider                    | Notes                                                                                    |
| ---------------- | --------------------------- | ---------------------------------------------------------------------------------------- |
| Hosting/compute  | Vercel                      | One deployable Next.js app (`apps/web`); TLS terminated by Vercel; cron via vercel.json  |
| Database/auth    | Supabase (project `cweftpoaojwzllzficgt`) | Postgres + Auth + Storage + RLS; service-role key server-side only          |
| Source control   | GitHub                      | Monorepo + per-client repos; `claude-code-action` in client repos; fine-grained PAT      |
| Payments         | Stripe (cards), GoCardless (Bacs DD) | Hosted components only — no PAN/CVV ever touches the system                     |
| Accounting       | Xero (custom connection)    | Invoice + payment mirror                                                                 |
| Email            | Resend                      | All outbound; purpose-gated sends                                                        |
| AI               | Anthropic API; Claude Code (Actions, Routines research preview, Managed Agents beta) | Consultation, triage, ingest, fix-batch dispatch |
| Monitoring       | — (none)                    | No error monitoring, no uptime checks, no alerting service                               |
| Device mgmt      | — (none)                    | No MDM; founder-operated hardware                                                        |

### 2.2 Data categories handled

- **Client confidential**: project scope/pricing, proposals, contracts (Order Forms,
  Change Orders, DPAs), issues and inbox transcripts (WhatsApp/Zoom/email pastes),
  system passports (repo/Vercel/Supabase refs, runbooks, known footguns).
- **Client personal data**: lead/contact identity (name, email, phone, UTM), portal
  user accounts, call records, complaint records. Clients' *own* end-user data lives in
  client systems Null Shift builds/hosts, where Null Shift is processor.
- **Credentials & secrets**: provider keys in Vercel env; ⚠ two plaintext bearer
  tokens live in the DB (`system_profiles.routine_token`, `calls.meeting_password`) —
  a known finding carried into the gap matrix.
- **Source code**: this monorepo plus client repositories (read/write via
  `GITHUB_DISPATCH_TOKEN`, and via Anthropic-hosted runners during fix batches).

### 2.3 People

Founder/director-operated with contractors as needed. No org-wide role split yet:
admin = `staff` membership on the internal tenant (or transitional `ADMIN_EMAILS`).
Every staff member currently sees everything; there is no finance/delivery/security
role separation (known backlog item, OPS-HUB-AUDIT §Phase 4.5).

## 3. Existing controls by Trust Services category

Legend: ✅ implemented and operating in code · 🟡 partial (exists but unowned,
unevidenced, or incomplete) · ❌ missing.

### 3.1 Security (CC-series) — required baseline

- ✅ **Logical access, tenant isolation** — default-deny RLS on all 46 tables;
  `is_member_of()` / `is_internal_staff()` policy helpers; composite tenant FKs; a real
  cross-tenant RLS test (`packages/db/src/rls.test.mjs`, needs `SUPABASE_DB_URL`).
- ✅ **Staff MFA** — TOTP enrolment + aal2 step-up enforced at the `/admin` boundary
  (`app/admin/security`, `(dashboard)/layout.tsx`). 🟡 Provider-account MFA (Supabase,
  Vercel, GitHub, Stripe, GoCardless, Xero, Resend) is unverifiable from code and
  unrecorded — needs attestation evidence.
- ✅ **Audit trail** — append-only `audit_log`, DB trigger binds actor + timestamp so
  entries cannot be forged; written on every staff mutation and client-data write.
  🟡 Never read, never reviewed, no retention statement.
- ✅ **Webhook integrity** — Stripe signature verification, GoCardless HMAC, idempotent
  processing (`stripe_events` dedupe).
- ✅ **Secret hygiene in app code** — secrets env-only; service-role key confined to
  `packages/db/src/server.ts`; AI logs redacted by key name and value shape
  (`lib/ai/impact.ts`, tested). 🟡 Two plaintext tokens in DB rows (2.2 above);
  no repository secret scanning.
- ✅ **Function hardening** — 0036: EXECUTE revoked from PUBLIC on enumeration-oracle
  functions; `search_path` pinned on triggers.
- 🟡 **Rate limiting** — durable `rate_limits` table exists (0026) with helpers on
  sensitive routes; coverage is per-route opt-in, not fleet-wide.
- 🟡 **Joiner/leaver** — joiner = staff membership upsert (auto-provision from
  allowlist); **no leaver process at all** across Supabase/Vercel/GitHub/Stripe/
  GoCardless/Xero/Resend + memberships (SECURITY-BASELINE #8).
- ❌ Access reviews, privileged-access inventory, break-glass process, security
  training/acknowledgement records, written policies, risk register, secret detection.

### 3.2 Availability (A-series)

- 🟡 Supabase plan-level backups exist; **no recorded policy, no success review, no
  restore test ever recorded** (SECURITY-BASELINE #5 — an Order Form storing personal
  data is already blocked without a `backupPolicyId`, which is a real dependency).
- ❌ Uptime/health monitoring of hosted client systems; incident response records
  (breach prose exists in the runbook, no record store); BC/DR plan; capacity review.
- Context: Null Shift **hosts and operates client production systems** (care plans
  include "hosting, DB, SSL, backups, monitoring" as a sold service) — Availability
  belongs in scope for those systems.

### 3.3 Processing Integrity (PI-series)

- ✅ Strong authorisation gates in the money and contract paths: DPA-before-live DB
  trigger; proposal acceptance by typed signature with compare-and-set; Change Orders
  gated before build; contracted-MRR resolution on every billing path; idempotent
  invoice generation; AI drafts always human-confirmed before becoming issues.
- 🟡 Known integrity holes catalogued in OPS-HUB-AUDIT §1 (due dates, GoCardless
  cancel, unbatchable-work gates — several since fixed in Phase 0 of that backlog).
- Recommendation: include PI **narrowly** (billing/invoicing accuracy + change
  authorisation) in a first readiness scope; do not claim the full series.

### 3.4 Confidentiality (C-series)

- ✅ Tenant isolation (above); private storage buckets for deliverables/attachments;
  staff-only SAR export; DPA machinery with per-client subprocessor change notices
  (14-day enforced runway, migration 0035).
- 🟡 One legacy public bucket (`project-updates`); column-level leaks to portal users
  catalogued in OPS-HUB-AUDIT §3.6; no data classification scheme; no retention
  schedule beyond termination records; sub-processor register unverified.
- ❌ Confidentiality commitments inventory; classification-driven handling rules.

### 3.5 Privacy (P-series)

- A UK GDPR spine already exists (DPAs, SARs, erasure, complaints with statutory
  deadline alerts, consent manager, marketing permission gate). **Recommendation:
  exclude the SOC 2 Privacy category from the first readiness scope** — the scoped
  system processes client personal data as *processor*, the GDPR programme covers it,
  and P-series adds audit surface without client demand. Revisit at first re-scope.

## 4. Gap matrix

Columns: control objective → what exists today → evidence available today → gap →
risk → recommended remediation → proposed owner → target.

| # | Control objective (TSC) | Existing implementation | Evidence today | Gap | Risk | Remediation | Owner (proposed) | Target |
| - | ----------------------- | ----------------------- | -------------- | --- | ---- | ----------- | ---------------- | ------ |
| G1 | Approved infosec policy, annual review (CC1/CC5) | Prose fragments (runbook, OPERATIONS.md) | None | No approved, versioned, acknowledged policies | High | Policy register + 12 seeded drafts → human/legal review → approval + acknowledgement tracking | Programme Owner (Director) | Phase 1 |
| G2 | Risk assessment & register (CC3) | None | None | No risk records at all | High | `risks` register with treatment, owner, linked controls, review cadence | Programme Owner | Phase 1 |
| G3 | Defined security roles (CC1) | Monolithic `staff` | None | No programme owner/control owner/reviewer roles | High | Programme role assignments (per-user), enforced server-side on the SOC 2 area | Programme Owner | Phase 1 |
| G4 | Asset/system inventory (CC3/CC6) | `system_profiles` per client system; env list in DEPLOY.md | Partial (passports) | No unified inventory w/ owner, classification, criticality, review date | Medium | `soc2_assets` seeded from systems/integrations; flag unowned/unclassified | Programme Owner | Phase 1 |
| G5 | MFA on all in-scope provider accounts (CC6.1) | Enforced for `/admin` staff; providers unknown | Step-up code; nothing for providers | No provider MFA attestation | High | Access-review attestation items per provider account; exception when missing | Control Owner: access | Phase 2 |
| G6 | Leaver deprovisioning (CC6.2/6.3) | None | None | Departed staff could retain provider access | Critical | Offboarding checklist control + access-change records + review evidence | Control Owner: access | Phase 2 |
| G7 | Periodic access review (CC6.2) | None | None | Never performed | High | `access_reviews` + per-account items + sign-off + overdue exception | Control Owner: access | Phase 2 |
| G8 | Backup success + restore test (A1.2) | Supabase plan backups | None recorded | No policy id, no review, no restore test | High | Backup policy record + periodic review control + restore-test control w/ evidence | Control Owner: infra | Phase 2 |
| G9 | Incident process + records (CC7.3–7.5) | Breach prose in runbook; complaint records exist | Complaints only | No security-incident record store, no severity model, no post-incident review | High | `security_incidents` with timeline, containment, notification decision, lessons | Programme Owner | Phase 2 |
| G10 | Vendor register + review (CC9.2) | Subprocessor register (placeholders); notice machinery | Notices only | No risk review, DPA/contract status, review cadence; register unverified | High | `soc2_vendors` seeded from subprocessors + integrations; review controls + expiry flags | Programme Owner | Phase 1–2 |
| G11 | Change management: linked review/approval (CC8.1) | GitHub PRs + husky + fix-batch flow; deploy via Vercel | Git history only | No change records linked to deploys; no approval evidence; solo-dev self-approval unmanaged | Medium | `change_records` + release approvals + documented solo-review exception w/ compensating control | Control Owner: delivery | Phase 2 |
| G12 | Dependency vulnerability management (CC7.1) | Manual `pnpm audit` pre-release (stated, unevidenced) | None | No CI scanning, no SLA, no remediation records | Medium | Control + evidence of runs; wire Dependabot/`pnpm audit` into CI (human task) | Control Owner: delivery | Phase 2–3 |
| G13 | Secrets never in code/tickets/DB (CC6.1) | Env-only + AI-log redaction | Redaction tests | 2 plaintext DB tokens; no repo secret scanning | High | Exception raised at seed; migrate tokens to env/vault refs (human task); scan control | Control Owner: delivery | Phase 2 |
| G14 | Audit-trail review (CC4.1) | `audit_log` written everywhere | The log itself | Never reviewed; no retention statement | Medium | Periodic log-review control + retention rule in evidence store | Programme Owner | Phase 2 |
| G15 | Availability monitoring of operated client systems (A1.1) | Manual uptime dropdown on passports | None | No health checks/alerting despite selling "monitoring" | High | Monitoring integration category + stale-health exception; interim: manual check control w/ evidence | Control Owner: infra | Phase 3 |
| G16 | BC/DR plan + test (A1.3) | None | None | No plan, no tabletop | Medium | BC/DR policy draft + tabletop-review control | Programme Owner | Phase 2–3 |
| G17 | Staff security training/acknowledgement (CC1.4) | None | None | Nothing to acknowledge yet (see G1) | Medium | Acknowledgement requirements on policy versions + overdue flags | Programme Owner | Phase 2 |
| G18 | AI agent governance (CC6/CC8 extension) | Lifecycle, tiers, grants, budgets, approvals, policy checks | agent_events/runs | Owners nullable; no owner+manager approval trail; denials not exceptions | Medium | Require owner; route policy denials, stale heartbeats, budget breaches into exception engine | Programme Owner | Phase 3 |
| G19 | Evidence collection & retention (CC4) | None | — | No evidence store at all | High | `evidence_items` w/ hash, classification, retention, reviewer | Programme Owner | Phase 2 |
| G20 | Readiness reporting & audit pack (CC2.2/2.3) | None | — | No readiness view, no exportable index | Medium | Dashboard + review periods + audit pack export (redacted, scoped) | Programme Owner | Phase 4 |

## 5. Proposed Scope of System (v1 — requires Administrator approval in-app)

**Service description:** design, build, deployment, hosting support and ongoing care of
bespoke client software; operation of the Null Shift Ops platform (admin hub + client
portal) through which client-facing delivery and confidential client information flow.

**In scope**

- Services: Null Shift Ops platform (nullshift.co.uk — `/admin`, `/portal`, `/api`),
  client production systems on a care plan where Null Shift operates hosting.
- Environments: Vercel production project; Supabase production project
  (`cweftpoaojwzllzficgt`); client Vercel/Supabase projects under care plans.
- Repositories: this monorepo; client repositories Null Shift maintains.
- Cloud/SaaS accounts: Vercel, Supabase, GitHub, Stripe, GoCardless, Xero, Resend,
  Anthropic (API + Claude Code surfaces).
- Data: client confidential data (2.2), client personal data the platform processes,
  credentials/secrets, source code.
- People: all Null Shift staff and any contractor with access to in-scope systems.

**Trust Services categories:** Security (baseline) + Availability (operated client
systems + the Ops platform) + Confidentiality (client confidential data/source code).
Processing Integrity: narrow inclusion (billing accuracy, change authorisation).
Privacy: **excluded** in v1 (rationale §3.5).

**Exclusions:** marketing site content; prospect-only analytics; the gated `apps/clinic`
scaffold (not deployed); Null Shift's own bookkeeping beyond invoice records; client
systems where the client operates hosting themselves (supported, not operated).

## 6. What already counts toward readiness (reuse, don't rebuild)

| Existing record/mechanism | SOC 2 reuse |
| ------------------------- | ----------- |
| `audit_log` + `logAudit()` | The append-only trail for every SOC 2 material action — extended, not duplicated |
| `compliance_records` | Historical evidence of DPA/backup checks; superseded by control runs, kept as history |
| `subprocessors.ts` + 0035 notices | Seed + change-control layer of the vendor register |
| `system_profiles` | Seed of the asset inventory for client systems |
| Order Form `technical.backupPolicyId` blocker | First backup-policy linkage — the BC/backup controls make it real |
| AI Workspace (agents, approvals, escalations, budgets, routines) | The AI governance control set; its signals feed the exception engine |
| `data_complaints`, `termination_records`, `data_export_requests` | Privacy/confidentiality operational records referenced as evidence sources |
| `rate_limits`, 0036 hardening, RLS test | Technical control evidence, citable directly |
| Legal-deadlines cron pattern | The shape of the SOC 2 sweep (alert *before* the deadline, silent when clear) |

## 7. Phased implementation plan (this build)

- **Phase 1 — Governance spine:** scope records (versioned, approved), programme
  roles, control library (seeded, editable, TSC-mapped), policy register + 12 draft
  templates, asset inventory, vendor register, risk register, readiness dashboard
  with the mandatory disclaimer.
- **Phase 2 — Operate & evidence:** control runs (scheduled by frequency), evidence
  items (hash, classification, retention, reviewer), access reviews + items +
  access-change records, incidents, change records, backup/restore checks.
- **Phase 3 — Detection:** rules engine → exceptions (8-state lifecycle, severity
  rationale, owner, due date), alert routing (critical → immediate email; high →
  owner + SLA escalation; medium/low → queue), AI Workspace signal integration,
  daily cron sweep (idempotent).
- **Phase 4 — Reporting:** review periods, readiness trend, audit pack export
  (scoped by period, secret-free, redacted), auditor access records, management
  attestation drafts and control narratives marked for human review.

## 8. Decisions and actions that require a human (not made silently by this build)

1. **Appoint the Security/SOC 2 Programme Owner** (a Director/Partner) and control
   owners — the seeds assign "unassigned" and flag it as an exception until done.
2. **Approve Scope v1** (§5) in the app — nothing reports readiness against an
   unapproved scope.
3. **Confirm provider-account MFA** on Supabase/Vercel/GitHub/Stripe/GoCardless/
   Xero/Resend/Anthropic and record the attestation (first access review).
4. **Record the Supabase backup policy** (schedule, retention) and run the first
   restore test.
5. **Verify the sub-processor register** — legal names, processing countries,
   transfer mechanisms are placeholders; confirm Anthropic's entry and DPA terms.
6. **Migrate the two plaintext DB tokens** (`system_profiles.routine_token`,
   `calls.meeting_password`) to env/secret references.
7. **Enable Supabase leaked-password protection** (dashboard toggle).
8. **Wire dependency scanning into CI** (Dependabot config exists per runbook; verify
   it runs and route findings).
9. **Policy review**: all 12 seeded policies are drafts requiring human (and where
   marked, legal) review before approval; the AI Tool & Client Data Use policy needs a
   decision on Anthropic data-handling terms.
10. **Solo-operator segregation of duties**: several controls (change approval,
    evidence review) assume a second person. Decide the compensating-control posture
    (documented self-review + periodic external check) and record it as an approved
    exception — an auditor will test this honestly, not cosmetically.
11. **Marketing legal claims** ("GDPR-compliant", "watertight") — already flagged in
    OPS-HUB-AUDIT §6.1; a SOC 2 programme must not coexist with unsubstantiated
    compliance claims on the website. Needs sign-off to soften.
12. **Engage a qualified independent SOC 2 auditor** to determine final scope, the
    examination period (Type 1 vs Type 2) and evidence sufficiency.

## 9. Verification of this audit

The §3 "✅" claims trace to: migrations 0001/0003/0010/0014/0016/0026/0036 (RLS,
audit_log, hardening, rate limits), `SECURITY-BASELINE.md` (live-DB verified rows),
`app/admin/(dashboard)/layout.tsx` (aal2 step-up), `packages/db/src/audit.ts` +
`rls.test.mjs`, `lib/ai/impact.ts` + `tests/ai-gates.test.ts`, `lib/sendEmail.ts`
(purpose gate), 0035 (notice-period trigger). The 🟡/❌ claims trace to
`OPS-HUB-AUDIT-2026-08-18.md` §3.12–3.13 and `SECURITY-BASELINE.md` ⬜/⚠ rows.
