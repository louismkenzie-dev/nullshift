# Phase 1 — Finance area (`/admin/next/finance`)

Task `p1-finance` of the admin redesign. Implements brief §5.6 (Finance), the §10.1 obligation
spine and the §12.3 monetary invariants as a fixture-backed prototype inside the existing
`/admin/next` shell. Nothing here reads the database, calls a provider, sends email or writes.

## What was built

Six local tabs, three detail routes, one fixtures module, one CSS module.

| Route                                  | Content                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/admin/next/finance`                  | Overview: six distinct metrics, each with currency, count, date range, an expandable definition, freshness stamp and a drill-down link. A boundary note states that client payment volume (connected accounts) is excluded from every figure. Open-exceptions queue.                                                                                                                                                                                                                                                        |
| `/admin/next/finance/invoices`         | Invoice list with `?filter=open                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | overdue   | paid      | exceptions`; gross / paid / remaining, state, Xero identity or "Not created".                                                                                                                                                                                                            |
| `/admin/next/finance/invoices/[id]`    | Obligation and milestone/period; immutable issued line items with net/tax/gross; tax basis snapshot (Orbit's £600 handover carries `PENDING` — decision 18.3); balance equation (gross − allocations − credits = remaining); Xero identity (fictional ids) including create-failed and payment-sync-failed states; payment allocations (bank transfer, Direct Debit collection, credit note); credits/refunds as typed operations; collection links; event history.                                                         |
| `/admin/next/finance/collections`      | Collections list with `?filter=authorised                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | scheduled | collected | failed`. "Authorised — not scheduled" is a first-class state with its own filter and is never counted as scheduled. Columns: client · obligation, mandate, accepted amount, contractual start, requested vs actual charge date, collection state, payout state, bank-match state, owner. |
| `/admin/next/finance/collections/[id]` | Same fields in full with a plain-English explanation of the state, provider ids (sandbox-style), payout equation and bank evidence, late-event note, linked exceptions.                                                                                                                                                                                                                                                                                                                                                     |
| `/admin/next/finance/subscriptions`    | One row per billable service with legacy marker, governing acceptance, package, agreed rate, start, provider ids, next collection, pause/cancel state and upcoming review. Below the table: clients with no row and why (Northline, Cedar with its exception, Westbridge, Orbit).                                                                                                                                                                                                                                           |
| `/admin/next/finance/reconciliation`   | Gross − refunds − fees ± adjustments = net, computed and compared with the stated net ("Balances" / "Does not balance"). "Needs human review" section shows the Westbridge £2,500.00 receipt, its suggested (ambiguous) match, the evidence list, the ambiguity statement and inert second-person actions. Matched table shows a partial payment (Westbridge M2), several invoices in one transfer (Cedar £7,200.00 across two invoices) and points at the split-transfer example (Northline deposit paid in two receipts). |
| `/admin/next/finance/exceptions`       | Exceptions list with filters for open / all / resolved and each of the eight kinds.                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `/admin/next/finance/exceptions/[id]`  | Owner, what happened, attempt history, safe-retry block ("Retry does…" / "Never…"), second-person marker, resolution evidence, next step, linked records.                                                                                                                                                                                                                                                                                                                                                                   |

### Fixture coverage (brief §16)

| Fixture              | Where it shows                                                                                                                                                                                                                                                       |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2 Harbour            | `COL-1037-2026-10` authorised — not scheduled; `SUB-1037-ACTIVITY` accepted, future start 1 Oct, not counted in contracted value.                                                                                                                                    |
| 3 Cedar              | `EX-0001` missing consent (billing start 22 Sep, no schedule, no mandate); no subscription row.                                                                                                                                                                      |
| 5 Morrow             | Two subscription rows under one client (`SUB-1015-BOOKINGS` managed Core, `SUB-1015-ROTA` independent / not billable); `EX-0002` cancelled mandate (resolved with evidence); `EX-0005` duplicate provider event (resolved automatically).                            |
| 6 Fieldstone         | `COL-1011-2026-09` failed; `EX-0003` failed collection awaiting second-person approval; `COL-1011-2026-08` "Paid out (late event)" — state derived from obligations, not event order.                                                                                |
| 8 Legacy Example Ltd | `SUB-0007-HOSTING` legacy + read-only; September collection confirmed but payout pending (the "collected, not yet paid out" figure).                                                                                                                                 |
| 10 Westbridge        | Three milestone invoices; M2 part paid with `EX-0006` balance mismatch (ledger £1,500.00 vs Xero £4,000.00); M3 `EX-0004` Xero create failed with "Retry creates the Xero invoice record only; it never collects"; `BANK-0916-J` unmatched £2,500.00 with `EX-0008`. |
| 1 Northline, 4 Orbit | Deposit paid by split transfer; £600 handover invoice with pending tax basis and `EX-0007` link-closure failure.                                                                                                                                                     |

All eight §5.6 exception kinds are present: missing consent, cancelled mandate, failed collection,
Xero outage, duplicate warning, balance mismatch, link-closure failure, unmatched payout.

## Files

Created (all under `apps/web/`):

- `lib/next/fixtures-finance.ts` — types, fictional data and pure helpers (`formatMoney`, `fmtDate`, `remainingMinor`, `paidMinor`, `creditedMinor`, `overAllocated`, `isOverdue`, `netPayoutMinor`, `payoutBalances`, `payoutOverAllocated`, `overviewMetrics`, lookups). Money is integer minor units with an explicit `currency`; no floating point. Imports only `CLIENTS`/`Client` from `lib/next/fixtures.ts` (not edited).
- `app/admin/(dashboard)/next/finance/layout.tsx` — page head and local tabs.
- `app/admin/(dashboard)/next/finance/FinanceTabs.tsx` — client component for the active tab only.
- `app/admin/(dashboard)/next/finance/ui.tsx` — server-safe chips, `Amount`, `KV`, `Empty`, `SourceNote`, `ClientLink`, `RetryBlock`.
- `app/admin/(dashboard)/next/finance/Skeleton.tsx`, `loading.tsx`, `error.tsx` (client boundary using `unstable_retry`), and `loading.tsx` in every sub-segment (`invoices`, `invoices/[id]`, `collections`, `collections/[id]`, `subscriptions`, `reconciliation`, `exceptions`, `exceptions/[id]`).
- `app/admin/(dashboard)/next/finance/page.tsx`, `invoices/page.tsx`, `invoices/[id]/page.tsx`, `collections/page.tsx`, `collections/[id]/page.tsx`, `subscriptions/page.tsx`, `reconciliation/page.tsx`, `exceptions/page.tsx`, `exceptions/[id]/page.tsx`.
- `app/admin/(dashboard)/next/finance/finance.module.css` — Halo tokens inherited from `.shell`, square corners, no animation.

Modified: none outside the list above. `lib/next/fixtures.ts`, `next.module.css`, `Rail.tsx` and the existing prototype pages are untouched (the Rail already links to `/admin/next/finance`).

## Flags

No database path exists in this slice, so nothing is gated for behaviour; the flags are read for honesty of labelling only:

- `commercialV2` — `SourceNote` on every page says "fixtures (commercialV2 off)" or, when on, "live reads are not implemented in this slice; fixtures shown".
- `integrationWorkers` — `RetryBlock` explains why Retry is disabled (flag off, or on but no operation queue). The button is always inert; no server action exists, so nothing can be enqueued or charged.

With every flag off the pages are unchanged and no existing behaviour is affected. Migrations: none.

## Checks

- `pnpm -C apps/web typecheck` — clean.
- `pnpm -C apps/web exec eslint "app/admin/(dashboard)/next/finance" lib/next/fixtures-finance.ts` — clean.
- `pnpm -C apps/web test` — 45 files, 539 tests passed (no new repo tests; see gaps).
- Prettier applied to the owned files.
- Invariant checks were run from the scratchpad with the repo vitest config (`vitest run --dir <scratch>`): 7 passed. The test body is below so it can be added to `apps/web/tests/next-finance.test.ts` by whoever owns that directory.

<details>
<summary>Suggested <code>apps/web/tests/next-finance.test.ts</code></summary>

```ts
import { describe, expect, it } from "vitest";
import {
  COLLECTIONS,
  EXCEPTIONS,
  INVOICES,
  PAYOUTS,
  SUBSCRIPTIONS,
  SUBSCRIPTIONS_WITHOUT_ROW,
  clientRef,
  collectionById,
  exceptionById,
  formatMoney,
  fmtDate,
  gbpMinor,
  invoiceById,
  isOverdue,
  netPayoutMinor,
  overAllocated,
  overviewMetrics,
  payoutBalances,
  payoutOverAllocated,
  remainingMinor,
  paidMinor,
} from "@/lib/next/fixtures-finance";
import { CLIENTS } from "@/lib/next/fixtures";

describe("finance fixtures invariants", () => {
  it("formats minor units without floating point", () => {
    expect(formatMoney(gbpMinor(16315))).toBe("£163.15");
    expect(formatMoney(gbpMinor(250000))).toBe("£2,500.00");
    expect(formatMoney(gbpMinor(-1500))).toBe("−£15.00");
    expect(formatMoney(gbpMinor(1), { signed: true })).toBe("+£0.01");
    expect(fmtDate("2026-10-01")).toBe("1 Oct 2026");
  });
  it("every payout balances and is not over-allocated", () => {
    for (const p of PAYOUTS) {
      expect(payoutBalances(p), p.id).toBe(true);
      expect(payoutOverAllocated(p), p.id).toBe(false);
    }
    expect(netPayoutMinor(PAYOUTS[0])).toBe(16315);
  });
  it("no invoice is over-allocated and balances are as designed", () => {
    for (const i of INVOICES) expect(overAllocated(i), i.id).toBe(false);
    expect(remainingMinor(invoiceById("INV-1033-02")!)).toBe(150000);
    expect(remainingMinor(invoiceById("INV-1015-2026-08")!)).toBe(0);
    expect(paidMinor(invoiceById("INV-1041-01")!)).toBe(740000);
    expect(isOverdue(invoiceById("INV-1033-02")!)).toBe(true);
    expect(isOverdue(invoiceById("INV-1022-H1")!)).toBe(false);
  });
  it("overview metrics", () => {
    const m = Object.fromEntries(overviewMetrics().map((x) => [x.key, x]));
    expect(m.contracted.value.amountMinor).toBe(16500 + 24500 + 8000);
    expect(m.receivables.value.amountMinor).toBe(150000 + 400000 + 24500 + 60000);
    expect(m.overdue.value.amountMinor).toBe(150000 + 24500);
    expect(m.scheduled.value.amountMinor).toBe(16500 + 8000);
    expect(m.collected.value.amountMinor).toBe(8000);
    expect(m.unmatched.value.amountMinor).toBe(250000);
    for (const x of overviewMetrics()) {
      expect(x.definition.length).toBeGreaterThan(20);
      expect(x.href).toMatch(/^\/admin\/next\/finance/);
      expect(x.range).toContain("2026");
    }
  });
  it("all eight exception kinds exist with owner, attempts and retry statements", () => {
    const kinds = new Set(EXCEPTIONS.map((e) => e.kind));
    expect(kinds.size).toBe(8);
    for (const e of EXCEPTIONS) {
      expect(e.owner).toBeTruthy();
      expect(e.retry.does).toBeTruthy();
      expect(e.retry.never).toMatch(/never/i);
      expect(clientRef(e.clientId).ref).not.toBe("—");
    }
  });
  it("cross links resolve", () => {
    for (const i of INVOICES) {
      for (const id of i.collectionIds) expect(collectionById(id), id).toBeDefined();
      for (const id of i.exceptionIds) expect(exceptionById(id), id).toBeDefined();
      expect(CLIENTS.some((c) => c.id === i.clientId)).toBe(true);
    }
    for (const c of COLLECTIONS) {
      if (c.obligation.invoiceId)
        expect(invoiceById(c.obligation.invoiceId)).toBeDefined();
      for (const id of c.exceptionIds) expect(exceptionById(id)).toBeDefined();
    }
    for (const p of PAYOUTS)
      for (const a of p.allocations) expect(invoiceById(a.invoiceId)).toBeDefined();
    for (const e of EXCEPTIONS) {
      if (e.links.invoiceId) expect(invoiceById(e.links.invoiceId)).toBeDefined();
      if (e.links.collectionId)
        expect(collectionById(e.links.collectionId)).toBeDefined();
    }
    for (const s of [...SUBSCRIPTIONS, ...SUBSCRIPTIONS_WITHOUT_ROW])
      expect(clientRef(s.clientId).ref).not.toBe("—");
  });
  it("brief states: authorised-not-scheduled, Morrow two rows, legacy read-only, Northline no row, no real client names", () => {
    expect(
      COLLECTIONS.filter((c) => c.state === "authorised_not_scheduled").map(
        (c) => c.clientId
      )
    ).toEqual(["harbour"]);
    expect(SUBSCRIPTIONS.filter((s) => s.clientId === "morrow")).toHaveLength(2);
    expect(SUBSCRIPTIONS.find((s) => s.clientId === "legacy")?.readOnly).toBe(true);
    expect(SUBSCRIPTIONS.some((s) => s.clientId === "northline")).toBe(false);
    const blob = JSON.stringify({
      INVOICES,
      COLLECTIONS,
      PAYOUTS,
      EXCEPTIONS,
      SUBSCRIPTIONS,
    }).toLowerCase();
    for (const real of ["dance exclusive", "suffolk", "new future", "gino"])
      expect(blob).not.toContain(real);
  });
});
```

</details>

## Gaps

- **No repo test file.** `apps/web/tests/` is outside this task's owned paths; the invariant test above should be added there as `next-finance.test.ts`.
- **Not rendered in a browser this session.** Browser tools were off-limits for this task; the pages are verified by typecheck, lint and the fixture invariants only. A visual pass at 1440 px and 375 px (plus loading/empty/error states) is still owed.
- **Retry, accept-match, hold and refund are inert.** There is no server action, no `requireStaff()` call and no `audit_log` write because nothing mutates. When `integrationWorkers` lands, `RetryBlock` should become a form posting to a `requireStaff()` action that enqueues an operation with the `does`/`never` text as the audit reason, refuses under a `ns_client_preview` cookie, and never charges.
- **No live reads.** `commercialV2` on does not switch the data source; `SourceNote` says so. Live reads need the obligation / collection attempt / payout / allocation tables the Phase 0 report lists as missing (§3 concept table), plus the ledger reconciliation in decision N-h.
- **Application fees on connected accounts** are mentioned as excluded but not shown; a later slice can add a clearly separated "platform fee income" metric if wanted.
- **Tax basis** is `NONE (fixture)` at 0 % on every invoice and `PENDING` on the handover fee; real codes wait on decision 18.8 with the accountant.
- Exception detail pages link payouts to the Reconciliation tab (no `/reconciliation/[id]` route was requested).

## Approvals needed

None to merge this slice: no migration, no flag default change, no external call. Before any live path: decisions 18.3 (handover fee tax basis), 18.8 (Xero tax/clearing mappings), 18.10 (retry/refund policy) and 18.11 (who may approve a retry or allocation as the second person).

## How to try it

1. Run the web app as usual and sign in as staff.
2. Open `/admin/next/finance`. The rail's Finance entry already points here.
3. Suggested walk: Overview → "Unmatched payouts" drill-down → Reconciliation review card → `EX-0008` → linked `INV-1033-02` (part paid, Xero payment sync failed) → `EX-0006`; then Collections filtered to "Authorised — not scheduled" → `COL-1037-2026-10`; then Subscriptions to see Morrow's two rows and the "no row" list; then Exceptions filtered by kind.
4. `OPS_V2_FLAGS=commercialV2,integrationWorkers` changes only the source note and the retry-disabled reason.
5. Empty states: `/admin/next/finance/exceptions?filter=resolved` has rows; `/admin/next/finance/collections?filter=` with an unknown value falls back to All; to see a true empty state temporarily filter a kind with no rows (none exist in fixtures — every kind is represented), or visit `/admin/next/finance/invoices?filter=exceptions` after removing exception ids in the fixture.
