/**
 * Billing obligations — the pure rules and the flag-gated staff actions
 * behind migration 0062 (brief §3.3 #5–#7, §5.6 Invoices, §10.1 "one
 * commercial obligation has one stable identity", §12.3 monetary invariants,
 * §14.2 additive rollout, §17.2 milestone / rounding / partial-payment rows).
 *
 * Two halves:
 *
 *  PURE (unit-tested, no I/O)
 *   - `obligationBalance(obligation, allocations)` — payments, refunds,
 *     credits, chargebacks and bank returns are DISTINCT typed operations;
 *     the balance and the derived state (pending / issued / part_paid / paid)
 *     fall out of them. Void and disputed are human decisions and are never
 *     derived.
 *   - `planBuildMilestones`, `planServicePeriods`, `planHandoverFee` — turn
 *     an accepted commercial snapshot into the obligation rows to insert,
 *     using `allocateMilestones` so milestone totals equal the accepted
 *     amount exactly. Amounts come from the accepted snapshot, never from the
 *     live catalogue.
 *   - `issueBlockers(obligation)` — why an obligation cannot be issued yet
 *     (tax basis pending, zero amount, wrong state).
 *
 *  ACTIONS (server, behind `billingActivation`)
 *   - `createObligationsFromOrderForm`, `createObligationsFromSchedule`,
 *     `createHandoverObligation` — requireStaff() → flag → not a preview
 *     session → read the accepted record through the caller's RLS client →
 *     tenant check → plan → insert → audit_log. With the flag off every
 *     action returns `{ ok: false, reason: "flag_off" }` before touching the
 *     database. A duplicate (the 0062 unique indexes) is reported, never
 *     retried by changing a key.
 *
 * Nothing here issues an invoice, calls Xero, GoCardless or Stripe, sends an
 * email or schedules a collection. Creating an obligation records a debt's
 * identity and amount; issuing and collecting are separate, later steps.
 */

import { createClient } from "@nullshift/db";
import { requireStaff } from "@nullshift/auth/guards";
import { logAudit } from "@nullshift/db/audit";
import { flagOn } from "@/lib/flags";
import { isClientPreview } from "@/lib/clientPreview";
import { acceptedContent, type AcceptanceSnapshot } from "@/lib/legal/acceptanceSnapshot";
import {
  chargeability,
  HANDOVER_FEE_CURRENCY,
  HANDOVER_FEE_MINOR,
  type Cadence,
  type HandoverContent,
  type ScheduleContent,
} from "@/lib/legal/arrangements";
import {
  allocateMilestones,
  applyTax,
  isMinorUnits,
  isTaxPending,
  PENDING_TAX,
  type AllocationProblem,
  type MilestoneShare,
  type TaxSnapshot,
} from "./allocation";

/* ── Vocabulary (mirrors the 0062 CHECK constraints) ─────────────────────── */

export const OBLIGATION_KINDS = [
  "build_milestone",
  "handover_fee",
  "service_period",
  "grow_item",
  "one_off",
] as const;
export type ObligationKind = (typeof OBLIGATION_KINDS)[number];

export const OBLIGATION_STATES = [
  "pending",
  "issued",
  "part_paid",
  "paid",
  "void",
  "disputed",
] as const;
export type ObligationState = (typeof OBLIGATION_STATES)[number];

export const ORCHESTRATORS = [
  "xero_native",
  "nullshift_gocardless",
  "stripe",
  "manual",
] as const;
export type Orchestrator = (typeof ORCHESTRATORS)[number];

export const COLLECTION_POLICIES = [
  "invoice_terms",
  "direct_debit",
  "manual",
  "none",
] as const;
export type CollectionPolicy = (typeof COLLECTION_POLICIES)[number];

export const ALLOCATION_KINDS = [
  "payment",
  "refund",
  "credit",
  "chargeback",
  "bank_return",
] as const;
export type AllocationKind = (typeof ALLOCATION_KINDS)[number];

export const PAYMENT_PROVIDERS = [
  "gocardless",
  "stripe",
  "xero",
  "bank",
  "manual",
] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

/** States a person sets; never derived from allocations. */
export const MANUAL_STATES: readonly ObligationState[] = ["void", "disputed"];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: unknown): s is string =>
  typeof s === "string" && UUID_RE.test(s);

/* ── Shapes (camelCase views over the 0062 rows) ─────────────────────────── */

export type ObligationRecord = {
  id: string;
  tenantId: string;
  projectId: string | null;
  arrangementId: string | null;
  kind: ObligationKind;
  milestoneKey: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  amountNetMinor: number;
  taxMinor: number;
  amountGrossMinor: number;
  currency: string;
  taxCodeRef: string;
  issueAt: string | null;
  dueAt: string | null;
  collectionPolicy: CollectionPolicy;
  orchestrator: Orchestrator;
  state: ObligationState;
  label: string | null;
  sourceKind: string | null;
  sourceId: string | null;
};

export type AllocationRecord = {
  id: string;
  obligationId: string;
  invoiceId: string | null;
  provider: PaymentProvider;
  providerPaymentId: string;
  kind: AllocationKind;
  amountMinor: number;
  currency: string;
  allocatedAt: string;
};

/* ── Balance and derived state ───────────────────────────────────────────── */

export type ObligationBalance = {
  obligationId: string;
  currency: string;
  grossMinor: number;
  /** Money received against the debt. */
  paymentsMinor: number;
  /** Money returned to the client (typed, never a negative payment). */
  refundsMinor: number;
  /** Money reversed by the client's bank or card scheme. */
  chargebacksMinor: number;
  /** Money the bank returned after a collection appeared to succeed. */
  bankReturnsMinor: number;
  /** Credit notes applied — reduce the debt without money moving. */
  creditsMinor: number;
  /** payments − refunds − chargebacks − bank returns. */
  netPaidMinor: number;
  /** netPaid + credits: what has settled the debt. */
  settledMinor: number;
  /** gross − settled; negative = overpaid. */
  remainingMinor: number;
  /** max(0, −remaining): stays visible, never auto-refunded or written off. */
  overpaymentMinor: number;
  /** Allocations in another currency are excluded and listed here. */
  excluded: AllocationRecord[];
  derivedState: ObligationState;
};

const sumKind = (as: readonly AllocationRecord[], kind: AllocationKind): number =>
  as.filter((a) => a.kind === kind).reduce((t, a) => t + a.amountMinor, 0);

/**
 * Derive the state an obligation should be in from its typed allocations.
 * `void` and `disputed` are kept as set. Otherwise: fully settled → paid;
 * partly settled → part_paid; nothing settled → issued if it has been issued,
 * else pending. An overpayment is reported, not hidden, and still counts as
 * paid.
 */
export function obligationBalance(
  o: Pick<ObligationRecord, "id" | "currency" | "amountGrossMinor" | "state" | "issueAt">,
  allocations: readonly AllocationRecord[]
): ObligationBalance {
  const mine = allocations.filter((a) => a.obligationId === o.id);
  const excluded = mine.filter((a) => a.currency !== o.currency);
  const same = mine.filter((a) => a.currency === o.currency);

  const paymentsMinor = sumKind(same, "payment");
  const refundsMinor = sumKind(same, "refund");
  const chargebacksMinor = sumKind(same, "chargeback");
  const bankReturnsMinor = sumKind(same, "bank_return");
  const creditsMinor = sumKind(same, "credit");
  const netPaidMinor = paymentsMinor - refundsMinor - chargebacksMinor - bankReturnsMinor;
  const settledMinor = netPaidMinor + creditsMinor;
  const remainingMinor = o.amountGrossMinor - settledMinor;
  const overpaymentMinor = Math.max(0, -remainingMinor);

  let derivedState: ObligationState;
  if (MANUAL_STATES.includes(o.state)) derivedState = o.state;
  else if (o.amountGrossMinor > 0 && remainingMinor <= 0) derivedState = "paid";
  else if (settledMinor > 0) derivedState = "part_paid";
  else if (o.state === "issued" || o.issueAt) derivedState = "issued";
  else derivedState = "pending";

  return {
    obligationId: o.id,
    currency: o.currency,
    grossMinor: o.amountGrossMinor,
    paymentsMinor,
    refundsMinor,
    chargebacksMinor,
    bankReturnsMinor,
    creditsMinor,
    netPaidMinor,
    settledMinor,
    remainingMinor,
    overpaymentMinor,
    excluded,
    derivedState,
  };
}

/* ── Issue blockers ──────────────────────────────────────────────────────── */

export type Blocker = { code: string; detail: string };

/** Why this obligation cannot be issued as an invoice yet. Empty = may issue. */
export function issueBlockers(
  o: Pick<
    ObligationRecord,
    | "state"
    | "taxCodeRef"
    | "amountGrossMinor"
    | "amountNetMinor"
    | "taxMinor"
    | "currency"
    | "orchestrator"
  >
): Blocker[] {
  const b: Blocker[] = [];
  if (o.state !== "pending")
    b.push({
      code: "not_pending",
      detail: `Obligation is ${o.state}; only a pending obligation can be issued.`,
    });
  if (isTaxPending({ codeRef: o.taxCodeRef }))
    b.push({
      code: "tax_pending",
      detail:
        "Tax basis is pending decision (18.3 / 18.8); an invoice cannot be issued without an approved tax code.",
    });
  if (o.amountGrossMinor <= 0)
    b.push({ code: "zero_amount", detail: "Gross amount is zero." });
  if (o.amountGrossMinor !== o.amountNetMinor + o.taxMinor)
    b.push({ code: "gross_mismatch", detail: "Gross does not equal net + tax." });
  if (!/^[A-Z]{3}$/.test(o.currency))
    b.push({ code: "currency_invalid", detail: "Currency must be a three-letter code." });
  return b;
}

/* ── Date maths (YYYY-MM-DD, no timezone) ────────────────────────────────── */

const daysInMonth = (y: number, m0: number): number =>
  new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();

/** Add whole months to an ISO date, clamping the day to the target month's length. */
export function addMonths(iso: string, months: number): string {
  if (!DATE_RE.test(iso)) throw new Error(`addMonths: invalid date ${iso}`);
  const [y, m, d] = iso.split("-").map(Number);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm0 = total - ny * 12;
  const nd = Math.min(d, daysInMonth(ny, nm0));
  return `${ny}-${String(nm0 + 1).padStart(2, "0")}-${String(nd).padStart(2, "0")}`;
}

export const CADENCE_MONTHS: Record<Cadence, number> = {
  monthly: 1,
  quarterly: 3,
  annual: 12,
};

/* ── Planners ────────────────────────────────────────────────────────────── */

/** A row ready for `billing_obligations` (snake_case, as the table expects). */
export type ObligationInsert = {
  tenant_id: string;
  project_id: string | null;
  arrangement_id: string | null;
  kind: ObligationKind;
  milestone_key: string | null;
  period_start: string | null;
  period_end: string | null;
  amount_net_minor: number;
  tax_minor: number;
  amount_gross_minor: number;
  currency: string;
  tax_code_ref: string;
  issue_at: string | null;
  due_at: string | null;
  collection_policy: CollectionPolicy;
  orchestrator: Orchestrator;
  state: "pending";
  label: string;
  source_kind: string;
  source_id: string;
};

export type PlanResult =
  | { ok: true; rows: ObligationInsert[]; notes: string[] }
  | { ok: false; problems: AllocationProblem[] };

export type BuildMilestonePlan = {
  tenantId: string;
  projectId: string;
  /** The accepted record the debt comes from (Order Form id). */
  sourceKind: "order_form" | "change_order";
  sourceId: string;
  /** The accepted Build total, net of tax, in minor units. From the snapshot. */
  totalNetMinor: number;
  currency: string;
  shares: readonly MilestoneShare[];
  tax: TaxSnapshot;
  orchestrator: Orchestrator;
  collectionPolicy?: CollectionPolicy;
  /** Optional due timestamp per milestone key (ISO). */
  dueAt?: Readonly<Record<string, string>>;
};

/**
 * One obligation per milestone, amounts from `allocateMilestones` so they sum
 * to the accepted total exactly. Tax is applied per milestone from the same
 * frozen snapshot; a one-penny rounding difference between "tax on the
 * total" and "sum of tax per milestone" is reported in `notes`, never hidden.
 */
export function planBuildMilestones(p: BuildMilestonePlan): PlanResult {
  const problems: AllocationProblem[] = [];
  if (!p.tenantId)
    problems.push({ code: "tenant_missing", detail: "A client is required." });
  if (!p.projectId)
    problems.push({
      code: "project_missing",
      detail: "A build milestone belongs to a project.",
    });
  if (!p.sourceId)
    problems.push({
      code: "source_missing",
      detail: "The accepted record id is required.",
    });
  if (!/^[A-Z]{3}$/.test(p.currency))
    problems.push({
      code: "currency_invalid",
      detail: "Currency must be a three-letter code.",
    });
  if (!ORCHESTRATORS.includes(p.orchestrator))
    problems.push({
      code: "orchestrator_invalid",
      detail: "Unknown collection orchestrator.",
    });
  if (problems.length) return { ok: false, problems };

  const split = allocateMilestones(p.totalNetMinor, p.shares);
  if (!split.ok) return split;

  const rows: ObligationInsert[] = [];
  let taxSum = 0;
  for (const m of split.value.milestones) {
    const parts = applyTax(m.amountMinor, p.tax);
    if (!parts.ok) return parts;
    taxSum += parts.value.taxMinor;
    rows.push({
      tenant_id: p.tenantId,
      project_id: p.projectId,
      arrangement_id: null,
      kind: "build_milestone",
      milestone_key: m.key,
      period_start: null,
      period_end: null,
      amount_net_minor: parts.value.netMinor,
      tax_minor: parts.value.taxMinor,
      amount_gross_minor: parts.value.grossMinor,
      currency: p.currency,
      tax_code_ref: p.tax.codeRef,
      issue_at: null,
      due_at: p.dueAt?.[m.key] ?? null,
      collection_policy: p.collectionPolicy ?? "invoice_terms",
      orchestrator: p.orchestrator,
      state: "pending",
      label: `${m.label} (${(m.basisPoints / 100).toFixed(2)}%)`,
      source_kind: p.sourceKind,
      source_id: p.sourceId,
    });
  }

  const notes: string[] = [
    `Milestones sum to ${split.value.sumMinor} = accepted ${p.totalNetMinor} ${p.currency} (${split.value.rule}).`,
  ];
  const onTotal = applyTax(p.totalNetMinor, p.tax);
  if (onTotal.ok && onTotal.value.taxMinor !== taxSum)
    notes.push(
      `Tax per milestone sums to ${taxSum}; tax on the total would be ${onTotal.value.taxMinor} (rounding difference ${taxSum - onTotal.value.taxMinor}). Each invoice carries its own rounded tax.`
    );
  if (isTaxPending(p.tax))
    notes.push(
      "Tax basis is pending decision; these obligations cannot be issued until it is approved."
    );
  return { ok: true, rows, notes };
}

export type ServicePeriodPlan = {
  tenantId: string;
  projectId: string | null;
  arrangementId: string;
  /** The accepted schedule id. */
  sourceId: string;
  /** The FROZEN content read from the accepted snapshot, never the live row. */
  accepted: ScheduleContent;
  scheduleStatus: "draft" | "issued" | "accepted" | "superseded";
  documentHash: string | null;
  /** How many periods to plan from the accepted start date (1–12). */
  periods: number;
  tax: TaxSnapshot;
  orchestrator: Orchestrator;
  collectionPolicy?: CollectionPolicy;
};

/**
 * One obligation per service period from the accepted schedule's start date,
 * advancing by cadence. Stable identity is (arrangement, period_start) — the
 * 0062 unique index — so replaying the plan cannot mint a second period.
 * Refuses when the schedule is not chargeable (not accepted, inexact,
 * unverified snapshot).
 */
export function planServicePeriods(p: ServicePeriodPlan): PlanResult {
  const problems: AllocationProblem[] = [];
  if (!p.tenantId)
    problems.push({ code: "tenant_missing", detail: "A client is required." });
  if (!p.arrangementId)
    problems.push({
      code: "arrangement_missing",
      detail: "A service period belongs to an arrangement.",
    });
  if (!Number.isInteger(p.periods) || p.periods < 1 || p.periods > 12)
    problems.push({
      code: "periods_invalid",
      detail: "Plan between 1 and 12 periods at a time.",
    });
  if (!ORCHESTRATORS.includes(p.orchestrator))
    problems.push({
      code: "orchestrator_invalid",
      detail: "Unknown collection orchestrator.",
    });
  const charge = chargeability(
    { status: p.scheduleStatus, documentHash: p.documentHash },
    p.accepted
  );
  if (!charge.chargeable)
    problems.push(
      ...charge.missing.map((m) => ({
        code: `not_chargeable:${m.code}`,
        detail: m.detail,
      }))
    );
  if (problems.length || !charge.chargeable) return { ok: false, problems };

  const months = CADENCE_MONTHS[charge.cadence];
  const rows: ObligationInsert[] = [];
  let start = charge.startDate;
  for (let i = 0; i < p.periods; i += 1) {
    const end = addMonths(start, months);
    const parts = applyTax(charge.amountMinor, p.tax);
    if (!parts.ok) return parts;
    rows.push({
      tenant_id: p.tenantId,
      project_id: p.projectId,
      arrangement_id: p.arrangementId,
      kind: "service_period",
      milestone_key: null,
      period_start: start,
      period_end: end,
      amount_net_minor: parts.value.netMinor,
      tax_minor: parts.value.taxMinor,
      amount_gross_minor: parts.value.grossMinor,
      currency: charge.currency,
      tax_code_ref: p.tax.codeRef,
      issue_at: null,
      due_at: null,
      collection_policy: p.collectionPolicy ?? "direct_debit",
      orchestrator: p.orchestrator,
      state: "pending",
      label: `${p.accepted.packageCode} service period ${start} to ${end}`,
      source_kind: "service_schedule",
      source_id: p.sourceId,
    });
    start = end;
  }
  const notes = [
    `${p.periods} ${charge.cadence} period(s) at ${charge.amountMinor} ${charge.currency} net from ${charge.startDate}, amounts from the accepted snapshot.`,
  ];
  if (isTaxPending(p.tax))
    notes.push(
      "Tax basis is pending decision; these obligations cannot be issued until it is approved."
    );
  return { ok: true, rows, notes };
}

export type HandoverFeePlan = {
  tenantId: string;
  projectId: string | null;
  arrangementId: string;
  /** The accepted handover schedule id. */
  sourceId: string;
  /** Frozen content from the accepted snapshot. */
  accepted: HandoverContent;
  scheduleStatus: "draft" | "issued" | "accepted" | "superseded";
  orchestrator: Orchestrator;
};

/**
 * The £600 independent handover fee as ONE obligation, keyed 'handover' on
 * the project so it can never be minted twice. Its tax basis is
 * 'pending_decision' (brief §6.5, decision 18.3) unless the accepted content
 * carries a decided basis — and even then the code reference is the
 * caller's approved mapping, not a guess made here.
 */
export function planHandoverFee(
  p: HandoverFeePlan,
  tax: TaxSnapshot = PENDING_TAX
): PlanResult {
  const problems: AllocationProblem[] = [];
  if (!p.tenantId)
    problems.push({ code: "tenant_missing", detail: "A client is required." });
  if (!p.arrangementId)
    problems.push({
      code: "arrangement_missing",
      detail: "A handover fee belongs to an arrangement.",
    });
  if (p.scheduleStatus !== "accepted")
    problems.push({
      code: "not_accepted",
      detail: `Handover schedule is ${p.scheduleStatus}, not accepted.`,
    });
  if (!isMinorUnits(p.accepted.feeMinor) || p.accepted.feeMinor <= 0)
    problems.push({
      code: "fee_invalid",
      detail: "Accepted handover fee must be a positive integer of minor units.",
    });
  if (p.accepted.feeDisposition === "pending")
    problems.push({
      code: "fee_disposition_pending",
      detail: "Application-fee disposition after handover is undecided (18.4).",
    });
  if (!ORCHESTRATORS.includes(p.orchestrator))
    problems.push({
      code: "orchestrator_invalid",
      detail: "Unknown collection orchestrator.",
    });
  if (problems.length) return { ok: false, problems };

  const effectiveTax = p.accepted.taxBasis === "pending" ? PENDING_TAX : tax;
  const parts = applyTax(p.accepted.feeMinor, effectiveTax);
  if (!parts.ok) return parts;
  const notes: string[] = [];
  if (
    p.accepted.feeMinor !== HANDOVER_FEE_MINOR ||
    p.accepted.currency !== HANDOVER_FEE_CURRENCY
  )
    notes.push(
      `Accepted fee ${p.accepted.feeMinor} ${p.accepted.currency} differs from the standard ${HANDOVER_FEE_MINOR} ${HANDOVER_FEE_CURRENCY}; the accepted figure is used.`
    );
  if (isTaxPending(effectiveTax))
    notes.push(
      "Handover fee tax basis is pending decision (18.3); the obligation records the debt but cannot be issued."
    );
  return {
    ok: true,
    notes,
    rows: [
      {
        tenant_id: p.tenantId,
        project_id: p.projectId,
        arrangement_id: p.arrangementId,
        kind: "handover_fee",
        milestone_key: p.projectId ? "handover" : null,
        period_start: null,
        period_end: null,
        amount_net_minor: parts.value.netMinor,
        tax_minor: parts.value.taxMinor,
        amount_gross_minor: parts.value.grossMinor,
        currency: p.accepted.currency,
        tax_code_ref: effectiveTax.codeRef,
        issue_at: null,
        due_at: null,
        collection_policy: "invoice_terms",
        orchestrator: p.orchestrator,
        state: "pending",
        label: "Independent handover fee",
        source_kind: "handover_schedule",
        source_id: p.sourceId,
      },
    ],
  };
}

/* ── Server actions (flag `billingActivation`) ───────────────────────────── */

export type ObligationFailure =
  | "flag_off"
  | "unauthenticated"
  | "forbidden"
  | "preview"
  | "invalid"
  | "not_found"
  | "not_accepted"
  | "wrong_tenant"
  | "duplicate"
  | "db_error";

export type ObligationActionResult =
  | {
      ok: true;
      ids: string[];
      rows: ObligationInsert[];
      notes: string[];
      message: string;
    }
  | {
      ok: false;
      reason: ObligationFailure;
      message: string;
      problems?: AllocationProblem[];
    };

async function gate(): Promise<
  { ok: true; userId: string } | { ok: false; reason: ObligationFailure; message: string }
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
        "Flag billingActivation is off — obligations are not created; nothing was written.",
    };
  if (await isClientPreview())
    return {
      ok: false,
      reason: "preview",
      message: "Client preview sessions are read-only; nothing was written.",
    };
  return { ok: true, userId: staff.userId };
}

const isUniqueViolation = (e: { code?: string | null; message?: string }): boolean =>
  e.code === "23505" || /duplicate key|unique/i.test(e.message ?? "");

async function insertObligations(
  rows: ObligationInsert[],
  createdBy: string
): Promise<
  | { ok: true; ids: string[] }
  | { ok: false; reason: "duplicate" | "db_error"; message: string }
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("billing_obligations")
    .insert(rows.map((r) => ({ ...r, created_by: createdBy })))
    .select("id");
  if (error) {
    if (isUniqueViolation(error))
      return {
        ok: false,
        reason: "duplicate",
        message:
          "An obligation with this milestone key or period already exists for this project / arrangement; nothing was written.",
      };
    return { ok: false, reason: "db_error", message: error.message };
  }
  return { ok: true, ids: (data ?? []).map((r: { id: string }) => r.id) };
}

export type CreateFromOrderFormInput = {
  orderFormId: string;
  shares: readonly MilestoneShare[];
  tax: TaxSnapshot;
  orchestrator: Orchestrator;
  collectionPolicy?: CollectionPolicy;
  dueAt?: Readonly<Record<string, string>>;
};

/**
 * Create the build-milestone obligations for an ACCEPTED Order Form. The
 * total is the form's accepted project fee; the split is the caller's
 * milestone template (decision 18.10 — no template is assumed here).
 */
export async function createObligationsFromOrderForm(
  input: CreateFromOrderFormInput
): Promise<ObligationActionResult> {
  "use server";
  const g = await gate();
  if (!g.ok) return g;
  if (!isUuid(input.orderFormId))
    return {
      ok: false,
      reason: "invalid",
      message: "A valid Order Form id is required.",
    };

  const supabase = await createClient();
  const { data: form, error } = await supabase
    .from("order_forms")
    .select("id, tenant_id, project_id, reference, status, accepted_at, project_fee")
    .eq("id", input.orderFormId)
    .maybeSingle();
  if (error) return { ok: false, reason: "db_error", message: error.message };
  if (!form) return { ok: false, reason: "not_found", message: "Order Form not found." };
  if (form.status !== "accepted" || !form.accepted_at)
    return {
      ok: false,
      reason: "not_accepted",
      message: `Order Form ${form.reference} is ${form.status}, not accepted.`,
    };
  if (!form.project_id)
    return {
      ok: false,
      reason: "invalid",
      message: "This Order Form has no project; build milestones need one.",
    };

  const { data: project } = await supabase
    .from("projects")
    .select("id, tenant_id")
    .eq("id", form.project_id)
    .maybeSingle();
  if (!project || project.tenant_id !== form.tenant_id)
    return {
      ok: false,
      reason: "wrong_tenant",
      message: "The Order Form's project does not belong to its client.",
    };

  const fee =
    form.project_fee === null || form.project_fee === undefined
      ? null
      : Number(form.project_fee);
  if (fee === null || !Number.isFinite(fee) || fee <= 0)
    return {
      ok: false,
      reason: "invalid",
      message: "The accepted Order Form carries no project fee.",
    };
  const totalNetMinor = Math.round(fee * 100);

  const plan = planBuildMilestones({
    tenantId: form.tenant_id,
    projectId: form.project_id,
    sourceKind: "order_form",
    sourceId: form.id,
    totalNetMinor,
    currency: "GBP",
    shares: input.shares,
    tax: input.tax,
    orchestrator: input.orchestrator,
    collectionPolicy: input.collectionPolicy,
    dueAt: input.dueAt,
  });
  if (!plan.ok)
    return {
      ok: false,
      reason: "invalid",
      message: "The milestone plan is invalid.",
      problems: plan.problems,
    };

  const ins = await insertObligations(plan.rows, g.userId);
  if (!ins.ok) return ins;

  await logAudit({
    action: "billing_obligation.created_from_order_form",
    target: `order_form:${form.id}`,
    tenantId: form.tenant_id,
    metadata: {
      obligation_ids: ins.ids,
      project_id: form.project_id,
      total_net_minor: totalNetMinor,
      currency: "GBP",
      milestone_keys: plan.rows.map((r) => r.milestone_key),
      tax_code_ref: input.tax.codeRef,
      orchestrator: input.orchestrator,
      notes: plan.notes,
    },
  });
  return {
    ok: true,
    ids: ins.ids,
    rows: plan.rows,
    notes: plan.notes,
    message: `${ins.ids.length} milestone obligation(s) recorded for ${form.reference}.`,
  };
}

export type CreateFromScheduleInput = {
  scheduleId: string;
  periods: number;
  tax: TaxSnapshot;
  orchestrator: Orchestrator;
  collectionPolicy?: CollectionPolicy;
};

/**
 * Create service-period obligations for an ACCEPTED service schedule, reading
 * the amount from the verified acceptance snapshot (never the live row or the
 * catalogue).
 */
export async function createObligationsFromSchedule(
  input: CreateFromScheduleInput
): Promise<ObligationActionResult> {
  "use server";
  const g = await gate();
  if (!g.ok) return g;
  if (!isUuid(input.scheduleId))
    return { ok: false, reason: "invalid", message: "A valid schedule id is required." };

  const supabase = await createClient();
  const { data: s, error } = await supabase
    .from("service_schedules")
    .select("id, arrangement_id, status, document_snapshot, document_hash")
    .eq("id", input.scheduleId)
    .maybeSingle();
  if (error) return { ok: false, reason: "db_error", message: error.message };
  if (!s)
    return { ok: false, reason: "not_found", message: "Service schedule not found." };
  if (s.status !== "accepted")
    return {
      ok: false,
      reason: "not_accepted",
      message: `Schedule is ${s.status}, not accepted.`,
    };

  const { data: a } = await supabase
    .from("service_arrangements")
    .select("id, tenant_id, project_id, state")
    .eq("id", s.arrangement_id)
    .maybeSingle();
  if (!a)
    return { ok: false, reason: "not_found", message: "Service arrangement not found." };
  if (a.state !== "active")
    return {
      ok: false,
      reason: "not_accepted",
      message: "The arrangement is superseded; plan from its successor.",
    };

  const accepted = acceptedContent<ScheduleContent & Record<string, never>>(
    (s.document_snapshot as AcceptanceSnapshot | null) ?? null,
    s.document_hash
  );
  const plan = planServicePeriods({
    tenantId: a.tenant_id,
    projectId: a.project_id ?? null,
    arrangementId: a.id,
    sourceId: s.id,
    accepted: (accepted as ScheduleContent | null) ?? emptySchedule(),
    scheduleStatus: s.status,
    documentHash: accepted ? s.document_hash : null,
    periods: input.periods,
    tax: input.tax,
    orchestrator: input.orchestrator,
    collectionPolicy: input.collectionPolicy,
  });
  if (!plan.ok)
    return {
      ok: false,
      reason: "invalid",
      message: "The schedule is not chargeable.",
      problems: plan.problems,
    };

  const ins = await insertObligations(plan.rows, g.userId);
  if (!ins.ok) return ins;

  await logAudit({
    action: "billing_obligation.created_from_schedule",
    target: `service_schedule:${s.id}`,
    tenantId: a.tenant_id,
    metadata: {
      obligation_ids: ins.ids,
      arrangement_id: a.id,
      periods: plan.rows.map((r) => [r.period_start, r.period_end]),
      amount_net_minor: plan.rows[0]?.amount_net_minor ?? null,
      currency: plan.rows[0]?.currency ?? null,
      tax_code_ref: input.tax.codeRef,
      orchestrator: input.orchestrator,
      notes: plan.notes,
    },
  });
  return {
    ok: true,
    ids: ins.ids,
    rows: plan.rows,
    notes: plan.notes,
    message: `${ins.ids.length} service period obligation(s) recorded.`,
  };
}

export type CreateHandoverInput = {
  handoverScheduleId: string;
  orchestrator: Orchestrator;
  /** Approved tax mapping, if 18.3 has been decided; defaults to pending. */
  tax?: TaxSnapshot;
};

/** Create the handover-fee obligation for an ACCEPTED handover schedule. */
export async function createHandoverObligation(
  input: CreateHandoverInput
): Promise<ObligationActionResult> {
  "use server";
  const g = await gate();
  if (!g.ok) return g;
  if (!isUuid(input.handoverScheduleId))
    return {
      ok: false,
      reason: "invalid",
      message: "A valid handover schedule id is required.",
    };

  const supabase = await createClient();
  const { data: h, error } = await supabase
    .from("handover_schedules")
    .select("id, arrangement_id, status, document_snapshot, document_hash")
    .eq("id", input.handoverScheduleId)
    .maybeSingle();
  if (error) return { ok: false, reason: "db_error", message: error.message };
  if (!h)
    return { ok: false, reason: "not_found", message: "Handover schedule not found." };
  if (h.status !== "accepted")
    return {
      ok: false,
      reason: "not_accepted",
      message: `Handover schedule is ${h.status}, not accepted.`,
    };

  const { data: a } = await supabase
    .from("service_arrangements")
    .select("id, tenant_id, project_id, state")
    .eq("id", h.arrangement_id)
    .maybeSingle();
  if (!a)
    return { ok: false, reason: "not_found", message: "Service arrangement not found." };

  const accepted = acceptedContent<HandoverContent & Record<string, never>>(
    (h.document_snapshot as AcceptanceSnapshot | null) ?? null,
    h.document_hash
  );
  if (!accepted)
    return {
      ok: false,
      reason: "invalid",
      message:
        "The accepted snapshot is missing or fails verification; the fee cannot be read.",
    };

  const plan = planHandoverFee(
    {
      tenantId: a.tenant_id,
      projectId: a.project_id ?? null,
      arrangementId: a.id,
      sourceId: h.id,
      accepted: accepted as HandoverContent,
      scheduleStatus: h.status,
      orchestrator: input.orchestrator,
    },
    input.tax ?? PENDING_TAX
  );
  if (!plan.ok)
    return {
      ok: false,
      reason: "invalid",
      message: "The handover fee cannot be planned.",
      problems: plan.problems,
    };

  const ins = await insertObligations(plan.rows, g.userId);
  if (!ins.ok) return ins;

  await logAudit({
    action: "billing_obligation.created_handover_fee",
    target: `handover_schedule:${h.id}`,
    tenantId: a.tenant_id,
    metadata: {
      obligation_ids: ins.ids,
      arrangement_id: a.id,
      amount_net_minor: plan.rows[0]?.amount_net_minor ?? null,
      currency: plan.rows[0]?.currency ?? null,
      tax_code_ref: plan.rows[0]?.tax_code_ref ?? null,
      orchestrator: input.orchestrator,
      notes: plan.notes,
    },
  });
  return {
    ok: true,
    ids: ins.ids,
    rows: plan.rows,
    notes: plan.notes,
    message: "Handover fee obligation recorded.",
  };
}

function emptySchedule(): ScheduleContent {
  return {
    packageCode: "",
    catalogueRef: null,
    inclusions: [],
    exclusions: [],
    usagePolicy: {},
    amountMinor: null,
    currency: "GBP",
    taxBasis: "pending",
    cadence: null,
    startDate: null,
    noticeDays: null,
    cancellationTermsRef: null,
    responseTargets: {},
  };
}
