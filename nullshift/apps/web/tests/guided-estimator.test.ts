import { describe, expect, it } from "vitest";
import {
  EMPTY_GUIDED_INPUT,
  FEATURES,
  FEATURE_KEYS,
  clientSummary,
  contingencyPctFor,
  guidedEstimate,
  mapToDrivers,
  mapToScale,
  parseGuidedInput,
  type GuidedInput,
} from "@/lib/estimator/guided";
import { guidedQuoteContent } from "@/lib/estimator/guidedQuote";
import { CURRENT_POLICY, calculateEstimate, estimateInputFromQuote } from "@/lib/estimator";
import { toStudioQuote } from "@/lib/commercial/studio";
import { calculateScalePricing, PRICING_VERSION } from "@/lib/pricing/nsi";

type Deep<T> = { [K in keyof T]?: T[K] extends object ? Deep<T[K]> : T[K] };

const input = (over: Deep<GuidedInput> = {}): GuidedInput => ({
  client: { ...EMPTY_GUIDED_INPUT.client, name: "Test Co", ...(over.client ?? {}) },
  size: { ...EMPTY_GUIDED_INPUT.size, ...(over.size ?? {}) },
  features: (over.features as GuidedInput["features"]) ?? [],
  quantities: (over.quantities as GuidedInput["quantities"]) ?? {},
  migration: { ...EMPTY_GUIDED_INPUT.migration, ...(over.migration ?? {}) },
  integrations: { ...EMPTY_GUIDED_INPUT.integrations, ...(over.integrations ?? {}) },
  constraints: { ...EMPTY_GUIDED_INPUT.constraints, ...(over.constraints ?? {}) },
});

const small = input({
  size: { staffCount: 4, sites: 1, customersPerMonth: 300 },
  features: ["booking", "payments", "automated_messaging"],
});

const BOOKING_PER_TYPE_BASE = FEATURES.find((f) => f.key === "booking")!.perUnit!.hours.base;

describe("mapping table", () => {
  it("covers every feature key with ordered hours and a reason", () => {
    expect(FEATURES.map((f) => f.key)).toEqual([...FEATURE_KEYS]);
    for (const f of FEATURES) {
      expect(f.hours.low).toBeGreaterThan(0);
      expect(f.hours.low).toBeLessThanOrEqual(f.hours.base);
      expect(f.hours.base).toBeLessThanOrEqual(f.hours.high);
      expect(f.reason.length).toBeGreaterThan(10);
    }
  });

  it("is deterministic: the same input gives deep-equal drivers and results", () => {
    expect(mapToDrivers(small)).toEqual(mapToDrivers(input({ ...small })));
    const a = guidedEstimate(small);
    const b = guidedEstimate(small);
    expect(a.build).toEqual(b.build);
    expect(a.monthly).toEqual(b.monthly);
  });

  it("always carries discovery, foundation and launch, plus one driver per feature", () => {
    const ids = mapToDrivers(small).map((d) => d.id);
    expect(ids).toEqual([
      "discovery",
      "foundation",
      "booking",
      "payments",
      "automated_messaging",
      "launch",
    ]);
  });

  it("quantities above what is included add hours; below it they do not", () => {
    const one = mapToDrivers(input({ features: ["booking"], quantities: { booking: 1 } }));
    const five = mapToDrivers(input({ features: ["booking"], quantities: { booking: 5 } }));
    const b1 = one.find((d) => d.id === "booking")!;
    const b5 = five.find((d) => d.id === "booking")!;
    expect(b5.hours.base).toBe(b1.hours.base + 4 * BOOKING_PER_TYPE_BASE);
    expect(b5.reason).toContain("5 booking types");
  });
});

describe("ranges", () => {
  it("every driver and the totals are ordered low ≤ base ≤ high", () => {
    const r = guidedEstimate(small);
    for (const d of r.build.drivers) {
      expect(d.hours.low).toBeLessThanOrEqual(d.hours.base);
      expect(d.hours.base).toBeLessThanOrEqual(d.hours.high);
    }
    expect(r.build.lowMinor).toBeLessThanOrEqual(r.build.baseMinor);
    expect(r.build.baseMinor).toBeLessThanOrEqual(r.build.highMinor);
    expect(r.build.floorMinor).toBeLessThanOrEqual(r.build.recommendedMinor);
    expect(r.build.recommendedMinor).toBe(r.build.baseMinor);
  });

  it("money is integer minor units and the recommended price is the policy target", () => {
    const r = guidedEstimate(small);
    for (const n of [r.build.lowMinor, r.build.baseMinor, r.build.highMinor, r.build.floorMinor])
      expect(Number.isInteger(n)).toBe(true);
    expect(r.build.marginPct).toBe(CURRENT_POLICY.targetMarginPct);
    expect(r.build.recommendedMinor % CURRENT_POLICY.roundingIncrementMinor).toBe(0);
    const est = calculateEstimate(r.estimateInput, CURRENT_POLICY);
    expect(est.build.state === "priced" && est.build.recommendedMinor).toBe(r.build.recommendedMinor);
  });

  it("an unknown migration size gives a wide, non-zero range, higher contingency and low confidence", () => {
    const knownSize = input({ ...small, migration: { needed: true, recordCount: 5_000, source: "a spreadsheet" } });
    const unknownSize = input({ ...small, migration: { needed: true, recordCount: null, source: "" } });
    const k = guidedEstimate(knownSize);
    const u = guidedEstimate(unknownSize);
    const mig = u.build.drivers.find((d) => d.id === "migration")!;
    expect(mig.hours.low).toBeGreaterThan(0);
    expect(mig.hours.high / mig.hours.low).toBeGreaterThanOrEqual(3);
    expect(mig.uncertain).toBe(true);
    expect(u.build.highMinor - u.build.lowMinor).toBeGreaterThan(k.build.highMinor - k.build.lowMinor);
    expect(contingencyPctFor(unknownSize)).toBe(contingencyPctFor(knownSize) + 5);
    expect(u.confidence).toBe("low");
    expect(u.discoveryRecommended).toBe(true);
    expect(k.confidence).not.toBe("low");
  });

  it("an unknown number of other integrations is never priced at zero", () => {
    const r = guidedEstimate(input({ ...small, integrations: { otherCount: null } }));
    const other = r.build.drivers.find((d) => d.id === "integration_other")!;
    expect(other.hours.base).toBeGreaterThan(0);
    expect(other.uncertain).toBe(true);
    expect(r.notes.join(" ")).toMatch(/other integrations is not known/);
  });

  it("a tight deadline adds a compressed-timeline driver and contingency", () => {
    const r = guidedEstimate(input({ ...small, constraints: { urgency: "tight" } }));
    expect(r.build.drivers.some((d) => d.id === "tight_deadline")).toBe(true);
    expect(r.build.contingencyPct).toBe(contingencyPctFor(small) + 5);
    expect(r.build.recommendedMinor).toBeGreaterThan(guidedEstimate(small).build.recommendedMinor);
  });
});

describe("monthly (NSI v2)", () => {
  it("equals calculateScalePricing for the same ScaleInput, in minor units", () => {
    const r = guidedEstimate(small);
    for (const plan of ["core", "pro", "max"] as const) {
      const direct = calculateScalePricing({ ...mapToScale(small), plan }, { pricingVersion: PRICING_VERSION });
      expect(direct.recommendedMrr).not.toBeNull();
      expect(r.monthly[`${plan}Minor`]).toBe(direct.recommendedMrr! * 100);
    }
    expect(r.monthly.pricingVersion).toBe(PRICING_VERSION);
    expect(r.monthly.band).toBe("standard");
    expect(r.monthly.multiplier).toBe(1);
    expect(r.monthly.coreMinor).toBe(14_900);
    expect(r.monthly.proMinor).toBe(24_900);
    expect(r.monthly.maxMinor).toBe(39_900);
  });

  it("company size moves the band and the monthly", () => {
    const smallCo = guidedEstimate(small);
    const bigCo = guidedEstimate(
      input({
        ...small,
        size: { staffCount: 120, sites: 8, customersPerMonth: 12_000, turnoverBand: "5m_20m" },
        features: ["booking", "payments", "customer_portal", "staff_dashboard", "reporting"],
        quantities: { staff_dashboard: 3 },
        integrations: { accounting: true, calendar: true, email: true, otherCount: 1 },
      })
    );
    expect(bigCo.monthly.nsi).toBeGreaterThan(smallCo.monthly.nsi);
    expect(bigCo.monthly.band).not.toBe("standard");
    expect(bigCo.monthly.multiplier!).toBeGreaterThan(1);
    expect(bigCo.monthly.coreMinor!).toBeGreaterThan(smallCo.monthly.coreMinor!);
    expect(bigCo.scaleInput.riskFlags.threePlusIntegrations).toBe(true);
    expect(bigCo.scaleInput.riskFlags.complexAdminWorkflows).toBe(true);
  });

  it("recommends a plan with a one-line reason", () => {
    expect(guidedEstimate(small).monthly.recommendedPlan).toBe("pro");
    expect(guidedEstimate(input({ ...small, features: ["reporting"] })).monthly.recommendedPlan).toBe("core");
    const ai = guidedEstimate(input({ ...small, features: ["ai_assistant"] }));
    expect(ai.monthly.recommendedPlan).toBe("max");
    expect(ai.monthly.reason.length).toBeGreaterThan(10);
    expect(ai.scaleInput.riskFlags.operationalAi).toBe(true);
  });

  it("no size at all still prices at the smallest band and says so", () => {
    const r = guidedEstimate(input({ features: ["website"] }));
    expect(r.monthly.coreMinor).toBe(14_900);
    expect(r.confidence).toBe("low");
    expect(r.notes.join(" ")).toMatch(/No company size/);
  });
});

describe("large projects", () => {
  it("are not capped: everything selected at scale escalates for review", () => {
    const big = input({
      size: { staffCount: 400, sites: 20, customersPerMonth: 60_000, turnoverBand: "over_20m" },
      features: [...FEATURE_KEYS],
      quantities: { booking: 20, staff_dashboard: 10, ai_assistant: 10, website: 40, reporting: 20 },
      migration: { needed: true, recordCount: 2_000_000, source: "legacy CRM" },
      integrations: { accounting: true, payments: true, calendar: true, email: true, otherCount: 10 },
      constraints: { urgency: "tight", sensitiveData: true, clientOwnAccounts: true },
    });
    const r = guidedEstimate(big);
    expect(r.build.recommendedMinor).toBeGreaterThan(CURRENT_POLICY.approvalThresholdMinor);
    expect(r.build.reviewRequired).toBe(true);
    expect(r.build.highMinor).toBeGreaterThan(r.build.recommendedMinor);
    expect(r.discoveryRecommended).toBe(true);
    // The NSI engine says Enterprise review at this scale; that is reported, not hidden.
    expect(r.monthly.enterpriseReview).toBe(true);
    expect(r.monthly.coreMinor).toBeNull();
    expect(r.notes.join(" ")).toMatch(/Enterprise review/);
  });
});

describe("quote content and the Studio round trip", () => {
  it("writes scope, packages and commercial from the guided result and keeps the guided input", () => {
    const r = guidedEstimate(small);
    const c = guidedQuoteContent(small, r);
    expect(c.scope.included).toEqual([
      "Online booking or scheduling",
      "Online payments or deposits",
      "Automated emails or SMS",
    ]);
    expect(c.estimate.packages.map((p) => p.name)).toEqual(r.build.drivers.map((d) => d.label));
    expect(c.commercial.build_price_minor).toBe(r.build.recommendedMinor);
    expect(c.commercial.route).toBe("managed");
    expect(c.commercial.run_state).toMatch(/^Managed route — package to be agreed after build acceptance/);
    expect(c.commercial.run_state).toMatch(/Pro at £249 a month/);
    expect(c.internal.guided_input).toEqual(small);
  });

  it("re-prices to the same recommended build in the Studio", () => {
    const r = guidedEstimate(small);
    const c = guidedQuoteContent(small, r);
    const now = "2026-09-20T10:00:00.000Z";
    const q = toStudioQuote(
      {
        id: "11111111-1111-4111-8111-111111111111",
        quote_id: "q",
        version_no: 1,
        status: "draft",
        currency: "GBP",
        expires_at: null,
        ...c,
        policy_version: CURRENT_POLICY.id,
        formula_version: null,
        author: null,
        issued_at: null,
        accepted_at: null,
        superseded_by: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: "q",
        opportunity_id: "o",
        tenant_id: null,
        project_label: "Booking build",
        current_version_id: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: "o",
        tenant_id: null,
        legal_name: "Test Co",
        trading_name: null,
        contact_name: null,
        contact_email: null,
        contact_phone: null,
        stage: "scope_ready",
        owner: null,
        next_action: null,
        next_action_due: null,
        probability_pct: null,
        source: null,
        decision_rationale: null,
        created_by: null,
        created_at: now,
        updated_at: now,
      }
    );
    const est = calculateEstimate(estimateInputFromQuote(q, CURRENT_POLICY), CURRENT_POLICY);
    expect(est.build.state).toBe("priced");
    if (est.build.state === "priced") expect(est.build.recommendedMinor).toBe(r.build.recommendedMinor);
  });
});

describe("client summary", () => {
  it("names the price and range but never hours, costs, rates or margins", () => {
    const r = guidedEstimate(small);
    const text = clientSummary(small, r);
    expect(text).toContain("Test Co");
    expect(text).toContain("Online booking or scheduling");
    expect(text).toMatch(/guide price £[\d,]+/);
    expect(text).toMatch(/Core £149, Pro £249, Max £399/);
    expect(text).not.toMatch(/\bhours?\b|\bh\b|margin|cost|rate|contingency|floor|NSI|band/i);
  });
});

describe("parseGuidedInput", () => {
  it("normalises a valid payload and rejects a bad one", () => {
    const ok = parseGuidedInput({ ...small, features: ["booking", "nonsense"], client: { name: "  X  " } });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.value.features).toEqual(["booking"]);
      expect(ok.value.client.name).toBe("X");
    }
    const bad = parseGuidedInput({ client: { name: "" }, size: { staffCount: 1.5 } });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors.length).toBe(2);
  });
});
