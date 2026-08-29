import Link from "next/link";
import { createClient } from "@nullshift/db";
import { T } from "@nullshift/ui/tokens";
import { PageHeader, Panel, StatusChip } from "@/components/app/AppKit";
import { Reveal } from "@/components/kyma";
import {
  LIFECYCLE_META,
  staleness,
  type AgentEventRow,
  type AgentRow,
  type AgentTaskRow,
  type DepartmentRow,
} from "@/lib/aiw";

/**
 * Live office map — the reporting-lines view. Humans at the top, manager
 * agents beneath, specialists grouped by department. Solid connector = manages;
 * a node links to the agent profile. Statuses are recorded state with visible
 * last-activity/staleness — never pretend real-time. The Agent directory is the
 * accessible list/table alternative to this visual.
 */

export const dynamic = "force-dynamic";

export default async function OfficeMapPage() {
  const supabase = await createClient();
  const [
    { data: depsRaw },
    { data: agentsRaw },
    { data: tasksRaw },
    { data: eventsRaw },
  ] = await Promise.all([
    supabase.from("agent_departments").select("*").order("sort"),
    supabase.from("agents").select("*").neq("lifecycle", "archived").order("name"),
    supabase
      .from("agent_tasks")
      .select("id, agent_id, status")
      .not("status", "in", "(complete,failed,cancelled)"),
    supabase
      .from("agent_events")
      .select("agent_id, summary, created_at")
      .order("created_at", { ascending: false })
      .limit(60),
  ]);

  const departments = (depsRaw ?? []) as DepartmentRow[];
  const agents = (agentsRaw ?? []) as AgentRow[];
  const tasks = (tasksRaw ?? []) as Pick<AgentTaskRow, "id" | "agent_id" | "status">[];
  const events = (eventsRaw ?? []) as Pick<
    AgentEventRow,
    "agent_id" | "summary" | "created_at"
  >[];

  const latestEvent = new Map<string, string>();
  for (const e of events) {
    if (e.agent_id && !latestEvent.has(e.agent_id))
      latestEvent.set(e.agent_id, e.summary);
  }
  const openTaskCount = new Map<string, number>();
  const waitingCount = new Map<string, number>();
  for (const t of tasks) {
    if (!t.agent_id) continue;
    openTaskCount.set(t.agent_id, (openTaskCount.get(t.agent_id) ?? 0) + 1);
    if (t.status === "waiting_approval" || t.status === "awaiting_start_approval")
      waitingCount.set(t.agent_id, (waitingCount.get(t.agent_id) ?? 0) + 1);
  }

  const managers = agents.filter((a) => a.may_delegate);
  const childrenOf = (id: string) => agents.filter((a) => a.manager_agent_id === id);
  const unmanaged = agents.filter((a) => !a.may_delegate && !a.manager_agent_id);

  return (
    <div>
      <PageHeader
        index="AI"
        label="Office map"
        title="Who reports to whom"
        lead="Solid lines are standing reporting lines. Every agent answers to a manager agent or directly to a human owner — and every manager answers to the humans."
        actions={
          <Link href="/admin/ai/agents" className="kb kb-outline kb-sm">
            List view
          </Link>
        }
        className="mb-8"
      />

      {/* Humans */}
      <Reveal>
        <div className="flex justify-center">
          <div
            className="k-kard px-6 py-4 text-center"
            style={{
              border: "1px solid var(--k-accent)",
              background: "var(--k-surface)",
            }}
          >
            <div
              style={{
                fontFamily: T.mono,
                fontSize: "10px",
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "var(--k-accent)",
              }}
            >
              Accountable humans
            </div>
            <div
              style={{
                fontFamily: T.sans,
                fontWeight: 700,
                fontSize: "1.05rem",
                color: "var(--k-fg)",
                marginTop: 4,
              }}
            >
              Null Shift admins & partners
            </div>
            <div
              style={{ fontFamily: T.mono, fontSize: "10.5px", color: "var(--k-faint)" }}
            >
              Approve anything material · own every agent
            </div>
          </div>
        </div>
        <Connector />
      </Reveal>

      {/* Departments with managers + reports */}
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}
      >
        {departments.map((dept, di) => {
          const deptManagers = managers.filter((m) => m.department_id === dept.id);
          const deptLoose = unmanaged.filter((a) => a.department_id === dept.id);
          if (deptManagers.length === 0 && deptLoose.length === 0) return null;
          return (
            <Reveal key={dept.id} className="block" delay={di * 0.05}>
              <Panel
                label={`// ${dept.name.toUpperCase()}`}
                title={dept.name}
                pad={false}
              >
                <div style={{ padding: 14 }}>
                  <p
                    style={{
                      fontFamily: T.sans,
                      fontSize: "0.8rem",
                      color: "var(--k-faint)",
                      marginBottom: 12,
                    }}
                  >
                    {dept.mission}
                  </p>
                  {deptManagers.map((m) => (
                    <div key={m.id} style={{ marginBottom: 14 }}>
                      <AgentNode
                        agent={m}
                        liveLabel={latestEvent.get(m.id)}
                        openTasks={openTaskCount.get(m.id) ?? 0}
                        waiting={waitingCount.get(m.id) ?? 0}
                        manager
                      />
                      {childrenOf(m.id).length > 0 && (
                        <div
                          style={{
                            marginLeft: 14,
                            paddingLeft: 14,
                            borderLeft: "2px solid var(--k-border)",
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                            marginTop: 8,
                          }}
                        >
                          {childrenOf(m.id).map((c) => (
                            <AgentNode
                              key={c.id}
                              agent={c}
                              liveLabel={latestEvent.get(c.id)}
                              openTasks={openTaskCount.get(c.id) ?? 0}
                              waiting={waitingCount.get(c.id) ?? 0}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {deptLoose.map((a) => (
                    <div key={a.id} style={{ marginBottom: 8 }}>
                      <AgentNode
                        agent={a}
                        liveLabel={latestEvent.get(a.id)}
                        openTasks={openTaskCount.get(a.id) ?? 0}
                        waiting={waitingCount.get(a.id) ?? 0}
                        reportsToHumans
                      />
                    </div>
                  ))}
                </div>
              </Panel>
            </Reveal>
          );
        })}
      </div>
    </div>
  );
}

function Connector() {
  return (
    <div className="flex justify-center" aria-hidden>
      <div
        style={{ width: 2, height: 28, background: "var(--k-border)", margin: "6px 0" }}
      />
    </div>
  );
}

function AgentNode({
  agent,
  liveLabel,
  openTasks,
  waiting,
  manager = false,
  reportsToHumans = false,
}: {
  agent: AgentRow;
  liveLabel?: string;
  openTasks: number;
  waiting: number;
  manager?: boolean;
  reportsToHumans?: boolean;
}) {
  const meta = LIFECYCLE_META[agent.lifecycle];
  const stale = staleness(agent);
  return (
    <Link
      href={`/admin/ai/agents/${agent.id}`}
      className="k-kard-h block px-3 py-2"
      style={{
        border: `1px solid ${manager ? "var(--k-accent)" : "var(--k-border)"}`,
        background: "var(--k-bg)",
        textDecoration: "none",
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          style={{
            fontFamily: T.sans,
            fontWeight: 700,
            fontSize: "0.85rem",
            color: "var(--k-fg)",
          }}
        >
          {agent.name}
          {manager && (
            <span
              style={{
                fontFamily: T.mono,
                fontSize: "9px",
                letterSpacing: "0.1em",
                color: "var(--k-accent)",
                marginLeft: 8,
                textTransform: "uppercase",
              }}
            >
              Manager
            </span>
          )}
        </span>
        <StatusChip tone={meta.tone}>{meta.label}</StatusChip>
      </div>
      <div
        style={{
          fontFamily: T.sans,
          fontSize: "0.78rem",
          color: "var(--k-muted)",
          marginTop: 3,
        }}
      >
        {liveLabel ?? agent.role_title}
      </div>
      <div
        className="flex flex-wrap items-center gap-3"
        style={{
          fontFamily: T.mono,
          fontSize: "9.5px",
          letterSpacing: "0.05em",
          color: "var(--k-faint)",
          marginTop: 5,
        }}
      >
        <span>
          {openTasks} open task{openTasks === 1 ? "" : "s"}
        </span>
        {waiting > 0 && (
          <span style={{ color: T.warning }}>{waiting} awaiting approval</span>
        )}
        <span style={stale.stale ? { color: T.warning } : undefined}>
          {stale.stale ? `STALE · ${stale.label}` : stale.label}
        </span>
        {reportsToHumans && <span>Reports to humans</span>}
      </div>
    </Link>
  );
}
