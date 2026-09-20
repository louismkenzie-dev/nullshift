/**
 * Agreements loaders for /admin/agreements (brief §9). Server-only, read-only,
 * service-role client. Real rows are mapped into the AgreementDocument view
 * model so the pure helpers in lib/next/fixtures-agreements (issueBlockers,
 * canIssue, filterAgreements, expiryState, sortAgreements) apply unchanged.
 *
 * Sources:
 *   order_forms               → "Project Order Form / SOW"      id = <uuid>
 *   change_orders             → "Change Order"                  id = co_<uuid>
 *   projects.proposal_status  → "Legacy proposal"               id = proposal_<project uuid>
 *   service_schedules (0059)  → "Managed service schedule"      id = ss_<uuid>   (optional)
 *   handover_schedules (0059) → "Independent handover schedule" id = hs_<uuid>   (optional)
 *   contract_acceptances, document_events → evidence and audit trail
 *   service_arrangements (0059) → service route + billing start facts (optional)
 *
 * The legacy editor at /admin/clients/[tenantId]/agreement remains the only
 * write surface; every id here is read-only.
 */
import { createServiceClient } from "@nullshift/db";
import { reviewState, type ReviewState } from "@/lib/legal/review";
import {
  DOCUMENT_TYPE_KEY,
  REVIEW_REQUIREMENTS,
  STATUS_KEY,
  type AgreementDocument,
  type AgreementFilters,
  type AgreementStatus,
  type AuditEvent,
  type PricingLine,
  type ReviewFilter,
  type RiskFlag,
  type ServiceRoute,
} from "@/lib/next/fixtures-agreements";

/* ── Row shapes ──────────────────────────────────────────── */

type TenantRow = { id: string; name: string };
type ProfileRow = { id: string; email: string | null; full_name: string | null };

type OrderFormRow = {
  id: string;
  tenant_id: string;
  project_id: string | null;
  reference: string;
  status: string;
  client_legal_name: string;
  client_company_number: string | null;
  client_billing_email: string;
  client_legal_email: string;
  plan: string;
  scale_band: string;
  pricing_version: string;
  monthly_fee: number | string;
  vat_treatment: string;
  billing_date_rule: string;
  project_fee: number | string | null;
  mobilisation_fee: number | string | null;
  invoice_schedule: unknown;
  scope: Record<string, unknown> | null;
  payment_architecture: string | null;
  payment_review_ref: string | null;
  payment_reviewed_by: string | null;
  application_fee_enabled: boolean | null;
  application_fee_percent: number | string | null;
  superseded_by: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  created_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

type ChangeOrderRow = {
  id: string;
  tenant_id: string;
  project_id: string | null;
  reference: string;
  status: string;
  order_form_id: string;
  supersedes_id: string | null;
  description: string;
  business_outcome: string;
  included: unknown;
  excluded: unknown;
  acceptance_criteria: unknown;
  project_fee: number | string;
  recurring_fee_delta: number | string | null;
  flags: Record<string, unknown> | null;
  contract_version: string | null;
  accepted_by_name: string | null;
  accepted_by_email: string | null;
  accepted_at: string | null;
  created_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

type AcceptanceRow = {
  id: string;
  tenant_id: string;
  order_form_id: string;
  accepted_by_name: string;
  accepted_by_title: string;
  accepted_by_email: string;
  msa_version: string;
  dpa_version: string | null;
  ai_schedule_version: string | null;
  payments_schedule_version: string | null;
  aup_version: string;
  pricing_version: string;
  document_hashes: Record<string, string> | null;
  accepted_at: string;
  ip_address: string | null;
  user_agent: string | null;
  acceptance_method: string;
  signed_artifact_path: string | null;
  application_fee_percent: number | string | null;
};

type DocumentEventRow = {
  id: string;
  tenant_id: string;
  document_type: string;
  document_id: string;
  event: string;
  actor: string | null;
  actor_kind: string;
  at: string;
  meta: Record<string, unknown> | null;
};

type ProjectRow = {
  id: string;
  tenant_id: string;
  name: string;
  stage: string;
  build_fee: number | string | null;
  proposal_status: string;
  proposal_sent_at: string | null;
  proposal_drafted_by: string | null;
  proposal_reviewed_by: string | null;
  proposal_reviewed_at: string | null;
  accepted_snapshot: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type ArrangementRow = {
  id: string;
  tenant_id: string;
  project_id: string | null;
  order_form_id: string | null;
  route: string;
  package_state: string;
  billing_start_arrangement: string;
  billing_start_date: string | null;
  approved_wording_ref: string | null;
  state: string;
};

type ScheduleRow = {
  id: string;
  arrangement_id: string;
  version_no: number;
  package_code?: string;
  inclusions?: unknown;
  exclusions?: unknown;
  amount_minor?: number | null;
  fee_minor?: number;
  currency: string;
  tax_basis: string;
  cadence?: string | null;
  start_date?: string | null;
  notice_days?: number | null;
  included_work?: unknown;
  status: string;
  created_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  issued_at: string | null;
  accepted_at: string | null;
  accepted_by_name: string | null;
  accepted_role: string | null;
  acceptance_method: string | null;
  created_at: string;
  updated_at: string;
};

/* ── Helpers ─────────────────────────────────────────────── */

type Db = ReturnType<typeof createServiceClient>;

async function optional<T>(run: () => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  try {
    const { data, error } = await run();
    if (error) return [];
    return (data ?? []) as T[];
  } catch {
    return [];
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: string): boolean => UUID_RE.test(v);

const toMinor = (v: number | string | null | undefined): number =>
  v === null || v === undefined ? 0 : Math.round(Number(v) * 100);

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

const day = (iso: string | null | undefined): string => (iso ? iso.slice(0, 10) : "");

const stamp = (iso: string): string => iso.replace("T", " ").slice(0, 16);

const taxBasisFor = (vat: string | null): PricingLine["taxBasis"] =>
  vat === "plus_vat" ? "ex VAT" : vat === "vat_included" ? "VAT included" : "not VAT registered";

const scheduleTaxBasis = (b: string): PricingLine["taxBasis"] =>
  b === "pending" ? "pending decision" : b === "standard_vat" ? "ex VAT" : "not VAT registered";

/** A person lookup for uuids stored on review / actor columns. */
class People {
  constructor(private readonly map: Map<string, ProfileRow>) {}
  name(id: string | null | undefined): string | null {
    if (!id) return null;
    const p = this.map.get(id);
    return p?.full_name || p?.email || id.slice(0, 8);
  }
}

function orderStatus(r: { status: string }, review: ReviewState): AgreementStatus {
  switch (r.status) {
    case "draft":
      return review.reviewedBy ? (review.canSend ? "Ready to issue" : "Needs internal review") : "Draft";
    case "client_review":
      return "Awaiting client";
    case "accepted":
    case "in_build":
    case "delivered":
    case "accepted_complete":
      return "Accepted";
    case "rejected":
      return "Rejected";
    case "withdrawn":
      return "Withdrawn";
    case "superseded":
      return "Superseded";
    default:
      return "Draft";
  }
}

function eventsToAudit(events: DocumentEventRow[], people: People): AuditEvent[] {
  return events.map((e) => ({
    at: stamp(e.at),
    actor: e.actor_kind === "system" ? "system" : (people.name(e.actor) ?? e.actor_kind),
    event:
      e.event === "sent"
        ? `Sent to client${typeof e.meta?.to === "string" ? ` (${e.meta.to})` : ""}`
        : e.event === "viewed"
          ? "Viewed by client"
          : e.event === "signed"
            ? "Signed"
            : "Approved for sending",
    kind: e.event === "signed" ? "acceptance" : e.event === "approved" ? "internal" : "evidence",
  }));
}

/* ── Mapping ─────────────────────────────────────────────── */

export type AcceptanceEvidence = {
  acceptedByName: string;
  acceptedByTitle: string;
  acceptedByEmail: string;
  acceptedAt: string;
  method: string;
  ipAddress: string | null;
  userAgent: string | null;
  versions: { label: string; value: string | null }[];
  hashedDocuments: string[];
  signedArtifactPath: string | null;
};

export type AgreementRecord = {
  doc: AgreementDocument;
  tenantId: string;
  /** The legacy editor / page that can change this record. */
  editorHref: string;
  evidence: AcceptanceEvidence | null;
  /** Raw review input for lib/legal/review.reviewState. */
  review: { author: string | null; reviewedBy: string | null; reviewedAt: string | null };
};

type Ctx = {
  tenants: Map<string, TenantRow>;
  people: People;
  projects: Map<string, ProjectRow>;
  acceptances: Map<string, AcceptanceRow>;
  events: DocumentEventRow[];
  arrangements: ArrangementRow[];
  quoteRefs: Map<string, string>;
};

const tenantName = (ctx: Ctx, id: string): string => ctx.tenants.get(id)?.name ?? "Unknown client";

function mapOrderForm(r: OrderFormRow, ctx: Ctx): AgreementRecord {
  const review = { author: r.created_by, reviewedBy: r.reviewed_by, reviewedAt: r.reviewed_at };
  const rs = reviewState(review);
  const acceptance = ctx.acceptances.get(r.id) ?? null;
  const arrangement = ctx.arrangements.find((a) => a.order_form_id === r.id && a.state === "active");
  const route: ServiceRoute = arrangement ? (arrangement.route as ServiceRoute) : "unresolved";
  const project = r.project_id ? ctx.projects.get(r.project_id) : undefined;

  const pricing: PricingLine[] = [
    {
      label: `Monthly service fee — ${r.plan} · ${r.scale_band} band`,
      amount: { minor: toMinor(r.monthly_fee), currency: "GBP" },
      cadence: "monthly",
      basis: `Pricing version ${r.pricing_version} · billing ${r.billing_date_rule}`,
      taxBasis: taxBasisFor(r.vat_treatment),
    },
  ];
  if (r.project_fee !== null && r.project_fee !== undefined) {
    pricing.push({
      label: "Project (build) fee",
      amount: { minor: toMinor(r.project_fee), currency: "GBP" },
      cadence: "one-off",
      basis: Array.isArray(r.invoice_schedule) && r.invoice_schedule.length ? `${r.invoice_schedule.length} invoice milestone(s)` : "Invoice schedule not set",
      taxBasis: taxBasisFor(r.vat_treatment),
    });
  }
  if (r.mobilisation_fee !== null && r.mobilisation_fee !== undefined && toMinor(r.mobilisation_fee) > 0) {
    pricing.push({
      label: "Mobilisation fee",
      amount: { minor: toMinor(r.mobilisation_fee), currency: "GBP" },
      cadence: "one-off",
      basis: "Order Form",
      taxBasis: taxBasisFor(r.vat_treatment),
    });
  }
  if (r.application_fee_enabled && r.application_fee_percent !== null) {
    pricing.push({
      label: `Stripe Connect application fee — ${Number(r.application_fee_percent)}%`,
      amount: { minor: 0, currency: "GBP" },
      cadence: "n/a",
      basis: "Percentage of client payment volume; fixed wording hashed at acceptance",
      taxBasis: "pending decision",
    });
  }

  const riskFlags: RiskFlag[] = [];
  if (r.payment_architecture) {
    const prohibited = r.payment_architecture === "nullshift_custody_PROHIBITED";
    const reviewed = r.payment_architecture.endsWith("_reviewed") || prohibited;
    riskFlags.push({
      label: `Payment architecture: ${r.payment_architecture.replace(/_/g, " ")}`,
      severity: prohibited ? "high" : reviewed ? "medium" : "low",
      resolved: !reviewed || !!r.payment_reviewed_by,
      requiresReview: reviewed,
      note: r.payment_review_ref
        ? `Regulatory review reference ${r.payment_review_ref}`
        : reviewed
          ? "Needs a regulatory-legal review reference before release"
          : "No review required for this architecture",
    });
  } else {
    riskFlags.push({
      label: "Payment architecture not recorded",
      severity: "medium",
      resolved: false,
      requiresReview: true,
      note: "Release hard-fails without a recorded payment architecture (§14).",
    });
  }

  const audit: AuditEvent[] = [
    { at: stamp(r.created_at), actor: ctx.people.name(r.created_by) ?? "staff", event: `Drafted ${r.reference}`, kind: "internal" },
  ];
  if (r.reviewed_at) audit.push({ at: stamp(r.reviewed_at), actor: ctx.people.name(r.reviewed_by) ?? "staff", event: "Approved by second person", kind: "internal" });
  if (r.sent_at) audit.push({ at: stamp(r.sent_at), actor: "staff", event: "Issued to client (client_review)", kind: "issue" });
  audit.push(...eventsToAudit(ctx.events.filter((e) => e.document_type === "order_form" && e.document_id === r.id), ctx.people));
  if (acceptance) {
    audit.push({
      at: stamp(acceptance.accepted_at),
      actor: `${acceptance.accepted_by_name} (${acceptance.accepted_by_title})`,
      event: `Accepted by ${acceptance.acceptance_method}`,
      kind: "acceptance",
      note: `MSA ${acceptance.msa_version} · pricing ${acceptance.pricing_version}`,
    });
  }
  audit.sort((a, b) => a.at.localeCompare(b.at));

  const doc: AgreementDocument = {
    id: r.id,
    clientId: r.tenant_id,
    client: tenantName(ctx, r.tenant_id),
    project: project?.name ?? r.reference,
    type: "Project Order Form / SOW",
    version: r.reference,
    status: orderStatus(r, rs),
    templateVersion: `pricing ${r.pricing_version}`,
    reviewRequirement: "second-person",
    supersededBy: r.superseded_by ?? undefined,
    facts: {
      legalEntity: r.client_legal_name,
      signatory: acceptance ? `${acceptance.accepted_by_name}, ${acceptance.accepted_by_title}` : undefined,
      serviceRoute: route,
      billingStart: arrangement
        ? {
            arrangement: arrangement.billing_start_arrangement.replace(/_/g, " "),
            exactDate: arrangement.billing_start_date ?? undefined,
            approvedWording: arrangement.billing_start_arrangement !== "unresolved",
          }
        : undefined,
      quoteRef: ctx.quoteRefs.has(r.id) ? { id: ctx.quoteRefs.get(r.id)!, version: "", stale: false } : undefined,
    },
    scope: {
      included: strings(r.scope?.included ?? r.scope?.deliverables),
      excluded: strings(r.scope?.excluded ?? r.scope?.exclusions),
      acceptance: strings(r.scope?.acceptance ?? r.scope?.acceptance_criteria),
    },
    pricing,
    riskFlags,
    review: { author: ctx.people.name(r.created_by), reviewedBy: ctx.people.name(r.reviewed_by), reviewedAt: r.reviewed_at ? stamp(r.reviewed_at) : null },
    internalNotes: [
      `Billing email ${r.client_billing_email} · legal email ${r.client_legal_email}`,
      r.client_company_number ? `Company number ${r.client_company_number}` : "No company number recorded",
    ],
    clientSummary: [
      `${r.plan} plan on the ${r.scale_band} band at ${(toMinor(r.monthly_fee) / 100).toLocaleString("en-GB", { style: "currency", currency: "GBP" })} per month`,
      r.project_fee ? `Project fee ${(toMinor(r.project_fee) / 100).toLocaleString("en-GB", { style: "currency", currency: "GBP" })}` : "No project fee",
    ],
    audit,
  };

  return {
    doc,
    tenantId: r.tenant_id,
    editorHref: `/admin/clients/${r.tenant_id}/agreement`,
    evidence: acceptance
      ? {
          acceptedByName: acceptance.accepted_by_name,
          acceptedByTitle: acceptance.accepted_by_title,
          acceptedByEmail: acceptance.accepted_by_email,
          acceptedAt: acceptance.accepted_at,
          method: acceptance.acceptance_method,
          ipAddress: acceptance.ip_address,
          userAgent: acceptance.user_agent,
          versions: [
            { label: "MSA", value: acceptance.msa_version },
            { label: "DPA", value: acceptance.dpa_version },
            { label: "AI schedule", value: acceptance.ai_schedule_version },
            { label: "Payments schedule", value: acceptance.payments_schedule_version },
            { label: "AUP", value: acceptance.aup_version },
            { label: "Pricing", value: acceptance.pricing_version },
            { label: "Application fee %", value: acceptance.application_fee_percent === null ? null : String(acceptance.application_fee_percent) },
          ],
          hashedDocuments: Object.keys(acceptance.document_hashes ?? {}),
          signedArtifactPath: acceptance.signed_artifact_path,
        }
      : null,
    review,
  };
}

function mapChangeOrder(r: ChangeOrderRow, parent: OrderFormRow | undefined, ctx: Ctx): AgreementRecord {
  const review = { author: r.created_by, reviewedBy: r.reviewed_by, reviewedAt: r.reviewed_at };
  const rs = reviewState(review);
  const project = r.project_id ? ctx.projects.get(r.project_id) : undefined;
  const pricing: PricingLine[] = [
    {
      label: "Change fee",
      amount: { minor: toMinor(r.project_fee), currency: "GBP" },
      cadence: "one-off",
      basis: r.reference,
      taxBasis: taxBasisFor(parent?.vat_treatment ?? null),
    },
  ];
  if (r.recurring_fee_delta !== null && r.recurring_fee_delta !== undefined) {
    pricing.push({
      label: "Recurring fee change",
      amount: { minor: toMinor(r.recurring_fee_delta), currency: "GBP" },
      cadence: "monthly",
      basis: "Delta to the governing Order Form's monthly fee",
      taxBasis: taxBasisFor(parent?.vat_treatment ?? null),
    });
  }
  const flags = r.flags ?? {};
  const riskFlags: RiskFlag[] = Object.entries(flags)
    .filter(([, v]) => v === true)
    .map(([k]) => ({ label: `${k.replace(/_/g, " ")} flag carried onto this change`, severity: "medium", resolved: !!r.reviewed_by, requiresReview: true, note: "Set on the change order; cleared by second-person review." }));

  const audit: AuditEvent[] = [
    { at: stamp(r.created_at), actor: ctx.people.name(r.created_by) ?? "staff", event: `Drafted ${r.reference}`, kind: "internal" },
  ];
  if (r.reviewed_at) audit.push({ at: stamp(r.reviewed_at), actor: ctx.people.name(r.reviewed_by) ?? "staff", event: "Approved by second person", kind: "internal" });
  audit.push(...eventsToAudit(ctx.events.filter((e) => e.document_type === "change_order" && e.document_id === r.id), ctx.people));
  if (r.accepted_at) audit.push({ at: stamp(r.accepted_at), actor: r.accepted_by_name ?? r.accepted_by_email ?? "client", event: "Accepted", kind: "acceptance", note: r.contract_version ? `Contract ${r.contract_version}` : undefined });
  audit.sort((a, b) => a.at.localeCompare(b.at));

  const doc: AgreementDocument = {
    id: `co_${r.id}`,
    clientId: r.tenant_id,
    client: tenantName(ctx, r.tenant_id),
    project: project?.name ?? r.description.slice(0, 60),
    type: "Change Order",
    version: r.reference,
    status: orderStatus(r, rs),
    templateVersion: r.contract_version ?? "change order",
    reviewRequirement: "second-person",
    supersedes: r.supersedes_id ? `co_${r.supersedes_id}` : undefined,
    facts: {
      legalEntity: parent?.client_legal_name,
      signatory: r.accepted_by_name ?? undefined,
      serviceRoute: "not applicable",
      governing: parent?.id,
    },
    scope: { included: strings(r.included), excluded: strings(r.excluded), acceptance: strings(r.acceptance_criteria) },
    pricing,
    riskFlags,
    review: { author: ctx.people.name(r.created_by), reviewedBy: ctx.people.name(r.reviewed_by), reviewedAt: r.reviewed_at ? stamp(r.reviewed_at) : null },
    internalNotes: [r.business_outcome],
    clientSummary: [r.description],
    audit,
  };
  return { doc, tenantId: r.tenant_id, editorHref: `/admin/clients/${r.tenant_id}/agreement`, evidence: null, review };
}

function mapProposal(p: ProjectRow, ctx: Ctx): AgreementRecord {
  const status: AgreementStatus =
    p.proposal_status === "accepted" ? "Accepted" : p.proposal_status === "declined" ? "Rejected" : "Awaiting client";
  const snap = p.accepted_snapshot ?? {};
  const fee = typeof snap.build_fee === "number" ? snap.build_fee : p.build_fee;
  const pricing: PricingLine[] = fee
    ? [{ label: "Build fee (proposal)", amount: { minor: toMinor(fee), currency: "GBP" }, cadence: "one-off", basis: "projects.build_fee / accepted snapshot", taxBasis: "as signed (historical)" }]
    : [];
  const audit: AuditEvent[] = [];
  if (p.proposal_sent_at) audit.push({ at: stamp(p.proposal_sent_at), actor: "staff", event: "Proposal sent", kind: "issue" });
  audit.push(...eventsToAudit(ctx.events.filter((e) => e.document_type === "proposal" && e.document_id === p.id), ctx.people));
  audit.sort((a, b) => a.at.localeCompare(b.at));
  const review = { author: p.proposal_drafted_by, reviewedBy: p.proposal_reviewed_by, reviewedAt: p.proposal_reviewed_at };
  const doc: AgreementDocument = {
    id: `proposal_${p.id}`,
    clientId: p.tenant_id,
    client: tenantName(ctx, p.tenant_id),
    project: p.name,
    type: "Legacy proposal",
    version: "proposal",
    status,
    templateVersion: "legacy proposal",
    reviewRequirement: "none",
    legacy: true,
    facts: { legalEntity: tenantName(ctx, p.tenant_id), serviceRoute: "not applicable" },
    scope: { included: strings(snap.scope ?? snap.deliverables), excluded: [], acceptance: [] },
    pricing,
    riskFlags: [],
    review: { author: ctx.people.name(p.proposal_drafted_by), reviewedBy: ctx.people.name(p.proposal_reviewed_by), reviewedAt: p.proposal_reviewed_at ? stamp(p.proposal_reviewed_at) : null },
    internalNotes: [`Project stage ${p.stage}`],
    clientSummary: [`Proposal for ${p.name}`],
    audit,
  };
  return { doc, tenantId: p.tenant_id, editorHref: `/admin/clients/${p.tenant_id}`, evidence: null, review };
}

function mapSchedule(kind: "service" | "handover", r: ScheduleRow, arr: ArrangementRow, ctx: Ctx): AgreementRecord {
  const review = { author: r.created_by, reviewedBy: r.reviewed_by, reviewedAt: r.reviewed_at };
  const rs = reviewState(review);
  const status: AgreementStatus =
    r.status === "accepted" ? "Accepted" : r.status === "superseded" ? "Superseded" : r.status === "issued" ? "Awaiting client" : rs.canSend ? "Ready to issue" : "Draft";
  const minor = kind === "service" ? (r.amount_minor ?? 0) : (r.fee_minor ?? 0);
  const project = arr.project_id ? ctx.projects.get(arr.project_id) : undefined;
  const audit: AuditEvent[] = [{ at: stamp(r.created_at), actor: ctx.people.name(r.created_by) ?? "staff", event: "Drafted", kind: "internal" }];
  if (r.reviewed_at) audit.push({ at: stamp(r.reviewed_at), actor: ctx.people.name(r.reviewed_by) ?? "staff", event: "Approved by second person", kind: "internal" });
  if (r.issued_at) audit.push({ at: stamp(r.issued_at), actor: "staff", event: "Issued to client", kind: "issue" });
  if (r.accepted_at) audit.push({ at: stamp(r.accepted_at), actor: r.accepted_by_name ?? "client", event: `Accepted by ${r.acceptance_method ?? "clickwrap"}`, kind: "acceptance" });
  const doc: AgreementDocument = {
    id: `${kind === "service" ? "ss" : "hs"}_${r.id}`,
    clientId: arr.tenant_id,
    client: tenantName(ctx, arr.tenant_id),
    project: project?.name ?? (kind === "service" ? `Service schedule (${r.package_code ?? "package"})` : "Handover schedule"),
    type: kind === "service" ? "Managed service schedule" : "Independent handover schedule",
    version: `v${r.version_no}`,
    status,
    templateVersion: kind === "service" ? (r.package_code ?? "schedule") : "handover",
    reviewRequirement: "second-person",
    facts: {
      legalEntity: tenantName(ctx, arr.tenant_id),
      signatory: r.accepted_by_name ? `${r.accepted_by_name}${r.accepted_role ? ` (${r.accepted_role})` : ""}` : undefined,
      serviceRoute: arr.route as ServiceRoute,
      billingStart:
        kind === "service"
          ? { arrangement: arr.billing_start_arrangement.replace(/_/g, " "), exactDate: r.start_date ?? arr.billing_start_date ?? undefined, approvedWording: arr.billing_start_arrangement !== "unresolved" }
          : undefined,
      governing: arr.order_form_id ?? undefined,
      noticePeriod: r.notice_days !== null && r.notice_days !== undefined ? `${r.notice_days} days` : undefined,
    },
    scope: { included: strings(kind === "service" ? r.inclusions : r.included_work), excluded: strings(r.exclusions), acceptance: [] },
    pricing: [
      {
        label: kind === "service" ? `Managed service — ${r.package_code ?? "package"}` : "Handover fee",
        amount: { minor, currency: "GBP" },
        cadence: kind === "service" ? "monthly" : "one-off",
        basis: kind === "service" ? `${r.cadence ?? "cadence not set"}` : "Fixed handover fee (brief §2.1)",
        taxBasis: scheduleTaxBasis(r.tax_basis),
      },
    ],
    riskFlags: [],
    review: { author: ctx.people.name(r.created_by), reviewedBy: ctx.people.name(r.reviewed_by), reviewedAt: r.reviewed_at ? stamp(r.reviewed_at) : null },
    internalNotes: [],
    clientSummary: [kind === "service" ? "Ongoing managed service" : "Independent handover"],
    audit,
  };
  return { doc, tenantId: arr.tenant_id, editorHref: `/admin/clients/${arr.tenant_id}/agreement`, evidence: null, review };
}

/* ── Loading ─────────────────────────────────────────────── */

async function loadContext(db: Db): Promise<Ctx & { orders: OrderFormRow[]; changes: ChangeOrderRow[]; schedules: ScheduleRow[]; handovers: ScheduleRow[]; proposals: ProjectRow[] }> {
  const [tenants, profiles, projects, orders, changes, acceptances, events, arrangements, schedules, handovers] = await Promise.all([
    db.from("tenants").select("id, name").eq("type", "client"),
    db.from("profiles").select("id, email, full_name"),
    db
      .from("projects")
      .select("id, tenant_id, name, stage, build_fee, proposal_status, proposal_sent_at, proposal_drafted_by, proposal_reviewed_by, proposal_reviewed_at, accepted_snapshot, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(200),
    db.from("order_forms").select("*").order("created_at", { ascending: false }).limit(100),
    db.from("change_orders").select("*").order("created_at", { ascending: false }).limit(100),
    db.from("contract_acceptances").select("*").order("accepted_at", { ascending: false }).limit(200),
    db.from("document_events").select("*").order("at", { ascending: true }).limit(500),
    optional<ArrangementRow>(() => db.from("service_arrangements").select("id, tenant_id, project_id, order_form_id, route, package_state, billing_start_arrangement, billing_start_date, approved_wording_ref, state")),
    optional<ScheduleRow>(() => db.from("service_schedules").select("*").order("created_at", { ascending: false }).limit(100)),
    optional<ScheduleRow>(() => db.from("handover_schedules").select("*").order("created_at", { ascending: false }).limit(100)),
  ]);
  for (const [name, r] of [["tenants", tenants], ["profiles", profiles], ["projects", projects], ["order_forms", orders], ["change_orders", changes], ["contract_acceptances", acceptances], ["document_events", events]] as const) {
    if (r.error) throw new Error(`${name} read failed: ${r.error.message}`);
  }
  const projectRows = (projects.data ?? []) as ProjectRow[];
  const acceptanceRows = (acceptances.data ?? []) as AcceptanceRow[];
  const acceptanceByOrder = new Map<string, AcceptanceRow>();
  for (const a of acceptanceRows) if (!acceptanceByOrder.has(a.order_form_id)) acceptanceByOrder.set(a.order_form_id, a);
  return {
    tenants: new Map(((tenants.data ?? []) as TenantRow[]).map((t) => [t.id, t])),
    people: new People(new Map(((profiles.data ?? []) as ProfileRow[]).map((p) => [p.id, p]))),
    projects: new Map(projectRows.map((p) => [p.id, p])),
    acceptances: acceptanceByOrder,
    events: (events.data ?? []) as DocumentEventRow[],
    arrangements,
    quoteRefs: new Map(),
    orders: (orders.data ?? []) as OrderFormRow[],
    changes: (changes.data ?? []) as ChangeOrderRow[],
    schedules,
    handovers,
    proposals: projectRows.filter((p) => p.proposal_status !== "draft"),
  };
}

function mapAll(ctx: Awaited<ReturnType<typeof loadContext>>): AgreementRecord[] {
  const orderById = new Map(ctx.orders.map((o) => [o.id, o]));
  const arrById = new Map(ctx.arrangements.map((a) => [a.id, a]));
  const out: AgreementRecord[] = [];
  for (const o of ctx.orders) out.push(mapOrderForm(o, ctx));
  for (const c of ctx.changes) out.push(mapChangeOrder(c, orderById.get(c.order_form_id), ctx));
  for (const s of ctx.schedules) {
    const arr = arrById.get(s.arrangement_id);
    if (arr) out.push(mapSchedule("service", s, arr, ctx));
  }
  for (const h of ctx.handovers) {
    const arr = arrById.get(h.arrangement_id);
    if (arr) out.push(mapSchedule("handover", h, arr, ctx));
  }
  for (const p of ctx.proposals) out.push(mapProposal(p, ctx));
  return out;
}

export type AgreementsLibrary = {
  records: AgreementRecord[];
  clients: { id: string; name: string }[];
  /** 0059 tables reachable on this read. */
  arrangementsAvailable: boolean;
  asAt: string;
};

export async function loadAgreementsLibrary(): Promise<AgreementsLibrary> {
  const db = createServiceClient();
  const ctx = await loadContext(db);
  const records = mapAll(ctx);
  const clientIds = [...new Set(records.map((r) => r.tenantId))];
  const clients = clientIds
    .map((id) => ({ id, name: ctx.tenants.get(id)?.name ?? "Unknown client" }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return {
    records,
    clients,
    arrangementsAvailable: ctx.arrangements.length > 0 || ctx.schedules.length > 0,
    asAt: new Date().toISOString(),
  };
}

export async function loadAgreement(id: string): Promise<AgreementRecord | null> {
  const raw = id.replace(/^(co|ss|hs|proposal)_/, "");
  if (!isUuid(raw)) return null;
  const db = createServiceClient();
  const ctx = await loadContext(db);
  return mapAll(ctx).find((r) => r.doc.id === id) ?? null;
}

/** Parse untrusted search params against the documents actually loaded. */
export function parseLibraryFilters(
  sp: Record<string, string | string[] | undefined>,
  docs: AgreementDocument[]
): AgreementFilters {
  const one = (v: string | string[] | undefined): string | undefined =>
    typeof v === "string" && v.length > 0 && v.length <= 64 ? v : undefined;
  const f: AgreementFilters = {};
  const client = one(sp.client);
  if (client && docs.some((d) => d.clientId === client)) f.client = client;
  const type = one(sp.type);
  if (type && Object.values(DOCUMENT_TYPE_KEY).includes(type)) f.type = type;
  const status = one(sp.status);
  if (status && Object.values(STATUS_KEY).includes(status)) f.status = status;
  const expiry = one(sp.expiry);
  if (expiry === "expiring" || expiry === "expired" || expiry === "none") f.expiry = expiry;
  const review = one(sp.review);
  if (review && (REVIEW_REQUIREMENTS as readonly string[]).includes(review)) f.review = review as ReviewFilter;
  return f;
}

export const todayIso = (): string => day(new Date().toISOString());
