# Phase 1 — client portal prototype (`/admin/next/portal`)

Task `p1-portal`, 17 September 2026. Brief §5.10, §4.5, §8.2–8.6, §13; Phase 0 report §3, §7–§11.

## What it is

A mobile-first client-portal prototype rendered **inside the admin shell** as a phone-width
frame (max-width 420 px, centred; `?wide=1` renders at up to 920 px). Staff can review the
client experience without touching the real `/portal` routes, real tenants, cookies, the
database or any provider. Every screen reads from one fixtures module and performs no writes.

It sits under the existing `(dashboard)` gate, so login, MFA step-up and `requireStaff()` are
inherited unchanged. No link was added to the legacy `AdminNav`; the redesign rail already
carries "Client portal preview".

## Screens

| Route                                 | Screen                                                                                                                                                                                                                                                                                                           | Brief             |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| `/admin/next/portal`                  | Dashboard: "Let's get your project ready" (headline varies by fixture), meaningful completion count (required items only; waived/not-applicable excluded; a waiver is never completion evidence), **one** next step for the viewer's role, upcoming dates each with its _meaning_, clear route to a named person | §5.10, §8.6       |
| `/admin/next/portal/checklist`        | Initial checklist: Company/billing details → Agreement → Initial payment → Assets/access → Kickoff readiness                                                                                                                                                                                                     | §5.10             |
| `/admin/next/portal/checklist/[step]` | One step: **why** it is required, **who** owns it (personalised to "You" when the viewer owns it), requirement source, due/evidence, what happens, role notice, hosted-flow notice, save-and-return form, sticky primary action                                                                                  | §5.10, §8.6, §4.5 |
| `/admin/next/portal/next-steps`       | Later checklist: Build review/acceptance → Managed package + service-schedule acceptance **or** independent handover → activation / transfer completion. Branch comes from the fixture's route; the client never sees both                                                                                       | §8.2–8.5          |
| `/admin/next/portal/billing`          | Invoices (mirrored from accounting, "paid" means accounting confirmed it) and payment setup: package, contractual start vs provider collection date, mandate state, Direct Debit hosted-flow statement, £600 handover fee                                                                                        | §5.10, §8.3       |
| `/admin/next/portal/help`             | Named owner, email, hours, what the viewer's role can and cannot do, "what each step means"                                                                                                                                                                                                                      | §5.10             |

Each segment has `loading.tsx` (phone-shaped skeleton, no spinner, status announcement) and the
group has `error.tsx` ("failed to load" is distinct from "no data"; retry; digest shown, message
never shown). Empty states are real sentences, not blank cards.

## Preview switches (URL only, no cookies or session)

- `?client=northline|harbour|orbit|cedar|brightwell` (default `northline`)
  - **Northline** — managed, package pending; build acceptance is available to the signatory
    without choosing a package; Direct Debit blocked until a schedule exists.
  - **Harbour** — schedule accepted (Pro fixture, £245/month sandbox), contractual start
    1 Oct 2026, mandate authorised, **provider collection date "Not yet scheduled"** — shown as
    two different things with their meanings, on the dashboard, next-steps and billing screens.
  - **Orbit** — independent £600 route: fee invoiced once, tax basis "pending decision", no
    subscription, transfer checklist per §8.5, access revoked only after gates.
  - **Cedar** — date approaching (22 Sep) without an accepted package: the client sees an
    **owned exception** with three options; no default plan, no indicative charge, no
    backdating, date preserved, no forced route change, no shutdown (§8.4).
  - **Brightwell** (extra, onboarding phase) — the only fixture with an incomplete initial
    checklist, so the save-and-return draft ("Saved yesterday, 4 of 7 fields") and the blocked
    agreement are demonstrable.
- `?role=signatory|project|billing` (default `signatory`)
  - Signatory: can accept agreement, build, package/schedule.
  - Project contact: assets/access, kickoff, walkthrough; contract items read-only; billing
    tab shows an explanatory empty state.
  - Billing admin: invoices and payment setup; contract items show "you can see this but
    **cannot vary the contract** — accepting it needs your signatory (name)".
- `?wide=1` full-width frame (two-column content grid ≥900 px).

Links inside the frame preserve all three switches (`portalHref`).

## Direct Debit wording

The Direct Debit step and the billing screen state that account number and sort code are
entered on the provider's secure page, never in a Nullshift form; Nullshift does not see or
store them; a mandate authorises collection under the accepted schedule and does not start it;
notice precedes any collection; the provider date can be later than the contractual start and
the start does not move (§8.3). The initial-payment step carries the equivalent card/bank
hosted-page statement.

## Files

- `apps/web/lib/next/fixtures-portal.ts` — types, five fictional clients, money formatter
  (integer minor units + currency), pure derivations `completion`, `nextStep`, `canAct`,
  `canVaryContract`, `activeItems`, `portalItemById`. Imports only names/refs from
  `lib/next/fixtures.ts` (not edited).
- `apps/web/app/admin/(dashboard)/next/portal/portal.module.css` — frame, bar, nav, cards,
  chips, buttons, sticky action, form fields, notices, skeleton. Halo tokens via the shell's
  `--ns-*` variables only; square corners; no animation.
- `.../portal/_lib/context.ts` — `resolveCtx(searchParams)`, `portalHref`.
- `.../portal/_ui/Frame.tsx` — staff-only controls (outside the frame), `Frame`, `ItemRow`,
  `StateChip`, `DateLine`, `Empty`.
- `.../portal/_ui/Skeleton.tsx`, `loading.tsx` (×6), `error.tsx`.
- Pages: `page.tsx`, `checklist/page.tsx`, `checklist/[step]/page.tsx`, `next-steps/page.tsx`,
  `billing/page.tsx`, `help/page.tsx`.
- `docs/admin-redesign/phase1-accessibility.md`.

## Flags

None consulted. The prototype has no database-backed or behaviour-changing path: it reads a
compiled-in fixture and every action button is inert (`aria-disabled`, explained in text).
When the portal is wired to real data it must sit behind `commercialV2` for reads and use
portal server actions (membership check, audit row, preview-cookie refusal) for writes.

## Checks

- `pnpm -C apps/web typecheck` — clean.
- `pnpm -C apps/web exec eslint "app/admin/(dashboard)/next/portal" lib/next/fixtures-portal.ts` — clean
  (two apostrophe warnings fixed).
- `pnpm -C apps/web test` — 45 files, 539 tests pass (unchanged; none added, see gaps).
- Derivations sanity-checked from a scratchpad vitest run (9 cases: completion counts, role
  routing of the next step, Northline acceptance without package, Harbour date separation,
  Orbit fee, Cedar exception, contract-vary rule, default client). Not committed.

## Gaps and follow-ups

1. **No committed unit test.** `apps/web/tests/` is outside this task's ownership. Proposed
   file `apps/web/tests/next-portal.test.ts` covering `completion`, `nextStep`, `canAct`,
   `canVaryContract`, `money` and the "no legacy client names" guard (the scratch cases above
   can be pasted in).
2. **No browser verification.** Layout claims in the accessibility note are judged from CSS.
   A preview deployment at 320/390/768/1440 and 200 % zoom is still required (§13 matrix).
3. **Inert actions.** Accept / pay / submit / Direct-Debit-continue do nothing. Real behaviour
   needs portal server actions with role capabilities that do not exist yet (Phase 0 §3: only
   `client_admin` is minted; N4).
4. The shell's own `.faint` usages (Today page freshness line, disabled rail links, search
   placeholder) fail contrast — outside this task; see the accessibility note.
5. Brightwell was added as a fifth fixture so the initial-phase checklist is reviewable; it is
   not in the task's `?client=` list but is harmless and labelled.
6. The `<meter>` completion bar relies on browser default styling in Firefox/Safari for the
   filled part; the count is always present as text so nothing depends on it.

## Approvals needed

None to review. Before any of this reaches a real client: decision-register items 18.1
(tier prices), 18.3 (£600 tax basis/scope) and 18.11 (portal role capabilities) — the fixture
prices are sandbox figures and are labelled as such in the UI.

## How to try it

Run the web app as usual, sign in as staff, then open:

- `/admin/next/portal` — Northline dashboard as signatory.
- `/admin/next/portal?client=brightwell&role=billing` — draft company form, save-and-return.
- `/admin/next/portal/checklist/agreement?client=brightwell&role=billing` — "cannot vary the contract".
- `/admin/next/portal/next-steps?client=harbour` — contractual start vs provider date.
- `/admin/next/portal/checklist/direct-debit?client=northline&role=billing` — hosted-flow step.
- `/admin/next/portal/next-steps?client=orbit` — independent £600 route.
- `/admin/next/portal?client=cedar` — owned exception card.
- Append `&wide=1` to any of the above for the wide frame.
