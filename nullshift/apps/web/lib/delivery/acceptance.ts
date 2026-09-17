/**
 * Build acceptance — pure rules (brief §5.5, §8.2, §17.1 rows 2, 3, 5).
 *
 * What an acceptance record can and cannot do is fixed here, not in the UI:
 *  - it records who accepted what scope version, with evidence per deliverable,
 *    client comments and outstanding defects;
 *  - it is `partial` when any deliverable is unmet or defects are listed, and
 *    `disputed` when the client says so — both are recorded, neither is hidden;
 *  - it never selects a Run package, never marks an invoice paid and never
 *    records a signature (the result type has no such fields);
 *  - one clean (non-partial, non-disputed) acceptance per (project, scope
 *    version): a second is refused in code before the database refuses it.
 */

import type {
  AcceptanceEvidence,
  AcceptanceMethod,
  AcceptedRole,
  BuildAcceptance,
  DeliverableEvidence,
  OutstandingDefect,
} from "./types";

export const ACCEPTANCE_METHODS: readonly AcceptanceMethod[] = [
  "portal",
  "staff_recorded",
  "email",
  "meeting",
  "document",
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string =>
  typeof v === "string" && UUID_RE.test(v);

/** What the client (or staff) submits. */
export type AcceptanceInput = {
  tenantId: string;
  projectId: string;
  scopeVersionRef: string;
  acceptedByName: string;
  acceptedRole: AcceptedRole;
  method: AcceptanceMethod;
  /** Set for portal acceptances (auth user id); null when staff record one. */
  acceptedByUser: string | null;
  deliverables: DeliverableEvidence[];
  defects: OutstandingDefect[];
  /** The client explicitly disputes the build. */
  disputed: boolean;
  notes: string | null;
};

export type AcceptanceOutcome = "accepted" | "accepted_with_exceptions" | "disputed";

export function acceptanceOutcome(
  a: Pick<BuildAcceptance, "partial" | "disputed">
): AcceptanceOutcome {
  if (a.disputed) return "disputed";
  return a.partial ? "accepted_with_exceptions" : "accepted";
}

export const OUTCOME_LABEL: Record<AcceptanceOutcome, string> = {
  accepted: "Accepted",
  accepted_with_exceptions: "Accepted with listed exceptions",
  disputed: "Disputed",
};

/**
 * Partial = any deliverable unmet or any defect listed. Disputed is the
 * client's explicit word and is recorded whatever the deliverables say.
 */
export function deriveFlags(
  deliverables: DeliverableEvidence[],
  defects: OutstandingDefect[],
  disputed: boolean
): { partial: boolean; disputed: boolean } {
  const unmet = deliverables.some((d) => d.met === false);
  return { partial: unmet || defects.length > 0, disputed: !!disputed };
}

const clean = (s: unknown, max = 2000): string =>
  typeof s === "string" ? s.trim().slice(0, max) : "";

export type Validated =
  | { ok: true; value: AcceptanceInput }
  | { ok: false; message: string };

/** Validate and normalise an acceptance submission. */
export function validateAcceptanceInput(raw: Partial<AcceptanceInput>): Validated {
  if (!isUuid(raw.tenantId)) return { ok: false, message: "Tenant id is not valid." };
  if (!isUuid(raw.projectId)) return { ok: false, message: "Project id is not valid." };
  const scope = clean(raw.scopeVersionRef, 200);
  if (!scope)
    return {
      ok: false,
      message: "There is no accepted scope version to accept against.",
    };
  const name = clean(raw.acceptedByName, 200);
  if (!name)
    return { ok: false, message: "Your name is required on the acceptance record." };
  if (raw.acceptedRole !== "client_signatory" && raw.acceptedRole !== "staff")
    return { ok: false, message: "Role is not valid." };
  if (!raw.method || !ACCEPTANCE_METHODS.includes(raw.method))
    return { ok: false, message: "Method is not valid." };
  if (raw.method === "portal" && !isUuid(raw.acceptedByUser))
    return {
      ok: false,
      message: "A portal acceptance must be made by a signed-in user.",
    };
  if (raw.acceptedRole === "staff" && raw.method === "portal")
    return {
      ok: false,
      message: "Staff cannot accept through the portal on the client's behalf.",
    };
  if (raw.acceptedRole === "client_signatory" && raw.method !== "portal")
    return {
      ok: false,
      message: "A client acceptance outside the portal is recorded by staff.",
    };
  const notes = clean(raw.notes) || null;
  if (raw.acceptedRole === "staff" && !notes)
    return {
      ok: false,
      message:
        "A staff-recorded acceptance needs a reason and the evidence reference in notes.",
    };

  const deliverables: DeliverableEvidence[] = (raw.deliverables ?? [])
    .map((d) => ({
      deliverable: clean(d?.deliverable, 300),
      criteria: clean(d?.criteria, 1000),
      met: d?.met !== false,
      evidence: clean(d?.evidence, 1000),
      client_comment: clean(d?.client_comment, 1000),
    }))
    .filter((d) => d.deliverable);
  if (deliverables.length === 0)
    return { ok: false, message: "At least one deliverable must be reviewed." };

  const defects: OutstandingDefect[] = (raw.defects ?? [])
    .map((d, i) => ({
      ref: clean(d?.ref, 40) || `D${i + 1}`,
      summary: clean(d?.summary, 500),
      owner: d?.owner === "client" ? ("client" as const) : ("nullshift" as const),
    }))
    .filter((d) => d.summary);

  return {
    ok: true,
    value: {
      tenantId: raw.tenantId,
      projectId: raw.projectId,
      scopeVersionRef: scope,
      acceptedByName: name,
      acceptedRole: raw.acceptedRole,
      method: raw.method,
      acceptedByUser: raw.acceptedRole === "staff" ? null : (raw.acceptedByUser ?? null),
      deliverables,
      defects,
      disputed: !!raw.disputed,
      notes,
    },
  };
}

/**
 * Decide whether the acceptance can be recorded given what already exists for
 * the same (project, scope version). A clean acceptance may not be recorded
 * twice; partial and disputed rows are always allowed (they are history).
 */
export function planRecordAcceptance(
  existing: AcceptanceEvidence[],
  value: AcceptanceInput,
  now: string,
  recordedBy: string | null
):
  | { ok: true; row: BuildAcceptance; outcome: AcceptanceOutcome }
  | { ok: false; reason: "already_accepted"; message: string } {
  const flags = deriveFlags(value.deliverables, value.defects, value.disputed);
  const cleanExists = existing.some(
    (e) => e.scope_version_ref === value.scopeVersionRef && !e.disputed && !e.partial
  );
  if (cleanExists && !flags.partial && !flags.disputed) {
    return {
      ok: false,
      reason: "already_accepted",
      message:
        "This scope version is already accepted. A new scope version needs a new acceptance.",
    };
  }
  const row: BuildAcceptance = {
    tenant_id: value.tenantId,
    project_id: value.projectId,
    scope_version_ref: value.scopeVersionRef,
    accepted_by_user: value.acceptedByUser,
    accepted_by_name: value.acceptedByName,
    accepted_role: value.acceptedRole,
    method: value.method,
    accepted_at: now,
    evidence: value.deliverables,
    partial: flags.partial,
    disputed: flags.disputed,
    defects_outstanding: value.defects,
    notes: value.notes,
    recorded_by: value.acceptedRole === "staff" ? recordedBy : null,
  };
  return { ok: true, row, outcome: acceptanceOutcome(row) };
}

/**
 * The acceptance that GOVERNS a scope version: the clean one if it exists,
 * else the latest partial one, else null. A disputed row never governs.
 */
export function governingAcceptance<
  T extends AcceptanceEvidence & { accepted_at?: string },
>(acceptances: T[], scopeVersionRef: string | null): T | null {
  if (!scopeVersionRef) return null;
  const forScope = acceptances.filter(
    (a) => a.scope_version_ref === scopeVersionRef && !a.disputed
  );
  const cleanRow = forScope.find((a) => !a.partial);
  if (cleanRow) return cleanRow;
  const partials = forScope
    .filter((a) => a.partial)
    .sort((a, b) => (b.accepted_at ?? "").localeCompare(a.accepted_at ?? ""));
  return partials[0] ?? null;
}

/** Summary line for the portal and the workspace. */
export function acceptanceSummary(a: BuildAcceptance): string {
  const outcome = OUTCOME_LABEL[acceptanceOutcome(a)];
  const who =
    a.accepted_role === "staff"
      ? `recorded by staff (${a.method.replace("_", " ")})`
      : a.accepted_by_name;
  const met = a.evidence.filter((d) => d.met).length;
  return `${outcome} · ${who} · ${met} of ${a.evidence.length} deliverables met · ${a.defects_outstanding.length} defects outstanding`;
}
