import { describe, expect, it } from "vitest";
import {
  NURTURE_BUDGETS,
  QUALIFY_THRESHOLD,
  scoreLead,
  type Answers,
} from "@/lib/funnel";

/**
 * Funnel scoring decides which leads get the qualified treatment (call CTA,
 * pipeline priority) vs nurture. Pin the segment boundary and the budget
 * hard-rule so a copy tweak to the quiz can't silently reroute leads.
 */
describe("scoreLead", () => {
  const strong: Answers = {
    industry: "clinic",
    need: "booking",
    budget: "8kplus",
    timeline: "asap",
  };

  it("qualifies a high-scoring lead above the threshold", () => {
    const r = scoreLead(strong);
    expect(r.score).toBeGreaterThanOrEqual(QUALIFY_THRESHOLD);
    expect(r.segment).toBe("qualified");
  });

  it("routes an under-£1k budget to nurture regardless of score", () => {
    const r = scoreLead({ ...strong, budget: NURTURE_BUDGETS[0] });
    expect(r.segment).toBe("nurture");
  });

  it("routes an empty answer set to nurture", () => {
    const r = scoreLead({});
    expect(r.score).toBe(0);
    expect(r.segment).toBe("nurture");
  });

  it("always returns a recommendation", () => {
    expect(scoreLead(strong).recommendation).toBeTruthy();
    expect(scoreLead({}).recommendation).toBeTruthy();
  });
});
