import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@nullshift/db";
import { logAudit } from "@nullshift/db/audit";
import { requireStaff, getCurrentUser } from "@nullshift/auth/guards";
import { T } from "@nullshift/ui/tokens";
import { PageHeader, Panel, StatusChip } from "@/components/app/AppKit";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Reveal } from "@/components/kyma";
import {
  LIFECYCLE_META,
  RISK_TIER_LABEL,
  RUNTIME_LABEL,
  TASK_META,
  fmtUsd,
  staleness,
  type AgentEventRow,
  type AgentLifecycle,
  type AgentRow,
  type AgentRunRow,
  type AgentTaskRow,
  type DepartmentRow,
} from "@/lib/aiw";

/** Agent profile — the full record for one agent: role, reporting line,
 *  permissions, gates, activity, runs/cost and versioned config history.
 *  Lifecycle actions (pause/resume/archive) are audited and append to the
 *  ledger. Archived agents keep their history but cannot run (Phase 1 has no
 *  execution; the constraint is recorded so Phase 4 enforcement inherits it). */

export const dynamic = "force-dynamic";

/** Legal manual transitions (Phase 1 — activation beyond test stays with the
 *  Agent Studio flow in Phase 3, so drafts can only move to under_review/test). */
const TRANSITIONS: Record<AgentLifecycle, AgentLifecycle[]> = {
  draft: ["under_review"],
  under_review: ["test", "draft"],
  test: ["active", "under_review"],
  active: ["paused", "archived"],
  paused: ["active", "archived"],
  needs_attention: ["active", "paused", "archived"],
  archived: [],
};

async function runTest(formData: FormData) {
  "use server";
  const staff = await requireStaff();
  if (!staff.ok) return;
  const id = String(formData.get("id") || "");
  const sample = String(formData.get("sample") || "").trim();
  if (!id || !sample) return;
  const { runTestCase } = await import("@/lib/aiw-runtime");
  await runTestCase(id, sample, staff.email);
  revalidatePath(`/admin/ai/agents/${id}`);
}

async function changeLifecycle(formData: FormData) {
  "use server";
  const staff = await requireStaff();
  if (!staff.ok) return;
  const id = String(formData.get("id") || "");
  const to = String(formData.get("to") || "") as AgentLifecycle;
  if (!id || !to) return;

  const supabase = await createClient();
  const { data: agent } = await supabase
    .from("agents")
    .select("id, name, lifecycle")
    .eq("id", id)
    .maybeSingle();
  if (!agent) return;
  const allowed = TRANSITIONS[agent.lifecycle as AgentLifecycle] ?? [];
  if (!allowed.includes(to)) return;

  await supabase.from("agents").update({ lifecycle: to }).eq("id", id);
  await supabase.from("agent_events").insert({
    agent_id: id,
    type: "lifecycle.changed",
    summary: `${agent.name}: ${agent.lifecycle} → ${to} (by ${staff.email})`,
    actor: staff.email,
    detail: { from: agent.lifecycle, to },
  });
  await logAudit({
    action: `agent.${to}`,
    target: `agent:${id}`,
    metadata: { from: agent.lifecycle },
  });
  revalidatePath(`/admin/ai/agents/${id}`);
  revalidatePath("/admin/ai");
}

export default async function AgentProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getCurrentUser();

  const { data: agentRaw } = await supabase
    .from("agents")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!agentRaw) notFound();
  const agent = agentRaw as AgentRow;

  const [
    { data: dept },
    { data: manager },
    { data: reports },
    { data: tasksRaw },
    { data: eventsRaw },
    { data: runsRaw },
    { data: versionsRaw },
  ] = await Promise.all([
    agent.department_id
      ? supabase
          .from("agent_departments")
          .select("*")
          .eq("id", agent.department_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    agent.manager_agent_id
      ? supabase
          .from("agents")
          .select("id, name")
          .eq("id", agent.manager_agent_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("agents").select("id, name, lifecycle").eq("manager_agent_id", id),
    supabase
      .from("agent_tasks")
      .select("*")
      .eq("agent_id", id)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("agent_events")
      .select("*")
      .eq("agent_id", id)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("agent_runs")
      .select("*")
      .eq("agent_id", id)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("agent_versions")
      .select("id, version, reason, author_email, created_at")
      .eq("agent_id", id)
      .order("version", { ascending: false }),
  ]);

  const tasks = (tasksRaw ?? []) as AgentTaskRow[];
  const events = (eventsRaw ?? []) as AgentEventRow[];
  const runs = (runsRaw ?? []) as AgentRunRow[];
  const meta = LIFECYCLE_META[agent.lifecycle];
  const st = staleness(agent);
  const cost30 = runs.reduce((s, r) => s + (parseFloat(String(r.cost_usd ?? 0)) || 0), 0);
  const transitions = TRANSITIONS[agent.lifecycle] ?? [];

  return (
    <div>
      <PageHeader
        index="AI"
        label={(dept as DepartmentRow | null)?.name ?? "Agent"}
        title={agent.name}
        lead={
          <>
            {agent.role_title} · <StatusChip tone={meta.tone}>{meta.label}</StatusChip>{" "}
            <span style={{ marginLeft: 8 }}>
              {st.stale ? `STALE · ${st.label}` : st.label}
            </span>
          </>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {transitions.map((to) => (
              <form key={to} action={changeLifecycle}>
                <input type="hidden" name="id" value={agent.id} />
                <input type="hidden" name="to" value={to} />
                <SubmitButton
                  className={`kb kb-sm ${to === "archived" ? "kb-outline" : "kb-primary"}`}
                  pendingLabel="Saving…"
                >
                  {to === "active"
                    ? agent.lifecycle === "test"
                      ? "Activate"
                      : "Resume"
                    : to === "paused"
                      ? "Pause"
                      : to === "archived"
                        ? "Archive"
                        : to === "under_review"
                          ? "Send to review"
                          : to === "test"
                            ? "Enter test mode"
                            : `→ ${LIFECYCLE_META[to].label}`}
                </SubmitButton>
              </form>
            ))}
          </div>
        }
        className="mb-8"
      />

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="flex flex-col gap-4">
          <Reveal className="block">
            <Panel label="// ROLE" title="What this agent is for">
              <p style={body}>{agent.purpose}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Fact
                  k="Reports to"
                  v={
                    (manager as { name?: string } | null)?.name ??
                    "Humans (admins & partners)"
                  }
                />
                <Fact
                  k="Accountable human"
                  v={agent.owner_email ?? "Unassigned — config decision needed"}
                />
                <Fact k="Runtime" v={RUNTIME_LABEL[agent.runtime]} />
                <Fact
                  k="Max autonomous risk"
                  v={RISK_TIER_LABEL[agent.max_risk_tier] ?? String(agent.max_risk_tier)}
                />
                <Fact
                  k="May delegate"
                  v={agent.may_delegate ? "Yes — bounded, Phase 2 enforced" : "No"}
                />
                <Fact k="Config version" v={`v${agent.current_version}`} />
              </div>
              {(reports ?? []).length > 0 && (
                <div className="mt-4">
                  <div style={monoHead}>Direct reports</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(
                      reports as { id: string; name: string; lifecycle: AgentLifecycle }[]
                    ).map((r) => (
                      <Link
                        key={r.id}
                        href={`/admin/ai/agents/${r.id}`}
                        className="kb kb-outline kb-sm"
                      >
                        {r.name} · {LIFECYCLE_META[r.lifecycle].label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </Panel>
          </Reveal>

          <Reveal className="block" delay={0.04}>
            <Panel label="// PERMISSIONS" title="Capabilities, tools & gates">
              <ListBlock
                label="Capabilities"
                items={agent.capabilities}
                empty="None granted"
              />
              <ListBlock label="Tool grants" items={agent.tool_grants} empty="No tools" />
              <ListBlock
                label="Data scopes"
                items={agent.data_scopes}
                empty="No data access"
              />
              <ListBlock
                label="Human approval gates"
                items={agent.human_gates}
                empty="None recorded"
                tone="warning"
              />
            </Panel>
          </Reveal>

          {["draft", "under_review", "test"].includes(agent.lifecycle) && (
            <Reveal className="block" delay={0.06}>
              <Panel label="// TEST MODE" title="Run a test case (sandbox input only)">
                <form action={runTest} className="flex flex-col gap-3">
                  <input type="hidden" name="id" value={agent.id} />
                  <textarea
                    name="sample"
                    required
                    rows={3}
                    className="brief-input"
                    style={{ height: "auto", paddingTop: 10 }}
                    placeholder="Paste a sample input — the agent runs against this text only; no live data, no actions."
                  />
                  <div>
                    <SubmitButton
                      className="kb kb-primary kb-sm"
                      pendingLabel="Running test…"
                    >
                      Run test case
                    </SubmitButton>
                  </div>
                </form>
                {(() => {
                  const lastTest = events.find((e) => e.type === "test.ran");
                  const out = (
                    lastTest as
                      | (AgentEventRow & { detail?: { output?: string } })
                      | undefined
                  )?.detail?.output;
                  return out ? (
                    <div
                      style={{
                        marginTop: 12,
                        border: "1px solid var(--k-border)",
                        background: "var(--k-bg)",
                        padding: 12,
                        whiteSpace: "pre-wrap",
                        fontFamily: T.sans,
                        fontSize: "0.83rem",
                        lineHeight: 1.55,
                        color: "var(--k-fg)",
                        maxHeight: 280,
                        overflowY: "auto",
                      }}
                    >
                      {out}
                    </div>
                  ) : null;
                })()}
                <p style={{ ...monoFaint, marginTop: 8 }}>
                  Test runs are logged with cost and appear in the ledger. Activation
                  should follow passing tests — the transition buttons above enforce the
                  draft → review → test → active pipeline.
                </p>
              </Panel>
            </Reveal>
          )}

          <Reveal className="block" delay={0.08}>
            <Panel
              label="// TASKS"
              title="Recent tasks"
              actions={
                <Link href="/admin/ai/tasks" className="kb kb-outline kb-sm">
                  Task board
                </Link>
              }
            >
              {tasks.length === 0 ? (
                <p style={body}>No tasks recorded for this agent yet.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {tasks.map((t) => (
                    <Link
                      key={t.id}
                      href={`/admin/ai/tasks/${t.id}`}
                      className="k-kard-h flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                      style={{
                        border: "1px solid var(--k-border)",
                        textDecoration: "none",
                      }}
                    >
                      <span style={{ ...body, color: "var(--k-fg)" }}>{t.objective}</span>
                      <StatusChip tone={TASK_META[t.status].tone}>
                        {TASK_META[t.status].label}
                      </StatusChip>
                    </Link>
                  ))}
                </div>
              )}
            </Panel>
          </Reveal>
        </div>

        <div className="flex flex-col gap-4">
          <Reveal className="block" delay={0.04}>
            <Panel label="// RUNS" title={`Recent runs · ${fmtUsd(cost30)} (shown)`}>
              {runs.length === 0 ? (
                <p style={body}>
                  No runs recorded.{" "}
                  {agent.lifecycle === "draft" && "Drafts cannot run by design."}
                </p>
              ) : (
                <div className="flex flex-col">
                  {runs.map((r) => (
                    <div
                      key={r.id}
                      className="flex flex-wrap items-baseline justify-between gap-2 py-2"
                      style={{ borderBottom: "1px solid var(--k-border)" }}
                    >
                      <span style={{ ...body, color: "var(--k-fg)" }}>
                        {r.agent}{" "}
                        <StatusChip
                          tone={
                            r.status === "ok"
                              ? "success"
                              : r.status === "error"
                                ? "danger"
                                : "muted"
                          }
                        >
                          {r.status}
                        </StatusChip>
                      </span>
                      <span style={monoFaint}>
                        {fmtUsd(r.cost_usd)} ·{" "}
                        {r.duration_ms ? `${Math.round(r.duration_ms / 1000)}s` : "—"} ·{" "}
                        {new Date(r.created_at).toLocaleString("en-GB")}
                      </span>
                      {r.error && (
                        <span style={{ ...monoFaint, color: T.danger, width: "100%" }}>
                          {r.error}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </Reveal>

          <Reveal className="block" delay={0.08}>
            <Panel label="// LEDGER" title="Activity">
              {events.length === 0 ? (
                <p style={body}>No ledger entries.</p>
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

          <Reveal className="block" delay={0.12}>
            <Panel label="// VERSIONS" title="Configuration history">
              <div className="flex flex-col">
                {(versionsRaw ?? []).map((v) => (
                  <div
                    key={v.id}
                    className="flex items-baseline justify-between gap-2 py-2"
                    style={{ borderBottom: "1px solid var(--k-border)" }}
                  >
                    <span style={{ ...body, color: "var(--k-fg)" }}>
                      v{v.version} — {v.reason ?? "no reason recorded"}
                    </span>
                    <span style={monoFaint}>
                      {v.author_email ?? "—"} ·{" "}
                      {new Date(v.created_at).toLocaleDateString("en-GB")}
                    </span>
                  </div>
                ))}
              </div>
              <p style={{ ...monoFaint, marginTop: 8 }}>
                Editing configuration lands with Agent Studio (Phase 3); every change will
                write a new version here. Viewing as {user?.email ?? "staff"}.
              </p>
            </Panel>
          </Reveal>
        </div>
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

function ListBlock({
  label,
  items,
  empty,
  tone,
}: {
  label: string;
  items: string[];
  empty: string;
  tone?: "warning";
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={monoHead}>{label}</div>
      {(items ?? []).length === 0 ? (
        <p style={{ ...body, marginTop: 4 }}>{empty}</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1.5">
          {items.map((c, i) => (
            <li
              key={i}
              style={{
                ...body,
                color: tone === "warning" ? T.warning : "var(--k-fg)",
                paddingLeft: 14,
                position: "relative",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  left: 0,
                  color: tone === "warning" ? T.warning : "var(--k-accent)",
                }}
                aria-hidden
              >
                ▸
              </span>
              {c}
            </li>
          ))}
        </ul>
      )}
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
