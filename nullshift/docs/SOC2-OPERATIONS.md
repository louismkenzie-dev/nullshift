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
in `soc2_audit_packs`, and logged. Auditor access = a time-limited (≤90 days,
DB-enforced expiry) read-only programme role, granted and revoked on the same
page.

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
