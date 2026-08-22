import { describe, it, expect } from "vitest";
import { composeExceptionWorkOrder, type WorkOrderExceptionInput } from "@/lib/soc2/workOrder";

/**
 * The exception → Claude Code work order: one copy-paste must hand a fresh
 * session everything it needs, and must never smuggle in language the
 * readiness programme forbids.
 */

const base: WorkOrderExceptionInput = {
  ref: "EXC-0007",
  title: "Deployed change missing reviewer and test evidence",
  severity: "high",
  status: "in_remediation",
  detail: "CHG-0012 deployed 3 days ago with no reviewer recorded.",
  ruleKey: "change_missing_annotation",
  triggerRef: "CHG-0012",
  recommendedAction: "Record the reviewer and link test evidence on the change record.",
  severityRationale: "Unreviewed production change.",
  remediationPlan: "Backfill review, then fix the release checklist.",
  affected: { change_records: ["abc-123"], empty_bucket: [] },
  control: {
    key: "CC8.1-CHG",
    name: "Change management",
    objective: "Every production change is reviewed and tested before deploy.",
    testProcedure: "Sample change records; check reviewer/approver/test evidence.",
    evidenceRequirements: "Change record with reviewer, approver, test evidence link.",
  },
  trail: ["2026-08-20 · detected · EXC-0007 raised by sweep.", "2026-08-21 · triaged · routed to remediation."],
};

describe("composeExceptionWorkOrder", () => {
  it("carries the exception, its control, the trail, and the traceability loop", () => {
    const wo = composeExceptionWorkOrder(base);
    expect(wo).toContain("EXC-0007");
    expect(wo).toContain("high");
    expect(wo).toContain("in remediation"); // status underscores humanised
    expect(wo).toContain("CC8.1-CHG — Change management");
    expect(wo).toContain("Objective: Every production change is reviewed");
    expect(wo).toContain("change_records: abc-123");
    expect(wo).not.toContain("empty_bucket"); // empty affected buckets dropped
    expect(wo).toContain("2026-08-20 · detected");
    expect(wo).toContain("Claude-Session trailer"); // closes the deploy-mirror loop
    expect(wo).toContain("resolved and verified by people"); // humans own closure
    expect(wo).toContain("never suppress the rule");
  });

  it("degrades cleanly when optional context is absent", () => {
    const wo = composeExceptionWorkOrder({
      ...base,
      detail: null,
      ruleKey: null,
      triggerRef: null,
      recommendedAction: null,
      severityRationale: null,
      remediationPlan: null,
      affected: {},
      control: null,
      trail: [],
    });
    expect(wo).toContain("EXC-0007");
    expect(wo).toContain("No control linked");
    expect(wo).toContain("(no trail entries yet)");
    expect(wo).not.toContain("- Detail:");
    expect(wo).not.toContain("Affected records");
  });

  it("holds the language contract — instructs readiness terms, never claims certification", () => {
    const wo = composeExceptionWorkOrder(base).toLowerCase();
    // The ground rules quote the banned words as things NOT to say — that is
    // the only place they may appear.
    const stripped = wo.replace(/never "compliant" or "certified"/g, "");
    expect(stripped).not.toContain("compliant");
    expect(stripped).not.toContain("certified");
    expect(stripped).not.toContain("audit-ready");
  });
});
