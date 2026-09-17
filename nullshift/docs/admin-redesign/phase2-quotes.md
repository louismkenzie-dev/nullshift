# Phase 2 — Opportunities and quote versions (task p2-quotes)

Date: 2026-09-17. Branch `feat/admin-redesign`. Brief §5.2 (quote states), §5.3 (Quote Studio controls and concurrency), §12.1 (Opportunity, Quote assessment, Quote/document version, Acceptance), §12.2 (orthogonal states), §12.5 (permissions, separation of duties). Phase 0 report §3, §7, §8, §9, §11.

Everything here is **off by default**. With `OPS_V2_FLAGS` not containing `commercialV2`, the new route renders fixtures, `loadQuoteForStudio()` returns `null` exactly as the previous stub did, and every server action returns `{ ok: false, reason: "flag_off" }` without touching the database. No existing table, row, trigger or flow is changed; the three legacy clients are untouched.

## What was built

### Migration `supabase/migrations/0057_opportunities_quotes.sql` — NOT APPLIED

Additive only. Four new tables, all RLS-enabled with staff-only policies (`is_internal_staff()`); no client policies yet.

| Table             | Purpose                                                                                   | Notes                                                                                                                                                                                                                                      |
| ----------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `opportunities`   | Prospect or existing client's next project; pipeline stage separate from delivery/billing | `tenant_id` nullable (prospects); stage CHECK `new_enquiry … won/lost`; `probability_pct` nullable so weighted pipeline only appears when explicitly set                                                                                   |
| `quotes`          | One commercial thread per opportunity + project label                                     | `current_version_id` FK (set on issue); `tenant_id` copied from the opportunity server-side                                                                                                                                                |
| `quote_versions`  | The document version                                                                      | status CHECK for the nine §5.2 states; `currency` column (money in the jsonb payloads is integer minor units); `unique (quote_id, version_no)`; CHECKs tying `issued`/`accepted`/`superseded` to `issued_at`/`accepted_at`/`superseded_by` |
| `quote_approvals` | Append-only approval evidence                                                             | `decision` approve/reject, `below_floor`, `reason`; CHECK that a below-floor approval carries a reason; select + insert policies only (no update/delete for anyone but service role)                                                       |

Triggers:

- `set_updated_at` on opportunities, quotes, quote_versions.
- `quote_versions_guard_frozen_content()` — BEFORE UPDATE: raises when `OLD.status` is not `draft`/`internal_review` and any of `brief`/`scope`/`estimate`/`commercial`/`internal` changes; also refuses changes to `quote_id`/`version_no`. Issued content is immutable; an edit is a new version.
- `quote_approvals_guard_separation()` — BEFORE INSERT: raises when `approver = quote_versions.author`, so a direct PostgREST call cannot bypass the server action's check.

Enumerations are `text + CHECK` (the repo's convention since 0030) rather than Postgres enums, so later states can be added additively. Header carries purpose, dependencies (0001 only), the NOT APPLIED status, and rollback DDL.

### Data layer `apps/web/lib/commercial/`

| File              | Contents                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `types.ts`        | Hand-written row types (`OpportunityRow`, `QuoteRow`, `QuoteVersionRow`, `QuoteApprovalRow`), the five jsonb payload shapes (`QuoteBrief`, `QuoteScope`, `QuoteEstimate`, `QuoteCommercial`, `QuoteInternal`), `ActionResult`/`ActionFailure`                                                                                                                                                                                                                                                                                                                        |
| `stateMachine.ts` | Pure rules: `canTransition`, `allowedTransitions`, `isContentEditable`, `canCreateNextVersion`, `supersededOnIssue`, `isTerminal`, `isStale` (instant comparison for optimistic concurrency), `floorMinor` (cost ÷ (1 − min margin), rounded up, no cap), `isBelowFloor`, `checkApproval` (approver ≠ author, below-floor needs reason, only from internal review), `checkIssue` (stale → invalid transition → approval missing), `expiryFor` (explicit expiry, 30-day default), `STATUS_LABEL`                                                                      |
| `studio.ts`       | `toStudioQuote()` maps a version + quote + opportunity to the fixture `Quote` shape (minor → pounds, steps derived from payload completeness). Post-issue states render as `"Issued"` with the true state in `savedAt` because the Studio type's union stops at Issued                                                                                                                                                                                                                                                                                               |
| `fixtures.ts`     | The listing's own fixtures (Northline v2 in review, Northline v1 superseded, Atlas v1 draft), shaped like 0057 rows; ids/names borrowed from `lib/next/fixtures.ts`, never edited                                                                                                                                                                                                                                                                                                                                                                                    |
| `repo.ts`         | RLS-client reads/writes: `getVersion`, `getVersionContext` (embedded quote + opportunity with explicit FK hints because quotes ⇄ quote_versions has two FKs), `listQuoteVersions`, `latestVersionForQuote`, `insertOpportunity/Quote/Version/Approval`, `guardedUpdateVersion` (filters on `updated_at` and allowed statuses inside the UPDATE so a concurrent save cannot slip between read and write; a follow-up read explains stale / not found / not editable), `hasApproveDecision`, `supersedePriorVersions`, `setQuoteCurrentVersion`, `setOpportunityStage` |
| `quotes.ts`       | `loadQuoteForStudio(id)` — same exported name and signature as the stub; flag off or non-uuid → `null`; accepts a version id (that version) or a quote id (its current version, else latest). `loadQuoteVersionListing()` — fixtures off, database on                                                                                                                                                                                                                                                                                                                |

### Server actions `apps/web/app/admin/(dashboard)/next/quotes/actions.ts`

Every action: `flagOn("commercialV2")` → `requireStaff()` → refuse under the `ns_client_preview` cookie → cookie (RLS) client → `logAudit` row. Client-supplied ids are only used after the row and its relations load; `tenant_id` is never taken from the caller (`createOpportunity` verifies a supplied tenant exists; `createQuoteDraft` copies it from the opportunity).

| Action              | Rules                                                                                                                                                                                                                                                                                        | Audit action                                                               |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `createOpportunity` | legal name required, stage in enum, probability 0–100                                                                                                                                                                                                                                        | `opportunity.created`                                                      |
| `createQuoteDraft`  | opportunity must exist; inserts quote + v1 draft (author = caller, draft policy/formula versions)                                                                                                                                                                                            | `quote.draft_created`                                                      |
| `saveDraft`         | `expected_updated_at` must match → else `{ ok: false, reason: "stale" }`; only from draft/internal review → else `not_editable`                                                                                                                                                              | `quote_version.saved`                                                      |
| `requestApproval`   | draft → internal_review (stale-checked); moves a pre-quote opportunity stage to `quote_in_review`                                                                                                                                                                                            | `quote_version.approval_requested`                                         |
| `approveToIssue`    | approver ≠ author (server and trigger); below floor requires reason; internal_review → approved_to_issue, then an `approve` evidence row; if the evidence insert fails the status is put back                                                                                                | `quote_version.approved_to_issue`                                          |
| `returnToDraft`     | internal_review/approved_to_issue → draft; a second person's rejection is recorded as evidence                                                                                                                                                                                               | `quote_version.returned_to_draft`                                          |
| `issue`             | stale-checked; requires approved_to_issue and an approve row; stamps `issued_at`, explicit `expires_at` (caller or +30 days); supersedes prior issued/accepted versions of the quote (`superseded_by` set); sets `quotes.current_version_id`; opportunity → `sent` unless negotiating/closed | `quote_version.issued` + one `quote_version.superseded` per superseded row |
| `createNextVersion` | only from issued/accepted; copies content into draft `version_no + 1` authored by the caller; parent untouched until the new one is issued                                                                                                                                                   | `quote_version.next_created`                                               |

Form adapters (`createDraftFromForm`, `requestApprovalFromForm`, `approveFromForm`, `returnToDraftFromForm`, `issueFromForm`, `nextVersionFromForm`) wrap those for the server-rendered page and report through `?notice=` so the listing needs no client component.

### Route `/admin/next/quotes`

`page.tsx` (server component) lists quote versions — client/project, version (with "current" and "superseded by" markers), status chip plus "content frozen" and "below floor" markers, build price with policy version, expiry, updated time, and per-state actions when the flag is on (Request approval / Approve with reason / Return to draft / Issue with optional expiry / New version). Flag off: fixtures with Studio links where a fixture Studio page exists. Real empty state ("No quote versions yet") distinct from the `error.tsx` failed-load state; `loading.tsx` skeleton. Halo tokens via the existing `next.module.css` / `ops.module.css` classes; no new CSS.

## Tests — `apps/web/tests/commercial-quotes.test.ts` (29)

Allowed transitions and forbidden shortcuts; terminal states; editable pair matches the trigger; supersession (only issued/accepted supersede, next version only from issued/accepted, accepted only → superseded); stale-tab rejection incl. "a stale tab cannot issue a superseded version" and the up-to-date-but-unapproved case; approver ≠ author (incl. authorless refused); below-floor reason; floor arithmetic with no cap; expiry default and past-date guard; Studio mapping (minor → pounds, read-only note, step derivation, safe defaults); fixture hygiene (`@example.test`, superseded chain).

Results: `pnpm typecheck` clean; `eslint` clean on all owned files; `pnpm test` 47 files / 584 tests passing (including the 29 new ones).

## Flags

- `commercialV2` — the only flag used. Off: fixtures, `loadQuoteForStudio` → `null`, actions no-op. On: 0057 tables through the staff RLS client.

## How to try it

1. Flag off (default): open `/admin/next/quotes` as staff — three fixture rows, Northline links to the existing Studio fixture, actions column shows "fixture".
2. Flag on, on a branch database only: apply `0057` (after reconciling the ledger per Phase 0 N-h), set `OPS_V2_FLAGS=commercialV2`, open `/admin/next/quotes`, create a draft with the form, request approval, then approve **as a different staff user** (the same user gets `approver_is_author`), issue, then "New version" and issue that — the first version flips to Superseded and the quote's current pointer moves.
3. Concurrency: open the page in two tabs, act in one, act in the other → "This tab was out of date".

## Gaps / not done here

- `apps/web/app/admin/(dashboard)/next/quotes/[id]/page.tsx` (not owned) still reads `quoteById()` fixtures only; it should call `loadQuoteForStudio(id)` first and fall back to fixtures, otherwise database rows have no Studio page (the listing deliberately does not link them).
- `Quote["status"]` in `lib/next/fixtures.ts` (not owned) stops at `"Issued"`; the mapping renders Accepted/Declined/Expired/Superseded/Withdrawn as Issued + read-only note until that union is widened.
- Acceptance evidence (§12.1 Acceptance row: authorised actor, method, time, evidence reference) and client-visible policies are not in 0057; `accepted`/`declined`/`expired`/`withdrawn` have no writer yet. Expiry is stored, not enforced by a job.
- Staff capabilities are still binary (Phase 0 N3 / 18.11): "approver ≠ author" is the only separation of duties; an owner-only approval role needs the capability model.
- Diff view between versions (§5.3), autosave from the Studio, and the reject path from Approved to issue back to review are not built.
- Money inside the jsonb payloads is minor units by convention and TypeScript type, not by database CHECK.
- `pricing`: `policy-draft-2026-09` / `formula-draft-1` are placeholders; no approved rates, margins or thresholds exist (Phase 0 18.1/18.2).

## Approvals needed

- Apply 0057 to a branch database, then production, after reconciling the migration ledger (Phase 0 N-h). Not done.
- Confirm the cost-derived floor formula and the 30-day default validity as the interim policy.
- Decide who may approve to issue once capabilities exist (18.11); until then any second staff member can.
