/**
 * Typed rows for migration 0057 (opportunities, quotes, quote_versions,
 * quote_approvals). Hand-written on purpose: the generated Database types are
 * not regenerated until the migration is applied, and this module must not
 * depend on it having been.
 *
 * Money inside the jsonb payloads is integer minor units (pence) in the
 * version's `currency`. Nothing here is an approved price list (brief §6.5).
 */

export const OPPORTUNITY_STAGES = [
  "new_enquiry",
  "qualified",
  "discovery",
  "scope_ready",
  "quote_in_review",
  "sent",
  "negotiation",
  "won",
  "lost",
] as const;
export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number];

export const QUOTE_VERSION_STATUSES = [
  "draft",
  "internal_review",
  "approved_to_issue",
  "issued",
  "accepted",
  "declined",
  "expired",
  "superseded",
  "withdrawn",
] as const;
export type QuoteVersionStatus = (typeof QUOTE_VERSION_STATUSES)[number];

export type Confidence = "low" | "medium" | "high";
export type ServiceRoute = "managed" | "independent" | "unresolved";

/** Step 1 — Brief. */
export type QuoteBrief = {
  outcomes: string[];
  users: string;
  constraints: string;
  confidence: Confidence;
};

/** Step 2 — Scope. */
export type QuoteScope = {
  included: string[];
  excluded: string[];
  acceptance: string[];
};

/** Step 3 — Delivery estimate (hours per package; reserve in minor units). */
export type QuoteEstimate = {
  packages: { name: string; low: number; base: number; high: number; role: string }[];
  contingency_pct: number;
  warranty_reserve_minor: number;
};

/** Step 4 — Commercial model (BUILD / RUN / GROW / TRANSACT). */
export type QuoteCommercial = {
  build_price_minor: number;
  milestones: { label: string; pct: number }[];
  route: ServiceRoute;
  run_state: string;
  grow_options: { name: string; basis: string; from_minor: number }[];
  transact: string;
};

/** Step 5 — Internal review. Never projected to a client. */
export type QuoteInternal = {
  risk_adjusted_cost_minor: number;
  min_margin_pct: number;
  target_margin_pct: number;
  approved_price_minor: number;
  approver: string;
  override_reason?: string;
  checks: { label: string; ok: boolean }[];
};

export type OpportunityRow = {
  id: string;
  tenant_id: string | null;
  legal_name: string;
  trading_name: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  stage: OpportunityStage;
  owner: string | null;
  next_action: string | null;
  next_action_due: string | null;
  probability_pct: number | null;
  source: string | null;
  decision_rationale: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type QuoteRow = {
  id: string;
  opportunity_id: string;
  tenant_id: string | null;
  project_label: string;
  current_version_id: string | null;
  created_at: string;
  updated_at: string;
};

export type QuoteVersionRow = {
  id: string;
  quote_id: string;
  version_no: number;
  status: QuoteVersionStatus;
  currency: string;
  expires_at: string | null;
  brief: Partial<QuoteBrief>;
  scope: Partial<QuoteScope>;
  estimate: Partial<QuoteEstimate>;
  commercial: Partial<QuoteCommercial>;
  internal: Partial<QuoteInternal>;
  policy_version: string | null;
  formula_version: string | null;
  author: string | null;
  issued_at: string | null;
  accepted_at: string | null;
  superseded_by: string | null;
  created_at: string;
  updated_at: string;
};

export type QuoteApprovalRow = {
  id: string;
  version_id: string;
  approver: string | null;
  decision: "approve" | "reject";
  reason: string | null;
  below_floor: boolean;
  created_at: string;
};

/** The editable payloads a draft save may carry. */
export type QuoteVersionContent = {
  brief: QuoteBrief;
  scope: QuoteScope;
  estimate: QuoteEstimate;
  commercial: QuoteCommercial;
  internal: QuoteInternal;
};

/** A listing row: version joined with its quote and opportunity. */
export type QuoteVersionListItem = {
  version: QuoteVersionRow;
  quote: QuoteRow;
  opportunity: OpportunityRow;
};

export type ActionFailure =
  | "flag_off"
  | "unauthenticated"
  | "forbidden"
  | "preview"
  | "not_found"
  | "stale"
  | "invalid"
  | "invalid_transition"
  | "not_editable"
  | "approver_is_author"
  | "reason_required"
  | "approval_missing"
  | "db_error";

export type ActionResult<T = Record<string, never>> =
  | ({ ok: true } & T)
  | { ok: false; reason: ActionFailure; detail?: string };
