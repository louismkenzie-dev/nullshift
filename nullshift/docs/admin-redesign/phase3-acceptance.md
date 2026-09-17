# Admin redesign — Phase 3, task p3-acceptance (build acceptance, checklists, handover)

Date: 17 September 2026 · Branch: `feat/admin-redesign` · Brief sections: §5.5 (acceptance), §5.10 (initial and later checklists), §8.2, §8.5–8.6, §3.3 #3, §17.1 rows 2, 3, 5, 11, 12 · Phase 0 report: `docs/ADMIN-REDESIGN-PHASE0-2026-09-17.md` §3, §7, §8 (#3), §9, §10, §11.

## What was built

Everything database-backed or behaviour-changing is off by default behind `flagOn("acceptanceGate")`.

1. **Migration `0060_build_acceptance_checklists.sql` — NOT APPLIED.** Three additive tables — `build_acceptances`, `checklist_tasks`, `handover_tasks` — with staff-full / member-read RLS, a client insert policy for build acceptance, and two `SECURITY DEFINER` functions for the only client write to a task. No existing table, row or trigger is touched. `projects.stage`, `checklists` (0040), `tenants.care_plan_choice` and `subscriptions` are left as they are.
2. **Pure delivery model — `apps/web/lib/delivery/`.** Generators for the §5.10 initial checklist, the §5.10 later checklist (branching on the service route), and the §8.5 independent-handover checklist; acceptance rules (partial / disputed / one clean acceptance per scope version); the governing-scope resolver; client-transition rules that mirror the SQL function exactly.
3. **`planChoiceOpenV2` in `apps/web/lib/planGate.ts`.** With the flag off it is `planChoiceOpen(stage)` unchanged. With the flag on it opens only on a non-disputed build acceptance for the governing scope version. The existing `planChoiceOpen` export and its test are untouched and still pass.
4. **Server actions — `apps/web/lib/delivery/actions.ts`.** `recordBuildAcceptance` (client signatory through the portal, or staff recording an acceptance given elsewhere with a reason), `updateChecklistTaskFromPortal` (through the SECURITY DEFINER function), `publishChecklist` (staff persist the generated tasks, `on conflict` skip so states are never overwritten), plus `<form action>` wrappers. Every write: flag → not a preview session → identity → validate → tenant check → write through the caller's own client → `audit_log` row.
5. **Portal routes `/portal/checklist` and `/portal/acceptance`** with `loading.tsx`, `error.tsx` and real empty states. Rendered for the signed-in client tenant using the existing `getPortalClient()` (RLS client, or the tenant-scoped read-only client for a staff preview). Read-only unless the flag is on. Accepting the build never requires — or offers — a package choice.

### Migration detail (`supabase/migrations/0060_build_acceptance_checklists.sql`)

- `build_acceptances`: `id`, `tenant_id` (→ tenants), `project_id` (→ projects), `scope_version_ref text` (e.g. `order_form:OF-2026-0004`, `proposal:<project uuid>:v1`), `accepted_by_user` (nullable → auth.users), `accepted_by_name`, `accepted_role` (`client_signatory | staff`), `method` (`portal | staff_recorded | email | meeting | document`), `accepted_at timestamptz`, `evidence jsonb` (per deliverable: deliverable, criteria, met, evidence, client_comment), `partial`, `disputed`, `defects_outstanding jsonb`, `notes`, `recorded_by` (nullable → auth.users), timestamps. Checks: a staff-recorded acceptance needs notes (the reason); a portal acceptance is bound to a user; a partial acceptance must list at least one defect or unmet deliverable. **Partial unique index** `build_acceptances_one_clean_per_scope on (project_id, scope_version_ref) where not disputed and not partial`. No column for a plan, a payment or a signature exists here — on purpose.
- `checklist_tasks`: `id`, `tenant_id`, `project_id` (nullable), `arrangement_id uuid` (nullable, **no FK** — the service-arrangement table is the sibling migration `0059_service_arrangements.sql`, which may not be in the ledger; add the FK in a later migration), `journey` (`initial | later`), `key`, `label`, `why`, `owner_kind` (`nullshift | client`), `state` (`not_started | in_progress | awaiting_client | blocked | complete | not_applicable | waived`), `waived_by`, `waiver_reason`, `waiver_approver`, `evidence jsonb`, `due_at`, `requirement_source`, `completed_at`, timestamps. Checks: waived needs reason + approver; waived has `completed_at null` (a waiver is not completion); complete has `completed_at`. Unique `(project_id, journey, key)` (partial, `project_id is not null`) and `(arrangement_id, journey, key)` for arrangement-only tasks.
- `handover_tasks`: as the brief lists plus `tenant_id` (needed for RLS), `why`, `due_at`, `requirement_source`, waiver columns and timestamps; unique `(arrangement_id, key)`; same waiver/complete checks.
- RLS: `*_staff_all` (`is_internal_staff()`), `*_member_select` (`is_member_of(tenant_id)`), and `build_acceptances_client_insert` for `is_tenant_admin(tenant_id) and accepted_by_user = auth.uid() and accepted_role = 'client_signatory' and method = 'portal' and recorded_by is null` against a project of that tenant. Clients have no update or delete policy on any table.
- `portal_update_checklist_task(task_id, new_state, new_evidence)` / `portal_update_handover_task(...)`: SECURITY DEFINER, `revoke … from public, anon`, `grant execute to authenticated`. They require `auth.uid()`, membership of the row's tenant, `owner_kind = 'client'`, a current state that is not `waived | not_applicable | blocked`, and a target state in `not_started | in_progress | complete` — so a client can never waive, block or mark not-applicable. Completing needs evidence (new or existing). Evidence is appended, never replaced. `completed_at` is set on complete and cleared otherwise.
- No money columns; nothing is priced. No backfill. Rollback notes in the header. `supabase/README.md` not edited.

### Pure logic (`apps/web/lib/delivery/`)

- `types.ts` — task states, owner kinds, journey, service route, `ChecklistTask`, `HandoverTask`, `DeliverableEvidence`, `OutstandingDefect`, `BuildAcceptance`, `AcceptanceEvidence`, `CLIENT_SETTABLE_STATES` / `CLIENT_LOCKED_STATES`.
- `checklists.ts` — `generateInitialChecklist(facts)` (company → agreement → initial payment → assets → kickoff; a configured waiver becomes `waived` with reason and approver and is excluded from the completion count; a waiver never overrides a real completion and never marks the deposit paid), `generateLaterChecklist(facts)` (managed: acceptance → package/schedule → Direct Debit → activation; independent: acceptance → handover → transfer completion; unresolved: acceptance + "route to be confirmed" — the client never sees both branches), `generateHandoverChecklist(facts)` (all eleven §8.5 bullets with requirement sources; the application-fee item is always present and needs evidence), `handoverCanComplete`, `completion`, `nextStep`, `clientTransition`, `applyClientUpdate`, `STATE_LABEL`.
- `acceptance.ts` — `validateAcceptanceInput`, `deriveFlags` (partial = any unmet deliverable or any defect; disputed = the client's explicit word), `planRecordAcceptance` (refuses a second clean acceptance of the same scope version; partial and disputed rows are always recordable history), `governingAcceptance` (clean row, else latest partial, never disputed), `acceptanceOutcome`, `acceptanceSummary`.
- `scope.ts` — `governingScope(project, orderForms)`: the accepted, non-superseded Order Form for the project (deliverables and acceptance criteria from `order_forms.scope`), else the accepted proposal snapshot, else null.
- `fixtures.ts` — fictional Northline / Harbour / Orbit acceptances and checklists on `f1c7…` UUIDs; the £600 handover fee as a fixture with tax basis "pending decision" and marked "draft / sandbox — not an approved price list".
- `load.ts` (server only) — `loadProjectFacts(db)` reads what the portal already reads (tenant, projects, order forms, invoices, subscriptions) to derive facts; `loadPortalDelivery()` adds the 0060 rows when the flag is on and works out `isSignatory` (the caller's own `client_admin` membership, via the service client, never staff-wide RLS). Route: a chosen care plan → `managed`; anything else → `unresolved` (independent is never inferred from `care_plan_choice = 'none'`; it needs a service arrangement).

### Plan gate (`apps/web/lib/planGate.ts`)

`planChoiceOpenV2({ stage, governingScopeVersionRef, acceptances, legacy?, allowPartial? })`:

- flag off → `planChoiceOpen(stage)` exactly;
- flag on → `false` unless a non-disputed acceptance exists for `governingScopeVersionRef`; a partial acceptance opens the chooser only with `allowPartial: true` (default off: an incomplete system should not start a Managed schedule); `legacy: true` defers to the stage rule for tenants already on the old model (the per-tenant bypass from Phase 0 §7, pending `tenants.legacy_model`).
- `planChoiceClosedReasonV2` gives the matching copy (disputed / exceptions / not yet accepted).
- No existing caller was changed: `plan/actions.ts`, `plan/page.tsx`, `care-plan/page.tsx`, `direct-debits/*` and `hub/rules.ts` still call `planChoiceOpen`. Wiring them to V2 is a follow-up (not owned).

### Portal routes

- `/portal/checklist` — headline ("Let's get your project ready" / "From review to launch"), meaningful completion count (required items only), the one next step (client-owned first), "Getting started" and "After the build" sections. Each item: label, state chip, why, owner ("You" / "Nullshift"), requirement source, due, completed, evidence, and the waiver wording. With the flag on and tasks published, client-owned open items carry a note field and "Mark in progress" / "Mark complete" / "Reopen" buttons posting to `updateChecklistTaskForm`. With the flag off: derived, read-only, with a notice saying so. Staff preview: read-only notice.
- `/portal/acceptance` — agreed scope (label + deliverable/criterion pairs); acceptance record (flag on); the review form for the signatory: per deliverable "meets the criterion / does not yet", evidence, comment; outstanding defects one per line; "I dispute this build" checkbox; name; notes; the authorisation checkbox whose wording states it does not select a package, mark an invoice paid or sign an agreement. After a clean acceptance the form is replaced by the acceptance notice. No package is offered anywhere on the page.
- Both: `loading.tsx` skeleton (no spinner), `error.tsx` (`unstable_retry`, digest shown, states nothing was recorded), empty states for "no project" and "no accepted scope". Styling in `apps/web/lib/delivery/portal.module.css` — Halo `--ns-*` tokens on `.root`, square corners, no animation library, mobile-first (max-width 680, 16px gutters).
- Preview sessions (`ns_client_preview`) never mutate: the loader gives them the tenant-scoped read-only client, the pages hide the forms, and every action re-checks `isClientPreview()` before doing anything.

## Files

Created (all within the owned list):

- `supabase/migrations/0060_build_acceptance_checklists.sql`
- `apps/web/lib/delivery/types.ts`, `checklists.ts`, `acceptance.ts`, `scope.ts`, `fixtures.ts`, `load.ts`, `actions.ts`, `index.ts`, `portal.module.css`
- `apps/web/app/portal/(dashboard)/checklist/{page,loading,error}.tsx`
- `apps/web/app/portal/(dashboard)/acceptance/{page,loading,error}.tsx`
- `apps/web/tests/acceptance-gate.test.ts`, `apps/web/tests/checklists.test.ts`
- `docs/admin-redesign/phase3-acceptance.md` — this document.

Modified: `apps/web/lib/planGate.ts` (additive: imports at the top, `planChoiceOpenV2`, `planChoiceClosedReasonV2`, `PlanChoiceInputV2`; existing exports unchanged).

Read, not edited: `apps/web/lib/flags.ts`, `apps/web/lib/clientPreview.ts`, `apps/web/lib/carePlans.ts`, `apps/web/lib/next/fixtures.ts` (names via `clientById`), `apps/web/lib/next/fixtures-portal.ts`, `packages/auth/src/guards.ts`, `packages/db/src/audit.ts`, portal layout / plan page / plan actions / dpa-actions, migrations 0001, 0025, 0030, 0040, 0053, 0057, 0058, `next.module.css`, Next 16 docs for `error.js`, `loading.js` and server functions.

## Flags

- `acceptanceGate` (from `apps/web/lib/flags.ts`, unchanged). Off (default): `planChoiceOpenV2` = `planChoiceOpen`; the portal pages read nothing from migration 0060 and render read-only derived lists; every action returns `{ ok: false, reason: "flag_off" }` without a database call. On: 0060 rows are read; the signatory can accept; clients can move their own tasks; staff can publish checklists; the gate reads acceptance evidence.
- No other flag is read. With the flag off no existing route, action, column or trigger behaves differently.

## Tests

- `tests/checklists.test.ts` (18 tests): five initial steps in order with why/owner/source; facts are read, never inferred (blocked until prerequisites exist); a waived deposit gate is waived — not paid, not done, not counted; a waiver never overrides a real completion; next step is the first open client-owned item; managed branch keys and never the handover branch; independent branch keys and never the managed branch, with the £600 tax-basis wording; unresolved route = acceptance + route item, acceptance not blocked; package blocked until acceptance and Direct Debit blocked until schedule (§17.1 row 2); a mandate alone never activates (row 3); partial and disputed acceptance states; all eleven §8.5 keys with sources; revocation and completion start blocked; handover cannot complete with open tasks, a waived fee item does not count, the fee disposition needs evidence (row 12); application-fee wording either way; client transitions mirror the SQL function (allowed states, forbidden waiver/not-applicable/blocked/awaiting_client, Nullshift-owned and locked tasks refused, evidence required to complete, evidence appended, `completed_at` set/cleared).
- `tests/acceptance-gate.test.ts` (15 tests): flag off = legacy rule regardless of evidence; flag on ignores `live`/`complete` without acceptance; opens on a clean acceptance at stage `build`; wrong or missing scope version does not count; disputed never opens; partial closed by default, open with `allowPartial`, clean beside partial governs; legacy bypass; `planChoiceOpen` unchanged; `governingAcceptance` ordering; a clean acceptance carries per-deliverable evidence and no plan/paid/signature/subscription/mandate keys; unmet deliverable or listed defect → accepted with exceptions; dispute recorded whatever the deliverables say; second clean acceptance refused while partial/disputed/new-version are recorded; clean after partial governs; staff recording needs a reason and carries `recorded_by`, portal path needs the user, cross-checks on role/method; fixtures.
- Existing `tests/plan-gate.test.ts` untouched and passing.

Checks run: `pnpm -C apps/web typecheck` clean · `pnpm -C apps/web exec eslint lib/delivery lib/planGate.ts "app/portal/(dashboard)/checklist" "app/portal/(dashboard)/acceptance" tests/acceptance-gate.test.ts tests/checklists.test.ts` clean (0 errors, 0 warnings) · `pnpm -C apps/web test` 52 files, 682 tests passed · prettier applied to the owned files.

## Gaps and follow-ups

- **Portal navigation.** `apps/web/app/portal/(dashboard)/PortalHeader.tsx` (not owned) has no entries for `/portal/checklist` or `/portal/acceptance`; the pages are reachable by URL and cross-link each other. Add "Checklist" to `NAV` when the flag is enabled for a pilot tenant.
- **Existing gate callers still read the stage.** `plan/actions.ts`, `plan/page.tsx`, `clients/[id]/care-plan/page.tsx`, `billing/direct-debits/*` and `lib/hub/rules.ts` call `planChoiceOpen`. They should call `planChoiceOpenV2` with `{ stage, governingScopeVersionRef: governingScope(...)?.ref, acceptances }` (reading `build_acceptances` under the flag) so the Direct Debit start and the "send plan options" email are gated on evidence too. Not owned by this task.
- **Signatory role.** Only `client_admin` is ever minted (Phase 0 §3, N4), so `isSignatory` = tenant-admin membership. When the §5.10 signatory / project / billing roles land, both the `build_acceptances_client_insert` policy and `clientSignatory()` in `actions.ts` should switch to the signatory flag.
- **Independent route detection.** `routeFromChoice` maps a chosen care plan to `managed` and everything else to `unresolved`; the independent branch renders only once a service arrangement (`0059_service_arrangements.sql`, sibling task) records the election and a loader passes `route: "independent"`. `checklist_tasks.arrangement_id` / `handover_tasks.arrangement_id` have no FK until both migrations are in the ledger.
- **Staff surfaces.** No admin page renders acceptances, publishes checklists or records a staff acceptance yet; `recordBuildAcceptance({ acceptedRole: "staff", … })` and `publishChecklist` are ready for the Delivery project page (`/admin/next/delivery`, not owned).
- **`packages/db/src/types.ts` not regenerated** (not owned; migration not applied). The cookie client is untyped so the new tables typecheck; regenerate after apply.
- **Assets / kickoff evidence.** Today no record exists for "assets provided" or "kickoff confirmed"; the derived (flag-off) list uses the stage having moved past onboarding and says so in code. Once published, the persisted rows carry real evidence.
- **Warranty duration** (decision 18.6) is not modelled here; acceptance records the start event only.

## Approvals needed

- Applying migration 0060 (after ledger reconciliation, Phase 0 N-h) and enabling `acceptanceGate` for a pilot tenant (decision 18.12).
- Decision 18.6 (partial acceptance / disputes) — whether a partial acceptance may open the Managed chooser (`allowPartial`), currently off.
- Decision 18.3 — the £600 handover fee's tax basis, shown as "pending decision".
- Decision 18.4 — application-fee disposition after handover; the checklist item forces an explicit answer but does not decide it.

## How to try it

1. Without any flag: sign in as a client (or open a staff preview) and visit `/portal/checklist` and `/portal/acceptance`. The checklist is derived from existing records and read-only; the acceptance page shows the agreed scope and states that recording is not enabled. Nothing is written.
2. With `OPS_V2_FLAGS=acceptanceGate` on a preview deployment **and** 0060 applied to a branch database: as staff call `publishChecklist({ tenantId, projectId, journey: "initial" })` (and `"later"`), then as the client's tenant admin visit `/portal/checklist` to move your own items, and `/portal/acceptance` to record a clean, partial or disputed acceptance. Check `audit_log` for `build.accepted` / `build.accepted_with_exceptions` / `build.disputed`, `checklist_task.client_updated` and `checklist.published`, and confirm `tenants.care_plan_choice`, `subscriptions` and `invoices` are unchanged.
3. Unit tests: `pnpm -C apps/web test -- acceptance-gate checklists`.
