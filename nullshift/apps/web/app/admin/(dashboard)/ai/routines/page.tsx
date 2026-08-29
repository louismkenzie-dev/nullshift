import Link from "next/link";
import { revalidatePath } from "next/cache";
import { createClient } from "@nullshift/db";
import { logAudit } from "@nullshift/db/audit";
import { requireStaff } from "@nullshift/auth/guards";
import { T } from "@nullshift/ui/tokens";
import { PageHeader, Panel, StatusChip } from "@/components/app/AppKit";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Reveal } from "@/components/kyma";
import { LIFECYCLE_META, type AgentRow } from "@/lib/aiw";

/** Routines (Phase 4/5) — schedule- and event-driven work, admin-controlled.
 *  A routine fires only when (1) an admin has enabled it here AND (2) its
 *  target agent is active. Firings are idempotent (unique fire keys): repeated
 *  ticks or event deliveries can never duplicate tasks, drafts or reminders. */

export const dynamic = "force-dynamic";

type RoutineRow = {
  key: string;
  name: string;
  purpose: string;
  agent_key: string;
  cadence: string;
  enabled: boolean;
  risk_limit: number;
  budget_usd_daily: number;
  last_fired_at: string | null;
};

type RoutineRun = {
  id: string;
  routine_key: string;
  fire_key: string;
  outcome: string;
  detail: string | null;
  created_at: string;
};

const CADENCE_LABEL: Record<string, string> = {
  workdays: "Each workday (07:00 UTC tick)",
  daily: "Daily (07:00 UTC tick)",
  weekly_mon: "Mondays",
  event: "Event-driven",
};

async function toggleRoutine(formData: FormData) {
  "use server";
  const staff = await requireStaff();
  if (!staff.ok) return;
  const key = String(formData.get("key") || "");
  const enable = String(formData.get("enable") || "") === "1";
  if (!key) return;
  const supabase = await createClient();
  await supabase.from("agent_routines").update({ enabled: enable }).eq("key", key);
  await supabase.from("agent_events").insert({
    type: enable ? "routine.enabled" : "routine.disabled",
    summary: `Routine ${key} ${enable ? "enabled" : "disabled"} by ${staff.email}`,
    actor: staff.email,
  });
  await logAudit({
    action: `agent_routine.${enable ? "enabled" : "disabled"}`,
    target: `agent_routine:${key}`,
  });
  revalidatePath("/admin/ai/routines");
}

export default async function RoutinesPage() {
  const supabase = await createClient();
  const [{ data: routinesRaw }, { data: agentsRaw }, { data: runsRaw }] =
    await Promise.all([
      supabase.from("agent_routines").select("*").order("key"),
      supabase.from("agents").select("id, key, name, lifecycle"),
      supabase
        .from("agent_routine_runs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
  const routines = (routinesRaw ?? []) as RoutineRow[];
  const agents = new Map(
    ((agentsRaw ?? []) as Pick<AgentRow, "id" | "key" | "name" | "lifecycle">[]).map(
      (a) => [a.key, a]
    )
  );
  const runs = (runsRaw ?? []) as RoutineRun[];

  return (
    <div>
      <PageHeader
        index="AI"
        label="Routines"
        title="Scheduled & event-driven work"
        lead="A routine runs only when you enable it AND its agent is active. Every firing is idempotent — the same day/event can never fire twice."
        className="mb-8"
      />

      <div className="flex flex-col gap-3">
        {routines.map((r, i) => {
          const agent = agents.get(r.agent_key);
          const agentActive = agent && ["active", "test"].includes(agent.lifecycle);
          return (
            <Reveal key={r.key} className="block" delay={i * 0.03}>
              <Panel
                label={`// ${CADENCE_LABEL[r.cadence] ?? r.cadence}`}
                title={r.name}
                actions={
                  <form action={toggleRoutine}>
                    <input type="hidden" name="key" value={r.key} />
                    <input type="hidden" name="enable" value={r.enabled ? "0" : "1"} />
                    <SubmitButton
                      className={`kb kb-sm ${r.enabled ? "kb-outline" : "kb-primary"}`}
                      pendingLabel="Saving…"
                    >
                      {r.enabled ? "Disable" : "Enable"}
                    </SubmitButton>
                  </form>
                }
              >
                <p style={body}>{r.purpose}</p>
                <div
                  className="mt-3 flex flex-wrap items-center gap-2"
                  style={{
                    fontFamily: T.mono,
                    fontSize: "10px",
                    color: "var(--k-faint)",
                  }}
                >
                  <StatusChip tone={r.enabled ? "success" : "muted"}>
                    {r.enabled ? "Enabled" : "Disabled"}
                  </StatusChip>
                  {agent ? (
                    <Link
                      href={`/admin/ai/agents/${agent.id}`}
                      style={{ textDecoration: "none" }}
                    >
                      <StatusChip tone={agentActive ? "success" : "warning"}>
                        {agent.name}: {LIFECYCLE_META[agent.lifecycle].label}
                      </StatusChip>
                    </Link>
                  ) : (
                    <StatusChip tone="danger">Agent missing</StatusChip>
                  )}
                  {r.enabled && !agentActive && (
                    <span style={{ color: T.warning }}>
                      Will be skipped until the agent is activated
                    </span>
                  )}
                  <span>Risk limit T{r.risk_limit}</span>
                  <span>Budget ${Number(r.budget_usd_daily).toFixed(2)}/day</span>
                  <span>
                    Last fired:{" "}
                    {r.last_fired_at
                      ? new Date(r.last_fired_at).toLocaleString("en-GB")
                      : "never"}
                  </span>
                </div>
              </Panel>
            </Reveal>
          );
        })}

        <Reveal className="block">
          <Panel label="// FIRINGS" title="Recent firings (idempotency record)">
            {runs.length === 0 ? (
              <p style={body}>
                No firings yet — enable a routine and activate its agent.
              </p>
            ) : (
              <div className="flex flex-col">
                {runs.map((run) => (
                  <div
                    key={run.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 py-2"
                    style={{ borderBottom: "1px solid var(--k-border)" }}
                  >
                    <span style={{ ...body, color: "var(--k-fg)" }}>
                      <StatusChip
                        tone={
                          run.outcome === "fired"
                            ? "success"
                            : run.outcome.startsWith("skipped")
                              ? "warning"
                              : "danger"
                        }
                      >
                        {run.outcome}
                      </StatusChip>{" "}
                      {run.fire_key}
                      {run.detail ? ` — ${run.detail}` : ""}
                    </span>
                    <span
                      style={{
                        fontFamily: T.mono,
                        fontSize: "10px",
                        color: "var(--k-faint)",
                      }}
                    >
                      {new Date(run.created_at).toLocaleString("en-GB")}
                    </span>
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

const body: React.CSSProperties = {
  fontFamily: T.sans,
  fontSize: "0.88rem",
  lineHeight: 1.55,
  color: "var(--k-muted)",
};
