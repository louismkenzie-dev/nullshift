import Link from "next/link";
import { createClient } from "@nullshift/db";
import { T } from "@nullshift/ui/tokens";
import { PageHeader, StatusChip } from "@/components/app/AppKit";
import { Reveal } from "@/components/kyma";
import { carePlan } from "@/lib/carePlans";
import { OPEN_STATUSES } from "@/lib/ops/issues";

/**
 * Systems — the fleet. One row per client project: stage, care plan, open
 * issues, passport health and repo, click through to the system passport
 * (/admin/systems/[id]). A handful of bulk queries joined in memory — no N+1.
 */
export const dynamic = "force-dynamic";

// Stage → emerald is the only brand colour; everything else reads as muted/signal.
const STAGE_TONE: Record<string, string> = {
  discovery: "var(--k-muted)",
  onboarding: "var(--k-accent)",
  build: "var(--k-accent)",
  review: T.warning,
  launch_prep: T.warning,
  live: T.success,
  care: T.success,
  complete: "var(--k-muted)",
};

const HEALTH_TONE: Record<string, "accent" | "success" | "warning" | "danger" | "muted"> =
  {
    ok: "success",
    warning: "warning",
    down: "danger",
    unknown: "muted",
  };

const mono: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: 10,
  fontWeight: 500,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
};

type Tenant = { id: string; name: string; status: string; contact_name: string | null };
type Project = { id: string; tenant_id: string; name: string; stage: string };
type Profile = { project_id: string; repo_full_name: string | null; health: string };
type Sub = { tenant_id: string; plan: string | null; status: string };

const GRID = "1.7fr 110px 130px 80px 110px 1fr";

export default async function SystemsPage() {
  const supabase = await createClient();
  const { data: tenantsRaw } = await supabase
    .from("tenants")
    .select("id, name, status, contact_name")
    .eq("type", "client");
  // The platform itself is a system too — Null Shift Ops lives under the
  // internal tenant and gets the same cockpit as every client system.
  const { data: internalRaw } = await supabase
    .from("tenants")
    .select("id, name")
    .eq("type", "internal");
  const internalIds = ((internalRaw ?? []) as { id: string; name: string }[]).map((t) => t.id);
  const { data: internalProjectsRaw } = internalIds.length
    ? await supabase
        .from("projects")
        .select("id, tenant_id, name, stage")
        .in("tenant_id", internalIds)
        .order("created_at", { ascending: false })
    : { data: [] };
  const internalProjects = (internalProjectsRaw ?? []) as Project[];
  const allTenants = (tenantsRaw ?? []) as Tenant[];
  // Prospects sit apart from the active fleet: real relationships, not yet
  // paying — parked below, one click from onboarding.
  const prospects = allTenants.filter((t) => t.status === "prospect");
  const tenants = allTenants.filter((t) => t.status !== "prospect");
  const tenantIds = tenants.map((t) => t.id);

  const { data: projectsRaw } = tenantIds.length
    ? await supabase
        .from("projects")
        .select("id, tenant_id, name, stage")
        .in("tenant_id", tenantIds)
        .order("created_at", { ascending: false })
    : { data: [] };
  const projects = (projectsRaw ?? []) as Project[];
  const projectIds = [...projects, ...internalProjects].map((p) => p.id);

  const [{ data: profilesRaw }, { data: issuesRaw }, { data: subsRaw }] =
    projectIds.length
      ? await Promise.all([
          supabase
            .from("system_profiles")
            .select("project_id, repo_full_name, health")
            .in("project_id", projectIds),
          supabase
            .from("issues")
            .select("project_id, severity, status, due_at")
            .in("status", OPEN_STATUSES)
            .in("project_id", projectIds),
          supabase
            .from("subscriptions")
            .select("tenant_id, plan, status")
            .in("status", ["active", "trialing", "past_due"])
            .in("tenant_id", tenantIds),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }];

  // Fold the per-system signals into maps.
  const tenantName = new Map(tenants.map((t) => [t.id, t.name]));
  const profileByProject = new Map(
    ((profilesRaw ?? []) as Profile[]).map((p) => [p.project_id, p])
  );
  type OpenIssue = {
    project_id: string | null;
    severity: string;
    status: string;
    due_at: string | null;
  };
  const openIssues = (issuesRaw ?? []) as OpenIssue[];
  const openByProject = new Map<string, number>();
  const issuesByProject = new Map<string, OpenIssue[]>();
  for (const i of openIssues) {
    if (!i.project_id) continue;
    openByProject.set(i.project_id, (openByProject.get(i.project_id) ?? 0) + 1);
    const list = issuesByProject.get(i.project_id) ?? [];
    list.push(i);
    issuesByProject.set(i.project_id, list);
  }
  const planByTenant = new Map<string, string | null>();
  const pastDueTenants = new Set<string>();
  for (const s of (subsRaw ?? []) as Sub[]) {
    if (s.status === "past_due") pastDueTenants.add(s.tenant_id);
    else planByTenant.set(s.tenant_id, s.plan);
  }

  // Computed, explainable delivery health (audit Phase 1.4): derived from
  // recorded signals, never hand-set, and always carrying its evidence. The
  // manual system_profiles.health stays what it is — uptime — on the passport.
  const nowMs = Date.now();
  const deliveryHealth = (
    projectId: string,
    tenantId: string
  ): { key: "on_track" | "watch" | "at_risk" | "blocked"; evidence: string } => {
    const list = issuesByProject.get(projectId) ?? [];
    const critHigh = list.filter(
      (i) => i.severity === "critical" || i.severity === "high"
    ).length;
    const overdue = list.filter(
      (i) => !!i.due_at && new Date(i.due_at).getTime() < nowMs
    ).length;
    const waiting = list.filter((i) => i.status === "awaiting_client").length;
    const pastDue = pastDueTenants.has(tenantId);
    const evidence: string[] = [];
    if (critHigh)
      evidence.push(`${critHigh} critical/high issue${critHigh === 1 ? "" : "s"}`);
    if (overdue) evidence.push(`${overdue} overdue issue${overdue === 1 ? "" : "s"}`);
    if (pastDue) evidence.push("payment past due");
    if (waiting) evidence.push(`${waiting} waiting on client`);
    if (critHigh || overdue || pastDue)
      return { key: "at_risk", evidence: evidence.join(" · ") };
    if (waiting > 0 && waiting === list.length)
      return { key: "blocked", evidence: evidence.join(" · ") };
    if (list.length > 3) return { key: "watch", evidence: `${list.length} open issues` };
    return { key: "on_track", evidence: evidence.join(" · ") || "no risk signals" };
  };
  const DELIVERY_TONE = {
    on_track: "success",
    watch: "warning",
    at_risk: "danger",
    blocked: "warning",
  } as const;
  const DELIVERY_LABEL = {
    on_track: "on track",
    watch: "watch",
    at_risk: "at risk",
    blocked: "blocked",
  } as const;

  return (
    <div>
      <PageHeader
        index="02"
        label="Systems"
        title="Systems"
        lead="The fleet — every client system with its stage, plan, health and open issues. Click one to open its passport."
        actions={
          <span style={{ ...mono, fontSize: 12, color: "var(--k-muted)" }}>
            {projects.length} system{projects.length === 1 ? "" : "s"}
          </span>
        }
      />

      {internalProjects.length > 0 && (
        <div style={{ border: "1px solid var(--k-border)", marginTop: 24 }}>
          <div
            className="px-5 py-2.5"
            style={{ background: "var(--k-surface)", borderBottom: "1px solid var(--k-border)" }}
          >
            <span style={{ ...mono, color: "var(--k-muted)" }}>{"// THE PLATFORM"}</span>
          </div>
          {internalProjects.map((p, i) => {
            const profile = profileByProject.get(p.id);
            const open = openByProject.get(p.id) ?? 0;
            return (
              <Reveal key={p.id} delay={i * 0.04}>
                <Link
                  href={`/admin/systems/${p.id}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-3.5 hover:bg-[var(--k-surface)] transition-colors"
                  style={{ borderTop: i ? "1px solid var(--k-border)" : "none" }}
                >
                  <span style={{ fontFamily: T.sans, fontWeight: 600, fontSize: "0.95rem", color: "var(--k-fg)" }}>
                    {p.name}
                  </span>
                  <StatusChip tone="accent">internal</StatusChip>
                  <span style={{ ...mono, color: "var(--k-muted)" }}>{p.stage}</span>
                  {open > 0 && (
                    <span style={{ ...mono, color: T.warning }}>
                      {open} open issue{open === 1 ? "" : "s"}
                    </span>
                  )}
                  <span className="ml-auto" style={{ ...mono, fontSize: 11, color: "var(--k-faint)" }}>
                    {profile?.repo_full_name ?? "no repo"} · cockpit →
                  </span>
                </Link>
              </Reveal>
            );
          })}
        </div>
      )}

      {projects.length === 0 ? (
        <p
          style={{
            fontFamily: T.sans,
            fontSize: "0.9rem",
            color: "var(--k-faint)",
            marginTop: 24,
          }}
        >
          No client systems yet — they appear here once a client has a project.
        </p>
      ) : (
        <div
          className="overflow-hidden"
          style={{ border: "1px solid var(--k-border)", marginTop: 24 }}
        >
          {/* Mono uppercase column headers — desktop only; rows stack as cards on mobile */}
          <div
            className="max-md:hidden grid items-center gap-4 px-5 py-3"
            style={{
              gridTemplateColumns: GRID,
              background: "var(--k-surface)",
              borderBottom: "1px solid var(--k-border)",
            }}
          >
            <span style={{ ...mono, color: "var(--k-muted)" }}>System</span>
            <span style={{ ...mono, color: "var(--k-muted)" }}>Stage</span>
            <span style={{ ...mono, color: "var(--k-muted)" }}>Plan</span>
            <span style={{ ...mono, color: "var(--k-muted)" }}>Issues</span>
            <span style={{ ...mono, color: "var(--k-muted)" }}>Health</span>
            <span style={{ ...mono, color: "var(--k-muted)" }}>Repo</span>
          </div>
          {projects.map((p, i) => {
            const profile = profileByProject.get(p.id);
            const plan = carePlan(planByTenant.get(p.tenant_id));
            const open = openByProject.get(p.id) ?? 0;
            const uptime = profile?.health ?? "unknown";
            const dh = deliveryHealth(p.id, p.tenant_id);
            const repoShort = profile?.repo_full_name?.split("/").pop() ?? null;
            return (
              <Reveal key={p.id} delay={Math.min(i, 8) * 0.04}>
                <Link
                  href={`/admin/systems/${p.id}`}
                  className="max-md:flex max-md:flex-col max-md:gap-1.5 md:grid md:items-center gap-4 px-5 py-3.5 hover:bg-[var(--k-surface)]"
                  style={{
                    gridTemplateColumns: GRID,
                    borderTop: i ? "1px solid var(--k-border)" : "none",
                    textDecoration: "none",
                    transition: "background-color 0.15s ease",
                  }}
                >
                  <span className="min-w-0" style={{ minWidth: 0 }}>
                    <span
                      style={{
                        fontFamily: T.sans,
                        fontWeight: 600,
                        fontSize: "0.95rem",
                        color: "var(--k-fg)",
                        display: "block",
                      }}
                    >
                      {p.name}
                    </span>
                    {/* Tenant subtitle repeats the card title on phones — desktop only */}
                    <span
                      className="max-md:hidden"
                      style={{ ...mono, color: "var(--k-faint)" }}
                    >
                      {tenantName.get(p.tenant_id) ?? "—"}
                    </span>
                  </span>
                  {/* Signals — one wrapping line on mobile, grid cells at md+ */}
                  <div className="max-md:flex max-md:flex-wrap max-md:items-center max-md:gap-2 md:contents">
                    <span
                      className="inline-flex items-center gap-1.5"
                      style={{ ...mono, color: STAGE_TONE[p.stage] ?? "var(--k-muted)" }}
                    >
                      <span
                        className="k-livedot"
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 999,
                          background: STAGE_TONE[p.stage] ?? "var(--k-muted)",
                          display: "inline-block",
                        }}
                      />
                      {p.stage}
                    </span>
                    <span>
                      <StatusChip tone={plan ? "accent" : "muted"}>
                        {plan?.label ?? "No plan"}
                      </StatusChip>
                    </span>
                    <span
                      className={open === 0 ? "max-md:hidden" : undefined}
                      style={{
                        ...mono,
                        fontSize: 12,
                        color: open > 0 ? T.warning : "var(--k-faint)",
                      }}
                    >
                      {open > 0 ? open : "—"}
                      <span className="md:hidden">
                        &nbsp;issue{open === 1 ? "" : "s"}
                      </span>
                    </span>
                    <span
                      className="inline-flex items-center gap-1.5"
                      title={dh.evidence}
                    >
                      <StatusChip tone={DELIVERY_TONE[dh.key]}>
                        {DELIVERY_LABEL[dh.key]}
                      </StatusChip>
                      {/* Uptime chip only when it's actually signalling */}
                      {(uptime === "down" || uptime === "warning") && (
                        <StatusChip tone={HEALTH_TONE[uptime] ?? "muted"}>
                          {uptime}
                        </StatusChip>
                      )}
                    </span>
                  </div>
                  <span
                    className="min-w-0 md:truncate max-md:break-all"
                    style={{
                      fontFamily: T.mono,
                      fontSize: 11,
                      letterSpacing: "0.02em",
                      color: repoShort ? "var(--k-muted)" : "var(--k-faint)",
                    }}
                  >
                    {repoShort ?? "no repo"}
                  </span>
                </Link>
              </Reveal>
            );
          })}
        </div>
      )}

      {/* ── Prospective clients — parked, ready to onboard ───── */}
      {prospects.length > 0 && (
        <Reveal className="block" delay={0.1}>
          <div
            className="overflow-hidden"
            style={{ border: "1px dashed var(--k-border)", marginTop: 28 }}
          >
            <div
              className="flex items-center justify-between gap-3 px-5 py-3"
              style={{
                background: "var(--k-surface)",
                borderBottom: "1px solid var(--k-border)",
              }}
            >
              <span style={{ ...mono, color: "var(--k-muted)" }}>
                {"// PROSPECTIVE CLIENTS"}
              </span>
              <span style={{ ...mono, color: "var(--k-faint)" }}>
                not active — onboard when ready
              </span>
            </div>
            {prospects.map((t, i) => (
              <Link
                key={t.id}
                href={`/admin/clients/${t.id}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-3.5 hover:bg-[var(--k-surface)]"
                style={{
                  borderTop: i ? "1px solid var(--k-border)" : "none",
                  textDecoration: "none",
                  transition: "background-color 0.15s ease",
                }}
              >
                <span
                  className="min-w-0"
                  style={{
                    fontFamily: T.sans,
                    fontWeight: 600,
                    fontSize: "0.95rem",
                    color: "var(--k-fg)",
                  }}
                >
                  {t.name}
                </span>
                {t.contact_name && (
                  <span style={{ ...mono, color: "var(--k-faint)" }}>
                    {t.contact_name}
                  </span>
                )}
                <span className="ml-auto inline-flex items-center gap-2">
                  <StatusChip tone="muted">prospect</StatusChip>
                  <span style={{ ...mono, fontSize: 11, color: "var(--k-accent)" }}>
                    Onboard <span className="k-arrow">→</span>
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </Reveal>
      )}
    </div>
  );
}
