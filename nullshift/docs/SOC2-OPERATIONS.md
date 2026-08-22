# SOC 2 Readiness — Operating Guide

How to run the Security & SOC 2 Readiness programme built into `/admin/soc2`
(migration `supabase/migrations/0037_soc2_readiness.sql`, engine in
`apps/web/lib/soc2/`). Written so a new Programme Owner can operate it cold.

**Language contract (product-wide, enforced in copy and tests):** the system
records that a **control is implemented**, **evidence was collected**, or an
**exception needs review**. It never states that Null Shift is SOC 2
certified, compliant or audit-ready — SOC 2 is an independent CPA
examination, and the dashboard carries that disclaimer permanently.

## First-run sequence

1. **Appoint the Programme Owner** — `/admin/soc2/settings`. While no roles
   exist (bootstrap), any staff member may appoint the first Programme Owner;
   the act is audited. Everything else needs a live programme role: being
   staff opens `/admin`, a programme role opens this area. Client users have
   no path at all (staff-only RLS, no `is_member_of()` on any `soc2_*` table).
2. **Seed the programme** — Settings → "Seed / update programme" (Programme
   Owner only). Installs ~40 controls (TSC-mapped, editable), 12 policy
   drafts (all marked for human review; legal review flagged where needed),
   the vendor register (from the legal sub-processor register + live
   integrations — seeded **proposed**, because the legal register marks them
   unverified), and the asset inventory (platform estate + client system
   passports). Idempotent and additive: re-running never overwrites owners,
   schedules or decisions.
3. **Assign owners** — every control, asset and vendor needs an owner; the
   sweep flags what is missing. Grant `control_owner` / `evidence_reviewer` /
   `system_owner` roles in Settings.
4. **Draft and approve Scope v1** — `/admin/soc2/scope`. The recommended v1
   scope is in `docs/SOC2-READINESS-AUDIT-2026-08-20.md` §5. An Administrator
   (Programme Owner) approves each version with a typed confirmation; nothing
   reports readiness against an unapproved scope, and audit packs refuse to
   generate without one.
5. **Review and approve policies** — `/admin/soc2/policies`. Every seed is a
   draft; correct the bracketed `[confirm]` placeholders to match reality
   before approval. Approval is a named act; acknowledgement tracking starts
   only after approval.
6. **Run the first sweep** — Settings → "Run sweep now" (also daily at 06:30
   UTC via Vercel cron `/api/cron/soc2-sweep`). Expect a wave of honest
   exceptions on first run — unowned assets, unverified vendors, missing
   backup evidence. That wave IS the readiness backlog.

## The operating loop

- **Daily** — the sweep materialises due evidence requests (control runs with
  DB-unique fire keys), runs every exception rule, routes alerts (critical →
  immediate email to Programme Owner + control owner and an incident-candidate
  flag; high → control owner, escalated after SLA without triage; medium/low →
  queue only), and moves cleared conditions to *resolved — pending
  verification*. It closes nothing: closure always needs owner remediation
  plus verification by a different person — a database trigger, applied to
  the machine and people alike.
- **When an evidence request appears** — perform the control, complete the
  run (performer + result + summary; failing honestly is fine — a `fail`
  result with an exception beats a cosmetic pass), attach evidence, and have
  a different person review it. Accepted evidence becomes immutable
  (DB-enforced); fix bad evidence by superseding, not editing.
- **Quarterly** — access review (`/admin/soc2/access-reviews`: every account
  on every provider, privilege + MFA attested, every row decided — the DB
  refuses completion with undecided or unactioned items) and a management
  review (`/admin/soc2/continuity`), which doubles as GOV-06's evidence.
- **Per change** — record production changes at `/admin/soc2/changes`
  (request → review → approval → deploy, rollback plan mandatory).
  Self-approval is visible, flagged medium, and expected to carry the
  documented solo-operator compensating control.
- **Per incident** — `/admin/soc2/incidents`: append-only timeline,
  containment, and a **named human** notification decision (specialist legal
  advice where flagged — the system never concludes legal duty). Closing
  needs a completed post-incident review with lessons learned.

## Evidence rules

- References, never secrets: uploads and evidence text are refused when a
  field matches a secret pattern (same detector as the AI logs,
  `lib/ai/impact.ts`), and the refusal itself raises a critical exception
  without echoing the content.
- Files live in the private `soc2-evidence` bucket; downloads are short-lived
  signed URLs behind the programme-role guard; every download is logged.
- Every item carries capture date, period, collector, reviewer,
  classification and retention date. Restricted-classification notes never
  leave the app — packs export their index metadata only.

## Audit pack

`/admin/soc2/audit-pack`: define review periods, then generate a pack against
an approved scope — scope description + items, roles, control matrix with
period runs, policy index + version history, evidence index, exception
register (incl. remediation/verification trail), vendor register, risk
register, incident summaries and management reviews. The whole pack passes
secret redaction, is hashed (sha256), stored in the private bucket, indexed
in `soc2_audit_packs`, and logged.

**Auditor access posture — be precise about what the role does.** The
recommended way to give an external auditor material is the generated pack
(shared out-of-band; every download is a logged, signed, expiring URL) — an
external auditor gets **no database or app account at all**. The `auditor`
programme role exists for the case where an adviser HAS been given a staff
login: it is time-limited (expiry mandatory at the DB, the ≤90-day cap
app-enforced), excluded from every write path in the app layer, and barred
from restricted-classification evidence files. The data layer backs this up:
every `soc2_*` table is **select-only for authenticated sessions** — all
writes go through the application's service role after its programme-role
guard (the one deliberate session-write is the actor-stamped `soc2_events`
trail insert) — so even raw REST access with a staff login cannot modify SOC
2 records. What remains app-side: an authenticated staff login can still
READ these tables after an auditor role expires, until the staff membership
itself is removed. Granting a staff login to an outsider is therefore still
a recorded risk decision — prefer the pack.

## Mirroring Claude Code work into the change register

Most production change at Null Shift is authored by Claude Code sessions and
lands via GitHub → Vercel. The change register mirrors that pipeline instead
of relying on anyone remembering to log it:

- **Every commit a Claude Code session pushes carries a `Claude-Session:`
  trailer** — a URL that opens the full session transcript: every command,
  file edit and decision behind the change. That is the pull-it-apart link.
- **The deploy mirror** (`/api/vercel/deploy-hook`, shared secret in
  `VERCEL_DEPLOY_HOOK_SECRET`) turns every successful **production**
  deployment into a `soc2_change_records` row: commit link, author, branch,
  deployment id (the idempotency key, unique index from migration 0038),
  prefilled Vercel-instant-rollback plan, and the Claude-Session trailer as
  the ticket reference. The route authenticates the signature, not the
  sender, so either transport below feeds it — and the commit is checked as
  well as the deployment id, so running both cannot double-register a
  release.
- **Reviewer, approval and test evidence stay human.** A mirrored deployment
  has `changeAnnotationGraceDays` (default 2) to be annotated on
  `/admin/soc2/changes`; after that the sweep raises the high-severity
  change-control exception. An unreviewed production change surfacing loudly
  is the control operating, not noise — annotate it or roll it back.

### Choosing a transport

**GitHub Actions (free, in use).** `.github/workflows/soc2-change-mirror.yml`
posts each production deployment of this repo to the endpoint, signed with the
`SOC2_DEPLOY_HOOK_SECRET` repository secret. It fires on `deployment_status`
(seconds after Vercel reports success) and replays the last 20 production
deployments nightly at 06:05, before the 06:30 sweep — so a missed event
self-heals instead of leaving a silent gap. It fails the workflow, loudly,
if the secret is missing, the endpoint is unconfigured, or no production
deployments are visible at all.

One-time setup: pick a long random string; set it as `VERCEL_DEPLOY_HOOK_SECRET`
in the Vercel project's environment variables, and as the
`SOC2_DEPLOY_HOOK_SECRET` repository secret under GitHub → Settings → Secrets
and variables → Actions. **Then redeploy** — Vercel bakes environment
variables into a deployment at build time, so the deployment already serving
production cannot see a variable added afterwards, and the mirror answers 503
until a new one goes out. Finally, run the workflow once by hand
(Actions → SOC 2 change mirror → Run workflow) to backfill; a green run that
reports records mirrored or already registered confirms both sides agree.

**Vercel team webhook (paid plans).** Vercel → Team Settings → Webhooks →
endpoint `https://nullshift.co.uk/api/vercel/deploy-hook`, event
`deployment.succeeded`, all projects; the generated secret goes in the same
`VERCEL_DEPLOY_HOOK_SECRET`. The advantage over the Actions transport is
breadth: one webhook covers **every project in the Vercel team**, including
hosted client systems whose repos have no workflow. Worth the upgrade only
when hosted client systems need to be in the register too; for this platform
alone the free transport is equivalent.

Whichever is used, the register records what actually reached production —
not what someone remembered to log.

What this does not capture: production deployments of OTHER repos while the
GitHub Actions transport is the only one configured (each repo needs the
workflow, or the team webhook), database DDL applied directly (tracked in the
Supabase migrations ledger — the commit that ships the SQL file is mirrored
via its deployment, and direct applies get a manual change record), and
Claude Code sessions that never push (no production change, nothing to
register). AI Workspace activity is mirrored separately through
`agent_runs`/`ai_tool_invocations` and the exception rules.

## AI Workspace under the programme

Controls AIW-01/AIW-02 govern the AI estate. The sweep consumes the
workspace's own signals: active agents without owners, stale heartbeats
(>72h), open escalations (budget → high), `policy.denied` task-trail events,
and `refused` tool invocations — each becomes a reviewable exception; a
reviewed denial is never re-raised. AI providers are vendors like any other
(VND-04): approval before client confidential data, per the AI Tool & Client
Data Use policy draft.

## Testing

Unit tests: `apps/web/tests/soc2-engine.test.ts` (vitest, pure engine —
rules, health precedence, routing, dedupe, schedule, period filters,
redaction, seed hygiene) — `corepack pnpm --filter @nullshift/web test`.

**End-to-end checks** — `supabase/soc2_e2e_checks.sql` is an executable,
self-rolling-back psql script covering the table below. It was run in full on
2026-08-20 against a local Postgres 16 replica built from the complete
documented migration chain (fresh-replay order in `supabase/README.md`):
every check passed. Re-run it against staging after any change to 0037's
triggers:

| # | Scenario (brief §Testing) | How to exercise | Pass condition |
|---|---|---|---|
| E2E-1 | Access review cannot be silently completed | Create a review + one `pending` item; set the review `status='complete'` | DB error `This access review still has 1 undecided account(s).`; same for a decided-but-unactioned revoke |
| E2E-2 | Exception closure gate | On any open exception, `update … set status='closed'` without resolution/verification, then with `verified_by = resolved_by` | Both refused by `enforce_exception_closure`; closes only with note + resolver + different verifier |
| E2E-3 | N/A needs a reason | Set a control `applicability='not_applicable'` without `na_reason`/`na_approved_by` | Refused by `enforce_control_na` |
| E2E-4 | Accepted evidence immutable | Accept an evidence item, then edit its `content_sha256` | Refused by `enforce_evidence_immutability` |
| E2E-5 | Break-glass window | Insert an event with a 48h expiry, or `approved_by = used_by` | Refused by `enforce_break_glass_window` |
| E2E-6 | Non-programme user blocked | Sign in as staff with no programme role → `/admin/soc2/*`; as a client portal user → REST select any `soc2_*` table | Role-required screen; zero rows (RLS staff-only, no member path) |
| E2E-7 | Auditor expiry mandatory | Insert an `auditor` role without `expires_at` | Refused by `enforce_auditor_expiry` |
| E2E-8 | Sweep idempotency | Run the sweep twice in a row | Second run: 0 new runs, 0 new exceptions, 0 new alerts |
| E2E-9 | Pack scoping | Generate packs for two disjoint periods | Each contains only its period's runs/evidence/exceptions; scope must be approved or generation refuses |
| E2E-10 | Cross-tenant isolation | `packages/db` RLS test with `SUPABASE_DB_URL` set | Passes (pre-existing control, cited as IAM-04 evidence) |

## What this build deliberately does NOT do

- Grade an overall score or say "compliant" — statuses carry their basis.
- Make legal/notification decisions — recorded human acts, with a
  specialist-advice flag.
- Auto-connect provider integrations — evidence starts manual/attested;
  read-only integration adapters (identity, source control, monitoring) are
  the designed next step and the vendor register already models them.
- Verify its own closures — the sweep resolves, humans verify.

## Standing human actions

The list the software cannot do for you lives in
`docs/SOC2-READINESS-AUDIT-2026-08-20.md` §8 — Programme Owner appointment,
scope approval, provider MFA attestation, backup policy + restore test,
sub-processor verification, plaintext-token migration, leaked-password
toggle, CI dependency scanning, policy/legal review, solo-operator
compensating control, marketing-claims sign-off, and engaging the
independent auditor.
