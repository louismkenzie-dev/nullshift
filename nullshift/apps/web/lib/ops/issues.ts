import type { WorkClassification } from "@nullshift/content/legal/work";

/**
 * Issue bank — shared constants, labels and tone maps for the ops system.
 * The issues table (migration 0014) is the single intake for every bug,
 * change request and question from every channel (portal, WhatsApp, Zoom,
 * email, monitoring). Statuses drive both the admin cockpit and the honest
 * client-facing timeline in the portal.
 */

export type IssueKind = "bug" | "change" | "question" | "task";
export type IssueSeverity = "critical" | "high" | "normal" | "low";
export type IssueStatus =
  | "new"
  | "triaged"
  | "queued"
  | "batched"
  | "in_progress"
  | "awaiting_client"
  | "fixed"
  | "shipped"
  | "closed";
export type IssueBilling = "unclassified" | "covered" | "build_item" | "out_of_scope";
export type IssueSource =
  | "portal"
  | "whatsapp"
  | "email"
  | "zoom"
  | "phone"
  | "internal"
  | "monitor";

export type IssueRow = {
  id: string;
  tenant_id: string;
  project_id: string | null;
  batch_id: string | null;
  submitted_by: string | null;
  source: IssueSource;
  kind: IssueKind;
  severity: IssueSeverity;
  billing: IssueBilling;
  status: IssueStatus;
  title: string;
  description: string | null;
  repro: string | null;
  source_quote: string | null;
  image_urls: string[];
  client_visible: boolean;
  quoted_price: number | null;
  quote_note: string | null;
  quote_accepted_at: string | null;
  quote_declined_at: string | null;
  build_items: number | null;
  due_at: string | null;
  promised_at: string | null;
  promised_note: string | null;
  ai: Record<string, unknown> | null;
  resolution_note: string | null;
  resolved_at: string | null;
  /**
   * Spec §8. `billing` answers who pays; this answers whether the work is a
   * restoration at all — and it is the one the build gate reads.
   */
  classification: WorkClassification | null;
  classified_by: string | null;
  classified_at: string | null;
  classification_note: string | null;
  change_order_id: string | null;
  created_at: string;
  updated_at: string;
};

/** Statuses that count as "open" — the admin's working set. */
export const OPEN_STATUSES: IssueStatus[] = [
  "new",
  "triaged",
  "queued",
  "batched",
  "in_progress",
  "awaiting_client",
];

/** Statuses a batch pulls from when compiling. */
export const QUEUEABLE_STATUSES: IssueStatus[] = ["new", "triaged", "queued"];

/**
 * An unreviewed inbox draft: AI-parsed, hidden, not yet confirmed by a human.
 * Drafts must never count as real work (mission control) or enter a batch.
 */
export function isUnreviewedDraft(i: {
  status: IssueStatus;
  client_visible: boolean;
}): boolean {
  return i.status === "new" && !i.client_visible;
}

/**
 * Whether an issue may be compiled into a fix batch. Two gates:
 * 1. not an unreviewed draft (a human must have confirmed it exists), and
 * 2. the money question is settled — covered/build_item work is included in
 *    the plan; out_of_scope (billable) work needs the client's recorded
 *    acceptance of the quote before it can be built, shipped, and announced.
 */
export function isBatchable(i: {
  status: IssueStatus;
  client_visible: boolean;
  billing: IssueBilling;
  quote_accepted_at?: string | null;
}): boolean {
  if (isUnreviewedDraft(i)) return false;
  if (i.billing === "covered" || i.billing === "build_item") return true;
  return i.billing === "out_of_scope" && !!i.quote_accepted_at;
}

export const KIND_LABEL: Record<IssueKind, string> = {
  bug: "Bug",
  change: "Change",
  question: "Question",
  task: "Task",
};

/** Portal intake picker — phrased for non-technical clients. */
export const PORTAL_KINDS: { id: IssueKind; label: string; hint: string }[] = [
  {
    id: "bug",
    label: "Something's broken",
    hint: "An error, a page not working, a payment problem",
  },
  {
    id: "change",
    label: "Request a change",
    hint: "Something new, or something done differently",
  },
  {
    id: "question",
    label: "Ask a question",
    hint: "How something works, or anything else",
  },
];

export const SEVERITY_META: Record<
  IssueSeverity,
  {
    label: string;
    tone: "accent" | "success" | "warning" | "danger" | "muted";
    dueDays: number;
  }
> = {
  critical: { label: "Critical", tone: "danger", dueDays: 1 },
  high: { label: "High", tone: "warning", dueDays: 3 },
  normal: { label: "Normal", tone: "accent", dueDays: 7 },
  low: { label: "Low", tone: "muted", dueDays: 14 },
};

export const STATUS_TONE: Record<
  IssueStatus,
  "accent" | "success" | "warning" | "danger" | "muted"
> = {
  new: "warning",
  triaged: "muted",
  queued: "accent",
  batched: "accent",
  in_progress: "accent",
  awaiting_client: "warning",
  fixed: "success",
  shipped: "success",
  closed: "muted",
};

/** Honest client-facing labels — what the portal shows instead of internal jargon. */
export const CLIENT_STATUS_LABEL: Record<IssueStatus, string> = {
  new: "Received",
  triaged: "Reviewed",
  queued: "Queued for the next fix batch",
  batched: "Being worked on",
  in_progress: "Being worked on",
  awaiting_client: "Waiting on you",
  fixed: "Fixed — going live shortly",
  shipped: "Live",
  closed: "Closed",
};

export const BILLING_LABEL: Record<IssueBilling, string> = {
  unclassified: "Unclassified",
  covered: "Covered by plan",
  build_item: "Build item",
  out_of_scope: "Needs a quote",
};

export const BILLING_TONE: Record<
  IssueBilling,
  "accent" | "success" | "warning" | "danger" | "muted"
> = {
  unclassified: "muted",
  covered: "success",
  build_item: "accent",
  out_of_scope: "warning",
};

export const SOURCE_LABEL: Record<IssueSource, string> = {
  portal: "Portal",
  whatsapp: "WhatsApp",
  email: "Email",
  zoom: "Zoom",
  phone: "Phone",
  internal: "Internal",
  monitor: "Monitor",
};

/** Due date derived from severity when an issue is triaged. */
export function dueAtFor(severity: IssueSeverity, from: Date = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + SEVERITY_META[severity].dueDays);
  return d.toISOString();
}
