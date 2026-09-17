import { afterEach, describe, expect, it, vi } from "vitest";
import {
  planChoiceClosedReasonV2,
  planChoiceOpen,
  planChoiceOpenV2,
} from "@/lib/planGate";
import {
  acceptanceOutcome,
  acceptanceSummary,
  deriveFlags,
  governingAcceptance,
  planRecordAcceptance,
  validateAcceptanceInput,
  type AcceptanceEvidence,
  type AcceptanceInput,
} from "@/lib/delivery";
import {
  FIXTURE_ACCEPTANCE_HARBOUR,
  FIXTURE_ACCEPTANCE_NORTHLINE_PARTIAL,
  FIXTURE_DELIVERABLES,
  FIXTURE_IDS,
  FIXTURE_SCOPE,
} from "@/lib/delivery/fixtures";

const SCOPE = FIXTURE_SCOPE.harbour;
const clean: AcceptanceEvidence = {
  scope_version_ref: SCOPE,
  partial: false,
  disputed: false,
};
const partial: AcceptanceEvidence = {
  scope_version_ref: SCOPE,
  partial: true,
  disputed: false,
};
const disputed: AcceptanceEvidence = {
  scope_version_ref: SCOPE,
  partial: false,
  disputed: true,
};

afterEach(() => vi.unstubAllEnvs());

describe("planChoiceOpenV2 — flag off", () => {
  it("is exactly the legacy stage rule, whatever evidence is passed", () => {
    vi.stubEnv("OPS_V2_FLAGS", "");
    for (const stage of ["live", "care", "complete"]) {
      expect(
        planChoiceOpenV2({ stage, governingScopeVersionRef: SCOPE, acceptances: [] })
      ).toBe(true);
      expect(
        planChoiceOpenV2({
          stage,
          governingScopeVersionRef: SCOPE,
          acceptances: [disputed],
        })
      ).toBe(true);
    }
    for (const stage of ["build", "review", "launch_prep", null]) {
      expect(
        planChoiceOpenV2({ stage, governingScopeVersionRef: SCOPE, acceptances: [clean] })
      ).toBe(planChoiceOpen(stage));
    }
    expect(
      planChoiceClosedReasonV2({
        stage: "build",
        governingScopeVersionRef: SCOPE,
        acceptances: [],
      })
    ).toMatch(/being built/);
  });
});

describe("planChoiceOpenV2 — flag on (brief §3.3 #3, §17.1 rows 2 and 5)", () => {
  it("ignores stage labels: 'live' without acceptance is closed", () => {
    vi.stubEnv("OPS_V2_FLAGS", "acceptanceGate");
    expect(
      planChoiceOpenV2({
        stage: "live",
        governingScopeVersionRef: SCOPE,
        acceptances: [],
      })
    ).toBe(false);
    expect(
      planChoiceOpenV2({
        stage: "complete",
        governingScopeVersionRef: SCOPE,
        acceptances: [],
      })
    ).toBe(false);
  });

  it("opens on a clean acceptance for the governing scope version, even at stage 'build'", () => {
    vi.stubEnv("OPS_V2_FLAGS", "acceptanceGate,newShell");
    expect(
      planChoiceOpenV2({
        stage: "build",
        governingScopeVersionRef: SCOPE,
        acceptances: [clean],
      })
    ).toBe(true);
  });

  it("an acceptance for a different scope version does not count", () => {
    vi.stubEnv("OPS_V2_FLAGS", "acceptanceGate");
    expect(
      planChoiceOpenV2({
        stage: "live",
        governingScopeVersionRef: "order_form:OF-FX-2026-0099",
        acceptances: [clean],
      })
    ).toBe(false);
    expect(
      planChoiceOpenV2({
        stage: "live",
        governingScopeVersionRef: null,
        acceptances: [clean],
      })
    ).toBe(false);
  });

  it("a disputed acceptance never opens the chooser", () => {
    vi.stubEnv("OPS_V2_FLAGS", "acceptanceGate");
    expect(
      planChoiceOpenV2({
        stage: "live",
        governingScopeVersionRef: SCOPE,
        acceptances: [disputed],
      })
    ).toBe(false);
    expect(
      planChoiceClosedReasonV2({
        stage: "live",
        governingScopeVersionRef: SCOPE,
        acceptances: [disputed],
      })
    ).toMatch(/disputed/);
  });

  it("a partial acceptance is closed by default and opens only when the caller allows it", () => {
    vi.stubEnv("OPS_V2_FLAGS", "acceptanceGate");
    expect(
      planChoiceOpenV2({
        stage: "live",
        governingScopeVersionRef: SCOPE,
        acceptances: [partial],
      })
    ).toBe(false);
    expect(
      planChoiceClosedReasonV2({
        stage: "live",
        governingScopeVersionRef: SCOPE,
        acceptances: [partial],
      })
    ).toMatch(/exceptions/);
    expect(
      planChoiceOpenV2({
        stage: "live",
        governingScopeVersionRef: SCOPE,
        acceptances: [partial],
        allowPartial: true,
      })
    ).toBe(true);
    // A clean acceptance alongside a partial one governs.
    expect(
      planChoiceOpenV2({
        stage: "build",
        governingScopeVersionRef: SCOPE,
        acceptances: [partial, clean],
      })
    ).toBe(true);
  });

  it("legacy bypass defers to the stage rule for a tenant already on the old model", () => {
    vi.stubEnv("OPS_V2_FLAGS", "acceptanceGate");
    expect(
      planChoiceOpenV2({
        stage: "care",
        governingScopeVersionRef: null,
        acceptances: [],
        legacy: true,
      })
    ).toBe(true);
    expect(
      planChoiceOpenV2({
        stage: "build",
        governingScopeVersionRef: null,
        acceptances: [],
        legacy: true,
      })
    ).toBe(false);
  });

  it("keeps the existing export unchanged", () => {
    vi.stubEnv("OPS_V2_FLAGS", "acceptanceGate");
    expect(planChoiceOpen("live")).toBe(true);
    expect(planChoiceOpen("build")).toBe(false);
  });
});

describe("governingAcceptance", () => {
  it("prefers the clean row, then the latest partial, never a disputed one", () => {
    const p1 = { ...partial, accepted_at: "2026-09-01T00:00:00Z" };
    const p2 = { ...partial, accepted_at: "2026-09-05T00:00:00Z" };
    expect(governingAcceptance([p1, p2], SCOPE)).toBe(p2);
    expect(governingAcceptance([p1, clean, p2], SCOPE)).toBe(clean);
    expect(governingAcceptance([disputed], SCOPE)).toBeNull();
    expect(governingAcceptance([clean], null)).toBeNull();
  });
});

describe("recording an acceptance (brief §5.5, §8.2)", () => {
  const base: AcceptanceInput = {
    tenantId: FIXTURE_IDS.tenants.harbour,
    projectId: FIXTURE_IDS.projects.harbour,
    scopeVersionRef: SCOPE,
    acceptedByName: "Priya Nair",
    acceptedRole: "client_signatory",
    method: "portal",
    acceptedByUser: FIXTURE_IDS.users.harbourSignatory,
    deliverables: FIXTURE_DELIVERABLES.map((d) => ({ ...d, met: true })),
    defects: [],
    disputed: false,
    notes: null,
  };
  const NOW = "2026-09-17T12:00:00Z";

  it("a clean acceptance records evidence per deliverable and NOTHING about packages, payment or signature", () => {
    const r = planRecordAcceptance([], base, NOW, null);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.outcome).toBe("accepted");
    expect(r.row.partial).toBe(false);
    expect(r.row.disputed).toBe(false);
    expect(r.row.evidence).toHaveLength(3);
    expect(r.row.evidence[0]).toMatchObject({
      deliverable: expect.any(String),
      criteria: expect.any(String),
      met: true,
    });
    const keys = Object.keys(r.row);
    for (const forbidden of [
      "plan",
      "package",
      "paid",
      "paid_at",
      "signature",
      "signed",
      "subscription",
      "mandate",
    ])
      expect(keys.some((k) => k.toLowerCase().includes(forbidden))).toBe(false);
  });

  it("an unmet deliverable or a listed defect makes it partial — accepted with exceptions", () => {
    const unmet = planRecordAcceptance(
      [],
      { ...base, deliverables: FIXTURE_DELIVERABLES },
      NOW,
      null
    );
    expect(unmet.ok && unmet.outcome).toBe("accepted_with_exceptions");
    const withDefect = planRecordAcceptance(
      [],
      {
        ...base,
        defects: [{ ref: "D1", summary: "SMS reminders fail", owner: "nullshift" }],
      },
      NOW,
      null
    );
    expect(withDefect.ok && withDefect.row.partial).toBe(true);
    expect(deriveFlags(FIXTURE_DELIVERABLES, [], false)).toEqual({
      partial: true,
      disputed: false,
    });
  });

  it("a dispute is recorded as a dispute whatever the deliverables say", () => {
    const r = planRecordAcceptance([], { ...base, disputed: true }, NOW, null);
    expect(r.ok && r.outcome).toBe("disputed");
    expect(acceptanceOutcome({ partial: true, disputed: true })).toBe("disputed");
  });

  it("refuses a second clean acceptance of the same scope version; partial and disputed rows are still recorded", () => {
    const again = planRecordAcceptance([clean], base, NOW, null);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.reason).toBe("already_accepted");
    expect(planRecordAcceptance([clean], { ...base, disputed: true }, NOW, null).ok).toBe(
      true
    );
    expect(
      planRecordAcceptance(
        [clean],
        { ...base, deliverables: FIXTURE_DELIVERABLES },
        NOW,
        null
      ).ok
    ).toBe(true);
    // A new scope version is a new acceptance.
    expect(
      planRecordAcceptance(
        [clean],
        { ...base, scopeVersionRef: "order_form:OF-FX-2026-0012" },
        NOW,
        null
      ).ok
    ).toBe(true);
  });

  it("a clean acceptance after a partial one is allowed and then governs", () => {
    const r = planRecordAcceptance([partial], base, NOW, null);
    expect(r.ok).toBe(true);
    if (r.ok) expect(governingAcceptance([partial, r.row], SCOPE)).toBe(r.row);
  });

  it("staff recording carries recorded_by and needs a reason; the portal path needs the signed-in user", () => {
    const staff = validateAcceptanceInput({
      ...base,
      acceptedRole: "staff",
      method: "email",
      acceptedByUser: null,
      notes: null,
    });
    expect(staff.ok).toBe(false);
    const staffOk = validateAcceptanceInput({
      ...base,
      acceptedRole: "staff",
      method: "email",
      acceptedByUser: null,
      notes: "Accepted by email FX-MAIL-1",
    });
    expect(staffOk.ok).toBe(true);
    if (staffOk.ok) {
      const r = planRecordAcceptance([], staffOk.value, NOW, "staff-user");
      expect(r.ok && r.row.recorded_by).toBe("staff-user");
      expect(r.ok && r.row.accepted_by_user).toBeNull();
    }
    expect(validateAcceptanceInput({ ...base, acceptedByUser: null }).ok).toBe(false);
    expect(
      validateAcceptanceInput({
        ...base,
        acceptedRole: "staff",
        method: "portal",
        notes: "x",
      }).ok
    ).toBe(false);
    expect(validateAcceptanceInput({ ...base, method: "email" }).ok).toBe(false);
    expect(validateAcceptanceInput({ ...base, deliverables: [] }).ok).toBe(false);
    expect(validateAcceptanceInput({ ...base, scopeVersionRef: " " }).ok).toBe(false);
    expect(validateAcceptanceInput({ ...base, tenantId: "northline" }).ok).toBe(false);
  });

  it("fixtures describe a clean portal acceptance and a staff-recorded partial one", () => {
    expect(acceptanceOutcome(FIXTURE_ACCEPTANCE_HARBOUR)).toBe("accepted");
    expect(acceptanceSummary(FIXTURE_ACCEPTANCE_HARBOUR)).toMatch(/^Accepted · /);
    expect(acceptanceOutcome(FIXTURE_ACCEPTANCE_NORTHLINE_PARTIAL)).toBe(
      "accepted_with_exceptions"
    );
    expect(FIXTURE_ACCEPTANCE_NORTHLINE_PARTIAL.notes).toMatch(/email/);
    expect(acceptanceSummary(FIXTURE_ACCEPTANCE_NORTHLINE_PARTIAL)).toMatch(
      /2 of 3 deliverables met · 1 defects outstanding/
    );
  });
});
