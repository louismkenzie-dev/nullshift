import { describe, expect, it } from "vitest";
import {
  blockedMessage,
  canApprove,
  REVIEW_REASON,
  reviewState,
} from "@/lib/legal/review";

describe("reviewState", () => {
  it("cannot send an unreviewed draft", () => {
    const s = reviewState({ author: "a", reviewedBy: null, reviewedAt: null });
    expect(s.canSend).toBe(false);
    expect(s.reason).toBe(REVIEW_REASON.awaiting);
  });

  it("cannot send when the author approved their own document", () => {
    const s = reviewState({
      author: "a",
      reviewedBy: "a",
      reviewedAt: "2026-09-01T10:00:00Z",
    });
    expect(s.canSend).toBe(false);
    expect(s.reason).toBe(REVIEW_REASON.selfApproved);
  });

  it("can send once a different staff member approved it", () => {
    const s = reviewState({
      author: "a",
      reviewedBy: "b",
      reviewedAt: "2026-09-01T10:00:00Z",
    });
    expect(s.canSend).toBe(true);
    expect(s.reviewedBy).toBe("b");
    expect(s.reviewedAt).toBe("2026-09-01T10:00:00Z");
  });

  it("treats a legacy document with no recorded author as sendable once approved", () => {
    const s = reviewState({ author: null, reviewedBy: "b", reviewedAt: null });
    expect(s.canSend).toBe(true);
  });

  it("normalises undefined to null", () => {
    const s = reviewState({
      author: undefined,
      reviewedBy: undefined,
      reviewedAt: undefined,
    });
    expect(s).toEqual({
      author: null,
      reviewedBy: null,
      reviewedAt: null,
      canSend: false,
      reason: REVIEW_REASON.awaiting,
    });
  });
});

describe("canApprove", () => {
  it("refuses the author", () => {
    expect(canApprove({ author: "a" }, "a").ok).toBe(false);
  });
  it("allows anyone else", () => {
    expect(canApprove({ author: "a" }, "b").ok).toBe(true);
  });
  it("allows approval when no author is recorded", () => {
    expect(canApprove({ author: null }, "a").ok).toBe(true);
  });
});

describe("blockedMessage", () => {
  it("maps the redirect codes", () => {
    expect(blockedMessage("review")).toMatch(/second staff member/);
    expect(blockedMessage("self_approval")).toMatch(/cannot approve/);
    expect(blockedMessage("not_draft")).toMatch(/no longer a draft/);
    expect(blockedMessage(undefined)).toBeNull();
    expect(blockedMessage("something-else")).toBeNull();
  });
});
