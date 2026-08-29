import { createServiceClient } from "@nullshift/db";

/** AI Workspace policy layer (Phase 2) — structured rules evaluated in code
 *  BEFORE anything runs; prompts are style, this is enforcement. Server-only. */

export type WorkspacePolicy = {
  max_delegation_depth: number;
  max_children_per_task: number;
  max_task_budget_usd: number;
  org_daily_budget_usd: number;
  approval_expiry_days: number;
};

const DEFAULTS: WorkspacePolicy = {
  max_delegation_depth: 2,
  max_children_per_task: 5,
  max_task_budget_usd: 5,
  org_daily_budget_usd: 25,
  approval_expiry_days: 7,
};

export async function getPolicy(): Promise<WorkspacePolicy> {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("ops_settings")
      .select("value")
      .eq("key", "ai_workspace_policy")
      .maybeSingle();
    return { ...DEFAULTS, ...((data?.value as Partial<WorkspacePolicy>) ?? {}) };
  } catch {
    return DEFAULTS;
  }
}

export type PolicyVerdict = { ok: true } | { ok: false; reason: string };

/** Delegation checks for creating a child task under a parent (Phase 2 rules:
 *  bounded depth, bounded fan-out, no risk escalation, inherited scope). */
export async function checkDelegation(input: {
  parentTaskId: string;
  agentId: string;
  riskTier: number;
  tenantId: string | null;
}): Promise<PolicyVerdict> {
  const supabase = createServiceClient();
  const policy = await getPolicy();

  const { data: parent } = await supabase
    .from("agent_tasks")
    .select("id, parent_task_id, risk_tier, tenant_id")
    .eq("id", input.parentTaskId)
    .maybeSingle();
  if (!parent) return { ok: false, reason: "parent task not found" };

  // Depth: walk up the chain.
  let depth = 1;
  let cursor = parent.parent_task_id as string | null;
  while (cursor && depth <= policy.max_delegation_depth + 1) {
    depth += 1;
    const { data: up } = await supabase
      .from("agent_tasks")
      .select("parent_task_id")
      .eq("id", cursor)
      .maybeSingle();
    cursor = (up?.parent_task_id as string | null) ?? null;
  }
  if (depth > policy.max_delegation_depth)
    return {
      ok: false,
      reason: `delegation depth ${depth} exceeds limit ${policy.max_delegation_depth}`,
    };

  // Fan-out.
  const { count } = await supabase
    .from("agent_tasks")
    .select("id", { count: "exact", head: true })
    .eq("parent_task_id", input.parentTaskId);
  if ((count ?? 0) >= policy.max_children_per_task)
    return {
      ok: false,
      reason: `parent already has ${count} child tasks (limit ${policy.max_children_per_task})`,
    };

  // No risk escalation beyond parent or agent ceiling.
  if (input.riskTier > (parent.risk_tier as number))
    return { ok: false, reason: "child risk tier exceeds parent task's tier" };
  const { data: agent } = await supabase
    .from("agents")
    .select("max_risk_tier, lifecycle")
    .eq("id", input.agentId)
    .maybeSingle();
  if (!agent) return { ok: false, reason: "agent not found" };
  if (!["active", "test"].includes(agent.lifecycle as string))
    return { ok: false, reason: "agent is not active" };
  if (input.riskTier > (agent.max_risk_tier as number))
    return { ok: false, reason: "child risk tier exceeds the agent's permitted tier" };

  // Scope inheritance: a child may not widen client scope.
  const parentTenant = parent.tenant_id as string | null;
  if (parentTenant && input.tenantId && input.tenantId !== parentTenant)
    return {
      ok: false,
      reason: "child task cannot access a different client than its parent",
    };
  if (parentTenant && !input.tenantId)
    return { ok: false, reason: "child task must inherit the parent's client scope" };

  return { ok: true };
}

/** Today's recorded spend (USD) for an agent, and org-wide. */
export async function spendToday(agentId?: string): Promise<number> {
  const supabase = createServiceClient();
  const since = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
  let q = supabase.from("agent_runs").select("cost_usd").gte("created_at", since);
  if (agentId) q = q.eq("agent_id", agentId);
  const { data } = await q;
  return (data ?? []).reduce((s, r) => s + (parseFloat(String(r.cost_usd ?? 0)) || 0), 0);
}

export async function ledger(event: {
  agent_id?: string | null;
  task_id?: string | null;
  run_id?: string | null;
  type: string;
  summary: string;
  detail?: Record<string, unknown>;
  actor?: string | null;
}): Promise<void> {
  try {
    const supabase = createServiceClient();
    await supabase.from("agent_events").insert({
      agent_id: event.agent_id ?? null,
      task_id: event.task_id ?? null,
      run_id: event.run_id ?? null,
      type: event.type,
      summary: event.summary.slice(0, 500),
      detail: event.detail ?? {},
      actor: event.actor ?? "system",
    });
  } catch (e) {
    console.error("[aiw] ledger write failed (non-fatal):", e);
  }
}

export async function escalate(input: {
  agent_id?: string | null;
  task_id?: string | null;
  tenant_id?: string | null;
  reason: string;
  severity?: "low" | "normal" | "high" | "critical";
  owner_email?: string | null;
}): Promise<void> {
  try {
    const supabase = createServiceClient();
    // Dedupe: one open escalation per (agent, reason) at a time.
    const { data: existing } = await supabase
      .from("agent_escalations")
      .select("id")
      .eq("status", "open")
      .eq("reason", input.reason)
      .limit(1);
    if (existing && existing.length > 0) return;
    await supabase.from("agent_escalations").insert({
      agent_id: input.agent_id ?? null,
      task_id: input.task_id ?? null,
      tenant_id: input.tenant_id ?? null,
      reason: input.reason,
      severity: input.severity ?? "normal",
      owner_email: input.owner_email ?? null,
      sla_due_at: new Date(Date.now() + 48 * 3600_000).toISOString(),
    });
    await ledger({
      agent_id: input.agent_id ?? null,
      task_id: input.task_id ?? null,
      type: "escalation.created",
      summary: `Escalation: ${input.reason}`,
    });
  } catch (e) {
    console.error("[aiw] escalation failed (non-fatal):", e);
  }
}
