import { describe, expect, it } from "vitest";
import {
  clientTitle,
  defaultOutcome,
  isPublishable,
  parseOutcomes,
} from "@/lib/ops/outcomes";
import type { IssueRow } from "@/lib/ops/issues";

const issue = (id: string, title: string, kind: IssueRow["kind"] = "change"): IssueRow =>
  ({
    id,
    tenant_id: "t",
    project_id: "p",
    batch_id: "b",
    submitted_by: null,
    source: "portal",
    kind,
    severity: "normal",
    billing: "covered",
    status: "batched",
    title,
    description: null,
    repro: null,
    source_quote: null,
    image_urls: [],
    client_visible: true,
    assignee: null,
    quoted_price: null,
    quote_note: null,
    quote_accepted_at: null,
    quote_declined_at: null,
    build_items: null,
    due_at: null,
    promised_at: null,
    promised_note: null,
    ai: null,
    resolution_note: null,
    resolved_at: null,
    classification: null,
    classified_by: null,
    classified_at: null,
    classification_note: null,
    change_order_id: null,
    created_at: "2026-09-03T00:00:00Z",
    updated_at: "2026-09-03T00:00:00Z",
  }) as IssueRow;

const A = "b59d2525-b11e-499a-b124-027131854fd9";
const B = "0f8ff909-17f8-4ddd-a14f-35cec6d54cb6";
const C = "546d441b-4dab-44bb-a9ca-29b9b96fa151";

describe("parseOutcomes", () => {
  const issues = [
    issue(A, "Merchandise page"),
    issue(B, "What does the cake mean next to someone's name?", "question"),
    issue(C, "Financial report"),
  ];

  it("reads the structured Outcomes block", () => {
    const body = `## Outcomes
- ${A} | fixed | Parents can buy uniform from the shop page.
- ${B} | answered | The cake marks a birthday in the next seven days.
- ${C} | not_done | Needs a decision on which fees to subtract.`;
    expect(parseOutcomes(body, issues)).toEqual([
      {
        issueId: A,
        outcome: "fixed",
        note: "Parents can buy uniform from the shop page.",
      },
      {
        issueId: B,
        outcome: "answered",
        note: "The cake marks a birthday in the next seven days.",
      },
      {
        issueId: C,
        outcome: "not_done",
        note: "Needs a decision on which fees to subtract.",
      },
    ]);
  });

  it("falls back to loose prose matched on the issue title", () => {
    const body = `Here is what landed.

- **Fixed:** Merchandise page now sells uniform.
- Answered: What does the cake mean next to someone's name — it is a birthday.`;
    const out = parseOutcomes(body, issues);
    expect(out[0]).toEqual({
      issueId: A,
      outcome: "fixed",
      note: "Merchandise page now sells uniform.",
    });
    expect(out[1].outcome).toBe("answered");
    expect(out[1].note).toContain("birthday");
  });

  it("returns a blank draft for every issue the PR never mentions", () => {
    const out = parseOutcomes("Nothing useful here.", issues);
    expect(out).toHaveLength(3);
    expect(out.map((o) => o.note)).toEqual(["", "", ""]);
    // A question defaults to Answered, everything else to Fixed.
    expect(out.map((o) => o.outcome)).toEqual(["fixed", "answered", "fixed"]);
  });

  it("never invents an outcome for an id that is not on the batch", () => {
    const body = `- 11111111-2222-3333-4444-555555555555 | fixed | Some other batch.`;
    expect(parseOutcomes(body, issues).every((o) => o.note === "")).toBe(true);
  });

  it("is case-insensitive about ids and tolerates bold markdown", () => {
    const body = `- **${A.toUpperCase()}** | Fixed | Shop page is live.`;
    expect(parseOutcomes(body, issues)[0]).toEqual({
      issueId: A,
      outcome: "fixed",
      note: "Shop page is live.",
    });
  });
});

describe("outcome rules", () => {
  it("answers questions and decisions, fixes everything else", () => {
    expect(defaultOutcome("question")).toBe("answered");
    expect(defaultOutcome("decision")).toBe("answered");
    expect(defaultOutcome("bug")).toBe("fixed");
    expect(defaultOutcome("change")).toBe("fixed");
  });

  it("titles the client's update with the right verb", () => {
    expect(clientTitle("answered", "Trial emails")).toBe("Answered: Trial emails");
    expect(clientTitle("fixed", "Registers")).toBe("Fixed: Registers");
  });

  it("publishes only approved, unpublished, non-empty outcomes the client should see", () => {
    const base = {
      outcome: "fixed",
      note: "Done.",
      approved_at: "x",
      published_at: null,
    };
    expect(isPublishable(base)).toBe(true);
    expect(isPublishable({ ...base, approved_at: null })).toBe(false);
    expect(isPublishable({ ...base, published_at: "y" })).toBe(false);
    expect(isPublishable({ ...base, note: "   " })).toBe(false);
    // "Not done" is an internal outcome — the client is told by a person.
    expect(isPublishable({ ...base, outcome: "not_done" })).toBe(false);
  });
});
