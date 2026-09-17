/**
 * Pure mapping from a persisted quote version (0057) to the Quote Studio
 * shape in lib/next/fixtures.ts. Money leaves minor units here; nothing else
 * changes. The Studio's status union stops at "Issued", so every post-issue
 * status renders as "Issued" with the true state spelled out in `savedAt`.
 */
import type { Quote, QuoteStep } from "@/lib/next/fixtures";
import { STATUS_LABEL } from "./stateMachine";
import type { OpportunityRow, QuoteRow, QuoteVersionRow } from "./types";

const STUDIO_STATUS: Record<QuoteVersionRow["status"], Quote["status"]> = {
  draft: "Draft",
  internal_review: "Internal review",
  approved_to_issue: "Approved to issue",
  issued: "Issued",
  accepted: "Issued",
  declined: "Issued",
  expired: "Issued",
  superseded: "Issued",
  withdrawn: "Issued",
};

const STEP_ORDER: QuoteStep[] = [
  "Brief",
  "Scope",
  "Delivery estimate",
  "Commercial model",
  "Review & approval",
  "Client preview",
];

export const minorToMajor = (minor: number | undefined | null): number =>
  Math.round(minor ?? 0) / 100;

export function formatDateUk(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatTimeUk(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/** Which steps hold content, in order; the first empty one is "current". */
export function deriveSteps(v: QuoteVersionRow): Quote["steps"] {
  const done: boolean[] = [
    (v.brief.outcomes?.length ?? 0) > 0,
    (v.scope.included?.length ?? 0) > 0,
    (v.estimate.packages?.length ?? 0) > 0,
    (v.commercial.build_price_minor ?? 0) > 0 ||
      (v.commercial.route ?? "unresolved") !== "unresolved",
    v.status !== "draft" && v.status !== "internal_review",
    v.issued_at !== null,
  ];
  let currentSet = false;
  return STEP_ORDER.map((name, i) => {
    if (done[i]) return { name, state: "complete" as const };
    if (!currentSet) {
      currentSet = true;
      return { name, state: "current" as const };
    }
    return { name, state: "todo" as const };
  });
}

export function toStudioQuote(
  version: QuoteVersionRow,
  quote: QuoteRow,
  opportunity: OpportunityRow
): Quote {
  const clientName = opportunity.trading_name || opportunity.legal_name;
  const stateNote =
    version.status === "draft" ||
    version.status === "internal_review" ||
    version.status === "approved_to_issue"
      ? `Saved ${formatTimeUk(version.updated_at)}`
      : `${STATUS_LABEL[version.status]} ${formatDateUk(version.updated_at)} · read-only`;

  return {
    id: version.id,
    clientId: quote.tenant_id ?? opportunity.id,
    client: clientName,
    project: quote.project_label,
    version: `v${version.version_no}`,
    status: STUDIO_STATUS[version.status],
    expires: formatDateUk(version.expires_at),
    savedAt: stateNote,
    steps: deriveSteps(version),
    brief: {
      outcomes: version.brief.outcomes ?? [],
      users: version.brief.users ?? "",
      constraints: version.brief.constraints ?? "",
      confidence: version.brief.confidence ?? "low",
    },
    scope: {
      included: version.scope.included ?? [],
      excluded: version.scope.excluded ?? [],
      acceptance: version.scope.acceptance ?? [],
    },
    estimate: {
      packages: (version.estimate.packages ?? []).map((p) => ({ ...p })),
      contingencyPct: version.estimate.contingency_pct ?? 0,
      warrantyReserveGbp: minorToMajor(version.estimate.warranty_reserve_minor),
    },
    commercial: {
      buildPriceGbp: minorToMajor(version.commercial.build_price_minor),
      milestones: (version.commercial.milestones ?? []).map((m) => ({ ...m })),
      route: version.commercial.route ?? "unresolved",
      runState: version.commercial.run_state ?? "Not assessed",
      growOptions: (version.commercial.grow_options ?? []).map((g) => ({
        name: g.name,
        basis: g.basis,
        fromGbp: minorToMajor(g.from_minor),
      })),
      transact: version.commercial.transact ?? "Unknown",
    },
    internal: {
      riskAdjustedCostGbp: minorToMajor(version.internal.risk_adjusted_cost_minor),
      minMarginPct: version.internal.min_margin_pct ?? 0,
      targetMarginPct: version.internal.target_margin_pct ?? 0,
      approvedPriceGbp: minorToMajor(version.internal.approved_price_minor),
      approver: version.internal.approver ?? "—",
      ...(version.internal.override_reason
        ? { overrideReason: version.internal.override_reason }
        : {}),
    },
    checks: (version.internal.checks ?? []).map((c) => ({ ...c })),
  };
}
