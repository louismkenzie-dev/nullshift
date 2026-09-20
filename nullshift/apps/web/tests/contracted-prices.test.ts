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
  it("is base + unpriced when the client has not been scored (current from-price)", () => {
    const p = priceFromAssessment(null, carePlan("hosting_api")!);
    expect(p).toMatchObject({ mrr: 249, source: "base", priced: false });
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

describe("hand-set plan prices", () => {
  const row: AssessmentRow = {
    id: "a1",
    plan: "core",
    scale_band: "growth",
    multiplier: 1.5,
    direct_cost_floor: 80,
    recommended_mrr: 80,
    override_mrr: null,
    agreed_mrr: null,
    enterprise_review_required: false,
    pricing_version: "NSI_v1_2026_08",
    plan_prices: { pro: { mrr: 95, reason: "Includes the weekly export you asked for" } },
  };
  it("wins for the plan it names and carries the client-facing reason", () => {
    expect(priceFromAssessment(row, carePlan("hosting_api")!)).toMatchObject({
      mrr: 95,
      source: "override",
      priced: true,
      note: "Includes the weekly export you asked for",
    });
  });
  it("leaves the other plans on the formula", () => {
    expect(priceFromAssessment(row, carePlan("hosting")!)).toMatchObject({
      mrr: 80,
      source: "formula",
      note: null,
    });
    expect(priceFromAssessment(row, carePlan("build_3")!)).toMatchObject({
      mrr: 180,
      source: "derived",
      note: null,
    });
  });
  it("an agreed figure for the exact plan still beats a hand-set one", () => {
    const agreed: AssessmentRow = {
      ...row,
      agreed_mrr: 70,
      plan_prices: { core: { mrr: 60, reason: "x" } },
    };
    expect(priceFromAssessment(agreed, carePlan("hosting")!)).toMatchObject({
      mrr: 70,
      source: "agreed",
    });
  });
});

describe("pricing versions — legacy protection", () => {
  /** A real v1 Growth Pro row exactly as it sits in scale_assessments today. */
  const v1Row = (over: Partial<AssessmentRow> = {}): AssessmentRow => ({
    id: "legacy-1",
    plan: "pro",
    scale_band: "growth",
    multiplier: 1.5,
    direct_cost_floor: 32,
    recommended_mrr: 120,
    override_mrr: null,
    agreed_mrr: null,
    enterprise_review_required: false,
    pricing_version: "NSI_v1_2026_08",
    ...over,
  });

  it("a v1 assessment prices identically before and after v2 was published", () => {
    // Frozen expectations from the NSI_v1 ladder (£40/£80/£120, £5 rounding).
    const before = {
      hosting: { mrr: 60, source: "derived" },
      hosting_api: { mrr: 120, source: "formula" },
      build_3: { mrr: 180, source: "derived" },
      build_10: { mrr: null, source: "unpriced" },
    };
    const after = pricesFromAssessment(v1Row()).prices;
    for (const [id, exp] of Object.entries(before))
      expect(after[id], id).toMatchObject({ ...exp, pricingVersion: "NSI_v1_2026_08" });
    expect(after.hosting!.mrr).not.toBe(225); // NOT the v2 derived figure
  });

  it("a v1 row keeps £5 rounding and its own vendor-cost floor when deriving siblings", () => {
    const r = v1Row({
      plan: "max",
      scale_band: "established",
      multiplier: 2.5,
      direct_cost_floor: 140,
      recommended_mrr: 300,
    });
    expect(priceFromAssessment(r, carePlan("hosting")!).mrr).toBe(140);
    expect(priceFromAssessment(r, carePlan("hosting_api")!).mrr).toBe(200);
    expect(priceFromAssessment(r, carePlan("build_3")!).mrr).toBe(300);
  });

  it("legacy agreed, override and hand-set figures are untouched by the version", () => {
    const agreed = v1Row({ agreed_mrr: 95 });
    expect(priceFromAssessment(agreed, carePlan("hosting_api")!)).toMatchObject({
      mrr: 95,
      source: "agreed",
    });
    const override = v1Row({ override_mrr: 88 });
    expect(priceFromAssessment(override, carePlan("hosting_api")!)).toMatchObject({
      mrr: 88,
      source: "override",
    });
    const hand = v1Row({ plan_prices: { core: { mrr: 45, reason: "Legacy rate" } } });
    expect(priceFromAssessment(hand, carePlan("hosting")!)).toMatchObject({
      mrr: 45,
      source: "override",
      note: "Legacy rate",
    });
  });

  it("a v2 assessment uses the new bases and rounds to the pound", () => {
    const v2 = v1Row({
      id: "new-1",
      pricing_version: "NSI_v2_2026_09",
      recommended_mrr: 374, // 249 × 1.5 = 373.5 → 374
      direct_cost_floor: 32,
    });
    const all = pricesFromAssessment(v2);
    expect(all.prices.hosting_api).toMatchObject({ mrr: 374, source: "formula" });
    expect(all.prices.hosting).toMatchObject({ mrr: 224, source: "derived" }); // 149 × 1.5 = 223.5
    expect(all.prices.build_3).toMatchObject({ mrr: 599, source: "derived" }); // 399 × 1.5 = 598.5
    expect(all.sellable.every((s) => s.pricingVersion === "NSI_v2_2026_09")).toBe(true);
  });

  it("Standard band under v2 reproduces the new public from-prices exactly", () => {
    const r = v1Row({
      plan: "core",
      pricing_version: "NSI_v2_2026_09",
      scale_band: "standard",
      multiplier: 1,
      direct_cost_floor: 20,
      recommended_mrr: 149,
    });
    expect(pricesFromAssessment(r).sellable.map((s) => s.mrr)).toEqual([149, 249, 399]);
  });

  it("refuses to derive a sibling price for a version this build does not know", () => {
    const r = v1Row({ pricing_version: "NSI_v9_2099_01" });
    // The formula's own figure for the scored plan is still honoured…
    expect(priceFromAssessment(r, carePlan("hosting_api")!)).toMatchObject({
      mrr: 120,
      source: "formula",
    });
    // …but nothing is guessed for the siblings.
    expect(priceFromAssessment(r, carePlan("hosting")!)).toMatchObject({
      mrr: null,
      source: "unpriced",
      priced: false,
    });
  });
});
