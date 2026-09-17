import { describe, expect, it } from "vitest";
import {
  ATTENTION,
  CLIENTS,
  QUOTES,
  floorPrice,
  marginPct,
  targetPrice,
} from "@/lib/next/fixtures";

describe("admin redesign fixtures (brief §16, §17)", () => {
  it("has the ten fictional clients and no real client names", () => {
    expect(CLIENTS).toHaveLength(10);
    const names = CLIENTS.map((c) => c.legalName.toLowerCase()).join(" ");
    for (const real of ["dance exclusive", "suffolk", "new future", "gino"])
      expect(names).not.toContain(real);
  });

  it("represents 'Managed selected, tier pending' without a monthly amount", () => {
    const pending = CLIENTS.filter((c) => c.run.state === "package pending");
    expect(pending.length).toBeGreaterThanOrEqual(2);
    for (const c of pending) {
      expect(c.facets.route.state).toBe("managed");
      expect(c.run.monthlyGbp).toBeUndefined();
      expect(c.run.packageName).toBeUndefined();
    }
  });

  it("keeps a future-start acceptance distinct from a scheduled collection", () => {
    const harbour = CLIENTS.find((c) => c.id === "harbour")!;
    expect(harbour.run.state).toBe("accepted, future start");
    expect(harbour.run.mandate).toBe("authorised");
    expect(harbour.run.providerCollectionDate).toMatch(/not scheduled/i);
  });

  it("gives the independent handover a single £600 fee and no subscription", () => {
    const orbit = CLIENTS.find((c) => c.id === "orbit")!;
    expect(orbit.handover?.feeGbp).toBe(600);
    expect(orbit.run.state).toBe("not applicable");
    expect(orbit.run.monthlyGbp).toBeUndefined();
  });

  it("every attention row has an owner and one action", () => {
    for (const a of ATTENTION) {
      expect(a.owner.length).toBeGreaterThan(0);
      expect(a.action.length).toBeGreaterThan(0);
    }
  });

  it("prices from cost and margin, never from a cap", () => {
    expect(floorPrice(5000, 50)).toBe(10000);
    expect(targetPrice(6900, 50)).toBe(13800);
    expect(floorPrice(6900, 40)).toBe(11500);
    expect(marginPct(10000, 5000)).toBe(50);
    expect(marginPct(0, 5000)).toBe(0);
    // A ×1.75 markup is a 42.9% margin, not 75%.
    expect(marginPct(1750, 1000)).toBe(42.9);
    // Large estimates are not clamped.
    expect(targetPrice(40000, 50)).toBe(80000);
  });

  it("keeps internal figures out of the client-facing commercial model", () => {
    for (const q of QUOTES) {
      const clientFacing = JSON.stringify(q.commercial);
      expect(clientFacing).not.toContain("riskAdjusted");
      expect(clientFacing).not.toContain("margin");
    }
  });
});
