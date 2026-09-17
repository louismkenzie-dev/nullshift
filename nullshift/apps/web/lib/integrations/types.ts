/**
 * Integration inbox / outbox — shared vocabulary, row shapes and the ports
 * (brief §10.2–10.3, §12.4; migration 0063).
 *
 * Everything in `lib/integrations` is written against these ports so the
 * same code runs over Supabase (service role, behind `integrationWorkers`)
 * and over the in-memory fakes in `memoryStore.ts` (tests, prototypes). No
 * module here performs I/O of its own; the ports do.
 *
 * Money is integer minor units with an explicit currency. Instants are ISO
 * strings. `Environment` is the 0064 vocabulary (sandbox | live) and is part
 * of every provider identity; `provider_payments` (0062) spells the same
 * idea as test | live, and the Supabase store maps between them.
 */

import type {
  Environment,
  ActivationRecord,
  GateInput,
  MandateRecord,
} from "@/lib/billing/activation";
import type { ConsentEvidence, MandateUpsert } from "@/lib/billing/mandates";
import type {
  AllocationKind,
  AllocationRecord,
  PaymentProvider,
} from "@/lib/billing/obligations";
import type { ExceptionInsert } from "@/lib/billing/exceptions";

export type { Environment };

/* ── Vocabulary (mirrors the 0063 CHECK constraints) ─────────────────────── */

export const INTEGRATION_PROVIDERS = ["gocardless", "stripe", "xero"] as const;
export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];

export const EVENT_STATUSES = ["received", "processed", "failed", "ignored"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const OPERATION_STATES = [
  "queued",
  "leased",
  "succeeded",
  "failed",
  "dead_letter",
] as const;
export type OperationState = (typeof OPERATION_STATES)[number];

export const OPERATION_KINDS = [
  "xero.create_invoice",
  "xero.allocate_payment",
  "gocardless.schedule_activation",
  "gocardless.cancel_pending",
  "notify",
] as const;
export type OperationKind = (typeof OPERATION_KINDS)[number];

export const isOperationKind = (s: unknown): s is OperationKind =>
  typeof s === "string" && (OPERATION_KINDS as readonly string[]).includes(s);

/** Default bound on attempts (0063 default); a kind may lower it. */
export const DEFAULT_MAX_ATTEMPTS = 8;

/* ── Inbox rows ──────────────────────────────────────────────────────────── */

export type InboundEvent = {
  provider: IntegrationProvider;
  environment: Environment;
  accountRef: string | null;
  eventRef: string;
  eventType: string;
  resourceType: string | null;
  resourceRef: string | null;
  /** The body as received: evidence, never the source of state. */
  payload: Record<string, unknown>;
  receivedAt: string;
};

export type EventRow = InboundEvent & {
  id: string;
  status: EventStatus;
  processedAt: string | null;
  error: string | null;
};

/* ── Outbox rows ─────────────────────────────────────────────────────────── */

/** What an operation is about. Keys mirror the 0063 comment (snake_case JSON). */
export type OperationSubject = {
  tenant_id?: string | null;
  obligation_id?: string | null;
  invoice_id?: string | null;
  activation_id?: string | null;
  allocation_id?: string | null;
  collection_ref?: string | null;
  exception_id?: string | null;
};

export type OperationInsert = {
  kind: OperationKind;
  idempotencyKey: string;
  subject: OperationSubject;
  payload: Record<string, unknown>;
  maxAttempts?: number;
  correlationId?: string | null;
  /** Defaults to "now" at enqueue. */
  nextAttemptAt?: string;
};

export type OperationRow = {
  id: string;
  kind: string;
  idempotencyKey: string;
  subject: OperationSubject;
  payload: Record<string, unknown>;
  state: OperationState;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: string;
  leasedUntil: string | null;
  leaseOwner: string | null;
  lastError: string | null;
  correlationId: string | null;
  createdAt: string;
  succeededAt: string | null;
};

/** What the worker writes back after running a claimed operation. */
export type OperationOutcomePatch =
  | { state: "succeeded"; succeededAt: string; lastError: null }
  | { state: "queued"; nextAttemptAt: string; lastError: string }
  | { state: "dead_letter"; lastError: string }
  | { state: "failed"; lastError: string };

/* ── Store errors ────────────────────────────────────────────────────────── */

export type StoreError = { code?: string | null; message: string };
export type InsertResult = { ok: true; id: string } | { ok: false; error: StoreError };

export const isUniqueViolation = (e: StoreError): boolean =>
  e.code === "23505" || /duplicate key|unique/i.test(e.message ?? "");

/* ── Audit ───────────────────────────────────────────────────────────────── */

export type AuditEntry = {
  action: string;
  target: string | null;
  tenantId: string | null;
  metadata: Record<string, unknown>;
};

/* ── Ledger views the handlers read ──────────────────────────────────────── */

export type XeroInvoiceView = {
  id: string;
  tenantId: string;
  /** Our stable reference as it appears in Xero (the recovery lookup key). */
  reference: string;
  status: string;
  dateISO: string;
  dueDateISO: string | null;
  xeroInvoiceId: string | null;
  lineItems: { description: string; amountMinor: number }[];
  currency: string;
  tenant: { name: string; email: string | null; xeroContactId: string | null };
};

export type XeroAllocationView = {
  id: string;
  tenantId: string;
  obligationId: string;
  invoiceId: string | null;
  xeroInvoiceId: string | null;
  kind: AllocationKind;
  provider: PaymentProvider;
  providerPaymentRef: string;
  amountMinor: number;
  currency: string;
  allocatedAt: string;
  /** Already recorded in Xero (evidence.xero_payment_id or xero_recorded_at). */
  xeroRecorded: boolean;
  /** Xero payment ids other allocations on the same invoice already claimed. */
  siblingXeroPaymentIds: string[];
};

export type ActivationView = ActivationRecord & { tenantId: string };

export type ObligationView = {
  id: string;
  tenantId: string;
  currency: string;
  amountGrossMinor: number;
  invoiceId: string | null;
  xeroInvoiceId: string | null;
};

export type ProviderPaymentInsert = {
  tenantId: string | null;
  provider: PaymentProvider;
  providerPaymentRef: string;
  kind: AllocationKind;
  amountMinor: number;
  currency: string;
  environment: Environment;
  receivedAt: string;
  evidence: Record<string, unknown>;
};

export type AllocationInsert = {
  tenantId: string;
  obligationId: string;
  invoiceId: string | null;
  provider: PaymentProvider;
  providerPaymentRef: string;
  kind: AllocationKind;
  amountMinor: number;
  currency: string;
  allocatedAt: string;
  evidence: Record<string, unknown>;
};

export type RecordResult =
  | { ok: true; id: string; created: boolean }
  | { ok: false; error: StoreError };

/**
 * Legacy mirror: the status projections the pre-redesign webhook applies to
 * `subscriptions` rows that have NO arrangement (arrangement_id is null).
 * With `integrationWorkers` on, the inbox path applies the same projections
 * so the two live legacy rows keep behaving exactly as today. It NEVER
 * creates a subscription.
 */
export type LegacyMirror = {
  findPendingByBillingRequest(
    ref: string
  ): Promise<{ id: string; tenantId: string; plan: string | null } | null>;
  replaceMandateRef(oldRef: string, newRef: string): Promise<void>;
  cancelByMandateRef(ref: string): Promise<{ id: string; tenantId: string }[]>;
  cancelBySubscriptionRef(ref: string): Promise<{ id: string; tenantId: string }[]>;
  markPaymentOutcome(q: {
    subscriptionRef: string | null;
    mandateRef: string | null;
    outcome: "failed" | "recovered";
  }): Promise<{ id: string; tenantId: string; plan: string | null }[]>;
  findLegacySubscription(q: {
    subscriptionRef: string | null;
    mandateRef: string | null;
  }): Promise<{ id: string; tenantId: string; plan: string | null } | null>;
  recordCarePlanPayment(args: {
    tenantId: string;
    subscriptionId: string;
    plan: string | null;
    paymentId: string;
    amountPence: number;
    chargeDate: string | null;
  }): Promise<void>;
};

export type LedgerStore = {
  // Xero invoice projection
  getInvoiceForXero(invoiceId: string): Promise<XeroInvoiceView | null>;
  setInvoiceXeroId(
    invoiceId: string,
    xeroInvoiceId: string,
    onlineUrl: string | null
  ): Promise<"saved" | "already_set" | "not_found">;
  setTenantXeroContact(tenantId: string, contactId: string): Promise<void>;
  // Xero payment allocation
  getAllocationForXero(allocationId: string): Promise<XeroAllocationView | null>;
  markAllocationRecordedInXero(
    allocationId: string,
    evidence: {
      xero_payment_id: string | null;
      xero_recorded_at: string;
      recovered: boolean;
    }
  ): Promise<void>;
  // Mandates (0064)
  findMandate(q: {
    provider: "gocardless" | "stripe";
    environment: Environment;
    mandateRef?: string | null;
    billingRequestRef?: string | null;
  }): Promise<MandateRecord | null>;
  saveMandate(row: MandateUpsert): Promise<{ id: string }>;
  /** Who owns a mandate, from OUR records (an earlier mandates row or a legacy pending row); never provider metadata. */
  resolveMandateOwner(q: {
    environment: Environment;
    billingRequestRef: string | null;
    mandateRef: string | null;
  }): Promise<{ tenantId: string | null; consent: ConsentEvidence | null }>;
  // Activations (0064)
  getActivation(id: string): Promise<ActivationView | null>;
  findActivationByProviderRef(
    environment: Environment,
    ref: string
  ): Promise<ActivationView | null>;
  findLiveActivationByMandate(mandateId: string): Promise<ActivationView | null>;
  /** Everything `activationGates` needs, loaded fresh; null when it cannot be assembled. */
  loadGateInput(activationId: string, asOf: string): Promise<GateInput | null>;
  updateActivation(
    id: string,
    patch: Partial<{
      state: ActivationRecord["state"];
      requestedChargeDate: string | null;
      providerConfirmedChargeDate: string | null;
      providerSubscriptionRef: string | null;
      failureReason: string | null;
      scheduledAt: string | null;
      activatedAt: string | null;
      cancelledAt: string | null;
    }>
  ): Promise<void>;
  // Obligations, provider payments, allocations (0062)
  findObligationForCollection(q: {
    activation: ActivationView;
    chargeDate: string | null;
  }): Promise<ObligationView | null>;
  recordProviderPayment(row: ProviderPaymentInsert): Promise<RecordResult>;
  recordAllocation(row: AllocationInsert): Promise<RecordResult>;
  listAllocations(
    provider: PaymentProvider,
    providerPaymentRef: string
  ): Promise<AllocationRecord[]>;
  legacy: LegacyMirror;
};

/* ── The store port ──────────────────────────────────────────────────────── */

export type OpsStore = {
  insertEvent(e: InboundEvent): Promise<InsertResult>;
  getEvent(id: string): Promise<EventRow | null>;
  setEventStatus(
    id: string,
    status: EventStatus,
    error: string | null,
    processedAt: string | null
  ): Promise<void>;
  /** Events still to (re)process: received (never processed) or failed (transient error), oldest first. */
  listUnprocessedEvents(q: {
    limit: number;
    receivedBefore: string;
    receivedAfter: string;
  }): Promise<EventRow[]>;
  insertOperation(op: OperationInsert, now: string): Promise<InsertResult>;
  findOperationByKey(key: string): Promise<OperationRow | null>;
  claimOperations(q: {
    owner: string;
    limit: number;
    now: string;
    leaseUntil: string;
  }): Promise<OperationRow[]>;
  /** Guarded by the lease: false when another worker holds the row now. */
  completeOperation(
    id: string,
    owner: string,
    patch: OperationOutcomePatch
  ): Promise<boolean>;
  openException(
    row: ExceptionInsert
  ): Promise<
    { ok: true; id: string; created: boolean } | { ok: false; error: StoreError }
  >;
  audit(entry: AuditEntry): Promise<void>;
  ledger: LedgerStore;
};

/* ── Provider ports ──────────────────────────────────────────────────────── */

/**
 * Xero, as the handlers need it. `lib/xeroOps.ts` implements it over
 * `packages/billing/src/xero.ts` plus the recovery lookups; tests fake it.
 * Methods throw `XeroOpsError`-shaped errors ({ kind: outage | rejected |
 * unconfigured }) so the worker can tell transient from permanent.
 */
export type XeroPort = {
  configured(): boolean;
  findInvoiceByReference(
    reference: string
  ): Promise<{ invoiceId: string; invoiceNumber: string | null; status: string } | null>;
  findOrCreateContact(opts: {
    name: string;
    email: string | null;
    existingContactId: string | null;
  }): Promise<string | null>;
  createInvoice(opts: {
    contactId: string;
    reference: string;
    dateISO: string;
    dueDateISO: string | null;
    lineItems: { description: string; amountMinor: number }[];
  }): Promise<{ invoiceId: string; invoiceNumber: string | null } | null>;
  getOnlineInvoiceUrl(xeroInvoiceId: string): Promise<string | null>;
  listInvoicePayments(
    xeroInvoiceId: string
  ): Promise<
    {
      paymentId: string;
      amountMinor: number;
      dateISO: string;
      reference: string | null;
    }[]
  >;
  recordPayment(opts: {
    xeroInvoiceId: string;
    amountMinor: number;
    dateISO: string;
    reference: string;
    accountCode?: string;
  }): Promise<{ ok: true } | null>;
};

export type ProviderErrorKind = "outage" | "rejected" | "unconfigured";

/** A provider error the worker can classify. Message must already be sanitised. */
export class ProviderError extends Error {
  constructor(
    public readonly kind: ProviderErrorKind,
    message: string,
    public readonly status: number | null = null
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export type GoCardlessPaymentResource = {
  id: string;
  status: string;
  amountMinor: number;
  currency: string;
  chargeDate: string | null;
  subscriptionRef: string | null;
  mandateRef: string | null;
};

export type GoCardlessMandateResource = {
  id: string;
  status: string;
  customerRef: string | null;
  /** From the mandate's own links when the provider reports a successor. */
  nextMandateRef: string | null;
};

export type GoCardlessBillingRequestResource = {
  id: string;
  status: string;
  mandateRef: string | null;
  metadata: Record<string, string>;
};

export type GoCardlessSubscriptionResource = {
  id: string;
  status: string;
  amountMinor: number;
  currency: string;
  startDate: string | null;
  /** The provider's own first/next charge date; never assumed. */
  nextChargeDate: string | null;
  mandateRef: string | null;
};

/**
 * GoCardless, as the inbox processing and the two collection handlers need
 * it. Reads are authoritative resource fetches; the only creates are the
 * subscription (with a start date, an Idempotency-Key and 409 adoption) and
 * the payment cancellation.
 */
export type GoCardlessPort = {
  environment: Environment;
  getPayment(ref: string): Promise<GoCardlessPaymentResource | null>;
  getMandate(ref: string): Promise<GoCardlessMandateResource | null>;
  getBillingRequest(ref: string): Promise<GoCardlessBillingRequestResource | null>;
  getSubscription(ref: string): Promise<GoCardlessSubscriptionResource | null>;
  createSubscription(opts: {
    idempotencyKey: string;
    mandateRef: string;
    amountMinor: number;
    currency: string;
    intervalUnit: "monthly" | "yearly";
    intervalCount: number;
    startDate: string;
    name: string;
    metadata: Record<string, string>;
  }): Promise<{ subscriptionRef: string; adopted: boolean }>;
  cancelPayment(ref: string): Promise<{ ok: boolean }>;
};

/** No real send. The stub records and dedupes; a real channel is a later, approved step. */
export type NotifyPort = {
  deliver(msg: {
    dedupeKey: string;
    channel: string;
    subject: string;
    body: string;
  }): Promise<{ delivered: false; stubbed: true }>;
};

export type Ports = {
  xero: XeroPort;
  gocardless: GoCardlessPort;
  notify: NotifyPort;
};
