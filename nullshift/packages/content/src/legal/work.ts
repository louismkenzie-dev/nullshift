/**
 * Support vs Additional Development, and the Change Order state machine
 * (spec §8, §9).
 *
 * The commercial line this file draws is the one the whole plan model rests
 * on: a plan buys the continued working of what was agreed, not the building
 * of what was not. Get it wrong in either direction and either the client is
 * billed for a fix they were entitled to, or Nullshift builds features for
 * free until the plan is worthless.
 *
 * Nothing here decides anything on its own. A human classifies; this module
 * gives them the rule in the same words every time, and then makes the
 * consequence of the classification unavoidable.
 */

export type WorkClassification =
  | "support"
  | "additional_development"
  | "mixed"
  | "security_incident"
  | "usage_review";

/** The one-line test, quoted verbatim to staff at the point of classifying. */
export const CLASSIFIER_RULE =
  "Restore or configure an existing agreed capability = Support. Create or materially change a capability = Additional Development.";

export const WORK_CLASSIFICATIONS: {
  id: WorkClassification;
  label: string;
  meaning: string;
  /** True when a Change Order must exist before any build work starts. */
  requiresChangeOrder: boolean;
  examples: string[];
}[] = [
  {
    id: "support",
    label: "Support",
    meaning:
      "Something that was agreed and worked has stopped working, or needs configuring within its existing design. Covered by the plan.",
    requiresChangeOrder: false,
    examples: [
      "The booking flow that was working is now erroring.",
      "Change the confirmation email wording.",
      "A scheduled job stopped running.",
      "Add a user to the admin panel.",
    ],
  },
  {
    id: "additional_development",
    label: "Additional development",
    meaning:
      "A capability that does not exist yet, or a material change to one that does. Quoted and accepted separately, every time.",
    requiresChangeOrder: true,
    examples: [
      "Add seat selection to the booking flow.",
      "Integrate a new payment provider.",
      "Build a reporting dashboard.",
      "Replace the pricing model with tiered rates.",
    ],
  },
  {
    id: "mixed",
    label: "Mixed",
    meaning:
      "Part restoration, part new capability. Fix the broken part under the plan; the new part is quoted separately — the fix does not carry the feature in with it.",
    requiresChangeOrder: true,
    examples: [
      "The export is broken, and while you're in there can it also export PDFs?",
    ],
  },
  {
    id: "security_incident",
    label: "Security incident",
    meaning:
      "Suspected or confirmed compromise, data exposure or abuse. Handled under the incident process at priority, not the support queue, and never held up waiting for a Change Order.",
    requiresChangeOrder: false,
    examples: ["Unexpected admin logins.", "A client reports their data is visible."],
  },
  {
    id: "usage_review",
    label: "Usage review",
    meaning:
      "Consumption has moved materially — traffic, storage, AI or other vendor cost. Triggers a pricing conversation, not development work and not silent unlimited spend.",
    requiresChangeOrder: false,
    examples: ["AI spend tripled month on month.", "Traffic outgrew the current plan."],
  },
];

export const classificationMeta = (c: WorkClassification) =>
  WORK_CLASSIFICATIONS.find((w) => w.id === c)!;

/** True when this ticket must not be built from a support entitlement (§8). */
export const requiresChangeOrder = (c: WorkClassification | null | undefined) =>
  c === "additional_development" || c === "mixed";

/* ── Change Order state machine (§9) ───────────────────────────── */

export type ChangeOrderStatus =
  | "draft"
  | "client_review"
  | "accepted"
  | "in_build"
  | "delivered"
  | "accepted_complete"
  | "rejected"
  | "withdrawn"
  | "superseded";

/**
 * The permitted moves. `accepted` is reachable only by the client, which is
 * why it is not in the staff transition map below.
 */
export const CHANGE_ORDER_FLOW: Record<ChangeOrderStatus, ChangeOrderStatus[]> = {
  draft: ["client_review", "withdrawn"],
  client_review: ["accepted", "rejected", "withdrawn", "superseded"],
  accepted: ["in_build", "superseded"],
  in_build: ["delivered"],
  delivered: ["accepted_complete", "in_build"],
  accepted_complete: [],
  rejected: ["superseded"],
  withdrawn: [],
  superseded: [],
};

export const CHANGE_ORDER_LABEL: Record<ChangeOrderStatus, string> = {
  draft: "Draft",
  client_review: "With client",
  accepted: "Accepted",
  in_build: "In build",
  delivered: "Delivered",
  accepted_complete: "Signed off",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  superseded: "Superseded",
};

/** Moves staff may make. Acceptance and rejection belong to the client alone. */
export const staffTransitions = (from: ChangeOrderStatus): ChangeOrderStatus[] =>
  CHANGE_ORDER_FLOW[from].filter((s) => s !== "accepted" && s !== "rejected");

export const canTransition = (from: ChangeOrderStatus, to: ChangeOrderStatus) =>
  CHANGE_ORDER_FLOW[from].includes(to);

/** Work has started or finished — the states that require prior acceptance. */
export const isBuildState = (s: ChangeOrderStatus) =>
  s === "in_build" || s === "delivered" || s === "accepted_complete";

/**
 * What must be true before a Change Order can go to the client. Returned as a
 * list so a half-finished draft shows everything still missing at once.
 */
export function changeOrderReadiness(co: {
  description?: string | null;
  businessOutcome?: string | null;
  acceptanceCriteria?: unknown[];
  recurringFeeDelta?: number | null;
}): string[] {
  const missing: string[] = [];
  if (!co.description?.trim()) missing.push("A description of the change.");
  if (!co.businessOutcome?.trim())
    missing.push("The business outcome — what the client gets, in their words.");
  if (!co.acceptanceCriteria?.length)
    missing.push("At least one acceptance criterion, so 'done' is not a matter of opinion.");
  if (co.recurringFeeDelta === null || co.recurringFeeDelta === undefined)
    missing.push(
      "The recurring-fee impact. Enter 0 if there is none — leaving it unanswered is how surprise monthly charges happen."
    );
  return missing;
}
