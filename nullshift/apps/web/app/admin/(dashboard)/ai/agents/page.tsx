import Link from "next/link";
import { createClient } from "@nullshift/db";
import { T } from "@nullshift/ui/tokens";
import { PageHeader, Panel, StatusChip } from "@/components/app/AppKit";
import { Reveal } from "@/components/kyma";
import {
  LIFECYCLE_META,
  RUNTIME_LABEL,
  fmtUsd,
  staleness,
  type AgentRow,
  type AgentRunRow,
  type DepartmentRow,
} from "@/lib/aiw";

/** Agent directory — the accessible table view of the office (list alternative
 *  to the map). One row per agent: role, manager, owner, lifecycle, runtime,
 *  activity and 7-day cost. */

export const dynamic = "force-dynamic";

export default async function AgentDirectoryPage() {
  const supabase = await createClient();
  const since7d = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
  const [{ data: agentsRaw }, { data: depsRaw }, { data: runsRaw }] = await Promise.all([
    supabase.from("agents").select("*").order("name"),
    supabase.from("agent_departments").select("*"),
    supabase
      .from("agent_runs")
      .select("agent_id, status, cost_usd, created_at")
      .gte("created_at", since7d),
  ]);

  const agents = (agentsRaw ?? []) as AgentRow[];
  const departments = new Map(((depsRaw ?? []) as DepartmentRow[]).map((d) => [d.id, d]));
  const runs = (runsRaw ?? []) as Pick<
    AgentRunRow,
    "agent_id" | "status" | "cost_usd" | "created_at"
  >[];
  const agentName = new Map(agents.map((a) => [a.id, a.name]));

  const stats = new Map<string, { runs: number; cost: number; errors: number }>();
  for (const r of runs) {
    if (!r.agent_id) continue;
    const s = stats.get(r.agent_id) ?? { runs: 0, cost: 0, errors: 0 };
    s.runs += 1;
    s.cost += parseFloat(String(r.cost_usd ?? 0)) || 0;
    if (r.status === "error") s.errors += 1;
    stats.set(r.agent_id, s);
  }

  return (
    <div>
      <PageHeader
        index="AI"
        label="Agent directory"
        title="Every agent, on the record"
        lead="Software agents with named human owners. Drafts cannot run; activation requires review, scoped permissions and test evidence."
        actions={
          <Link href="/admin/ai/map" className="kb kb-outline kb-sm">
            Office map
          </Link>
        }
        className="mb-8"
      />

      <Reveal className="block">
        <Panel label="// DIRECTORY" title={`${agents.length} agents`} pad={false}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {[
                    "Agent",
                    "Department",
                    "Manager",
                    "Owner",
                    "Status",
                    "Runtime",
                    "Activity",
                    "Runs 7d",
                    "Cost 7d",
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "10px 14px",
                        fontFamily: T.mono,
                        fontSize: "9.5px",
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        color: "var(--k-faint)",
                        borderBottom: "1px solid var(--k-border)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {agents.map((a) => {
                  const meta = LIFECYCLE_META[a.lifecycle];
                  const s = stats.get(a.id);
                  const st = staleness(a);
                  return (
                    <tr key={a.id} className="k-kard-h">
                      <td style={cell}>
                        <Link
                          href={`/admin/ai/agents/${a.id}`}
                          style={{
                            fontFamily: T.sans,
                            fontWeight: 700,
                            fontSize: "0.85rem",
                            color: "var(--k-fg)",
                            textDecoration: "none",
                          }}
                        >
                          {a.name}
                        </Link>
                        <div style={{ ...faint, marginTop: 2 }}>{a.role_title}</div>
                      </td>
                      <td style={cell}>
                        {departments.get(a.department_id ?? "")?.name ?? "—"}
                      </td>
                      <td style={cell}>
                        {a.manager_agent_id
                          ? (agentName.get(a.manager_agent_id) ?? "—")
                          : "Humans"}
                      </td>
                      <td style={cell}>
                        {a.owner_email ?? <span style={faint}>unassigned</span>}
                      </td>
                      <td style={cell}>
                        <StatusChip tone={meta.tone}>{meta.label}</StatusChip>
                      </td>
                      <td style={cell}>{RUNTIME_LABEL[a.runtime]}</td>
                      <td style={{ ...cell, ...(st.stale ? { color: T.warning } : {}) }}>
                        {st.stale ? `STALE · ${st.label}` : st.label}
                      </td>
                      <td style={cell}>
                        {s ? `${s.runs}${s.errors ? ` (${s.errors} failed)` : ""}` : "0"}
                      </td>
                      <td style={cell}>{fmtUsd(s?.cost ?? 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </Reveal>
    </div>
  );
}

const cell: React.CSSProperties = {
  padding: "12px 14px",
  fontFamily: T.sans,
  fontSize: "0.82rem",
  color: "var(--k-muted)",
  borderBottom: "1px solid var(--k-border)",
  verticalAlign: "top",
};
const faint: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: "10px",
  color: "var(--k-faint)",
};
