import { describe, expect, it } from "vitest";
import {
  DEFAULT_VALIDITY_DAYS,
  allowedTransitions,
  canCreateNextVersion,
  canTransition,
  checkApproval,
  checkIssue,
  expiryFor,
  floorMinor,
  isBelowFloor,
  isContentEditable,
  isStale,
  isTerminal,
  supersededOnIssue,
} from "@/lib/commercial/stateMachine";
import { deriveSteps, toStudioQuote } from "@/lib/commercial/studio";
import { FIXTURE_QUOTE_VERSIONS, FIXTURE_STUDIO_IDS } from "@/lib/commercial/fixtures";
import { QUOTE_VERSION_STATUSES, type QuoteVersionStatus } from "@/lib/commercial/types";

describe("quote version transitions (brief §5.2)", () => {
  it("follows Draft → Internal review → Approved to issue → Issued", () => {
    expect(canTransition("draft", "internal_review")).toBe(true);
    expect(canTransition("internal_review", "approved_to_issue")).toBe(true);
    expect(canTransition("approved_to_issue", "issued")).toBe(true);
  });

  it("never skips review or issues from a draft", () => {
    expect(canTransition("draft", "approved_to_issue")).toBe(false);
    expect(canTransition("draft", "issued")).toBe(false);
    expect(canTransition("internal_review", "issued")).toBe(false);
  });

  it("lets a reviewer send a version back before issue, never after", () => {
    expect(canTransition("internal_review", "draft")).toBe(true);
    expect(canTransition("approved_to_issue", "draft")).toBe(true);
    expect(canTransition("issued", "draft")).toBe(false);
    expect(canTransition("accepted", "draft")).toBe(false);
  });

  it("resolves an issued version to exactly the client outcomes plus supersession", () => {
    expect([...allowedTransitions("issued")].sort()).toEqual(
      ["accepted", "declined", "expired", "superseded", "withdrawn"].sort()
    );
  });

  it("treats declined, expired, superseded and withdrawn as terminal", () => {
    for (const s of ["declined", "expired", "superseded", "withdrawn"] as const) {
      expect(isTerminal(s)).toBe(true);
      for (const t of QUOTE_VERSION_STATUSES) expect(canTransition(s, t)).toBe(false);
    }
  });

  it("only draft and internal review are editable in place (matches the 0057 trigger)", () => {
    const editable = QUOTE_VERSION_STATUSES.filter(isContentEditable);
    expect(editable).toEqual(["draft", "internal_review"]);
  });
});

describe("supersession", () => {
  it("creates the next version only from an issued or accepted one", () => {
    const allowed = QUOTE_VERSION_STATUSES.filter(canCreateNextVersion);
    expect(allowed).toEqual(["issued", "accepted"]);
  });

  it("supersedes live prior versions when a new one is issued, and nothing else", () => {
    const superseded = QUOTE_VERSION_STATUSES.filter(supersededOnIssue);
    expect(superseded).toEqual(["issued", "accepted"]);
    expect(supersededOnIssue("draft")).toBe(false);
    expect(supersededOnIssue("withdrawn")).toBe(false);
  });

  it("accepted versions can only ever be superseded, never mutated into another state", () => {
    expect([...allowedTransitions("accepted")]).toEqual(["superseded"]);
  });
});

describe("stale tab rejection (§5.3 concurrency)", () => {
  const t = "2026-09-17T10:00:00.123456+00:00";

  it("accepts the same instant in either spelling", () => {
    expect(isStale(t, t)).toBe(false);
    expect(isStale("2026-09-17T10:00:00.123Z", "2026-09-17T10:00:00.123+00:00")).toBe(
      false
    );
  });

  it("rejects an older or newer expectation and garbage", () => {
    expect(isStale("2026-09-17T09:59:59.000Z", t)).toBe(true);
    expect(isStale("2026-09-17T10:00:01.000Z", t)).toBe(true);
    expect(isStale("", t)).toBe(true);
    expect(isStale("not a date", t)).toBe(true);
  });

  it("a stale tab cannot issue a superseded version", () => {
    const r = checkIssue({
      status: "superseded",
      hasApproval: true,
      expectedUpdatedAt: "2026-09-01T00:00:00Z",
      actualUpdatedAt: "2026-09-16T09:15:00Z",
    });
    expect(r).toEqual({ ok: false, reason: "stale" });
  });

  it("an up-to-date tab still cannot issue a superseded or unapproved version", () => {
    const now = "2026-09-16T09:15:00Z";
    expect(
      checkIssue({
        status: "superseded",
        hasApproval: true,
        expectedUpdatedAt: now,
        actualUpdatedAt: now,
      })
    ).toEqual({ ok: false, reason: "invalid_transition" });
    expect(
      checkIssue({
        status: "approved_to_issue",
        hasApproval: false,
        expectedUpdatedAt: now,
        actualUpdatedAt: now,
      })
    ).toEqual({ ok: false, reason: "approval_missing" });
    expect(
      checkIssue({
        status: "approved_to_issue",
        hasApproval: true,
        expectedUpdatedAt: now,
        actualUpdatedAt: now,
      })
    ).toEqual({ ok: true });
  });
});

describe("approval rules (§12.5 separation of duties)", () => {
  const base = {
    status: "internal_review" as QuoteVersionStatus,
    belowFloor: false,
    reason: null,
  };

  it("refuses the author approving their own version", () => {
    expect(checkApproval({ ...base, authorId: "u1", approverId: "u1" })).toEqual({
      ok: false,
      reason: "approver_is_author",
    });
  });

  it("refuses an authorless version rather than waving it through", () => {
    expect(checkApproval({ ...base, authorId: null, approverId: "u2" })).toEqual({
      ok: false,
      reason: "approver_is_author",
    });
  });

  it("accepts a second person at or above floor without a reason", () => {
    expect(checkApproval({ ...base, authorId: "u1", approverId: "u2" })).toEqual({
      ok: true,
    });
  });

  it("requires a written reason below floor", () => {
    expect(
      checkApproval({
        ...base,
        authorId: "u1",
        approverId: "u2",
        belowFloor: true,
        reason: "  ",
      })
    ).toEqual({ ok: false, reason: "reason_required" });
    expect(
      checkApproval({
        ...base,
        authorId: "u1",
        approverId: "u2",
        belowFloor: true,
        reason: "Strategic first client in sector; owner-approved",
      })
    ).toEqual({ ok: true });
  });

  it("only approves from internal review", () => {
    for (const status of QUOTE_VERSION_STATUSES) {
      const r = checkApproval({ ...base, status, authorId: "u1", approverId: "u2" });
      expect(r.ok).toBe(status === "internal_review");
    }
  });
});

describe("cost-derived floor", () => {
  it("is cost / (1 − min margin), rounded up, with no cap", () => {
    expect(floorMinor(690_000, 40)).toBe(1_150_000);
    expect(floorMinor(100, 33)).toBe(150);
    expect(floorMinor(10_000_000, 40)).toBe(Math.ceil(10_000_000 / 0.6));
  });

  it("treats an unassessed cost as no floor, never zero price", () => {
    expect(floorMinor(0, 40)).toBe(0);
    expect(
      isBelowFloor(
        { build_price_minor: 0 },
        { risk_adjusted_cost_minor: 0, min_margin_pct: 40 }
      )
    ).toBe(false);
  });

  it("flags a price under the floor", () => {
    const internal = { risk_adjusted_cost_minor: 690_000, min_margin_pct: 40 };
    expect(isBelowFloor({ build_price_minor: 1_480_000 }, internal)).toBe(false);
    expect(isBelowFloor({ build_price_minor: 1_149_999 }, internal)).toBe(true);
  });
});

describe("expiry", () => {
  it("defaults to 30 days from issue and honours a later requested date", () => {
    const issued = new Date("2026-09-17T12:00:00Z");
    expect(expiryFor(issued).toISOString()).toBe(
      new Date(issued.getTime() + DEFAULT_VALIDITY_DAYS * 86_400_000).toISOString()
    );
    expect(expiryFor(issued, new Date("2026-12-01T00:00:00Z")).toISOString()).toBe(
      "2026-12-01T00:00:00.000Z"
    );
  });

  it("ignores an expiry in the past", () => {
    const issued = new Date("2026-09-17T12:00:00Z");
    expect(expiryFor(issued, new Date("2026-01-01T00:00:00Z")).getTime()).toBeGreaterThan(
      issued.getTime()
    );
  });
});

describe("Studio mapping", () => {
  const northline = FIXTURE_QUOTE_VERSIONS[0];
  const superseded = FIXTURE_QUOTE_VERSIONS[1];
  const atlas = FIXTURE_QUOTE_VERSIONS[2];

  it("converts minor units to pounds and keeps the id, version and client", () => {
    const q = toStudioQuote(northline.version, northline.quote, northline.opportunity);
    expect(q.id).toBe("q-northline-v2");
    expect(q.version).toBe("v2");
    expect(q.status).toBe("Internal review");
    expect(q.commercial.buildPriceGbp).toBe(14_800);
    expect(q.internal.riskAdjustedCostGbp).toBe(6_900);
    expect(q.client).toBe(northline.opportunity.legal_name);
  });

  it("renders post-issue states as read-only Issued with the true state in the save note", () => {
    const q = toStudioQuote(superseded.version, superseded.quote, superseded.opportunity);
    expect(q.status).toBe("Issued");
    expect(q.savedAt).toMatch(/^Superseded .* read-only$/);
    expect(q.expires).toMatch(/2026/);
  });

  it("derives the current step from the first empty payload", () => {
    const steps = deriveSteps(atlas.version);
    expect(steps[0]).toEqual({ name: "Brief", state: "current" });
    expect(steps.filter((s) => s.state === "current")).toHaveLength(1);
  });

  it("fills missing payloads with safe defaults instead of throwing", () => {
    const q = toStudioQuote(atlas.version, atlas.quote, atlas.opportunity);
    expect(q.brief.outcomes).toEqual([]);
    expect(q.commercial.route).toBe("unresolved");
    expect(q.internal.approver).toBe("—");
    expect(q.checks).toEqual([]);
  });
});

describe("listing fixtures", () => {
  it("only link to Studio pages that exist and use example.test contacts", () => {
    for (const item of FIXTURE_QUOTE_VERSIONS) {
      expect(item.opportunity.contact_email).toMatch(/@example\.test$/);
      expect(item.version.currency).toBe("GBP");
    }
    expect(FIXTURE_STUDIO_IDS.has("q-northline-v2")).toBe(true);
    expect(FIXTURE_STUDIO_IDS.has("q-northline-v1")).toBe(false);
  });

  it("carries a superseded version whose successor is the current one", () => {
    const v1 = FIXTURE_QUOTE_VERSIONS.find((i) => i.version.id === "q-northline-v1");
    expect(v1?.version.status).toBe("superseded");
    expect(v1?.version.superseded_by).toBe("q-northline-v2");
  });
});
