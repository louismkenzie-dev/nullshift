import { claudeJson } from "./claude";
import type { IssueBilling, IssueKind, IssueSeverity } from "./issues";
import type { CarePlan } from "../carePlans";

/**
 * Intake triage — classify an incoming issue the moment it lands: what kind
 * of work it is, how urgent, and whether it's covered by the retainer, a
 * build item against the monthly allowance, or out of scope (needs a quote).
 * The result is stored on issues.ai and pre-fills the admin triage; Louis
 * can override any call with one click. Null when Claude is unconfigured.
 */

export type IssueClassification = {
  kind: IssueKind;
  severity: IssueSeverity;
  billing: IssueBilling;
  suggested_title: string;
  rationale: string;
  confidence: number;
};

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "severity", "billing", "suggested_title", "rationale", "confidence"],
  properties: {
    kind: { type: "string", enum: ["bug", "change", "question", "task"] },
    severity: { type: "string", enum: ["critical", "high", "normal", "low"] },
    billing: { type: "string", enum: ["covered", "build_item", "out_of_scope"] },
    suggested_title: { type: "string" },
    rationale: { type: "string" },
    confidence: { type: "integer", enum: [1, 2, 3, 4, 5] },
  },
} as const;

export async function classifyIssue(input: {
  title: string;
  description: string | null;
  systemName: string;
  plan: CarePlan | null;
}): Promise<IssueClassification | null> {
  const planContext = input.plan
    ? `The client is on the "${input.plan.label}" plan (£${input.plan.mrr}/mo, ${input.plan.buildAllowance} build items included per month). Plan covers: ${input.plan.features.join("; ")}.`
    : "The client has no active retainer plan.";

  return claudeJson<IssueClassification>({
    system: `You triage incoming client requests for NullShift, a UK dev agency that builds and runs bespoke systems (booking systems, client portals) for small businesses. Classify each request:

- kind: "bug" (something we built is broken or misbehaving), "change" (new or altered functionality), "question" (how-does-it-work), "task" (admin/content chores).
- severity: "critical" only for payments broken, site down, or data loss; "high" for a core flow degraded; "normal" for most things; "low" for cosmetic issues.
- billing: "covered" for bug fixes on anything we built and for questions — always free under any plan. "build_item" for new/changed functionality that fits within roughly a day's work — these consume the monthly build allowance on plans that include one. "out_of_scope" for substantial new functionality that clearly exceeds a single build item, or work on things we didn't build — these need a separate quote.
- suggested_title: a crisp title (max 10 words) if the submitted one is vague; otherwise echo it.
- confidence: 1 (guessing) to 5 (certain).

${planContext}`,
    prompt: `System: ${input.systemName}\nTitle: ${input.title}\nDescription: ${input.description ?? "(none)"}`,
    schema: SCHEMA as unknown as Record<string, unknown>,
    effort: "low",
    maxTokens: 8000,
  });
}
