/**
 * FICTIONAL DEMO DATA for the operations areas of the admin redesign prototype
 * (brief §5.2 Sales, §5.5 Delivery, §5.8 Automations, §5.9 Settings, §6.5, §7,
 * §8.5, §11). Phase 1 task p1-ops.
 *
 * Nothing here is a real client, a real price or an approved price list. The
 * catalogue below is DRAFT / SANDBOX only (brief §6.5). Every screen under
 * /admin/next/{sales,delivery,automations,settings} renders from this module and
 * from ./fixtures only — no database reads, no provider calls, no writes.
 *
 * Client names and ids are imported from ./fixtures so the areas agree with the
 * Today / Clients / Quote Studio slice. This module never edits that file.
 *
 * Money is held as integer minor units with an explicit currency so the fixture
 * shape matches the schema rule for later migrations.
 */

import { QUOTES, clientById } from "./fixtures";

/* ────────────────────────────────────────────────────────────────────────────
 * Money
 * ──────────────────────────────────────────────────────────────────────────── */

export type Money = { amountMinor: number; currency: "GBP" };

export const money = (amountMinor: number): Money => ({ amountMinor, currency: "GBP" });

export function formatMoney(m: Money): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: m.currency,
    maximumFractionDigits: m.amountMinor % 100 === 0 ? 0 : 2,
  }).format(m.amountMinor / 100);
}

const clientName = (id: string): string => clientById(id)?.legalName ?? id;

/* ────────────────────────────────────────────────────────────────────────────
 * §5.2 Sales — pipeline
 * ──────────────────────────────────────────────────────────────────────────── */

export const PIPELINE_STAGES = [
  "New enquiry",
  "Qualified",
  "Discovery",
  "Scope ready",
  "Quote in review",
  "Sent",
  "Negotiation",
  "Won",
  "Lost",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export type Confidence = "low" | "medium" | "high" | "not estimated";

export type DuplicateMatch = {
  entity: string;
  kind: "legal entity" | "contact" | "domain";
  evidence: string;
  recommendation: "reuse existing record" | "review before converting" | "no match";
};

export type Opportunity = {
  id: string;
  company: string;
  /** Existing client fixture id when the lead belongs to a known client. */
  clientId?: string;
  opportunity: string;
  stage: PipelineStage;
  owner: string; // "Unassigned" is a real value, shown visibly
  nextAction: { text: string; due: string };
  confidence: Confidence;
  /** Proposal value only when a quote version carries one. Never contracted revenue. */
  proposalValue?: Money;
  /** Explicit probability. Left undefined everywhere — weighted pipeline is not configured. */
  probabilityPct?: number;
  detail: {
    problem: string;
    outcome: string;
    stakeholders: { name: string; role: string }[];
    currentProcess: string;
    timeline: string;
    budgetSignal: string; // "Not supplied" is a real value
    systems: string[];
    dataSensitivity:
      | "none stated"
      | "personal data"
      | "special category"
      | "payment data";
    discoveryNotes: string[];
    linkedQuoteIds: string[];
    activity: { at: string; text: string }[];
    decisionRationale: string;
  };
  duplicateMatches: DuplicateMatch[];
  closed?: { outcome: "won" | "lost"; at: string; reason: string };
};

export const OPPORTUNITIES: Opportunity[] = [
  {
    id: "opp-kestrel",
    company: "Kestrel Dental Group",
    opportunity: "Patient recall and online booking",
    stage: "New enquiry",
    owner: "Unassigned",
    nextAction: { text: "Acknowledge, assign owner and qualify", due: "18 Sep 2026" },
    confidence: "not estimated",
    detail: {
      problem: "Reception staff phone patients for recalls; no-shows are high.",
      outcome: "Automated recall reminders and self-service booking.",
      stakeholders: [{ name: "R. Adeyemi", role: "Practice manager (enquirer)" }],
      currentProcess: "Paper diary plus a spreadsheet of recall dates.",
      timeline: "Wants something before January.",
      budgetSignal: "Not supplied",
      systems: ["Unknown practice management system"],
      dataSensitivity: "special category",
      discoveryNotes: [],
      linkedQuoteIds: [],
      activity: [{ at: "17 Sep", text: "Web enquiry received (fixture)" }],
      decisionRationale: "Not yet qualified.",
    },
    duplicateMatches: [
      {
        entity: "kestreldental.example (domain)",
        kind: "domain",
        evidence: "Same domain as an enquiry closed lost in March (fixture)",
        recommendation: "review before converting",
      },
    ],
  },
  {
    id: "opp-morrow-2",
    company: clientName("morrow"),
    clientId: "morrow",
    opportunity: "Second site rollout",
    stage: "Qualified",
    owner: "Louis",
    nextAction: { text: "Book discovery call with site lead", due: "22 Sep 2026" },
    confidence: "not estimated",
    detail: {
      problem: "Second site runs on the first site's system with shared logins.",
      outcome: "Separate business unit with its own reporting.",
      stakeholders: [{ name: "D. Whitlock", role: "Owner" }],
      currentProcess: "Shared account; reports filtered manually.",
      timeline: "Q4 2026",
      budgetSignal: "Indicated 'similar to the first build'",
      systems: ["Existing managed platform (Core)"],
      dataSensitivity: "personal data",
      discoveryNotes: [
        "Existing client — winning must not create a second billing identity.",
      ],
      linkedQuoteIds: [],
      activity: [{ at: "15 Sep", text: "Owner asked about a second location" }],
      decisionRationale: "Qualified: existing managed client, clear scope boundary.",
    },
    duplicateMatches: [
      {
        entity: clientName("morrow"),
        kind: "legal entity",
        evidence: "Lead raised from an existing client workspace",
        recommendation: "reuse existing record",
      },
    ],
  },
  {
    id: "opp-atlas",
    company: clientName("atlas"),
    clientId: "atlas",
    opportunity: "Operations platform (multi-site)",
    stage: "Discovery",
    owner: "Louis",
    nextAction: {
      text: "Receive migration data inventory from client",
      due: "26 Sep 2026",
    },
    confidence: "low",
    detail: {
      problem: "Four sites on three spreadsheets; no shared job status.",
      outcome:
        "One operations platform with per-site views and a migration of live jobs.",
      stakeholders: [
        { name: "S. Iqbal", role: "Operations director (sponsor)" },
        { name: "K. Byrne", role: "Site manager (user)" },
      ],
      currentProcess: "Spreadsheets emailed nightly.",
      timeline: "Wants go-live in Q1 2027",
      budgetSignal: "Range given verbally; not recorded until written",
      systems: ["Spreadsheets", "Accounting package (unspecified)"],
      dataSensitivity: "personal data",
      discoveryNotes: [
        "Large estimate, low confidence — paid discovery in progress.",
        "Migration source volume unknown; pricing blocked until inventory received.",
      ],
      linkedQuoteIds: ["q-atlas-v1"],
      activity: [
        { at: "12 Sep", text: "Discovery workshop 1 held" },
        {
          at: "9 Sep",
          text: "Paid discovery agreed (price per draft catalogue, to confirm)",
        },
      ],
      decisionRationale: "Do not price before the migration inventory is in hand.",
    },
    duplicateMatches: [],
  },
  {
    id: "opp-brightwell",
    company: clientName("brightwell"),
    clientId: "brightwell",
    opportunity: "Client intake and case notes",
    stage: "Scope ready",
    owner: "Louis",
    nextAction: {
      text: "Legal review of sensitive-data handling before quoting",
      due: "19 Sep 2026",
    },
    confidence: "medium",
    detail: {
      problem: "Intake forms on paper; case notes in email.",
      outcome: "Structured intake with consent capture and access-controlled notes.",
      stakeholders: [{ name: "L. Fenwick", role: "Director" }],
      currentProcess: "Paper forms scanned to a shared drive.",
      timeline: "No fixed date",
      budgetSignal: "Not supplied",
      systems: ["Shared drive", "Email"],
      dataSensitivity: "special category",
      discoveryNotes: [
        "Sensitive-data flag — extra contract review before any quote issues.",
      ],
      linkedQuoteIds: [],
      activity: [{ at: "16 Sep", text: "Scope agreed in principle at discovery close" }],
      decisionRationale: "Scope ready; quote blocked on legal review of data terms.",
    },
    duplicateMatches: [],
  },
  {
    id: "opp-northline",
    company: clientName("northline"),
    clientId: "northline",
    opportunity: "Studio bookings platform",
    stage: "Quote in review",
    owner: "Louis",
    nextAction: {
      text: "Approve service-schedule wording, then approve v2 to issue",
      due: "20 Sep 2026",
    },
    confidence: "medium",
    proposalValue: money(1_480_000),
    detail: {
      problem: "Paper bookings and manual deposit chasing.",
      outcome: "Online scheduling with deposits and a weekly utilisation report.",
      stakeholders: [
        { name: "Jide Okafor", role: "Signatory" },
        { name: "Mara Ellis", role: "Project contact" },
      ],
      currentProcess: "Paper diary; deposits by bank transfer.",
      timeline: "Launch before the November term",
      budgetSignal: "Accepted v1; v2 is a scope clarification",
      systems: ["Payments", "Transactional email"],
      dataSensitivity: "personal data",
      discoveryNotes: [
        "v2 adds the utilisation report acceptance criterion; price unchanged.",
      ],
      linkedQuoteIds: ["q-northline-v1", "q-northline-v2"],
      activity: [
        { at: "16 Sep", text: "v2 sent for internal review" },
        { at: "2 Sep", text: "Order Form v1 accepted" },
      ],
      decisionRationale: "Existing legal entity; no new billing identity on conversion.",
    },
    duplicateMatches: [
      {
        entity: clientName("northline"),
        kind: "legal entity",
        evidence: "Exact match on company number (fixture)",
        recommendation: "reuse existing record",
      },
      {
        entity: "jide@northline.example",
        kind: "contact",
        evidence: "Existing signatory contact",
        recommendation: "reuse existing record",
      },
    ],
  },
  {
    id: "opp-fieldstone-grow",
    company: clientName("fieldstone"),
    clientId: "fieldstone",
    opportunity: "Reporting dashboard (Grow)",
    stage: "Sent",
    owner: "Louis",
    nextAction: { text: "Chase decision; offer expires 30 Sep", due: "25 Sep 2026" },
    confidence: "high",
    proposalValue: money(42_000),
    detail: {
      problem: "Owner exports CSVs weekly to build a report by hand.",
      outcome: "Dashboard with the three agreed views.",
      stakeholders: [{ name: "A. Kowalski", role: "Owner" }],
      currentProcess: "Manual CSV export",
      timeline: "October",
      budgetSignal: "Accepted the from-price range verbally",
      systems: ["Existing managed platform (Pro)"],
      dataSensitivity: "none stated",
      discoveryNotes: [
        "Grow request; execution blocked until acceptance and payment gate.",
      ],
      linkedQuoteIds: ["q-fieldstone-grow-v1"],
      activity: [{ at: "10 Sep", text: "Quote v1 issued" }],
      decisionRationale: "Standard Grow item; no discovery needed.",
    },
    duplicateMatches: [
      {
        entity: clientName("fieldstone"),
        kind: "legal entity",
        evidence: "Raised from client workspace",
        recommendation: "reuse existing record",
      },
    ],
  },
  {
    id: "opp-westbridge-3",
    company: clientName("westbridge"),
    clientId: "westbridge",
    opportunity: "Ticket scanning at the door",
    stage: "Negotiation",
    owner: "Louis",
    nextAction: {
      text: "Respond to request to split into two phases",
      due: "23 Sep 2026",
    },
    confidence: "medium",
    proposalValue: money(310_000),
    detail: {
      problem: "Door staff check names on a printed list.",
      outcome: "QR scanning with live capacity counts.",
      stakeholders: [{ name: "N. Osei", role: "Events director" }],
      currentProcess: "Printed lists",
      timeline: "Before the December season",
      budgetSignal: "Asked for phasing to spread cost",
      systems: ["Existing events platform", "Ticketing provider API"],
      dataSensitivity: "personal data",
      discoveryNotes: ["Any change after issue creates a new quote version."],
      linkedQuoteIds: ["q-westbridge-scan-v1"],
      activity: [{ at: "14 Sep", text: "Client proposed a two-phase split" }],
      decisionRationale: "Open — awaiting phasing decision.",
    },
    duplicateMatches: [],
  },
  {
    id: "opp-harbour",
    company: clientName("harbour"),
    clientId: "harbour",
    opportunity: "Activity booking and waivers",
    stage: "Won",
    owner: "Louis",
    nextAction: { text: "None — converted to client and project", due: "—" },
    confidence: "high",
    proposalValue: money(960_000),
    detail: {
      problem: "Waivers signed on paper at the door.",
      outcome: "Online booking with digital waivers.",
      stakeholders: [{ name: "Priya Nair", role: "Signatory + billing admin" }],
      currentProcess: "Paper waivers filed weekly",
      timeline: "Delivered",
      budgetSignal: "Accepted",
      systems: ["Booking", "E-signature"],
      dataSensitivity: "personal data",
      discoveryNotes: [],
      linkedQuoteIds: ["q-harbour-v1"],
      activity: [{ at: "12 Aug", text: "Won — Order Form v1 accepted" }],
      decisionRationale: "Won on scope fit; converted reusing the enquiry contact.",
    },
    duplicateMatches: [],
    closed: { outcome: "won", at: "12 Aug 2026", reason: "Order Form v1 accepted" },
  },
  {
    id: "opp-pennant",
    company: "Pennant Logistics Ltd",
    opportunity: "Driver rota tool",
    stage: "Lost",
    owner: "Louis",
    nextAction: { text: "None — closed", due: "—" },
    confidence: "medium",
    proposalValue: money(680_000),
    detail: {
      problem: "Rotas built in a spreadsheet by one planner.",
      outcome: "Rota tool with driver self-service.",
      stakeholders: [{ name: "T. Marsh", role: "Operations manager" }],
      currentProcess: "Spreadsheet",
      timeline: "Was Q3",
      budgetSignal: "Chose an off-the-shelf product",
      systems: ["Spreadsheet"],
      dataSensitivity: "personal data",
      discoveryNotes: [],
      linkedQuoteIds: ["q-pennant-v1"],
      activity: [
        { at: "28 Aug", text: "Declined — bought an off-the-shelf rota product" },
      ],
      decisionRationale: "Lost to a packaged product on price; no follow-up planned.",
    },
    duplicateMatches: [],
    closed: {
      outcome: "lost",
      at: "28 Aug 2026",
      reason: "Off-the-shelf product chosen",
    },
  },
];

export const opportunityById = (id: string): Opportunity | undefined =>
  OPPORTUNITIES.find((o) => o.id === id);

export type WeightedPipeline =
  | { configured: true; total: Money }
  | { configured: false; reason: string; unweightedOpen: Money };

/**
 * Weighted pipeline is shown only when every open opportunity carries an
 * explicitly configured probability (brief §5.2). Fixtures configure none, so
 * the UI shows "not configured". The unweighted sum is proposal value, never
 * contracted revenue.
 */
export function weightedPipeline(opps: Opportunity[]): WeightedPipeline {
  const open = opps.filter((o) => !o.closed);
  const unweightedOpen = money(
    open.reduce((n, o) => n + (o.proposalValue?.amountMinor ?? 0), 0)
  );
  const missing = open.filter((o) => o.probabilityPct === undefined);
  if (missing.length > 0) {
    return {
      configured: false,
      reason: `Stage probabilities are not configured (${missing.length} of ${open.length} open opportunities have none)`,
      unweightedOpen,
    };
  }
  const total = open.reduce(
    (n, o) =>
      n +
      Math.round(((o.proposalValue?.amountMinor ?? 0) * (o.probabilityPct ?? 0)) / 100),
    0
  );
  return { configured: true, total: money(total) };
}

/* ────────────────────────────────────────────────────────────────────────────
 * §5.2 Quotes — versions and states
 * ──────────────────────────────────────────────────────────────────────────── */

export const QUOTE_STATES = [
  "Draft",
  "Internal review",
  "Approved to issue",
  "Issued",
  "Accepted",
  "Declined",
  "Expired",
  "Superseded",
  "Withdrawn",
] as const;

export type QuoteState = (typeof QUOTE_STATES)[number];

const QUOTE_TRANSITIONS: Record<QuoteState, QuoteState[]> = {
  Draft: ["Internal review", "Withdrawn"],
  "Internal review": ["Draft", "Approved to issue", "Withdrawn"],
  "Approved to issue": ["Issued", "Draft", "Withdrawn"],
  Issued: ["Accepted", "Declined", "Expired", "Superseded", "Withdrawn"],
  Accepted: ["Superseded"],
  Declined: [],
  Expired: [],
  Superseded: [],
  Withdrawn: [],
};

export const nextQuoteStates = (from: QuoteState): QuoteState[] =>
  QUOTE_TRANSITIONS[from];

/** After issue a quote is client-visible; edits create a new version instead. */
export const editableInPlace = (state: QuoteState): boolean =>
  state === "Draft" || state === "Internal review" || state === "Approved to issue";

export type QuoteVersionRow = {
  id: string;
  clientId: string;
  client: string;
  project: string;
  version: string;
  state: QuoteState;
  value?: Money;
  savedAt: string;
  /** Present only when the Quote Studio fixture exists for this id. */
  studioHref?: string;
  supersededBy?: string;
  note?: string;
};

const studioIds = new Set(QUOTES.map((q) => q.id));
const studioHref = (id: string): string | undefined =>
  studioIds.has(id) ? `/admin/next/quotes/${id}` : undefined;

export const QUOTE_ROWS: QuoteVersionRow[] = [
  {
    id: "q-northline-v2",
    clientId: "northline",
    client: clientName("northline"),
    project: "Studio bookings platform",
    version: "v2",
    state: "Internal review",
    value: money(1_480_000),
    savedAt: "Saved 14:02 (fixture)",
    studioHref: studioHref("q-northline-v2"),
    note: "One commercial check fails — cannot be approved to issue yet",
  },
  {
    id: "q-northline-v1",
    clientId: "northline",
    client: clientName("northline"),
    project: "Studio bookings platform",
    version: "v1",
    state: "Superseded",
    value: money(1_480_000),
    savedAt: "Superseded 16 Sep",
    supersededBy: "q-northline-v2",
    note: "Accepted 2 Sep; superseded by v2 clarification. The accepted offer is not mutated.",
  },
  {
    id: "q-atlas-v1",
    clientId: "atlas",
    client: clientName("atlas"),
    project: "Operations platform (multi-site)",
    version: "v1",
    state: "Draft",
    savedAt: "Saved 11:40 (fixture)",
    studioHref: studioHref("q-atlas-v1"),
    note: "No price until discovery closes",
  },
  {
    id: "q-fieldstone-grow-v1",
    clientId: "fieldstone",
    client: clientName("fieldstone"),
    project: "Reporting dashboard (Grow)",
    version: "v1",
    state: "Issued",
    value: money(42_000),
    savedAt: "Issued 10 Sep · expires 30 Sep",
  },
  {
    id: "q-westbridge-scan-v1",
    clientId: "westbridge",
    client: clientName("westbridge"),
    project: "Ticket scanning at the door",
    version: "v1",
    state: "Issued",
    value: money(310_000),
    savedAt: "Issued 8 Sep · client asked for phasing",
    note: "A phased offer would be v2; v1 stays as issued",
  },
  {
    id: "q-harbour-v1",
    clientId: "harbour",
    client: clientName("harbour"),
    project: "Activity booking and waivers",
    version: "v1",
    state: "Accepted",
    value: money(960_000),
    savedAt: "Accepted 12 Aug",
  },
  {
    id: "q-brightwell-v1",
    clientId: "brightwell",
    client: clientName("brightwell"),
    project: "Client intake and case notes",
    version: "v1",
    state: "Approved to issue",
    value: money(620_000),
    savedAt: "Approved 16 Sep · issue blocked by legal review",
    note: "Approved internally; human issue action pending legal review of data terms",
  },
  {
    id: "q-pennant-v1",
    clientId: "pennant",
    client: "Pennant Logistics Ltd",
    project: "Driver rota tool",
    version: "v1",
    state: "Declined",
    value: money(680_000),
    savedAt: "Declined 28 Aug",
  },
  {
    id: "q-cedar-training-v1",
    clientId: "cedar",
    client: clientName("cedar"),
    project: "Team training session",
    version: "v1",
    state: "Expired",
    value: money(29_500),
    savedAt: "Expired 1 Sep",
  },
  {
    id: "q-morrow-video-v1",
    clientId: "morrow",
    client: clientName("morrow"),
    project: "Branded explainer video",
    version: "v1",
    state: "Withdrawn",
    value: money(9_500),
    savedAt: "Withdrawn 4 Sep — wrong deliverable count",
  },
];

/* ────────────────────────────────────────────────────────────────────────────
 * §5.2 Discovery
 * ──────────────────────────────────────────────────────────────────────────── */

export type DiscoveryEngagement = {
  id: string;
  opportunityId: string;
  company: string;
  kind: "Paid discovery" | "Discovery call" | "Provisional estimate review";
  state: "proposed" | "agreed" | "in progress" | "complete";
  price: { text: string; basis: string };
  checklist: { label: string; done: boolean }[];
  owner: string;
  due: string;
};

export const DISCOVERY: DiscoveryEngagement[] = [
  {
    id: "disc-atlas",
    opportunityId: "opp-atlas",
    company: clientName("atlas"),
    kind: "Paid discovery",
    state: "in progress",
    price: {
      text: "Draft catalogue range £350–£750 — amount to confirm",
      basis: "Not an approved price; staff approval before charging",
    },
    checklist: [
      { label: "Workshop 1 — current process", done: true },
      { label: "Migration data inventory received", done: false },
      { label: "Integration ownership agreed", done: false },
      { label: "Provisional estimate reviewed", done: false },
    ],
    owner: "Louis",
    due: "26 Sep 2026",
  },
  {
    id: "disc-brightwell",
    opportunityId: "opp-brightwell",
    company: clientName("brightwell"),
    kind: "Paid discovery",
    state: "complete",
    price: {
      text: "Draft catalogue range £350–£750",
      basis: "Charged under legacy quote; fixture",
    },
    checklist: [
      { label: "Workshop held", done: true },
      { label: "Data-sensitivity review", done: true },
      { label: "Scope schedule drafted", done: true },
    ],
    owner: "Louis",
    due: "16 Sep 2026",
  },
  {
    id: "disc-kestrel",
    opportunityId: "opp-kestrel",
    company: "Kestrel Dental Group",
    kind: "Discovery call",
    state: "proposed",
    price: { text: "No charge", basis: "Qualification call" },
    checklist: [{ label: "Call booked", done: false }],
    owner: "Unassigned",
    due: "—",
  },
];

/* ────────────────────────────────────────────────────────────────────────────
 * §6.5 Pricing catalogue — DRAFT / SANDBOX only
 * ──────────────────────────────────────────────────────────────────────────── */

export const CATALOGUE_VERSION = {
  id: "catalogue-sandbox-2026-09",
  status: "draft" as const,
  effectiveFrom: "Not effective — sandbox",
  marker:
    "Not an approved price list — draft, non-chargeable suggestions for review (brief §6.5)",
};

export type CatalogueFamily = "Discovery" | "Run" | "Grow" | "Launch" | "AI" | "Transact";

export type CatalogueItem = {
  id: string;
  family: CatalogueFamily;
  item: string;
  suggested: string; // the earlier suggested starting point, verbatim wording
  basis: "one-off" | "from" | "per month" | "custom" | "illustrative" | "percentage";
  status: "draft";
  chargeable: false;
  note?: string;
};

export const CATALOGUE: CatalogueItem[] = [
  {
    id: "cat-discovery",
    family: "Discovery",
    item: "Paid Discovery",
    suggested: "£350–£750",
    basis: "one-off",
    status: "draft",
    chargeable: false,
  },
  {
    id: "cat-managed",
    family: "Run",
    item: "Managed Core / Pro / Max",
    suggested: "£149 / £249 / £399 per month",
    basis: "per month",
    status: "draft",
    chargeable: false,
    note: "Evaluate against calculator first",
  },
  {
    id: "cat-small-change",
    family: "Grow",
    item: "Small platform change",
    suggested: "From £125",
    basis: "from",
    status: "draft",
    chargeable: false,
  },
  {
    id: "cat-ui-change",
    family: "Grow",
    item: "UI/design change",
    suggested: "From £150",
    basis: "from",
    status: "draft",
    chargeable: false,
  },
  {
    id: "cat-feature",
    family: "Grow",
    item: "Small / substantial feature",
    suggested: "From £250 / £500",
    basis: "from",
    status: "draft",
    chargeable: false,
  },
  {
    id: "cat-module",
    family: "Grow",
    item: "New module/workflow",
    suggested: "From £750",
    basis: "from",
    status: "draft",
    chargeable: false,
  },
  {
    id: "cat-major",
    family: "Grow",
    item: "Major extension",
    suggested: "Custom quote",
    basis: "custom",
    status: "draft",
    chargeable: false,
  },
  {
    id: "cat-integration",
    family: "Grow",
    item: "Third-party integration",
    suggested: "From £400",
    basis: "from",
    status: "draft",
    chargeable: false,
  },
  {
    id: "cat-email",
    family: "Grow",
    item: "Automated email/workflow",
    suggested: "From £175",
    basis: "from",
    status: "draft",
    chargeable: false,
  },
  {
    id: "cat-reporting",
    family: "Grow",
    item: "Reporting/dashboard",
    suggested: "From £350",
    basis: "from",
    status: "draft",
    chargeable: false,
  },
  {
    id: "cat-data",
    family: "Grow",
    item: "Data import/migration",
    suggested: "From £250",
    basis: "from",
    status: "draft",
    chargeable: false,
  },
  {
    id: "cat-training",
    family: "Grow",
    item: "Admin onboarding / team training",
    suggested: "£195 / £295",
    basis: "one-off",
    status: "draft",
    chargeable: false,
  },
  {
    id: "cat-video",
    family: "Launch",
    item: "Branded explainer video / five-video pack",
    suggested: "£95 each / £395",
    basis: "one-off",
    status: "draft",
    chargeable: false,
    note: "Distinct from the Platform Launch Pack; avoid overlapping products",
  },
  {
    id: "cat-launch-pack",
    family: "Launch",
    item: "Platform Launch Pack",
    suggested: "£495",
    basis: "one-off",
    status: "draft",
    chargeable: false,
    note: "Candidate scope: up to five walkthrough videos, script/copy, AI voiceover, screen demonstrations, exports, one revision round, basic launch/help documentation",
  },
  {
    id: "cat-launch-plus",
    family: "Launch",
    item: "Launch Pack Plus",
    suggested: "£795",
    basis: "one-off",
    status: "draft",
    chargeable: false,
    note: "Exact additional deliverables to approve",
  },
  {
    id: "cat-location",
    family: "Grow",
    item: "Additional location/business unit setup",
    suggested: "From £500",
    basis: "from",
    status: "draft",
    chargeable: false,
  },
  {
    id: "cat-whitelabel",
    family: "Grow",
    item: "White-label/custom-brand rollout",
    suggested: "From £750",
    basis: "from",
    status: "draft",
    chargeable: false,
  },
  {
    id: "cat-ai-assistant",
    family: "AI",
    item: "AI Assistant",
    suggested: "From £99/month plus usage",
    basis: "per month",
    status: "draft",
    chargeable: false,
  },
  {
    id: "cat-ai-automation",
    family: "AI",
    item: "AI Automation",
    suggested: "From £149/month plus usage",
    basis: "per month",
    status: "draft",
    chargeable: false,
  },
  {
    id: "cat-ai-workflow",
    family: "AI",
    item: "Custom AI Workflow setup",
    suggested: "From £500",
    basis: "from",
    status: "draft",
    chargeable: false,
  },
  {
    id: "cat-extra-env",
    family: "Run",
    item: "Extra venue / brand or business unit / production environment",
    suggested: "Illustrative +£50 / +£75 / +£100 per month",
    basis: "illustrative",
    status: "draft",
    chargeable: false,
  },
  {
    id: "cat-complex-int",
    family: "Run",
    item: "Complex integration management",
    suggested: "Illustrative +£50–£150 per month",
    basis: "illustrative",
    status: "draft",
    chargeable: false,
  },
  {
    id: "cat-app-fee",
    family: "Transact",
    item: "Application fee",
    suggested: "Discussion default around 1.5%; processor fees separate",
    basis: "percentage",
    status: "draft",
    chargeable: false,
  },
];

/**
 * The £600 independent handover fee is a confirmed commercial decision, shown
 * separately from the unapproved catalogue (brief §6.5 last paragraph). Tax
 * basis decided 20 Sep 2026: invoiced inclusive, no VAT line. Real issuance
 * stays blocked until payment timing and scope are confirmed.
 */
export const HANDOVER_FEE_DECISION = {
  id: "decision-handover-fee",
  label: "Independent handover fee",
  amount: money(60_000),
  status: "confirmed commercial decision" as const,
  taxBasis: "inclusive, no VAT line" as const,
  blockedOn: [
    "Payment timing (due date)",
    "Scope and exceptions (complex migrations, later offboarding, route changes)",
  ],
  issuanceAllowed: false as const,
};

/* ────────────────────────────────────────────────────────────────────────────
 * §5.5 Delivery — projects and commercial gates
 * ──────────────────────────────────────────────────────────────────────────── */

export type GateState = "pass" | "fail" | "waived" | "not applicable";

export type CommercialGate = {
  id: string;
  label: string;
  state: GateState;
  evidence: string;
  waiver?: { by: string; reason: string; auditRef: string; at: string };
};

export type BuildStartInput = {
  agreementAccepted: boolean;
  depositPaid: boolean;
  readinessComplete: boolean;
  waiver?: { by: string; reason: string; auditRef: string };
  /** State of the deposit invoice as recorded in the ledger. */
  depositInvoiceState: "issued" | "paid" | "part paid" | "overdue";
};

export type BuildStartResult = {
  satisfied: boolean;
  reasons: string[];
  /** The gate never changes the invoice; a waiver leaves it exactly as it was. */
  depositInvoiceState: BuildStartInput["depositInvoiceState"];
  waived: boolean;
};

/**
 * Build starts when agreement, deposit and readiness gates are satisfied, or an
 * authorised waiver is recorded for the deposit gate. Waiving the deposit gate
 * does not mark the invoice paid (brief §5.5).
 */
export function buildStartGate(input: BuildStartInput): BuildStartResult {
  const reasons: string[] = [];
  if (!input.agreementAccepted) reasons.push("Agreement not accepted");
  const depositSatisfied = input.depositPaid || Boolean(input.waiver);
  if (!depositSatisfied)
    reasons.push("Deposit not paid and no authorised waiver recorded");
  if (!input.readinessComplete) reasons.push("Readiness checklist incomplete");
  return {
    satisfied: reasons.length === 0,
    reasons,
    depositInvoiceState: input.depositInvoiceState,
    waived: !input.depositPaid && Boolean(input.waiver),
  };
}

export type Deliverable = {
  id: string;
  label: string;
  scopeRef: string; // links back to scope or an approved change
  acceptance: {
    criterion: string;
    evidence?: string;
    state: "pending" | "evidenced" | "accepted" | "disputed";
  }[];
  owner: string;
};

export type Project = {
  id: string;
  clientId: string;
  client: string;
  name: string;
  scopeVersion: { label: string; acceptedAt: string; href: string };
  owners: { role: string; name: string }[];
  milestones: {
    label: string;
    due: string;
    state: "complete" | "in progress" | "not started";
    commercial: string;
  }[];
  dependencies: {
    label: string;
    owner: string;
    state: "met" | "open" | "at risk";
    due?: string;
  }[];
  deliverables: Deliverable[];
  blockers: { label: string; owner: string; since: string }[];
  gates: CommercialGate[];
  buildStart: BuildStartInput;
};

export const PROJECTS: Project[] = [
  {
    id: "proj-northline",
    clientId: "northline",
    client: clientName("northline"),
    name: "Studio bookings platform",
    scopeVersion: {
      label: "Order Form v1 · Scope schedule v1",
      acceptedAt: "Accepted 2 Sep 2026 by J. Okafor",
      href: "/admin/next/quotes/q-northline-v2",
    },
    owners: [
      { role: "Delivery lead", name: "Louis" },
      { role: "Client project contact", name: "Mara Ellis" },
      { role: "Signatory", name: "Jide Okafor" },
    ],
    milestones: [
      {
        label: "Milestone 1 — foundations",
        due: "10 Sep 2026",
        state: "complete",
        commercial: "Deposit (example 50%) paid 3 Sep",
      },
      {
        label: "Milestone 2 — booking and deposits",
        due: "24 Sep 2026",
        state: "in progress",
        commercial: "Build complete (example 25%) — issued on build review",
      },
      {
        label: "Milestone 3 — reports and acceptance",
        due: "8 Oct 2026",
        state: "not started",
        commercial: "Acceptance (example 25%) — issued on acceptance",
      },
    ],
    dependencies: [
      { label: "Payment provider account (client-owned)", owner: "Client", state: "met" },
      {
        label: "Spreadsheet export for data import (≤ 2,000 rows)",
        owner: "Client",
        state: "at risk",
        due: "22 Sep 2026",
      },
      {
        label: "Transactional email domain verification",
        owner: "Nullshift",
        state: "open",
        due: "23 Sep 2026",
      },
    ],
    deliverables: [
      {
        id: "del-booking",
        label: "Booking calendar with deposits",
        scopeRef: "Scope schedule v1 · item 1",
        owner: "Louis",
        acceptance: [
          {
            criterion: "A customer can book and pay a deposit end to end",
            state: "evidenced",
            evidence: "Staging walkthrough recording 15 Sep",
          },
          { criterion: "Staff can reschedule and refund a deposit", state: "pending" },
        ],
      },
      {
        id: "del-accounts",
        label: "Customer accounts and reminders",
        scopeRef: "Scope schedule v1 · item 2",
        owner: "Louis",
        acceptance: [
          { criterion: "Reminder sent 24h before a booking", state: "pending" },
        ],
      },
      {
        id: "del-report",
        label: "Admin dashboard and utilisation report",
        scopeRef:
          "Scope schedule v1 · item 3 (criterion clarified in quote v2, in review)",
        owner: "Louis",
        acceptance: [
          { criterion: "Report matches a checked sample week", state: "pending" },
        ],
      },
      {
        id: "del-import",
        label: "Data import from spreadsheet",
        scopeRef: "Scope schedule v1 · item 4",
        owner: "Louis",
        acceptance: [
          { criterion: "Row count and spot-check match the source", state: "pending" },
        ],
      },
    ],
    blockers: [
      {
        label: "Import source file not yet supplied",
        owner: "Client (Mara Ellis)",
        since: "12 Sep 2026",
      },
    ],
    gates: [
      {
        id: "gate-agreement",
        label: "Agreement accepted",
        state: "pass",
        evidence: "Order Form v1 accepted 2 Sep (signatory)",
      },
      {
        id: "gate-deposit",
        label: "Deposit received",
        state: "pass",
        evidence: "Milestone 1 paid 3 Sep · Xero INV-FX-0101 (fixture)",
      },
      {
        id: "gate-readiness",
        label: "Readiness (assets and access)",
        state: "pass",
        evidence: "Granted 5 Sep",
      },
      {
        id: "gate-acceptance",
        label: "Client acceptance",
        state: "fail",
        evidence: "Not started — evidence per deliverable required first",
      },
      {
        id: "gate-service",
        label: "Managed package accepted",
        state: "not applicable",
        evidence: "Agreed after build acceptance as a separate service schedule",
      },
    ],
    buildStart: {
      agreementAccepted: true,
      depositPaid: true,
      readinessComplete: true,
      depositInvoiceState: "paid",
    },
  },
  {
    id: "proj-westbridge",
    clientId: "westbridge",
    client: clientName("westbridge"),
    name: "Events platform",
    scopeVersion: {
      label: "Order Form v1",
      acceptedAt: "Accepted 15 Jul 2026",
      href: "/admin/next/clients/westbridge",
    },
    owners: [{ role: "Delivery lead", name: "Louis" }],
    milestones: [
      { label: "Milestone 1", due: "1 Aug 2026", state: "complete", commercial: "Paid" },
      {
        label: "Milestone 2",
        due: "1 Sep 2026",
        state: "complete",
        commercial: "Part paid",
      },
      {
        label: "Milestone 3",
        due: "23 Sep 2026",
        state: "in progress",
        commercial: "Issued — Xero sync failed (accounting-only retry)",
      },
    ],
    dependencies: [],
    deliverables: [],
    blockers: [],
    gates: [
      {
        id: "gate-agreement",
        label: "Agreement accepted",
        state: "pass",
        evidence: "Order Form v1 accepted 15 Jul",
      },
      {
        id: "gate-deposit",
        label: "Deposit received",
        state: "waived",
        evidence:
          "Deposit invoice remained 'issued' until paid 20 Jul — waiver did not mark it paid",
        waiver: {
          by: "Louis",
          reason: "Start one week early to hit venue date",
          auditRef: "audit:fx-0044",
          at: "16 Jul 2026",
        },
      },
      {
        id: "gate-readiness",
        label: "Readiness (assets and access)",
        state: "pass",
        evidence: "Granted 17 Jul",
      },
    ],
    buildStart: {
      agreementAccepted: true,
      depositPaid: false,
      readinessComplete: true,
      waiver: {
        by: "Louis",
        reason: "Start one week early to hit venue date",
        auditRef: "audit:fx-0044",
      },
      depositInvoiceState: "issued",
    },
  },
];

export const projectById = (id: string): Project | undefined =>
  PROJECTS.find((p) => p.id === id);

/* ────────────────────────────────────────────────────────────────────────────
 * §7 Work queue — classification and coverage
 * ──────────────────────────────────────────────────────────────────────────── */

export const WORK_CLASSES = [
  "DEFECT",
  "SUPPORT",
  "MAINTENANCE",
  "CHANGE / FEATURE",
  "CONTENT / TRAINING",
  "DATA / INTEGRATION / EXPANSION",
  "TRANSACTION",
] as const;

export type WorkClass = (typeof WORK_CLASSES)[number];

export const WORK_CLASS_HANDLING: Record<
  WorkClass,
  { handling: string; evidence: string }
> = {
  DEFECT: {
    handling: "Covered warranty and/or Run if applicable",
    evidence: "Reproduction, expected agreed behaviour, affected version; check coverage",
  },
  SUPPORT: {
    handling: "Included within applicable Run schedule",
    evidence: "Existing-system assistance; check limits and exclusions",
  },
  MAINTENANCE: {
    handling: "Included routine Run work where covered",
    evidence: "Routine security/dependency/compatibility task",
  },
  "CHANGE / FEATURE": {
    handling: "Grow, quote required",
    evidence: "New or changed capability/scope",
  },
  "CONTENT / TRAINING": {
    handling: "Grow unless expressly included",
    evidence: "Deliverable/format/audience/revision limits",
  },
  "DATA / INTEGRATION / EXPANSION": {
    handling: "Grow unless expressly included",
    evidence: "Migration, new connection, rollout or additional operational scope",
  },
  TRANSACTION: {
    handling: "Agreed percentage-fee model",
    evidence: "Accepted fee schedule and connected-account context",
  },
};

export type Coverage = "managed" | "warranty" | "grow" | "review";

/** Exact UI wording from brief §7. */
export const COVERAGE_LABEL: Record<Coverage, string> = {
  managed: "Included — Managed Platform",
  warranty: "Included — build warranty",
  grow: "Chargeable Grow request — quote required",
  review: "Coverage needs review",
};

export type CoverageInput = {
  workClass: WorkClass;
  /** An accepted Run/Managed schedule governs this system. */
  managedActive: boolean;
  /** Build warranty is in force for the affected version. */
  warrantyActive: boolean;
  /** Reproduction / agreed-behaviour evidence is sufficient to classify. */
  evidenceSufficient: boolean;
  /** Expressly included by the governing agreement (content/data classes). */
  expresslyIncluded?: boolean;
};

/**
 * Classification does not itself create an entitlement (brief §7). Coverage is
 * assessed against accepted implemented scope and the governing agreement.
 */
export function assessCoverage(i: CoverageInput): Coverage {
  if (!i.evidenceSufficient) return "review";
  switch (i.workClass) {
    case "DEFECT":
      if (i.warrantyActive) return "warranty";
      if (i.managedActive) return "managed";
      return "review";
    case "SUPPORT":
    case "MAINTENANCE":
      return i.managedActive ? "managed" : "review";
    case "CHANGE / FEATURE":
      return "grow";
    case "CONTENT / TRAINING":
    case "DATA / INTEGRATION / EXPANSION":
      return i.expresslyIncluded ? (i.managedActive ? "managed" : "warranty") : "grow";
    case "TRANSACTION":
      return "review";
  }
}

export type GrowGateInput = {
  scopeAccepted: boolean;
  priceAccepted: boolean;
  paymentGateSatisfied: boolean;
  exception?: { by: string; reason: string; auditRef: string };
};

/** Grow execution stays blocked until acceptance and the payment gate, unless an authorised exception is recorded. */
export function growExecutionAllowed(g: GrowGateInput): {
  allowed: boolean;
  reason: string;
} {
  if (g.exception)
    return {
      allowed: true,
      reason: `Authorised exception recorded by ${g.exception.by} (${g.exception.auditRef})`,
    };
  if (!g.scopeAccepted) return { allowed: false, reason: "Scope not accepted" };
  if (!g.priceAccepted) return { allowed: false, reason: "Price not accepted" };
  if (!g.paymentGateSatisfied)
    return { allowed: false, reason: "Payment gate not satisfied" };
  return { allowed: true, reason: "Scope, price and payment gate satisfied" };
}

export type WorkItem = {
  id: string;
  clientId: string;
  client: string;
  title: string;
  clientCalledIt: string;
  workClass: WorkClass;
  coverage: Coverage;
  governing: string;
  owner: string;
  state:
    | "new"
    | "triaged"
    | "awaiting client"
    | "awaiting quote"
    | "in progress"
    | "released"
    | "blocked";
  due?: string;
  /** For a mixed request split into linked items. */
  splitFrom?: string;
  linkedTo?: string;
  suggestion?: { source: "fixture" | "ai-draft"; note: string };
  growGate?: GrowGateInput;
};

export const WORK_QUEUE: WorkItem[] = [
  {
    id: "wq-harbour-12",
    clientId: "harbour",
    client: clientName("harbour"),
    title: "Waiver PDF fails to generate for groups over 12",
    clientCalledIt: "bug",
    workClass: "DEFECT",
    coverage: assessCoverage({
      workClass: "DEFECT",
      managedActive: false,
      warrantyActive: true,
      evidenceSufficient: true,
    }),
    governing: "Order Form v1 · build warranty to 9 Nov 2026 (fixture)",
    owner: "Louis",
    state: "released",
    suggestion: {
      source: "fixture",
      note: "Reproduced on staging; agreed behaviour in Scope schedule v1 item 3",
    },
  },
  {
    id: "wq-morrow-31",
    clientId: "morrow",
    client: clientName("morrow"),
    title: "Runtime deprecation notice from hosting provider",
    clientCalledIt: "—",
    workClass: "MAINTENANCE",
    coverage: assessCoverage({
      workClass: "MAINTENANCE",
      managedActive: true,
      warrantyActive: false,
      evidenceSufficient: true,
    }),
    governing: "Service schedule v1 · Core (fixture)",
    owner: "Louis",
    state: "in progress",
    due: "30 Sep 2026",
  },
  {
    id: "wq-cedar-07",
    clientId: "cedar",
    client: clientName("cedar"),
    title: "Quote PDF shows the wrong VAT line and we want a discount-code field",
    clientCalledIt: "change",
    workClass: "CHANGE / FEATURE",
    coverage: "review",
    governing: "Mixed request — split into wq-cedar-07a and wq-cedar-07b",
    owner: "Louis",
    state: "triaged",
    suggestion: {
      source: "fixture",
      note: "Split: restoration of agreed VAT line (defect) and a new capability (feature)",
    },
  },
  {
    id: "wq-cedar-07a",
    clientId: "cedar",
    client: clientName("cedar"),
    title: "Restore agreed VAT line on quote PDF",
    clientCalledIt: "change",
    workClass: "DEFECT",
    coverage: assessCoverage({
      workClass: "DEFECT",
      managedActive: false,
      warrantyActive: true,
      evidenceSufficient: true,
    }),
    governing: "Order Form v1 · build warranty (fixture) — Scope schedule item 5",
    owner: "Louis",
    state: "in progress",
    splitFrom: "wq-cedar-07",
    linkedTo: "wq-cedar-07b",
    due: "19 Sep 2026",
  },
  {
    id: "wq-cedar-07b",
    clientId: "cedar",
    client: clientName("cedar"),
    title: "Add discount-code field to quotes",
    clientCalledIt: "change",
    workClass: "CHANGE / FEATURE",
    coverage: assessCoverage({
      workClass: "CHANGE / FEATURE",
      managedActive: false,
      warrantyActive: true,
      evidenceSufficient: true,
    }),
    governing: "No governing agreement — Grow quote required",
    owner: "Louis",
    state: "awaiting quote",
    splitFrom: "wq-cedar-07",
    linkedTo: "wq-cedar-07a",
    growGate: { scopeAccepted: false, priceAccepted: false, paymentGateSatisfied: false },
  },
  {
    id: "wq-cedar-09",
    clientId: "cedar",
    client: clientName("cedar"),
    title: "How do we export job sheets to CSV?",
    clientCalledIt: "question",
    workClass: "SUPPORT",
    coverage: assessCoverage({
      workClass: "SUPPORT",
      managedActive: false,
      warrantyActive: true,
      evidenceSufficient: true,
    }),
    governing: "No accepted Run schedule; warranty does not cover assistance",
    owner: "Unassigned",
    state: "new",
    suggestion: {
      source: "fixture",
      note: "Interim arrangement may cover — needs human review",
    },
  },
  {
    id: "wq-orbit-04",
    clientId: "orbit",
    client: clientName("orbit"),
    title: "Record two extra walkthrough videos",
    clientCalledIt: "request",
    workClass: "CONTENT / TRAINING",
    coverage: assessCoverage({
      workClass: "CONTENT / TRAINING",
      managedActive: false,
      warrantyActive: false,
      evidenceSufficient: true,
      expresslyIncluded: false,
    }),
    governing: "Handover schedule — not included",
    owner: "Louis",
    state: "awaiting quote",
    growGate: { scopeAccepted: false, priceAccepted: false, paymentGateSatisfied: false },
  },
  {
    id: "wq-atlas-02",
    clientId: "atlas",
    client: clientName("atlas"),
    title: "Import legacy job data from four spreadsheets",
    clientCalledIt: "part of the build",
    workClass: "DATA / INTEGRATION / EXPANSION",
    coverage: assessCoverage({
      workClass: "DATA / INTEGRATION / EXPANSION",
      managedActive: false,
      warrantyActive: false,
      evidenceSufficient: false,
    }),
    governing: "No accepted scope yet — discovery in progress",
    owner: "Louis",
    state: "blocked",
    suggestion: {
      source: "fixture",
      note: "Volume unknown; cannot assess inclusion until scope schedule exists",
    },
  },
  {
    id: "wq-fieldstone-18",
    clientId: "fieldstone",
    client: clientName("fieldstone"),
    title: "Application fee on last payout looks different from the schedule",
    clientCalledIt: "billing query",
    workClass: "TRANSACTION",
    coverage: assessCoverage({
      workClass: "TRANSACTION",
      managedActive: true,
      warrantyActive: false,
      evidenceSufficient: true,
    }),
    governing:
      "Accepted fee schedule (Order Form v1, fixture) — connected-account context to attach",
    owner: "Finance (Louis)",
    state: "triaged",
  },
  {
    id: "wq-fieldstone-19",
    clientId: "fieldstone",
    client: clientName("fieldstone"),
    title: "Reporting dashboard (three agreed views)",
    clientCalledIt: "feature",
    workClass: "CHANGE / FEATURE",
    coverage: "grow",
    governing: "Quote q-fieldstone-grow-v1 issued 10 Sep — not yet accepted",
    owner: "Louis",
    state: "awaiting client",
    growGate: { scopeAccepted: false, priceAccepted: false, paymentGateSatisfied: false },
  },
];

export const workItemById = (id: string): WorkItem | undefined =>
  WORK_QUEUE.find((w) => w.id === id);

export type Incident = {
  id: string;
  clientId: string;
  client: string;
  title: string;
  severity: "S1" | "S2" | "S3";
  state: "open" | "mitigated" | "resolved";
  owner: string;
  since: string;
  coverage: Coverage;
  note: string;
};

/** Incidents are triaged separately from routine changes (brief §7). */
export const INCIDENTS: Incident[] = [
  {
    id: "inc-fieldstone-3",
    clientId: "fieldstone",
    client: clientName("fieldstone"),
    title: "Transactional email bouncing for ~15% of customers",
    severity: "S2",
    state: "open",
    owner: "Louis",
    since: "17 Sep 08:12",
    coverage: "managed",
    note: "Covered incident response proceeds regardless of the pending Grow quote (wq-fieldstone-19)",
  },
  {
    id: "inc-morrow-1",
    clientId: "morrow",
    client: clientName("morrow"),
    title: "Nightly backup check failed once (recovered on retry)",
    severity: "S3",
    state: "resolved",
    owner: "Louis",
    since: "14 Sep",
    coverage: "managed",
    note: "Resolved; recorded for the monthly platform review",
  },
];

/* ────────────────────────────────────────────────────────────────────────────
 * §5.5 Releases
 * ──────────────────────────────────────────────────────────────────────────── */

export type Release = {
  id: string;
  clientId: string;
  client: string;
  label: string;
  state: "planned" | "staged" | "released" | "rolled back";
  when: string;
  linkedTo: string; // scope item, approved change or work item
  acceptance: "not required" | "awaiting client" | "partial" | "accepted" | "disputed";
  note?: string;
};

export const RELEASES: Release[] = [
  {
    id: "rel-northline-m2",
    clientId: "northline",
    client: clientName("northline"),
    label: "Milestone 2 build-review candidate",
    state: "staged",
    when: "Review 24 Sep 2026",
    linkedTo: "proj-northline · milestone 2",
    acceptance: "awaiting client",
    note: "Acceptance is recorded per deliverable with evidence; a page view is not acceptance",
  },
  {
    id: "rel-harbour-1-3",
    clientId: "harbour",
    client: clientName("harbour"),
    label: "1.3.0 — waiver PDF fix",
    state: "released",
    when: "15 Sep 2026",
    linkedTo: "wq-harbour-12 (DEFECT, warranty)",
    acceptance: "accepted",
  },
  {
    id: "rel-cedar-vat",
    clientId: "cedar",
    client: clientName("cedar"),
    label: "Quote PDF VAT line restoration",
    state: "planned",
    when: "19 Sep 2026",
    linkedTo: "wq-cedar-07a (DEFECT, warranty)",
    acceptance: "not required",
    note: "Ships without the linked discount-code enhancement (wq-cedar-07b), which awaits a quote",
  },
  {
    id: "rel-westbridge-m3",
    clientId: "westbridge",
    client: clientName("westbridge"),
    label: "Milestone 3 — client review build",
    state: "staged",
    when: "In client review since 12 Sep",
    linkedTo: "proj-westbridge · milestone 3",
    acceptance: "partial",
    note: "Two of three deliverables accepted; one disputed defect open — partial acceptance recorded explicitly",
  },
];

/* ────────────────────────────────────────────────────────────────────────────
 * §8.5 Handover — Orbit checklist
 * ──────────────────────────────────────────────────────────────────────────── */

export type HandoverItemState =
  | "complete"
  | "in progress"
  | "not started"
  | "blocked"
  | "not applicable";

export type HandoverItem = {
  n: number;
  label: string;
  owner: "Nullshift" | "Client" | "Both";
  state: HandoverItemState;
  evidence?: string;
  blockedOn?: string;
};

export const HANDOVER_ORBIT = {
  clientId: "orbit",
  client: clientName("orbit"),
  fee: HANDOVER_FEE_DECISION,
  feeInvoice: "Invoiced once and paid (fixture) · tax basis recorded as pending decision",
  scheduleRef: "Independent handover schedule accepted 20 Aug 2026",
  accessRevocation:
    "Blocked until items 1–9 complete — access cannot be revoked before the agreed transfer gates",
  items: [
    {
      n: 1,
      label: "Confirm receiving owner/provider and transfer plan",
      owner: "Client",
      state: "complete",
      evidence: "Confirmed 1 Sep by receiving IT contractor (fixture)",
    },
    {
      n: 2,
      label: "Resolve outstanding accepted obligations and any authorised exceptions",
      owner: "Both",
      state: "complete",
      evidence: "Acceptance milestone paid 29 Aug; no exceptions",
    },
    {
      n: 3,
      label:
        "Create/confirm client-owned hosting, database, domains, communications and payment accounts",
      owner: "Client",
      state: "complete",
      evidence:
        "Verified 9 Sep — hosting, database, domain; no payment platform in scope",
    },
    {
      n: 4,
      label:
        "Transfer repository/deployment ownership, environment inventory, configuration documentation and operational instructions securely",
      owner: "Nullshift",
      state: "in progress",
      evidence: "Repository transfer invited 15 Sep; environment inventory drafted",
    },
    {
      n: 5,
      label:
        "Transfer data using an approved, tested method; verify backups/restoration and data-processing responsibilities",
      owner: "Nullshift",
      state: "not started",
    },
    {
      n: 6,
      label: "Record licence/third-party restrictions and secrets-rotation plan",
      owner: "Nullshift",
      state: "not started",
    },
    {
      n: 7,
      label: "Confirm DNS/payment/webhook/email continuity and agreed validation checks",
      owner: "Both",
      state: "not started",
    },
    {
      n: 8,
      label: "Resolve Stripe Connect/application-fee disposition explicitly",
      owner: "Nullshift",
      state: "blocked",
      blockedOn:
        "Owner decision (register 18.4) — no application fee in this project, but disposition must be recorded",
    },
    {
      n: 9,
      label: "Provide agreed walkthrough/documentation; record client acknowledgement",
      owner: "Nullshift",
      state: "not started",
      evidence: "Walkthrough booked Fri 19 Sep",
    },
    {
      n: 10,
      label:
        "Revoke Nullshift access only after the agreed transfer gates; retain only authorised access and records",
      owner: "Nullshift",
      state: "blocked",
      blockedOn: "Items 1–9",
    },
    {
      n: 11,
      label:
        "Mark handover complete with evidence and future support/warranty boundaries",
      owner: "Nullshift",
      state: "not started",
    },
  ] satisfies HandoverItem[],
};

/* ────────────────────────────────────────────────────────────────────────────
 * §5.5 Capacity — explicit assumptions
 * ──────────────────────────────────────────────────────────────────────────── */

export const CAPACITY = {
  assumptions: [
    {
      label: "Available delivery hours per week (Louis)",
      value: "24",
      source: "Stated by Louis on 17 Sep — not measured",
    },
    {
      label: "Focus factor applied to available hours",
      value: "0.8",
      source: "Assumption; revisit after two tracked weeks",
    },
    {
      label: "Effort figures",
      value: "Quote estimate low/base/high",
      source: "Internal estimate — never sold as hours",
    },
    {
      label: "Time tracking",
      value: "Not in place",
      source: "Figures are commitments, not actuals",
    },
  ],
  weeks: ["w/c 15 Sep", "w/c 22 Sep", "w/c 29 Sep", "w/c 6 Oct"],
  commitments: [
    {
      label: "Northline — milestone 2/3",
      hours: { low: 12, base: 16, high: 22 },
      weeks: [true, true, true, false],
    },
    {
      label: "Westbridge — milestone 3 review fixes",
      hours: { low: 3, base: 5, high: 8 },
      weeks: [true, true, false, false],
    },
    {
      label: "Cedar — VAT line restoration (warranty)",
      hours: { low: 2, base: 3, high: 4 },
      weeks: [true, false, false, false],
    },
    {
      label: "Orbit — handover items 4–9",
      hours: { low: 4, base: 6, high: 9 },
      weeks: [true, true, false, false],
    },
    {
      label: "Fieldstone — incident and covered maintenance",
      hours: { low: 2, base: 4, high: 8 },
      weeks: [true, true, true, true],
    },
    {
      label: "Atlas — discovery",
      hours: { low: 2, base: 3, high: 4 },
      weeks: [true, true, false, false],
    },
  ],
};

export function capacityWeek(weekIndex: number): {
  low: number;
  base: number;
  high: number;
  available: number;
} {
  const available = Math.round(24 * 0.8);
  return CAPACITY.commitments
    .filter((c) => c.weeks[weekIndex])
    .reduce(
      (acc, c) => ({
        ...acc,
        low: acc.low + c.hours.low,
        base: acc.base + c.hours.base,
        high: acc.high + c.hours.high,
      }),
      { low: 0, base: 0, high: 0, available }
    );
}

/* ────────────────────────────────────────────────────────────────────────────
 * §5.8 / §11 Automations
 * ──────────────────────────────────────────────────────────────────────────── */

export type AutomationMode = "Draft" | "Sandbox" | "Enabled" | "Paused";

export type Automation = {
  id: string;
  trigger: string;
  conditions: string;
  action: string;
  owner: string;
  approval: string;
  mode: AutomationMode;
  lastRun?: { at: string; outcome: "ok" | "failed" | "skipped" };
  failureState?: string;
  /** True when the action reaches a client or a provider (email, collection, document). */
  outbound: boolean;
  highImpact?: boolean;
};

export const AUTOMATIONS: Automation[] = [
  {
    id: "auto-enquiry",
    trigger: "Enquiry received",
    conditions: "Source form or inbox; not from a test fixture",
    action: "Create/update opportunity, assign owner and next action",
    owner: "Louis",
    approval: "Review uncertain duplicate matches; no contract created",
    mode: "Sandbox",
    lastRun: { at: "17 Sep 09:14", outcome: "ok" },
    outbound: false,
  },
  {
    id: "auto-discovery",
    trigger: "Discovery required",
    conditions: "Estimate confidence low or scope unclear",
    action: "Prepare discovery checklist/quote draft",
    owner: "Louis",
    approval: "Staff approval before issuing or charging",
    mode: "Draft",
    outbound: false,
  },
  {
    id: "auto-quote-ready",
    trigger: "Quote internally approved",
    conditions: "All commercial checks pass; approver recorded",
    action: "Make it ready to issue",
    owner: "Louis",
    approval: "Human issue action initially; no autonomous acceptance",
    mode: "Draft",
    outbound: false,
  },
  {
    id: "auto-accepted",
    trigger: "Agreement accepted",
    conditions: "Exact accepted version hash matches",
    action: "Create linked onboarding tasks and approved invoice work",
    owner: "Louis",
    approval: "Configured payment schedule; retry-safe",
    mode: "Draft",
    outbound: true,
    highImpact: true,
  },
  {
    id: "auto-initial-payment",
    trigger: "Initial payment confirmed",
    conditions: "Provider/accounting evidence — not return URL alone",
    action: "Update financial gate and next action",
    owner: "Finance (Louis)",
    approval: "Evidence check",
    mode: "Draft",
    outbound: false,
  },
  {
    id: "auto-assets",
    trigger: "Assets/access incomplete",
    conditions: "Approved cadence; no reminder in last 5 business days",
    action: "Queue reminder and surface blocker",
    owner: "Louis",
    approval: "Approved template; pause on dispute",
    mode: "Paused",
    lastRun: { at: "12 Sep 10:00", outcome: "skipped" },
    failureState:
      "Paused 12 Sep — Cedar dispute open; reminders must not resume automatically",
    outbound: true,
  },
  {
    id: "auto-build-accepted",
    trigger: "Build accepted",
    conditions: "Explicit acceptance recorded with evidence",
    action: "Open later service-choice/handover checklist",
    owner: "Louis",
    approval: "Do not start billing automatically",
    mode: "Draft",
    outbound: false,
  },
  {
    id: "auto-managed-date",
    trigger: "Managed date approaching",
    conditions: "Contractual start within 14 days",
    action: "Check price acceptance/mandate/notice; create owned exception",
    owner: "Finance (Louis)",
    approval: "No guessed plan or date",
    mode: "Sandbox",
    lastRun: { at: "15 Sep 07:00", outcome: "ok" },
    outbound: false,
  },
  {
    id: "auto-activation",
    trigger: "All activation gates pass",
    conditions: "Acceptance, mandate, notice period, finance approval",
    action: "Schedule approved collection through durable worker",
    owner: "Finance (Louis)",
    approval: "Finance activation permission/policy; sandbox then pilot",
    mode: "Draft",
    outbound: true,
    highImpact: true,
  },
  {
    id: "auto-payment-event",
    trigger: "Payment event received",
    conditions: "Signature valid; event not seen; account/environment match",
    action: "Update provider state and queue accounting allocation",
    owner: "Finance (Louis)",
    approval: "Signature, event dedupe, account/environment checks",
    mode: "Sandbox",
    lastRun: { at: "16 Sep 23:41", outcome: "ok" },
    outbound: false,
  },
  {
    id: "auto-collection-fails",
    trigger: "Collection fails",
    conditions: "Provider failure event",
    action: "Create finance exception and approved reminder/retry proposal",
    owner: "Finance (Louis)",
    approval: "Follow accepted retry policy; no automatic service deletion",
    mode: "Sandbox",
    lastRun: { at: "3 Sep 06:10", outcome: "ok" },
    outbound: false,
  },
  {
    id: "auto-request",
    trigger: "Request submitted",
    conditions: "Portal or email request",
    action: "Suggest RUN/GROW classification and owner",
    owner: "Louis",
    approval: "Human review where scope/coverage is uncertain",
    mode: "Enabled",
    lastRun: { at: "17 Sep 08:30", outcome: "ok" },
    outbound: false,
  },
  {
    id: "auto-grow-accepted",
    trigger: "Grow scope accepted",
    conditions: "Version match; offer not withdrawn",
    action: "Release approved work/payment-gate workflow",
    owner: "Louis",
    approval: "No work against a withdrawn offer",
    mode: "Draft",
    outbound: false,
  },
  {
    id: "auto-usage",
    trigger: "Usage materially increases",
    conditions: "Above agreed schedule for two periods",
    action: "Create cost review and notice draft",
    owner: "Finance (Louis)",
    approval: "No silent repricing or collection",
    mode: "Draft",
    outbound: false,
  },
  {
    id: "auto-handover",
    trigger: "Handover completed",
    conditions: "All §8.5 items evidenced",
    action: "Start agreed access/retention closeout tasks",
    owner: "Louis",
    approval: "Evidence, approval and fee disposition required",
    mode: "Draft",
    outbound: false,
  },
  {
    id: "auto-sync-fails",
    trigger: "Integration sync fails",
    conditions: "Accounting or provider call fails",
    action: "Persist retry, backoff and eventually owned exception",
    owner: "Finance (Louis)",
    approval: "Retry the failed operation only; never re-collect accidentally",
    mode: "Sandbox",
    lastRun: { at: "17 Sep 06:02", outcome: "failed" },
    failureState:
      "Westbridge Xero invoice create — 3 attempts, next backoff 12:00; escalated to exception",
    outbound: false,
  },
];

export const automationById = (id: string): Automation | undefined =>
  AUTOMATIONS.find((a) => a.id === id);

export type DryRunStep = {
  step: string;
  would: string;
  guard: string;
  effect: "none (dry run)";
};

/**
 * A dry run evaluates guards and lists what the automation WOULD do. It never
 * performs an outbound operation; every step reports "none (dry run)".
 */
export function dryRun(a: Automation): {
  automation: Automation;
  steps: DryRunStep[];
  verdict: string;
} {
  const steps: DryRunStep[] = [
    {
      step: "Match trigger",
      would: `Evaluate "${a.trigger}" against fixture events`,
      guard: a.conditions,
      effect: "none (dry run)",
    },
    {
      step: "Check approval policy",
      would: `Require: ${a.approval}`,
      guard: a.highImpact
        ? "High-impact: narrow permission and explicit policy required"
        : "Standard staff approval",
      effect: "none (dry run)",
    },
    {
      step: "Propose action",
      would: a.action,
      guard: a.outbound
        ? "Outbound — blocked by global pause when active; approved template only"
        : "Internal state only",
      effect: "none (dry run)",
    },
    {
      step: "Record evidence",
      would: "Write audit row with proposed change and evidence for human review",
      guard: "Audit is mandatory; secrets never logged",
      effect: "none (dry run)",
    },
  ];
  const verdict =
    a.mode === "Enabled"
      ? "Would run — no outbound effect in this dry run"
      : a.mode === "Paused"
        ? "Would NOT run — automation is paused"
        : `Would NOT run — mode is ${a.mode}; enable only after reviewing this preview`;
  return { automation: a, steps, verdict };
}

export const GLOBAL_PAUSE = {
  active: false,
  label: "Pause new outbound operations",
  scope:
    "Stops NEW outbound operations from this system: emails, document issues, new collection requests and new provider calls.",
  unaffected:
    "Already-scheduled provider collections are unaffected and need separate handling with the provider. A local pause is not a promise that provider payments have stopped.",
  preserved: "Inbound event capture and audit evidence continue while paused.",
};

export type ApprovalRow = {
  id: string;
  what: string;
  clientId: string;
  client: string;
  requestedBy: string;
  requires: string;
  impact: "high" | "standard";
  state: "pending" | "approved" | "rejected";
};

export const APPROVALS: ApprovalRow[] = [
  {
    id: "apr-harbour-activation",
    what: "Activate Managed Pro collection from 1 Oct",
    clientId: "harbour",
    client: clientName("harbour"),
    requestedBy: "auto-activation (dry run)",
    requires: "Finance activation permission",
    impact: "high",
    state: "pending",
  },
  {
    id: "apr-fieldstone-retry",
    what: "Retry failed collection under accepted retry policy",
    clientId: "fieldstone",
    client: clientName("fieldstone"),
    requestedBy: "auto-collection-fails",
    requires: "Finance approval; client reminder template",
    impact: "high",
    state: "pending",
  },
  {
    id: "apr-northline-quote",
    what: "Approve quote v2 to issue",
    clientId: "northline",
    client: clientName("northline"),
    requestedBy: "Louis",
    requires: "Second staff review — one check fails",
    impact: "standard",
    state: "pending",
  },
  {
    id: "apr-cedar-reminder",
    what: "Resume asset reminders after dispute",
    clientId: "cedar",
    client: clientName("cedar"),
    requestedBy: "auto-assets",
    requires: "Owner decision",
    impact: "standard",
    state: "pending",
  },
];

export type RunRow = {
  id: string;
  automationId: string;
  at: string;
  subject: string;
  outcome: "ok" | "failed" | "skipped" | "dry run";
  detail: string;
};

export const RUN_HISTORY: RunRow[] = [
  {
    id: "run-1",
    automationId: "auto-enquiry",
    at: "17 Sep 09:14",
    subject: "Kestrel Dental Group",
    outcome: "ok",
    detail: "Opportunity created; domain match flagged for review; owner Unassigned",
  },
  {
    id: "run-2",
    automationId: "auto-request",
    at: "17 Sep 08:30",
    subject: "Cedar — wq-cedar-09",
    outcome: "ok",
    detail: "Suggested SUPPORT · Coverage needs review; awaiting human review",
  },
  {
    id: "run-3",
    automationId: "auto-sync-fails",
    at: "17 Sep 06:02",
    subject: "Westbridge — INV-FX-0233",
    outcome: "failed",
    detail: "Xero create returned 503; attempt 3 of 3; exception opened",
  },
  {
    id: "run-4",
    automationId: "auto-payment-event",
    at: "16 Sep 23:41",
    subject: "Morrow — provider payment",
    outcome: "ok",
    detail: "Signature valid; duplicate event ignored; allocation queued",
  },
  {
    id: "run-5",
    automationId: "auto-managed-date",
    at: "15 Sep 07:00",
    subject: "Cedar — start 22 Sep",
    outcome: "ok",
    detail: "No accepted package — owned exception created, no plan guessed",
  },
  {
    id: "run-6",
    automationId: "auto-assets",
    at: "12 Sep 10:00",
    subject: "Cedar",
    outcome: "skipped",
    detail: "Dispute open — reminder suppressed; automation paused",
  },
  {
    id: "run-7",
    automationId: "auto-activation",
    at: "12 Sep 09:05",
    subject: "Harbour",
    outcome: "dry run",
    detail:
      "All gates pass except internal approval — approval requested; nothing scheduled",
  },
];

export type ExceptionRow = {
  id: string;
  kind: string;
  clientId: string;
  client: string;
  owner: string;
  attempts: string;
  safeRetry: string;
  state: "open" | "resolved";
};

export const EXCEPTIONS: ExceptionRow[] = [
  {
    id: "exc-westbridge-xero",
    kind: "Accounting sync failed",
    clientId: "westbridge",
    client: clientName("westbridge"),
    owner: "Finance (Louis)",
    attempts: "3 attempts, last 06:02",
    safeRetry: "Retry Xero invoice create only — no charge, no email",
    state: "open",
  },
  {
    id: "exc-fieldstone-collection",
    kind: "Collection failed",
    clientId: "fieldstone",
    client: clientName("fieldstone"),
    owner: "Finance (Louis)",
    attempts: "1 attempt, 3 Sep",
    safeRetry:
      "Retry proposal awaiting approval — states the amount and date before anything is scheduled",
    state: "open",
  },
  {
    id: "exc-cedar-date",
    kind: "Managed date without accepted package",
    clientId: "cedar",
    client: clientName("cedar"),
    owner: "Finance (Louis)",
    attempts: "—",
    safeRetry: "No retry — needs accepted amendment or approved interim arrangement",
    state: "open",
  },
  {
    id: "exc-westbridge-payout",
    kind: "Unmatched payout",
    clientId: "westbridge",
    client: clientName("westbridge"),
    owner: "Finance (Louis)",
    attempts: "—",
    safeRetry:
      "Match manually with bank evidence; suggested matches explain their evidence",
    state: "open",
  },
  {
    id: "exc-kestrel-dupe",
    kind: "Duplicate match uncertain",
    clientId: "kestrel",
    client: "Kestrel Dental Group",
    owner: "Unassigned",
    attempts: "—",
    safeRetry: "Human review of the domain match before conversion",
    state: "open",
  },
];

/* ────────────────────────────────────────────────────────────────────────────
 * §5.9 Settings
 * ──────────────────────────────────────────────────────────────────────────── */

export type SettingField = {
  label: string;
  value: string;
  kind: "value" | "secret reference" | "versioned";
};

export type SettingsSection = {
  id: string;
  title: string;
  summary: string;
  readPermission: string;
  changePermission: string;
  version: { id: string; effectiveFrom: string; status: "published" | "draft" };
  pendingChange?: {
    id: string;
    effectiveFrom: string;
    impactPreview: string;
    approvedBy?: string;
  };
  fields: SettingField[];
};

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: "company",
    title: "Company and legal details",
    summary:
      "Legal entity, registered address, VAT status and signatory used on documents.",
    readPermission: "Any staff",
    changePermission: "Owner",
    version: { id: "company-v3", effectiveFrom: "1 Apr 2026", status: "published" },
    fields: [
      { label: "Legal entity", value: "Nullshift Ltd (fixture)", kind: "versioned" },
      {
        label: "VAT registration",
        value: "Pending decision — affects handover fee tax basis",
        kind: "versioned",
      },
      { label: "Default signatory", value: "Louis", kind: "value" },
    ],
  },
  {
    id: "roles",
    title: "Staff roles",
    summary:
      "Capabilities are separate from membership: reading does not imply changing.",
    readPermission: "Any staff",
    changePermission: "Owner",
    version: { id: "roles-v1", effectiveFrom: "17 Sep 2026", status: "draft" },
    fields: [
      {
        label: "Owner",
        value:
          "All capabilities including pricing, tax mapping, provider accounts, templates, activation",
        kind: "versioned",
      },
      {
        label: "Staff",
        value:
          "Read everything; draft quotes and work items; cannot approve prices or activate billing",
        kind: "versioned",
      },
      {
        label: "Finance",
        value: "Approve activation, retries and allocations; cannot edit templates",
        kind: "versioned",
      },
      {
        label: "Note",
        value:
          "Today's production role model is binary staff (Phase 0 §3). This section is a proposal.",
        kind: "value",
      },
    ],
  },
  {
    id: "catalogue",
    title: "Commercial catalogue",
    summary:
      "Draft/sandbox catalogue with version id, effective date and published state.",
    readPermission: "Any staff",
    changePermission: "Owner (pricing change)",
    version: {
      id: CATALOGUE_VERSION.id,
      effectiveFrom: CATALOGUE_VERSION.effectiveFrom,
      status: "draft",
    },
    pendingChange: {
      id: "catalogue-2026-10-draft",
      effectiveFrom: "Not set",
      impactPreview:
        "New assessments only; existing accepted agreements resolve from their immutable snapshots — 0 subscriptions affected",
    },
    fields: [
      {
        label: "Items",
        value: `${CATALOGUE.length} draft items · none chargeable`,
        kind: "versioned",
      },
      {
        label: "Handover fee",
        value: "£600 confirmed decision · tax basis pending",
        kind: "versioned",
      },
    ],
  },
  {
    id: "estimator",
    title: "Estimator assumptions",
    summary: "Loaded rates, margin floor and contingency used by Quote Studio.",
    readPermission: "Any staff",
    changePermission: "Owner (pricing change)",
    version: {
      id: "estimator-policy-draft-1",
      effectiveFrom: "Not effective — placeholder constants",
      status: "draft",
    },
    fields: [
      {
        label: "Minimum margin",
        value: "40% (placeholder, decision register 18.2)",
        kind: "versioned",
      },
      { label: "Target margin", value: "50% (placeholder)", kind: "versioned" },
      { label: "Contingency", value: "12% (placeholder)", kind: "versioned" },
    ],
  },
  {
    id: "templates",
    title: "Document templates",
    summary:
      "Order Form, service schedule, scope schedule and handover schedule templates.",
    readPermission: "Any staff",
    changePermission: "Owner (template change) + legal review",
    version: { id: "templates-v2", effectiveFrom: "1 Aug 2026", status: "published" },
    pendingChange: {
      id: "templates-v3-draft",
      effectiveFrom: "Not set",
      impactPreview:
        "Affects newly issued documents only; issued documents keep their template version",
    },
    fields: [
      { label: "Order Form", value: "v2 (published)", kind: "versioned" },
      {
        label: "Managed service schedule",
        value: "v1 (published) — 'tier pending' wording under review",
        kind: "versioned",
      },
      {
        label: "Independent handover schedule",
        value: "v1 (published)",
        kind: "versioned",
      },
    ],
  },
  {
    id: "approvals",
    title: "Approval policies",
    summary:
      "Who approves prices, exceptions, activation and retries; second-person gates.",
    readPermission: "Any staff",
    changePermission: "Owner",
    version: { id: "approval-policy-v1", effectiveFrom: "17 Sep 2026", status: "draft" },
    fields: [
      {
        label: "Quote issue",
        value: "Drafter cannot approve own price; second staff review",
        kind: "versioned",
      },
      {
        label: "Billing activation",
        value: "Finance permission; sandbox then pilot",
        kind: "versioned",
      },
      {
        label: "Collection retry",
        value: "Finance approval; proposal states amount and date",
        kind: "versioned",
      },
    ],
  },
  {
    id: "integrations",
    title: "Integrations",
    summary:
      "Provider accounts, environments and webhook endpoints. Secrets are referenced by name only.",
    readPermission: "Any staff (names and status only)",
    changePermission: "Owner (provider accounts)",
    version: { id: "integrations-v4", effectiveFrom: "2 Sep 2026", status: "published" },
    fields: [
      {
        label: "Accounting",
        value: "Configured · token stored as environment secret (name only shown)",
        kind: "secret reference",
      },
      {
        label: "Direct Debit provider",
        value: "Not configured in production (Phase 0 §11)",
        kind: "secret reference",
      },
      {
        label: "Card payments",
        value: "Configured · live/test environment marker required on every operation",
        kind: "secret reference",
      },
      {
        label: "Webhook signing",
        value: "Stored as environment secret — never displayed",
        kind: "secret reference",
      },
    ],
  },
  {
    id: "notifications",
    title: "Notification templates",
    summary:
      "Approved outbound templates with environment controls; fixtures never email real clients.",
    readPermission: "Any staff",
    changePermission: "Owner (template change)",
    version: { id: "notify-v3", effectiveFrom: "1 Aug 2026", status: "published" },
    fields: [
      {
        label: "Asset reminder",
        value: "Approved · cadence 5 business days · paused on dispute",
        kind: "versioned",
      },
      {
        label: "Collection failure notice",
        value: "Approved · sent only with an approved retry proposal",
        kind: "versioned",
      },
      {
        label: "Test environment",
        value: "All sends routed to a sink address",
        kind: "value",
      },
    ],
  },
  {
    id: "retention",
    title: "Data retention",
    summary: "Retention periods and closeout tasks after handover or offboarding.",
    readPermission: "Any staff",
    changePermission: "Owner + legal review",
    version: { id: "retention-v1", effectiveFrom: "1 Apr 2026", status: "published" },
    fields: [
      {
        label: "Client records after handover",
        value: "Authorised records only; access revoked after transfer gates",
        kind: "versioned",
      },
      {
        label: "Audit log",
        value: "Retained; never exported with secrets",
        kind: "versioned",
      },
    ],
  },
  {
    id: "audit",
    title: "Audit and export",
    summary:
      "Every mutation writes an audit row with actor, reason and evidence; exports exclude secrets.",
    readPermission: "Any staff",
    changePermission: "Not editable — append-only",
    version: { id: "audit-v1", effectiveFrom: "Always", status: "published" },
    fields: [
      {
        label: "Export",
        value:
          "CSV of audit rows for a date range — secrets and tokens are never included",
        kind: "value",
      },
      {
        label: "Client readability",
        value:
          "Today's audit_log is readable by tenant members (Phase 0 §3) — to be restricted",
        kind: "value",
      },
    ],
  },
  {
    id: "legacy",
    title: "Advanced legacy tools",
    summary:
      "Read-only view of the legacy admin flows for the three protected legacy clients.",
    readPermission: "Owner",
    changePermission: "Not available — legacy records are protected",
    version: { id: "legacy-v1", effectiveFrom: "Always", status: "published" },
    fields: [
      {
        label: "Legacy clients",
        value: "Protected; existing rows and flows unchanged",
        kind: "value",
      },
      {
        label: "Route",
        value: "Current admin remains reachable from the rail",
        kind: "value",
      },
    ],
  },
];

export const settingsSectionById = (id: string): SettingsSection | undefined =>
  SETTINGS_SECTIONS.find((s) => s.id === id);

export type SettingsVersionRow = {
  at: string;
  section: string;
  change: string;
  effectiveFrom: string;
  by: string;
  approvedBy: string;
};

export const SETTINGS_HISTORY: SettingsVersionRow[] = [
  {
    at: "17 Sep 2026",
    section: "Commercial catalogue",
    change: "Sandbox catalogue seeded from brief §6.5 (draft, non-chargeable)",
    effectiveFrom: "Not effective",
    by: "Louis",
    approvedBy: "—",
  },
  {
    at: "2 Sep 2026",
    section: "Integrations",
    change: "Accounting connection re-authorised",
    effectiveFrom: "2 Sep 2026",
    by: "Louis",
    approvedBy: "Louis",
  },
  {
    at: "1 Aug 2026",
    section: "Document templates",
    change: "Order Form v2 published",
    effectiveFrom: "1 Aug 2026",
    by: "Louis",
    approvedBy: "Legal review (fixture)",
  },
  {
    at: "1 Apr 2026",
    section: "Company and legal details",
    change: "Registered address updated",
    effectiveFrom: "1 Apr 2026",
    by: "Louis",
    approvedBy: "Louis",
  },
];

export const SECRETS_NOTE =
  "Secrets never appear in ordinary forms, browser bundles, logs or exports. Integration settings show the secret's name and status only; values live in the deployment environment.";
