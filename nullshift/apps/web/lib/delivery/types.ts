/**
 * Delivery model — build acceptance, checklist tasks and handover tasks
 * (brief §5.5, §5.10, §8.2, §8.5–8.6). Pure types shared by the generators,
 * the plan gate and the portal pages. The shapes mirror migration
 * 0060_build_acceptance_checklists.sql column for column so a row can be
 * rendered without translation.
 */

/** §8.6 task states. `waived` is a state with a reason; it is never completion. */
export const TASK_STATES = [
  "not_started",
  "in_progress",
  "awaiting_client",
  "blocked",
  "complete",
  "not_applicable",
  "waived",
] as const;
export type TaskState = (typeof TASK_STATES)[number];

export const isTaskState = (v: unknown): v is TaskState =>
  typeof v === "string" && (TASK_STATES as readonly string[]).includes(v);

/** The states a client may put their OWN task into (mirrors the SQL function). */
export const CLIENT_SETTABLE_STATES = ["not_started", "in_progress", "complete"] as const;
export type ClientSettableState = (typeof CLIENT_SETTABLE_STATES)[number];

/** States a client can never leave: they are Nullshift decisions. */
export const CLIENT_LOCKED_STATES = ["waived", "not_applicable", "blocked"] as const;

export type OwnerKind = "nullshift" | "client";
export type Journey = "initial" | "later";

/** The service route the later journey branches on (brief §5.10, §8.3–8.5). */
export type ServiceRoute = "managed" | "independent" | "unresolved";

export type TaskEvidence = {
  kind: "note" | "link" | "document" | "provider" | "record";
  ref?: string;
  note?: string;
  /** ISO timestamp. */
  at?: string;
  /** Who supplied it — a user id or a label such as "client" / "staff". */
  by?: string;
};

/** A checklist task as generated (unsaved) or as read from `checklist_tasks`. */
export type ChecklistTask = {
  id?: string;
  tenant_id?: string;
  project_id?: string | null;
  arrangement_id?: string | null;
  journey: Journey;
  key: string;
  label: string;
  why: string;
  owner_kind: OwnerKind;
  state: TaskState;
  waived_by?: string | null;
  waiver_reason?: string | null;
  waiver_approver?: string | null;
  evidence: TaskEvidence[];
  due_at?: string | null;
  requirement_source: string;
  completed_at?: string | null;
};

/** A handover task as generated or as read from `handover_tasks`. */
export type HandoverTask = {
  id?: string;
  tenant_id?: string;
  arrangement_id?: string | null;
  key: string;
  label: string;
  why: string;
  owner_kind: OwnerKind;
  state: TaskState;
  waived_by?: string | null;
  waiver_reason?: string | null;
  waiver_approver?: string | null;
  evidence: TaskEvidence[];
  due_at?: string | null;
  requirement_source: string;
  completed_at?: string | null;
};

/** Per-deliverable acceptance evidence (brief §5.5). */
export type DeliverableEvidence = {
  deliverable: string;
  criteria: string;
  /** The client's verdict on this deliverable. */
  met: boolean;
  /** What shows it: a link, a test note, a screenshot reference. */
  evidence: string;
  client_comment: string;
};

export type OutstandingDefect = {
  ref: string;
  summary: string;
  owner: OwnerKind;
};

export type AcceptedRole = "client_signatory" | "staff";
export type AcceptanceMethod =
  | "portal"
  | "staff_recorded"
  | "email"
  | "meeting"
  | "document";

/** A `build_acceptances` row (or the record about to become one). */
export type BuildAcceptance = {
  id?: string;
  tenant_id: string;
  project_id: string;
  scope_version_ref: string;
  accepted_by_user: string | null;
  accepted_by_name: string;
  accepted_role: AcceptedRole;
  method: AcceptanceMethod;
  accepted_at: string;
  evidence: DeliverableEvidence[];
  partial: boolean;
  disputed: boolean;
  defects_outstanding: OutstandingDefect[];
  notes: string | null;
  recorded_by?: string | null;
};

/** The minimal evidence the plan gate needs (brief §3.3 #3). */
export type AcceptanceEvidence = Pick<
  BuildAcceptance,
  "scope_version_ref" | "partial" | "disputed"
>;
