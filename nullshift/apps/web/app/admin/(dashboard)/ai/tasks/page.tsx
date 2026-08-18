import Link from "next/link";
import { revalidatePath } from "next/cache";
import { createClient } from "@nullshift/db";
import { logAudit } from "@nullshift/db/audit";
import { requireStaff } from "@nullshift/auth/guards";
import { T } from "@nullshift/ui/tokens";
import { PageHeader, Panel, StatusChip } from "@/components/app/AppKit";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Reveal } from "@/components/kyma";
import {
  TASK_COLUMNS,
  TASK_META,
  RISK_TIER_LABEL,
  type AgentRow,
  type AgentTaskRow,
} from "@/lib/aiw";

/** Task board — every piece of work delegated to an agent, in one workflow
 *  view, plus the "Delegate task" form. Phase 1 records the delegation and
 *  routes it through the lifecycle; runtime execution attaches in Phase 4, so
 *  a queued task is a work order awaiting its runtime, not a hidden run. */

export const dynamic = "force-dynamic";

async function delegateTask(formData: FormData) {
  "use server";
  const staff = await requireStaff();
  if (!staff.ok) return;

  const objective = String(formData.get("objective") || "").trim();
  const agentId = String(formData.get("agent_id") || "");
  const detail = String(formData.get("detail") || "").trim() || null;
  const priority = String(formData.get("priority") || "normal");
  const riskTier = Math.min(2, Math.max(0, Number(formData.get("risk_tier") || 0)));
  const executionMode = String(formData.get("execution_mode") || "draft_only");
  const tenantId = String(formData.get("tenant_id") || "") || null;
  if (!objective || !agentId) return;

  const supabase = await createClient();
  // Only active or test-mode agents may accept tasks (drafts cannot, by design).
  const { data: agent } = await supabase
    .from("agents")
    .select("id, name, lifecycle, max_risk_tier")
    .eq("id", agentId)
    .maybeSingle();
  if (!agent || !["active", "test"].includes(agent.lifecycle)) return;
  // A task may not carry more autonomy than the agent is allowed.
  const tier = Math.min(riskTier, agent.max_risk_tier);

  const { data: task } = await supabase
    .from("agent_tasks")
    .insert({
      agent_id: agentId,
      tenant_id: tenantId,
      objective,
      detail,
      priority,
      risk_tier: tier,
      execution_mode: executionMode,
      source: "manual",
      status: "queued",
      requested_by: staff.email,
    })
    .select("id")
    .single();

  if (task) {
    await supabase.from("agent_events").insert({
      agent_id: agentId,
      task_id: task.id,
      type: "task.created",
      summary: `Task delegated to ${agent.name}: ${objective.slice(0, 120)}`,
      actor: staff.email,
      detail: { priority, risk_tier: tier, execution_mode: executionMode },
    });
    await logAudit({
      action: "agent_task.created",
      target: `agent_task:${task.id}`,
      tenantId,
      metadata: { agent: agent.name, objective: objective.slice(0, 200) },
    });
  }
  revalidatePath("/admin/ai/tasks");
  revalidatePath("/admin/ai");
}

export default async function AgentTasksPage() {
  const supabase = await createClient();
  const [{ data: tasksRaw }, { data: agentsRaw }, { data: tenantsRaw }] =
    await Promise.all([
      supabase.from("agent_tasks").select("*").order("created_at", { ascending: false }),
      supabase.from("agents").select("*").order("name"),
      supabase.from("tenants").select("id, name").eq("type", "client").order("name"),
    ]);
  const tasks = (tasksRaw ?? []) as AgentTaskRow[];
  const agents = (agentsRaw ?? []) as AgentRow[];
  const tenants = (tenantsRaw ?? []) as { id: string; name: string }[];
  const agentById = new Map(agents.map((a) => [a.id, a]));
  const assignable = agents.filter((a) => ["active", "test"].includes(a.lifecycle));

  // Show only columns that hold work, plus the always-visible core lanes.
  const core = new Set(["queued", "running", "waiting_approval", "complete"]);
  const columns = TASK_COLUMNS.filter(
    (c) => core.has(c) || tasks.some((t) => t.status === c)
  );

  return (
    <div>
      <PageHeader
        index="AI"
        label="Agent tasks"
        title="The work queue"
        lead="Every delegation on the record: objective, agent, risk tier, approvals and outcome. Nothing runs invisibly."
        className="mb-8"
      />

      {/* Delegate form */}
      <Reveal className="block">
        <Panel label="// DELEGATE" title="Delegate a task to an agent">
          <form action={delegateTask} className="grid gap-3 lg:grid-cols-2">
            <label className="flex flex-col gap-1.5 lg:col-span-2">
              <span style={labelStyle}>Objective (plain English)</span>
              <input
                name="objective"
                required
                className="brief-input"
                placeholder="e.g. Draft this week's internal status summary for the Dance Exclusive build"
              />
            </label>
            <label className="flex flex-col gap-1.5 lg:col-span-2">
              <span style={labelStyle}>Detail / desired output (optional)</span>
              <textarea
                name="detail"
                rows={2}
                className="brief-input"
                style={{ height: "auto", paddingTop: 10 }}
                placeholder="What should the result look like? Any constraints?"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span style={labelStyle}>Agent (active or test-mode only)</span>
              <select name="agent_id" required className="brief-input">
                <option value="">Choose an agent…</option>
                {assignable.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} — {a.role_title}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span style={labelStyle}>Client context (optional)</span>
              <select name="tenant_id" className="brief-input">
                <option value="">No client scope</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span style={labelStyle}>Priority</span>
              <select name="priority" defaultValue="normal" className="brief-input">
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span style={labelStyle}>Risk tier (capped by the agent&apos;s limit)</span>
              <select name="risk_tier" defaultValue="0" className="brief-input">
                <option value="0">{RISK_TIER_LABEL[0]}</option>
                <option value="1">{RISK_TIER_LABEL[1]}</option>
                <option value="2">{RISK_TIER_LABEL[2]}</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5 lg:col-span-2">
              <span style={labelStyle}>Execution mode</span>
              <select
                name="execution_mode"
                defaultValue="draft_only"
                className="brief-input"
              >
                <option value="draft_only">Draft only — output for human review</option>
                <option value="approve_before_action">
                  Approval before any action is taken
                </option>
                <option value="approved_low_risk">
                  Approved low-risk execution (Tier 0–1 only)
                </option>
              </select>
            </label>
            <div className="lg:col-span-2">
              <SubmitButton className="kb kb-primary" pendingLabel="Recording…">
                Delegate task
              </SubmitButton>
            </div>
          </form>
        </Panel>
      </Reveal>

      {/* Board */}
      <div
        className="mt-6 grid gap-3"
        style={{
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          alignItems: "start",
        }}
      >
        {columns.map((col, ci) => {
          const items = tasks.filter((t) => t.status === col);
          return (
            <Reveal key={col} delay={ci * 0.03}>
              <div
                className="k-kard"
                style={{
                  background: "var(--k-surface)",
                  border: "1px solid var(--k-border)",
                  padding: 12,
                }}
              >
                <div
                  className="flex items-center justify-between"
                  style={{
                    marginBottom: 10,
                    paddingBottom: 8,
                    borderBottom: "1px solid var(--k-border)",
                  }}
                >
                  <span
                    style={{
                      fontFamily: T.mono,
                      fontSize: "10px",
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "var(--k-muted)",
                    }}
                  >
                    {TASK_META[col].label}
                  </span>
                  <span
                    style={{
                      fontFamily: T.mono,
                      fontSize: "10.5px",
                      color: "var(--k-faint)",
                    }}
                  >
                    {items.length}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {items.length === 0 ? (
                    <span
                      style={{
                        fontFamily: T.mono,
                        fontSize: "10px",
                        color: "var(--k-faint)",
                      }}
                    >
                      Empty
                    </span>
                  ) : (
                    items.map((t) => (
                      <Link
                        key={t.id}
                        href={`/admin/ai/tasks/${t.id}`}
                        className="k-kard-h block px-3 py-2"
                        style={{
                          border: "1px solid var(--k-border)",
                          background: "var(--k-bg)",
                          textDecoration: "none",
                        }}
                      >
                        <div
                          style={{
                            fontFamily: T.sans,
                            fontWeight: 600,
                            fontSize: "0.8rem",
                            color: "var(--k-fg)",
                          }}
                        >
                          {t.objective}
                        </div>
                        <div
                          className="flex flex-wrap gap-2"
                          style={{
                            fontFamily: T.mono,
                            fontSize: "9.5px",
                            color: "var(--k-faint)",
                            marginTop: 4,
                          }}
                        >
                          <span>
                            {agentById.get(t.agent_id ?? "")?.name ?? "Unassigned"}
                          </span>
                          <span>T{t.risk_tier}</span>
                          {t.priority !== "normal" && (
                            <StatusChip
                              tone={t.priority === "urgent" ? "danger" : "warning"}
                            >
                              {t.priority}
                            </StatusChip>
                          )}
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontFamily: T.sans,
  fontSize: "0.8125rem",
  fontWeight: 500,
  color: "var(--k-fg)",
};
