import { createClient } from "./server";

/**
 * Append an entry to the append-only `audit_log` (brief §3/§9). Uses the caller's
 * authenticated Supabase client so the DB stamp trigger binds actor=auth.uid().
 * Every client-data write and admin action should call this. Best-effort: never
 * throws (audit failure must not break the action), but logs server-side.
 */
export type AuditInput = {
  action: string; // e.g. "change_request.scoped"
  target?: string | null; // e.g. "change_request:<id>"
  tenantId?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function logAudit(input: AuditInput): Promise<void> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("audit_log").insert({
      tenant_id: input.tenantId ?? null,
      action: input.action,
      target: input.target ?? null,
      metadata: (input.metadata ?? null) as never,
    });
    if (error) console.error("audit_log insert failed:", error.message);
  } catch (e) {
    console.error("audit_log insert threw:", e);
  }
}
