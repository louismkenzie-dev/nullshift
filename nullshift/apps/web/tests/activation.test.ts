import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  activationGates,
  dateArrivalOutcome,
  duplicateRails,
  isMandateUsable,
  isUniqueViolation,
  onOtherPaymentArrived,
  reservationAuditEntry,
  reserveActivation,
  scheduleActivation,
  type ActivationRecord,
  type ActivationStore,
  type CollectionRail,
  type GateInput,
  type MandateRecord,
  type ReservationInsert,
} from "@/lib/billing/activation";
import {
  mapProviderStatus,
  recordMandateFromEvent,
  releaseMandateHold,
  type MandateEventInput,
  type ProviderMandateResource,
} from "@/lib/billing/mandates";
import type {
  Arrangement,
  ScheduleContent,
  ServiceSchedule,
} from "@/lib/legal/arrangements";

/* ── Fixtures (fictional; no real client, no real provider id) ──────────── */

const STAFF_A = "00000000-0000-4000-8000-00000000000a";
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
  packageState: "accepted",
  billingStartArrangement: "exact_date",
  billingStartDate: "2026-11-01",
  approvedWordingRef: null,
  state: "active",
  supersedesId: null,
  supersededBy: null,
  variationReason: null,
  ...over,
});

const content = (over: Partial<ScheduleContent> = {}): ScheduleContent => ({
  packageCode: "run-core-draft",
  catalogueRef: "catalogue-draft-2026-09#run-core",
  inclusions: ["Hosting and monitoring"],
  exclusions: ["New features"],
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

const acceptedSchedule = (over: Partial<ServiceSchedule> = {}): ServiceSchedule => ({
  ...content(),
  id: "ss-1",
  arrangementId: "arr-1",
  versionNo: 1,
  status: "accepted",
  createdBy: STAFF_A,
  reviewedBy: STAFF_C,
  reviewedAt: "2026-10-01T10:00:00Z",
  issuedBy: STAFF_A,
  issuedAt: "2026-10-01T11:00:00Z",
  acceptedAt: "2026-10-02T09:00:00Z",
  acceptedByUser: CLIENT_USER,
  acceptedByName: "Leo Marsh",
  acceptedRole: "Director",
  acceptanceMethod: "clickwrap",
  documentHash: "a".repeat(64),
  supersededBy: null,
  ...over,
});

const mandate = (over: Partial<MandateRecord> = {}): MandateRecord => ({
  id: "md-row-1",
  tenantId: TENANT,
  provider: "gocardless",
  environment: "live",
  customerRef: "CU-fixture",
  billingRequestRef: "BRQ-fixture",
  mandateRef: "MD-fixture",
  status: "authorised",
  consentTermsVersion: "dd-consent-2026.09",
  consentAcceptanceRef: "acceptance:ss-1",
  heldForReview: false,
  holdReason: null,
  authorisedAt: "2026-10-05T09:00:00Z",
  cancelledAt: null,
  replacedBy: null,
  rawStatus: "submitted",
  lastProviderSyncAt: "2026-10-05T09:00:00Z",
  ...over,
});

const approval = { approvedBy: STAFF_C, approvedAt: "2026-10-06T09:00:00Z" };

const gateInput = (over: Partial<GateInput> = {}): GateInput => ({
  arrangement: arrangement(),
  schedule: acceptedSchedule(),
  accepted: content(),
  approval,
  environment: "live",
  mandate: mandate(),
  providerLeadDays: 5,
  existingRails: [],
  asOf: "2026-10-10",
  ...over,
});

const reserved = (over: Partial<ActivationRecord> = {}): ActivationRecord => ({
  id: "act-1",
  arrangementId: "arr-1",
  scheduleId: "ss-1",
  mandateId: "md-row-1",
  requestedBy: STAFF_A,
  approvedBy: STAFF_C,
  contractualStartDate: "2026-11-01",
  requestedChargeDate: null,
  providerConfirmedChargeDate: null,
  providerSubscriptionRef: null,
  environment: "live",
  state: "reserved",
  failureReason: null,
  ...over,
});

/**
 * An in-memory store that behaves like Postgres with the 0064 partial unique
 * index `service_activations_one_live_per_arrangement`: each insert yields
 * to the event loop first (so two callers genuinely interleave), then checks
 * and commits in one synchronous step, as a unique index does at commit.
 */
function memoryStore() {
  const live = new Set<string>();
  const rows: ReservationInsert[] = [];
  let n = 0;
  const store: ActivationStore = {
    async insertReservation(row) {
      await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 3)));
      if (live.has(row.arrangementId))
        return {
          ok: false,
          error: {
            code: "23505",
            message:
              'duplicate key value violates unique constraint "service_activations_one_live_per_arrangement"',
          },
        };
      live.add(row.arrangementId);
      rows.push(row);
      n += 1;
      return { ok: true, id: `act-${n}` };
    },
  };
  return { store, rows };
}

beforeEach(() => vi.stubEnv("OPS_V2_FLAGS", "billingActivation"));
afterEach(() => vi.unstubAllEnvs());

/* ── Flag off: nothing reserves, nothing records ─────────────────────────── */

describe("flag off", () => {
  it("reserveActivation refuses before touching the store", async () => {
    vi.stubEnv("OPS_V2_FLAGS", "");
    const { store, rows } = memoryStore();
    const r = await reserveActivation(store, {
      gates: gateInput(),
      requestedBy: STAFF_A,
    });
    expect(r).toEqual({ ok: false, reason: "flag_off" });
    expect(rows).toHaveLength(0);
  });

  it("recordMandateFromEvent refuses and still promises no subscription", () => {
    vi.stubEnv("OPS_V2_FLAGS", "");
    const r = recordMandateFromEvent(mandateEvent());
    expect(r.ok).toBe(false);
    expect(r.never.createSubscription).toBe(false);
    expect(r.never.createActivation).toBe(false);
  });
});

/* ── §8.3 step 5: two concurrent reservations → exactly one wins ─────────── */

describe("reservation (§8.3 step 5, §10.2 transactional duplicate protection)", () => {
  it("two concurrent callers with the same arrangement get exactly one winner", async () => {
    const { store, rows } = memoryStore();
    const results = await Promise.all([
      reserveActivation(store, { gates: gateInput(), requestedBy: STAFF_A }),
      reserveActivation(store, { gates: gateInput(), requestedBy: STAFF_C }),
    ]);
    const winners = results.filter((r) => r.ok);
    const losers = results.filter((r) => !r.ok);
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
    expect(losers[0]).toEqual({ ok: false, reason: "duplicate", arrangementId: "arr-1" });
    expect(rows).toHaveLength(1);
    expect(rows[0].state).toBe("reserved");
    expect(rows[0].contractualStartDate).toBe("2026-11-01");
  });

  it("ten concurrent callers still yield one row", async () => {
    const { store, rows } = memoryStore();
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        reserveActivation(store, { gates: gateInput(), requestedBy: `staff-${i}` })
      )
    );
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok && r.reason === "duplicate")).toHaveLength(9);
    expect(rows).toHaveLength(1);
  });

  it("different arrangements do not block each other", async () => {
    const { store, rows } = memoryStore();
    const results = await Promise.all([
      reserveActivation(store, { gates: gateInput(), requestedBy: STAFF_A }),
      reserveActivation(store, {
        gates: gateInput({
          arrangement: arrangement({ id: "arr-2", projectId: "proj-2" }),
          schedule: acceptedSchedule({ id: "ss-2", arrangementId: "arr-2" }),
        }),
        requestedBy: STAFF_A,
      }),
    ]);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(rows).toHaveLength(2);
  });

  it("a missing gate refuses before the store is touched", async () => {
    const { store, rows } = memoryStore();
    const r = await reserveActivation(store, {
      gates: gateInput({ approval: null }),
      requestedBy: STAFF_A,
    });
    expect(r.ok).toBe(false);
    if (!r.ok && r.reason === "gates_missing")
      expect(r.missing.map((m) => m.gate)).toContain("internal_approval");
    expect(rows).toHaveLength(0);
  });

  it("recognises the unique violation by code or by index name", () => {
    expect(isUniqueViolation({ code: "23505", message: "x" })).toBe(true);
    expect(
      isUniqueViolation({ message: "service_activations_one_live_per_arrangement" })
    ).toBe(true);
    expect(isUniqueViolation({ code: "42P01", message: "relation missing" })).toBe(false);
  });

  it("every outcome, including the loser, gets an audit entry", async () => {
    const { store } = memoryStore();
    const a = await reserveActivation(store, {
      gates: gateInput(),
      requestedBy: STAFF_A,
    });
    const b = await reserveActivation(store, {
      gates: gateInput(),
      requestedBy: STAFF_C,
    });
    const ctx = { tenantId: TENANT, arrangementId: "arr-1", actor: STAFF_A };
    expect(reservationAuditEntry(a, ctx).action).toBe("billing.activation_reserved");
    expect(reservationAuditEntry(b, ctx).action).toBe(
      "billing.activation_refused.duplicate"
    );
  });
});

/* ── §8.4: the date arrives with a missing gate → exception, no charge ───── */

describe("date arrival (§8.4)", () => {
  it("before the date nothing is due", () => {
    expect(dateArrivalOutcome(gateInput({ asOf: "2026-10-10" })).kind).toBe("not_due");
  });

  it("date arrived, every gate passes → ready with the exact accepted terms", () => {
    const out = dateArrivalOutcome(gateInput({ asOf: "2026-11-01" }));
    expect(out.kind).toBe("ready");
    if (out.kind === "ready") {
      expect(out.charge.amountMinor).toBe(14900);
      expect(out.charge.currency).toBe("GBP");
      expect(out.contractualStartDate).toBe("2026-11-01");
    }
  });

  it("date arrived with internal approval missing → owned exception, no charge, no default plan", () => {
    const out = dateArrivalOutcome(gateInput({ asOf: "2026-11-01", approval: null }));
    expect(out.kind).toBe("exception");
    if (out.kind === "exception") {
      expect(out.priority).toBe("high");
      expect(out.ownerRequired).toBe(true);
      expect(out.missing.map((m) => m.gate)).toContain("internal_approval");
      expect(out.charge).toBeNull();
      expect(out.amountMinor).toBeNull();
      expect(out.plan).toBeNull();
      expect(out.originalStartDate).toBe("2026-11-01");
      expect(Object.values(out.forbidden).every((v) => v === false)).toBe(true);
      expect(out.resolutionOptions).toEqual([
        "accepted_amendment",
        "approved_interim_arrangement",
        "explicit_instruction",
      ]);
    }
  });

  it("date arrived with no mandate → exception rather than a card fallback", () => {
    const out = dateArrivalOutcome(gateInput({ asOf: "2026-11-03", mandate: null }));
    expect(out.kind).toBe("exception");
    if (out.kind === "exception") {
      expect(out.missing.map((m) => m.gate)).toContain("collection_authority");
      // The original date is preserved even though today is later.
      expect(out.originalStartDate).toBe("2026-11-01");
    }
  });

  it("scheduleActivation refuses when a gate is missing, so no worker operation is produced", () => {
    const r = scheduleActivation(
      reserved(),
      gateInput({ asOf: "2026-11-01", approval: null })
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("gates_missing");
  });
});

/* ── Early mandate: recorded, never a subscription ───────────────────────── */

function resource(over: Partial<ProviderMandateResource> = {}): ProviderMandateResource {
  return {
    provider: "gocardless",
    environment: "live",
    mandateRef: "MD-fixture",
    billingRequestRef: "BRQ-fixture",
    customerRef: "CU-fixture",
    rawStatus: "pending_submission",
    fetchedAt: "2026-10-05T09:00:00Z",
    replacedByMandateRef: null,
    ...over,
  };
}

function mandateEvent(over: Partial<MandateEventInput> = {}): MandateEventInput {
  return {
    eventId: "EV-1",
    resource: resource(),
    tenantId: TENANT,
    consent: { termsVersion: "dd-consent-2026.09", acceptanceRef: "acceptance:ss-1" },
    existing: null,
    successor: null,
    ...over,
  };
}

describe("early mandate (§3.3 #2, §8.3 step 4, §10.2)", () => {
  it("a fulfilled setup request records an authorised mandate and nothing else", () => {
    const plan = recordMandateFromEvent(mandateEvent());
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(plan.op).toBe("insert");
      expect(plan.row.status).toBe("authorised");
      expect(plan.row.authorisedAt).toBe("2026-10-05T09:00:00Z");
      expect(plan.heldForReview).toBe(false);
      expect(plan.never).toEqual({
        createSubscription: false,
        createActivation: false,
        scheduleCollection: false,
        collect: false,
      });
      expect(plan.audit.metadata.createdSubscription).toBe(false);
    }
  });

  it("an authorised mandate before any accepted schedule cannot be reserved", async () => {
    const { store, rows } = memoryStore();
    const r = await reserveActivation(store, {
      gates: gateInput({
        arrangement: arrangement({
          packageState: "pending",
          billingStartArrangement: "unresolved",
          billingStartDate: null,
        }),
        schedule: null,
        accepted: null,
        approval: null,
      }),
      requestedBy: STAFF_A,
    });
    expect(r.ok).toBe(false);
    if (!r.ok && r.reason === "gates_missing") {
      const gates = r.missing.map((m) => m.gate);
      expect(gates).toContain("schedule_accepted");
      expect(gates).toContain("exact_amount");
      expect(gates).toContain("agreed_start");
      expect(gates).not.toContain("collection_authority");
    }
    expect(rows).toHaveLength(0);
  });

  it("maps provider statuses without inventing authority", () => {
    expect(mapProviderStatus("gocardless", "pending_customer_approval")).toBe("pending");
    expect(mapProviderStatus("gocardless", "submitted")).toBe("authorised");
    expect(mapProviderStatus("gocardless", "active")).toBe("active");
    expect(mapProviderStatus("gocardless", "expired")).toBe("cancelled");
    expect(mapProviderStatus("gocardless", "something_new")).toBeNull();
  });

  it("an unrecognised provider status is held, not guessed", () => {
    const plan = recordMandateFromEvent(
      mandateEvent({ resource: resource({ rawStatus: "something_new" }) })
    );
    expect(plan.ok && plan.heldForReview).toBe(true);
    if (plan.ok) expect(plan.row.status).toBe("pending");
  });

  it("a later-fetched active state updates the row; an older fetch is a no-op", () => {
    const existing = mandate();
    const newer = recordMandateFromEvent(
      mandateEvent({
        existing,
        resource: resource({ rawStatus: "active", fetchedAt: "2026-10-07T09:00:00Z" }),
      })
    );
    expect(newer.ok && newer.op).toBe("update");
    if (newer.ok) {
      expect(newer.row.status).toBe("active");
      expect(newer.row.authorisedAt).toBe(existing.authorisedAt);
      expect(newer.row.id).toBe(existing.id);
    }
    const stale = recordMandateFromEvent(
      mandateEvent({
        existing,
        resource: resource({
          rawStatus: "pending_customer_approval",
          fetchedAt: "2026-10-01T09:00:00Z",
        }),
      })
    );
    expect(stale.ok && stale.op).toBe("noop");
  });

  it("a cancelled mandate does not regress to authorised", () => {
    const existing = mandate({
      status: "cancelled",
      rawStatus: "cancelled",
      cancelledAt: "2026-10-08T00:00:00Z",
    });
    const plan = recordMandateFromEvent(
      mandateEvent({
        existing,
        resource: resource({ rawStatus: "submitted", fetchedAt: "2026-10-09T00:00:00Z" }),
      })
    );
    expect(plan.ok && plan.row.status).toBe("cancelled");
  });

  it("replacement marks the old row replaced only once the successor is known", () => {
    const existing = mandate();
    const without = recordMandateFromEvent(
      mandateEvent({
        existing,
        resource: resource({
          rawStatus: "cancelled",
          replacedByMandateRef: "MD-new",
          fetchedAt: "2026-10-09T00:00:00Z",
        }),
      })
    );
    expect(without.ok && without.row.status).toBe("cancelled");
    expect(without.ok && without.followUp).toMatch(/MD-new/);
    const successor = mandate({ id: "md-row-2", mandateRef: "MD-new" });
    const withSucc = recordMandateFromEvent(
      mandateEvent({
        existing,
        successor,
        resource: resource({
          rawStatus: "cancelled",
          replacedByMandateRef: "MD-new",
          fetchedAt: "2026-10-09T00:00:00Z",
        }),
      })
    );
    expect(withSucc.ok && withSucc.row.status).toBe("replaced");
    expect(withSucc.ok && withSucc.row.replacedBy).toBe("md-row-2");
  });
});

/* ── Orphan mandate / missing consent → held for review ─────────────────── */

describe("orphan mandate (§10.2 recovery only with original acceptance evidence)", () => {
  it("no tenant → held for review, never usable", () => {
    const plan = recordMandateFromEvent(mandateEvent({ tenantId: null }));
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(plan.heldForReview).toBe(true);
      expect(plan.holdReason).toMatch(/orphan/);
      expect(plan.row.tenantId).toBeNull();
      expect(isMandateUsable(plan.row)).toBe(false);
    }
  });

  it("no consent evidence → held even with a tenant", () => {
    const plan = recordMandateFromEvent(
      mandateEvent({ consent: { termsVersion: null, acceptanceRef: null } })
    );
    expect(plan.ok && plan.heldForReview).toBe(true);
    if (plan.ok) expect(plan.holdReason).toMatch(/consent/);
  });

  it("a held mandate stays held even when a later event carries the evidence", () => {
    const existing = mandate({
      tenantId: null,
      heldForReview: true,
      holdReason: "orphan",
      consentTermsVersion: null,
      consentAcceptanceRef: null,
    });
    const plan = recordMandateFromEvent(
      mandateEvent({
        existing,
        tenantId: TENANT,
        resource: resource({ rawStatus: "active", fetchedAt: "2026-10-09T00:00:00Z" }),
      })
    );
    expect(plan.ok && plan.heldForReview).toBe(true);
  });

  it("a held mandate fails the collection-authority gate", () => {
    const report = activationGates(
      gateInput({ mandate: mandate({ heldForReview: true, holdReason: "orphan" }) })
    );
    expect(report.ok).toBe(false);
    expect(
      report.missing.some(
        (m) => m.gate === "collection_authority" && /held/.test(m.detail)
      )
    ).toBe(true);
    expect(report.charge).toBeNull();
  });

  it("a mandate bound to another client is not authority for this one", () => {
    const report = activationGates(
      gateInput({ mandate: mandate({ tenantId: OTHER_TENANT }) })
    );
    expect(
      report.missing.some(
        (m) => m.gate === "collection_authority" && /different client/.test(m.detail)
      )
    ).toBe(true);
  });

  it("release needs the client, full consent evidence and a reason", () => {
    const held = mandate({
      tenantId: null,
      heldForReview: true,
      holdReason: "orphan",
      consentTermsVersion: null,
      consentAcceptanceRef: null,
    });
    const bad = releaseMandateHold(held, {
      tenantId: TENANT,
      consent: { termsVersion: "dd-consent-2026.09", acceptanceRef: null },
      reason: "found it",
      releasedBy: STAFF_C,
      releasedAt: "2026-10-10T00:00:00Z",
    });
    expect(bad.ok).toBe(false);
    const good = releaseMandateHold(held, {
      tenantId: TENANT,
      consent: { termsVersion: "dd-consent-2026.09", acceptanceRef: "acceptance:ss-1" },
      reason: "Billing request BRQ-fixture matches the accepted schedule ss-1",
      releasedBy: STAFF_C,
      releasedAt: "2026-10-10T00:00:00Z",
    });
    expect(good.ok).toBe(true);
    if (good.ok) {
      expect(good.row.heldForReview).toBe(false);
      expect(isMandateUsable(good.row)).toBe(true);
      expect(good.never.createSubscription).toBe(false);
    }
    expect(
      releaseMandateHold(mandate(), {
        tenantId: TENANT,
        consent: { termsVersion: "x", acceptanceRef: "y" },
        reason: "r",
        releasedBy: STAFF_C,
        releasedAt: "t",
      }).ok
    ).toBe(false);
  });
});

/* ── Sandbox vs live (§12.3) ─────────────────────────────────────────────── */

describe("environments never mix (§12.3)", () => {
  it("a sandbox mandate cannot satisfy a live activation", () => {
    const report = activationGates(
      gateInput({ mandate: mandate({ environment: "sandbox" }) })
    );
    expect(report.ok).toBe(false);
    expect(report.missing.map((m) => m.gate)).toContain("environment_match");
    expect(report.charge).toBeNull();
  });

  it("scheduleActivation refuses an environment mismatch even if the gate report were ignored", () => {
    const r = scheduleActivation(
      reserved({ environment: "live" }),
      gateInput({ environment: "sandbox", mandate: mandate({ environment: "sandbox" }) })
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("environment_mismatch");
  });

  it("a live mandate row cannot be updated from a sandbox resource", () => {
    const plan = recordMandateFromEvent(
      mandateEvent({
        existing: mandate(),
        resource: resource({ environment: "sandbox" }),
      })
    );
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.reason).toBe("environment_mismatch");
  });

  it("a sandbox mandate on a sandbox activation is fine", () => {
    const report = activationGates(
      gateInput({ environment: "sandbox", mandate: mandate({ environment: "sandbox" }) })
    );
    expect(report.ok).toBe(true);
  });
});

/* ── Duplicate rails, including Xero-native (§10.1, §12.3) ──────────────── */

describe("one collection orchestrator per obligation", () => {
  const xero: CollectionRail = {
    kind: "xero_native",
    environment: null,
    status: "active",
    ref: "xero-dd-workflow",
  };

  it("a Xero-native collection workflow is a duplicate rail even though it is the same provider", () => {
    const report = activationGates(gateInput({ existingRails: [xero] }));
    expect(report.ok).toBe(false);
    const dup = report.missing.filter((m) => m.gate === "no_duplicate_rail");
    expect(dup).toHaveLength(1);
    expect(dup[0].detail).toMatch(/Xero-native/);
  });

  it("is reported even before a mandate exists", () => {
    const report = activationGates(gateInput({ mandate: null, existingRails: [xero] }));
    expect(report.missing.map((m) => m.gate)).toContain("no_duplicate_rail");
  });

  it("a cancelled rail does not count; a sandbox app rail does not block a live activation", () => {
    expect(duplicateRails([{ ...xero, status: "cancelled" }], "live")).toHaveLength(0);
    expect(
      duplicateRails(
        [
          {
            kind: "app_subscription",
            environment: "sandbox",
            status: "active",
            ref: "SB1",
          },
        ],
        "live"
      )
    ).toHaveLength(0);
    expect(
      duplicateRails(
        [{ kind: "app_subscription", environment: "live", status: "active", ref: "SB1" }],
        "live"
      )
    ).toHaveLength(1);
  });
});

/* ── Scheduling: payload only, provider call in the worker ───────────────── */

describe("scheduleActivation (§8.3 steps 6–7)", () => {
  it("returns the worker operation with the contractual date preserved", () => {
    const r = scheduleActivation(reserved(), gateInput({ asOf: "2026-10-10" }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.operation.executeIn).toBe("worker");
      expect(r.operation.kind).toBe("provider.schedule_collection");
      expect(r.operation.idempotencyKey).toBe("activation:act-1:schedule");
      expect(r.operation.contractualStartDate).toBe("2026-11-01");
      expect(r.operation.requestedChargeDate).toBe("2026-11-01");
      expect(r.operation.providerConfirmedChargeDate).toBeNull();
      expect(r.operation.amountMinor).toBe(14900);
      expect(r.operation.mandateRef).toBe("MD-fixture");
      expect(r.next).toBe("scheduled");
    }
  });

  it("when the provider needs longer than remains, the requested date moves but the contractual date does not", () => {
    const r = scheduleActivation(
      reserved(),
      gateInput({ asOf: "2026-11-01", providerLeadDays: 5 })
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.operation.contractualStartDate).toBe("2026-11-01");
      expect(r.operation.requestedChargeDate).toBe("2026-11-06");
      expect(r.operation.timing.providerLater).toBe(true);
      expect(r.operation.timing.chargeBeforeStart).toBe(false);
    }
  });

  it("only a reserved activation can be scheduled", () => {
    const r = scheduleActivation(reserved({ state: "scheduled" }), gateInput());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("not_reserved");
  });
});

/* ── Bank transfer before Direct Debit (§10.2, §17.2) ────────────────────── */

describe("another payment arrives while a collection is pending", () => {
  const obligation = {
    obligationId: "ob-1",
    grossMinor: 14900,
    currency: "GBP",
    allocatedMinor: 0,
  };
  const pending = {
    provider: "gocardless" as const,
    environment: "live" as const,
    ref: "PM-1",
    amountMinor: 14900,
    currency: "GBP",
    status: "scheduled" as const,
    cancellableByProvider: true,
  };

  it("bank transfer settles the obligation → cancellation requested, recorded only on provider confirmation", () => {
    const out = onOtherPaymentArrived(
      obligation,
      { source: "bank_transfer", ref: "BT-1", amountMinor: 14900, currency: "GBP" },
      pending
    );
    expect(out.remainingMinor).toBe(0);
    expect(out.overpaymentMinor).toBe(0);
    expect(out.action.kind).toBe("request_cancellation");
    if (out.action.kind === "request_cancellation") {
      expect(out.action.operation.executeIn).toBe("worker");
      expect(out.action.operation.recordOnProviderConfirmation).toBe(true);
      expect(out.action.followUp).toBeNull();
    }
  });

  it("already submitted → urgent owned exception; closing a link is not enough", () => {
    const out = onOtherPaymentArrived(
      obligation,
      { source: "bank_transfer", ref: "BT-1", amountMinor: 14900, currency: "GBP" },
      { ...pending, status: "submitted", cancellableByProvider: false }
    );
    expect(out.action.kind).toBe("exception");
    if (out.action.kind === "exception") {
      expect(out.action.priority).toBe("urgent");
      expect(out.action.ownerRequired).toBe(true);
      expect(out.action.closingPaymentLinkIsInsufficient).toBe(true);
    }
    // The overpayment that will result stays visible and is not refunded here.
    expect(out.overpayment.automaticRefund).toBe(false);
    expect(out.overpayment.writeOff).toBe(false);
  });

  it("overpayment is visible, needs approval and is never refunded automatically", () => {
    const out = onOtherPaymentArrived(
      obligation,
      { source: "bank_transfer", ref: "BT-1", amountMinor: 20000, currency: "GBP" },
      null
    );
    expect(out.remainingMinor).toBe(-5100);
    expect(out.overpaymentMinor).toBe(5100);
    expect(out.overpayment).toEqual({
      visible: true,
      automaticRefund: false,
      writeOff: false,
      requiresApproval: true,
    });
    expect(out.action.kind).toBe("none");
  });

  it("a partial payment that still leaves room for the collection changes nothing", () => {
    const out = onOtherPaymentArrived(
      { ...obligation, grossMinor: 30000 },
      { source: "bank_transfer", ref: "BT-1", amountMinor: 10000, currency: "GBP" },
      pending
    );
    expect(out.remainingMinor).toBe(20000);
    expect(out.action.kind).toBe("none");
  });

  it("a currency mismatch is never netted; it is an urgent exception", () => {
    const out = onOtherPaymentArrived(
      obligation,
      { source: "stripe", ref: "ch_1", amountMinor: 14900, currency: "EUR" },
      pending
    );
    expect(out.remainingMinor).toBe(14900);
    expect(out.action.kind).toBe("exception");
  });
});
