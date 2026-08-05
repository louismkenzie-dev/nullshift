import { claudeJson } from "./claude";
import type { IssueKind, IssueSeverity } from "./issues";

/**
 * Inbox ingest — turn pasted WhatsApp exports, Zoom transcripts, voice-note
 * transcriptions or forwarded emails into structured draft issues. Each draft
 * is confirmed by the admin before it becomes a real issue, so the model is
 * asked to over-capture rather than filter. Also flags promises Louis made
 * ("I'll add that by Friday") for the promise ledger. Null when Claude is
 * unconfigured — the inbox falls back to manual entry.
 */

export type IngestDraft = {
  title: string;
  kind: IssueKind;
  severity: IssueSeverity;
  description: string;
  source_quote: string;
  is_promise: boolean;
  promised_note: string | null;
};

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["drafts"],
  properties: {
    drafts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "title",
          "kind",
          "severity",
          "description",
          "source_quote",
          "is_promise",
          "promised_note",
        ],
        properties: {
          title: { type: "string" },
          kind: { type: "string", enum: ["bug", "change", "question", "task"] },
          severity: { type: "string", enum: ["critical", "high", "normal", "low"] },
          description: { type: "string" },
          source_quote: { type: "string" },
          is_promise: { type: "boolean" },
          promised_note: { type: ["string", "null"] },
        },
      },
    },
  },
} as const;

export async function parseIngest(input: {
  text: string;
  systemName: string;
  clientName: string;
  existingOpenTitles: string[];
}): Promise<IngestDraft[] | null> {
  const existing = input.existingOpenTitles.length
    ? `Already-open issues for this system (do NOT create duplicates of these; skip anything already covered): ${input.existingOpenTitles.map((t) => `"${t}"`).join(", ")}.`
    : "There are no open issues for this system yet.";

  const result = await claudeJson<{ drafts: IngestDraft[] }>({
    system: `You extract actionable work items from messy client communications for NullShift, a UK dev agency. The input is a raw WhatsApp chat export, call transcript, or forwarded message thread between the agency (Louis) and a client.

Extract every distinct bug report, change request, question, or task mentioned. For each:
- title: crisp, max 10 words.
- kind: "bug" (broken behaviour), "change" (new/altered functionality), "question" (client asking how something works), "task" (content/admin chore).
- severity: "critical" only for payments broken / site down / data loss; "high" for a core flow degraded; "normal" default; "low" cosmetic.
- description: everything a developer needs, written from the source material — include who reported it, what happened, and any repro detail mentioned.
- source_quote: the exact message text (verbatim) this was extracted from, so the original context is preserved.
- is_promise: true when the item is a commitment Louis made to the client ("I'll add that by Friday", "leave it with me"), with promised_note capturing what was promised and any deadline. Otherwise false with promised_note null.

Over-capture rather than filter — a human confirms each draft before it becomes real. Merge repeated mentions of the same problem into one draft. ${existing}`,
    prompt: `Client: ${input.clientName}\nSystem: ${input.systemName}\n\n--- RAW SOURCE ---\n${input.text}`,
    schema: SCHEMA as unknown as Record<string, unknown>,
    effort: "medium",
    maxTokens: 16000,
  });
  return result?.drafts ?? null;
}
