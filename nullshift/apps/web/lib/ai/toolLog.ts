import "server-only";

import { createServiceClient } from "@nullshift/db";
import { classifyImpact, redactSecrets, requiresConfirmation } from "@/lib/ai/impact";

/**
 * AI tool-invocation logging (spec §13).
 *
 * The classification and redaction rules live in `impact.ts` so they can be
 * tested without a database. This module is the writing half: it opens a log
 * entry BEFORE a tool runs, so an action that crashes the process still leaves
 * a record that it was attempted, and it refuses a high-impact action that no
 * person confirmed rather than deferring the question.
 */

export type { ToolImpact } from "@/lib/ai/impact";
export { classifyImpact, redactSecrets, requiresConfirmation } from "@/lib/ai/impact";

/* ── the log ───────────────────────────────────────────────────── */

export type ToolInvocation = {
  tool: string;
  agentId?: string | null;
  taskId?: string | null;
  runId?: string | null;
  tenantId?: string | null;
  initiatingUser?: string | null;
  initiatingEmail?: string | null;
  modelRequestId?: string | null;
  args?: unknown;
  /** Set when a human confirmed this specific action. */
  confirmedBy?: { id?: string | null; email?: string | null } | null;
  /** Only for a tool a workflow deliberately pre-authorised. */
  preAuthorised?: boolean;
};

/**
 * Open the log entry BEFORE the tool runs, so an action that crashes the
 * process still leaves a record that it was attempted. Returns the row id to
 * close with `finishToolInvocation`.
 */
export async function startToolInvocation(inv: ToolInvocation): Promise<string | null> {
  const impact = classifyImpact(inv.tool);
  const needsConfirmation = requiresConfirmation(inv.tool, {
    preAuthorised: inv.preAuthorised,
  });

  const db = createServiceClient();
  const { data } = await db
    .from("ai_tool_invocations")
    .insert({
      tool: inv.tool,
      impact,
      agent_id: inv.agentId ?? null,
      task_id: inv.taskId ?? null,
      run_id: inv.runId ?? null,
      tenant_id: inv.tenantId ?? null,
      initiating_user: inv.initiatingUser ?? null,
      initiating_email: inv.initiatingEmail ?? null,
      model_request_id: inv.modelRequestId ?? null,
      arguments: redactSecrets(inv.args ?? {}) as Record<string, unknown>,
      outcome: "pending",
      confirmation_required: needsConfirmation,
      confirmed_at: inv.confirmedBy ? new Date().toISOString() : null,
      confirmed_by: inv.confirmedBy?.id ?? null,
      confirmed_by_email: inv.confirmedBy?.email ?? null,
    })
    .select("id")
    .single();
  return data?.id ?? null;
}

export async function finishToolInvocation(
  id: string | null,
  outcome: "succeeded" | "failed" | "refused" | "cancelled",
  detail?: { summary?: string; error?: string }
): Promise<void> {
  if (!id) return;
  const db = createServiceClient();
  await db
    .from("ai_tool_invocations")
    .update({
      outcome,
      result_summary: detail?.summary
        ? String(redactSecrets(detail.summary))
        : null,
      error_message: detail?.error ? String(redactSecrets(detail.error)) : null,
      finished_at: new Date().toISOString(),
    })
    .eq("id", id);
}

/**
 * Run a tool through the gate. A high-impact tool with no confirmation is
 * refused and logged as refused — it does not fall through to "ask later".
 */
export async function runGatedTool<T>(
  inv: ToolInvocation,
  run: () => Promise<T>
): Promise<{ ok: true; value: T } | { ok: false; reason: string }> {
  const needsConfirmation = requiresConfirmation(inv.tool, {
    preAuthorised: inv.preAuthorised,
  });
  const id = await startToolInvocation(inv);

  if (needsConfirmation && !inv.confirmedBy) {
    await finishToolInvocation(id, "refused", {
      summary: `${inv.tool} is a high-impact action and was not confirmed by a person.`,
    });
    return {
      ok: false,
      reason: `${inv.tool} needs to be confirmed by a person before it can run.`,
    };
  }

  try {
    const value = await run();
    await finishToolInvocation(id, "succeeded");
    return { ok: true, value };
  } catch (e) {
    await finishToolInvocation(id, "failed", {
      error: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
}
