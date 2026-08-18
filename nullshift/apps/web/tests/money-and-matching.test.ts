import { describe, expect, it } from "vitest";
import { escapeLike } from "@nullshift/db/leads";
import { computeMrr } from "@nullshift/billing/mrr";

/**
 * escapeLike guards every `.ilike(column, email)` in the app — % and _ are
 * legal in email local parts, and an unescaped pattern can match (or grant
 * workspace membership against) the wrong tenant.
 */
describe("escapeLike", () => {
  it("escapes %, _ and backslash", () => {
    expect(escapeLike("a%b_c\\d@e.com")).toBe("a\\%b\\_c\\\\d@e.com");
  });

  it("leaves ordinary emails untouched", () => {
    expect(escapeLike("louis@nullshift.co.uk")).toBe("louis@nullshift.co.uk");
  });

  it("a crafted wildcard local part can no longer match everything", () => {
    expect(escapeLike("%@%.%")).toBe("\\%@\\%.\\%");
  });
});

/**
 * computeMrr is THE definition of MRR — the dashboard and the billing cockpit
 * both fold through it, so its rule (active + trialing only) is pinned here.
 */
describe("computeMrr", () => {
  it("sums active and trialing, ignores past_due and canceled", () => {
    expect(
      computeMrr([
        { mrr: 100, status: "active" },
        { mrr: 50, status: "trialing" },
        { mrr: 75, status: "past_due" },
        { mrr: 200, status: "canceled" },
      ])
    ).toBe(150);
  });

  it("treats missing mrr as zero", () => {
    expect(computeMrr([{ mrr: Number.NaN, status: "active" }])).toBe(0);
    expect(computeMrr([])).toBe(0);
  });
});
