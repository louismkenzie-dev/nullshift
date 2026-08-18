import { claudeJson } from "./claude";

/**
 * The Phase 4 assistant lineup (audit §4.2 / brief "AI assistance"): small,
 * structured drafters over internal records. Hard rules, enforced by shape:
 * every output is a DRAFT a human edits before anything client-facing happens,
 * every call is cost-logged to agent_runs via claudeJson's logAs, and every
 * prompt carries only the records the staff member can already see. Nothing
 * here sends email, changes status, or touches a client surface.
 */

const DRAFT_SYSTEM =
  "You draft internal working documents for Null Shift, a small UK software agency. " +
  "Plain English, no hype, no invented facts — if a detail isn't in the provided records, leave it out or mark it as unknown. " +
  "Never claim legal compliance or make commitments (prices, dates, guarantees) that aren't already in the records. " +
  "Your output is a draft a human will edit; write tight and concrete.";

/** Client-update drafter: weekly-update prose from what actually happened. */
export async function draftClientUpdate(input: {
  clientName: string;
  projectName: string;
  stage: string;
  shipped: string[];
  upNext: string[];
  waitingOnClient: string[];
  milestones: { title: string; target_date: string | null }[];
}): Promise<{ title: string; body: string } | null> {
  return claudeJson<{ title: string; body: string }>({
    system: DRAFT_SYSTEM,
    prompt:
      `Draft a short, warm project update for the client "${input.clientName}" about "${input.projectName}" (stage: ${input.stage}).\n\n` +
      `Shipped recently:\n${input.shipped.map((s) => `- ${s}`).join("\n") || "- nothing shipped this period"}\n\n` +
      `Up next:\n${input.upNext.map((s) => `- ${s}`).join("\n") || "- (nothing queued)"}\n\n` +
      `Waiting on the client:\n${input.waitingOnClient.map((s) => `- ${s}`).join("\n") || "- nothing"}\n\n` +
      `Milestones:\n${input.milestones.map((m) => `- ${m.title}${m.target_date ? ` (${m.target_date})` : ""}`).join("\n") || "- none"}\n\n` +
      `Return a title (one plain sentence, no "Update:" prefix) and a body of 2-4 short paragraphs. ` +
      `Mention what we need from them only if the waiting list is non-empty. No sign-off — the portal adds context.`,
    schema: {
      type: "object",
      required: ["title", "body"],
      additionalProperties: false,
      properties: { title: { type: "string" }, body: { type: "string" } },
    },
    effort: "low",
    maxTokens: 2000,
    logAs: "ops.update_drafter",
  });
}

/** Change-request assistant: plain-English impact statement for a quote. */
export async function draftImpactStatement(input: {
  title: string;
  description: string | null;
  projectName: string;
  quotedPrice: number | null;
}): Promise<{ impact_statement: string; clarifying_questions: string[] } | null> {
  return claudeJson<{ impact_statement: string; clarifying_questions: string[] }>({
    system: DRAFT_SYSTEM,
    prompt:
      `A client of project "${input.projectName}" asked for:\n` +
      `"${input.title}"${input.description ? `\n\nDetail: ${input.description}` : ""}\n\n` +
      (input.quotedPrice
        ? `Staff have priced it at £${input.quotedPrice}.\n\n`
        : "No price is set yet — do NOT invent one.\n\n") +
      `Draft the plain-English impact statement the client reads next to the quote: ` +
      `what we'd build, what it affects, and roughly how it lands in the schedule (relative terms like "a few days' work" only if obvious — no dates). ` +
      `2-4 sentences, second person, no jargon. Also list up to 3 clarifying questions staff should settle before building, if any.`,
    schema: {
      type: "object",
      required: ["impact_statement", "clarifying_questions"],
      additionalProperties: false,
      properties: {
        impact_statement: { type: "string" },
        clarifying_questions: { type: "array", items: { type: "string" }, maxItems: 3 },
      },
    },
    effort: "low",
    maxTokens: 1500,
    logAs: "ops.cr_assistant",
  });
}

/** Discovery analyst: an editable internal brief from captured discovery data. */
export async function draftDiscoveryBrief(input: {
  clientName: string;
  facts: [string, string][];
  agentSummary: string | null;
  painPoints: string[];
  callNotes: string[];
}): Promise<{ brief: string } | null> {
  return claudeJson<{ brief: string }>({
    system: DRAFT_SYSTEM,
    prompt:
      `Draft an internal discovery brief for "${input.clientName}" from these records.\n\n` +
      `Funnel answers:\n${input.facts.map(([k, v]) => `- ${k}: ${v}`).join("\n") || "- none"}\n\n` +
      `Research summary (AI, unverified):\n${input.agentSummary ?? "- none"}\n\n` +
      `Pain points:\n${input.painPoints.map((p) => `- ${p}`).join("\n") || "- none"}\n\n` +
      `Call notes:\n${input.callNotes.map((n) => `- ${n}`).join("\n") || "- none"}\n\n` +
      `Structure: THE BUSINESS / THE PROBLEM / WHAT SUCCESS LOOKS LIKE / CONSTRAINTS (budget, timeline) / OPEN QUESTIONS. ` +
      `Mark anything sourced only from the unverified research summary with "(unverified)". Markdown, under 300 words.`,
    schema: {
      type: "object",
      required: ["brief"],
      additionalProperties: false,
      properties: { brief: { type: "string" } },
    },
    effort: "medium",
    maxTokens: 2500,
    logAs: "ops.discovery_analyst",
  });
}

/** Handover assistant: internal summary stitched from the handover sources. */
export async function draftHandoverSummary(input: {
  projectName: string;
  clientName: string;
  stage: string;
  purpose: string | null;
  scopeItems: string[];
  decisions: string[];
  risks: string[];
  openWork: string[];
  quirks: string | null;
}): Promise<{ summary: string } | null> {
  return claudeJson<{ summary: string }>({
    system: DRAFT_SYSTEM,
    prompt:
      `Draft the "read this first" handover paragraph block for "${input.projectName}" (${input.clientName}, stage ${input.stage}).\n\n` +
      `Purpose: ${input.purpose ?? "(not written)"}\n` +
      `Agreed scope:\n${input.scopeItems.map((s) => `- ${s}`).join("\n") || "- (no snapshot)"}\n` +
      `Decisions:\n${input.decisions.map((d) => `- ${d}`).join("\n") || "- none logged"}\n` +
      `Open risks:\n${input.risks.map((r) => `- ${r}`).join("\n") || "- none"}\n` +
      `Open work:\n${input.openWork.map((w) => `- ${w}`).join("\n") || "- none"}\n` +
      `Quirks: ${input.quirks ?? "(none recorded)"}\n\n` +
      `Write 2-3 paragraphs a new owner reads before anything else: what this is, where it stands, what will bite them. ` +
      `End with the single most important thing to do first. Under 220 words.`,
    schema: {
      type: "object",
      required: ["summary"],
      additionalProperties: false,
      properties: { summary: { type: "string" } },
    },
    effort: "medium",
    maxTokens: 2000,
    logAs: "ops.handover_assistant",
  });
}
