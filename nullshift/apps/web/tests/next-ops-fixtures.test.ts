import { describe, expect, it } from "vitest";
import {
  AUTOMATIONS,
  CATALOGUE,
  COVERAGE_LABEL,
  HANDOVER_FEE_DECISION,
  HANDOVER_ORBIT,
  OPPORTUNITIES,
  PIPELINE_STAGES,
  QUOTE_ROWS,
  SETTINGS_SECTIONS,
  WORK_CLASSES,
  WORK_QUEUE,
  assessCoverage,
  buildStartGate,
  dryRun,
  editableInPlace,
  growExecutionAllowed,
  nextQuoteStates,
  weightedPipeline,
} from "@/lib/next/fixtures-ops";

describe("ops fixtures — sales (brief §5.2, §6.5)", () => {
  it("uses the proposed stage names in order and no real client names", () => {
    expect([...PIPELINE_STAGES]).toEqual([
      "New enquiry",
      "Qualified",
      "Discovery",
      "Scope ready",
      "Quote in review",
      "Sent",
      "Negotiation",
      "Won",
      "Lost",
    ]);
    const names = OPPORTUNITIES.map((o) => o.company.toLowerCase()).join(" ");
    for (const real of ["dance exclusive", "suffolk", "new future", "gino"])
      expect(names).not.toContain(real);
  });

  it("shows weighted pipeline as not configured when probabilities are absent", () => {
    const w = weightedPipeline(OPPORTUNITIES);
    expect(w.configured).toBe(false);
    if (!w.configured) expect(w.unweightedOpen.currency).toBe("GBP");
  });

  it("weights only when every open opportunity has an explicit probability", () => {
    const w = weightedPipeline(
      OPPORTUNITIES.filter((o) => !o.closed).map((o) => ({ ...o, probabilityPct: 50 }))
    );
    expect(w.configured).toBe(true);
  });

  it("never edits a quote in place after issue", () => {
    expect(editableInPlace("Draft")).toBe(true);
    expect(editableInPlace("Issued")).toBe(false);
    expect(editableInPlace("Accepted")).toBe(false);
    expect(nextQuoteStates("Issued")).toContain("Superseded");
    expect(nextQuoteStates("Declined")).toEqual([]);
    const superseded = QUOTE_ROWS.find((q) => q.id === "q-northline-v1");
    expect(superseded?.supersededBy).toBe("q-northline-v2");
  });

  it("links the two Quote Studio fixtures and nothing else", () => {
    const withStudio = QUOTE_ROWS.filter((q) => q.studioHref)
      .map((q) => q.id)
      .sort();
    expect(withStudio).toEqual(["q-atlas-v1", "q-northline-v2"]);
  });

  it("marks every catalogue item draft and non-chargeable, with the £600 fee separate", () => {
    expect(CATALOGUE.length).toBe(23);
    for (const c of CATALOGUE) {
      expect(c.status).toBe("draft");
      expect(c.chargeable).toBe(false);
    }
    expect(CATALOGUE.some((c) => /handover/i.test(c.item))).toBe(false);
    expect(HANDOVER_FEE_DECISION.amount).toEqual({ amountMinor: 60000, currency: "GBP" });
    expect(HANDOVER_FEE_DECISION.taxBasis).toBe("pending decision");
    expect(HANDOVER_FEE_DECISION.issuanceAllowed).toBe(false);
  });
});

describe("ops fixtures — delivery (brief §5.5, §7, §8.5)", () => {
  it("satisfies the build-start gate by deposit or an audited waiver without marking the invoice paid", () => {
    const paid = buildStartGate({
      agreementAccepted: true,
      depositPaid: true,
      readinessComplete: true,
      depositInvoiceState: "paid",
    });
    expect(paid.satisfied).toBe(true);
    expect(paid.waived).toBe(false);

    const waived = buildStartGate({
      agreementAccepted: true,
      depositPaid: false,
      readinessComplete: true,
      waiver: { by: "Louis", reason: "venue date", auditRef: "audit:1" },
      depositInvoiceState: "issued",
    });
    expect(waived.satisfied).toBe(true);
    expect(waived.waived).toBe(true);
    expect(waived.depositInvoiceState).toBe("issued");

    const blocked = buildStartGate({
      agreementAccepted: true,
      depositPaid: false,
      readinessComplete: false,
      depositInvoiceState: "overdue",
    });
    expect(blocked.satisfied).toBe(false);
    expect(blocked.reasons).toHaveLength(2);
  });

  it("uses the seven §7 classes and the exact coverage wording", () => {
    expect(WORK_CLASSES).toHaveLength(7);
    expect(Object.values(COVERAGE_LABEL).sort()).toEqual(
      [
        "Included — Managed Platform",
        "Included — build warranty",
        "Chargeable Grow request — quote required",
        "Coverage needs review",
      ].sort()
    );
    for (const w of WORK_QUEUE) expect(WORK_CLASSES).toContain(w.workClass);
  });

  it("assesses coverage against agreements, not the client's label", () => {
    expect(
      assessCoverage({
        workClass: "DEFECT",
        managedActive: false,
        warrantyActive: true,
        evidenceSufficient: true,
      })
    ).toBe("warranty");
    expect(
      assessCoverage({
        workClass: "DEFECT",
        managedActive: false,
        warrantyActive: false,
        evidenceSufficient: true,
      })
    ).toBe("review");
    expect(
      assessCoverage({
        workClass: "SUPPORT",
        managedActive: true,
        warrantyActive: false,
        evidenceSufficient: true,
      })
    ).toBe("managed");
    expect(
      assessCoverage({
        workClass: "SUPPORT",
        managedActive: false,
        warrantyActive: true,
        evidenceSufficient: true,
      })
    ).toBe("review");
    expect(
      assessCoverage({
        workClass: "CHANGE / FEATURE",
        managedActive: true,
        warrantyActive: true,
        evidenceSufficient: true,
      })
    ).toBe("grow");
    expect(
      assessCoverage({
        workClass: "CONTENT / TRAINING",
        managedActive: true,
        warrantyActive: false,
        evidenceSufficient: true,
        expresslyIncluded: true,
      })
    ).toBe("managed");
    expect(
      assessCoverage({
        workClass: "DATA / INTEGRATION / EXPANSION",
        managedActive: false,
        warrantyActive: false,
        evidenceSufficient: false,
      })
    ).toBe("review");
  });

  it("splits the mixed request into linked restoration and enhancement items", () => {
    const a = WORK_QUEUE.find((w) => w.id === "wq-cedar-07a");
    const b = WORK_QUEUE.find((w) => w.id === "wq-cedar-07b");
    expect(a?.splitFrom).toBe("wq-cedar-07");
    expect(b?.splitFrom).toBe("wq-cedar-07");
    expect(a?.linkedTo).toBe(b?.id);
    expect(b?.linkedTo).toBe(a?.id);
    expect(a?.workClass).toBe("DEFECT");
    expect(a?.coverage).toBe("warranty");
    expect(b?.workClass).toBe("CHANGE / FEATURE");
    expect(b?.coverage).toBe("grow");
  });

  it("blocks Grow execution until acceptance and payment gate unless an exception is recorded", () => {
    expect(
      growExecutionAllowed({
        scopeAccepted: true,
        priceAccepted: true,
        paymentGateSatisfied: false,
      }).allowed
    ).toBe(false);
    expect(
      growExecutionAllowed({
        scopeAccepted: true,
        priceAccepted: true,
        paymentGateSatisfied: true,
      }).allowed
    ).toBe(true);
    expect(
      growExecutionAllowed({
        scopeAccepted: false,
        priceAccepted: false,
        paymentGateSatisfied: false,
        exception: { by: "Louis", reason: "urgent", auditRef: "audit:2" },
      }).allowed
    ).toBe(true);
  });

  it("renders the eleven §8.5 handover items with a £600 fee and blocked access revocation", () => {
    expect(HANDOVER_ORBIT.items).toHaveLength(11);
    expect(HANDOVER_ORBIT.items.map((i) => i.n)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    ]);
    expect(HANDOVER_ORBIT.fee.amount.amountMinor).toBe(60000);
    expect(HANDOVER_ORBIT.items[9].state).toBe("blocked");
  });
});

describe("ops fixtures — automations (brief §5.8, §11)", () => {
  it("has the sixteen §11 workflows with owner, approval and a mode", () => {
    expect(AUTOMATIONS).toHaveLength(16);
    for (const a of AUTOMATIONS) {
      expect(a.owner.length).toBeGreaterThan(0);
      expect(a.approval.length).toBeGreaterThan(0);
      expect(["Draft", "Sandbox", "Enabled", "Paused"]).toContain(a.mode);
    }
  });

  it("dry runs never have an outbound effect", () => {
    for (const a of AUTOMATIONS) {
      const r = dryRun(a);
      expect(r.steps.length).toBeGreaterThan(0);
      for (const st of r.steps) expect(st.effect).toBe("none (dry run)");
      if (a.mode !== "Enabled") expect(r.verdict).toMatch(/would not run/i);
    }
  });

  it("marks high-impact outbound actions explicitly", () => {
    const activation = AUTOMATIONS.find((a) => a.id === "auto-activation");
    expect(activation?.outbound).toBe(true);
    expect(activation?.highImpact).toBe(true);
    expect(activation?.mode).not.toBe("Enabled");
  });
});

describe("ops fixtures — settings (brief §5.9)", () => {
  it("separates read from change permission on every section and never carries a secret value", () => {
    expect(SETTINGS_SECTIONS.length).toBeGreaterThanOrEqual(11);
    for (const sec of SETTINGS_SECTIONS) {
      expect(sec.readPermission.length).toBeGreaterThan(0);
      expect(sec.changePermission.length).toBeGreaterThan(0);
      expect(sec.version.effectiveFrom.length).toBeGreaterThan(0);
      for (const f of sec.fields) {
        expect(f.value).not.toMatch(/sk_(live|test)_|whsec_|eyJ[a-zA-Z0-9]{20,}/);
      }
    }
  });
});
