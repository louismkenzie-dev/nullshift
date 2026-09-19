/**
 * When to chase an unfinished Direct Debit — the pure rules.
 *
 * A client who accepts the terms and then loses the GoCardless page is, from
 * our side, indistinguishable from one who changed their mind. They have
 * committed to a plan and nothing is collecting. Until now nobody found out
 * until somebody happened to look at the board.
 *
 * The judgement calls live here, apart from the sending, so they can be tested
 * without a database or an inbox:
 *
 *  · Leave the first day alone. Most people finish within the hour, and a
 *    reminder an hour after someone signed reads as nagging, not helping.
 *  · Chase daily, then stop. An email that keeps arriving forever gets a
 *    filter rule, and then we cannot reach them about anything.
 *  · When chasing stops, that is not the end of it — it becomes ours to pick
 *    up by hand, so the last step hands it to staff rather than going quiet.
 */

export const REMINDER_START_HOURS = 20;
/** After this many client reminders, stop emailing them and tell staff. */
export const MAX_CLIENT_REMINDERS = 5;

export type PendingMandate = {
  tenantId: string;
  /** When the client accepted the terms — the clock starts here, not at creation. */
  termsAcceptedAt: string | null;
  /** How many reminders this client has already had for this attempt. */
  remindersSent: number;
};

export type ReminderDecision =
  | { action: "wait"; reason: "too_soon" | "no_terms" }
  | { action: "remind"; nth: number }
  | { action: "escalate" };

export function decideReminder(
  m: PendingMandate,
  now: Date = new Date()
): ReminderDecision {
  // No acceptance means they never got as far as agreeing — there is nothing
  // to hold them to, and chasing would be chasing a decision they never made.
  if (!m.termsAcceptedAt) return { action: "wait", reason: "no_terms" };

  const accepted = new Date(m.termsAcceptedAt).getTime();
  if (!Number.isFinite(accepted)) return { action: "wait", reason: "no_terms" };

  const hours = (now.getTime() - accepted) / 3_600_000;
  if (hours < REMINDER_START_HOURS) return { action: "wait", reason: "too_soon" };

  if (m.remindersSent >= MAX_CLIENT_REMINDERS) return { action: "escalate" };
  return { action: "remind", nth: m.remindersSent + 1 };
}

/**
 * The copy changes as the days pass. The first is a nudge; the last says
 * plainly that we will pick up the phone, because by then something is
 * actually wrong and pretending otherwise wastes everyone's time.
 *
 * The words themselves live with the other client emails, in
 * lib/clientEmails.ts — this only decides which of the three it is, so the
 * subject line cannot drift away from the body it belongs to.
 */
export function reminderTone(nth: number): "nudge" | "check" | "final" {
  if (nth <= 1) return "nudge";
  if (nth >= MAX_CLIENT_REMINDERS) return "final";
  return "check";
}
