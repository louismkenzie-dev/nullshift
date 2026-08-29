import { createClient, createServiceClient } from "@nullshift/db";
import { logAudit } from "@nullshift/db/audit";

/**
 * Domain trail writer. Every material SOC 2 action lands twice:
 *  · soc2_events — the per-record trail the area's pages read;
 *  · audit_log   — the global, DB-stamped append-only log.
 * Best-effort like logAudit: a trail failure never breaks the action, but is
 * loudly logged server-side.
 */
export type Soc2EventInput = {
  recordType:
    | "programme_role"
    | "scope"
    | "asset"
    | "vendor"
    | "policy"
    | "policy_version"
    | "risk"
    | "control"
    | "control_run"
    | "evidence"
    | "exception"
    | "incident"
    | "access_review"
    | "access_change"
    | "break_glass"
    | "change_record"
    | "management_review"
    | "review_period"
    | "audit_pack"
    | "settings";
  recordId: string;
  type: string; // 'created' | 'status.changed' | 'approved' | ...
  summary: string; // plain-English, secret-free
  detail?: Record<string, unknown>;
  actor: string; // email, or 'system:sweep'
  /** Use the service client (cron/sweep paths with no user session). */
  asService?: boolean;
};

export async function logSoc2Event(input: Soc2EventInput): Promise<void> {
  try {
    const db = input.asService ? createServiceClient() : await createClient();
    const { error } = await db.from("soc2_events").insert({
      record_type: input.recordType,
      record_id: input.recordId,
      type: input.type,
      summary: input.summary,
      detail: (input.detail ?? {}) as never,
      actor: input.actor,
    });
    if (error) console.error("soc2_events insert failed:", error.message);
  } catch (e) {
    console.error("soc2_events insert threw:", e);
  }
  // The global audit_log rides the user's session (its DB trigger stamps
  // actor = auth.uid()). Service-context writes (the sweep) have no session:
  // their global-trail record is the soc2_events row itself, written above
  // with actor 'system:sweep'.
  if (!input.asService) {
    await logAudit({
      action: `soc2.${input.recordType}.${input.type}`,
      target: `${input.recordType}:${input.recordId}`,
      metadata: { summary: input.summary, ...(input.detail ?? {}) },
    });
  }
}
