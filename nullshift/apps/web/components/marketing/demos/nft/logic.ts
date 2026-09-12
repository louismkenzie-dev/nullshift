/**
 * NewFuture Reflections — the safety gate, ported from the client's
 * `src/app/api/reflections/chat/route.ts` (read 2026-09-11). Pure functions
 * only; the demo replays them offline. Constants and the tier mapping are
 * verbatim; the route order mirrors the handler top to bottom.
 */

export const CHAT_MODEL = "claude-sonnet-5";
export const SAFETY_MODEL = "claude-haiku-4-5";
export const MAX_MESSAGE_CHARS = 4000;

export type SafetyTier = "none" | "vulnerability" | "immediate";

/** The three-way tier, read exactly as the route reads the classifier's
 *  one-word reply (recall-first: "immediate" wins if present). */
export function parseTier(reply: string): SafetyTier {
  const text = reply.trim().toLowerCase();
  if (text.includes("immediate")) return "immediate";
  if (text.includes("vulnerability")) return "vulnerability";
  return "none";
}

/** Inbound messages are clamped before anything else sees them. */
export function clampMessage(message: string): string {
  return message.trim().slice(0, MAX_MESSAGE_CHARS);
}

/** The classifier's instruction, verbatim. It sees the raw message only —
 *  no conversation context — so a classification can never be reframed. */
export const SAFETY_SYSTEM_PROMPT = `You classify one message from an adult using a relationship-education platform. Reply with exactly one word.

immediate — mentions of suicide, wanting to die, self-harm intent, immediate danger from another person, a medical emergency, or harm to a child.
vulnerability — significant distress, fear of a partner, coercion or control, abuse that is not an immediate emergency, disclosure of being under 18, or clearly worsening mental health.
none — everything else, including ordinary sadness, conflict and frustration.

When genuinely unsure between two tiers, choose the more serious one. Reply with only: none, vulnerability, or immediate.`;

/** Appended to the system blocks for a "vulnerability" turn, verbatim. */
export const VULNERABILITY_BLOCK =
  "# For this reply\nThe participant may be in a vulnerable moment. Keep your reply especially short and gentle. Do not interpret, label or suggest intensifying exercises. Do not suggest joint or partner exercises. Name your limits softly and encourage support from a trusted person, their GP or a qualified therapist, alongside at most one gentle grounding suggestion.";

export type RouteOutcome =
  | { kind: "crisis"; modelCalled: false; safetyEvent: "immediate" }
  | {
      kind: "stream";
      modelCalled: true;
      model: typeof CHAT_MODEL;
      extraSystem: string | null;
      safetyEvent: "vulnerability" | null;
    };

/** What the handler does once the tier is known. An "immediate" tier ends
 *  the request with a JSON discriminator — `client.messages.stream()` is
 *  never reached — and the client swaps in the fixed CrisisScreen. */
export function routeAfterSafety(tier: SafetyTier): RouteOutcome {
  if (tier === "immediate") {
    return { kind: "crisis", modelCalled: false, safetyEvent: "immediate" };
  }
  return {
    kind: "stream",
    modelCalled: true,
    model: CHAT_MODEL,
    extraSystem: tier === "vulnerability" ? VULNERABILITY_BLOCK : null,
    safetyEvent: tier === "vulnerability" ? "vulnerability" : null,
  };
}

/** The handler, top to bottom — one row per guard, for the trace panel. */
export const PIPELINE = [
  { id: "auth", code: "getUser()", note: "401 if not signed in" },
  { id: "entitlement", code: "getEntitlement()", note: "403 without course access" },
  {
    id: "clamp",
    code: `clamp(message, ${MAX_MESSAGE_CHARS})`,
    note: "raw text, nothing else",
  },
  {
    id: "classify",
    code: `classifySafety(${SAFETY_MODEL})`,
    note: "the message alone — no context",
  },
  { id: "gate", code: 'tier === "immediate"', note: 'return { kind: "crisis" }' },
  {
    id: "counter",
    code: "recordSafetyEvent(tier)",
    note: "tier + time only — no user, no text",
  },
  {
    id: "stream",
    code: `messages.stream(${CHAT_MODEL})`,
    note: "system prompt + exercise context",
  },
  {
    id: "client",
    code: 'kind === "crisis" → <CrisisScreen/>',
    note: "fixed UI replaces the panel",
  },
] as const;

export type PipelineId = (typeof PIPELINE)[number]["id"];
