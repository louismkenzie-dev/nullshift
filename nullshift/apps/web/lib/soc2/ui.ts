import type { ControlHealth, ExceptionSeverity, ExceptionStatus } from "./types";

/**
 * Domain tone/label maps for the Security & SOC 2 Readiness area — the
 * lib-module home for UI constants, mirroring lib/ops/issues.ts, so pages
 * never redeclare meanings.
 */

export type ChipTone = "accent" | "success" | "warning" | "danger" | "muted";

export const HEALTH_TONE: Record<ControlHealth, ChipTone> = {
  operating: "success",
  evidence_due: "accent",
  evidence_missing: "warning",
  exception_open: "danger",
  not_applicable: "muted",
  untested: "muted",
};

export const SEVERITY_TONE: Record<ExceptionSeverity, ChipTone> = {
  critical: "danger",
  high: "danger",
  medium: "warning",
  low: "muted",
};

export const EXCEPTION_STATUS_TONE: Record<ExceptionStatus, ChipTone> = {
  detected: "warning",
  triage_required: "danger",
  in_remediation: "accent",
  awaiting_evidence: "warning",
  awaiting_risk_acceptance: "warning",
  resolved_pending_verification: "accent",
  closed: "success",
  not_applicable: "muted",
};

export const EXCEPTION_STATUS_LABEL: Record<ExceptionStatus, string> = {
  detected: "Detected",
  triage_required: "Triage required",
  in_remediation: "In remediation",
  awaiting_evidence: "Awaiting evidence",
  awaiting_risk_acceptance: "Awaiting risk acceptance",
  resolved_pending_verification: "Resolved — pending verification",
  closed: "Closed",
  not_applicable: "False positive / N-A",
};

export const VENDOR_STATUS_TONE: Record<string, ChipTone> = {
  proposed: "warning",
  approved: "success",
  conditional: "accent",
  rejected: "danger",
  offboarded: "muted",
};

export const POLICY_STATUS_TONE: Record<string, ChipTone> = {
  draft: "warning",
  in_review: "accent",
  approved: "success",
  retired: "muted",
};

export const RUN_STATUS_TONE: Record<string, ChipTone> = {
  scheduled: "accent",
  in_progress: "warning",
  complete: "success",
  failed: "danger",
  skipped: "muted",
};

export const INCIDENT_STATUS_TONE: Record<string, ChipTone> = {
  open: "danger",
  contained: "warning",
  recovering: "accent",
  resolved: "accent",
  closed: "success",
};

export const RISK_STATUS_TONE: Record<string, ChipTone> = {
  open: "warning",
  treated: "accent",
  accepted: "muted",
  closed: "success",
};

export const SCOPE_STATUS_TONE: Record<string, ChipTone> = {
  draft: "warning",
  approved: "success",
  superseded: "muted",
};

/**
 * The mandatory dashboard disclaimer — verbatim, one source. Rendered on the
 * Overview and repeated on the Audit Pack page.
 */
export const READINESS_DISCLAIMER =
  "Readiness indicators support internal management. An independent SOC 2 auditor determines the scope and report conclusion.";
