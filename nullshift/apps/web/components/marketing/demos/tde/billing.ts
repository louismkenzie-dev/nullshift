/* Ported verbatim from The Dance Exclusive — src/lib/billing.ts (main @ 99614da,
   read 2026-09-11). Do not edit here; re-port when the client ships a change. */

// Billing calendar for monthly memberships (Amie's model, Aug 2026):
//
//  - First payment is taken AT SIGNUP (the "first month" line on the first
//    invoice) — EXCEPT during August, when nothing is charged and the
//    subscription simply starts billing on 5 September.
//  - Recurring payments always land on the 5TH of the month, anchored via a
//    Stripe trial that ends on the 5th of the month AFTER the signup month.
//  - Families pay 11 consecutive months a year; their 12th month is free and
//    is skipped every year by the maintenance job (pause_collection "void"
//    across that month voids the 5th's invoice). For September starters —
//    including everyone who signs up during August — the free month is
//    August. For a February joiner it is January, exactly as specified.
//
// Mirror of supabase/functions/_shared/billing.ts — KEEP THE TWO IN SYNC.

const LONDON_TZ = "Europe/London";

/** Calendar year/month/day as the studio experiences it (Europe/London). */
export function londonYMD(d: Date = new Date()): { y: number; m: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: LONDON_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d); // "YYYY-MM-DD"
  const [y, m, day] = parts.split("-").map(Number);
  return { y, m, day };
}

/** True during the studio's August (no classes, no membership charges). */
export const isAugustLondon = (d: Date = new Date()): boolean => londonYMD(d).m === 8;

/**
 * The Stripe trial end that anchors recurring billing: the 5th of the month
 * AFTER the signup month, at 07:00 UTC (which is the morning of the 5th in
 * London in both GMT and BST).
 */
export function firstBillingAnchor(d: Date = new Date()): Date {
  const { y, m } = londonYMD(d);
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  return new Date(Date.UTC(nextY, nextM - 1, 5, 7, 0, 0));
}

/**
 * The subscription's annual free month (1–12): the month before the first
 * PAID month. August signups first pay in September, so their free month is
 * August; everyone else first pays in their signup month, so their free
 * month is the month before it (a February joiner skips January).
 */
export function freeMonthFor(d: Date = new Date()): number {
  const { m } = londonYMD(d);
  if (m === 8) return 8;
  return m === 1 ? 12 : m - 1;
}

/** Whether the first month is charged at signup (false only during August). */
export const chargesFirstMonthAtSignup = (d: Date = new Date()): boolean =>
  !isAugustLondon(d);

/** The 1st of the month after the given free month, next occurrence from `from` (UTC). */
export function resumeAfterFreeMonth(freeMonth: number, from: Date = new Date()): Date {
  const { y, m } = londonYMD(from);
  const resumeM = freeMonth === 12 ? 1 : freeMonth + 1;
  // Next occurrence: this year if the resume month is still ahead (or is the
  // current month — "resume now"), otherwise next year.
  const resumeY = resumeM >= m ? y : y + 1;
  return new Date(Date.UTC(resumeY, resumeM - 1, 1, 0, 0, 0));
}
