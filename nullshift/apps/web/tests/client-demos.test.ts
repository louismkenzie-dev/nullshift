import { describe, expect, it } from "vitest";
import {
  ADULT_PASSES,
  additionalMonthlyPrice,
  additionalYearlyPrice,
  computeSiblingDiscount,
  monthlyPrice,
  priceMonthlyItems,
  priceYearlyItems,
  sessionPrice,
  termPrice,
  trialPrice,
  yearlyPrice,
  type PricedClass,
} from "@/components/marketing/demos/tde/pricing";
import {
  chargesFirstMonthAtSignup,
  firstBillingAnchor,
  freeMonthFor,
  isAugustLondon,
  londonYMD,
} from "@/components/marketing/demos/tde/billing";
import { derivePriceBreakdown } from "@/components/marketing/demos/tde/bookingBreakdown";
import {
  parseTier,
  routeAfterSafety,
  clampMessage,
  MAX_MESSAGE_CHARS,
} from "@/components/marketing/demos/nft/logic";
import {
  LTA_AREAS,
  LTA_LEVELS,
  isComplete,
  levelLabel,
  trendSentence,
} from "@/components/marketing/demos/suffolk/lta";
import {
  isParentVisible,
  isUpdated,
  outward,
} from "@/components/marketing/demos/suffolk/reports";

/**
 * The client-stories demos run the clients' own logic, ported verbatim.
 * These are the clients' own test cases (concrete numbers from their
 * repos), re-run here so a re-port that drifts fails loudly.
 */

/* ── The Dance Exclusive — lib/pricing.ts ───────────────────────── */

const childClass = (o: Partial<PricedClass> = {}): PricedClass => ({
  class_type: "children",
  start_time: "17:00",
  end_time: "18:00",
  price_per_session: null,
  price_per_term: null,
  price_per_month: null,
  price_per_year: null,
  ...o,
});
const adultClass = (o: Partial<PricedClass> = {}): PricedClass =>
  childClass({ class_type: "adult", ...o });

describe("TDE pricing — the published ladder", () => {
  it("derives the weekly rate from the class duration", () => {
    expect(sessionPrice(childClass())).toBe(9);
    expect(sessionPrice(childClass({ end_time: "17:45" }))).toBe(8);
    expect(trialPrice(childClass())).toBe(9);
    expect(sessionPrice(adultClass())).toBe(10);
    expect(sessionPrice(adultClass({ end_time: "18:15" }))).toBe(12);
  });

  it("monthly = weekly × 3.4; additional classes at the lower rate", () => {
    expect(monthlyPrice(childClass())).toBe(30.6);
    expect(monthlyPrice(childClass({ end_time: "17:45" }))).toBe(27.2);
    expect(additionalMonthlyPrice(childClass())).toBe(26.35);
    expect(additionalMonthlyPrice(childClass({ end_time: "17:45" }))).toBe(22.95);
  });

  it("yearly and termly upfront discounts", () => {
    expect(yearlyPrice(childClass())).toBe(307.8); // £9 × 38 × 0.9
    expect(termPrice(childClass(), 12)).toBe(102.6); // £9 × 12 × 0.95
    expect(termPrice(childClass(), 0)).toBeNull();
    expect(additionalYearlyPrice(childClass())).toBe(265.05);
    expect(additionalYearlyPrice(childClass({ end_time: "17:45" }))).toBe(230.85);
  });

  it("admin overrides beat derived defaults", () => {
    const cls = childClass({
      price_per_session: 10,
      price_per_month: 35,
      price_per_year: 320,
      price_per_term: 99,
    });
    expect(sessionPrice(cls)).toBe(10);
    expect(monthlyPrice(cls)).toBe(35);
    expect(yearlyPrice(cls)).toBe(320);
    expect(termPrice(cls, 12)).toBe(99);
  });

  it("adult passes", () => {
    expect(ADULT_PASSES.week_2).toMatchObject({
      sessions: 2,
      price: 20,
      windowDays: null,
    });
    expect(ADULT_PASSES.pack_8).toMatchObject({ sessions: 8, price: 70, windowDays: 42 });
  });
});

describe("TDE pricing — multi-class, the £110 cap, siblings", () => {
  it("caps a child's combined monthly total at the £110 Unlimited price", () => {
    const items = ["a", "b", "c", "d", "e"].map((id) => ({
      id,
      classId: `cls-${id}`,
      studentId: "child1",
      fullMonthly: 30.6,
      additionalMonthly: 26.35,
    }));
    const prices = priceMonthlyItems(items);
    expect([...prices.values()]).toEqual([30.6, 26.35, 26.35, 26.35, 0.35]);
    const total = [...prices.values()].reduce((s, p) => s + p, 0);
    expect(Math.round(total * 100) / 100).toBe(110);
  });

  it("remembers memberships from earlier checkouts", () => {
    const one = priceMonthlyItems(
      [
        {
          id: "new",
          classId: "cls-thu",
          studentId: "c",
          fullMonthly: 30.6,
          additionalMonthly: 26.35,
        },
      ],
      new Map([["c", { count: 1, monthlyTotal: 30.6 }]])
    );
    expect(one.get("new")).toBe(26.35);
    const capped = priceMonthlyItems(
      [
        {
          id: "new",
          classId: "cls-x",
          studentId: "child1",
          fullMonthly: 30.6,
          additionalMonthly: 26.35,
        },
      ],
      new Map([["child1", { count: 4, monthlyTotal: 109.65 }]])
    );
    expect(capped.get("new")).toBe(0.35);
  });

  it("the demo basket: second class cheaper, sibling 10% off", () => {
    const priced = priceMonthlyItems([
      {
        id: "commercial",
        classId: "cls-commercial-60",
        studentId: "poppy",
        fullMonthly: 30.6,
        additionalMonthly: 26.35,
      },
      {
        id: "street",
        classId: "cls-street-45",
        studentId: "poppy",
        fullMonthly: 27.2,
        additionalMonthly: 22.95,
      },
      {
        id: "theo",
        classId: "cls-commercial-60",
        studentId: "theo",
        fullMonthly: 30.6,
        additionalMonthly: 26.35,
      },
    ]);
    expect(priced.get("commercial")).toBe(30.6);
    expect(priced.get("street")).toBe(22.95);
    expect(priced.get("theo")).toBe(30.6);
    const item = (id: string, studentId: string, totalPrice: number) => ({
      id,
      studentId,
      isSelfStudent: false,
      classType: "children" as const,
      siblingDiscountEnabled: true,
      totalPrice,
    });
    const sib = computeSiblingDiscount([
      item("commercial", "poppy", 30.6),
      item("street", "poppy", 22.95),
      item("theo", "theo", 30.6),
    ]);
    expect(sib.total).toBe(3.06);
    expect(sib.discountedChildIds).toEqual(["theo"]);
  });

  it("discounts the third child too, and everyone when a sibling is already booked", () => {
    const item = (id: string, studentId: string, totalPrice: number) => ({
      id,
      studentId,
      isSelfStudent: false,
      classType: "children" as const,
      siblingDiscountEnabled: true,
      totalPrice,
    });
    expect(
      computeSiblingDiscount([
        item("a", "child1", 100),
        item("b", "child2", 50),
        item("c", "child3", 40),
      ]).total
    ).toBe(9);
    const prior = computeSiblingDiscount([item("a", "child1", 30.6)], ["existing-child"]);
    expect(prior.total).toBe(3.06);
    expect(prior.discountedChildIds).toEqual(["child1"]);
  });

  it("yearly: most expensive class gets the full rate", () => {
    const result = priceYearlyItems([
      {
        id: "a",
        classId: "cls-a",
        studentId: "c",
        fullYearly: 273.6,
        additionalYearly: 230.85,
      },
      {
        id: "b",
        classId: "cls-b",
        studentId: "c",
        fullYearly: 307.8,
        additionalYearly: 265.05,
      },
    ]);
    expect(result.get("b")).toBe(307.8);
    expect(result.get("a")).toBe(230.85);
  });
});

describe("TDE billing calendar", () => {
  it("anchors recurring payments on the 5th of the following month", () => {
    expect(firstBillingAnchor(new Date("2026-08-03T12:00:00Z")).toISOString()).toBe(
      "2026-09-05T07:00:00.000Z"
    );
    expect(firstBillingAnchor(new Date("2026-12-31T12:00:00Z")).toISOString()).toBe(
      "2027-01-05T07:00:00.000Z"
    );
  });

  it("the free month, and August's card-only signup", () => {
    expect(freeMonthFor(new Date("2026-08-03T12:00:00Z"))).toBe(8);
    expect(freeMonthFor(new Date("2026-09-10T12:00:00Z"))).toBe(8);
    expect(freeMonthFor(new Date("2026-02-20T12:00:00Z"))).toBe(1);
    expect(chargesFirstMonthAtSignup(new Date("2026-08-03T12:00:00Z"))).toBe(false);
    expect(chargesFirstMonthAtSignup(new Date("2026-09-11T10:00:00Z"))).toBe(true);
  });

  it("thinks in London time", () => {
    expect(londonYMD(new Date("2026-08-31T23:30:00Z"))).toEqual({
      y: 2026,
      m: 9,
      day: 1,
    });
    expect(isAugustLondon(new Date("2026-08-31T23:30:00Z"))).toBe(false);
  });
});

describe("TDE booking breakdown — reverse derivation", () => {
  const DISCO = childClass({
    start_time: "18:00",
    end_time: "19:00",
    price_per_session: 9,
    price_per_term: 119.7,
  });
  it("explains a full-price and a sibling-discounted termly booking", () => {
    const full = derivePriceBreakdown("term", 119.7, DISCO, 15);
    expect(full.reconciled).toBe(true);
    expect(full.lines[0]).toEqual({
      label: "Termly price (set by the studio)",
      amount: 119.7,
      kind: "base",
    });
    const sib = derivePriceBreakdown("term", 107.73, DISCO, 15);
    expect(sib.lines[1]).toEqual({
      label: "Sibling discount (10%)",
      amount: -11.97,
      kind: "discount",
    });
  });
  it("names the £110 cap and flags anything it cannot explain", () => {
    expect(derivePriceBreakdown("monthly", 0, childClass(), 0).lines[0].label).toContain(
      "£110 Unlimited"
    );
    expect(derivePriceBreakdown("term", 99.99, DISCO, 15).reconciled).toBe(false);
  });
});

/* ── NewFuture Reflections — the safety gate ────────────────────── */

describe("NFT Reflections gate", () => {
  it("reads the classifier's one word, recall-first", () => {
    expect(parseTier("immediate")).toBe("immediate");
    expect(parseTier("  Immediate\n")).toBe("immediate");
    expect(parseTier("vulnerability")).toBe("vulnerability");
    expect(parseTier("none")).toBe("none");
    expect(parseTier("")).toBe("none");
  });

  it("an immediate tier ends the request before the chat model exists", () => {
    expect(routeAfterSafety("immediate")).toEqual({
      kind: "crisis",
      modelCalled: false,
      safetyEvent: "immediate",
    });
    const v = routeAfterSafety("vulnerability");
    expect(v.kind).toBe("stream");
    expect(v.kind === "stream" && v.extraSystem?.startsWith("# For this reply")).toBe(
      true
    );
    const n = routeAfterSafety("none");
    expect(n.kind === "stream" && n.extraSystem).toBeNull();
  });

  it("clamps the inbound message", () => {
    expect(clampMessage(" hi ")).toBe("hi");
    expect(clampMessage("x".repeat(5000)).length).toBe(MAX_MESSAGE_CHARS);
  });
});

/* ── Suffolk Tennis LTA — lib/lta.ts ────────────────────────────── */

describe("Suffolk session reports", () => {
  it("nine areas, four levels, one is best", () => {
    expect(LTA_AREAS).toHaveLength(9);
    expect(LTA_AREAS.map((a) => a.name)).toEqual([
      "Confident to Attack",
      "Comfortable in Rally",
      "Chases Every Ball",
      "Creative in Play",
      "Athletic Qualities",
      "Reads the Ball",
      "Loves the Game",
      "Loves to Compete",
      "Serving",
    ]);
    expect(LTA_LEVELS.map((l) => l.label)).toEqual([
      "Excelling",
      "Consistent",
      "Progressing",
      "Next Step Focus",
    ]);
    expect(levelLabel(1)).toBe("Excelling");
    expect(levelLabel(undefined)).toBe("Not rated");
  });

  it("a report is complete only when every area is rated 1–4", () => {
    const partial = { Serving: 2, "Loves the Game": 1 };
    expect(isComplete(partial)).toBe(false);
    const all = Object.fromEntries(LTA_AREAS.map((a) => [a.name, 2]));
    expect(isComplete(all)).toBe(true);
    expect(isComplete({ ...all, Serving: 5 })).toBe(false);
    expect(
      isParentVisible({ complete: true, sent_at: "2026-09-05T15:58:00Z", ratings: all })
    ).toBe(true);
    expect(isParentVisible({ complete: true, sent_at: null, ratings: all })).toBe(false);
  });

  it("writes plain trend copy; lower is better", () => {
    expect(trendSentence("Serving", 3, 2)).toBe(
      "Serving up from Progressing to Consistent"
    );
    expect(trendSentence("Serving", 2, 3)).toBe(
      "Serving down from Consistent to Progressing"
    );
    expect(trendSentence("Serving", 2, 2)).toBeNull();
    expect(outward(1)).toBe(4);
    expect(outward(4)).toBe(1);
    expect(outward(undefined)).toBeNull();
  });

  it("an edit more than a minute after sending shows as Updated", () => {
    expect(
      isUpdated({ sent_at: "2026-09-05T15:58:00Z", updated_at: "2026-09-05T15:58:30Z" })
    ).toBe(false);
    expect(
      isUpdated({ sent_at: "2026-09-05T15:58:00Z", updated_at: "2026-09-05T16:10:00Z" })
    ).toBe(true);
  });
});
