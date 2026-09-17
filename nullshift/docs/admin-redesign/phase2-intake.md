# Admin redesign — Phase 2, task p2-intake (work classification, coverage, next actions)

Date: 17 September 2026 · Branch: `feat/admin-redesign` · Brief sections: §5.4 (owners and next actions), §7, §11 rows "Request submitted" and "Grow scope accepted", §17.1 rows 9–11 · Phase 0 report: `docs/ADMIN-REDESIGN-PHASE0-2026-09-17.md` §3, §8 (N6, N-b), §9, §11.

## What was built

Three things, all off by default behind `flagOn("workIntake")`:

1. **Migration `0058_next_actions_work_class.sql` — NOT APPLIED.** A `client_next_actions` table (one open, owned next action per client with history) and four additive nullable columns on `issues` for the §7 work class and coverage decision. No backfill; no change to `issues.billing`, `issues.classification`, or the 0030 Change Order trigger. Staff-only RLS.
2. **Pure §7 logic — `apps/web/lib/work/classify.ts`.** `suggestClassification(input)` and `coverageFor(classification, entitlements)` implement the brief's rules and are unit-tested: classification never creates an entitlement; warranty applies without Run; an expired warranty is not free support; a client-labelled "bug" can be a feature and a "change" can be a defect; mixed requests split into linked items whose gates are independent; correcting Nullshift's own failed deliverable is not a new charge; urgent covered incidents go to the incident lane and are not delayed by a pending enhancement.
3. **Next-action model and actions — `apps/web/lib/nextActions/`.** `planSetNextAction` decides insert / supersede / no-op so the "one open row per client, never duplicated" rule is testable without a database; `setNextAction`, `completeNextAction`, `listNextActions` are server actions gated by `requireStaff()` → flag → preview cookie → validation → tenant check, and each write logs an `audit_log` row.

Plus a fixture-driven **Work intake page at `/admin/next/delivery/intake`** showing a request being classified (with a GET-only what-if form), the exact coverage wording, a mixed-request split and the §5.4 next-action strip with history. With the flag on, the page additionally renders forms that post to the real actions.

### Migration detail

- `client_next_actions`: `id`, `tenant_id` (→ tenants), `project_id` (nullable → projects), `text`, `owner` (free text, as the brief keeps owners today), `owner_user` (nullable → auth.users), `due_at date`, `state` (`open|done|superseded`), `source` (`manual`, `fixture`, `automation:<id>`), `created_by`, `completed_at`, `superseded_by_id` (lineage), `created_at`, `updated_at`. Partial unique index `client_next_actions_one_open_per_tenant on (tenant_id) where state = 'open'`. `set_updated_at()` trigger. RLS enabled; one policy `for all to authenticated using (is_internal_staff()) with check (is_internal_staff())`, following 0030/0014.
- `issues` additive columns: `work_class public.work_class` (enum: `defect, support, maintenance, change_feature, content_training, data_integration_expansion, transaction`), `coverage_decision public.coverage_decision` (enum: `included_managed, included_warranty, chargeable_grow, needs_review`), `coverage_evidence jsonb`, `split_from_issue_id uuid references issues`. Enums created in `do $$ … exception when duplicate_object` blocks; columns `add column if not exists`; partial index on `split_from_issue_id`.
- No money columns (nothing here is priced). Rollback notes in the header. `projects.next_action` (0022) is untouched; the new table is the client-level, owned replacement the brief asks for and a later step can migrate it.
- `supabase/README.md` was not edited.

### Server actions

`apps/web/lib/work/actions.ts` (`"use server"`):

- `recordClassification({ issueId, tenantId, workClass, coverageDecision, evidence })` — updates only `work_class`, `coverage_decision`, `coverage_evidence` on the issue after verifying `issue.tenant_id === tenantId`. Never touches `billing`, `classification`, `status`, `quoted_price` or `change_order_id`, so legacy tickets and the existing queue are unchanged. Audit `issue.work_classified`.
- `splitRequest({ issueId, tenantId, parts })` — inserts ≥ 2 child issues (`status new`, `source internal`, kind derived from class, `split_from_issue_id = parent`, class + coverage set, `client_visible` copied from the parent). The parent is not modified. Audit `issue.split`.
- `recordClassificationForm` / `splitRequestForm` — `useActionState` wrappers.

`apps/web/lib/nextActions/actions.ts` (`"use server"`):

- `setNextAction(input)` — tenant and project checks; reads the open row; `planSetNextAction`; on supersede does a guarded `update … where id = ? and state = 'open'` (exactly one row or it aborts), inserts the new open row, then links `superseded_by_id`. Identical action → `{ ok: true, kind: "unchanged" }` with no write. Audit `next_action.set` / `next_action.superseded`.
- `completeNextAction({ id, tenantId })` — only an open row for that tenant; audit `next_action.completed`.
- `listNextActions({ tenantId })` — read; still flag-gated.
- Every action returns `{ ok: false, reason: "flag_off" }` when `workIntake` is off, `"preview"` when the `ns_client_preview` cookie is present, `"unauthenticated" | "forbidden"` from `requireStaff()`.

### Page — `/admin/next/delivery/intake`

- **Classify a request**: a GET form (`?q=1&req=…&f_*=1&e_*=1&…`) so the classifier can be exercised on any combination of facts and entitlements with nothing written. Below it the _Suggested class_ panel (class, confidence, incident/routine lane, reasons, label-mismatch note, split parts) and the _Coverage_ panel with the exact §7 wording — `Included — Managed Platform (…)`, `Included — build warranty (…)`, `Chargeable Grow request — quote required.`, `Coverage needs review` — plus governing agreement, reasons, "quote required" / "needs review" chips.
- **Worked examples**: nine fixture requests (`?req=`) that each teach one rule: warranty without Run (Harbour), "bug" that is a feature (Morrow), "change" that is a defect but the warranty has expired (Legacy Example), warranty ≠ assistance (Cedar), our own failed migration is not a new charge (Orbit), routine maintenance under Run (Morrow), no scope yet (Atlas), fee-schedule query to Finance (Fieldstone), urgent covered incident (Northline).
- **Mixed request → linked items**: `req-cedar-07` split into a DEFECT (`Included — build warranty`, proceeds now) and a CHANGE / FEATURE (`Chargeable Grow request — quote required.`, awaits the Grow gate), with the §7 note that neither delays the other.
- **Next action strip**: the client's one open action (owner, due, overdue / no-owner chips) or an explicit empty state; a GET what-if that shows whether "set" would insert, supersede or be a no-op; history (done / superseded rows with lineage, never edited).
- With `workIntake` on: `RecordClassificationForm`, `SplitRequestForm` and `NextActionForms` (the only client component, `IntakeForms.tsx`) post to the actions above. The strip reads live rows only when `?tenant=<uuid>` is supplied; fixture ids are refused by validation.
- `loading.tsx` (skeleton) and `error.tsx` (`unstable_retry`, states nothing was written) provided. Halo tokens via `next.module.css`; own `intake.module.css`; square corners; no animation; UK English; no emoji.

## Files

Created (all within the owned list):

- `supabase/migrations/0058_next_actions_work_class.sql`
- `apps/web/lib/work/classify.ts` — vocabulary, `WORK_CLASS_META`, `COVERAGE_WORDING`, `coverageWording`, `suggestClassification`, `coverageFor`, `planLinkedItems`, parsers.
- `apps/web/lib/work/actions.ts` — `recordClassification`, `splitRequest` (+ form wrappers).
- `apps/web/lib/work/intakeFixtures.ts` — fictional requests, mixed request, next-action rows, fixture tenant UUIDs.
- `apps/web/lib/work/intakeQuery.ts` — what-if query parser and field labels.
- `apps/web/lib/nextActions/model.ts` — types, validation, `planSetNextAction`, `applySetPlan`, `planCompleteNextAction`, `openActionFor`, `isOverdue`.
- `apps/web/lib/nextActions/actions.ts` — server actions; `apps/web/lib/nextActions/index.ts` — re-exports the model only.
- `apps/web/app/admin/(dashboard)/next/delivery/intake/{page,loading,error}.tsx`, `IntakeForms.tsx`, `intake.module.css`
- `apps/web/tests/work-classify.test.ts` (20 tests), `apps/web/tests/next-actions.test.ts` (12 tests)
- `docs/admin-redesign/phase2-intake.md` — this document.

Modified: none. Read but not edited: `apps/web/lib/flags.ts`, `apps/web/lib/next/fixtures.ts` (client names via `clientById`), `apps/web/lib/next/fixtures-ops.ts`, `next.module.css`, `ops.module.css`, `sales/ops-ui.tsx` (imported `Empty`, `Notice`, `Skeleton`), `packages/auth/src/guards.ts`, `packages/db/src/audit.ts`, `apps/web/lib/clientPreview.ts`, migrations 0001/0014/0030/0053.

## Flags

- `workIntake` (from `apps/web/lib/flags.ts`, unchanged): gates every write in `lib/work/actions.ts` and `lib/nextActions/actions.ts` and the read in `listNextActions`. Off (default): the page is fixtures and pure logic; the action forms are not rendered; calling an action directly returns `flag_off` and performs no database call. On: forms render and post; every action still re-checks staff, flag and preview cookie itself.
- No other flag is read. Existing behaviour with the flag off is unaffected: no existing route, action, column or trigger is touched.

## Tests

- `tests/work-classify.test.ts`: vocabulary matches the migration; exact wording and governing-agreement suffix; facts beat labels ("bug" → feature, "change" → defect); no facts → hint only or no class; incident lane; single-fact mapping; nothing included with nothing in force (all seven classes); warranty without Run; expired warranty is not free support (defect and support); warranty ≠ assistance, Run covers assistance/maintenance; feature work is Grow even with Run; content/data chargeable unless expressly included; own failed deliverable not a new charge; insufficient evidence → review; transaction never a Run/Grow answer; mixed split with independent gates; urgent incident proceeds; fixtures avoid legacy client names and hit each expected outcome; what-if query only overrides with `q=1`.
- `tests/next-actions.test.ts`: validation (uuid tenant, text/owner, date, project id, length); insert when none open; no-op when identical (whitespace-insensitive); supersede on any material change; non-open row treated as none; foreign-tenant row throws; applying supersede leaves one open row with lineage and the old text unedited; repeated identical set never creates a second row; invariant guard; complete only open rows of the right tenant; fixture lineage; overdue rule.

Checks run: `pnpm -C apps/web typecheck` clean · `pnpm -C apps/web exec eslint lib/work lib/nextActions "app/admin/(dashboard)/next/delivery/intake" tests/work-classify.test.ts tests/next-actions.test.ts` clean · `pnpm -C apps/web test` 50 files, 647 tests passed.

## Gaps and follow-ups

- **Not linked from the Delivery work queue.** `apps/web/app/admin/(dashboard)/next/delivery/page.tsx` is not owned by this task; add a link from the Work queue tab to `/admin/next/delivery/intake` (the rail already highlights Delivery for the prefix).
- **`packages/db/src/types.ts` not regenerated** (not owned; migration not applied). The cookie client is untyped so the new table/columns typecheck; regenerate after apply.
- **Vocabulary decision N-b remains open.** This slice adds a fourth vocabulary (snake_case §7 enum) beside `issues.billing`, `issues.classification` and `packages/content/src/legal/work.ts`. It is additive and unread with the flag off; the decision should pick one and map the others before the flag is enabled.
- **0030 trigger interaction.** `recordClassification` updates an issue row; if that row is already in `queued|batched|in_progress` with `classification in (additional_development, mixed)` and no accepted Change Order, the existing trigger rejects any update (pre-existing N6 behaviour). The action surfaces this as `db_error`; it does not bypass the gate.
- **Automation "Request submitted" (§11)** is not wired: the classifier is pure and the page is manual. A later worker can call `suggestClassification` and `setNextAction` with `source: "automation:request-submitted"` once `integrationWorkers` exists.
- **"Grow scope accepted" (§11)** is out of this task's scope: `splitRequest` records the linked item with `chargeable_grow`; releasing work on acceptance belongs to the Change Order / quote-version work (N-f).
- `IntakeForms.tsx` asks for raw issue/tenant UUIDs because the prototype has no real client picker; a real picker belongs to the client workspace task.
- The next-action strip on `/admin/next/clients/[id]` still reads `lib/next/fixtures.ts` (not owned); switch it to `listNextActions` when the flag is on.

## Approvals needed

- Apply `0058` (after the ledger reconciliation in Phase 0 N-h) — a schema change on the production project; nothing in this task applied it.
- Decision N-b (canonical work-classification vocabulary) before `workIntake` is turned on for any client.
- Decision 18.6 (warranty duration/start) so `warrantyActive` / `warrantyExpired` can be derived from records rather than entered at triage.
- The defect definition wording in `DEFECT_DEFINITION` is the brief's proposed text; legal review before it appears in any client-facing document.

## How to try it

1. `pnpm -C apps/web dev`, sign in as staff, open `/admin/next/delivery/intake`.
2. Worked examples on the right: `?req=req-morrow-33` (bug → feature), `?req=req-legacy-05` (change → defect, expired warranty), `?req=req-orbit-06` (own failed migration, included), `?req=req-northline-21` (incident lane).
3. Change any checkbox and press **Assess** — the URL carries `q=1` and the panels recompute; **Reset to fixture** returns to the fixture facts. Nothing is written.
4. Scroll to **Next action**: type a different action and **Preview what would happen** to see insert / supersede / no change; type the open action's exact text to see the no-op.
5. `OPS_V2_FLAGS=workIntake pnpm -C apps/web dev` renders the record, split and next-action write forms; add `?tenant=<real tenant uuid>` to read a real client's strip. Without the migration applied the actions return `db_error` from PostgREST (table/columns missing) and write nothing.
6. `pnpm -C apps/web exec vitest run tests/work-classify.test.ts tests/next-actions.test.ts`.
