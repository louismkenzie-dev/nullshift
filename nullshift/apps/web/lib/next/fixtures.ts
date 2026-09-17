/**
 * FICTIONAL DEMO DATA for the admin redesign prototype (brief §16).
 *
 * Nothing here is a real client, a real price or an approved price list. Every
 * screen under /admin/next renders from this module only — no database reads,
 * no provider calls, no writes. Amounts are chosen to be obviously fixtures.
 */

export type Relationship = "prospect" | "active" | "paused" | "offboarded";
export type Agreement = "draft" | "awaiting acceptance" | "accepted" | "superseded";
export type Billing =
  | "setup pending"
  | "current"
  | "overdue"
  | "exception"
  | "not applicable";
export type Delivery =
  | "discovery"
  | "building"
  | "awaiting client"
  | "review"
  | "accepted"
  | "live";
export type Route = "managed" | "independent" | "unresolved";
export type Health = "healthy" | "attention" | "incident" | "unknown";

export type Facets = {
  relationship: Relationship;
  agreement: { state: Agreement; evidence: string };
  billing: { state: Billing; evidence: string };
  delivery: { state: Delivery; evidence: string };
  route: { state: Route; evidence: string };
  health: { state: Health; evidence: string; freshness: string };
};

export type TaskState =
  | "not started"
  | "in progress"
  | "awaiting client"
  | "blocked"
  | "complete"
  | "not applicable"
  | "waived";

export type Task = {
  label: string;
  owner: "Nullshift" | "Client";
  state: TaskState;
  source: string;
  evidence?: string;
  due?: string;
};

export type MilestoneState =
  | "paid"
  | "part paid"
  | "issued"
  | "overdue"
  | "scheduled"
  | "waived";

export type RunState =
  | "package pending"
  | "accepted, future start"
  | "active"
  | "collection failed"
  | "exception"
  | "not applicable"
  | "legacy";

export type Client = {
  id: string;
  legalName: string;
  tradingName?: string;
  ref: string;
  owner: string;
  model: "new" | "legacy";
  facets: Facets;
  nextAction: { text: string; owner: string; due: string; consequence: string };
  build: {
    priceGbp: number;
    milestones: {
      label: string;
      amountGbp: number;
      paidGbp: number;
      state: MilestoneState;
      due: string;
    }[];
  };
  run: {
    state: RunState;
    packageName?: string;
    monthlyGbp?: number;
    contractualStart?: string;
    mandate?: "authorised" | "none" | "cancelled";
    providerCollectionDate?: string;
    note?: string;
  };
  handover?: { feeGbp: number; tasks: Task[] };
  systems: { name: string; arrangement: string }[];
  checklist: Task[];
  contacts: { name: string; role: string; email: string }[];
  history: { at: string; text: string }[];
  flags?: string[];
};

export const gbp = (n: number): string =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(n);

const fresh = "Fixture · updated 2 minutes ago";

export const CLIENTS: Client[] = [
  {
    id: "northline",
    legalName: "Northline Studios Ltd",
    tradingName: "Northline",
    ref: "NS-1041",
    owner: "Louis",
    model: "new",
    facets: {
      relationship: "active",
      agreement: {
        state: "accepted",
        evidence: "Order Form v1 accepted 2 Sep 2026 by J. Okafor (signatory)",
      },
      billing: {
        state: "setup pending",
        evidence: "Deposit paid; package not yet chosen — nothing to collect",
      },
      delivery: { state: "building", evidence: "Milestone 2 of 3 in progress" },
      route: {
        state: "managed",
        evidence:
          "Managed route elected on Order Form v1 · package to be agreed after build acceptance",
      },
      health: { state: "unknown", evidence: "Not live yet", freshness: fresh },
    },
    nextAction: {
      text: "Confirm acceptance-criteria evidence before the 24 Sep build review",
      owner: "Louis",
      due: "24 Sep 2026",
      consequence: "Acceptance cannot be recorded without evidence per deliverable",
    },
    build: {
      priceGbp: 14800,
      milestones: [
        {
          label: "Deposit (example 50%)",
          amountGbp: 7400,
          paidGbp: 7400,
          state: "paid",
          due: "3 Sep 2026",
        },
        {
          label: "Build complete (example 25%)",
          amountGbp: 3700,
          paidGbp: 0,
          state: "scheduled",
          due: "On build review",
        },
        {
          label: "Acceptance (example 25%)",
          amountGbp: 3700,
          paidGbp: 0,
          state: "scheduled",
          due: "On acceptance",
        },
      ],
    },
    run: {
      state: "package pending",
      note: "Managed route selected; package, price and start date to be agreed and accepted as a separate service schedule after build acceptance.",
    },
    systems: [
      { name: "Studio bookings platform", arrangement: "Managed · package pending" },
    ],
    checklist: [
      {
        label: "Company and billing details",
        owner: "Client",
        state: "complete",
        source: "Onboarding gate",
        evidence: "Submitted 1 Sep",
      },
      {
        label: "Agreement accepted",
        owner: "Client",
        state: "complete",
        source: "Order Form v1",
        evidence: "Accepted 2 Sep",
      },
      {
        label: "Initial payment",
        owner: "Client",
        state: "complete",
        source: "Milestone 1",
        evidence: "Paid 3 Sep (Xero INV-FX-0101)",
      },
      {
        label: "Assets and access",
        owner: "Client",
        state: "complete",
        source: "Files & access",
        evidence: "Granted 5 Sep",
      },
      {
        label: "Build review",
        owner: "Nullshift",
        state: "in progress",
        source: "Delivery",
        due: "24 Sep 2026",
      },
      {
        label: "Client acceptance",
        owner: "Client",
        state: "not started",
        source: "Acceptance gate",
      },
      {
        label: "Managed package selection and service schedule",
        owner: "Client",
        state: "not started",
        source: "Later checklist",
      },
    ],
    contacts: [
      { name: "Jide Okafor", role: "Signatory", email: "jide@northline.example" },
      { name: "Mara Ellis", role: "Project contact", email: "mara@northline.example" },
    ],
    history: [
      { at: "5 Sep", text: "Assets and access granted" },
      { at: "3 Sep", text: "Deposit allocated in Xero (fixture)" },
      { at: "2 Sep", text: "Order Form v1 accepted — Managed route, package pending" },
    ],
  },
  {
    id: "harbour",
    legalName: "Harbour Activity Group Ltd",
    ref: "NS-1037",
    owner: "Louis",
    model: "new",
    facets: {
      relationship: "active",
      agreement: {
        state: "accepted",
        evidence: "Order Form v1 + Managed service schedule v1 accepted 12 Sep",
      },
      billing: {
        state: "setup pending",
        evidence: "Mandate authorised 12 Sep · first collection not yet scheduled",
      },
      delivery: {
        state: "accepted",
        evidence: "Build accepted 10 Sep with evidence per deliverable",
      },
      route: { state: "managed", evidence: "Pro package accepted (fixture price)" },
      health: {
        state: "healthy",
        evidence: "Uptime and backup checks passed 09:00",
        freshness: fresh,
      },
    },
    nextAction: {
      text: "Internal finance approval, then schedule the first collection for the agreed start",
      owner: "Finance (Louis)",
      due: "26 Sep 2026",
      consequence: "Direct Debit notice period must be respected before 1 Oct",
    },
    build: {
      priceGbp: 9600,
      milestones: [
        {
          label: "Deposit",
          amountGbp: 4800,
          paidGbp: 4800,
          state: "paid",
          due: "12 Aug 2026",
        },
        {
          label: "Build complete",
          amountGbp: 2400,
          paidGbp: 2400,
          state: "paid",
          due: "4 Sep 2026",
        },
        {
          label: "Acceptance",
          amountGbp: 2400,
          paidGbp: 2400,
          state: "paid",
          due: "11 Sep 2026",
        },
      ],
    },
    run: {
      state: "accepted, future start",
      packageName: "Pro (fixture)",
      monthlyGbp: 245,
      contractualStart: "1 Oct 2026",
      mandate: "authorised",
      providerCollectionDate: "Authorised — not scheduled",
    },
    systems: [
      {
        name: "Activity booking and waivers",
        arrangement: "Managed · Pro · billing from 1 Oct 2026",
      },
    ],
    checklist: [
      {
        label: "Build review and acceptance",
        owner: "Client",
        state: "complete",
        source: "Acceptance gate",
        evidence: "Accepted 10 Sep",
      },
      {
        label: "Managed package selection",
        owner: "Client",
        state: "complete",
        source: "Service schedule v1",
        evidence: "Accepted 12 Sep",
      },
      {
        label: "Direct Debit mandate",
        owner: "Client",
        state: "complete",
        source: "Provider-hosted flow",
        evidence: "Mandate authorised 12 Sep",
      },
      {
        label: "Internal activation approval",
        owner: "Nullshift",
        state: "in progress",
        source: "Activation gates",
        due: "26 Sep 2026",
      },
      {
        label: "Schedule first collection",
        owner: "Nullshift",
        state: "blocked",
        source: "Activation gates",
        evidence: "Waiting on approval",
      },
    ],
    contacts: [
      {
        name: "Priya Nair",
        role: "Signatory + billing admin",
        email: "priya@harbour.example",
      },
    ],
    history: [
      { at: "12 Sep", text: "Mandate authorised (provider event, fixture)" },
      {
        at: "12 Sep",
        text: "Service schedule v1 accepted — Pro, £245/month, start 1 Oct",
      },
      { at: "10 Sep", text: "Build accepted" },
    ],
  },
  {
    id: "cedar",
    legalName: "Cedar Works Ltd",
    ref: "NS-1029",
    owner: "Louis",
    model: "new",
    facets: {
      relationship: "active",
      agreement: {
        state: "accepted",
        evidence: "Order Form v1 accepted 4 Aug · service schedule NOT accepted",
      },
      billing: {
        state: "exception",
        evidence: "Contractual start 22 Sep with no accepted package",
      },
      delivery: {
        state: "live",
        evidence: "Live since 8 Sep under approved interim arrangement",
      },
      route: { state: "managed", evidence: "Managed route elected · package unresolved" },
      health: { state: "healthy", evidence: "Checks passed 09:00", freshness: fresh },
    },
    nextAction: {
      text: "Managed package not accepted · billing date in 5 days — review arrangement",
      owner: "Finance (Louis)",
      due: "22 Sep 2026",
      consequence:
        "No default plan, no indicative charge, no backdating; needs an accepted amendment or approved interim arrangement",
    },
    build: {
      priceGbp: 7200,
      milestones: [
        {
          label: "Deposit",
          amountGbp: 3600,
          paidGbp: 3600,
          state: "paid",
          due: "6 Aug 2026",
        },
        {
          label: "Acceptance",
          amountGbp: 3600,
          paidGbp: 3600,
          state: "paid",
          due: "8 Sep 2026",
        },
      ],
    },
    run: {
      state: "exception",
      contractualStart: "22 Sep 2026",
      mandate: "none",
      note: "Owned exception raised 15 Sep. Options: accepted amendment, approved interim arrangement, or explicit instruction. Original date preserved.",
    },
    systems: [
      {
        name: "Job sheet and quoting system",
        arrangement: "Managed · package unresolved · interim arrangement",
      },
    ],
    checklist: [
      {
        label: "Managed package selection",
        owner: "Client",
        state: "awaiting client",
        source: "Later checklist",
        due: "22 Sep 2026",
      },
      {
        label: "Service schedule acceptance",
        owner: "Client",
        state: "blocked",
        source: "Consent rule",
        evidence: "Depends on package",
      },
      {
        label: "Direct Debit mandate",
        owner: "Client",
        state: "not started",
        source: "Provider-hosted flow",
      },
      {
        label: "Gap responsibility recorded",
        owner: "Nullshift",
        state: "complete",
        source: "Interim arrangement",
        evidence: "Approved 8 Sep",
      },
    ],
    contacts: [{ name: "Tom Reyes", role: "Signatory", email: "tom@cedarworks.example" }],
    history: [
      {
        at: "15 Sep",
        text: "Finance exception opened — package not accepted, date approaching",
      },
      { at: "8 Sep", text: "Went live under approved interim arrangement" },
    ],
    flags: ["Exception: contractual start without accepted package"],
  },
  {
    id: "orbit",
    legalName: "Orbit Training Ltd",
    ref: "NS-1022",
    owner: "Louis",
    model: "new",
    facets: {
      relationship: "active",
      agreement: {
        state: "accepted",
        evidence: "Order Form v1 + Independent handover schedule accepted 20 Aug",
      },
      billing: {
        state: "current",
        evidence:
          "£600 handover fee invoiced once (tax basis: pending decision) and paid",
      },
      delivery: { state: "accepted", evidence: "Build accepted 28 Aug" },
      route: {
        state: "independent",
        evidence: "Independent handover · no ongoing Nullshift management",
      },
      health: {
        state: "unknown",
        evidence: "Operated by client after transfer",
        freshness: fresh,
      },
    },
    nextAction: {
      text: "Build accepted · independent handover incomplete — open transfer checklist",
      owner: "Louis",
      due: "19 Sep 2026",
      consequence: "Access cannot be revoked until transfer gates are met",
    },
    build: {
      priceGbp: 11200,
      milestones: [
        {
          label: "Deposit",
          amountGbp: 5600,
          paidGbp: 5600,
          state: "paid",
          due: "22 Jul 2026",
        },
        {
          label: "Acceptance",
          amountGbp: 5600,
          paidGbp: 5600,
          state: "paid",
          due: "29 Aug 2026",
        },
      ],
    },
    run: {
      state: "not applicable",
      note: "No recurring subscription. Third-party services are paid by the client directly.",
    },
    handover: {
      feeGbp: 600,
      tasks: [
        {
          label: "Receiving owner and transfer plan confirmed",
          owner: "Client",
          state: "complete",
          source: "Handover schedule",
          evidence: "Confirmed 1 Sep",
        },
        {
          label: "Client-owned hosting, database and domain accounts",
          owner: "Client",
          state: "complete",
          source: "Handover schedule",
          evidence: "Verified 9 Sep",
        },
        {
          label: "Repository and deployment ownership transferred",
          owner: "Nullshift",
          state: "in progress",
          source: "Handover schedule",
        },
        {
          label: "Data transfer verified with restoration test",
          owner: "Nullshift",
          state: "not started",
          source: "Handover schedule",
        },
        {
          label: "DNS, email and webhook continuity checks",
          owner: "Nullshift",
          state: "not started",
          source: "Handover schedule",
        },
        {
          label: "Application-fee disposition resolved",
          owner: "Nullshift",
          state: "blocked",
          source: "Decision register",
          evidence: "Awaiting owner decision",
        },
        {
          label: "Walkthrough delivered and acknowledged",
          owner: "Client",
          state: "not started",
          source: "Handover schedule",
          due: "19 Sep 2026",
        },
        {
          label: "Nullshift access revoked",
          owner: "Nullshift",
          state: "not started",
          source: "Handover schedule",
        },
      ],
    },
    systems: [
      {
        name: "Course booking and certificates",
        arrangement: "Independent handover in progress",
      },
    ],
    checklist: [],
    contacts: [
      { name: "Ana Petrova", role: "Signatory", email: "ana@orbittraining.example" },
    ],
    history: [
      { at: "9 Sep", text: "Client accounts verified" },
      { at: "28 Aug", text: "Build accepted" },
    ],
  },
  {
    id: "morrow",
    legalName: "Morrow Venues Ltd",
    ref: "NS-1015",
    owner: "Louis",
    model: "new",
    facets: {
      relationship: "active",
      agreement: {
        state: "accepted",
        evidence: "Two service arrangements under one framework",
      },
      billing: {
        state: "current",
        evidence: "Bookings platform collected 1 Sep · rota system has no charges",
      },
      delivery: { state: "live", evidence: "Both systems live" },
      route: {
        state: "managed",
        evidence: "Bookings: Managed Core · Staff rota: Independent (handover complete)",
      },
      health: { state: "healthy", evidence: "Checks passed 09:00", freshness: fresh },
    },
    nextAction: {
      text: "Quarterly usage review due",
      owner: "Louis",
      due: "30 Sep 2026",
      consequence: "Routine",
    },
    build: {
      priceGbp: 16400,
      milestones: [
        {
          label: "Bookings platform",
          amountGbp: 9800,
          paidGbp: 9800,
          state: "paid",
          due: "2026",
        },
        {
          label: "Staff rota system",
          amountGbp: 6600,
          paidGbp: 6600,
          state: "paid",
          due: "2026",
        },
      ],
    },
    run: {
      state: "active",
      packageName: "Core (fixture)",
      monthlyGbp: 165,
      contractualStart: "1 Jun 2026",
      mandate: "authorised",
      providerCollectionDate: "1 Oct 2026 (provider-confirmed)",
    },
    systems: [
      { name: "Bookings platform", arrangement: "Managed · Core · billed monthly" },
      { name: "Staff rota", arrangement: "Independent · handover complete 14 Jul" },
    ],
    checklist: [],
    contacts: [
      { name: "Sam Whitlock", role: "Signatory", email: "sam@morrow.example" },
      { name: "Dee Lawson", role: "Billing admin", email: "accounts@morrow.example" },
    ],
    history: [{ at: "1 Sep", text: "Collection £165 confirmed and allocated" }],
  },
  {
    id: "fieldstone",
    legalName: "Fieldstone Services Ltd",
    ref: "NS-1011",
    owner: "Louis",
    model: "new",
    facets: {
      relationship: "active",
      agreement: { state: "accepted", evidence: "Service schedule v1 accepted 3 Jun" },
      billing: {
        state: "overdue",
        evidence:
          "1 Sep collection failed (insufficient funds) · retry proposal awaiting approval",
      },
      delivery: { state: "live", evidence: "Live since May" },
      route: { state: "managed", evidence: "Pro (fixture)" },
      health: {
        state: "attention",
        evidence: "Email bounce rate above threshold since 14 Sep",
        freshness: fresh,
      },
    },
    nextAction: {
      text: "Collection failed · approve retry proposal or contact client",
      owner: "Finance (Louis)",
      due: "18 Sep 2026",
      consequence: "Obligation remains open; no automatic service change",
    },
    build: {
      priceGbp: 8000,
      milestones: [
        {
          label: "Build (single milestone)",
          amountGbp: 8000,
          paidGbp: 8000,
          state: "paid",
          due: "May 2026",
        },
      ],
    },
    run: {
      state: "collection failed",
      packageName: "Pro (fixture)",
      monthlyGbp: 245,
      contractualStart: "1 Jun 2026",
      mandate: "authorised",
      providerCollectionDate: "Retry not scheduled",
      note: "A delayed older provider event (August payout) arrived after the failure; state derived from current obligations, not event order.",
    },
    systems: [{ name: "Field service dispatch", arrangement: "Managed · Pro" }],
    checklist: [],
    contacts: [
      { name: "Ruth Adeyemi", role: "Billing admin", email: "ruth@fieldstone.example" },
    ],
    history: [
      {
        at: "16 Sep",
        text: "Late provider event for August payout processed — no state change",
      },
      { at: "1 Sep", text: "Collection £245 failed — exception opened" },
    ],
    flags: ["Failed collection · retry needs approval", "Health: email bounces"],
  },
  {
    id: "brightwell",
    legalName: "Brightwell Demo Ltd",
    ref: "NS-1048",
    owner: "Louis",
    model: "new",
    facets: {
      relationship: "prospect",
      agreement: {
        state: "draft",
        evidence:
          "Order Form v1 draft · sensitive-data flag requires second-person legal review",
      },
      billing: { state: "not applicable", evidence: "Nothing accepted" },
      delivery: { state: "discovery", evidence: "Paid discovery in progress" },
      route: {
        state: "unresolved",
        evidence: "Route election pending on the Order Form",
      },
      health: { state: "unknown", evidence: "No system yet", freshness: fresh },
    },
    nextAction: {
      text: "Second-person legal review of data schedule before issue",
      owner: "Louis (reviewer: second staff member)",
      due: "18 Sep 2026",
      consequence: "Order Form cannot be issued unreviewed",
    },
    build: { priceGbp: 0, milestones: [] },
    run: { state: "not applicable" },
    systems: [],
    checklist: [
      {
        label: "Discovery workshop",
        owner: "Nullshift",
        state: "complete",
        source: "Discovery",
        evidence: "12 Sep",
      },
      {
        label: "Data classification recorded",
        owner: "Nullshift",
        state: "complete",
        source: "Risk review",
        evidence: "Sensitive categories flagged",
      },
      {
        label: "Legal review (second person)",
        owner: "Nullshift",
        state: "in progress",
        source: "Issue gate",
        due: "18 Sep 2026",
      },
    ],
    contacts: [{ name: "Leo Marsh", role: "Signatory", email: "leo@brightwell.example" }],
    history: [{ at: "12 Sep", text: "Discovery workshop held" }],
    flags: ["Sensitive data flag — extra contract review"],
  },
  {
    id: "legacy",
    legalName: "Legacy Example Ltd",
    ref: "NS-0007",
    owner: "Louis",
    model: "legacy",
    facets: {
      relationship: "active",
      agreement: {
        state: "accepted",
        evidence: "Signed terms Feb 2026 (historical plan, read-only)",
      },
      billing: { state: "current", evidence: "Collected 1 Sep" },
      delivery: { state: "live", evidence: "Live since Feb 2026" },
      route: {
        state: "managed",
        evidence: "Historical hosting plan — not repriced by catalogue changes",
      },
      health: { state: "healthy", evidence: "Checks passed 09:00", freshness: fresh },
    },
    nextAction: {
      text: "None required",
      owner: "Unassigned",
      due: "—",
      consequence: "—",
    },
    build: {
      priceGbp: 3000,
      milestones: [
        {
          label: "Build (historical)",
          amountGbp: 3000,
          paidGbp: 3000,
          state: "paid",
          due: "Feb 2026",
        },
      ],
    },
    run: {
      state: "legacy",
      packageName: "hosting (historical id)",
      monthlyGbp: 80,
      contractualStart: "1 Mar 2026",
      mandate: "authorised",
      providerCollectionDate: "1 Oct 2026 (provider-confirmed)",
    },
    systems: [{ name: "Booking site", arrangement: "Legacy plan · preserved" }],
    checklist: [],
    contacts: [
      { name: "Historic Contact", role: "Signatory", email: "owner@legacy.example" },
    ],
    history: [{ at: "1 Sep", text: "Collection £80 confirmed" }],
    flags: ["Protected legacy agreement — shown read-only"],
  },
  {
    id: "atlas",
    legalName: "Atlas Operations Ltd",
    ref: "NS-1052",
    owner: "Louis",
    model: "new",
    facets: {
      relationship: "prospect",
      agreement: { state: "draft", evidence: "No quote issued" },
      billing: { state: "not applicable", evidence: "Nothing accepted" },
      delivery: { state: "discovery", evidence: "Scoping" },
      route: { state: "unresolved", evidence: "Not yet elected" },
      health: { state: "unknown", evidence: "No system yet", freshness: fresh },
    },
    nextAction: {
      text: "Estimate exceeds review threshold and migration volume is unknown — propose paid discovery",
      owner: "Sales (Louis)",
      due: "20 Sep 2026",
      consequence: "No price is quoted while confidence is low; no cap is applied",
    },
    build: { priceGbp: 0, milestones: [] },
    run: { state: "not applicable" },
    systems: [],
    checklist: [
      {
        label: "Brief captured",
        owner: "Nullshift",
        state: "complete",
        source: "Opportunity",
        evidence: "11 Sep",
      },
      {
        label: "Migration volume and data quality",
        owner: "Client",
        state: "awaiting client",
        source: "Estimator inputs",
      },
      {
        label: "Paid discovery proposal",
        owner: "Nullshift",
        state: "not started",
        source: "Commercial review",
      },
    ],
    contacts: [
      { name: "Grace Lindqvist", role: "Project contact", email: "grace@atlas.example" },
    ],
    history: [{ at: "11 Sep", text: "Enquiry qualified" }],
    flags: ["Large estimate · low confidence · discovery required"],
  },
  {
    id: "westbridge",
    legalName: "Westbridge Events Ltd",
    ref: "NS-1033",
    owner: "Louis",
    model: "new",
    facets: {
      relationship: "active",
      agreement: { state: "accepted", evidence: "Order Form v1 accepted 15 Jul" },
      billing: {
        state: "exception",
        evidence:
          "Milestone 2 part paid · Xero invoice create failed for milestone 3 · unmatched payout £2,500",
      },
      delivery: { state: "review", evidence: "Milestone 3 in client review" },
      route: { state: "managed", evidence: "Managed route elected · package pending" },
      health: { state: "healthy", evidence: "Staging checks passed", freshness: fresh },
    },
    nextAction: {
      text: "Xero invoice creation failed · retry available — inspect sync",
      owner: "Finance (Louis)",
      due: "17 Sep 2026",
      consequence: "Retry creates the accounting record only; it never collects",
    },
    build: {
      priceGbp: 12000,
      milestones: [
        {
          label: "Milestone 1 — Discovery and design",
          amountGbp: 4000,
          paidGbp: 4000,
          state: "paid",
          due: "20 Jul 2026",
        },
        {
          label: "Milestone 2 — Core build",
          amountGbp: 4000,
          paidGbp: 2500,
          state: "part paid",
          due: "1 Sep 2026",
        },
        {
          label: "Milestone 3 — Integrations and launch",
          amountGbp: 4000,
          paidGbp: 0,
          state: "issued",
          due: "23 Sep 2026",
        },
      ],
    },
    run: {
      state: "package pending",
      note: "Managed route selected; package to be agreed after build acceptance.",
    },
    systems: [
      { name: "Event ticketing and check-in", arrangement: "Managed · package pending" },
    ],
    checklist: [],
    contacts: [
      { name: "Owen Hart", role: "Signatory", email: "owen@westbridge.example" },
    ],
    history: [
      {
        at: "16 Sep",
        text: "Payout £2,500 received — unmatched (suggested match: milestone 2 part payment, needs review)",
      },
      {
        at: "15 Sep",
        text: "Xero create failed for milestone 3 (timeout) — operation kept, retry available",
      },
    ],
    flags: ["Accounting sync outage", "Unmatched payout"],
  },
];

export const clientById = (id: string): Client | undefined =>
  CLIENTS.find((c) => c.id === id);

export type Attention = {
  clientId: string;
  client: string;
  problem: string;
  consequence: string;
  owner: string;
  due: string;
  action: string;
  kind: "incident" | "finance" | "contract" | "overdue" | "deadline" | "routine";
};

/** Priority order per brief §5.1: incidents and financial/contract blockers, then overdue, deadlines, routine. */
export const ATTENTION: Attention[] = [
  {
    clientId: "fieldstone",
    client: "Fieldstone Services",
    problem: "Collection failed · retry needs approval",
    consequence: "Obligation open; no automatic service change",
    owner: "Finance (Louis)",
    due: "18 Sep",
    action: "Review retry proposal",
    kind: "finance",
  },
  {
    clientId: "westbridge",
    client: "Westbridge Events",
    problem: "Xero invoice creation failed · retry available",
    consequence: "Milestone 3 has no accounting record",
    owner: "Finance (Louis)",
    due: "17 Sep",
    action: "Inspect sync",
    kind: "finance",
  },
  {
    clientId: "cedar",
    client: "Cedar Works",
    problem: "Managed package not accepted · billing date in 5 days",
    consequence: "No charge is possible without an accepted schedule",
    owner: "Finance (Louis)",
    due: "22 Sep",
    action: "Review arrangement",
    kind: "contract",
  },
  {
    clientId: "westbridge",
    client: "Westbridge Events",
    problem: "Unmatched payout £2,500",
    consequence: "Bank evidence not reconciled",
    owner: "Finance (Louis)",
    due: "19 Sep",
    action: "Review suggested match",
    kind: "finance",
  },
  {
    clientId: "brightwell",
    client: "Brightwell Demo",
    problem: "Sensitive-data flag · legal review required",
    consequence: "Order Form cannot be issued",
    owner: "Louis",
    due: "18 Sep",
    action: "Open review",
    kind: "contract",
  },
  {
    clientId: "orbit",
    client: "Orbit Training",
    problem: "Build accepted · independent handover incomplete",
    consequence: "Access cannot be revoked yet",
    owner: "Louis",
    due: "19 Sep",
    action: "Open transfer checklist",
    kind: "deadline",
  },
  {
    clientId: "atlas",
    client: "Atlas Operations",
    problem: "Large estimate · migration info missing",
    consequence: "Quote blocked until discovery",
    owner: "Sales (Louis)",
    due: "20 Sep",
    action: "Draft discovery proposal",
    kind: "deadline",
  },
  {
    clientId: "harbour",
    client: "Harbour Activity Group",
    problem: "All activation gates pass except internal approval",
    consequence: "Notice period before 1 Oct start",
    owner: "Finance (Louis)",
    due: "26 Sep",
    action: "Approve activation",
    kind: "routine",
  },
];

export const WEEK = [
  { when: "Wed 17 Sep", what: "Westbridge — milestone 3 sync retry", kind: "finance" },
  {
    when: "Thu 18 Sep",
    what: "Brightwell — second-person legal review",
    kind: "contract",
  },
  { when: "Fri 19 Sep", what: "Orbit — handover walkthrough", kind: "handover" },
  {
    when: "Mon 22 Sep",
    what: "Cedar — contractual billing start (exception open)",
    kind: "contract",
  },
  { when: "Tue 23 Sep", what: "Westbridge — milestone 3 due", kind: "milestone" },
  { when: "Wed 24 Sep", what: "Northline — build review", kind: "milestone" },
];

export const METRICS = {
  contractedMonthlyGbp: 165 + 245 + 80,
  pendingFutureStartsGbp: 245,
  outstandingGbp: 1500 + 245 + 4000,
  overdueGbp: 245 + 1500,
  scheduledNext30Gbp: 165 + 80,
  authorisedNotScheduledGbp: 245,
  projectsNeedingAction: new Set(ATTENTION.map((a) => a.clientId)).size,
};

export type QuoteStep =
  | "Brief"
  | "Scope"
  | "Delivery estimate"
  | "Commercial model"
  | "Review & approval"
  | "Client preview";

export type Quote = {
  id: string;
  clientId: string;
  client: string;
  project: string;
  version: string;
  status: "Draft" | "Internal review" | "Approved to issue" | "Issued";
  expires: string;
  savedAt: string;
  steps: { name: QuoteStep; state: "complete" | "current" | "todo" }[];
  brief: {
    outcomes: string[];
    users: string;
    constraints: string;
    confidence: "low" | "medium" | "high";
  };
  scope: { included: string[]; excluded: string[]; acceptance: string[] };
  estimate: {
    packages: { name: string; low: number; base: number; high: number; role: string }[];
    contingencyPct: number;
    warrantyReserveGbp: number;
  };
  commercial: {
    buildPriceGbp: number;
    milestones: { label: string; pct: number }[];
    route: Route;
    runState: string;
    growOptions: { name: string; basis: string; fromGbp: number }[];
    transact: string;
  };
  internal: {
    riskAdjustedCostGbp: number;
    minMarginPct: number;
    targetMarginPct: number;
    approvedPriceGbp: number;
    approver: string;
    overrideReason?: string;
  };
  checks: { label: string; ok: boolean }[];
};

export const QUOTES: Quote[] = [
  {
    id: "q-northline-v2",
    clientId: "northline",
    client: "Northline Studios Ltd",
    project: "Studio bookings platform",
    version: "v2",
    status: "Internal review",
    expires: "30 Sep 2026",
    savedAt: "Saved 14:02 (fixture)",
    steps: [
      { name: "Brief", state: "complete" },
      { name: "Scope", state: "complete" },
      { name: "Delivery estimate", state: "complete" },
      { name: "Commercial model", state: "current" },
      { name: "Review & approval", state: "todo" },
      { name: "Client preview", state: "todo" },
    ],
    brief: {
      outcomes: [
        "Replace paper bookings with online scheduling",
        "Take deposits at booking",
        "Weekly utilisation report for the owner",
      ],
      users: "3 staff, ~400 customers/month",
      constraints: "Must launch before the November term",
      confidence: "medium",
    },
    scope: {
      included: [
        "Booking calendar with deposits",
        "Customer accounts and reminders",
        "Admin dashboard and utilisation report",
        "Data import from spreadsheet (≤ 2,000 rows)",
      ],
      excluded: ["Marketing website", "Accounting integration", "Native mobile apps"],
      acceptance: [
        "A customer can book and pay a deposit end to end",
        "Staff can reschedule and refund a deposit",
        "Report matches a checked sample week",
      ],
    },
    estimate: {
      packages: [
        { name: "Discovery and design", low: 12, base: 16, high: 22, role: "Lead" },
        { name: "Implementation", low: 60, base: 78, high: 100, role: "Engineer" },
        {
          name: "Integrations (payments, email)",
          low: 10,
          base: 14,
          high: 20,
          role: "Engineer",
        },
        { name: "Data import", low: 4, base: 6, high: 10, role: "Engineer" },
        { name: "Testing and security review", low: 8, base: 10, high: 14, role: "Lead" },
        {
          name: "Project management and meetings",
          low: 6,
          base: 8,
          high: 10,
          role: "Lead",
        },
      ],
      contingencyPct: 12,
      warrantyReserveGbp: 400,
    },
    commercial: {
      buildPriceGbp: 14800,
      milestones: [
        { label: "Deposit", pct: 50 },
        { label: "Build complete", pct: 25 },
        { label: "Acceptance", pct: 25 },
      ],
      route: "managed",
      runState: "Managed route selected; package to be agreed after build acceptance",
      growOptions: [
        { name: "Team training session", basis: "one-off", fromGbp: 295 },
        {
          name: "Branded walkthrough videos (pack of five)",
          basis: "one-off",
          fromGbp: 395,
        },
      ],
      transact: "Not applicable — no client payment platform fee in this project",
    },
    internal: {
      riskAdjustedCostGbp: 6900,
      minMarginPct: 40,
      targetMarginPct: 50,
      approvedPriceGbp: 14800,
      approver: "Louis",
    },
    checks: [
      { label: "Price at or above floor", ok: true },
      { label: "Low ≤ base ≤ high on every package", ok: true },
      { label: "No unexplained overrides", ok: true },
      { label: "Service-schedule wording for deferred package approved", ok: false },
      { label: "Client preview contains no internal rates or margin", ok: true },
    ],
  },
  {
    id: "q-atlas-v1",
    clientId: "atlas",
    client: "Atlas Operations Ltd",
    project: "Operations platform (multi-site)",
    version: "v1",
    status: "Draft",
    expires: "—",
    savedAt: "Saved 11:40 (fixture)",
    steps: [
      { name: "Brief", state: "complete" },
      { name: "Scope", state: "current" },
      { name: "Delivery estimate", state: "todo" },
      { name: "Commercial model", state: "todo" },
      { name: "Review & approval", state: "todo" },
      { name: "Client preview", state: "todo" },
    ],
    brief: {
      outcomes: ["Consolidate three site systems", "Migrate 9 years of records"],
      users: "40 staff, 6 sites",
      constraints: "Migration volume and quality unknown",
      confidence: "low",
    },
    scope: { included: ["To be defined after discovery"], excluded: [], acceptance: [] },
    estimate: {
      packages: [
        {
          name: "Provisional total (unknown migration)",
          low: 220,
          base: 300,
          high: 420,
          role: "Mixed",
        },
      ],
      contingencyPct: 25,
      warrantyReserveGbp: 900,
    },
    commercial: {
      buildPriceGbp: 0,
      milestones: [],
      route: "unresolved",
      runState: "Not assessed",
      growOptions: [],
      transact: "Unknown",
    },
    internal: {
      riskAdjustedCostGbp: 0,
      minMarginPct: 40,
      targetMarginPct: 50,
      approvedPriceGbp: 0,
      approver: "—",
    },
    checks: [
      { label: "Missing inputs treated as Unknown, not zero", ok: true },
      {
        label: "Estimate exceeds review threshold — escalated (no cap applied)",
        ok: false,
      },
      { label: "Paid discovery proposed before pricing", ok: false },
    ],
  },
];

export const quoteById = (id: string): Quote | undefined =>
  QUOTES.find((q) => q.id === id);

export const floorPrice = (cost: number, minMarginPct: number, increment = 100): number =>
  Math.ceil(cost / (1 - minMarginPct / 100) / increment) * increment;
export const targetPrice = (
  cost: number,
  targetMarginPct: number,
  increment = 100
): number => Math.ceil(cost / (1 - targetMarginPct / 100) / increment) * increment;
export const marginPct = (price: number, cost: number): number =>
  price > 0 ? Math.round(((price - cost) / price) * 1000) / 10 : 0;
