/**
 * Stage-gate predicates (audit Phase 1.3) — the rules that decide whether a
 * project may enter a gated stage. Pure and unit-tested; the setStage server
 * action supplies the facts. The go-live DPA gate lives in the database
 * (trigger 0005, verified live in the 8-stage walkthrough) — this module
 * covers the app-level gates.
 */

/**
 * Committed build work needs money to have moved: any paid invoice on the
 * project (the acceptance invoice qualifies) — or a staff override carrying a
 * recorded reason, which the caller audit-logs. Never silently.
 */
export function canEnterBuild(opts: {
  hasPaidInvoice: boolean;
  overrideReason: string;
}): boolean {
  return opts.hasPaidInvoice || opts.overrideReason.trim().length > 0;
}
