"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@nullshift/db";
import { requireStaff } from "@nullshift/auth/guards";
import { logAudit } from "@nullshift/db/audit";
import { flagOn } from "@/lib/flags";
import { isClientPreview } from "@/lib/clientPreview";
import * as repo from "@/lib/commercial/repo";
import {
  canCreateNextVersion,
  canTransition,
  checkApproval,
  checkIssue,
  expiryFor,
  isBelowFloor,
  isStale,
} from "@/lib/commercial/stateMachine";
import {
  OPPORTUNITY_STAGES,
  type ActionFailure,
  type ActionResult,
  type OpportunityStage,
  type QuoteVersionContent,
} from "@/lib/commercial/types";

/**
 * Quote lifecycle server actions (brief §5.2, §5.3, §12.5), Phase 2.
 *
 * Every action: `commercialV2` flag → requireStaff → never under a client
 * preview cookie → RLS client → audit_log row. With the flag off each one is
 * a no-op returning { ok: false, reason: "flag_off" }, so production behaviour
 * is unchanged until the flag is set. Ids arriving from the browser are only
 * ever used after the row has been loaded and its relations checked.
 */

const LIST_PATH = "/admin/next/quotes";
// Draft placeholders, not an approved policy (brief §6.5, Phase 0 decision 18.2).
const POLICY_VERSION = "policy-draft-2026-09";
const FORMULA_VERSION = "formula-draft-1";

type Guard =
  | { ok: true; userId: string; email: string; db: repo.Db }
  | { ok: false; reason: ActionFailure };

async function guard(): Promise<Guard> {
  if (!flagOn("commercialV2")) return { ok: false, reason: "flag_off" };
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

function fail(reason: ActionFailure, detail?: string): ActionResult<never> {
  return detail ? { ok: false, reason, detail } : { ok: false, reason };
}

function dbFailure(e: unknown): ActionResult<never> {
  const message = e instanceof Error ? e.message : String(e);
  console.error("commercial action:", message);
  return fail("db_error", message);
}

function revalidate() {
  revalidatePath(LIST_PATH);
  revalidatePath("/admin/next/sales");
}

// ---------------------------------------------------------------------------
// Opportunities
// ---------------------------------------------------------------------------

export type CreateOpportunityInput = {
  legal_name: string;
  trading_name?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  stage?: OpportunityStage;
  owner?: string | null;
  next_action?: string | null;
  next_action_due?: string | null;
  probability_pct?: number | null;
  source?: string | null;
  /** Existing client, when the opportunity belongs to one. Verified server-side. */
  tenant_id?: string | null;
};

export async function createOpportunity(
  input: CreateOpportunityInput
): Promise<ActionResult<{ id: string }>> {
  const g = await guard();
  if (!g.ok) return fail(g.reason);

  const legalName = clean(input.legal_name);
  if (!legalName) return fail("invalid", "legal_name is required");
  const stage = input.stage ?? "new_enquiry";
  if (!OPPORTUNITY_STAGES.includes(stage)) return fail("invalid", "unknown stage");
  const probability =
    input.probability_pct === null || input.probability_pct === undefined
      ? null
      : Number.isInteger(input.probability_pct) &&
          input.probability_pct >= 0 &&
          input.probability_pct <= 100
        ? input.probability_pct
        : undefined;
  if (probability === undefined) return fail("invalid", "probability_pct must be 0–100");

  let tenantId: string | null = null;
  if (input.tenant_id) {
    if (!repo.isUuid(input.tenant_id)) return fail("invalid", "tenant_id is not a uuid");
    const { data, error } = await g.db
      .from("tenants")
      .select("id")
      .eq("id", input.tenant_id)
      .maybeSingle();
    if (error) return dbFailure(error.message);
    if (!data) return fail("not_found", "tenant");
    tenantId = input.tenant_id;
  }

  try {
    const row = await repo.insertOpportunity(g.db, {
      tenant_id: tenantId,
      legal_name: legalName,
      trading_name: clean(input.trading_name),
      contact_name: clean(input.contact_name),
      contact_email: clean(input.contact_email),
      contact_phone: clean(input.contact_phone),
      stage,
      owner: clean(input.owner),
      next_action: clean(input.next_action),
      next_action_due: clean(input.next_action_due),
      probability_pct: probability,
      source: clean(input.source),
      created_by: g.userId,
    });
    await logAudit({
      action: "opportunity.created",
      target: `opportunity:${row.id}`,
      tenantId,
      metadata: { stage, actor_email: g.email },
    });
    revalidate();
    return { ok: true, id: row.id };
  } catch (e) {
    return dbFailure(e);
  }
}

// ---------------------------------------------------------------------------
// Quote drafts
// ---------------------------------------------------------------------------

export type CreateQuoteDraftInput = {
  opportunity_id: string;
  project_label: string;
  content?: Partial<QuoteVersionContent>;
};

export async function createQuoteDraft(
  input: CreateQuoteDraftInput
): Promise<ActionResult<{ quoteId: string; versionId: string; updatedAt: string }>> {
  const g = await guard();
  if (!g.ok) return fail(g.reason);
  if (!repo.isUuid(input.opportunity_id))
    return fail("invalid", "opportunity_id is not a uuid");
  const label = clean(input.project_label);
  if (!label) return fail("invalid", "project_label is required");

  try {
    const opportunity = await repo.getOpportunity(g.db, input.opportunity_id);
    if (!opportunity) return fail("not_found", "opportunity");

    // tenant_id is copied from the opportunity, never taken from the caller.
    const quote = await repo.insertQuote(g.db, {
      opportunity_id: opportunity.id,
      tenant_id: opportunity.tenant_id,
      project_label: label,
    });
    const version = await repo.insertVersion(g.db, {
      quote_id: quote.id,
      version_no: 1,
      status: "draft",
      currency: "GBP",
      author: g.userId,
      policy_version: POLICY_VERSION,
      formula_version: FORMULA_VERSION,
      ...(input.content ?? {}),
    });
    await logAudit({
      action: "quote.draft_created",
      target: `quote_version:${version.id}`,
      tenantId: quote.tenant_id,
      metadata: { quote_id: quote.id, opportunity_id: opportunity.id, version_no: 1 },
    });
    revalidate();
    return {
      ok: true,
      quoteId: quote.id,
      versionId: version.id,
      updatedAt: version.updated_at,
    };
  } catch (e) {
    return dbFailure(e);
  }
}

export type SaveDraftInput = {
  version_id: string;
  /** The updated_at the tab last rendered. Mismatch → { ok: false, reason: "stale" }. */
  expected_updated_at: string;
  content: Partial<QuoteVersionContent>;
};

const CONTENT_KEYS = ["brief", "scope", "estimate", "commercial", "internal"] as const;

export async function saveDraft(
  input: SaveDraftInput
): Promise<ActionResult<{ updatedAt: string }>> {
  const g = await guard();
  if (!g.ok) return fail(g.reason);
  if (!repo.isUuid(input.version_id)) return fail("invalid", "version_id is not a uuid");
  if (!clean(input.expected_updated_at))
    return fail("invalid", "expected_updated_at is required");

  const patch: Record<string, unknown> = {};
  for (const key of CONTENT_KEYS) {
    const value = input.content[key];
    if (value && typeof value === "object") patch[key] = value;
  }
  if (Object.keys(patch).length === 0) return fail("invalid", "nothing to save");

  try {
    const result = await repo.guardedUpdateVersion(
      g.db,
      input.version_id,
      input.expected_updated_at,
      ["draft", "internal_review"],
      patch
    );
    if (!result.ok) return fail(result.reason, result.detail);
    const ctx = await repo.getVersionContext(g.db, input.version_id);
    await logAudit({
      action: "quote_version.saved",
      target: `quote_version:${input.version_id}`,
      tenantId: ctx?.quote.tenant_id ?? null,
      metadata: { fields: Object.keys(patch) },
    });
    revalidate();
    return { ok: true, updatedAt: result.row.updated_at };
  } catch (e) {
    return dbFailure(e);
  }
}

// ---------------------------------------------------------------------------
// Review and approval
// ---------------------------------------------------------------------------

export type VersionRef = { version_id: string; expected_updated_at: string };

export async function requestApproval(
  input: VersionRef
): Promise<ActionResult<{ updatedAt: string }>> {
  const g = await guard();
  if (!g.ok) return fail(g.reason);
  if (!repo.isUuid(input.version_id)) return fail("invalid", "version_id is not a uuid");

  try {
    const ctx = await repo.getVersionContext(g.db, input.version_id);
    if (!ctx) return fail("not_found");
    if (isStale(input.expected_updated_at, ctx.version.updated_at)) return fail("stale");
    if (!canTransition(ctx.version.status, "internal_review"))
      return fail("invalid_transition");

    const result = await repo.guardedUpdateVersion(
      g.db,
      ctx.version.id,
      input.expected_updated_at,
      ["draft"],
      { status: "internal_review" }
    );
    if (!result.ok) return fail(result.reason, result.detail);

    const preQuote: OpportunityStage[] = [
      "new_enquiry",
      "qualified",
      "discovery",
      "scope_ready",
    ];
    if (preQuote.includes(ctx.opportunity.stage)) {
      await repo.setOpportunityStage(g.db, ctx.opportunity.id, "quote_in_review");
    }
    await logAudit({
      action: "quote_version.approval_requested",
      target: `quote_version:${ctx.version.id}`,
      tenantId: ctx.quote.tenant_id,
      metadata: { quote_id: ctx.quote.id, version_no: ctx.version.version_no },
    });
    revalidate();
    return { ok: true, updatedAt: result.row.updated_at };
  } catch (e) {
    return dbFailure(e);
  }
}

export type ApproveInput = VersionRef & { reason?: string | null };

/**
 * Approve to issue. The approver must differ from the author (checked here
 * and by the 0057 trigger) and a below-floor price needs a written reason.
 */
export async function approveToIssue(
  input: ApproveInput
): Promise<ActionResult<{ updatedAt: string; belowFloor: boolean }>> {
  const g = await guard();
  if (!g.ok) return fail(g.reason);
  if (!repo.isUuid(input.version_id)) return fail("invalid", "version_id is not a uuid");

  try {
    const ctx = await repo.getVersionContext(g.db, input.version_id);
    if (!ctx) return fail("not_found");
    if (isStale(input.expected_updated_at, ctx.version.updated_at)) return fail("stale");

    const belowFloor = isBelowFloor(ctx.version.commercial, ctx.version.internal);
    const reason = clean(input.reason);
    const check = checkApproval({
      status: ctx.version.status,
      authorId: ctx.version.author,
      approverId: g.userId,
      belowFloor,
      reason,
    });
    if (!check.ok) return fail(check.reason);

    const result = await repo.guardedUpdateVersion(
      g.db,
      ctx.version.id,
      input.expected_updated_at,
      ["internal_review"],
      { status: "approved_to_issue" }
    );
    if (!result.ok) return fail(result.reason, result.detail);

    let approvalId: string;
    try {
      const approval = await repo.insertApproval(g.db, {
        version_id: ctx.version.id,
        approver: g.userId,
        decision: "approve",
        reason,
        below_floor: belowFloor,
      });
      approvalId = approval.id;
    } catch (e) {
      // No evidence row → no approval. Put the version back and report.
      await repo.guardedUpdateVersion(g.db, ctx.version.id, null, ["approved_to_issue"], {
        status: "internal_review",
      });
      return dbFailure(e);
    }

    await logAudit({
      action: "quote_version.approved_to_issue",
      target: `quote_version:${ctx.version.id}`,
      tenantId: ctx.quote.tenant_id,
      metadata: {
        approval_id: approvalId,
        below_floor: belowFloor,
        reason,
        author: ctx.version.author,
        approver: g.userId,
      },
    });
    revalidate();
    return { ok: true, updatedAt: result.row.updated_at, belowFloor };
  } catch (e) {
    return dbFailure(e);
  }
}

/** Reviewer sends the version back with a reject decision recorded as evidence. */
export async function returnToDraft(
  input: ApproveInput
): Promise<ActionResult<{ updatedAt: string }>> {
  const g = await guard();
  if (!g.ok) return fail(g.reason);
  if (!repo.isUuid(input.version_id)) return fail("invalid", "version_id is not a uuid");

  try {
    const ctx = await repo.getVersionContext(g.db, input.version_id);
    if (!ctx) return fail("not_found");
    if (isStale(input.expected_updated_at, ctx.version.updated_at)) return fail("stale");
    if (!canTransition(ctx.version.status, "draft")) return fail("invalid_transition");

    const result = await repo.guardedUpdateVersion(
      g.db,
      ctx.version.id,
      input.expected_updated_at,
      ["internal_review", "approved_to_issue"],
      { status: "draft" }
    );
    if (!result.ok) return fail(result.reason, result.detail);

    if (ctx.version.author !== g.userId) {
      await repo.insertApproval(g.db, {
        version_id: ctx.version.id,
        approver: g.userId,
        decision: "reject",
        reason: clean(input.reason),
        below_floor: isBelowFloor(ctx.version.commercial, ctx.version.internal),
      });
    }
    await logAudit({
      action: "quote_version.returned_to_draft",
      target: `quote_version:${ctx.version.id}`,
      tenantId: ctx.quote.tenant_id,
      metadata: { from: ctx.version.status, reason: clean(input.reason) },
    });
    revalidate();
    return { ok: true, updatedAt: result.row.updated_at };
  } catch (e) {
    return dbFailure(e);
  }
}

// ---------------------------------------------------------------------------
// Issue and versions
// ---------------------------------------------------------------------------

export type IssueInput = VersionRef & { expires_at?: string | null };

/**
 * Issue: freezes the version (status leaves the editable pair, so the 0057
 * trigger refuses content changes from here on), stamps issued_at and an
 * explicit expiry, supersedes any live prior version of the same quote and
 * makes this the quote's current version.
 */
export async function issue(
  input: IssueInput
): Promise<ActionResult<{ updatedAt: string; expiresAt: string; superseded: string[] }>> {
  const g = await guard();
  if (!g.ok) return fail(g.reason);
  if (!repo.isUuid(input.version_id)) return fail("invalid", "version_id is not a uuid");

  try {
    const ctx = await repo.getVersionContext(g.db, input.version_id);
    if (!ctx) return fail("not_found");
    const hasApproval = await repo.hasApproveDecision(g.db, ctx.version.id);
    const check = checkIssue({
      status: ctx.version.status,
      hasApproval,
      expectedUpdatedAt: input.expected_updated_at,
      actualUpdatedAt: ctx.version.updated_at,
    });
    if (!check.ok) return fail(check.reason);

    const now = new Date();
    const requested = input.expires_at ? new Date(input.expires_at) : null;
    if (requested && Number.isNaN(requested.getTime()))
      return fail("invalid", "expires_at");
    const expiresAt = expiryFor(now, requested);

    const result = await repo.guardedUpdateVersion(
      g.db,
      ctx.version.id,
      input.expected_updated_at,
      ["approved_to_issue"],
      {
        status: "issued",
        issued_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      }
    );
    if (!result.ok) return fail(result.reason, result.detail);

    const superseded = await repo.supersedePriorVersions(
      g.db,
      ctx.quote.id,
      ctx.version.id
    );
    await repo.setQuoteCurrentVersion(g.db, ctx.quote.id, ctx.version.id);
    if (
      ctx.opportunity.stage !== "won" &&
      ctx.opportunity.stage !== "lost" &&
      ctx.opportunity.stage !== "negotiation"
    ) {
      await repo.setOpportunityStage(g.db, ctx.opportunity.id, "sent");
    }

    await logAudit({
      action: "quote_version.issued",
      target: `quote_version:${ctx.version.id}`,
      tenantId: ctx.quote.tenant_id,
      metadata: {
        quote_id: ctx.quote.id,
        version_no: ctx.version.version_no,
        expires_at: expiresAt.toISOString(),
        superseded,
        policy_version: ctx.version.policy_version,
        formula_version: ctx.version.formula_version,
      },
    });
    for (const id of superseded) {
      await logAudit({
        action: "quote_version.superseded",
        target: `quote_version:${id}`,
        tenantId: ctx.quote.tenant_id,
        metadata: { superseded_by: ctx.version.id },
      });
    }
    revalidate();
    return {
      ok: true,
      updatedAt: result.row.updated_at,
      expiresAt: expiresAt.toISOString(),
      superseded,
    };
  } catch (e) {
    return dbFailure(e);
  }
}

/**
 * Next version from an issued or accepted one: copies the content into a new
 * draft (version_no + 1) by the current user. The parent is untouched until
 * the new version is issued, at which point it is marked superseded.
 */
export async function createNextVersion(input: {
  version_id: string;
}): Promise<ActionResult<{ versionId: string; versionNo: number; updatedAt: string }>> {
  const g = await guard();
  if (!g.ok) return fail(g.reason);
  if (!repo.isUuid(input.version_id)) return fail("invalid", "version_id is not a uuid");

  try {
    const ctx = await repo.getVersionContext(g.db, input.version_id);
    if (!ctx) return fail("not_found");
    if (!canCreateNextVersion(ctx.version.status)) return fail("invalid_transition");

    const versionNo = await repo.nextVersionNo(g.db, ctx.quote.id);
    const next = await repo.insertVersion(g.db, {
      quote_id: ctx.quote.id,
      version_no: versionNo,
      status: "draft",
      currency: ctx.version.currency,
      author: g.userId,
      policy_version: ctx.version.policy_version,
      formula_version: ctx.version.formula_version,
      brief: {
        outcomes: [],
        users: "",
        constraints: "",
        confidence: "low",
        ...ctx.version.brief,
      },
      scope: { included: [], excluded: [], acceptance: [], ...ctx.version.scope },
      estimate: {
        packages: [],
        contingency_pct: 0,
        warranty_reserve_minor: 0,
        ...ctx.version.estimate,
      },
      commercial: {
        build_price_minor: 0,
        milestones: [],
        route: "unresolved",
        run_state: "Not assessed",
        grow_options: [],
        transact: "Unknown",
        ...ctx.version.commercial,
      },
      internal: {
        risk_adjusted_cost_minor: 0,
        min_margin_pct: 0,
        target_margin_pct: 0,
        approved_price_minor: 0,
        approver: "—",
        checks: [],
        ...ctx.version.internal,
      },
    });
    await logAudit({
      action: "quote_version.next_created",
      target: `quote_version:${next.id}`,
      tenantId: ctx.quote.tenant_id,
      metadata: { parent_version_id: ctx.version.id, version_no: versionNo },
    });
    revalidate();
    return { ok: true, versionId: next.id, versionNo, updatedAt: next.updated_at };
  } catch (e) {
    return dbFailure(e);
  }
}

// ---------------------------------------------------------------------------
// Form adapters for the listing page (server-rendered <form action>). They
// wrap the actions above and report through ?notice= so no client component
// is needed. The redirect throws, which is how Next signals it.
// ---------------------------------------------------------------------------

const describe = (
  r: { ok: boolean; reason?: string; detail?: string },
  okText: string
) =>
  r.ok ? `ok:${okText}` : `err:${r.reason ?? "unknown"}${r.detail ? `:${r.detail}` : ""}`;

function toList(notice: string): never {
  redirect(`${LIST_PATH}?notice=${encodeURIComponent(notice.slice(0, 200))}`);
}

export async function createDraftFromForm(formData: FormData): Promise<void> {
  const legalName = clean(formData.get("legal_name"));
  const projectLabel = clean(formData.get("project_label"));
  if (!legalName || !projectLabel)
    toList("err:invalid:legal name and project label are required");

  const opp = await createOpportunity({
    legal_name: legalName,
    contact_email: clean(formData.get("contact_email")),
    owner: clean(formData.get("owner")),
    stage: "scope_ready",
    source: "admin/next/quotes",
  });
  if (!opp.ok) toList(describe(opp, ""));

  const draft = await createQuoteDraft({
    opportunity_id: opp.id,
    project_label: projectLabel,
  });
  toList(describe(draft, draft.ok ? `draft v1 created (${draft.versionId})` : ""));
}

function refFrom(formData: FormData): VersionRef {
  return {
    version_id: String(formData.get("version_id") ?? ""),
    expected_updated_at: String(formData.get("expected_updated_at") ?? ""),
  };
}

export async function requestApprovalFromForm(formData: FormData): Promise<void> {
  toList(describe(await requestApproval(refFrom(formData)), "sent for internal review"));
}

export async function approveFromForm(formData: FormData): Promise<void> {
  const r = await approveToIssue({
    ...refFrom(formData),
    reason: clean(formData.get("reason")),
  });
  toList(
    describe(
      r,
      r.ok && r.belowFloor
        ? "approved below floor (reason recorded)"
        : "approved to issue"
    )
  );
}

export async function returnToDraftFromForm(formData: FormData): Promise<void> {
  toList(
    describe(
      await returnToDraft({
        ...refFrom(formData),
        reason: clean(formData.get("reason")),
      }),
      "returned to draft"
    )
  );
}

export async function issueFromForm(formData: FormData): Promise<void> {
  const r = await issue({
    ...refFrom(formData),
    expires_at: clean(formData.get("expires_at")),
  });
  toList(
    describe(
      r,
      r.ok
        ? `issued, expires ${r.expiresAt.slice(0, 10)}${r.superseded.length ? `, superseded ${r.superseded.length}` : ""}`
        : ""
    )
  );
}

export async function nextVersionFromForm(formData: FormData): Promise<void> {
  const r = await createNextVersion({
    version_id: String(formData.get("version_id") ?? ""),
  });
  toList(describe(r, r.ok ? `draft v${r.versionNo} created` : ""));
}
