/**
 * Real-data loader for /admin/sales (pipeline, quotes, discovery) and
 * /admin/sales/opportunities/[id]. Service-role reads over migration 0057
 * (opportunities, quotes, quote_versions) plus `leads` rows that have not
 * been converted into an opportunity or a client tenant. Nothing here writes.
 *
 * The view-model shapes mirror lib/next/fixtures-ops.ts so the pages keep
 * their markup; every value is derived from rows. Weighted pipeline is shown
 * only when every open opportunity carries an explicit probability (§5.2).
 */
import { createServiceClient } from "@nullshift/db";
import { readProjectEnquiry } from "@/lib/projectEnquiry";
import type {
  OpportunityRow,
  QuoteRow,
  QuoteVersionRow,
  QuoteVersionStatus,
} from "@/lib/commercial/types";
import { fmtDate, num } from "./clientsData";

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

export type Money = { amountMinor: number; currency: "GBP" };
export const money = (amountMinor: number): Money => ({ amountMinor, currency: "GBP" });
export function formatMoney(m: Money): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: m.currency,
    maximumFractionDigits: m.amountMinor % 100 === 0 ? 0 : 2,
  }).format(m.amountMinor / 100);
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

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

const STAGE_LABEL: Record<string, PipelineStage> = {
  new_enquiry: "New enquiry",
  qualified: "Qualified",
  discovery: "Discovery",
  scope_ready: "Scope ready",
  quote_in_review: "Quote in review",
  sent: "Sent",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};

/** leads.status (0001 enum) → pipeline stage. */
const LEAD_STAGE: Record<string, PipelineStage> = {
  new: "New enquiry",
  qualified: "Qualified",
  call_booked: "Discovery",
  won: "Won",
  lost: "Lost",
};

export type Confidence = "low" | "medium" | "high" | "not estimated";

export type DuplicateMatch = {
  entity: string;
  kind: "legal entity" | "contact" | "domain";
  evidence: string;
  recommendation: "reuse existing record" | "review before converting" | "no match";
};

export type Opportunity = {
  id: string;
  /** "opportunity" rows come from 0057; "lead" rows from the funnel table. */
  source: "opportunity" | "lead";
  company: string;
  clientId?: string;
  opportunity: string;
  stage: PipelineStage;
  owner: string;
  nextAction: { text: string; due: string };
  confidence: Confidence;
  proposalValue?: Money;
  probabilityPct?: number;
  detail: {
    problem: string;
    outcome: string;
    stakeholders: { name: string; role: string }[];
    currentProcess: string;
    timeline: string;
    budgetSignal: string;
    systems: string[];
    dataSensitivity: "none stated" | "personal data" | "special category" | "payment data";
    discoveryNotes: string[];
    linkedQuoteIds: string[];
    activity: { at: string; text: string }[];
    decisionRationale: string;
  };
  duplicateMatches: DuplicateMatch[];
  closed?: { outcome: "won" | "lost"; at: string; reason: string };
};

export type WeightedPipeline =
  | { configured: true; total: Money }
  | { configured: false; reason: string; unweightedOpen: Money };

export function weightedPipeline(opps: Opportunity[]): WeightedPipeline {
  const open = opps.filter((o) => !o.closed);
  const unweightedOpen = money(
    open.reduce((n, o) => n + (o.proposalValue?.amountMinor ?? 0), 0)
  );
  const missing = open.filter((o) => o.probabilityPct === undefined);
  if (missing.length > 0 || open.length === 0)
    return {
      configured: false,
      reason: open.length
        ? `Stage probabilities are not configured (${missing.length} of ${open.length} open opportunities have none)`
        : "No open opportunities",
      unweightedOpen,
    };
  const total = open.reduce(
    (n, o) =>
      n + Math.round(((o.proposalValue?.amountMinor ?? 0) * (o.probabilityPct ?? 0)) / 100),
    0
  );
  return { configured: true, total: money(total) };
}

// ---------------------------------------------------------------------------
// Quotes
// ---------------------------------------------------------------------------

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

const QUOTE_STATE_LABEL: Record<QuoteVersionStatus, QuoteState> = {
  draft: "Draft",
  internal_review: "Internal review",
  approved_to_issue: "Approved to issue",
  issued: "Issued",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired",
  superseded: "Superseded",
  withdrawn: "Withdrawn",
};

export const editableInPlace = (state: QuoteState): boolean =>
  state === "Draft" || state === "Internal review" || state === "Approved to issue";

export type QuoteVersionListRow = {
  id: string;
  quoteId: string;
  opportunityId: string;
  clientId?: string;
  client: string;
  project: string;
  version: string;
  state: QuoteState;
  value?: Money;
  savedAt: string;
  studioHref: string;
  supersededBy?: string;
  note?: string;
};

// ---------------------------------------------------------------------------
// Discovery (derived: opportunities at the Discovery stage)
// ---------------------------------------------------------------------------

export type DiscoveryEngagement = {
  id: string;
  opportunityId: string;
  company: string;
  kind: "Discovery call" | "Paid discovery" | "Provisional estimate review";
  state: "proposed" | "agreed" | "in progress" | "complete";
  price: { text: string; basis: string };
  checklist: { label: string; done: boolean }[];
  owner: string;
  due: string;
};

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

type LeadRow = {
  id: string;
  name: string | null;
  email: string | null;
  vertical: string | null;
  source: string | null;
  status: string;
  notes: string | null;
  lead_score: number | null;
  quiz_answers: Record<string, unknown> | null;
  plan: { businessName?: string | null; summary?: string | null } | null;
  created_at: string;
  updated_at: string;
};

type TenantLite = { id: string; name: string; contact_email: string | null };

export type SalesData = {
  opportunities: Opportunity[];
  quotes: QuoteVersionListRow[];
  discovery: DiscoveryEngagement[];
  freshness: string;
  /** False when migration 0057 has not been applied (tables missing). */
  opportunitiesAvailable: boolean;
};

const OPPORTUNITY_COLUMNS =
  "id, tenant_id, legal_name, trading_name, contact_name, contact_email, contact_phone, stage, owner, next_action, next_action_due, probability_pct, source, decision_rationale, created_by, created_at, updated_at";
const QUOTE_COLUMNS =
  "id, opportunity_id, tenant_id, project_label, current_version_id, created_at, updated_at";
const VERSION_COLUMNS =
  "id, quote_id, version_no, status, currency, expires_at, brief, scope, estimate, commercial, internal, policy_version, formula_version, author, issued_at, accepted_at, superseded_by, created_at, updated_at";
const LEAD_COLUMNS =
  "id, name, email, vertical, source, status, notes, lead_score, quiz_answers, plan, created_at, updated_at";

const PUBLIC_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "hotmail.co.uk",
  "yahoo.com",
  "yahoo.co.uk",
  "icloud.com",
  "me.com",
  "live.com",
  "live.co.uk",
]);

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
const domainOf = (email: string | null | undefined): string | null => {
  const e = norm(email);
  const at = e.lastIndexOf("@");
  return at > 0 ? e.slice(at + 1) : null;
};

const CONFIDENCE_LABEL: Record<string, Confidence> = {
  low: "low",
  medium: "medium",
  high: "high",
};

// ---------------------------------------------------------------------------
// Derivations
// ---------------------------------------------------------------------------

function duplicateMatches(
  input: { legalName: string; email: string | null; tenantId: string | null },
  tenants: TenantLite[]
): DuplicateMatch[] {
  if (input.tenantId) {
    const t = tenants.find((x) => x.id === input.tenantId);
    return t
      ? [
          {
            entity: t.name,
            kind: "legal entity",
            evidence: "Opportunity is already linked to this client tenant",
            recommendation: "reuse existing record",
          },
        ]
      : [];
  }
  const out: DuplicateMatch[] = [];
  const name = norm(input.legalName);
  const email = norm(input.email);
  const domain = domainOf(input.email);
  for (const t of tenants) {
    if (name && norm(t.name) === name)
      out.push({
        entity: t.name,
        kind: "legal entity",
        evidence: "Tenant name matches exactly",
        recommendation: "reuse existing record",
      });
    else if (email && norm(t.contact_email) === email)
      out.push({
        entity: t.name,
        kind: "contact",
        evidence: `Contact email ${email} is this tenant's contact`,
        recommendation: "reuse existing record",
      });
    else if (domain && !PUBLIC_EMAIL_DOMAINS.has(domain) && domainOf(t.contact_email) === domain)
      out.push({
        entity: t.name,
        kind: "domain",
        evidence: `Shares the email domain ${domain}`,
        recommendation: "review before converting",
      });
  }
  return out;
}

function versionValue(v: QuoteVersionRow | undefined): Money | undefined {
  const minor = v?.commercial?.build_price_minor;
  return typeof minor === "number" && minor > 0 ? money(minor) : undefined;
}

function toOpportunity(
  row: OpportunityRow,
  quotes: QuoteRow[],
  versions: QuoteVersionRow[],
  tenants: TenantLite[]
): Opportunity {
  const myQuotes = quotes.filter((q) => q.opportunity_id === row.id);
  const quoteIds = new Set(myQuotes.map((q) => q.id));
  const myVersions = versions
    .filter((v) => quoteIds.has(v.quote_id))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  // The version the business stands behind: the current one, else the newest.
  const current =
    myVersions.find((v) => myQuotes.some((q) => q.current_version_id === v.id)) ??
    myVersions[0];
  const stage = STAGE_LABEL[row.stage] ?? "New enquiry";
  const brief = current?.brief ?? {};
  const closed =
    stage === "Won" || stage === "Lost"
      ? {
          outcome: stage === "Won" ? ("won" as const) : ("lost" as const),
          at: fmtDate(row.updated_at),
          reason: row.decision_rationale ?? "No rationale recorded",
        }
      : undefined;

  const activity: { at: string; text: string }[] = [
    { at: fmtDate(row.created_at), text: `Opportunity created${row.source ? ` · ${row.source}` : ""}` },
  ];
  for (const v of [...myVersions].reverse()) {
    const q = myQuotes.find((x) => x.id === v.quote_id);
    activity.push({
      at: fmtDate(v.created_at),
      text: `${q?.project_label ?? "Quote"} v${v.version_no} ${QUOTE_STATE_LABEL[v.status].toLowerCase()}`,
    });
    if (v.issued_at) activity.push({ at: fmtDate(v.issued_at), text: `v${v.version_no} issued` });
    if (v.accepted_at)
      activity.push({ at: fmtDate(v.accepted_at), text: `v${v.version_no} accepted` });
  }
  if (row.updated_at !== row.created_at)
    activity.push({ at: fmtDate(row.updated_at), text: `Stage ${stage.toLowerCase()}` });

  return {
    id: row.id,
    source: "opportunity",
    company: row.trading_name ? `${row.legal_name} (${row.trading_name})` : row.legal_name,
    clientId: row.tenant_id ?? undefined,
    opportunity: myQuotes[0]?.project_label ?? row.source ?? "Untitled opportunity",
    stage,
    owner: row.owner?.trim() || "Unassigned",
    nextAction: {
      text: row.next_action?.trim() || "No next action recorded",
      due: row.next_action_due ? fmtDate(row.next_action_due) : "no date",
    },
    confidence: (brief.confidence && CONFIDENCE_LABEL[brief.confidence]) || "not estimated",
    proposalValue: versionValue(current),
    probabilityPct: row.probability_pct ?? undefined,
    detail: {
      problem: (brief.outcomes ?? []).length
        ? (brief.outcomes ?? []).join("; ")
        : "No brief recorded on a quote version yet",
      outcome: (brief.outcomes ?? [])[0] ?? "Not recorded",
      stakeholders: row.contact_name
        ? [{ name: row.contact_name, role: row.contact_email ?? "contact" }]
        : [],
      currentProcess: brief.users ? `Users: ${brief.users}` : "Not recorded",
      timeline: current?.expires_at ? `Quote expires ${fmtDate(current.expires_at)}` : "Not recorded",
      budgetSignal: current?.commercial?.build_price_minor
        ? `Build price on v${current.version_no}: ${formatMoney(money(current.commercial.build_price_minor))}`
        : "Not supplied",
      systems: (current?.scope?.included ?? []).slice(0, 6),
      dataSensitivity: "none stated",
      discoveryNotes: brief.constraints ? [brief.constraints] : [],
      linkedQuoteIds: myVersions.map((v) => v.id),
      activity: activity.sort((a, b) => a.at.localeCompare(b.at)),
      decisionRationale: row.decision_rationale ?? "No rationale recorded",
    },
    duplicateMatches: duplicateMatches(
      { legalName: row.legal_name, email: row.contact_email, tenantId: row.tenant_id },
      tenants
    ),
    closed,
  };
}

function toLeadOpportunity(l: LeadRow, tenants: TenantLite[]): Opportunity {
  const enquiry = readProjectEnquiry(l.quiz_answers);
  const company = enquiry?.business || l.plan?.businessName || l.name || l.email || "Unknown";
  const stage = LEAD_STAGE[l.status] ?? "New enquiry";
  const closed =
    stage === "Won" || stage === "Lost"
      ? {
          outcome: stage === "Won" ? ("won" as const) : ("lost" as const),
          at: fmtDate(l.updated_at),
          reason: l.notes ?? "No rationale recorded",
        }
      : undefined;
  const notes: string[] = [];
  if (l.notes) notes.push(l.notes);
  if (l.plan?.summary) notes.push(l.plan.summary);
  return {
    id: `lead:${l.id}`,
    source: "lead",
    company,
    opportunity: l.vertical ? `${l.vertical} enquiry` : "Website enquiry",
    stage,
    owner: "Unassigned",
    nextAction: {
      text:
        l.status === "new"
          ? "Qualify the enquiry and open it as an opportunity"
          : l.status === "call_booked"
            ? "Hold the discovery call"
            : "Review the lead",
      due: enquiry?.preferredDate ? fmtDate(enquiry.preferredDate) : "no date",
    },
    confidence: "not estimated",
    detail: {
      problem: enquiry?.challenge || "Funnel enquiry · no brief recorded",
      outcome: "Not recorded",
      stakeholders: l.name ? [{ name: l.name, role: l.email ?? "contact" }] : [],
      currentProcess: "Not recorded",
      timeline: enquiry?.timing || (enquiry?.preferredDate ? `Preferred date ${fmtDate(enquiry.preferredDate)}` : "Not recorded"),
      budgetSignal: enquiry?.budget ? String(enquiry.budget) : "Not supplied",
      systems: [],
      dataSensitivity: "none stated",
      discoveryNotes: notes,
      linkedQuoteIds: [],
      activity: [
        {
          at: fmtDate(l.created_at),
          text: `Lead captured${l.source ? ` · ${l.source}` : ""}${
            l.lead_score !== null ? ` · score ${l.lead_score}` : ""
          }`,
        },
      ],
      decisionRationale: "Not converted to an opportunity yet",
    },
    duplicateMatches: duplicateMatches({ legalName: company, email: l.email, tenantId: null }, tenants),
    closed,
  };
}

function toDiscovery(o: Opportunity): DiscoveryEngagement {
  return {
    id: `disc-${o.id}`,
    opportunityId: o.id,
    company: o.company,
    kind: "Discovery call",
    state: "in progress",
    price: { text: "Not priced", basis: "No discovery engagement table · derived from the pipeline stage" },
    checklist: [
      { label: "Brief captured on a quote version", done: o.detail.problem !== "No brief recorded on a quote version yet" && o.source === "opportunity" },
      { label: "Owner assigned", done: o.owner !== "Unassigned" },
      { label: "Next action dated", done: o.nextAction.due !== "no date" },
      { label: "Quote version started", done: o.detail.linkedQuoteIds.length > 0 },
    ],
    owner: o.owner,
    due: o.nextAction.due,
  };
}

// ---------------------------------------------------------------------------
// Loaders
// ---------------------------------------------------------------------------

async function readTables(service: ReturnType<typeof createServiceClient>) {
  const [oppRes, quoteRes, versionRes, leadRes, tenantRes] = await Promise.all([
    service
      .from("opportunities")
      .select(OPPORTUNITY_COLUMNS)
      .order("updated_at", { ascending: false })
      .limit(100),
    service.from("quotes").select(QUOTE_COLUMNS).order("updated_at", { ascending: false }).limit(200),
    service
      .from("quote_versions")
      .select(VERSION_COLUMNS)
      .order("updated_at", { ascending: false })
      .limit(500),
    service.from("leads").select(LEAD_COLUMNS).order("created_at", { ascending: false }).limit(100),
    service.from("tenants").select("id, name, contact_email").eq("type", "client"),
  ]);
  return {
    opportunitiesAvailable: !oppRes.error,
    opportunities: (oppRes.data ?? []) as OpportunityRow[],
    quotes: (quoteRes.data ?? []) as QuoteRow[],
    versions: (versionRes.data ?? []) as QuoteVersionRow[],
    leads: (leadRes.data ?? []) as LeadRow[],
    tenants: (tenantRes.data ?? []) as TenantLite[],
  };
}

export async function loadSales(): Promise<SalesData> {
  const service = createServiceClient();
  const t = await readTables(service);
  const now = new Date();

  const opps = t.opportunities.map((row) => toOpportunity(row, t.quotes, t.versions, t.tenants));

  // Leads that have not been converted: no opportunity or client tenant with
  // the same contact email. Emailless leads cannot have been converted.
  const converted = new Set<string>();
  for (const o of t.opportunities) if (o.contact_email) converted.add(norm(o.contact_email));
  for (const x of t.tenants) if (x.contact_email) converted.add(norm(x.contact_email));
  const leadOpps = t.leads
    .filter((l) => !l.email || !converted.has(norm(l.email)))
    .map((l) => toLeadOpportunity(l, t.tenants));

  const opportunities = [...opps, ...leadOpps].slice(0, 100);

  const quoteById = new Map(t.quotes.map((q) => [q.id, q]));
  const oppById = new Map(t.opportunities.map((o) => [o.id, o]));
  const tenantName = new Map(t.tenants.map((x) => [x.id, x.name]));
  const quotes: QuoteVersionListRow[] = t.versions
    .map((v) => {
      const q = quoteById.get(v.quote_id);
      const o = q ? oppById.get(q.opportunity_id) : undefined;
      const clientId = q?.tenant_id ?? o?.tenant_id ?? undefined;
      return {
        id: v.id,
        quoteId: v.quote_id,
        opportunityId: q?.opportunity_id ?? "",
        clientId,
        client: (clientId && tenantName.get(clientId)) || o?.legal_name || "Unknown",
        project: q?.project_label ?? "Quote",
        version: `v${v.version_no}`,
        state: QUOTE_STATE_LABEL[v.status] ?? "Draft",
        value: versionValue(v),
        savedAt: fmtDate(v.updated_at),
        studioHref: `/admin/quotes/${v.id}`,
        supersededBy: v.superseded_by ? `→ ${v.superseded_by.slice(0, 8)}` : undefined,
        note: v.policy_version ? `policy ${v.policy_version}` : undefined,
      };
    })
    .slice(0, 100);

  const discovery = opportunities.filter((o) => o.stage === "Discovery").map(toDiscovery);

  return {
    opportunities,
    quotes,
    discovery,
    opportunitiesAvailable: t.opportunitiesAvailable,
    freshness: `Database read ${new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/London",
    }).format(now)}${t.opportunitiesAvailable ? "" : " · opportunities table not available (0057 not applied)"}`,
  };
}

/** One opportunity (a 0057 row or a `lead:<id>` funnel row) with its quotes. */
export async function loadOpportunity(
  id: string
): Promise<{ opportunity: Opportunity; quotes: QuoteVersionListRow[] } | null> {
  const sales = await loadSales();
  const opportunity = sales.opportunities.find((o) => o.id === id);
  if (!opportunity) return null;
  const linked = new Set(opportunity.detail.linkedQuoteIds);
  return { opportunity, quotes: sales.quotes.filter((q) => linked.has(q.id)) };
}
