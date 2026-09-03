import { describe, expect, it } from "vitest";
import {
  awaitingSignatureCount,
  blockColour,
  carePlanState,
  summariseReceipts,
  tileStates,
  type Block,
  type BlockProject,
  type CarePlanInput,
} from "@/lib/hub/rules";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const project = (over: Partial<BlockProject> = {}): BlockProject => ({
  id: "p1",
  name: "Acme — build",
  stage: "live",
  proposalStatus: "accepted",
  proposalSentAt: "2026-07-01T00:00:00Z",
  acceptedAt: "2026-07-03T00:00:00Z",
  liveUrl: "https://acme.example",
  nextAction: "Send month-one review",
  nextActionOwner: "Louis",
  owners: { account: "Louis", delivery: "Louis", technical: "Louis", finance: "Louis" },
  profile: {
    repo: "nullshift/acme",
    supabaseRef: "abcdefghijklmnop",
    health: "ok",
    buildGoal: "Bookings for a clinic",
  },
  ...over,
});

const block = (over: Partial<Block> = {}): Block => {
  const p = over.project === undefined ? project() : over.project;
  return {
    tenant: {
      id: "t1",
      name: "Acme",
      type: "client",
      status: "active",
      vertical: "clinic",
      contactName: "Ann",
      contactEmail: "ann@acme.example",
      carePlanChoice: "hosting_api",
      carePlanTermsAcceptedAt: "2026-07-10T00:00:00Z",
      createdAt: "2026-06-01T00:00:00Z",
    },
    projects: p ? [p] : [],
    project: p,
    orderForm: null,
    changeOrdersInReview: 0,
    subscription: {
      id: "s1",
      plan: "hosting_api",
      planLabel: "Pro",
      status: "active",
      provider: "gocardless",
      mrr: 120,
    },
    pricing: {
      scored: true,
      anyPriced: true,
      enterpriseReview: false,
      band: "growth",
      multiplier: 1.5,
      scan: null,
    },
    issues: { open: 0, critHigh: 0, awaitingClient: 0 },
    invoices: {
      openCount: 0,
      openTotal: 0,
      overdueCount: 0,
      overdueTotal: 0,
      paidTotal: 2400,
      hasAny: true,
    },
    carePlan: { optionsSentAt: "2026-07-05T00:00:00Z", ddLinkSentAt: null },
    portal: { state: "active", email: "ann@acme.example", lastSignInAt: "2026-07-11" },
    documents: [],
    docs: { awaitingApproval: 0, awaitingSignature: 0, signed: 2, sent: 2 },
    colour: { tone: "success", label: "Active" },
    awaitingSignature: 0,
    ...over,
  };
};

// ---------------------------------------------------------------------------
// Block colour
// ---------------------------------------------------------------------------

describe("blockColour", () => {
  const base = {
    proposalStatus: null,
    orderFormStatus: null,
    tenantStatus: "active",
    stage: null,
  };

  it("is green once the proposal is signed, and stays green when complete", () => {
    expect(blockColour({ ...base, proposalStatus: "accepted", stage: "live" })).toEqual({
      tone: "success",
      label: "Active",
    });
    expect(
      blockColour({ ...base, proposalStatus: "accepted", stage: "complete" }).tone
    ).toBe("success");
  });

  it("is green on a signed Order Form even without a proposal", () => {
    expect(blockColour({ ...base, orderFormStatus: "accepted" }).tone).toBe("success");
  });

  it("is orange while a proposal or Order Form awaits signature", () => {
    expect(blockColour({ ...base, proposalStatus: "sent", stage: "discovery" })).toEqual({
      tone: "warning",
      label: "Quote sent",
    });
    expect(blockColour({ ...base, orderFormStatus: "client_review" }).tone).toBe(
      "warning"
    );
  });

  it("does not regress to orange when a later Order Form is out for signature", () => {
    expect(
      blockColour({
        ...base,
        proposalStatus: "accepted",
        orderFormStatus: "client_review",
      }).tone
    ).toBe("success");
    expect(
      awaitingSignatureCount({
        proposalStatus: "accepted",
        orderFormStatus: "client_review",
        changeOrdersInReview: 2,
      })
    ).toBe(3);
  });

  it("is red for a lead, a prospect and a draft", () => {
    expect(blockColour({ ...base, isLead: true })).toEqual({
      tone: "danger",
      label: "Enquiry",
    });
    expect(blockColour({ ...base, tenantStatus: "prospect" })).toEqual({
      tone: "danger",
      label: "Enquiry",
    });
    expect(blockColour({ ...base, proposalStatus: "draft" })).toEqual({
      tone: "danger",
      label: "Not sent",
    });
  });

  it("is red with 'Declined' for a declined proposal", () => {
    expect(blockColour({ ...base, proposalStatus: "declined" })).toEqual({
      tone: "danger",
      label: "Declined",
    });
  });

  it("is orange, not 'Declined', when an Order Form is in flight after a declined proposal", () => {
    expect(
      blockColour({
        ...base,
        proposalStatus: "declined",
        orderFormStatus: "client_review",
      })
    ).toEqual({ tone: "warning", label: "Quote sent" });
    expect(
      blockColour({ ...base, proposalStatus: "declined", orderFormStatus: "accepted" })
        .tone
    ).toBe("success");
  });
});

// ---------------------------------------------------------------------------
// Care plan
// ---------------------------------------------------------------------------

describe("carePlanState", () => {
  const ready: CarePlanInput = {
    scored: true,
    anyPriced: true,
    enterpriseReview: false,
    stage: "live",
    choice: null,
    subscriptionStatus: null,
    subscriptionProvider: null,
    optionsSentAt: null,
    ddLinkSentAt: null,
  };

  it("is red when the client has not been scored", () => {
    const s = carePlanState({ ...ready, scored: false, anyPriced: false });
    expect(s.tone).toBe("danger");
    expect(s.label).toBe("Not scored");
  });

  it("is red when scored but no price is ready (Enterprise review)", () => {
    const s = carePlanState({ ...ready, anyPriced: false, enterpriseReview: true });
    expect(s.tone).toBe("danger");
    expect(s.label).toMatch(/quote/i);
  });

  it("is amber once options are sent but nothing is subscribed", () => {
    const s = carePlanState({ ...ready, optionsSentAt: "2026-07-05T00:00:00Z" });
    expect(s.tone).toBe("warning");
    expect(s.label).toBe("Options sent");
  });

  it("is amber while a Direct Debit mandate is incomplete", () => {
    expect(
      carePlanState({
        ...ready,
        ddLinkSentAt: "2026-07-06T00:00:00Z",
        subscriptionStatus: "incomplete",
        subscriptionProvider: "gocardless",
      })
    ).toMatchObject({ tone: "warning", label: "Awaiting mandate" });
    // The link alone (no subscription row yet) reads the same way.
    expect(carePlanState({ ...ready, ddLinkSentAt: "2026-07-06T00:00:00Z" }).tone).toBe(
      "warning"
    );
  });

  it("is green when subscribed", () => {
    for (const status of ["active", "trialing"]) {
      const s = carePlanState({
        ...ready,
        subscriptionStatus: status,
        subscriptionProvider: "gocardless",
        planLabel: "Pro",
        mrr: 120,
      });
      expect(s.tone).toBe("success");
      expect(s.label).toBe("Subscribed");
      expect(s.sub).toContain("Pro");
      expect(s.sub).toContain("120");
    }
  });

  it("is red with 'Past due' when the subscription is failing", () => {
    const s = carePlanState({
      ...ready,
      subscriptionStatus: "past_due",
      subscriptionProvider: "stripe",
    });
    expect(s.tone).toBe("danger");
    expect(s.label).toBe("Past due");
  });

  it("is grey when the client chose no plan", () => {
    const s = carePlanState({ ...ready, choice: "none" });
    expect(s.tone).toBe("muted");
    expect(s.label).toMatch(/no plan/i);
  });

  it("is grey while the chooser is closed before go-live", () => {
    for (const stage of ["discovery", "build", "review", "launch_prep"]) {
      const s = carePlanState({ ...ready, stage });
      expect(s.tone).toBe("muted");
      expect(s.label).toBe("Opens at go-live");
      expect(s.sub).toContain(`stage ${stage.replace(/_/g, " ")}`);
    }
    // Unscored AND not live: the gate wins, but the sub-line says it is unscored.
    expect(carePlanState({ ...ready, stage: "build", scored: false }).sub).toMatch(
      /not scored/
    );
  });

  it("is red when priced and live but nobody has sent the options yet", () => {
    const s = carePlanState(ready);
    expect(s.tone).toBe("danger");
    expect(s.label).toBe("Options not sent");
  });
});

// ---------------------------------------------------------------------------
// Tiles
// ---------------------------------------------------------------------------

describe("tileStates", () => {
  it("links every tile under /admin/clients/[id]/", () => {
    const t = tileStates(block());
    expect(t.passport.href).toBe("/admin/clients/t1/passport");
    expect(t.billing.href).toBe("/admin/clients/t1/billing");
    expect(t.issues.href).toBe("/admin/clients/t1/issues");
    expect(t.carePlan.href).toBe("/admin/clients/t1/care-plan");
    expect(t.scale.href).toBe("/admin/clients/t1/pricing");
    expect(t.account.href).toBe("/admin/clients/t1/account");
    expect(t.docs.href).toBe("/admin/clients/t1/docs");
  });

  it("is all green for a healthy, subscribed, settled client", () => {
    const t = tileStates(block());
    for (const key of Object.keys(t) as (keyof typeof t)[])
      expect(t[key].tone, key).toBe("success");
    expect(t.scale.label).toBe("Band Growth x1.5");
    expect(t.billing.label).toBe("Settled");
    expect(t.issues.label).toBe("Clear");
    expect(t.docs.label).toBe("All signed");
  });

  describe("passport", () => {
    it("is muted with no project", () => {
      const t = tileStates(block({ project: null, projects: [] }));
      expect(t.passport).toMatchObject({ tone: "muted", label: "No system yet" });
    });
    it("is red when the system is down or has no repo", () => {
      expect(
        tileStates(
          block({
            project: project({
              profile: { repo: "x/y", supabaseRef: "r", health: "down", buildGoal: "g" },
            }),
          })
        ).passport.tone
      ).toBe("danger");
      expect(
        tileStates(
          block({
            project: project({
              profile: { repo: null, supabaseRef: "r", health: "ok", buildGoal: "g" },
            }),
          })
        ).passport.tone
      ).toBe("danger");
      expect(
        tileStates(block({ project: project({ profile: null }) })).passport.tone
      ).toBe("danger");
    });
    it("is amber when the passport is incomplete", () => {
      const t = tileStates(
        block({
          project: project({
            profile: { repo: "x/y", supabaseRef: null, health: "ok", buildGoal: "g" },
          }),
        })
      );
      expect(t.passport).toMatchObject({ tone: "warning", label: "Passport incomplete" });
    });
    it("lists several systems in the sub-line", () => {
      const p2 = project({ id: "p2", name: "Acme — app" });
      const t = tileStates(block({ projects: [p2, project()], project: p2 }));
      expect(t.passport.sub).toContain("2 systems");
    });
  });

  describe("billing", () => {
    it("is red on overdue invoices, amber on open, muted with none", () => {
      const inv = block().invoices;
      expect(
        tileStates(
          block({
            invoices: {
              ...inv,
              openCount: 2,
              openTotal: 900,
              overdueCount: 1,
              overdueTotal: 400,
            },
          })
        ).billing
      ).toMatchObject({ tone: "danger", label: "Overdue GBP 400" });
      expect(
        tileStates(block({ invoices: { ...inv, openCount: 1, openTotal: 500 } })).billing
      ).toMatchObject({ tone: "warning", label: "Awaiting payment GBP 500" });
      expect(
        tileStates(block({ invoices: { ...inv, paidTotal: 0, hasAny: false } })).billing
      ).toMatchObject({ tone: "muted", label: "No invoices" });
    });
  });

  describe("issues", () => {
    it("is red on critical/high, amber on any open", () => {
      expect(
        tileStates(block({ issues: { open: 3, critHigh: 1, awaitingClient: 0 } })).issues
      ).toMatchObject({ tone: "danger", label: "1 critical/high" });
      expect(
        tileStates(block({ issues: { open: 2, critHigh: 0, awaitingClient: 1 } })).issues
      ).toMatchObject({ tone: "warning", label: "2 open" });
    });
  });

  describe("scale", () => {
    it("is red when unscored, amber with an unconfirmed auto-score", () => {
      const pricing = block().pricing;
      expect(
        tileStates(
          block({ pricing: { ...pricing, scored: false, anyPriced: false, band: null } })
        ).scale
      ).toMatchObject({ tone: "danger", label: "Not scored" });
      expect(
        tileStates(
          block({
            pricing: {
              ...pricing,
              scored: false,
              anyPriced: false,
              band: null,
              scan: { nsi: 42, band: "growth", pending: 3 },
            },
          })
        ).scale
      ).toMatchObject({ tone: "warning", label: "Auto NSI 42 - confirm" });
    });
  });

  describe("account", () => {
    it("is amber with no next action, no owner, or a portal never signed in", () => {
      expect(
        tileStates(block({ project: project({ nextAction: null }) })).account
      ).toMatchObject({ tone: "warning", label: "No next action" });
      expect(
        tileStates(
          block({
            project: project({
              owners: { account: null, delivery: null, technical: null, finance: null },
            }),
          })
        ).account
      ).toMatchObject({ tone: "warning", label: "No owner" });
      expect(
        tileStates(
          block({
            portal: { state: "invited", email: "ann@acme.example", lastSignInAt: null },
          })
        ).account
      ).toMatchObject({ tone: "warning", label: "Never signed in" });
    });
  });

  describe("docs", () => {
    it("is amber awaiting approval or signature, muted when nothing sent", () => {
      expect(
        tileStates(
          block({
            docs: { awaitingApproval: 1, awaitingSignature: 0, signed: 0, sent: 0 },
          })
        ).docs
      ).toMatchObject({ tone: "warning", label: "1 awaiting approval" });
      expect(
        tileStates(
          block({
            docs: { awaitingApproval: 0, awaitingSignature: 1, signed: 1, sent: 2 },
          })
        ).docs
      ).toMatchObject({ tone: "warning", label: "1 awaiting signature" });
      expect(
        tileStates(
          block({
            docs: { awaitingApproval: 0, awaitingSignature: 0, signed: 0, sent: 0 },
          })
        ).docs
      ).toMatchObject({ tone: "muted", label: "Nothing sent" });
    });

    it("folds read receipts into the summary", () => {
      expect(
        summariseReceipts([
          {
            documentType: "proposal",
            documentId: "p1",
            title: "Proposal",
            sentAt: "2026-07-01",
            viewedAt: "2026-07-02",
            signedAt: "2026-07-03",
            approvedAt: "2026-06-30",
            awaitingApproval: false,
          },
          {
            documentType: "order_form",
            documentId: "o1",
            title: "OF-2026-0001",
            sentAt: "2026-07-05",
            viewedAt: null,
            signedAt: null,
            approvedAt: "2026-07-04",
            awaitingApproval: false,
          },
          {
            documentType: "change_order",
            documentId: "c1",
            title: "CO-2026-0001",
            sentAt: null,
            viewedAt: null,
            signedAt: null,
            approvedAt: null,
            awaitingApproval: true,
          },
        ])
      ).toEqual({ awaitingApproval: 1, awaitingSignature: 1, signed: 1, sent: 2 });
    });
  });

  it("reads the care plan tile from carePlanState (build stage -> grey)", () => {
    const t = tileStates(
      block({ project: project({ stage: "build" }), subscription: null })
    );
    expect(t.carePlan).toMatchObject({ tone: "muted", label: "Opens at go-live" });
  });
});
