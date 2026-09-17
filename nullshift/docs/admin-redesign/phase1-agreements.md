# Phase 1 — Agreements area (`/admin/next/agreements`)

Task `p1-agreements` · branch `feat/admin-redesign` · 2026-09-17 · brief §5.7, §8.1, §9, §2.1

## What was built

A fixtures-only Agreements area inside the admin redesign prototype shell. No database reads, no provider calls, no writes, no server actions. Both routes inherit the existing `(dashboard)` login → MFA step-up → staff check because they are mounted under `apps/web/app/admin/(dashboard)/next/`.

### Library — `/admin/next/agreements`

- Server component. Filter chips are plain links that toggle `?client=`, `?type=`, `?version=`, `?status=`, `?expiry=`, `?review=` search params; every chip shows how many rows it would leave given the other active filters. Unknown or over-long param values are dropped by `parseFilters` (never trusted).
- Filters: client, document type (Master framework · Project Order Form / SOW · Managed service schedule · Independent handover schedule · Data/Payment/AI schedule · Change Order), version, status (all eight: Draft · Needs internal review · Ready to issue · Awaiting client · Accepted · Rejected · Superseded · Withdrawn — each has its own chip tone), expiry (within 30 days / expired / none, relative to the fixed fixture date 2026-09-17), review requirement (second-person legal review / standard / none-historical).
- Columns: document + project + supersedes/superseded-by, client (links to the client workspace), status, template version, review requirement, expiry, "Before issue" (count of blockers — shown as _blocking_ for pre-issue documents, _open_ for accepted ones, n/a for legacy), last audit event with its kind.
- Real empty state when the filter combination has no rows, with a clear-filters link. `loading.tsx` skeleton and `error.tsx` (client component using `unstable_retry`) for the segment.
- Sort: documents needing internal work first, then awaiting client, accepted, then terminal states.

### Document workspace — `/admin/next/agreements/[id]`

- Header: type, version, template version, status chip, validity/expiry, supersedes / superseded-by links. Action buttons (Request review, Withdraw, New version, Issue) are disabled; the Issue button's title lists every reason it cannot be pressed.
- **Structured facts**: legal entity, authorised signatory, service route, billing-start arrangement (exact date or explicitly conditional wording, and whether that wording is approved), quote reference (flagged when stale), governing document link, notice, warranty, template version, review requirement. Missing facts render as red "Missing" chips.
- **Scope schedule**, **Pricing schedule** (integer minor units with explicit currency, cadence, tax basis chip — "pending decision" is amber — and a red "quote £x" note when the document amount differs from the governing quote), **Risk flags** (severity, open/resolved, review-required).
- **Internal review** panel (dashed amber border, "internal — never in client preview"): reuses the existing second-person gate `reviewState()` from `apps/web/lib/legal/review.ts`, so the rule "reviewer must differ from the author" is the same one the legacy Order Form send path uses. Internal notes live here only.
- **Client preview**: framed, labelled "Read-only · exactly what the client sees · no internal notes, risk flags, costs or margins". Renders only `clientSummary`, scope, client-facing charges and (for Northline) the approved-wording placeholder for the deferred Managed package. Footer states the preview cannot accept, sign or pay.
- **Audit trail**: every event carries a kind chip — _evidence only_ (sent, viewed, mandate authorised), _acceptance_, _issued_, _internal_, _system_. The card header says "sent and viewed are evidence, not acceptance".
- **Issue blockers** panel (sticky aside): derived by the pure `issueBlockers()` — missing service-route selection, missing billing-start arrangement (or missing exact start date on a service schedule, or unapproved conditional wording), missing legal entity/signatory, conflicting prices, stale quote reference, unresolved risk review. For accepted/terminal documents the same panel is titled "Open items" and explains that the frozen snapshot is never edited; resolution is by amendment or new version.
- A "Snapshot" strip on issued documents and a "Protected legacy agreement — read-only" note on the Legacy Example Ltd record ("never regenerated from today's catalogue and never edited in place").

## Fixtures (`apps/web/lib/next/fixtures-agreements.ts`)

All fictional; ids reuse `apps/web/lib/next/fixtures.ts` client ids so links resolve. Amounts are fixtures, not an approved price list.

| id                     | Client                     | Type · version                     | Status                | Demonstrates                                                                                                                        |
| ---------------------- | -------------------------- | ---------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `brightwell-of-v1`     | Brightwell Demo Ltd        | Order Form v1                      | Needs internal review | Blocked: unresolved sensitive-data review + route not elected; author has no second-person reviewer                                 |
| `brightwell-ds-v1`     | Brightwell Demo Ltd        | Data/Payment/AI schedule v1        | Draft                 | Schedule attached because of real risk, not by default                                                                              |
| `northline-of-v1`      | Northline Studios Ltd      | Order Form v1                      | Accepted              | Managed route, tier pending, £0 "no amount" line, approved-wording placeholder for the deferred package; sent/viewed/accepted trail |
| `harbour-of-v1`        | Harbour Activity Group Ltd | Order Form v1                      | Accepted              | Governing document for the service schedule                                                                                         |
| `harbour-ss-v1`        | Harbour Activity Group Ltd | Managed service schedule v1        | Accepted              | Exact £245/month GBP, start 2026-10-01, 30 days' notice; mandate event marked evidence, not collection                              |
| `orbit-hs-v1`          | Orbit Training Ltd         | Independent handover schedule v1   | Accepted              | £600 once, tax basis "pending decision", application-fee disposition open item (decision 18.4)                                      |
| `morrow-mf-v1`         | Morrow Venues Ltd          | Master framework v1                | Accepted              | Governing terms                                                                                                                     |
| `morrow-co-v1`         | Morrow Venues Ltd          | Change Order v1                    | Superseded            | Preserved unchanged; stale quote reference                                                                                          |
| `morrow-co-v2`         | Morrow Venues Ltd          | Change Order v2                    | Awaiting client       | Supersedes v1; states what changed; viewed = evidence only                                                                          |
| `cedar-ss-v1`          | Cedar Works Ltd            | Managed service schedule v1        | Rejected              | Client declined Pro with reason                                                                                                     |
| `fieldstone-ds-v1`     | Fieldstone Services Ltd    | Data/Payment/AI schedule v1        | Ready to issue        | Second-person review recorded, risk flag resolved, no blockers                                                                      |
| `westbridge-co-v1`     | Westbridge Events Ltd      | Change Order v1                    | Withdrawn             | Withdrawn with reason before any acceptance                                                                                         |
| `legacy-terms-2026-02` | Legacy Example Ltd         | Master framework (signed Feb 2026) | Accepted              | Legacy, read-only, review requirement none, never regenerated                                                                       |

Pure helpers exported for tests and later slices: `issueBlockers`, `canIssue`, `filterAgreements`, `parseFilters`, `sortAgreements`, `expiryState`, `daysUntil`, `money`, plus the vocabularies (`DOCUMENT_TYPES`, `AGREEMENT_STATUSES`, `PRE_ISSUE_STATUSES`, `REVIEW_REQUIREMENTS`, `BLOCKER_CODES`).

## Files

Created:

- `apps/web/lib/next/fixtures-agreements.ts`
- `apps/web/app/admin/(dashboard)/next/agreements/page.tsx`
- `apps/web/app/admin/(dashboard)/next/agreements/loading.tsx`
- `apps/web/app/admin/(dashboard)/next/agreements/error.tsx`
- `apps/web/app/admin/(dashboard)/next/agreements/statusTone.ts`
- `apps/web/app/admin/(dashboard)/next/agreements/agreements.module.css`
- `apps/web/app/admin/(dashboard)/next/agreements/[id]/page.tsx`
- `apps/web/app/admin/(dashboard)/next/agreements/[id]/loading.tsx`
- `apps/web/app/admin/(dashboard)/next/agreements/[id]/error.tsx`
- `docs/admin-redesign/phase1-agreements.md` (this file)

Modified: none. `apps/web/lib/next/fixtures.ts`, `next.module.css`, `Rail.tsx` and `layout.tsx` were read but not edited; the Rail already links to `/admin/next/agreements`.

## Flags

- No database-backed or behaviour-changing path exists in this slice, so nothing needs gating to keep production unchanged. The library reads `flagOn("commercialV2")` only to label the data source: with the flag on the header says "commercialV2 on · database source not wired in this slice · fixtures shown". A later slice that reads agreements from the database must keep that read behind `commercialV2` and keep the fixtures path for the flag-off case.
- No migrations, no server actions, no audit rows, no email, no provider calls.

## Checks

- `pnpm -C apps/web typecheck` — clean (after `next typegen`, `.next/types/validator.ts` validates both new pages).
- `pnpm -C apps/web exec eslint "app/admin/(dashboard)/next/agreements" lib/next/fixtures-agreements.ts` — clean; files formatted with the repo prettier config.
- `pnpm -C apps/web test` — 45 files, 539 tests pass (unchanged suite).
- Not rendered in a browser (browser tools are out of bounds for this task); no `next build` run to avoid disturbing parallel agents.

## Tests

`apps/web/tests/` is outside this task's owned paths, so the unit test was run from the scratchpad against the real module (11 tests, all pass) and is reproduced below for the integrator to drop in as `apps/web/tests/next-agreements.test.ts` unchanged:

```ts
import { describe, expect, it } from "vitest";
import { reviewState } from "@/lib/legal/review";
import {
  AGREEMENTS,
  AGREEMENT_STATUSES,
  FIXTURE_TODAY,
  agreementById,
  canIssue,
  expiryState,
  filterAgreements,
  issueBlockers,
  money,
  parseFilters,
  sortAgreements,
} from "@/lib/next/fixtures-agreements";

describe("agreements fixtures (brief §5.7, §8.1, §9)", () => {
  it("covers all eight statuses distinctly and names no real client", () => {
    const seen = new Set(AGREEMENTS.map((d) => d.status));
    for (const st of AGREEMENT_STATUSES) expect(seen.has(st)).toBe(true);
    const names = AGREEMENTS.map((d) => d.client.toLowerCase()).join(" ");
    for (const real of ["dance exclusive", "suffolk", "new future", "gino"])
      expect(names).not.toContain(real);
  });

  it("blocks Brightwell Order Form v1 on sensitive-data review and route election", () => {
    const d = agreementById("brightwell-of-v1")!;
    const codes = issueBlockers(d).map((b) => b.code);
    expect(codes).toContain("unresolved-risk-review");
    expect(codes).toContain("missing-service-route");
    const decision = canIssue(d, reviewState(d.review));
    expect(decision.ok).toBe(false);
    expect(decision.reasons.join(" ")).toMatch(/other than the author/);
  });

  it("records Northline as Managed with tier pending, no amount, approved wording", () => {
    const d = agreementById("northline-of-v1")!;
    expect(d.status).toBe("Accepted");
    expect(d.facts.serviceRoute).toBe("managed");
    expect(d.facts.billingStart?.exactDate).toBeUndefined();
    expect(d.facts.billingStart?.approvedWording).toBe(true);
    expect(d.approvedWordingPlaceholder).toMatch(/Nothing in this Order Form authorises/);
    const pending = d.pricing.find((p) => p.cadence === "n/a")!;
    expect(pending.amount.minor).toBe(0);
    expect(issueBlockers(d)).toEqual([]);
  });

  it("gives Harbour's service schedule an exact amount, currency, cadence, start and notice", () => {
    const d = agreementById("harbour-ss-v1")!;
    const line = d.pricing[0]!;
    expect(line.amount).toEqual({ minor: 24500, currency: "GBP" });
    expect(line.cadence).toBe("monthly");
    expect(d.facts.billingStart?.exactDate).toBe("2026-10-01");
    expect(d.facts.noticePeriod).toBeTruthy();
    expect(money(line.amount)).toBe("£245");
  });

  it("keeps the £600 handover fee on a pending tax basis with the fee disposition open", () => {
    const d = agreementById("orbit-hs-v1")!;
    expect(d.pricing[0]!.amount.minor).toBe(60000);
    expect(d.pricing[0]!.taxBasis).toBe("pending decision");
    expect(issueBlockers(d).map((b) => b.code)).toEqual(["unresolved-risk-review"]);
    // Accepted: open items never make it issuable again, and nothing is edited.
    expect(canIssue(d, reviewState(d.review)).ok).toBe(false);
  });

  it("links Morrow Change Order v2 to the superseded v1 and treats viewed as evidence only", () => {
    const v1 = agreementById("morrow-co-v1")!;
    const v2 = agreementById("morrow-co-v2")!;
    expect(v1.status).toBe("Superseded");
    expect(v1.supersededBy).toBe("morrow-co-v2");
    expect(v2.supersedes).toBe("morrow-co-v1");
    expect(v2.status).toBe("Awaiting client");
    const viewed = v2.audit.find((e) => /viewed/i.test(e.event))!;
    expect(viewed.kind).toBe("evidence");
    expect(v2.audit.some((e) => e.kind === "acceptance")).toBe(false);
    expect(issueBlockers(v1).map((b) => b.code)).toContain("stale-quote-reference");
  });

  it("marks the legacy signed terms read-only and never issuable", () => {
    const d = agreementById("legacy-terms-2026-02")!;
    expect(d.legacy).toBe(true);
    expect(d.reviewRequirement).toBe("none");
    const decision = canIssue(d, reviewState(d.review));
    expect(decision.ok).toBe(false);
    expect(decision.reasons[0]).toMatch(/legacy/i);
  });

  it("detects the remaining blocker kinds from facts", () => {
    const base = agreementById("harbour-of-v1")!;
    const noEntity = { ...base, facts: { ...base.facts, legalEntity: undefined } };
    expect(issueBlockers(noEntity).map((b) => b.code)).toContain(
      "missing-legal-entity-signatory"
    );
    const noStart = { ...base, facts: { ...base.facts, billingStart: undefined } };
    expect(issueBlockers(noStart).map((b) => b.code)).toContain("missing-billing-start");
    const conflict = {
      ...base,
      pricing: [
        { ...base.pricing[0]!, quoteAmount: { minor: 1, currency: "GBP" as const } },
      ],
    };
    expect(issueBlockers(conflict).map((b) => b.code)).toContain("conflicting-prices");
  });

  it("filters by every chip and drops unknown search params", () => {
    const f = parseFilters({
      client: "morrow",
      type: "change-order",
      bogus: "x",
      status: "nope",
    });
    expect(f).toEqual({ client: "morrow", type: "change-order" });
    const rows = filterAgreements(AGREEMENTS, f, FIXTURE_TODAY);
    expect(rows.map((d) => d.id).sort()).toEqual(["morrow-co-v1", "morrow-co-v2"]);
    expect(filterAgreements(AGREEMENTS, { version: "v2" }, FIXTURE_TODAY)).toHaveLength(
      1
    );
    expect(filterAgreements(AGREEMENTS, { review: "none" }, FIXTURE_TODAY)).toHaveLength(
      1
    );
    const expiring = filterAgreements(AGREEMENTS, { expiry: "expiring" }, FIXTURE_TODAY);
    for (const d of expiring)
      expect(expiryState(d, FIXTURE_TODAY).days).toBeLessThanOrEqual(30);
    expect(
      filterAgreements(AGREEMENTS, { expiry: "expired" }, FIXTURE_TODAY)
    ).toHaveLength(0);
  });

  it("sorts work needing attention before frozen states", () => {
    const sorted = sortAgreements(AGREEMENTS);
    expect(sorted[0]!.status).toBe("Needs internal review");
    expect(sorted[sorted.length - 1]!.status).toBe("Withdrawn");
  });

  it("keeps internal notes and risk flags out of the client-visible content", () => {
    for (const d of AGREEMENTS) {
      const visible = JSON.stringify({
        s: d.clientSummary,
        w: d.approvedWordingPlaceholder,
      });
      for (const note of d.internalNotes) expect(visible).not.toContain(note);
      expect(visible.toLowerCase()).not.toContain("margin");
    }
  });
});
```

## Gaps and follow-ups

1. **Test file placement** — add the test above as `apps/web/tests/next-agreements.test.ts` (not created here; the directory is not owned by this task).
2. **Client workspace "Agreements" tab** — `apps/web/app/admin/(dashboard)/next/clients/[id]/page.tsx` still shows the tab as "Not in this slice"; it should link to `/admin/next/agreements?client=<id>` (file owned by another task).
3. **Today / attention queue** — the Brightwell "Open review" attention row in `fixtures.ts` could deep-link to `/admin/next/agreements/brightwell-of-v1`.
4. **Data model** — `AgreementDocument` is the prototype's shape. The eventual migration (brief §9: structured facts + rendered snapshot + hash + template/document versions + acceptance actor/method; §7 status writer for Ready to issue / Awaiting client / Withdrawn / Superseded) is not part of this slice. Existing `order_forms` / `change_orders` rows and the legacy clients must map to Accepted without re-signing.
5. **Issue action** — when implemented it must be a server action calling `requireStaff()`, re-running `issueBlockers` + `reviewState` server-side, freezing the snapshot and hash, and writing an `audit_log` row; the client preview must never gain an accept control.
6. **Expiry "today"** — pinned to `FIXTURE_TODAY = "2026-09-17"` so rendering is deterministic; the live version should use the request date.

## Approvals needed (business, not engineering)

- Tax basis for the £600 independent handover fee (decision 18.3) — shown as "pending decision".
- Application-fee disposition after independent handover (18.4) — shown as an open item on Orbit.
- Approved conditional wording for a deferred Managed package — the Northline placeholder is illustrative text, not solicitor-reviewed wording.
- Document precedence, governing terms and template versions (`OF-2026.08`, `MSS-2026.09`, etc. are fixture labels) before any template is used with a client.
- Warranty duration/start (18.6) — Northline/Harbour fixtures say "60 days from build acceptance (as accepted)" to mirror the current content, not to set policy.

## How to try it

1. Sign in to the admin as staff (existing login and MFA step-up apply).
2. Open `/admin/next/agreements`. Click chips to combine filters, e.g. `?status=needs-review`, `?client=morrow&type=change-order`, `?expiry=expiring`, `?review=none`. Combine chips until the empty state appears; use "Clear filters".
3. Open `brightwell-of-v1` (blocked: risk review + route), `northline-of-v1` (accepted, tier pending, approved-wording placeholder in the client preview), `harbour-ss-v1` (exact amount/cadence/start/notice), `orbit-hs-v1` (£600, tax pending, open item), `morrow-co-v2` → follow the "supersedes" link to v1, and `legacy-terms-2026-02` (read-only note).
4. Hover the disabled Issue button to read the reasons it is blocked.
