import { describe, expect, it } from "vitest";
import {
  CARE_PLANS,
  SELLABLE_PLANS,
  carePlan,
  carePlanForNsi,
  nsiPlanOf,
} from "../lib/carePlans";
import { priceFromAssessment, type AssessmentRow } from "../lib/pricing/contractedPrice";
import { pricesFromAssessment } from "../lib/pricing/contracted";

const row = (over: Partial<AssessmentRow>): AssessmentRow => ({
  id: "a1",
  plan: "pro",
  scale_band: "growth",
  multiplier: 1.5,
  direct_cost_floor: null,
  recommended_mrr: 120,
  override_mrr: null,
  agreed_mrr: null,
  enterprise_review_required: false,
  pricing_version: "NSI_v1_2026_08",
  ...over,
});

describe("plan vocabulary bridge", () => {
  it("maps every catalogue id to the engine's vocabulary and back", () => {
    expect(nsiPlanOf("hosting")).toBe("core");
    expect(nsiPlanOf("hosting_api")).toBe("pro");
    expect(nsiPlanOf("build_3")).toBe("max");
    expect(nsiPlanOf("build_10")).toBe("enterprise");
    expect(carePlanForNsi("max")?.id).toBe("build_3");
    expect(carePlanForNsi("nope")).toBeNull();
    expect(new Set(CARE_PLANS.map((p) => p.nsiPlan)).size).toBe(4);
  });
  it("exposes exactly three sellable plans, Enterprise excluded", () => {
    expect(SELLABLE_PLANS.map((p) => p.id)).toEqual([
      "hosting",
      "hosting_api",
      "build_3",
    ]);
  });
});

describe("priceFromAssessment", () => {
  it("is base + unpriced when the client has not been scored", () => {
    const p = priceFromAssessment(null, carePlan("hosting_api")!);
    expect(p).toMatchObject({ mrr: 80, source: "base", priced: false });
  });
  it("uses the formula figure for the scored plan (Growth Pro = £120)", () => {
    const p = priceFromAssessment(row({}), carePlan("hosting_api")!);
    expect(p).toMatchObject({
      mrr: 120,
      source: "formula",
      priced: true,
      band: "growth",
    });
  });
  it("derives sibling plans from the same band (Growth Core = £60, Max = £180)", () => {
    expect(priceFromAssessment(row({}), carePlan("hosting")!)).toMatchObject({
      mrr: 60,
      source: "derived",
      priced: true,
    });
    expect(priceFromAssessment(row({}), carePlan("build_3")!)).toMatchObject({
      mrr: 180,
      source: "derived",
    });
  });
  it("lets the vendor-cost floor win and rounds up to £5 (Established Core, floor £140)", () => {
    const r = row({
      plan: "max",
      scale_band: "established",
      multiplier: 2.5,
      direct_cost_floor: 140,
      recommended_mrr: 300,
    });
    // Core base 40 × 2.5 = 100 < floor 140 → 140
    expect(priceFromAssessment(r, carePlan("hosting")!).mrr).toBe(140);
    // Pro 80 × 2.5 = 200 > 140 → 200
    expect(priceFromAssessment(r, carePlan("hosting_api")!).mrr).toBe(200);
    expect(priceFromAssessment(r, carePlan("build_3")!)).toMatchObject({
      mrr: 300,
      source: "formula",
    });
  });
  it("agreed beats override beats formula, but only for the scored plan", () => {
    const r = row({ agreed_mrr: 99, override_mrr: 88, recommended_mrr: 120 });
    expect(priceFromAssessment(r, carePlan("hosting_api")!)).toMatchObject({
      mrr: 99,
      source: "agreed",
    });
    expect(
      priceFromAssessment(row({ override_mrr: 88 }), carePlan("hosting_api")!)
    ).toMatchObject({
      mrr: 88,
      source: "override",
    });
    // Sibling plans never inherit a hand-set figure.
    expect(priceFromAssessment(r, carePlan("hosting")!)).toMatchObject({
      mrr: 60,
      source: "derived",
    });
  });
  it("Standard band reproduces the public from-prices", () => {
    const r = row({
      plan: "core",
      scale_band: "standard",
      multiplier: 1,
      recommended_mrr: 40,
    });
    expect(pricesFromAssessment(r).sellable.map((s) => s.mrr)).toEqual([40, 80, 120]);
  });
  it("Enterprise review or a missing multiplier leaves everything unpriced", () => {
    const r = row({
      enterprise_review_required: true,
      multiplier: null,
      scale_band: null,
      recommended_mrr: null,
    });
    const all = pricesFromAssessment(r);
    expect(all.anyPriced).toBe(false);
    expect(all.sellable.every((s) => s.source === "unpriced" && !s.priced)).toBe(true);
  });
  it("Enterprise is only priced by an agreed or override figure on an enterprise assessment", () => {
    expect(priceFromAssessment(row({}), carePlan("build_10")!)).toMatchObject({
      priced: false,
      source: "unpriced",
    });
    const ent = row({
      plan: "enterprise",
      enterprise_review_required: true,
      multiplier: null,
      recommended_mrr: null,
      agreed_mrr: 660,
    });
    expect(priceFromAssessment(ent, carePlan("build_10")!)).toMatchObject({
      mrr: 660,
      source: "agreed",
      priced: true,
    });
  });
  it("tolerates numeric columns arriving as strings", () => {
    const r = row({ multiplier: "1.5", recommended_mrr: "120", direct_cost_floor: "0" });
    expect(priceFromAssessment(r, carePlan("hosting_api")!).mrr).toBe(120);
    expect(priceFromAssessment(r, carePlan("hosting")!).mrr).toBe(60);
  });
});
