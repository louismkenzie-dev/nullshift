/**
 * Client next actions (brief §5.4) — pure model and supersede semantics.
 *
 * One open, owned next action per client. Setting a new one supersedes the
 * open row (state → `superseded`, lineage kept) and inserts a fresh open row;
 * setting an identical action is a no-op, never a duplicate. The database
 * enforces the invariant with a partial unique index (migration 0058); this
 * module decides the plan so the rule is testable without a database.
 */

export const NEXT_ACTION_STATES = ["open", "done", "superseded"] as const;
export type NextActionState = (typeof NEXT_ACTION_STATES)[number];

export type NextActionRow = {
  id: string;
  tenant_id: string;
  project_id: string | null;
  text: string;
  owner: string;
  owner_user: string | null;
  due_at: string | null; // ISO date (YYYY-MM-DD)
  state: NextActionState;
  source: string;
  created_by: string | null;
  completed_at: string | null;
  superseded_by_id: string | null;
  created_at: string;
  updated_at: string;
};

export type NextActionInput = {
  tenantId: string;
  projectId?: string | null;
  text: string;
  owner: string;
  ownerUser?: string | null;
  dueAt?: string | null;
  source?: string;
};

export type ValidatedNextAction = {
  tenantId: string;
  projectId: string | null;
  text: string;
  owner: string;
  ownerUser: string | null;
  dueAt: string | null;
  source: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const NEXT_ACTION_TEXT_MAX = 280;
export const NEXT_ACTION_OWNER_MAX = 80;

export type Validation =
  | { ok: true; value: ValidatedNextAction }
  | { ok: false; reason: "invalid"; message: string };

export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

/** Validate raw (form) input. Rejects anything that would be junk in the strip. */
export function validateNextActionInput(raw: Partial<NextActionInput>): Validation {
  if (!isUuid(raw.tenantId)) {
    return { ok: false, reason: "invalid", message: "A client (tenant id) is required." };
  }
  const tenantId = raw.tenantId;
  const projectId = raw.projectId ?? null;
  if (projectId !== null && !isUuid(projectId)) {
    return { ok: false, reason: "invalid", message: "Project id is not a valid id." };
  }
  const text = (raw.text ?? "").trim().replace(/\s+/g, " ");
  if (!text)
    return { ok: false, reason: "invalid", message: "Next action text is required." };
  if (text.length > NEXT_ACTION_TEXT_MAX) {
    return {
      ok: false,
      reason: "invalid",
      message: `Next action text must be ${NEXT_ACTION_TEXT_MAX} characters or fewer.`,
    };
  }
  const owner = (raw.owner ?? "").trim();
  if (!owner) return { ok: false, reason: "invalid", message: "An owner is required." };
  if (owner.length > NEXT_ACTION_OWNER_MAX) {
    return { ok: false, reason: "invalid", message: "Owner name is too long." };
  }
  const ownerUser = raw.ownerUser ?? null;
  if (ownerUser !== null && !isUuid(ownerUser)) {
    return { ok: false, reason: "invalid", message: "Owner user is not a valid id." };
  }
  const dueAt = raw.dueAt ? raw.dueAt.trim() : null;
  if (dueAt !== null && (!DATE_RE.test(dueAt) || Number.isNaN(Date.parse(dueAt)))) {
    return { ok: false, reason: "invalid", message: "Due date must be a calendar date." };
  }
  const source = (raw.source ?? "manual").trim() || "manual";
  return {
    ok: true,
    value: { tenantId, projectId, text, owner, ownerUser, dueAt, source },
  };
}

/** True when an open row already says exactly this (same text, owner, due, project). */
export function isSameAction(open: NextActionRow, v: ValidatedNextAction): boolean {
  return (
    open.text.trim().replace(/\s+/g, " ") === v.text &&
    open.owner.trim() === v.owner &&
    (open.due_at ?? null) === v.dueAt &&
    (open.project_id ?? null) === v.projectId
  );
}

export type SetPlan =
  | { kind: "noop"; reason: "unchanged"; keep: NextActionRow }
  | { kind: "insert"; supersede: null; insert: ValidatedNextAction }
  | { kind: "supersede"; supersede: NextActionRow; insert: ValidatedNextAction };

/**
 * Decide what "set next action" does given the client's current open row.
 * Never returns a plan that leaves two open rows or duplicates an identical one.
 */
export function planSetNextAction(
  open: NextActionRow | null,
  value: ValidatedNextAction
): SetPlan {
  if (!open) return { kind: "insert", supersede: null, insert: value };
  if (open.state !== "open") {
    // Caller passed a non-open row; treat as no open action.
    return { kind: "insert", supersede: null, insert: value };
  }
  if (open.tenant_id !== value.tenantId) {
    throw new Error("planSetNextAction: open row belongs to a different tenant");
  }
  if (isSameAction(open, value)) return { kind: "noop", reason: "unchanged", keep: open };
  return { kind: "supersede", supersede: open, insert: value };
}

/**
 * Apply a plan to an in-memory list (used by tests and the fixture what-if).
 * Mirrors the database sequence: supersede first, insert, then link lineage.
 */
export function applySetPlan(
  rows: NextActionRow[],
  plan: SetPlan,
  ids: { newId: string; now: string; createdBy: string | null }
): NextActionRow[] {
  if (plan.kind === "noop") return rows;
  const v = plan.insert;
  const inserted: NextActionRow = {
    id: ids.newId,
    tenant_id: v.tenantId,
    project_id: v.projectId,
    text: v.text,
    owner: v.owner,
    owner_user: v.ownerUser,
    due_at: v.dueAt,
    state: "open",
    source: v.source,
    created_by: ids.createdBy,
    completed_at: null,
    superseded_by_id: null,
    created_at: ids.now,
    updated_at: ids.now,
  };
  const next = rows.map((r) =>
    plan.kind === "supersede" && r.id === plan.supersede.id
      ? {
          ...r,
          state: "superseded" as const,
          superseded_by_id: ids.newId,
          updated_at: ids.now,
        }
      : r
  );
  return [...next, inserted];
}

export type CompletePlan =
  | { ok: true; row: NextActionRow }
  | { ok: false; reason: "not_found" | "not_open" | "wrong_tenant" };

/** Completing marks the open row done; a superseded or done row cannot be completed again. */
export function planCompleteNextAction(
  row: NextActionRow | null,
  tenantId: string
): CompletePlan {
  if (!row) return { ok: false, reason: "not_found" };
  if (row.tenant_id !== tenantId) return { ok: false, reason: "wrong_tenant" };
  if (row.state !== "open") return { ok: false, reason: "not_open" };
  return { ok: true, row };
}

/** The single open action for a tenant, or null. Throws if the invariant is broken. */
export function openActionFor(
  rows: NextActionRow[],
  tenantId: string
): NextActionRow | null {
  const open = rows.filter((r) => r.tenant_id === tenantId && r.state === "open");
  if (open.length > 1) {
    throw new Error(`invariant: ${open.length} open next actions for tenant ${tenantId}`);
  }
  return open[0] ?? null;
}

/** Overdue when the due date is before today (UTC calendar dates). */
export function isOverdue(
  row: Pick<NextActionRow, "due_at" | "state">,
  today: string
): boolean {
  return row.state === "open" && !!row.due_at && row.due_at < today;
}
