import type { ControlFrequency } from "./types";

/**
 * Control scheduling — pure date arithmetic, no imports from server code.
 *
 * The scheduler's contract: every schedulable control carries `next_due_at`;
 * the sweep materialises a `soc2_control_runs` row (an evidence request) when
 * the due date enters the lead window, keyed by a deterministic fire key so
 * re-runs can never double-create it — the same idempotency shape as the AI
 * Workspace routine ticks.
 */

/** Days between performances. Null = not schedulable (evidenced per event). */
export const FREQUENCY_DAYS: Record<ControlFrequency, number | null> = {
  continuous: null,
  per_change: null,
  event: null,
  weekly: 7,
  monthly: 31,
  quarterly: 92,
  semiannual: 183,
  annual: 366,
};

/** How far ahead of the due date an evidence request appears. */
export const SCHEDULE_LEAD_DAYS = 14;

export const isSchedulable = (frequency: ControlFrequency): boolean =>
  FREQUENCY_DAYS[frequency] !== null;

const DAY_MS = 24 * 60 * 60 * 1000;

export const toDateOnly = (d: Date): string => d.toISOString().slice(0, 10);

export const addDays = (dateOnly: string, days: number): string =>
  toDateOnly(new Date(new Date(dateOnly + "T00:00:00Z").getTime() + days * DAY_MS));

export const daysBetween = (fromDateOnly: string, toDateOnlyStr: string): number =>
  Math.round(
    (new Date(toDateOnlyStr + "T00:00:00Z").getTime() -
      new Date(fromDateOnly + "T00:00:00Z").getTime()) /
      DAY_MS
  );

/**
 * The run identifier for a control due on a given date. Deterministic on
 * (control, due date): a sweep re-run, a retry, or two overlapping crons all
 * derive the same key and the unique index makes the second insert a no-op.
 */
export const runFireKey = (controlKey: string, dueAt: string): string =>
  `${controlKey}:${dueAt}`;

/** After a run completes, when is the control next due? */
export const nextDueAfter = (
  frequency: ControlFrequency,
  performedDate: string
): string | null => {
  const days = FREQUENCY_DAYS[frequency];
  return days === null ? null : addDays(performedDate, days);
};

/** Is this due date inside the lead window (i.e. an evidence request is due)? */
export const withinLeadWindow = (dueAt: string, today: string): boolean =>
  daysBetween(today, dueAt) <= SCHEDULE_LEAD_DAYS;

export const isOverdue = (dueAt: string, today: string): boolean =>
  daysBetween(today, dueAt) < 0;

/* ── review-period filters (used by the audit pack; pure for tests) ── */

export type PeriodWindow = { starts_on: string; ends_on: string };

/** A dated record (date or timestamp) falls inside the period. */
export const withinPeriod = (dateish: string | null | undefined, p: PeriodWindow): boolean => {
  if (!dateish) return false;
  const d = dateish.slice(0, 10);
  return d >= p.starts_on && d <= p.ends_on;
};

/**
 * A lifecycle record (opened at / closed at) overlaps the period — including
 * records still open at period end.
 */
export const overlapsPeriod = (
  openedAt: string | null | undefined,
  closedAt: string | null | undefined,
  p: PeriodWindow
): boolean => {
  const start = (openedAt ?? "").slice(0, 10);
  const end = (closedAt ?? "9999-12-31").slice(0, 10);
  return start <= p.ends_on && end >= p.starts_on;
};
