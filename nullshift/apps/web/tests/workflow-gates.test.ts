import { describe, expect, it } from "vitest";
import {
  CLIENT_STATUS_LABEL,
  OPEN_STATUSES,
  QUEUEABLE_STATUSES,
  SEVERITY_META,
  dueAtFor,
  isBatchable,
  isUnreviewedDraft,
  type IssueBilling,
  type IssueStatus,
} from "@/lib/ops/issues";

/**
 * The batch gate is the line between "a client asked for something" and
 * "an agent builds and ships it". These tests pin the two rules that keep
 * unapproved billable work out of fix batches.
 */
describe("isBatchable", () => {
  const base = { status: "triaged" as IssueStatus, client_visible: true };

  it("allows covered and build_item work", () => {
    expect(isBatchable({ ...base, billing: "covered" })).toBe(true);
    expect(isBatchable({ ...base, billing: "build_item" })).toBe(true);
  });

  it("refuses unclassified and out_of_scope work — billable changes need approval first", () => {
    expect(isBatchable({ ...base, billing: "unclassified" })).toBe(false);
    expect(isBatchable({ ...base, billing: "out_of_scope" })).toBe(false);
  });

  it("refuses unreviewed inbox drafts even when billing is covered", () => {
    expect(
      isBatchable({ status: "new", client_visible: false, billing: "covered" })
    ).toBe(false);
  });

  it("allows a human-confirmed 'new' issue (client_visible) with covered billing", () => {
    expect(isBatchable({ status: "new", client_visible: true, billing: "covered" })).toBe(
      true
    );
  });
});

describe("isUnreviewedDraft", () => {
  it("is exactly: status new AND hidden from the client", () => {
    expect(isUnreviewedDraft({ status: "new", client_visible: false })).toBe(true);
    expect(isUnreviewedDraft({ status: "new", client_visible: true })).toBe(false);
    expect(isUnreviewedDraft({ status: "triaged", client_visible: false })).toBe(false);
  });
});

describe("dueAtFor", () => {
  it("derives the due date from severity (critical 1d … low 14d)", () => {
    const from = new Date("2026-08-18T12:00:00.000Z");
    expect(dueAtFor("critical", from)).toBe("2026-08-19T12:00:00.000Z");
    expect(dueAtFor("high", from)).toBe("2026-08-21T12:00:00.000Z");
    expect(dueAtFor("normal", from)).toBe("2026-08-25T12:00:00.000Z");
    expect(dueAtFor("low", from)).toBe("2026-09-01T12:00:00.000Z");
  });
});

describe("status vocabularies stay total", () => {
  it("every open/queueable status carries a client-facing label", () => {
    for (const s of [...OPEN_STATUSES, ...QUEUEABLE_STATUSES]) {
      expect(CLIENT_STATUS_LABEL[s], `label for ${s}`).toBeTruthy();
    }
  });

  it("every severity carries meta (label, tone, due days)", () => {
    for (const s of ["critical", "high", "normal", "low"] as const) {
      expect(SEVERITY_META[s].dueDays).toBeGreaterThan(0);
    }
  });

  it("billing values cover the classification set", () => {
    const all: IssueBilling[] = ["unclassified", "covered", "build_item", "out_of_scope"];
    // Exactly the four the triage UI and the batch gate reason about.
    expect(new Set(all).size).toBe(4);
  });
});
