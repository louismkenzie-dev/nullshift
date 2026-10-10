import { describe, expect, it } from "vitest";
import {
  INVOICE_CHASE_DAYS,
  MAX_INVOICE_REMINDERS,
  MAX_PERIODS_PER_RUN,
  PAST_DUE_AFTER_DAYS,
  carePlanPeriodLine,
  daysOverdue,
  decideInvoiceChase,
  invoiceDueAt,
  monthlyPeriodsDue,
  monthsOn,
  nextPeriodStart,
  parseIsoDate,
  periodAt,
  periodLabel,
  subscriptionStatusFromInvoices,
  suggestedInvoicedFrom,
} from "@/lib/billing/invoicedPlans";
import { referenceHit } from "@/lib/revolut/match";

const at = (iso: string) => new Date(iso);

describe("periods", () => {
  it("anchors on the start day and clamps short months", () => {
    expect(monthsOn({ y: 2026, mo: 0, d: 31 }, 1)).toEqual({ y: 2026, mo: 1, d: 28 });
    expect(monthsOn({ y: 2026, mo: 0, d: 31 }, 3)).toEqual({ y: 2026, mo: 3, d: 30 });
    expect(monthsOn({ y: 2026, mo: 10, d: 15 }, 2)).toEqual({ y: 2027, mo: 0, d: 15 });
  });

  it("describes a period as start, inclusive end and the month label", () => {
    expect(periodAt("2026-10-01", 0)).toEqual({ start: "2026-10-01", end: "2026-10-31", label: "October 2026" });
    expect(periodAt("2026-10-01", 1)).toEqual({ start: "2026-11-01", end: "2026-11-30", label: "November 2026" });
    expect(periodAt("2026-01-31", 1)).toEqual({ start: "2026-02-28", end: "2026-03-30", label: "February 2026" });
    expect(periodAt("not-a-date", 0)).toBeNull();
    expect(parseIsoDate("2026-02-30")).toBeNull();
  });

  it("lists only the periods that have started and are not yet raised", () => {
    expect(monthlyPeriodsDue({ invoicedFrom: "2026-10-01", today: "2026-10-10", existing: [] })).toEqual([
      { start: "2026-10-01", end: "2026-10-31", label: "October 2026" },
    ]);
    expect(monthlyPeriodsDue({ invoicedFrom: "2026-10-01", today: "2026-10-10", existing: ["2026-10-01"] })).toEqual([]);
    expect(monthlyPeriodsDue({ invoicedFrom: "2026-11-01", today: "2026-10-10", existing: [] })).toEqual([]);
    const two = monthlyPeriodsDue({ invoicedFrom: "2026-09-01", today: "2026-10-10", existing: [] });
    expect(two.map((p) => p.start)).toEqual(["2026-09-01", "2026-10-01"]);
  });

  it("caps a long backlog so one run cannot raise years of invoices", () => {
    const many = monthlyPeriodsDue({ invoicedFrom: "2020-01-01", today: "2026-10-10", existing: [] });
    expect(many).toHaveLength(MAX_PERIODS_PER_RUN);
    expect(many[0].start).toBe("2020-01-01");
  });

  it("knows the next period start and names the line", () => {
    expect(nextPeriodStart("2026-10-01", "2026-10-10")).toBe("2026-11-01");
    expect(nextPeriodStart("2026-10-15", "2026-10-15")).toBe("2026-11-15");
    expect(periodLabel("2026-03-05")).toBe("March 2026");
    expect(carePlanPeriodLine("Max", periodAt("2026-10-01", 0)!)).toBe("Max care plan — October 2026");
    expect(suggestedInvoicedFrom(at("2026-10-10T12:00:00Z"))).toBe("2026-10-01");
  });
});

describe("due dates and overdue", () => {
  it("is due at the end of the day the terms land on", () => {
    expect(invoiceDueAt("2026-10-01", 14)).toBe("2026-10-15T23:59:59.000Z");
    expect(invoiceDueAt("2026-10-01", 0)).toBe("2026-10-01T23:59:59.000Z");
    expect(invoiceDueAt("2026-10-01", 500)).toBe("2026-12-30T23:59:59.000Z");
  });

  it("counts whole days past due and never goes negative", () => {
    expect(daysOverdue("2026-10-15T23:59:59.000Z", at("2026-10-15T10:00:00Z"))).toBe(0);
    expect(daysOverdue("2026-10-15T23:59:59.000Z", at("2026-10-16T23:59:58Z"))).toBe(0);
    expect(daysOverdue("2026-10-15T23:59:59.000Z", at("2026-10-19T00:00:00Z"))).toBe(3);
    expect(daysOverdue(null, at("2026-10-19T00:00:00Z"))).toBe(0);
  });
});

describe("chasing", () => {
  const due = "2026-10-15T23:59:59.000Z";
  const day = (n: number) => at(new Date(Date.parse(due) + n * 86_400_000 + 1000).toISOString());

  it("waits until the first threshold, then reminds in order", () => {
    expect(decideInvoiceChase({ dueAt: due, now: day(1), remindersSent: 0 })).toEqual({ action: "wait" });
    expect(decideInvoiceChase({ dueAt: due, now: day(INVOICE_CHASE_DAYS[0]), remindersSent: 0 })).toMatchObject({
      action: "remind",
      nth: 1,
      tone: "nudge",
    });
    // Already nudged: wait for the second threshold.
    expect(decideInvoiceChase({ dueAt: due, now: day(5), remindersSent: 1 })).toEqual({ action: "wait" });
    expect(decideInvoiceChase({ dueAt: due, now: day(INVOICE_CHASE_DAYS[1]), remindersSent: 1 })).toMatchObject({
      action: "remind",
      nth: 2,
      tone: "check",
    });
    expect(decideInvoiceChase({ dueAt: due, now: day(INVOICE_CHASE_DAYS[2]), remindersSent: 2 })).toMatchObject({
      action: "remind",
      nth: 3,
      tone: "final",
    });
  });

  it("escalates once the reminders are spent and never reminds before due", () => {
    expect(decideInvoiceChase({ dueAt: due, now: day(40), remindersSent: MAX_INVOICE_REMINDERS })).toMatchObject({
      action: "escalate",
    });
    expect(decideInvoiceChase({ dueAt: due, now: at("2026-10-01T00:00:00Z"), remindersSent: 0 })).toEqual({ action: "wait" });
    expect(decideInvoiceChase({ dueAt: null, now: day(40), remindersSent: 0 })).toEqual({ action: "wait" });
  });
});

describe("plan status from invoices", () => {
  const due = "2026-10-15T23:59:59.000Z";
  const day = (n: number) => at(new Date(Date.parse(due) + n * 86_400_000 + 1000).toISOString());

  it("goes past due at the threshold and recovers when nothing is overdue", () => {
    expect(subscriptionStatusFromInvoices({ status: "active", openDueAts: [due], now: day(PAST_DUE_AFTER_DAYS - 1) })).toBeNull();
    expect(subscriptionStatusFromInvoices({ status: "active", openDueAts: [due], now: day(PAST_DUE_AFTER_DAYS) })).toBe("past_due");
    expect(subscriptionStatusFromInvoices({ status: "past_due", openDueAts: [due], now: day(PAST_DUE_AFTER_DAYS) })).toBeNull();
    expect(subscriptionStatusFromInvoices({ status: "past_due", openDueAts: [], now: day(40) })).toBe("active");
    expect(subscriptionStatusFromInvoices({ status: "past_due", openDueAts: [due], now: day(2) })).toBe("active");
  });

  it("leaves cancelled and pending plans alone", () => {
    expect(subscriptionStatusFromInvoices({ status: "incomplete", openDueAts: [due], now: day(40) })).toBeNull();
    expect(subscriptionStatusFromInvoices({ status: "canceled", openDueAts: [due], now: day(40) })).toBeNull();
  });
});

describe("bank match: client name without its suffix", () => {
  const inv = {
    id: "11111111-1111-4111-8111-111111111111",
    tenantId: "t",
    tenantName: "Suffolk Tennis LTA",
    references: ["11111111"],
    amountMinor: 16000,
    currency: "GBP",
    status: "open" as const,
    dueAt: null,
    obligationId: null,
  };
  const tx = (counterparty: string, reference = "") => ({
    id: "tx",
    amountMinor: 16000,
    feeMinor: 0,
    currency: "GBP",
    state: "completed",
    type: "transfer",
    reference,
    counterpartyName: counterparty,
    completedAt: null,
    createdAt: "2026-10-01T00:00:00Z",
  });

  it("matches the trading name as the bank shows it", () => {
    expect(referenceHit(tx("SUFFOLK TENNIS LTA"), inv)).toBe("Suffolk Tennis LTA");
    expect(referenceHit(tx("SUFFOLK TENNIS"), inv)).toBe("Suffolk Tennis");
    expect(referenceHit(tx("Suffolk Tennis Partnership", "care plan"), inv)).toBe("Suffolk Tennis");
  });

  it("does not match on a short or different name", () => {
    expect(referenceHit(tx("SUFFOLK"), inv)).toBeNull();
    expect(referenceHit(tx("NORFOLK TENNIS"), inv)).toBeNull();
  });
});
