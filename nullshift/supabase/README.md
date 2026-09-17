# Database schema — how the SQL in this directory fits together

**There are two migration series, and BOTH must be applied to reproduce production.**
Neither series alone yields a database the app can run against. This is a known
liability (see `docs/OPS-HUB-AUDIT-2026-08-18.md` §5 Phase 1.1 — consolidation into
one ledger-tracked series is the planned fix). Until then, this file is the apply-order
contract for any fresh/staging environment.

## Apply order for a fresh environment

1. **`schema.sql`** — legacy baseline (enquiries, clients, proposals, brand_guidelines).
   ⚠️ Known defect: it declares `enquiries` with an FK to `public.clients` before
   creating `clients`; on a fresh DB, create `clients` first or apply the statements
   out of file order. Its permissive `auth all` policies are **dropped later by
   `migrations/0014` §8** — never re-run `schema.sql` on a live database.
2. **Legacy 3-digit series, `002` → `013`** (root of this directory) — but see the
   verified fresh-replay order below: legacy `014`–`020` re-key tables to `tenants`
   and therefore only apply AFTER `migrations/0001`.
   Still-live contributions: `002/005/014` (calls, re-keyed to tenants),
   `008` (email_verifications), `009` + `017` (project_updates, re-keyed to tenants),
   `012` (funnel columns), `015/016/018` (projects proposal/DPA columns),
   `019/020` (agent_consultations, agent_runs, leads.agent_enrichment).
   Dead contributions (backed flows that no longer exist): `003`, `004`, `006`, `007`,
   `010`, `011`, `013`. ⚠️ `006_subscriptions.sql` conflicts with
   `migrations/0001` (same enum/table names, different shapes) — **skip 006 entirely,
   and skip `007` with it** (007 only ALTERs 006's dead table; on a fresh DB it
   errors with `relation "subscriptions" does not exist`).
3. **4-digit series, in order: `migrations/0001` → `migrations/0043`.**

**Fresh-replay order, verified end-to-end on Postgres 16 (2026-08-20):**
`clients` table first (schema.sql's own FK defect) → rest of `schema.sql` →
legacy `002`–`013` (skip `006`+`007`) → `migrations/0001` → legacy `014`–`020` →
`migrations/0002` → `0043`. Two more replay hazards found in that run:
legacy `014` fails before `migrations/0001` (`relation "public.tenants" does not
exist`), and `migrations/0020_ai_workspace_phases2_5.sql`'s routine seeds
reference agents (`operations-manager`, `finance-assistant`,
`project-coordinator`, `privacy-review`) that production seeded via app code —
on a fresh DB, insert those four `agents` rows (any minimal stub) before 0020,
or its `agent_routines` seed fails its FK.
This is the multi-tenant core the app runs on (tenants, memberships, projects,
tasks, change_requests, invoices, issues, fix_batches, RLS hardening, Stripe/
GoCardless/Xero columns). Note the interleaving: `0003` backfills from legacy
`clients`, `0010` patches legacy `project_updates` policies (no-ops if 009 hasn't
run yet — apply the legacy series first), `0014` §8 drops `schema.sql`'s
permissive policies, and `0020` commits two columns that were hand-applied to
production outside any migration file.

**0040–0043 (renumbered 2026-09-02):** the ops-hub delivery layer, compliance reviews, SAR
completeness and project-updates bucket hardening were authored on a local branch as
`0028`–`0031` while `main` gained a different `0028`–`0031` (scale assessments, data
complaints, order forms, termination). Production already has ALL of them applied — the
ledger (`supabase_migrations.schema_migrations`) records them by name (`delivery_layer`,
`compliance_reviews`, `sar_completeness`, `project_updates_bucket_hardening`) — so the
files were renumbered rather than re-applied. On a fresh DB apply them after `0039`.

Ordering constraints that matter:

- legacy `009`/`017` **before** `migrations/0010` (else the RLS patch silently no-ops
  and the permissive `auth all project_updates` policy stays live);
- `schema.sql` **before** `migrations/0014` (whose §8 drops its policies);
- never apply legacy `006`.

## Verifying an environment matches production

The app's load-bearing drift checks (all discovered the hard way):

- `projects.dpa_client_company_name` and `projects.dpa_client_submitted_at` exist (0019);
- `subscriptions` has `tenant_id`/`plan`/`mrr`/`provider` (NOT `user_id`/`tier`);
- `enquiries`/`clients`/`proposals`/`brand_guidelines` have staff-only policies
  (0014 §8), not `auth all`;
- `agent_consultations` + `agent_runs` exist (legacy 019/020);
- the `soc2_*` tables + the private `soc2-evidence` storage bucket exist (0037),
  and `next_soc2_exception_ref()` is NOT executable by `anon`/`authenticated`
  (EXECUTE revoked from PUBLIC, same posture as the other `next_*_ref()` allocators).

`packages/db/src/rls.test.mjs` runs a real cross-tenant isolation test when
`SUPABASE_DB_URL` is set (it silently skips otherwise).

## Admin redesign series 0057–0065 — NOT APPLIED (2026-09-17)

Authored on `feat/admin-redesign` against the live schema described in
`docs/ADMIN-REDESIGN-PHASE0-2026-09-17.md` §11. **None of these files has been applied
to any database**, branch or production. Nothing in the app reads or writes their
objects unless the matching `OPS_V2_FLAGS` entry is set (all off).

Apply order and dependencies (from `pnpm -C apps/web migrations:dry-run`, which parses
the SQL with no database connection and reports forbidden statements, RLS, money and
timestamp rules, numbering, ledger-name collisions and order):

| File                                   | Depends on                                                                                                                  | Flag                 |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| `0057_opportunities_quotes.sql`        | 0001                                                                                                                        | `commercialV2`       |
| `0058_next_actions_work_class.sql`     | 0001, 0014, 0030                                                                                                            | `workIntake`         |
| `0059_service_arrangements.sql`        | 0001, 0030                                                                                                                  | `commercialV2`       |
| `0060_build_acceptance_checklists.sql` | 0001 (no FK to 0059 on purpose)                                                                                             | `acceptanceGate`     |
| `0062_billing_obligations.sql`         | 0001, 0013 (replaces `invoices_one_build_per_project`; documented backfill links live legacy build invoices to obligations) | `billingActivation`  |
| `0063_integration_operations.sql`      | 0001 (RLS with no policies: service role only)                                                                              | `integrationWorkers` |
| `0064_service_activations.sql`         | 0001, **0059**                                                                                                              | `billingActivation`  |
| `0065_finance_exceptions.sql`          | 0001, **0062** (no FK to 0064 on purpose)                                                                                   | `billingActivation`  |

Order: 0057 → 0058 → 0059 → 0060 → 0062 → 0063 → 0064 → 0065. `0056` (PR #20
`client_economics`) is applied in production but has no file here; `0061` is unassigned.
The production ledger is name-based and not reproducible from this directory (two
`0020`s, renamed `0040–0043`, eighteen applied names with no file): read
`supabase_migrations.schema_migrations` and number the ledger entries against it, not
against the file names (Phase 0 decision N-h), before applying anything. Rehearse on a
branch database first and run `apps/web/scripts/legacy-invariants.sql` for each of the
three protected clients before and after; only `invoices.obligation_id` (0062) and
`order_forms.commercial_version` (0059, default `v1`) may differ. Rollback DDL is in
each file's header and is for a database that never went live with the flag.
