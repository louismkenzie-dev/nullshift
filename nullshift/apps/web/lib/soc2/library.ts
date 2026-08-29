import type { ControlFrequency, TscCategory } from "./types";

/**
 * The seeded control library — a practical baseline for a bespoke software
 * agency that builds, hosts and supports client systems and handles client
 * confidential data. Installed by an explicit, audited action from Settings
 * (never silently at boot), and fully editable afterwards: the final control
 * set for an examination is agreed with the independent auditor, not by this
 * file.
 *
 * `tscRefs` point at the AICPA 2017 Trust Services Criteria (2022 revised
 * points of focus) as orientation for a future auditor conversation; they are
 * references, not a mapping claim.
 *
 * Frequencies: schedulable ones (weekly…annual) get evidence requests from the
 * sweep; continuous / per_change / event controls are evidenced as they
 * happen (deploys, joiners/leavers, incidents) and assessed by exception.
 */

export type ControlSeed = {
  key: string;
  tscCategory: TscCategory;
  tscRefs: string[];
  name: string;
  objective: string;
  description: string;
  frequency: ControlFrequency;
  testProcedure: string;
  evidenceRequirements: string;
  policyKey: string | null;
  automation: "manual" | "automated" | "hybrid";
};

export const CONTROL_LIBRARY: ControlSeed[] = [
  /* ── A · Governance and risk management ──────────────────────── */
  {
    key: "GOV-01",
    tscCategory: "security",
    tscRefs: ["CC1.1", "CC5.3"],
    name: "Information security policy approved and reviewed",
    objective: "An approved information-security policy exists and is reviewed at least annually.",
    description:
      "The Information Security Policy is owned, approved by management, versioned, and reviewed on schedule. Staff acknowledge the current version.",
    frequency: "annual",
    testProcedure:
      "Inspect the current approved policy version, its approver and effective date; confirm the review happened within 12 months and acknowledgements are current.",
    evidenceRequirements: "Approved policy version record; acknowledgement records for the period.",
    policyKey: "information_security",
    automation: "hybrid",
  },
  {
    key: "GOV-02",
    tscCategory: "security",
    tscRefs: ["CC3.1", "CC3.2", "CC3.4"],
    name: "Risk assessment and register maintained",
    objective: "Risks are identified, scored, treated and reviewed on a defined cadence.",
    description:
      "The risk register records likelihood, impact, treatment, owner and residual risk. Risk acceptance is a named management decision.",
    frequency: "quarterly",
    testProcedure:
      "Inspect the register: every open risk has an owner and treatment; review dates are current; acceptances carry a named acceptor.",
    evidenceRequirements: "Risk register export for the period; management review record covering risks.",
    policyKey: "information_security",
    automation: "hybrid",
  },
  {
    key: "GOV-03",
    tscCategory: "security",
    tscRefs: ["CC1.3", "CC1.5"],
    name: "Security roles and accountability defined",
    objective: "Programme, control, evidence-review and system ownership are assigned to named people.",
    description:
      "Programme roles are recorded in the system; every active control has an owner; changes to role assignments are audited.",
    frequency: "quarterly",
    testProcedure: "List programme roles and unowned controls; confirm zero active controls without an owner.",
    evidenceRequirements: "Programme role register; control ownership listing.",
    policyKey: "information_security",
    automation: "automated",
  },
  {
    key: "GOV-04",
    tscCategory: "security",
    tscRefs: ["CC1.4", "CC2.2"],
    name: "Staff security training and policy acknowledgement",
    objective: "Staff and contractors complete security awareness and acknowledge required policies.",
    description:
      "Each staff member acknowledges required policy versions; new joiners acknowledge during onboarding; refreshers follow policy re-approval.",
    frequency: "annual",
    testProcedure: "Compare the staff list against acknowledgement records for every policy requiring one.",
    evidenceRequirements: "Acknowledgement records; onboarding checklist entries.",
    policyKey: "acceptable_use",
    automation: "hybrid",
  },
  {
    key: "GOV-05",
    tscCategory: "security",
    tscRefs: ["CC3.2", "CC6.1"],
    name: "System scope and asset inventory maintained",
    objective: "An approved Scope of System and a current asset inventory exist.",
    description:
      "Every in-scope system, repository, cloud account, environment and data store is inventoried with owner, classification and criticality. The scope is versioned and administrator-approved.",
    frequency: "quarterly",
    testProcedure:
      "Inspect the approved scope version; sample assets for owner/classification/review date; confirm no active asset is unowned or unclassified.",
    evidenceRequirements: "Approved scope record; asset inventory export.",
    policyKey: "data_classification",
    automation: "hybrid",
  },
  {
    key: "GOV-06",
    tscCategory: "security",
    tscRefs: ["CC1.2", "CC4.2"],
    name: "Management review of readiness",
    objective:
      "Management periodically reviews readiness status, major risks, incidents and open exceptions, and records decisions.",
    description:
      "A recorded management review covers control health, open exceptions by severity, incident summaries and risk decisions.",
    frequency: "quarterly",
    testProcedure: "Inspect the latest management review record and its recorded decisions and owners.",
    evidenceRequirements: "Management review record with attendees and decisions.",
    policyKey: "information_security",
    automation: "manual",
  },

  /* ── B · Identity and access management ──────────────────────── */
  {
    key: "IAM-01",
    tscCategory: "security",
    tscRefs: ["CC6.1"],
    name: "MFA required on in-scope systems",
    objective: "Multi-factor authentication is enabled for staff access to in-scope systems wherever supported.",
    description:
      "Staff admin access to the Ops platform enforces TOTP step-up in code; provider accounts (Supabase, Vercel, GitHub, Stripe, GoCardless, Xero, Resend, Anthropic) are attested via access reviews until integration evidence exists.",
    frequency: "quarterly",
    testProcedure:
      "Inspect the platform MFA enforcement (layout step-up) and the latest access review's MFA attestation per provider account.",
    evidenceRequirements: "Access review items with MFA status per account; platform enforcement reference.",
    policyKey: "access_control",
    automation: "hybrid",
  },
  {
    key: "IAM-02",
    tscCategory: "security",
    tscRefs: ["CC6.1", "CC6.2"],
    name: "Individual accounts; no undocumented shared access",
    objective:
      "Access is by individual account. Shared administrative accounts exist only as documented break-glass access.",
    description:
      "Access reviews flag shared accounts; any break-glass account is inventoried with its approval, expiry and post-use review.",
    frequency: "quarterly",
    testProcedure: "Inspect access review items flagged shared; confirm each has an approved exception or was removed.",
    evidenceRequirements: "Access review records; break-glass event records.",
    policyKey: "access_control",
    automation: "hybrid",
  },
  {
    key: "IAM-03",
    tscCategory: "security",
    tscRefs: ["CC6.2", "CC6.3"],
    name: "Joiner / mover / leaver process",
    objective: "Access is granted with approval, adjusted on role change, and removed promptly on departure.",
    description:
      "Onboarding and offboarding follow the checklist policy; every grant/change/revocation is recorded with approver and date; offboarding covers every provider in the asset inventory.",
    frequency: "per_change",
    testProcedure:
      "For each joiner/leaver in the period, trace the access-change records against the checklist; confirm revocations completed within the policy SLA.",
    evidenceRequirements: "Access change records; completed onboarding/offboarding checklists.",
    policyKey: "onboarding_offboarding",
    automation: "hybrid",
  },
  {
    key: "IAM-04",
    tscCategory: "security",
    tscRefs: ["CC6.1", "CC6.3"],
    name: "Role-based, least-privilege access",
    objective: "Access rights follow role and least privilege, enforced in the platform by RLS and staff gating.",
    description:
      "Tenant isolation is enforced by row-level security (verified by the automated cross-tenant test); staff access is membership-based; client users can never reach internal records.",
    frequency: "quarterly",
    testProcedure: "Run the RLS isolation test; review staff membership list against current team.",
    evidenceRequirements: "RLS test output; membership listing.",
    policyKey: "access_control",
    automation: "hybrid",
  },
  {
    key: "IAM-05",
    tscCategory: "security",
    tscRefs: ["CC6.2"],
    name: "Periodic access review",
    objective: "A responsible reviewer periodically reviews all accounts and privileges on in-scope systems.",
    description:
      "Quarterly access reviews list every account per system with privilege and MFA status; every account gets a retain/modify/revoke decision; revocations are actioned and recorded. The system blocks completion with undecided items.",
    frequency: "quarterly",
    testProcedure: "Inspect the completed review: all items decided, all revocations actioned, reviewer named.",
    evidenceRequirements: "Completed access review with items and decisions.",
    policyKey: "access_control",
    automation: "hybrid",
  },
  {
    key: "IAM-06",
    tscCategory: "security",
    tscRefs: ["CC6.1", "CC6.2"],
    name: "Privileged access inventory and enhanced review",
    objective: "Privileged/admin access is inventoried, individually approved and reviewed with extra scrutiny.",
    description:
      "Access review items mark privilege level; privileged grants require a named approver; unapproved privileged access raises a high-severity exception.",
    frequency: "quarterly",
    testProcedure: "Filter review items to privileged/admin; confirm each has an approver and current decision.",
    evidenceRequirements: "Privileged access listing from the review; grant approval records.",
    policyKey: "access_control",
    automation: "hybrid",
  },
  {
    key: "IAM-07",
    tscCategory: "security",
    tscRefs: ["CC6.1"],
    name: "Secrets held in approved stores only",
    objective:
      "Credentials live in approved secret stores (provider env config), never in source code, chat logs, tickets or plain-text records.",
    description:
      "Provider secrets are env-only; the service-role key is confined to server code; AI logs redact secrets by key and value shape before insert; evidence uploads are refused when secret-shaped values are detected.",
    frequency: "quarterly",
    testProcedure:
      "Inspect redaction tests; sample recent evidence/notes for secret-shaped content; confirm the two known legacy DB tokens are migrated (open exception until then).",
    evidenceRequirements: "Redaction test run; secret-scan review note.",
    policyKey: "access_control",
    automation: "hybrid",
  },
  {
    key: "IAM-08",
    tscCategory: "security",
    tscRefs: ["CC6.1", "CC6.3"],
    name: "Break-glass access controlled",
    objective:
      "Emergency privileged access requires named approval, expires within 24 hours, and gets a post-use review.",
    description:
      "Break-glass events record who, approver, reason, window and review. Self-approval and >24h windows are blocked by the database; unreviewed events raise exceptions.",
    frequency: "event",
    testProcedure: "Inspect all break-glass events in the period for approval, expiry and completed review.",
    evidenceRequirements: "Break-glass event records with reviews.",
    policyKey: "access_control",
    automation: "hybrid",
  },

  /* ── C · Secure development and change management ────────────── */
  {
    key: "DEV-01",
    tscCategory: "security",
    tscRefs: ["CC8.1", "CC6.1"],
    name: "Repository access restricted and reviewed",
    objective: "Source repositories are private, access is least-privilege, and membership is reviewed.",
    description:
      "GitHub org/repo membership appears in the quarterly access review; dispatch tokens are fine-grained and inventoried as assets.",
    frequency: "quarterly",
    testProcedure: "Inspect the access review section covering GitHub; confirm token inventory is current.",
    evidenceRequirements: "Access review items for source control.",
    policyKey: "secure_development",
    automation: "hybrid",
  },
  {
    key: "DEV-02",
    tscCategory: "security",
    tscRefs: ["CC8.1"],
    name: "Production changes carry a change record",
    objective:
      "Every production change links a change record: request, reviewer, approval, test evidence and rollback plan.",
    description:
      "Change records tie deploys to their PR/fix-batch and ticket. Deployed changes missing reviewer, approval, test evidence or rollback plan raise a high-severity exception; self-approval is visible and flagged.",
    frequency: "per_change",
    testProcedure: "Sample deployed change records; verify linkage and approvals; inspect exceptions raised for gaps.",
    evidenceRequirements: "Change records for the period with linked PRs and approvals.",
    policyKey: "secure_development",
    automation: "hybrid",
  },
  {
    key: "DEV-03",
    tscCategory: "security",
    tscRefs: ["CC8.1"],
    name: "Peer review before production",
    objective: "Production code changes are peer reviewed, with documented exceptions where impossible.",
    description:
      "Pull-request review is the norm; where the team is one person, the documented compensating control (self-review checklist + periodic external review) applies and is recorded as an approved exception.",
    frequency: "per_change",
    testProcedure: "Sample merged PRs for review; inspect the recorded compensating-control exception where applicable.",
    evidenceRequirements: "PR review references on change records; compensating-control exception record.",
    policyKey: "secure_development",
    automation: "hybrid",
  },
  {
    key: "DEV-04",
    tscCategory: "security",
    tscRefs: ["CC8.1", "CC7.1"],
    name: "Automated tests and checks proportionate to the change",
    objective: "Typecheck, lint and tests run before release; results are referenced from the change record.",
    description: "The monorepo's typecheck/lint/test suite gates releases; change records reference the run outcome.",
    frequency: "per_change",
    testProcedure: "Sample change records for test evidence references.",
    evidenceRequirements: "Test outcome references on change records.",
    policyKey: "secure_development",
    automation: "hybrid",
  },
  {
    key: "DEV-05",
    tscCategory: "security",
    tscRefs: ["CC8.1"],
    name: "Environment separation",
    objective: "Development, preview and production environments are separate where feasible.",
    description:
      "Vercel preview vs production; Supabase per-project separation; environments are inventoried assets with owners and classifications.",
    frequency: "annual",
    testProcedure: "Inspect the asset inventory's environments; confirm separation notes are current.",
    evidenceRequirements: "Environment asset records.",
    policyKey: "secure_development",
    automation: "manual",
  },
  {
    key: "DEV-06",
    tscCategory: "security",
    tscRefs: ["CC8.1"],
    name: "Authorised deployment with rollback",
    objective: "Production deployments have an authorised approver and a rollback plan.",
    description:
      "Change records carry approver and rollback plan; Vercel's instant-rollback is the default mechanism and is named per record.",
    frequency: "per_change",
    testProcedure: "Sample deployed change records for approver and rollback plan.",
    evidenceRequirements: "Approved change records.",
    policyKey: "secure_development",
    automation: "hybrid",
  },
  {
    key: "DEV-07",
    tscCategory: "security",
    tscRefs: ["CC7.1"],
    name: "Dependency and vulnerability management",
    objective: "Dependencies are scanned; critical/high findings get an owner and remediation within SLA.",
    description:
      "Dependency audit runs at least monthly (manual `pnpm audit` until CI wiring lands); findings above threshold become exceptions with owners and due dates.",
    frequency: "monthly",
    testProcedure: "Inspect the latest audit evidence and the exception trail for findings.",
    evidenceRequirements: "Audit run output reference; remediation exceptions.",
    policyKey: "vulnerability_management",
    automation: "hybrid",
  },
  {
    key: "DEV-08",
    tscCategory: "security",
    tscRefs: ["CC8.1", "CC4.1"],
    name: "Change logging",
    objective: "Source, configuration and deployment changes are logged and attributable.",
    description:
      "Git history, Vercel deploy history and the append-only audit log record changes; the audit log is DB-stamped so entries cannot be forged.",
    frequency: "continuous",
    testProcedure: "Trace a sampled change from commit to deploy to audit entry.",
    evidenceRequirements: "Sampled trace references.",
    policyKey: "secure_development",
    automation: "automated",
  },

  /* ── D · Data protection and confidentiality ─────────────────── */
  {
    key: "DATA-01",
    tscCategory: "confidentiality",
    tscRefs: ["C1.1", "CC3.2"],
    name: "Data classification applied",
    objective: "Data and assets are classified (public/internal/confidential/restricted) with handling rules.",
    description:
      "Every asset carries a classification; new assets/integrations without one are flagged; the Data Classification Standard defines handling per level.",
    frequency: "quarterly",
    testProcedure: "List unclassified active assets (target: zero); sample handling against the standard.",
    evidenceRequirements: "Asset inventory export; classification review note.",
    policyKey: "data_classification",
    automation: "hybrid",
  },
  {
    key: "DATA-02",
    tscCategory: "confidentiality",
    tscRefs: ["C1.1", "CC6.1"],
    name: "Restricted access to client data, credentials and source",
    objective:
      "Client credentials, production data, source code and personal data are restricted to those who need them.",
    description:
      "RLS-enforced tenant isolation; private storage buckets; staff-only internal records; client-system credentials referenced, never stored in plain text.",
    frequency: "quarterly",
    testProcedure: "Run the RLS isolation test; review bucket privacy; sample passports for credential references.",
    evidenceRequirements: "RLS test output; storage configuration reference.",
    policyKey: "data_classification",
    automation: "hybrid",
  },
  {
    key: "DATA-03",
    tscCategory: "confidentiality",
    tscRefs: ["CC6.7", "C1.1"],
    name: "Encryption in transit and at rest documented",
    objective: "Encryption posture for each in-scope service is documented and current.",
    description:
      "TLS via Vercel/Supabase; at-rest encryption per provider. The vendor register records each provider's documented posture.",
    frequency: "annual",
    testProcedure: "Inspect vendor register encryption notes; confirm no in-scope service lacks a documented posture.",
    evidenceRequirements: "Vendor register export with security documentation references.",
    policyKey: "data_classification",
    automation: "manual",
  },
  {
    key: "DATA-04",
    tscCategory: "confidentiality",
    tscRefs: ["C1.2"],
    name: "Retention and deletion operated",
    objective: "Client data, backups, logs and records follow defined retention and deletion rules.",
    description:
      "Retention decisions are recorded per asset; termination records track deletion due dates; evidence items carry retention_until; erasure is audit-logged.",
    frequency: "quarterly",
    testProcedure: "Sample assets/evidence for retention decisions; inspect termination deletions done on time.",
    evidenceRequirements: "Retention listing; deletion records.",
    policyKey: "backup_recovery",
    automation: "hybrid",
  },
  {
    key: "DATA-05",
    tscCategory: "confidentiality",
    tscRefs: ["CC9.2", "C1.1"],
    name: "Data sharing and sub-processor use documented",
    objective: "Where client data reaches third parties, the sharing is documented and clients are notified per contract.",
    description:
      "The sub-processor register is published; changes follow the enforced 14-day notice machinery; vendor records document data access.",
    frequency: "quarterly",
    testProcedure: "Compare live integrations against the register; inspect notice records for changes in the period.",
    evidenceRequirements: "Register export; notice delivery records.",
    policyKey: "vendor_management",
    automation: "hybrid",
  },
  {
    key: "DATA-06",
    tscCategory: "confidentiality",
    tscRefs: ["CC6.7"],
    name: "Secure file sharing and client access rules",
    objective: "Files move through authenticated, classified channels; evidence downloads are signed and expiring.",
    description:
      "Client deliverables and evidence live in private buckets with short-lived signed URLs; uploads are validated and checksummed.",
    frequency: "annual",
    testProcedure: "Inspect bucket policies and a sampled signed-URL flow.",
    evidenceRequirements: "Storage policy reference; sampled flow note.",
    policyKey: "data_classification",
    automation: "hybrid",
  },
  {
    key: "DATA-07",
    tscCategory: "confidentiality",
    tscRefs: ["CC3.4", "C1.1"],
    name: "Sensitive-project compliance review",
    objective:
      "A project handling special-category or children's data gets a recorded compliance review before it can read as ready.",
    description:
      "Projects flagged for special-category data raise a review requirement; readiness for the Confidentiality category cannot read positive while the review exception is open.",
    frequency: "event",
    testProcedure: "Inspect flagged projects and their review exception trail.",
    evidenceRequirements: "Compliance review records for flagged projects.",
    policyKey: "data_classification",
    automation: "automated",
  },

  /* ── E · Availability, continuity and resilience ─────────────── */
  {
    key: "AVL-01",
    tscCategory: "availability",
    tscRefs: ["A1.2"],
    name: "Backup approach documented and operating",
    objective: "In-scope production systems and critical records have a documented, operating backup approach.",
    description:
      "The Backup & Recovery Standard names schedule, retention and restore approach per system; the Supabase policy id is recorded and referenced by Order Forms.",
    frequency: "monthly",
    testProcedure: "Inspect the recorded policy and the month's backup review evidence.",
    evidenceRequirements: "Backup review note/report reference per system.",
    policyKey: "backup_recovery",
    automation: "hybrid",
  },
  {
    key: "AVL-02",
    tscCategory: "availability",
    tscRefs: ["A1.2"],
    name: "Backup success reviewed",
    objective: "Backup success is checked at defined intervals and failures are remediated.",
    description: "A monthly review confirms backups ran for each in-scope system; failures raise exceptions.",
    frequency: "monthly",
    testProcedure: "Inspect the review evidence and any failure exceptions with remediation.",
    evidenceRequirements: "Monthly backup review evidence.",
    policyKey: "backup_recovery",
    automation: "hybrid",
  },
  {
    key: "AVL-03",
    tscCategory: "availability",
    tscRefs: ["A1.3"],
    name: "Restore test performed",
    objective: "A restore is tested and recorded at a sensible cadence, not assumed.",
    description:
      "A documented restore test (to a scratch project) runs at least semi-annually per critical system; results and gaps are recorded.",
    frequency: "semiannual",
    testProcedure: "Inspect the restore test record: system, date, performer, outcome, issues.",
    evidenceRequirements: "Restore test evidence.",
    policyKey: "backup_recovery",
    automation: "manual",
  },
  {
    key: "AVL-04",
    tscCategory: "availability",
    tscRefs: ["CC7.4", "CC7.5"],
    name: "Incident response operated",
    objective: "Incidents follow the response plan: owner, severity, containment, communication decision, review.",
    description:
      "Security incidents are recorded with timeline, containment and a human notification decision; high severity requires acknowledgement within the policy SLA.",
    frequency: "event",
    testProcedure: "Inspect incidents in the period against the plan's required fields and SLAs.",
    evidenceRequirements: "Incident records with timelines and post-incident reviews.",
    policyKey: "incident_response",
    automation: "hybrid",
  },
  {
    key: "AVL-05",
    tscCategory: "availability",
    tscRefs: ["A1.3", "CC9.1"],
    name: "Business continuity / disaster recovery reviewed",
    objective: "A BC/DR plan exists and is tabletop-reviewed on a defined cadence.",
    description:
      "The BC/DR plan covers loss of key person, provider outage and data loss; an annual tabletop review is recorded with findings.",
    frequency: "annual",
    testProcedure: "Inspect the plan version and the tabletop review record.",
    evidenceRequirements: "Tabletop review evidence.",
    policyKey: "business_continuity",
    automation: "manual",
  },
  {
    key: "AVL-06",
    tscCategory: "availability",
    tscRefs: ["A1.1", "CC7.2"],
    name: "Availability monitoring of operated systems",
    objective: "Production services Null Shift operates are monitored for availability, with alerting.",
    description:
      "Until a monitoring integration is connected, a monthly manual health check per operated system is recorded; stale or failed checks raise exceptions. Connecting real monitoring is the standing remediation.",
    frequency: "monthly",
    testProcedure: "Inspect the month's health-check evidence per operated system.",
    evidenceRequirements: "Health check evidence; monitoring integration status.",
    policyKey: "business_continuity",
    automation: "hybrid",
  },

  /* ── F · Vendor and sub-processor management ─────────────────── */
  {
    key: "VND-01",
    tscCategory: "security",
    tscRefs: ["CC9.2"],
    name: "Approved vendor register maintained",
    objective: "In-scope services run only on vendors in the approved register.",
    description:
      "Every provider in use has a vendor record: service, data access, dependency, owner, risk, DPA/contract status. Integrations without a register entry are flagged.",
    frequency: "quarterly",
    testProcedure: "Compare live integrations/env configuration against the register; target zero unregistered.",
    evidenceRequirements: "Vendor register export; unregistered-integration exception trail.",
    policyKey: "vendor_management",
    automation: "hybrid",
  },
  {
    key: "VND-02",
    tscCategory: "security",
    tscRefs: ["CC9.2"],
    name: "Vendor security review before sensitive use",
    objective:
      "A proportionate security/privacy review happens before a vendor handles sensitive or client data.",
    description:
      "Vendors touching confidential/personal data require an approval decision with reviewed security documentation before status becomes approved.",
    frequency: "event",
    testProcedure: "Sample approved vendors for their review evidence; inspect exceptions for unapproved use.",
    evidenceRequirements: "Vendor review evidence per approval.",
    policyKey: "vendor_management",
    automation: "hybrid",
  },
  {
    key: "VND-03",
    tscCategory: "security",
    tscRefs: ["CC9.2"],
    name: "Critical vendors reassessed periodically",
    objective: "Critical vendors are re-reviewed on cadence and after material changes or incidents.",
    description:
      "Review due dates are tracked; overdue critical vendors alert their owner; closure of the exception requires review evidence.",
    frequency: "annual",
    testProcedure: "Inspect review dates for critical vendors; confirm none overdue without an open exception.",
    evidenceRequirements: "Vendor review records.",
    policyKey: "vendor_management",
    automation: "hybrid",
  },
  {
    key: "VND-04",
    tscCategory: "security",
    tscRefs: ["CC9.2"],
    name: "AI providers approved before client data use",
    objective: "New AI providers/tools require approval before touching client confidential data.",
    description:
      "AI vendors are register entries like any other; the AI Tool & Client Data Use policy defines the approval; agents using unapproved integrations raise exceptions.",
    frequency: "event",
    testProcedure: "Compare AI Workspace runtimes/integrations against approved AI vendor entries.",
    evidenceRequirements: "Vendor approvals for AI providers; exception trail.",
    policyKey: "ai_tool_use",
    automation: "hybrid",
  },

  /* ── G · Incident management ─────────────────────────────────── */
  {
    key: "INC-01",
    tscCategory: "security",
    tscRefs: ["CC7.3"],
    name: "Incident definition and severity model",
    objective: "What counts as a security incident, and its severity model, are defined and used.",
    description:
      "The Incident Response Plan defines incident classes and severities; records use them; suspicious events get triaged rather than silently ignored.",
    frequency: "annual",
    testProcedure: "Inspect the plan; sample incidents for correct classification.",
    evidenceRequirements: "Plan version; sampled incident records.",
    policyKey: "incident_response",
    automation: "manual",
  },
  {
    key: "INC-02",
    tscCategory: "security",
    tscRefs: ["CC7.4", "CC7.5"],
    name: "Incident lifecycle recorded end to end",
    objective:
      "Detection, assessment, containment, investigation, recovery, communication decision and lessons learned are recorded.",
    description:
      "The incident record's append-only timeline captures each phase; the notification decision is a named human act (with specialist advice where flagged), never automated.",
    frequency: "event",
    testProcedure: "Trace a sampled incident through all phases on its timeline.",
    evidenceRequirements: "Incident timelines; post-incident reviews.",
    policyKey: "incident_response",
    automation: "hybrid",
  },
  {
    key: "INC-03",
    tscCategory: "security",
    tscRefs: ["CC7.5"],
    name: "Incident response tabletop test",
    objective: "The incident response process is exercised periodically, not just written down.",
    description: "An annual tabletop walks a realistic scenario; findings feed the plan and the risk register.",
    frequency: "annual",
    testProcedure: "Inspect the tabletop record and resulting actions.",
    evidenceRequirements: "Tabletop evidence.",
    policyKey: "incident_response",
    automation: "manual",
  },

  /* ── AI Workspace governance ─────────────────────────────────── */
  {
    key: "AIW-01",
    tscCategory: "security",
    tscRefs: ["CC6.1", "CC8.1"],
    name: "AI agents have accountable owners and approved scope",
    objective:
      "Every active AI agent has a named human owner, an approved manager, and a defined task/data scope, tool grants, risk tier and budget.",
    description:
      "Agent records carry owner, tool grants, data scopes, risk tier and human gates; activation is lifecycle-gated; agents without owners raise exceptions.",
    frequency: "quarterly",
    testProcedure: "List active agents; confirm each has owner, scope and current config version.",
    evidenceRequirements: "Agent register export with owners and grants.",
    policyKey: "ai_tool_use",
    automation: "automated",
  },
  {
    key: "AIW-02",
    tscCategory: "security",
    tscRefs: ["CC6.1", "CC7.2"],
    name: "AI activity logged, gated and within budget",
    objective:
      "Agent actions are logged with redaction; high-impact actions need human approval; budget and policy denials are recorded and escalated.",
    description:
      "Tool invocations log redacted arguments and confirmation state; Tier 2+ output needs approval; policy denials, budget breaches and stale heartbeats surface as exceptions.",
    frequency: "continuous",
    testProcedure:
      "Sample tool invocations for redaction and confirmation; inspect the exception trail for denials/budget events.",
    evidenceRequirements: "Invocation log samples; escalation/exception records.",
    policyKey: "ai_tool_use",
    automation: "automated",
  },
];

/** Look up a seed by key (used by tests and the seeding action). */
export const controlSeed = (key: string): ControlSeed | undefined =>
  CONTROL_LIBRARY.find((c) => c.key === key);
