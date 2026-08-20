/**
 * SOC 2 readiness — shared row and domain types (migration 0037).
 *
 * Kept free of server-only imports so the pure engine modules (health,
 * schedule, rules) can be unit-tested directly, the same split as
 * lib/ai/impact.ts vs toolLog.ts.
 *
 * Language contract, repeated where it matters: these types describe controls
 * IMPLEMENTED, evidence COLLECTED and exceptions NEEDING REVIEW. Nothing in
 * this module or its consumers computes or displays a "compliance" verdict —
 * that belongs to an independent SOC 2 auditor.
 */

export type TscCategory =
  | "security"
  | "availability"
  | "processing_integrity"
  | "confidentiality"
  | "privacy";

export const TSC_LABEL: Record<TscCategory, string> = {
  security: "Security",
  availability: "Availability",
  processing_integrity: "Processing Integrity",
  confidentiality: "Confidentiality",
  privacy: "Privacy",
};

export type ControlFrequency =
  | "continuous"
  | "per_change"
  | "weekly"
  | "monthly"
  | "quarterly"
  | "semiannual"
  | "annual"
  | "event";

export type ProgrammeRole =
  | "programme_owner"
  | "control_owner"
  | "evidence_reviewer"
  | "system_owner"
  | "staff"
  | "auditor";

export const PROGRAMME_ROLE_LABEL: Record<ProgrammeRole, string> = {
  programme_owner: "Programme Owner",
  control_owner: "Control Owner",
  evidence_reviewer: "Evidence Reviewer",
  system_owner: "System Owner",
  staff: "Staff / Contractor",
  auditor: "Auditor / External Adviser",
};

export type ExceptionSeverity = "critical" | "high" | "medium" | "low";

export type ExceptionStatus =
  | "detected"
  | "triage_required"
  | "in_remediation"
  | "awaiting_evidence"
  | "awaiting_risk_acceptance"
  | "resolved_pending_verification"
  | "closed"
  | "not_applicable";

/** Open = still counts against the linked control's health. */
export const OPEN_EXCEPTION_STATUSES: ExceptionStatus[] = [
  "detected",
  "triage_required",
  "in_remediation",
  "awaiting_evidence",
  "awaiting_risk_acceptance",
  "resolved_pending_verification",
];

/**
 * Control health. Deliberately NOT a percentage and NOT a compliance verdict:
 * each value names the evidence/exception basis it was computed from.
 */
export type ControlHealth =
  | "operating"
  | "evidence_due"
  | "evidence_missing"
  | "exception_open"
  | "not_applicable"
  | "untested";

export const CONTROL_HEALTH_LABEL: Record<ControlHealth, string> = {
  operating: "Operating",
  evidence_due: "Evidence due",
  evidence_missing: "Evidence missing",
  exception_open: "Exception open",
  not_applicable: "Not applicable",
  untested: "Untested",
};

/* ── row shapes (subset of columns the engine reads) ───────────── */

export type ControlRow = {
  id: string;
  key: string;
  tsc_category: TscCategory;
  tsc_refs: string[];
  name: string;
  objective: string;
  owner_email: string | null;
  frequency: ControlFrequency;
  policy_key: string | null;
  applicability: "applicable" | "not_applicable";
  status: "active" | "retired";
  next_due_at: string | null; // date
};

export type ControlRunRow = {
  id: string;
  control_id: string;
  fire_key: string | null;
  due_at: string; // date
  status: "scheduled" | "in_progress" | "complete" | "failed" | "skipped";
  result: "pass" | "fail" | "partial" | null;
  performed_by: string | null;
  performed_at: string | null;
  reviewer_email: string | null;
  review_result: "accepted" | "returned" | null;
};

export type EvidenceRow = {
  id: string;
  control_id: string | null;
  control_run_id: string | null;
  source: string;
  capture_date: string;
  review_result: "accepted" | "returned" | null;
  classification: "internal" | "confidential" | "restricted";
};

export type ExceptionRow = {
  id: string;
  ref: string;
  control_id: string | null;
  rule_key: string | null;
  fire_key: string | null;
  title: string;
  severity: ExceptionSeverity;
  status: ExceptionStatus;
  owner_email: string | null;
  due_at: string | null;
  detected_at: string;
  triaged_at: string | null;
  detail: string | null;
};

/** A rule's proposed exception — becomes a soc2_exceptions row if new. */
export type ExceptionCandidate = {
  ruleKey: string;
  /** Dedupe key: while an exception with this key is open, don't raise again. */
  fireKey: string;
  controlKey: string | null;
  title: string;
  detail: string;
  severity: ExceptionSeverity;
  severityRationale: string;
  recommendedAction: string;
  /** Referenced records only — ids/labels, never contents or secrets. */
  affected: {
    assets?: string[];
    tenants?: string[];
    projects?: string[];
    vendors?: string[];
    users?: string[];
  };
  /** What tripped the rule, as a record reference (table:id) or label. */
  triggerRef: string;
  /** Marks a candidate the alert router should treat as an incident candidate. */
  incidentCandidate?: boolean;
  source: "rule" | "ai_workspace" | "integration";
};
