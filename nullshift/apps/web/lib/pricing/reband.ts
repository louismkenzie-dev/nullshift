import { SCALE_BAND_LABEL, type ScaleBand } from "@/lib/pricing/nsi";

/**
 * Re-band decision rules (spec §7).
 *
 * A shadow score is not a price. This module answers one question — "does this
 * month's snapshot justify PROPOSING a price change?" — and the answer is
 * never "charge them differently". Nothing here writes to Stripe, and nothing
 * here can be reached without a human pressing something afterwards.
 *
 * The asymmetry is deliberate and in the client's favour:
 *
 *  · UP needs two consecutive months in the higher band. One busy month is
 *    not a bigger business, and a client should never see a bill rise because
 *    of a single spike.
 *  · DOWN needs three consecutive months AND a six-month review point. That
 *    looks harsher, but it is what stops a real reduction being reversed by
 *    the first quiet month after it.
 *  · An Enterprise flag goes to a human immediately, in either direction. The
 *    formula stops having an opinion at that point.
 */

export const BAND_ORDER: ScaleBand[] = [
  "standard",
  "growth",
  "established",
  "scale",
  "critical",
];

export const UPWARD_CONSECUTIVE = 2;
export const DOWNWARD_CONSECUTIVE = 3;
export const DOWNWARD_REVIEW_MONTHS = 6;
export const NOTICE_DAYS = 30;

export const bandRank = (b: ScaleBand | null): number =>
  b ? BAND_ORDER.indexOf(b) : -1;

export type Snapshot = {
  id: string;
  /** First of the month, "YYYY-MM-DD". */
  period: string;
  scaleBand: ScaleBand | null;
  recommendedMrr: number | null;
  enterpriseReviewRequired: boolean;
};

export type RebandDecision =
  | { action: "none"; reason: string }
  | { action: "manual_review"; reason: string; evidence: string[] }
  | {
      action: "propose";
      direction: "increase" | "decrease";
      fromBand: ScaleBand;
      toBand: ScaleBand;
      newMrr: number;
      reason: string;
      evidence: string[];
    };

/**
 * Decide from the snapshot history. `snapshots` must be newest first, and
 * `contractedBand`/`currentMrr` are what the client is actually on today.
 *
 * `monthsSinceLastChange` gates downward moves onto the six-month review; pass
 * the months since the last price change (or since the agreement started).
 */
export function rebandDecision(
  snapshots: Snapshot[],
  opts: {
    contractedBand: ScaleBand | null;
    currentMrr: number;
    monthsSinceLastChange: number;
  }
): RebandDecision {
  const { contractedBand, currentMrr, monthsSinceLastChange } = opts;

  if (snapshots.length === 0)
    return { action: "none", reason: "No shadow scores recorded yet." };

  // Enterprise short-circuits everything. A client whose flags say Enterprise
  // is not a band problem, and the formula deliberately produces no price.
  const enterprise = snapshots.find((s) => s.enterpriseReviewRequired);
  if (enterprise)
    return {
      action: "manual_review",
      reason:
        "An Enterprise flag was raised. This needs a manual commercial and legal review, not a band change.",
      evidence: [enterprise.id],
    };

  if (!contractedBand)
    return {
      action: "manual_review",
      reason:
        "No contracted scale band is recorded, so there is nothing to compare this month's score against.",
      evidence: [snapshots[0]!.id],
    };

  const current = bandRank(contractedBand);
  const latest = snapshots[0]!;
  const latestRank = bandRank(latest.scaleBand);

  if (latestRank === current)
    return {
      action: "none",
      reason: `This month scores ${SCALE_BAND_LABEL[contractedBand]}, the band they are already on.`,
    };

  const direction = latestRank > current ? "increase" : "decrease";
  const needed = direction === "increase" ? UPWARD_CONSECUTIVE : DOWNWARD_CONSECUTIVE;

  // Count the run of consecutive months on the same side of the contracted
  // band. Same SIDE, not the same band: a client who scores `scale` then
  // `critical` has been above their band for two months, and pretending
  // otherwise would restart the clock every time they climbed further.
  const run: Snapshot[] = [];
  for (const s of snapshots) {
    const r = bandRank(s.scaleBand);
    const sameSide = direction === "increase" ? r > current : r >= 0 && r < current;
    if (!sameSide) break;
    run.push(s);
  }

  if (run.length < needed)
    return {
      action: "none",
      reason:
        direction === "increase"
          ? `${run.length} of ${UPWARD_CONSECUTIVE} consecutive months above ${SCALE_BAND_LABEL[contractedBand]}. One month is not a trend.`
          : `${run.length} of ${DOWNWARD_CONSECUTIVE} consecutive months below ${SCALE_BAND_LABEL[contractedBand]}.`,
    };

  if (direction === "decrease" && monthsSinceLastChange < DOWNWARD_REVIEW_MONTHS)
    return {
      action: "none",
      reason: `Downward re-bands are made at the six-month review. ${monthsSinceLastChange} of ${DOWNWARD_REVIEW_MONTHS} months since the last change.`,
    };

  // The band the run actually supports: for an increase, the LOWEST band in
  // the run — proposing the peak would charge for a month they did not sustain.
  // For a decrease, the HIGHEST, for the mirror-image reason.
  const ranks = run.slice(0, needed).map((s) => bandRank(s.scaleBand));
  const targetRank = direction === "increase" ? Math.min(...ranks) : Math.max(...ranks);
  const toBand = BAND_ORDER[targetRank]!;

  if (targetRank === current)
    return {
      action: "none",
      reason: "The sustained band is the one they are already on.",
    };

  // Price the target band from the snapshot that produced it, never from an
  // average — a recommended figure has to be one the formula actually said.
  const source = run.find((s) => bandRank(s.scaleBand) === targetRank);
  const newMrr = source?.recommendedMrr ?? null;
  if (newMrr === null)
    return {
      action: "manual_review",
      reason:
        "The sustained band has no recommended figure — usually a missing vendor cost. Price this one by hand.",
      evidence: run.slice(0, needed).map((s) => s.id),
    };

  if (newMrr === currentMrr)
    return {
      action: "none",
      reason: "The band moved but the recommended figure is unchanged.",
    };

  return {
    action: "propose",
    direction,
    fromBand: contractedBand,
    toBand,
    newMrr,
    reason:
      direction === "increase"
        ? `${needed} consecutive months at ${SCALE_BAND_LABEL[toBand]} or above, against a contracted band of ${SCALE_BAND_LABEL[contractedBand]}.`
        : `${needed} consecutive months at ${SCALE_BAND_LABEL[toBand]} or below at the six-month review, against a contracted band of ${SCALE_BAND_LABEL[contractedBand]}.`,
    evidence: run.slice(0, needed).map((s) => s.id),
  };
}

/**
 * The earliest date a change may take effect: 30 clear days after the notice
 * goes out. The database enforces this too — this is so the UI can show the
 * date rather than make staff work it out.
 */
export function earliestEffectiveDate(noticeSentAt: Date = new Date()): string {
  const d = new Date(noticeSentAt);
  d.setDate(d.getDate() + NOTICE_DAYS);
  return d.toISOString().slice(0, 10);
}

/** First of the current month, the period a snapshot is filed under. */
export function currentPeriod(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
}
