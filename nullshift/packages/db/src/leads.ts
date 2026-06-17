import { createServiceClient } from "./server";

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
};

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

    const { error } = await supabase.from("leads").insert({
      tenant_id: tenant.id,
      name: input.name ?? null,
      email: input.email ?? null,
      source: input.source ?? null,
      vertical: input.vertical ?? null,
      quiz_answers: input.quizAnswers ?? null,
      lead_score: input.leadScore ?? null,
      status: input.status ?? "new",
    });

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unknown error" };
  }
}
