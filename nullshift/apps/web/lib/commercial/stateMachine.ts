/**
 * Pure quote-version state machine (brief §5.2, §5.3, §12.5). No I/O — the
 * server actions and the database trigger both defer to these rules, and the
 * vitest suite in tests/commercial-quotes.test.ts pins them.
 */
import type { QuoteCommercial, QuoteInternal, QuoteVersionStatus } from "./types";

const TRANSITIONS: Record<QuoteVersionStatus, readonly QuoteVersionStatus[]> = {
  draft: ["internal_review", "withdrawn"],
  internal_review: ["draft", "approved_to_issue", "withdrawn"],
  approved_to_issue: ["issued", "draft", "withdrawn"],
  issued: ["accepted", "declined", "expired", "superseded", "withdrawn"],
  accepted: ["superseded"],
  declined: [],
  expired: [],
  superseded: [],
  withdrawn: [],
};

export function allowedTransitions(
  from: QuoteVersionStatus
): readonly QuoteVersionStatus[] {
  return TRANSITIONS[from];
}

export function canTransition(from: QuoteVersionStatus, to: QuoteVersionStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Content may change only while the version is a working copy (mirrors the DB trigger). */
export function isContentEditable(status: QuoteVersionStatus): boolean {
  return status === "draft" || status === "internal_review";
}

/** A version the client has seen (or could have). */
export function isClientVisible(status: QuoteVersionStatus): boolean {
  return (
    status === "issued" ||
    status === "accepted" ||
    status === "declined" ||
    status === "expired" ||
    status === "superseded"
  );
}

/** Only an issued or accepted version can be the parent of the next version. */
export function canCreateNextVersion(status: QuoteVersionStatus): boolean {
  return status === "issued" || status === "accepted";
}

/** Issuing a new version supersedes every prior version that is still live. */
export function supersededOnIssue(priorStatus: QuoteVersionStatus): boolean {
  return priorStatus === "issued" || priorStatus === "accepted";
}

/** A terminal status admits no further transition. */
export function isTerminal(status: QuoteVersionStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

/**
 * Optimistic concurrency: the caller sends the updated_at it last rendered.
 * Timestamps are compared by instant, not by string, so "+00:00" and "Z"
 * spellings of the same moment agree. An unparseable expectation is stale.
 */
export function isStale(expectedUpdatedAt: string, actualUpdatedAt: string): boolean {
  const expected = Date.parse(expectedUpdatedAt);
  const actual = Date.parse(actualUpdatedAt);
  if (Number.isNaN(expected) || Number.isNaN(actual)) return true;
  return expected !== actual;
}

/**
 * Cost-derived floor: cost / (1 − min margin), rounded up to the next minor
 * unit. Zero cost means "not assessed" and yields no floor (0), never a cap.
 */
export function floorMinor(riskAdjustedCostMinor: number, minMarginPct: number): number {
  if (!(riskAdjustedCostMinor > 0)) return 0;
  const margin = Math.min(Math.max(minMarginPct, 0), 99) / 100;
  return Math.ceil(riskAdjustedCostMinor / (1 - margin));
}

export function isBelowFloor(
  commercial: Partial<QuoteCommercial>,
  internal: Partial<QuoteInternal>
): boolean {
  const floor = floorMinor(
    internal.risk_adjusted_cost_minor ?? 0,
    internal.min_margin_pct ?? 0
  );
  if (floor === 0) return false;
  return (commercial.build_price_minor ?? 0) < floor;
}

export type ApprovalCheck =
  | { ok: true }
  | {
      ok: false;
      reason: "approver_is_author" | "reason_required" | "invalid_transition";
    };

/**
 * Approve-to-issue rules: the version must be in internal review, the
 * approver must not be the author, and a below-floor price needs a written
 * reason. Authorless legacy rows (author null) cannot satisfy separation, so
 * they are refused rather than waved through.
 */
export function checkApproval(input: {
  status: QuoteVersionStatus;
  authorId: string | null;
  approverId: string;
  belowFloor: boolean;
  reason: string | null | undefined;
}): ApprovalCheck {
  if (!canTransition(input.status, "approved_to_issue")) {
    return { ok: false, reason: "invalid_transition" };
  }
  if (input.authorId === null || input.authorId === input.approverId) {
    return { ok: false, reason: "approver_is_author" };
  }
  if (input.belowFloor && !(input.reason && input.reason.trim().length > 0)) {
    return { ok: false, reason: "reason_required" };
  }
  return { ok: true };
}

export type IssueCheck =
  | { ok: true }
  | { ok: false; reason: "invalid_transition" | "approval_missing" | "stale" };

/**
 * Issue rules: only an approved version may be issued, it must carry an
 * approve decision, and a stale tab (an updated_at that no longer matches)
 * is refused so nobody issues a version that was superseded or withdrawn
 * underneath them.
 */
export function checkIssue(input: {
  status: QuoteVersionStatus;
  hasApproval: boolean;
  expectedUpdatedAt: string | null;
  actualUpdatedAt: string;
}): IssueCheck {
  if (
    input.expectedUpdatedAt !== null &&
    isStale(input.expectedUpdatedAt, input.actualUpdatedAt)
  ) {
    return { ok: false, reason: "stale" };
  }
  if (!canTransition(input.status, "issued"))
    return { ok: false, reason: "invalid_transition" };
  if (!input.hasApproval) return { ok: false, reason: "approval_missing" };
  return { ok: true };
}

export const DEFAULT_VALIDITY_DAYS = 30;

/** Explicit expiry (§5.3): caller-supplied, else 30 days from issue. */
export function expiryFor(issuedAt: Date, requested?: Date | null): Date {
  if (requested && requested.getTime() > issuedAt.getTime()) return requested;
  return new Date(issuedAt.getTime() + DEFAULT_VALIDITY_DAYS * 24 * 60 * 60 * 1000);
}

/** Human labels (UK English) used by the listing and the Studio mapping. */
export const STATUS_LABEL: Record<QuoteVersionStatus, string> = {
  draft: "Draft",
  internal_review: "Internal review",
  approved_to_issue: "Approved to issue",
  issued: "Issued",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired",
  superseded: "Superseded",
  withdrawn: "Withdrawn",
};
