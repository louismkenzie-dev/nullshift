import { describe, expect, it } from "vitest";
import { partitionOutstanding } from "@/lib/ops/buildAll";
import type { IssueRow } from "@/lib/ops/issues";

const base = (over: Partial<IssueRow>): IssueRow =>
  ({
    id: over.id ?? "i",
    tenant_id: "t",
    project_id: "p",
    batch_id: null,
    submitted_by: null,
    source: "portal",
    kind: "change",
    severity: "normal",
    billing: "unclassified",
    status: "new",
    title: "x",
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
    ...over,
  }) as IssueRow;

describe("partitionOutstanding", () => {
  it("promotes unclassified open issues and builds covered ones", () => {
    const p = partitionOutstanding([
      base({ id: "a" }),
      base({ id: "b", billing: "covered", status: "queued" }),
      base({ id: "c", billing: "build_item", status: "triaged" }),
    ]);
    expect(p.promote.map((i) => i.id)).toEqual(["a"]);
    expect(p.ready.map((i) => i.id)).toEqual(["b", "c"]);
    expect(p.blocked).toEqual([]);
  });

  it("ignores closed, shipped and already-batched statuses and unreviewed drafts", () => {
    const p = partitionOutstanding([
      base({ id: "closed", status: "closed" }),
      base({ id: "batched", status: "batched" }),
      base({ id: "draft", status: "new", client_visible: false }),
    ]);
    expect(p.ready).toEqual([]);
    expect(p.promote).toEqual([]);
    expect(p.blocked).toEqual([]);
  });

  it("holds §8 work without an accepted Change Order, releases it once accepted", () => {
    const held = partitionOutstanding(
      [
        base({ id: "dev", classification: "additional_development" }),
        base({ id: "mixed", classification: "mixed", change_order_id: "co1" }),
      ],
      new Map([["co1", "client_review"]])
    );
    expect(held.blocked.map((b) => [b.issue.id, b.reason])).toEqual([
      ["dev", "change_order"],
      ["mixed", "change_order"],
    ]);

    const ok = partitionOutstanding(
      [base({ id: "mixed", classification: "mixed", change_order_id: "co1" })],
      new Map([["co1", "accepted"]])
    );
    expect(ok.promote.map((i) => i.id)).toEqual(["mixed"]);
  });

  it("holds billable work until the quote is accepted", () => {
    const p = partitionOutstanding([
      base({ id: "q", billing: "out_of_scope" }),
      base({
        id: "paid",
        billing: "out_of_scope",
        quote_accepted_at: "2026-09-01T00:00:00Z",
      }),
    ]);
    expect(p.blocked.map((b) => [b.issue.id, b.reason])).toEqual([["q", "quote"]]);
    expect(p.ready.map((i) => i.id)).toEqual(["paid"]);
  });

  it("never re-queues an issue that already rides a batch", () => {
    const p = partitionOutstanding([base({ id: "r", status: "queued", batch_id: "b1" })]);
    expect(p.blocked.map((b) => b.reason)).toEqual(["in_batch"]);
  });
});
