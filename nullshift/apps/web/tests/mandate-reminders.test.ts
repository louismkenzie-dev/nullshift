import { describe, expect, it } from "vitest";
import { mandateReminderEmail } from "@/lib/clientEmails";
import {
  decideReminder,
  reminderTone,
  MAX_CLIENT_REMINDERS,
  REMINDER_START_HOURS,
  type PendingMandate,
} from "@/lib/billing/mandateReminders";

const NOW = new Date("2026-09-20T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

const mandate = (over: Partial<PendingMandate> = {}): PendingMandate => ({
  tenantId: "t1",
  termsAcceptedAt: hoursAgo(48),
  remindersSent: 0,
  ...over,
});

describe("decideReminder", () => {
  it("leaves the first hours alone — most people finish on their own", () => {
    expect(decideReminder(mandate({ termsAcceptedAt: hoursAgo(1) }), NOW)).toEqual({
      action: "wait",
      reason: "too_soon",
    });
    expect(
      decideReminder(
        mandate({ termsAcceptedAt: hoursAgo(REMINDER_START_HOURS - 0.5) }),
        NOW
      )
    ).toEqual({ action: "wait", reason: "too_soon" });
  });

  it("starts chasing once the window has passed", () => {
    expect(
      decideReminder(mandate({ termsAcceptedAt: hoursAgo(REMINDER_START_HOURS + 1) }), NOW)
    ).toEqual({ action: "remind", nth: 1 });
  });

  it("never chases someone who did not accept the terms", () => {
    // No acceptance means no commitment to chase — the row is just an
    // abandoned visit to the chooser.
    expect(decideReminder(mandate({ termsAcceptedAt: null }), NOW)).toEqual({
      action: "wait",
      reason: "no_terms",
    });
    expect(decideReminder(mandate({ termsAcceptedAt: "not a date" }), NOW)).toEqual({
      action: "wait",
      reason: "no_terms",
    });
  });

  it("counts each reminder so the sequence advances", () => {
    expect(decideReminder(mandate({ remindersSent: 2 }), NOW)).toEqual({
      action: "remind",
      nth: 3,
    });
  });

  it("stops emailing the client and hands it to staff", () => {
    expect(
      decideReminder(mandate({ remindersSent: MAX_CLIENT_REMINDERS }), NOW)
    ).toEqual({ action: "escalate" });
    // And stays escalated rather than silently resuming.
    expect(
      decideReminder(mandate({ remindersSent: MAX_CLIENT_REMINDERS + 9 }), NOW)
    ).toEqual({ action: "escalate" });
  });

  it("the last client email is the final one, not one past it", () => {
    const last = decideReminder(
      mandate({ remindersSent: MAX_CLIENT_REMINDERS - 1 }),
      NOW
    );
    expect(last).toEqual({ action: "remind", nth: MAX_CLIENT_REMINDERS });
    expect(reminderTone(MAX_CLIENT_REMINDERS)).toBe("final");
  });
});

describe("tone and copy", () => {
  it("softens at the start and is plain at the end", () => {
    expect(reminderTone(1)).toBe("nudge");
    expect(reminderTone(3)).toBe("check");
    expect(reminderTone(MAX_CLIENT_REMINDERS)).toBe("final");
  });

  it("names the plan in every subject", () => {
    for (const tone of ["nudge", "check", "final"] as const) {
      const { subject } = mandateReminderEmail({
        name: "Laura West",
        planLabel: "Max",
        mrr: 240,
        url: "https://nullshift.co.uk/portal/plan",
        tone,
      });
      expect(subject).toContain("Max");
    }
  });

  it("does not shout on the first nudge", () => {
    expect(
      mandateReminderEmail({
        name: "Laura West",
        planLabel: "Max",
        mrr: 240,
        url: "https://nullshift.co.uk/portal/plan",
        tone: "nudge",
      }).subject
    ).toBe("One step left on your Max plan");
  });

  it("sends them to the portal, never to a GoCardless link", () => {
    // A GoCardless authorisation link dies the moment a newer one is minted,
    // so a run of daily emails carrying them would be a run of dead links.
    const { html, text } = mandateReminderEmail({
      name: "Laura West",
      planLabel: "Max",
      mrr: 240,
      url: "https://nullshift.co.uk/portal/plan",
      tone: "check",
    });
    expect(html).toContain("https://nullshift.co.uk/portal/plan");
    expect(html).not.toContain("gocardless.com");
    expect(text).toContain("https://nullshift.co.uk/portal/plan");
  });

  it("greets by first name and states the price", () => {
    const { html, text } = mandateReminderEmail({
      name: "Laura West",
      planLabel: "Max",
      mrr: 240,
      url: "https://nullshift.co.uk/portal/plan",
      tone: "nudge",
    });
    expect(html).toContain("Hi Laura,");
    expect(html).toContain("£240/month");
    expect(text).toContain("Hi Laura,");
  });

  it("says a person will take over in the final one", () => {
    const { html } = mandateReminderEmail({
      name: "Laura West",
      planLabel: "Max",
      mrr: 240,
      url: "https://nullshift.co.uk/portal/plan",
      tone: "final",
    });
    expect(html).toContain("last automatic reminder");
  });
});
