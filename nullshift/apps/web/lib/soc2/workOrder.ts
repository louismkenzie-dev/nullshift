/**
 * Exception → Claude Code work order (pure, testable).
 *
 * Fix batches already dispatch to Claude Code with a compiled, context-
 * complete prompt; SOC 2 exceptions deserve the same affordance. This
 * composes everything a fresh Claude Code session needs to work a remediation
 * — the exception, its control, the recent trail, and where the relevant code
 * and docs live — so "open a session about this" is one copy-paste (or one
 * dispatch, where a transport is configured).
 *
 * Two shapes share the same facts:
 * - composeExceptionWorkOrder: a complete standalone session prompt.
 * - composeExceptionBatchSection: a compact section for embedding inside a
 *   compiled batch work order (the batch supplies repo pointers and ground
 *   rules once, so the section carries only this exception's substance).
 *
 * The loop closes itself: the session's commits carry a Claude-Session
 * trailer, the deploy webhook mirrors the deployment into the change
 * register with that trailer attached, and the human then resolves the
 * exception pointing at it. Intent → diff → deployment → resolution, all
 * linked.
 */

export type WorkOrderExceptionInput = {
  ref: string;
  title: string;
  severity: string;
  status: string;
  detail: string | null;
  ruleKey: string | null;
  triggerRef: string | null;
  recommendedAction: string | null;
  severityRationale: string | null;
  remediationPlan: string | null;
  affected: Record<string, string[]>;
  control: {
    key: string;
    name: string;
    objective: string;
    testProcedure: string | null;
    evidenceRequirements: string | null;
  } | null;
  /** Recent trail entries, oldest first: "date · type · summary". */
  trail: string[];
};

const affectedBlock = (e: WorkOrderExceptionInput): string =>
  Object.entries(e.affected ?? {})
    .filter(([, v]) => (v ?? []).length > 0)
    .map(([k, v]) => `  - ${k}: ${v.join(", ")}`)
    .join("\n");

const substanceLines = (e: WorkOrderExceptionInput): (string | null)[] => {
  const affected = affectedBlock(e);
  return [
    e.detail ? `- Detail: ${e.detail}` : null,
    e.ruleKey ? `- Raised by rule: ${e.ruleKey}` : null,
    e.triggerRef ? `- Trigger: ${e.triggerRef}` : null,
    e.severityRationale ? `- Severity rationale: ${e.severityRationale}` : null,
    e.recommendedAction ? `- Recommended action: ${e.recommendedAction}` : null,
    e.remediationPlan ? `- Agreed remediation plan: ${e.remediationPlan}` : null,
    affected ? `- Affected records (ids):\n${affected}` : null,
  ];
};

const controlLines = (e: WorkOrderExceptionInput): string =>
  e.control
    ? [
        `- ${e.control.key} — ${e.control.name}`,
        `- Objective: ${e.control.objective}`,
        e.control.testProcedure ? `- How it is tested: ${e.control.testProcedure}` : null,
        e.control.evidenceRequirements
          ? `- Evidence it needs: ${e.control.evidenceRequirements}`
          : null,
      ]
        .filter(Boolean)
        .join("\n")
    : `- No control linked; treat the exception text as the requirement.`;

export function composeExceptionWorkOrder(e: WorkOrderExceptionInput): string {
  return [
    `You are working in the Null Shift Ops monorepo (louismkenzie-dev/nullshift, app in nullshift/).`,
    `Your task is to remediate SOC 2 readiness exception ${e.ref} and leave the trail an auditor can follow.`,
    ``,
    `## The exception`,
    `- Ref: ${e.ref} (${e.severity}, currently "${e.status.replace(/_/g, " ")}")`,
    `- Title: ${e.title}`,
    ...substanceLines(e),
    ``,
    `## The control it protects`,
    controlLines(e),
    ``,
    `## Recent trail`,
    e.trail.length ? e.trail.map((t) => `- ${t}`).join("\n") : `- (no trail entries yet)`,
    ``,
    `## Where things live`,
    `- SOC 2 engine: nullshift/apps/web/lib/soc2/ (rules.ts raised this; health.ts, sweep.ts)`,
    `- Admin pages: nullshift/apps/web/app/admin/(dashboard)/soc2/`,
    `- Schema + DB gates: nullshift/supabase/migrations/0037_soc2_readiness.sql (+0038)`,
    `- Operating guide: nullshift/docs/SOC2-OPERATIONS.md · current-state audit: nullshift/docs/SOC2-READINESS-AUDIT-2026-08-20.md`,
    ``,
    `## Ground rules`,
    `1. Fix the root cause the exception points at — never suppress the rule or relax a database gate to make it quiet.`,
    `2. Product language is "control implemented / evidence collected / exception needs review" — never "compliant" or "certified".`,
    `3. Run the repo's checks before any push: corepack pnpm --filter @nullshift/web typecheck && lint && test.`,
    `4. Commit with the standard Claude-Session trailer; the deploy webhook mirrors your deployment into the change register with the session linked, so the remediation is traceable end to end.`,
    `5. When done, report exactly what changed and what evidence a human should attach — the exception itself is resolved and verified by people in /admin/soc2, not by you.`,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

/**
 * Compact per-exception section for embedding in a compiled batch work order.
 * The batch supplies the repo, working rules, and the SOC 2 ground rules once
 * — this carries only the exception's substance, its control, and its trail.
 */
export function composeExceptionBatchSection(e: WorkOrderExceptionInput): string {
  return [
    `- Status: currently "${e.status.replace(/_/g, " ")}" — humans resolve and verify it in /admin/soc2/exceptions after your fix ships.`,
    ...substanceLines(e),
    ``,
    `**The control it protects:**`,
    controlLines(e),
    e.trail.length
      ? `\n**Recent trail:**\n${e.trail.map((t) => `- ${t}`).join("\n")}`
      : null,
    ``,
    `**Done when:** the root cause is fixed so the rule that raised ${e.ref} has nothing left to flag — never by suppressing the rule or relaxing a gate.`,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}
