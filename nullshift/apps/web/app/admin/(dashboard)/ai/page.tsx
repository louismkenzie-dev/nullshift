import Link from "next/link";
import { createClient } from "@nullshift/db";
import { T } from "@nullshift/ui/tokens";
import { PageHeader, Panel, StatCard, StatusChip } from "@/components/app/AppKit";
import { Reveal } from "@/components/kyma";
import {
  LIFECYCLE_META,
  TASK_META,
  fmtUsd,
  staleness,
  type AgentEventRow,
  type AgentRow,
  type AgentRunRow,
  type AgentTaskRow,
} from "@/lib/aiw";

/**
 * AI Workspace — Office overview. The admin landing page for the agency's AI
 * office: who's active, what's running, what needs a human, what it costs.
 * Phase 1 shows real recorded state only — no pretend real-time. Staff-only
 * (dashboard layout gate + RLS).
 */

export const dynamic = "force-dynamic";

export default async function AiOfficePage() {
  const supabase = await createClient();
  const since30d = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();
  const sinceToday = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

  const [
    { data: agentsRaw },
    { data: tasksRaw },
    { data: eventsRaw },
    { data: runsRaw },
  ] = await Promise.all([
    supabase.from("agents").select("*").order("name"),
    supabase.from("agent_tasks").select("*").order("created_at", { ascending: false }),
    supabase
      .from("agent_events")
      .select("id, agent_id, task_id, run_id, type, summary, actor, created_at")
      .order("created_at", { ascending: false })
      .limit(14),
    supabase
      .from("agent_runs")
      .select(
        "id, agent, agent_id, status, cost_usd, duration_ms, error, created_at, model, trigger, input_tokens, output_tokens, task_id"
      )
      .gte("created_at", since30d)
      .order("created_at", { ascending: false }),
  ]);

  const agents = (agentsRaw ?? []) as AgentRow[];
  const tasks = (tasksRaw ?? []) as AgentTaskRow[];
  const events = (eventsRaw ?? []) as AgentEventRow[];
  const runs = (runsRaw ?? []) as AgentRunRow[];
  const agentById = new Map(agents.map((a) => [a.id, a]));

  const byLifecycle = (l: AgentRow["lifecycle"]) =>
    agents.filter((a) => a.lifecycle === l).length;
  const openTasks = tasks.filter(
    (t) => !["complete", "failed", "cancelled"].includes(t.status)
  );
  const waitingHuman = tasks.filter(
    (t) => t.status === "waiting_approval" || t.status === "awaiting_start_approval"
  );
  const runsToday = runs.filter((r) => r.created_at >= sinceToday);
  const cost = (rows: AgentRunRow[]) =>
    rows.reduce((s, r) => s + (parseFloat(String(r.cost_usd ?? 0)) || 0), 0);
  const failures7d = runs.filter(
    (r) =>
      r.status === "error" &&
      r.created_at >= new Date(Date.now() - 7 * 24 * 3600_000).toISOString()
  );
  const staleActive = agents.filter((a) => staleness(a).stale);

  // Runtime/integration health — presence of configuration, honestly labelled.
  const health = [
    {
      name: "Anthropic API (internal calls)",
      ok: Boolean(process.env.ANTHROPIC_API_KEY),
      note: process.env.ANTHROPIC_API_KEY
        ? "Key configured"
        : "ANTHROPIC_API_KEY missing",
    },
    {
      name: "GitHub dispatch",
      ok: Boolean(process.env.GITHUB_DISPATCH_TOKEN),
      note: process.env.GITHUB_DISPATCH_TOKEN
        ? "Token configured"
        : "GITHUB_DISPATCH_TOKEN missing",
    },
    {
      name: "Managed Agents runtime",
      ok: Boolean(process.env.ANTHROPIC_API_KEY),
      note: "Status is checked per-session on the batch page — no heartbeat yet (Phase 4)",
    },
  ];

  return (
    <div>
      <PageHeader
        index="AI"
        label="AI Workspace"
        title="The office, at a glance"
        lead={
          <>
            {byLifecycle("active")} active · {byLifecycle("draft")} draft ·{" "}
            {waitingHuman.length} waiting on a human · {fmtUsd(cost(runsToday))} spent
            today. Agents recommend and draft — humans approve anything material.
          </>
        }
        actions={
          <div className="flex gap-2">
            <Link href="/admin/ai/map" className="kb kb-outline kb-sm">
              Office map
            </Link>
            <Link href="/admin/ai/tasks" className="kb kb-primary kb-sm">
              Delegate a task
            </Link>
          </div>
        }
        className="mb-8"
      />

      {/* Stat row */}
      <Reveal>
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}
        >
          <StatCard value={String(byLifecycle("active"))} label="Active agents" accent />
          <StatCard
            value={String(
              byLifecycle("draft") + byLifecycle("under_review") + byLifecycle("test")
            )}
            label="In preparation"
          />
          <StatCard value={String(openTasks.length)} label="Open tasks" />
          <StatCard value={String(waitingHuman.length)} label="Awaiting human" />
          <StatCard value={String(runsToday.length)} label="Runs today" />
          <StatCard value={fmtUsd(cost(runs))} label="Spend · 30 days" />
        </div>
      </Reveal>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        {/* Needs a human */}
        <Reveal className="block">
          <Panel label="// NEEDS A HUMAN" title="Escalations & waiting work">
            {waitingHuman.length === 0 &&
            staleActive.length === 0 &&
            failures7d.length === 0 ? (
              <p style={body}>
                Nothing is waiting on a human right now. New approval work will appear
                here.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {waitingHuman.map((t) => (
                  <Row
                    key={t.id}
                    href={`/admin/ai/tasks/${t.id}`}
                    chip={
                      <StatusChip tone={TASK_META[t.status].tone}>
                        {TASK_META[t.status].label}
                      </StatusChip>
                    }
                    main={t.objective}
                    sub={agentById.get(t.agent_id ?? "")?.name ?? "Unassigned"}
                  />
                ))}
                {staleActive.map((a) => (
                  <Row
                    key={a.id}
                    href={`/admin/ai/agents/${a.id}`}
                    chip={<StatusChip tone="warning">Stale</StatusChip>}
                    main={`${a.name} has not reported activity in over 24h`}
                    sub={staleness(a).label}
                  />
                ))}
                {failures7d.slice(0, 5).map((r) => (
                  <Row
                    key={r.id}
                    href={
                      r.agent_id ? `/admin/ai/agents/${r.agent_id}` : "/admin/ai/agents"
                    }
                    chip={<StatusChip tone="danger">Run failed</StatusChip>}
                    main={`${agentById.get(r.agent_id ?? "")?.name ?? r.agent}: ${r.error ?? "unknown error"}`}
                    sub={new Date(r.created_at).toLocaleString("en-GB")}
                  />
                ))}
              </div>
            )}
          </Panel>
        </Reveal>

        {/* Runtime health */}
        <Reveal className="block" delay={0.05}>
          <Panel label="// RUNTIME HEALTH" title="Integrations">
            <div className="flex flex-col gap-2">
              {health.map((h) => (
                <div
                  key={h.name}
                  className="flex items-center justify-between gap-3 py-2"
                  style={{ borderBottom: "1px solid var(--k-border)" }}
                >
                  <div>
                    <div style={{ ...body, color: "var(--k-fg)", fontWeight: 600 }}>
                      {h.name}
                    </div>
                    <div style={{ ...mono, color: "var(--k-faint)" }}>{h.note}</div>
                  </div>
                  <StatusChip tone={h.ok ? "success" : "danger"}>
                    {h.ok ? "Configured" : "Unavailable"}
                  </StatusChip>
                </div>
              ))}
              <p style={{ ...mono, color: "var(--k-faint)", marginTop: 6 }}>
                Health = configuration presence. Live heartbeats arrive with the runtime
                adapter (Phase 4).
              </p>
            </div>
          </Panel>
        </Reveal>
      </div>

      {/* Activity feed */}
      <Reveal className="block">
        <Panel
          label="// ACTIVITY"
          title="Recent office activity"
          className="mt-4"
          actions={
            <Link href="/admin/ai/agents" className="kb kb-outline kb-sm">
              Agent directory
            </Link>
          }
        >
          {events.length === 0 && runs.length === 0 ? (
            <p style={body}>No recorded activity yet.</p>
          ) : (
            <div className="flex flex-col">
              {events.map((e) => (
                <div
                  key={e.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 py-2"
                  style={{ borderBottom: "1px solid var(--k-border)" }}
                >
                  <span style={{ ...body, color: "var(--k-fg)" }}>{e.summary}</span>
                  <span style={{ ...mono, color: "var(--k-faint)" }}>
                    {e.actor ?? "system"} ·{" "}
                    {new Date(e.created_at).toLocaleString("en-GB")}
                  </span>
                </div>
              ))}
              {runs.slice(0, 8).map((r) => (
                <div
                  key={r.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 py-2"
                  style={{ borderBottom: "1px solid var(--k-border)" }}
                >
                  <span style={{ ...body, color: "var(--k-fg)" }}>
                    {agentById.get(r.agent_id ?? "")?.name ?? r.agent} run{" "}
                    {r.status === "ok" ? "completed" : r.status} · {fmtUsd(r.cost_usd)} ·{" "}
                    {r.duration_ms ? `${Math.round(r.duration_ms / 1000)}s` : "—"}
                  </span>
                  <span style={{ ...mono, color: "var(--k-faint)" }}>
                    {new Date(r.created_at).toLocaleString("en-GB")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </Reveal>

      {/* Lifecycle legend */}
      <Reveal className="block">
        <Panel label="// LEGEND" title="Agent lifecycle" className="mt-4">
          <div className="flex flex-wrap gap-2">
            {Object.entries(LIFECYCLE_META).map(([k, m]) => (
              <StatusChip key={k} tone={m.tone}>
                {m.label}
              </StatusChip>
            ))}
          </div>
          <p style={{ ...body, marginTop: 10 }}>
            Draft agents cannot see data, call tools or accept tasks. Activation requires
            review, scoped permissions and passing test evidence (Agent Studio — Phase 3).
          </p>
        </Panel>
      </Reveal>
    </div>
  );
}

function Row({
  href,
  chip,
  main,
  sub,
}: {
  href: string;
  chip: React.ReactNode;
  main: string;
  sub: string;
}) {
  return (
    <Link
      href={href}
      className="k-kard-h flex flex-wrap items-center justify-between gap-2 px-3 py-2"
      style={{ border: "1px solid var(--k-border)", textDecoration: "none" }}
    >
      <span className="flex items-center gap-2" style={{ minWidth: 0 }}>
        {chip}
        <span style={{ ...body, color: "var(--k-fg)" }}>{main}</span>
      </span>
      <span style={{ ...mono, color: "var(--k-faint)" }}>{sub}</span>
    </Link>
  );
}

const body: React.CSSProperties = {
  fontFamily: T.sans,
  fontSize: "0.88rem",
  lineHeight: 1.55,
  color: "var(--k-muted)",
};
const mono: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: "10.5px",
  letterSpacing: "0.05em",
};
