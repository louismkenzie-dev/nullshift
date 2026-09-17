import { describe, it, expect } from "vitest";
import { emptyQuote, parseQuote, quoteTotals } from "@/lib/next/quote-builder";
function valid() {
  const draft = emptyQuote();
  Object.assign(draft.document, {
    business: "Example Studio",
    title: "Operations platform",
    included: "Bookings\nPayments",
    acceptance: "An example booking and test payment can be completed",
    lines: [{ name: "Platform build", quantity: 1, unitMinor: 500000 }],
  });
  return draft;
}
describe("Operations quote builder", () => {
  it("validates a real editable draft with undecided monthly fees", () => {
    const result = parseQuote(valid());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.document.monthlyMinor).toBeNull();
  });
  it("calculates pence, VAT and a separate handover fee", () => {
    const { document: d, costs: c } = valid();
    d.route = "independent";
    d.vatPct = 20;
    expect(quoteTotals(d, c)).toMatchObject({
      build: 500000,
      handover: 60000,
      subtotal: 560000,
      vat: 112000,
      total: 672000,
    });
  });
  it("calculates risk-adjusted cost and true margin, not markup", () => {
    const { document: d, costs: c } = valid();
    Object.assign(c, {
      deliveryMinor: 100000,
      externalMinor: 20000,
      contingencyPct: 10,
      reserveMinor: 8000,
      targetMarginPct: 40,
    });
    expect(quoteTotals(d, c)).toMatchObject({
      cost: 140000,
      suggested: 233400,
      marginPct: 72,
    });
  });
  it("allocates every penny exactly once over milestones", () => {
    const { document: d, costs: c } = valid();
    d.lines[0].unitMinor = 10001;
    const t = quoteTotals(d, c);
    expect(t.milestones.reduce((n, m) => n + m.amount, 0)).toBe(10001);
  });
  it("never silently bundles monthly or transaction fees into the build", () => {
    const { document: d, costs: c } = valid();
    d.route = "managed";
    d.monthlyMinor = 39900;
    d.transactPct = 1.5;
    expect(quoteTotals(d, c).total).toBe(500000);
  });
  it("strips arbitrary authority fields and hidden nested data", () => {
    const draft = valid();
    Object.assign(draft.document, { status: "accepted", author: "fake", total: 1 });
    Object.assign(draft.document.lines[0], { secret: "ignored" });
    const result = parseQuote(draft);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.document).not.toHaveProperty("status");
      expect(result.value.document.lines[0]).not.toHaveProperty("secret");
    }
  });
  it("clears irrelevant monthly fees when the route changes", () => {
    const draft = valid();
    Object.assign(draft.document, {
      route: "independent",
      monthlyMinor: 99900,
      billingDate: "2026-10-01",
    });
    const result = parseQuote(draft);
    if (!result.ok) throw new Error(result.error);
    expect(result.value.document.monthlyMinor).toBeNull();
    expect(result.value.document.billingDate).toBe("");
  });
  it.each([null, {}, [], { document: {}, costs: {} }])(
    "rejects malformed payload %j",
    (raw) => expect(parseQuote(raw).ok).toBe(false)
  );
  it.each([
    ["business", ""],
    ["title", " "],
    ["included", ""],
    ["acceptance", ""],
    ["clientId", "not-a-uuid"],
    ["email", "invalid"],
    ["route", "free"],
    ["vatPct", -1],
    ["warrantyDays", 1.5],
    ["monthlyMinor", -1],
    ["handoverMinor", 1.1],
    ["transactPct", 101],
    ["billingDate", "2026-02-31"],
    ["validUntil", "not-date"],
    ["summary", "a".repeat(10001)],
  ])("rejects invalid %s", (key, value) => {
    const draft = valid();
    Object.assign(draft.document, { [key]: value });
    expect(parseQuote(draft).ok).toBe(false);
  });
  it.each([NaN, Infinity, -1, 1.25, 100000001])("rejects invalid money %s", (value) => {
    const draft = valid();
    draft.document.lines[0].unitMinor = value;
    expect(parseQuote(draft).ok).toBe(false);
  });
  it("rejects zero totals and empty or oversized lines", () => {
    const draft = valid();
    draft.document.lines[0].unitMinor = 0;
    expect(parseQuote(draft).ok).toBe(false);
    draft.document.lines = [];
    expect(parseQuote(draft).ok).toBe(false);
    draft.document.lines = Array.from({ length: 51 }, () => ({
      name: "a",
      quantity: 1,
      unitMinor: 1,
    }));
    expect(parseQuote(draft).ok).toBe(false);
  });
  it("rejects milestones that do not add to 100", () => {
    const draft = valid();
    draft.document.milestones[0].pct = 49;
    expect(parseQuote(draft).ok).toBe(false);
  });
  it("rejects unsafe margin denominators", () => {
    const draft = valid();
    draft.costs.targetMarginPct = 100;
    expect(parseQuote(draft).ok).toBe(false);
  });
});
