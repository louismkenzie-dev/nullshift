/**
 * In-memory implementation of the ops store, the ledger port and the three
 * provider ports. Used by `tests/integration-ops.test.ts` and safe for
 * prototype fixtures: nothing here touches a database or a provider.
 *
 * The fakes emulate exactly the constraints the code relies on:
 *   - integration_events unique (provider, environment, event_ref)
 *   - integration_operations unique idempotency_key; claim = queued-and-due
 *     or leased-and-expired, oldest first, bounded, attempts++ at claim;
 *     completion guarded by lease owner
 *   - provider_payments unique (provider, provider_payment_id, kind) per
 *     environment; payment_allocations unique (provider, ref, kind,
 *     obligation)
 *   - finance_exceptions one OPEN row per (kind, subject)
 *   - GoCardless Idempotency-Key: a reused key returns the first resource
 */

import type {
  ActivationRecord,
  GateInput,
  MandateRecord,
} from "@/lib/billing/activation";
import type { MandateUpsert, ConsentEvidence } from "@/lib/billing/mandates";
import type { AllocationRecord, PaymentProvider } from "@/lib/billing/obligations";
import type { ExceptionInsert } from "@/lib/billing/exceptions";
import {
  ProviderError,
  type ActivationView,
  type AllocationInsert,
  type AuditEntry,
  type Environment,
  type EventRow,
  type GoCardlessBillingRequestResource,
  type GoCardlessMandateResource,
  type GoCardlessPaymentResource,
  type GoCardlessPort,
  type GoCardlessSubscriptionResource,
  type InboundEvent,
  type InsertResult,
  type LedgerStore,
  type LegacyMirror,
  type NotifyPort,
  type ObligationView,
  type OperationInsert,
  type OperationOutcomePatch,
  type OperationRow,
  type OpsStore,
  type ProviderPaymentInsert,
  type RecordResult,
  type XeroAllocationView,
  type XeroInvoiceView,
  type XeroPort,
} from "./types";

let seq = 0;
export const nextId = (prefix: string): string =>
  `${prefix}-${String(++seq).padStart(4, "0")}`;

const UNIQUE: InsertResult = {
  ok: false,
  error: { code: "23505", message: "duplicate key value violates unique constraint" },
};

/* ── Ledger data the fakes hold ──────────────────────────────────────────── */

export type MemoryInvoice = {
  id: string;
  tenantId: string;
  obligationId: string | null;
  status: string;
  amountMinor: number;
  currency: string;
  createdAt: string;
  dueAt: string | null;
  xeroInvoiceId: string | null;
  hostedInvoiceUrl: string | null;
  lines: { description: string; amountMinor: number }[];
};

export type MemoryTenant = {
  id: string;
  name: string;
  email: string | null;
  xeroContactId: string | null;
};

export type MemoryProviderPayment = ProviderPaymentInsert & { id: string };
export type MemoryAllocation = AllocationInsert & { id: string };

export type MemoryObligation = {
  id: string;
  tenantId: string;
  arrangementId: string | null;
  kind: string;
  periodStart: string | null;
  periodEnd: string | null;
  currency: string;
  amountGrossMinor: number;
};

export type MemoryLegacySubscription = {
  id: string;
  tenantId: string;
  plan: string | null;
  status: string;
  gcBillingRequestId: string | null;
  gcMandateId: string | null;
  gcSubscriptionId: string | null;
  arrangementId: null;
};

export type MemoryException = Omit<ExceptionInsert, "state"> & {
  id: string;
  state: "open" | "in_progress" | "resolved";
};

export type MemoryData = {
  events: EventRow[];
  operations: OperationRow[];
  exceptions: MemoryException[];
  audit: AuditEntry[];
  invoices: MemoryInvoice[];
  tenants: MemoryTenant[];
  obligations: MemoryObligation[];
  providerPayments: MemoryProviderPayment[];
  allocations: MemoryAllocation[];
  mandates: MandateRecord[];
  activations: ActivationView[];
  /** GateInput per activation id, supplied by the test. */
  gateInputs: Record<string, GateInput | null>;
  legacySubscriptions: MemoryLegacySubscription[];
  legacyCarePlanPayments: { paymentId: string; tenantId: string }[];
  /** Owner resolution for mandates, keyed by billing request ref. */
  mandateOwners: Record<
    string,
    { tenantId: string | null; consent: ConsentEvidence | null }
  >;
};

export function emptyData(): MemoryData {
  return {
    events: [],
    operations: [],
    exceptions: [],
    audit: [],
    invoices: [],
    tenants: [],
    obligations: [],
    providerPayments: [],
    allocations: [],
    mandates: [],
    activations: [],
    gateInputs: {},
    legacySubscriptions: [],
    legacyCarePlanPayments: [],
    mandateOwners: {},
  };
}

/* ── Store ───────────────────────────────────────────────────────────────── */

export type MemoryStore = OpsStore & { data: MemoryData };

export function memoryStore(data: MemoryData = emptyData()): MemoryStore {
  const legacy: LegacyMirror = {
    async findPendingByBillingRequest(ref) {
      const s = data.legacySubscriptions.find(
        (x) => x.gcBillingRequestId === ref && x.arrangementId === null
      );
      return s ? { id: s.id, tenantId: s.tenantId, plan: s.plan } : null;
    },
    async replaceMandateRef(oldRef, newRef) {
      for (const s of data.legacySubscriptions)
        if (s.gcMandateId === oldRef) s.gcMandateId = newRef;
    },
    async cancelByMandateRef(ref) {
      const hit = data.legacySubscriptions.filter((s) => s.gcMandateId === ref);
      for (const s of hit) s.status = "canceled";
      return hit.map((s) => ({ id: s.id, tenantId: s.tenantId }));
    },
    async cancelBySubscriptionRef(ref) {
      const hit = data.legacySubscriptions.filter((s) => s.gcSubscriptionId === ref);
      for (const s of hit) s.status = "canceled";
      return hit.map((s) => ({ id: s.id, tenantId: s.tenantId }));
    },
    async markPaymentOutcome(q) {
      const from = q.outcome === "failed" ? "active" : "past_due";
      const to = q.outcome === "failed" ? "past_due" : "active";
      const hit = data.legacySubscriptions.filter(
        (s) =>
          s.status === from &&
          ((q.subscriptionRef && s.gcSubscriptionId === q.subscriptionRef) ||
            (!q.subscriptionRef && q.mandateRef && s.gcMandateId === q.mandateRef))
      );
      for (const s of hit) s.status = to;
      return hit.map((s) => ({ id: s.id, tenantId: s.tenantId, plan: s.plan }));
    },
    async findLegacySubscription(q) {
      const s = data.legacySubscriptions.find(
        (x) =>
          (q.subscriptionRef && x.gcSubscriptionId === q.subscriptionRef) ||
          (!q.subscriptionRef && q.mandateRef && x.gcMandateId === q.mandateRef)
      );
      return s ? { id: s.id, tenantId: s.tenantId, plan: s.plan } : null;
    },
    async recordCarePlanPayment(args) {
      if (!data.legacyCarePlanPayments.some((p) => p.paymentId === args.paymentId))
        data.legacyCarePlanPayments.push({
          paymentId: args.paymentId,
          tenantId: args.tenantId,
        });
    },
  };

  const ledger: LedgerStore = {
    async getInvoiceForXero(invoiceId): Promise<XeroInvoiceView | null> {
      const inv = data.invoices.find((i) => i.id === invoiceId);
      if (!inv) return null;
      const t = data.tenants.find((x) => x.id === inv.tenantId);
      return {
        id: inv.id,
        tenantId: inv.tenantId,
        reference: `NS-${inv.tenantId.slice(0, 4)} · ${inv.id.slice(0, 8)}`,
        status: inv.status,
        dateISO: inv.createdAt,
        dueDateISO: inv.dueAt,
        xeroInvoiceId: inv.xeroInvoiceId,
        lineItems: inv.lines,
        currency: inv.currency,
        tenant: {
          name: t?.name ?? "Unknown",
          email: t?.email ?? null,
          xeroContactId: t?.xeroContactId ?? null,
        },
      };
    },
    async setInvoiceXeroId(invoiceId, xeroInvoiceId, onlineUrl) {
      const inv = data.invoices.find((i) => i.id === invoiceId);
      if (!inv) return "not_found";
      if (inv.xeroInvoiceId) return "already_set";
      inv.xeroInvoiceId = xeroInvoiceId;
      if (onlineUrl && !inv.hostedInvoiceUrl) inv.hostedInvoiceUrl = onlineUrl;
      return "saved";
    },
    async setTenantXeroContact(tenantId, contactId) {
      const t = data.tenants.find((x) => x.id === tenantId);
      if (t) t.xeroContactId = contactId;
    },
    async getAllocationForXero(allocationId): Promise<XeroAllocationView | null> {
      const a = data.allocations.find((x) => x.id === allocationId);
      if (!a) return null;
      const inv = a.invoiceId ? data.invoices.find((i) => i.id === a.invoiceId) : null;
      const siblings = data.allocations
        .filter(
          (x) =>
            x.id !== a.id &&
            x.invoiceId === a.invoiceId &&
            typeof x.evidence.xero_payment_id === "string"
        )
        .map((x) => x.evidence.xero_payment_id as string);
      return {
        id: a.id,
        tenantId: a.tenantId,
        obligationId: a.obligationId,
        invoiceId: a.invoiceId,
        xeroInvoiceId: inv?.xeroInvoiceId ?? null,
        kind: a.kind,
        provider: a.provider,
        providerPaymentRef: a.providerPaymentRef,
        amountMinor: a.amountMinor,
        currency: a.currency,
        allocatedAt: a.allocatedAt,
        xeroRecorded: typeof a.evidence.xero_recorded_at === "string",
        siblingXeroPaymentIds: siblings,
      };
    },
    async markAllocationRecordedInXero(allocationId, evidence) {
      const a = data.allocations.find((x) => x.id === allocationId);
      if (a) a.evidence = { ...a.evidence, ...evidence };
    },
    async findMandate(q) {
      return (
        data.mandates.find(
          (m) =>
            m.provider === q.provider &&
            m.environment === q.environment &&
            ((q.mandateRef && m.mandateRef === q.mandateRef) ||
              (q.billingRequestRef && m.billingRequestRef === q.billingRequestRef))
        ) ?? null
      );
    },
    async saveMandate(row: MandateUpsert) {
      if (row.id) {
        const i = data.mandates.findIndex((m) => m.id === row.id);
        if (i >= 0) data.mandates[i] = { ...row, id: row.id };
        return { id: row.id };
      }
      const id = nextId("mandate");
      data.mandates.push({ ...row, id });
      return { id };
    },
    async resolveMandateOwner(q) {
      if (q.billingRequestRef && data.mandateOwners[q.billingRequestRef])
        return data.mandateOwners[q.billingRequestRef];
      if (q.mandateRef && data.mandateOwners[q.mandateRef])
        return data.mandateOwners[q.mandateRef];
      const legacyRow = q.billingRequestRef
        ? data.legacySubscriptions.find(
            (s) => s.gcBillingRequestId === q.billingRequestRef
          )
        : null;
      // A legacy row identifies the client but carries no consent evidence.
      if (legacyRow) return { tenantId: legacyRow.tenantId, consent: null };
      return { tenantId: null, consent: null };
    },
    async getActivation(id) {
      return data.activations.find((a) => a.id === id) ?? null;
    },
    async findActivationByProviderRef(environment, ref) {
      return (
        data.activations.find(
          (a) => a.environment === environment && a.providerSubscriptionRef === ref
        ) ?? null
      );
    },
    async findLiveActivationByMandate(mandateId) {
      return (
        data.activations.find(
          (a) =>
            a.mandateId === mandateId &&
            ["reserved", "scheduled", "active"].includes(a.state)
        ) ?? null
      );
    },
    async loadGateInput(activationId, asOf) {
      const g = data.gateInputs[activationId];
      return g ? { ...g, asOf } : null;
    },
    async updateActivation(id, patch) {
      const a = data.activations.find((x) => x.id === id);
      if (!a) return;
      const p = patch as Partial<ActivationRecord>;
      Object.assign(
        a,
        Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined))
      );
    },
    async findObligationForCollection({
      activation,
      chargeDate,
    }): Promise<ObligationView | null> {
      const o = data.obligations.find(
        (x) =>
          x.arrangementId === activation.arrangementId &&
          x.kind === "service_period" &&
          (!chargeDate ||
            !x.periodStart ||
            !x.periodEnd ||
            (x.periodStart <= chargeDate && chargeDate < x.periodEnd))
      );
      if (!o) return null;
      const inv =
        data.invoices.find((i) => i.obligationId === o.id && i.status !== "void") ?? null;
      return {
        id: o.id,
        tenantId: o.tenantId,
        currency: o.currency,
        amountGrossMinor: o.amountGrossMinor,
        invoiceId: inv?.id ?? null,
        xeroInvoiceId: inv?.xeroInvoiceId ?? null,
      };
    },
    async recordProviderPayment(row): Promise<RecordResult> {
      const existing = data.providerPayments.find(
        (p) =>
          p.provider === row.provider &&
          p.providerPaymentRef === row.providerPaymentRef &&
          p.kind === row.kind &&
          p.environment === row.environment
      );
      if (existing) return { ok: true, id: existing.id, created: false };
      const id = nextId("pp");
      data.providerPayments.push({ ...row, id });
      return { ok: true, id, created: true };
    },
    async recordAllocation(row): Promise<RecordResult> {
      const existing = data.allocations.find(
        (a) =>
          a.provider === row.provider &&
          a.providerPaymentRef === row.providerPaymentRef &&
          a.kind === row.kind &&
          a.obligationId === row.obligationId
      );
      if (existing) return { ok: true, id: existing.id, created: false };
      // The 0062 trigger: never beyond the recorded provider payment.
      const recorded = data.providerPayments.find(
        (p) =>
          p.provider === row.provider &&
          p.providerPaymentRef === row.providerPaymentRef &&
          p.kind === row.kind
      );
      if (!recorded)
        return {
          ok: false,
          error: {
            code: "P0001",
            message: "payment_allocations: provider payment not recorded",
          },
        };
      const already = data.allocations
        .filter(
          (a) =>
            a.provider === row.provider &&
            a.providerPaymentRef === row.providerPaymentRef &&
            a.kind === row.kind
        )
        .reduce((t, a) => t + a.amountMinor, 0);
      if (already + row.amountMinor > recorded.amountMinor)
        return {
          ok: false,
          error: {
            code: "P0001",
            message:
              "payment_allocations: allocation exceeds the recorded provider payment",
          },
        };
      const id = nextId("alloc");
      data.allocations.push({ ...row, id });
      return { ok: true, id, created: true };
    },
    async listAllocations(provider: PaymentProvider, ref): Promise<AllocationRecord[]> {
      return data.allocations
        .filter((a) => a.provider === provider && a.providerPaymentRef === ref)
        .map((a) => ({
          id: a.id,
          obligationId: a.obligationId,
          invoiceId: a.invoiceId,
          provider: a.provider,
          providerPaymentId: a.providerPaymentRef,
          kind: a.kind,
          amountMinor: a.amountMinor,
          currency: a.currency,
          allocatedAt: a.allocatedAt,
        }));
    },
    legacy,
  };

  const store: MemoryStore = {
    data,
    async insertEvent(e: InboundEvent) {
      if (
        data.events.some(
          (x) =>
            x.provider === e.provider &&
            x.environment === e.environment &&
            x.eventRef === e.eventRef
        )
      )
        return UNIQUE;
      const id = nextId("evt");
      data.events.push({ ...e, id, status: "received", processedAt: null, error: null });
      return { ok: true, id };
    },
    async getEvent(id) {
      return data.events.find((e) => e.id === id) ?? null;
    },
    async setEventStatus(id, status, error, processedAt) {
      const e = data.events.find((x) => x.id === id);
      if (!e) return;
      e.status = status;
      e.error = error;
      e.processedAt = processedAt;
    },
    async listUnprocessedEvents(q) {
      return data.events
        .filter(
          (e) =>
            (e.status === "received" || e.status === "failed") &&
            e.receivedAt <= q.receivedBefore &&
            e.receivedAt >= q.receivedAfter
        )
        .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))
        .slice(0, q.limit);
    },
    async insertOperation(op: OperationInsert, now) {
      if (data.operations.some((x) => x.idempotencyKey === op.idempotencyKey))
        return UNIQUE;
      const id = nextId("op");
      data.operations.push({
        id,
        kind: op.kind,
        idempotencyKey: op.idempotencyKey,
        subject: op.subject,
        payload: op.payload,
        state: "queued",
        attempts: 0,
        maxAttempts: op.maxAttempts ?? 8,
        nextAttemptAt: op.nextAttemptAt ?? now,
        leasedUntil: null,
        leaseOwner: null,
        lastError: null,
        correlationId: op.correlationId ?? null,
        createdAt: now,
        succeededAt: null,
      });
      return { ok: true, id };
    },
    async findOperationByKey(key) {
      return data.operations.find((o) => o.idempotencyKey === key) ?? null;
    },
    async claimOperations({ owner, limit, now, leaseUntil }) {
      const due = data.operations
        .filter(
          (o) =>
            (o.state === "queued" && o.nextAttemptAt <= now) ||
            (o.state === "leased" && o.leasedUntil !== null && o.leasedUntil < now)
        )
        .sort(
          (a, b) =>
            a.nextAttemptAt.localeCompare(b.nextAttemptAt) ||
            a.createdAt.localeCompare(b.createdAt)
        )
        .slice(0, Math.max(1, Math.min(100, limit)));
      for (const o of due) {
        o.state = "leased";
        o.leaseOwner = owner;
        o.leasedUntil = leaseUntil;
        o.attempts += 1;
      }
      // Rows, not references: the worker must not mutate the store's copy.
      return due.map((o) => ({
        ...o,
        subject: { ...o.subject },
        payload: { ...o.payload },
      }));
    },
    async completeOperation(id, owner, patch: OperationOutcomePatch) {
      const o = data.operations.find((x) => x.id === id);
      if (!o || o.state !== "leased" || o.leaseOwner !== owner) return false;
      o.leaseOwner = null;
      o.leasedUntil = null;
      o.state = patch.state;
      o.lastError = patch.lastError;
      if (patch.state === "succeeded") o.succeededAt = patch.succeededAt;
      if (patch.state === "queued") o.nextAttemptAt = patch.nextAttemptAt;
      return true;
    },
    async openException(row) {
      const same = data.exceptions.find(
        (e) =>
          e.state !== "resolved" &&
          e.kind === row.kind &&
          (e.obligation_id ?? "") === (row.obligation_id ?? "") &&
          (e.invoice_id ?? "") === (row.invoice_id ?? "") &&
          (e.subscription_id ?? "") === (row.subscription_id ?? "") &&
          (e.activation_id ?? "") === (row.activation_id ?? "") &&
          (e.external_ref ?? "") === (row.external_ref ?? "")
      );
      if (same) return { ok: true, id: same.id, created: false };
      const id = nextId("exc");
      data.exceptions.push({ ...row, id });
      return { ok: true, id, created: true };
    },
    async audit(entry) {
      data.audit.push(entry);
    },
    ledger,
  };
  return store;
}

/* ── Fake providers ──────────────────────────────────────────────────────── */

export type FakeXeroInvoice = {
  invoiceId: string;
  invoiceNumber: string;
  reference: string;
  status: string;
  payments: {
    paymentId: string;
    amountMinor: number;
    dateISO: string;
    reference: string | null;
  }[];
};

export type FakeXero = XeroPort & {
  invoices: FakeXeroInvoice[];
  contacts: { contactId: string; name: string; email: string | null }[];
  /** When set, every call throws a ProviderError of this kind. */
  failWith: "outage" | "rejected" | null;
  /** When set, the next create/record succeeds remotely but throws afterwards (crash window). */
  crashAfterRemote: boolean;
  calls: { create: number; recordPayment: number; findByReference: number };
  isConfigured: boolean;
};

export function fakeXero(): FakeXero {
  const x: FakeXero = {
    invoices: [],
    contacts: [],
    failWith: null,
    crashAfterRemote: false,
    calls: { create: 0, recordPayment: 0, findByReference: 0 },
    isConfigured: true,
    configured: () => x.isConfigured,
    async findInvoiceByReference(reference) {
      guard(x);
      x.calls.findByReference += 1;
      const hit = x.invoices.find(
        (i) =>
          i.reference === reference && i.status !== "VOIDED" && i.status !== "DELETED"
      );
      return hit
        ? {
            invoiceId: hit.invoiceId,
            invoiceNumber: hit.invoiceNumber,
            status: hit.status,
          }
        : null;
    },
    async findOrCreateContact(opts) {
      guard(x);
      if (opts.existingContactId) return opts.existingContactId;
      const hit = x.contacts.find(
        (c) => (opts.email && c.email === opts.email) || c.name === opts.name
      );
      if (hit) return hit.contactId;
      const contactId = nextId("xc");
      x.contacts.push({ contactId, name: opts.name, email: opts.email });
      return contactId;
    },
    async createInvoice(opts) {
      guard(x);
      x.calls.create += 1;
      const invoiceId = nextId("xi");
      x.invoices.push({
        invoiceId,
        invoiceNumber: `INV-${invoiceId}`,
        reference: opts.reference,
        status: "AUTHORISED",
        payments: [],
      });
      if (x.crashAfterRemote) {
        x.crashAfterRemote = false;
        throw new Error("socket hang up after Xero POST /Invoices");
      }
      return { invoiceId, invoiceNumber: `INV-${invoiceId}` };
    },
    async getOnlineInvoiceUrl(id) {
      guard(x);
      return `https://in.xero.example/${id}`;
    },
    async listInvoicePayments(xeroInvoiceId) {
      guard(x);
      return (
        x.invoices
          .find((i) => i.invoiceId === xeroInvoiceId)
          ?.payments.map((p) => ({ ...p })) ?? []
      );
    },
    async recordPayment(opts) {
      guard(x);
      x.calls.recordPayment += 1;
      const inv = x.invoices.find((i) => i.invoiceId === opts.xeroInvoiceId);
      if (!inv)
        throw new ProviderError(
          "rejected",
          "Xero PUT /Payments → 404: invoice not found"
        );
      inv.payments.push({
        paymentId: nextId("xp"),
        amountMinor: opts.amountMinor,
        dateISO: opts.dateISO.slice(0, 10),
        reference: opts.reference,
      });
      if (x.crashAfterRemote) {
        x.crashAfterRemote = false;
        throw new Error("socket hang up after Xero PUT /Payments");
      }
      return { ok: true };
    },
  };
  return x;
}

function guard(x: FakeXero) {
  if (!x.isConfigured) throw new ProviderError("unconfigured", "Xero is not configured.");
  if (x.failWith === "outage")
    throw new ProviderError(
      "outage",
      "Xero GET /Invoices → 503: service unavailable",
      503
    );
  if (x.failWith === "rejected")
    throw new ProviderError(
      "rejected",
      "Xero POST /Invoices → 400: validation error",
      400
    );
}

export type FakeGoCardless = GoCardlessPort & {
  payments: Map<string, GoCardlessPaymentResource>;
  mandates: Map<string, GoCardlessMandateResource>;
  billingRequests: Map<string, GoCardlessBillingRequestResource>;
  subscriptions: Map<string, GoCardlessSubscriptionResource>;
  idempotency: Map<string, string>;
  calls: { createSubscription: number; cancelPayment: number; getPayment: number };
  failWith: "outage" | null;
  crashAfterRemote: boolean;
};

export function fakeGoCardless(environment: Environment): FakeGoCardless {
  const g: FakeGoCardless = {
    environment,
    payments: new Map(),
    mandates: new Map(),
    billingRequests: new Map(),
    subscriptions: new Map(),
    idempotency: new Map(),
    calls: { createSubscription: 0, cancelPayment: 0, getPayment: 0 },
    failWith: null,
    crashAfterRemote: false,
    async getPayment(ref) {
      if (g.failWith)
        throw new ProviderError("outage", "GoCardless GET /payments → 502", 502);
      g.calls.getPayment += 1;
      const p = g.payments.get(ref);
      return p ? { ...p } : null;
    },
    async getMandate(ref) {
      if (g.failWith)
        throw new ProviderError("outage", "GoCardless GET /mandates → 502", 502);
      const m = g.mandates.get(ref);
      return m ? { ...m } : null;
    },
    async getBillingRequest(ref) {
      if (g.failWith)
        throw new ProviderError("outage", "GoCardless GET /billing_requests → 502", 502);
      const b = g.billingRequests.get(ref);
      return b ? { ...b, metadata: { ...b.metadata } } : null;
    },
    async getSubscription(ref) {
      if (g.failWith)
        throw new ProviderError("outage", "GoCardless GET /subscriptions → 502", 502);
      const s = g.subscriptions.get(ref);
      return s ? { ...s } : null;
    },
    async createSubscription(opts) {
      if (g.failWith)
        throw new ProviderError("outage", "GoCardless POST /subscriptions → 502", 502);
      const existing = g.idempotency.get(opts.idempotencyKey);
      if (existing) return { subscriptionRef: existing, adopted: true };
      g.calls.createSubscription += 1;
      const id = nextId("SB");
      g.subscriptions.set(id, {
        id,
        status: "active",
        amountMinor: opts.amountMinor,
        currency: opts.currency,
        startDate: opts.startDate,
        nextChargeDate: opts.startDate,
        mandateRef: opts.mandateRef,
      });
      g.idempotency.set(opts.idempotencyKey, id);
      if (g.crashAfterRemote) {
        g.crashAfterRemote = false;
        throw new Error("socket hang up after GoCardless POST /subscriptions");
      }
      return { subscriptionRef: id, adopted: false };
    },
    async cancelPayment(ref) {
      if (g.failWith)
        throw new ProviderError(
          "outage",
          "GoCardless POST /payments/:id/actions/cancel → 502",
          502
        );
      g.calls.cancelPayment += 1;
      const p = g.payments.get(ref);
      if (!p) return { ok: false };
      if (p.status === "pending_submission" || p.status === "pending_customer_approval") {
        p.status = "cancelled";
        return { ok: true };
      }
      return { ok: false };
    },
  };
  return g;
}

export function fakeNotify(): NotifyPort & { sent: string[] } {
  const n = {
    sent: [] as string[],
    async deliver(msg: { dedupeKey: string }) {
      n.sent.push(msg.dedupeKey);
      return { delivered: false as const, stubbed: true as const };
    },
  };
  return n;
}
