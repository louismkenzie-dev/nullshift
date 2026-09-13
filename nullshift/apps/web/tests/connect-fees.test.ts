import { describe, expect, it } from "vitest";
import {
  breakdownByTenant,
  gbpFromPence,
  netFeePence,
  startOfMonth,
  testModeCount,
  totalFees,
  type FeeRow,
} from "@/lib/billing/connectFees";

const row = (over: Partial<FeeRow>): FeeRow => ({
  id: "fee_1",
  tenant_id: "t1",
  stripe_account_id: "acct_1",
  amount: 1000,
  amount_refunded: 0,
  currency: "gbp",
  livemode: true,
  stripe_created_at: "2026-09-01T00:00:00Z",
  ...over,
});

describe("netFeePence", () => {
  it("is amount minus any refund", () => {
    expect(netFeePence({ amount: 1000, amount_refunded: 200 })).toBe(800);
  });
  it("never goes negative", () => {
    expect(netFeePence({ amount: 100, amount_refunded: 500 })).toBe(0);
  });
});

describe("totalFees", () => {
  it("excludes test-mode fees by default — they are not real revenue", () => {
    const rows = [row({ id: "a", livemode: true, amount: 1000 }), row({ id: "b", livemode: false, amount: 5000 })];
    expect(totalFees(rows)).toEqual({ grossPence: 1000, refundedPence: 0, netPence: 1000, count: 1 });
  });

  it("includes test-mode fees only when explicitly asked", () => {
    const rows = [row({ id: "a", livemode: true, amount: 1000 }), row({ id: "b", livemode: false, amount: 5000 })];
    expect(totalFees(rows, { includeTestMode: true }).count).toBe(2);
  });

  it("sums gross, refunded and net across multiple rows", () => {
    const rows = [
      row({ id: "a", amount: 1000, amount_refunded: 0 }),
      row({ id: "b", amount: 2000, amount_refunded: 500 }),
    ];
    expect(totalFees(rows)).toEqual({ grossPence: 3000, refundedPence: 500, netPence: 2500, count: 2 });
  });

  it("filters by a since date", () => {
    const rows = [
      row({ id: "a", stripe_created_at: "2026-08-15T00:00:00Z", amount: 1000 }),
      row({ id: "b", stripe_created_at: "2026-09-05T00:00:00Z", amount: 2000 }),
    ];
    expect(totalFees(rows, { since: new Date("2026-09-01T00:00:00Z") }).netPence).toBe(2000);
  });
});

describe("breakdownByTenant", () => {
  it("groups by tenant, sorted by net amount collected highest first", () => {
    const rows = [
      row({ id: "a", tenant_id: "t1", amount: 1000 }),
      row({ id: "b", tenant_id: "t2", amount: 5000 }),
      row({ id: "c", tenant_id: "t1", amount: 500 }),
    ];
    const names = new Map([["t1", "Suffolk Tennis"], ["t2", "The Dance Exclusive"]]);
    const out = breakdownByTenant(rows, names);
    expect(out.map((g) => g.tenantName)).toEqual(["The Dance Exclusive", "Suffolk Tennis"]);
    expect(out[1].totals.netPence).toBe(1500);
    expect(out[1].totals.count).toBe(2);
  });

  it("never drops a collected fee — an unmatched account still appears, labelled", () => {
    const rows = [row({ id: "a", tenant_id: null, stripe_account_id: "acct_9", amount: 1000 })];
    const out = breakdownByTenant(rows, new Map());
    expect(out).toHaveLength(1);
    expect(out[0].tenantName).toMatch(/Unmatched account/);
    expect(out[0].tenantName).toContain("acct_9");
    expect(out[0].totals.netPence).toBe(1000);
  });

  it("excludes test-mode rows from the breakdown", () => {
    const rows = [row({ id: "a", livemode: false, amount: 9999 })];
    expect(breakdownByTenant(rows, new Map())).toEqual([]);
  });

  it("tracks the most recent collection date per tenant", () => {
    const rows = [
      row({ id: "a", tenant_id: "t1", stripe_created_at: "2026-09-01T00:00:00Z" }),
      row({ id: "b", tenant_id: "t1", stripe_created_at: "2026-09-10T00:00:00Z" }),
    ];
    expect(breakdownByTenant(rows, new Map())[0].lastCollectedAt).toBe("2026-09-10T00:00:00Z");
  });
});

describe("testModeCount", () => {
  it("counts only non-live rows", () => {
    const rows = [row({ id: "a", livemode: true }), row({ id: "b", livemode: false }), row({ id: "c", livemode: false })];
    expect(testModeCount(rows)).toBe(2);
  });
});

describe("gbpFromPence", () => {
  it("formats pence as pounds with two decimal places", () => {
    expect(gbpFromPence(1000)).toBe("£10.00");
    expect(gbpFromPence(1050)).toBe("£10.50");
    expect(gbpFromPence(123456)).toBe("£1,234.56");
    expect(gbpFromPence(0)).toBe("£0.00");
  });
});

describe("startOfMonth", () => {
  it("returns midnight UTC on the 1st of the given month", () => {
    expect(startOfMonth(new Date("2026-09-13T15:42:00Z")).toISOString()).toBe(
      "2026-09-01T00:00:00.000Z"
    );
  });
});
