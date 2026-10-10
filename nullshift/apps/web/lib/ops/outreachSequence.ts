/**
 * Pure helpers for the partner-agency outreach pipeline (migration 0068).
 * No I/O: the touch sequence, the park rule and the CSV-paste parser live
 * here so they can be unit-tested without a database. `outreachData.ts`
 * re-exports them for the pages and actions.
 */

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

export const PROSPECT_STATUSES = [
  "sourced",
  "verified",
  "queued",
  "contacted",
  "replied",
  "call_booked",
  "agreed",
  "declined",
  "parked",
  "unsubscribed",
] as const;
export type ProspectStatus = (typeof PROSPECT_STATUSES)[number];

export const AGENCY_TYPES = [
  "growth_consultant",
  "marketing_agency",
  "seo_ppc",
  "design_studio",
  "social_media",
  "accountant",
  "other",
] as const;
export type AgencyType = (typeof AGENCY_TYPES)[number];

export const TOUCH_CHANNELS = [
  "email",
  "linkedin",
  "instagram",
  "meeting",
  "note",
] as const;
export type TouchChannel = (typeof TOUCH_CHANNELS)[number];

export const TOUCH_DIRECTIONS = ["outbound", "inbound"] as const;
export type TouchDirection = (typeof TOUCH_DIRECTIONS)[number];

export const STATUS_LABEL: Record<ProspectStatus, string> = {
  sourced: "Sourced",
  verified: "Verified",
  queued: "Queued",
  contacted: "Contacted",
  replied: "Replied",
  call_booked: "Call booked",
  agreed: "Agreed",
  declined: "Declined",
  parked: "Parked",
  unsubscribed: "Unsubscribed",
};

export const AGENCY_TYPE_LABEL: Record<AgencyType, string> = {
  growth_consultant: "Growth consultant",
  marketing_agency: "Marketing agency",
  seo_ppc: "SEO / PPC",
  design_studio: "Design studio",
  social_media: "Social media",
  accountant: "Accountant",
  other: "Other",
};

export const isProspectStatus = (v: unknown): v is ProspectStatus =>
  typeof v === "string" && (PROSPECT_STATUSES as readonly string[]).includes(v);
export const isAgencyType = (v: unknown): v is AgencyType =>
  typeof v === "string" && (AGENCY_TYPES as readonly string[]).includes(v);
export const isTouchChannel = (v: unknown): v is TouchChannel =>
  typeof v === "string" && (TOUCH_CHANNELS as readonly string[]).includes(v);
export const isTouchDirection = (v: unknown): v is TouchDirection =>
  typeof v === "string" && (TOUCH_DIRECTIONS as readonly string[]).includes(v);

/** Statuses that count as "still in play" for the due queue and the board. */
export const OPEN_STATUSES: readonly ProspectStatus[] = [
  "sourced",
  "verified",
  "queued",
  "contacted",
  "replied",
  "call_booked",
];

/** Terminal statuses: no further automatic touches are scheduled. */
export const CLOSED_STATUSES: readonly ProspectStatus[] = [
  "agreed",
  "declined",
  "unsubscribed",
];

// ---------------------------------------------------------------------------
// Sequence: 4 touches over 14 days, then park for 90 days with no reply
// ---------------------------------------------------------------------------

export type SequenceStep = {
  step: number;
  day: number;
  channel: TouchChannel;
  label: string;
};

export const OUTREACH_SEQUENCE: readonly SequenceStep[] = [
  { step: 1, day: 0, channel: "email", label: "Intro email" },
  { step: 2, day: 3, channel: "linkedin", label: "LinkedIn connect + note" },
  { step: 3, day: 7, channel: "email", label: "Follow-up email" },
  { step: 4, day: 14, channel: "email", label: "Last email" },
];

export const PARK_DAYS = 90;
/** How soon we should answer an inbound reply. */
export const REPLY_FOLLOW_UP_DAYS = 1;

const DAY_MS = 24 * 60 * 60 * 1000;

export const addDays = (d: Date, days: number): Date =>
  new Date(d.getTime() + days * DAY_MS);

export type NextTouchPlan =
  | { kind: "touch"; step: SequenceStep; dueAt: Date }
  | { kind: "park"; parkedUntil: Date };

/**
 * What comes after `outboundCount` outbound touches have been sent.
 *
 * - 0 sent → step 1 is due now (or at `now`).
 * - 1..3 sent → the next step is due at (first outbound) + its day offset;
 *   if that moment has already passed it is due now.
 * - 4 sent (sequence exhausted) → park for PARK_DAYS from `now`.
 */
export function planNextTouch(input: {
  outboundCount: number;
  firstOutboundAt: Date | null;
  now: Date;
}): NextTouchPlan {
  const { outboundCount, now } = input;
  if (outboundCount >= OUTREACH_SEQUENCE.length) {
    return { kind: "park", parkedUntil: addDays(now, PARK_DAYS) };
  }
  const step = OUTREACH_SEQUENCE[Math.max(0, outboundCount)];
  const anchor = input.firstOutboundAt ?? now;
  const scheduled = addDays(anchor, step.day);
  const dueAt = scheduled.getTime() < now.getTime() ? now : scheduled;
  return { kind: "touch", step, dueAt };
}

/** The step a prospect is on (1-based) given how many outbound touches went out. */
export const sequencePosition = (outboundCount: number): string =>
  outboundCount >= OUTREACH_SEQUENCE.length
    ? `sequence complete (${OUTREACH_SEQUENCE.length}/${OUTREACH_SEQUENCE.length})`
    : `step ${outboundCount + 1} of ${OUTREACH_SEQUENCE.length}`;

/**
 * Status + schedule after a touch is logged. Pure: the caller persists the
 * result. Terminal statuses never move; an inbound touch marks a reply and
 * asks for a follow-up within a day; an outbound touch advances the sequence
 * or parks the prospect once the sequence is exhausted.
 */
export function afterTouch(input: {
  status: ProspectStatus;
  direction: TouchDirection;
  channel: TouchChannel;
  /** Outbound message touches already logged BEFORE this one. */
  priorOutboundCount: number;
  firstOutboundAt: Date | null;
  now: Date;
}): { status: ProspectStatus; nextTouchAt: Date | null; parkedUntil: Date | null } {
  const { status, direction, channel, now } = input;
  const terminal = CLOSED_STATUSES.includes(status);

  // Internal notes and meetings never move the sequence on their own; a
  // meeting is the call itself, so it is recorded as call_booked progress.
  if (channel === "note") {
    return { status, nextTouchAt: null, parkedUntil: null };
  }
  if (terminal) return { status, nextTouchAt: null, parkedUntil: null };

  if (direction === "inbound") {
    const next: ProspectStatus =
      status === "call_booked" || status === "replied" ? status : "replied";
    return {
      status: next,
      nextTouchAt: addDays(now, REPLY_FOLLOW_UP_DAYS),
      parkedUntil: null,
    };
  }

  if (channel === "meeting") {
    return {
      status: "call_booked",
      nextTouchAt: addDays(now, REPLY_FOLLOW_UP_DAYS),
      parkedUntil: null,
    };
  }

  // Outbound message: the prospect has replied or booked already, so we are
  // in a conversation rather than the cold sequence. Keep the status and ask
  // for a check-in in a few days.
  if (status === "replied" || status === "call_booked") {
    return { status, nextTouchAt: addDays(now, 3), parkedUntil: null };
  }

  const plan = planNextTouch({
    outboundCount: input.priorOutboundCount + 1,
    firstOutboundAt: input.firstOutboundAt ?? now,
    now,
  });
  if (plan.kind === "park") {
    return {
      status: "parked",
      nextTouchAt: plan.parkedUntil,
      parkedUntil: plan.parkedUntil,
    };
  }
  return { status: "contacted", nextTouchAt: plan.dueAt, parkedUntil: null };
}

// ---------------------------------------------------------------------------
// CSV paste parser
// ---------------------------------------------------------------------------

export const CSV_COLUMNS = [
  "company",
  "website",
  "country",
  "agency_type",
  "contact_name",
  "contact_role",
  "email",
  "linkedin_url",
  "instagram_handle",
  "source",
  "fit_notes",
] as const;
export type CsvColumn = (typeof CSV_COLUMNS)[number];

export type CsvProspect = Omit<Record<CsvColumn, string | null>, "company"> & {
  company: string;
  /** 1-based data row number (header is row 1), for error messages. */
  line: number;
};

export type CsvParseResult = {
  rows: CsvProspect[];
  /** Human-readable problems; a row with an error is NOT in `rows`. */
  errors: string[];
};

/** RFC-4180-ish line splitter: quoted fields, doubled quotes, commas inside quotes. */
export function splitCsvLine(line: string, delimiter = ","): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else quoted = false;
      } else cur += ch;
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const normaliseHeader = (h: string): string =>
  h
    .trim()
    .toLowerCase()
    .replace(/^﻿/, "")
    .replace(/[\s-]+/g, "_");

/** Accepts a few friendly header spellings. */
const HEADER_ALIASES: Record<string, CsvColumn> = {
  company: "company",
  agency: "company",
  name: "company",
  website: "website",
  url: "website",
  site: "website",
  country: "country",
  agency_type: "agency_type",
  type: "agency_type",
  contact_name: "contact_name",
  contact: "contact_name",
  contact_role: "contact_role",
  role: "contact_role",
  title: "contact_role",
  email: "email",
  linkedin_url: "linkedin_url",
  linkedin: "linkedin_url",
  instagram_handle: "instagram_handle",
  instagram: "instagram_handle",
  source: "source",
  fit_notes: "fit_notes",
  notes: "fit_notes",
};

const AGENCY_TYPE_ALIASES: Record<string, AgencyType> = {
  growth: "growth_consultant",
  growth_consultant: "growth_consultant",
  growth_consultancy: "growth_consultant",
  consultant: "growth_consultant",
  marketing: "marketing_agency",
  marketing_agency: "marketing_agency",
  seo: "seo_ppc",
  ppc: "seo_ppc",
  seo_ppc: "seo_ppc",
  "seo/ppc": "seo_ppc",
  design: "design_studio",
  design_studio: "design_studio",
  brand: "design_studio",
  brand_studio: "design_studio",
  social: "social_media",
  social_media: "social_media",
  accountant: "accountant",
  accountants: "accountant",
  bookkeeper: "accountant",
  accounting: "accountant",
  other: "other",
};

export function normaliseAgencyType(raw: string | null | undefined): AgencyType | null {
  if (!raw) return null;
  const key = raw
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  return AGENCY_TYPE_ALIASES[key] ?? (isAgencyType(key) ? key : null);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normaliseEmail = (raw: string | null | undefined): string | null => {
  const e = (raw ?? "").trim().toLowerCase();
  return e && EMAIL_RE.test(e) ? e : null;
};

export const normaliseHandle = (raw: string | null | undefined): string | null => {
  const h = (raw ?? "")
    .trim()
    .replace(/^@/, "")
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/\/+$/, "");
  return h || null;
};

export const normaliseWebsite = (raw: string | null | undefined): string | null => {
  const w = (raw ?? "").trim();
  if (!w) return null;
  return /^https?:\/\//i.test(w) ? w : `https://${w}`;
};

/**
 * Parse pasted CSV (comma or tab separated; first line is the header). Only
 * `company` is required. Unknown columns are ignored; known columns may be
 * in any order. Duplicate emails inside the paste keep the first row.
 */
export function parseProspectCsv(text: string): CsvParseResult {
  const errors: string[] = [];
  const rows: CsvProspect[] = [];
  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((l) => l.trim().length > 0);
  if (lines.length === 0)
    return { rows, errors: ["Nothing to import: the paste is empty."] };

  const delimiter = lines[0].includes("\t") && !lines[0].includes(",") ? "\t" : ",";
  const headers = splitCsvLine(lines[0], delimiter).map(normaliseHeader);
  const index = new Map<CsvColumn, number>();
  headers.forEach((h, i) => {
    const col = HEADER_ALIASES[h];
    if (col && !index.has(col)) index.set(col, i);
  });
  if (!index.has("company")) {
    return {
      rows,
      errors: [
        `Header row must include a "company" column. Found: ${headers.join(", ") || "(none)"}.`,
      ],
    };
  }

  const seenEmails = new Set<string>();
  for (let i = 1; i < lines.length; i++) {
    const line = i + 1;
    const cells = splitCsvLine(lines[i], delimiter);
    const get = (c: CsvColumn): string | null => {
      const at = index.get(c);
      if (at === undefined) return null;
      const v = (cells[at] ?? "").trim();
      return v.length ? v : null;
    };
    const company = get("company");
    if (!company) {
      errors.push(`Row ${line}: company is empty.`);
      continue;
    }
    const rawEmail = get("email");
    const email = normaliseEmail(rawEmail);
    if (rawEmail && !email) {
      errors.push(`Row ${line} (${company}): "${rawEmail}" is not a valid email.`);
      continue;
    }
    if (email) {
      if (seenEmails.has(email)) {
        errors.push(
          `Row ${line} (${company}): duplicate email ${email} in this paste; skipped.`
        );
        continue;
      }
      seenEmails.add(email);
    }
    const rawType = get("agency_type");
    const agencyType = normaliseAgencyType(rawType);
    if (rawType && !agencyType) {
      errors.push(
        `Row ${line} (${company}): unknown agency_type "${rawType}" (use ${AGENCY_TYPES.join(", ")}); imported as "other".`
      );
    }
    rows.push({
      line,
      company,
      website: normaliseWebsite(get("website")),
      country: get("country"),
      agency_type: rawType ? (agencyType ?? "other") : null,
      contact_name: get("contact_name"),
      contact_role: get("contact_role"),
      email,
      linkedin_url: get("linkedin_url"),
      instagram_handle: normaliseHandle(get("instagram_handle")),
      source: get("source"),
      fit_notes: get("fit_notes"),
    });
  }
  return { rows, errors };
}

// ---------------------------------------------------------------------------
// Partner applications (migration 0069) → prospects (migration 0068)
// ---------------------------------------------------------------------------

export const APPLICATION_STATUSES = [
  "new",
  "reviewing",
  "accepted",
  "declined",
  "archived",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  new: "New",
  reviewing: "Reviewing",
  accepted: "Accepted",
  declined: "Declined",
  archived: "Archived",
};

export const isApplicationStatus = (v: unknown): v is ApplicationStatus =>
  typeof v === "string" && (APPLICATION_STATUSES as readonly string[]).includes(v);

export const MODEL_INTEREST_LABEL: Record<string, string> = {
  referral: "Referral",
  white_label: "White-label",
  both: "Both / unsure",
};

/** /partners form agency_type (lib/partnerApplication.ts) → 0068 agency_type. */
const APPLICATION_AGENCY_TYPE: Record<string, AgencyType> = {
  growth_consultancy: "growth_consultant",
  marketing_seo_ppc: "marketing_agency",
  design_brand: "design_studio",
  social: "social_media",
  accountancy: "accountant",
  other: "other",
};

export const applicationAgencyType = (
  raw: string | null | undefined
): AgencyType | null =>
  raw ? (APPLICATION_AGENCY_TYPE[raw] ?? normaliseAgencyType(raw)) : null;

/** The tag that links a prospect back to the application it came from. */
export const applicationTag = (applicationId: string): string =>
  `application:${applicationId}`;

export type ApplicationSource = {
  id: string;
  agency_name: string;
  website: string | null;
  country: string | null;
  contact_name: string | null;
  role: string | null;
  email: string;
  agency_type: string | null;
  team_size: string | null;
  model_interest: string | null;
  client_types: string | null;
  message: string | null;
};

/**
 * Pure: the partner_prospects row and the inbound note touch to create when
 * an application is converted. The agency wrote to us, so the prospect starts
 * at `replied` with a follow-up due within a day; the sequence does not apply.
 */
export function applicationToProspect(
  app: ApplicationSource,
  now: Date
): {
  prospect: {
    company: string;
    website: string | null;
    country: string | null;
    agency_type: AgencyType | null;
    staff_band: string | null;
    contact_name: string | null;
    contact_role: string | null;
    email: string | null;
    source: string;
    fit_notes: string | null;
    status: ProspectStatus;
    next_touch_at: string;
    tags: string[];
  };
  touch: {
    channel: TouchChannel;
    direction: TouchDirection;
    subject: string;
    body: string;
  };
} {
  const model = app.model_interest
    ? (MODEL_INTEREST_LABEL[app.model_interest] ?? app.model_interest)
    : null;
  const notes = [
    model ? `Model interest: ${model}` : null,
    app.client_types ? `Client types: ${app.client_types}` : null,
    app.message ? `Message: ${app.message}` : null,
  ].filter((x): x is string => Boolean(x));
  const tags = [applicationTag(app.id), "application"];
  if (app.model_interest) tags.push(app.model_interest);
  return {
    prospect: {
      company: app.agency_name,
      website: normaliseWebsite(app.website),
      country: app.country,
      agency_type: applicationAgencyType(app.agency_type),
      staff_band: app.team_size,
      contact_name: app.contact_name,
      contact_role: app.role,
      email: normaliseEmail(app.email),
      source: "partners form",
      fit_notes: notes.length ? notes.join("\n") : null,
      status: "replied",
      next_touch_at: addDays(now, REPLY_FOLLOW_UP_DAYS).toISOString(),
      tags,
    },
    touch: {
      channel: "note",
      direction: "inbound",
      subject: "Applied via /partners",
      body: notes.length ? notes.join("\n") : "Application submitted with no message.",
    },
  };
}
