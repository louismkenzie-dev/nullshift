/**
 * Data access for migration 0057. Every function takes the caller's cookie
 * (RLS) client so `is_internal_staff()` and the audit stamp trigger see the
 * real actor; nothing here uses the service role. Callers check the
 * `commercialV2` flag before reaching this module.
 */
import type { createClient } from "@nullshift/db";
import type {
  OpportunityRow,
  QuoteApprovalRow,
  QuoteRow,
  QuoteVersionContent,
  QuoteVersionListItem,
  QuoteVersionRow,
  QuoteVersionStatus,
} from "./types";

export type Db = Awaited<ReturnType<typeof createClient>>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: string): boolean => UUID_RE.test(v);

/** Embedded select that names the FK so the quotes ⇄ quote_versions pair is unambiguous. */
const VERSION_WITH_CONTEXT =
  "*, quote:quotes!quote_versions_quote_id_fkey(*, opportunity:opportunities!quotes_opportunity_id_fkey(*))";

type EmbeddedVersion = QuoteVersionRow & {
  quote: (QuoteRow & { opportunity: OpportunityRow | null }) | null;
};

function unpack(row: EmbeddedVersion | null): QuoteVersionListItem | null {
  if (!row || !row.quote || !row.quote.opportunity) return null;
  const opportunity: OpportunityRow = row.quote.opportunity;
  const { quote, ...version } = row;
  const { opportunity: _dropped, ...quoteRow } = quote;
  void _dropped;
  return {
    version: version as QuoteVersionRow,
    quote: quoteRow as QuoteRow,
    opportunity,
  };
}

export async function getVersion(db: Db, id: string): Promise<QuoteVersionRow | null> {
  const { data, error } = await db
    .from("quote_versions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`quote_versions read failed: ${error.message}`);
  return (data as QuoteVersionRow | null) ?? null;
}

export async function getVersionContext(
  db: Db,
  id: string
): Promise<QuoteVersionListItem | null> {
  const { data, error } = await db
    .from("quote_versions")
    .select(VERSION_WITH_CONTEXT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`quote_versions read failed: ${error.message}`);
  return unpack(data as unknown as EmbeddedVersion | null);
}

export async function getQuote(db: Db, id: string): Promise<QuoteRow | null> {
  const { data, error } = await db.from("quotes").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`quotes read failed: ${error.message}`);
  return (data as QuoteRow | null) ?? null;
}

export async function getOpportunity(db: Db, id: string): Promise<OpportunityRow | null> {
  const { data, error } = await db
    .from("opportunities")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`opportunities read failed: ${error.message}`);
  return (data as OpportunityRow | null) ?? null;
}

export async function listQuoteVersions(
  db: Db,
  limit = 200
): Promise<QuoteVersionListItem[]> {
  const { data, error } = await db
    .from("quote_versions")
    .select(VERSION_WITH_CONTEXT)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`quote_versions list failed: ${error.message}`);
  const rows = (data ?? []) as unknown as EmbeddedVersion[];
  return rows.map(unpack).filter((r): r is QuoteVersionListItem => r !== null);
}

export async function latestVersionForQuote(
  db: Db,
  quoteId: string
): Promise<QuoteVersionRow | null> {
  const { data, error } = await db
    .from("quote_versions")
    .select("*")
    .eq("quote_id", quoteId)
    .order("version_no", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`quote_versions read failed: ${error.message}`);
  return (data as QuoteVersionRow | null) ?? null;
}

export async function nextVersionNo(db: Db, quoteId: string): Promise<number> {
  const latest = await latestVersionForQuote(db, quoteId);
  return (latest?.version_no ?? 0) + 1;
}

export type OpportunityInsert = {
  tenant_id: string | null;
  legal_name: string;
  trading_name: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  stage: OpportunityRow["stage"];
  owner: string | null;
  next_action: string | null;
  next_action_due: string | null;
  probability_pct: number | null;
  source: string | null;
  created_by: string;
};

export async function insertOpportunity(
  db: Db,
  input: OpportunityInsert
): Promise<OpportunityRow> {
  const { data, error } = await db
    .from("opportunities")
    .insert(input)
    .select("*")
    .single();
  if (error) throw new Error(`opportunities insert failed: ${error.message}`);
  return data as OpportunityRow;
}

export async function insertQuote(
  db: Db,
  input: { opportunity_id: string; tenant_id: string | null; project_label: string }
): Promise<QuoteRow> {
  const { data, error } = await db.from("quotes").insert(input).select("*").single();
  if (error) throw new Error(`quotes insert failed: ${error.message}`);
  return data as QuoteRow;
}

export type VersionInsert = {
  quote_id: string;
  version_no: number;
  status: "draft";
  currency: string;
  author: string;
  policy_version: string | null;
  formula_version: string | null;
} & Partial<QuoteVersionContent>;

export async function insertVersion(
  db: Db,
  input: VersionInsert
): Promise<QuoteVersionRow> {
  const { data, error } = await db
    .from("quote_versions")
    .insert(input)
    .select("*")
    .single();
  if (error) throw new Error(`quote_versions insert failed: ${error.message}`);
  return data as QuoteVersionRow;
}

export type GuardedUpdate =
  | { ok: true; row: QuoteVersionRow }
  | {
      ok: false;
      reason: "stale" | "not_found" | "not_editable" | "invalid_transition" | "db_error";
      detail?: string;
    };

/**
 * Optimistic-concurrency update: the row must still carry `expectedUpdatedAt`
 * and (when `fromStatuses` is given) one of those statuses. PostgREST applies
 * the filters inside the UPDATE, so a concurrent save cannot slip between the
 * read and the write. When nothing matches, one follow-up read explains why.
 */
export async function guardedUpdateVersion(
  db: Db,
  id: string,
  expectedUpdatedAt: string | null,
  fromStatuses: readonly QuoteVersionStatus[] | null,
  patch: Record<string, unknown>
): Promise<GuardedUpdate> {
  let q = db.from("quote_versions").update(patch).eq("id", id);
  if (expectedUpdatedAt !== null) q = q.eq("updated_at", expectedUpdatedAt);
  if (fromStatuses) q = q.in("status", [...fromStatuses]);
  const { data, error } = await q.select("*").maybeSingle();
  if (error) return { ok: false, reason: "db_error", detail: error.message };
  if (data) return { ok: true, row: data as QuoteVersionRow };

  const current = await getVersion(db, id);
  if (!current) return { ok: false, reason: "not_found" };
  if (fromStatuses && !fromStatuses.includes(current.status)) {
    return {
      ok: false,
      reason: fromStatuses.length === 2 ? "not_editable" : "invalid_transition",
    };
  }
  return { ok: false, reason: "stale" };
}

export async function insertApproval(
  db: Db,
  input: {
    version_id: string;
    approver: string;
    decision: "approve" | "reject";
    reason: string | null;
    below_floor: boolean;
  }
): Promise<QuoteApprovalRow> {
  const { data, error } = await db
    .from("quote_approvals")
    .insert(input)
    .select("*")
    .single();
  if (error) throw new Error(`quote_approvals insert failed: ${error.message}`);
  return data as QuoteApprovalRow;
}

export async function hasApproveDecision(db: Db, versionId: string): Promise<boolean> {
  const { count, error } = await db
    .from("quote_approvals")
    .select("id", { count: "exact", head: true })
    .eq("version_id", versionId)
    .eq("decision", "approve");
  if (error) throw new Error(`quote_approvals read failed: ${error.message}`);
  return (count ?? 0) > 0;
}

/** Marks every live prior version of the quote superseded by `newVersionId`. */
export async function supersedePriorVersions(
  db: Db,
  quoteId: string,
  newVersionId: string
): Promise<string[]> {
  const { data, error } = await db
    .from("quote_versions")
    .update({ status: "superseded", superseded_by: newVersionId })
    .eq("quote_id", quoteId)
    .neq("id", newVersionId)
    .in("status", ["issued", "accepted"])
    .select("id");
  if (error) throw new Error(`quote_versions supersede failed: ${error.message}`);
  return ((data ?? []) as { id: string }[]).map((r) => r.id);
}

export async function setQuoteCurrentVersion(
  db: Db,
  quoteId: string,
  versionId: string
): Promise<void> {
  const { error } = await db
    .from("quotes")
    .update({ current_version_id: versionId })
    .eq("id", quoteId);
  if (error) throw new Error(`quotes update failed: ${error.message}`);
}

export async function setOpportunityStage(
  db: Db,
  opportunityId: string,
  stage: OpportunityRow["stage"]
): Promise<void> {
  const { error } = await db
    .from("opportunities")
    .update({ stage })
    .eq("id", opportunityId);
  if (error) throw new Error(`opportunities update failed: ${error.message}`);
}
