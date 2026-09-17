/**
 * Finance exceptions — pure rules and flag-gated staff actions behind
 * migration 0065 (brief §5.6 Exceptions: "each has owner, attempt history,
 * safe retry and resolution evidence. A retry must say what it will do; it
 * must not accidentally charge again while retrying an accounting sync";
 * §3.3 #6–#7; §10.2 "create an urgent owned exception"; §10.3 "show and
 * retry the closure. Do not hide a remaining double-payment risk behind
 * Paid"; §17.2 "mark-paid plus payment-link-close failure becomes a visible
 * exception until resolved").
 *
 *  PURE (unit-tested, no I/O)
 *   - `SAFE_RETRY_OPS` — the closed list of operations a retry may propose.
 *     Every entry is an accounting, linkage, state-refresh or consent
 *     operation. None collects money; `retryNeverCollects` proves it for any
 *     name, including ones not on the list.
 *   - `proposeRetry(exception)` — what pressing "retry" WILL do, in words,
 *     plus the operation payload a worker would execute. Never executes.
 *   - `planOpen`, `planAssign`, `planAttempt`, `planResolve` — the state
 *     machine: open → in_progress → resolved; resolved is terminal; attempts
 *     are append-only; resolving needs evidence.
 *
 *  ACTIONS (server, behind `billingActivation`)
 *   - `openException`, `assignException`, `proposeExceptionRetry`,
 *     `resolveException` — requireStaff() → flag → not a preview session →
 *     read → tenant check → guarded update → audit_log.
 *
 * Nothing here calls a provider or moves money. `proposeExceptionRetry`
 * records the proposal as an attempt and returns the operation for the
 * worker (a sibling task); the collection rails are not reachable from it.
 */

import { createClient } from "@nullshift/db";
import { requireStaff } from "@nullshift/auth/guards";
import { logAudit } from "@nullshift/db/audit";
import { flagOn } from "@/lib/flags";
import { isClientPreview } from "@/lib/clientPreview";
import { isUuid } from "./obligations";

/* ── Vocabulary (mirrors the 0065 CHECK constraints) ─────────────────────── */

export const EXCEPTION_KINDS = [
  "missing_consent",
  "cancelled_mandate",
  "failed_collection",
  "xero_outage",
  "duplicate_warning",
  "balance_mismatch",
  "link_closure_failed",
  "unmatched_payout",
  "missing_activation_gate",
  "other",
] as const;
export type ExceptionKind = (typeof EXCEPTION_KINDS)[number];

export const EXCEPTION_STATES = ["open", "in_progress", "resolved"] as const;
export type ExceptionState = (typeof EXCEPTION_STATES)[number];

export const SEVERITIES = ["normal", "urgent"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const EXCEPTION_KIND_LABEL: Record<ExceptionKind, string> = {
  missing_consent: "Missing consent",
  cancelled_mandate: "Cancelled mandate",
  failed_collection: "Failed collection",
  xero_outage: "Xero outage",
  duplicate_warning: "Duplicate warning",
  balance_mismatch: "Balance mismatch",
  link_closure_failed: "Payment-link closure failed",
  unmatched_payout: "Unmatched payout",
  missing_activation_gate: "Missing activation gate",
  other: "Other",
};

/* ── Safe retry operations ───────────────────────────────────────────────── */

export type RetryCategory = "accounting" | "linkage" | "state_refresh" | "consent";

export type SafeRetryDefinition = {
  category: RetryCategory;
  /** What the retry WILL do — shown verbatim before anyone presses it. */
  does: string;
  /** The kinds of exception this retry makes sense for. */
  appliesTo: readonly ExceptionKind[];
};

export const NEVER_TEXT =
  "Never collects, charges, refunds, schedules a collection, creates a mandate or moves money.";

/**
 * The closed list. Mirrors the CHECK on finance_exceptions.safe_retry_op.
 * Adding an entry here requires adding it to the migration too, and it must
 * pass `retryNeverCollects`.
 */
export const SAFE_RETRY_OPS = {
  xero_create_invoice: {
    category: "accounting",
    does: "Look up the invoice in Xero by our reference; create it there only if it is genuinely absent; save the Xero identity locally.",
    appliesTo: ["xero_outage", "balance_mismatch", "other"],
  },
  xero_allocate_payment: {
    does: "Record an ALREADY RECEIVED payment against the Xero invoice, checking Xero first so the same payment is never entered twice.",
    category: "accounting",
    appliesTo: ["xero_outage", "balance_mismatch", "other"],
  },
  close_payment_link: {
    category: "linkage",
    does: "Void the hosted payment link for a debt that has already been paid another way, so it cannot be paid twice. Reports if the provider refuses.",
    appliesTo: ["link_closure_failed", "duplicate_warning"],
  },
  refresh_mandate_state: {
    category: "state_refresh",
    does: "Read the mandate's current state from the provider and update our record. Read-only at the provider.",
    appliesTo: [
      "cancelled_mandate",
      "missing_consent",
      "failed_collection",
      "missing_activation_gate",
    ],
  },
  refresh_payout_state: {
    category: "state_refresh",
    does: "Read the payout's current state and lines from the provider and update our record. Read-only at the provider.",
    appliesTo: ["unmatched_payout", "balance_mismatch"],
  },
  rematch_payout: {
    category: "linkage",
    does: "Re-run the matching rules for this payout against today's open obligations and refresh the suggested match. Allocates nothing.",
    appliesTo: ["unmatched_payout", "balance_mismatch"],
  },
  recompute_balance: {
    category: "accounting",
    does: "Recompute the obligation's balance from its typed allocations and compare with Xero. Writes only the derived state.",
    appliesTo: ["balance_mismatch", "duplicate_warning", "other"],
  },
  request_consent: {
    category: "consent",
    does: "Prepare (not send) a fresh consent request for the client to authorise, for a person to review and send.",
    appliesTo: ["missing_consent", "cancelled_mandate", "missing_activation_gate"],
  },
} as const satisfies Record<string, SafeRetryDefinition>;

export type SafeRetryOp = keyof typeof SAFE_RETRY_OPS;

export const isSafeRetryOp = (s: unknown): s is SafeRetryOp =>
  typeof s === "string" && Object.prototype.hasOwnProperty.call(SAFE_RETRY_OPS, s);

/**
 * Words that mean "money moves". An operation name or description containing
 * one of these can never be a safe retry, whether or not it is on the list.
 */
const MONEY_MOVING =
  /\b(collect|collection_create|create_collection|charge|create_payment|payment_create|take_payment|debit|refund|schedule_collection|create_subscription|subscription_create|create_mandate|mandate_create|payout_create|transfer)\b/i;

/**
 * THE rule: a retry never performs collection. True when the operation is on
 * the closed list AND neither its name nor its description mentions moving
 * money. The description check catches a future entry that is mis-classified.
 */
export function retryNeverCollects(
  op: string
): { ok: true } | { ok: false; reason: string } {
  if (!isSafeRetryOp(op))
    return {
      ok: false,
      reason: `"${op}" is not on the closed list of safe retry operations.`,
    };
  if (MONEY_MOVING.test(op))
    return { ok: false, reason: `"${op}" names a money-moving operation.` };
  const def = SAFE_RETRY_OPS[op];
  if (MONEY_MOVING.test(def.does))
    return { ok: false, reason: `"${op}" describes a money-moving operation.` };
  return { ok: true };
}

/* ── Shapes (camelCase views over the 0065 rows) ─────────────────────────── */

export type Attempt = {
  at: string;
  by: string;
  action: string;
  outcome: string;
  note?: string;
};

export type ResolutionEvidence = {
  at: string;
  by: string;
  /** What kind of proof: 'provider_confirmation', 'xero_record', 'bank_line', 'approval', 'note'. */
  kind: string;
  ref?: string;
  note: string;
};

export type ExceptionRecord = {
  id: string;
  tenantId: string | null;
  kind: ExceptionKind;
  severity: Severity;
  obligationId: string | null;
  invoiceId: string | null;
  subscriptionId: string | null;
  activationId: string | null;
  externalRef: string | null;
  title: string;
  detail: string | null;
  owner: string | null;
  state: ExceptionState;
  attempts: Attempt[];
  safeRetryOp: SafeRetryOp | null;
  safeRetrySummary: string | null;
  resolutionEvidence: ResolutionEvidence[];
  openedAt: string;
  resolvedAt: string | null;
};

export type Problem = { code: string; detail: string };

/* ── Retry proposal ──────────────────────────────────────────────────────── */

export type RetryOperation = {
  kind: `retry.${SafeRetryOp}`;
  /** Stable per (exception, attempt number) so a double-press is one attempt. */
  idempotencyKey: string;
  executeIn: "worker";
  exceptionId: string;
  op: SafeRetryOp;
  category: RetryCategory;
  subject: {
    obligationId: string | null;
    invoiceId: string | null;
    subscriptionId: string | null;
    activationId: string | null;
    externalRef: string | null;
  };
  movesMoney: false;
};

export type RetryProposal =
  | {
      allowed: true;
      op: SafeRetryOp;
      /** "Will: …" — shown before the button. */
      summary: string;
      never: typeof NEVER_TEXT;
      operation: RetryOperation;
      attemptNo: number;
    }
  | { allowed: false; reason: string; never: typeof NEVER_TEXT };

/**
 * What a retry of this exception would do. Refuses when the exception is
 * resolved, has no safe retry, names an operation that is not on the closed
 * list, or names one that does not apply to its kind.
 */
export function proposeRetry(
  e: Pick<
    ExceptionRecord,
    | "id"
    | "kind"
    | "state"
    | "safeRetryOp"
    | "safeRetrySummary"
    | "attempts"
    | "obligationId"
    | "invoiceId"
    | "subscriptionId"
    | "activationId"
    | "externalRef"
  >
): RetryProposal {
  if (e.state === "resolved")
    return {
      allowed: false,
      reason: "The exception is resolved; open a new one if it recurs.",
      never: NEVER_TEXT,
    };
  if (!e.safeRetryOp)
    return {
      allowed: false,
      reason: "This exception has no safe retry; it needs a person.",
      never: NEVER_TEXT,
    };
  const safe = retryNeverCollects(e.safeRetryOp);
  if (!safe.ok) return { allowed: false, reason: safe.reason, never: NEVER_TEXT };
  const def = SAFE_RETRY_OPS[e.safeRetryOp];
  if (!(def.appliesTo as readonly ExceptionKind[]).includes(e.kind))
    return {
      allowed: false,
      reason: `${e.safeRetryOp} does not apply to a ${EXCEPTION_KIND_LABEL[e.kind].toLowerCase()} exception.`,
      never: NEVER_TEXT,
    };
  const attemptNo = e.attempts.length + 1;
  return {
    allowed: true,
    op: e.safeRetryOp,
    summary: `Will: ${e.safeRetrySummary ?? def.does}`,
    never: NEVER_TEXT,
    attemptNo,
    operation: {
      kind: `retry.${e.safeRetryOp}`,
      idempotencyKey: `exception:${e.id}:attempt:${attemptNo}`,
      executeIn: "worker",
      exceptionId: e.id,
      op: e.safeRetryOp,
      category: def.category,
      subject: {
        obligationId: e.obligationId,
        invoiceId: e.invoiceId,
        subscriptionId: e.subscriptionId,
        activationId: e.activationId,
        externalRef: e.externalRef,
      },
      movesMoney: false,
    },
  };
}

/* ── State machine planners ──────────────────────────────────────────────── */

export type OpenInput = {
  tenantId: string | null;
  kind: ExceptionKind;
  severity?: Severity;
  title: string;
  detail?: string | null;
  owner?: string | null;
  obligationId?: string | null;
  invoiceId?: string | null;
  subscriptionId?: string | null;
  activationId?: string | null;
  externalRef?: string | null;
  safeRetryOp?: SafeRetryOp | null;
  safeRetrySummary?: string | null;
};

export type ExceptionInsert = {
  tenant_id: string | null;
  kind: ExceptionKind;
  severity: Severity;
  title: string;
  detail: string | null;
  owner: string | null;
  obligation_id: string | null;
  invoice_id: string | null;
  subscription_id: string | null;
  activation_id: string | null;
  external_ref: string | null;
  state: "open";
  attempts: Attempt[];
  safe_retry_op: SafeRetryOp | null;
  safe_retry_summary: string | null;
  resolution_evidence: ResolutionEvidence[];
};

export function planOpen(
  input: OpenInput
): { ok: true; row: ExceptionInsert } | { ok: false; problems: Problem[] } {
  const problems: Problem[] = [];
  if (!EXCEPTION_KINDS.includes(input.kind))
    problems.push({ code: "kind_invalid", detail: "Unknown exception kind." });
  const severity = input.severity ?? "normal";
  if (!SEVERITIES.includes(severity))
    problems.push({
      code: "severity_invalid",
      detail: "Severity must be normal or urgent.",
    });
  const title = (input.title ?? "").trim();
  if (title.length < 3 || title.length > 200)
    problems.push({ code: "title_invalid", detail: "Title must be 3–200 characters." });
  for (const [field, v] of [
    ["tenantId", input.tenantId],
    ["obligationId", input.obligationId],
    ["invoiceId", input.invoiceId],
    ["subscriptionId", input.subscriptionId],
    ["activationId", input.activationId],
  ] as const)
    if (v !== null && v !== undefined && !isUuid(v))
      problems.push({ code: `${field}_invalid`, detail: `${field} must be a uuid.` });
  const subjects = [
    input.obligationId,
    input.invoiceId,
    input.subscriptionId,
    input.activationId,
    input.externalRef,
  ].filter(Boolean);
  if (subjects.length === 0)
    problems.push({
      code: "subject_missing",
      detail:
        "An exception must reference an obligation, invoice, subscription, activation or external reference.",
    });
  if (input.safeRetryOp) {
    const safe = retryNeverCollects(input.safeRetryOp);
    if (!safe.ok) problems.push({ code: "retry_unsafe", detail: safe.reason });
    else if (
      !(SAFE_RETRY_OPS[input.safeRetryOp].appliesTo as readonly ExceptionKind[]).includes(
        input.kind
      )
    )
      problems.push({
        code: "retry_not_applicable",
        detail: `${input.safeRetryOp} does not apply to ${input.kind}.`,
      });
  }
  if (problems.length) return { ok: false, problems };
  return {
    ok: true,
    row: {
      tenant_id: input.tenantId ?? null,
      kind: input.kind,
      severity,
      title,
      detail: input.detail?.trim() || null,
      owner: input.owner?.trim() || null,
      obligation_id: input.obligationId ?? null,
      invoice_id: input.invoiceId ?? null,
      subscription_id: input.subscriptionId ?? null,
      activation_id: input.activationId ?? null,
      external_ref: input.externalRef?.trim() || null,
      state: "open",
      attempts: [],
      safe_retry_op: input.safeRetryOp ?? null,
      safe_retry_summary: input.safeRetryOp
        ? input.safeRetrySummary?.trim() || SAFE_RETRY_OPS[input.safeRetryOp].does
        : null,
      resolution_evidence: [],
    },
  };
}

export type Transition<T> = { ok: true; patch: T } | { ok: false; reason: string };

/** Assign an owner; an unowned or open row moves to in_progress. */
export function planAssign(
  e: Pick<ExceptionRecord, "state" | "owner">,
  owner: string
): Transition<{ owner: string; state: ExceptionState }> {
  const o = owner.trim();
  if (!o) return { ok: false, reason: "An owner is required." };
  if (e.state === "resolved")
    return { ok: false, reason: "A resolved exception cannot be reassigned." };
  return { ok: true, patch: { owner: o, state: "in_progress" } };
}

/** Append an attempt (append-only: the existing history is returned unchanged in front). */
export function planAttempt(
  e: Pick<ExceptionRecord, "state" | "attempts">,
  attempt: Attempt
): Transition<{ attempts: Attempt[]; state: ExceptionState }> {
  if (e.state === "resolved")
    return { ok: false, reason: "A resolved exception takes no further attempts." };
  if (!attempt.at || !attempt.by || !attempt.action || !attempt.outcome)
    return { ok: false, reason: "An attempt needs at, by, action and outcome." };
  return {
    ok: true,
    patch: { attempts: [...e.attempts, attempt], state: "in_progress" },
  };
}

/** Resolve with evidence. No evidence, no resolution (the 0065 trigger agrees). */
export function planResolve(
  e: Pick<ExceptionRecord, "state" | "resolutionEvidence">,
  evidence: ResolutionEvidence
): Transition<{
  state: "resolved";
  resolved_at: string;
  resolution_evidence: ResolutionEvidence[];
}> {
  if (e.state === "resolved") return { ok: false, reason: "Already resolved." };
  if (!evidence.at || !evidence.by || !evidence.kind || !evidence.note?.trim())
    return { ok: false, reason: "Resolution evidence needs at, by, kind and a note." };
  return {
    ok: true,
    patch: {
      state: "resolved",
      resolved_at: evidence.at,
      resolution_evidence: [...e.resolutionEvidence, evidence],
    },
  };
}

/* ── Row mapping ─────────────────────────────────────────────────────────── */

type Row = {
  id: string;
  tenant_id: string | null;
  kind: ExceptionKind;
  severity: Severity;
  obligation_id: string | null;
  invoice_id: string | null;
  subscription_id: string | null;
  activation_id: string | null;
  external_ref: string | null;
  title: string;
  detail: string | null;
  owner: string | null;
  state: ExceptionState;
  attempts: Attempt[] | null;
  safe_retry_op: string | null;
  safe_retry_summary: string | null;
  resolution_evidence: ResolutionEvidence[] | null;
  opened_at: string;
  resolved_at: string | null;
};

export function fromRow(r: Row): ExceptionRecord {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    kind: r.kind,
    severity: r.severity,
    obligationId: r.obligation_id,
    invoiceId: r.invoice_id,
    subscriptionId: r.subscription_id,
    activationId: r.activation_id,
    externalRef: r.external_ref,
    title: r.title,
    detail: r.detail,
    owner: r.owner,
    state: r.state,
    attempts: Array.isArray(r.attempts) ? r.attempts : [],
    safeRetryOp: isSafeRetryOp(r.safe_retry_op) ? r.safe_retry_op : null,
    safeRetrySummary: r.safe_retry_summary,
    resolutionEvidence: Array.isArray(r.resolution_evidence) ? r.resolution_evidence : [],
    openedAt: r.opened_at,
    resolvedAt: r.resolved_at,
  };
}

/* ── Server actions (flag `billingActivation`) ───────────────────────────── */

export type ExceptionFailure =
  | "flag_off"
  | "unauthenticated"
  | "forbidden"
  | "preview"
  | "invalid"
  | "not_found"
  | "wrong_tenant"
  | "not_allowed"
  | "duplicate"
  | "db_error";

export type ExceptionActionResult =
  | { ok: true; exception: ExceptionRecord; message: string; proposal?: RetryProposal }
  | { ok: false; reason: ExceptionFailure; message: string; problems?: Problem[] };

const TABLE = "finance_exceptions";

async function gate(): Promise<
  | { ok: true; userId: string; email: string }
  | { ok: false; reason: ExceptionFailure; message: string }
> {
  const staff = await requireStaff();
  if (!staff.ok)
    return {
      ok: false,
      reason: staff.reason,
      message: staff.reason === "unauthenticated" ? "Sign in as staff." : "Staff only.",
    };
  if (!flagOn("billingActivation"))
    return {
      ok: false,
      reason: "flag_off",
      message:
        "Flag billingActivation is off — finance exceptions are not persisted; nothing was written.",
    };
  if (await isClientPreview())
    return {
      ok: false,
      reason: "preview",
      message: "Client preview sessions are read-only; nothing was written.",
    };
  return { ok: true, userId: staff.userId, email: staff.email };
}

async function loadException(
  id: string,
  tenantId: string | null | undefined
): Promise<
  | { ok: true; exception: ExceptionRecord }
  | { ok: false; reason: ExceptionFailure; message: string }
> {
  if (!isUuid(id))
    return { ok: false, reason: "invalid", message: "A valid exception id is required." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) return { ok: false, reason: "db_error", message: error.message };
  if (!data) return { ok: false, reason: "not_found", message: "Exception not found." };
  const exception = fromRow(data as Row);
  // Tenant check: a client-scoped call may only touch its own client's rows.
  if (tenantId && exception.tenantId && exception.tenantId !== tenantId)
    return {
      ok: false,
      reason: "wrong_tenant",
      message: "That exception belongs to a different client.",
    };
  return { ok: true, exception };
}

/** Open an exception. One open row per (kind, subject); a repeat is reported as duplicate. */
export async function openException(input: OpenInput): Promise<ExceptionActionResult> {
  "use server";
  const g = await gate();
  if (!g.ok) return g;
  const plan = planOpen(input);
  if (!plan.ok)
    return {
      ok: false,
      reason: "invalid",
      message: "The exception is invalid.",
      problems: plan.problems,
    };

  const supabase = await createClient();
  if (plan.row.tenant_id) {
    const { data: tenant } = await supabase
      .from("tenants")
      .select("id")
      .eq("id", plan.row.tenant_id)
      .maybeSingle();
    if (!tenant) return { ok: false, reason: "not_found", message: "Client not found." };
  }
  if (plan.row.obligation_id) {
    const { data: o } = await supabase
      .from("billing_obligations")
      .select("id, tenant_id")
      .eq("id", plan.row.obligation_id)
      .maybeSingle();
    if (!o) return { ok: false, reason: "not_found", message: "Obligation not found." };
    if (plan.row.tenant_id && o.tenant_id !== plan.row.tenant_id)
      return {
        ok: false,
        reason: "wrong_tenant",
        message: "That obligation belongs to a different client.",
      };
  }
  if (plan.row.invoice_id) {
    const { data: inv } = await supabase
      .from("invoices")
      .select("id, tenant_id")
      .eq("id", plan.row.invoice_id)
      .maybeSingle();
    if (!inv) return { ok: false, reason: "not_found", message: "Invoice not found." };
    if (plan.row.tenant_id && inv.tenant_id !== plan.row.tenant_id)
      return {
        ok: false,
        reason: "wrong_tenant",
        message: "That invoice belongs to a different client.",
      };
  }

  const { data, error } = await supabase
    .from(TABLE)
    .insert({ ...plan.row, created_by: g.userId })
    .select("*")
    .single();
  if (error || !data) {
    if (error && (error.code === "23505" || /duplicate key|unique/i.test(error.message)))
      return {
        ok: false,
        reason: "duplicate",
        message: "An open exception of this kind already exists for this subject.",
      };
    return { ok: false, reason: "db_error", message: error?.message ?? "Insert failed." };
  }
  const exception = fromRow(data as Row);
  await logAudit({
    action: "finance_exception.opened",
    target: `finance_exception:${exception.id}`,
    tenantId: exception.tenantId,
    metadata: {
      kind: exception.kind,
      severity: exception.severity,
      title: exception.title,
      obligation_id: exception.obligationId,
      invoice_id: exception.invoiceId,
      subscription_id: exception.subscriptionId,
      activation_id: exception.activationId,
      external_ref: exception.externalRef,
      safe_retry_op: exception.safeRetryOp,
    },
  });
  return {
    ok: true,
    exception,
    message: `${EXCEPTION_KIND_LABEL[exception.kind]} exception opened.`,
  };
}

/** Assign an owner. */
export async function assignException(args: {
  id: string;
  tenantId?: string | null;
  owner: string;
}): Promise<ExceptionActionResult> {
  "use server";
  const g = await gate();
  if (!g.ok) return g;
  const loaded = await loadException(args.id, args.tenantId);
  if (!loaded.ok) return loaded;
  const plan = planAssign(loaded.exception, args.owner);
  if (!plan.ok) return { ok: false, reason: "not_allowed", message: plan.reason };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from(TABLE)
    .update(plan.patch)
    .eq("id", loaded.exception.id)
    .neq("state", "resolved")
    .select("*")
    .maybeSingle();
  if (error) return { ok: false, reason: "db_error", message: error.message };
  if (!data)
    return {
      ok: false,
      reason: "not_allowed",
      message: "The exception was resolved underneath you; reload.",
    };
  const exception = fromRow(data as Row);
  await logAudit({
    action: "finance_exception.assigned",
    target: `finance_exception:${exception.id}`,
    tenantId: exception.tenantId,
    metadata: { owner: plan.patch.owner, previous_owner: loaded.exception.owner },
  });
  return { ok: true, exception, message: `Assigned to ${plan.patch.owner}.` };
}

/**
 * Propose the safe retry: records an attempt "retry_proposed" and returns the
 * worker operation. Does NOT execute it and cannot reach a collection rail —
 * the operation carries `movesMoney: false` by type.
 */
export async function proposeExceptionRetry(args: {
  id: string;
  tenantId?: string | null;
}): Promise<ExceptionActionResult> {
  "use server";
  const g = await gate();
  if (!g.ok) return g;
  const loaded = await loadException(args.id, args.tenantId);
  if (!loaded.ok) return loaded;
  const proposal = proposeRetry(loaded.exception);
  if (!proposal.allowed)
    return { ok: false, reason: "not_allowed", message: proposal.reason };

  const attempt: Attempt = {
    at: new Date().toISOString(),
    by: g.email || g.userId,
    action: `retry_proposed:${proposal.op}`,
    outcome: "queued_for_worker",
    note: proposal.summary,
  };
  const plan = planAttempt(loaded.exception, attempt);
  if (!plan.ok) return { ok: false, reason: "not_allowed", message: plan.reason };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from(TABLE)
    .update(plan.patch)
    .eq("id", loaded.exception.id)
    .neq("state", "resolved")
    .select("*")
    .maybeSingle();
  if (error) return { ok: false, reason: "db_error", message: error.message };
  if (!data)
    return {
      ok: false,
      reason: "not_allowed",
      message: "The exception was resolved underneath you; reload.",
    };
  const exception = fromRow(data as Row);
  await logAudit({
    action: "finance_exception.retry_proposed",
    target: `finance_exception:${exception.id}`,
    tenantId: exception.tenantId,
    metadata: {
      op: proposal.op,
      idempotency_key: proposal.operation.idempotencyKey,
      attempt_no: proposal.attemptNo,
      summary: proposal.summary,
      moves_money: false,
    },
  });
  return { ok: true, exception, proposal, message: proposal.summary };
}

/** Resolve with evidence. */
export async function resolveException(args: {
  id: string;
  tenantId?: string | null;
  evidence: Omit<ResolutionEvidence, "at" | "by">;
}): Promise<ExceptionActionResult> {
  "use server";
  const g = await gate();
  if (!g.ok) return g;
  const loaded = await loadException(args.id, args.tenantId);
  if (!loaded.ok) return loaded;
  const evidence: ResolutionEvidence = {
    ...args.evidence,
    at: new Date().toISOString(),
    by: g.email || g.userId,
  };
  const plan = planResolve(loaded.exception, evidence);
  if (!plan.ok) return { ok: false, reason: "not_allowed", message: plan.reason };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from(TABLE)
    .update({ ...plan.patch, resolved_by: g.userId })
    .eq("id", loaded.exception.id)
    .neq("state", "resolved")
    .select("*")
    .maybeSingle();
  if (error) return { ok: false, reason: "db_error", message: error.message };
  if (!data)
    return {
      ok: false,
      reason: "not_allowed",
      message: "The exception was already resolved.",
    };
  const exception = fromRow(data as Row);
  await logAudit({
    action: "finance_exception.resolved",
    target: `finance_exception:${exception.id}`,
    tenantId: exception.tenantId,
    metadata: {
      evidence_kind: evidence.kind,
      evidence_ref: evidence.ref ?? null,
      note: evidence.note,
    },
  });
  return { ok: true, exception, message: "Exception resolved with evidence." };
}
