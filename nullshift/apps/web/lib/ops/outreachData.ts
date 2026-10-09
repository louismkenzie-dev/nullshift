/**
 * Real-data loader for /admin/outreach (partner-agency pipeline) and
 * /admin/outreach/[id]. Service-role reads over migration 0068
 * (partner_prospects, partner_touches). Nothing here writes; the server
 * actions in app/admin/(dashboard)/outreach/actions.ts do that through the
 * RLS client.
 *
 * Modelled on salesData.ts: rows → view models with every value derived.
 */
import { createServiceClient } from "@nullshift/db";
import { fmtDate } from "./clientsData";
import {
  AGENCY_TYPE_LABEL,
  CLOSED_STATUSES,
  OPEN_STATUSES,
  OUTREACH_SEQUENCE,
  PROSPECT_STATUSES,
  STATUS_LABEL,
  isAgencyType,
  isApplicationStatus,
  isProspectStatus,
  planNextTouch,
  sequencePosition,
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABEL,
  MODEL_INTEREST_LABEL,
  applicationTag,
  type AgencyType,
  type ApplicationStatus,
  type ProspectStatus,
  type TouchChannel,
  type TouchDirection,
} from "./outreachSequence";

export * from "./outreachSequence";

// ---------------------------------------------------------------------------
// Rows (as stored)
// ---------------------------------------------------------------------------

export type ProspectRow = {
  id: string;
  company: string;
  website: string | null;
  country: string | null;
  region: string | null;
  agency_type: string | null;
  staff_band: string | null;
  contact_name: string | null;
  contact_role: string | null;
  email: string | null;
  linkedin_url: string | null;
  instagram_handle: string | null;
  phone: string | null;
  source: string | null;
  fit_notes: string | null;
  verified_at: string | null;
  verified_by: string | null;
  status: string;
  next_touch_at: string | null;
  parked_until: string | null;
  owner: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
};

export type TouchRow = {
  id: string;
  prospect_id: string;
  channel: string;
  direction: string;
  subject: string | null;
  body: string | null;
  sent_at: string;
  outcome: string | null;
  created_by: string | null;
  created_at: string;
};

export const PROSPECT_COLUMNS =
  "id, company, website, country, region, agency_type, staff_band, contact_name, contact_role, email, linkedin_url, instagram_handle, phone, source, fit_notes, verified_at, verified_by, status, next_touch_at, parked_until, owner, tags, created_at, updated_at";
export const TOUCH_COLUMNS =
  "id, prospect_id, channel, direction, subject, body, sent_at, outcome, created_by, created_at";

// ---------------------------------------------------------------------------
// View models
// ---------------------------------------------------------------------------

export type Touch = {
  id: string;
  channel: TouchChannel;
  direction: TouchDirection;
  subject: string | null;
  body: string | null;
  sentAt: string;
  sentAtIso: string;
  outcome: string | null;
  createdBy: string | null;
};

export type Prospect = {
  id: string;
  company: string;
  website: string | null;
  country: string | null;
  region: string | null;
  agencyType: AgencyType | null;
  agencyTypeLabel: string;
  staffBand: string | null;
  contactName: string | null;
  contactRole: string | null;
  email: string | null;
  linkedinUrl: string | null;
  instagramHandle: string | null;
  phone: string | null;
  source: string | null;
  fitNotes: string | null;
  verifiedAt: string | null;
  verifiedBy: string | null;
  status: ProspectStatus;
  statusLabel: string;
  open: boolean;
  closed: boolean;
  nextTouchAt: string | null;
  nextTouchIso: string | null;
  /** True when next_touch_at <= now and the prospect is still open. */
  due: boolean;
  overdueDays: number;
  parkedUntil: string | null;
  owner: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  updatedAtIso: string;
  /** Outbound message touches sent (email / linkedin / instagram). */
  outboundCount: number;
  firstOutboundAt: string | null;
  sequence: string;
  /** The suggested next step from the sequence, if the prospect is still cold. */
  nextStep: { label: string; channel: TouchChannel; day: number } | null;
  lastTouch: Touch | null;
  touches: Touch[];
};

export type PipelineCounts = Record<ProspectStatus, number>;

export type OutreachData = {
  prospects: Prospect[];
  dueToday: Prospect[];
  counts: PipelineCounts;
  open: number;
  freshness: string;
  /** False when migration 0068 has not been applied (tables missing). */
  available: boolean;
};

// ---------------------------------------------------------------------------
// Derivations
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

const MESSAGE_CHANNELS: readonly string[] = ["email", "linkedin", "instagram"];

function toTouch(t: TouchRow): Touch {
  return {
    id: t.id,
    channel: (t.channel as TouchChannel) ?? "note",
    direction: (t.direction as TouchDirection) ?? "outbound",
    subject: t.subject,
    body: t.body,
    sentAt: fmtDate(t.sent_at),
    sentAtIso: t.sent_at,
    outcome: t.outcome,
    createdBy: t.created_by,
  };
}

export function toProspect(row: ProspectRow, touchRows: TouchRow[], now: Date): Prospect {
  const touches = touchRows
    .filter((t) => t.prospect_id === row.id)
    .sort((a, b) => b.sent_at.localeCompare(a.sent_at))
    .map(toTouch);
  const outbound = touches.filter(
    (t) => t.direction === "outbound" && MESSAGE_CHANNELS.includes(t.channel)
  );
  const outboundCount = outbound.length;
  const firstOutbound = outbound.length ? outbound[outbound.length - 1] : null;
  const status: ProspectStatus = isProspectStatus(row.status) ? row.status : "sourced";
  const open = OPEN_STATUSES.includes(status);
  const closed = CLOSED_STATUSES.includes(status);
  const nextMs = row.next_touch_at ? new Date(row.next_touch_at).getTime() : null;
  const due = open && nextMs !== null && nextMs <= now.getTime();
  const overdueDays =
    due && nextMs !== null ? Math.floor((now.getTime() - nextMs) / DAY_MS) : 0;
  const agencyType = isAgencyType(row.agency_type) ? row.agency_type : null;

  let nextStep: Prospect["nextStep"] = null;
  if (open && status !== "replied" && status !== "call_booked") {
    const plan = planNextTouch({
      outboundCount,
      firstOutboundAt: firstOutbound ? new Date(firstOutbound.sentAtIso) : null,
      now,
    });
    if (plan.kind === "touch")
      nextStep = {
        label: plan.step.label,
        channel: plan.step.channel,
        day: plan.step.day,
      };
  }

  return {
    id: row.id,
    company: row.company,
    website: row.website,
    country: row.country,
    region: row.region,
    agencyType,
    agencyTypeLabel: agencyType ? AGENCY_TYPE_LABEL[agencyType] : "Unclassified",
    staffBand: row.staff_band,
    contactName: row.contact_name,
    contactRole: row.contact_role,
    email: row.email,
    linkedinUrl: row.linkedin_url,
    instagramHandle: row.instagram_handle,
    phone: row.phone,
    source: row.source,
    fitNotes: row.fit_notes,
    verifiedAt: row.verified_at ? fmtDate(row.verified_at) : null,
    verifiedBy: row.verified_by,
    status,
    statusLabel: STATUS_LABEL[status],
    open,
    closed,
    nextTouchAt: row.next_touch_at ? fmtDate(row.next_touch_at) : null,
    nextTouchIso: row.next_touch_at,
    due,
    overdueDays,
    parkedUntil: row.parked_until ? fmtDate(row.parked_until) : null,
    owner: row.owner?.trim() || "Unassigned",
    tags: row.tags ?? [],
    createdAt: fmtDate(row.created_at),
    updatedAt: fmtDate(row.updated_at),
    updatedAtIso: row.updated_at,
    outboundCount,
    firstOutboundAt: firstOutbound?.sentAtIso ?? null,
    sequence: sequencePosition(outboundCount),
    nextStep,
    lastTouch: touches[0] ?? null,
    touches,
  };
}

export function pipelineCounts(prospects: Prospect[]): PipelineCounts {
  const counts = Object.fromEntries(
    PROSPECT_STATUSES.map((s) => [s, 0])
  ) as PipelineCounts;
  for (const p of prospects) counts[p.status] += 1;
  return counts;
}

/** Open prospects whose next touch is due (<= now), most overdue first. */
export function dueToday(prospects: Prospect[]): Prospect[] {
  return prospects
    .filter((p) => p.due)
    .sort((a, b) => (a.nextTouchIso ?? "").localeCompare(b.nextTouchIso ?? ""));
}

/** Case-insensitive match on company, contact, email, country, type, tags, source. */
export function matchesSearch(p: Prospect, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const hay = [
    p.company,
    p.contactName,
    p.contactRole,
    p.email,
    p.country,
    p.region,
    p.agencyTypeLabel,
    p.agencyType,
    p.source,
    p.owner,
    p.website,
    p.instagramHandle,
    ...p.tags,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(needle);
}

export const SEQUENCE_SUMMARY = OUTREACH_SEQUENCE.map(
  (s) => `day ${s.day} ${s.channel}`
).join(" · ");

// ---------------------------------------------------------------------------
// Loaders
// ---------------------------------------------------------------------------

async function readTables(service: ReturnType<typeof createServiceClient>) {
  const [prospectRes, touchRes] = await Promise.all([
    service
      .from("partner_prospects")
      .select(PROSPECT_COLUMNS)
      .order("updated_at", { ascending: false })
      .limit(2000),
    service
      .from("partner_touches")
      .select(TOUCH_COLUMNS)
      .order("sent_at", { ascending: false })
      .limit(10000),
  ]);
  return {
    available: !prospectRes.error,
    prospects: (prospectRes.data ?? []) as ProspectRow[],
    touches: (touchRes.data ?? []) as TouchRow[],
  };
}

export async function loadOutreach(): Promise<OutreachData> {
  const service = createServiceClient();
  const t = await readTables(service);
  const now = new Date();
  const prospects = t.prospects.map((row) => toProspect(row, t.touches, now));
  const counts = pipelineCounts(prospects);
  return {
    prospects,
    dueToday: dueToday(prospects),
    counts,
    open: prospects.filter((p) => p.open).length,
    available: t.available,
    freshness: `Database read ${new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/London",
    }).format(
      now
    )}${t.available ? "" : " · partner_prospects table not available (0068 not applied)"}`,
  };
}

/** One prospect with its full touch timeline, or null. */
export async function loadProspect(id: string): Promise<Prospect | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
    return null;
  const service = createServiceClient();
  const [prospectRes, touchRes] = await Promise.all([
    service.from("partner_prospects").select(PROSPECT_COLUMNS).eq("id", id).maybeSingle(),
    service
      .from("partner_touches")
      .select(TOUCH_COLUMNS)
      .eq("prospect_id", id)
      .order("sent_at", { ascending: false })
      .limit(500),
  ]);
  if (prospectRes.error || !prospectRes.data) return null;
  return toProspect(
    prospectRes.data as ProspectRow,
    (touchRes.data ?? []) as TouchRow[],
    new Date()
  );
}

// ---------------------------------------------------------------------------
// Partner applications (migration 0069: public /partners form intake)
// ---------------------------------------------------------------------------

export type ApplicationRow = {
  id: string;
  agency_name: string;
  website: string | null;
  country: string;
  contact_name: string;
  role: string | null;
  email: string;
  agency_type: string;
  team_size: string;
  model_interest: string;
  client_types: string | null;
  message: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  reviewed_at: string | null;
};

export const APPLICATION_COLUMNS =
  "id, agency_name, website, country, contact_name, role, email, agency_type, team_size, model_interest, client_types, message, status, notes, created_at, reviewed_at";

export type Application = {
  id: string;
  agency: string;
  website: string | null;
  country: string;
  contactName: string;
  role: string | null;
  email: string;
  agencyType: string;
  agencyTypeLabel: string;
  teamSize: string;
  modelInterest: string;
  modelInterestLabel: string;
  clientTypes: string | null;
  message: string | null;
  status: ApplicationStatus;
  statusLabel: string;
  notes: string | null;
  submittedAt: string;
  submittedAtIso: string;
  reviewedAt: string | null;
  /** The prospect this application was converted into, when one is tagged. */
  prospectId: string | null;
  prospectCompany: string | null;
};

export type ApplicationsData = {
  applications: Application[];
  counts: Record<ApplicationStatus, number>;
  /** False when migration 0069 has not been applied (table missing). */
  available: boolean;
  note: string;
};

const APPLICATION_AGENCY_LABEL: Record<string, string> = {
  growth_consultancy: "Growth / business consultancy",
  marketing_seo_ppc: "Marketing, SEO or PPC",
  design_brand: "Design or brand studio",
  social: "Social media management",
  accountancy: "Accountancy / bookkeeping",
  other: "Something else",
};

type ProspectLink = { id: string; company: string; tags: string[] | null };

export function toApplication(row: ApplicationRow, links: ProspectLink[]): Application {
  const status: ApplicationStatus = isApplicationStatus(row.status) ? row.status : "new";
  const tag = applicationTag(row.id);
  const linked = links.find((p) => (p.tags ?? []).includes(tag)) ?? null;
  return {
    id: row.id,
    agency: row.agency_name,
    website: row.website,
    country: row.country,
    contactName: row.contact_name,
    role: row.role,
    email: row.email,
    agencyType: row.agency_type,
    agencyTypeLabel: APPLICATION_AGENCY_LABEL[row.agency_type] ?? row.agency_type,
    teamSize: row.team_size,
    modelInterest: row.model_interest,
    modelInterestLabel: MODEL_INTEREST_LABEL[row.model_interest] ?? row.model_interest,
    clientTypes: row.client_types,
    message: row.message,
    status,
    statusLabel: APPLICATION_STATUS_LABEL[status],
    notes: row.notes,
    submittedAt: fmtDate(row.created_at),
    submittedAtIso: row.created_at,
    reviewedAt: row.reviewed_at ? fmtDate(row.reviewed_at) : null,
    prospectId: linked?.id ?? null,
    prospectCompany: linked?.company ?? null,
  };
}

async function readProspectLinks(
  service: ReturnType<typeof createServiceClient>
): Promise<ProspectLink[]> {
  const { data } = await service
    .from("partner_prospects")
    .select("id, company, tags")
    .contains("tags", ["application"])
    .limit(2000);
  return (data ?? []) as ProspectLink[];
}

export async function loadApplications(): Promise<ApplicationsData> {
  const service = createServiceClient();
  const [appRes, links] = await Promise.all([
    service
      .from("partner_applications")
      .select(APPLICATION_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(500),
    readProspectLinks(service),
  ]);
  const available = !appRes.error;
  const applications = ((appRes.data ?? []) as ApplicationRow[]).map((r) =>
    toApplication(r, links)
  );
  const counts = Object.fromEntries(APPLICATION_STATUSES.map((st) => [st, 0])) as Record<
    ApplicationStatus,
    number
  >;
  for (const a of applications) counts[a.status] += 1;
  return {
    applications,
    counts,
    available,
    note: available ? "" : "partner_applications table not available (0069 not applied)",
  };
}

export async function loadApplication(id: string): Promise<Application | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
    return null;
  const service = createServiceClient();
  const [appRes, links] = await Promise.all([
    service
      .from("partner_applications")
      .select(APPLICATION_COLUMNS)
      .eq("id", id)
      .maybeSingle(),
    readProspectLinks(service),
  ]);
  if (appRes.error || !appRes.data) return null;
  return toApplication(appRes.data as ApplicationRow, links);
}
