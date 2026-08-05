import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { createClient } from "@nullshift/db";
import { requireStaff } from "@nullshift/auth/guards";
import { logAudit } from "@nullshift/db/audit";
import { T } from "@nullshift/ui/tokens";
import { PageHeader, Panel, StatusChip } from "@/components/app/AppKit";
import { Reveal } from "@/components/kyma";
import { compileBatchPrompt, type SystemProfileRow } from "@/lib/ops/batchCompiler";
import {
  QUEUEABLE_STATUSES,
  type IssueRow,
  type IssueSeverity,
} from "@/lib/ops/issues";

/**
 * Fix batches — compile a project's queueable issues into one context-complete
 * Claude Code work order (a fix_batches row), then track it from compiled
 * through dispatched / PR open / shipped on the detail page.
 */

export const dynamic = "force-dynamic";

type Tenant = { id: string; name: string };
type Project = { id: string; tenant_id: string; name: string; live_url: string | null };
type BatchRow = {
  id: string;
  tenant_id: string;
  project_id: string | null;
  title: string;
  status: "draft" | "compiled" | "dispatched" | "pr_open" | "shipped" | "cancelled";
  created_at: string;
};

type Tone = "accent" | "success" | "warning" | "danger" | "muted";
const BATCH_TONE: Record<BatchRow["status"], Tone> = {
  draft: "muted",
  compiled: "accent",
  dispatched: "warning",
  pr_open: "warning",
  shipped: "success",
  cancelled: "muted",
};

const SEVERITY_RANK: Record<IssueSeverity, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

const GRID = "1.6fr 1fr 130px 80px 110px";

// ── server actions ─────────────────────────────────────────────

async function compileBatch(formData: FormData) {
  "use server";
  if (!(await requireStaff()).ok) return;
  const projectId = String(formData.get("project_id") || "");
  const title = String(formData.get("title") || "").trim();
  if (!projectId || !title) return;
  const supabase = await createClient();

  const { data: issueRows } = await supabase
    .from("issues")
    .select("*")
    .eq("project_id", projectId)
    .in("status", QUEUEABLE_STATUSES);
  const issues = ((issueRows ?? []) as IssueRow[]).sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      a.created_at.localeCompare(b.created_at)
  );
  if (issues.length === 0) return;

  const [{ data: project }, { data: profileRow }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, tenant_id, name, live_url")
      .eq("id", projectId)
      .single(),
    supabase
      .from("system_profiles")
      .select(
        "project_id, repo_full_name, default_branch, vercel_project, supabase_ref, stack, runbook, quirks"
      )
      .eq("project_id", projectId)
      .maybeSingle(),
  ]);
  if (!project) return;
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name")
    .eq("id", project.tenant_id)
    .single();

  const prompt = compileBatchPrompt({
    tenantName: tenant?.name ?? "the client",
    projectName: project.name,
    liveUrl: project.live_url ?? null,
    profile: (profileRow as SystemProfileRow | null) ?? null,
    issues,
    batchTitle: title,
  });

  const { data: batch, error } = await supabase
    .from("fix_batches")
    .insert({
      tenant_id: project.tenant_id,
      project_id: projectId,
      title,
      status: "compiled",
      prompt,
    })
    .select("id")
    .single();
  if (error || !batch) return;

  await supabase
    .from("issues")
    .update({ batch_id: batch.id, status: "batched" })
    .in(
      "id",
      issues.map((i) => i.id)
    );

  await logAudit({
    action: "batch.compiled",
    target: `batch:${batch.id}`,
    tenantId: project.tenant_id,
    metadata: { title, issues: issues.length },
  });
  revalidatePath("/admin/batches");
  revalidatePath("/admin/issues");
  redirect(`/admin/batches/${batch.id}`);
}

// ── page ───────────────────────────────────────────────────────

export default async function BatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const { project: preselect } = await searchParams;
  const supabase = await createClient();
  const [{ data: batchRows }, { data: tenantRows }, { data: projectRows }, { data: batchedIssues }] =
    await Promise.all([
      supabase
        .from("fix_batches")
        .select("id, tenant_id, project_id, title, status, created_at")
        .order("created_at", { ascending: false }),
      supabase.from("tenants").select("id, name").order("name"),
      supabase
        .from("projects")
        .select("id, tenant_id, name, live_url")
        .order("created_at"),
      supabase.from("issues").select("id, batch_id").not("batch_id", "is", null),
    ]);
  const batches = (batchRows ?? []) as BatchRow[];
  const tenants = (tenantRows ?? []) as Tenant[];
  const projects = (projectRows ?? []) as Project[];
  const counts = new Map<string, number>();
  for (const row of (batchedIssues ?? []) as { id: string; batch_id: string }[]) {
    counts.set(row.batch_id, (counts.get(row.batch_id) ?? 0) + 1);
  }
  const tenantName = (id: string) => tenants.find((t) => t.id === id)?.name ?? "—";
  const projectOptions = projects
    .map((p) => ({ id: p.id, label: `${tenantName(p.tenant_id)} — ${p.name}` }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const defaultTitle = `Fix batch — ${new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}`;

  return (
    <div>
      <PageHeader
        index="10"
        label="Ops"
        title="Fix batches"
        lead="Queued issues compiled into one Claude Code work order per system — one batch, one PR, one shipped update."
      />

      {/* ── Compile ─────────────────────────────────────────── */}
      <Reveal className="block" delay={0.05}>
        <Panel label="// COMPILE BATCH" className="mt-7">
          <form action={compileBatch} className="flex items-center gap-2 flex-wrap">
            <select
              name="project_id"
              required
              defaultValue={
                preselect && projects.some((p) => p.id === preselect) ? preselect : ""
              }
              style={inp}
            >
              <option value="" disabled>
                Client — project…
              </option>
              {projectOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <input
              name="title"
              required
              defaultValue={defaultTitle}
              style={{ ...inp, width: 260 }}
            />
            <SubmitButton style={btn("var(--k-accent)", "var(--k-on-accent)")}>
              Compile
            </SubmitButton>
            <span
              style={{ fontFamily: T.sans, fontSize: "0.82rem", color: "var(--k-faint)" }}
            >
              Pulls every new / triaged / queued issue on the project, worst first.
            </span>
          </form>
        </Panel>
      </Reveal>

      {/* ── All batches ─────────────────────────────────────── */}
      <div className="mt-6" style={{ border: "1px solid var(--k-border)" }}>
        <div
          className="grid gap-3 items-center px-4 py-2.5"
          style={{
            gridTemplateColumns: GRID,
            background: "var(--k-surface)",
            borderBottom: batches.length ? "1px solid var(--k-border)" : "none",
            fontFamily: T.mono,
            fontSize: "10px",
            fontWeight: 500,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--k-faint)",
          }}
        >
          <span>Title</span>
          <span>Client</span>
          <span>Status</span>
          <span>Issues</span>
          <span>Created</span>
        </div>
        {batches.length === 0 && (
          <p
            className="text-center py-7"
            style={{ fontFamily: T.sans, fontSize: "0.85rem", color: "var(--k-muted)" }}
          >
            No batches yet — compile one above once issues are queued.
          </p>
        )}
        {batches.map((b, i) => (
          <Reveal key={b.id} delay={Math.min(i, 8) * 0.04}>
            <Link
              href={`/admin/batches/${b.id}`}
              className="grid gap-3 items-center px-4 py-3 hover:bg-[var(--k-surface)] transition-colors"
              style={{
                gridTemplateColumns: GRID,
                borderTop: i ? "1px solid var(--k-border)" : "none",
              }}
            >
              <span
                className="truncate"
                style={{
                  fontFamily: T.sans,
                  fontWeight: 600,
                  fontSize: "0.88rem",
                  color: "var(--k-fg)",
                }}
              >
                {b.title}
              </span>
              <span
                className="truncate"
                style={{ fontFamily: T.sans, fontSize: "0.85rem", color: "var(--k-muted)" }}
              >
                {tenantName(b.tenant_id)}
              </span>
              <span>
                <StatusChip tone={BATCH_TONE[b.status]}>
                  {b.status.replace(/_/g, " ")}
                </StatusChip>
              </span>
              <span style={{ fontFamily: T.mono, fontSize: "11px", color: "var(--k-muted)" }}>
                {counts.get(b.id) ?? 0}
              </span>
              <span style={{ fontFamily: T.mono, fontSize: "10px", color: "var(--k-faint)" }}>
                {new Date(b.created_at).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            </Link>
          </Reveal>
        ))}
      </div>
    </div>
  );
}

const inp = {
  fontFamily: T.sans,
  fontSize: "0.85rem",
  height: 36,
  padding: "0 11px",
  background: "var(--k-surface)",
  color: "var(--k-fg)",
  border: "1px solid var(--k-border)",
  borderRadius: 0,
} as const;
const btn = (bg: string, fg: string, outline = false) => ({
  fontFamily: T.mono,
  fontSize: "11px",
  fontWeight: 500,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  height: 36,
  paddingInline: 14,
  background: bg,
  color: fg,
  border: outline ? "1px solid var(--k-border)" : "1px solid transparent",
  borderRadius: 0,
  cursor: "pointer",
});
