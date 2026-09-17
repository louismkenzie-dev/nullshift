import { describe, expect, it } from "vitest";
import {
  checkPayoutAllocations,
  payoutArithmetic,
  reconcilePayout,
  referenceMatches,
  subsetSums,
  suggestMatch,
  type OpenObligationCandidate,
  type PayoutInput,
  type Receipt,
} from "@/lib/billing/reconciliation";

/**
 * Brief §5.6 Reconciliation: "gross collections − refunds − fees ± adjustments
 * = net payout, linked to bank evidence. Support partial payments, split
 * transfers and several invoices paid in one transfer. Suggested matches
 * explain their evidence; ambiguous matches require human review."
 */

const payout = (over: Partial<PayoutInput> = {}): PayoutInput => ({
  id: "PO-1",
  provider: "gocardless",
  currency: "GBP",
  grossMinor: 100_000,
  refunds: [{ label: "Refund PM-9", amountMinor: 5_000 }],
  fees: [{ label: "GoCardless fees", amountMinor: 1_200 }],
  adjustments: [{ label: "Fee reversal", amountMinor: 200 }],
  statedNetMinor: 94_000,
  bank: {
    statementLine: "GOCARDLESS PO-1",
    reference: "PO-1",
    at: "2026-09-05",
    amountMinor: 94_000,
    currency: "GBP",
  },
  ...over,
});

describe("payout arithmetic", () => {
  it("gross − refunds − fees ± adjustments = net", () => {
    expect(payoutArithmetic(payout())).toEqual({
      grossMinor: 100_000,
      refundsMinor: 5_000,
      feesMinor: 1_200,
      adjustmentsMinor: 200,
      netMinor: 94_000,
    });
    const negativeAdj = payoutArithmetic(
      payout({ adjustments: [{ label: "Chargeback fee", amountMinor: -1_500 }] })
    );
    expect(negativeAdj.netMinor).toBe(92_300);
  });

  it("balanced when provider, arithmetic and bank all agree", () => {
    const r = reconcilePayout(payout());
    expect(r.verdict).toBe("balanced");
    expect(r.providerDifferenceMinor).toBe(0);
    expect(r.bankDifferenceMinor).toBe(0);
    expect(r.requiresHumanReview).toBe(false);
    expect(r.explanation[0]).toMatch(
      /Gross 100000 − refunds 5000 − fees 1200 \+ adjustments 200 = net 94000 GBP/
    );
  });

  it("a provider mismatch is reported with its sign, never absorbed", () => {
    const r = reconcilePayout(payout({ statedNetMinor: 93_500 }));
    expect(r.verdict).toBe("provider_mismatch");
    expect(r.providerDifferenceMinor).toBe(500);
    expect(r.requiresHumanReview).toBe(true);
    expect(r.explanation.join(" ")).toMatch(/do not force it to balance/);
  });

  it("bank pending, bank mismatch and bank currency mismatch are distinct", () => {
    expect(reconcilePayout(payout({ bank: null })).verdict).toBe("bank_pending");
    const off = reconcilePayout(
      payout({ bank: { ...payout().bank!, amountMinor: 93_900 } })
    );
    expect(off.verdict).toBe("bank_mismatch");
    expect(off.bankDifferenceMinor).toBe(100);
    expect(off.requiresHumanReview).toBe(true);
    expect(
      reconcilePayout(payout({ bank: { ...payout().bank!, currency: "EUR" } })).verdict
    ).toBe("bank_mismatch");
  });

  it("unstated when the provider has not reported a net", () => {
    const r = reconcilePayout(payout({ statedNetMinor: null }));
    expect(r.verdict).toBe("unstated");
    expect(r.statedNetMinor).toBeNull();
  });

  it("allocations against a payout can never exceed its gross", () => {
    expect(
      checkPayoutAllocations(100_000, [
        { obligationId: "a", amountMinor: 60_000 },
        { obligationId: "b", amountMinor: 40_000 },
      ]).overAllocated
    ).toBe(false);
    const over = checkPayoutAllocations(100_000, [
      { obligationId: "a", amountMinor: 60_000 },
      { obligationId: "b", amountMinor: 40_001 },
    ]);
    expect(over.overAllocated).toBe(true);
    expect(over.remainingMinor).toBe(-1);
  });
});

const T1 = "tenant-1";
const T2 = "tenant-2";

const cand = (
  over: Partial<OpenObligationCandidate> &
    Pick<OpenObligationCandidate, "obligationId" | "remainingMinor">
): OpenObligationCandidate => ({
  tenantId: T1,
  invoiceRef: null,
  label: over.obligationId,
  currency: "GBP",
  dueAt: null,
  ...over,
});

const receipt = (over: Partial<Receipt> = {}): Receipt => ({
  id: "RC-1",
  source: "bank_receipt",
  amountMinor: 50_000,
  currency: "GBP",
  reference: null,
  receivedAt: "2026-09-10",
  tenantId: null,
  ...over,
});

describe("suggestMatch — evidence and ambiguity", () => {
  const candidates: OpenObligationCandidate[] = [
    cand({
      obligationId: "ob-dep",
      invoiceRef: "INV-2026-0101",
      remainingMinor: 50_000,
      dueAt: "2026-09-01",
    }),
    cand({
      obligationId: "ob-mid",
      invoiceRef: "INV-2026-0102",
      remainingMinor: 30_000,
      dueAt: "2026-09-15",
    }),
    cand({
      obligationId: "ob-fin",
      invoiceRef: "INV-2026-0103",
      remainingMinor: 20_000,
      dueAt: "2026-10-01",
    }),
    cand({
      obligationId: "ob-other",
      invoiceRef: "INV-2026-0200",
      remainingMinor: 75_000,
      tenantId: T2,
    }),
  ];

  it("a reference naming one invoice with the exact amount is high confidence with the evidence spelled out", () => {
    const s = suggestMatch(receipt({ reference: "INV 2026 0101 NORTHLINE" }), candidates);
    expect(s.confidence).toBe("high");
    expect(s.allocations).toEqual([{ obligationId: "ob-dep", amountMinor: 50_000 }]);
    expect(s.requiresHumanReview).toBe(false);
    expect(s.evidence.join("\n")).toMatch(/names INV-2026-0101/);
    expect(s.evidence.join("\n")).toMatch(/equals the named balance exactly/);
  });

  it("a referenced partial payment is high confidence and states what remains", () => {
    const s = suggestMatch(
      receipt({ reference: "INV-2026-0101", amountMinor: 20_000 }),
      candidates
    );
    expect(s.confidence).toBe("high");
    expect(s.allocations).toEqual([{ obligationId: "ob-dep", amountMinor: 20_000 }]);
    expect(s.evidence.join("\n")).toMatch(/partial payment leaving 30000/);
  });

  it("a referenced overpayment is ambiguous: the surplus stays visible and needs a decision", () => {
    const s = suggestMatch(
      receipt({ reference: "INV-2026-0103", amountMinor: 25_000 }),
      candidates
    );
    expect(s.confidence).toBe("ambiguous");
    expect(s.allocations).toEqual([{ obligationId: "ob-fin", amountMinor: 20_000 }]);
    expect(s.unallocatedMinor).toBe(5_000);
    expect(s.requiresHumanReview).toBe(true);
    expect(s.ambiguity).toMatch(/Overpayment of 5000/);
  });

  it("a split transfer: the second half matches the remaining balance exactly", () => {
    const afterFirstHalf = candidates.map((c) =>
      c.obligationId === "ob-dep" ? { ...c, remainingMinor: 30_000 } : c
    );
    // 30,000 now equals BOTH ob-dep's remaining and ob-mid's balance → ambiguous, alternatives listed.
    const s = suggestMatch(
      receipt({ amountMinor: 30_000, tenantId: T1 }),
      afterFirstHalf
    );
    expect(s.confidence).toBe("ambiguous");
    expect(s.alternatives).toHaveLength(1);
    expect(s.requiresHumanReview).toBe(true);
    // With the reference it resolves.
    const withRef = suggestMatch(
      receipt({ amountMinor: 30_000, tenantId: T1, reference: "2nd half INV-2026-0101" }),
      afterFirstHalf
    );
    expect(withRef.confidence).toBe("high");
    expect(withRef.allocations).toEqual([
      { obligationId: "ob-dep", amountMinor: 30_000 },
    ]);
  });

  it("an exact single balance without a reference is high when unique", () => {
    const s = suggestMatch(receipt({ amountMinor: 20_000, tenantId: T1 }), candidates);
    expect(s.confidence).toBe("high");
    expect(s.allocations).toEqual([{ obligationId: "ob-fin", amountMinor: 20_000 }]);
    expect(s.evidence.join("\n")).toMatch(/and no other/);
  });

  it("several invoices in one transfer: a unique subset sum is high confidence", () => {
    const s = suggestMatch(receipt({ amountMinor: 80_000, tenantId: T1 }), candidates);
    expect(s.confidence).toBe("high");
    expect(s.allocations).toEqual([
      { obligationId: "ob-dep", amountMinor: 50_000 },
      { obligationId: "ob-mid", amountMinor: 30_000 },
    ]);
    expect(s.evidence.join("\n")).toMatch(
      /combined balance of INV-2026-0101 \+ INV-2026-0102/
    );
  });

  it("several subsets that fit are ambiguous and list every combination", () => {
    const many = [
      cand({ obligationId: "a", remainingMinor: 10_000 }),
      cand({ obligationId: "b", remainingMinor: 20_000 }),
      cand({ obligationId: "c", remainingMinor: 30_000 }),
      cand({ obligationId: "d", remainingMinor: 40_000 }),
    ];
    // 50,000 = a + d = b + c
    const s = suggestMatch(receipt({ amountMinor: 50_000, tenantId: T1 }), many);
    expect(s.confidence).toBe("ambiguous");
    expect(s.alternatives).toHaveLength(1);
    expect(s.ambiguity).toMatch(/a \+ d \| b \+ c|b \+ c \| a \+ d/);
    expect(s.requiresHumanReview).toBe(true);
  });

  it("the client identity on a provider payout narrows the pool and excludes other clients", () => {
    const s = suggestMatch(receipt({ amountMinor: 75_000, tenantId: T1 }), candidates);
    expect(s.confidence).toBe("none");
    expect(s.requiresHumanReview).toBe(true);
    const other = suggestMatch(
      receipt({ amountMinor: 75_000, tenantId: T2 }),
      candidates
    );
    expect(other.confidence).toBe("high");
    expect(other.allocations[0].obligationId).toBe("ob-other");
  });

  it("an unreferenced partial payment of the only open debt is ambiguous, not assumed", () => {
    const s = suggestMatch(receipt({ amountMinor: 40_000, tenantId: T2 }), candidates);
    expect(s.confidence).toBe("ambiguous");
    expect(s.allocations).toEqual([{ obligationId: "ob-other", amountMinor: 40_000 }]);
    expect(s.ambiguity).toMatch(/Confirm this is a partial payment/);
  });

  it("nothing fits → none, with the reasons, and human review", () => {
    const s = suggestMatch(receipt({ amountMinor: 12_345 }), candidates);
    expect(s.confidence).toBe("none");
    expect(s.allocations).toEqual([]);
    expect(s.unallocatedMinor).toBe(12_345);
    expect(s.requiresHumanReview).toBe(true);
    expect(s.evidence.join("\n")).toMatch(/No payment reference/);
    expect(s.evidence.join("\n")).toMatch(/matches no balance/);
  });

  it("another currency is excluded, never matched", () => {
    const s = suggestMatch(receipt({ amountMinor: 50_000, currency: "EUR" }), candidates);
    expect(s.confidence).toBe("none");
    expect(s.evidence.join("\n")).toMatch(/another currency were excluded/);
  });

  it("a non-high result always requires human review; a high one never claims otherwise", () => {
    const cases = [
      suggestMatch(receipt({ reference: "INV-2026-0101" }), candidates),
      suggestMatch(
        receipt({ amountMinor: 30_000, tenantId: T1 }),
        candidates.map((c) =>
          c.obligationId === "ob-dep" ? { ...c, remainingMinor: 30_000 } : c
        )
      ),
      suggestMatch(receipt({ amountMinor: 1 }), candidates),
    ];
    for (const s of cases) expect(s.requiresHumanReview).toBe(s.confidence !== "high");
  });
});

describe("helpers", () => {
  it("referenceMatches ignores punctuation and case, and needs a real reference", () => {
    const cs = [
      cand({ obligationId: "x", invoiceRef: "INV-2026-0007", remainingMinor: 1 }),
    ];
    expect(referenceMatches({ reference: "inv 2026/0007 paid" }, cs)).toHaveLength(1);
    expect(referenceMatches({ reference: "" }, cs)).toHaveLength(0);
    expect(referenceMatches({ reference: null }, cs)).toHaveLength(0);
  });

  it("subsetSums only returns combinations of two or more", () => {
    const cs = [
      cand({ obligationId: "a", remainingMinor: 5 }),
      cand({ obligationId: "b", remainingMinor: 5 }),
      cand({ obligationId: "c", remainingMinor: 10 }),
    ];
    expect(subsetSums(cs, 10).map((s) => s.map((c) => c.obligationId))).toEqual([
      ["a", "b"],
    ]);
    expect(subsetSums(cs, 20)).toEqual([[cs[0], cs[1], cs[2]]]);
  });
});
