# Phase 2 — Deterministic estimator (brief §6, §17.3)

Status: prototype, fixtures only. No migration, no database reads or writes, no
provider calls, no server actions (the estimator has no mutations). Nothing in
this slice is an approved price, rate, margin or threshold (brief §2.2; decision
18.2). Branch `feat/admin-redesign`, 17 September 2026.

## What was built

A pure, versioned estimator in `apps/web/lib/estimator/` and a Quote Studio
whose Review & approval box is computed from it instead of the ad-hoc
`floorPrice` / `targetPrice` helpers.

| Module          | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `types.ts`      | `Money` (integer minor units + explicit currency), `Maybe<T>` (`known` / `unknown` with a reason — Unknown is never coerced to zero), work packages, cost-to-serve lines, the `EstimateInput` and the `EstimateResult` (BUILD / RUN / GROW / TRANSACT)                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `policy.ts`     | `CommercialPolicy` (id, effective date, draft/published, target and minimum build/run margins, rounding increments, approval threshold, contingency method, warranty reserve rule, loaded role rates in minor units per hour). One seeded policy: `POLICY_2026_09_DRAFT`, state `draft`, every constant labelled hypothetical                                                                                                                                                                                                                                                                                                                                              |
| `catalogue.ts`  | The §6.5 candidate catalogue, every item `state: "draft"`, `chargeable: false`, versioned and dated; one launch family (Platform Launch Pack / Launch Pack Plus) and one five-video pack, no near-duplicates. `HANDOVER_FEE` (£600) is kept separate from the add-ons with `taxBasis: "pending"`, `issuable: false`                                                                                                                                                                                                                                                                                                                                                        |
| `calculate.ts`  | The §6.2 formulas exactly, in integer minor units: base delivery cost, risk-adjusted cost (contingency and warranty counted once; the reserve is skipped when a package covers warranty), floor and target rounded UP to the increment, monthly cost-to-serve with fixed vs usage-sensitive vs client-pays-direct split, run floor and target, forecast contribution and margin (null, not NaN, at a zero price), low/base/high scenarios with cost drivers, escalation above the threshold with no cap. Helpers `marginFromMarkup`, `markupFromMargin`, `priceForMargin`, `ceilToIncrement`, `allocateMilestones`. The result is deep-frozen and embeds a policy snapshot |
| `validate.ts`   | §6.4 controls as `block` / `review` / `info` issues: nonnegative finite values, `0 ≤ min ≤ target < 100`, `low ≤ base ≤ high`, below-floor price needs an approver and a reason, discount effect on contribution, zero price reported as undefined margin, large estimates escalate (never capped), missing costs, warranty double-count, draft policy, handover tax basis pending, draft catalogue, speculative transaction volumes                                                                                                                                                                                                                                       |
| `clientView.ts` | Client-safe projection: no rates, hours, costs, floors, targets or margins; totals keep tax, one-off, recurring, usage and percentage fees separate; a deferred run package never manufactures a recurring amount                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `fixtures.ts`   | Adapter from the Studio fixture `Quote` (read from `@/lib/next/fixtures`, never edited) to an `EstimateInput`, plus fictional cost-to-serve lines for the managed fixture client                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `index.ts`      | Barrel                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

### Quote Studio (`/admin/next/quotes/[id]`)

`apps/web/app/admin/(dashboard)/next/quotes/[id]/page.tsx` now:

- loads the quote through `loadQuote()`: when **both** `flagOn("calculator")` and
  `flagOn("commercialV2")` are set it calls `loadQuoteForStudio(id)` from
  `lib/commercial/quotes.ts` first and falls back to the fixture; with either
  flag off it never touches the data layer. A `source: fixture | database`
  label is shown in the header;
- computes the Review & approval box from the estimator: policy line (id, state,
  effective date, margins, increment, threshold, "no cap"), internal estimate,
  floor, target, recommended, approved net price, forecast contribution and
  margin (with before-discount figures when a discount exists), approver,
  escalation; a low/base/high scenario table; cost drivers with share bars; the
  RUN cost-to-serve split and run floor/target; the full validation list with
  severity chips; and the fixture's remaining manual review items (the ones the
  estimator now computes are not repeated);
- shows an insufficient-confidence state listing the Unknown inputs and the
  discovery requirement when any material input is Unknown (the Atlas fixture);
- shows the client preview totals (one-off / recurring / usage / percentage /
  tax) from `toClientView`;
- carries a sandbox banner naming the draft policy and draft catalogue.

The Issue button stays disabled; its tooltip explains whether a blocking check
fails. `studio.module.css` adds the scenario table, driver bars and issue rows
using Halo tokens only, square corners, no motion.

## Flags

- `calculator` + `commercialV2` (both required): try the persisted quote before
  the fixture. `loadQuoteForStudio` currently returns `null`, so the fixture is
  used either way; the estimator itself is pure and runs regardless.
- Default (no flags): identical behaviour to before for everything outside this
  page; the page itself now renders estimator output from fixtures.

## Tests (`apps/web/tests/estimator.test.ts`, 31 tests)

Covers every §17.3 bullet:

| §17.3 bullet                                                    | Test                                                                                                                                                                                                                                          |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deterministic versioned outputs                                 | deep-equal, frozen result with policy snapshot; new policy changes new assessments only and cannot mutate an existing snapshot                                                                                                                |
| Negative/nonfinite inputs rejected; missing not coerced to zero | field-level `value_nonneg_finite` errors; Unknown hours / contractors / material facts → `insufficient_confidence`, scenarios null; Unknown cost-to-serve line → null run floor; empty cost-to-serve on a managed route → "missing, not zero" |
| Min above target, inverted ranges rejected                      | `policy_margin_range` for build and run, margins ≥ 100 rejected, `range_order` names the package                                                                                                                                              |
| Zero selling price                                              | margin `null`, never NaN/Infinity                                                                                                                                                                                                             |
| Margin and markup displayed correctly                           | ×1.75 = 42.9% margin; `markupFromMargin(50) = 100`                                                                                                                                                                                            |
| Floor rounding never below the minimum                          | rounded floor ≥ exact floor and ≥ min margin across several costs; increment multiples                                                                                                                                                        |
| Large estimates not capped                                      | £45,500 cost → £91,000 target escalates for review; £2,000/month cost → £5,000/month target                                                                                                                                                   |
| Contingency/warranty counted once                               | reserve skipped when a package covers warranty; two claiming packages rejected                                                                                                                                                                |
| Below-floor requires approval and reason                        | approver alone still blocks; approver + reason → review item; a discount that crosses the floor is treated the same                                                                                                                           |
| Client output has no internal data                              | client view of both fixture quotes contains none of rate / margin / cost / hours / floor / target / contingency / policy / contribution                                                                                                       |
| Totals separate tax, one-off, recurring, usage, percentage      | exact totals object; recurring stays null (never manufactured); milestones sum exactly                                                                                                                                                        |
| Changes to assumptions do not rewrite history                   | frozen result and snapshot test above                                                                                                                                                                                                         |

Plus the §6.2 worked examples (£5,000 → £10,000; £100/month → £250/month),
the Northline and Atlas fixture walkthroughs, the independent-handover block,
transaction scenarios excluded from contribution, currency-mismatch refusal,
and the catalogue invariants (all draft, unique ids and names, one launch
family, two video products).

`tests/next-fixtures.test.ts` is unchanged and still passes.

## Checks

- `pnpm -C apps/web typecheck`: clean.
- `pnpm -C apps/web exec eslint lib/estimator tests/estimator.test.ts "app/admin/(dashboard)/next/quotes/[id]/page.tsx"`: clean.
- `pnpm -C apps/web test`: 48 files, 615 tests passed.

## How to try it

1. `pnpm -C apps/web dev`, sign in as staff, open
   `/admin/next/quotes/q-northline-v2` (priced: above floor, below target, one
   manual item fails) and `/admin/next/quotes/q-atlas-v1` (insufficient
   confidence: Unknown migration volume and blended role, no price).
2. Set `OPS_V2_FLAGS=calculator,commercialV2` to exercise the persisted-quote
   path; today it falls back to the fixture because the loader returns `null`.
3. In code: `calculateEstimate(input, POLICY_2026_09_DRAFT)` then
   `validateEstimate(input, policy, result)` and `toClientView(result, input)`.

## Gaps and follow-ups

- `loading.tsx` and `error.tsx` for `quotes/[id]` are not in this task's owned
  file list, so none were added under `[id]`. The parent `quotes/` segment now
  has `loading.tsx` and `error.tsx` from a parallel task, and those wrap `[id]`
  as well; a dedicated `[id]` pair can be added later by that segment's owner.
- Not visually verified in a browser (browser tools are out of bounds for this
  task); typecheck, eslint and unit tests only.
- The fixture `Quote` carries its own `minMarginPct` / `targetMarginPct` /
  `riskAdjustedCostGbp`; the page now ignores them in favour of the policy and
  the computed cost. `lib/next/fixtures.ts` still exports `floorPrice`,
  `targetPrice` and `marginPct` for `next-fixtures.test.ts`; they are no longer
  used by the page and can be retired with that test when convenient.
- Persisting an assessment (inputs, policy snapshot, result, approver) needs a
  migration extending `scale_assessments` (Phase 0 §5 "Extend") or a new
  `quote_assessments` table; out of scope here and blocked on decision 18.2.
- Milestone amounts are split from the approved net price with a floor-and-
  remainder allocation; the 50/25/25 schedule remains an example (brief §2.2).

## Approvals needed before any real use

- Decision 18.2: loaded rates, margins, contingency method, thresholds and
  increments (all placeholders in `POLICY_2026_09_DRAFT`).
- Decision 18.1 / §6.5: publishing any catalogue item; all remain draft and
  non-chargeable.
- Decision 18.3: £600 handover tax basis, payment timing and scope; issuance
  stays blocked until then.
- Decision 18.11: who may approve a below-floor price (drafting and approving
  are different permissions; the estimator records approver and reason but does
  not check authority).
