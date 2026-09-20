import { describe, expect, it } from "vitest";
import type { Block } from "@/lib/hub/rules";
import {
  attentionFor,
  isLegacy,
  liveOrderForm,
  liveSubscription,
  type OpsSignals,
  type SubscriptionDetailRow,
} from "@/lib/ops/clientsData";
import { deriveToday } from "@/lib/ops/todayData";
import { weightedPipeline, type Opportunity } from "@/lib/ops/salesData";

const NOW = new Date("2026-09-20T12:00:00Z");

function block(id: string, name: string, over: Partial<Block> = {}): Block {
  return {
    tenant: {
      id,
      name,
      type: "client",
      status: "active",
      vertical: null,
      contactName: null,
      contactEmail: null,
      carePlanChoice: null,
      carePlanTermsAcceptedAt: null,
      stripeConnectStatus: null,
      createdAt: "2026-01-01T00:00:00Z",
    },
    projects: [],
    project: null,
    orderForm: null,
    changeOrdersInReview: 0,
    subscription: null,
    pricing: {
      scored: false,
      anyPriced: false,
      enterpriseReview: false,
      band: null,
      multiplier: null,
      scan: null,
    },
    issues: { open: 0, critHigh: 0, awaitingClient: 0 },
    invoices: {
      openCount: 0,
      openTotal: 0,
      overdueCount: 0,
      overdueTotal: 0,
      paidTotal: 0,
      hasAny: false,
    },
    carePlan: { optionsSentAt: null, ddLinkSentAt: null },
    portal: { state: "none", email: null, lastSignInAt: null },
    documents: [],
    docs: { awaitingApproval: 0, awaitingSignature: 0, signed: 0, sent: 0 },
    colour: { tone: "success", label: "Active" },
    awaitingSignature: 0,
    ...over,
  };
}

function sub(over: Partial<SubscriptionDetailRow>): SubscriptionDetailRow {
  return {
    id: "s1",
    tenant_id: "t1",
    plan: "hosting",
    status: "active",
    provider: "gocardless",
    mrr: 40,
    started_at: "2026-03-05T00:00:00Z",
    gc_billing_request_id: null,
    gc_mandate_id: "MD1",
    gc_subscription_id: "SB1",
    terms_version: null,
    terms_accepted_at: null,
    created_at: "2026-03-01T00:00:00Z",
    ...over,
  };
}

function signals(over: Partial<OpsSignals> = {}): OpsSignals {
  return {
    now: NOW,
    nextActions: new Map(),
    nextActionsAvailable: true,
    issues: [],
    invoices: [],
    subscriptions: [],
    orderForms: [],
    buildFees: new Map(),
    ...over,
  };
}

describe("today metrics (brief §5.1 definitions)", () => {
  it("sums contracted mrr over active/trialing/past_due only and splits legacy vs new", () => {
    const s = signals({
      subscriptions: [
        sub({ id: "a", tenant_id: "t1", plan: "hosting", status: "active", mrr: 40 }),
        sub({ id: "b", tenant_id: "t2", plan: "core", status: "past_due", mrr: 149, provider: "stripe" }),
        sub({ id: "c", tenant_id: "t3", plan: "pro", status: "incomplete", mrr: 249 }),
        sub({ id: "d", tenant_id: "t4", plan: "hosting_api", status: "canceled", mrr: 80 }),
      ],
      invoices: [
        {
          id: "i1",
          tenant_id: "t1",
          project_id: null,
          type: "build_milestone",
          amount: "1500",
          status: "open",
          due_at: "2026-09-01T00:00:00Z",
          paid_at: null,
          xero_invoice_id: "X1",
          created_at: "2026-08-01T00:00:00Z",
        },
        {
          id: "i2",
          tenant_id: "t2",
          project_id: null,
          type: "one_off",
          amount: 300,
          status: "open",
          due_at: "2026-10-01T00:00:00Z",
          paid_at: null,
          xero_invoice_id: null,
          created_at: "2026-09-10T00:00:00Z",
        },
        {
          id: "i3",
          tenant_id: "t2",
          project_id: null,
          type: "one_off",
          amount: 999,
          status: "paid",
          due_at: null,
          paid_at: "2026-09-01T00:00:00Z",
          xero_invoice_id: null,
          created_at: "2026-08-01T00:00:00Z",
        },
      ],
    });
    const blocks = [block("t1", "One"), block("t2", "Two"), block("t3", "Three"), block("t4", "Four")];
    const today = deriveToday({ clients: [], attention: [], signals: s, blocks, truncated: false });
    expect(today.metrics.contractedMonthlyGbp).toBe(189);
    expect(today.metrics.contractedLegacyGbp).toBe(40);
    expect(today.metrics.contractedNewGbp).toBe(149);
    expect(today.metrics.scheduledNext30Gbp).toBe(40); // active GoCardless only
    expect(today.metrics.awaitingMandateGbp).toBe(249);
    expect(today.metrics.outstandingGbp).toBe(1800);
    expect(today.metrics.overdueGbp).toBe(1500);
    // i2 has no Xero record → exception; past_due sub → exception
    expect(today.exceptions.map((e) => e.tone)).toEqual(["exception", "exception"]);
  });
});

describe("attention queue", () => {
  it("orders overdue invoices before contract signals before routine issues", () => {
    const b = block("t1", "Client");
    const s = signals({
      invoices: [
        {
          id: "i1",
          tenant_id: "t1",
          project_id: null,
          type: "build_milestone",
          amount: 700,
          status: "open",
          due_at: "2026-09-01T00:00:00Z",
          paid_at: null,
          xero_invoice_id: null,
          created_at: "2026-08-01T00:00:00Z",
        },
      ],
      orderForms: [
        {
          id: "of1",
          tenant_id: "t1",
          reference: "OF-1",
          status: "client_review",
          plan: "core",
          monthly_fee: 149,
          project_fee: 5000,
          sent_at: "2026-09-01T00:00:00Z",
          accepted_at: null,
          reviewed_by: "u1",
          created_at: "2026-08-30T00:00:00Z",
        },
      ],
      issues: [
        {
          id: "x1",
          tenant_id: "t1",
          title: "Login fails",
          status: "new",
          severity: "high",
          billing: "unclassified",
          classification: null,
          client_visible: true,
          source: "portal",
          due_at: null,
          created_at: "2026-09-18T00:00:00Z",
        },
      ],
    });
    const rows = attentionFor(b, s, null, liveOrderForm(s.orderForms));
    expect(rows.map((r) => r.kind)).toEqual(["finance", "contract", "routine"]);
    expect(rows[0].href).toBe("/admin/clients/t1/billing");
    expect(rows[1].problem).toContain("OF-1");
    expect(rows[2].href).toBe("/admin/clients/t1/issues");
    expect(rows.every((r) => r.owner === "Unassigned")).toBe(true);
  });

  it("flags a chosen plan without accepted terms, and a Direct Debit awaiting mandate", () => {
    const b = block("t1", "Client", {
      tenant: { ...block("t1", "Client").tenant, carePlanChoice: "hosting" },
    });
    const incomplete = sub({ status: "incomplete", gc_mandate_id: null, gc_billing_request_id: "BR1" });
    const rows = attentionFor(b, signals({ subscriptions: [incomplete] }), incomplete, null);
    expect(rows.map((r) => r.kind)).toEqual(["finance", "contract"]);
    expect(rows[0].href).toBe("/admin/billing/direct-debits");
    expect(rows[1].href).toBe("/admin/clients/t1/care-plan");
  });
});

describe("row selection and legacy marker", () => {
  it("prefers a live subscription and an accepted order form over stale rows", () => {
    const live = liveSubscription([
      sub({ id: "old", status: "canceled", created_at: "2026-09-01T00:00:00Z" }),
      sub({ id: "new", status: "active", created_at: "2026-01-01T00:00:00Z" }),
    ]);
    expect(live?.id).toBe("new");
    const of = liveOrderForm([
      {
        id: "d",
        tenant_id: "t1",
        reference: "OF-D",
        status: "draft",
        plan: null,
        monthly_fee: null,
        project_fee: null,
        sent_at: null,
        accepted_at: null,
        reviewed_by: null,
        created_at: "2026-09-10T00:00:00Z",
      },
      {
        id: "a",
        tenant_id: "t1",
        reference: "OF-A",
        status: "accepted",
        plan: "core",
        monthly_fee: 149,
        project_fee: null,
        sent_at: null,
        accepted_at: "2026-09-02T00:00:00Z",
        reviewed_by: "u",
        created_at: "2026-08-10T00:00:00Z",
      },
    ]);
    expect(of?.reference).toBe("OF-A");
  });

  it("marks legacy by plan id or a pre-September-2026 accepted proposal, never by signature alone", () => {
    expect(isLegacy(block("t1", "A"), sub({ plan: "build_3" }))).toBe(true);
    expect(isLegacy(block("t1", "A"), sub({ plan: "core" }))).toBe(false);
    const oldAccepted = block("t1", "A", {
      project: {
        id: "p",
        proposalReviewedBy: null,
        name: "Site",
        stage: "live",
        proposalStatus: "accepted",
        proposalSentAt: null,
        acceptedAt: "2026-06-01T00:00:00Z",
        liveUrl: null,
        nextAction: null,
        nextActionOwner: null,
        owners: { account: null, delivery: null, technical: null, finance: null },
        profile: null,
      },
    });
    expect(isLegacy(oldAccepted, null)).toBe(true);
    const newAccepted = block("t1", "A", {
      project: { ...oldAccepted.project!, acceptedAt: "2026-09-15T00:00:00Z" },
    });
    expect(isLegacy(newAccepted, null)).toBe(false);
  });
});

describe("weighted pipeline", () => {
  const opp = (over: Partial<Opportunity>): Opportunity => ({
    id: "o",
    source: "opportunity",
    company: "Co",
    opportunity: "Site",
    stage: "Sent",
    owner: "Unassigned",
    nextAction: { text: "x", due: "no date" },
    confidence: "not estimated",
    detail: {
      problem: "",
      outcome: "",
      stakeholders: [],
      currentProcess: "",
      timeline: "",
      budgetSignal: "",
      systems: [],
      dataSensitivity: "none stated",
      discoveryNotes: [],
      linkedQuoteIds: [],
      activity: [],
      decisionRationale: "",
    },
    duplicateMatches: [],
    ...over,
  });

  it("is not configured unless every open opportunity has an explicit probability", () => {
    const w = weightedPipeline([
      opp({ id: "a", proposalValue: { amountMinor: 100000, currency: "GBP" }, probabilityPct: 50 }),
      opp({ id: "b", proposalValue: { amountMinor: 50000, currency: "GBP" } }),
    ]);
    expect(w.configured).toBe(false);
    if (!w.configured) expect(w.unweightedOpen.amountMinor).toBe(150000);
    const ok = weightedPipeline([
      opp({ id: "a", proposalValue: { amountMinor: 100000, currency: "GBP" }, probabilityPct: 50 }),
    ]);
    expect(ok).toEqual({ configured: true, total: { amountMinor: 50000, currency: "GBP" } });
  });
});
