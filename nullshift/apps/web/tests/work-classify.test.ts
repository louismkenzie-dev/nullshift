import { describe, expect, it } from "vitest";
import {
  COVERAGE_DECISIONS,
  COVERAGE_WORDING,
  WORK_CLASS_IDS,
  WORK_CLASS_META,
  coverageFor,
  coverageWording,
  planLinkedItems,
  suggestClassification,
  type Entitlements,
} from "@/lib/work/classify";
import {
  INTAKE_REQUESTS,
  MIXED_REQUEST,
  assess,
  mixedPlan,
} from "@/lib/work/intakeFixtures";
import { readIntakeQuery } from "@/lib/work/intakeQuery";

const none: Entitlements = {
  managedActive: false,
  warrantyActive: false,
  evidenceSufficient: true,
};
const warrantyOnly: Entitlements = {
  managedActive: false,
  warrantyActive: true,
  warrantyAgreement: "Order Form v1 · warranty",
  evidenceSufficient: true,
};
const managedOnly: Entitlements = {
  managedActive: true,
  managedAgreement: "Service schedule v1 · Core",
  warrantyActive: false,
  evidenceSufficient: true,
};
const expired: Entitlements = {
  managedActive: false,
  warrantyActive: false,
  warrantyExpired: true,
  evidenceSufficient: true,
};

describe("§7 vocabulary", () => {
  it("has the seven classes and four decisions matching migration 0058", () => {
    expect([...WORK_CLASS_IDS]).toEqual([
      "defect",
      "support",
      "maintenance",
      "change_feature",
      "content_training",
      "data_integration_expansion",
      "transaction",
    ]);
    expect([...COVERAGE_DECISIONS]).toEqual([
      "included_managed",
      "included_warranty",
      "chargeable_grow",
      "needs_review",
    ]);
    expect(WORK_CLASS_META.change_feature.handling).toBe("Grow, quote required");
    expect(WORK_CLASS_META.transaction.handling).toBe("Agreed percentage-fee model");
  });

  it("uses the exact UI wording and appends the governing agreement only when included", () => {
    expect(COVERAGE_WORDING.included_managed).toBe("Included — Managed Platform");
    expect(COVERAGE_WORDING.included_warranty).toBe("Included — build warranty");
    expect(COVERAGE_WORDING.chargeable_grow).toBe(
      "Chargeable Grow request — quote required."
    );
    expect(COVERAGE_WORDING.needs_review).toBe("Coverage needs review");
    expect(coverageWording("included_warranty", "Order Form v1")).toBe(
      "Included — build warranty (Order Form v1)"
    );
    expect(coverageWording("chargeable_grow", "Order Form v1")).toBe(
      "Chargeable Grow request — quote required."
    );
    expect(coverageWording("needs_review", "x")).toBe("Coverage needs review");
  });
});

describe("suggestClassification — facts beat labels", () => {
  it('a client-labelled "bug" that asks for new capability is CHANGE / FEATURE', () => {
    const s = suggestClassification({
      title: "Booking page doesn't let customers choose a table",
      clientLabel: "bug",
      facts: { newCapability: true },
    });
    expect(s.workClass).toBe("change_feature");
    expect(s.labelMismatch?.clientLabel).toBe("bug");
    expect(s.confidence).toBe("high");
  });

  it('a client-labelled "change" that is a reproducible failure of agreed scope is a DEFECT', () => {
    const s = suggestClassification({
      title: "Change the invoice so the totals add up",
      clientLabel: "change",
      facts: { existingCapability: true, reproducibleFailure: true },
    });
    expect(s.workClass).toBe("defect");
    expect(s.labelMismatch?.note).toMatch(/DEFECT/);
  });

  it("with no facts established it never decides — at most a low-confidence hint", () => {
    const hinted = suggestClassification({ title: "Checkout returns 500", facts: {} });
    expect(hinted.workClass).toBe("defect");
    expect(hinted.confidence).toBe("low");
    expect(hinted.needsHumanReview).toBe(true);

    const blank = suggestClassification({ title: "Something", facts: {} });
    expect(blank.workClass).toBeNull();
    expect(blank.needsHumanReview).toBe(true);
  });

  it("urgent requests go to the incident lane regardless of class", () => {
    const s = suggestClassification({
      facts: { existingCapability: true, reproducibleFailure: true, urgent: true },
    });
    expect(s.lane).toBe("incident");
    expect(s.workClass).toBe("defect");
    expect(suggestClassification({ facts: { assistance: true } }).lane).toBe("routine");
  });

  it("maps each single fact to its §7 class", () => {
    expect(suggestClassification({ facts: { assistance: true } }).workClass).toBe(
      "support"
    );
    expect(suggestClassification({ facts: { routineMaintenance: true } }).workClass).toBe(
      "maintenance"
    );
    expect(suggestClassification({ facts: { contentOrTraining: true } }).workClass).toBe(
      "content_training"
    );
    expect(suggestClassification({ facts: { dataOrIntegration: true } }).workClass).toBe(
      "data_integration_expansion"
    );
    expect(suggestClassification({ facts: { transaction: true } }).workClass).toBe(
      "transaction"
    );
  });
});

describe("coverageFor — classification never creates an entitlement", () => {
  it("with nothing in force nothing is included, for any class", () => {
    for (const cls of WORK_CLASS_IDS) {
      const r = coverageFor(cls, none);
      expect(
        r.decision === "included_managed" || r.decision === "included_warranty"
      ).toBe(false);
    }
  });

  it("warranty applies to a defect without Run, with the governing agreement in the wording", () => {
    const r = coverageFor("defect", warrantyOnly);
    expect(r.decision).toBe("included_warranty");
    expect(r.wording).toBe("Included — build warranty (Order Form v1 · warranty)");
    expect(r.quoteRequired).toBe(false);
  });

  it("an expired warranty is not free support", () => {
    const d = coverageFor("defect", expired);
    expect(d.decision).toBe("needs_review");
    expect(d.reasons.join(" ")).toMatch(/expired warranty is not free support/);
    const s = coverageFor("support", expired);
    expect(s.decision).toBe("needs_review");
    expect(s.wording).toBe("Coverage needs review");
  });

  it("warranty covers defects, not assistance; Run covers assistance and maintenance", () => {
    expect(coverageFor("support", warrantyOnly).decision).toBe("needs_review");
    expect(coverageFor("maintenance", warrantyOnly).decision).toBe("needs_review");
    expect(coverageFor("support", managedOnly).decision).toBe("included_managed");
    expect(coverageFor("maintenance", managedOnly).wording).toBe(
      "Included — Managed Platform (Service schedule v1 · Core)"
    );
  });

  it("feature work is Grow on every tier, even with Run active", () => {
    const r = coverageFor("change_feature", managedOnly);
    expect(r.decision).toBe("chargeable_grow");
    expect(r.wording).toBe("Chargeable Grow request — quote required.");
    expect(r.quoteRequired).toBe(true);
    expect(r.governing).toBeNull();
  });

  it("content and data work is chargeable unless expressly included", () => {
    expect(coverageFor("content_training", managedOnly).decision).toBe("chargeable_grow");
    expect(
      coverageFor("data_integration_expansion", {
        ...managedOnly,
        expresslyIncluded: true,
      }).decision
    ).toBe("included_managed");
    expect(
      coverageFor("content_training", { ...none, expresslyIncluded: true }).decision
    ).toBe("needs_review");
  });

  it("correcting Nullshift's own failed contracted deliverable is not a new charge", () => {
    const r = coverageFor("data_integration_expansion", {
      ...warrantyOnly,
      ownDeliverableFailure: true,
    });
    expect(r.decision).toBe("included_warranty");
    expect(r.quoteRequired).toBe(false);
    const unsure = coverageFor("content_training", {
      ...none,
      ownDeliverableFailure: true,
    });
    expect(unsure.decision).toBe("needs_review");
    expect(unsure.decision).not.toBe("chargeable_grow");
  });

  it("insufficient evidence always needs review, whatever is in force", () => {
    const r = coverageFor("defect", {
      ...managedOnly,
      warrantyActive: true,
      evidenceSufficient: false,
    });
    expect(r.decision).toBe("needs_review");
    expect(coverageFor(null, managedOnly).decision).toBe("needs_review");
  });

  it("transaction queries are never a Run/Grow coverage answer", () => {
    expect(
      coverageFor("transaction", { ...managedOnly, feeScheduleAccepted: true }).decision
    ).toBe("needs_review");
    expect(coverageFor("transaction", none).decision).toBe("needs_review");
  });
});

describe("mixed requests split into linked items", () => {
  it("restoration plus new capability produces two linked parts with independent gates", () => {
    const s = suggestClassification({
      title: MIXED_REQUEST.title,
      clientLabel: "change",
      facts: { existingCapability: true, reproducibleFailure: true, newCapability: true },
    });
    expect(s.workClass).toBeNull();
    expect(s.split?.map((p) => p.workClass)).toEqual(["defect", "change_feature"]);
    expect(s.split?.map((p) => p.gate)).toEqual(["proceed", "quote_required"]);

    const plan = planLinkedItems(MIXED_REQUEST.title, s, warrantyOnly);
    expect(plan?.parts[0].coverage.decision).toBe("included_warranty");
    expect(plan?.parts[1].coverage.decision).toBe("chargeable_grow");
    expect(
      planLinkedItems("x", suggestClassification({ facts: { assistance: true } }), none)
    ).toBeNull();
  });

  it("an urgent covered incident proceeds and is not delayed by the pending enhancement", () => {
    const s = suggestClassification({
      facts: {
        existingCapability: true,
        reproducibleFailure: true,
        newCapability: true,
        urgent: true,
      },
    });
    const plan = planLinkedItems("outage + feature", s, managedOnly);
    expect(plan?.incidentProceeds).toBe(true);
    expect(plan?.note).toMatch(/Do not delay incident response/);
    expect(plan?.parts.find((p) => p.gate === "proceed")?.coverage.decision).toBe(
      "included_managed"
    );
  });
});

describe("intake fixtures", () => {
  it("use fictional clients only and cover the brief's hard cases", () => {
    const names = INTAKE_REQUESTS.map((r) => r.client.toLowerCase());
    for (const banned of ["dance exclusive", "suffolk", "new future"]) {
      expect(names.some((n) => n.includes(banned))).toBe(false);
    }
    const by = Object.fromEntries(INTAKE_REQUESTS.map((r) => [r.id, assess(r)]));
    expect(by["req-harbour-12"].coverage.decision).toBe("included_warranty"); // warranty without Run
    expect(by["req-morrow-33"].suggestion.workClass).toBe("change_feature"); // "bug" → feature
    expect(by["req-morrow-33"].coverage.decision).toBe("chargeable_grow");
    expect(by["req-legacy-05"].suggestion.workClass).toBe("defect"); // "change" → defect
    expect(by["req-legacy-05"].coverage.decision).toBe("needs_review"); // expired warranty
    expect(by["req-cedar-09"].coverage.decision).toBe("needs_review"); // warranty ≠ assistance
    expect(by["req-orbit-06"].coverage.decision).toBe("included_warranty"); // own failed migration
    expect(by["req-morrow-31"].coverage.decision).toBe("included_managed");
    expect(by["req-atlas-02"].coverage.decision).toBe("needs_review"); // no evidence
    expect(by["req-northline-21"].suggestion.lane).toBe("incident");
    expect(mixedPlan().parts).toHaveLength(2);
  });

  it("the what-if query overrides the fixture only when q=1", () => {
    const f = INTAKE_REQUESTS[0];
    const untouched = readIntakeQuery({ f_new: "1" }, f);
    expect(untouched.fromQuery).toBe(false);
    expect(untouched.facts).toEqual(f.facts);

    const q = readIntakeQuery(
      {
        q: "1",
        f_new: "1",
        e_managed: "1",
        e_managed_ref: "Service schedule v1",
        label: "bug",
      },
      f
    );
    expect(q.fromQuery).toBe(true);
    expect(q.facts).toEqual({ newCapability: true });
    expect(q.entitlements.managedActive).toBe(true);
    expect(q.entitlements.managedAgreement).toBe("Service schedule v1");
    expect(q.entitlements.warrantyActive).toBe(false);
    expect(q.entitlements.evidenceSufficient).toBe(false);
    expect(q.clientLabel).toBe("bug");
  });
});
