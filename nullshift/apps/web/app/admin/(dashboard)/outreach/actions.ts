"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@nullshift/db";
import { requireStaff } from "@nullshift/auth/guards";
import { logAudit } from "@nullshift/db/audit";
import { isClientPreview } from "@/lib/clientPreview";
import type { ActionFailure, ActionResult } from "@/lib/commercial/types";
import {
  APPLICATION_COLUMNS,
  PROSPECT_COLUMNS,
  TOUCH_COLUMNS,
  afterTouch,
  applicationTag,
  applicationToProspect,
  isApplicationStatus,
  isAgencyType,
  isProspectStatus,
  isTouchChannel,
  isTouchDirection,
  normaliseEmail,
  normaliseHandle,
  normaliseWebsite,
  parseProspectCsv,
  planNextTouch,
  PARK_DAYS,
  addDays,
  type ApplicationRow,
  type ApplicationStatus,
  type ProspectRow,
  type ProspectStatus,
  type TouchChannel,
  type TouchDirection,
  type TouchRow,
} from "@/lib/ops/outreachData";

/**
 * Partner-outreach server actions (migration 0068).
 *
 * Every action: requireStaff → never under a client preview cookie → RLS
 * client → audit_log row. Same guard as quotes/actions.ts. Ids arriving
 * from the browser are only ever used after the row has been loaded.
 */

const LIST_PATH = "/admin/outreach";
const prospectPath = (id: string) => `${LIST_PATH}/${id}`;

type Db = Awaited<ReturnType<typeof createClient>>;

type Guard =
  | { ok: true; userId: string; email: string; db: Db }
  | { ok: false; reason: ActionFailure };

async function guard(): Promise<Guard> {
  const staff = await requireStaff();
  if (!staff.ok) return { ok: false, reason: staff.reason };
  if (await isClientPreview()) return { ok: false, reason: "preview" };
  return { ok: true, userId: staff.userId, email: staff.email, db: await createClient() };
}

const clean = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

function fail(reason: ActionFailure, detail?: string): ActionResult<never> {
  return detail ? { ok: false, reason, detail } : { ok: false, reason };
}

function dbFailure(e: unknown): ActionResult<never> {
  const message = e instanceof Error ? e.message : String(e);
  console.error("outreach action:", message);
  return fail("db_error", message);
}

function revalidate(id?: string) {
  revalidatePath(LIST_PATH);
  if (id) revalidatePath(prospectPath(id));
}

/** Parse a date/datetime string from a form; undefined = not supplied, null = clear. */
function dateOrNull(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  const s = clean(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

async function getProspect(db: Db, id: string): Promise<ProspectRow | null> {
  const { data, error } = await db
    .from("partner_prospects")
    .select(PROSPECT_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ProspectRow | null) ?? null;
}

// ---------------------------------------------------------------------------
// Create / update
// ---------------------------------------------------------------------------

export type ProspectInput = {
  company: string;
  website?: string | null;
  country?: string | null;
  region?: string | null;
  agency_type?: string | null;
  staff_band?: string | null;
  contact_name?: string | null;
  contact_role?: string | null;
  email?: string | null;
  linkedin_url?: string | null;
  instagram_handle?: string | null;
  phone?: string | null;
  source?: string | null;
  fit_notes?: string | null;
  owner?: string | null;
  tags?: string[] | null;
  status?: string | null;
  next_touch_at?: string | null;
};

type ProspectPatch = {
  company?: string;
  website?: string | null;
  country?: string | null;
  region?: string | null;
  agency_type?: string | null;
  staff_band?: string | null;
  contact_name?: string | null;
  contact_role?: string | null;
  email?: string | null;
  linkedin_url?: string | null;
  instagram_handle?: string | null;
  phone?: string | null;
  source?: string | null;
  fit_notes?: string | null;
  owner?: string | null;
  tags?: string[];
  status?: ProspectStatus;
  next_touch_at?: string | null;
  parked_until?: string | null;
  verified_at?: string | null;
  verified_by?: string | null;
};

function buildPatch(
  input: Partial<ProspectInput>,
  opts: { requireCompany: boolean }
): ActionResult<{ patch: ProspectPatch }> {
  const patch: ProspectPatch = {};
  if (input.company !== undefined || opts.requireCompany) {
    const company = clean(input.company);
    if (!company) return fail("invalid", "company is required");
    patch.company = company;
  }
  if (input.email !== undefined) {
    const raw = clean(input.email);
    const email = normaliseEmail(raw);
    if (raw && !email) return fail("invalid", `"${raw}" is not a valid email`);
    patch.email = email;
  }
  if (input.agency_type !== undefined) {
    const t = clean(input.agency_type);
    if (t && !isAgencyType(t)) return fail("invalid", `unknown agency_type "${t}"`);
    patch.agency_type = t;
  }
  if (input.status !== undefined) {
    const st = clean(input.status);
    if (st) {
      if (!isProspectStatus(st)) return fail("invalid", `unknown status "${st}"`);
      patch.status = st;
    }
  }
  if (input.next_touch_at !== undefined) {
    const d = dateOrNull(input.next_touch_at);
    if (d === undefined) return fail("invalid", "next_touch_at is not a date");
    patch.next_touch_at = d;
  }
  if (input.website !== undefined) patch.website = normaliseWebsite(clean(input.website));
  if (input.instagram_handle !== undefined)
    patch.instagram_handle = normaliseHandle(clean(input.instagram_handle));
  if (input.tags !== undefined)
    patch.tags = (input.tags ?? []).map((t) => t.trim()).filter(Boolean);
  for (const key of [
    "country",
    "region",
    "staff_band",
    "contact_name",
    "contact_role",
    "linkedin_url",
    "phone",
    "source",
    "fit_notes",
    "owner",
  ] as const) {
    if (input[key] !== undefined) patch[key] = clean(input[key]);
  }
  return { ok: true, patch };
}

export async function createProspect(
  input: ProspectInput
): Promise<ActionResult<{ id: string }>> {
  const g = await guard();
  if (!g.ok) return fail(g.reason);
  const built = buildPatch(input, { requireCompany: true });
  if (!built.ok) return built;
  const patch = built.patch;
  if (!patch.status) patch.status = "sourced";

  try {
    const { data, error } = await g.db
      .from("partner_prospects")
      .insert(patch as never)
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505")
        return fail("invalid", `a prospect with email ${patch.email} already exists`);
      return dbFailure(error.message);
    }
    const id = (data as { id: string }).id;
    await logAudit({
      action: "partner_prospect.created",
      target: `partner_prospect:${id}`,
      tenantId: null,
      metadata: { company: patch.company, status: patch.status, actor_email: g.email },
    });
    revalidate();
    return { ok: true, id };
  } catch (e) {
    return dbFailure(e);
  }
}

export async function updateProspect(
  id: string,
  input: Partial<ProspectInput>
): Promise<ActionResult<{ id: string }>> {
  const g = await guard();
  if (!g.ok) return fail(g.reason);
  if (!isUuid(id)) return fail("invalid", "id is not a uuid");
  const built = buildPatch(input, { requireCompany: false });
  if (!built.ok) return built;
  if (Object.keys(built.patch).length === 0) return fail("invalid", "nothing to update");

  try {
    const existing = await getProspect(g.db, id);
    if (!existing) return fail("not_found", "prospect");
    const { error } = await g.db
      .from("partner_prospects")
      .update(built.patch as never)
      .eq("id", id);
    if (error) {
      if (error.code === "23505")
        return fail(
          "invalid",
          `a prospect with email ${built.patch.email} already exists`
        );
      return dbFailure(error.message);
    }
    await logAudit({
      action: "partner_prospect.updated",
      target: `partner_prospect:${id}`,
      tenantId: null,
      metadata: { fields: Object.keys(built.patch), actor_email: g.email },
    });
    revalidate(id);
    return { ok: true, id };
  } catch (e) {
    return dbFailure(e);
  }
}

// ---------------------------------------------------------------------------
// Status, verification, parking
// ---------------------------------------------------------------------------

export async function setStatus(
  id: string,
  status: string,
  opts: { next_touch_at?: string | null } = {}
): Promise<ActionResult<{ status: ProspectStatus }>> {
  const g = await guard();
  if (!g.ok) return fail(g.reason);
  if (!isUuid(id)) return fail("invalid", "id is not a uuid");
  if (!isProspectStatus(status)) return fail("invalid", `unknown status "${status}"`);

  try {
    const existing = await getProspect(g.db, id);
    if (!existing) return fail("not_found", "prospect");
    const now = new Date();
    const patch: ProspectPatch = { status };
    const next = dateOrNull(opts.next_touch_at);
    if (next === undefined && opts.next_touch_at !== undefined)
      return fail("invalid", "next_touch_at is not a date");

    if (status === "parked") {
      patch.parked_until = addDays(now, PARK_DAYS).toISOString();
      patch.next_touch_at = next ?? patch.parked_until;
    } else if (
      status === "agreed" ||
      status === "declined" ||
      status === "unsubscribed"
    ) {
      patch.next_touch_at = null;
      patch.parked_until = null;
    } else if (status === "queued") {
      // Queueing starts the sequence: step 1 is due now unless a date is given.
      patch.parked_until = null;
      patch.next_touch_at = next ?? now.toISOString();
    } else {
      patch.parked_until = null;
      if (next !== undefined) patch.next_touch_at = next;
    }

    const { error } = await g.db
      .from("partner_prospects")
      .update(patch as never)
      .eq("id", id);
    if (error) return dbFailure(error.message);
    await logAudit({
      action: "partner_prospect.status",
      target: `partner_prospect:${id}`,
      tenantId: null,
      metadata: { from: existing.status, to: status, actor_email: g.email },
    });
    revalidate(id);
    return { ok: true, status };
  } catch (e) {
    return dbFailure(e);
  }
}

/** Staff confirmed contact details and fit; moves sourced → verified. */
export async function markVerified(id: string): Promise<ActionResult<{ id: string }>> {
  const g = await guard();
  if (!g.ok) return fail(g.reason);
  if (!isUuid(id)) return fail("invalid", "id is not a uuid");
  try {
    const existing = await getProspect(g.db, id);
    if (!existing) return fail("not_found", "prospect");
    const patch: ProspectPatch = {
      verified_at: new Date().toISOString(),
      verified_by: g.email || g.userId,
    };
    if (existing.status === "sourced") patch.status = "verified";
    const { error } = await g.db
      .from("partner_prospects")
      .update(patch as never)
      .eq("id", id);
    if (error) return dbFailure(error.message);
    await logAudit({
      action: "partner_prospect.verified",
      target: `partner_prospect:${id}`,
      tenantId: null,
      metadata: { actor_email: g.email },
    });
    revalidate(id);
    return { ok: true, id };
  } catch (e) {
    return dbFailure(e);
  }
}

/** Park for `days` (default 90): status parked, next touch = parked_until. */
export async function park(
  id: string,
  days: number = PARK_DAYS
): Promise<ActionResult<{ parkedUntil: string }>> {
  const g = await guard();
  if (!g.ok) return fail(g.reason);
  if (!isUuid(id)) return fail("invalid", "id is not a uuid");
  const n = Number.isFinite(days) && days > 0 ? Math.round(days) : PARK_DAYS;
  try {
    const existing = await getProspect(g.db, id);
    if (!existing) return fail("not_found", "prospect");
    const parkedUntil = addDays(new Date(), n).toISOString();
    const { error } = await g.db
      .from("partner_prospects")
      .update({
        status: "parked",
        parked_until: parkedUntil,
        next_touch_at: parkedUntil,
      } as never)
      .eq("id", id);
    if (error) return dbFailure(error.message);
    await logAudit({
      action: "partner_prospect.parked",
      target: `partner_prospect:${id}`,
      tenantId: null,
      metadata: { days: n, parked_until: parkedUntil, actor_email: g.email },
    });
    revalidate(id);
    return { ok: true, parkedUntil };
  } catch (e) {
    return dbFailure(e);
  }
}

// ---------------------------------------------------------------------------
// Touches
// ---------------------------------------------------------------------------

export type LogTouchInput = {
  prospect_id: string;
  channel: string;
  direction: string;
  subject?: string | null;
  body?: string | null;
  outcome?: string | null;
  sent_at?: string | null;
};

/**
 * Record a touch and advance the prospect per the sequence (day 0 email,
 * day 3 LinkedIn, day 7 email, day 14 email; park 90 days after the fourth
 * outbound with no reply). Inbound touches mark a reply.
 */
export async function logTouch(
  input: LogTouchInput
): Promise<
  ActionResult<{ touchId: string; status: ProspectStatus; nextTouchAt: string | null }>
> {
  const g = await guard();
  if (!g.ok) return fail(g.reason);
  if (!isUuid(input.prospect_id)) return fail("invalid", "prospect_id is not a uuid");
  if (!isTouchChannel(input.channel))
    return fail("invalid", `unknown channel "${input.channel}"`);
  if (!isTouchDirection(input.direction))
    return fail("invalid", `unknown direction "${input.direction}"`);
  const channel: TouchChannel = input.channel;
  const direction: TouchDirection = input.direction;
  const sentAt = dateOrNull(input.sent_at ?? null);
  if (sentAt === undefined) return fail("invalid", "sent_at is not a date");

  try {
    const existing = await getProspect(g.db, input.prospect_id);
    if (!existing) return fail("not_found", "prospect");
    const { data: priorRows, error: priorErr } = await g.db
      .from("partner_touches")
      .select(TOUCH_COLUMNS)
      .eq("prospect_id", existing.id)
      .order("sent_at", { ascending: true });
    if (priorErr) return dbFailure(priorErr.message);
    const prior = (priorRows ?? []) as TouchRow[];
    const priorOutbound = prior.filter(
      (t) =>
        t.direction === "outbound" &&
        ["email", "linkedin", "instagram"].includes(t.channel)
    );

    const { data: inserted, error: insErr } = await g.db
      .from("partner_touches")
      .insert({
        prospect_id: existing.id,
        channel,
        direction,
        subject: clean(input.subject),
        body: clean(input.body),
        outcome: clean(input.outcome),
        sent_at: sentAt ?? new Date().toISOString(),
        created_by: g.email || g.userId,
      } as never)
      .select("id")
      .single();
    if (insErr) return dbFailure(insErr.message);
    const touchId = (inserted as { id: string }).id;

    const now = new Date();
    const status: ProspectStatus = isProspectStatus(existing.status)
      ? existing.status
      : "sourced";
    const next = afterTouch({
      status,
      direction,
      channel,
      priorOutboundCount: priorOutbound.length,
      firstOutboundAt: priorOutbound[0] ? new Date(priorOutbound[0].sent_at) : null,
      now,
    });
    const patch: ProspectPatch = {};
    if (channel !== "note") {
      patch.status = next.status;
      patch.next_touch_at = next.nextTouchAt ? next.nextTouchAt.toISOString() : null;
      patch.parked_until = next.parkedUntil ? next.parkedUntil.toISOString() : null;
      const { error: updErr } = await g.db
        .from("partner_prospects")
        .update(patch as never)
        .eq("id", existing.id);
      if (updErr) return dbFailure(updErr.message);
    }

    await logAudit({
      action: "partner_touch.logged",
      target: `partner_prospect:${existing.id}`,
      tenantId: null,
      metadata: {
        touch_id: touchId,
        channel,
        direction,
        status_from: existing.status,
        status_to: patch.status ?? existing.status,
        next_touch_at: patch.next_touch_at ?? existing.next_touch_at,
        actor_email: g.email,
      },
    });
    revalidate(existing.id);
    return {
      ok: true,
      touchId,
      status: patch.status ?? status,
      nextTouchAt: patch.next_touch_at ?? existing.next_touch_at,
    };
  } catch (e) {
    return dbFailure(e);
  }
}

// ---------------------------------------------------------------------------
// CSV import
// ---------------------------------------------------------------------------

export type ImportResult = {
  imported: number;
  skipped: number;
  errors: string[];
};

/**
 * Paste CSV (header row: company,website,country,agency_type,contact_name,
 * contact_role,email,linkedin_url,instagram_handle,source,fit_notes). Rows
 * whose email already exists are skipped, not overwritten. Every row lands
 * as `sourced` with no next touch; verification and queueing are deliberate
 * staff steps.
 */
export async function importCsv(
  text: string,
  opts: { source?: string | null; owner?: string | null; queue?: boolean } = {}
): Promise<ActionResult<ImportResult>> {
  const g = await guard();
  if (!g.ok) return fail(g.reason);
  const parsed = parseProspectCsv(String(text ?? ""));
  const errors = [...parsed.errors];
  if (parsed.rows.length === 0) return fail("invalid", errors[0] ?? "no rows to import");
  if (parsed.rows.length > 500)
    return fail("invalid", "import at most 500 rows at a time");

  const defaultSource = clean(opts.source);
  const owner = clean(opts.owner);
  const now = new Date();
  const queue = opts.queue === true;
  const firstStep = planNextTouch({ outboundCount: 0, firstOutboundAt: null, now });

  let imported = 0;
  let skipped = 0;
  try {
    for (const r of parsed.rows) {
      const row: ProspectPatch = {
        company: r.company,
        website: r.website,
        country: r.country,
        agency_type: r.agency_type,
        contact_name: r.contact_name,
        contact_role: r.contact_role,
        email: r.email,
        linkedin_url: r.linkedin_url,
        instagram_handle: r.instagram_handle,
        source: r.source ?? defaultSource,
        fit_notes: r.fit_notes,
        owner,
        status: queue ? "queued" : "sourced",
        next_touch_at:
          queue && firstStep.kind === "touch" ? firstStep.dueAt.toISOString() : null,
      };
      const { error } = await g.db.from("partner_prospects").insert(row as never);
      if (error) {
        if (error.code === "23505") {
          skipped += 1;
          errors.push(
            `Row ${r.line} (${r.company}): ${r.email} already exists; skipped.`
          );
          continue;
        }
        return dbFailure(error.message);
      }
      imported += 1;
    }
    await logAudit({
      action: "partner_prospect.imported",
      target: "partner_prospects",
      tenantId: null,
      metadata: { imported, skipped, errors: errors.length, queue, actor_email: g.email },
    });
    revalidate();
    return { ok: true, imported, skipped, errors };
  } catch (e) {
    return dbFailure(e);
  }
}

// ---------------------------------------------------------------------------
// Partner applications (migration 0069). Staff may select and update; the
// public form inserts through the service role, never from here.
// ---------------------------------------------------------------------------

const APPLICATION_PATH = (id: string) => `${LIST_PATH}/applications/${id}`;

async function getApplication(db: Db, id: string): Promise<ApplicationRow | null> {
  const { data, error } = await db
    .from("partner_applications")
    .select(APPLICATION_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ApplicationRow | null) ?? null;
}

function revalidateApplication(id?: string) {
  revalidatePath(LIST_PATH);
  if (id) revalidatePath(APPLICATION_PATH(id));
}

export async function setApplicationStatus(
  id: string,
  status: string
): Promise<ActionResult<{ status: ApplicationStatus }>> {
  const g = await guard();
  if (!g.ok) return fail(g.reason);
  if (!isUuid(id)) return fail("invalid", "id is not a uuid");
  if (!isApplicationStatus(status)) return fail("invalid", `unknown status "${status}"`);
  try {
    const existing = await getApplication(g.db, id);
    if (!existing) return fail("not_found", "application");
    const patch: { status: ApplicationStatus; reviewed_at?: string } = { status };
    if (!existing.reviewed_at && status !== "new")
      patch.reviewed_at = new Date().toISOString();
    const { error } = await g.db
      .from("partner_applications")
      .update(patch as never)
      .eq("id", id);
    if (error) return dbFailure(error.message);
    await logAudit({
      action: "partner_application.status",
      target: `partner_application:${id}`,
      tenantId: null,
      metadata: { from: existing.status, to: status, actor_email: g.email },
    });
    revalidateApplication(id);
    return { ok: true, status };
  } catch (e) {
    return dbFailure(e);
  }
}

/** Replace the triage notes (the form shows the current text for editing). */
export async function setApplicationNotes(
  id: string,
  notes: string | null
): Promise<ActionResult<{ id: string }>> {
  const g = await guard();
  if (!g.ok) return fail(g.reason);
  if (!isUuid(id)) return fail("invalid", "id is not a uuid");
  try {
    const existing = await getApplication(g.db, id);
    if (!existing) return fail("not_found", "application");
    const { error } = await g.db
      .from("partner_applications")
      .update({ notes: clean(notes) } as never)
      .eq("id", id);
    if (error) return dbFailure(error.message);
    await logAudit({
      action: "partner_application.notes",
      target: `partner_application:${id}`,
      tenantId: null,
      metadata: { actor_email: g.email },
    });
    revalidateApplication(id);
    return { ok: true, id };
  } catch (e) {
    return dbFailure(e);
  }
}

/** Stamp reviewed_at; a `new` application becomes `reviewing`. */
export async function markApplicationReviewed(
  id: string
): Promise<ActionResult<{ id: string }>> {
  const g = await guard();
  if (!g.ok) return fail(g.reason);
  if (!isUuid(id)) return fail("invalid", "id is not a uuid");
  try {
    const existing = await getApplication(g.db, id);
    if (!existing) return fail("not_found", "application");
    const patch: { reviewed_at: string; status?: ApplicationStatus } = {
      reviewed_at: new Date().toISOString(),
    };
    if (existing.status === "new") patch.status = "reviewing";
    const { error } = await g.db
      .from("partner_applications")
      .update(patch as never)
      .eq("id", id);
    if (error) return dbFailure(error.message);
    await logAudit({
      action: "partner_application.reviewed",
      target: `partner_application:${id}`,
      tenantId: null,
      metadata: { actor_email: g.email },
    });
    revalidateApplication(id);
    return { ok: true, id };
  } catch (e) {
    return dbFailure(e);
  }
}

/**
 * One click: create a partner_prospects row from the application (status
 * `replied`, follow-up due within a day), log the application as an inbound
 * note touch, tag the prospect `application:<id>` so the two link, and mark
 * the application reviewing. If a prospect with that email already exists
 * it is reused: tagged and given the note instead of duplicated.
 */
export async function convertApplication(
  id: string
): Promise<ActionResult<{ prospectId: string; reused: boolean }>> {
  const g = await guard();
  if (!g.ok) return fail(g.reason);
  if (!isUuid(id)) return fail("invalid", "id is not a uuid");
  try {
    const app = await getApplication(g.db, id);
    if (!app) return fail("not_found", "application");
    const tag = applicationTag(app.id);

    // Already converted? Point at the existing prospect.
    const { data: already } = await g.db
      .from("partner_prospects")
      .select("id")
      .contains("tags", [tag])
      .limit(1)
      .maybeSingle();
    if (already)
      return { ok: true, prospectId: (already as { id: string }).id, reused: true };

    const now = new Date();
    const mapped = applicationToProspect(app, now);
    let prospectId: string;
    let reused = false;

    const { data: inserted, error: insErr } = await g.db
      .from("partner_prospects")
      .insert(mapped.prospect as never)
      .select("id")
      .single();
    if (insErr && insErr.code === "23505" && mapped.prospect.email) {
      // Same email already in the pipeline: reuse that row.
      const { data: existing, error: exErr } = await g.db
        .from("partner_prospects")
        .select("id, tags")
        .ilike("email", mapped.prospect.email)
        .limit(1)
        .maybeSingle();
      if (exErr) return dbFailure(exErr.message);
      if (!existing) return dbFailure(insErr.message);
      const row = existing as { id: string; tags: string[] | null };
      const tags = Array.from(new Set([...(row.tags ?? []), ...mapped.prospect.tags]));
      const { error: updErr } = await g.db
        .from("partner_prospects")
        .update({
          tags,
          status: "replied",
          next_touch_at: mapped.prospect.next_touch_at,
          parked_until: null,
        } as never)
        .eq("id", row.id);
      if (updErr) return dbFailure(updErr.message);
      prospectId = row.id;
      reused = true;
    } else if (insErr) {
      return dbFailure(insErr.message);
    } else {
      prospectId = (inserted as { id: string }).id;
    }

    const { error: touchErr } = await g.db.from("partner_touches").insert({
      prospect_id: prospectId,
      channel: mapped.touch.channel,
      direction: mapped.touch.direction,
      subject: mapped.touch.subject,
      body: mapped.touch.body,
      sent_at: app.created_at,
      created_by: g.email || g.userId,
    } as never);
    if (touchErr) return dbFailure(touchErr.message);

    const appPatch: { reviewed_at?: string; status?: ApplicationStatus } = {};
    if (!app.reviewed_at) appPatch.reviewed_at = now.toISOString();
    if (app.status === "new") appPatch.status = "reviewing";
    if (Object.keys(appPatch).length) {
      const { error: appErr } = await g.db
        .from("partner_applications")
        .update(appPatch as never)
        .eq("id", app.id);
      if (appErr) return dbFailure(appErr.message);
    }

    await logAudit({
      action: "partner_application.converted",
      target: `partner_application:${app.id}`,
      tenantId: null,
      metadata: { prospect_id: prospectId, reused, actor_email: g.email },
    });
    revalidateApplication(app.id);
    revalidate(prospectId);
    return { ok: true, prospectId, reused };
  } catch (e) {
    return dbFailure(e);
  }
}

// ---------------------------------------------------------------------------
// Form adapters (server-rendered <form action>). They wrap the actions above
// and report through ?notice= so no client component is needed. redirect()
// throws, which is how Next signals it.
// ---------------------------------------------------------------------------

const describe = (
  r: { ok: boolean; reason?: string; detail?: string },
  okText: string
) =>
  r.ok ? `ok:${okText}` : `err:${r.reason ?? "unknown"}${r.detail ? `:${r.detail}` : ""}`;

function toList(notice: string, extra = ""): never {
  redirect(`${LIST_PATH}?notice=${encodeURIComponent(notice.slice(0, 300))}${extra}`);
}

function toProspect(id: string, notice: string): never {
  redirect(`${prospectPath(id)}?notice=${encodeURIComponent(notice.slice(0, 300))}`);
}

function inputFromForm(formData: FormData): ProspectInput {
  const str = (k: string) => clean(formData.get(k));
  const tags = str("tags");
  return {
    company: String(formData.get("company") ?? ""),
    website: str("website"),
    country: str("country"),
    region: str("region"),
    agency_type: str("agency_type"),
    staff_band: str("staff_band"),
    contact_name: str("contact_name"),
    contact_role: str("contact_role"),
    email: str("email"),
    linkedin_url: str("linkedin_url"),
    instagram_handle: str("instagram_handle"),
    phone: str("phone"),
    source: str("source"),
    fit_notes: str("fit_notes"),
    owner: str("owner"),
    tags: tags ? tags.split(",") : [],
    status: str("status"),
    next_touch_at: str("next_touch_at"),
  };
}

export async function createProspectFromForm(formData: FormData): Promise<void> {
  const r = await createProspect(inputFromForm(formData));
  if (r.ok) toProspect(r.id, "ok:prospect created");
  redirect(
    `${LIST_PATH}/new?notice=${encodeURIComponent(describe(r, "").slice(0, 300))}`
  );
}

export async function updateProspectFromForm(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const r = await updateProspect(id, inputFromForm(formData));
  toProspect(id, describe(r, "prospect saved"));
}

export async function setStatusFromForm(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const nextRaw = formData.get("next_touch_at");
  const r = await setStatus(
    id,
    status,
    nextRaw === null ? {} : { next_touch_at: clean(nextRaw) }
  );
  toProspect(id, describe(r, r.ok ? `status set to ${r.status.replace("_", " ")}` : ""));
}

export async function setNextTouchFromForm(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const r = await updateProspect(id, {
    next_touch_at: clean(formData.get("next_touch_at")),
  });
  toProspect(id, describe(r, "next touch updated"));
}

export async function markVerifiedFromForm(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  toProspect(id, describe(await markVerified(id), "marked verified"));
}

export async function parkFromForm(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const days = Number(formData.get("days") ?? PARK_DAYS);
  const r = await park(id, Number.isFinite(days) ? days : PARK_DAYS);
  toProspect(id, describe(r, r.ok ? `parked until ${r.parkedUntil.slice(0, 10)}` : ""));
}

export async function logTouchFromForm(formData: FormData): Promise<void> {
  const id = String(formData.get("prospect_id") ?? "");
  const r = await logTouch({
    prospect_id: id,
    channel: String(formData.get("channel") ?? ""),
    direction: String(formData.get("direction") ?? "outbound"),
    subject: clean(formData.get("subject")),
    body: clean(formData.get("body")),
    outcome: clean(formData.get("outcome")),
    sent_at: clean(formData.get("sent_at")),
  });
  toProspect(
    id,
    describe(
      r,
      r.ok
        ? `touch logged · now ${r.status.replace("_", " ")}${r.nextTouchAt ? `, next touch ${r.nextTouchAt.slice(0, 10)}` : ""}`
        : ""
    )
  );
}

export async function importCsvFromForm(formData: FormData): Promise<void> {
  const r = await importCsv(String(formData.get("csv") ?? ""), {
    source: clean(formData.get("source")),
    owner: clean(formData.get("owner")),
    queue: formData.get("queue") === "on",
  });
  if (!r.ok) {
    redirect(
      `${LIST_PATH}/import?notice=${encodeURIComponent(describe(r, "").slice(0, 300))}`
    );
  }
  const summary = `imported ${r.imported}${r.skipped ? `, skipped ${r.skipped}` : ""}${
    r.errors.length
      ? ` · ${r.errors.length} warning${r.errors.length === 1 ? "" : "s"}`
      : ""
  }`;
  const detail = r.errors.length
    ? `&detail=${encodeURIComponent(r.errors.slice(0, 20).join("\n").slice(0, 1500))}`
    : "";
  toList(`ok:${summary}`, `&tab=all${detail}`);
}

// ---------------------------------------------------------------------------
// Application form adapters, reporting back to /admin/outreach/applications/[id].
// ---------------------------------------------------------------------------

function toApplication(id: string, notice: string): never {
  redirect(`${APPLICATION_PATH(id)}?notice=${encodeURIComponent(notice.slice(0, 300))}`);
}

export async function setApplicationStatusFromForm(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const r = await setApplicationStatus(id, String(formData.get("status") ?? ""));
  toApplication(id, describe(r, r.ok ? `status set to ${r.status}` : ""));
}

export async function setApplicationNotesFromForm(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  toApplication(
    id,
    describe(await setApplicationNotes(id, clean(formData.get("notes"))), "notes saved")
  );
}

export async function markApplicationReviewedFromForm(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  toApplication(id, describe(await markApplicationReviewed(id), "marked reviewed"));
}

export async function convertApplicationFromForm(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const r = await convertApplication(id);
  if (r.ok)
    toProspect(
      r.prospectId,
      r.reused
        ? "ok:linked to the existing prospect for this email (tagged, note logged)"
        : "ok:prospect created from the application · status replied, follow-up due tomorrow"
    );
  toApplication(id, describe(r, ""));
}
