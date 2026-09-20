import { describe, expect, it } from "vitest";
import {
  BASE_PLAN_PRICE,
  BASE_PLAN_PRICE_BY_VERSION,
  basePlanPriceFor,
  basesFor,
  calculateScalePricing,
  ceilToFive,
  EMPTY_SCALE_INPUT,
  isKnownPricingVersion,
  organisationReachPoints,
  organisationScalePoints,
  PRICING_VERSION,
  PRICING_VERSION_V1,
  PRICING_VERSION_V2,
  roundQuoteFor,
  scaleBandFor,
  type ScaleInput,
} from "@/lib/pricing/nsi";

/**
 * The Scale Scoring Formula decides what every recurring client is charged, so
 * it is pinned against the four worked examples in the spec plus the boundary
 * rules that keep a quote defensible (cost floor, never-infer, reach-is-max).
 *
 * The spec's worked examples were written against the NSI_v1 bases
 * (£40/£80/£120); they are run under that version explicitly so the figures
 * stay pinned after v2 (£149/£249/£399) became the default for new work.
 */

const V1 = { pricingVersion: PRICING_VERSION_V1 };

type PartialInput = Partial<Omit<ScaleInput, "riskFlags" | "enterpriseFlags">> & {
  riskFlags?: Partial<ScaleInput["riskFlags"]>;
  enterpriseFlags?: Partial<ScaleInput["enterpriseFlags"]>;
};

const input = (over: PartialInput): ScaleInput => ({
  ...EMPTY_SCALE_INPUT,
  ...over,
  riskFlags: { ...EMPTY_SCALE_INPUT.riskFlags, ...(over.riskFlags ?? {}) },
  enterpriseFlags: {
    ...EMPTY_SCALE_INPUT.enterpriseFlags,
    ...(over.enterpriseFlags ?? {}),
  },
});

describe("worked examples from the pricing spec (NSI_v1 bases)", () => {
  it("A — small local booking business: NSI 21, Standard, Pro stays at £80", () => {
    const r = calculateScalePricing(
      input({
        plan: "pro",
        monthlyActiveUsers: 350,
        platformRole: "transaction_critical",
        annualTurnoverGbp: 180_000,
        directMonthlyVendorCostGbp: 8,
        internalActiveUsers: 2,
        locationsOrUnits: 1,
        riskFlags: { payments: true, authenticatedPii: true },
      }),
      V1
    );
    expect(r.pricingVersion).toBe(PRICING_VERSION_V1);
    expect(r.nsi).toBe(21);
    expect(r.scaleBand).toBe("standard");
    expect(r.multiplier).toBe(1.0);
    expect(r.directCostFloor).toBe(32);
    expect(r.recommendedMrr).toBe(80);
  });

  it("B — established multi-location operator: NSI 61, Scale ×4, Max at £480", () => {
    const r = calculateScalePricing(
      input({
        plan: "max",
        monthlyActiveUsers: 7_500,
        platformRole: "transaction_critical",
        annualTurnoverGbp: 3_500_000,
        directMonthlyVendorCostGbp: 42,
        internalActiveUsers: 22,
        locationsOrUnits: 7,
        riskFlags: {
          payments: true,
          authenticatedPii: true,
          threePlusIntegrations: true,
          operationalAi: true,
        },
      }),
      V1
    );
    expect(r.nsi).toBe(61);
    expect(r.scaleBand).toBe("scale");
    expect(r.multiplier).toBe(4.0);
    expect(r.directCostFloor).toBe(168);
    expect(r.recommendedMrr).toBe(480);
  });

  it("C — high-value business, modest traffic: NSI 55, Established, Pro at £200", () => {
    const r = calculateScalePricing(
      input({
        plan: "pro",
        monthlyActiveUsers: 1_200,
        platformRole: "operational",
        annualTurnoverGbp: 12_000_000,
        directMonthlyVendorCostGbp: 28,
        internalActiveUsers: 65,
        locationsOrUnits: 12,
        riskFlags: {
          authenticatedPii: true,
          threePlusIntegrations: true,
          complexAdminWorkflows: true,
        },
      }),
      V1
    );
    expect(r.nsi).toBe(55);
    expect(r.scaleBand).toBe("established");
    expect(r.recommendedMrr).toBe(200);
  });

  it("D — vendor cost sets a higher floor than the band: Pro at £140, not £80", () => {
    const r = calculateScalePricing(
      input({
        plan: "pro",
        monthlyActiveUsers: 400,
        platformRole: "operational",
        annualTurnoverGbp: 200_000,
        directMonthlyVendorCostGbp: 35,
        internalActiveUsers: 4,
        riskFlags: { authenticatedPii: true, operationalAi: true },
      }),
      V1
    );
    expect(r.scaleBand).toBe("standard");
    expect(r.scaledPlanPrice).toBe(80);
    expect(r.directCostFloor).toBe(140);
    expect(r.recommendedMrr).toBe(140);
    expect(r.reviewFlags.join(" ")).toMatch(/Vendor cost sets the price/);
  });
});

describe("guardrails", () => {
  it("never infers organisation scale — no turnover and no headcount scores 0 and flags", () => {
    expect(organisationScalePoints(null, null)).toEqual({ points: 0, inferred: true });
    const r = calculateScalePricing(
      input({ plan: "core", monthlyActiveUsers: 100, directMonthlyVendorCostGbp: 5 })
    );
    expect(r.reviewFlags.join(" ")).toMatch(/organisation scale scored 0/);
  });

  it("marks data quality low when neither MAU nor sessions is known", () => {
    const r = calculateScalePricing(
      input({ plan: "core", employeeCount: 4, directMonthlyVendorCostGbp: 5 })
    );
    expect(r.dataQuality).toBe("low");
    expect(r.componentScores.audience).toBe(0);
  });

  it("prefers MAU over sessions when both are present", () => {
    const r = calculateScalePricing(
      input({
        plan: "core",
        monthlyActiveUsers: 100, // 0 points
        monthlySessions: 500_000, // would be 25
        directMonthlyVendorCostGbp: 5,
      })
    );
    expect(r.componentScores.audience).toBe(0);
  });

  it("takes the higher of internal users and locations, never the sum", () => {
    expect(organisationReachPoints(65, 12)).toBe(15);
    expect(organisationReachPoints(2, 7)).toBe(10);
    expect(organisationReachPoints(null, null)).toBe(0);
  });

  it("caps complexity risk at 15 even with every flag set", () => {
    const r = calculateScalePricing(
      input({
        plan: "core",
        monthlyActiveUsers: 10,
        annualTurnoverGbp: 1000,
        directMonthlyVendorCostGbp: 1,
        riskFlags: {
          payments: true,
          authenticatedPii: true,
          threePlusIntegrations: true,
          operationalAi: true,
          complexAdminWorkflows: true,
        },
      })
    );
    expect(r.componentScores.complexityRisk).toBe(15);
  });

  it("blocks auto-pricing when vendor cost is unknown — the margin floor is unsafe", () => {
    const r = calculateScalePricing(
      input({ plan: "pro", monthlyActiveUsers: 800, annualTurnoverGbp: 400_000 })
    );
    expect(r.recommendedMrr).toBeNull();
    expect(r.directCostFloor).toBeNull();
    expect(r.reviewFlags.join(" ")).toMatch(/margin floor cannot be calculated/);
  });

  it("forces an Enterprise quote on any trigger, whatever the score", () => {
    const r = calculateScalePricing(
      input({
        plan: "core",
        monthlyActiveUsers: 10,
        annualTurnoverGbp: 1000,
        directMonthlyVendorCostGbp: 1,
        enterpriseFlags: { specialSla: true },
      })
    );
    expect(r.enterpriseReviewRequired).toBe(true);
    expect(r.recommendedMrr).toBeNull();
    expect(r.scaleBand).toBeNull();
    expect(r.reviewFlags.join(" ")).toMatch(/Enterprise trigger: specialSla/);
  });

  it("forces an Enterprise quote at NSI 85+", () => {
    const r = calculateScalePricing(
      input({
        plan: "max",
        monthlyActiveUsers: 60_000, // 25
        platformRole: "transaction_critical", // 15
        annualTurnoverGbp: 25_000_000, // 10
        directMonthlyVendorCostGbp: 300, // 20
        internalActiveUsers: 60, // 15
        riskFlags: {
          payments: true,
          authenticatedPii: true,
          threePlusIntegrations: true,
          operationalAi: true,
          complexAdminWorkflows: true,
        }, // 15
      })
    );
    expect(r.nsi).toBe(100);
    expect(r.enterpriseReviewRequired).toBe(true);
  });

  it("pins the band boundaries", () => {
    expect(scaleBandFor(29)).toEqual({ band: "standard", multiplier: 1.0 });
    expect(scaleBandFor(30)).toEqual({ band: "growth", multiplier: 1.5 });
    expect(scaleBandFor(44)).toEqual({ band: "growth", multiplier: 1.5 });
    expect(scaleBandFor(45)).toEqual({ band: "established", multiplier: 2.5 });
    expect(scaleBandFor(59)).toEqual({ band: "established", multiplier: 2.5 });
    expect(scaleBandFor(60)).toEqual({ band: "scale", multiplier: 4.0 });
    expect(scaleBandFor(74)).toEqual({ band: "scale", multiplier: 4.0 });
    expect(scaleBandFor(75)).toEqual({ band: "critical", multiplier: 5.5 });
    expect(scaleBandFor(84)).toEqual({ band: "critical", multiplier: 5.5 });
    expect(scaleBandFor(85)).toBeNull();
  });

  it("keeps the published from-prices as the Standard-band floor", () => {
    expect(PRICING_VERSION).toBe(PRICING_VERSION_V2);
    expect(BASE_PLAN_PRICE).toEqual({ core: 149, pro: 249, max: 399 });
  });

  it("rounds every quote up to the next £5", () => {
    expect(ceilToFive(80)).toBe(80);
    expect(ceilToFive(81)).toBe(85);
    expect(ceilToFive(138)).toBe(140);
  });
});

describe("pricing versions", () => {
  const exampleA = input({
    plan: "pro",
    monthlyActiveUsers: 350,
    platformRole: "transaction_critical",
    annualTurnoverGbp: 180_000,
    directMonthlyVendorCostGbp: 8,
    internalActiveUsers: 2,
    locationsOrUnits: 1,
    riskFlags: { payments: true, authenticatedPii: true },
  });
  const exampleB = input({
    plan: "max",
    monthlyActiveUsers: 7_500,
    platformRole: "transaction_critical",
    annualTurnoverGbp: 3_500_000,
    directMonthlyVendorCostGbp: 42,
    internalActiveUsers: 22,
    locationsOrUnits: 7,
    riskFlags: {
      payments: true,
      authenticatedPii: true,
      threePlusIntegrations: true,
      operationalAi: true,
    },
  });

  it("keeps every version's bases available, keyed by version", () => {
    expect(BASE_PLAN_PRICE_BY_VERSION[PRICING_VERSION_V1]).toEqual({
      core: 40,
      pro: 80,
      max: 120,
    });
    expect(BASE_PLAN_PRICE_BY_VERSION[PRICING_VERSION_V2]).toEqual({
      core: 149,
      pro: 249,
      max: 399,
    });
    expect(basesFor(PRICING_VERSION_V1)).toEqual({ core: 40, pro: 80, max: 120 });
    expect(basesFor(null)).toBe(BASE_PLAN_PRICE);
    expect(basePlanPriceFor("core", PRICING_VERSION_V1)).toBe(40);
    expect(basePlanPriceFor("core")).toBe(149);
    expect(basePlanPriceFor("enterprise")).toBeNull();
    expect(isKnownPricingVersion(PRICING_VERSION_V1)).toBe(true);
    expect(isKnownPricingVersion("NSI_v9_2099_01")).toBe(false);
  });

  it("refuses to guess the bases of a version it does not know", () => {
    expect(() => basesFor("NSI_v9_2099_01")).toThrow(/Unknown pricing version/);
    expect(() => roundQuoteFor(1, "NSI_v9_2099_01")).toThrow(/Unknown pricing version/);
  });

  it("stamps NEW assessments with NSI_v2 and prices them from the new bases", () => {
    const a = calculateScalePricing(exampleA);
    expect(a.pricingVersion).toBe("NSI_v2_2026_09");
    expect(a.basePlanPrice).toBe(249);
    expect(a.scaledPlanPrice).toBe(249);
    expect(a.recommendedMrr).toBe(249);

    const b = calculateScalePricing(exampleB);
    expect(b.scaleBand).toBe("scale");
    expect(b.basePlanPrice).toBe(399);
    expect(b.scaledPlanPrice).toBe(1596);
    expect(b.recommendedMrr).toBe(1596);
  });

  it("a v1 assessment prices identically before and after v2 was published", () => {
    // These are the spec's own v1 figures, frozen: the same inputs re-scored
    // under the row's version must reproduce them exactly.
    const a = calculateScalePricing(exampleA, V1);
    expect(a).toMatchObject({
      pricingVersion: "NSI_v1_2026_08",
      basePlanPrice: 80,
      scaledPlanPrice: 80,
      recommendedMrr: 80,
    });
    const b = calculateScalePricing(exampleB, V1);
    expect(b).toMatchObject({
      pricingVersion: "NSI_v1_2026_08",
      basePlanPrice: 120,
      scaledPlanPrice: 480,
      recommendedMrr: 480,
    });
    // And the scoring itself is version-independent: only the money moved.
    const v2 = calculateScalePricing(exampleB);
    expect(v2.nsi).toBe(b.nsi);
    expect(v2.componentScores).toEqual(b.componentScores);
    expect(v2.scaleBand).toBe(b.scaleBand);
    expect(v2.multiplier).toBe(b.multiplier);
    expect(v2.directCostFloor).toBe(b.directCostFloor);
  });

  it("rounds v1 quotes to £5 and v2 quotes to the pound, so £149 is what is paid", () => {
    expect(roundQuoteFor(149, PRICING_VERSION_V1)).toBe(150);
    expect(roundQuoteFor(149, PRICING_VERSION_V2)).toBe(149);
    expect(roundQuoteFor(373.5, PRICING_VERSION_V2)).toBe(374);
    expect(roundQuoteFor(81, PRICING_VERSION_V1)).toBe(85);
    const standardCore = calculateScalePricing(
      input({
        plan: "core",
        monthlyActiveUsers: 100,
        annualTurnoverGbp: 100_000,
        directMonthlyVendorCostGbp: 5,
      })
    );
    expect(standardCore.scaleBand).toBe("standard");
    expect(standardCore.recommendedMrr).toBe(149);
  });
});
