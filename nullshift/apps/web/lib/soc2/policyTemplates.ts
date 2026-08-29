/**
 * Seeded policy drafts — structured starting points, every one marked DRAFT
 * and requiring human review before approval (legal review where flagged).
 * The system never approves a policy: approval is a named human act recorded
 * on the policy version, and acknowledgement tracking only starts once a
 * version is approved.
 *
 * Bodies are Markdown. They describe how Null Shift ACTUALLY operates today
 * (single Supabase/Vercel/GitHub estate, care-plan hosting, AI Workspace) so
 * review means correcting specifics — not translating boilerplate.
 */

export type PolicyTemplate = {
  key: string;
  title: string;
  requiresAcknowledgement: boolean;
  acknowledgementAudience: "all_staff" | "engineering" | "admins" | "none";
  legalReviewRequired: boolean;
  reviewCadenceDays: number;
  body: string;
};

const draftHeader = (title: string) => `> **DRAFT — requires human review before approval.**
> Prepared as a structured starting point by the readiness tooling. Statements
> below describe intended operation; the owner must correct anything that does
> not match reality before approval. This document supports internal management
> and readiness preparation — it is not a compliance certification.

# ${title}

`;

export const POLICY_TEMPLATES: PolicyTemplate[] = [
  {
    key: "information_security",
    title: "Information Security Policy",
    requiresAcknowledgement: true,
    acknowledgementAudience: "all_staff",
    legalReviewRequired: false,
    reviewCadenceDays: 366,
    body:
      draftHeader("Information Security Policy") +
      `## Purpose and scope
Protect the confidentiality, integrity and availability of the systems and data
through which Null Shift Development delivers and supports client software. It
applies to all staff and contractors, all in-scope systems in the asset
inventory, and all client data handled through them.

## Governance
- A named **Security/SOC 2 Programme Owner** (a Director) owns this policy, the
  risk register, control design and readiness reporting.
- Every control in the control library has a named owner, a frequency and
  defined evidence. Control health is reviewed at the quarterly management
  review, alongside major risks, incidents and open exceptions.
- Risk acceptance is a named decision by the Programme Owner, recorded in the
  risk register.

## Core commitments
1. Access is least-privilege, individual, and MFA-protected wherever supported.
2. Client data is classified and handled per the Data Classification and
   Handling Standard; client tenants are isolated by row-level security.
3. Changes to production follow the Secure Development and Change Management
   Policy.
4. Incidents follow the Incident Response Plan; suspected incidents are
   reported the same day, without blame.
5. Vendors and sub-processors are used only from the approved register.
6. AI tooling operates under the AI Tool and Client Data Use Policy.
7. Every material administrative action is recorded in the append-only audit
   log.

## Exceptions to this policy
Deviations are recorded as exceptions in the readiness system with an owner, a
due date and (where accepted) a documented, approved reason and compensating
control. Nobody approves their own exception.

## Review
Reviewed at least annually by the Programme Owner and re-acknowledged by all
staff after material change.`,
  },
  {
    key: "access_control",
    title: "Access Control Policy",
    requiresAcknowledgement: true,
    acknowledgementAudience: "all_staff",
    legalReviewRequired: false,
    reviewCadenceDays: 366,
    body:
      draftHeader("Access Control Policy") +
      `## Principles
- **Individual accounts only.** Shared credentials are prohibited except
  documented break-glass access (below).
- **Least privilege.** Access matches role; privileged/admin access requires a
  named approver and appears in the privileged-access inventory.
- **MFA everywhere it is supported** — the Ops admin enforces TOTP step-up in
  code; provider accounts (Supabase, Vercel, GitHub, Stripe, GoCardless, Xero,
  Resend, Anthropic) must have MFA enabled and attested at access review.

## Granting, changing, removing
Every grant, change and revocation is recorded (who, what, approver, when) in
the access-change log. Offboarding follows the Onboarding/Offboarding
Checklist and completes within **[3 working days — confirm]** of departure,
covering every provider in the asset inventory plus the admin allowlist and
internal-tenant membership.

## Access reviews
A quarterly access review lists every account on every in-scope system with
privilege and MFA status. Every account gets a retain/modify/revoke decision;
revocations are actioned and their completion recorded. The system will not
let a review complete with undecided or unactioned items.

## Break-glass access
Emergency privileged access requires: a named approver (not the user), a
recorded reason, expiry within 24 hours, and a post-use review. The readiness
system flags any unreviewed use.

## Secrets
Credentials live in approved stores (provider environment configuration) —
never in source code, chat logs, tickets, documents or plain-text database
fields. Suspected exposure is an incident: rotate first, investigate second.`,
  },
  {
    key: "acceptable_use",
    title: "Acceptable Use Policy",
    requiresAcknowledgement: true,
    acknowledgementAudience: "all_staff",
    legalReviewRequired: false,
    reviewCadenceDays: 366,
    body:
      draftHeader("Acceptable Use Policy") +
      `## Using Null Shift systems and client data
- Work accounts, work systems: client data stays inside in-scope systems and
  is never copied to personal devices, personal cloud accounts or unapproved
  tools.
- Client confidential material (source code, credentials, commercial terms) is
  shared only through approved, authenticated channels — never public links.
- WhatsApp/Zoom/email content that concerns client work is brought into the
  Ops inbox the same day; it is not a system of record.
- Devices used for work have OS updates applied, disk encryption on, and a
  lock screen. **[Confirm the current device list and posture — see the device
  attestation in access reviews.]**
- AI tools are used per the AI Tool and Client Data Use Policy — client
  confidential data goes only to approved AI providers.

## Prohibited
Sharing individual credentials; disabling security controls; installing
unvetted tooling that touches client data; testing security controls without
authorisation; using client data for anything outside the engagement.

## Reporting
Suspected phishing, loss of a device, or accidental exposure is reported to
the Programme Owner immediately. Fast reporting is never punished.`,
  },
  {
    key: "secure_development",
    title: "Secure Software Development & Change Management Policy",
    requiresAcknowledgement: true,
    acknowledgementAudience: "engineering",
    legalReviewRequired: false,
    reviewCadenceDays: 366,
    body:
      draftHeader("Secure Software Development & Change Management Policy") +
      `## Repositories
Private by default; access least-privilege and reviewed quarterly; automation
tokens are fine-grained, inventoried as assets, and rotated on staff change.

## Making changes
1. Work is tracked (issue, fix batch, order form or change order).
2. Changes reach production through pull requests. Peer review is required;
   where the team is one person, the documented compensating control applies:
   a recorded self-review checklist plus periodic external review, held as an
   approved exception in the readiness system.
3. Typecheck, lint and tests run before release; outcomes are referenced from
   the change record.
4. Every production deployment has a change record: what, why, reviewer,
   approver, test evidence, rollback plan, deployment reference.
5. Rollback default is the platform's instant rollback; anything schema-level
   names its down-path in the change record.

## Environments
Development, preview and production are separated. Production data is not
copied into development environments; scrubbed or synthetic data is used.

## Dependencies
Dependency audit runs at least monthly. Critical/high findings get an owner
and a remediation exception with a due date per the Vulnerability and Patch
Management Standard.

## Direct-to-production changes
Hotfixes outside the pipeline are permitted only for live incidents, must be
recorded as a change within 24 hours, and are reviewed at the next management
review.`,
  },
  {
    key: "incident_response",
    title: "Incident Response Plan",
    requiresAcknowledgement: true,
    acknowledgementAudience: "all_staff",
    legalReviewRequired: true,
    reviewCadenceDays: 366,
    body:
      draftHeader("Incident Response Plan") +
      `## What counts as a security incident
Unauthorised access or credible attempt; loss/exposure of client data or
credentials; malware; a vulnerability exploited in production; sustained loss
of availability of an operated system; misuse of AI tooling affecting client
data.

## Severity
- **Critical** — client data or production security credibly at risk now.
- **High** — significant control failure or service impact.
- **Medium** — contained issue needing scheduled remediation.
- **Low** — near-miss or hygiene finding.

## Response steps (record each on the incident timeline)
1. **Detect & record** — open an incident record immediately; do not wait for
   certainty.
2. **Own & acknowledge** — critical/high incidents are acknowledged by a named
   owner within **24 hours** of detection.
3. **Contain** — rotate exposed credentials first (Supabase service role,
   Stripe, GoCardless, Xero, Resend, Anthropic, GitHub tokens), revoke
   sessions, isolate affected systems.
4. **Investigate & recover** — establish scope from the audit log and provider
   logs; restore from backups where needed.
5. **Communication decision** — whether client, regulator or contractual
   notification duties arise is a **named human decision**, recorded with its
   reasoning. Where the position is unclear, specialist legal advice is taken
   before concluding. The system never automates this conclusion.
   *(UK GDPR context: processor duty to notify controllers without undue
   delay; controllers' 72-hour ICO window — see the compliance runbook.)*
6. **Learn** — post-incident review within 14 days of closure: root cause,
   what worked, register updates, regression test where code was at fault.

## Testing
A tabletop exercise at least annually, recorded as evidence with findings.`,
  },
  {
    key: "business_continuity",
    title: "Business Continuity & Disaster Recovery Plan",
    requiresAcknowledgement: false,
    acknowledgementAudience: "admins",
    legalReviewRequired: false,
    reviewCadenceDays: 366,
    body:
      draftHeader("Business Continuity & Disaster Recovery Plan") +
      `## Scenarios this plan covers
1. **Loss of a production provider** (Vercel/Supabase regional failure) —
   recovery is provider-led; our duty is client communication within
   **[2 hours — confirm]** of confirmed impact and restore verification after.
2. **Data loss/corruption** — restore from Supabase backups per the Backup &
   Recovery Standard; verify against the audit log; notify affected clients of
   any gap.
3. **Loss of key person** — the continuity pack (this plan, the asset
   inventory, system passports, and access recovery steps) lets a nominated
   deputy **[name one]** operate or wind down responsibly. Provider account
   recovery paths are documented per asset. **[Confirm each.]**
4. **Loss of the Ops platform itself** — client systems keep running; rebuild
   follows supabase/README.md apply order (known liability: two migration
   series — consolidation is a standing backlog item).

## Objectives
Per operated system: RTO **[confirm, e.g. 1 business day]**, RPO bounded by
the backup schedule in the Backup & Recovery Standard.

## Review
Tabletop-reviewed annually; findings feed the risk register and this plan.`,
  },
  {
    key: "vendor_management",
    title: "Vendor & Sub-processor Management Policy",
    requiresAcknowledgement: false,
    acknowledgementAudience: "admins",
    legalReviewRequired: true,
    reviewCadenceDays: 366,
    body:
      draftHeader("Vendor & Sub-processor Management Policy") +
      `## Register
Every provider used for in-scope services has a vendor record: service,
data accessed, dependency criticality, owner, risk level, security
documentation references, DPA/contract status, hosting/transfer context and
review date. Providers processing client personal data also appear in the
public sub-processor register, and changes to that register follow the
contractual notice machinery (14 clear days, per-client delivery — enforced in
the database).

## Before use
A proportionate security/privacy review happens **before** a vendor touches
sensitive or client data: security documentation reviewed, DPA position
confirmed, data-access classification recorded, approval decision named. New
AI providers additionally follow the AI Tool and Client Data Use Policy.

## Ongoing
- Critical vendors re-reviewed at least annually and after material change or
  a vendor incident.
- Expired security documents and overdue reviews are flagged automatically;
  closure of the flag requires review evidence.
- Offboarding: access/keys revoked, data return/deletion confirmed, register
  updated, clients notified where contractually required.`,
  },
  {
    key: "data_classification",
    title: "Data Classification & Handling Standard",
    requiresAcknowledgement: true,
    acknowledgementAudience: "all_staff",
    legalReviewRequired: false,
    reviewCadenceDays: 366,
    body:
      draftHeader("Data Classification & Handling Standard") +
      `## Levels
- **Public** — published material. No handling constraints.
- **Internal** — business records with no client confidence attached.
- **Confidential** — client project material: scope, pricing, contracts,
  transcripts, passports, source code. Access on engagement need only.
- **Restricted** — credentials/secrets, personal data, special-category data,
  security records. Access named-individual only; storage in approved systems
  only; never in notifications, exports or AI context.

## Rules that follow from the level
- Every asset in the inventory carries a classification; new assets and
  integrations are flagged until they have one, plus a retention decision.
- Confidential and Restricted data moves only through authenticated channels;
  file access uses signed, expiring links.
- Restricted data never appears in: logs (redaction is enforced in code),
  email/notification previews, audit-pack exports, or evidence free-text.
- **Special-category and children's data**: any project handling it gets a
  recorded compliance review before build; the readiness system blocks a
  positive Confidentiality reading until that review exists.

## Retention
Client data, backups, logs and records follow recorded retention decisions
per asset; evidence items carry their own retention dates; erasure and
termination deletions are audit-logged.`,
  },
  {
    key: "backup_recovery",
    title: "Backup & Recovery Standard",
    requiresAcknowledgement: false,
    acknowledgementAudience: "admins",
    legalReviewRequired: false,
    reviewCadenceDays: 366,
    body:
      draftHeader("Backup & Recovery Standard") +
      `## Approach
- **Ops platform database (Supabase)** — provider backups. Record the plan's
  schedule and retention here **[confirm from the Supabase dashboard]** and
  store the policy id; Order Forms storing personal data reference it
  (technical.backupPolicyId) and are blocked without one.
- **Client systems on care plans** — per-system backup posture is recorded on
  the system passport and inventoried as an asset attribute.
- **Storage buckets** (deliverables, issue attachments, evidence) —
  **[confirm provider posture / replication]**.
- **This repository** — Git on GitHub; the two-series migration liability is
  tracked as a risk until consolidation.

## Verification
- **Monthly** — backup success reviewed per in-scope system; evidence
  attached to the control run; failures raise exceptions immediately.
- **Semi-annually** — a restore test to a scratch project, recorded with
  performer, duration, outcome and gaps. A restore that has never been tested
  is treated as not existing.

## Recovery
Restore steps live with each system passport; platform rebuild order lives in
supabase/README.md. Post-restore verification includes the RLS isolation test
and an audit-log continuity check.`,
  },
  {
    key: "vulnerability_management",
    title: "Vulnerability & Patch Management Standard",
    requiresAcknowledgement: false,
    acknowledgementAudience: "engineering",
    legalReviewRequired: false,
    reviewCadenceDays: 366,
    body:
      draftHeader("Vulnerability & Patch Management Standard") +
      `## Sources
- Dependency audit (\`pnpm audit\`) at least monthly — CI wiring is the
  standing remediation; until then the run is manual and evidenced.
- Supabase database advisors (security lints) checked at least quarterly.
- Provider security advisories for the platforms in the vendor register.
- Reports received at the published security contact.

## SLAs by severity (from discovery)
- **Critical** — begin remediation within 48 hours; fix or compensating
  control within 7 days.
- **High** — 14 days.
- **Medium** — 30 days, batched with releases.
- **Low** — next scheduled maintenance.

Findings above threshold become exceptions with owner and due date; missing
either is itself flagged. An accepted risk (e.g. no patch exists) is recorded
in the risk register with a named acceptor, never left implicit.

## Patching
Framework and dependency updates ride the normal change process; emergency
patches use the hotfix path in the Secure Development Policy.`,
  },
  {
    key: "onboarding_offboarding",
    title: "Employee & Contractor Onboarding / Offboarding Checklist",
    requiresAcknowledgement: false,
    acknowledgementAudience: "admins",
    legalReviewRequired: false,
    reviewCadenceDays: 366,
    body:
      draftHeader("Employee & Contractor Onboarding / Offboarding Checklist") +
      `## Onboarding (before first access to client data)
1. Contract incl. confidentiality terms signed. **[Legal owns the template.]**
2. Policy acknowledgements completed (Information Security, Access Control,
   Acceptable Use, Data Classification, AI Tool Use).
3. Access granted least-privilege per role, each grant recorded with approver
   in the access-change log: internal-tenant membership; GitHub; Vercel;
   Supabase; provider consoles only if the role needs them.
4. MFA verified on every granted account.
5. Device posture confirmed (encryption, updates, lock).

## Offboarding (complete within [3 working days — confirm])
1. Revoke in every system, recording each: memberships row; ADMIN_EMAILS (if
   present); GitHub org + per-repo; Vercel; Supabase; Stripe; GoCardless;
   Xero; Resend; Anthropic console; any client-system access.
2. Rotate shared-fate secrets the person could have seen (service-role key,
   dispatch tokens, webhook secrets).
3. Transfer ownership: reassign their controls, assets, vendors, agents and
   open exceptions.
4. Record completion in the access-change log; the next access review
   verifies nothing survived.

The readiness system flags any account marked for revocation that is not
recorded as removed within the SLA — critically.`,
  },
  {
    key: "ai_tool_use",
    title: "AI Tool & Client Data Use Policy",
    requiresAcknowledgement: true,
    acknowledgementAudience: "all_staff",
    legalReviewRequired: true,
    reviewCadenceDays: 183,
    body:
      draftHeader("AI Tool & Client Data Use Policy") +
      `## Approved use
AI tooling (Anthropic API, Claude Code surfaces, the internal AI Workspace)
is part of how Null Shift works. It operates inside the same control regime
as everything else — not beside it.

## Rules for every agent and routine
- A **named human owner** and an approved manager; an active agent without an
  owner is flagged and should be paused.
- Defined task/data scope, tool grants, risk tier and budget, all versioned;
  access to client data is least-privilege against that scope.
- Full activity logging with **secret redaction enforced in code before the
  write**; no plain-text credentials in prompts, configs or logs.
- **Human approval before**: external communication, financial action,
  deployment, contractual/legal material, or processing outside the approved
  data scope. High-impact tool calls require recorded confirmation.
- Denied tool/data access, budget breaches, unapproved integrations, stale
  heartbeats and high-risk escalations surface as exceptions for review.

## AI providers
An AI provider is a vendor: register entry, security review and DPA position
**before** client confidential data reaches it. **[Legal: confirm Anthropic
DTA/DPA terms and the sub-processor register entry.]**

## What AI must never do here
Declare legal or compliance conclusions (including notification decisions);
approve its own actions; present unreviewed output as human-reviewed; access
another tenant's data. The Data & Privacy Review agent may **prepare** review
packs and flag issues — a person decides.

## Client-facing AI
Prospect/client-facing AI output (consultation plans, savings figures) carries
the review posture decided by management — see the standing decision in the
ops audit; unreviewed figures are a recorded risk.`,
  },
];

export const policyTemplate = (key: string): PolicyTemplate | undefined =>
  POLICY_TEMPLATES.find((p) => p.key === key);
