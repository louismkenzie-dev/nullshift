import { createClient, createServiceClient } from "./server";

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

/**
 * Same append, via the service-role client. For the few places where the
 * caller has no usable cookie session at write time — a webhook, or a server
 * action that has JUST created the session (the fresh cookies are not visible
 * to a new cookie client inside the same request, so the RLS insert policy
 * `to authenticated` refuses it). The stamp trigger tolerates a null actor;
 * pass the acting user in `metadata` so the row still says who.
 */
export async function logAuditAsService(input: AuditInput): Promise<void> {
  try {
    const service = createServiceClient();
    const { error } = await service.from("audit_log").insert({
      tenant_id: input.tenantId ?? null,
      action: input.action,
      target: input.target ?? null,
      metadata: (input.metadata ?? null) as never,
    });
    if (error) console.error("audit_log (service) insert failed:", error.message);
  } catch (e) {
    console.error("audit_log (service) insert threw:", e);
  }
}
