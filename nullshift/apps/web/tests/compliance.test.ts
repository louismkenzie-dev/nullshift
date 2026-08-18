import { describe, expect, it } from "vitest";
import {
  INTAKE_SECTIONS,
  buildReviewPack,
  deriveFlags,
  missingAnswers,
} from "@/lib/compliance";

/**
 * Verification scenario 7 (the brief): a children's-data or other high-risk
 * flag must force recorded human escalation. These tests pin the flag
 * derivation and the pack's wording guardrails.
 */
describe("deriveFlags — the mandatory-escalation list", () => {
  it("raises no flags on an all-clear intake", () => {
    expect(deriveFlags({})).toEqual([]);
  });

  it("children's data raises a flag", () => {
    expect(deriveFlags({ children_possible: true })).toContain(
      "Children's data / likely child access"
    );
  });

  it("every escalating intake field actually escalates when true", () => {
    for (const section of INTAKE_SECTIONS)
      for (const f of section.fields)
        if (f.escalates)
          expect(deriveFlags({ [f.key]: true }), f.key).toContain(f.escalates);
  });

  it("sensitive + automated processing adds the likely-DPIA composite flag", () => {
    const flags = deriveFlags({ special_category: true, automated_decisions: true });
    expect(flags).toContain("Likely high-risk processing — DPIA screening needed");
    // Neither signal alone raises the composite.
    expect(deriveFlags({ special_category: true })).not.toContain(
      "Likely high-risk processing — DPIA screening needed"
    );
  });
});

describe("buildReviewPack — wording guardrails", () => {
  const pack = buildReviewPack({
    clientName: "Test Clinic",
    trigger: "pre_launch",
    answers: { children_possible: true, roles_map: "NS processor" },
    flags: deriveFlags({ children_possible: true }),
  });

  it("never claims compliance, safety, or readiness to sign", () => {
    expect(pack).not.toMatch(/is compliant|fully compliant|legally safe|bulletproof/i);
    expect(pack).toMatch(/NOT legal advice/);
    expect(pack).toMatch(/NOT ready to sign/);
  });

  it("routes flags to an Administrator decision in the issue register", () => {
    expect(pack).toContain("Children's data / likely child access");
    expect(pack).toMatch(/Administrator decision required/);
  });

  it("lists unanswered intake questions instead of hiding them", () => {
    const missing = missingAnswers({ roles_map: "NS processor" });
    expect(missing.length).toBeGreaterThan(0);
    for (const m of missing.slice(0, 3)) expect(pack).toContain(m);
  });

  it("treats an all-clear intake as absence of flags, never a clearance", () => {
    const clear = buildReviewPack({
      clientName: "Test",
      trigger: "discovery",
      answers: {},
      flags: [],
    });
    expect(clear).toMatch(/Absence of flags is not a clearance/);
  });
});
