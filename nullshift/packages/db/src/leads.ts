import { createServiceClient } from "./server";

/**
 * Escape LIKE/ILIKE metacharacters in caller-supplied text. `%` and `_` are
 * legal in email local parts, so every `.ilike(column, email)` match MUST go
 * through this — an unescaped pattern can match (or update) the wrong rows.
 */
export function escapeLike(value: string): string {
  return value.replace(/([\\%_])/g, "\\$1");
}

/**
 * Write a captured lead into the canonical multi-tenant `leads` table (under the
 * internal Nullshift tenant). Used by the marketing site's lead-capture routes
 * via the service role (RLS-bypassing, server-only). Best-effort: returns an
 * error string rather than throwing so callers can stay non-blocking.
 */
export type RecordLeadInput = {
  name?: string | null;
  email?: string | null;
  source?: string | null;
  /** Business type / vertical (clinic-first, not clinic-only). */
  vertical?: string | null;
  /** Full quiz payload incl. current software spend + biggest admin pain. */
  quizAnswers?: unknown;
  leadScore?: number | null;
  status?: "new" | "qualified" | "call_booked" | "won" | "lost";
  /** Unguessable token for the public /plan/[token] page. */
  planToken?: string | null;
  /** Generated Build Blueprint payload ({ blueprint, businessName, name, segment }). */
  plan?: unknown;
  /** Contact phone — persisted so a callback never depends on an email. */
  phone?: string | null;
  /** UTM params captured at the funnel — acquisition attribution. */
  utm?: Record<string, string> | null;
};

/** Lifecycle order for advancing a lead's status — never downgrade on merge. */
const STATUS_RANK: Record<string, number> = {
  new: 0,
  qualified: 1,
  call_booked: 2,
  won: 3,
  lost: 3,
};

function mergeQuizAnswers(existing: unknown, incoming: unknown): unknown {
  if (
    existing &&
    typeof existing === "object" &&
    !Array.isArray(existing) &&
    incoming &&
    typeof incoming === "object" &&
    !Array.isArray(incoming)
  ) {
    return { ...(existing as object), ...(incoming as object) };
  }
  return incoming ?? existing ?? null;
}

/**
 * Record a captured lead — UPSERT by email so there's only ever ONE lead per
 * person (a funnel completion + a later call booking merge into the same row,
 * rather than appearing as two cards in two pipeline columns at once). On merge,
 * status only advances (never downgrades), and quiz answers / plan are merged in.
 */
export async function recordLead(
  input: RecordLeadInput
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createServiceClient();

    const { data: tenant, error: tenantErr } = await supabase
      .from("tenants")
      .select("id")
      .eq("type", "internal")
      .limit(1)
      .single();

    if (tenantErr || !tenant) {
      return { ok: false, error: tenantErr?.message ?? "no internal tenant" };
    }

    const email = input.email?.trim().toLowerCase() ?? null;

    if (email) {
      const { data: existing } = await supabase
        .from("leads")
        .select("id, status, quiz_answers")
        .eq("tenant_id", tenant.id)
        .ilike("email", escapeLike(email))
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existing) {
        const incomingStatus = input.status ?? "new";
        const nextStatus =
          (STATUS_RANK[incomingStatus] ?? 0) > (STATUS_RANK[existing.status] ?? 0)
            ? incomingStatus
            : existing.status;
        const patch: Record<string, unknown> = {
          quiz_answers: mergeQuizAnswers(existing.quiz_answers, input.quizAnswers),
          status: nextStatus,
        };
        // Only overwrite fields we have new values for (keep the original
        // source/name where this capture doesn't supply one).
        if (input.name) patch.name = input.name;
        if (input.vertical) patch.vertical = input.vertical;
        if (input.leadScore != null) patch.lead_score = input.leadScore;
        if (input.plan != null) patch.plan = input.plan;
        if (input.planToken) patch.plan_token = input.planToken;
        if (input.phone) patch.phone = input.phone;
        if (input.utm && Object.keys(input.utm).length > 0) patch.utm = input.utm;
        const { error } = await supabase
          .from("leads")
          .update(patch)
          .eq("id", existing.id);
        if (error) return { ok: false, error: error.message };
        return { ok: true };
      }
    }

    const { error } = await supabase.from("leads").insert({
      tenant_id: tenant.id,
      name: input.name ?? null,
      email: input.email ?? null,
      source: input.source ?? null,
      vertical: input.vertical ?? null,
      quiz_answers: input.quizAnswers ?? null,
      lead_score: input.leadScore ?? null,
      status: input.status ?? "new",
      plan_token: input.planToken ?? null,
      plan: input.plan ?? null,
      phone: input.phone ?? null,
      utm: input.utm && Object.keys(input.utm).length > 0 ? input.utm : null,
    });

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unknown error" };
  }
}
