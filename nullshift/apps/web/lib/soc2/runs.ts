import type { createServiceClient } from "@nullshift/db";
import type { ControlFrequency } from "./types";
import { nextDueAfter, toDateOnly } from "./schedule";

/**
 * Completing a control performance from OUTSIDE the control detail page —
 * the access-review completion (IAM-05) and vendor review (VND-03) flows
 * perform the control as a side effect of their own record. Without this,
 * the scheduled run stays open and the sweep raises an "evidence overdue"
 * exception for a control that was, in fact, just performed.
 *
 * Finds the control by key, completes its earliest open run (if one exists),
 * and advances next_due_at from today either way. Best-effort by design:
 * a null return means the library isn't seeded — the caller's own record
 * still stands.
 */
export async function completeOpenRunForControl(
  db: ReturnType<typeof createServiceClient>,
  controlKey: string,
  opts: {
    performedBy: string;
    summary: string;
    result?: "pass" | "fail" | "partial";
  }
): Promise<{ controlId: string; runId: string | null } | null> {
  const { data: control } = await db
    .from("soc2_controls")
    .select("id, key, frequency")
    .eq("key", controlKey)
    .maybeSingle();
  if (!control) return null;

  const { data: openRun } = await db
    .from("soc2_control_runs")
    .select("id")
    .eq("control_id", control.id)
    .in("status", ["scheduled", "in_progress"])
    .order("due_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  let runId: string | null = null;
  if (openRun) {
    const { error } = await db
      .from("soc2_control_runs")
      .update({
        status: "complete",
        result: opts.result ?? "pass",
        summary: opts.summary,
        performed_by: opts.performedBy,
        performed_at: new Date().toISOString(),
      })
      .eq("id", openRun.id);
    if (!error) runId = openRun.id;
  }

  const nextDue = nextDueAfter(control.frequency as ControlFrequency, toDateOnly(new Date()));
  if (nextDue) {
    await db.from("soc2_controls").update({ next_due_at: nextDue }).eq("id", control.id);
  }

  return { controlId: control.id, runId };
}
