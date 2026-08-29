import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@nullshift/db";
import { logAudit } from "@nullshift/db/audit";
import { requireStaff } from "@nullshift/auth/guards";
import { T } from "@nullshift/ui/tokens";
import { PageHeader, Panel, StatusChip } from "@/components/app/AppKit";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Reveal } from "@/components/kyma";
import {
  RISK_TIER_LABEL,
  TASK_META,
  type AgentEventRow,
  type AgentRow,
  type AgentTaskRow,
  type TaskStatus,
} from "@/lib/aiw";

/** Task detail — the complete decision trail for one delegation: objective,
 *  context, policy settings, event history, and human resolution controls.
 *  Phase 1 transitions are human-only; a runtime will drive the middle states
 *  in Phase 4. */

export const dynamic = "force-dynamic";

const HUMAN_TRANSITIONS: Partial<Record<TaskStatus, TaskStatus[]>> = {
  proposed: ["queued", "cancelled"],
  queued: ["blocked", "complete", "cancelled"],
  planning: ["cancelled"],
  awaiting_start_approval: ["queued", "cancelled"],
  running: ["cancelled"],
  waiting_info: ["queued", "blocked", "cancelled"],
  waiting_approval: ["complete", "cancelled"],
  waiting_external: ["queued", "cancelled"],
  blocked: ["queued", "cancelled"],
  quality_review: ["complete", "failed"],
};

async function runNow(formData: FormData) {
  "use server";
  const staff = await requireStaff();
  if (!staff.ok) return;
  const id = String(formData.get("id") || "");
  if (!id) return;
  const { executeInternalTask } = await import("@/lib/aiw-runtime");
  await executeInternalTask(id, "admin");
  revalidatePath(`/admin/ai/tasks/${id}`);
  revalidatePath("/admin/ai/tasks");
  revalidatePath("/admin/ai/approvals");
}

async function delegateChild(formData: FormData) {
  "use server";
  const staff = await requireStaff();
  if (!staff.ok) return;
  const parentId = String(formData.get("parent_id") || "");
  const agentId = String(formData.get("agent_id") || "");
  const objective = String(formData.get("objective") || "").trim();
  const riskTier = Math.min(2, Math.max(0, Number(formData.get("risk_tier") || 0)));
  if (!parentId || !agentId || !objective) return;

  const supabase = await createClient();
  const { data: parent } = await supabase
    .from("agent_tasks")
    .select("id, tenant_id, agent_id")
    .eq("id", parentId)
    .maybeSingle();
  if (!parent) return;

  // Phase 2 policy gate: depth, fan-out, risk inheritance, scope inheritance.
  const { checkDelegation } = await import("@/lib/aiw-policy");
  const verdict = await checkDelegation({
    parentTaskId: parentId,
    agentId,
    riskTier,
    tenantId: (parent.tenant_id as string | null) ?? null,
  });
  if (!verdict.ok) {
    await supabase.from("agent_events").insert({
      agent_id: parent.agent_id,
      task_id: parentId,
      type: "policy.denied",
      summary: `Child delegation denied: ${verdict.reason}`,
      actor: staff.email,
      detail: {
        objective: objective.slice(0, 200),
        attempted_agent: agentId,
        risk_tier: riskTier,
      },
    });
    await logAudit({
      action: "agent_task.delegation_denied",
      target: `agent_task:${parentId}`,
      metadata: { reason: verdict.reason },
    });
    revalidatePath(`/admin/ai/tasks/${parentId}`);
    return;
  }

  const { data: child } = await supabase
    .from("agent_tasks")
    .insert({
      agent_id: agentId,
      parent_task_id: parentId,
      tenant_id: parent.tenant_id,
      objective,
      status: "queued",
      risk_tier: riskTier,
      execution_mode: "draft_only",
      source: "delegated",
      requested_by: staff.email,
    })
    .select("id")
    .single();
  if (child) {
    await supabase.from("agent_events").insert({
      agent_id: agentId,
      task_id: child.id,
      type: "task.created",
      summary: `Child task delegated under "${objective.slice(0, 80)}" (scope inherited)`,
      actor: staff.email,
    });
    await logAudit({
      action: "agent_task.child_created",
      target: `agent_task:${child.id}`,
    });
  }
  revalidatePath(`/admin/ai/tasks/${parentId}`);
}

async function resolveTask(formData: FormData) {
  "use server";
  const staff = await requireStaff();
  if (!staff.ok) return;
  const id = String(formData.get("id") || "");
  const to = String(formData.get("to") || "") as TaskStatus;
  const note = String(formData.get("note") || "").trim() || null;
  if (!id || !to) return;

  const supabase = await createClient();
  const { data: task } = await supabase
    .from("agent_tasks")
    .select("id, status, objective, agent_id")
    .eq("id", id)
    .maybeSingle();
  if (!task) return;
  const allowed = HUMAN_TRANSITIONS[task.status as TaskStatus] ?? [];
  if (!allowed.includes(to)) return;

  await supabase
    .from("agent_tasks")
    .update({ status: to, ...(note ? { result_summary: note } : {}) })
    .eq("id", id);
  await supabase.from("agent_events").insert({
    agent_id: task.agent_id,
    task_id: id,
    type: "task.status_changed",
    summary: `Task "${String(task.objective).slice(0, 80)}": ${task.status} → ${to}${note ? ` — ${note.slice(0, 100)}` : ""}`,
    actor: staff.email,
    detail: { from: task.status, to },
  });
  await logAudit({ action: `agent_task.${to}`, target: `agent_task:${id}` });
  revalidatePath(`/admin/ai/tasks/${id}`);
  revalidatePath("/admin/ai/tasks");
}

export default async function AgentTaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: taskRaw } = await supabase
    .from("agent_tasks")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!taskRaw) notFound();
  const task = taskRaw as AgentTaskRow;

  const [{ data: agent }, { data: tenant }, { data: eventsRaw }, { data: children }] =
    await Promise.all([
      task.agent_id
        ? supabase.from("agents").select("*").eq("id", task.agent_id).maybeSingle()
        : Promise.resolve({ data: null }),
      task.tenant_id
        ? supabase
            .from("tenants")
            .select("id, name")
            .eq("id", task.tenant_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("agent_events")
        .select("*")
        .eq("task_id", id)
        .order("created_at", { ascending: true }),
      supabase
        .from("agent_tasks")
        .select("id, objective, status")
        .eq("parent_task_id", id),
    ]);

  const { data: assignableRaw } = await supabase
    .from("agents")
    .select("*")
    .in("lifecycle", ["active", "test"])
    .order("name");
  const assignable = (assignableRaw ?? []) as AgentRow[];

  const events = (eventsRaw ?? []) as AgentEventRow[];
  const a = agent as AgentRow | null;
  const meta = TASK_META[task.status];
  const transitions = HUMAN_TRANSITIONS[task.status] ?? [];

  return (
    <div>
      <PageHeader
        index="AI"
        label="Agent task"
        title={task.objective}
        lead={
          <>
            <StatusChip tone={meta.tone}>{meta.label}</StatusChip>{" "}
            <span style={{ marginLeft: 8 }}>
              {a ? (
                <Link
                  href={`/admin/ai/agents/${a.id}`}
                  style={{ color: "var(--k-accent)" }}
                >
                  {a.name}
                </Link>
              ) : (
                "Unassigned"
              )}{" "}
              · requested by {task.requested_by ?? "—"} ·{" "}
              {new Date(task.created_at).toLocaleString("en-GB")}
            </span>
          </>
        }
        className="mb-8"
      />

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="flex flex-col gap-4">
          <Reveal className="block">
            <Panel label="// WORK ORDER" title="Objective & policy">
              {task.detail && <p style={body}>{task.detail}</p>}
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Fact
                  k="Risk tier"
                  v={RISK_TIER_LABEL[task.risk_tier] ?? String(task.risk_tier)}
                />
                <Fact
                  k="Execution mode"
                  v={
                    task.execution_mode === "draft_only"
                      ? "Draft only — human reviews output"
                      : task.execution_mode === "approve_before_action"
                        ? "Approval before any action"
                        : "Approved low-risk execution"
                  }
                />
                <Fact k="Priority" v={task.priority} />
                <Fact k="Source" v={task.source} />
                <Fact
                  k="Client scope"
                  v={(tenant as { name?: string } | null)?.name ?? "None (internal)"}
                />
                <Fact
                  k="Deadline"
                  v={
                    task.deadline
                      ? new Date(task.deadline).toLocaleString("en-GB")
                      : "None"
                  }
                />
              </div>
              {task.result_summary && (
                <div className="mt-4">
                  <div style={monoHead}>Outcome</div>
                  <p style={{ ...body, color: "var(--k-fg)", marginTop: 4 }}>
                    {task.result_summary}
                  </p>
                </div>
              )}
            </Panel>
          </Reveal>

          {(children ?? []).length > 0 && (
            <Reveal className="block" delay={0.04}>
              <Panel label="// DELEGATION" title="Child tasks">
                <div className="flex flex-col gap-2">
                  {(
                    children as { id: string; objective: string; status: TaskStatus }[]
                  ).map((c) => (
                    <Link
                      key={c.id}
                      href={`/admin/ai/tasks/${c.id}`}
                      className="k-kard-h flex items-center justify-between gap-2 px-3 py-2"
                      style={{
                        border: "1px solid var(--k-border)",
                        textDecoration: "none",
                      }}
                    >
                      <span style={{ ...body, color: "var(--k-fg)" }}>{c.objective}</span>
                      <StatusChip tone={TASK_META[c.status].tone}>
                        {TASK_META[c.status].label}
                      </StatusChip>
                    </Link>
                  ))}
                </div>
              </Panel>
            </Reveal>
          )}

          {["queued", "proposed"].includes(task.status) &&
            a &&
            ["active", "test"].includes(a.lifecycle) &&
            a.runtime === "internal_call" && (
              <Reveal className="block" delay={0.05}>
                <Panel label="// RUNTIME" title="Execute now (internal draft run)">
                  <p style={body}>
                    Runs one bounded internal model call for this task. Tier 0–1 output
                    completes as a recorded draft; Tier 2+ output lands in the approval
                    inbox — nothing external ever happens without a named human.
                  </p>
                  <form action={runNow} className="mt-3">
                    <input type="hidden" name="id" value={task.id} />
                    <SubmitButton className="kb kb-primary kb-sm" pendingLabel="Running…">
                      Run task now
                    </SubmitButton>
                  </form>
                </Panel>
              </Reveal>
            )}

          <Reveal className="block" delay={0.055}>
            <Panel label="// DELEGATE" title="Delegate a child task (policy-checked)">
              <form action={delegateChild} className="flex flex-col gap-3">
                <input type="hidden" name="parent_id" value={task.id} />
                <input
                  name="objective"
                  required
                  className="brief-input"
                  placeholder="Bounded sub-objective (inherits this task's client scope)"
                />
                <div className="flex flex-wrap gap-2">
                  <select
                    name="agent_id"
                    required
                    className="brief-input"
                    style={{ flex: 1, minWidth: 200 }}
                  >
                    <option value="">Choose an agent…</option>
                    {assignable.map((ag) => (
                      <option key={ag.id} value={ag.id}>
                        {ag.name}
                      </option>
                    ))}
                  </select>
                  <select
                    name="risk_tier"
                    defaultValue="0"
                    className="brief-input"
                    style={{ width: 160 }}
                  >
                    <option value="0">Tier 0</option>
                    <option value="1">Tier 1</option>
                    <option value="2">Tier 2</option>
                  </select>
                  <SubmitButton className="kb kb-outline kb-sm" pendingLabel="Checking…">
                    Delegate child
                  </SubmitButton>
                </div>
                <p style={monoFaint}>
                  Denied automatically if it exceeds delegation depth, fan-out, the
                  parent&apos;s risk tier, the agent&apos;s permitted tier, or widens
                  client scope — denials are recorded in the trail below.
                </p>
              </form>
            </Panel>
          </Reveal>

          <Reveal className="block" delay={0.06}>
            <Panel label="// RESOLVE" title="Human decision">
              {transitions.length === 0 ? (
                <p style={body}>This task is closed. The record is permanent.</p>
              ) : (
                <form action={resolveTask} className="flex flex-col gap-3">
                  <input type="hidden" name="id" value={task.id} />
                  <label className="flex flex-col gap-1.5">
                    <span style={{ ...body, color: "var(--k-fg)", fontWeight: 600 }}>
                      Note (recorded on the ledger)
                    </span>
                    <input
                      name="note"
                      className="brief-input"
                      placeholder="Why — becomes the outcome summary"
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {transitions.map((to) => (
                      <SubmitButton
                        key={to}
                        name="to"
                        value={to}
                        className={`kb kb-sm ${to === "cancelled" || to === "failed" ? "kb-outline" : "kb-primary"}`}
                        pendingLabel="Recording…"
                      >
                        {TASK_META[to].label}
                      </SubmitButton>
                    ))}
                  </div>
                </form>
              )}
            </Panel>
          </Reveal>
        </div>

        <Reveal className="block" delay={0.05}>
          <Panel label="// TRAIL" title="Event history">
            {events.length === 0 ? (
              <p style={body}>No events recorded yet.</p>
            ) : (
              <div className="flex flex-col">
                {events.map((e) => (
                  <div
                    key={e.id}
                    className="py-2"
                    style={{ borderBottom: "1px solid var(--k-border)" }}
                  >
                    <div style={{ ...body, color: "var(--k-fg)" }}>{e.summary}</div>
                    <div style={monoFaint}>
                      {e.type} · {e.actor ?? "system"} ·{" "}
                      {new Date(e.created_at).toLocaleString("en-GB")}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </Reveal>
      </div>
    </div>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div style={monoHead}>{k}</div>
      <div style={{ ...body, color: "var(--k-fg)", marginTop: 2 }}>{v}</div>
    </div>
  );
}

const body: React.CSSProperties = {
  fontFamily: T.sans,
  fontSize: "0.86rem",
  lineHeight: 1.55,
  color: "var(--k-muted)",
};
const monoHead: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: "9.5px",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--k-faint)",
};
const monoFaint: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: "10px",
  letterSpacing: "0.04em",
  color: "var(--k-faint)",
};
