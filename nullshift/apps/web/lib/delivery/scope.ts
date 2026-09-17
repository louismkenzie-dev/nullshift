/**
 * Which scope version governs a project's acceptance (brief §5.5 "agreed
 * scope/version", §9). Pure. Today the evidence is either an accepted Order
 * Form (0030) or an accepted proposal snapshot (0025); the redesign's document
 * model will add its own refs without changing the callers.
 */

export type OrderFormLike = {
  reference: string;
  status: string;
  accepted_at: string | null;
  superseded_by: string | null;
  project_id?: string | null;
  scope?: { deliverables?: unknown; acceptanceCriteria?: unknown } | null;
};

export type ProjectLike = {
  id: string;
  proposal_status?: string | null;
  accepted_at?: string | null;
  accepted_snapshot?: {
    deliverables?: unknown;
    scope?: { deliverables?: unknown };
  } | null;
};

export type GoverningScope = {
  ref: string;
  label: string;
  /** Deliverable → acceptance criterion pairs to review, in order. */
  deliverables: { deliverable: string; criteria: string }[];
  source: "order_form" | "proposal";
};

const strings = (v: unknown): string[] =>
  Array.isArray(v)
    ? v
        .filter((s): s is string => typeof s === "string" && s.trim() !== "")
        .map((s) => s.trim())
    : [];

function pairs(
  deliverables: string[],
  criteria: string[]
): { deliverable: string; criteria: string }[] {
  const list = deliverables.length
    ? deliverables
    : ["The whole build as described in the agreement"];
  return list.map((d, i) => ({
    deliverable: d,
    criteria: criteria[i] ?? criteria[0] ?? "Works as described in the agreed scope.",
  }));
}

/**
 * The governing scope: the accepted, non-superseded Order Form for the project
 * (or the tenant's only accepted form when none names the project), else the
 * accepted proposal, else null — with nothing to accept against, the portal
 * explains that rather than inventing a version.
 */
export function governingScope(
  project: ProjectLike | null,
  orderForms: OrderFormLike[]
): GoverningScope | null {
  if (!project) return null;
  const accepted = orderForms
    .filter((o) => o.status === "accepted" && o.accepted_at && !o.superseded_by)
    .sort((a, b) => (b.accepted_at ?? "").localeCompare(a.accepted_at ?? ""));
  const of =
    accepted.find((o) => o.project_id === project.id) ??
    accepted.find((o) => !o.project_id) ??
    null;
  if (of) {
    return {
      ref: `order_form:${of.reference}`,
      label: `Order Form ${of.reference}`,
      deliverables: pairs(
        strings(of.scope?.deliverables),
        strings(of.scope?.acceptanceCriteria)
      ),
      source: "order_form",
    };
  }
  if (project.proposal_status === "accepted") {
    const snap = project.accepted_snapshot;
    const dl = strings(snap?.deliverables).length
      ? strings(snap?.deliverables)
      : strings(snap?.scope?.deliverables);
    return {
      ref: `proposal:${project.id}:v1`,
      label: "Accepted proposal",
      deliverables: pairs(dl, []),
      source: "proposal",
    };
  }
  return null;
}
