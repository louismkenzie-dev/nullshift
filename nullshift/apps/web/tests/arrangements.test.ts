import { describe, expect, it } from "vitest";
import {
  ACTIVATION_GATES,
  HANDOVER_FEE_MINOR,
  activationPreconditions,
  addDays,
  buildVariation,
  canAcceptSchedule,
  canActivate,
  canIssueHandoverSchedule,
  canIssueServiceSchedule,
  canReviewSchedule,
  canTransitionSchedule,
  changeRoute,
  chargeability,
  collectionTiming,
  daysBetween,
  defaultHandoverContent,
  electRoute,
  handoverBlockers,
  handoverFeeLine,
  impliedConsentToAmount,
  isScheduleEditable,
  missingDateExceptionPlan,
  nextVersionNo,
  onMandateAuthorised,
  scheduleContentFromSnapshot,
  shouldCollectOn,
  supersededBy,
  validateArrangement,
  type Arrangement,
  type HandoverContent,
  type Mandate,
  type ScheduleContent,
  type ServiceSchedule,
} from "@/lib/legal/arrangements";
import {
  acceptedContent,
  buildAcceptanceSnapshot,
  canonicalJson,
  snapshotDiffers,
  snapshotHash,
  verifySnapshot,
} from "@/lib/legal/acceptanceSnapshot";
import {
  canIssueOrderFormV2,
  isOrderFormV2,
  orderFormV2Blockers,
  orderFormV2CommercialContent,
  type OrderFormV2,
} from "../../../packages/content/src/legal/orderFormV2";

/* ── Fixtures (fictional; @example.test) ────────────────────────────────── */

const STAFF_A = "00000000-0000-4000-8000-00000000000a";
const STAFF_B = "00000000-0000-4000-8000-00000000000b";
const STAFF_C = "00000000-0000-4000-8000-00000000000c";
const CLIENT_USER = "00000000-0000-4000-8000-0000000000c1";
const TENANT = "00000000-0000-4000-8000-0000000000a1";
const OTHER_TENANT = "00000000-0000-4000-8000-0000000000a2";
const PROJECT = "00000000-0000-4000-8000-0000000000b1";

const arrangement = (over: Partial<Arrangement> = {}): Arrangement => ({
  id: "arr-1",
  tenantId: TENANT,
  projectId: PROJECT,
  orderFormId: "of-1",
  route: "managed",
  packageState: "pending",
  billingStartArrangement: "unresolved",
  billingStartDate: null,
  approvedWordingRef: null,
  state: "active",
  supersedesId: null,
  supersededBy: null,
  variationReason: null,
  ...over,
});

const exactContent = (over: Partial<ScheduleContent> = {}): ScheduleContent => ({
  packageCode: "run-core-draft",
  catalogueRef: "catalogue-draft-2026-09#run-core",
  inclusions: ["Hosting and monitoring", "Security patching"],
  exclusions: ["New features", "Design changes"],
  usagePolicy: { fairUse: true },
  amountMinor: 14900,
  currency: "GBP",
  taxBasis: "exempt",
  cadence: "monthly",
  startDate: "2026-11-01",
  noticeDays: 30,
  cancellationTermsRef: "MSA-2026.09 §12",
  responseTargets: { p1: "1 business day" },
  ...over,
});

const schedule = (over: Partial<ServiceSchedule> = {}): ServiceSchedule => ({
  ...exactContent(),
  id: "ss-1",
  arrangementId: "arr-1",
  versionNo: 1,
  status: "draft",
  createdBy: STAFF_A,
  reviewedBy: null,
  reviewedAt: null,
  issuedBy: null,
  issuedAt: null,
  acceptedAt: null,
  acceptedByUser: null,
  acceptedByName: null,
  acceptedRole: null,
  acceptanceMethod: null,
  documentHash: null,
  supersededBy: null,
  ...over,
});

const acceptedSchedule = (over: Partial<ServiceSchedule> = {}): ServiceSchedule =>
  schedule({
    status: "accepted",
    reviewedBy: STAFF_B,
    reviewedAt: "2026-10-01T10:00:00Z",
    issuedBy: STAFF_A,
    issuedAt: "2026-10-01T11:00:00Z",
    acceptedAt: "2026-10-02T09:00:00Z",
    acceptedByUser: CLIENT_USER,
    acceptedByName: "Leo Marsh",
    acceptedRole: "Director",
    acceptanceMethod: "clickwrap",
    documentHash: "a".repeat(64),
    ...over,
  });

const mandate = (over: Partial<Mandate> = {}): Mandate => ({
  status: "authorised",
  reference: "MD-fixture",
  providerLeadDays: 5,
  otherActiveRails: 0,
  ...over,
});

const approval = { approvedBy: STAFF_C, approvedAt: "2026-10-03T09:00:00Z" };

/* ── §17.1 row 1: Managed without a tier ───────────────────────────────── */

describe("route election (§2.1, §17.1 row 1)", () => {
  it("Managed with the tier pending and the start unresolved is a valid contract state", () => {
    const draft = electRoute("managed");
    expect(draft).toEqual({
      route: "managed",
      packageState: "pending",
      billingStartArrangement: "unresolved",
      billingStartDate: null,
      approvedWordingRef: null,
    });
    expect(validateArrangement(draft)).toEqual({ ok: true });
  });

  it("selecting Managed is never consent to an amount", () => {
    const consent = impliedConsentToAmount(arrangement());
    expect(consent.consented).toBe(false);
    expect(consent.amountMinor).toBeNull();
  });

  it("a pending package produces no chargeable amount and no activation", () => {
    const missing = activationPreconditions({
      arrangement: arrangement(),
      schedule: null,
      accepted: null,
      mandate: null,
      approval: null,
      asOf: "2026-10-01",
    });
    const gates = missing.map((m) => m.gate);
    expect(gates).toContain("schedule_accepted");
    expect(gates).toContain("exact_amount");
    expect(gates).toContain("agreed_start");
    expect(gates).toContain("collection_authority");
    expect(gates).toContain("internal_approval");
  });

  it("independent means no package; the database contradiction is refused", () => {
    expect(electRoute("independent").packageState).toBe("not_applicable");
    const bad = validateArrangement({
      ...electRoute("independent"),
      packageState: "pending",
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok)
      expect(bad.problems.map((p) => p.code)).toContain("route_package_inconsistent");
  });

  it("an exact date needs a date and conditional wording needs an approved reference", () => {
    const noDate = validateArrangement({
      ...electRoute("managed"),
      billingStartArrangement: "exact_date",
    });
    expect(noDate.ok).toBe(false);
    const noWording = validateArrangement({
      ...electRoute("managed"),
      billingStartArrangement: "conditional_wording",
    });
    expect(noWording.ok).toBe(false);
    if (!noWording.ok)
      expect(noWording.problems.map((p) => p.code)).toContain(
        "approved_wording_required"
      );
    const ok = validateArrangement({
      ...electRoute("managed"),
      billingStartArrangement: "conditional_wording",
      approvedWordingRef: "solicitor-ref-2026-09-A",
    });
    expect(ok.ok).toBe(true);
  });
});

/* ── §17.1 row 7: route change after signature ─────────────────────────── */

describe("route change (§17.1 row 7)", () => {
  it("edits in place before signature", () => {
    const d = changeRoute(arrangement(), "independent", {
      signed: false,
      asVariation: false,
    });
    expect(d.ok && d.mode).toBe("in_place");
  });

  it("refuses an in-place change after signature and demands a variation", () => {
    const d = changeRoute(arrangement(), "independent", {
      signed: true,
      asVariation: false,
    });
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.problems[0]?.code).toBe("variation_required");
  });

  it("a variation needs a reason", () => {
    const d = changeRoute(arrangement(), "independent", {
      signed: true,
      asVariation: true,
    });
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.problems[0]?.code).toBe("reason_required");
  });

  it("a variation supersedes the old arrangement and preserves it", () => {
    const old = arrangement({
      billingStartArrangement: "exact_date",
      billingStartDate: "2026-11-01",
    });
    const d = changeRoute(old, "independent", {
      signed: true,
      asVariation: true,
      reason: "Client will self-host from November",
    });
    expect(d.ok && d.mode).toBe("variation");
    if (!d.ok || d.mode !== "variation") return;
    const { superseded, successor } = buildVariation(
      old,
      d.next,
      "arr-2",
      "Client will self-host from November"
    );
    expect(superseded).toEqual({ ...old, state: "superseded", supersededBy: "arr-2" });
    expect(superseded.route).toBe("managed");
    expect(superseded.billingStartDate).toBe("2026-11-01");
    expect(successor.id).toBe("arr-2");
    expect(successor.route).toBe("independent");
    expect(successor.packageState).toBe("not_applicable");
    expect(successor.supersedesId).toBe("arr-1");
    expect(successor.state).toBe("active");
  });

  it("a superseded arrangement is never edited", () => {
    const d = changeRoute(arrangement({ state: "superseded" }), "independent", {
      signed: false,
      asVariation: false,
    });
    expect(d.ok).toBe(false);
  });
});

/* ── Schedule machine ──────────────────────────────────────────────────── */

describe("service schedule machine", () => {
  it("draft → issued → accepted → superseded, nothing revives", () => {
    expect(canTransitionSchedule("draft", "issued")).toBe(true);
    expect(canTransitionSchedule("issued", "accepted")).toBe(true);
    expect(canTransitionSchedule("accepted", "superseded")).toBe(true);
    expect(canTransitionSchedule("draft", "accepted")).toBe(false);
    expect(canTransitionSchedule("superseded", "issued")).toBe(false);
    expect(canTransitionSchedule("accepted", "draft")).toBe(false);
  });

  it("only drafts are editable", () => {
    expect(isScheduleEditable("draft")).toBe(true);
    expect(isScheduleEditable("issued")).toBe(false);
    expect(isScheduleEditable("accepted")).toBe(false);
  });

  it("version numbers are sequential", () => {
    expect(nextVersionNo([])).toBe(1);
    expect(nextVersionNo([{ versionNo: 1 }, { versionNo: 3 }])).toBe(4);
  });

  it("the author cannot review their own draft", () => {
    expect(canReviewSchedule(schedule(), STAFF_A).ok).toBe(false);
    expect(canReviewSchedule(schedule(), STAFF_B).ok).toBe(true);
    expect(canReviewSchedule(schedule({ status: "issued" }), STAFF_B).ok).toBe(false);
  });

  it("issue needs a second person's review and the reviewer cannot be the issuer", () => {
    const unreviewed = canIssueServiceSchedule(schedule(), STAFF_A);
    expect(unreviewed.ok).toBe(false);
    if (!unreviewed.ok)
      expect(unreviewed.problems.map((p) => p.code)).toContain("review_required");

    const reviewed = schedule({
      reviewedBy: STAFF_B,
      reviewedAt: "2026-10-01T10:00:00Z",
    });
    expect(canIssueServiceSchedule(reviewed, STAFF_A).ok).toBe(true);
    const selfIssue = canIssueServiceSchedule(reviewed, STAFF_B);
    expect(selfIssue.ok).toBe(false);
    if (!selfIssue.ok)
      expect(selfIssue.problems.map((p) => p.code)).toContain("reviewer_is_issuer");
  });

  it("issue needs exact amount, currency, cadence, start, notice and an approved tax basis", () => {
    const vague = schedule({
      reviewedBy: STAFF_B,
      reviewedAt: "2026-10-01T10:00:00Z",
      amountMinor: null,
      cadence: null,
      startDate: null,
      taxBasis: "pending",
    });
    const d = canIssueServiceSchedule(vague, STAFF_A);
    expect(d.ok).toBe(false);
    if (!d.ok) {
      const codes = d.problems.map((p) => p.code);
      expect(codes).toEqual(
        expect.arrayContaining([
          "amount_required",
          "cadence_required",
          "start_date_required",
          "tax_basis_pending",
        ])
      );
    }
  });

  it("a newer issued version supersedes the earlier issued one; acceptance supersedes the earlier accepted one", () => {
    const versions = [
      { id: "v1", status: "accepted" as const, versionNo: 1 },
      { id: "v2", status: "issued" as const, versionNo: 2 },
      { id: "v3", status: "issued" as const, versionNo: 3 },
    ];
    expect(supersededBy(versions, { id: "v3", status: "issued", versionNo: 3 })).toEqual([
      "v2",
    ]);
    expect(
      supersededBy(versions, { id: "v3", status: "accepted", versionNo: 3 })
    ).toEqual(["v1", "v2"]);
  });
});

/* ── Acceptance by the signatory ───────────────────────────────────────── */

describe("client acceptance", () => {
  const signer = {
    userId: CLIENT_USER,
    membershipRole: "client_admin",
    membershipTenantId: TENANT,
    name: "Leo Marsh",
    authorityConfirmed: true,
  };
  const issued = {
    status: "issued" as const,
    documentHash: "a".repeat(64),
    snapshotVerified: true,
  };

  it("an issued, verified schedule can be accepted by a client admin of that tenant", () => {
    expect(canAcceptSchedule(issued, TENANT, signer)).toEqual({ ok: true });
  });

  it("refuses a member of another tenant, a plain member, unconfirmed authority and a draft", () => {
    expect(
      canAcceptSchedule(issued, TENANT, { ...signer, membershipTenantId: OTHER_TENANT })
        .ok
    ).toBe(false);
    expect(
      canAcceptSchedule(issued, TENANT, { ...signer, membershipRole: "client_member" }).ok
    ).toBe(false);
    expect(
      canAcceptSchedule(issued, TENANT, {
        ...signer,
        membershipTenantId: null,
        membershipRole: null,
      }).ok
    ).toBe(false);
    expect(
      canAcceptSchedule(issued, TENANT, { ...signer, authorityConfirmed: false }).ok
    ).toBe(false);
    expect(canAcceptSchedule({ ...issued, status: "draft" }, TENANT, signer).ok).toBe(
      false
    );
  });

  it("refuses a tampered snapshot", () => {
    const d = canAcceptSchedule({ ...issued, snapshotVerified: false }, TENANT, signer);
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.problems.map((p) => p.code)).toContain("snapshot_invalid");
  });
});

/* ── Chargeability and §17.1 row 8 ─────────────────────────────────────── */

describe("chargeability (§2.1) and catalogue edits (§17.1 row 8)", () => {
  it("only an accepted schedule with exact terms and a verified snapshot is chargeable", () => {
    const ok = chargeability(acceptedSchedule(), exactContent());
    expect(ok.chargeable).toBe(true);
    if (ok.chargeable) {
      expect(ok.amountMinor).toBe(14900);
      expect(ok.cadence).toBe("monthly");
      expect(ok.startDate).toBe("2026-11-01");
    }
    expect(chargeability(schedule({ status: "issued" }), exactContent()).chargeable).toBe(
      false
    );
    expect(chargeability(acceptedSchedule(), null).chargeable).toBe(false);
    expect(
      chargeability(acceptedSchedule(), exactContent({ amountMinor: null })).chargeable
    ).toBe(false);
    expect(
      chargeability(acceptedSchedule(), exactContent({ taxBasis: "pending" })).chargeable
    ).toBe(false);
  });

  it("editing the catalogue after acceptance leaves the accepted schedule unchanged", () => {
    // The catalogue as it was when the schedule was issued (draft, sandbox).
    const catalogue = {
      "run-core": {
        amountMinor: 14900,
        inclusions: ["Hosting and monitoring", "Security patching"],
      },
    };
    const issuedContent = exactContent({
      amountMinor: catalogue["run-core"].amountMinor,
      inclusions: [...catalogue["run-core"].inclusions],
    });
    const frozen = buildAcceptanceSnapshot({
      documentType: "service_schedule",
      documentId: "ss-1",
      versionNo: 1,
      templateVersion: "SS-2026.09-draft",
      content: {
        ...issuedContent,
        usagePolicy: { fairUse: true },
        responseTargets: { p1: "1 business day" },
      },
    });

    // Someone edits the catalogue: price up, an inclusion removed.
    catalogue["run-core"].amountMinor = 19900;
    catalogue["run-core"].inclusions.pop();

    const stored = acceptedContent(frozen.snapshot, frozen.hash);
    expect(stored).not.toBeNull();
    const accepted = scheduleContentFromSnapshot(stored);
    expect(accepted?.amountMinor).toBe(14900);
    expect(accepted?.inclusions).toEqual(["Hosting and monitoring", "Security patching"]);
    expect(verifySnapshot(frozen.snapshot, frozen.hash)).toBe(true);

    const charge = chargeability(
      acceptedSchedule({ documentHash: frozen.hash }),
      accepted
    );
    expect(charge.chargeable && charge.amountMinor).toBe(14900);
  });

  it("a snapshot altered after issue fails verification and yields no accepted content", () => {
    const frozen = buildAcceptanceSnapshot({
      documentType: "service_schedule",
      documentId: "ss-1",
      versionNo: 1,
      templateVersion: "SS-2026.09-draft",
      content: { ...exactContent(), usagePolicy: {}, responseTargets: {} },
    });
    const tampered = {
      ...frozen.snapshot,
      content: {
        ...(frozen.snapshot.content as Record<string, unknown>),
        amountMinor: 100,
      },
    };
    expect(verifySnapshot(tampered, frozen.hash)).toBe(false);
    expect(acceptedContent(tampered as never, frozen.hash)).toBeNull();
  });
});

/* ── Snapshot canonical form ───────────────────────────────────────────── */

describe("acceptance snapshot canonical JSON", () => {
  it("is independent of key order and drops undefined", () => {
    const a = { b: 1, a: { d: [1, 2], c: "x" }, e: undefined };
    const b = { a: { c: "x", d: [1, 2] }, b: 1 };
    expect(canonicalJson(a)).toBe(canonicalJson(b));
    expect(snapshotHash(a)).toBe(snapshotHash(b));
    expect(snapshotDiffers(a, b)).toBe(false);
    expect(snapshotDiffers(a, { ...b, b: 2 })).toBe(true);
  });

  it("produces a 64-hex sha256 and refuses non-finite numbers", () => {
    expect(snapshotHash({ x: 1 })).toMatch(/^[0-9a-f]{64}$/);
    expect(() => snapshotHash({ x: Number.NaN })).toThrow();
  });

  it("verifySnapshot rejects a missing or malformed hash", () => {
    expect(verifySnapshot({ x: 1 }, null)).toBe(false);
    expect(verifySnapshot({ x: 1 }, "nope")).toBe(false);
  });
});

/* ── §17.1 row 3: mandate authorised early ─────────────────────────────── */

describe("mandate authorised early (§17.1 row 3, §8.3 step 4)", () => {
  it("records the mandate and activates nothing", () => {
    const r = onMandateAuthorised({
      arrangement: arrangement(),
      schedule: null,
      accepted: null,
      mandate: mandate(),
      approval: null,
      asOf: "2026-10-01",
    });
    expect(r.recordMandate).toBe(true);
    expect(r.activate).toBe(false);
    expect(r.collect).toBe(false);
    expect(r.createSubscription).toBe(false);
    expect(r.remainingGates.map((g) => g.gate)).toContain("schedule_accepted");
    expect(r.remainingGates.map((g) => g.gate)).not.toContain("collection_authority");
  });
});

/* ── §17.1 row 4: accepted with a future date ──────────────────────────── */

describe("accepted package with a future contractual date (§17.1 row 4)", () => {
  const arr = arrangement({
    packageState: "accepted",
    billingStartArrangement: "exact_date",
    billingStartDate: "2026-11-01",
  });

  it("all gates pass, yet nothing is collected before the contractual date", () => {
    const input = {
      arrangement: arr,
      schedule: acceptedSchedule(),
      accepted: exactContent(),
      mandate: mandate(),
      approval,
      asOf: "2026-10-05",
    };
    expect(activationPreconditions(input)).toEqual([]);
    expect(canActivate(input)).toBe(true);
    const charge = chargeability(acceptedSchedule(), exactContent());
    expect(shouldCollectOn(charge, "2026-10-05")).toBe(false);
    expect(shouldCollectOn(charge, "2026-11-01")).toBe(true);
  });

  it("distinguishes the contractual start from the provider collection date and never shifts the commercial date", () => {
    const t = collectionTiming("2026-11-01", "2026-10-30", 5);
    expect(t.contractualStartDate).toBe("2026-11-01");
    expect(t.earliestProviderCollectionDate).toBe("2026-11-04");
    expect(t.providerLater).toBe(true);
    expect(t.displayCollectionDate).toBe("2026-11-04");
    expect(t.chargeBeforeStart).toBe(false);

    const early = collectionTiming("2026-11-01", "2026-10-05", 5);
    expect(early.providerLater).toBe(false);
    expect(early.displayCollectionDate).toBe("2026-11-01");
  });

  it("flags insufficient provider notice ahead of the date instead of moving the date", () => {
    const base = {
      arrangement: arr,
      schedule: acceptedSchedule(),
      accepted: exactContent({ noticeDays: 30 }),
      mandate: mandate({ providerLeadDays: 5 }),
      approval,
    };
    // Three days out, provider needs five: the gate names it.
    expect(
      activationPreconditions({ ...base, asOf: "2026-10-29" }).map((m) => m.gate)
    ).toEqual(["notice_period"]);
    // The contractual cancellation notice (30 days) is not an activation gate.
    expect(activationPreconditions({ ...base, asOf: "2026-10-20" })).toEqual([]);
    // On or after the date the provider collects later; that is a timing fact, not a missing gate.
    expect(activationPreconditions({ ...base, asOf: "2026-11-01" })).toEqual([]);
  });

  it("a conditional-wording start is not an agreed start until the exact date is recorded", () => {
    const missing = activationPreconditions({
      arrangement: arrangement({
        packageState: "accepted",
        billingStartArrangement: "conditional_wording",
        approvedWordingRef: "solicitor-ref",
      }),
      schedule: acceptedSchedule(),
      accepted: exactContent(),
      mandate: mandate(),
      approval,
      asOf: "2026-10-05",
    });
    expect(missing.map((m) => m.gate)).toEqual(["agreed_start"]);
  });

  it("refuses a duplicate rail, a cancelled mandate, a superseded schedule and a self-approval", () => {
    const base = {
      arrangement: arr,
      schedule: acceptedSchedule(),
      accepted: exactContent(),
      mandate: mandate(),
      approval,
      asOf: "2026-10-05",
    };
    expect(
      activationPreconditions({ ...base, mandate: mandate({ otherActiveRails: 1 }) }).map(
        (m) => m.gate
      )
    ).toEqual(["no_duplicate_rail"]);
    expect(
      activationPreconditions({ ...base, mandate: mandate({ status: "cancelled" }) }).map(
        (m) => m.gate
      )
    ).toEqual(["collection_authority"]);
    expect(
      activationPreconditions({
        ...base,
        schedule: acceptedSchedule({ supersededBy: "ss-2" }),
      }).map((m) => m.gate)
    ).toEqual(["schedule_current"]);
    expect(
      activationPreconditions({
        ...base,
        approval: { approvedBy: STAFF_A, approvedAt: approval.approvedAt },
      }).map((m) => m.gate)
    ).toEqual(["internal_approval"]);
    expect(
      activationPreconditions({ ...base, arrangement: { ...arr, projectId: null } }).map(
        (m) => m.gate
      )
    ).toEqual(["service_identity"]);
  });

  it("every gate name is a known gate", () => {
    const all = activationPreconditions({
      arrangement: arrangement({
        route: "unresolved",
        state: "superseded",
        projectId: null,
      }),
      schedule: null,
      accepted: null,
      mandate: null,
      approval: null,
      asOf: "2026-10-05",
    });
    for (const g of all) expect(ACTIVATION_GATES).toContain(g.gate);
  });
});

/* ── §17.1 row 5 / §8.4: the date arrives with something missing ───────── */

describe("start date arrives with something missing (§8.4, §17.1 row 5)", () => {
  const arr = arrangement({
    billingStartArrangement: "exact_date",
    billingStartDate: "2026-11-01",
  });

  it("produces an owned high-priority exception with no default plan, no indicative charge, no backdating, no route change, no shutdown", () => {
    const plan = missingDateExceptionPlan({
      arrangement: arr,
      schedule: null,
      accepted: null,
      mandate: null,
      approval: null,
      asOf: "2026-11-01",
    });
    expect(plan).not.toBeNull();
    if (!plan) return;
    expect(plan.kind).toBe("exception");
    expect(plan.priority).toBe("high");
    expect(plan.ownerRequired).toBe(true);
    expect(plan.originalStartDate).toBe("2026-11-01");
    expect(plan.plan).toBeNull();
    expect(plan.amountMinor).toBeNull();
    expect(plan.forbidden).toEqual({
      defaultPlan: false,
      indicativeCharge: false,
      backdate: false,
      silentDateChange: false,
      forcedRouteChange: false,
      automaticShutdown: false,
    });
    expect(plan.resolutionOptions).toEqual([
      "accepted_amendment",
      "approved_interim_arrangement",
      "explicit_instruction",
    ]);
    expect(plan.missing.map((m) => m.gate)).toContain("schedule_accepted");
    expect(plan.recordGapResponsibility).toBe(true);
  });

  it("price accepted but no mandate on the date → exception naming the mandate, nothing else", () => {
    const plan = missingDateExceptionPlan({
      arrangement: { ...arr, packageState: "accepted" },
      schedule: acceptedSchedule(),
      accepted: exactContent(),
      mandate: mandate({ status: "pending" }),
      approval,
      asOf: "2026-11-03",
    });
    expect(plan?.missing.map((m) => m.gate)).toEqual(["collection_authority"]);
    expect(plan?.originalStartDate).toBe("2026-11-01");
  });

  it("is null before the date, and null when nothing is missing", () => {
    expect(
      missingDateExceptionPlan({
        arrangement: arr,
        schedule: null,
        accepted: null,
        mandate: null,
        approval: null,
        asOf: "2026-10-01",
      })
    ).toBeNull();
    expect(
      missingDateExceptionPlan({
        arrangement: { ...arr, packageState: "accepted" },
        schedule: acceptedSchedule(),
        accepted: exactContent(),
        mandate: mandate({ status: "active" }),
        approval,
        asOf: "2026-11-01",
      })
    ).toBeNull();
  });
});

/* ── §17.1 row 6: independent handover ─────────────────────────────────── */

describe("independent handover (§17.1 row 6, §6.5, decisions 18.3/18.4)", () => {
  it("drafts at £600 GBP inclusive (no VAT line) and no run subscription", () => {
    const h = defaultHandoverContent();
    expect(h.feeMinor).toBe(HANDOVER_FEE_MINOR);
    expect(h.feeMinor).toBe(60000);
    expect(h.currency).toBe("GBP");
    expect(h.taxBasis).toBe("inclusive_no_vat");
    const line = handoverFeeLine(h);
    expect(line.occurrences).toBe(1);
    expect(line.cadence).toBe("one_off");
    expect(line.runSubscription).toBeNull();
    expect(line.issuable).toBe(false);
    expect(line.blockers.map((b) => b.code)).toEqual(
      expect.arrayContaining([
        "fee_disposition_pending",
        "included_work_required",
      ])
    );
  });

  it("appears once with an approved tax basis, third-party costs explicit, once decided", () => {
    const decided: HandoverContent = {
      ...defaultHandoverContent(),
      taxBasis: "exempt",
      feeDisposition: "stop",
      includedWork: [
        "Repository and deployment ownership transfer",
        "Environment inventory",
      ],
      costResponsibility: { hosting: "client", domain: "client", email: "client" },
    };
    expect(handoverBlockers(decided)).toEqual([]);
    const line = handoverFeeLine(decided);
    expect(line.issuable).toBe(true);
    expect(line.amountMinor).toBe(60000);
    expect(line.taxBasis).toBe("exempt");
    expect(line.thirdPartyCosts).toEqual({
      hosting: "client",
      domain: "client",
      email: "client",
    });
    expect(line.applicationFeeDisposition).toBe("stop");
    expect(line.runSubscription).toBeNull();
  });

  it("cannot be issued while pending, and needs second-person review like a service schedule", () => {
    const h = {
      ...defaultHandoverContent(),
      status: "draft" as const,
      createdBy: STAFF_A,
      reviewedBy: STAFF_B,
      reviewedAt: "2026-10-01T10:00:00Z",
    };
    const pending = canIssueHandoverSchedule(h, STAFF_A);
    expect(pending.ok).toBe(false);
    const decided = canIssueHandoverSchedule(
      {
        ...h,
        taxBasis: "exempt",
        feeDisposition: "continue",
        includedWork: ["Transfer"],
      },
      STAFF_A
    );
    expect(decided.ok).toBe(true);
    expect(
      canIssueHandoverSchedule(
        {
          ...h,
          taxBasis: "exempt",
          feeDisposition: "continue",
          includedWork: ["Transfer"],
        },
        STAFF_B
      ).ok
    ).toBe(false);
  });

  it("an independent arrangement has no managed service to activate", () => {
    const missing = activationPreconditions({
      arrangement: arrangement({ route: "independent", packageState: "not_applicable" }),
      schedule: null,
      accepted: null,
      mandate: mandate(),
      approval,
      asOf: "2026-10-05",
    });
    expect(missing.map((m) => m.gate)).toContain("route_managed");
  });
});

/* ── Order Form v2 (§3.3 #1) ───────────────────────────────────────────── */

const v2 = (over: Partial<OrderFormV2> = {}): OrderFormV2 => ({
  id: "of-v2-1",
  commercialVersion: "v2",
  templateVersion: "OF-2026.09-draft",
  client: {
    legalName: "Brightwell Demo Ltd",
    address: "1 Fixture Street, Ipswich",
    billingEmail: "billing@example.test",
    legalEmail: "legal@example.test",
  },
  scope: {
    businessOutcome: "Client intake",
    deliverables: ["Intake forms"],
    included: ["Intake forms"],
    excluded: ["NHS integrations"],
    acceptanceCriteria: ["A client can be registered end to end"],
    clientDependencies: ["Branding supplied"],
  },
  technical: { hostingProvider: "vercel" },
  compliance: {
    personalData: true,
    specialCategoryData: false,
    childrenLikely: false,
    territories: ["GB"],
    aiFeature: false,
    significantAutomatedDecision: false,
    paymentIntegration: false,
  },
  portfolioUse: false,
  applicableScheduleVersions: { msa: "2026.09" },
  build: {
    price: { amountMinor: 1_200_000, currency: "GBP" },
    taxBasis: "exempt",
    milestones: [
      { label: "Deposit", pct: 50, trigger: "Order Form accepted and kick-off booked" },
      { label: "Build review", pct: 25, trigger: "Client review complete" },
      { label: "Acceptance", pct: 25, trigger: "Build accepted" },
    ],
  },
  serviceRoute: {
    election: "managed",
    managed: {
      packageSelection: "deferred",
      scheduleAcceptance: "separate_service_schedule",
      billingStart: { arrangement: "unresolved" },
    },
  },
  signatory: { name: "Leo Marsh", title: "Director", email: "leo@example.test" },
  ...over,
});

describe("Order Form v2 (§3.3 #1, §8.1)", () => {
  it("Managed with the package deferred and the billing start unresolved has no blockers", () => {
    const form = v2();
    expect(isOrderFormV2(form)).toBe(true);
    expect(orderFormV2Blockers(form)).toEqual([]);
    expect(canIssueOrderFormV2(form)).toBe(true);
  });

  it("an unresolved route, a selected package without an exact amount, or an exact date without the date blocks issue", () => {
    expect(
      orderFormV2Blockers(v2({ serviceRoute: { election: "unresolved" } })).map(
        (b) => b.code
      )
    ).toContain("ROUTE_UNRESOLVED");
    const vaguePackage = v2({
      serviceRoute: {
        election: "managed",
        managed: {
          packageSelection: "selected",
          package: { code: "run-core", label: "Core", catalogueStatus: "draft_sandbox" },
          scheduleAcceptance: "separate_service_schedule",
          billingStart: { arrangement: "exact_date" },
        },
      },
    });
    const codes = orderFormV2Blockers(vaguePackage).map((b) => b.code);
    expect(codes).toContain("PACKAGE_AMOUNT_INEXACT");
    expect(codes).toContain("BILLING_START_DATE_REQUIRED");
    expect(canIssueOrderFormV2(vaguePackage)).toBe(false);
  });

  it("independent: £600 with tax pending blocks issue; a different fee is a warning; a retained application fee needs a disposition", () => {
    const independent = v2({
      applicationFee: { enabled: true, percent: 1.5 },
      serviceRoute: {
        election: "independent",
        independent: {
          handoverFee: { amountMinor: 60000, currency: "GBP" },
          taxBasis: "pending",
          includedWork: ["Transfer"],
          dependencies: [],
          costResponsibility: { hosting: "client" },
          ongoingManagement: "none",
          applicationFeeDisposition: "pending",
        },
      },
    });
    const codes = orderFormV2Blockers(independent).map((b) => b.code);
    expect(codes).toContain("HANDOVER_TAX_BASIS_PENDING");
    expect(codes).toContain("APPLICATION_FEE_DISPOSITION_PENDING");
    expect(codes).not.toContain("HANDOVER_FEE_DEVIATES");

    const deviates = v2({
      serviceRoute: {
        election: "independent",
        independent: {
          handoverFee: { amountMinor: 90000, currency: "GBP" },
          taxBasis: "exempt",
          includedWork: ["Transfer"],
          dependencies: [],
          costResponsibility: {},
          ongoingManagement: "none",
          applicationFeeDisposition: "stop",
        },
      },
    });
    const dev = orderFormV2Blockers(deviates);
    expect(dev.map((b) => b.code)).toEqual(["HANDOVER_FEE_DEVIATES"]);
    expect(dev[0]?.blocksIssue).toBe(false);
    expect(canIssueOrderFormV2(deviates)).toBe(true);
  });

  it("milestones must sum to 100% or to the build price", () => {
    const bad = v2({
      build: {
        price: { amountMinor: 100000, currency: "GBP" },
        taxBasis: "exempt",
        milestones: [{ label: "Deposit", pct: 50, trigger: "Accepted" }],
      },
    });
    expect(orderFormV2Blockers(bad).map((b) => b.code)).toContain(
      "MILESTONES_INCOMPLETE"
    );
    const exact = v2({
      build: {
        price: { amountMinor: 100000, currency: "GBP" },
        taxBasis: "exempt",
        milestones: [
          {
            label: "Deposit",
            amount: { amountMinor: 40000, currency: "GBP" },
            trigger: "Accepted",
          },
          {
            label: "Final",
            amount: { amountMinor: 60000, currency: "GBP" },
            trigger: "Build accepted",
          },
        ],
      },
    });
    expect(orderFormV2Blockers(exact)).toEqual([]);
  });

  it("the commercial content snapshot hashes stably and changes when a fact changes", () => {
    const content = orderFormV2CommercialContent(v2());
    const frozen = buildAcceptanceSnapshot({
      documentType: "order_form_v2",
      documentId: "of-v2-1",
      versionNo: 1,
      templateVersion: "OF-2026.09-draft",
      content: content as never,
    });
    expect(verifySnapshot(frozen.snapshot, frozen.hash)).toBe(true);
    const changed = orderFormV2CommercialContent(
      v2({ build: { ...v2().build, price: { amountMinor: 1_300_000, currency: "GBP" } } })
    );
    expect(snapshotDiffers(content as never, changed as never)).toBe(true);
  });
});

/* ── Date helpers ──────────────────────────────────────────────────────── */

describe("date helpers", () => {
  it("count days and add days in UTC", () => {
    expect(daysBetween("2026-10-30", "2026-11-01")).toBe(2);
    expect(daysBetween("2026-11-01", "2026-10-30")).toBe(-2);
    expect(addDays("2026-12-30", 5)).toBe("2027-01-04");
  });
});
