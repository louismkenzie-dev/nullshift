import { describe, expect, it } from "vitest";
import {
  allocateMilestones,
  allocationCeiling,
  applyTax,
  floorToStep,
  PENDING_TAX,
  spreadPayment,
} from "@/lib/billing/allocation";
import {
  addMonths,
  issueBlockers,
  obligationBalance,
  planBuildMilestones,
  planHandoverFee,
  planServicePeriods,
  type AllocationRecord,
  type ObligationRecord,
} from "@/lib/billing/obligations";
import {
  NEVER_TEXT,
  planAssign,
  planAttempt,
  planOpen,
  planResolve,
  proposeRetry,
  retryNeverCollects,
  SAFE_RETRY_OPS,
  type ExceptionRecord,
} from "@/lib/billing/exceptions";
import { HANDOVER_FEE_MINOR } from "@/lib/legal/arrangements";

/**
 * Brief §12.3: "Milestone totals equal the accepted Build amount after
 * rounding; allocate residual pennies deterministically." §17.2: "Milestone
 * rounding totals equal the accepted project amount exactly."
 */
describe("allocateMilestones — residual pennies", () => {
  const thirds = [
    { key: "m1", label: "Deposit", percent: 33.33 },
    { key: "m2", label: "Midpoint", percent: 33.33 },
    { key: "m3", label: "Completion", percent: 33.34 },
  ];

  it("sums to the accepted total exactly", () => {
    for (const total of [1, 2, 3, 99, 100, 1000, 12345, 1_500_000, 999_999_99]) {
      const r = allocateMilestones(total, thirds);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.value.sumMinor).toBe(total);
      expect(r.value.milestones.reduce((a, m) => a + m.amountMinor, 0)).toBe(total);
    }
  });

  it("is deterministic: same input, same split, every time", () => {
    const a = allocateMilestones(1_000_001, thirds);
    const b = allocateMilestones(1_000_001, thirds);
    expect(a).toEqual(b);
  });

  it("gives the leftover pennies to the largest remainders, ties to the earliest milestone", () => {
    // £1.00 split 33.33 / 33.33 / 33.34 → floors 33, 33, 33; leftover 1 → m3 (remainder 34 > 33).
    const r = allocateMilestones(100, thirds);
    if (!r.ok) throw new Error("expected ok");
    expect(r.value.milestones.map((m) => m.amountMinor)).toEqual([33, 33, 34]);
    // Four equal quarters of 3p: floors 0,0,0,0; remainders equal; earliest three get the pennies.
    const q = allocateMilestones(3, [
      { key: "a", label: "a", percent: 25 },
      { key: "b", label: "b", percent: 25 },
      { key: "c", label: "c", percent: 25 },
      { key: "d", label: "d", percent: 25 },
    ]);
    if (!q.ok) throw new Error("expected ok");
    expect(q.value.milestones.map((m) => m.amountMinor)).toEqual([1, 1, 1, 0]);
    expect(q.value.milestones.map((m) => m.residualMinor)).toEqual([1, 1, 1, 0]);
  });

  it("50/50 of an odd amount puts the extra penny on the first milestone", () => {
    const r = allocateMilestones(999, [
      { key: "half1", label: "First half", percent: 50 },
      { key: "half2", label: "Second half", percent: 50 },
    ]);
    if (!r.ok) throw new Error("expected ok");
    expect(r.value.milestones.map((m) => m.amountMinor)).toEqual([500, 499]);
  });

  it("refuses percentages that do not total 100, duplicate keys and non-integer totals", () => {
    expect(
      allocateMilestones(100, [
        { key: "a", label: "a", percent: 60 },
        { key: "b", label: "b", percent: 30 },
      ]).ok
    ).toBe(false);
    expect(
      allocateMilestones(100, [
        { key: "a", label: "a", percent: 50 },
        { key: "a", label: "b", percent: 50 },
      ]).ok
    ).toBe(false);
    expect(allocateMilestones(100.5, [{ key: "a", label: "a", percent: 100 }]).ok).toBe(
      false
    );
    expect(allocateMilestones(100, []).ok).toBe(false);
    const r = allocateMilestones(100, [
      { key: "a", label: "a", percent: 60 },
      { key: "b", label: "b", percent: 30 },
    ]);
    if (r.ok) throw new Error("expected problems");
    expect(r.problems.map((p) => p.code)).toContain("percent_sum");
  });

  it("a milestone with 0% is allowed and gets nothing", () => {
    const r = allocateMilestones(100, [
      { key: "a", label: "a", percent: 100 },
      { key: "b", label: "b", percent: 0 },
    ]);
    if (!r.ok) throw new Error("expected ok");
    expect(r.value.milestones.map((m) => m.amountMinor)).toEqual([100, 0]);
  });
});

describe("applyTax and floorToStep", () => {
  it("rounds tax half-up in integer arithmetic and keeps gross = net + tax", () => {
    const r = applyTax(1_234_5, { codeRef: "OUTPUT2", rateBps: 2000 }); // £123.45 @ 20% = £24.69
    if (!r.ok) throw new Error("expected ok");
    expect(r.value).toEqual({ netMinor: 12345, taxMinor: 2469, grossMinor: 14814 });
    const half = applyTax(25, { codeRef: "OUTPUT2", rateBps: 2000 }); // 5.0 → 5
    if (!half.ok) throw new Error("expected ok");
    expect(half.value.taxMinor).toBe(5);
    const up = applyTax(3, { codeRef: "OUTPUT2", rateBps: 2000 }); // 0.6 → 1
    if (!up.ok) throw new Error("expected ok");
    expect(up.value.taxMinor).toBe(1);
  });

  it("pending tax is zero tax but is still marked pending", () => {
    const r = applyTax(60000, PENDING_TAX);
    if (!r.ok) throw new Error("expected ok");
    expect(r.value).toEqual({ netMinor: 60000, taxMinor: 0, grossMinor: 60000 });
    expect(PENDING_TAX.codeRef).toBe("pending_decision");
  });

  it("floor rounding never falls below the configured minimum (§17.2)", () => {
    expect(floorToStep(12_345, 100, 0)).toBe(12_300);
    expect(floorToStep(12_345, 100, 12_400)).toBe(12_400);
    expect(floorToStep(50, 100, 100)).toBe(100);
  });
});

/** §12.3: "Partial payments reduce the correct obligation; refunds/credits are distinct typed operations." */
describe("obligationBalance — typed allocations", () => {
  const ob: Pick<
    ObligationRecord,
    "id" | "currency" | "amountGrossMinor" | "state" | "issueAt"
  > = {
    id: "ob-1",
    currency: "GBP",
    amountGrossMinor: 100_000,
    state: "issued",
    issueAt: "2026-09-01T00:00:00Z",
  };
  const alloc = (
    kind: AllocationRecord["kind"],
    amountMinor: number,
    id: string = kind,
    obligationId = "ob-1"
  ): AllocationRecord => ({
    id,
    obligationId,
    invoiceId: null,
    provider: "bank",
    providerPaymentId: `bank-${id}`,
    kind,
    amountMinor,
    currency: "GBP",
    allocatedAt: "2026-09-10T00:00:00Z",
  });

  it("nothing allocated: issued stays issued, pending stays pending", () => {
    expect(obligationBalance(ob, []).derivedState).toBe("issued");
    expect(
      obligationBalance({ ...ob, state: "pending", issueAt: null }, []).derivedState
    ).toBe("pending");
  });

  it("a partial payment reduces the right obligation and only that one", () => {
    const b = obligationBalance(ob, [
      alloc("payment", 40_000),
      alloc("payment", 99_999, "other", "ob-2"),
    ]);
    expect(b.paymentsMinor).toBe(40_000);
    expect(b.remainingMinor).toBe(60_000);
    expect(b.derivedState).toBe("part_paid");
  });

  it("a split transfer (two payments) settles it", () => {
    const b = obligationBalance(ob, [
      alloc("payment", 40_000, "p1"),
      alloc("payment", 60_000, "p2"),
    ]);
    expect(b.remainingMinor).toBe(0);
    expect(b.derivedState).toBe("paid");
  });

  it("refund, chargeback and bank return are typed reversals, not negative payments", () => {
    const b = obligationBalance(ob, [
      alloc("payment", 100_000, "p1"),
      alloc("refund", 10_000, "r1"),
      alloc("chargeback", 5_000, "c1"),
      alloc("bank_return", 2_000, "b1"),
    ]);
    expect(b.paymentsMinor).toBe(100_000);
    expect(b.refundsMinor).toBe(10_000);
    expect(b.chargebacksMinor).toBe(5_000);
    expect(b.bankReturnsMinor).toBe(2_000);
    expect(b.netPaidMinor).toBe(83_000);
    expect(b.remainingMinor).toBe(17_000);
    expect(b.derivedState).toBe("part_paid");
  });

  it("a credit note settles without money moving and is reported separately", () => {
    const b = obligationBalance(ob, [
      alloc("payment", 90_000, "p1"),
      alloc("credit", 10_000, "cn1"),
    ]);
    expect(b.creditsMinor).toBe(10_000);
    expect(b.netPaidMinor).toBe(90_000);
    expect(b.settledMinor).toBe(100_000);
    expect(b.derivedState).toBe("paid");
  });

  it("an overpayment is visible and never hidden", () => {
    const b = obligationBalance(ob, [alloc("payment", 120_000)]);
    expect(b.remainingMinor).toBe(-20_000);
    expect(b.overpaymentMinor).toBe(20_000);
    expect(b.derivedState).toBe("paid");
  });

  it("void and disputed are human states and are never derived away", () => {
    expect(
      obligationBalance({ ...ob, state: "void" }, [alloc("payment", 100_000)])
        .derivedState
    ).toBe("void");
    expect(
      obligationBalance({ ...ob, state: "disputed" }, [alloc("payment", 100_000)])
        .derivedState
    ).toBe("disputed");
  });

  it("allocations in another currency are excluded, not silently summed", () => {
    const b = obligationBalance(ob, [{ ...alloc("payment", 100_000), currency: "EUR" }]);
    expect(b.excluded).toHaveLength(1);
    expect(b.paymentsMinor).toBe(0);
  });
});

/** §12.3: "One provider payment cannot be allocated twice beyond its available amount." */
describe("allocationCeiling (mirrors trg_payment_allocations_guard)", () => {
  const recorded = {
    provider: "bank",
    providerPaymentId: "TX-1",
    kind: "payment",
    amountMinor: 50_000,
    currency: "GBP",
  };

  it("allows a split up to the recorded amount and refuses one penny more", () => {
    const existing = [
      {
        provider: "bank",
        providerPaymentId: "TX-1",
        kind: "payment",
        amountMinor: 30_000,
      },
    ];
    expect(allocationCeiling(recorded, existing, 20_000).allowed).toBe(true);
    const over = allocationCeiling(recorded, existing, 20_001);
    expect(over.allowed).toBe(false);
    expect(over.availableMinor).toBe(20_000);
    expect(over.reason).toMatch(/50000/);
  });

  it("ignores allocations of other payments or other kinds", () => {
    const existing = [
      {
        provider: "bank",
        providerPaymentId: "TX-2",
        kind: "payment",
        amountMinor: 50_000,
      },
      {
        provider: "bank",
        providerPaymentId: "TX-1",
        kind: "refund",
        amountMinor: 50_000,
      },
    ];
    expect(allocationCeiling(recorded, existing, 50_000).allowed).toBe(true);
  });
});

describe("spreadPayment — several invoices in one transfer", () => {
  const debts = [
    { obligationId: "b", remainingMinor: 30_000, currency: "GBP", dueAt: "2026-09-20" },
    { obligationId: "a", remainingMinor: 20_000, currency: "GBP", dueAt: "2026-09-10" },
    { obligationId: "c", remainingMinor: 10_000, currency: "GBP", dueAt: null },
  ];

  it("fills oldest due first and reports the leftover", () => {
    const r = spreadPayment(55_000, "GBP", debts);
    if (!r.ok) throw new Error("expected ok");
    expect(r.value.allocations).toEqual([
      { obligationId: "a", amountMinor: 20_000 },
      { obligationId: "b", amountMinor: 30_000 },
      { obligationId: "c", amountMinor: 5_000 },
    ]);
    expect(r.value.unallocatedMinor).toBe(0);
    const over = spreadPayment(70_000, "GBP", debts);
    if (!over.ok) throw new Error("expected ok");
    expect(over.value.unallocatedMinor).toBe(10_000);
  });

  it("refuses a currency mismatch", () => {
    expect(spreadPayment(1_000, "EUR", debts).ok).toBe(false);
  });
});

describe("planBuildMilestones — from an accepted Order Form snapshot", () => {
  const base = {
    tenantId: "00000000-0000-4000-8000-000000000001",
    projectId: "00000000-0000-4000-8000-000000000002",
    sourceKind: "order_form" as const,
    sourceId: "00000000-0000-4000-8000-000000000003",
    totalNetMinor: 1_000_000, // £10,000.00
    currency: "GBP",
    shares: [
      { key: "deposit", label: "Deposit", percent: 40 },
      { key: "midpoint", label: "Midpoint", percent: 30 },
      { key: "completion", label: "Completion", percent: 30 },
    ],
    tax: { codeRef: "OUTPUT2", rateBps: 2000 },
    orchestrator: "xero_native" as const,
  };

  it("one pending obligation per milestone, stable keys, net sums to the accepted amount", () => {
    const r = planBuildMilestones(base);
    if (!r.ok) throw new Error("expected ok");
    expect(r.rows).toHaveLength(3);
    expect(r.rows.map((x) => x.milestone_key)).toEqual([
      "deposit",
      "midpoint",
      "completion",
    ]);
    expect(r.rows.reduce((t, x) => t + x.amount_net_minor, 0)).toBe(1_000_000);
    for (const row of r.rows) {
      expect(row.kind).toBe("build_milestone");
      expect(row.state).toBe("pending");
      expect(row.amount_gross_minor).toBe(row.amount_net_minor + row.tax_minor);
      expect(row.orchestrator).toBe("xero_native");
      expect(row.source_id).toBe(base.sourceId);
    }
  });

  it("replaying the plan produces identical rows (the unique index then refuses the duplicate)", () => {
    expect(planBuildMilestones(base)).toEqual(planBuildMilestones(base));
  });

  it("reports a per-milestone tax rounding difference instead of hiding it", () => {
    const r = planBuildMilestones({
      ...base,
      totalNetMinor: 1_001,
      shares: [
        { key: "a", label: "a", percent: 33.33 },
        { key: "b", label: "b", percent: 33.33 },
        { key: "c", label: "c", percent: 33.34 },
      ],
    });
    if (!r.ok) throw new Error("expected ok");
    const taxSum = r.rows.reduce((t, x) => t + x.tax_minor, 0);
    expect(r.rows.reduce((t, x) => t + x.amount_net_minor, 0)).toBe(1_001);
    if (taxSum !== 200)
      expect(r.notes.some((n) => /rounding difference/.test(n))).toBe(true);
  });

  it("pending tax is allowed to plan but blocks issue", () => {
    const r = planBuildMilestones({ ...base, tax: PENDING_TAX });
    if (!r.ok) throw new Error("expected ok");
    expect(r.notes.some((n) => /pending decision/.test(n))).toBe(true);
    const o: Parameters<typeof issueBlockers>[0] = {
      state: "pending",
      taxCodeRef: r.rows[0].tax_code_ref,
      amountNetMinor: r.rows[0].amount_net_minor,
      taxMinor: r.rows[0].tax_minor,
      amountGrossMinor: r.rows[0].amount_gross_minor,
      currency: "GBP",
      orchestrator: "manual",
    };
    expect(issueBlockers(o).map((b) => b.code)).toContain("tax_pending");
    expect(issueBlockers({ ...o, taxCodeRef: "OUTPUT2" })).toEqual([]);
    expect(
      issueBlockers({ ...o, taxCodeRef: "OUTPUT2", state: "issued" }).map((b) => b.code)
    ).toContain("not_pending");
  });

  it("refuses a missing project or a bad split", () => {
    expect(planBuildMilestones({ ...base, projectId: "" }).ok).toBe(false);
    expect(
      planBuildMilestones({ ...base, shares: [{ key: "x", label: "x", percent: 90 }] }).ok
    ).toBe(false);
  });
});

describe("planServicePeriods — from the accepted schedule snapshot", () => {
  const accepted = {
    packageCode: "managed_pro",
    catalogueRef: null,
    inclusions: ["hosting"],
    exclusions: [],
    usagePolicy: {},
    amountMinor: 24_900,
    currency: "GBP",
    taxBasis: "standard_vat" as const,
    cadence: "monthly" as const,
    startDate: "2026-10-31",
    noticeDays: 30,
    cancellationTermsRef: "terms-v1",
    responseTargets: {},
  };
  const base = {
    tenantId: "00000000-0000-4000-8000-000000000001",
    projectId: null,
    arrangementId: "00000000-0000-4000-8000-000000000004",
    sourceId: "00000000-0000-4000-8000-000000000005",
    accepted,
    scheduleStatus: "accepted" as const,
    documentHash: "a".repeat(64),
    periods: 3,
    tax: { codeRef: "OUTPUT2", rateBps: 2000 },
    orchestrator: "nullshift_gocardless" as const,
  };

  it("stable (arrangement, period_start) identity; month-end dates clamp correctly", () => {
    const r = planServicePeriods(base);
    if (!r.ok) throw new Error("expected ok");
    expect(r.rows.map((x) => [x.period_start, x.period_end])).toEqual([
      ["2026-10-31", "2026-11-30"],
      ["2026-11-30", "2026-12-30"],
      ["2026-12-30", "2027-01-30"],
    ]);
    for (const row of r.rows) {
      expect(row.kind).toBe("service_period");
      expect(row.arrangement_id).toBe(base.arrangementId);
      expect(row.amount_net_minor).toBe(24_900);
      expect(row.tax_minor).toBe(4_980);
      expect(row.amount_gross_minor).toBe(29_880);
      expect(row.collection_policy).toBe("direct_debit");
    }
  });

  it("quarterly and annual cadences advance by 3 and 12 months", () => {
    const q = planServicePeriods({
      ...base,
      periods: 2,
      accepted: { ...accepted, cadence: "quarterly", startDate: "2026-01-15" },
    });
    if (!q.ok) throw new Error("expected ok");
    expect(q.rows.map((x) => x.period_end)).toEqual(["2026-04-15", "2026-07-15"]);
    const a = planServicePeriods({
      ...base,
      periods: 1,
      accepted: { ...accepted, cadence: "annual", startDate: "2028-02-29" },
    });
    if (!a.ok) throw new Error("expected ok");
    expect(a.rows[0].period_end).toBe("2029-02-28");
  });

  it("refuses a schedule that is not chargeable: not accepted, no hash, inexact amount", () => {
    expect(planServicePeriods({ ...base, scheduleStatus: "issued" }).ok).toBe(false);
    expect(planServicePeriods({ ...base, documentHash: null }).ok).toBe(false);
    const r = planServicePeriods({
      ...base,
      accepted: { ...accepted, amountMinor: null },
    });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("expected problems");
    expect(r.problems.some((p) => p.code.startsWith("not_chargeable:"))).toBe(true);
  });

  it("caps how many periods can be planned at once", () => {
    expect(planServicePeriods({ ...base, periods: 13 }).ok).toBe(false);
    expect(planServicePeriods({ ...base, periods: 0 }).ok).toBe(false);
  });

  it("addMonths is pure string maths", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-12-01", 1)).toBe("2027-01-01");
    expect(addMonths("2026-03-15", -3)).toBe("2025-12-15");
  });
});

describe("planHandoverFee — the £600 independent handover fee", () => {
  const base = {
    tenantId: "00000000-0000-4000-8000-000000000001",
    projectId: "00000000-0000-4000-8000-000000000002",
    arrangementId: "00000000-0000-4000-8000-000000000004",
    sourceId: "00000000-0000-4000-8000-000000000006",
    accepted: {
      feeMinor: HANDOVER_FEE_MINOR,
      currency: "GBP",
      taxBasis: "pending" as const,
      includedWork: ["repo transfer"],
      dependencies: [],
      costResponsibility: {},
      feeDisposition: "stop" as const,
    },
    scheduleStatus: "accepted" as const,
    orchestrator: "manual" as const,
  };

  it("records the debt with tax basis pending decision and the stable key 'handover'", () => {
    const r = planHandoverFee(base);
    if (!r.ok) throw new Error("expected ok");
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].kind).toBe("handover_fee");
    expect(r.rows[0].milestone_key).toBe("handover");
    expect(r.rows[0].amount_net_minor).toBe(60_000);
    expect(r.rows[0].tax_code_ref).toBe("pending_decision");
    expect(r.notes.some((n) => /18\.3/.test(n))).toBe(true);
  });

  it("a caller's approved tax does not override a snapshot whose basis is still pending", () => {
    const r = planHandoverFee(base, { codeRef: "OUTPUT2", rateBps: 2000 });
    if (!r.ok) throw new Error("expected ok");
    expect(r.rows[0].tax_code_ref).toBe("pending_decision");
    const decided = planHandoverFee(
      { ...base, accepted: { ...base.accepted, taxBasis: "standard_vat" } },
      { codeRef: "OUTPUT2", rateBps: 2000 }
    );
    if (!decided.ok) throw new Error("expected ok");
    expect(decided.rows[0].tax_minor).toBe(12_000);
  });

  it("refuses an unaccepted schedule or an undecided fee disposition", () => {
    expect(planHandoverFee({ ...base, scheduleStatus: "issued" }).ok).toBe(false);
    expect(
      planHandoverFee({
        ...base,
        accepted: { ...base.accepted, feeDisposition: "pending" },
      }).ok
    ).toBe(false);
  });
});

/** §5.6: "A retry must say what it will do; it must not accidentally charge again while retrying an accounting sync." */
describe("finance exceptions — safe retry never collects", () => {
  const exception: ExceptionRecord = {
    id: "00000000-0000-4000-8000-0000000000ee",
    tenantId: "00000000-0000-4000-8000-000000000001",
    kind: "link_closure_failed",
    severity: "urgent",
    obligationId: "00000000-0000-4000-8000-0000000000ab",
    invoiceId: null,
    subscriptionId: null,
    activationId: null,
    externalRef: null,
    title: "Marked paid by bank transfer; Stripe hosted invoice still open",
    detail: null,
    owner: null,
    state: "open",
    attempts: [],
    safeRetryOp: "close_payment_link",
    safeRetrySummary: null,
    resolutionEvidence: [],
    openedAt: "2026-09-17T09:00:00Z",
    resolvedAt: null,
  };

  it("every operation on the closed list is non-collecting", () => {
    for (const op of Object.keys(SAFE_RETRY_OPS))
      expect(retryNeverCollects(op)).toEqual({ ok: true });
  });

  it("anything that names collection, charging or refunding is refused even if someone adds it", () => {
    for (const op of [
      "collect",
      "create_payment",
      "charge",
      "schedule_collection",
      "refund",
      "create_subscription",
      "transfer",
      "not_a_thing",
    ])
      expect(retryNeverCollects(op).ok).toBe(false);
  });

  it("a proposal says what it will do, what it never does, and carries movesMoney: false", () => {
    const p = proposeRetry(exception);
    if (!p.allowed) throw new Error(p.reason);
    expect(p.summary).toMatch(/^Will: /);
    expect(p.summary).toMatch(/cannot be paid twice/);
    expect(p.never).toBe(NEVER_TEXT);
    expect(p.operation.movesMoney).toBe(false);
    expect(p.operation.executeIn).toBe("worker");
    expect(p.operation.idempotencyKey).toBe(`exception:${exception.id}:attempt:1`);
    const after = proposeRetry({
      ...exception,
      attempts: [{ at: "x", by: "y", action: "a", outcome: "o" }],
    });
    if (!after.allowed) throw new Error(after.reason);
    expect(after.operation.idempotencyKey).toBe(`exception:${exception.id}:attempt:2`);
  });

  it("refuses a resolved exception, a missing retry, or an op that does not fit the kind", () => {
    expect(proposeRetry({ ...exception, state: "resolved" }).allowed).toBe(false);
    expect(proposeRetry({ ...exception, safeRetryOp: null }).allowed).toBe(false);
    expect(proposeRetry({ ...exception, kind: "xero_outage" }).allowed).toBe(false);
    expect(
      proposeRetry({
        ...exception,
        kind: "xero_outage",
        safeRetryOp: "xero_allocate_payment",
      }).allowed
    ).toBe(true);
  });

  it("planOpen needs a subject and a title, and refuses an unsafe retry", () => {
    const ok = planOpen({
      tenantId: exception.tenantId,
      kind: "unmatched_payout",
      title: "Payout PO-1 unmatched",
      externalRef: "PO-1",
      safeRetryOp: "rematch_payout",
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.row.state).toBe("open");
      expect(ok.row.safe_retry_summary).toBe(SAFE_RETRY_OPS.rematch_payout.does);
    }
    expect(planOpen({ tenantId: null, kind: "other", title: "No subject" }).ok).toBe(
      false
    );
    const bad = planOpen({
      tenantId: null,
      kind: "unmatched_payout",
      title: "x",
      externalRef: "PO-1",
      safeRetryOp: "collect" as never,
    });
    expect(bad.ok).toBe(false);
    expect(
      planOpen({
        tenantId: null,
        kind: "failed_collection",
        title: "Wrong retry",
        externalRef: "PM-1",
        safeRetryOp: "xero_create_invoice",
      }).ok
    ).toBe(false);
  });

  it("assign → in_progress; attempts append only; resolve needs evidence; resolved is terminal", () => {
    const assigned = planAssign(exception, "  louis  ");
    if (!assigned.ok) throw new Error(assigned.reason);
    expect(assigned.patch).toEqual({ owner: "louis", state: "in_progress" });
    expect(planAssign(exception, " ").ok).toBe(false);

    const first = {
      at: "2026-09-17T10:00:00Z",
      by: "louis",
      action: "retry_proposed:close_payment_link",
      outcome: "queued_for_worker",
    };
    const a1 = planAttempt(exception, first);
    if (!a1.ok) throw new Error(a1.reason);
    const second = {
      at: "2026-09-17T11:00:00Z",
      by: "louis",
      action: "worker:close_payment_link",
      outcome: "provider_refused",
    };
    const a2 = planAttempt({ ...exception, attempts: a1.patch.attempts }, second);
    if (!a2.ok) throw new Error(a2.reason);
    expect(a2.patch.attempts.slice(0, 1)).toEqual([first]);
    expect(a2.patch.attempts).toHaveLength(2);

    expect(
      planResolve(exception, {
        at: "t",
        by: "louis",
        kind: "provider_confirmation",
        note: "",
      }).ok
    ).toBe(false);
    const done = planResolve(exception, {
      at: "2026-09-17T12:00:00Z",
      by: "louis",
      kind: "provider_confirmation",
      ref: "in_123",
      note: "Hosted invoice voided; confirmed in dashboard.",
    });
    if (!done.ok) throw new Error(done.reason);
    expect(done.patch.state).toBe("resolved");
    expect(done.patch.resolution_evidence).toHaveLength(1);

    const resolved = { ...exception, state: "resolved" as const };
    expect(planAssign(resolved, "louis").ok).toBe(false);
    expect(planAttempt(resolved, first).ok).toBe(false);
    expect(planResolve(resolved, done.patch.resolution_evidence[0]).ok).toBe(false);
  });
});
