import {
  BILLING_LABEL,
  KIND_LABEL,
  SEVERITY_META,
  SOURCE_LABEL,
  type IssueBilling,
  type IssueKind,
  type IssueSeverity,
  type IssueSource,
  type IssueStatus,
} from "@/lib/ops/issues";
import { WORK_CLASSIFICATIONS } from "@nullshift/content/legal/work";

/**
 * The option lists the issue forms (quick-add, inline triage, the inbox paste
 * form) validate against — shared by the issue bank, the ingest inbox and the
 * per-client Issues and Bugs tile so every surface accepts exactly the same
 * values. Plain data: no server code, so it can be imported anywhere.
 */

export const STATUS_FILTERS: IssueStatus[] = [
  "new",
  "triaged",
  "queued",
  "batched",
  "in_progress",
  "awaiting_client",
  "fixed",
  "shipped",
];
export const ALL_STATUSES: IssueStatus[] = [...STATUS_FILTERS, "closed"];
export const KINDS = Object.keys(KIND_LABEL) as IssueKind[];
export const CLASSIFICATIONS = WORK_CLASSIFICATIONS.map((w) => w.id);
/** Statuses that mean work has been approved for build (spec §8). */
export const BUILD_STATUSES: IssueStatus[] = ["queued", "batched", "in_progress"];
export const SEVERITIES = Object.keys(SEVERITY_META) as IssueSeverity[];
export const BILLINGS = Object.keys(BILLING_LABEL) as IssueBilling[];
export const SOURCES = Object.keys(SOURCE_LABEL) as IssueSource[];
/** Sources the ingest inbox accepts a paste from. */
export const PASTE_SOURCES: IssueSource[] = ["whatsapp", "zoom", "email", "phone"];

/** Issues that cannot be scheduled until a Change Order is signed (§8). */
export const needsChangeOrder = (i: {
  classification: string | null;
  change_order_id: string | null;
}) =>
  (i.classification === "additional_development" || i.classification === "mixed") &&
  !i.change_order_id;
