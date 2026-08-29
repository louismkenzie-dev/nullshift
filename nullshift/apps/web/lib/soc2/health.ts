import type {
  ControlHealth,
  ControlRow,
  ControlRunRow,
  EvidenceRow,
  ExceptionRow,
  TscCategory,
} from "./types";
import { OPEN_EXCEPTION_STATUSES } from "./types";
import { FREQUENCY_DAYS, isOverdue, isSchedulable, withinLeadWindow } from "./schedule";

/**
 * Control health — pure calculation over the control, its runs, evidence and
 * open exceptions. Deliberately explainable: `explain` names the basis so the
 * UI can show WHY a control reads the way it does, and there is no rollup
 * percentage anywhere — readiness is a set of statuses with reasons, not a
 * score, because a score is one step from "97% compliant" and that claim
 * belongs to an auditor, not a progress bar.
 *
 * Precedence (first match wins):
 *   1. not_applicable  — control marked N/A (reason + approver enforced by DB)
 *   2. exception_open  — any open exception on the control
 *   3. evidence_missing— overdue run, or a completed run with no evidence
 *   4. evidence_due    — a run is due inside the lead window
 *   5. operating       — performed within its frequency window, evidenced
 *   6. untested        — no completed performance yet (and nothing overdue)
 */

export type ControlHealthResult = {
  health: ControlHealth;
  explain: string;
};

export function controlHealth(input: {
  control: ControlRow;
  runs: ControlRunRow[]; // this control's runs
  evidence: EvidenceRow[]; // this control's evidence items
  exceptions: ExceptionRow[]; // this control's exceptions
  today: string; // date-only
}): ControlHealthResult {
  const { control, runs, evidence, exceptions, today } = input;

  if (control.applicability === "not_applicable") {
    return { health: "not_applicable", explain: "Marked not applicable, with approved reason." };
  }

  const open = exceptions.filter((e) => OPEN_EXCEPTION_STATUSES.includes(e.status));
  if (open.length > 0) {
    return {
      health: "exception_open",
      explain: `${open.length} open exception${open.length === 1 ? "" : "s"} (${open
        .map((e) => e.ref)
        .join(", ")}).`,
    };
  }

  const completed = runs
    .filter((r) => r.status === "complete")
    .sort((a, b) => (a.performed_at ?? "").localeCompare(b.performed_at ?? ""));
  const latestComplete = completed[completed.length - 1];

  // An overdue open run means the evidence the schedule asked for never came.
  const overdueRun = runs.find(
    (r) => (r.status === "scheduled" || r.status === "in_progress") && isOverdue(r.due_at, today)
  );
  if (overdueRun) {
    return {
      health: "evidence_missing",
      explain: `Run due ${overdueRun.due_at} was never completed.`,
    };
  }

  // A completed performance with nothing attached is a claim, not evidence.
  if (latestComplete) {
    const runEvidence = evidence.filter((e) => e.control_run_id === latestComplete.id);
    if (runEvidence.length === 0) {
      return {
        health: "evidence_missing",
        explain: `Latest run (due ${latestComplete.due_at}) completed with no evidence attached.`,
      };
    }
  }

  const dueSoonRun = runs.find(
    (r) =>
      (r.status === "scheduled" || r.status === "in_progress") && withinLeadWindow(r.due_at, today)
  );
  if (dueSoonRun) {
    return { health: "evidence_due", explain: `Evidence due by ${dueSoonRun.due_at}.` };
  }

  if (isSchedulable(control.frequency)) {
    if (!latestComplete) {
      // Never performed. If its first due date has already passed, that is
      // missing evidence, not a blank slate.
      if (control.next_due_at && isOverdue(control.next_due_at, today)) {
        return {
          health: "evidence_missing",
          explain: `First performance was due ${control.next_due_at} and has not happened.`,
        };
      }
      return { health: "untested", explain: "No completed performance yet." };
    }
    // Performed and evidenced within the window; the schedule will raise the
    // next request when it enters the lead window.
    const windowDays = FREQUENCY_DAYS[control.frequency];
    return {
      health: "operating",
      explain: `Last performed ${latestComplete.performed_at?.slice(0, 10) ?? latestComplete.due_at}; next due ${
        control.next_due_at ?? `within ${windowDays} days`
      }.`,
    };
  }

  // Event-driven controls (continuous / per_change / event): assessed by
  // whether they have EVER been evidenced and whether exceptions are open
  // (already checked above). Recent evidence keeps them "operating".
  const anyEvidence = evidence.length > 0;
  if (!anyEvidence) {
    return { health: "untested", explain: "Event-driven control with no evidence collected yet." };
  }
  const latest = [...evidence].sort((a, b) => a.capture_date.localeCompare(b.capture_date)).pop()!;
  return {
    health: "operating",
    explain: `Event-driven; latest evidence captured ${latest.capture_date}; no open exceptions.`,
  };
}

/* ── rollups ───────────────────────────────────────────────────── */

export type CategoryRollup = {
  category: TscCategory;
  counts: Record<ControlHealth, number>;
  total: number;
  /** Applicable controls (total minus not_applicable). */
  applicable: number;
};

export function rollupByCategory(
  rows: { control: ControlRow; health: ControlHealth }[]
): CategoryRollup[] {
  const categories: TscCategory[] = [
    "security",
    "availability",
    "processing_integrity",
    "confidentiality",
    "privacy",
  ];
  return categories
    .map((category) => {
      const inCat = rows.filter((r) => r.control.tsc_category === category);
      const counts: Record<ControlHealth, number> = {
        operating: 0,
        evidence_due: 0,
        evidence_missing: 0,
        exception_open: 0,
        not_applicable: 0,
        untested: 0,
      };
      for (const r of inCat) counts[r.health] += 1;
      return {
        category,
        counts,
        total: inCat.length,
        applicable: inCat.length - counts.not_applicable,
      };
    })
    .filter((r) => r.total > 0);
}
