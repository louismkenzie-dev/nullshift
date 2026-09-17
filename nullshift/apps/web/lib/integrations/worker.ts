/**
 * Ops worker — claims a bounded, leased batch from the outbox and runs the
 * registered handler for each operation (brief §12.4 "short database
 * transactions, stable operation keys, transactional reservation, bounded
 * retries and recovery after ambiguous remote success"; §17.2 "provider
 * timeout, rate limit and worker crash are bounded/recoverable and do not
 * strand unaudited operations").
 *
 * One `runOnce`:
 *   1. claim ≤ limit rows that are queued-and-due or leased-and-expired
 *      (the store's claim is UPDATE … WHERE … FOR UPDATE SKIP LOCKED …
 *      RETURNING with a lease; attempts is consumed at claim);
 *   2. run the handler; classify the result:
 *        succeeded → state succeeded
 *        retry     → queued again at now + exponential backoff
 *        failed    → dead_letter immediately (permanent) + finance exception
 *      a throw is `retry` with a sanitised message; ProviderError kinds
 *      `rejected` / `unconfigured` are permanent, `outage` is retry;
 *   3. once attempts ≥ max_attempts a retry becomes dead_letter and opens a
 *      finance_exceptions row (0065) with an owner-visible title, the
 *      correlation id and the sanitised error, so a person owns it;
 *   4. every write-back is guarded by the lease owner: if the lease expired
 *      and another worker claimed the row, this worker's late result is
 *      dropped (the other run's outcome stands) and reported as `lease_lost`.
 *
 * Handlers never see the store's raw errors and never receive a row whose
 * kind they did not register for; an unknown kind is dead-lettered at once.
 */

import { flagOn } from "@/lib/flags";
import {
  planOpen,
  type ExceptionKind,
  type OpenInput,
  type SafeRetryOp,
} from "@/lib/billing/exceptions";
import { DEFAULT_BACKOFF, nextAttemptAfter, type BackoffPolicy } from "./outbox";
import {
  ProviderError,
  isOperationKind,
  type OperationRow,
  type OpsStore,
  type Ports,
} from "./types";

/* ── Handler contract ────────────────────────────────────────────────────── */

export type HandlerContext = {
  store: OpsStore;
  ports: Ports;
  /** ISO instant the run started; handlers use it instead of Date.now(). */
  now: string;
  /** YYYY-MM-DD of `now` (UTC) for gate arithmetic. */
  today: string;
  owner: string;
};

/** Override for the exception a permanent failure opens. */
export type ExceptionHint = {
  kind: ExceptionKind;
  severity?: "normal" | "urgent";
  title?: string;
  detail?: string;
  safeRetryOp?: SafeRetryOp | null;
};

export type HandlerResult =
  | { outcome: "succeeded"; note?: string }
  | { outcome: "retry"; error: string }
  | { outcome: "failed"; error: string; exception?: ExceptionHint };

export type Handler = (op: OperationRow, ctx: HandlerContext) => Promise<HandlerResult>;

export type HandlerRegistry = Partial<Record<string, Handler>>;

/* ── Sanitising errors before they are stored or shown ───────────────────── */

const SECRET_PATTERNS = [
  /bearer\s+[a-z0-9._-]+/gi,
  /(access_token|client_secret|secret|token|authorization)\s*[=:]\s*[^\s,&"']+/gi,
  /\b\d{2}-\d{2}-\d{2}\b/g, // sort codes
  /\b\d{8}\b/g, // 8-digit account numbers
];

/** Strip anything token- or bank-shaped and bound the length. */
export function sanitiseError(e: unknown, max = 300): string {
  let msg =
    e instanceof Error
      ? e.message
      : typeof e === "string"
        ? e
        : JSON.stringify(e ?? null);
  for (const p of SECRET_PATTERNS) msg = msg.replace(p, "[redacted]");
  return msg.slice(0, max);
}

/* ── Dead-letter → finance exception ─────────────────────────────────────── */

const DEAD_LETTER_DEFAULTS: Record<
  string,
  { kind: ExceptionKind; safeRetryOp: SafeRetryOp | null; severity: "normal" | "urgent" }
> = {
  "xero.create_invoice": {
    kind: "xero_outage",
    safeRetryOp: "xero_create_invoice",
    severity: "normal",
  },
  "xero.allocate_payment": {
    kind: "xero_outage",
    safeRetryOp: "xero_allocate_payment",
    severity: "normal",
  },
  "gocardless.schedule_activation": {
    kind: "missing_activation_gate",
    safeRetryOp: null,
    severity: "normal",
  },
  "gocardless.cancel_pending": {
    kind: "duplicate_warning",
    safeRetryOp: null,
    severity: "urgent",
  },
  notify: { kind: "other", safeRetryOp: null, severity: "normal" },
};

/** The finance_exceptions row a dead-lettered operation opens. Pure. */
export function deadLetterException(
  op: OperationRow,
  error: string,
  hint?: ExceptionHint
): OpenInput {
  const d = DEAD_LETTER_DEFAULTS[op.kind] ?? {
    kind: "other" as const,
    safeRetryOp: null,
    severity: "normal" as const,
  };
  const kind = hint?.kind ?? d.kind;
  return {
    tenantId: op.subject.tenant_id ?? null,
    kind,
    severity: hint?.severity ?? d.severity,
    title:
      hint?.title ??
      `${op.kind} dead-lettered after ${op.attempts} attempt${op.attempts === 1 ? "" : "s"}`,
    detail: `${hint?.detail ? `${hint.detail} ` : ""}Last error: ${error}. Correlation: ${op.correlationId ?? op.idempotencyKey}.`,
    obligationId: op.subject.obligation_id ?? null,
    invoiceId: op.subject.invoice_id ?? null,
    activationId: op.subject.activation_id ?? null,
    // One open exception per dead-lettered operation.
    externalRef: op.idempotencyKey,
    safeRetryOp: hint?.safeRetryOp === undefined ? d.safeRetryOp : hint.safeRetryOp,
  };
}

/* ── runOnce ─────────────────────────────────────────────────────────────── */

export type RunOnceArgs = {
  store: OpsStore;
  ports: Ports;
  handlers: HandlerRegistry;
  owner: string;
  now?: string;
  limit?: number;
  leaseMs?: number;
  backoff?: BackoffPolicy;
};

export type OperationOutcome = {
  id: string;
  kind: string;
  key: string;
  outcome: "succeeded" | "retry" | "dead_letter" | "lease_lost" | "unknown_kind";
  attempts: number;
  error?: string;
  nextAttemptAt?: string;
  exceptionId?: string | null;
};

export type RunOnceSummary = {
  owner: string;
  now: string;
  claimed: number;
  succeeded: number;
  retried: number;
  deadLettered: number;
  leaseLost: number;
  results: OperationOutcome[];
  skipped?: "flag_off";
};

export const DEFAULT_LEASE_MS = 5 * 60 * 1000;

export async function runOnce(args: RunOnceArgs): Promise<RunOnceSummary> {
  const now = args.now ?? new Date().toISOString();
  const summary: RunOnceSummary = {
    owner: args.owner,
    now,
    claimed: 0,
    succeeded: 0,
    retried: 0,
    deadLettered: 0,
    leaseLost: 0,
    results: [],
  };
  if (!flagOn("integrationWorkers")) return { ...summary, skipped: "flag_off" };

  const limit = Math.max(1, Math.min(100, args.limit ?? 25));
  const leaseMs = Math.max(30_000, args.leaseMs ?? DEFAULT_LEASE_MS);
  const leaseUntil = new Date(new Date(now).getTime() + leaseMs).toISOString();
  const claimed = await args.store.claimOperations({
    owner: args.owner,
    limit,
    now,
    leaseUntil,
  });
  summary.claimed = claimed.length;

  const ctx: HandlerContext = {
    store: args.store,
    ports: args.ports,
    now,
    today: now.slice(0, 10),
    owner: args.owner,
  };

  for (const op of claimed) {
    const outcome = await runOne(op, ctx, args.handlers, args.backoff ?? DEFAULT_BACKOFF);
    summary.results.push(outcome);
    if (outcome.outcome === "succeeded") summary.succeeded += 1;
    else if (outcome.outcome === "retry") summary.retried += 1;
    else if (outcome.outcome === "dead_letter" || outcome.outcome === "unknown_kind")
      summary.deadLettered += 1;
    else if (outcome.outcome === "lease_lost") summary.leaseLost += 1;
  }
  return summary;
}

async function runOne(
  op: OperationRow,
  ctx: HandlerContext,
  handlers: HandlerRegistry,
  backoff: BackoffPolicy
): Promise<OperationOutcome> {
  const base = {
    id: op.id,
    kind: op.kind,
    key: op.idempotencyKey,
    attempts: op.attempts,
  };
  const handler = isOperationKind(op.kind) ? handlers[op.kind] : undefined;

  if (!handler) {
    const error = `No handler registered for kind "${op.kind}".`;
    const exceptionId = await deadLetter(op, ctx, error);
    return { ...base, outcome: "unknown_kind", error, exceptionId };
  }

  let result: HandlerResult;
  try {
    result = await handler(op, ctx);
  } catch (e) {
    const error = sanitiseError(e);
    if (e instanceof ProviderError && e.kind !== "outage")
      result = { outcome: "failed", error };
    else result = { outcome: "retry", error };
  }

  if (result.outcome === "succeeded") {
    const kept = await ctx.store.completeOperation(op.id, ctx.owner, {
      state: "succeeded",
      succeededAt: ctx.now,
      lastError: null,
    });
    if (!kept) return { ...base, outcome: "lease_lost" };
    await ctx.store.audit({
      action: "ops.operation_succeeded",
      target: `integration_operation:${op.id}`,
      tenantId: op.subject.tenant_id ?? null,
      metadata: {
        kind: op.kind,
        key: op.idempotencyKey,
        attempts: op.attempts,
        note: result.note ?? null,
        correlation_id: op.correlationId,
      },
    });
    return { ...base, outcome: "succeeded" };
  }

  if (result.outcome === "failed" || op.attempts >= op.maxAttempts) {
    const error = sanitiseError(result.error);
    const exceptionId = await deadLetter(
      op,
      ctx,
      error,
      result.outcome === "failed" ? result.exception : undefined
    );
    if (exceptionId === undefined) return { ...base, outcome: "lease_lost", error };
    return { ...base, outcome: "dead_letter", error, exceptionId };
  }

  const nextAttemptAt = nextAttemptAfter(ctx.now, op.attempts, backoff);
  const error = sanitiseError(result.error);
  const kept = await ctx.store.completeOperation(op.id, ctx.owner, {
    state: "queued",
    nextAttemptAt,
    lastError: error,
  });
  if (!kept) return { ...base, outcome: "lease_lost", error };
  await ctx.store.audit({
    action: "ops.operation_retry_scheduled",
    target: `integration_operation:${op.id}`,
    tenantId: op.subject.tenant_id ?? null,
    metadata: {
      kind: op.kind,
      key: op.idempotencyKey,
      attempts: op.attempts,
      max_attempts: op.maxAttempts,
      next_attempt_at: nextAttemptAt,
      error,
      correlation_id: op.correlationId,
    },
  });
  return { ...base, outcome: "retry", error, nextAttemptAt };
}

/** Park the row and open the owned exception. `undefined` = lease lost. */
async function deadLetter(
  op: OperationRow,
  ctx: HandlerContext,
  error: string,
  hint?: ExceptionHint
): Promise<string | null | undefined> {
  const kept = await ctx.store.completeOperation(op.id, ctx.owner, {
    state: "dead_letter",
    lastError: error,
  });
  if (!kept) return undefined;
  const plan = planOpen(deadLetterException(op, error, hint));
  let exceptionId: string | null = null;
  if (plan.ok) {
    const opened = await ctx.store.openException(plan.row);
    exceptionId = opened.ok ? opened.id : null;
  }
  await ctx.store.audit({
    action: "ops.operation_dead_lettered",
    target: `integration_operation:${op.id}`,
    tenantId: op.subject.tenant_id ?? null,
    metadata: {
      kind: op.kind,
      key: op.idempotencyKey,
      attempts: op.attempts,
      max_attempts: op.maxAttempts,
      error,
      exception_id: exceptionId,
      exception_problems: plan.ok ? null : plan.problems,
      correlation_id: op.correlationId,
    },
  });
  return exceptionId;
}
