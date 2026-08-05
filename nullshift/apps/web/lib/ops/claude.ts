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
}): Promise<T | null> {
  if (!hasClaude()) {
    console.warn("[ops/claude] ANTHROPIC_API_KEY not set — skipping AI step");
    return null;
  }
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
    if (response.stop_reason === "refusal") return null;
    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") return null;
    return JSON.parse(text.text) as T;
  } catch (err) {
    console.error("[ops/claude] request failed", err);
    return null;
  }
}
