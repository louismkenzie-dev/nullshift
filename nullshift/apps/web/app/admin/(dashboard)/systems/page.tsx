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
  build: "var(--k-accent)",
  review: T.warning,
  live: T.success,
  care: T.success,
};

const HEALTH_TONE: Record<string, "accent" | "success" | "warning" | "danger" | "muted"> = {
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

type Tenant = { id: string; name: string };
type Project = { id: string; tenant_id: string; name: string; stage: string };
type Profile = { project_id: string; repo_full_name: string | null; health: string };
type Sub = { tenant_id: string; plan: string | null };

const GRID = "1.7fr 110px 130px 80px 110px 1fr";

export default async function SystemsPage() {
  const supabase = await createClient();
  const { data: tenantsRaw } = await supabase
    .from("tenants")
    .select("id, name")
    .eq("type", "client");
  const tenants = (tenantsRaw ?? []) as Tenant[];
  const tenantIds = tenants.map((t) => t.id);

  const { data: projectsRaw } = tenantIds.length
    ? await supabase
        .from("projects")
        .select("id, tenant_id, name, stage")
        .in("tenant_id", tenantIds)
        .order("created_at", { ascending: false })
    : { data: [] };
  const projects = (projectsRaw ?? []) as Project[];
  const projectIds = projects.map((p) => p.id);

  const [{ data: profilesRaw }, { data: issuesRaw }, { data: subsRaw }] = projectIds.length
    ? await Promise.all([
        supabase
          .from("system_profiles")
          .select("project_id, repo_full_name, health")
          .in("project_id", projectIds),
        supabase
          .from("issues")
          .select("project_id")
          .in("status", OPEN_STATUSES)
          .in("project_id", projectIds),
        supabase
          .from("subscriptions")
          .select("tenant_id, plan")
          .in("status", ["active", "trialing"])
          .in("tenant_id", tenantIds),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  // Fold the per-system signals into maps.
  const tenantName = new Map(tenants.map((t) => [t.id, t.name]));
  const profileByProject = new Map(
    ((profilesRaw ?? []) as Profile[]).map((p) => [p.project_id, p])
  );
  const openByProject = new Map<string, number>();
  for (const i of (issuesRaw ?? []) as { project_id: string | null }[]) {
    if (i.project_id)
      openByProject.set(i.project_id, (openByProject.get(i.project_id) ?? 0) + 1);
  }
  const planByTenant = new Map<string, string | null>();
  for (const s of (subsRaw ?? []) as Sub[]) planByTenant.set(s.tenant_id, s.plan);

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
            const health = profile?.health ?? "unknown";
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
                    <span className="max-md:hidden" style={{ ...mono, color: "var(--k-faint)" }}>
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
                      <span className="md:hidden">&nbsp;issue{open === 1 ? "" : "s"}</span>
                    </span>
                    <span>
                      <StatusChip tone={HEALTH_TONE[health] ?? "muted"}>{health}</StatusChip>
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
    </div>
  );
}
