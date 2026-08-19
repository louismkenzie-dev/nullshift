import { describe, expect, it } from "vitest";
import {
  BASE_PLAN_PRICE,
  calculateScalePricing,
  ceilToFive,
  EMPTY_SCALE_INPUT,
  organisationReachPoints,
  organisationScalePoints,
  scaleBandFor,
  type ScaleInput,
} from "@/lib/pricing/nsi";

/**
 * The Scale Scoring Formula decides what every recurring client is charged, so
 * it is pinned against the four worked examples in the spec plus the boundary
 * rules that keep a quote defensible (cost floor, never-infer, reach-is-max).
 */

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

describe("worked examples from the pricing spec", () => {
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
      })
    );
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
      })
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
      })
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
      })
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
    expect(BASE_PLAN_PRICE).toEqual({ core: 40, pro: 80, max: 120 });
  });

  it("rounds every quote up to the next £5", () => {
    expect(ceilToFive(80)).toBe(80);
    expect(ceilToFive(81)).toBe(85);
    expect(ceilToFive(138)).toBe(140);
  });
});
