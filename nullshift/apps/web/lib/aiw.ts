/** AI Workspace — shared types + meta maps (Phase 1: visibility & records).
 *  Server-safe; no client-only imports. Data comes from the 0019 tables:
 *  agent_departments, agents, agent_versions, agent_tasks, agent_events,
 *  plus the pre-existing agent_runs (extended with agent_id/task_id). */

export type AgentRow = {
  id: string;
  key: string;
  name: string;
  role_title: string;
  purpose: string;
  department_id: string | null;
  manager_agent_id: string | null;
  owner_email: string | null;
  runtime: "internal_call" | "managed_agents" | "github_action" | "routine" | "none";
  lifecycle: AgentLifecycle;
  max_risk_tier: number;
  may_delegate: boolean;
  capabilities: string[];
  tool_grants: string[];
  data_scopes: string[];
  human_gates: string[];
  current_version: number;
  last_activity_at: string | null;
  created_at: string;
};

export type AgentLifecycle =
  | "draft"
  | "under_review"
  | "test"
  | "active"
  | "paused"
  | "needs_attention"
  | "archived";

export type DepartmentRow = {
  id: string;
  key: string;
  name: string;
  mission: string | null;
  sort: number;
};

export type AgentTaskRow = {
  id: string;
  agent_id: string | null;
  parent_task_id: string | null;
  tenant_id: string | null;
  project_id: string | null;
  objective: string;
  detail: string | null;
  status: TaskStatus;
  priority: "low" | "normal" | "high" | "urgent";
  risk_tier: number;
  execution_mode: "draft_only" | "approve_before_action" | "approved_low_risk";
  source: "manual" | "routine" | "event" | "delegated" | "system";
  requested_by: string | null;
  deadline: string | null;
  result_summary: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskStatus =
  | "proposed"
  | "queued"
  | "planning"
  | "awaiting_start_approval"
  | "running"
  | "waiting_info"
  | "waiting_approval"
  | "waiting_external"
  | "blocked"
  | "quality_review"
  | "complete"
  | "failed"
  | "cancelled";

export type AgentEventRow = {
  id: string;
  agent_id: string | null;
  task_id: string | null;
  run_id: string | null;
  type: string;
  summary: string;
  actor: string | null;
  created_at: string;
};

export type AgentRunRow = {
  id: string;
  agent: string;
  agent_id: string | null;
  task_id: string | null;
  trigger: string;
  model: string;
  status: string;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: number | string | null;
  duration_ms: number | null;
  error: string | null;
  created_at: string;
};

/* ── Meta maps (labels never rely on colour alone) ─────────────── */

export const LIFECYCLE_META: Record<
  AgentLifecycle,
  { label: string; tone: "accent" | "success" | "warning" | "danger" | "muted" }
> = {
  draft: { label: "Draft", tone: "muted" },
  under_review: { label: "Under review", tone: "warning" },
  test: { label: "Test mode", tone: "warning" },
  active: { label: "Active", tone: "success" },
  paused: { label: "Paused", tone: "muted" },
  needs_attention: { label: "Needs attention", tone: "danger" },
  archived: { label: "Archived", tone: "muted" },
};

export const TASK_COLUMNS: readonly TaskStatus[] = [
  "proposed",
  "queued",
  "planning",
  "awaiting_start_approval",
  "running",
  "waiting_info",
  "waiting_approval",
  "waiting_external",
  "blocked",
  "quality_review",
  "complete",
  "failed",
  "cancelled",
] as const;

export const TASK_META: Record<
  TaskStatus,
  { label: string; tone: "accent" | "success" | "warning" | "danger" | "muted" }
> = {
  proposed: { label: "Proposed", tone: "muted" },
  queued: { label: "Queued", tone: "accent" },
  planning: { label: "Planning", tone: "accent" },
  awaiting_start_approval: { label: "Awaiting approval to start", tone: "warning" },
  running: { label: "Running", tone: "accent" },
  waiting_info: { label: "Waiting on information", tone: "warning" },
  waiting_approval: { label: "Waiting on human approval", tone: "warning" },
  waiting_external: { label: "Waiting on external system", tone: "warning" },
  blocked: { label: "Blocked", tone: "danger" },
  quality_review: { label: "Quality review", tone: "accent" },
  complete: { label: "Complete", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "muted" },
};

export const RISK_TIER_LABEL: Record<number, string> = {
  0: "T0 · Observe & organise",
  1: "T1 · Internal workflow",
  2: "T2 · External draft (human release)",
  3: "T3 · High-impact (named approval)",
  4: "T4 · Prohibited autonomy",
};

export const RUNTIME_LABEL: Record<AgentRow["runtime"], string> = {
  internal_call: "Internal model call",
  managed_agents: "Managed Agents session",
  github_action: "GitHub dispatch",
  routine: "Routine",
  none: "No runtime (not executable)",
};

/** An agent is stale when it claims activity but hasn't reported for 24h.
 *  Phase 1 has no heartbeats — never pretend real-time. */
export function staleness(a: Pick<AgentRow, "lifecycle" | "last_activity_at">): {
  stale: boolean;
  label: string;
} {
  if (!a.last_activity_at)
    return {
      stale: false,
      label: a.lifecycle === "active" ? "No activity recorded" : "—",
    };
  const ms = Date.now() - new Date(a.last_activity_at).getTime();
  const hours = ms / 3_600_000;
  const label =
    hours < 1
      ? `${Math.max(1, Math.round(ms / 60_000))}m ago`
      : hours < 48
        ? `${Math.round(hours)}h ago`
        : `${Math.round(hours / 24)}d ago`;
  return {
    stale: a.lifecycle === "active" && hours > 24,
    label: `Last activity ${label}`,
  };
}

export function fmtUsd(v: number | string | null | undefined): string {
  const n = typeof v === "string" ? parseFloat(v) : (v ?? 0);
  return `$${(Number.isFinite(n) ? n : 0).toFixed(2)}`;
}
