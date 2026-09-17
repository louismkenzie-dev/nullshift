/**
 * Billing activation — the pure rules behind migration 0064 (brief §3.3 #2
 * and #4, §8.3–8.4, §10.2, §12.3, §17.2 rows 1–2 and 5, "bank transfer
 * before Direct Debit").
 *
 * Builds on `lib/legal/arrangements.ts` (`activationPreconditions`, which
 * already encodes the §8.3 gate list) and adds what the activation task
 * owns:
 *
 *  - `activationGates(input)` — the §8.3 list against the 0064 mandate
 *    record: environment must match (a sandbox mandate can never satisfy a
 *    live activation), a held-for-review or foreign-tenant mandate is not
 *    collection authority, and a Xero-native collection workflow on the same
 *    obligation is a duplicate rail even though it is "the same provider".
 *  - `dateArrivalOutcome(input)` — §8.4: once the contractual date arrives
 *    with any gate missing, the only output is a high-priority owned
 *    exception. No default plan, no indicative charge, no backdating, no
 *    silent date change, no forced route change, no shutdown.
 *  - `reserveActivation(store, request)` — §8.3 step 5: the transactional
 *    reservation. It inserts one `service_activations` row and interprets
 *    the partial unique index's 23505 as `{ ok: false, reason: "duplicate" }`.
 *    Two concurrent callers get exactly one winner.
 *  - `scheduleActivation(...)` — §8.3 step 6: returns the operation payload
 *    the worker will execute. The provider call is never made here.
 *  - `onOtherPaymentArrived(...)` — §10.2 last paragraph / §17.2: another
 *    payment settles or reduces the obligation while a collection is
 *    pending: request cancellation where the provider permits, otherwise
 *    open an urgent owned exception; overpayment stays visible with no
 *    automatic refund or write-off.
 *
 * Nothing in this module performs I/O itself. The only side effect is the
 * store call inside `reserveActivation`, and that runs only when the
 * `billingActivation` flag is on. Money is integer minor units with an
 * explicit currency; dates are ISO `YYYY-MM-DD` strings compared lexically.
 */

import { flagOn } from "@/lib/flags";
import {
  activationPreconditions,
  chargeability,
  collectionTiming,
  EXCEPTION_RESOLUTIONS,
  type ActivationGate,
  type ActivationInput,
  type Arrangement,
  type Cadence,
  type Chargeability,
  type CollectionTiming,
  type ExceptionResolution,
  type InternalApproval,
  type Mandate as GateMandate,
  type MissingGate,
  type ScheduleContent,
  type ServiceSchedule,
} from "@/lib/legal/arrangements";

/* ── Vocabulary (mirrors 0064 CHECK constraints) ─────────────────────────── */

export const ENVIRONMENTS = ["sandbox", "live"] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

export const MANDATE_PROVIDERS = ["gocardless", "stripe"] as const;
export type MandateProvider = (typeof MANDATE_PROVIDERS)[number];

export const MANDATE_STATUSES = [
  "pending",
  "authorised",
  "active",
  "cancelled",
  "failed",
  "replaced",
] as const;
export type MandateStatus = (typeof MANDATE_STATUSES)[number];

export const ACTIVATION_STATES = [
  "reserved",
  "scheduled",
  "active",
  "cancelled",
  "failed",
] as const;
export type ActivationState = (typeof ACTIVATION_STATES)[number];

/** Live = holds the per-arrangement reservation (the 0064 partial unique index). */
export const LIVE_ACTIVATION_STATES: readonly ActivationState[] = [
  "reserved",
  "scheduled",
  "active",
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/* ── Shapes (camelCase views over the 0064 rows) ─────────────────────────── */

export type MandateRecord = {
  id: string;
  /** Null = orphan (held for review by construction). */
  tenantId: string | null;
  provider: MandateProvider;
  environment: Environment;
  customerRef: string | null;
  billingRequestRef: string | null;
  mandateRef: string | null;
  status: MandateStatus;
  consentTermsVersion: string | null;
  consentAcceptanceRef: string | null;
  heldForReview: boolean;
  holdReason: string | null;
  authorisedAt: string | null;
  cancelledAt: string | null;
  replacedBy: string | null;
  rawStatus: string | null;
  /** When the provider resource was last fetched (orders out-of-order events). */
  lastProviderSyncAt: string | null;
};

export type ActivationRecord = {
  id: string;
  arrangementId: string;
  scheduleId: string;
  mandateId: string | null;
  requestedBy: string | null;
  approvedBy: string | null;
  contractualStartDate: string;
  requestedChargeDate: string | null;
  providerConfirmedChargeDate: string | null;
  providerSubscriptionRef: string | null;
  environment: Environment;
  state: ActivationState;
  failureReason: string | null;
};

/**
 * Any collection rail already bound to this obligation. `xero_native` is a
 * Xero-connected payment service / automatic-collection workflow (brief
 * §8.4 of the integrations chapter: "one provider is not sufficient
 * duplicate protection").
 */
export type CollectionRail = {
  kind:
    | "app_subscription"
    | "xero_native"
    | "stripe_subscription"
    | "manual_standing_order";
  environment: Environment | null;
  status: "active" | "scheduled" | "pending" | "cancelled" | "unknown";
  ref: string | null;
};

/** A mandate is usable collection authority only in these states. */
export const isMandateUsable = (
  m: Pick<MandateRecord, "status" | "heldForReview">
): boolean => !m.heldForReview && (m.status === "authorised" || m.status === "active");

/* ── §8.3 gates ──────────────────────────────────────────────────────────── */

export type GateCode = ActivationGate | "environment_match";

export type MissingItem = { gate: GateCode; detail: string };

export type GateInput = {
  arrangement: Arrangement;
  schedule: ServiceSchedule | null;
  /** Frozen content read from the accepted snapshot; null if unverified. */
  accepted: ScheduleContent | null;
  approval: InternalApproval | null;
  /** The environment this activation targets (from configuration, not the mandate). */
  environment: Environment;
  mandate: MandateRecord | null;
  /** Provider lead time (banking days) between submission and first collection. */
  providerLeadDays: number;
  /** Other rails already bound to this obligation, including Xero-native ones. */
  existingRails: readonly CollectionRail[];
  /** YYYY-MM-DD "today". */
  asOf: string;
};

export type GateReport = {
  ok: boolean;
  missing: MissingItem[];
  /** The exact terms, when every content gate passes; null otherwise. */
  charge: Extract<Chargeability, { chargeable: true }> | null;
  contractualStartDate: string | null;
};

/** Rails that would collect the same obligation if we scheduled another. */
export function duplicateRails(
  rails: readonly CollectionRail[],
  environment: Environment
): CollectionRail[] {
  return rails.filter((r) => {
    if (r.status === "cancelled") return false;
    // A Xero-native workflow collects regardless of which environment label
    // we hold for it; treat it as a duplicate unless it is cancelled.
    if (r.kind === "xero_native") return true;
    if (r.status === "unknown") return true;
    return r.environment === null || r.environment === environment;
  });
}

function toGateMandate(input: GateInput): GateMandate | null {
  const { mandate } = input;
  if (!mandate) return null;
  return {
    status: mandateStatusForGate(mandate),
    reference: mandate.mandateRef,
    providerLeadDays: input.providerLeadDays,
    otherActiveRails: duplicateRails(input.existingRails, input.environment).length,
  };
}

function mandateStatusForGate(m: MandateRecord): GateMandate["status"] {
  if (m.heldForReview) return "pending";
  switch (m.status) {
    case "replaced":
      return "cancelled";
    default:
      return m.status;
  }
}

/**
 * Every §8.3 gate still missing, in the brief's order, against the 0064
 * mandate record. Empty = the activation MAY be reserved (by
 * `reserveActivation`, behind `billingActivation`). Never charges.
 */
export function activationGates(input: GateInput): GateReport {
  const gateMandate = toGateMandate(input);
  const base: ActivationInput = {
    arrangement: input.arrangement,
    schedule: input.schedule,
    accepted: input.accepted,
    mandate: gateMandate,
    approval: input.approval,
    asOf: input.asOf,
  };
  // Duplicate rails are reported once, below, with each rail named; drop the
  // base list's count-only line when there are any.
  const dups = duplicateRails(input.existingRails, input.environment);
  const missing: MissingItem[] = activationPreconditions(base)
    .filter((g: MissingGate) => !(dups.length && g.gate === "no_duplicate_rail"))
    .map((g: MissingGate) => ({ gate: g.gate, detail: g.detail }));

  const m = input.mandate;
  if (m) {
    if (m.environment !== input.environment)
      missing.push({
        gate: "environment_match",
        detail: `A ${m.environment} mandate cannot satisfy a ${input.environment} activation. Test and live records never mix (brief §12.3).`,
      });
    if (m.heldForReview)
      missing.push({
        gate: "collection_authority",
        detail: `The mandate is held for review: ${m.holdReason ?? "no consent evidence"}.`,
      });
    if (m.tenantId !== input.arrangement.tenantId)
      missing.push({
        gate: "collection_authority",
        detail: "The mandate belongs to a different client (or to no client).",
      });
    if (m.status === "replaced")
      missing.push({
        gate: "collection_authority",
        detail: "The mandate has been replaced; bind the replacement, not this one.",
      });
  }

  // Duplicate rails are a gate in their own right, whether or not a mandate
  // exists yet. A Xero-native collection workflow is a duplicate even though
  // it is "the same provider" (§10.1: one collection orchestrator per
  // obligation); name it explicitly so the exception says why.
  if (dups.length) {
    const named = dups
      .map((r) => `${r.kind}${r.ref ? ` ${r.ref}` : ""} (${r.status})`)
      .join(", ");
    const xero = dups.some((r) => r.kind === "xero_native");
    missing.push({
      gate: "no_duplicate_rail",
      detail: `${dups.length} other collection rail(s) already bound to this obligation: ${named}.${
        xero
          ? " A Xero-native collection workflow counts as a duplicate rail; one obligation has one collection orchestrator (brief §12.3)."
          : ""
      }`,
    });
  }

  const dedup = dedupe(missing);
  const charge = input.schedule ? chargeability(input.schedule, input.accepted) : null;
  const startDate =
    input.arrangement.billingStartArrangement === "exact_date"
      ? input.arrangement.billingStartDate
      : null;
  return {
    ok: dedup.length === 0,
    missing: dedup,
    charge: dedup.length === 0 && charge?.chargeable ? charge : null,
    contractualStartDate: startDate,
  };
}

function dedupe(items: MissingItem[]): MissingItem[] {
  const seen = new Set<string>();
  return items.filter((i) => {
    const key = `${i.gate}|${i.detail}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/* ── §8.4 — the date arrives ─────────────────────────────────────────────── */

export type ActivationException = {
  kind: "exception";
  priority: "high" | "urgent";
  ownerRequired: true;
  arrangementId: string;
  /** Preserved verbatim — never shifted. */
  originalStartDate: string | null;
  missing: MissingItem[];
  resolutionOptions: readonly ExceptionResolution[];
  forbidden: {
    defaultPlan: false;
    indicativeCharge: false;
    backdate: false;
    silentDateChange: false;
    forcedRouteChange: false;
    automaticShutdown: false;
  };
  recordGapResponsibility: true;
  plan: null;
  amountMinor: null;
  charge: null;
};

export type DateArrivalOutcome =
  | { kind: "not_due"; contractualStartDate: string | null }
  | {
      kind: "ready";
      charge: Extract<Chargeability, { chargeable: true }>;
      contractualStartDate: string;
    }
  | ActivationException;

const FORBIDDEN = {
  defaultPlan: false,
  indicativeCharge: false,
  backdate: false,
  silentDateChange: false,
  forcedRouteChange: false,
  automaticShutdown: false,
} as const;

/**
 * When the contractual start date (or the accepted schedule's start) has
 * arrived: `ready` only if every gate passes; otherwise a high-priority owned
 * exception and nothing else. Before the date: `not_due`.
 */
export function dateArrivalOutcome(input: GateInput): DateArrivalOutcome {
  const report = activationGates(input);
  const contractual = report.contractualStartDate;
  const scheduleStart = input.accepted?.startDate ?? null;
  const asOfValid = DATE_RE.test(input.asOf);
  const arrived =
    asOfValid &&
    ((contractual !== null && input.asOf >= contractual) ||
      (scheduleStart !== null && input.asOf >= scheduleStart));
  if (!arrived) return { kind: "not_due", contractualStartDate: contractual };
  if (report.ok && report.charge && contractual)
    return { kind: "ready", charge: report.charge, contractualStartDate: contractual };
  return {
    kind: "exception",
    priority: "high",
    ownerRequired: true,
    arrangementId: input.arrangement.id,
    originalStartDate: contractual ?? scheduleStart,
    missing: report.missing,
    resolutionOptions: EXCEPTION_RESOLUTIONS,
    forbidden: { ...FORBIDDEN },
    recordGapResponsibility: true,
    plan: null,
    amountMinor: null,
    charge: null,
  };
}

/* ── §8.3 step 5 — the transactional reservation ─────────────────────────── */

export type ReservationInsert = {
  arrangementId: string;
  scheduleId: string;
  mandateId: string;
  requestedBy: string;
  approvedBy: string;
  contractualStartDate: string;
  environment: Environment;
  state: "reserved";
};

export type StoreError = { code?: string | null; message: string };

/**
 * The one write this module makes. Implemented over Supabase by the server
 * action / worker; implemented in memory by the tests. A conforming store
 * enforces `service_activations_one_live_per_arrangement` and reports the
 * violation as code "23505" (or a message naming the index).
 */
export type ActivationStore = {
  insertReservation(
    row: ReservationInsert
  ): Promise<{ ok: true; id: string } | { ok: false; error: StoreError }>;
};

export type ReserveRequest = {
  gates: GateInput;
  requestedBy: string;
};

export type ReserveResult =
  | { ok: true; activationId: string; row: ReservationInsert }
  | { ok: false; reason: "flag_off" }
  | { ok: false; reason: "gates_missing"; missing: MissingItem[] }
  | { ok: false; reason: "duplicate"; arrangementId: string }
  | { ok: false; reason: "store_error"; error: StoreError };

export const isUniqueViolation = (e: StoreError): boolean =>
  e.code === "23505" ||
  /service_activations_one_live_per_arrangement|duplicate key|unique/i.test(
    e.message ?? ""
  );

/**
 * Reserve ONE activation for the arrangement. Refuses before touching the
 * store when the flag is off or any gate is missing. Two concurrent callers
 * with the same arrangement get exactly one `ok: true`; the loser sees
 * `duplicate` and must not retry by relaxing a gate.
 */
export async function reserveActivation(
  store: ActivationStore,
  request: ReserveRequest
): Promise<ReserveResult> {
  if (!flagOn("billingActivation")) return { ok: false, reason: "flag_off" };
  const report = activationGates(request.gates);
  if (!report.ok || !report.charge || !report.contractualStartDate)
    return { ok: false, reason: "gates_missing", missing: report.missing };
  const { gates } = request;
  // Gates passed, so these are present; the narrowing is repeated for the
  // type checker rather than trusted.
  if (!gates.schedule || !gates.mandate || !gates.approval?.approvedBy)
    return {
      ok: false,
      reason: "gates_missing",
      missing: [{ gate: "internal_approval", detail: "Incomplete activation input." }],
    };
  const row: ReservationInsert = {
    arrangementId: gates.arrangement.id,
    scheduleId: gates.schedule.id,
    mandateId: gates.mandate.id,
    requestedBy: request.requestedBy,
    approvedBy: gates.approval.approvedBy,
    contractualStartDate: report.contractualStartDate,
    environment: gates.environment,
    state: "reserved",
  };
  const result = await store.insertReservation(row);
  if (result.ok) return { ok: true, activationId: result.id, row };
  if (isUniqueViolation(result.error))
    return { ok: false, reason: "duplicate", arrangementId: row.arrangementId };
  return { ok: false, reason: "store_error", error: result.error };
}

/**
 * The audit_log row the calling server action writes (via `logAudit`) for a
 * reservation attempt. Every outcome is recorded, including the loser of a
 * race: a silent duplicate is exactly what the brief forbids.
 */
export function reservationAuditEntry(
  result: ReserveResult,
  ctx: { tenantId: string; arrangementId: string; actor: string }
): {
  action: string;
  target: string;
  tenantId: string;
  metadata: Record<string, unknown>;
} {
  const target = `service_arrangement:${ctx.arrangementId}`;
  if (result.ok)
    return {
      action: "billing.activation_reserved",
      target,
      tenantId: ctx.tenantId,
      metadata: {
        actor: ctx.actor,
        activationId: result.activationId,
        environment: result.row.environment,
        contractualStartDate: result.row.contractualStartDate,
      },
    };
  return {
    action: `billing.activation_refused.${result.reason}`,
    target,
    tenantId: ctx.tenantId,
    metadata: {
      actor: ctx.actor,
      ...(result.reason === "gates_missing"
        ? { missing: result.missing.map((m) => m.gate) }
        : {}),
      ...(result.reason === "store_error" ? { error: result.error.message } : {}),
    },
  };
}

/* ── §8.3 step 6 — schedule (payload only; the worker calls the provider) ── */

export type ScheduleCollectionOperation = {
  kind: "provider.schedule_collection";
  /** Stable identity so a retried worker run cannot double-create. */
  idempotencyKey: string;
  executeIn: "worker";
  provider: MandateProvider;
  environment: Environment;
  activationId: string;
  arrangementId: string;
  scheduleId: string;
  mandateRef: string;
  amountMinor: number;
  currency: string;
  cadence: Cadence;
  /** Never earlier than this; preserved verbatim. */
  contractualStartDate: string;
  /** What to ask the provider for (>= contractual start). */
  requestedChargeDate: string;
  timing: CollectionTiming;
  /** Written back by the worker from the provider's response, never assumed. */
  providerConfirmedChargeDate: null;
  metadata: { activation_id: string; arrangement_id: string; schedule_id: string };
};

export type ScheduleResult =
  | { ok: true; operation: ScheduleCollectionOperation; next: "scheduled" }
  | { ok: false; reason: "not_reserved"; state: ActivationState }
  | { ok: false; reason: "gates_missing"; missing: MissingItem[] }
  | { ok: false; reason: "environment_mismatch"; detail: string }
  | { ok: false; reason: "mandate_ref_missing" };

/**
 * From a reserved activation and a passing gate report, the operation the
 * worker will execute. No provider call here; no charge before the
 * contractual date; the provider's later date never moves the commercial
 * one (collectionTiming reports it separately).
 */
export function scheduleActivation(
  activation: ActivationRecord,
  input: GateInput
): ScheduleResult {
  if (activation.state !== "reserved")
    return { ok: false, reason: "not_reserved", state: activation.state };
  const report = activationGates(input);
  if (!report.ok || !report.charge || !report.contractualStartDate)
    return { ok: false, reason: "gates_missing", missing: report.missing };
  const mandate = input.mandate;
  if (
    !mandate ||
    mandate.environment !== activation.environment ||
    input.environment !== activation.environment
  )
    return {
      ok: false,
      reason: "environment_mismatch",
      detail: `Activation is ${activation.environment}; mandate is ${mandate?.environment ?? "absent"}; target is ${input.environment}.`,
    };
  if (!mandate.mandateRef) return { ok: false, reason: "mandate_ref_missing" };

  const timing = collectionTiming(
    report.contractualStartDate,
    input.asOf,
    input.providerLeadDays
  );
  const requestedChargeDate =
    timing.earliestProviderCollectionDate > report.contractualStartDate
      ? timing.earliestProviderCollectionDate
      : report.contractualStartDate;

  return {
    ok: true,
    next: "scheduled",
    operation: {
      kind: "provider.schedule_collection",
      idempotencyKey: `activation:${activation.id}:schedule`,
      executeIn: "worker",
      provider: mandate.provider,
      environment: activation.environment,
      activationId: activation.id,
      arrangementId: activation.arrangementId,
      scheduleId: activation.scheduleId,
      mandateRef: mandate.mandateRef,
      amountMinor: report.charge.amountMinor,
      currency: report.charge.currency,
      cadence: report.charge.cadence,
      contractualStartDate: report.contractualStartDate,
      requestedChargeDate,
      timing,
      providerConfirmedChargeDate: null,
      metadata: {
        activation_id: activation.id,
        arrangement_id: activation.arrangementId,
        schedule_id: activation.scheduleId,
      },
    },
  };
}

/* ── Another payment arrives while a collection is pending (§10.2, §17.2) ─ */

export type PendingCollection = {
  provider: MandateProvider;
  environment: Environment;
  ref: string;
  amountMinor: number;
  currency: string;
  /** Provider-confirmed state, not the last event received. */
  status:
    | "scheduled"
    | "pending_submission"
    | "submitted"
    | "confirmed"
    | "paid_out"
    | "unknown";
  /** Whether the provider permits cancellation in this state. */
  cancellableByProvider: boolean;
};

export type IncomingPayment = {
  source: "bank_transfer" | "stripe" | "other";
  ref: string;
  amountMinor: number;
  currency: string;
};

export type ObligationBalance = {
  obligationId: string;
  grossMinor: number;
  currency: string;
  /** Already allocated to this obligation before this payment. */
  allocatedMinor: number;
};

export type CancelCollectionOperation = {
  kind: "provider.cancel_collection";
  idempotencyKey: string;
  executeIn: "worker";
  provider: MandateProvider;
  environment: Environment;
  collectionRef: string;
  /** Record the cancellation only when the provider confirms it. */
  recordOnProviderConfirmation: true;
};

export type OtherPaymentOutcome = {
  obligationId: string;
  currency: string;
  /** After this payment: > 0 still owed, 0 settled, < 0 overpaid. */
  remainingMinor: number;
  overpaymentMinor: number;
  /** Overpayment stays on the ledger; never refunded or written off here. */
  overpayment: {
    visible: true;
    automaticRefund: false;
    writeOff: false;
    requiresApproval: boolean;
  };
  action:
    | { kind: "none"; detail: string }
    | {
        kind: "request_cancellation";
        operation: CancelCollectionOperation;
        followUp: string | null;
      }
    | {
        kind: "exception";
        priority: "urgent";
        ownerRequired: true;
        detail: string;
        closingPaymentLinkIsInsufficient: true;
      };
};

/**
 * Re-evaluate the remaining obligation when another payment lands while a
 * Direct Debit (or other collection) is pending. Cancel where the provider
 * permits (recorded only on confirmation); if submitted or uncertain, an
 * urgent owned exception. Never refunds or writes off.
 */
export function onOtherPaymentArrived(
  obligation: ObligationBalance,
  payment: IncomingPayment,
  pending: PendingCollection | null
): OtherPaymentOutcome {
  const mismatch =
    payment.currency !== obligation.currency ||
    (pending !== null && pending.currency !== obligation.currency);
  const remainingBefore = obligation.grossMinor - obligation.allocatedMinor;
  const remainingMinor = mismatch
    ? remainingBefore
    : remainingBefore - payment.amountMinor;
  const overpaymentMinor = Math.max(0, -remainingMinor);
  const overpayment = {
    visible: true as const,
    automaticRefund: false as const,
    writeOff: false as const,
    requiresApproval: overpaymentMinor > 0,
  };
  const base = {
    obligationId: obligation.obligationId,
    currency: obligation.currency,
    remainingMinor,
    overpaymentMinor,
    overpayment,
  };

  if (mismatch)
    return {
      ...base,
      action: {
        kind: "exception",
        priority: "urgent",
        ownerRequired: true,
        detail: `Currency mismatch (${payment.currency} payment against a ${obligation.currency} obligation); allocate by hand.`,
        closingPaymentLinkIsInsufficient: true,
      },
    };

  if (!pending)
    return {
      ...base,
      action: { kind: "none", detail: "No pending collection to reconcile against." },
    };

  // Would the pending collection now over-collect?
  const wouldOverCollect = pending.amountMinor > Math.max(0, remainingMinor);
  if (!wouldOverCollect)
    return {
      ...base,
      action: {
        kind: "none",
        detail: "The pending collection still fits the remaining obligation.",
      },
    };

  const cancellable =
    pending.cancellableByProvider &&
    (pending.status === "scheduled" || pending.status === "pending_submission");
  if (cancellable)
    return {
      ...base,
      action: {
        kind: "request_cancellation",
        operation: {
          kind: "provider.cancel_collection",
          idempotencyKey: `collection:${pending.environment}:${pending.ref}:cancel`,
          executeIn: "worker",
          provider: pending.provider,
          environment: pending.environment,
          collectionRef: pending.ref,
          recordOnProviderConfirmation: true,
        },
        followUp:
          remainingMinor > 0
            ? `Remaining ${remainingMinor} ${obligation.currency} needs a new collection through the normal gates; nothing is re-scheduled automatically.`
            : null,
      },
    };

  return {
    ...base,
    action: {
      kind: "exception",
      priority: "urgent",
      ownerRequired: true,
      detail:
        pending.status === "unknown"
          ? `Collection ${pending.ref} state is uncertain; confirm with the provider before anything else.`
          : `Collection ${pending.ref} is ${pending.status} and cannot be cancelled; an over-collection of ${pending.amountMinor - Math.max(0, remainingMinor)} ${obligation.currency} will need approved handling.`,
      closingPaymentLinkIsInsufficient: true,
    },
  };
}
