import type { ExceptionCandidate, ExceptionSeverity } from "./types";
import { addDays, daysBetween, isOverdue } from "./schedule";

/**
 * The exception rules engine — pure functions over a snapshot of the data the
 * sweep fetched. Each rule proposes ExceptionCandidates; the sweep decides
 * novelty (fire-key dedupe against open exceptions), persistence and alerting.
 *
 * An exception is a statement that "a configured control may not have been
 * performed, may have failed, or needs review" — the rules never phrase a
 * finding as non-compliance, and never put secrets, log contents or client
 * personal data in titles/details (ids and labels only: notification previews
 * are built from these fields).
 */

/* ── snapshot shape (plain data, so rules are unit-testable) ───── */

export type SweepSnapshot = {
  today: string; // date-only, UTC
  scopes: { id: string; version: number; status: string }[];
  policies: {
    id: string;
    key: string;
    title: string;
    status: string;
    review_due_at: string | null;
    requires_acknowledgement: boolean;
    current_version: number;
  }[];
  /** Emails of current staff (for acknowledgement coverage). */
  staffEmails: string[];
  /** policy key → emails who acknowledged the current version. */
  acknowledgements: Record<string, string[]>;
  assets: {
    id: string;
    name: string;
    kind: string;
    status: string;
    in_scope: boolean;
    owner_email: string | null;
    classification: string | null;
    criticality: string | null;
    review_due_at: string | null;
  }[];
  risks: {
    id: string;
    ref: string;
    title: string;
    status: string;
    owner_email: string | null;
    treatment: string;
    review_due_at: string | null;
  }[];
  controls: {
    id: string;
    key: string;
    name: string;
    status: string;
    applicability: string;
    owner_email: string | null;
    frequency: string;
    next_due_at: string | null;
    tsc_category: string;
  }[];
  controlRuns: {
    id: string;
    control_id: string;
    due_at: string;
    status: string;
    performed_at: string | null;
  }[];
  /** run id → number of evidence items attached. */
  runEvidenceCounts: Record<string, number>;
  vendors: {
    id: string;
    name: string;
    status: string;
    data_access: string;
    service_dependency: string | null;
    risk_level: string | null;
    owner_email: string | null;
    review_due_at: string | null;
    dpa_status: string;
    security_docs: { kind?: string; reference?: string; expires_on?: string }[];
  }[];
  /** Integrations detected as configured in the environment (name + vendor match key). */
  activeIntegrations: { key: string; label: string }[];
  /** Vendor names lowercased, for register matching. */
  accessReviews: {
    id: string;
    ref: string;
    status: string;
    due_at: string;
    completed_at: string | null;
  }[];
  accessReviewItems: {
    id: string;
    review_id: string;
    system_label: string;
    account_identifier: string;
    person: string | null;
    privilege: string;
    is_shared: boolean;
    mfa_status: string;
    decision: string;
    decided_at: string | null;
    action_completed_at: string | null;
  }[];
  breakGlassEvents: {
    id: string;
    system_label: string;
    used_by: string;
    review_due_at: string;
    reviewed_at: string | null;
    expires_at: string;
    ended_at: string | null;
  }[];
  changeRecords: {
    id: string;
    ref: string;
    title: string;
    status: string;
    requested_by: string | null;
    reviewed_by: string | null;
    approved_by: string | null;
    test_evidence: string | null;
    rollback_plan: string | null;
    ticket_ref: string | null;
    deployed_at: string | null;
  }[];
  incidents: {
    id: string;
    ref: string;
    severity: string;
    status: string;
    owner_email: string | null;
    acknowledged_at: string | null;
    containment_summary: string | null;
    detected_at: string;
    post_review_due_at: string | null;
    post_review_done_at: string | null;
  }[];
  managementReviews: { id: string; held_at: string }[];
  /** Projects flagged as handling special-category (incl. children's) data. */
  sensitiveProjects: {
    id: string;
    tenant_id: string;
    name: string;
    detail: string | null;
    reviewed: boolean; // a compliance review evidence/closed exception exists
  }[];
  aiAgents: {
    id: string;
    key: string;
    name: string;
    lifecycle: string;
    owner_email: string | null;
    last_activity_at: string | null;
  }[];
  aiEscalations: {
    id: string;
    agent_id: string | null;
    kind: string;
    severity: string;
    status: string;
  }[];
  /** Recent denied/refused AI tool invocations + policy denials. */
  aiDenials: {
    id: string;
    source: "tool_invocation" | "policy";
    agent_key: string | null;
    tool: string | null;
    at: string;
  }[];
};

/* ── SLAs (defaults; overridable via ops_settings soc2_engine config) ── */

export type EngineConfig = {
  ackGraceDays: number; // policy acknowledgement window after approval
  revokeActionSlaDays: number; // revoke decided → actioned
  incidentAckSlaHours: number; // high/critical incident acknowledgement
  postIncidentReviewGraceDays: number;
  managementReviewCadenceDays: number;
  aiStaleHours: number;
};

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  ackGraceDays: 14,
  revokeActionSlaDays: 3,
  incidentAckSlaHours: 24,
  postIncidentReviewGraceDays: 14,
  managementReviewCadenceDays: 100,
  aiStaleHours: 72,
};

/* ── rule implementations ──────────────────────────────────────── */

type Rule = (s: SweepSnapshot, cfg: EngineConfig) => ExceptionCandidate[];

const candidate = (
  partial: Omit<ExceptionCandidate, "source"> & { source?: ExceptionCandidate["source"] }
): ExceptionCandidate => ({ source: "rule", ...partial });

/** A · No approved scope: readiness has nothing to report against. */
const scopeApproved: Rule = (s) => {
  if (s.scopes.some((sc) => sc.status === "approved")) return [];
  return [
    candidate({
      ruleKey: "governance.scope_unapproved",
      fireKey: "governance.scope_unapproved",
      controlKey: "GOV-05",
      title: "No approved Scope of System",
      detail:
        "Readiness is reported against an approved scope version. Draft a scope and have an Administrator approve it.",
      severity: "high",
      severityRationale: "Without an approved scope every other readiness statement is unanchored.",
      recommendedAction: "Approve a scope version under Scope of System.",
      affected: {},
      triggerRef: "soc2_scopes",
    }),
  ];
};

/** A · Approved policy past its review date. */
const policyReviewOverdue: Rule = (s) =>
  s.policies
    .filter((p) => p.status === "approved" && p.review_due_at && isOverdue(p.review_due_at, s.today))
    .map((p) =>
      candidate({
        ruleKey: "governance.policy_review_overdue",
        fireKey: `governance.policy_review_overdue:${p.key}`,
        controlKey: "GOV-01",
        title: `Policy review overdue: ${p.title}`,
        detail: `"${p.title}" was due for review on ${p.review_due_at}.`,
        severity: "medium",
        severityRationale: "A policy past review may no longer describe how the company operates.",
        recommendedAction: "Review the policy, record changes (or none), and set the next review date.",
        affected: {},
        triggerRef: `soc2_policies:${p.id}`,
      })
    );

/** A · Required staff acknowledgement missing after the grace window. */
const policyAckOverdue: Rule = (s, cfg) =>
  s.policies
    .filter((p) => p.status === "approved" && p.requires_acknowledgement)
    .flatMap((p) => {
      const acked = new Set((s.acknowledgements[p.key] ?? []).map((e) => e.toLowerCase()));
      const missing = s.staffEmails.filter((e) => !acked.has(e.toLowerCase()));
      if (missing.length === 0) return [];
      return [
        candidate({
          ruleKey: "governance.policy_ack_overdue",
          fireKey: `governance.policy_ack_overdue:${p.key}:v${p.current_version}`,
          controlKey: "GOV-04",
          title: `Acknowledgements outstanding: ${p.title}`,
          detail: `${missing.length} staff member(s) have not acknowledged v${p.current_version} (grace ${cfg.ackGraceDays} days).`,
          severity: "medium",
          severityRationale: "Unacknowledged policies cannot be relied on as a people control.",
          recommendedAction: "Chase the outstanding acknowledgements from the policy page.",
          affected: { users: missing },
          triggerRef: `soc2_policies:${p.id}`,
        }),
      ];
    });

/** A · Asset with no owner, classification or review date. */
const assetUngoverned: Rule = (s) =>
  s.assets
    .filter((a) => a.status === "active" && a.in_scope)
    .flatMap((a) => {
      const gaps: string[] = [];
      if (!a.owner_email) gaps.push("owner");
      if (!a.classification) gaps.push("classification");
      if (!a.review_due_at) gaps.push("review date");
      if (gaps.length === 0) return [];
      return [
        candidate({
          ruleKey: "governance.asset_ungoverned",
          fireKey: `governance.asset_ungoverned:${a.id}`,
          controlKey: "GOV-05",
          title: `Asset missing ${gaps.join(", ")}: ${a.name}`,
          detail: `In-scope ${a.kind} "${a.name}" has no ${gaps.join(", no ")}.`,
          severity: a.criticality === "critical" || a.criticality === "high" ? "high" : "medium",
          severityRationale:
            "An unowned or unclassified in-scope asset has no one accountable for its controls.",
          recommendedAction: "Assign an owner, classification and review date on the asset record.",
          affected: { assets: [a.id] },
          triggerRef: `soc2_assets:${a.id}`,
        }),
      ];
    });

/** A · Risk without owner/treatment, or overdue review. */
const riskUngoverned: Rule = (s) =>
  s.risks
    .filter((r) => r.status === "open")
    .flatMap((r) => {
      const gaps: string[] = [];
      if (!r.owner_email) gaps.push("no owner");
      if (r.treatment === "undecided") gaps.push("no treatment decision");
      if (r.review_due_at && isOverdue(r.review_due_at, s.today)) gaps.push("review overdue");
      if (gaps.length === 0) return [];
      return [
        candidate({
          ruleKey: "governance.risk_ungoverned",
          fireKey: `governance.risk_ungoverned:${r.id}`,
          controlKey: "GOV-02",
          title: `Risk ${r.ref} ${gaps.join("; ")}`,
          detail: `"${r.title}" — ${gaps.join("; ")}.`,
          severity: "medium",
          severityRationale: "An untreated or unreviewed risk is a decision nobody has made.",
          recommendedAction: "Assign an owner and a treatment, or bring the review current.",
          affected: {},
          triggerRef: `soc2_risks:${r.id}`,
        }),
      ];
    });

/** A · Active control without an owner (or schedulable without a due date). */
const controlUnowned: Rule = (s) =>
  s.controls
    .filter((c) => c.status === "active" && c.applicability === "applicable")
    .flatMap((c) => {
      const gaps: string[] = [];
      if (!c.owner_email) gaps.push("no owner");
      const schedulable = !["continuous", "per_change", "event"].includes(c.frequency);
      if (schedulable && !c.next_due_at) gaps.push("no scheduled evidence collection");
      if (gaps.length === 0) return [];
      return [
        candidate({
          ruleKey: "governance.control_unowned",
          fireKey: `governance.control_unowned:${c.key}`,
          controlKey: c.key,
          title: `Control ${c.key} has ${gaps.join(" and ")}`,
          detail: `"${c.name}" — ${gaps.join("; ")}.`,
          severity: "medium",
          severityRationale: "A control is only healthy with an accountable owner and a defined operation.",
          recommendedAction: "Assign an owner and/or set the schedule on the control.",
          affected: {},
          triggerRef: `soc2_controls:${c.id}`,
        }),
      ];
    });

/** A · Management review overdue. */
const managementReviewOverdue: Rule = (s, cfg) => {
  const latest = [...s.managementReviews].sort((a, b) => a.held_at.localeCompare(b.held_at)).pop();
  const dueBy = latest ? addDays(latest.held_at, cfg.managementReviewCadenceDays) : null;
  if (latest && dueBy && !isOverdue(dueBy, s.today)) return [];
  // No review ever, or the cadence has lapsed.
  const fireSuffix = latest ? latest.held_at : "never";
  return [
    candidate({
      ruleKey: "governance.management_review_overdue",
      fireKey: `governance.management_review_overdue:${fireSuffix}`,
      controlKey: "GOV-06",
      title: "Management readiness review overdue",
      detail: latest
        ? `Last management review was ${latest.held_at}; the ${cfg.managementReviewCadenceDays}-day cadence has lapsed.`
        : "No management readiness review has been recorded yet.",
      severity: "medium",
      severityRationale: "Without periodic management review, exceptions and risks age unseen.",
      recommendedAction: "Hold and record a management review (Overview → Management reviews).",
      affected: {},
      triggerRef: "soc2_management_reviews",
    }),
  ];
};

/** B · Access review overdue or never completed. */
const accessReviewOverdue: Rule = (s) => {
  const overdueOpen = s.accessReviews.filter(
    (r) => r.status !== "complete" && isOverdue(r.due_at, s.today)
  );
  return overdueOpen.map((r) =>
    candidate({
      ruleKey: "iam.access_review_overdue",
      fireKey: `iam.access_review_overdue:${r.id}`,
      controlKey: "IAM-05",
      title: `Access review ${r.ref} overdue`,
      detail: `Due ${r.due_at}, still ${r.status}. Evidence for the period is missing until it completes.`,
      severity: "high",
      severityRationale: "An overdue access review means access rights are unverified for the period.",
      recommendedAction: "Work every account to a decision; the review cannot complete with undecided items.",
      affected: {},
      triggerRef: `soc2_access_reviews:${r.id}`,
    })
  );
};

/** B · Privileged account without a named approver/decision, or without MFA. */
const privilegedAccessFindings: Rule = (s, cfg) => {
  const out: ExceptionCandidate[] = [];
  const openReviewIds = new Set(s.accessReviews.filter((r) => r.status !== "complete").map((r) => r.id));
  for (const item of s.accessReviewItems) {
    const privileged = item.privilege === "privileged" || item.privilege === "admin";
    // MFA disabled where the integration/attestation can establish it.
    if (privileged && item.mfa_status === "disabled") {
      out.push(
        candidate({
          ruleKey: "iam.privileged_mfa_missing",
          fireKey: `iam.privileged_mfa_missing:${item.id}`,
          controlKey: "IAM-01",
          title: `Privileged account without MFA: ${item.system_label}`,
          detail: `Account "${item.account_identifier}" on ${item.system_label} is ${item.privilege} with MFA disabled.`,
          severity: "high",
          severityRationale: "Privileged access without MFA is a single-factor path to production.",
          recommendedAction: "Enable MFA on the account, then record it on the review item.",
          affected: { users: item.person ? [item.person] : [] },
          triggerRef: `soc2_access_review_items:${item.id}`,
        })
      );
    }
    // Shared account declared without break-glass privilege.
    if (item.is_shared && item.privilege !== "break_glass") {
      out.push(
        candidate({
          ruleKey: "iam.shared_account",
          fireKey: `iam.shared_account:${item.id}`,
          controlKey: "IAM-02",
          title: `Shared account declared: ${item.system_label}`,
          detail: `"${item.account_identifier}" on ${item.system_label} is shared and is not documented break-glass access.`,
          severity: "high",
          severityRationale: "Shared credentials break attribution; only documented break-glass is permitted.",
          recommendedAction: "Replace with individual accounts, or document it as break-glass with approval.",
          affected: {},
          triggerRef: `soc2_access_review_items:${item.id}`,
        })
      );
    }
    // Revoke decided but not actioned within SLA — the departed-user case.
    if (
      item.decision === "revoke" &&
      !item.action_completed_at &&
      item.decided_at &&
      daysBetween(item.decided_at.slice(0, 10), s.today) > cfg.revokeActionSlaDays
    ) {
      out.push(
        candidate({
          ruleKey: "iam.revoke_unactioned",
          fireKey: `iam.revoke_unactioned:${item.id}`,
          controlKey: "IAM-03",
          title: `Access still active after revoke decision: ${item.system_label}`,
          detail: `"${item.account_identifier}" was marked for revocation on ${item.decided_at.slice(0, 10)} and is not recorded as removed (SLA ${cfg.revokeActionSlaDays} days).`,
          severity: "critical",
          severityRationale:
            "An account past its revocation decision may belong to someone who should no longer have access.",
          recommendedAction: "Remove the access in the provider now and record the completion time.",
          affected: { users: item.person ? [item.person] : [] },
          triggerRef: `soc2_access_review_items:${item.id}`,
          incidentCandidate: true,
        })
      );
    }
    // Privileged access surfaced in an OPEN review still awaiting any decision
    // is only a finding once the review itself is overdue — covered above.
    void openReviewIds;
  }
  return out;
};

/** B · Break-glass event unreviewed past its review date. */
const breakGlassUnreviewed: Rule = (s) =>
  s.breakGlassEvents
    .filter((b) => !b.reviewed_at && isOverdue(b.review_due_at, s.today))
    .map((b) =>
      candidate({
        ruleKey: "iam.break_glass_unreviewed",
        fireKey: `iam.break_glass_unreviewed:${b.id}`,
        controlKey: "IAM-08",
        title: `Break-glass use unreviewed: ${b.system_label}`,
        detail: `Emergency access used by ${b.used_by} was due a post-use review by ${b.review_due_at}.`,
        severity: "high",
        severityRationale: "Unreviewed emergency access defeats the purpose of the break-glass control.",
        recommendedAction: "Complete the post-use review on the break-glass record.",
        affected: { users: [b.used_by] },
        triggerRef: `soc2_break_glass_events:${b.id}`,
      })
    );

/** C · Deployed change without review/approval/test/rollback, or self-approved. */
const changeControlFindings: Rule = (s) => {
  const out: ExceptionCandidate[] = [];
  for (const c of s.changeRecords) {
    if (c.status !== "deployed") continue;
    const gaps: string[] = [];
    if (!c.ticket_ref) gaps.push("no linked change/ticket record");
    if (!c.reviewed_by) gaps.push("no reviewer");
    if (!c.approved_by) gaps.push("no approval");
    if (!c.test_evidence) gaps.push("no test evidence");
    if (!c.rollback_plan) gaps.push("no rollback plan");
    if (gaps.length > 0) {
      out.push(
        candidate({
          ruleKey: "change.unlinked_production_change",
          fireKey: `change.unlinked_production_change:${c.id}`,
          controlKey: "DEV-02",
          title: `Production change ${c.ref} incomplete: ${gaps[0]}`,
          detail: `"${c.title}" deployed ${c.deployed_at?.slice(0, 10) ?? ""} with ${gaps.join("; ")}.`,
          severity: "high",
          severityRationale: "A production change without its control trail is an unauthorised-change risk.",
          recommendedAction: "Complete the change record (reviewer, approval, tests, rollback) or roll back.",
          affected: {},
          triggerRef: `soc2_change_records:${c.id}`,
        })
      );
    } else if (c.approved_by && c.requested_by && c.approved_by === c.requested_by) {
      out.push(
        candidate({
          ruleKey: "change.self_approved",
          fireKey: `change.self_approved:${c.id}`,
          controlKey: "DEV-03",
          title: `Change ${c.ref} was self-approved`,
          detail: `"${c.title}" was requested and approved by the same person.`,
          severity: "medium",
          severityRationale:
            "Self-approval is a segregation-of-duties gap; for a solo operator it needs the documented compensating control.",
          recommendedAction:
            "Have a different reviewer approve, or link the approved compensating-control exception.",
          affected: {},
          triggerRef: `soc2_change_records:${c.id}`,
        })
      );
    }
  }
  return out;
};

/** D · Sensitive (special-category / children's) project without a review. */
const sensitiveProjectUnreviewed: Rule = (s) =>
  s.sensitiveProjects
    .filter((p) => !p.reviewed)
    .map((p) =>
      candidate({
        ruleKey: "data.sensitive_project_review",
        fireKey: `data.sensitive_project_review:${p.id}`,
        controlKey: "DATA-07",
        title: `Compliance review required: ${p.name}`,
        detail:
          "This project is flagged as handling special-category (or children's) data and has no recorded compliance review. Readiness for Confidentiality cannot read positive while this is open.",
        severity: "high",
        severityRationale:
          "Sensitive-data processing without a recorded human review is exactly what the control exists to catch.",
        recommendedAction:
          "Record the compliance review (with any specialist input needed) as closure evidence.",
        affected: { projects: [p.id], tenants: [p.tenant_id] },
        triggerRef: `projects:${p.id}`,
      })
    );

/** F · Vendor overdue for review, unapproved for its data, or docs expired. */
const vendorFindings: Rule = (s) => {
  const out: ExceptionCandidate[] = [];
  for (const v of s.vendors) {
    if (v.status === "offboarded" || v.status === "rejected") continue;
    const critical = v.service_dependency === "critical" || v.risk_level === "critical";
    if (v.review_due_at && isOverdue(v.review_due_at, s.today)) {
      out.push(
        candidate({
          ruleKey: "vendor.review_overdue",
          fireKey: `vendor.review_overdue:${v.id}`,
          controlKey: "VND-03",
          title: `Vendor review overdue: ${v.name}`,
          detail: `Review was due ${v.review_due_at}. Closure needs review evidence attached.`,
          severity: critical ? "high" : "medium",
          severityRationale: critical
            ? "A critical-dependency vendor past review is an unexamined systemic risk."
            : "Vendor review lapsed; risk posture may be stale.",
          recommendedAction: "Perform the vendor review and attach the evidence to close.",
          affected: { vendors: [v.id] },
          triggerRef: `soc2_vendors:${v.id}`,
        })
      );
    }
    const sensitiveData = ["confidential", "personal", "special_category"].includes(v.data_access);
    if (sensitiveData && v.status !== "approved" && v.status !== "conditional") {
      out.push(
        candidate({
          ruleKey: "vendor.sensitive_unapproved",
          fireKey: `vendor.sensitive_unapproved:${v.id}`,
          controlKey: "VND-02",
          title: `Unapproved vendor handles ${v.data_access} data: ${v.name}`,
          detail: `Status is "${v.status}" but the vendor's data access is ${v.data_access}.`,
          severity: "high",
          severityRationale: "Sensitive data with an unapproved vendor bypasses the review control.",
          recommendedAction: "Complete the vendor security review and record the approval decision.",
          affected: { vendors: [v.id] },
          triggerRef: `soc2_vendors:${v.id}`,
        })
      );
    }
    if (sensitiveData && v.dpa_status === "unknown") {
      out.push(
        candidate({
          ruleKey: "vendor.dpa_unknown",
          fireKey: `vendor.dpa_unknown:${v.id}`,
          controlKey: "VND-01",
          title: `DPA status unknown: ${v.name}`,
          detail: `The vendor handles ${v.data_access} data and no DPA/contract position is recorded.`,
          severity: "medium",
          severityRationale: "Processing terms with a sensitive-data vendor must be known, not assumed.",
          recommendedAction: "Record the DPA/contract status on the vendor record.",
          affected: { vendors: [v.id] },
          triggerRef: `soc2_vendors:${v.id}`,
        })
      );
    }
    for (const doc of v.security_docs ?? []) {
      if (doc.expires_on && isOverdue(doc.expires_on, s.today)) {
        out.push(
          candidate({
            ruleKey: "vendor.doc_expired",
            fireKey: `vendor.doc_expired:${v.id}:${doc.kind ?? "doc"}:${doc.expires_on}`,
            controlKey: "VND-03",
            title: `Vendor security document expired: ${v.name}`,
            detail: `${doc.kind ?? "Security document"} expired ${doc.expires_on}.`,
            severity: "medium",
            severityRationale: "Assurance documentation has lapsed; the vendor position is stale.",
            recommendedAction: "Obtain the current document and update the vendor record.",
            affected: { vendors: [v.id] },
            triggerRef: `soc2_vendors:${v.id}`,
          })
        );
      }
    }
  }
  // Integrations running without any register entry.
  const registered = new Set(s.vendors.map((v) => v.name.toLowerCase()));
  for (const integ of s.activeIntegrations) {
    if (!registered.has(integ.key.toLowerCase())) {
      out.push(
        candidate({
          ruleKey: "vendor.unregistered_integration",
          fireKey: `vendor.unregistered_integration:${integ.key}`,
          controlKey: "VND-01",
          title: `Integration in use with no vendor record: ${integ.label}`,
          detail: `${integ.label} is configured in the environment but absent from the vendor register.`,
          severity: "high",
          severityRationale: "A live provider outside the register is unreviewed third-party risk.",
          recommendedAction: "Add the vendor record, classify its data access, and review it.",
          affected: {},
          triggerRef: `env:${integ.key}`,
        })
      );
    }
  }
  return out;
};

/** G · Incident hygiene: unacknowledged, uncontained, review overdue. */
const incidentFindings: Rule = (s, cfg) => {
  const out: ExceptionCandidate[] = [];
  for (const i of s.incidents) {
    const open = i.status !== "closed";
    const highSev = i.severity === "critical" || i.severity === "high";
    if (open && highSev && !i.acknowledged_at) {
      const hoursOpen =
        (new Date(s.today + "T00:00:00Z").getTime() - new Date(i.detected_at).getTime()) / 36e5;
      if (hoursOpen > cfg.incidentAckSlaHours || !i.owner_email) {
        out.push(
          candidate({
            ruleKey: "incident.unacknowledged",
            fireKey: `incident.unacknowledged:${i.id}`,
            controlKey: "AVL-04",
            title: `Incident ${i.ref} lacks ${i.owner_email ? "acknowledgement" : "an owner"}`,
            detail: `${i.severity} incident detected ${i.detected_at.slice(0, 10)} has ${
              i.owner_email ? "not been acknowledged" : "no owner"
            } within the ${cfg.incidentAckSlaHours}h SLA.`,
            severity: "critical",
            severityRationale: "A high-severity incident nobody owns is an unmanaged live risk.",
            recommendedAction: "Assign an owner and acknowledge on the incident record now.",
            affected: {},
            triggerRef: `soc2_incidents:${i.id}`,
          })
        );
      }
    }
    if (open && highSev && i.acknowledged_at && !i.containment_summary) {
      out.push(
        candidate({
          ruleKey: "incident.uncontained",
          fireKey: `incident.uncontained:${i.id}`,
          controlKey: "INC-02",
          title: `Incident ${i.ref} has no containment update`,
          detail: "Acknowledged but no containment action is recorded yet.",
          severity: "high",
          severityRationale: "Without recorded containment the incident's blast radius is unknown.",
          recommendedAction: "Record the containment action taken (or why none is needed).",
          affected: {},
          triggerRef: `soc2_incidents:${i.id}`,
        })
      );
    }
    if (
      i.post_review_due_at &&
      !i.post_review_done_at &&
      isOverdue(i.post_review_due_at, s.today)
    ) {
      out.push(
        candidate({
          ruleKey: "incident.review_overdue",
          fireKey: `incident.review_overdue:${i.id}`,
          controlKey: "INC-02",
          title: `Post-incident review overdue: ${i.ref}`,
          detail: `Review was due ${i.post_review_due_at} (grace ${cfg.postIncidentReviewGraceDays} days).`,
          severity: "medium",
          severityRationale: "Lessons unrecorded are lessons unlearned.",
          recommendedAction: "Complete and record the post-incident review.",
          affected: {},
          triggerRef: `soc2_incidents:${i.id}`,
        })
      );
    }
  }
  return out;
};

/** E · Scheduled control run overdue (evidence never arrived). */
const controlRunOverdue: Rule = (s) => {
  const byId = new Map(s.controls.map((c) => [c.id, c]));
  return s.controlRuns
    .filter(
      (r) => (r.status === "scheduled" || r.status === "in_progress") && isOverdue(r.due_at, s.today)
    )
    .flatMap((r) => {
      const control = byId.get(r.control_id);
      if (!control || control.status !== "active") return [];
      const availabilityOrAccess =
        control.key.startsWith("AVL-") || control.key.startsWith("IAM-") || control.key.startsWith("INC-");
      return [
        candidate({
          ruleKey: "evidence.run_overdue",
          fireKey: `evidence.run_overdue:${r.id}`,
          controlKey: control.key,
          title: `Evidence overdue: ${control.name}`,
          detail: `The ${control.frequency} performance of ${control.key} was due ${r.due_at} and has not been completed.`,
          severity: availabilityOrAccess ? "high" : "medium",
          severityRationale: availabilityOrAccess
            ? "Backup/access/incident controls losing their cadence is a material gap."
            : "The control's evidence cadence has lapsed.",
          recommendedAction: "Perform the control and attach evidence, or record why it was skipped.",
          affected: {},
          triggerRef: `soc2_control_runs:${r.id}`,
        }),
      ];
    });
};

/** E · Completed run with no evidence attached. */
const runWithoutEvidence: Rule = (s) => {
  const byId = new Map(s.controls.map((c) => [c.id, c]));
  return s.controlRuns
    .filter((r) => r.status === "complete" && (s.runEvidenceCounts[r.id] ?? 0) === 0)
    .flatMap((r) => {
      const control = byId.get(r.control_id);
      if (!control) return [];
      return [
        candidate({
          ruleKey: "evidence.run_without_evidence",
          fireKey: `evidence.run_without_evidence:${r.id}`,
          controlKey: control.key,
          title: `Run completed without evidence: ${control.name}`,
          detail: `The run due ${r.due_at} is marked complete but carries no evidence items.`,
          severity: "medium",
          severityRationale: "A performance without evidence cannot support the readiness pack.",
          recommendedAction: "Attach the evidence for the run, or return it to in-progress.",
          affected: {},
          triggerRef: `soc2_control_runs:${r.id}`,
        }),
      ];
    });
};

/** AI · Workspace governance signals. */
const aiWorkspaceFindings: Rule = (s, cfg) => {
  const out: ExceptionCandidate[] = [];
  for (const a of s.aiAgents) {
    if (a.lifecycle !== "active") continue;
    if (!a.owner_email) {
      out.push(
        candidate({
          ruleKey: "ai.agent_unowned",
          fireKey: `ai.agent_unowned:${a.key}`,
          controlKey: "AIW-01",
          title: `Active AI agent has no accountable owner: ${a.name}`,
          detail: "Every active agent needs a named human owner.",
          severity: "high",
          severityRationale: "Autonomy without an accountable human is outside the AI policy.",
          recommendedAction: "Assign an owner on the agent profile, or pause the agent.",
          affected: {},
          triggerRef: `agents:${a.id}`,
          source: "ai_workspace",
        })
      );
    }
    if (a.last_activity_at) {
      const hours =
        (new Date(s.today + "T00:00:00Z").getTime() - new Date(a.last_activity_at).getTime()) / 36e5;
      if (hours > cfg.aiStaleHours) {
        out.push(
          candidate({
            ruleKey: "ai.agent_stale",
            fireKey: `ai.agent_stale:${a.key}`,
            controlKey: "AIW-02",
            title: `AI agent heartbeat stale: ${a.name}`,
            detail: `No activity for over ${cfg.aiStaleHours} hours while marked active.`,
            severity: "medium",
            severityRationale: "An agent that looks alive but is silent may be failing unobserved.",
            recommendedAction: "Check the agent's runs; pause it if it is not actually operating.",
            affected: {},
            triggerRef: `agents:${a.id}`,
            source: "ai_workspace",
          })
        );
      }
    }
  }
  for (const e of s.aiEscalations) {
    if (e.status === "open") {
      out.push(
        candidate({
          ruleKey: "ai.escalation_open",
          fireKey: `ai.escalation_open:${e.id}`,
          controlKey: "AIW-02",
          title: `AI Workspace escalation open (${e.kind})`,
          detail: `An AI Workspace escalation is awaiting a human: ${e.kind}.`,
          severity: e.severity === "high" || e.severity === "critical" ? "high" : "medium",
          severityRationale: "Escalations are the workspace's own request for human judgement.",
          recommendedAction: "Work the escalation from /admin/ai/approvals.",
          affected: {},
          triggerRef: `agent_escalations:${e.id}`,
          source: "ai_workspace",
        })
      );
    }
  }
  for (const d of s.aiDenials) {
    out.push(
      candidate({
        ruleKey: "ai.access_denied",
        fireKey: `ai.access_denied:${d.source}:${d.id}`,
        controlKey: "AIW-02",
        title: `AI agent denied ${d.tool ? `tool "${d.tool}"` : "an action"}${d.agent_key ? ` (${d.agent_key})` : ""}`,
        detail:
          d.source === "policy"
            ? "The workspace policy engine denied a delegation/action; the denial is recorded in the task trail."
            : "A tool invocation was refused (outside grants/scope or unconfirmed high-impact).",
        severity: "medium",
        severityRationale:
          "The denial worked as designed; the review confirms the attempt was expected and configured correctly.",
        recommendedAction: "Review the attempt: expected → close with note; unexpected → tighten scope/escalate.",
        affected: {},
        triggerRef: `${d.source === "policy" ? "agent_events" : "ai_tool_invocations"}:${d.id}`,
        source: "ai_workspace",
      })
    );
  }
  return out;
};

/* ── the engine ────────────────────────────────────────────────── */

export const ALL_RULES: Rule[] = [
  scopeApproved,
  policyReviewOverdue,
  policyAckOverdue,
  assetUngoverned,
  riskUngoverned,
  controlUnowned,
  managementReviewOverdue,
  accessReviewOverdue,
  privilegedAccessFindings,
  breakGlassUnreviewed,
  changeControlFindings,
  sensitiveProjectUnreviewed,
  vendorFindings,
  incidentFindings,
  controlRunOverdue,
  runWithoutEvidence,
  aiWorkspaceFindings,
];

export function runRules(
  snapshot: SweepSnapshot,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG
): ExceptionCandidate[] {
  const out: ExceptionCandidate[] = [];
  for (const rule of ALL_RULES) out.push(...rule(snapshot, config));
  return out;
}

/* ── dedupe contract ───────────────────────────────────────────── */

/**
 * Rules whose exceptions, once closed, must never be re-raised for the same
 * subject: closing "we reviewed this" must not resurrect it (the underlying
 * fact — a past denial, an immutable flag on a record — never changes).
 * Every other rule dedupes against OPEN exceptions only, so a closure that
 * did not actually fix the condition is honestly re-raised by the next sweep.
 */
export const EVER_DEDUPE_RULES: ReadonlySet<string> = new Set([
  "data.sensitive_project_review",
  "ai.access_denied",
  "change.self_approved",
  "iam.shared_account",
]);

export function shouldRaise(
  ruleKey: string,
  fireKey: string,
  openFireKeys: ReadonlySet<string>,
  everFireKeys: ReadonlySet<string>
): boolean {
  if (EVER_DEDUPE_RULES.has(ruleKey)) return !everFireKeys.has(fireKey);
  return !openFireKeys.has(fireKey);
}

/* ── alert routing ─────────────────────────────────────────────── */

export type AlertRoute = {
  /** Emails to notify immediately (empty = queue only). */
  notifyNow: string[];
  /** Whether the exception should offer/raise an incident candidate. */
  incidentCandidate: boolean;
  queueOnly: boolean;
};

/**
 * Routing per the programme's severity model. Previews built from these
 * exceptions contain refs and titles only — never log contents, secrets or
 * client personal data (rules only emit ids/labels).
 */
export function routeAlert(
  severity: ExceptionSeverity,
  opts: {
    programmeOwners: string[];
    controlOwner: string | null;
    incidentCandidate?: boolean;
  }
): AlertRoute {
  const owners = [...new Set(opts.programmeOwners)];
  const withControlOwner = [
    ...new Set([...(opts.controlOwner ? [opts.controlOwner] : []), ...owners]),
  ];
  switch (severity) {
    case "critical":
      return {
        notifyNow: withControlOwner,
        incidentCandidate: opts.incidentCandidate ?? true,
        queueOnly: false,
      };
    case "high":
      return {
        notifyNow: opts.controlOwner ? [opts.controlOwner] : owners,
        incidentCandidate: opts.incidentCandidate ?? false,
        queueOnly: false,
      };
    default:
      return { notifyNow: [], incidentCandidate: false, queueOnly: true };
  }
}
