/**
 * Handler registry for the ops worker (brief §10.2, §10.3, §12.4, §17.2).
 *
 *  xero.create_invoice        Look the invoice up in Xero BY OUR REFERENCE
 *                             before creating; never create twice; save the
 *                             Xero identity. Nothing about payments.
 *  xero.allocate_payment      Record an ALREADY RECEIVED payment against the
 *                             Xero invoice; idempotent by provider payment
 *                             ref (Xero payment Reference) with a recovery
 *                             lookup; retries only the allocation. If the
 *                             invoice is not in Xero yet it enqueues the
 *                             create operation and waits — the two are
 *                             separate operations by design.
 *  gocardless.schedule_activation
 *                             Re-runs `activationGates` against fresh data
 *                             on EVERY attempt; the provider call happens
 *                             only when all pass and the payload still
 *                             matches the accepted schedule; the subscription
 *                             is created with a start date ≥ the contractual
 *                             start, an Idempotency-Key and 409 adoption;
 *                             the provider-confirmed charge date is written
 *                             back from the resource, never assumed.
 *  gocardless.cancel_pending  Cancel a pending collection; record the
 *                             cancellation only on provider confirmation;
 *                             an already-submitted collection is an urgent
 *                             owned exception, not a retry.
 *  notify                     No real send. Stub with dedupe (the outbox
 *                             key), audited.
 *
 * Every handler is pure over the ports and the ledger port; nothing here
 * imports a provider SDK or a database client.
 */

import { activationGates } from "@/lib/billing/activation";
import type {
  ScheduleCollectionOperation,
  CancelCollectionOperation,
} from "@/lib/billing/activation";
import { opXeroCreateInvoice } from "./outbox";
import { ProviderError, type OperationRow } from "./types";
import type {
  ExceptionHint,
  Handler,
  HandlerContext,
  HandlerRegistry,
  HandlerResult,
} from "./worker";

const failed = (error: string, exception?: ExceptionHint): HandlerResult => ({
  outcome: "failed",
  error,
  ...(exception ? { exception } : {}),
});
const retry = (error: string): HandlerResult => ({ outcome: "retry", error });
const ok = (note?: string): HandlerResult => ({ outcome: "succeeded", note });

const subjectId = (
  op: OperationRow,
  key: keyof OperationRow["subject"]
): string | null => {
  const v = op.subject[key];
  return typeof v === "string" && v.length > 0 ? v : null;
};

/* ── xero.create_invoice ─────────────────────────────────────────────────── */

export const xeroCreateInvoice: Handler = async (op, ctx) => {
  const invoiceId = subjectId(op, "invoice_id");
  if (!invoiceId) return failed("subject.invoice_id is required.");
  const { xero } = ctx.ports;
  const { ledger } = ctx.store;

  const inv = await ledger.getInvoiceForXero(invoiceId);
  if (!inv) return failed(`Invoice ${invoiceId} not found.`);
  if (inv.xeroInvoiceId) return ok("already in Xero");
  if (inv.status === "void" || inv.status === "draft")
    return failed(`Invoice is ${inv.status}; nothing to create.`);
  if (!xero.configured())
    throw new ProviderError("unconfigured", "Xero is not configured.");

  // Recovery lookup BEFORE any create: a previous attempt may have created
  // the invoice remotely and died before saving the id (§3.3 #6).
  const existing = await xero.findInvoiceByReference(inv.reference);
  if (existing) {
    const saved = await ledger.setInvoiceXeroId(inv.id, existing.invoiceId, null);
    await ctx.store.audit({
      action: "ops.xero_invoice_recovered",
      target: `invoice:${inv.id}`,
      tenantId: inv.tenantId,
      metadata: {
        xero_invoice_id: existing.invoiceId,
        reference: inv.reference,
        saved,
        correlation_id: op.correlationId,
      },
    });
    return ok(`recovered ${existing.invoiceId} by reference`);
  }

  const contactId = await xero.findOrCreateContact({
    name: inv.tenant.name,
    email: inv.tenant.email,
    existingContactId: inv.tenant.xeroContactId,
  });
  if (!contactId) throw new ProviderError("unconfigured", "Xero returned no contact.");
  if (contactId !== inv.tenant.xeroContactId)
    await ledger.setTenantXeroContact(inv.tenantId, contactId);

  const created = await xero.createInvoice({
    contactId,
    reference: inv.reference,
    dateISO: inv.dateISO,
    dueDateISO: inv.dueDateISO,
    lineItems: inv.lineItems,
  });
  if (!created) throw new ProviderError("unconfigured", "Xero returned no invoice.");

  // The online link is optional; a failure here must not make the create
  // look failed (that would risk a second create on retry).
  const onlineUrl = await xero.getOnlineInvoiceUrl(created.invoiceId).catch(() => null);
  const saved = await ledger.setInvoiceXeroId(inv.id, created.invoiceId, onlineUrl);
  await ctx.store.audit({
    action: "ops.xero_invoice_created",
    target: `invoice:${inv.id}`,
    tenantId: inv.tenantId,
    metadata: {
      xero_invoice_id: created.invoiceId,
      xero_invoice_number: created.invoiceNumber,
      reference: inv.reference,
      saved,
      correlation_id: op.correlationId,
    },
  });
  return ok(`created ${created.invoiceId}`);
};

/* ── xero.allocate_payment ───────────────────────────────────────────────── */

export const xeroAllocatePayment: Handler = async (op, ctx) => {
  const allocationId = subjectId(op, "allocation_id");
  if (!allocationId) return failed("subject.allocation_id is required.");
  const { xero } = ctx.ports;
  const { ledger } = ctx.store;

  const a = await ledger.getAllocationForXero(allocationId);
  if (!a) return failed(`Allocation ${allocationId} not found.`);
  if (a.xeroRecorded) return ok("already recorded in Xero");
  if (a.kind !== "payment")
    return failed(
      `Allocation kind ${a.kind} is not recorded as a Xero payment by this operation (a credit note or refund needs its own approved operation).`
    );
  if (!a.invoiceId)
    return failed(
      "The obligation has no issued invoice; issue it before the payment can be recorded in Xero.",
      {
        kind: "balance_mismatch",
        title: "Payment received against an obligation with no issued invoice",
        safeRetryOp: null,
      }
    );
  if (!xero.configured())
    throw new ProviderError("unconfigured", "Xero is not configured.");

  if (!a.xeroInvoiceId) {
    // Separate operation: make sure the create is queued, then wait for it.
    await ctx.store.insertOperation(
      opXeroCreateInvoice({
        invoiceId: a.invoiceId,
        tenantId: a.tenantId,
        obligationId: a.obligationId,
        correlationId: op.correlationId,
      }),
      ctx.now
    );
    return retry(
      "Invoice is not in Xero yet; xero.create_invoice is queued. Only this allocation will retry."
    );
  }

  // Recovery lookup: was this payment already recorded (crash after PUT)?
  const payments = await xero.listInvoicePayments(a.xeroInvoiceId);
  const claimed = new Set(a.siblingXeroPaymentIds);
  const match =
    payments.find((p) => p.reference === a.providerPaymentRef) ??
    payments.find(
      (p) =>
        !claimed.has(p.paymentId) &&
        p.amountMinor === a.amountMinor &&
        p.dateISO.slice(0, 10) === a.allocatedAt.slice(0, 10)
    );
  if (match) {
    await ledger.markAllocationRecordedInXero(a.id, {
      xero_payment_id: match.paymentId,
      xero_recorded_at: ctx.now,
      recovered: true,
    });
    await ctx.store.audit({
      action: "ops.xero_payment_recovered",
      target: `payment_allocation:${a.id}`,
      tenantId: a.tenantId,
      metadata: {
        xero_invoice_id: a.xeroInvoiceId,
        xero_payment_id: match.paymentId,
        provider_payment_ref: a.providerPaymentRef,
        correlation_id: op.correlationId,
      },
    });
    return ok(`recovered Xero payment ${match.paymentId}`);
  }

  const recorded = await xero.recordPayment({
    xeroInvoiceId: a.xeroInvoiceId,
    amountMinor: a.amountMinor,
    dateISO: a.allocatedAt,
    reference: a.providerPaymentRef,
  });
  if (!recorded)
    throw new ProviderError(
      "unconfigured",
      "Xero payment account is not configured (XERO_PAYMENT_ACCOUNT_CODE)."
    );

  // Read back the id when Xero exposes it; the marker is what makes the
  // next attempt a no-op either way.
  const after = await xero.listInvoicePayments(a.xeroInvoiceId).catch(() => []);
  const mine = after.find((p) => p.reference === a.providerPaymentRef) ?? null;
  await ledger.markAllocationRecordedInXero(a.id, {
    xero_payment_id: mine?.paymentId ?? null,
    xero_recorded_at: ctx.now,
    recovered: false,
  });
  await ctx.store.audit({
    action: "ops.xero_payment_recorded",
    target: `payment_allocation:${a.id}`,
    tenantId: a.tenantId,
    metadata: {
      xero_invoice_id: a.xeroInvoiceId,
      xero_payment_id: mine?.paymentId ?? null,
      amount_minor: a.amountMinor,
      currency: a.currency,
      provider_payment_ref: a.providerPaymentRef,
      correlation_id: op.correlationId,
    },
  });
  return ok("recorded");
};

/* ── gocardless.schedule_activation ──────────────────────────────────────── */

const INTERVAL: Record<
  ScheduleCollectionOperation["cadence"],
  { unit: "monthly" | "yearly"; count: number }
> = {
  monthly: { unit: "monthly", count: 1 },
  quarterly: { unit: "monthly", count: 3 },
  annual: { unit: "yearly", count: 1 },
};

function schedulePayload(op: OperationRow): ScheduleCollectionOperation | null {
  const p = op.payload as Partial<ScheduleCollectionOperation>;
  if (
    p.kind !== "provider.schedule_collection" ||
    typeof p.activationId !== "string" ||
    typeof p.mandateRef !== "string" ||
    typeof p.amountMinor !== "number" ||
    typeof p.currency !== "string" ||
    typeof p.cadence !== "string" ||
    typeof p.contractualStartDate !== "string" ||
    typeof p.requestedChargeDate !== "string" ||
    (p.environment !== "sandbox" && p.environment !== "live")
  )
    return null;
  return p as ScheduleCollectionOperation;
}

export const gocardlessScheduleActivation: Handler = async (op, ctx) => {
  const activationId = subjectId(op, "activation_id");
  if (!activationId) return failed("subject.activation_id is required.");
  const payload = schedulePayload(op);
  if (!payload || payload.activationId !== activationId)
    return failed(
      "Payload is not a provider.schedule_collection operation for this activation."
    );
  const { gocardless } = ctx.ports;
  const { ledger } = ctx.store;

  // Sandbox and live never cross: the operation's environment must be the
  // one this worker's provider port talks to.
  if (payload.environment !== gocardless.environment)
    return failed(
      `Operation is ${payload.environment}; this worker's GoCardless port is ${gocardless.environment}.`,
      {
        kind: "other",
        title: "Activation scheduled for the wrong provider environment",
      }
    );

  const activation = await ledger.getActivation(activationId);
  if (!activation) return failed(`Activation ${activationId} not found.`);
  if (activation.state === "active" && activation.providerSubscriptionRef)
    return ok("already active");
  if (activation.state === "cancelled" || activation.state === "failed")
    return failed(`Activation is ${activation.state}; nothing is scheduled.`);
  if (activation.environment !== payload.environment)
    return failed("Activation and operation environments differ.");

  // Gates re-run on EVERY attempt against fresh data. Any missing gate is a
  // permanent failure of this operation (a person re-approves), never a
  // retry that might pass by accident later.
  const gates = await ledger.loadGateInput(activationId, ctx.today);
  if (!gates)
    return failed("Activation gate input could not be loaded.", {
      kind: "missing_activation_gate",
    });
  const report = activationGates(gates);
  if (!report.ok || !report.charge || !report.contractualStartDate)
    return failed(
      `Gates missing: ${report.missing.map((m) => m.gate).join(", ") || "unknown"}.`,
      {
        kind: "missing_activation_gate",
        title: "Activation could not be scheduled: gate missing",
        detail: report.missing.map((m) => `${m.gate}: ${m.detail}`).join(" "),
      }
    );

  // The payload must still describe the accepted schedule exactly.
  if (
    report.charge.amountMinor !== payload.amountMinor ||
    report.charge.currency !== payload.currency ||
    report.charge.cadence !== payload.cadence ||
    report.contractualStartDate !== payload.contractualStartDate ||
    payload.requestedChargeDate < payload.contractualStartDate
  )
    return failed(
      "The operation payload no longer matches the accepted schedule; re-approve the activation.",
      {
        kind: "missing_activation_gate",
        title: "Activation payload drifted from the accepted schedule",
      }
    );

  // Recovery: a previous attempt may have created the subscription remotely.
  let subscriptionRef = activation.providerSubscriptionRef;
  let adopted = false;
  if (!subscriptionRef) {
    if (activation.state === "reserved")
      await ledger.updateActivation(activationId, {
        state: "scheduled",
        requestedChargeDate: payload.requestedChargeDate,
        scheduledAt: ctx.now,
      });
    const interval = INTERVAL[payload.cadence];
    const created = await gocardless.createSubscription({
      idempotencyKey: op.idempotencyKey,
      mandateRef: payload.mandateRef,
      amountMinor: payload.amountMinor,
      currency: payload.currency,
      intervalUnit: interval.unit,
      intervalCount: interval.count,
      startDate: payload.requestedChargeDate,
      name: `Nullshift managed service (${payload.cadence})`,
      metadata: {
        activation_id: payload.metadata.activation_id,
        arrangement_id: payload.metadata.arrangement_id,
        schedule_id: payload.metadata.schedule_id,
      },
    });
    subscriptionRef = created.subscriptionRef;
    adopted = created.adopted;
  }

  // The confirmed charge date comes from the provider resource, not from
  // what we asked for.
  const sub = await gocardless.getSubscription(subscriptionRef);
  if (!sub)
    return retry(
      `Subscription ${subscriptionRef} created but not yet readable; will confirm on retry.`
    );
  if (sub.amountMinor !== payload.amountMinor || sub.currency !== payload.currency)
    return failed(
      `Provider subscription ${subscriptionRef} has amount ${sub.amountMinor} ${sub.currency}, expected ${payload.amountMinor} ${payload.currency}.`,
      {
        kind: "duplicate_warning",
        severity: "urgent",
        title: "Provider subscription does not match the accepted schedule",
      }
    );
  const confirmed = sub.nextChargeDate ?? sub.startDate;
  if (confirmed && confirmed < payload.contractualStartDate)
    return failed(
      `Provider confirmed charge date ${confirmed} is before the contractual start ${payload.contractualStartDate}.`,
      {
        kind: "duplicate_warning",
        severity: "urgent",
        title: "Provider would collect before the contractual start",
      }
    );

  await ledger.updateActivation(activationId, {
    state: "active",
    providerSubscriptionRef: subscriptionRef,
    providerConfirmedChargeDate: confirmed,
    activatedAt: ctx.now,
  });
  await ctx.store.audit({
    action: "billing.activation_scheduled_at_provider",
    target: `service_activation:${activationId}`,
    tenantId: activation.tenantId,
    metadata: {
      provider: "gocardless",
      environment: payload.environment,
      provider_subscription_ref: subscriptionRef,
      adopted_existing: adopted,
      amount_minor: payload.amountMinor,
      currency: payload.currency,
      cadence: payload.cadence,
      contractual_start_date: payload.contractualStartDate,
      requested_charge_date: payload.requestedChargeDate,
      provider_confirmed_charge_date: confirmed,
      correlation_id: op.correlationId,
    },
  });
  return ok(adopted ? `adopted ${subscriptionRef}` : `created ${subscriptionRef}`);
};

/* ── gocardless.cancel_pending ───────────────────────────────────────────── */

const CANCELLABLE = new Set(["pending_customer_approval", "pending_submission"]);
const SUBMITTED = new Set(["submitted", "confirmed", "paid_out"]);

export const gocardlessCancelPending: Handler = async (op, ctx) => {
  const ref = subjectId(op, "collection_ref");
  if (!ref) return failed("subject.collection_ref is required.");
  const p = op.payload as Partial<CancelCollectionOperation>;
  if (p.environment && p.environment !== ctx.ports.gocardless.environment)
    return failed(
      `Operation is ${p.environment}; this worker's GoCardless port is ${ctx.ports.gocardless.environment}.`,
      {
        kind: "other",
        title: "Cancellation requested in the wrong provider environment",
      }
    );
  const { gocardless } = ctx.ports;

  const before = await gocardless.getPayment(ref);
  if (!before) return failed(`Collection ${ref} not found at the provider.`);
  const tenantId = op.subject.tenant_id ?? null;

  const confirmCancelled = async (source: "already" | "requested") => {
    await ctx.store.audit({
      action: "billing.collection_cancelled_confirmed",
      target: `collection:${gocardless.environment}:${ref}`,
      tenantId,
      metadata: {
        provider_status: "cancelled",
        source,
        obligation_id: op.subject.obligation_id ?? null,
        activation_id: op.subject.activation_id ?? null,
        correlation_id: op.correlationId,
      },
    });
    return ok(source === "already" ? "already cancelled" : "cancelled and confirmed");
  };

  if (before.status === "cancelled") return confirmCancelled("already");
  if (SUBMITTED.has(before.status))
    return failed(
      `Collection ${ref} is ${before.status} and cannot be cancelled; an over-collection needs approved handling.`,
      {
        kind: "duplicate_warning",
        severity: "urgent",
        title: "Collection already submitted; cancellation impossible",
        detail:
          "Closing a payment link is insufficient. Do not refund or write off without approval.",
      }
    );
  if (!CANCELLABLE.has(before.status))
    return retry(
      `Collection ${ref} is ${before.status}; state uncertain, confirming again later.`
    );

  const r = await gocardless.cancelPayment(ref);
  if (!r.ok)
    return retry(`Provider refused the cancellation of ${ref}; will re-read and retry.`);
  // Record only on provider confirmation.
  const after = await gocardless.getPayment(ref);
  if (after?.status === "cancelled") return confirmCancelled("requested");
  return retry(
    `Cancellation of ${ref} requested but the provider still reports ${after?.status ?? "unknown"}.`
  );
};

/* ── notify (stub) ───────────────────────────────────────────────────────── */

export const notify: Handler = async (op, ctx) => {
  const p = op.payload as {
    dedupeKey?: unknown;
    channel?: unknown;
    subject?: unknown;
    body?: unknown;
  };
  if (typeof p.dedupeKey !== "string" || typeof p.subject !== "string")
    return failed("notify payload needs dedupeKey and subject.");
  const r = await ctx.ports.notify.deliver({
    dedupeKey: p.dedupeKey,
    channel: typeof p.channel === "string" ? p.channel : "staff",
    subject: p.subject,
    body: typeof p.body === "string" ? p.body : "",
  });
  await ctx.store.audit({
    action: "ops.notify_stubbed",
    target: `notify:${p.dedupeKey}`,
    tenantId: op.subject.tenant_id ?? null,
    metadata: {
      subject: p.subject,
      delivered: r.delivered,
      stubbed: r.stubbed,
      correlation_id: op.correlationId,
    },
  });
  return ok("stubbed: no send");
};

/* ── Registry ────────────────────────────────────────────────────────────── */

export function defaultHandlers(): HandlerRegistry {
  return {
    "xero.create_invoice": xeroCreateInvoice,
    "xero.allocate_payment": xeroAllocatePayment,
    "gocardless.schedule_activation": gocardlessScheduleActivation,
    "gocardless.cancel_pending": gocardlessCancelPending,
    notify,
  };
}

export type { HandlerContext };
