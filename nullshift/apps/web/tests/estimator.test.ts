import { describe, expect, it } from "vitest";
import {
  CATALOGUE,
  CATALOGUE_PUBLISHED_VERSION,
  HANDOVER_FEE,
  POLICY_2026_09_DRAFT,
  POLICY_2026_09_v1,
  RUN_PACKAGE_BASE_MINOR,
  policyById,
  allocateMilestones,
  calculateEstimate,
  ceilToIncrement,
  estimateInputFromQuote,
  hasBlockers,
  known,
  marginFromMarkup,
  marginPctOf,
  markupFromMargin,
  money,
  priceForMargin,
  toClientView,
  unknown,
  validateEstimate,
  validatePolicy,
  type CommercialPolicy,
  type EstimateInput,
  type WorkPackage,
} from "@/lib/estimator";
import { BASE_PLAN_PRICE } from "@/lib/pricing/nsi";
import { QUOTES, quoteById } from "@/lib/next/fixtures";

const policy = POLICY_2026_09_v1;

const pkg = (over: Partial<WorkPackage> = {}): WorkPackage => ({
  id: "impl",
  name: "Implementation",
  roleId: "engineer",
  owner: "Engineer",
  hours: known({ low: 80, base: 100, high: 120 }),
  externalCosts: money(0),
  assumptions: [],
  source: "test",
  confidence: "medium",
  ...over,
});

/** A minimal priced estimate: 100 h × £45 = £4,500 base; contingency 0; warranty £500 → £5,000 risk-adjusted. */
const baseInput = (over: Partial<EstimateInput> = {}): EstimateInput => ({
  id: "t-1",
  currency: "GBP",
  policyId: policy.id,
  facts: [],
  packages: [pkg()],
  contractors: known(money(0)),
  attributableProjectCosts: known(money(0)),
  contingencyPct: 0,
  warrantyReserve: money(50_000),
  build: {
    milestones: [],
    validityDays: 30,
    exclusions: [],
    assumptions: [],
    acceptanceCriteria: [],
  },
  selling: { listPrice: unknown("none"), discounts: [] },
  run: {
    route: "unresolved",
    stage: "recommendation",
    packageChoice: unknown("deferred"),
    costToServe: [],
    usageLimits: [],
  },
  grow: [],
  transact: {
    applicable: known(false),
    feeBps: unknown("n/a"),
    processorFeesSeparate: true,
    volumeScenarios: [],
  },
  ...over,
});

const priced = (input: EstimateInput) => {
  const r = calculateEstimate(input, policy);
  if (r.build.state !== "priced") throw new Error("expected priced");
  return { r, b: r.build };
};

describe("§6.2 worked examples", () => {
  it("£5,000 risk-adjusted cost at 50% target implies £10,000", () => {
    const { b } = priced(baseInput());
    expect(b.internalEstimateMinor).toBe(500_000);
    expect(b.targetMinor).toBe(1_000_000);
    expect(priceForMargin(500_000, 50)).toBe(1_000_000);
  });

  it("£100 monthly cost at 60% target run margin implies £250/month", () => {
    const r = calculateEstimate(
      baseInput({
        run: {
          route: "managed",
          stage: "recommendation",
          packageChoice: unknown("deferred"),
          costToServe: [
            {
              kind: "money",
              id: "h",
              name: "Hosting",
              category: "infrastructure",
              monthly: known(money(10_000)),
              sensitivity: "fixed",
              payer: "nullshift",
            },
          ],
          usageLimits: [],
        },
      }),
      policy
    );
    expect(r.run.monthlyCostToServeMinor).toBe(10_000);
    expect(r.run.targetMinor).toBe(25_000);
    expect(r.run.floorMinor).toBe(20_000);
  });

  it("×1.75 markup is a 42.9% margin, not 75%", () => {
    expect(marginFromMarkup(75)).toBe(42.9);
    expect(markupFromMargin(42.9)).toBeCloseTo(75.1, 0);
    expect(markupFromMargin(50)).toBe(100);
    expect(marginPctOf(175_000, 100_000)).toBe(42.9);
  });
});

describe("§17.3 deterministic versioned outputs", () => {
  it("same inputs and policy give deep-equal, frozen results with the policy snapshot", () => {
    const a = calculateEstimate(baseInput(), policy);
    const b = calculateEstimate(baseInput(), policy);
    expect(a).toEqual(b);
    expect(Object.isFrozen(a)).toBe(true);
    expect(Object.isFrozen(a.build)).toBe(true);
    expect(a.policy.id).toBe("POLICY_2026_09_v1");
    expect(a.policy.state).toBe("published");
    expect(a.policy.effectiveDate).toBe("2026-09-20");
    expect(a.policy.runPackageBaseMinor).toEqual({ core: 14_900, pro: 24_900, max: 39_900 });
  });

  it("a new policy changes new assessments only; an existing result keeps its numbers", () => {
    const before = calculateEstimate(baseInput(), policy);
    const newer: CommercialPolicy = {
      ...policy,
      id: "POLICY_TEST_NEWER",
      targetMarginPct: 70,
      minMarginPct: 60,
    };
    const after = calculateEstimate(baseInput({ policyId: newer.id }), newer);
    expect(before.build.state === "priced" && before.build.targetMinor).toBe(1_000_000);
    expect(after.build.state === "priced" && after.build.targetMinor).toBe(1_670_000);
    expect(before.policy.targetMarginPct).toBe(50);
    expect(() => {
      (before.policy as { targetMarginPct: number }).targetMarginPct = 70;
    }).toThrow();
  });
});

describe("§17.3 validation of inputs and policy", () => {
  it("rejects negative and nonfinite costs with field errors", () => {
    const input = baseInput({
      packages: [
        pkg({ externalCosts: money(-5) }),
        pkg({ id: "x", name: "X", hours: known({ low: Number.NaN, base: 1, high: 2 }) }),
      ],
      warrantyReserve: money(Number.POSITIVE_INFINITY),
    });
    const issues = validateEstimate(input, policy, calculateEstimate(input, policy));
    const msgs = issues
      .filter((i) => i.code === "value_nonneg_finite")
      .map((i) => i.message);
    expect(msgs.some((m) => m.includes("Implementation external costs"))).toBe(true);
    expect(msgs.some((m) => m.includes("X: low hours"))).toBe(true);
    expect(msgs.some((m) => m.includes("Warranty reserve"))).toBe(true);
    expect(hasBlockers(issues)).toBe(true);
  });

  it("rejects minimum margin above target and margins at or above 100%", () => {
    expect(
      validatePolicy({ ...policy, minMarginPct: 60, targetMarginPct: 50 }).some(
        (i) => i.code === "policy_margin_range" && i.message.startsWith("Build")
      )
    ).toBe(true);
    expect(
      validatePolicy({ ...policy, minRunMarginPct: 10, targetRunMarginPct: 100 }).some(
        (i) => i.code === "policy_margin_range" && i.message.startsWith("Run")
      )
    ).toBe(true);
    expect(
      validatePolicy({ ...policy, minMarginPct: -1 }).some(
        (i) => i.code === "policy_margin_range"
      )
    ).toBe(true);
    expect(validatePolicy(policy).filter((i) => i.severity === "block")).toEqual([]);
    expect(() => priceForMargin(1, 100)).toThrow(RangeError);
  });

  it("rejects inverted low/base/high ranges naming the package", () => {
    const input = baseInput({
      packages: [pkg({ hours: known({ low: 120, base: 100, high: 80 }) })],
    });
    const issues = validateEstimate(input, policy, calculateEstimate(input, policy));
    const hit = issues.find((i) => i.code === "range_order");
    expect(hit?.severity).toBe("block");
    expect(hit?.message).toContain("Implementation");
  });

  it("never coerces a missing input to zero: it is Unknown and requires discovery", () => {
    const input = baseInput({
      packages: [
        pkg(),
        pkg({
          id: "mig",
          name: "Data migration",
          hours: unknown("Migration volume not yet known"),
        }),
      ],
      contractors: unknown("Contractor quote awaited"),
    });
    const r = calculateEstimate(input, policy);
    expect(r.confidence).toBe("insufficient");
    expect(r.discoveryRequired).toBe(true);
    expect(r.build.state).toBe("insufficient_confidence");
    if (r.build.state !== "insufficient_confidence") throw new Error();
    expect(r.build.scenarios).toBeNull();
    expect(r.build.unknowns.map((u) => u.label)).toEqual([
      "Data migration — hours",
      "Contractors",
    ]);
    expect(JSON.stringify(r.build)).not.toContain("floorMinor");
    const issues = validateEstimate(input, policy, r);
    expect(issues.find((i) => i.code === "insufficient_confidence")?.severity).toBe(
      "block"
    );
  });

  it("a material Unknown fact blocks pricing even when every package is estimated", () => {
    const input = baseInput({
      facts: [
        {
          key: "m",
          label: "Migration volume",
          value: unknown("Not supplied"),
          material: true,
        },
      ],
    });
    expect(calculateEstimate(input, policy).build.state).toBe("insufficient_confidence");
    const immaterial = baseInput({
      facts: [
        { key: "m", label: "Logo file", value: unknown("Not supplied"), material: false },
      ],
    });
    expect(calculateEstimate(immaterial, policy).build.state).toBe("priced");
  });

  it("an Unknown cost-to-serve line yields no run floor rather than a smaller one", () => {
    const r = calculateEstimate(
      baseInput({
        run: {
          route: "managed",
          stage: "recommendation",
          packageChoice: unknown("deferred"),
          costToServe: [
            {
              kind: "money",
              id: "h",
              name: "Hosting",
              category: "infrastructure",
              monthly: known(money(3_000)),
              sensitivity: "fixed",
              payer: "nullshift",
            },
            {
              kind: "money",
              id: "ai",
              name: "AI usage",
              category: "apis_ai",
              monthly: unknown("Volume unknown"),
              sensitivity: "usage",
              payer: "nullshift",
            },
          ],
          usageLimits: [],
        },
      }),
      policy
    );
    expect(r.run.monthlyCostToServeMinor).toBeNull();
    expect(r.run.floorMinor).toBeNull();
    expect(r.run.unknowns[0]?.label).toBe("AI usage");
  });
});

describe("§17.3 zero price, margin display, rounding, caps", () => {
  it("zero selling price gives an undefined (null) margin, never NaN or Infinity", () => {
    const { b } = priced(
      baseInput({
        selling: { listPrice: known(money(0)), discounts: [], approvedBy: "Louis" },
      })
    );
    expect(b.contribution?.marginPct).toBeNull();
    expect(b.contribution?.contributionMinor).toBe(-500_000);
    expect(marginPctOf(0, 500_000)).toBeNull();
    expect(JSON.stringify(b.contribution)).not.toMatch(/NaN|Infinity/);
  });

  it("floors and targets are rounded UP to the increment and never below the exact minimum", () => {
    // 100 h × £45 + 12% contingency + £400 warranty: exact floor 40% is not a multiple of £100.
    const { b } = priced(
      baseInput({ contingencyPct: 12, warrantyReserve: money(40_000) })
    );
    const base = b.scenarios.base;
    expect(base.riskAdjustedDeliveryCostMinor).toBe(450_000 + 54_000 + 40_000);
    expect(base.floorExactMinor).toBe(Math.ceil((544_000 * 100) / 60));
    expect(base.floorMinor % policy.roundingIncrementMinor).toBe(0);
    expect(base.floorMinor).toBeGreaterThanOrEqual(base.floorExactMinor);
    expect(
      marginPctOf(base.floorMinor, base.riskAdjustedDeliveryCostMinor)
    ).toBeGreaterThanOrEqual(policy.minMarginPct);
    expect(ceilToIncrement(1, 10_000)).toBe(10_000);
    expect(ceilToIncrement(10_000, 10_000)).toBe(10_000);
    for (const cost of [1, 99, 12_345, 987_654_321]) {
      const floor = ceilToIncrement(priceForMargin(cost, 40), 10_000);
      expect(floor * 60).toBeGreaterThanOrEqual(cost * 100);
    }
  });

  it("large estimates escalate for review and are never capped to £15,000 or £900", () => {
    const { b, r } = priced(
      baseInput({
        packages: [pkg({ hours: known({ low: 800, base: 1_000, high: 1_200 }) })],
      })
    );
    expect(b.internalEstimateMinor).toBe(4_550_000);
    expect(b.targetMinor).toBe(9_100_000);
    expect(b.targetMinor).toBeGreaterThan(1_500_000);
    expect(b.escalation.required).toBe(true);
    const issues = validateEstimate(
      baseInput({
        packages: [pkg({ hours: known({ low: 800, base: 1_000, high: 1_200 }) })],
      }),
      policy,
      r
    );
    const esc = issues.find((i) => i.code === "escalate_large_estimate");
    expect(esc?.severity).toBe("review");
    expect(esc?.message).toContain("not capped");
    const run = calculateEstimate(
      baseInput({
        run: {
          route: "managed",
          stage: "recommendation",
          packageChoice: unknown("d"),
          costToServe: [
            {
              kind: "money",
              id: "h",
              name: "Hosting",
              category: "infrastructure",
              monthly: known(money(200_000)),
              sensitivity: "fixed",
              payer: "nullshift",
            },
          ],
          usageLimits: [],
        },
      }),
      policy
    );
    expect(run.run.targetMinor).toBe(500_000);
    expect(run.run.targetMinor).toBeGreaterThan(90_000);
  });
});

describe("§17.3 risk allowances counted once", () => {
  it("adds contingency and warranty once, and skips the reserve when a package covers warranty", () => {
    const withReserve = priced(baseInput({ contingencyPct: 10 })).b.scenarios.base;
    expect(withReserve.contingencyMinor).toBe(45_000);
    expect(withReserve.warrantyReserveMinor).toBe(50_000);
    expect(withReserve.riskAdjustedDeliveryCostMinor).toBe(450_000 + 45_000 + 50_000);

    const covered = priced(
      baseInput({
        contingencyPct: 10,
        packages: [
          pkg(),
          pkg({
            id: "w",
            name: "Warranty period",
            hours: known({ low: 8, base: 10, high: 12 }),
            coversWarranty: true,
          }),
        ],
      })
    ).b;
    const base = covered.scenarios.base;
    expect(base.warrantyReserveMinor).toBe(0);
    expect(base.baseDeliveryCostMinor).toBe(450_000 + 45_000);
    expect(base.riskAdjustedDeliveryCostMinor).toBe(495_000 + Math.ceil(495_000 * 0.1));
    expect(covered.drivers.find((d) => d.kind === "warranty")?.explanation).toContain(
      "Not added"
    );
  });

  it("two packages both claiming warranty is rejected", () => {
    const input = baseInput({
      packages: [
        pkg({ coversWarranty: true }),
        pkg({ id: "w", name: "W", coversWarranty: true }),
      ],
    });
    expect(
      validateEstimate(input, policy, calculateEstimate(input, policy)).some(
        (i) => i.code === "warranty_double_count"
      )
    ).toBe(true);
  });
});

describe("§17.3 below-floor prices, approvals and discounts", () => {
  const belowFloor = (selling: EstimateInput["selling"]) => {
    const input = baseInput({ selling });
    return validateEstimate(input, policy, calculateEstimate(input, policy));
  };

  it("a below-floor price without an approver and reason blocks", () => {
    const issues = belowFloor({ listPrice: known(money(700_000)), discounts: [] });
    const hit = issues.find((i) => i.code === "below_floor");
    expect(hit?.severity).toBe("block");
    expect(hit?.effect).toContain("approver and reason");
  });

  it("an approver without a reason still blocks; approver plus reason becomes a recorded review item", () => {
    expect(
      belowFloor({
        listPrice: known(money(700_000)),
        discounts: [],
        approvedBy: "Louis",
      }).find((i) => i.code === "below_floor")?.effect
    ).toContain("reason");
    const ok = belowFloor({
      listPrice: known(money(700_000)),
      discounts: [],
      approvedBy: "Louis",
      overrideReason: "Strategic first client in vertical",
    });
    expect(ok.find((i) => i.code === "below_floor")).toBeUndefined();
    expect(ok.find((i) => i.code === "below_floor_override")?.severity).toBe("review");
  });

  it("a discount that takes the net price below the floor is treated exactly like a low price", () => {
    const issues = belowFloor({
      listPrice: known(money(1_000_000)),
      discounts: [
        { label: "Launch discount", amount: money(200_000), reason: "Referral" },
      ],
    });
    expect(issues.find((i) => i.code === "below_floor")?.severity).toBe("block");
  });

  it("discounts show their effect on contribution instead of hiding in cost", () => {
    const input = baseInput({
      selling: {
        listPrice: known(money(1_200_000)),
        discounts: [{ label: "Referral", amount: money(100_000), reason: "Referral" }],
        approvedBy: "Louis",
      },
    });
    const { b } = priced(input);
    expect(b.internalEstimateMinor).toBe(500_000);
    expect(b.contribution).toMatchObject({
      listPriceMinor: 1_200_000,
      discountsMinor: 100_000,
      netSellingPriceMinor: 1_100_000,
      contributionMinor: 600_000,
      marginPct: 54.5,
      beforeDiscounts: { contributionMinor: 700_000, marginPct: 58.3 },
    });
    const effect = validateEstimate(input, policy, calculateEstimate(input, policy)).find(
      (i) => i.code === "discount_effect"
    );
    expect(effect?.severity).toBe("info");
    expect(effect?.effect).toBe("Margin 58.3% → 54.5%");
  });

  it("a discount without a reason is rejected", () => {
    const input = baseInput({
      selling: {
        listPrice: known(money(1_200_000)),
        discounts: [{ label: "x", amount: money(1), reason: " " }],
      },
    });
    expect(
      validateEstimate(input, policy, calculateEstimate(input, policy)).some(
        (i) => i.code === "discount_reason"
      )
    ).toBe(true);
  });
});

describe("§17.3 client output and totals", () => {
  it("contains no internal rates, hours, cost notes, floors, targets or margin data", () => {
    for (const q of QUOTES) {
      const input = estimateInputFromQuote(q, policy);
      const view = toClientView(calculateEstimate(input, policy), input);
      const json = JSON.stringify(view).toLowerCase();
      for (const word of [
        "rate",
        "margin",
        "cost",
        "hours",
        "floor",
        "target",
        "contingency",
        "warrantyreserve",
        "policy",
        "contribution",
      ])
        expect(json, `${q.id} leaks "${word}"`).not.toContain(word);
    }
  });

  it("keeps tax, one-off, recurring, usage and percentage fees separate and never manufactures a recurring amount", () => {
    const q = quoteById("q-northline-v2")!;
    const input = estimateInputFromQuote(q, policy);
    const view = toClientView(calculateEstimate(input, policy), input);
    expect(view.totals).toEqual({
      oneOffMinor: 1_480_000,
      recurringMonthlyMinor: null,
      usageBasis: [],
      percentageFeesBps: [],
      taxMinor: null,
      taxNote: "Tax basis: decision pending; amounts exclude tax",
    });
    expect(view.run.statement).toMatch(/deferred/);
    expect(view.build.milestones.reduce((n, m) => n + m.minor, 0)).toBe(1_480_000);
    expect(view.grow.every((g) => g.label === "draft suggestion")).toBe(true);
  });

  it("splits milestones so the parts sum exactly to the price", () => {
    const parts = allocateMilestones(1_000_001, [
      { label: "a", pct: 50 },
      { label: "b", pct: 25 },
      { label: "c", pct: 25 },
    ]);
    expect(parts.map((p) => p.minor)).toEqual([500_000, 250_000, 250_001]);
    expect(allocateMilestones(5, [])).toEqual([]);
  });
});

describe("four outputs and the fixture quotes", () => {
  it("Northline: priced above floor, below target; RUN deferred with a fixed/usage split; GROW draft; TRANSACT n/a", () => {
    const q = quoteById("q-northline-v2")!;
    const input = estimateInputFromQuote(q, policy);
    const r = calculateEstimate(input, policy);
    expect(r.confidence).toBe("medium");
    if (r.build.state !== "priced") throw new Error();
    const base = r.build.scenarios.base;
    expect(base.hours).toBe(132);
    expect(base.labourMinor).toBe(34 * 6_000 + 98 * 4_500);
    expect(base.riskAdjustedDeliveryCostMinor).toBe(762_400);
    expect(r.build.floorMinor).toBe(1_280_000);
    expect(r.build.targetMinor).toBe(1_530_000);
    expect(r.build.recommendedMinor).toBe(1_530_000);
    expect(r.build.approvedNetMinor).toBe(1_480_000);
    expect(r.build.contribution?.marginPct).toBe(48.5);
    expect(r.build.scenarios.low.riskAdjustedDeliveryCostMinor).toBeLessThan(
      base.riskAdjustedDeliveryCostMinor
    );
    expect(r.build.scenarios.high.riskAdjustedDeliveryCostMinor).toBeGreaterThan(
      base.riskAdjustedDeliveryCostMinor
    );
    expect(r.build.drivers[0]?.label).toBe("Implementation");
    expect(r.build.drivers.reduce((n, d) => n + d.minor, 0)).toBe(762_400);

    expect(r.run.route).toBe("managed");
    expect(r.run.deferred).toBe(true);
    expect(r.run.fixedMinor).toBe(12_500);
    expect(r.run.usageSensitiveMinor).toBe(600);
    expect(r.run.clientDirectMinor).toBe(0);
    expect(r.run.monthlyCostToServeMinor).toBe(13_100);
    expect(r.run.floorMinor).toBe(26_500);
    expect(r.run.targetMinor).toBe(33_000);

    expect(r.grow.map((g) => g.catalogueItemId)).toEqual([
      "team-training",
      "video-pack-five",
    ]);
    expect(r.grow.every((g) => g.state === "draft")).toBe(true);
    expect(r.transact.applicable).toEqual(known(false));
    expect(r.transact.countsTowardsContribution).toBe(false);

    const issues = validateEstimate(input, policy, r);
    expect(issues.find((i) => i.code === "below_floor")).toBeUndefined();
    expect(issues.find((i) => i.code === "below_target")?.severity).toBe("info");
    expect(issues.find((i) => i.code === "policy_draft")).toBeUndefined();
    expect(issues.filter((i) => i.severity === "block")).toEqual([]);
  });

  it("Atlas: unknown migration and blended role give insufficient confidence, no price, discovery required", () => {
    const q = quoteById("q-atlas-v1")!;
    const input = estimateInputFromQuote(q, policy);
    const r = calculateEstimate(input, policy);
    expect(r.confidence).toBe("insufficient");
    expect(r.build.state).toBe("insufficient_confidence");
    if (r.build.state !== "insufficient_confidence") throw new Error();
    expect(r.build.unknowns.some((u) => u.label === "Migration volume and quality")).toBe(
      true
    );
    expect(r.run.route).toBe("unresolved");
    expect(r.run.floorMinor).toBeNull();
    expect(r.transact.applicable.known).toBe(false);
    expect(hasBlockers(validateEstimate(input, policy, r))).toBe(true);
    expect(input.build.optionalDiscoveryItemId).toBe("paid-discovery");
  });

  it("independent route blocks issuance until handover timing and scope are decided; the fee stays £600, inclusive with no VAT line", () => {
    const input = baseInput({
      run: {
        route: "independent",
        stage: "recommendation",
        packageChoice: unknown("n/a"),
        costToServe: [],
        usageLimits: [],
      },
    });
    const issues = validateEstimate(input, policy, calculateEstimate(input, policy));
    expect(issues.find((i) => i.code === "handover_terms_pending")?.severity).toBe("block");
    expect(issues.find((i) => i.code === "handover_tax_pending")).toBeUndefined();
    expect(HANDOVER_FEE.minor).toBe(60_000);
    expect(HANDOVER_FEE.taxBasis).toBe("inclusive_no_vat");
    expect(HANDOVER_FEE.paymentTiming).toBe("pending");
    expect(HANDOVER_FEE.issuable).toBe(false);
    expect(CATALOGUE.find((c) => c.id === HANDOVER_FEE.id)).toBeUndefined();
  });

  it("transact volume forecasts are scenarios only and are never added to contribution", () => {
    const input = baseInput({
      selling: { listPrice: known(money(1_000_000)), discounts: [], approvedBy: "Louis" },
      transact: {
        applicable: known(true),
        feeBps: known(150),
        processorFeesSeparate: true,
        chargeArchitecture: "Direct charge",
        volumeScenarios: [{ label: "Base", monthlyVolume: money(2_000_000) }],
      },
    });
    const { b, r } = priced(input);
    expect(r.transact.scenarios[0]).toMatchObject({
      feeMinor: 30_000,
      note: "scenario, not earned revenue",
    });
    expect(b.contribution?.contributionMinor).toBe(500_000);
    expect(
      validateEstimate(input, policy, r).find((i) => i.code === "transact_speculative")
        ?.severity
    ).toBe("info");
  });

  it("refuses a currency mismatch instead of converting", () => {
    expect(() =>
      calculateEstimate(baseInput({ currency: "USD" as "GBP" }), policy)
    ).toThrow(/conversion policy/);
  });
});

describe("§6.5 catalogue", () => {
  const TIERS = ["managed-core", "managed-pro", "managed-max"];

  it("every item outside the three managed tiers is draft, non-chargeable, versioned and dated; ids and names are unique", () => {
    expect(CATALOGUE.length).toBeGreaterThanOrEqual(28);
    for (const c of CATALOGUE) {
      if (TIERS.includes(c.id)) continue;
      expect(c.state, c.id).toBe("draft");
      expect(c.chargeable, c.id).toBe(false);
      expect(c.version).toBe("CATALOGUE_2026_09_DRAFT");
      expect(c.effectiveDate).toBe("2026-09-17");
      if (c.fromMinor !== null)
        expect(Number.isInteger(c.fromMinor) && c.fromMinor >= 0).toBe(true);
    }
    expect(new Set(CATALOGUE.map((c) => c.id)).size).toBe(CATALOGUE.length);
    const norm = CATALOGUE.map((c) => c.name.toLowerCase().replace(/[^a-z]/g, ""));
    expect(new Set(norm).size).toBe(norm.length);
    expect(CATALOGUE.filter((c) => /launch/i.test(c.name)).map((c) => c.id)).toEqual([
      "platform-launch-pack",
      "launch-pack-plus",
    ]);
    expect(CATALOGUE.filter((c) => /video/i.test(c.name))).toHaveLength(2);
  });

  it("the three managed tiers are published at the NSI_v2 from-prices, in step with the pricing engine", () => {
    const tiers = TIERS.map((id) => CATALOGUE.find((c) => c.id === id)!);
    expect(tiers.map((t) => t.fromMinor)).toEqual([14_900, 24_900, 39_900]);
    for (const t of tiers) {
      expect(t.state).toBe("published");
      expect(t.chargeable).toBe(true);
      expect(t.version).toBe(CATALOGUE_PUBLISHED_VERSION);
      expect(t.effectiveDate).toBe("2026-09-20");
    }
    // One ladder, two modules: the estimator's run bases ARE the NSI bases.
    expect(RUN_PACKAGE_BASE_MINOR).toEqual({
      core: BASE_PLAN_PRICE.core * 100,
      pro: BASE_PLAN_PRICE.pro * 100,
      max: BASE_PLAN_PRICE.max * 100,
    });
    expect(policy.runPackageBaseMinor).toEqual(RUN_PACKAGE_BASE_MINOR);
  });

  it("the policy is published from 20 Sep 2026 and the draft id still resolves to it", () => {
    expect(policy.state).toBe("published");
    expect(policy.effectiveDate).toBe("2026-09-20");
    expect(POLICY_2026_09_DRAFT).toBe(POLICY_2026_09_v1);
    expect(policyById("POLICY_2026_09_DRAFT")).toBe(POLICY_2026_09_v1);
    expect(policyById("POLICY_2026_09_v1")).toBe(POLICY_2026_09_v1);
    expect(validatePolicy(policy).find((i) => i.code === "policy_draft")).toBeUndefined();
    for (const r of policy.roleRates) expect(r.note).toMatch(/working figure/i);
  });
});
