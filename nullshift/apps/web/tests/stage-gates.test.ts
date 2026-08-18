import { describe, expect, it } from "vitest";
import { canEnterBuild } from "@/lib/stageGates";
import { playbooksForStage } from "@/lib/playbooks";

/**
 * The 8-stage lifecycle: discovery → onboarding → build → review →
 * launch_prep → live → care → complete. The DB-level go-live gate (trigger
 * 0005) was verified against production in the walkthrough of 2026-08-18;
 * these tests pin the app-level build gate and per-stage playbook coverage.
 */
describe("canEnterBuild — the deposit gate", () => {
  it("admits a project with a paid invoice", () => {
    expect(canEnterBuild({ hasPaidInvoice: true, overrideReason: "" })).toBe(true);
  });

  it("blocks an unpaid project with no override", () => {
    expect(canEnterBuild({ hasPaidInvoice: false, overrideReason: "" })).toBe(false);
  });

  it("admits an unpaid project only with a recorded reason", () => {
    expect(
      canEnterBuild({
        hasPaidInvoice: false,
        overrideReason: "Retainer client, invoiced monthly",
      })
    ).toBe(true);
    // Whitespace is not a reason.
    expect(canEnterBuild({ hasPaidInvoice: false, overrideReason: "   " })).toBe(false);
  });
});

describe("every lifecycle stage has playbook coverage", () => {
  const STAGES = [
    "discovery",
    "onboarding",
    "build",
    "review",
    "launch_prep",
    "live",
    "care",
    "complete",
  ];

  it("all 8 stages offer at least one playbook", () => {
    for (const stage of STAGES) {
      expect(playbooksForStage(stage).length, `stage ${stage}`).toBeGreaterThan(0);
    }
  });

  it("the gated stages offer their gate's playbook", () => {
    expect(playbooksForStage("build").map((p) => p.kind)).toContain("planning");
    expect(playbooksForStage("review").map((p) => p.kind)).toContain("client_review");
    expect(playbooksForStage("launch_prep").map((p) => p.kind)).toContain("launch");
  });
});
