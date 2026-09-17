# Admin redesign — Phase 1, task p1-ops (Sales, Delivery, Automations, Settings)

Date: 17 September 2026 · Branch: `feat/admin-redesign` · Brief sections: §5.2, §5.5, §5.8, §5.9, §6.5, §7, §8.5, §11 · Phase 0 report: `docs/ADMIN-REDESIGN-PHASE0-2026-09-17.md`

## What was built

Four prototype areas under the existing `/admin/next` dark shell. Every page is a server component that renders from fixtures only: no database reads, no provider calls, no writes, no server actions. Nothing is added to `AdminNav`; the routes are reachable by URL (and from the prototype rail, which already listed them) for staff who pass the existing `(dashboard)` login → MFA → `requireStaff()` chain.

### Sales & Quotes — `/admin/next/sales`

Tabs via `?tab=`: `pipeline` (default) · `quotes` · `discovery` · `catalogue`.

- **Pipeline** — list and board views (`?view=list|board`). Stages exactly as §5.2: New enquiry → Qualified → Discovery → Scope ready → Quote in review → Sent → Negotiation → Won / Lost. Cards show company, opportunity, owner (a visible "Unassigned"), next action and date, estimate confidence and proposal value. Weighted pipeline shows **"Not configured"** because no fixture carries an explicit probability; the unweighted sum is labelled "not contracted revenue".
- **Opportunity detail (drawer-as-page)** — `/admin/next/sales/opportunities/[id]`: problem/outcome, stakeholders, current process, timeline, budget signal, systems/integrations, data sensitivity, discovery notes, linked quote versions, activity and decision rationale. A **Convert to client/project** panel lists duplicate matches (legal entity / contact / domain) with evidence and a recommendation; the button is disabled with a title explaining it would reuse the matched record and never create a second billing identity for an existing client.
- **Quotes** — one row per quote version with the §5.2 states (Draft → Internal review → Approved to issue → Issued → Accepted / Declined / Expired / Superseded / Withdrawn), an "Editable: in place / new version only" column, and links to the two Quote Studio fixtures `/admin/next/quotes/q-northline-v2` and `/admin/next/quotes/q-atlas-v1`. `q-northline-v1` shows as Superseded by v2.
- **Discovery** — paid discovery engagements with checklist, owner, due date and a price line that states the draft-catalogue range and "not an approved price".
- **Pricing catalogue** — the §6.5 table rendered verbatim as 23 items, each stamped **sandbox** and chipped **draft · not chargeable**, under a marker "Not an approved price list — draft, non-chargeable suggestions for review". The **£600 independent handover fee** sits in its own card as a **confirmed commercial decision** with tax basis **pending decision** and the three blockers on issuance (tax basis, payment timing, scope). It is deliberately not a row in the catalogue table (tested).

### Delivery — `/admin/next/delivery`

Tabs: `projects` (default) · `queue` · `releases` · `handover` · `capacity`.

- **Projects** — table with agreed scope version, milestone progress, build-start gate result, blockers and delivery lead. Detail at `/admin/next/delivery/projects/[id]`: Northline (`proj-northline`) shows agreed scope version (links to the quote), milestones with their commercial link, dependencies, deliverables with per-criterion acceptance evidence (pending / evidenced / accepted / disputed), blockers, owners and commercial gates. Westbridge (`proj-westbridge`) demonstrates the **audited deposit waiver**: the gate reads "satisfied · waiver" while the deposit invoice state stays "issued" (the waiver never marks it paid — `buildStartGate()` returns the invoice state untouched, tested).
- **Work queue** — requests classified with the seven §7 classes (`DEFECT`, `SUPPORT`, `MAINTENANCE`, `CHANGE / FEATURE`, `CONTENT / TRAINING`, `DATA / INTEGRATION / EXPANSION`, `TRANSACTION`) and the four exact coverage strings: "Included — Managed Platform", "Included — build warranty", "Chargeable Grow request — quote required", "Coverage needs review". Each row shows what the client called it, the governing agreement, and (for Grow items) whether execution is allowed via `growExecutionAllowed()`. The Cedar mixed request `wq-cedar-07` is split into linked `wq-cedar-07a` (DEFECT, warranty restoration) and `wq-cedar-07b` (CHANGE / FEATURE, Grow quote required). **Incidents** are a separate panel, with a note that covered incident response proceeds regardless of a pending Grow quote.
- **Releases** — planned / staged / released / rolled back, each linked to a scope item, approved change or work item, with explicit acceptance state including **partial** (Westbridge) and "awaiting client".
- **Handover** — Orbit's checklist as the eleven §8.5 items with owner, state and evidence; £600 fee card (confirmed decision, tax basis pending); access revocation blocked until items 1–9; the §8.5 closing rules quoted.
- **Capacity** — explicit assumptions table (stated availability, focus factor, "figures are commitments, not actuals"); per-week low/base/high hours against assumed availability; no fabricated precision.

### Automations — `/admin/next/automations`

- Sixteen catalogue cards from the §11 table: trigger, conditions, action, owner, approval requirement, mode (Draft / Sandbox / Enabled / Paused), last run and failure state; **outbound** and **high impact** stamps.
- Tabs: `workflows` · `approvals` · `runs` · `exceptions`.
- **Dry-run preview panel** (`?preview=<id>`): `dryRun()` lists the steps the automation _would_ take with the guard evaluated; every step's effect is "none (dry run)" (tested); the Enable button is disabled pending review.
- **Global "Pause new outbound operations"** control at the top of the page. Copy states the scope, that **already-scheduled provider collections are unaffected and need separate handling with the provider** ("a local pause is not a promise that provider payments have stopped"), and that inbound event capture and audit evidence continue. The button is disabled: there is no pause register or server action in this slice.

### Settings — `/admin/next/settings`

Eleven §5.9 sections (`?section=`): Company and legal details; Staff roles; Commercial catalogue; Estimator assumptions; Document templates; Approval policies; Integrations; Notification templates; Data retention; Audit and export; Advanced legacy tools. Each shows a **Read** permission and a separate **Change** permission, the version in force with effective date and published/draft state, fields with a kind (`value` / `versioned` / `secret reference`), and any pending change with effective date and impact preview. A banner states secrets never appear in forms, bundles, logs or exports; integration fields show names/status only. Extra views: **Version history** and **Feature flags** (read-only list of `OPS_V2_FLAG_KEYS` with on/off from `activeFlags()`).

## Files

Created (all owned by this task):

- `apps/web/lib/next/fixtures-ops.ts` — fixtures and pure helpers (`weightedPipeline`, `nextQuoteStates`, `editableInPlace`, `buildStartGate`, `assessCoverage`, `growExecutionAllowed`, `capacityWeek`, `dryRun`, `formatMoney`). Money as `{ amountMinor, currency: "GBP" }`.
- `apps/web/app/admin/(dashboard)/next/ops.module.css` — Halo-token styles for the four areas (board, drawer, gates, work-queue split, capacity, automation cards, pause box, dry-run, settings layout, empty and skeleton states). Square corners; no animation.
- `apps/web/app/admin/(dashboard)/next/sales/{page,loading,error}.tsx`, `sales/ops-ui.tsx` (shared server-safe pieces: `SubTabs`, `Empty`, `Notice`, `Skeleton`, `stateTone`, `first`), `sales/opportunities/[id]/{page,loading}.tsx`
- `apps/web/app/admin/(dashboard)/next/delivery/{page,loading,error}.tsx`, `delivery/projects/[id]/{page,loading}.tsx`
- `apps/web/app/admin/(dashboard)/next/automations/{page,loading,error}.tsx`
- `apps/web/app/admin/(dashboard)/next/settings/{page,loading,error}.tsx`
- `apps/web/tests/next-ops-fixtures.test.ts` — outside the strict owned list but a new, uniquely named file (no conflict risk); drop it if unwanted.
- `docs/admin-redesign/phase1-ops.md` — this document.

Modified: none. `apps/web/lib/next/fixtures.ts` is imported (`QUOTES`, `clientById`) and never edited.

## Flags

No database-backed path exists in this slice, so nothing changes behaviour with a flag on. Flags are read only to label the data source honestly:

- `commercialV2` — Sales header note.
- `acceptanceGate` — Delivery projects note (production still reads stage labels).
- `workIntake` — Work queue classification-source note.
- `integrationWorkers` — Automations header and the pause control's disabled reason.
- Settings → Feature flags lists all keys with their state via `activeFlags()`.

With every flag off (the default) the prototype renders fixtures; with a flag on it renders the same fixtures and says the live read "is not wired in this slice".

## Tests

`apps/web/tests/next-ops-fixtures.test.ts` (17 tests): stage order and no real client names; weighted pipeline not configured / configured only with explicit probabilities; quote state transitions and no in-place edits after issue; only the two Quote Studio fixtures link; all 23 catalogue items draft and non-chargeable with the £600 fee kept separate; build-start gate by deposit or waiver with invoice state untouched; seven classes and exact coverage wording; coverage assessment by agreement not label; mixed request split into linked items; Grow execution gate; eleven §8.5 items; sixteen §11 workflows; dry runs have no outbound effect; high-impact activation not enabled; settings read/change separation and no secret-shaped values.

Checks run: `pnpm -C apps/web typecheck` clean · `pnpm -C apps/web exec eslint <owned files>` clean · `pnpm -C apps/web test` 46 files, 555 tests passed.

## Gaps and follow-ups

- No writes anywhere: convert-to-client, waiver recording, request split, automation enable/pause, settings "Propose change" are disabled buttons with explanatory titles. Each needs a server action behind `requireStaff()` with a `logAudit` row and, for the pause, a persistent pause register the worker honours.
- No migrations were written by this task (none assigned). The fixture types (`Opportunity`, `QuoteVersionRow`, `Project`/`CommercialGate`, `WorkItem`, `Automation`, `SettingsSection`) are the contract a later migration would implement.
- Capability model: Settings shows Owner / Staff / Finance as a **proposal**; production is binary staff (Phase 0 §3, decision 18.11).
- Work-classification vocabulary (Phase 0 decision N-b) is still open; this slice uses the §7 UPPERCASE names in fixtures only.
- The Rail already links `/admin/next/finance`, `/admin/next/agreements` and `/admin/next/portal`; those belong to other tasks.
- Shared UI pieces live in `sales/ops-ui.tsx` because the task owns only the four route directories; a later tidy-up could move them to `components/next/` (not owned here).
- `apps/web/app/admin/(dashboard)/next/sales/error.tsx` and siblings use `unstable_retry` per the Next 16 `error.js` reference in `node_modules/next/dist/docs`.

## Approvals needed (unchanged from the decision register)

- 18.1 / 18.2 catalogue prices and estimator constants before anything in the Pricing catalogue tab can leave sandbox.
- 18.3 £600 handover fee tax basis, due date and scope before issuance.
- 18.11 staff capabilities (who may change pricing, tax mapping, provider accounts, templates; who approves activation and retries).
- Policy for the global outbound pause and for enabling any §11 workflow beyond Sandbox.

## How to try it

1. `pnpm -C apps/web dev`, sign in as staff, then open:
   - `/admin/next/sales?tab=pipeline&view=board` → click a card → `/admin/next/sales/opportunities/opp-northline` (see the duplicate-match review) or `opp-kestrel` (Unassigned owner, domain match needs review).
   - `/admin/next/sales?tab=quotes` → open `q-northline-v2` / `q-atlas-v1` in Quote Studio.
   - `/admin/next/sales?tab=catalogue` → sandbox catalogue and the separate £600 decision card.
   - `/admin/next/delivery?tab=projects` → `proj-northline` (gates, acceptance evidence) and `proj-westbridge` (waiver, invoice still issued).
   - `/admin/next/delivery?tab=queue` → the Cedar split, coverage wording, incidents panel.
   - `/admin/next/delivery?tab=handover` and `?tab=capacity`.
   - `/admin/next/automations` → "Dry run" on any card, e.g. `?tab=workflows&preview=auto-activation`; tabs `approvals`, `runs`, `exceptions`.
   - `/admin/next/settings?section=integrations` (secret references), `?section=history`, `?section=flags`.
2. Set `OPS_V2_FLAGS=workIntake,integrationWorkers` locally to see the source labels change; the rendered data does not.
3. Unknown ids (`/admin/next/sales/opportunities/nope`) return the shell's 404; `loading.tsx` skeletons render during navigation; `error.tsx` offers "Try again" and states nothing was written.
