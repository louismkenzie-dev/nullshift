/**
 * GoCardless inbox processing — from a stored event to ledger effects,
 * deriving state from AUTHORITATIVE RESOURCE READS rather than the event
 * body or its order (brief §10.2 "derive state from authoritative resource
 * state … not only the last event received"; §3.3 #2; §17.2 duplicate,
 * out-of-order and sandbox rows).
 *
 *   billing_requests.*   → fetch the billing request and its mandate →
 *                          `recordMandateFromEvent` → ONE mandates row.
 *                          NEVER a subscription, never an activation. A
 *                          legacy pending row (arrangement_id null) is not
 *                          activated either: an owned exception says so
 *                          (Phase 0 N-i: never automatic).
 *   mandates.*           → fetch the mandate → mandate row (terminal states
 *                          sticky; replacement needs the successor). A live
 *                          activation bound to a cancelled mandate becomes
 *                          an owned exception. Legacy rows mirror status.
 *   subscriptions.*      → provider cancellation is recorded on the
 *                          activation; legacy rows mirror status.
 *   payments.*           → fetch the payment; confirmed | paid_out record ONE
 *                          provider_payment + ONE allocation against the
 *                          period's obligation (idempotent by provider ref)
 *                          and queue the Xero allocation; failed after a
 *                          recorded payment is a typed bank_return; charged
 *                          back is a typed chargeback; nothing is deleted.
 *                          Legacy rows mirror past_due / recovered and the
 *                          legacy care-plan invoice exactly as today.
 *   everything else      → ignored (acknowledged).
 *
 * Because every branch reads the current resource, confirmed / failed /
 * paid_out delivered in any order converge on the same rows, and a
 * redelivery finds its work already done. `environment` is part of every
 * lookup, so a sandbox event can only ever see sandbox rows.
 */

import { flagOn } from "@/lib/flags";
import type { Environment } from "@/lib/billing/activation";
import {
  recordMandateFromEvent,
  type ProviderMandateResource,
} from "@/lib/billing/mandates";
import { planOpen, type OpenInput } from "@/lib/billing/exceptions";
import { eventLinks, markEvent } from "./inbox";
import { opNotify, opXeroAllocatePayment, opXeroCreateInvoice } from "./outbox";
import type { EventRow, GoCardlessPort, OpsStore } from "./types";

export type ProcessContext = {
  store: OpsStore;
  gocardless: GoCardlessPort;
  now: string;
};

export type ProcessResult = {
  eventId: string;
  outcome: "processed" | "ignored" | "failed";
  note: string;
};

const PAID = new Set(["confirmed", "paid_out"]);
const NO_MONEY = new Set([
  "pending_customer_approval",
  "pending_submission",
  "submitted",
  "cancelled",
  "customer_approval_denied",
]);

async function openException(store: OpsStore, input: OpenInput): Promise<string | null> {
  const plan = planOpen(input);
  if (!plan.ok) return null;
  const r = await store.openException(plan.row);
  return r.ok ? r.id : null;
}

/** Process one stored event. Never throws; a transient failure leaves the row `failed` for the cron to retry. */
export async function processGoCardlessEvent(
  ctx: ProcessContext,
  event: EventRow
): Promise<ProcessResult> {
  if (!flagOn("integrationWorkers"))
    return { eventId: event.id, outcome: "failed", note: "integrationWorkers is off" };
  if (event.provider !== "gocardless")
    return finish(ctx, event, "ignored", "not a GoCardless event");
  if (event.environment !== ctx.gocardless.environment)
    return finish(
      ctx,
      event,
      "failed",
      `event is ${event.environment}; this processor's provider port is ${ctx.gocardless.environment}`
    );
  if (event.status === "processed" || event.status === "ignored")
    return { eventId: event.id, outcome: event.status, note: "already processed" };

  try {
    switch (event.resourceType) {
      case "billing_requests":
        return await finish(ctx, event, ...(await billingRequest(ctx, event)));
      case "mandates":
        return await finish(ctx, event, ...(await mandate(ctx, event)));
      case "subscriptions":
        return await finish(ctx, event, ...(await subscription(ctx, event)));
      case "payments":
        return await finish(ctx, event, ...(await payment(ctx, event)));
      default:
        return await finish(
          ctx,
          event,
          "ignored",
          `resource_type ${event.resourceType ?? "unknown"} has no ledger effect`
        );
    }
  } catch (e) {
    const msg = (e instanceof Error ? e.message : String(e))
      .replace(/bearer\s+\S+/gi, "[redacted]")
      .slice(0, 300);
    return finish(ctx, event, "failed", msg);
  }
}

type Outcome = ["processed" | "ignored" | "failed", string];

async function finish(
  ctx: ProcessContext,
  event: EventRow,
  outcome: Outcome[0],
  note: string
): Promise<ProcessResult> {
  await markEvent(
    ctx.store,
    event.id,
    outcome,
    ctx.now,
    outcome === "failed" ? note : null
  );
  return { eventId: event.id, outcome, note };
}

/* ── billing_requests ────────────────────────────────────────────────────── */

async function billingRequest(ctx: ProcessContext, event: EventRow): Promise<Outcome> {
  const ref = event.resourceRef;
  if (!ref) return ["ignored", "no billing_request link"];
  const br = await ctx.gocardless.getBillingRequest(ref);
  if (!br) return ["failed", `billing request ${ref} could not be read`];

  const mandateRef = br.mandateRef;
  const mandate = mandateRef ? await ctx.gocardless.getMandate(mandateRef) : null;
  const resource: ProviderMandateResource = {
    provider: "gocardless",
    environment: event.environment,
    mandateRef: mandateRef ?? null,
    billingRequestRef: ref,
    customerRef: mandate?.customerRef ?? null,
    rawStatus: mandate
      ? mandate.status
      : br.status === "fulfilled"
        ? "pending_submission"
        : "pending_customer_approval",
    fetchedAt: ctx.now,
    replacedByMandateRef: mandate?.nextMandateRef ?? null,
  };
  const saved = await saveMandate(ctx, event, resource);
  if (saved[0] !== "processed") return saved;

  // Legacy pending row for this billing request: the legacy webhook would
  // have created a subscription here. This path never does; a person decides.
  const legacy = await ctx.store.ledger.legacy.findPendingByBillingRequest(ref);
  if (legacy && br.status === "fulfilled") {
    await openException(ctx.store, {
      tenantId: legacy.tenantId,
      kind: "missing_activation_gate",
      severity: "normal",
      title:
        "Direct Debit authorised for a legacy pending plan; activation needs a decision",
      detail: `Billing request ${ref} was fulfilled while integrationWorkers is on. No subscription was created (brief §3.3 #2). Decide under Phase 0 N-i: activate through the new gates, or handle as a legacy record by hand.`,
      externalRef: `billing_request:${event.environment}:${ref}`,
      safeRetryOp: "refresh_mandate_state",
    });
    await ctx.store.insertOperation(
      opNotify({
        dedupeKey: `legacy_billing_request_fulfilled:${event.environment}:${ref}`,
        channel: "staff",
        subject: "Legacy Direct Debit authorised; no subscription created",
        body: `Billing request ${ref} fulfilled; see the finance exception.`,
        tenantId: legacy.tenantId,
        correlationId: event.id,
      }),
      ctx.now
    );
  }
  return ["processed", `${saved[1]}; subscription created: no`];
}

/* ── mandates ────────────────────────────────────────────────────────────── */

async function mandate(ctx: ProcessContext, event: EventRow): Promise<Outcome> {
  const ref = event.resourceRef;
  if (!ref) return ["ignored", "no mandate link"];
  const m = await ctx.gocardless.getMandate(ref);
  if (!m) return ["failed", `mandate ${ref} could not be read`];
  const links = eventLinks(event);
  const resource: ProviderMandateResource = {
    provider: "gocardless",
    environment: event.environment,
    mandateRef: ref,
    billingRequestRef: null,
    customerRef: m.customerRef,
    rawStatus: m.status,
    fetchedAt: ctx.now,
    replacedByMandateRef: m.nextMandateRef ?? links.new_mandate ?? null,
  };
  const saved = await saveMandate(ctx, event, resource);
  if (saved[0] !== "processed") return saved;

  const { legacy } = ctx.store.ledger;
  const terminal = [
    "cancelled",
    "expired",
    "failed",
    "blocked",
    "suspended_by_payer",
    "consumed",
  ].includes(m.status);
  if (resource.replacedByMandateRef)
    await legacy.replaceMandateRef(ref, resource.replacedByMandateRef);
  if (terminal) {
    const rows = await legacy.cancelByMandateRef(ref);
    for (const row of rows)
      await ctx.store.audit({
        action: "care_plan.dd_cancelled",
        target: `tenant:${row.tenantId}`,
        tenantId: row.tenantId,
        metadata: { mandateId: ref, cause: event.eventType, via: "inbox" },
      });

    // New model: a live activation bound to a dead mandate is a person's
    // decision, never an automatic re-mandate or shutdown.
    const stored = await ctx.store.ledger.findMandate({
      provider: "gocardless",
      environment: event.environment,
      mandateRef: ref,
    });
    const live = stored
      ? await ctx.store.ledger.findLiveActivationByMandate(stored.id)
      : null;
    if (live)
      await openException(ctx.store, {
        tenantId: live.tenantId,
        kind: "cancelled_mandate",
        severity: live.state === "active" ? "urgent" : "normal",
        title: `Mandate ${ref} is ${m.status} but activation is ${live.state}`,
        detail:
          "Collections against this activation will fail. Decide: new consent, or cancel the activation.",
        activationId: live.id,
        externalRef: `mandate:${event.environment}:${ref}`,
        safeRetryOp: "refresh_mandate_state",
      });
  }
  return ["processed", saved[1]];
}

async function saveMandate(
  ctx: ProcessContext,
  event: EventRow,
  resource: ProviderMandateResource
): Promise<Outcome> {
  const { ledger } = ctx.store;
  const existing =
    (resource.mandateRef &&
      (await ledger.findMandate({
        provider: "gocardless",
        environment: resource.environment,
        mandateRef: resource.mandateRef,
      }))) ||
    (resource.billingRequestRef &&
      (await ledger.findMandate({
        provider: "gocardless",
        environment: resource.environment,
        billingRequestRef: resource.billingRequestRef,
      }))) ||
    null;
  const successor = resource.replacedByMandateRef
    ? await ledger.findMandate({
        provider: "gocardless",
        environment: resource.environment,
        mandateRef: resource.replacedByMandateRef,
      })
    : null;
  const owner = existing?.tenantId
    ? {
        tenantId: existing.tenantId,
        consent: {
          termsVersion: existing.consentTermsVersion,
          acceptanceRef: existing.consentAcceptanceRef,
        },
      }
    : await ledger.resolveMandateOwner({
        environment: resource.environment,
        billingRequestRef:
          resource.billingRequestRef ?? existing?.billingRequestRef ?? null,
        mandateRef: resource.mandateRef,
      });

  const plan = recordMandateFromEvent({
    eventId: event.eventRef,
    resource,
    tenantId: owner.tenantId,
    consent: owner.consent,
    existing,
    successor,
  });
  if (!plan.ok) {
    if (plan.reason === "flag_off")
      return [
        "failed",
        "billingActivation is off: mandate not recorded (enable it with integrationWorkers)",
      ];
    return ["failed", `${plan.reason}: ${plan.detail}`];
  }
  if (plan.op !== "noop") await ledger.saveMandate(plan.row);
  await ctx.store.audit({
    ...plan.audit,
    metadata: { ...plan.audit.metadata, inbox_event_id: event.id },
  });
  if (plan.heldForReview && plan.op !== "noop")
    await openException(ctx.store, {
      tenantId: plan.row.tenantId,
      kind: "missing_consent",
      title: "Mandate held for review",
      detail: plan.holdReason ?? "held",
      externalRef: `mandate:${resource.environment}:${resource.mandateRef ?? resource.billingRequestRef}`,
      safeRetryOp: "request_consent",
    });
  return [
    "processed",
    `mandate ${plan.op} (${plan.row.status}${plan.heldForReview ? ", held" : ""})`,
  ];
}

/* ── subscriptions ───────────────────────────────────────────────────────── */

async function subscription(ctx: ProcessContext, event: EventRow): Promise<Outcome> {
  const ref = event.resourceRef;
  if (!ref) return ["ignored", "no subscription link"];
  const sub = await ctx.gocardless.getSubscription(ref);
  if (!sub) return ["failed", `subscription ${ref} could not be read`];
  if (!["cancelled", "finished"].includes(sub.status))
    return ["processed", `subscription ${ref} is ${sub.status}; no ledger effect`];

  const rows = await ctx.store.ledger.legacy.cancelBySubscriptionRef(ref);
  for (const row of rows)
    await ctx.store.audit({
      action: "care_plan.dd_cancelled",
      target: `tenant:${row.tenantId}`,
      tenantId: row.tenantId,
      metadata: {
        gcSubscriptionId: ref,
        cause: `subscriptions.${sub.status}`,
        via: "inbox",
      },
    });

  const activation = await ctx.store.ledger.findActivationByProviderRef(
    event.environment,
    ref
  );
  if (activation && activation.state !== "cancelled") {
    await ctx.store.ledger.updateActivation(activation.id, {
      state: "cancelled",
      cancelledAt: ctx.now,
    });
    await ctx.store.audit({
      action: "billing.activation_cancelled_at_provider",
      target: `service_activation:${activation.id}`,
      tenantId: activation.tenantId,
      metadata: {
        provider_subscription_ref: ref,
        provider_status: sub.status,
        inbox_event_id: event.id,
      },
    });
  }
  return [
    "processed",
    `subscription ${ref} ${sub.status}: legacy rows ${rows.length}, activation ${activation ? "cancelled" : "none"}`,
  ];
}

/* ── payments ────────────────────────────────────────────────────────────── */

async function payment(ctx: ProcessContext, event: EventRow): Promise<Outcome> {
  const ref = event.resourceRef;
  if (!ref) return ["ignored", "no payment link"];
  const p = await ctx.gocardless.getPayment(ref);
  if (!p) return ["failed", `payment ${ref} could not be read`];
  const { ledger } = ctx.store;
  const env: Environment = event.environment;

  // Where does this collection belong? New model first (by provider
  // subscription ref, environment-scoped), then the legacy rows.
  const activation = p.subscriptionRef
    ? await ledger.findActivationByProviderRef(env, p.subscriptionRef)
    : null;
  const obligation = activation
    ? await ledger.findObligationForCollection({ activation, chargeDate: p.chargeDate })
    : null;
  const legacy = activation
    ? null
    : await ledger.legacy.findLegacySubscription({
        subscriptionRef: p.subscriptionRef,
        mandateRef: p.mandateRef,
      });
  const tenantId = activation?.tenantId ?? legacy?.tenantId ?? null;
  const notes: string[] = [`payment ${ref} is ${p.status}`];

  const existing = await ledger.listAllocations("gocardless", ref);
  const hasPayment = existing.some((a) => a.kind === "payment");

  if (PAID.has(p.status)) {
    if (p.amountMinor <= 0) return ["processed", `${notes[0]}; zero amount`];
    // ONE provider payment per (provider, ref); idempotent.
    const pp = await ledger.recordProviderPayment({
      tenantId,
      provider: "gocardless",
      providerPaymentRef: ref,
      kind: "payment",
      amountMinor: p.amountMinor,
      currency: p.currency,
      environment: env,
      receivedAt: p.chargeDate ? `${p.chargeDate}T00:00:00.000Z` : ctx.now,
      evidence: {
        provider_status: p.status,
        subscription_ref: p.subscriptionRef,
        mandate_ref: p.mandateRef,
        inbox_event_id: event.id,
      },
    });
    if (!pp.ok) return ["failed", `provider_payment: ${pp.error.message}`];
    notes.push(
      pp.created ? "provider payment recorded" : "provider payment already recorded"
    );

    if (obligation && activation) {
      const alloc = await ledger.recordAllocation({
        tenantId: obligation.tenantId,
        obligationId: obligation.id,
        invoiceId: obligation.invoiceId,
        provider: "gocardless",
        providerPaymentRef: ref,
        kind: "payment",
        amountMinor: p.amountMinor,
        currency: p.currency,
        allocatedAt: p.chargeDate ? `${p.chargeDate}T00:00:00.000Z` : ctx.now,
        evidence: {
          provider_status: p.status,
          activation_id: activation.id,
          inbox_event_id: event.id,
        },
      });
      if (!alloc.ok) return ["failed", `allocation: ${alloc.error.message}`];
      notes.push(alloc.created ? "allocated" : "already allocated");
      if (alloc.created)
        await ctx.store.audit({
          action: "billing.collection_allocated",
          target: `billing_obligation:${obligation.id}`,
          tenantId: obligation.tenantId,
          metadata: {
            provider_payment_ref: ref,
            amount_minor: p.amountMinor,
            currency: p.currency,
            provider_status: p.status,
            allocation_id: alloc.id,
            inbox_event_id: event.id,
          },
        });
      // Accounting projection: separate, retryable operations.
      if (obligation.invoiceId) {
        if (!obligation.xeroInvoiceId)
          await ctx.store.insertOperation(
            opXeroCreateInvoice({
              invoiceId: obligation.invoiceId,
              tenantId: obligation.tenantId,
              obligationId: obligation.id,
              correlationId: event.id,
            }),
            ctx.now
          );
        await ctx.store.insertOperation(
          opXeroAllocatePayment({
            allocationId: alloc.id,
            invoiceId: obligation.invoiceId,
            obligationId: obligation.id,
            tenantId: obligation.tenantId,
            correlationId: event.id,
          }),
          ctx.now
        );
      } else {
        await openException(ctx.store, {
          tenantId: obligation.tenantId,
          kind: "balance_mismatch",
          title: "Collection received for an obligation with no issued invoice",
          detail: `Payment ${ref} (${p.amountMinor} ${p.currency}) is allocated to the obligation; issue the invoice so the accounting projection can follow.`,
          obligationId: obligation.id,
          externalRef: `payment:${env}:${ref}`,
          safeRetryOp: "recompute_balance",
        });
      }
    } else if (activation) {
      await openException(ctx.store, {
        tenantId: activation.tenantId,
        kind: "balance_mismatch",
        title: "Collection received with no matching obligation period",
        detail: `Payment ${ref} on activation ${activation.id} (charge date ${p.chargeDate ?? "unknown"}) matches no service_period obligation. The money is recorded; allocate by hand.`,
        activationId: activation.id,
        externalRef: `payment:${env}:${ref}`,
        safeRetryOp: "recompute_balance",
      });
      notes.push("no obligation: exception opened");
    } else if (legacy) {
      // Legacy mirror: exactly what the legacy webhook does today.
      const rows = await ledger.legacy.markPaymentOutcome({
        subscriptionRef: p.subscriptionRef,
        mandateRef: p.mandateRef,
        outcome: "recovered",
      });
      await ledger.legacy.recordCarePlanPayment({
        tenantId: legacy.tenantId,
        subscriptionId: legacy.id,
        plan: legacy.plan,
        paymentId: ref,
        amountPence: p.amountMinor,
        chargeDate: p.chargeDate,
      });
      for (const row of rows)
        await ctx.store.audit({
          action: "care_plan.payment_recovered",
          target: `tenant:${row.tenantId}`,
          tenantId: row.tenantId,
          metadata: {
            paymentId: ref,
            action: p.status,
            amountPence: p.amountMinor,
            chargeDate: p.chargeDate,
            via: "inbox",
          },
        });
      notes.push(`legacy care plan invoice recorded`);
    } else {
      await openException(ctx.store, {
        tenantId: null,
        kind: "other",
        title: "Unmatched Direct Debit collection",
        detail: `Payment ${ref} (${p.amountMinor} ${p.currency}, ${p.status}) matches no activation and no legacy subscription in ${env}. The money is recorded with no client; match it by hand.`,
        externalRef: `payment:${env}:${ref}`,
        safeRetryOp: "recompute_balance",
      });
      notes.push("unmatched: exception opened");
    }
    return ["processed", notes.join("; ")];
  }

  if (p.status === "failed" || p.status === "charged_back") {
    const reversalKind = p.status === "failed" ? "bank_return" : "chargeback";
    if (legacy) {
      const rows = await ledger.legacy.markPaymentOutcome({
        subscriptionRef: p.subscriptionRef,
        mandateRef: p.mandateRef,
        outcome: "failed",
      });
      for (const row of rows)
        await ctx.store.audit({
          action: "care_plan.payment_failed",
          target: `tenant:${row.tenantId}`,
          tenantId: row.tenantId,
          metadata: {
            paymentId: ref,
            action: p.status,
            amountPence: p.amountMinor,
            chargeDate: p.chargeDate,
            via: "inbox",
          },
        });
    }
    const paid = existing.find((a) => a.kind === "payment");
    if (paid && activation) {
      // A late failure or chargeback after we recorded the money: a typed
      // reversal against the SAME obligation, never a deletion (§10.2 "do
      // not delete a failed collection and pretend it never happened").
      const pp = await ledger.recordProviderPayment({
        tenantId,
        provider: "gocardless",
        providerPaymentRef: ref,
        kind: reversalKind,
        amountMinor: paid.amountMinor,
        currency: paid.currency,
        environment: env,
        receivedAt: ctx.now,
        evidence: {
          provider_status: p.status,
          reverses_payment_ref: ref,
          inbox_event_id: event.id,
        },
      });
      if (!pp.ok)
        return ["failed", `provider_payment (${reversalKind}): ${pp.error.message}`];
      const rev = await ledger.recordAllocation({
        tenantId: activation.tenantId,
        obligationId: paid.obligationId,
        invoiceId: paid.invoiceId,
        provider: "gocardless",
        providerPaymentRef: ref,
        kind: reversalKind,
        amountMinor: paid.amountMinor,
        currency: paid.currency,
        allocatedAt: ctx.now,
        evidence: { provider_status: p.status, inbox_event_id: event.id },
      });
      if (!rev.ok)
        return ["failed", `allocation (${reversalKind}): ${rev.error.message}`];
      notes.push(
        rev.created ? `${reversalKind} recorded` : `${reversalKind} already recorded`
      );
    }
    await openException(ctx.store, {
      tenantId,
      kind: "failed_collection",
      severity: hasPayment ? "urgent" : "normal",
      title: `Direct Debit collection ${ref} ${p.status === "failed" ? "failed" : "charged back"}`,
      detail: hasPayment
        ? `The collection had been recorded as paid; a ${reversalKind} allocation now offsets it. Balance is visible; nothing was deleted.`
        : `No money was received. The obligation stays open.`,
      obligationId: paid?.obligationId ?? obligation?.id ?? null,
      activationId: activation?.id ?? null,
      externalRef: `payment:${env}:${ref}`,
      safeRetryOp: "refresh_mandate_state",
    });
    return ["processed", notes.join("; ")];
  }

  if (NO_MONEY.has(p.status)) return ["processed", `${notes[0]}; no ledger effect`];
  return ["processed", `${notes[0]}; unrecognised status, no ledger effect`];
}

/** Re-process stored events that were captured but not (successfully) processed. Bounded. */
export async function sweepUnprocessedEvents(
  ctx: ProcessContext,
  q: { limit: number; olderThanMs: number; windowMs: number }
): Promise<ProcessResult[]> {
  const nowMs = new Date(ctx.now).getTime();
  const rows = await ctx.store.listUnprocessedEvents({
    limit: q.limit,
    receivedBefore: new Date(nowMs - q.olderThanMs).toISOString(),
    receivedAfter: new Date(nowMs - q.windowMs).toISOString(),
  });
  const out: ProcessResult[] = [];
  for (const row of rows) out.push(await processGoCardlessEvent(ctx, row));
  return out;
}
