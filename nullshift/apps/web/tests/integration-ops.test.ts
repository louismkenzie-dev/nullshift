import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { capture, gocardlessEventToInbound } from "@/lib/integrations/inbox";
import {
  backoffDelayMs,
  enqueue,
  opCancelPending,
  opScheduleActivation,
  opXeroAllocatePayment,
  opXeroCreateInvoice,
} from "@/lib/integrations/outbox";
import { deadLetterException, runOnce, sanitiseError } from "@/lib/integrations/worker";
import { defaultHandlers } from "@/lib/integrations/handlers";
import {
  processGoCardlessEvent,
  sweepUnprocessedEvents,
} from "@/lib/integrations/gocardlessEvents";
import {
  emptyData,
  fakeGoCardless,
  fakeNotify,
  fakeXero,
  memoryStore,
  type MemoryData,
  type MemoryStore,
} from "@/lib/integrations/memoryStore";
import type { Ports } from "@/lib/integrations/types";
import {
  scheduleActivation,
  type ActivationRecord,
  type GateInput,
  type MandateRecord,
} from "@/lib/billing/activation";
import type {
  Arrangement,
  ScheduleContent,
  ServiceSchedule,
} from "@/lib/legal/arrangements";

/* ── Fixtures (fictional; no real client, no real provider id) ──────────── */

const TENANT = "00000000-0000-4000-8000-0000000000a1";
const OTHER_TENANT = "00000000-0000-4000-8000-0000000000a2";
const PROJECT = "00000000-0000-4000-8000-0000000000b1";
const STAFF_A = "00000000-0000-4000-8000-00000000000a";
const STAFF_C = "00000000-0000-4000-8000-00000000000c";
const CLIENT_USER = "00000000-0000-4000-8000-0000000000c1";
const INVOICE = "00000000-0000-4000-8000-0000000000d1";
const LIVE_INVOICE = "00000000-0000-4000-8000-0000000000d2";
const OBLIGATION = "00000000-0000-4000-8000-0000000000e1";
const LIVE_OBLIGATION = "00000000-0000-4000-8000-0000000000e2";
const ACTIVATION = "00000000-0000-4000-8000-0000000000f1";
const LIVE_ACTIVATION = "00000000-0000-4000-8000-0000000000f2";
const NOW = "2026-10-10T09:00:00.000Z";

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

const mandateRow = (over: Partial<MandateRecord> = {}): MandateRecord => ({
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

const gateInput = (over: Partial<GateInput> = {}): GateInput => ({
  arrangement: arrangement(),
  schedule: acceptedSchedule(),
  accepted: content(),
  approval: { approvedBy: STAFF_C, approvedAt: "2026-10-06T09:00:00Z" },
  environment: "live",
  mandate: mandateRow(),
  providerLeadDays: 5,
  existingRails: [],
  asOf: "2026-10-10",
  ...over,
});

const reserved = (
  over: Partial<ActivationRecord & { tenantId: string }> = {}
): ActivationRecord & { tenantId: string } => ({
  id: ACTIVATION,
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
  tenantId: TENANT,
  ...over,
});

/** A live-model client with an active activation, a period obligation and an issued invoice. */
function seedLiveClient(data: MemoryData) {
  data.tenants.push({
    id: TENANT,
    name: "Harbour Vet Group (fixture)",
    email: "billing@example.test",
    xeroContactId: null,
  });
  data.activations.push(
    reserved({
      id: LIVE_ACTIVATION,
      state: "active",
      providerSubscriptionRef: "SB-LIVE-1",
      providerConfirmedChargeDate: "2026-11-01",
    })
  );
  data.obligations.push({
    id: LIVE_OBLIGATION,
    tenantId: TENANT,
    arrangementId: "arr-1",
    kind: "service_period",
    periodStart: "2026-11-01",
    periodEnd: "2026-12-01",
    currency: "GBP",
    amountGrossMinor: 14900,
  });
  data.invoices.push({
    id: LIVE_INVOICE,
    tenantId: TENANT,
    obligationId: LIVE_OBLIGATION,
    status: "open",
    amountMinor: 14900,
    currency: "GBP",
    createdAt: "2026-11-01T00:00:00.000Z",
    dueAt: "2026-11-15T00:00:00.000Z",
    xeroInvoiceId: null,
    hostedInvoiceUrl: null,
    lines: [{ description: "Managed service — November 2026", amountMinor: 14900 }],
  });
}

type World = {
  store: MemoryStore;
  data: MemoryData;
  xero: ReturnType<typeof fakeXero>;
  gc: ReturnType<typeof fakeGoCardless>;
  ports: Ports;
};

function world(env: "live" | "sandbox" = "live"): World {
  const data = emptyData();
  const store = memoryStore(data);
  const xero = fakeXero();
  const gc = fakeGoCardless(env);
  return { store, data, xero, gc, ports: { xero, gocardless: gc, notify: fakeNotify() } };
}

const paymentEvent = (id: string, action: string, paymentRef: string) => ({
  id,
  resource_type: "payments",
  action,
  links: { payment: paymentRef },
});

async function run(w: World, now = NOW, owner = "worker-A", limit = 25) {
  return runOnce({
    store: w.store,
    ports: w.ports,
    handlers: defaultHandlers(),
    owner,
    now,
    limit,
  });
}

beforeEach(() => {
  process.env.OPS_V2_FLAGS = "integrationWorkers,billingActivation";
});
afterEach(() => {
  delete process.env.OPS_V2_FLAGS;
});

/* ── Flag off ────────────────────────────────────────────────────────────── */

describe("flag off", () => {
  it("captures nothing, enqueues nothing and runs nothing", async () => {
    process.env.OPS_V2_FLAGS = "";
    const w = world();
    expect(
      await capture(
        w.store,
        gocardlessEventToInbound(paymentEvent("EV1", "confirmed", "PM1"), "live", NOW)
      )
    ).toEqual({ outcome: "flag_off" });
    expect(
      await enqueue(
        w.store,
        opXeroCreateInvoice({ invoiceId: INVOICE, tenantId: TENANT }),
        NOW
      )
    ).toEqual({ outcome: "flag_off" });
    expect((await run(w)).skipped).toBe("flag_off");
    expect(w.data.events).toHaveLength(0);
    expect(w.data.operations).toHaveLength(0);
  });
});

/* ── Duplicate delivery ──────────────────────────────────────────────────── */

describe("duplicate webhook delivery", () => {
  it("captures once and processes once; the redelivery is a no-op", async () => {
    const w = world();
    seedLiveClient(w.data);
    w.gc.payments.set("PM-1", {
      id: "PM-1",
      status: "confirmed",
      amountMinor: 14900,
      currency: "GBP",
      chargeDate: "2026-11-03",
      subscriptionRef: "SB-LIVE-1",
      mandateRef: "MD-fixture",
    });
    const inbound = gocardlessEventToInbound(
      paymentEvent("EV-dup", "confirmed", "PM-1"),
      "live",
      NOW
    );

    const first = await capture(w.store, inbound);
    const second = await capture(w.store, inbound);
    expect(first.outcome).toBe("captured");
    expect(second).toEqual({ outcome: "duplicate" });
    expect(w.data.events).toHaveLength(1);

    const row = (await w.store.getEvent((first as { id: string }).id))!;
    const r1 = await processGoCardlessEvent(
      { store: w.store, gocardless: w.gc, now: NOW },
      row
    );
    expect(r1.outcome).toBe("processed");
    // Processing the same stored row again (a crash between mark and ack) converges.
    const again = (await w.store.getEvent(row.id))!;
    const r2 = await processGoCardlessEvent(
      { store: w.store, gocardless: w.gc, now: NOW },
      again
    );
    expect(r2.note).toBe("already processed");

    expect(w.data.providerPayments).toHaveLength(1);
    expect(w.data.allocations).toHaveLength(1);
    expect(w.data.allocations[0]).toMatchObject({
      obligationId: LIVE_OBLIGATION,
      kind: "payment",
      amountMinor: 14900,
    });
    // One create + one allocate operation, not two of each.
    expect(w.data.operations.map((o) => o.kind).sort()).toEqual([
      "xero.allocate_payment",
      "xero.create_invoice",
    ]);
    expect(w.data.exceptions).toHaveLength(0);
  });

  it("the same event id in the other environment is a different event", async () => {
    const w = world();
    const live = await capture(
      w.store,
      gocardlessEventToInbound(paymentEvent("EV-same", "confirmed", "PM-1"), "live", NOW)
    );
    const sandbox = await capture(
      w.store,
      gocardlessEventToInbound(
        paymentEvent("EV-same", "confirmed", "PM-1"),
        "sandbox",
        NOW
      )
    );
    expect(live.outcome).toBe("captured");
    expect(sandbox.outcome).toBe("captured");
  });
});

/* ── Out-of-order events ─────────────────────────────────────────────────── */

describe("out-of-order confirmed / failed / paid_out", () => {
  it("authoritative state wins: paid_out resource → exactly one payment allocation, whatever order the events arrive", async () => {
    const w = world();
    seedLiveClient(w.data);
    w.gc.payments.set("PM-2", {
      id: "PM-2",
      status: "paid_out",
      amountMinor: 14900,
      currency: "GBP",
      chargeDate: "2026-11-03",
      subscriptionRef: "SB-LIVE-1",
      mandateRef: "MD-fixture",
    });
    const ctx = { store: w.store, gocardless: w.gc, now: NOW };
    for (const [id, action] of [
      ["EV-po", "paid_out"],
      ["EV-cf", "confirmed"],
      ["EV-fl", "failed"],
      ["EV-cf2", "confirmed"],
    ] as const) {
      const c = await capture(
        w.store,
        gocardlessEventToInbound(paymentEvent(id, action, "PM-2"), "live", NOW)
      );
      const r = await processGoCardlessEvent(
        ctx,
        (await w.store.getEvent((c as { id: string }).id))!
      );
      expect(r.outcome).toBe("processed");
    }
    expect(w.data.providerPayments).toHaveLength(1);
    expect(w.data.allocations).toHaveLength(1);
    expect(w.data.allocations[0].kind).toBe("payment");
    // The stale "failed" event could not reverse the newer valid outcome.
    expect(w.data.exceptions.filter((e) => e.kind === "failed_collection")).toHaveLength(
      0
    );
  });

  it("late failure after a recorded payment is a typed bank_return, not a deletion", async () => {
    const w = world();
    seedLiveClient(w.data);
    const ctx = { store: w.store, gocardless: w.gc, now: NOW };
    w.gc.payments.set("PM-3", {
      id: "PM-3",
      status: "confirmed",
      amountMinor: 14900,
      currency: "GBP",
      chargeDate: "2026-11-03",
      subscriptionRef: "SB-LIVE-1",
      mandateRef: "MD-fixture",
    });
    const c1 = await capture(
      w.store,
      gocardlessEventToInbound(paymentEvent("EV-c", "confirmed", "PM-3"), "live", NOW)
    );
    await processGoCardlessEvent(
      ctx,
      (await w.store.getEvent((c1 as { id: string }).id))!
    );
    // The bank later returns it.
    w.gc.payments.get("PM-3")!.status = "failed";
    const c2 = await capture(
      w.store,
      gocardlessEventToInbound(
        paymentEvent("EV-lf", "late_failure_settled", "PM-3"),
        "live",
        NOW
      )
    );
    await processGoCardlessEvent(
      ctx,
      (await w.store.getEvent((c2 as { id: string }).id))!
    );
    // And the provider redelivers the old confirmed event: still nothing new.
    const c3 = await capture(
      w.store,
      gocardlessEventToInbound(
        paymentEvent("EV-c-again", "confirmed", "PM-3"),
        "live",
        NOW
      )
    );
    await processGoCardlessEvent(
      ctx,
      (await w.store.getEvent((c3 as { id: string }).id))!
    );

    expect(w.data.allocations.map((a) => a.kind).sort()).toEqual([
      "bank_return",
      "payment",
    ]);
    expect(w.data.allocations.every((a) => a.obligationId === LIVE_OBLIGATION)).toBe(
      true
    );
    const exc = w.data.exceptions.filter((e) => e.kind === "failed_collection");
    expect(exc).toHaveLength(1);
    expect(exc[0].severity).toBe("urgent");
  });
});

/* ── Crash between remote create and local save ──────────────────────────── */

describe("crash after remote create, before local save", () => {
  it("xero.create_invoice: the retry finds the invoice by our reference and never creates a second one", async () => {
    const w = world();
    seedLiveClient(w.data);
    await enqueue(
      w.store,
      opXeroCreateInvoice({
        invoiceId: LIVE_INVOICE,
        tenantId: TENANT,
        obligationId: LIVE_OBLIGATION,
      }),
      NOW
    );
    w.xero.crashAfterRemote = true;

    const r1 = await run(w);
    expect(r1.results[0].outcome).toBe("retry");
    expect(w.xero.invoices).toHaveLength(1);
    expect(w.data.invoices[0].xeroInvoiceId).toBeNull();

    const later = new Date(new Date(NOW).getTime() + 2 * 60 * 1000).toISOString();
    const r2 = await run(w, later);
    expect(r2.results[0].outcome).toBe("succeeded");
    expect(w.xero.calls.create).toBe(1);
    expect(w.xero.invoices).toHaveLength(1);
    expect(w.data.invoices[0].xeroInvoiceId).toBe(w.xero.invoices[0].invoiceId);
    expect(w.data.audit.some((a) => a.action === "ops.xero_invoice_recovered")).toBe(
      true
    );
  });

  it("gocardless.schedule_activation: the retry adopts the subscription the first attempt created (Idempotency-Key)", async () => {
    const w = world();
    seedLiveClient(w.data);
    w.data.activations.push(reserved());
    w.data.gateInputs[ACTIVATION] = gateInput();
    const sched = scheduleActivation(reserved(), gateInput());
    expect(sched.ok).toBe(true);
    if (!sched.ok) return;
    await enqueue(w.store, opScheduleActivation(sched.operation, TENANT), NOW);
    w.gc.crashAfterRemote = true;

    const r1 = await run(w);
    expect(r1.results[0].outcome).toBe("retry");
    expect(w.gc.subscriptions.size).toBe(1);
    const act = w.data.activations.find((a) => a.id === ACTIVATION)!;
    expect(act.state).toBe("scheduled");
    expect(act.providerSubscriptionRef).toBeNull();

    const later = new Date(new Date(NOW).getTime() + 2 * 60 * 1000).toISOString();
    const r2 = await run(w, later);
    expect(r2.results[0].outcome).toBe("succeeded");
    expect(w.gc.calls.createSubscription).toBe(1);
    expect(w.gc.subscriptions.size).toBe(1);
    expect(act.state).toBe("active");
    expect(act.providerSubscriptionRef).toBe([...w.gc.subscriptions.keys()][0]);
    // Provider-confirmed date written back; never before the contractual start.
    expect(act.providerConfirmedChargeDate).toBe("2026-11-01");
    expect(act.contractualStartDate).toBe("2026-11-01");
  });
});

/* ── Xero outage ─────────────────────────────────────────────────────────── */

describe("Xero outage", () => {
  it("retries with exponential backoff, never re-collects, and dead-letters into an owned exception after max attempts", async () => {
    const w = world();
    seedLiveClient(w.data);
    w.gc.payments.set("PM-4", {
      id: "PM-4",
      status: "confirmed",
      amountMinor: 14900,
      currency: "GBP",
      chargeDate: "2026-11-03",
      subscriptionRef: "SB-LIVE-1",
      mandateRef: "MD-fixture",
    });
    const c = await capture(
      w.store,
      gocardlessEventToInbound(paymentEvent("EV-x", "confirmed", "PM-4"), "live", NOW)
    );
    await processGoCardlessEvent(
      { store: w.store, gocardless: w.gc, now: NOW },
      (await w.store.getEvent((c as { id: string }).id))!
    );
    // The client flow is safe: money recorded, accounting queued.
    expect(w.data.allocations).toHaveLength(1);
    w.xero.failWith = "outage";

    let t = new Date(NOW).getTime();
    const delays: number[] = [];
    for (let i = 0; i < 8; i++) {
      const now = new Date(t).toISOString();
      const r = await run(w, now);
      const create = r.results.find((x) => x.kind === "xero.create_invoice")!;
      if (create.nextAttemptAt) {
        delays.push(new Date(create.nextAttemptAt).getTime() - t);
        t = new Date(create.nextAttemptAt).getTime();
      } else t += 60_000;
    }
    expect(delays.slice(0, 4)).toEqual([60_000, 120_000, 240_000, 480_000]);
    const createOp = w.data.operations.find((o) => o.kind === "xero.create_invoice")!;
    expect(createOp.state).toBe("dead_letter");
    expect(createOp.attempts).toBe(8);
    expect(createOp.lastError).toMatch(/503/);
    const exc = w.data.exceptions.find((e) => e.kind === "xero_outage");
    expect(exc).toBeDefined();
    expect(exc!.safe_retry_op).toBe("xero_create_invoice");
    expect(exc!.external_ref).toBe(createOp.idempotencyKey);
    // Nothing was collected again: still one provider payment, one allocation, zero GoCardless creates.
    expect(w.data.providerPayments).toHaveLength(1);
    expect(w.data.allocations).toHaveLength(1);
    expect(w.gc.calls.createSubscription).toBe(0);
  });

  it("backoff is capped", () => {
    expect(backoffDelayMs(1)).toBe(60_000);
    expect(backoffDelayMs(20)).toBe(6 * 60 * 60 * 1000);
  });
});

/* ── Allocation failure retries only the allocation ──────────────────────── */

describe("successful invoice sync with failed payment allocation", () => {
  it("retries only the allocation; the invoice is not created again and the payment is not entered twice", async () => {
    const w = world();
    seedLiveClient(w.data);
    // Invoice already in Xero.
    w.xero.invoices.push({
      invoiceId: "XI-existing",
      invoiceNumber: "INV-1",
      reference: `NS-${TENANT.slice(0, 4)} · ${LIVE_INVOICE.slice(0, 8)}`,
      status: "AUTHORISED",
      payments: [],
    });
    w.data.invoices[0].xeroInvoiceId = "XI-existing";
    w.data.providerPayments.push({
      id: "pp-seed",
      tenantId: TENANT,
      provider: "gocardless",
      providerPaymentRef: "PM-5",
      kind: "payment",
      amountMinor: 14900,
      currency: "GBP",
      environment: "live",
      receivedAt: NOW,
      evidence: {},
    });
    w.data.allocations.push({
      id: "alloc-seed",
      tenantId: TENANT,
      obligationId: LIVE_OBLIGATION,
      invoiceId: LIVE_INVOICE,
      provider: "gocardless",
      providerPaymentRef: "PM-5",
      kind: "payment",
      amountMinor: 14900,
      currency: "GBP",
      allocatedAt: "2026-11-03T00:00:00.000Z",
      evidence: {},
    });
    await enqueue(
      w.store,
      opXeroAllocatePayment({
        allocationId: "alloc-seed",
        invoiceId: LIVE_INVOICE,
        obligationId: LIVE_OBLIGATION,
        tenantId: TENANT,
      }),
      NOW
    );

    // First attempt: the PUT lands remotely but we crash before saving the marker.
    w.xero.crashAfterRemote = true;
    const r1 = await run(w);
    expect(r1.results[0].outcome).toBe("retry");
    expect(w.xero.invoices[0].payments).toHaveLength(1);

    const later = new Date(new Date(NOW).getTime() + 2 * 60 * 1000).toISOString();
    const r2 = await run(w, later);
    expect(r2.results[0].outcome).toBe("succeeded");
    expect(w.xero.calls.recordPayment).toBe(1);
    expect(w.xero.calls.create).toBe(0);
    expect(w.xero.invoices[0].payments).toHaveLength(1);
    expect(w.data.allocations[0].evidence.xero_payment_id).toBe(
      w.xero.invoices[0].payments[0].paymentId
    );
    expect(w.data.allocations[0].evidence.recovered).toBe(true);
    expect(
      w.data.operations.filter((o) => o.kind === "xero.create_invoice")
    ).toHaveLength(0);
  });

  it("when the invoice is not in Xero yet, the allocation queues the create and waits (two separate operations)", async () => {
    const w = world();
    seedLiveClient(w.data);
    w.data.providerPayments.push({
      id: "pp-seed",
      tenantId: TENANT,
      provider: "gocardless",
      providerPaymentRef: "PM-6",
      kind: "payment",
      amountMinor: 14900,
      currency: "GBP",
      environment: "live",
      receivedAt: NOW,
      evidence: {},
    });
    w.data.allocations.push({
      id: "alloc-6",
      tenantId: TENANT,
      obligationId: LIVE_OBLIGATION,
      invoiceId: LIVE_INVOICE,
      provider: "gocardless",
      providerPaymentRef: "PM-6",
      kind: "payment",
      amountMinor: 14900,
      currency: "GBP",
      allocatedAt: "2026-11-03T00:00:00.000Z",
      evidence: {},
    });
    await enqueue(
      w.store,
      opXeroAllocatePayment({
        allocationId: "alloc-6",
        invoiceId: LIVE_INVOICE,
        obligationId: LIVE_OBLIGATION,
        tenantId: TENANT,
      }),
      NOW
    );
    const r1 = await run(w);
    expect(r1.results[0].outcome).toBe("retry");
    expect(w.data.operations.map((o) => o.kind).sort()).toEqual([
      "xero.allocate_payment",
      "xero.create_invoice",
    ]);
    const later = new Date(new Date(NOW).getTime() + 2 * 60 * 1000).toISOString();
    const r2 = await run(w, later);
    expect(r2.results.map((x) => [x.kind, x.outcome])).toEqual([
      ["xero.create_invoice", "succeeded"],
      ["xero.allocate_payment", "succeeded"],
    ]);
    expect(w.xero.calls.create).toBe(1);
    expect(w.xero.calls.recordPayment).toBe(1);
  });
});

/* ── Worker lease expiry ─────────────────────────────────────────────────── */

describe("worker lease expiry", () => {
  it("another worker can claim an expired lease; the dead worker's late result is dropped", async () => {
    const w = world();
    await enqueue(
      w.store,
      opXeroCreateInvoice({ invoiceId: INVOICE, tenantId: TENANT }),
      NOW
    );
    const claimedByA = await w.store.claimOperations({
      owner: "worker-A",
      limit: 10,
      now: NOW,
      leaseUntil: new Date(new Date(NOW).getTime() + 5 * 60 * 1000).toISOString(),
    });
    expect(claimedByA).toHaveLength(1);
    expect(claimedByA[0].attempts).toBe(1);

    // Within the lease nobody else can take it.
    const soon = new Date(new Date(NOW).getTime() + 60 * 1000).toISOString();
    expect(
      await w.store.claimOperations({
        owner: "worker-B",
        limit: 10,
        now: soon,
        leaseUntil: soon,
      })
    ).toHaveLength(0);

    // After the lease expires, B claims it (attempts is consumed again).
    const later = new Date(new Date(NOW).getTime() + 6 * 60 * 1000).toISOString();
    const claimedByB = await w.store.claimOperations({
      owner: "worker-B",
      limit: 10,
      now: later,
      leaseUntil: new Date(new Date(later).getTime() + 5 * 60 * 1000).toISOString(),
    });
    expect(claimedByB).toHaveLength(1);
    expect(claimedByB[0].attempts).toBe(2);

    // A wakes up and tries to report: refused.
    expect(
      await w.store.completeOperation(claimedByA[0].id, "worker-A", {
        state: "succeeded",
        succeededAt: later,
        lastError: null,
      })
    ).toBe(false);
    expect(
      await w.store.completeOperation(claimedByB[0].id, "worker-B", {
        state: "succeeded",
        succeededAt: later,
        lastError: null,
      })
    ).toBe(true);
    expect(w.data.operations[0].state).toBe("succeeded");
  });

  it("a handler that never returns is bounded: attempts consumed at claim, dead-lettered once max is reached", async () => {
    const w = world();
    await enqueue(
      w.store,
      {
        kind: "notify",
        idempotencyKey: "notify:hang",
        subject: {},
        payload: { dedupeKey: "hang", subject: "x" },
        maxAttempts: 2,
      },
      NOW
    );
    // Simulate two crashed runs: claim, never complete.
    let t = NOW;
    for (let i = 0; i < 2; i++) {
      const c = await w.store.claimOperations({
        owner: `crashed-${i}`,
        limit: 1,
        now: t,
        leaseUntil: new Date(new Date(t).getTime() + 60_000).toISOString(),
      });
      expect(c).toHaveLength(1);
      t = new Date(new Date(t).getTime() + 2 * 60_000).toISOString();
    }
    // Third run: claim (attempts → 3 ≥ 2), handler even succeeds here, but a
    // failing one would dead-letter. Show the bound with a failing handler.
    const r = await runOnce({
      store: w.store,
      ports: w.ports,
      handlers: { notify: async () => ({ outcome: "retry", error: "still hanging" }) },
      owner: "worker-C",
      now: t,
    });
    expect(r.results[0].outcome).toBe("dead_letter");
    expect(w.data.operations[0].state).toBe("dead_letter");
    expect(w.data.exceptions).toHaveLength(1);
  });
});

/* ── Sandbox isolation ───────────────────────────────────────────────────── */

describe("sandbox isolation", () => {
  it("a sandbox payment event with a live subscription ref cannot touch the live activation or obligation", async () => {
    const w = world("sandbox");
    seedLiveClient(w.data); // live rows
    w.gc.payments.set("PM-live-ref", {
      id: "PM-live-ref",
      status: "confirmed",
      amountMinor: 14900,
      currency: "GBP",
      chargeDate: "2026-11-03",
      subscriptionRef: "SB-LIVE-1",
      mandateRef: "MD-fixture",
    });
    const c = await capture(
      w.store,
      gocardlessEventToInbound(
        paymentEvent("EV-sb", "confirmed", "PM-live-ref"),
        "sandbox",
        NOW
      )
    );
    const r = await processGoCardlessEvent(
      { store: w.store, gocardless: w.gc, now: NOW },
      (await w.store.getEvent((c as { id: string }).id))!
    );
    expect(r.outcome).toBe("processed");
    // No allocation against the live obligation; the sandbox money sits unmatched, in the sandbox environment.
    expect(w.data.allocations).toHaveLength(0);
    expect(w.data.providerPayments).toHaveLength(1);
    expect(w.data.providerPayments[0].environment).toBe("sandbox");
    expect(w.data.providerPayments[0].tenantId).toBeNull();
    expect(w.data.exceptions[0]).toMatchObject({
      kind: "other",
      title: "Unmatched Direct Debit collection",
    });
    expect(w.data.activations.find((a) => a.id === LIVE_ACTIVATION)!.state).toBe(
      "active"
    );
  });

  it("a sandbox schedule operation is refused by a live worker (and the reverse)", async () => {
    const w = world("live");
    w.data.activations.push(reserved({ environment: "sandbox" }));
    w.data.gateInputs[ACTIVATION] = gateInput({
      environment: "sandbox",
      mandate: mandateRow({ environment: "sandbox" }),
    });
    const sched = scheduleActivation(
      reserved({ environment: "sandbox" }),
      gateInput({
        environment: "sandbox",
        mandate: mandateRow({ environment: "sandbox" }),
      })
    );
    expect(sched.ok).toBe(true);
    if (!sched.ok) return;
    await enqueue(w.store, opScheduleActivation(sched.operation, TENANT), NOW);
    const r = await run(w);
    expect(r.results[0].outcome).toBe("dead_letter");
    expect(w.gc.calls.createSubscription).toBe(0);
    expect(w.data.activations[0].state).toBe("reserved");
  });

  it("a live event is refused by a sandbox processor", async () => {
    const w = world("sandbox");
    const c = await capture(
      w.store,
      gocardlessEventToInbound(paymentEvent("EV-live", "confirmed", "PM-1"), "live", NOW)
    );
    const r = await processGoCardlessEvent(
      { store: w.store, gocardless: w.gc, now: NOW },
      (await w.store.getEvent((c as { id: string }).id))!
    );
    expect(r.outcome).toBe("failed");
    expect(w.gc.calls.getPayment).toBe(0);
  });
});

/* ── billing_requests.fulfilled records a mandate, never a subscription ──── */

describe("billing_requests.fulfilled", () => {
  it("records a mandate through the mandates lib and creates no subscription; a legacy pending row becomes an owned exception", async () => {
    const w = world();
    w.gc.billingRequests.set("BRQ-1", {
      id: "BRQ-1",
      status: "fulfilled",
      mandateRef: "MD-1",
      metadata: { tenant_id: OTHER_TENANT, plan: "core" },
    });
    w.gc.mandates.set("MD-1", {
      id: "MD-1",
      status: "pending_submission",
      customerRef: "CU-1",
      nextMandateRef: null,
    });
    w.data.mandateOwners["BRQ-1"] = {
      tenantId: TENANT,
      consent: { termsVersion: "dd-consent-2026.09", acceptanceRef: "acceptance:ss-1" },
    };
    w.data.legacySubscriptions.push({
      id: "sub-legacy",
      tenantId: TENANT,
      plan: "core",
      status: "incomplete",
      gcBillingRequestId: "BRQ-1",
      gcMandateId: null,
      gcSubscriptionId: null,
      arrangementId: null,
    });

    const ev = {
      id: "EV-br",
      resource_type: "billing_requests",
      action: "fulfilled",
      links: { billing_request: "BRQ-1", mandate_request_mandate: "MD-1" },
    };
    const c = await capture(w.store, gocardlessEventToInbound(ev, "live", NOW));
    const r = await processGoCardlessEvent(
      { store: w.store, gocardless: w.gc, now: NOW },
      (await w.store.getEvent((c as { id: string }).id))!
    );
    expect(r.outcome).toBe("processed");
    expect(r.note).toContain("subscription created: no");

    expect(w.data.mandates).toHaveLength(1);
    expect(w.data.mandates[0]).toMatchObject({
      mandateRef: "MD-1",
      status: "authorised",
      tenantId: TENANT,
      heldForReview: false,
    });
    // Provider metadata named OTHER_TENANT; our records win.
    expect(w.data.mandates[0].tenantId).not.toBe(OTHER_TENANT);
    expect(w.gc.calls.createSubscription).toBe(0);
    expect(w.gc.subscriptions.size).toBe(0);
    expect(w.data.legacySubscriptions[0].status).toBe("incomplete");
    expect(w.data.exceptions.some((e) => e.kind === "missing_activation_gate")).toBe(
      true
    );
    expect(w.data.operations.some((o) => o.kind === "notify")).toBe(true);

    // Redelivery: same mandate row, still no subscription.
    const c2 = await capture(
      w.store,
      gocardlessEventToInbound({ ...ev, id: "EV-br-2" }, "live", NOW)
    );
    await processGoCardlessEvent(
      { store: w.store, gocardless: w.gc, now: NOW },
      (await w.store.getEvent((c2 as { id: string }).id))!
    );
    expect(w.data.mandates).toHaveLength(1);
    expect(
      w.data.exceptions.filter((e) => e.kind === "missing_activation_gate")
    ).toHaveLength(1);
  });

  it("an orphan mandate is held for review, never usable", async () => {
    const w = world();
    w.gc.billingRequests.set("BRQ-orphan", {
      id: "BRQ-orphan",
      status: "fulfilled",
      mandateRef: "MD-o",
      metadata: {},
    });
    w.gc.mandates.set("MD-o", {
      id: "MD-o",
      status: "pending_submission",
      customerRef: null,
      nextMandateRef: null,
    });
    const c = await capture(
      w.store,
      gocardlessEventToInbound(
        {
          id: "EV-o",
          resource_type: "billing_requests",
          action: "fulfilled",
          links: { billing_request: "BRQ-orphan" },
        },
        "live",
        NOW
      )
    );
    await processGoCardlessEvent(
      { store: w.store, gocardless: w.gc, now: NOW },
      (await w.store.getEvent((c as { id: string }).id))!
    );
    expect(w.data.mandates[0].heldForReview).toBe(true);
    expect(w.data.exceptions.some((e) => e.kind === "missing_consent")).toBe(true);
  });
});

/* ── mandates.cancelled: legacy mirror + live activation exception ───────── */

describe("mandates.cancelled", () => {
  it("cancels the legacy row exactly as today and opens an owned exception for a live activation", async () => {
    const w = world();
    w.data.mandates.push(mandateRow({ id: "md-row-1", mandateRef: "MD-fixture" }));
    w.data.activations.push(
      reserved({ state: "active", providerSubscriptionRef: "SB-1" })
    );
    w.data.legacySubscriptions.push({
      id: "sub-legacy",
      tenantId: OTHER_TENANT,
      plan: "core",
      status: "active",
      gcBillingRequestId: null,
      gcMandateId: "MD-legacy",
      gcSubscriptionId: "SB-legacy",
      arrangementId: null,
    });
    w.gc.mandates.set("MD-fixture", {
      id: "MD-fixture",
      status: "cancelled",
      customerRef: "CU-fixture",
      nextMandateRef: null,
    });
    w.gc.mandates.set("MD-legacy", {
      id: "MD-legacy",
      status: "cancelled",
      customerRef: null,
      nextMandateRef: null,
    });
    const ctx = { store: w.store, gocardless: w.gc, now: "2026-10-11T09:00:00.000Z" };
    for (const [id, ref] of [
      ["EV-m1", "MD-fixture"],
      ["EV-m2", "MD-legacy"],
    ]) {
      const c = await capture(
        w.store,
        gocardlessEventToInbound(
          { id, resource_type: "mandates", action: "cancelled", links: { mandate: ref } },
          "live",
          NOW
        )
      );
      await processGoCardlessEvent(
        ctx,
        (await w.store.getEvent((c as { id: string }).id))!
      );
    }
    expect(w.data.mandates.find((m) => m.mandateRef === "MD-fixture")!.status).toBe(
      "cancelled"
    );
    expect(w.data.exceptions.find((e) => e.kind === "cancelled_mandate")).toMatchObject({
      severity: "urgent",
      activation_id: ACTIVATION,
    });
    expect(w.data.legacySubscriptions[0].status).toBe("canceled");
    // The legacy mandate has no consent evidence and no mandates row: held, not usable.
    expect(w.data.mandates.find((m) => m.mandateRef === "MD-legacy")!.heldForReview).toBe(
      true
    );
  });
});

/* ── cancel_pending records only provider-confirmed cancellation ─────────── */

describe("gocardless.cancel_pending", () => {
  it("cancels a pending collection and records it only after the provider confirms; a submitted one is an urgent exception", async () => {
    const w = world();
    w.gc.payments.set("PM-p", {
      id: "PM-p",
      status: "pending_submission",
      amountMinor: 14900,
      currency: "GBP",
      chargeDate: "2026-11-03",
      subscriptionRef: null,
      mandateRef: null,
    });
    w.gc.payments.set("PM-s", {
      id: "PM-s",
      status: "submitted",
      amountMinor: 14900,
      currency: "GBP",
      chargeDate: "2026-11-03",
      subscriptionRef: null,
      mandateRef: null,
    });
    const cancel = (ref: string) => ({
      kind: "provider.cancel_collection" as const,
      idempotencyKey: `collection:live:${ref}:cancel`,
      executeIn: "worker" as const,
      provider: "gocardless" as const,
      environment: "live" as const,
      collectionRef: ref,
      recordOnProviderConfirmation: true as const,
    });
    await enqueue(
      w.store,
      opCancelPending(cancel("PM-p"), { tenantId: TENANT, obligationId: OBLIGATION }),
      NOW
    );
    await enqueue(
      w.store,
      opCancelPending(cancel("PM-s"), { tenantId: TENANT, obligationId: OBLIGATION }),
      NOW
    );
    const r = await run(w);
    expect(r.results.map((x) => x.outcome)).toEqual(["succeeded", "dead_letter"]);
    expect(w.gc.payments.get("PM-p")!.status).toBe("cancelled");
    expect(
      w.data.audit.some((a) => a.action === "billing.collection_cancelled_confirmed")
    ).toBe(true);
    const exc = w.data.exceptions.find((e) => e.kind === "duplicate_warning");
    expect(exc).toMatchObject({ severity: "urgent", obligation_id: OBLIGATION });
  });
});

/* ── schedule_activation never charges outside the accepted schedule ─────── */

describe("gocardless.schedule_activation gates", () => {
  it("re-runs the gates on every attempt and makes no provider call when one is missing", async () => {
    const w = world();
    w.data.activations.push(reserved());
    const sched = scheduleActivation(reserved(), gateInput());
    if (!sched.ok) throw new Error("fixture");
    await enqueue(w.store, opScheduleActivation(sched.operation, TENANT), NOW);
    // Between approval and the worker run the mandate was cancelled.
    w.data.gateInputs[ACTIVATION] = gateInput({
      mandate: mandateRow({ status: "cancelled" }),
    });
    const r = await run(w);
    expect(r.results[0].outcome).toBe("dead_letter");
    expect(w.gc.calls.createSubscription).toBe(0);
    expect(w.data.exceptions[0]).toMatchObject({
      kind: "missing_activation_gate",
      activation_id: ACTIVATION,
    });
    expect(w.data.activations[0].state).toBe("reserved");
  });

  it("a drifted payload (amount no longer the accepted one) is refused before any provider call", async () => {
    const w = world();
    w.data.activations.push(reserved());
    w.data.gateInputs[ACTIVATION] = gateInput();
    const sched = scheduleActivation(reserved(), gateInput());
    if (!sched.ok) throw new Error("fixture");
    await enqueue(
      w.store,
      opScheduleActivation({ ...sched.operation, amountMinor: 99900 }, TENANT),
      NOW
    );
    const r = await run(w);
    expect(r.results[0].outcome).toBe("dead_letter");
    expect(w.gc.calls.createSubscription).toBe(0);
  });
});

/* ── Notify dedupe, sweep, sanitising, dead-letter mapping ───────────────── */

describe("notify, sweep and helpers", () => {
  it("notify is a stub with dedupe: the same key enqueues once", async () => {
    const w = world();
    const a = await enqueue(
      w.store,
      {
        kind: "notify",
        idempotencyKey: "notify:k1",
        subject: {},
        payload: { dedupeKey: "k1", subject: "Hello" },
      },
      NOW
    );
    const b = await enqueue(
      w.store,
      {
        kind: "notify",
        idempotencyKey: "notify:k1",
        subject: {},
        payload: { dedupeKey: "k1", subject: "Hello" },
      },
      NOW
    );
    expect(a.outcome).toBe("queued");
    expect(b.outcome).toBe("exists");
    const r = await run(w);
    expect(r.results[0].outcome).toBe("succeeded");
    expect(w.data.audit.some((x) => x.action === "ops.notify_stubbed")).toBe(true);
  });

  it("the sweep re-processes captured-but-unprocessed events, bounded and only after a grace period", async () => {
    const w = world();
    w.gc.payments.set("PM-9", {
      id: "PM-9",
      status: "pending_submission",
      amountMinor: 100,
      currency: "GBP",
      chargeDate: null,
      subscriptionRef: null,
      mandateRef: null,
    });
    const earlier = new Date(new Date(NOW).getTime() - 10 * 60 * 1000).toISOString();
    await capture(
      w.store,
      gocardlessEventToInbound(paymentEvent("EV-old", "created", "PM-9"), "live", earlier)
    );
    await capture(
      w.store,
      gocardlessEventToInbound(paymentEvent("EV-fresh", "created", "PM-9"), "live", NOW)
    );
    const swept = await sweepUnprocessedEvents(
      { store: w.store, gocardless: w.gc, now: NOW },
      { limit: 10, olderThanMs: 2 * 60 * 1000, windowMs: 7 * 24 * 60 * 60 * 1000 }
    );
    expect(swept).toHaveLength(1);
    expect(w.data.events.find((e) => e.eventRef === "EV-old")!.status).toBe("processed");
    expect(w.data.events.find((e) => e.eventRef === "EV-fresh")!.status).toBe("received");
  });

  it("errors are sanitised and dead letters map to owned exception kinds", () => {
    expect(
      sanitiseError(
        new Error(
          "Xero GET /x → 503 Authorization: Bearer abc.def-123 sort 12-34-56 acct 12345678"
        )
      )
    ).not.toMatch(/abc\.def|12-34-56|12345678/);
    const op = {
      id: "o",
      kind: "xero.allocate_payment",
      idempotencyKey: "k",
      subject: { tenant_id: TENANT, invoice_id: INVOICE },
      payload: {},
      state: "leased" as const,
      attempts: 8,
      maxAttempts: 8,
      nextAttemptAt: NOW,
      leasedUntil: null,
      leaseOwner: null,
      lastError: null,
      correlationId: "evt-1",
      createdAt: NOW,
      succeededAt: null,
    };
    const e = deadLetterException(op, "boom");
    expect(e).toMatchObject({
      kind: "xero_outage",
      safeRetryOp: "xero_allocate_payment",
      externalRef: "k",
      invoiceId: INVOICE,
    });
    expect(e.detail).toContain("evt-1");
  });
});
