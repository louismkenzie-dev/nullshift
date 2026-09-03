/**
 * The second-person review rule for legal documents — pure, no I/O, so the
 * send actions, the ReviewGate component and the unit test all share one
 * definition of "may this go to the client?".
 *
 * A document may be sent only when someone has approved it AND that someone
 * is not its author. Mirrors the SOC 2 reviewer ≠ performer rule.
 */

export const LEGAL_DOCUMENT_KINDS = ["proposal", "order_form", "change_order"] as const;
export type LegalDocumentKind = (typeof LEGAL_DOCUMENT_KINDS)[number];

export const LEGAL_DOCUMENT_LABEL: Record<LegalDocumentKind, string> = {
  proposal: "Proposal",
  order_form: "Order Form",
  change_order: "Change Order",
};

export type ReviewInput = {
  /** Who drafted it (projects.proposal_drafted_by / *.created_by). */
  author: string | null | undefined;
  /** Who approved it (projects.proposal_reviewed_by / *.reviewed_by). */
  reviewedBy: string | null | undefined;
  reviewedAt: string | null | undefined;
};

export type ReviewState = {
  author: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  /** True only when reviewedBy is set and differs from the author. */
  canSend: boolean;
  /** Human-readable explanation, shown next to a disabled Send button. */
  reason: string;
};

export const REVIEW_REASON = {
  approved: "Approved for sending.",
  awaiting: "Awaiting approval by a staff member other than the author.",
  selfApproved:
    "Approved by its own author — a different staff member must approve it before it can be sent.",
} as const;

export function reviewState(doc: ReviewInput): ReviewState {
  const author = doc.author ?? null;
  const reviewedBy = doc.reviewedBy ?? null;
  const reviewedAt = doc.reviewedAt ?? null;

  if (!reviewedBy) {
    return {
      author,
      reviewedBy,
      reviewedAt,
      canSend: false,
      reason: REVIEW_REASON.awaiting,
    };
  }
  if (author && reviewedBy === author) {
    return {
      author,
      reviewedBy,
      reviewedAt,
      canSend: false,
      reason: REVIEW_REASON.selfApproved,
    };
  }
  return {
    author,
    reviewedBy,
    reviewedAt,
    canSend: true,
    reason: REVIEW_REASON.approved,
  };
}

/**
 * May `userId` approve this document? The author never can; anyone else
 * (a staff member — the action checks that) can. Returns the reason to show
 * when they cannot.
 */
export function canApprove(
  doc: Pick<ReviewInput, "author">,
  userId: string
): { ok: true } | { ok: false; reason: string } {
  if (doc.author && doc.author === userId) {
    return {
      ok: false,
      reason: "You drafted this document — another staff member must approve it.",
    };
  }
  return { ok: true };
}

/** `?blocked=` values the send/approve actions redirect back with. */
export const REVIEW_BLOCKED = {
  review: "review",
  selfApproval: "self_approval",
  notDraft: "not_draft",
} as const;

export function blockedMessage(code: string | null | undefined): string | null {
  switch (code) {
    case REVIEW_BLOCKED.review:
      return "Not sent: this document has not been approved by a second staff member. Ask someone other than the author to approve it, then send again.";
    case REVIEW_BLOCKED.selfApproval:
      return "Not approved: you drafted this document, so you cannot approve it. A different staff member must approve it.";
    case REVIEW_BLOCKED.notDraft:
      return "Nothing to approve: this document is no longer a draft.";
    default:
      return null;
  }
}
