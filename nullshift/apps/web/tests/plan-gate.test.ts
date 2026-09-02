import { describe, expect, it } from "vitest";
import { planChoiceOpen, planChoiceClosedReason } from "@/lib/planGate";
import { CARE_PLAN_TERMS_VERSION, termsAcceptanceValid } from "@/lib/carePlanTerms";

describe("plan choice gate", () => {
  it("opens only once the system is built", () => {
    for (const s of [
      "discovery",
      "onboarding",
      "build",
      "review",
      "launch_prep",
      null,
      undefined,
      "",
    ])
      expect(planChoiceOpen(s)).toBe(false);
    for (const s of ["live", "care", "complete"]) expect(planChoiceOpen(s)).toBe(true);
  });

  it("explains why it is closed", () => {
    expect(planChoiceClosedReason("build")).toMatch(/being built/);
    expect(planChoiceClosedReason("launch_prep")).toMatch(/goes live/);
    expect(planChoiceClosedReason(null)).toMatch(/once your system is live/);
  });
});

describe("terms acceptance", () => {
  it("requires the box ticked and the current version", () => {
    expect(
      termsAcceptanceValid({ accepted: "on", version: CARE_PLAN_TERMS_VERSION })
    ).toBe(true);
    expect(
      termsAcceptanceValid({ accepted: true, version: CARE_PLAN_TERMS_VERSION })
    ).toBe(true);
    expect(termsAcceptanceValid({ accepted: "", version: CARE_PLAN_TERMS_VERSION })).toBe(
      false
    );
    expect(
      termsAcceptanceValid({ accepted: "on", version: "CARE_TERMS_2026_08_v1" })
    ).toBe(false);
    expect(termsAcceptanceValid({ accepted: "on", version: undefined })).toBe(false);
  });

  it("uses a dated, revisable version id", () => {
    expect(CARE_PLAN_TERMS_VERSION).toMatch(/^CARE_TERMS_\d{4}_\d{2}_v\d+$/);
  });
});
