"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient, createServiceClient } from "@nullshift/db";
import { requireStaff } from "@nullshift/auth/guards";
import { logAudit } from "@nullshift/db/audit";
import { flagOn } from "@/lib/flags";
import { isClientPreview } from "@/lib/clientPreview";
import {
  acceptedContent,
  buildAcceptanceSnapshot,
  verifySnapshot,
  type AcceptanceSnapshot,
} from "@/lib/legal/acceptanceSnapshot";
import {
  arrangementFromRow,
  buildVariation,
  canAcceptSchedule,
  canIssueHandoverSchedule,
  canIssueServiceSchedule,
  canReviewSchedule,
  changeRoute,
  defaultHandoverContent,
  electRoute,
  handoverContentFromRow,
  handoverScheduleFromRow,
  nextVersionNo,
  scheduleContentFromRow,
  serviceScheduleFromRow,
  supersededBy,
  validateArrangement,
  CADENCES,
  FEE_DISPOSITIONS,
  SERVICE_ROUTES,
  TAX_BASES,
  BILLING_START_ARRANGEMENTS,
  type ArrangementRow,
  type BillingStartArrangement,
  type Cadence,
  type FeeDisposition,
  type HandoverScheduleRow,
  type Problem,
  type ServiceRoute,
  type ServiceScheduleRow,
  type TaxBasis,
} from "@/lib/legal/arrangements";

/**
 * Service arrangement, service schedule and handover schedule server actions
 * (admin redesign Phase 3, task p3-arrangements; migration 0059).
 *
 * Every action: `commercialV2` flag → guard → never under the client-preview
 * cookie → audit_log row. Flag off: every action returns
 * { ok: false, reason: "flag_off" } without touching the database, so
 * production behaviour is unchanged until the flag is set.
 *
 * Staff actions use requireStaff() and the caller's RLS client. The two
 * client acceptance actions are portal actions: they resolve the signer's
 * membership + role on the schedule's tenant explicitly (service client,
 * after the check) and refuse anyone else — including staff, who record a
 * client's offline acceptance through a different, manual_upload path that
 * does not exist yet.
 *
 * Nothing here creates a subscription, an obligation or a collection.
 * Activation gates live in lib/legal/arrangements.ts behind `billingActivation`.
 */

const LIST_PATH = "/admin/agreements";
// Draft template identifiers, not solicitor-approved documents (brief §9).
const SERVICE_SCHEDULE_TEMPLATE = "SS-2026.09-draft";
const HANDOVER_SCHEDULE_TEMPLATE = "HS-2026.09-draft";

export type ArrangementActionFailure =
  | "flag_off"
  | "unauthenticated"
  | "forbidden"
  | "preview"
  | "not_found"
  | "stale"
  | "invalid"
  | "invalid_transition"
  | "variation_required"
  | "review_required"
  | "reviewer_is_author"
  | "snapshot_invalid"
  | "db_error";

export type ArrangementActionResult<T = Record<string, never>> =
  | ({ ok: true } & T)
  | {
      ok: false;
      reason: ArrangementActionFailure;
      problems?: Problem[];
      detail?: string;
    };

type Db = Awaited<ReturnType<typeof createClient>>;
type StaffGuard =
  | { ok: true; userId: string; email: string; db: Db }
  | { ok: false; reason: ArrangementActionFailure };

async function staffGuard(): Promise<StaffGuard> {
  if (!flagOn("commercialV2")) return { ok: false, reason: "flag_off" };
  const staff = await requireStaff();
  if (!staff.ok) return { ok: false, reason: staff.reason };
  if (await isClientPreview()) return { ok: false, reason: "preview" };
  return { ok: true, userId: staff.userId, email: staff.email, db: await createClient() };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const clean = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
};
const stringList = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(clean).filter((x): x is string => !!x) : [];
const plainObject = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

function fail<T = never>(
  reason: ArrangementActionFailure,
  detail?: string,
  problems?: Problem[]
): ArrangementActionResult<T> {
  return {
    ok: false,
    reason,
    ...(detail ? { detail } : {}),
    ...(problems ? { problems } : {}),
  };
}

function dbFailure<T = never>(e: unknown): ArrangementActionResult<T> {
  const message = e instanceof Error ? e.message : String(e);
  console.error("arrangement action:", message);
  return fail("db_error", message);
}

function revalidate() {
  revalidatePath(LIST_PATH);
  revalidatePath("/portal/legal");
}

const isStale = (expected: string | null | undefined, actual: string): boolean => {
  if (!expected) return true;
  const a = new Date(expected).getTime();
  const b = new Date(actual).getTime();
  return Number.isNaN(a) || Number.isNaN(b) || a !== b;
};

async function loadArrangement(db: Db, id: string): Promise<ArrangementRow | null> {
  const { data, error } = await db
    .from("service_arrangements")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`service_arrangements read failed: ${error.message}`);
  return (data as ArrangementRow | null) ?? null;
}

/** Has the governing Order Form been accepted? (Route changes after this need a variation.) */
async function arrangementSigned(db: Db, a: ArrangementRow): Promise<boolean> {
  if (!a.order_form_id) return false;
  const { data, error } = await db
    .from("order_forms")
    .select("status")
    .eq("id", a.order_form_id)
    .maybeSingle();
  if (error) throw new Error(`order_forms read failed: ${error.message}`);
  return data?.status === "accepted";
}

// ---------------------------------------------------------------------------
// Arrangements
// ---------------------------------------------------------------------------

export type CreateArrangementInput = {
  tenant_id: string;
  project_id?: string | null;
  order_form_id?: string | null;
  route: ServiceRoute;
  billing_start_arrangement?: BillingStartArrangement;
  billing_start_date?: string | null;
  approved_wording_ref?: string | null;
};

/**
 * Record the route election. Selecting Managed writes route='managed' and
 * package_state='pending' — no plan, no amount, no subscription (§17.1 row 1).
 * tenant_id is verified to exist; project and order form must belong to it.
 */
export async function createArrangement(
  input: CreateArrangementInput
): Promise<ArrangementActionResult<{ id: string }>> {
  const g = await staffGuard();
  if (!g.ok) return fail(g.reason);
  if (!isUuid(input.tenant_id)) return fail("invalid", "tenant_id is not a uuid");
  if (!SERVICE_ROUTES.includes(input.route)) return fail("invalid", "unknown route");

  const draft = {
    ...electRoute(input.route),
    billingStartArrangement: input.billing_start_arrangement ?? "unresolved",
    billingStartDate: clean(input.billing_start_date),
    approvedWordingRef: clean(input.approved_wording_ref),
  };
  if (!BILLING_START_ARRANGEMENTS.includes(draft.billingStartArrangement))
    return fail("invalid", "unknown billing_start_arrangement");
  const valid = validateArrangement(draft);
  if (!valid.ok) return fail("invalid", undefined, valid.problems);

  try {
    const { data: tenant, error: tErr } = await g.db
      .from("tenants")
      .select("id")
      .eq("id", input.tenant_id)
      .maybeSingle();
    if (tErr) return dbFailure(tErr.message);
    if (!tenant) return fail("not_found", "tenant");

    let projectId: string | null = null;
    if (input.project_id) {
      if (!isUuid(input.project_id)) return fail("invalid", "project_id is not a uuid");
      const { data: project, error } = await g.db
        .from("projects")
        .select("id, tenant_id")
        .eq("id", input.project_id)
        .maybeSingle();
      if (error) return dbFailure(error.message);
      if (!project || project.tenant_id !== input.tenant_id)
        return fail("not_found", "project does not belong to this client");
      projectId = project.id;
    }

    let orderFormId: string | null = null;
    if (input.order_form_id) {
      if (!isUuid(input.order_form_id))
        return fail("invalid", "order_form_id is not a uuid");
      const { data: form, error } = await g.db
        .from("order_forms")
        .select("id, tenant_id")
        .eq("id", input.order_form_id)
        .maybeSingle();
      if (error) return dbFailure(error.message);
      if (!form || form.tenant_id !== input.tenant_id)
        return fail("not_found", "order form does not belong to this client");
      orderFormId = form.id;
    }

    const { data: row, error } = await g.db
      .from("service_arrangements")
      .insert({
        tenant_id: input.tenant_id,
        project_id: projectId,
        order_form_id: orderFormId,
        route: draft.route,
        package_state: draft.packageState,
        billing_start_arrangement: draft.billingStartArrangement,
        billing_start_date: draft.billingStartDate,
        approved_wording_ref: draft.approvedWordingRef,
        state: "active",
        created_by: g.userId,
      })
      .select("id")
      .single();
    if (error) return dbFailure(error.message);

    await logAudit({
      action: "service_arrangement.created",
      target: `service_arrangement:${row.id}`,
      tenantId: input.tenant_id,
      metadata: {
        route: draft.route,
        package_state: draft.packageState,
        billing_start_arrangement: draft.billingStartArrangement,
        billing_start_date: draft.billingStartDate,
        order_form_id: orderFormId,
        project_id: projectId,
        actor_email: g.email,
        consent_to_amount: false,
      },
    });
    revalidate();
    return { ok: true, id: row.id as string };
  } catch (e) {
    return dbFailure(e);
  }
}

export type ChangeRouteInput = {
  arrangement_id: string;
  route: ServiceRoute;
  /** Required once the governing Order Form is accepted: creates a variation. */
  as_variation?: boolean;
  reason?: string | null;
};

/**
 * Change the route. Unsigned → in place. Signed → refused unless
 * `as_variation`, in which case a new active row supersedes the old one and
 * the old row (and every schedule under it) is preserved (§17.1 row 7).
 */
export async function changeArrangementRoute(
  input: ChangeRouteInput
): Promise<ArrangementActionResult<{ id: string; mode: "in_place" | "variation" }>> {
  const g = await staffGuard();
  if (!g.ok) return fail(g.reason);
  if (!isUuid(input.arrangement_id))
    return fail("invalid", "arrangement_id is not a uuid");
  if (!SERVICE_ROUTES.includes(input.route)) return fail("invalid", "unknown route");

  try {
    const row = await loadArrangement(g.db, input.arrangement_id);
    if (!row) return fail("not_found");
    const current = arrangementFromRow(row);
    const signed = await arrangementSigned(g.db, row);
    const decision = changeRoute(current, input.route, {
      signed,
      asVariation: !!input.as_variation,
      reason: clean(input.reason),
    });
    if (!decision.ok) {
      const code = decision.problems[0]?.code;
      return fail(
        code === "variation_required" ? "variation_required" : "invalid_transition",
        undefined,
        decision.problems
      );
    }

    if (decision.mode === "in_place") {
      const { error } = await g.db
        .from("service_arrangements")
        .update({
          route: decision.next.route,
          package_state: decision.next.packageState,
          billing_start_arrangement: decision.next.billingStartArrangement,
          billing_start_date: decision.next.billingStartDate,
          approved_wording_ref: decision.next.approvedWordingRef,
        })
        .eq("id", row.id)
        .eq("state", "active");
      if (error) return dbFailure(error.message);
      await logAudit({
        action: "service_arrangement.route_changed",
        target: `service_arrangement:${row.id}`,
        tenantId: row.tenant_id,
        metadata: {
          from: current.route,
          to: input.route,
          signed: false,
          mode: "in_place",
        },
      });
      revalidate();
      return { ok: true, id: row.id, mode: "in_place" };
    }

    // Variation: one transaction in the database (0059
    // supersede_service_arrangement) — successor inserted, old row marked
    // superseded with its evidence untouched, successor activated.
    const reason = clean(input.reason) as string;
    const { data: newId, error: rpcErr } = await g.db.rpc(
      "supersede_service_arrangement",
      {
        p_old_id: row.id,
        p_route: decision.next.route,
        p_reason: reason,
      }
    );
    if (rpcErr) return dbFailure(rpcErr.message);
    if (!isUuid(newId)) return fail("db_error", "variation did not return an id");
    const planned = buildVariation(current, decision.next, newId, reason);

    await logAudit({
      action: "service_arrangement.variation_created",
      target: `service_arrangement:${planned.successor.id}`,
      tenantId: row.tenant_id,
      metadata: {
        supersedes: row.id,
        from: current.route,
        to: input.route,
        reason,
        signed: true,
        actor_email: g.email,
      },
    });
    await logAudit({
      action: "service_arrangement.superseded",
      target: `service_arrangement:${row.id}`,
      tenantId: row.tenant_id,
      metadata: { superseded_by: planned.successor.id, evidence_preserved: true },
    });
    revalidate();
    return { ok: true, id: planned.successor.id, mode: "variation" };
  } catch (e) {
    return dbFailure(e);
  }
}

// ---------------------------------------------------------------------------
// Service schedules (managed route)
// ---------------------------------------------------------------------------

export type DraftServiceScheduleInput = {
  arrangement_id: string;
  package_code: string;
  catalogue_ref?: string | null;
  inclusions?: string[];
  exclusions?: string[];
  usage_policy?: Record<string, unknown>;
  amount_minor?: number | null;
  currency?: string;
  tax_basis?: TaxBasis;
  cadence?: Cadence | null;
  start_date?: string | null;
  notice_days?: number | null;
  cancellation_terms_ref?: string | null;
  response_targets?: Record<string, unknown>;
};

/** Draft the next schedule version under a managed arrangement. Never chargeable. */
export async function draftServiceSchedule(
  input: DraftServiceScheduleInput
): Promise<ArrangementActionResult<{ id: string; versionNo: number }>> {
  const g = await staffGuard();
  if (!g.ok) return fail(g.reason);
  if (!isUuid(input.arrangement_id))
    return fail("invalid", "arrangement_id is not a uuid");
  const packageCode = clean(input.package_code);
  if (!packageCode) return fail("invalid", "package_code is required");
  const currency = (clean(input.currency) ?? "GBP").toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) return fail("invalid", "currency");
  const taxBasis = input.tax_basis ?? "pending";
  if (!TAX_BASES.includes(taxBasis)) return fail("invalid", "tax_basis");
  if (input.cadence && !CADENCES.includes(input.cadence))
    return fail("invalid", "cadence");
  const startDate = clean(input.start_date);
  if (startDate && !DATE_RE.test(startDate)) return fail("invalid", "start_date");
  const amount = input.amount_minor ?? null;
  if (amount !== null && (!Number.isInteger(amount) || amount < 0))
    return fail("invalid", "amount_minor must be a non-negative integer");
  const notice = input.notice_days ?? null;
  if (notice !== null && (!Number.isInteger(notice) || notice < 0))
    return fail("invalid", "notice_days must be a non-negative integer");

  try {
    const arrangement = await loadArrangement(g.db, input.arrangement_id);
    if (!arrangement) return fail("not_found");
    if (arrangement.state !== "active")
      return fail("invalid_transition", "arrangement superseded");
    if (arrangement.route !== "managed")
      return fail("invalid_transition", "a service schedule needs the managed route");

    const { data: existing, error: vErr } = await g.db
      .from("service_schedules")
      .select("version_no")
      .eq("arrangement_id", arrangement.id);
    if (vErr) return dbFailure(vErr.message);
    const versionNo = nextVersionNo(
      ((existing ?? []) as { version_no: number }[]).map((v) => ({
        versionNo: v.version_no,
      }))
    );

    const { data: row, error } = await g.db
      .from("service_schedules")
      .insert({
        arrangement_id: arrangement.id,
        version_no: versionNo,
        package_code: packageCode,
        catalogue_ref: clean(input.catalogue_ref),
        inclusions: stringList(input.inclusions),
        exclusions: stringList(input.exclusions),
        usage_policy: plainObject(input.usage_policy),
        amount_minor: amount,
        currency,
        tax_basis: taxBasis,
        cadence: input.cadence ?? null,
        start_date: startDate,
        notice_days: notice,
        cancellation_terms_ref: clean(input.cancellation_terms_ref),
        response_targets: plainObject(input.response_targets),
        status: "draft",
        created_by: g.userId,
      })
      .select("id")
      .single();
    if (error) return dbFailure(error.message);

    await logAudit({
      action: "service_schedule.drafted",
      target: `service_schedule:${row.id}`,
      tenantId: arrangement.tenant_id,
      metadata: {
        arrangement_id: arrangement.id,
        version_no: versionNo,
        package_code: packageCode,
        catalogue_status: "draft_sandbox",
      },
    });
    revalidate();
    return { ok: true, id: row.id as string, versionNo };
  } catch (e) {
    return dbFailure(e);
  }
}

export type ScheduleRef = { schedule_id: string; expected_updated_at: string };

/** Second-person review: the reviewer must not be the author. */
export async function reviewServiceSchedule(
  input: ScheduleRef
): Promise<ArrangementActionResult<{ updatedAt: string }>> {
  return reviewSchedule("service_schedules", input);
}

export async function reviewHandoverSchedule(
  input: ScheduleRef
): Promise<ArrangementActionResult<{ updatedAt: string }>> {
  return reviewSchedule("handover_schedules", input);
}

async function reviewSchedule(
  table: "service_schedules" | "handover_schedules",
  input: ScheduleRef
): Promise<ArrangementActionResult<{ updatedAt: string }>> {
  const g = await staffGuard();
  if (!g.ok) return fail(g.reason);
  if (!isUuid(input.schedule_id)) return fail("invalid", "schedule_id is not a uuid");
  try {
    const { data, error } = await g.db
      .from(table)
      .select(
        "id, status, created_by, updated_at, arrangement:service_arrangements!inner(tenant_id)"
      )
      .eq("id", input.schedule_id)
      .maybeSingle();
    if (error) return dbFailure(error.message);
    if (!data) return fail("not_found");
    const row = data as unknown as {
      id: string;
      status: "draft" | "issued" | "accepted" | "superseded";
      created_by: string | null;
      updated_at: string;
      arrangement: { tenant_id: string };
    };
    if (isStale(input.expected_updated_at, row.updated_at)) return fail("stale");
    const decision = canReviewSchedule(
      { status: row.status, createdBy: row.created_by },
      g.userId
    );
    if (!decision.ok)
      return fail(
        decision.problems.some((p) => p.code === "reviewer_is_author")
          ? "reviewer_is_author"
          : "invalid_transition",
        undefined,
        decision.problems
      );
    const reviewedAt = new Date().toISOString();
    const { data: updated, error: uErr } = await g.db
      .from(table)
      .update({ reviewed_by: g.userId, reviewed_at: reviewedAt })
      .eq("id", row.id)
      .eq("status", "draft")
      .eq("updated_at", row.updated_at)
      .select("updated_at")
      .maybeSingle();
    if (uErr) return dbFailure(uErr.message);
    if (!updated) return fail("stale");
    await logAudit({
      action: `${table === "service_schedules" ? "service_schedule" : "handover_schedule"}.reviewed`,
      target: `${table === "service_schedules" ? "service_schedule" : "handover_schedule"}:${row.id}`,
      tenantId: row.arrangement.tenant_id,
      metadata: { reviewer: g.userId, author: row.created_by, actor_email: g.email },
    });
    revalidate();
    return { ok: true, updatedAt: updated.updated_at as string };
  } catch (e) {
    return dbFailure(e);
  }
}

/**
 * Issue a reviewed service schedule: freezes a canonical snapshot + sha256,
 * stamps issued_by/at, supersedes any earlier issued (unaccepted) version.
 * The reviewer must differ from the issuer (server and 0059 CHECK).
 */
export async function issueServiceSchedule(
  input: ScheduleRef
): Promise<
  ArrangementActionResult<{
    updatedAt: string;
    documentHash: string;
    superseded: string[];
  }>
> {
  const g = await staffGuard();
  if (!g.ok) return fail(g.reason);
  if (!isUuid(input.schedule_id)) return fail("invalid", "schedule_id is not a uuid");
  try {
    const { data, error } = await g.db
      .from("service_schedules")
      .select("*")
      .eq("id", input.schedule_id)
      .maybeSingle();
    if (error) return dbFailure(error.message);
    if (!data) return fail("not_found");
    const row = data as ServiceScheduleRow;
    if (isStale(input.expected_updated_at, row.updated_at)) return fail("stale");
    const schedule = serviceScheduleFromRow(row);
    const decision = canIssueServiceSchedule(schedule, g.userId);
    if (!decision.ok) {
      const codes = decision.problems.map((p) => p.code);
      const reason: ArrangementActionFailure = codes.includes("invalid_transition")
        ? "invalid_transition"
        : codes.some(
              (c) =>
                c === "review_required" ||
                c === "reviewer_is_issuer" ||
                c === "reviewer_is_author"
            )
          ? "review_required"
          : "invalid";
      return fail(reason, undefined, decision.problems);
    }
    const arrangement = await loadArrangement(g.db, row.arrangement_id);
    if (!arrangement) return fail("not_found", "arrangement");

    const content = scheduleContentFromRow(row);
    const frozen = buildAcceptanceSnapshot({
      documentType: "service_schedule",
      documentId: row.id,
      versionNo: row.version_no,
      templateVersion: SERVICE_SCHEDULE_TEMPLATE,
      content: {
        ...content,
        usagePolicy: content.usagePolicy as never,
        responseTargets: content.responseTargets as never,
      },
    });
    const issuedAt = new Date().toISOString();
    const { data: updated, error: uErr } = await g.db
      .from("service_schedules")
      .update({
        status: "issued",
        issued_by: g.userId,
        issued_at: issuedAt,
        document_snapshot: frozen.snapshot,
        document_hash: frozen.hash,
      })
      .eq("id", row.id)
      .eq("status", "draft")
      .eq("updated_at", row.updated_at)
      .select("updated_at")
      .maybeSingle();
    if (uErr) return dbFailure(uErr.message);
    if (!updated) return fail("stale");

    const superseded = await supersedeSiblings(
      g.db,
      "service_schedules",
      row.arrangement_id,
      {
        id: row.id,
        status: "issued",
        versionNo: row.version_no,
      }
    );
    const kind = "service_schedule";
    await logAudit({
      action: `${kind}.issued`,
      target: `${kind}:${row.id}`,
      tenantId: arrangement.tenant_id,
      metadata: {
        version_no: row.version_no,
        document_hash: frozen.hash,
        template_version: SERVICE_SCHEDULE_TEMPLATE,
        reviewed_by: row.reviewed_by,
        issued_by: g.userId,
        superseded,
        amount_minor: content.amountMinor,
        currency: content.currency,
        cadence: content.cadence,
        start_date: content.startDate,
      },
    });
    for (const id of superseded)
      await logAudit({
        action: `${kind}.superseded`,
        target: `${kind}:${id}`,
        tenantId: arrangement.tenant_id,
        metadata: { superseded_by: row.id },
      });
    revalidate();
    return {
      ok: true,
      updatedAt: updated.updated_at as string,
      documentHash: frozen.hash,
      superseded,
    };
  } catch (e) {
    return dbFailure(e);
  }
}

async function supersedeSiblings(
  db: Db,
  table: "service_schedules" | "handover_schedules",
  arrangementId: string,
  successor: { id: string; status: "issued" | "accepted"; versionNo: number }
): Promise<string[]> {
  const { data, error } = await db
    .from(table)
    .select("id, status, version_no")
    .eq("arrangement_id", arrangementId);
  if (error) throw new Error(`${table} read failed: ${error.message}`);
  const versions = (
    (data ?? []) as {
      id: string;
      status: "draft" | "issued" | "accepted" | "superseded";
      version_no: number;
    }[]
  ).map((v) => ({ id: v.id, status: v.status, versionNo: v.version_no }));
  const losers = supersededBy(versions, successor);
  for (const id of losers) {
    const { error: uErr } = await db
      .from(table)
      .update({ status: "superseded", superseded_by: successor.id })
      .eq("id", id)
      .in("status", ["issued", "accepted"]);
    if (uErr) throw new Error(`${table} supersede failed: ${uErr.message}`);
  }
  return losers;
}

// ---------------------------------------------------------------------------
// Handover schedules (independent route)
// ---------------------------------------------------------------------------

export type DraftHandoverScheduleInput = {
  arrangement_id: string;
  fee_minor?: number;
  currency?: string;
  tax_basis?: TaxBasis;
  included_work?: string[];
  dependencies?: string[];
  cost_responsibility?: Record<string, unknown>;
  fee_disposition?: FeeDisposition;
};

/** Draft the handover schedule: £600 by default, tax basis pending (blocks issue until decided). */
export async function draftHandoverSchedule(
  input: DraftHandoverScheduleInput
): Promise<ArrangementActionResult<{ id: string; versionNo: number }>> {
  const g = await staffGuard();
  if (!g.ok) return fail(g.reason);
  if (!isUuid(input.arrangement_id))
    return fail("invalid", "arrangement_id is not a uuid");
  const defaults = defaultHandoverContent();
  const fee = input.fee_minor ?? defaults.feeMinor;
  if (!Number.isInteger(fee) || fee < 0) return fail("invalid", "fee_minor");
  const currency = (clean(input.currency) ?? defaults.currency).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) return fail("invalid", "currency");
  const taxBasis = input.tax_basis ?? defaults.taxBasis;
  if (!TAX_BASES.includes(taxBasis)) return fail("invalid", "tax_basis");
  const disposition = input.fee_disposition ?? defaults.feeDisposition;
  if (!FEE_DISPOSITIONS.includes(disposition)) return fail("invalid", "fee_disposition");

  try {
    const arrangement = await loadArrangement(g.db, input.arrangement_id);
    if (!arrangement) return fail("not_found");
    if (arrangement.state !== "active")
      return fail("invalid_transition", "arrangement superseded");
    if (arrangement.route !== "independent")
      return fail(
        "invalid_transition",
        "a handover schedule needs the independent route"
      );

    const { data: existing, error: vErr } = await g.db
      .from("handover_schedules")
      .select("version_no")
      .eq("arrangement_id", arrangement.id);
    if (vErr) return dbFailure(vErr.message);
    const versionNo = nextVersionNo(
      ((existing ?? []) as { version_no: number }[]).map((v) => ({
        versionNo: v.version_no,
      }))
    );

    const { data: row, error } = await g.db
      .from("handover_schedules")
      .insert({
        arrangement_id: arrangement.id,
        version_no: versionNo,
        fee_minor: fee,
        currency,
        tax_basis: taxBasis,
        included_work: stringList(input.included_work),
        dependencies: stringList(input.dependencies),
        cost_responsibility: plainObject(input.cost_responsibility),
        fee_disposition: disposition,
        status: "draft",
        created_by: g.userId,
      })
      .select("id")
      .single();
    if (error) return dbFailure(error.message);

    await logAudit({
      action: "handover_schedule.drafted",
      target: `handover_schedule:${row.id}`,
      tenantId: arrangement.tenant_id,
      metadata: {
        arrangement_id: arrangement.id,
        version_no: versionNo,
        fee_minor: fee,
        currency,
        tax_basis: taxBasis,
        fee_disposition: disposition,
        deviates_from_decision:
          fee !== defaults.feeMinor || currency !== defaults.currency,
      },
    });
    revalidate();
    return { ok: true, id: row.id as string, versionNo };
  } catch (e) {
    return dbFailure(e);
  }
}

/** Issue a reviewed handover schedule. Blocked while tax basis / fee disposition are pending. */
export async function issueHandoverSchedule(
  input: ScheduleRef
): Promise<
  ArrangementActionResult<{
    updatedAt: string;
    documentHash: string;
    superseded: string[];
  }>
> {
  const g = await staffGuard();
  if (!g.ok) return fail(g.reason);
  if (!isUuid(input.schedule_id)) return fail("invalid", "schedule_id is not a uuid");
  try {
    const { data, error } = await g.db
      .from("handover_schedules")
      .select("*")
      .eq("id", input.schedule_id)
      .maybeSingle();
    if (error) return dbFailure(error.message);
    if (!data) return fail("not_found");
    const row = data as HandoverScheduleRow;
    if (isStale(input.expected_updated_at, row.updated_at)) return fail("stale");
    const schedule = handoverScheduleFromRow(row);
    const decision = canIssueHandoverSchedule(schedule, g.userId);
    if (!decision.ok) {
      const codes = decision.problems.map((p) => p.code);
      const reason: ArrangementActionFailure = codes.includes("invalid_transition")
        ? "invalid_transition"
        : codes.some(
              (c) =>
                c === "review_required" ||
                c === "reviewer_is_issuer" ||
                c === "reviewer_is_author"
            )
          ? "review_required"
          : "invalid";
      return fail(reason, undefined, decision.problems);
    }
    const arrangement = await loadArrangement(g.db, row.arrangement_id);
    if (!arrangement) return fail("not_found", "arrangement");

    const content = handoverContentFromRow(row);
    const frozen = buildAcceptanceSnapshot({
      documentType: "handover_schedule",
      documentId: row.id,
      versionNo: row.version_no,
      templateVersion: HANDOVER_SCHEDULE_TEMPLATE,
      content: {
        ...content,
        costResponsibility: content.costResponsibility as never,
        ongoingManagement: "none",
        runSubscription: null,
      },
    });
    const issuedAt = new Date().toISOString();
    const { data: updated, error: uErr } = await g.db
      .from("handover_schedules")
      .update({
        status: "issued",
        issued_by: g.userId,
        issued_at: issuedAt,
        document_snapshot: frozen.snapshot,
        document_hash: frozen.hash,
      })
      .eq("id", row.id)
      .eq("status", "draft")
      .eq("updated_at", row.updated_at)
      .select("updated_at")
      .maybeSingle();
    if (uErr) return dbFailure(uErr.message);
    if (!updated) return fail("stale");

    const superseded = await supersedeSiblings(
      g.db,
      "handover_schedules",
      row.arrangement_id,
      {
        id: row.id,
        status: "issued",
        versionNo: row.version_no,
      }
    );
    await logAudit({
      action: "handover_schedule.issued",
      target: `handover_schedule:${row.id}`,
      tenantId: arrangement.tenant_id,
      metadata: {
        version_no: row.version_no,
        document_hash: frozen.hash,
        template_version: HANDOVER_SCHEDULE_TEMPLATE,
        fee_minor: content.feeMinor,
        currency: content.currency,
        tax_basis: content.taxBasis,
        fee_disposition: content.feeDisposition,
        reviewed_by: row.reviewed_by,
        issued_by: g.userId,
        superseded,
        run_subscription_created: false,
      },
    });
    for (const id of superseded)
      await logAudit({
        action: "handover_schedule.superseded",
        target: `handover_schedule:${id}`,
        tenantId: arrangement.tenant_id,
        metadata: { superseded_by: row.id },
      });
    revalidate();
    return {
      ok: true,
      updatedAt: updated.updated_at as string,
      documentHash: frozen.hash,
      superseded,
    };
  } catch (e) {
    return dbFailure(e);
  }
}

// ---------------------------------------------------------------------------
// Client acceptance (portal signatory only)
// ---------------------------------------------------------------------------

export type AcceptScheduleInput = {
  schedule_id: string;
  accepted_by_name: string;
  accepted_role: string;
  authority_confirmed: boolean;
};

type Signer =
  | {
      ok: true;
      userId: string;
      email: string;
      membershipRole: string | null;
      membershipTenantId: string | null;
    }
  | { ok: false; reason: ArrangementActionFailure };

/**
 * Resolve the signer: the cookie user, then their membership on the given
 * tenant read with the service client AFTER the tenant is known from the
 * schedule row — never from the caller. Staff-wide RLS visibility is not a
 * membership; a staff member who is not a member of the tenant is refused.
 */
async function resolveSigner(tenantId: string): Promise<Signer> {
  if (!flagOn("commercialV2")) return { ok: false, reason: "flag_off" };
  if (await isClientPreview()) return { ok: false, reason: "preview" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "unauthenticated" };
  const service = createServiceClient();
  const { data: membership, error } = await service
    .from("memberships")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) return { ok: false, reason: "db_error" };
  return {
    ok: true,
    userId: user.id,
    email: user.email ?? "",
    membershipRole: (membership?.role as string | undefined) ?? null,
    membershipTenantId: (membership?.tenant_id as string | undefined) ?? null,
  };
}

async function requestEvidence(): Promise<{
  ip: string | null;
  userAgent: string | null;
}> {
  const h = await headers();
  return {
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null,
    userAgent: h.get("user-agent"),
  };
}

/**
 * The client's authorised signatory accepts an issued service schedule.
 * Verifies the frozen snapshot against its hash before recording; records
 * who, when, how, IP/UA and the hash; marks the arrangement's package
 * accepted; supersedes any earlier accepted version. Creates no subscription.
 */
export async function acceptServiceSchedule(
  input: AcceptScheduleInput
): Promise<ArrangementActionResult<{ acceptedAt: string; documentHash: string }>> {
  return acceptSchedule("service_schedules", input);
}

/** The client's authorised signatory accepts an issued handover schedule (£600 appears once). */
export async function acceptHandoverSchedule(
  input: AcceptScheduleInput
): Promise<ArrangementActionResult<{ acceptedAt: string; documentHash: string }>> {
  return acceptSchedule("handover_schedules", input);
}

async function acceptSchedule(
  table: "service_schedules" | "handover_schedules",
  input: AcceptScheduleInput
): Promise<ArrangementActionResult<{ acceptedAt: string; documentHash: string }>> {
  if (!flagOn("commercialV2")) return fail("flag_off");
  if (!isUuid(input.schedule_id)) return fail("invalid", "schedule_id is not a uuid");
  const name = clean(input.accepted_by_name);
  const role = clean(input.accepted_role);
  if (!name || !role) return fail("invalid", "name and role are required");
  const kind = table === "service_schedules" ? "service_schedule" : "handover_schedule";

  try {
    // Read the schedule with the service client: the base table has no client
    // policy by design. The tenant comes from the row, never from the caller.
    const service = createServiceClient();
    const { data, error } = await service
      .from(table)
      .select("*, arrangement:service_arrangements!inner(id, tenant_id, state, route)")
      .eq("id", input.schedule_id)
      .maybeSingle();
    if (error) return dbFailure(error.message);
    if (!data) return fail("not_found");
    const row = data as unknown as (ServiceScheduleRow | HandoverScheduleRow) & {
      arrangement: { id: string; tenant_id: string; state: string; route: string };
    };
    const tenantId = row.arrangement.tenant_id;

    const signer = await resolveSigner(tenantId);
    if (!signer.ok) return fail(signer.reason);

    const snapshot = row.document_snapshot as AcceptanceSnapshot | null;
    const verified = verifySnapshot(snapshot as never, row.document_hash);
    const decision = canAcceptSchedule(
      { status: row.status, documentHash: row.document_hash, snapshotVerified: verified },
      tenantId,
      {
        userId: signer.userId,
        membershipRole: signer.membershipRole,
        membershipTenantId: signer.membershipTenantId,
        name,
        authorityConfirmed: !!input.authority_confirmed,
      }
    );
    if (!decision.ok) {
      const codes = decision.problems.map((p) => p.code);
      const reason: ArrangementActionFailure =
        codes.includes("not_member") || codes.includes("not_signatory")
          ? "forbidden"
          : codes.includes("snapshot_invalid")
            ? "snapshot_invalid"
            : codes.includes("not_issued")
              ? "invalid_transition"
              : "invalid";
      return fail(reason, undefined, decision.problems);
    }
    if (row.arrangement.state !== "active")
      return fail("invalid_transition", "the arrangement has been superseded");
    // Belt and braces: the accepted terms are read from the snapshot, never
    // the live row; if that read fails the acceptance does not proceed.
    if (!acceptedContent(snapshot, row.document_hash)) return fail("snapshot_invalid");

    const evidence = await requestEvidence();
    const acceptedAt = new Date().toISOString();
    const { data: updated, error: uErr } = await service
      .from(table)
      .update({
        status: "accepted",
        accepted_at: acceptedAt,
        accepted_by_user: signer.userId,
        accepted_by_name: name,
        accepted_role: role,
        acceptance_method: "clickwrap",
        ip_address: evidence.ip,
        user_agent: evidence.userAgent,
      })
      .eq("id", row.id)
      .eq("status", "issued")
      .select("id")
      .maybeSingle();
    if (uErr) return dbFailure(uErr.message);
    if (!updated) return fail("stale", "the schedule is no longer issued");

    const superseded = await supersedeSiblings(
      service as unknown as Db,
      table,
      row.arrangement.id,
      {
        id: row.id,
        status: "accepted",
        versionNo: row.version_no,
      }
    );
    if (table === "service_schedules") {
      const { error: aErr } = await service
        .from("service_arrangements")
        .update({ package_state: "accepted" })
        .eq("id", row.arrangement.id)
        .eq("route", "managed");
      if (aErr) return dbFailure(aErr.message);
    }

    await logAudit({
      action: `${kind}.accepted`,
      target: `${kind}:${row.id}`,
      tenantId,
      metadata: {
        version_no: row.version_no,
        document_hash: row.document_hash,
        accepted_by: signer.email,
        accepted_role: role,
        membership_role: signer.membershipRole,
        acceptance_method: "clickwrap",
        superseded,
        subscription_created: false,
        collection_scheduled: false,
      },
    });
    for (const id of superseded)
      await logAudit({
        action: `${kind}.superseded`,
        target: `${kind}:${id}`,
        tenantId,
        metadata: { superseded_by: row.id },
      });
    revalidate();
    return { ok: true, acceptedAt, documentHash: row.document_hash as string };
  } catch (e) {
    return dbFailure(e);
  }
}
