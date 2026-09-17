/**
 * Money allocation — pure integer arithmetic behind migration 0062 (brief
 * §12.3 monetary invariants, §17.2 "milestone rounding totals equal the
 * accepted project amount exactly", "floor rounding never falls below the
 * configured minimum", "several invoices paid in one transfer").
 *
 * Everything here works in integer minor units (pence) with an explicit
 * currency carried by the caller. No floating-point money ever leaves this
 * module: percentages are converted to basis points once, and the residual
 * pennies that integer division leaves behind are handed out by a fixed,
 * documented rule so the same input always produces the same split.
 *
 * Nothing here reads a database or calls a provider.
 */

/* ── Validation ──────────────────────────────────────────────────────────── */

export type AllocationProblem = { code: string; detail: string };

export type AllocationResult<T> =
  | { ok: true; value: T }
  | { ok: false; problems: AllocationProblem[] };

export const isMinorUnits = (n: unknown): n is number =>
  typeof n === "number" && Number.isInteger(n) && Number.isFinite(n);

/** Percent (may carry decimals, e.g. 33.333) → integer basis points, half-up. */
export function percentToBasisPoints(percent: number): number {
  return Math.round(percent * 100);
}

/* ── Milestone split ─────────────────────────────────────────────────────── */

export type MilestoneShare = {
  /** Stable milestone identity ('m1', 'deposit', 'final'); unique per project. */
  key: string;
  label: string;
  /** Share of the accepted total in percent. May carry decimals. */
  percent: number;
};

export type MilestoneAmount = MilestoneShare & {
  basisPoints: number;
  amountMinor: number;
  /** Pennies added (or removed) by the deterministic residual rule. */
  residualMinor: number;
};

export type MilestoneSplit = {
  totalMinor: number;
  milestones: MilestoneAmount[];
  /** Always equals totalMinor; exported so callers can assert it in one line. */
  sumMinor: number;
  /** How the residual pennies were placed — kept for the obligation's evidence. */
  rule: "largest_remainder_then_first";
};

/**
 * Split an accepted total across milestones so the parts sum to the total
 * EXACTLY (§12.3 "milestone totals equal the accepted Build amount after
 * rounding; allocate residual pennies deterministically").
 *
 * Rule: each milestone gets floor(total × bps / 10000). The pennies left over
 * (always fewer than the number of milestones) go one each to the milestones
 * with the largest fractional remainder; ties are broken by position (earliest
 * milestone first). The same input always yields the same split, so a
 * replayed request produces identical obligations and the unique index on
 * (project, kind, milestone_key) does the rest.
 */
export function allocateMilestones(
  totalMinor: number,
  shares: readonly MilestoneShare[]
): AllocationResult<MilestoneSplit> {
  const problems: AllocationProblem[] = [];
  if (!isMinorUnits(totalMinor) || totalMinor < 0)
    problems.push({
      code: "total_invalid",
      detail: "Total must be a non-negative integer of minor units.",
    });
  if (shares.length === 0)
    problems.push({
      code: "no_milestones",
      detail: "At least one milestone is required.",
    });

  const keys = new Set<string>();
  let bpsSum = 0;
  const bps = shares.map((s, i) => {
    if (!s.key || !/^[a-z0-9][a-z0-9_-]*$/i.test(s.key))
      problems.push({
        code: "key_invalid",
        detail: `Milestone ${i + 1} needs a stable key (letters, digits, - or _).`,
      });
    if (keys.has(s.key))
      problems.push({
        code: "key_duplicate",
        detail: `Milestone key "${s.key}" is used twice.`,
      });
    keys.add(s.key);
    if (typeof s.percent !== "number" || !Number.isFinite(s.percent) || s.percent < 0)
      problems.push({
        code: "percent_invalid",
        detail: `Milestone "${s.key}" has an invalid percentage.`,
      });
    const b = percentToBasisPoints(s.percent);
    bpsSum += b;
    return b;
  });
  if (shares.length && bpsSum !== 10_000)
    problems.push({
      code: "percent_sum",
      detail: `Milestone percentages must total 100.00% (got ${(bpsSum / 100).toFixed(2)}%).`,
    });
  if (problems.length) return { ok: false, problems };

  // Integer maths only: floor share and the exact remainder in "ten-thousandths of a penny".
  const floors = bps.map((b) => Math.floor((totalMinor * b) / 10_000));
  const remainders = bps.map((b) => (totalMinor * b) % 10_000);
  let leftover = totalMinor - floors.reduce((a, v) => a + v, 0);

  const order = remainders
    .map((r, i) => ({ r, i }))
    .sort((a, b) => (b.r !== a.r ? b.r - a.r : a.i - b.i));
  const residual = new Array<number>(bps.length).fill(0);
  for (const { i } of order) {
    if (leftover <= 0) break;
    residual[i] = 1;
    leftover -= 1;
  }

  const milestones: MilestoneAmount[] = shares.map((s, i) => ({
    ...s,
    basisPoints: bps[i],
    amountMinor: floors[i] + residual[i],
    residualMinor: residual[i],
  }));
  const sumMinor = milestones.reduce((a, m) => a + m.amountMinor, 0);
  return {
    ok: true,
    value: { totalMinor, milestones, sumMinor, rule: "largest_remainder_then_first" },
  };
}

/* ── Net / tax / gross ───────────────────────────────────────────────────── */

export type TaxSnapshot = {
  /**
   * The approved tax code / basis reference frozen onto the obligation.
   * 'pending_decision' is a real value: it records that no basis has been
   * approved and blocks issue (brief §6.5, decisions 18.3 / 18.8).
   */
  codeRef: string;
  /** Rate in basis points (2000 = 20%). Zero for exempt / zero-rated / pending. */
  rateBps: number;
};

export const PENDING_TAX: TaxSnapshot = { codeRef: "pending_decision", rateBps: 0 };

export const isTaxPending = (t: Pick<TaxSnapshot, "codeRef">): boolean =>
  t.codeRef === "pending_decision";

export type MoneyParts = { netMinor: number; taxMinor: number; grossMinor: number };

/** Tax on a net amount, rounded half-up in integer arithmetic. gross = net + tax always. */
export function applyTax(
  netMinor: number,
  tax: TaxSnapshot
): AllocationResult<MoneyParts> {
  const problems: AllocationProblem[] = [];
  if (!isMinorUnits(netMinor) || netMinor < 0)
    problems.push({
      code: "net_invalid",
      detail: "Net must be a non-negative integer of minor units.",
    });
  if (!Number.isInteger(tax.rateBps) || tax.rateBps < 0 || tax.rateBps > 10_000)
    problems.push({
      code: "rate_invalid",
      detail: "Tax rate must be 0–10000 basis points.",
    });
  if (!tax.codeRef)
    problems.push({ code: "code_missing", detail: "A tax code reference is required." });
  if (problems.length) return { ok: false, problems };
  const taxMinor = Math.floor((netMinor * tax.rateBps + 5_000) / 10_000);
  return { ok: true, value: { netMinor, taxMinor, grossMinor: netMinor + taxMinor } };
}

/* ── Floor rounding ──────────────────────────────────────────────────────── */

/**
 * Round DOWN to a step (e.g. whole pounds = 100) but never below a configured
 * minimum (§17.2 "floor rounding never falls below the configured minimum").
 */
export function floorToStep(
  amountMinor: number,
  stepMinor: number,
  minimumMinor: number
): number {
  if (!isMinorUnits(amountMinor) || !isMinorUnits(stepMinor) || stepMinor <= 0)
    throw new Error(
      "floorToStep: amounts and step must be integers; step must be positive"
    );
  if (!isMinorUnits(minimumMinor) || minimumMinor < 0)
    throw new Error("floorToStep: minimum must be a non-negative integer");
  const floored = Math.floor(amountMinor / stepMinor) * stepMinor;
  return Math.max(floored, minimumMinor);
}

/* ── One payment across several debts ────────────────────────────────────── */

export type OpenDebt = {
  obligationId: string;
  /** Still owed on this obligation (gross − settled). Non-positive debts are skipped. */
  remainingMinor: number;
  currency: string;
  /** Used for ordering only; ISO date or timestamp. Null sorts last. */
  dueAt: string | null;
};

export type DebtAllocation = { obligationId: string; amountMinor: number };

export type PaymentSpread = {
  allocations: DebtAllocation[];
  /** What the payment could not be applied to (an overpayment, kept visible). */
  unallocatedMinor: number;
  /** The debts that remain after this payment, in the order they were filled. */
  remaining: { obligationId: string; remainingMinor: number }[];
};

/**
 * Apply ONE payment to several open obligations in due-date order (oldest
 * first, ties by input order), never exceeding either the payment or any
 * debt. Several invoices paid in one transfer are just several allocation
 * rows against one provider payment; anything left over is reported, never
 * silently dropped or refunded (brief §10.2 "keep any resulting overpayment
 * visible").
 */
export function spreadPayment(
  paymentMinor: number,
  currency: string,
  debts: readonly OpenDebt[]
): AllocationResult<PaymentSpread> {
  if (!isMinorUnits(paymentMinor) || paymentMinor <= 0)
    return {
      ok: false,
      problems: [
        {
          code: "payment_invalid",
          detail: "Payment must be a positive integer of minor units.",
        },
      ],
    };
  const foreign = debts.filter((d) => d.currency !== currency);
  if (foreign.length)
    return {
      ok: false,
      problems: [
        {
          code: "currency_mismatch",
          detail: `Cannot spread a ${currency} payment across ${foreign.map((d) => d.currency).join(", ")} obligations.`,
        },
      ],
    };

  const ordered = debts
    .map((d, i) => ({ d, i }))
    .filter(({ d }) => isMinorUnits(d.remainingMinor) && d.remainingMinor > 0)
    .sort((a, b) => {
      const da = a.d.dueAt ?? "￿";
      const db = b.d.dueAt ?? "￿";
      return da < db ? -1 : da > db ? 1 : a.i - b.i;
    });

  let left = paymentMinor;
  const allocations: DebtAllocation[] = [];
  const remaining: PaymentSpread["remaining"] = [];
  for (const { d } of ordered) {
    const take = Math.min(left, d.remainingMinor);
    if (take > 0) {
      allocations.push({ obligationId: d.obligationId, amountMinor: take });
      left -= take;
    }
    remaining.push({
      obligationId: d.obligationId,
      remainingMinor: d.remainingMinor - take,
    });
  }
  return { ok: true, value: { allocations, unallocatedMinor: left, remaining } };
}

/* ── Allocation ceiling (mirrors trg_payment_allocations_guard) ──────────── */

export type ProviderPaymentLike = {
  provider: string;
  providerPaymentId: string;
  kind: string;
  amountMinor: number;
  currency: string;
};

export type ExistingAllocationLike = {
  provider: string;
  providerPaymentId: string;
  kind: string;
  amountMinor: number;
};

/**
 * Would this allocation take the total applied from one provider payment
 * above its recorded amount? The database trigger is the authority; this is
 * the same check so the UI can refuse before a round trip and the tests can
 * pin the rule (§12.3 "one provider payment cannot be allocated twice beyond
 * its available amount").
 */
export function allocationCeiling(
  recorded: ProviderPaymentLike,
  existing: readonly ExistingAllocationLike[],
  proposedMinor: number
): {
  allowed: boolean;
  alreadyMinor: number;
  availableMinor: number;
  reason: string | null;
} {
  const alreadyMinor = existing
    .filter(
      (a) =>
        a.provider === recorded.provider &&
        a.providerPaymentId === recorded.providerPaymentId &&
        a.kind === recorded.kind
    )
    .reduce((t, a) => t + a.amountMinor, 0);
  const availableMinor = Math.max(0, recorded.amountMinor - alreadyMinor);
  if (!isMinorUnits(proposedMinor) || proposedMinor <= 0)
    return {
      allowed: false,
      alreadyMinor,
      availableMinor,
      reason: "Allocation must be a positive integer of minor units.",
    };
  if (proposedMinor > availableMinor)
    return {
      allowed: false,
      alreadyMinor,
      availableMinor,
      reason: `Allocating ${proposedMinor} would take ${recorded.provider}/${recorded.providerPaymentId} to ${alreadyMinor + proposedMinor} of a recorded ${recorded.amountMinor}.`,
    };
  return { allowed: true, alreadyMinor, availableMinor, reason: null };
}
