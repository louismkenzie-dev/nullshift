import { describe, it, expect } from "vitest";
import {
  DOWNWARD_CONSECUTIVE,
  NOTICE_DAYS,
  UPWARD_CONSECUTIVE,
  bandRank,
  currentPeriod,
  earliestEffectiveDate,
  rebandDecision,
  type Snapshot,
} from "@/lib/pricing/reband";
import type { ScaleBand } from "@/lib/pricing/nsi";

/**
 * §7 and the §21 pricing test cases: "monthly shadow score alone never changes
 * billing", and "normal price increase creates a 30-day notice event".
 */

let seq = 0;
const snap = (
  band: ScaleBand | null,
  mrr: number | null,
  enterprise = false
): Snapshot => ({
  id: `s${++seq}`,
  period: "2026-08-01",
  scaleBand: band,
  recommendedMrr: mrr,
  enterpriseReviewRequired: enterprise,
});

const opts = (band: ScaleBand | null, mrr: number, months = 12) => ({
  contractedBand: band,
  currentMrr: mrr,
  monthsSinceLastChange: months,
});

describe("re-band decisions (§7)", () => {
  it("does nothing at all with no history", () => {
    expect(rebandDecision([], opts("standard", 40)).action).toBe("none");
  });

  it("does nothing when this month scores the band they are on", () => {
    const d = rebandDecision([snap("standard", 40)], opts("standard", 40));
    expect(d.action).toBe("none");
  });

  it("never raises a price off a single month above band", () => {
    const d = rebandDecision(
      [snap("growth", 60), snap("standard", 40)],
      opts("standard", 40)
    );
    expect(d.action).toBe("none");
    if (d.action === "none") expect(d.reason).toMatch(/not a trend/i);
  });

  it("proposes an increase after two consecutive months above band", () => {
    const d = rebandDecision(
      [snap("growth", 60), snap("growth", 60), snap("standard", 40)],
      opts("standard", 40)
    );
    expect(d.action).toBe("propose");
    if (d.action === "propose") {
      expect(d.direction).toBe("increase");
      expect(d.toBand).toBe("growth");
      expect(d.newMrr).toBe(60);
      expect(d.evidence).toHaveLength(UPWARD_CONSECUTIVE);
    }
  });

  it("proposes the SUSTAINED band, not the peak", () => {
    // Above band for two months, but only `growth` was held for both.
    const d = rebandDecision(
      [snap("scale", 160), snap("growth", 60)],
      opts("standard", 40)
    );
    expect(d.action).toBe("propose");
    if (d.action === "propose") {
      expect(d.toBand).toBe("growth");
      expect(d.newMrr).toBe(60);
    }
  });

  it("keeps the run going when a client climbs further, rather than restarting it", () => {
    // Both months are above the contracted band; the second is higher still.
    const d = rebandDecision(
      [snap("established", 100), snap("growth", 60)],
      opts("standard", 40)
    );
    expect(d.action).toBe("propose");
  });

  it("breaks the run when a month falls back to the contracted band", () => {
    const d = rebandDecision(
      [snap("growth", 60), snap("standard", 40), snap("growth", 60)],
      opts("standard", 40)
    );
    expect(d.action).toBe("none");
  });

  it("needs three months to come down, not two", () => {
    const d = rebandDecision(
      [snap("standard", 40), snap("standard", 40)],
      opts("growth", 60)
    );
    expect(d.action).toBe("none");
    if (d.action === "none") expect(d.reason).toMatch(/consecutive months below/i);
  });

  it("proposes a decrease after three months, at the six-month review", () => {
    const d = rebandDecision(
      [snap("standard", 40), snap("standard", 40), snap("standard", 40)],
      opts("growth", 60, 6)
    );
    expect(d.action).toBe("propose");
    if (d.action === "propose") {
      expect(d.direction).toBe("decrease");
      expect(d.newMrr).toBe(40);
      expect(d.evidence).toHaveLength(DOWNWARD_CONSECUTIVE);
    }
  });

  it("holds a decrease back until the six-month review point", () => {
    const d = rebandDecision(
      [snap("standard", 40), snap("standard", 40), snap("standard", 40)],
      opts("growth", 60, 3)
    );
    expect(d.action).toBe("none");
    if (d.action === "none") expect(d.reason).toMatch(/six-month review/i);
  });

  it("sends an Enterprise flag to a human immediately, with no price attached", () => {
    const d = rebandDecision(
      [snap("critical", 220, true), snap("standard", 40)],
      opts("standard", 40)
    );
    expect(d.action).toBe("manual_review");
    if (d.action === "manual_review") expect(d.reason).toMatch(/Enterprise/i);
  });

  it("asks for a human when the sustained band has no recommended figure", () => {
    const d = rebandDecision(
      [snap("growth", null), snap("growth", null)],
      opts("standard", 40)
    );
    expect(d.action).toBe("manual_review");
    if (d.action === "manual_review") expect(d.reason).toMatch(/vendor cost/i);
  });

  it("asks for a human when there is no contracted band to compare against", () => {
    expect(rebandDecision([snap("growth", 60)], opts(null, 40)).action).toBe(
      "manual_review"
    );
  });

  it("does nothing when the band moved but the figure did not", () => {
    const d = rebandDecision(
      [snap("growth", 40), snap("growth", 40)],
      opts("standard", 40)
    );
    expect(d.action).toBe("none");
  });

  it("never proposes charging anything — only proposing", () => {
    const d = rebandDecision(
      [snap("growth", 60), snap("growth", 60)],
      opts("standard", 40)
    );
    // The only actions that exist. There is deliberately no "apply".
    expect(["none", "manual_review", "propose"]).toContain(d.action);
  });
});

describe("notice arithmetic (§7)", () => {
  it("puts the earliest effective date 30 clear days after notice", () => {
    const sent = new Date("2026-08-20T10:00:00Z");
    expect(earliestEffectiveDate(sent)).toBe("2026-09-19");
    expect(NOTICE_DAYS).toBe(30);
  });

  it("files a snapshot under the first of the month", () => {
    expect(currentPeriod(new Date("2026-08-20T10:00:00Z"))).toBe("2026-08-01");
    expect(currentPeriod(new Date("2026-12-31T23:59:00Z"))).toBe("2026-12-01");
  });

  it("orders the bands from cheapest to most demanding", () => {
    expect(bandRank("standard")).toBeLessThan(bandRank("growth"));
    expect(bandRank("scale")).toBeLessThan(bandRank("critical"));
    expect(bandRank(null)).toBe(-1);
  });
});
