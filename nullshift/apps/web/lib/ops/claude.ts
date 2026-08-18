/**
 * Thin Claude helper for the ops system's AI features (issue classification,
 * inbox ingest parsing). Best-effort by design, mirroring sendEmail: when
 * ANTHROPIC_API_KEY is unset or a call fails, callers get null and the app
 * degrades to manual entry rather than erroring.
 */

export const CLAUDE_MODEL = "claude-opus-5";

export function hasClaude(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * Run a single Claude request constrained to a JSON schema and return the
 * parsed object, or null if Claude is unconfigured or the call fails.
 */
export async function claudeJson<T>(opts: {
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
  /** AI Workspace run key (e.g. "ops.classify") — when set, the call is logged
   *  to agent_runs with usage + cost so it appears in the office records. */
  logAs?: string;
}): Promise<T | null> {
  if (!hasClaude()) {
    console.warn("[ops/claude] ANTHROPIC_API_KEY not set — skipping AI step");
    return null;
  }
  const t0 = Date.now();
  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic();
    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: opts.maxTokens ?? 16000,
      system: opts.system,
      output_config: {
        effort: opts.effort ?? "low",
        format: { type: "json_schema", schema: opts.schema },
      },
      messages: [{ role: "user", content: opts.prompt }],
    });
    if (opts.logAs) {
      void logOpsRun(opts.logAs, "ok", response.usage, Date.now() - t0, null);
    }
    if (response.stop_reason === "refusal") return null;
    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") return null;
    return JSON.parse(text.text) as T;
  } catch (err) {
    console.error("[ops/claude] request failed", err);
    if (opts.logAs) {
      void logOpsRun(
        opts.logAs,
        "error",
        null,
        Date.now() - t0,
        err instanceof Error ? err.message : "unknown"
      );
    }
    return null;
  }
}

/** Best-effort agent_runs write, linked to the workspace agent by key prefix
 *  (ops.classify → issue-classifier, ops.ingest → inbox-parser). Never throws. */
async function logOpsRun(
  agent: string,
  status: "ok" | "error",
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number | null;
  } | null,
  durationMs: number,
  error: string | null
): Promise<void> {
  try {
    const { logAgentRun } = await import("@nullshift/agents/runs");
    await logAgentRun({ agent, trigger: "admin", status, usage, durationMs, error });
    const key =
      agent === "ops.classify"
        ? "issue-classifier"
        : agent === "ops.ingest"
          ? "inbox-parser"
          : null;
    if (key) {
      const { createServiceClient } = await import("@nullshift/db");
      const supabase = createServiceClient();
      const { data: a } = await supabase
        .from("agents")
        .select("id")
        .eq("key", key)
        .maybeSingle();
      if (a) {
        await supabase
          .from("agent_runs")
          .update({ agent_id: a.id })
          .eq("agent", agent)
          .is("agent_id", null);
        await supabase
          .from("agents")
          .update({ last_activity_at: new Date().toISOString() })
          .eq("id", a.id);
      }
    }
  } catch (e) {
    console.error("[ops/claude] run logging failed (non-fatal):", e);
  }
}
