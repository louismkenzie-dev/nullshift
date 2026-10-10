import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONFIG,
  estimate,
  friendlyPence,
  validateConfig,
  type WidgetConfig,
} from "@/lib/quote-widget/engine";
import { TEMPLATES } from "@/lib/quote-widget/templates";

const cfg: WidgetConfig = {
  ...DEFAULT_CONFIG,
  margins: { lowPct: 0, highPct: 0 },
  services: [
    { id: "fixed", name: "Fixed job", mode: "fixed", pricePence: 10000 },
    {
      id: "unit",
      name: "Per unit",
      mode: "per_unit",
      pricePence: 1000,
      unitLabel: "units",
      minQty: 1,
      maxQty: 10,
    },
    {
      id: "hourly",
      name: "Hourly",
      mode: "hourly",
      pricePence: 5000,
      minHours: 2,
      maxHours: 4,
    },
  ],
  questions: [
    {
      id: "access",
      label: "Access",
      type: "choice",
      appliesTo: "all",
      options: [
        { id: "easy", label: "Easy", multiplier: 1 },
        { id: "hard", label: "Hard", multiplier: 1.5 },
      ],
    },
    {
      id: "waste",
      label: "Waste",
      type: "yesno",
      appliesTo: ["fixed"],
      options: [
        { id: "yes", label: "Yes", addPence: 2000 },
        { id: "no", label: "No" },
      ],
    },
  ],
};

describe("quote widget engine", () => {
  it("prices a fixed job with no answers", () => {
    const r = estimate(cfg, { serviceId: "fixed", answers: {} });
    expect(r.ok && r.basePence).toBe(10000);
    expect(r.ok && r.lowPence).toBe(10000);
    expect(r.ok && r.highPence).toBe(10000);
  });

  it("applies multipliers then add-ons", () => {
    const r = estimate(cfg, {
      serviceId: "fixed",
      answers: { access: "hard", waste: "yes" },
    });
    // 10000 × 1.5 + 2000 = 17000
    expect(r.ok && r.basePence).toBe(17000);
    expect(r.ok && r.answerSummary.length).toBe(2);
  });

  it("ignores questions that do not apply to the service", () => {
    const r = estimate(cfg, {
      serviceId: "unit",
      quantity: 3,
      answers: { waste: "yes" },
    });
    expect(r.ok && r.basePence).toBe(3000);
    expect(r.ok && r.answerSummary.length).toBe(0);
  });

  it("clamps per-unit quantity to the configured range", () => {
    const r = estimate(cfg, { serviceId: "unit", quantity: 999, answers: {} });
    expect(r.ok && r.quantity).toBe(10);
    expect(r.ok && r.basePence).toBe(10000);
  });

  it("spreads hourly jobs between min and max hours", () => {
    const r = estimate(cfg, { serviceId: "hourly", answers: {} });
    expect(r.ok && r.lowPence).toBe(10000);
    expect(r.ok && r.highPence).toBe(20000);
    expect(r.ok && r.basePence).toBe(15000);
  });

  it("widens the range by the configured margins and adds call-out + VAT", () => {
    const c: WidgetConfig = {
      ...cfg,
      margins: { lowPct: 0.1, highPct: 0.2 },
      calloutPence: 1000,
      vat: { registered: true, ratePct: 20 },
    };
    const r = estimate(c, { serviceId: "fixed", answers: {} });
    // (10000 + 1000) × 0.9 × 1.2 = 11880 → friendly £120; high (11000 × 1.2 × 1.2) = 15840 → £160
    expect(r.ok && r.lowPence).toBe(12000);
    expect(r.ok && r.highPence).toBe(16000);
    expect(r.ok && r.includesVat).toBe(true);
  });

  it("rejects an unknown service", () => {
    const r = estimate(cfg, { serviceId: "nope", answers: {} });
    expect(r.ok).toBe(false);
  });

  it("rounds to friendly figures", () => {
    expect(friendlyPence(12_345)).toBe(12_500);
    expect(friendlyPence(123_456)).toBe(123_000);
    expect(friendlyPence(0)).toBe(0);
  });
});

describe("validateConfig", () => {
  it("accepts every starter template", () => {
    for (const t of Object.values(TEMPLATES)) {
      const v = validateConfig(t.config);
      expect(v.ok, t.label).toBe(true);
    }
  });

  it("rejects an unnamed or unpriced service and duplicate ids", () => {
    const v = validateConfig({
      ...cfg,
      services: [
        { id: "a", name: "", mode: "fixed", pricePence: 100 },
        { id: "a", name: "B", mode: "fixed", pricePence: -5 },
      ],
    });
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(v.errors.some((e) => e.includes("needs a name"))).toBe(true);
      expect(v.errors.some((e) => e.includes("Duplicate"))).toBe(true);
      expect(v.errors.some((e) => e.includes("price"))).toBe(true);
    }
  });

  it("coerces strings, clamps margins and strips a bad colour", () => {
    const v = validateConfig({
      ...cfg,
      margins: { lowPct: "0.9", highPct: 5 },
      brand: { colour: "red" },
      services: [{ id: "x", name: "X", mode: "fixed", pricePence: "2500" }],
    });
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.config.margins.lowPct).toBe(0.6);
      expect(v.config.margins.highPct).toBe(1.5);
      expect(v.config.brand.colour).toBe("#10b981");
      expect(v.config.services[0].pricePence).toBe(2500);
    }
  });
});
