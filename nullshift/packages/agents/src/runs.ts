import { createServiceClient } from "@nullshift/db";
import { costUsd, MODEL } from "./client";

/** Cost + audit logging for agent invocations → public.agent_runs.
 *  Best-effort: never throws, never blocks the caller. */

export type AgentRunInput = {
  agent: string; // 'consultation.plan' | 'ops.classify' | 'aiw.execute' | ...
  trigger: string; // 'plan_view' | 'admin' | 'cron' | 'routine' | 'test'
  planToken?: string | null;
  /** AI Workspace links (0019): the registered agent + task this run served. */
  agentId?: string | null;
  taskId?: string | null;
  status: "ok" | "error";
  usage?: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number | null;
    cache_creation_input_tokens?: number | null;
    server_tool_use?: { web_search_requests?: number | null } | null;
  } | null;
  durationMs?: number;
  error?: string | null;
};

export async function logAgentRun(run: AgentRunInput): Promise<void> {
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from("agent_runs").insert({
      agent: run.agent,
      trigger: run.trigger,
      plan_token: run.planToken ?? null,
      agent_id: run.agentId ?? null,
      task_id: run.taskId ?? null,
      model: MODEL,
      status: run.status,
      input_tokens: run.usage?.input_tokens ?? null,
      output_tokens: run.usage?.output_tokens ?? null,
      cache_read_tokens: run.usage?.cache_read_input_tokens ?? null,
      cost_usd: run.usage ? costUsd(run.usage) : null,
      duration_ms: run.durationMs ?? null,
      error: run.error ?? null,
    });
    if (error) console.error("agent_runs insert failed:", error.message);
  } catch (e) {
    console.error("agent_runs logging failed (non-fatal):", e);
  }
}
