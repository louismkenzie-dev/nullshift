/**
 * Invoiced care plans — the pure rules behind migration 0072.
 *
 * A client who will not set up a Direct Debit is billed by a monthly invoice
 * instead: one invoice per period, raised in advance on the period's first
 * day, due after the agreed terms, chased when overdue, and the plan flagged
 * past due when a chase has not worked. Everything here is arithmetic over
 * ISO dates in UTC; the run (invoicedPlansRun.ts) does the I/O.
 *
 *   - `monthlyPeriodsDue` — which periods need an invoice as of today, given
 *     the ones already raised. Periods anchor on `invoicedFrom`'s day of the
 *     month (clamped: a plan that starts on the 31st bills on the 30th in
 *     April and the 28th in February) and are capped per run so a plan
 *     switched on with a start date long in the past cannot raise a year of
 *     invoices in one go without someone noticing.
 *   - `invoiceDueAt` — the period start plus the terms, end of day.
 *   - `decideInvoiceChase` — three reminders at 3, 10 and 17 days overdue,
 *     then it becomes staff's to pick up. Counted from the audit trail, like
 *     the mandate reminders, so the count can never disagree with what was
 *     actually sent.
 *   - `subscriptionStatusFromInvoices` — past due once any invoice is 14 days
 *     overdue; back to active once nothing is.
 */

export const INVOICE_TERMS_DEFAULT_DAYS = 14;
export const PAST_DUE_AFTER_DAYS = 14;
/** Days after the due date at which the nth reminder goes out. */
export const INVOICE_CHASE_DAYS = [3, 10, 17] as const;
export const MAX_INVOICE_REMINDERS = INVOICE_CHASE_DAYS.length;
export const MAX_PERIODS_PER_RUN = 12;

const DAY_MS = 86_400_000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export type Period = {
  /** ISO date, inclusive. */
  start: string;
  /** ISO date, inclusive. */
  end: string;
  /** "October 2026" — the month the period starts in. */
  label: string;
};

type Ymd = { y: number; mo: number; d: number };

export function parseIsoDate(s: string | null | undefined): Ymd | null {
  const m = ISO_DATE.exec(s ?? "");
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  if (mo < 0 || mo > 11 || d < 1 || d > daysInMonth(y, mo)) return null;
  return { y, mo, d };
}

export const daysInMonth = (y: number, mo: number) => new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();

const toIso = ({ y, mo, d }: Ymd) => new Date(Date.UTC(y, mo, d)).toISOString().slice(0, 10);

/** Today as an ISO date in UTC. */
export const isoDate = (d: Date = new Date()) => d.toISOString().slice(0, 10);

/** The same day of the month `n` months on, clamped to the month's length. */
export function monthsOn(anchor: Ymd, n: number): Ymd {
  const total = anchor.mo + n;
  const y = anchor.y + Math.floor(total / 12);
  const mo = ((total % 12) + 12) % 12;
  return { y, mo, d: Math.min(anchor.d, daysInMonth(y, mo)) };
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const periodLabel = (start: string): string => {
  const p = parseIsoDate(start);
  return p ? `${MONTHS[p.mo]} ${p.y}` : start;
};

/** The nth period (0-based) of a plan invoiced from `invoicedFrom`. */
export function periodAt(invoicedFrom: string, n: number): Period | null {
  const anchor = parseIsoDate(invoicedFrom);
  if (!anchor || n < 0) return null;
  const start = monthsOn(anchor, n);
  const next = monthsOn(anchor, n + 1);
  const endMs = Date.UTC(next.y, next.mo, next.d) - DAY_MS;
  const startIso = toIso(start);
  return { start: startIso, end: new Date(endMs).toISOString().slice(0, 10), label: periodLabel(startIso) };
}

/**
 * Periods whose start has arrived and which have no invoice yet. `existing`
 * lists the period starts already raised (void rows excluded by the caller).
 */
export function monthlyPeriodsDue(opts: {
  invoicedFrom: string;
  today: string;
  existing: readonly string[];
}): Period[] {
  const have = new Set(opts.existing);
  const due: Period[] = [];
  for (let n = 0; due.length < MAX_PERIODS_PER_RUN; n++) {
    const p = periodAt(opts.invoicedFrom, n);
    if (!p || p.start > opts.today) break;
    if (!have.has(p.start)) due.push(p);
    // A plan a few years old would otherwise walk every month since; the
    // cap above bounds the work and the loop bound keeps it finite.
    if (n > 240) break;
  }
  return due;
}

/** The next period start after today, for "next invoice" lines. */
export function nextPeriodStart(invoicedFrom: string, today: string): string | null {
  for (let n = 0; n <= 241; n++) {
    const p = periodAt(invoicedFrom, n);
    if (!p) return null;
    if (p.start > today) return p.start;
  }
  return null;
}

/** "Max care plan — October 2026": the invoice line the client and the books see. */
export const carePlanPeriodLine = (planLabel: string, period: Period) =>
  `${planLabel} care plan — ${period.label}`;

/** Period start + terms, at the end of that day (UTC), as an ISO timestamp. */
export function invoiceDueAt(periodStart: string, termsDays: number): string {
  const p = parseIsoDate(periodStart);
  if (!p) throw new Error(`invoiceDueAt: bad period start ${periodStart}`);
  const terms = Number.isFinite(termsDays) ? Math.max(0, Math.min(90, Math.round(termsDays))) : INVOICE_TERMS_DEFAULT_DAYS;
  return new Date(Date.UTC(p.y, p.mo, p.d + terms, 23, 59, 59)).toISOString();
}

/** Whole days past the due date; 0 when not yet due. */
export function daysOverdue(dueAt: string | null | undefined, now: Date): number {
  if (!dueAt) return 0;
  const due = new Date(dueAt).getTime();
  if (!Number.isFinite(due)) return 0;
  return Math.max(0, Math.floor((now.getTime() - due) / DAY_MS));
}

export type ChaseTone = "nudge" | "check" | "final";

export type ChaseDecision =
  | { action: "wait" }
  | { action: "remind"; nth: number; tone: ChaseTone; daysOverdue: number }
  | { action: "escalate"; daysOverdue: number };

export function decideInvoiceChase(input: {
  dueAt: string | null;
  now: Date;
  remindersSent: number;
}): ChaseDecision {
  const overdue = daysOverdue(input.dueAt, input.now);
  if (overdue <= 0) return { action: "wait" };
  const sent = Math.max(0, Math.floor(input.remindersSent));
  if (sent >= MAX_INVOICE_REMINDERS) return { action: "escalate", daysOverdue: overdue };
  const threshold = INVOICE_CHASE_DAYS[sent];
  if (overdue < threshold) return { action: "wait" };
  const nth = sent + 1;
  const tone: ChaseTone = nth === 1 ? "nudge" : nth === MAX_INVOICE_REMINDERS ? "final" : "check";
  return { action: "remind", nth, tone, daysOverdue: overdue };
}

/**
 * What the plan's status should be given its open invoices. Returns null when
 * nothing should change. Only ever moves between active and past_due; a
 * cancelled or incomplete plan is left alone.
 */
export function subscriptionStatusFromInvoices(input: {
  status: string;
  openDueAts: readonly (string | null)[];
  now: Date;
}): "active" | "past_due" | null {
  if (input.status !== "active" && input.status !== "past_due") return null;
  const worst = input.openDueAts.reduce((m, d) => Math.max(m, daysOverdue(d, input.now)), 0);
  if (worst >= PAST_DUE_AFTER_DAYS) return input.status === "past_due" ? null : "past_due";
  return input.status === "past_due" ? "active" : null;
}

/** The first of the current month — the default start when switching a plan on. */
export function suggestedInvoicedFrom(now: Date = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

export const gbp = (n: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
