import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { MARKETING_ADVISOR_SYSTEM } from "@/lib/marketingAdvisorPrompt";

export const runtime = "nodejs";
export const maxDuration = 60;

type ChatMsg = { role: "user" | "assistant"; content: string };

/**
 * POST /api/admin/marketing-advisor
 * Body: { messages: {role, content}[] }
 * Streams the Marketing Advisor's reply as plain UTF-8 text.
 * Admin-only (supabase session + ADMIN_EMAILS allowlist). Uses the embedded
 * recurring-revenue strategy as a cached system prompt; Claude Opus 4.8 with
 * adaptive thinking, streamed.
 */
export async function POST(request: Request) {
  // ── Auth: same gate as the admin dashboard ────────────────────
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !isAdminEmail(user.email)) {
      return new Response("Not authorised.", { status: 401 });
    }
  } catch {
    return new Response("Auth unavailable.", { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Graceful fallback — the chat is wired and ready; just needs the key.
    return new Response(
      "The Marketing Advisor isn't connected yet. Add **ANTHROPIC_API_KEY** to your environment (.env.local locally, or the Vercel project's Environment Variables) and redeploy — the chat will go live immediately. Everything else in the command centre works without it.",
      { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } }
    );
  }

  let messages: ChatMsg[] = [];
  try {
    const body = await request.json();
    messages = Array.isArray(body?.messages) ? body.messages : [];
  } catch {
    return new Response("Invalid request body.", { status: 400 });
  }
  // Keep it sane: trim to the last 20 turns, ensure the first is a user turn.
  messages = messages
    .filter((m) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-20);
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (!messages.length) return new Response("No message provided.", { status: 400 });

  const client = new Anthropic({ apiKey });
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const ms = client.messages.stream({
          model: "claude-opus-4-8",
          max_tokens: 8000,
          thinking: { type: "adaptive" },
          output_config: { effort: "medium" },
          system: [
            { type: "text", text: MARKETING_ADVISOR_SYSTEM, cache_control: { type: "ephemeral" } },
          ],
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        });

        for await (const event of ms) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        controller.enqueue(encoder.encode(`\n\n_Advisor error: ${msg}_`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
