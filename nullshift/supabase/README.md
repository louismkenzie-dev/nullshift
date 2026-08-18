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
2. **Legacy 3-digit series, in order: `002` → `020`** (root of this directory).
   Still-live contributions: `002/005/014` (calls, re-keyed to tenants),
   `008` (email_verifications), `009` + `017` (project_updates, re-keyed to tenants),
   `012` (funnel columns), `015/016/018` (projects proposal/DPA columns),
   `019/020` (agent_consultations, agent_runs, leads.agent_enrichment).
   Dead contributions (backed flows that no longer exist): `003`, `004`, `006`, `007`,
   `010`, `011`, `013`. ⚠️ `006_subscriptions.sql` conflicts with
   `migrations/0001` (same enum/table names, different shapes) — **skip 006 entirely**;
   the live subscriptions table is the tenant-keyed one from `migrations/0001`.
3. **4-digit series, in order: `migrations/0001` → `migrations/0021`.**
   This is the multi-tenant core the app runs on (tenants, memberships, projects,
   tasks, change_requests, invoices, issues, fix_batches, RLS hardening, Stripe/
   GoCardless/Xero columns). Note the interleaving: `0003` backfills from legacy
   `clients`, `0010` patches legacy `project_updates` policies (no-ops if 009 hasn't
   run yet — apply the legacy series first), `0014` §8 drops `schema.sql`'s
   permissive policies, and `0020` commits two columns that were hand-applied to
   production outside any migration file.

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
- `agent_consultations` + `agent_runs` exist (legacy 019/020).

`packages/db/src/rls.test.mjs` runs a real cross-tenant isolation test when
`SUPABASE_DB_URL` is set (it silently skips otherwise).
