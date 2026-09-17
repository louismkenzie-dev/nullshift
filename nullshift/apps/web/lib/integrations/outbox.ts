/**
 * Outbox — enqueueing durable operations keyed by a stable idempotency key
 * (brief §12.4 "stable operation keys … bounded retries"; migration 0063
 * `integration_operations`).
 *
 * `enqueue` inserts once; a second enqueue with the same key is `exists` and
 * never creates a second unit of work. The builders below fix the key format
 * per kind so every caller (webhook processing, a staff action, an exception
 * retry) lands on the same row for the same subject.
 *
 * Backoff is exponential with a cap and no jitter by default (deterministic
 * for tests); the worker passes its own policy when it wants jitter.
 */

import { flagOn } from "@/lib/flags";
import type {
  CancelCollectionOperation,
  ScheduleCollectionOperation,
} from "@/lib/billing/activation";
import {
  DEFAULT_MAX_ATTEMPTS,
  isUniqueViolation,
  type OperationInsert,
  type OperationRow,
  type OpsStore,
  type StoreError,
} from "./types";

export type EnqueueResult =
  | { outcome: "queued"; id: string }
  | { outcome: "exists"; id: string; state: OperationRow["state"] }
  | { outcome: "flag_off" }
  | { outcome: "error"; error: StoreError };

/** Insert keyed by idempotency_key; a unique violation is `exists`, never a second row. */
export async function enqueue(
  store: OpsStore,
  op: OperationInsert,
  now: string
): Promise<EnqueueResult> {
  if (!flagOn("integrationWorkers")) return { outcome: "flag_off" };
  if (!op.idempotencyKey)
    return { outcome: "error", error: { message: "idempotency_key is required" } };
  const r = await store.insertOperation(op, now);
  if (r.ok) return { outcome: "queued", id: r.id };
  if (isUniqueViolation(r.error)) {
    const existing = await store.findOperationByKey(op.idempotencyKey);
    if (existing) return { outcome: "exists", id: existing.id, state: existing.state };
  }
  return { outcome: "error", error: r.error };
}

/* ── Backoff ─────────────────────────────────────────────────────────────── */

export type BackoffPolicy = {
  baseMs: number;
  factor: number;
  maxMs: number;
  /** 0..1 fraction of the delay added as jitter; 0 = deterministic. */
  jitter: number;
};

export const DEFAULT_BACKOFF: BackoffPolicy = {
  baseMs: 60_000, // 1 min
  factor: 2,
  maxMs: 6 * 60 * 60 * 1000, // 6 h
  jitter: 0,
};

/** Delay before attempt number `attempt` + 1, given `attempt` attempts so far (>= 1). */
export function backoffDelayMs(
  attempt: number,
  policy: BackoffPolicy = DEFAULT_BACKOFF,
  random = Math.random
): number {
  const n = Math.max(1, Math.floor(attempt));
  const raw = policy.baseMs * Math.pow(policy.factor, n - 1);
  const capped = Math.min(policy.maxMs, raw);
  if (policy.jitter <= 0) return Math.round(capped);
  return Math.round(capped + capped * policy.jitter * random());
}

export function nextAttemptAfter(
  nowISO: string,
  attempt: number,
  policy?: BackoffPolicy
): string {
  return new Date(
    new Date(nowISO).getTime() + backoffDelayMs(attempt, policy)
  ).toISOString();
}

/* ── Builders: one key format per kind ───────────────────────────────────── */

export const opKey = {
  xeroCreateInvoice: (invoiceId: string) => `xero.create_invoice:invoice:${invoiceId}`,
  xeroAllocatePayment: (allocationId: string) =>
    `xero.allocate_payment:allocation:${allocationId}`,
  notify: (dedupeKey: string) => `notify:${dedupeKey}`,
};

export function opXeroCreateInvoice(args: {
  invoiceId: string;
  tenantId: string;
  obligationId?: string | null;
  correlationId?: string | null;
}): OperationInsert {
  return {
    kind: "xero.create_invoice",
    idempotencyKey: opKey.xeroCreateInvoice(args.invoiceId),
    subject: {
      invoice_id: args.invoiceId,
      tenant_id: args.tenantId,
      obligation_id: args.obligationId ?? null,
    },
    payload: {},
    maxAttempts: DEFAULT_MAX_ATTEMPTS,
    correlationId: args.correlationId ?? null,
  };
}

export function opXeroAllocatePayment(args: {
  allocationId: string;
  invoiceId: string | null;
  obligationId: string;
  tenantId: string;
  correlationId?: string | null;
}): OperationInsert {
  return {
    kind: "xero.allocate_payment",
    idempotencyKey: opKey.xeroAllocatePayment(args.allocationId),
    subject: {
      allocation_id: args.allocationId,
      invoice_id: args.invoiceId,
      obligation_id: args.obligationId,
      tenant_id: args.tenantId,
    },
    payload: {},
    maxAttempts: DEFAULT_MAX_ATTEMPTS,
    correlationId: args.correlationId ?? null,
  };
}

/** The activation lib's operation, as an outbox row. Its key is the lib's (`activation:<id>:schedule`). */
export function opScheduleActivation(
  operation: ScheduleCollectionOperation,
  tenantId: string,
  correlationId?: string | null
): OperationInsert {
  return {
    kind: "gocardless.schedule_activation",
    idempotencyKey: operation.idempotencyKey,
    subject: { activation_id: operation.activationId, tenant_id: tenantId },
    payload: { ...operation },
    // Money-adjacent: fewer attempts, and every one re-runs the gates.
    maxAttempts: 5,
    correlationId: correlationId ?? null,
  };
}

export function opCancelPending(
  operation: CancelCollectionOperation,
  subject: {
    tenantId: string | null;
    obligationId?: string | null;
    activationId?: string | null;
  },
  correlationId?: string | null
): OperationInsert {
  return {
    kind: "gocardless.cancel_pending",
    idempotencyKey: operation.idempotencyKey,
    subject: {
      collection_ref: operation.collectionRef,
      tenant_id: subject.tenantId,
      obligation_id: subject.obligationId ?? null,
      activation_id: subject.activationId ?? null,
    },
    payload: { ...operation },
    maxAttempts: 5,
    correlationId: correlationId ?? null,
  };
}

export function opNotify(args: {
  dedupeKey: string;
  channel: "staff";
  subject: string;
  body: string;
  tenantId?: string | null;
  correlationId?: string | null;
}): OperationInsert {
  return {
    kind: "notify",
    idempotencyKey: opKey.notify(args.dedupeKey),
    subject: { tenant_id: args.tenantId ?? null },
    payload: {
      dedupeKey: args.dedupeKey,
      channel: args.channel,
      subject: args.subject,
      body: args.body,
    },
    maxAttempts: 3,
    correlationId: args.correlationId ?? null,
  };
}
