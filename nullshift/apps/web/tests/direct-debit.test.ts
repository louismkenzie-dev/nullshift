import { describe, expect, it } from "vitest";
import {
  classifyCollection,
  directDebitAlertEmail,
  directDebitFindings,
  expectedPence,
  gbpPence,
  isCancellable,
  type Collection,
  type PlanSubscription,
} from "@/lib/billing/directDebit";

const sub: PlanSubscription = {
  id: "76e1beeb-1bad-47ee-b488-1d92d1e2b3dc",
  tenantId: "2e458eb1-2217-40d2-a52e-9bdfc32c797e",
  plan: "build_3",
  mrr: 180,
  status: "active",
  gcSubscriptionId: "SB01PLAN",
  gcMandateId: "MD01MANDATE",
};

const payment = (over: Partial<Collection> = {}): Collection => ({
  id: "PM01PLAN",
  status: "confirmed",
  amountPence: 18000,
  chargeDate: "2026-09-05",
  subscriptionId: "SB01PLAN",
  mandateId: "MD01MANDATE",
  ...over,
});

const now = new Date("2026-10-10T12:00:00Z");

describe("expected amount", () => {
  it("is the contracted MRR in pence, 0 when unknown", () => {
    expect(expectedPence(180)).toBe(18000);
    expect(expectedPence("180.00")).toBe(18000);
    expect(expectedPence(0)).toBe(0);
    expect(expectedPence(null)).toBe(0);
    expect(gbpPence(18000)).toBe("£180");
    expect(gbpPence(85050)).toBe("£850.50");
  });
});

describe("classifyCollection", () => {
  it("accepts the plan subscription at the contracted amount", () => {
    expect(classifyCollection(payment(), sub)).toEqual({ kind: "plan", expectedPence: 18000 });
  });

  it("rejects the plan subscription collecting a different amount", () => {
    expect(classifyCollection(payment({ id: "PM01BIG", amountPence: 85000 }), sub)).toEqual({
      kind: "off_plan",
      reason: "amount",
      expectedPence: 18000,
    });
  });

  it("rejects a one-off payment (no subscription) even at the plan amount", () => {
    expect(classifyCollection(payment({ subscriptionId: null }), sub)).toMatchObject({ kind: "off_plan", reason: "subscription" });
  });

  it("rejects a payment from a subscription we do not hold", () => {
    expect(classifyCollection(payment({ subscriptionId: "SB01OTHER" }), sub)).toMatchObject({ kind: "off_plan", reason: "subscription" });
  });

  it("rejects a payment under another mandate before anything else", () => {
    expect(classifyCollection(payment({ mandateId: "MD01OTHER", subscriptionId: null }), sub)).toMatchObject({ kind: "off_plan", reason: "mandate" });
  });

  it("checks only the amount for a legacy row with no subscription id", () => {
    const legacy = { ...sub, gcSubscriptionId: null };
    expect(classifyCollection(payment({ subscriptionId: null }), legacy).kind).toBe("plan");
    expect(classifyCollection(payment({ subscriptionId: null, amountPence: 85000 }), legacy)).toMatchObject({ kind: "off_plan", reason: "amount" });
  });
});

describe("directDebitFindings", () => {
  const healthy = {
    subscription: { id: "SB01PLAN", status: "active", amountPence: 18000, upcomingPayments: [{ chargeDate: "2026-11-05", amountPence: 18000 }] },
    mandate: { id: "MD01MANDATE", status: "active", nextPossibleChargeDate: "2026-10-14" },
    payments: [payment(), payment({ id: "PM01AUG", chargeDate: "2026-08-05" })],
  };

  it("is empty when GoCardless agrees with the plan", () => {
    expect(directDebitFindings({ sub, live: healthy, now })).toEqual([]);
  });

  it("flags an amended subscription amount as urgent drift, naming the next charge", () => {
    const live = { ...healthy, subscription: { ...healthy.subscription, amountPence: 85000, upcomingPayments: [{ chargeDate: "2026-11-05", amountPence: 85000 }] } };
    const [f] = directDebitFindings({ sub, live, now });
    expect(f).toMatchObject({ code: "amount_drift", severity: "urgent", amountPence: 85000, expectedPence: 18000 });
    expect(f.title).toBe("Direct Debit is set to collect £850 — the plan is £180");
    expect(f.detail).toContain("5 Nov 2026");
  });

  it("flags an off-plan payment by how far it has got: cancellable, in flight, collected", () => {
    const live = {
      ...healthy,
      payments: [
        payment({ id: "PM01PEND", status: "pending_submission", amountPence: 85000, subscriptionId: null, chargeDate: "2026-10-15" }),
        payment({ id: "PM01SUBM", status: "submitted", amountPence: 85000, subscriptionId: null, chargeDate: "2026-10-12" }),
        payment({ id: "PM01DONE", status: "paid_out", amountPence: 85000, subscriptionId: null, chargeDate: "2026-10-05" }),
        payment({ id: "PM01DEAD", status: "cancelled", amountPence: 85000, subscriptionId: null, chargeDate: "2026-10-01" }),
        payment(),
      ],
    };
    const f = directDebitFindings({ sub, live, now });
    expect(f.map((x) => x.code)).toEqual(["off_plan_pending", "off_plan_in_flight", "off_plan_collected"]);
    expect(f[0]).toMatchObject({ paymentId: "PM01PEND", cancellable: true, reason: "subscription" });
    expect(f[1]).toMatchObject({ paymentId: "PM01SUBM", cancellable: false });
    expect(f[2].title).toBe("£850 was collected on 5 Oct 2026 — not the plan");
    expect(f[2].detail).toContain("NOT booked as the care plan");
  });

  it("ignores old off-plan payments outside the lookback but never a scheduled one", () => {
    const live = {
      ...healthy,
      payments: [
        payment({ id: "PM01OLD", status: "paid_out", amountPence: 85000, subscriptionId: null, chargeDate: "2025-01-05" }),
        payment({ id: "PM01FUT", status: "pending_submission", amountPence: 85000, subscriptionId: null, chargeDate: "2027-01-05" }),
      ],
    };
    expect(directDebitFindings({ sub, live, now }).map((x) => x.paymentId)).toEqual(["PM01FUT"]);
  });

  it("reports a dead subscription or mandate as a normal finding", () => {
    const live = {
      ...healthy,
      subscription: { ...healthy.subscription, status: "cancelled" },
      mandate: { ...healthy.mandate, status: "cancelled" },
    };
    const codes = directDebitFindings({ sub, live, now }).map((x) => [x.code, x.severity]);
    expect(codes).toEqual([
      ["subscription_inactive", "normal"],
      ["mandate_inactive", "normal"],
    ]);
  });

  it("copes with GoCardless not answering for part of the picture", () => {
    expect(directDebitFindings({ sub, live: { subscription: null, mandate: null, payments: [] }, now })).toEqual([]);
  });

  it("puts urgent findings first", () => {
    const live = {
      ...healthy,
      mandate: { ...healthy.mandate, status: "cancelled" },
      payments: [payment({ id: "PM01DONE", status: "confirmed", amountPence: 85000, subscriptionId: null, chargeDate: "2026-10-05" })],
    };
    expect(directDebitFindings({ sub, live, now }).map((x) => x.code)).toEqual(["off_plan_collected", "mandate_inactive"]);
  });
});

describe("statuses and the alert email", () => {
  it("knows which statuses can still be cancelled", () => {
    expect(isCancellable("pending_submission")).toBe(true);
    expect(isCancellable("submitted")).toBe(false);
    expect(isCancellable("confirmed")).toBe(false);
  });

  it("writes a staff alert that names the client, the finding and the page", () => {
    const [f] = directDebitFindings({
      sub,
      live: { subscription: null, mandate: null, payments: [payment({ id: "PM01DONE", status: "confirmed", amountPence: 85000, subscriptionId: null, chargeDate: "2026-10-05" })] },
      now,
    });
    const mail = directDebitAlertEmail({
      tenantName: "The Dance Exclusive",
      findings: [f],
      carePlanUrl: "https://nullshift.co.uk/admin/clients/x/care-plan",
      dashboardUrl: "https://manage.gocardless.com/payments/PM01DONE",
    });
    expect(mail.subject).toBe("Direct Debit alert — The Dance Exclusive: £850 was collected on 5 Oct 2026 — not the plan");
    expect(mail.html).toContain("Open the care-plan page");
    expect(mail.html).toContain("manage.gocardless.com/payments/PM01DONE");
    expect(mail.text).toContain("NOT booked as the care plan");
  });
});
