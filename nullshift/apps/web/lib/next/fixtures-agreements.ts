/**
 * FICTIONAL DEMO DATA for the Agreements area of the admin redesign prototype
 * (brief §5.7, §8.1, §9, §2.1). Companion to ./fixtures.ts — client ids and
 * names are reused from there so links resolve, but nothing here is read from
 * or written to a database.
 *
 * Nothing in this module is an approved price list. Every amount is a fixture
 * held in integer minor units with an explicit currency; the £600 independent
 * handover fee carries tax basis "pending decision" (brief §6.5, decision 18.3).
 *
 * Pure logic lives here too (filters and issue blockers) so it can be unit
 * tested without the DOM.
 */

import { CLIENTS } from "./fixtures";

/* ── Vocabulary (brief §5.7 / §9) ───────────────────────────────────────── */

export const DOCUMENT_TYPES = [
  "Master framework",
  "Project Order Form / SOW",
  "Managed service schedule",
  "Independent handover schedule",
  "Data/Payment/AI schedule",
  "Change Order",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

/** URL-safe keys for the type filter chips. */
export const DOCUMENT_TYPE_KEY: Record<DocumentType, string> = {
  "Master framework": "framework",
  "Project Order Form / SOW": "order-form",
  "Managed service schedule": "managed-schedule",
  "Independent handover schedule": "handover-schedule",
  "Data/Payment/AI schedule": "data-schedule",
  "Change Order": "change-order",
};

export const AGREEMENT_STATUSES = [
  "Draft",
  "Needs internal review",
  "Ready to issue",
  "Awaiting client",
  "Accepted",
  "Rejected",
  "Superseded",
  "Withdrawn",
] as const;
export type AgreementStatus = (typeof AGREEMENT_STATUSES)[number];

export const STATUS_KEY: Record<AgreementStatus, string> = {
  Draft: "draft",
  "Needs internal review": "needs-review",
  "Ready to issue": "ready",
  "Awaiting client": "awaiting-client",
  Accepted: "accepted",
  Rejected: "rejected",
  Superseded: "superseded",
  Withdrawn: "withdrawn",
};

/** Statuses before a document has been issued to the client. */
export const PRE_ISSUE_STATUSES: readonly AgreementStatus[] = [
  "Draft",
  "Needs internal review",
  "Ready to issue",
];

export const REVIEW_REQUIREMENTS = ["second-person", "standard", "none"] as const;
export type ReviewRequirement = (typeof REVIEW_REQUIREMENTS)[number];

export const REVIEW_REQUIREMENT_LABEL: Record<ReviewRequirement, string> = {
  "second-person": "Second-person legal review",
  standard: "Standard internal review",
  none: "None (historical, read-only)",
};

export type ServiceRoute = "managed" | "independent" | "unresolved" | "not applicable";

export type Money = { minor: number; currency: "GBP" };

export type PricingLine = {
  label: string;
  amount: Money;
  cadence: "one-off" | "monthly" | "per milestone" | "n/a";
  basis: string;
  /** Tax basis is a business decision (18.3); shown verbatim, never assumed. */
  taxBasis: "ex VAT" | "pending decision" | "as signed (historical)";
  /** The amount on the governing quote, when the line came from a quote. */
  quoteAmount?: Money;
};

export type RiskFlag = {
  label: string;
  severity: "high" | "medium" | "low";
  /** True when a named reviewer has closed the flag with a note. */
  resolved: boolean;
  requiresReview: boolean;
  note: string;
};

export type AuditKind = "evidence" | "acceptance" | "internal" | "issue" | "system";

export type AuditEvent = {
  at: string;
  actor: string;
  event: string;
  kind: AuditKind;
  note?: string;
};

export type AgreementFacts = {
  legalEntity?: string;
  signatory?: string;
  serviceRoute: ServiceRoute;
  /** Contractual billing-start arrangement; undefined = not yet recorded. */
  billingStart?: { arrangement: string; exactDate?: string; approvedWording: boolean };
  /** Governing quote reference; stale when a newer quote version exists. */
  quoteRef?: { id: string; version: string; stale: boolean };
  governing?: string;
  noticePeriod?: string;
  warranty?: string;
};

export type AgreementDocument = {
  id: string;
  clientId: string;
  client: string;
  project: string;
  type: DocumentType;
  version: string;
  status: AgreementStatus;
  templateVersion: string;
  reviewRequirement: ReviewRequirement;
  /** ISO date the offer lapses; undefined = no expiry (accepted or historical). */
  expiresOn?: string;
  /** Protected legacy record: shown read-only, never regenerated. */
  legacy?: boolean;
  supersedes?: string;
  supersededBy?: string;
  facts: AgreementFacts;
  scope: { included: string[]; excluded: string[]; acceptance: string[] };
  pricing: PricingLine[];
  riskFlags: RiskFlag[];
  review: { author: string | null; reviewedBy: string | null; reviewedAt: string | null };
  /** Internal notes: never rendered in the client preview. */
  internalNotes: string[];
  /** Client-visible summary; exactly what the preview shows. */
  clientSummary: string[];
  audit: AuditEvent[];
  /** Explanatory placeholder where approved wording is still pending. */
  approvedWordingPlaceholder?: string;
};

/* ── Money ──────────────────────────────────────────────────────────────── */

export const money = (m: Money): string =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: m.currency,
    minimumFractionDigits: m.minor % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(m.minor / 100);

const gbp = (minor: number): Money => ({ minor, currency: "GBP" });

const clientName = (id: string): string =>
  CLIENTS.find((c) => c.id === id)?.legalName ?? id;

/* ── Fixtures ───────────────────────────────────────────────────────────── */

export const AGREEMENTS: AgreementDocument[] = [
  {
    id: "brightwell-of-v1",
    clientId: "brightwell",
    client: clientName("brightwell"),
    project: "Client intake and records system",
    type: "Project Order Form / SOW",
    version: "v1",
    status: "Needs internal review",
    templateVersion: "OF-2026.09-draft",
    reviewRequirement: "second-person",
    expiresOn: "2026-10-10",
    facts: {
      legalEntity: "Brightwell Demo Ltd (fixture, company number pending)",
      signatory: "Leo Marsh, Director",
      serviceRoute: "unresolved",
      quoteRef: { id: "q-brightwell-v1", version: "v1", stale: false },
      warranty: "Per template default — decision 18.6 open",
    },
    scope: {
      included: [
        "Client intake forms with consent capture",
        "Case records with restricted access roles",
        "Appointment reminders (email)",
      ],
      excluded: ["Clinical decision support", "Integrations with NHS systems"],
      acceptance: [
        "A new client can be registered end to end with consent recorded",
        "Restricted records are invisible to users without the role",
      ],
    },
    pricing: [
      {
        label: "Build — fixed scoped price (draft, not approved)",
        amount: gbp(1180000),
        cadence: "one-off",
        basis: "Fixed scope per this Order Form",
        taxBasis: "ex VAT",
        quoteAmount: gbp(1180000),
      },
    ],
    riskFlags: [
      {
        label: "Sensitive personal data (health-related categories)",
        severity: "high",
        resolved: false,
        requiresReview: true,
        note: "Data classification recorded 12 Sep. Data schedule must be reviewed by a second staff member before this Order Form can be issued.",
      },
      {
        label: "Service route not elected",
        severity: "medium",
        resolved: false,
        requiresReview: false,
        note: "Client has not chosen Managed or Independent; Order Form cannot be issued with the election blank.",
      },
    ],
    review: { author: "louis", reviewedBy: null, reviewedAt: null },
    internalNotes: [
      "Do not issue until the data schedule has a second-person review recorded.",
      "Cost-to-serve and margin live in Quote Studio, not here.",
    ],
    clientSummary: [
      "Scope, exclusions and acceptance criteria as listed",
      "Build price and milestone schedule",
      "Service-route election (to be completed before issue)",
      "Data schedule attached (sensitive categories)",
    ],
    audit: [
      {
        at: "2026-09-12 16:40",
        actor: "louis",
        event: "Draft created from quote q-brightwell-v1",
        kind: "internal",
      },
      {
        at: "2026-09-12 17:05",
        actor: "louis",
        event: "Risk flag raised: sensitive personal data",
        kind: "internal",
      },
      {
        at: "2026-09-15 09:30",
        actor: "louis",
        event: "Requested second-person legal review",
        kind: "internal",
        note: "Reviewer must not be the author.",
      },
    ],
  },
  {
    id: "brightwell-ds-v1",
    clientId: "brightwell",
    client: clientName("brightwell"),
    project: "Client intake and records system",
    type: "Data/Payment/AI schedule",
    version: "v1",
    status: "Draft",
    templateVersion: "DS-2026.09-draft",
    reviewRequirement: "second-person",
    expiresOn: "2026-10-10",
    facts: {
      legalEntity: "Brightwell Demo Ltd (fixture, company number pending)",
      signatory: "Leo Marsh, Director",
      serviceRoute: "not applicable",
      governing: "brightwell-of-v1",
    },
    scope: {
      included: [
        "Processing roles and lawful basis per data category",
        "Retention periods and deletion on request",
        "Sub-processor list (hosting, email)",
      ],
      excluded: ["Payment processing (none in scope)", "AI features (none in scope)"],
      acceptance: [],
    },
    pricing: [],
    riskFlags: [
      {
        label: "Sensitive personal data (health-related categories)",
        severity: "high",
        resolved: false,
        requiresReview: true,
        note: "Attached because of real architecture and risk, not by default.",
      },
    ],
    review: { author: "louis", reviewedBy: null, reviewedAt: null },
    internalNotes: ["Attach only the schedules the architecture needs (brief §9.5)."],
    clientSummary: ["Data processing schedule attached to the Order Form"],
    audit: [
      {
        at: "2026-09-12 17:10",
        actor: "louis",
        event: "Draft data schedule created",
        kind: "internal",
      },
    ],
  },
  {
    id: "northline-of-v1",
    clientId: "northline",
    client: clientName("northline"),
    project: "Studio bookings platform",
    type: "Project Order Form / SOW",
    version: "v1",
    status: "Accepted",
    templateVersion: "OF-2026.08",
    reviewRequirement: "second-person",
    facts: {
      legalEntity: "Northline Studios Ltd (fixture)",
      signatory: "Jide Okafor, Director",
      serviceRoute: "managed",
      billingStart: {
        arrangement:
          "Managed route elected; package, exact price and start date to be accepted as a separate service schedule after build acceptance.",
        approvedWording: true,
      },
      quoteRef: { id: "q-northline-v1", version: "v1", stale: false },
      warranty: "60 days from build acceptance (as accepted)",
    },
    scope: {
      included: [
        "Booking calendar with deposits",
        "Customer accounts and reminders",
        "Admin dashboard and utilisation report",
        "Data import from spreadsheet (up to 2,000 rows)",
      ],
      excluded: ["Marketing website", "Accounting integration", "Native mobile apps"],
      acceptance: [
        "A customer can book and pay a deposit end to end",
        "Staff can reschedule and refund a deposit",
        "Report matches a checked sample week",
      ],
    },
    pricing: [
      {
        label: "Build — fixed scoped price",
        amount: gbp(1480000),
        cadence: "one-off",
        basis:
          "Three milestones: deposit 50%, build complete 25%, acceptance 25% (example schedule)",
        taxBasis: "ex VAT",
        quoteAmount: gbp(1480000),
      },
      {
        label: "Managed service — tier pending",
        amount: gbp(0),
        cadence: "n/a",
        basis:
          "No amount: consent to an unknown monthly figure is not recorded (brief §2.1)",
        taxBasis: "pending decision",
      },
    ],
    riskFlags: [],
    review: {
      author: "louis",
      reviewedBy: "second-staff",
      reviewedAt: "2026-08-29 11:20",
    },
    internalNotes: [
      "Package selection is a later checklist item, not a condition of acceptance.",
    ],
    clientSummary: [
      "Scope, exclusions and acceptance criteria",
      "Build price £14,800 ex VAT and milestone schedule",
      "Managed route elected — ongoing package to be agreed separately",
      "Approved wording for the deferred package (see below)",
    ],
    approvedWordingPlaceholder:
      "[Approved wording — deferred Managed package] The client has elected the Managed route. The package, its exact monthly price, currency, billing cadence, start date and notice period will be set out in a Managed service schedule which takes effect only once accepted by an authorised signatory. Nothing in this Order Form authorises any recurring charge.",
    audit: [
      {
        at: "2026-08-28 15:02",
        actor: "louis",
        event: "Draft created from quote q-northline-v1",
        kind: "internal",
      },
      {
        at: "2026-08-29 11:20",
        actor: "second-staff",
        event: "Second-person review recorded",
        kind: "internal",
      },
      {
        at: "2026-08-29 14:00",
        actor: "louis",
        event: "Issued — rendered snapshot frozen, hash 3f9a…c1e2 (fixture)",
        kind: "issue",
      },
      {
        at: "2026-08-29 14:01",
        actor: "system",
        event: "Sent to jide@northline.example",
        kind: "evidence",
        note: "A sent email is not acceptance.",
      },
      {
        at: "2026-09-01 09:14",
        actor: "client",
        event: "Viewed in portal",
        kind: "evidence",
        note: "Viewing is evidence, not signature.",
      },
      {
        at: "2026-09-02 10:32",
        actor: "Jide Okafor (signatory)",
        event: "Accepted — three confirmations recorded, method: portal acceptance",
        kind: "acceptance",
      },
    ],
  },
  {
    id: "harbour-of-v1",
    clientId: "harbour",
    client: clientName("harbour"),
    project: "Activity booking and waivers",
    type: "Project Order Form / SOW",
    version: "v1",
    status: "Accepted",
    templateVersion: "OF-2026.07",
    reviewRequirement: "second-person",
    facts: {
      legalEntity: "Harbour Activity Group Ltd (fixture)",
      signatory: "Priya Nair, Managing Director",
      serviceRoute: "managed",
      billingStart: {
        arrangement: "Service schedule to be accepted after build acceptance",
        approvedWording: true,
      },
      quoteRef: { id: "q-harbour-v2", version: "v2", stale: false },
      warranty: "60 days from build acceptance (as accepted)",
    },
    scope: {
      included: ["Activity booking", "Digital waivers", "Staff roster view"],
      excluded: ["Payments other than deposits"],
      acceptance: ["Booking with waiver completes end to end"],
    },
    pricing: [
      {
        label: "Build — fixed scoped price",
        amount: gbp(960000),
        cadence: "one-off",
        basis: "Deposit 50%, build complete 25%, acceptance 25%",
        taxBasis: "ex VAT",
        quoteAmount: gbp(960000),
      },
    ],
    riskFlags: [],
    review: {
      author: "louis",
      reviewedBy: "second-staff",
      reviewedAt: "2026-08-08 10:00",
    },
    internalNotes: [],
    clientSummary: [
      "Scope and acceptance",
      "Build price £9,600 ex VAT",
      "Managed route elected",
    ],
    audit: [
      {
        at: "2026-08-08 12:00",
        actor: "louis",
        event: "Issued — snapshot frozen",
        kind: "issue",
      },
      { at: "2026-08-08 12:01", actor: "system", event: "Sent", kind: "evidence" },
      {
        at: "2026-08-10 09:00",
        actor: "Priya Nair (signatory)",
        event: "Accepted — portal acceptance",
        kind: "acceptance",
      },
    ],
  },
  {
    id: "harbour-ss-v1",
    clientId: "harbour",
    client: clientName("harbour"),
    project: "Activity booking and waivers",
    type: "Managed service schedule",
    version: "v1",
    status: "Accepted",
    templateVersion: "MSS-2026.09",
    reviewRequirement: "standard",
    facts: {
      legalEntity: "Harbour Activity Group Ltd (fixture)",
      signatory: "Priya Nair, Managing Director",
      serviceRoute: "managed",
      billingStart: {
        arrangement: "Exact start date accepted",
        exactDate: "2026-10-01",
        approvedWording: true,
      },
      governing: "harbour-of-v1",
      noticePeriod: "30 days' written notice, no minimum term (fixture)",
    },
    scope: {
      included: [
        "Hosting, monitoring, backups and security updates",
        "Response target: next business day (fixture)",
        "Normal agreed usage included; material third-party cost increases reviewed under accepted terms",
      ],
      excluded: ["New features and design work — quoted separately"],
      acceptance: [],
    },
    pricing: [
      {
        label: "Managed service — Pro (fixture)",
        amount: gbp(24500),
        cadence: "monthly",
        basis:
          "Exact accepted amount; first collection on or after 1 Oct 2026, Direct Debit",
        taxBasis: "ex VAT",
      },
    ],
    riskFlags: [],
    review: {
      author: "louis",
      reviewedBy: "second-staff",
      reviewedAt: "2026-09-11 16:30",
    },
    internalNotes: ["Activation still needs internal finance approval — separate gate."],
    clientSummary: [
      "Package: Pro (fixture)",
      "Price: £245 per month, GBP, ex VAT",
      "Start date: 1 October 2026",
      "Notice: 30 days",
    ],
    audit: [
      {
        at: "2026-09-11 17:00",
        actor: "louis",
        event: "Issued — snapshot frozen",
        kind: "issue",
      },
      { at: "2026-09-11 17:01", actor: "system", event: "Sent", kind: "evidence" },
      {
        at: "2026-09-12 08:45",
        actor: "client",
        event: "Viewed in portal",
        kind: "evidence",
      },
      {
        at: "2026-09-12 09:10",
        actor: "Priya Nair (signatory)",
        event:
          "Accepted — exact amount, currency, cadence, start date and notice confirmed",
        kind: "acceptance",
      },
      {
        at: "2026-09-12 09:40",
        actor: "system",
        event: "Direct Debit mandate authorised (provider event) — not a collection",
        kind: "evidence",
      },
    ],
  },
  {
    id: "orbit-hs-v1",
    clientId: "orbit",
    client: clientName("orbit"),
    project: "Course booking and certificates",
    type: "Independent handover schedule",
    version: "v1",
    status: "Accepted",
    templateVersion: "IHS-2026.08-draft",
    reviewRequirement: "standard",
    facts: {
      legalEntity: "Orbit Training Ltd (fixture)",
      signatory: "Ana Petrova, Director",
      serviceRoute: "independent",
      governing: "orbit-of-v1",
    },
    scope: {
      included: [
        "Transfer of repository, deployment and database ownership",
        "Data transfer with restoration test",
        "DNS, email and webhook continuity checks",
        "Walkthrough session for the receiving owner",
      ],
      excluded: [
        "Ongoing Nullshift management service",
        "Third-party costs (paid by client)",
      ],
      acceptance: ["Client confirms receipt of each transfer deliverable"],
    },
    pricing: [
      {
        label: "Independent technical handover fee",
        amount: gbp(60000),
        cadence: "one-off",
        basis:
          "Invoiced once on acceptance of this schedule (draft terms, decision 18.3)",
        taxBasis: "pending decision",
      },
    ],
    riskFlags: [
      {
        label: "Application-fee disposition unresolved",
        severity: "medium",
        resolved: false,
        requiresReview: true,
        note: "Whether any Transact application fee continues after handover is an open decision (18.4). 'No ongoing Nullshift charges' could conflict with a retained fee.",
      },
    ],
    review: {
      author: "louis",
      reviewedBy: "second-staff",
      reviewedAt: "2026-08-18 14:00",
    },
    internalNotes: [
      "Open item after acceptance: fee disposition. Do not edit the accepted snapshot; resolve by amendment if wording changes.",
    ],
    clientSummary: [
      "Handover deliverables and responsibilities",
      "Fee £600 once — tax treatment to be confirmed",
      "No ongoing Nullshift management service",
    ],
    audit: [
      {
        at: "2026-08-18 15:00",
        actor: "louis",
        event: "Issued — snapshot frozen",
        kind: "issue",
      },
      { at: "2026-08-18 15:01", actor: "system", event: "Sent", kind: "evidence" },
      {
        at: "2026-08-20 11:00",
        actor: "Ana Petrova (signatory)",
        event: "Accepted — portal acceptance",
        kind: "acceptance",
      },
      {
        at: "2026-09-10 10:00",
        actor: "louis",
        event: "Risk flag raised after acceptance: application-fee disposition",
        kind: "internal",
      },
    ],
  },
  {
    id: "morrow-co-v1",
    clientId: "morrow",
    client: clientName("morrow"),
    project: "Bookings platform",
    type: "Change Order",
    version: "v1",
    status: "Superseded",
    templateVersion: "CO-2026.06",
    reviewRequirement: "standard",
    supersededBy: "morrow-co-v2",
    facts: {
      legalEntity: "Morrow Venues Ltd (fixture)",
      signatory: "Sam Whitlock, Owner",
      serviceRoute: "not applicable",
      governing: "morrow-mf-v1",
      quoteRef: { id: "q-morrow-grow-v1", version: "v1", stale: true },
    },
    scope: {
      included: ["Gift voucher sales", "Voucher redemption at checkout"],
      excluded: ["Physical voucher printing"],
      acceptance: ["A voucher can be bought and redeemed end to end"],
    },
    pricing: [
      {
        label: "Grow — gift vouchers (v1 scope)",
        amount: gbp(180000),
        cadence: "one-off",
        basis: "Fixed scope per this Change Order",
        taxBasis: "ex VAT",
        quoteAmount: gbp(180000),
      },
    ],
    riskFlags: [],
    review: {
      author: "louis",
      reviewedBy: "second-staff",
      reviewedAt: "2026-09-03 10:00",
    },
    internalNotes: ["Superseded by v2 after the client asked for partial redemption."],
    clientSummary: ["Gift voucher scope v1", "Price £1,800 ex VAT"],
    audit: [
      {
        at: "2026-09-03 11:00",
        actor: "louis",
        event: "Issued — snapshot frozen",
        kind: "issue",
      },
      { at: "2026-09-03 11:01", actor: "system", event: "Sent", kind: "evidence" },
      {
        at: "2026-09-05 16:20",
        actor: "client",
        event: "Viewed in portal",
        kind: "evidence",
      },
      {
        at: "2026-09-09 09:00",
        actor: "louis",
        event: "Superseded by v2 — v1 preserved unchanged",
        kind: "system",
      },
    ],
  },
  {
    id: "morrow-co-v2",
    clientId: "morrow",
    client: clientName("morrow"),
    project: "Bookings platform",
    type: "Change Order",
    version: "v2",
    status: "Awaiting client",
    templateVersion: "CO-2026.06",
    reviewRequirement: "standard",
    supersedes: "morrow-co-v1",
    expiresOn: "2026-10-09",
    facts: {
      legalEntity: "Morrow Venues Ltd (fixture)",
      signatory: "Sam Whitlock, Owner",
      serviceRoute: "not applicable",
      governing: "morrow-mf-v1",
      quoteRef: { id: "q-morrow-grow-v2", version: "v2", stale: false },
    },
    scope: {
      included: [
        "Gift voucher sales",
        "Voucher redemption at checkout",
        "Partial redemption with remaining balance (added in v2)",
      ],
      excluded: ["Physical voucher printing"],
      acceptance: [
        "A voucher can be bought and redeemed end to end",
        "A partially redeemed voucher shows the correct remaining balance",
      ],
    },
    pricing: [
      {
        label: "Grow — gift vouchers (v2 scope)",
        amount: gbp(210000),
        cadence: "one-off",
        basis:
          "Fixed scope per this Change Order; change from v1: +£300 for partial redemption",
        taxBasis: "ex VAT",
        quoteAmount: gbp(210000),
      },
    ],
    riskFlags: [],
    review: {
      author: "louis",
      reviewedBy: "second-staff",
      reviewedAt: "2026-09-09 08:40",
    },
    internalNotes: ["What changed vs v1: partial redemption added; price +£300."],
    clientSummary: [
      "Gift voucher scope v2 (adds partial redemption)",
      "Price £2,100 ex VAT",
      "Replaces Change Order v1",
    ],
    audit: [
      {
        at: "2026-09-09 08:40",
        actor: "second-staff",
        event: "Second-person review recorded",
        kind: "internal",
      },
      {
        at: "2026-09-09 09:00",
        actor: "louis",
        event: "Issued — snapshot frozen",
        kind: "issue",
      },
      {
        at: "2026-09-09 09:01",
        actor: "system",
        event: "Sent to sam@morrow.example",
        kind: "evidence",
      },
      {
        at: "2026-09-14 13:12",
        actor: "client",
        event: "Viewed in portal",
        kind: "evidence",
        note: "Viewed is evidence, not acceptance — status stays Awaiting client.",
      },
    ],
  },
  {
    id: "morrow-mf-v1",
    clientId: "morrow",
    client: clientName("morrow"),
    project: "All projects",
    type: "Master framework",
    version: "v1",
    status: "Accepted",
    templateVersion: "MF-2026.05",
    reviewRequirement: "second-person",
    facts: {
      legalEntity: "Morrow Venues Ltd (fixture)",
      signatory: "Sam Whitlock, Owner",
      serviceRoute: "not applicable",
    },
    scope: {
      included: ["Governing terms for all Order Forms, schedules and Change Orders"],
      excluded: [],
      acceptance: [],
    },
    pricing: [],
    riskFlags: [],
    review: {
      author: "louis",
      reviewedBy: "second-staff",
      reviewedAt: "2026-05-20 10:00",
    },
    internalNotes: [],
    clientSummary: ["Master framework terms"],
    audit: [
      {
        at: "2026-05-21 10:00",
        actor: "louis",
        event: "Issued — snapshot frozen",
        kind: "issue",
      },
      {
        at: "2026-05-23 09:30",
        actor: "Sam Whitlock (signatory)",
        event: "Accepted — portal acceptance",
        kind: "acceptance",
      },
    ],
  },
  {
    id: "cedar-ss-v1",
    clientId: "cedar",
    client: clientName("cedar"),
    project: "Job sheet and quoting system",
    type: "Managed service schedule",
    version: "v1",
    status: "Rejected",
    templateVersion: "MSS-2026.09",
    reviewRequirement: "standard",
    facts: {
      legalEntity: "Cedar Works Ltd (fixture)",
      signatory: "Tom Reyes, Director",
      serviceRoute: "managed",
      billingStart: {
        arrangement: "Contractual start 22 Sep 2026 per Order Form v1",
        exactDate: "2026-09-22",
        approvedWording: true,
      },
      governing: "cedar-of-v1",
    },
    scope: {
      included: ["Hosting, monitoring, backups and security updates"],
      excluded: ["New features — quoted separately"],
      acceptance: [],
    },
    pricing: [
      {
        label: "Managed service — Pro (fixture)",
        amount: gbp(24500),
        cadence: "monthly",
        basis: "Proposed; client declined the Pro tier",
        taxBasis: "ex VAT",
      },
    ],
    riskFlags: [],
    review: {
      author: "louis",
      reviewedBy: "second-staff",
      reviewedAt: "2026-09-04 12:00",
    },
    internalNotes: [
      "Client wants Core. v2 not drafted yet; finance exception open for the 22 Sep date.",
    ],
    clientSummary: [
      "Package: Pro (fixture)",
      "Price £245 per month",
      "Start 22 September 2026",
    ],
    audit: [
      {
        at: "2026-09-04 14:00",
        actor: "louis",
        event: "Issued — snapshot frozen",
        kind: "issue",
      },
      { at: "2026-09-04 14:01", actor: "system", event: "Sent", kind: "evidence" },
      {
        at: "2026-09-08 10:15",
        actor: "Tom Reyes (signatory)",
        event: "Rejected — reason: prefers Core tier",
        kind: "acceptance",
      },
    ],
  },
  {
    id: "fieldstone-ds-v1",
    clientId: "fieldstone",
    client: clientName("fieldstone"),
    project: "Field service dispatch",
    type: "Data/Payment/AI schedule",
    version: "v1",
    status: "Ready to issue",
    templateVersion: "DS-2026.09",
    reviewRequirement: "second-person",
    expiresOn: "2026-10-31",
    facts: {
      legalEntity: "Fieldstone Services Ltd (fixture)",
      signatory: "Ruth Adeyemi, Operations Director",
      serviceRoute: "not applicable",
      governing: "fieldstone-of-v1",
    },
    scope: {
      included: ["AI-assisted job summaries — processing terms and human review"],
      excluded: ["Automated decisions without human review"],
      acceptance: [],
    },
    pricing: [],
    riskFlags: [
      {
        label: "AI feature processes engineer notes",
        severity: "medium",
        resolved: true,
        requiresReview: true,
        note: "Reviewed 15 Sep by second-staff: no special categories; human review required before output is shown to customers.",
      },
    ],
    review: {
      author: "louis",
      reviewedBy: "second-staff",
      reviewedAt: "2026-09-15 15:00",
    },
    internalNotes: [],
    clientSummary: ["AI processing schedule for job summaries"],
    audit: [
      {
        at: "2026-09-14 10:00",
        actor: "louis",
        event: "Draft created",
        kind: "internal",
      },
      {
        at: "2026-09-15 15:00",
        actor: "second-staff",
        event: "Second-person review recorded; risk flag resolved",
        kind: "internal",
      },
    ],
  },
  {
    id: "westbridge-co-v1",
    clientId: "westbridge",
    client: clientName("westbridge"),
    project: "Event ticketing and check-in",
    type: "Change Order",
    version: "v1",
    status: "Withdrawn",
    templateVersion: "CO-2026.06",
    reviewRequirement: "standard",
    facts: {
      legalEntity: "Westbridge Events Ltd (fixture)",
      signatory: "Owen Hart, Director",
      serviceRoute: "not applicable",
      governing: "westbridge-of-v1",
      quoteRef: { id: "q-westbridge-grow-v1", version: "v1", stale: false },
    },
    scope: {
      included: ["Seat-map check-in view"],
      excluded: [],
      acceptance: ["Check-in staff can locate a seat from a scanned ticket"],
    },
    pricing: [
      {
        label: "Grow — seat-map check-in",
        amount: gbp(90000),
        cadence: "one-off",
        basis: "Withdrawn: folded into milestone 3 scope at no extra charge",
        taxBasis: "ex VAT",
        quoteAmount: gbp(90000),
      },
    ],
    riskFlags: [],
    review: {
      author: "louis",
      reviewedBy: "second-staff",
      reviewedAt: "2026-08-20 09:00",
    },
    internalNotes: [
      "Withdrawn 25 Aug before the client responded; no acceptance ever recorded.",
    ],
    clientSummary: ["Seat-map check-in scope", "Price £900 ex VAT"],
    audit: [
      {
        at: "2026-08-20 10:00",
        actor: "louis",
        event: "Issued — snapshot frozen",
        kind: "issue",
      },
      { at: "2026-08-20 10:01", actor: "system", event: "Sent", kind: "evidence" },
      {
        at: "2026-08-25 09:00",
        actor: "louis",
        event: "Withdrawn — reason: scope folded into milestone 3",
        kind: "system",
      },
    ],
  },
  {
    id: "legacy-terms-2026-02",
    clientId: "legacy",
    client: clientName("legacy"),
    project: "Booking site",
    type: "Master framework",
    version: "signed Feb 2026",
    status: "Accepted",
    templateVersion: "Historical terms (pre-redesign)",
    reviewRequirement: "none",
    legacy: true,
    facts: {
      legalEntity: "Legacy Example Ltd (fixture)",
      signatory: "Historic Contact, Owner",
      serviceRoute: "managed",
      billingStart: {
        arrangement: "Historical hosting plan from 1 Mar 2026 as signed",
        exactDate: "2026-03-01",
        approvedWording: true,
      },
    },
    scope: {
      included: ["Booking site build (historical scope)", "Hosting plan (historical id)"],
      excluded: [],
      acceptance: [],
    },
    pricing: [
      {
        label: "Build (historical)",
        amount: gbp(300000),
        cadence: "one-off",
        basis: "As signed",
        taxBasis: "as signed (historical)",
      },
      {
        label: "Hosting plan (historical id)",
        amount: gbp(8000),
        cadence: "monthly",
        basis: "As signed — not repriced by catalogue changes",
        taxBasis: "as signed (historical)",
      },
    ],
    riskFlags: [],
    review: { author: null, reviewedBy: null, reviewedAt: null },
    internalNotes: [
      "Protected legacy agreement. Never regenerated from today's catalogue; never edited in place.",
    ],
    clientSummary: ["Signed terms as of February 2026"],
    audit: [
      {
        at: "2026-02-14 10:00",
        actor: "Historic Contact (signatory)",
        event: "Signed terms received (historical record)",
        kind: "acceptance",
      },
    ],
  },
];

export const agreementById = (id: string): AgreementDocument | undefined =>
  AGREEMENTS.find((d) => d.id === id);

/* ── Issue blockers (brief §5.7 last paragraph, §8.1) ──────────────────── */

export const BLOCKER_CODES = [
  "missing-service-route",
  "missing-billing-start",
  "missing-legal-entity-signatory",
  "conflicting-prices",
  "stale-quote-reference",
  "unresolved-risk-review",
] as const;
export type BlockerCode = (typeof BLOCKER_CODES)[number];

export type IssueBlocker = { code: BlockerCode; label: string; detail: string };

/**
 * Pure derivation of the issue blockers for one document. Applies to every
 * status so accepted documents can show open items, but only pre-issue
 * statuses treat the result as a gate (see canIssue).
 */
export function issueBlockers(doc: AgreementDocument): IssueBlocker[] {
  const out: IssueBlocker[] = [];
  const f = doc.facts;

  if (doc.type === "Project Order Form / SOW" && f.serviceRoute === "unresolved") {
    out.push({
      code: "missing-service-route",
      label: "Missing service-route selection",
      detail: "An Order Form must record Managed or Independent before issue.",
    });
  }

  const needsBillingStart =
    (doc.type === "Project Order Form / SOW" && f.serviceRoute === "managed") ||
    doc.type === "Managed service schedule";
  if (needsBillingStart) {
    if (!f.billingStart) {
      out.push({
        code: "missing-billing-start",
        label: "Missing billing-start arrangement",
        detail:
          "Managed route needs a contractual billing-start arrangement; an unknown date must use approved conditional wording, never an invented date.",
      });
    } else if (doc.type === "Managed service schedule" && !f.billingStart.exactDate) {
      out.push({
        code: "missing-billing-start",
        label: "Missing exact start date",
        detail:
          "A service schedule needs an exact accepted start date before activation.",
      });
    } else if (!f.billingStart.approvedWording) {
      out.push({
        code: "missing-billing-start",
        label: "Billing-start wording not approved",
        detail: "The conditional billing-start clause has not been approved.",
      });
    }
  }

  if (!f.legalEntity || !f.signatory) {
    out.push({
      code: "missing-legal-entity-signatory",
      label: "Missing legal entity or signatory",
      detail: "Record the contracting legal entity and an authorised signatory.",
    });
  }

  const conflicting = doc.pricing.filter(
    (p) =>
      p.quoteAmount &&
      (p.quoteAmount.minor !== p.amount.minor ||
        p.quoteAmount.currency !== p.amount.currency)
  );
  if (conflicting.length) {
    out.push({
      code: "conflicting-prices",
      label: "Conflicting prices",
      detail: conflicting
        .map(
          (p) =>
            `${p.label}: document ${money(p.amount)} vs quote ${money(p.quoteAmount!)}`
        )
        .join("; "),
    });
  }

  if (f.quoteRef?.stale) {
    out.push({
      code: "stale-quote-reference",
      label: "Stale quote reference",
      detail: `References ${f.quoteRef.id} ${f.quoteRef.version}, which has been superseded by a newer quote version.`,
    });
  }

  const unresolved = doc.riskFlags.filter((r) => r.requiresReview && !r.resolved);
  if (unresolved.length) {
    out.push({
      code: "unresolved-risk-review",
      label: "Unresolved risk review",
      detail: unresolved.map((r) => r.label).join("; "),
    });
  }

  return out;
}

export type IssueDecision = { ok: boolean; reasons: string[] };

/**
 * May this document be issued? Requires a pre-issue status, no blockers and
 * a second-person review when the document type demands one. Legacy records
 * are never issuable (they are read-only history).
 */
export function canIssue(
  doc: AgreementDocument,
  review: { canSend: boolean; reason: string }
): IssueDecision {
  const reasons: string[] = [];
  if (doc.legacy) reasons.push("Protected legacy record — read-only.");
  if (!PRE_ISSUE_STATUSES.includes(doc.status))
    reasons.push(`Status is ${doc.status}; only pre-issue documents can be issued.`);
  for (const b of issueBlockers(doc)) reasons.push(b.label);
  if (doc.reviewRequirement !== "none" && !review.canSend) reasons.push(review.reason);
  return { ok: reasons.length === 0, reasons };
}

/* ── Library filters ────────────────────────────────────────────────────── */

export type ExpiryFilter = "expiring" | "expired" | "none";
export type ReviewFilter = ReviewRequirement;

export type AgreementFilters = {
  client?: string;
  type?: string; // DOCUMENT_TYPE_KEY value
  version?: string;
  status?: string; // STATUS_KEY value
  expiry?: ExpiryFilter;
  review?: ReviewFilter;
};

const DAY_MS = 86_400_000;

/** Days from `today` (ISO yyyy-mm-dd) to `date`; negative when past. */
export function daysUntil(date: string, today: string): number {
  return Math.round((Date.parse(date) - Date.parse(today)) / DAY_MS);
}

export function expiryState(
  doc: AgreementDocument,
  today: string
): { state: ExpiryFilter; days?: number } {
  if (!doc.expiresOn) return { state: "none" };
  const days = daysUntil(doc.expiresOn, today);
  return { state: days < 0 ? "expired" : "expiring", days };
}

export function filterAgreements(
  docs: AgreementDocument[],
  f: AgreementFilters,
  today: string
): AgreementDocument[] {
  return docs.filter((d) => {
    if (f.client && d.clientId !== f.client) return false;
    if (f.type && DOCUMENT_TYPE_KEY[d.type] !== f.type) return false;
    if (f.version && d.version !== f.version) return false;
    if (f.status && STATUS_KEY[d.status] !== f.status) return false;
    if (f.review && d.reviewRequirement !== f.review) return false;
    if (f.expiry) {
      const e = expiryState(d, today);
      if (f.expiry === "expiring") {
        if (e.state !== "expiring" || (e.days ?? 0) > 30) return false;
      } else if (e.state !== f.expiry) return false;
    }
    return true;
  });
}

/** Parse untrusted search params into a filter object; unknown values are dropped. */
export function parseFilters(
  sp: Record<string, string | string[] | undefined>
): AgreementFilters {
  const one = (v: string | string[] | undefined): string | undefined =>
    typeof v === "string" && v.length > 0 && v.length <= 64 ? v : undefined;
  const f: AgreementFilters = {};
  const client = one(sp.client);
  if (client && CLIENTS.some((c) => c.id === client)) f.client = client;
  const type = one(sp.type);
  if (type && Object.values(DOCUMENT_TYPE_KEY).includes(type)) f.type = type;
  const version = one(sp.version);
  if (version && AGREEMENTS.some((d) => d.version === version)) f.version = version;
  const status = one(sp.status);
  if (status && Object.values(STATUS_KEY).includes(status)) f.status = status;
  const expiry = one(sp.expiry);
  if (expiry === "expiring" || expiry === "expired" || expiry === "none")
    f.expiry = expiry;
  const review = one(sp.review);
  if (review && (REVIEW_REQUIREMENTS as readonly string[]).includes(review))
    f.review = review as ReviewFilter;
  return f;
}

/** Sort: pre-issue and awaiting first, then accepted, then terminal states; newest version first within a client. */
const STATUS_RANK: Record<AgreementStatus, number> = {
  "Needs internal review": 0,
  Draft: 1,
  "Ready to issue": 2,
  "Awaiting client": 3,
  Accepted: 4,
  Rejected: 5,
  Superseded: 6,
  Withdrawn: 7,
};

export function sortAgreements(docs: AgreementDocument[]): AgreementDocument[] {
  return [...docs].sort(
    (a, b) =>
      STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
      a.client.localeCompare(b.client) ||
      b.version.localeCompare(a.version)
  );
}

/** Fixed "today" for deterministic prototype rendering (brief §16: fixtures only). */
export const FIXTURE_TODAY = "2026-09-17";
