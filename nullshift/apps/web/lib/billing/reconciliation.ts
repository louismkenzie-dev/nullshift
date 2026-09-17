/**
 * Reconciliation — pure rules behind Finance › Reconciliation (brief §5.6:
 * "gross collections − refunds − fees ± adjustments = net payout, linked to
 * bank evidence. Support partial payments, split transfers and several
 * invoices paid in one transfer. Suggested matches explain their evidence;
 * ambiguous matches require human review"; §10.1 ownership of facts; §12.3;
 * §17.2 "gross collections less fees/refunds/adjustments reconcile to the
 * correct payout and bank movement").
 *
 * Nothing here writes anything or calls a provider. A suggestion is a
 * suggestion: the only thing that ever creates a `payment_allocations` row is
 * a staff action (or the integration inbox) that has read the suggestion and
 * its evidence. `requiresHumanReview` is true for everything that is not a
 * high-confidence match, and even a high-confidence match is applied by a
 * person or a worker, never by this module.
 *
 * Money is integer minor units with an explicit currency throughout.
 */

import { isMinorUnits, spreadPayment, type DebtAllocation } from "./allocation";

/* ── Payout arithmetic ───────────────────────────────────────────────────── */

export type PayoutLine = {
  label: string;
  /** Positive for refunds and fees. Adjustments are SIGNED (+ adds to net, − reduces it). */
  amountMinor: number;
  ref?: string | null;
};

export type BankEvidence = {
  statementLine: string;
  reference: string | null;
  /** ISO date or timestamp of the bank movement. */
  at: string;
  amountMinor: number;
  currency: string;
};

export type PayoutInput = {
  id: string;
  provider: "gocardless" | "stripe" | "bank" | "manual";
  currency: string;
  /** Sum of the collections the provider says it is paying out. */
  grossMinor: number;
  refunds: readonly PayoutLine[];
  fees: readonly PayoutLine[];
  adjustments: readonly PayoutLine[];
  /** What the provider states landed. Null when the payout has not been reported. */
  statedNetMinor: number | null;
  bank: BankEvidence | null;
};

export type PayoutArithmetic = {
  grossMinor: number;
  refundsMinor: number;
  feesMinor: number;
  adjustmentsMinor: number;
  /** gross − refunds − fees + adjustments. */
  netMinor: number;
};

const sum = (lines: readonly PayoutLine[]): number =>
  lines.reduce((t, l) => t + l.amountMinor, 0);

/** gross − refunds − fees ± adjustments. Pure integer arithmetic. */
export function payoutArithmetic(
  p: Pick<PayoutInput, "grossMinor" | "refunds" | "fees" | "adjustments">
): PayoutArithmetic {
  const refundsMinor = sum(p.refunds);
  const feesMinor = sum(p.fees);
  const adjustmentsMinor = sum(p.adjustments);
  return {
    grossMinor: p.grossMinor,
    refundsMinor,
    feesMinor,
    adjustmentsMinor,
    netMinor: p.grossMinor - refundsMinor - feesMinor + adjustmentsMinor,
  };
}

export type PayoutVerdict =
  | "balanced" // computed net = stated net = bank movement
  | "bank_pending" // computed net = stated net; no bank evidence yet
  | "bank_mismatch" // computed net = stated net; bank movement differs
  | "provider_mismatch" // computed net ≠ stated net
  | "unstated"; // provider has not reported a net yet

export type PayoutReconciliation = PayoutArithmetic & {
  payoutId: string;
  currency: string;
  statedNetMinor: number | null;
  /** computed − stated; 0 when they agree. */
  providerDifferenceMinor: number | null;
  /** computed − bank; 0 when they agree. */
  bankDifferenceMinor: number | null;
  verdict: PayoutVerdict;
  /** Human-readable reasons, one per line. */
  explanation: string[];
  requiresHumanReview: boolean;
};

/**
 * Does the provider's stated payout, our arithmetic and the bank movement all
 * agree? Any difference is reported with its sign and never "absorbed" into a
 * fee or adjustment line.
 */
export function reconcilePayout(p: PayoutInput): PayoutReconciliation {
  const a = payoutArithmetic(p);
  const explanation: string[] = [
    `Gross ${a.grossMinor} − refunds ${a.refundsMinor} − fees ${a.feesMinor} ${a.adjustmentsMinor < 0 ? "−" : "+"} adjustments ${Math.abs(a.adjustmentsMinor)} = net ${a.netMinor} ${p.currency}.`,
  ];

  if (p.statedNetMinor === null) {
    explanation.push("The provider has not reported a net payout yet.");
    return {
      ...a,
      payoutId: p.id,
      currency: p.currency,
      statedNetMinor: null,
      providerDifferenceMinor: null,
      bankDifferenceMinor: null,
      verdict: "unstated",
      explanation,
      requiresHumanReview: false,
    };
  }

  const providerDifferenceMinor = a.netMinor - p.statedNetMinor;
  if (providerDifferenceMinor !== 0) {
    explanation.push(
      `Provider states ${p.statedNetMinor}; our arithmetic gives ${a.netMinor} (difference ${providerDifferenceMinor}). A fee, refund or adjustment line is missing or wrong — do not force it to balance.`
    );
    return {
      ...a,
      payoutId: p.id,
      currency: p.currency,
      statedNetMinor: p.statedNetMinor,
      providerDifferenceMinor,
      bankDifferenceMinor: null,
      verdict: "provider_mismatch",
      explanation,
      requiresHumanReview: true,
    };
  }
  explanation.push(`Provider states ${p.statedNetMinor}; arithmetic agrees.`);

  if (!p.bank) {
    explanation.push("No bank movement linked yet.");
    return {
      ...a,
      payoutId: p.id,
      currency: p.currency,
      statedNetMinor: p.statedNetMinor,
      providerDifferenceMinor: 0,
      bankDifferenceMinor: null,
      verdict: "bank_pending",
      explanation,
      requiresHumanReview: false,
    };
  }

  if (p.bank.currency !== p.currency) {
    explanation.push(
      `Bank movement is in ${p.bank.currency}; payout is in ${p.currency}.`
    );
    return {
      ...a,
      payoutId: p.id,
      currency: p.currency,
      statedNetMinor: p.statedNetMinor,
      providerDifferenceMinor: 0,
      bankDifferenceMinor: null,
      verdict: "bank_mismatch",
      explanation,
      requiresHumanReview: true,
    };
  }

  const bankDifferenceMinor = a.netMinor - p.bank.amountMinor;
  if (bankDifferenceMinor !== 0) {
    explanation.push(
      `Bank shows ${p.bank.amountMinor} on "${p.bank.statementLine}" (difference ${bankDifferenceMinor}).`
    );
    return {
      ...a,
      payoutId: p.id,
      currency: p.currency,
      statedNetMinor: p.statedNetMinor,
      providerDifferenceMinor: 0,
      bankDifferenceMinor,
      verdict: "bank_mismatch",
      explanation,
      requiresHumanReview: true,
    };
  }

  explanation.push(
    `Bank shows ${p.bank.amountMinor} on "${p.bank.statementLine}"; matched.`
  );
  return {
    ...a,
    payoutId: p.id,
    currency: p.currency,
    statedNetMinor: p.statedNetMinor,
    providerDifferenceMinor: 0,
    bankDifferenceMinor: 0,
    verdict: "balanced",
    explanation,
    requiresHumanReview: false,
  };
}

/* ── Matching a receipt to obligations ───────────────────────────────────── */

export type Receipt = {
  id: string;
  source: "bank_receipt" | "gocardless_payout" | "stripe_payout" | "manual";
  amountMinor: number;
  currency: string;
  /** Payment reference / remittance text as received. Null when absent. */
  reference: string | null;
  receivedAt: string;
  /** Known when the provider identifies the customer; null for a bare bank credit. */
  tenantId: string | null;
};

export type OpenObligationCandidate = {
  obligationId: string;
  tenantId: string;
  /** Invoice number / reference the client is likely to quote. */
  invoiceRef: string | null;
  label: string;
  remainingMinor: number;
  currency: string;
  dueAt: string | null;
};

export type MatchConfidence = "high" | "ambiguous" | "none";

export type MatchSuggestion = {
  receiptId: string;
  confidence: MatchConfidence;
  /** The proposed allocations. Empty when confidence is none. */
  allocations: DebtAllocation[];
  /** Any part of the receipt the proposal cannot place (overpayment; stays visible). */
  unallocatedMinor: number;
  /** Why — one line per piece of evidence, in the order it was weighed. */
  evidence: string[];
  /** What a human needs to decide when the match is ambiguous. */
  ambiguity: string | null;
  /** Other proposals that fit equally well. */
  alternatives: DebtAllocation[][];
  requiresHumanReview: boolean;
};

const normaliseRef = (s: string | null | undefined): string =>
  (s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Candidates the receipt's reference names, by invoice ref or obligation id. */
export function referenceMatches(
  receipt: Pick<Receipt, "reference">,
  candidates: readonly OpenObligationCandidate[]
): OpenObligationCandidate[] {
  const ref = normaliseRef(receipt.reference);
  if (ref.length < 4) return [];
  return candidates.filter((c) => {
    const inv = normaliseRef(c.invoiceRef);
    const id = normaliseRef(c.obligationId);
    return (
      (inv.length >= 4 && ref.includes(inv)) ||
      (id.length >= 8 && ref.includes(id.slice(0, 8)))
    );
  });
}

const MAX_SUBSET_CANDIDATES = 12;

/** Every subset (size ≥ 2) of candidates whose remaining balances sum to exactly `target`. */
export function subsetSums(
  candidates: readonly OpenObligationCandidate[],
  target: number
): OpenObligationCandidate[][] {
  const pool = candidates.slice(0, MAX_SUBSET_CANDIDATES);
  const found: OpenObligationCandidate[][] = [];
  const n = pool.length;
  for (let mask = 1; mask < 1 << n; mask += 1) {
    if ((mask & (mask - 1)) === 0) continue; // single element: handled by the exact rule
    let total = 0;
    for (let i = 0; i < n; i += 1) if (mask & (1 << i)) total += pool[i].remainingMinor;
    if (total === target) found.push(pool.filter((_, i) => mask & (1 << i)));
  }
  return found;
}

const toAllocations = (cs: readonly OpenObligationCandidate[]): DebtAllocation[] =>
  cs.map((c) => ({ obligationId: c.obligationId, amountMinor: c.remainingMinor }));

function none(receipt: Receipt, evidence: string[], ambiguity: string): MatchSuggestion {
  return {
    receiptId: receipt.id,
    confidence: "none",
    allocations: [],
    unallocatedMinor: receipt.amountMinor,
    evidence,
    ambiguity,
    alternatives: [],
    requiresHumanReview: true,
  };
}

/**
 * Suggest how a receipt should be allocated. Rules, in order:
 *
 *  1. Currency and (when known) client must agree; anything else is unmatched.
 *  2. The remittance reference names one or more obligations → those, in
 *     due-date order. Exact → high. Under (partial payment) → high with the
 *     partial stated. Over → ambiguous: the overpayment needs a decision.
 *  3. The amount equals exactly one obligation's remaining balance → high.
 *     (A split transfer's second half lands here: the remaining balance
 *     already reflects the first.) Several with the same balance → ambiguous.
 *  4. The amount equals the sum of exactly one subset of open obligations
 *     ("several invoices in one transfer") → high. Several subsets → ambiguous.
 *  5. Otherwise → none; a partial payment without a reference is a decision
 *     for a person, not a guess.
 *
 * Every non-high result carries `requiresHumanReview: true`.
 */
export function suggestMatch(
  receipt: Receipt,
  candidates: readonly OpenObligationCandidate[]
): MatchSuggestion {
  const evidence: string[] = [];
  if (!isMinorUnits(receipt.amountMinor) || receipt.amountMinor <= 0)
    return none(
      receipt,
      ["Receipt amount is not a positive integer of minor units."],
      "Invalid receipt amount."
    );

  let pool = candidates.filter((c) => c.remainingMinor > 0);
  const foreign = pool.filter((c) => c.currency !== receipt.currency);
  if (foreign.length)
    evidence.push(`${foreign.length} obligation(s) in another currency were excluded.`);
  pool = pool.filter((c) => c.currency === receipt.currency);

  if (receipt.tenantId) {
    const other = pool.length;
    pool = pool.filter((c) => c.tenantId === receipt.tenantId);
    evidence.push(
      `Provider identifies the client (${receipt.tenantId}); ${pool.length} of ${other} open obligation(s) belong to them.`
    );
  } else {
    evidence.push(
      "No client identity on the receipt; matching across all open obligations."
    );
  }

  if (pool.length === 0)
    return none(
      receipt,
      [...evidence, "No open obligation to match against."],
      "Unmatched receipt: no open obligation in this currency for this client."
    );

  // 2. Reference.
  const byRef = referenceMatches(receipt, pool);
  if (byRef.length) {
    evidence.push(
      `Reference "${receipt.reference}" names ${byRef.map((c) => c.invoiceRef ?? c.obligationId).join(", ")}.`
    );
    const spread = spreadPayment(receipt.amountMinor, receipt.currency, byRef);
    if (spread.ok) {
      const { allocations, unallocatedMinor } = spread.value;
      const named = byRef.reduce((t, c) => t + c.remainingMinor, 0);
      if (unallocatedMinor === 0 && receipt.amountMinor === named) {
        evidence.push(`Amount ${receipt.amountMinor} equals the named balance exactly.`);
        return {
          receiptId: receipt.id,
          confidence: "high",
          allocations,
          unallocatedMinor: 0,
          evidence,
          ambiguity: null,
          alternatives: [],
          requiresHumanReview: false,
        };
      }
      if (unallocatedMinor === 0) {
        evidence.push(
          `Amount ${receipt.amountMinor} is less than the named balance ${named}: a partial payment leaving ${named - receipt.amountMinor}.`
        );
        return {
          receiptId: receipt.id,
          confidence: "high",
          allocations,
          unallocatedMinor: 0,
          evidence,
          ambiguity: null,
          alternatives: [],
          requiresHumanReview: false,
        };
      }
      evidence.push(
        `Amount ${receipt.amountMinor} exceeds the named balance ${named} by ${unallocatedMinor}.`
      );
      return {
        receiptId: receipt.id,
        confidence: "ambiguous",
        allocations,
        unallocatedMinor,
        evidence,
        ambiguity: `Overpayment of ${unallocatedMinor} ${receipt.currency}: hold it visibly, allocate to another obligation, or refund — none of which happens automatically.`,
        alternatives: [],
        requiresHumanReview: true,
      };
    }
  } else if (receipt.reference) {
    evidence.push(`Reference "${receipt.reference}" names no open obligation.`);
  } else {
    evidence.push("No payment reference.");
  }

  // 3. Exact single balance.
  const exact = pool.filter((c) => c.remainingMinor === receipt.amountMinor);
  if (exact.length === 1) {
    const c = exact[0];
    evidence.push(
      `Amount ${receipt.amountMinor} equals the remaining balance of ${c.invoiceRef ?? c.obligationId} and no other.`
    );
    return {
      receiptId: receipt.id,
      confidence: "high",
      allocations: toAllocations(exact),
      unallocatedMinor: 0,
      evidence,
      ambiguity: null,
      alternatives: [],
      requiresHumanReview: false,
    };
  }
  if (exact.length > 1) {
    evidence.push(
      `Amount ${receipt.amountMinor} equals the remaining balance of ${exact.length} obligations: ${exact.map((c) => c.invoiceRef ?? c.obligationId).join(", ")}.`
    );
    return {
      receiptId: receipt.id,
      confidence: "ambiguous",
      allocations: toAllocations([exact[0]]),
      unallocatedMinor: 0,
      evidence,
      ambiguity:
        "Several obligations have this exact balance; choose which one this receipt settles.",
      alternatives: exact.slice(1).map((c) => toAllocations([c])),
      requiresHumanReview: true,
    };
  }

  // 4. Several invoices in one transfer.
  const subsets = subsetSums(pool, receipt.amountMinor);
  if (subsets.length === 1) {
    evidence.push(
      `Amount ${receipt.amountMinor} equals the combined balance of ${subsets[0].map((c) => c.invoiceRef ?? c.obligationId).join(" + ")} and no other combination.`
    );
    return {
      receiptId: receipt.id,
      confidence: "high",
      allocations: toAllocations(subsets[0]),
      unallocatedMinor: 0,
      evidence,
      ambiguity: null,
      alternatives: [],
      requiresHumanReview: false,
    };
  }
  if (subsets.length > 1) {
    evidence.push(
      `Amount ${receipt.amountMinor} equals ${subsets.length} different combinations of open balances.`
    );
    return {
      receiptId: receipt.id,
      confidence: "ambiguous",
      allocations: toAllocations(subsets[0]),
      unallocatedMinor: 0,
      evidence,
      ambiguity: `Combinations: ${subsets
        .map((s) => s.map((c) => c.invoiceRef ?? c.obligationId).join(" + "))
        .join(" | ")}. Choose one.`,
      alternatives: subsets.slice(1).map(toAllocations),
      requiresHumanReview: true,
    };
  }

  // 5. Nothing fits.
  const single = pool.length === 1 ? pool[0] : null;
  if (single && receipt.amountMinor < single.remainingMinor) {
    evidence.push(
      `Only one open obligation (${single.invoiceRef ?? single.obligationId}, remaining ${single.remainingMinor}); the amount would be a partial payment but nothing on the receipt says so.`
    );
    return {
      receiptId: receipt.id,
      confidence: "ambiguous",
      allocations: [
        { obligationId: single.obligationId, amountMinor: receipt.amountMinor },
      ],
      unallocatedMinor: 0,
      evidence,
      ambiguity:
        "Confirm this is a partial payment of the only open obligation before allocating.",
      alternatives: [],
      requiresHumanReview: true,
    };
  }
  evidence.push(
    `Amount ${receipt.amountMinor} matches no balance or combination of balances.`
  );
  return none(
    receipt,
    evidence,
    "Unmatched receipt: needs a person to identify the payer and the debt."
  );
}

/* ── Applying allocations to a payout (over-allocation guard) ────────────── */

export type PayoutAllocationCheck = {
  allocatedMinor: number;
  grossMinor: number;
  remainingMinor: number;
  overAllocated: boolean;
};

/** Allocations against one payout can never exceed its gross collections. */
export function checkPayoutAllocations(
  grossMinor: number,
  allocations: readonly DebtAllocation[]
): PayoutAllocationCheck {
  const allocatedMinor = allocations.reduce((t, a) => t + a.amountMinor, 0);
  return {
    allocatedMinor,
    grossMinor,
    remainingMinor: grossMinor - allocatedMinor,
    overAllocated: allocatedMinor > grossMinor,
  };
}
