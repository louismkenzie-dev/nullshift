import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { createClient } from "@nullshift/db";
import { requireStaff } from "@nullshift/auth/guards";
import { logAudit } from "@nullshift/db/audit";
import { T } from "@nullshift/ui/tokens";
import { PageHeader, Panel, StatusChip } from "@/components/app/AppKit";
import { Reveal } from "@/components/kyma";
import { CopyButton } from "@/components/app/CopyButton";
import { createGithubFixIssue } from "@/lib/ops/githubDispatch";
import { fireRoutine } from "@/lib/ops/routineDispatch";
import {
  dispatchBatchToManagedAgent,
  getManagedSessionStatus,
  hasManagedAgentConfig,
} from "@/lib/ops/managedAgents";
import { currentPeriodStart } from "@/lib/carePlans";
import type { SystemProfileRow } from "@/lib/ops/batchCompiler";
import { SEVERITY_META, STATUS_TONE, type IssueRow } from "@/lib/ops/issues";

/**
 * Fix batch detail — the compiled Claude Code work order plus its lifecycle:
 * dispatch to GitHub (claude-code-action picks it up), record the PR, mark
 * shipped (closes issues, posts client updates, burns build credits) or
 * cancel (issues return to the queue).
 */

export const dynamic = "force-dynamic";

type BatchStatus = "draft" | "compiled" | "dispatched" | "pr_open" | "shipped" | "cancelled";
type BatchRow = {
  id: string;
  tenant_id: string;
  project_id: string | null;
  title: string;
  status: BatchStatus;
  prompt: string | null;
  github_issue_url: string | null;
  pr_url: string | null;
  dispatched_at: string | null;
  shipped_at: string | null;
  notes: string | null;
  created_at: string;
  routine_session_url: string | null;
  routine_fired_at: string | null;
  ma_session_id: string | null;
  ma_session_url: string | null;
};

type ProfileWithDispatch = SystemProfileRow & {
  routine_fire_url: string | null;
  routine_token: string | null;
};

type Tone = "accent" | "success" | "warning" | "danger" | "muted";
const BATCH_TONE: Record<BatchStatus, Tone> = {
  draft: "muted",
  compiled: "accent",
  dispatched: "warning",
  pr_open: "warning",
  shipped: "success",
  cancelled: "muted",
};

// ── server actions ─────────────────────────────────────────────

async function dispatchBatch(formData: FormData) {
  "use server";
  if (!(await requireStaff()).ok) return;
  const id = String(formData.get("id") || "");
  if (!id) return;
  const supabase = await createClient();
  const { data: batchRow } = await supabase.from("fix_batches").select("*").eq("id", id).single();
  if (!batchRow) return;
  const batch = batchRow as BatchRow;
  if (batch.status !== "compiled" || !batch.prompt || !batch.project_id) return;
  const { data: profile } = await supabase
    .from("system_profiles")
    .select("repo_full_name")
    .eq("project_id", batch.project_id)
    .maybeSingle();
  const repoFullName = (profile?.repo_full_name as string | null) ?? null;
  if (!repoFullName) return;

  const result = await createGithubFixIssue({
    repoFullName,
    title: `Fix batch: ${batch.title}`,
    body: batch.prompt,
  });
  if (result) {
    await supabase
      .from("fix_batches")
      .update({
        github_issue_url: result.url,
        status: "dispatched",
        dispatched_at: new Date().toISOString(),
      })
      .eq("id", id);
    await logAudit({
      action: "batch.dispatched",
      target: `batch:${id}`,
      tenantId: batch.tenant_id,
      metadata: { repo: repoFullName, issue_url: result.url },
    });
  }
  revalidatePath(`/admin/batches/${id}`);
  revalidatePath("/admin/batches");
}

async function fireRoutineAction(formData: FormData) {
  "use server";
  if (!(await requireStaff()).ok) return;
  const id = String(formData.get("id") || "");
  if (!id) return;
  const supabase = await createClient();
  const { data: batchRow } = await supabase.from("fix_batches").select("*").eq("id", id).single();
  if (!batchRow) return;
  const batch = batchRow as BatchRow;
  if (batch.status !== "compiled" || !batch.prompt || !batch.project_id) return;
  const { data: profile } = await supabase
    .from("system_profiles")
    .select("routine_fire_url, routine_token")
    .eq("project_id", batch.project_id)
    .maybeSingle();
  const fireUrl = (profile?.routine_fire_url as string | null) ?? null;
  const token = (profile?.routine_token as string | null) ?? null;
  if (!fireUrl || !token) return;

  const result = await fireRoutine({ fireUrl, token, text: batch.prompt });
  if (result) {
    await supabase
      .from("fix_batches")
      .update({
        routine_session_url: result.sessionUrl,
        routine_fired_at: new Date().toISOString(),
        status: "dispatched",
        dispatched_at: new Date().toISOString(),
      })
      .eq("id", id);
    await logAudit({
      action: "batch.routine_fired",
      target: `batch:${id}`,
      tenantId: batch.tenant_id,
      metadata: { session_url: result.sessionUrl },
    });
  }
  revalidatePath(`/admin/batches/${id}`);
  revalidatePath("/admin/batches");
}

async function runManagedAgent(formData: FormData) {
  "use server";
  if (!(await requireStaff()).ok) return;
  const id = String(formData.get("id") || "");
  if (!id) return;
  const supabase = await createClient();
  const { data: batchRow } = await supabase.from("fix_batches").select("*").eq("id", id).single();
  if (!batchRow) return;
  const batch = batchRow as BatchRow;
  if (batch.status !== "compiled" || !batch.prompt || !batch.project_id) return;
  const { data: profile } = await supabase
    .from("system_profiles")
    .select("repo_full_name, default_branch")
    .eq("project_id", batch.project_id)
    .maybeSingle();
  const repoFullName = (profile?.repo_full_name as string | null) ?? null;
  if (!repoFullName) return;

  const result = await dispatchBatchToManagedAgent({
    repoFullName,
    defaultBranch: (profile?.default_branch as string | null) ?? "main",
    workOrder: batch.prompt,
    batchId: batch.id,
  });
  if (result) {
    await supabase
      .from("fix_batches")
      .update({
        ma_session_id: result.sessionId,
        ma_session_url: result.sessionUrl,
        status: "dispatched",
        dispatched_at: new Date().toISOString(),
      })
      .eq("id", id);
    await logAudit({
      action: "batch.managed_agent_started",
      target: `batch:${id}`,
      tenantId: batch.tenant_id,
      metadata: { session_id: result.sessionId, repo: repoFullName },
    });
  }
  revalidatePath(`/admin/batches/${id}`);
  revalidatePath("/admin/batches");
}

async function recordPr(formData: FormData) {
  "use server";
  if (!(await requireStaff()).ok) return;
  const id = String(formData.get("id") || "");
  const tenantId = String(formData.get("tenant_id") || "");
  const url = String(formData.get("pr_url") || "").trim();
  if (!id || !url) return;
  const supabase = await createClient();
  await supabase.from("fix_batches").update({ pr_url: url, status: "pr_open" }).eq("id", id);
  await logAudit({
    action: "batch.pr_recorded",
    target: `batch:${id}`,
    tenantId,
    metadata: { pr_url: url },
  });
  revalidatePath(`/admin/batches/${id}`);
  revalidatePath("/admin/batches");
}

async function markShipped(formData: FormData) {
  "use server";
  if (!(await requireStaff()).ok) return;
  const id = String(formData.get("id") || "");
  if (!id) return;
  const supabase = await createClient();
  const { data: batchRow } = await supabase.from("fix_batches").select("*").eq("id", id).single();
  if (!batchRow) return;
  const batch = batchRow as BatchRow;
  if (batch.status === "shipped" || batch.status === "cancelled") return;
  const { data: issueRows } = await supabase.from("issues").select("*").eq("batch_id", id);
  const issues = (issueRows ?? []) as IssueRow[];
  const now = new Date().toISOString();

  await supabase
    .from("fix_batches")
    .update({ status: "shipped", shipped_at: now })
    .eq("id", id);

  for (const issue of issues) {
    await supabase
      .from("issues")
      .update({ status: "shipped", resolved_at: now })
      .eq("id", issue.id);
    if (issue.client_visible) {
      await supabase.from("project_updates").insert({
        tenant_id: issue.tenant_id,
        project_id: issue.project_id,
        type: "update",
        title: `Fixed: ${issue.title}`,
        body: issue.resolution_note ?? null,
        client_id: null,
      });
    }
    if (issue.billing === "build_item") {
      const { data: prior } = await supabase
        .from("build_credit_events")
        .select("id")
        .eq("issue_id", issue.id)
        .limit(1);
      if (!prior?.length) {
        await supabase.from("build_credit_events").insert({
          tenant_id: issue.tenant_id,
          project_id: issue.project_id,
          issue_id: issue.id,
          period: currentPeriodStart(),
          delta: -Number(issue.build_items ?? 1),
          reason: issue.title,
        });
      }
    }
  }

  await logAudit({
    action: "batch.shipped",
    target: `batch:${id}`,
    tenantId: batch.tenant_id,
    metadata: { issues: issues.length },
  });
  revalidatePath(`/admin/batches/${id}`);
  revalidatePath("/admin/batches");
  revalidatePath("/admin/issues");
}

async function cancelBatch(formData: FormData) {
  "use server";
  if (!(await requireStaff()).ok) return;
  const id = String(formData.get("id") || "");
  const tenantId = String(formData.get("tenant_id") || "");
  if (!id) return;
  const supabase = await createClient();
  await supabase
    .from("issues")
    .update({ status: "queued", batch_id: null })
    .eq("batch_id", id);
  await supabase.from("fix_batches").update({ status: "cancelled" }).eq("id", id);
  await logAudit({ action: "batch.cancelled", target: `batch:${id}`, tenantId });
  revalidatePath(`/admin/batches/${id}`);
  revalidatePath("/admin/batches");
  revalidatePath("/admin/issues");
}

// ── page ───────────────────────────────────────────────────────

export default async function BatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: batchRow } = await supabase
    .from("fix_batches")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!batchRow) notFound();
  const batch = batchRow as BatchRow;

  const [{ data: issueRows }, { data: tenant }, { data: project }, { data: profileRow }] =
    await Promise.all([
      supabase.from("issues").select("*").eq("batch_id", id).order("created_at"),
      supabase.from("tenants").select("id, name").eq("id", batch.tenant_id).single(),
      batch.project_id
        ? supabase
            .from("projects")
            .select("id, name, live_url")
            .eq("id", batch.project_id)
            .single()
        : Promise.resolve({ data: null }),
      batch.project_id
        ? supabase
            .from("system_profiles")
            .select(
              "project_id, repo_full_name, default_branch, vercel_project, supabase_ref, stack, runbook, quirks, routine_fire_url, routine_token"
            )
            .eq("project_id", batch.project_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
  const issues = (issueRows ?? []) as IssueRow[];
  const profile = (profileRow as ProfileWithDispatch | null) ?? null;
  const active = batch.status !== "shipped" && batch.status !== "cancelled";
  const dispatchConfigured = Boolean(process.env.GITHUB_DISPATCH_TOKEN);
  const routineConfigured = Boolean(profile?.routine_fire_url && profile?.routine_token);
  const maConfigured = hasManagedAgentConfig();
  // Live Managed Agent session status — best-effort, refreshed on page load.
  const maStatus = batch.ma_session_id
    ? await getManagedSessionStatus(batch.ma_session_id)
    : null;
  const maBranch = `claude/fix-batch-${batch.id.slice(0, 8)}`;
  const maCompareUrl = profile?.repo_full_name
    ? `https://github.com/${profile.repo_full_name}/compare/${profile.default_branch ?? "main"}...${maBranch}?expand=1`
    : null;

  return (
    <div>
      <PageHeader
        label="Fix batch"
        title={batch.title}
        lead={
          <>
            {tenant?.name ?? "—"}
            {project ? ` · ${project.name}` : ""}
          </>
        }
        actions={
          <>
            <StatusChip tone={BATCH_TONE[batch.status]}>
              {batch.status.replace(/_/g, " ")}
            </StatusChip>
            {batch.github_issue_url && (
              <a
                href={batch.github_issue_url}
                target="_blank"
                rel="noreferrer"
                className="kb kb-outline kb-sm"
              >
                GitHub issue
              </a>
            )}
            {batch.pr_url && (
              <a
                href={batch.pr_url}
                target="_blank"
                rel="noreferrer"
                className="kb kb-outline kb-sm"
              >
                Pull request
              </a>
            )}
            {batch.routine_session_url && (
              <a
                href={batch.routine_session_url}
                target="_blank"
                rel="noreferrer"
                className="kb kb-outline kb-sm"
              >
                Routine run
              </a>
            )}
            {batch.ma_session_url && (
              <a
                href={batch.ma_session_url}
                target="_blank"
                rel="noreferrer"
                className="kb kb-outline kb-sm"
              >
                Agent session
              </a>
            )}
            <Link href="/admin/batches" className="kb kb-outline kb-sm">
              All batches
            </Link>
          </>
        }
      />

      {/* ── Work order ──────────────────────────────────────── */}
      <Reveal className="block" delay={0.05}>
        <Panel
          label="// WORK ORDER"
          pad={false}
          className="mt-7"
          actions={batch.prompt ? <CopyButton text={batch.prompt} /> : undefined}
        >
          {batch.prompt ? (
            <pre
              style={{
                fontFamily: T.mono,
                fontSize: 12,
                lineHeight: 1.6,
                color: "var(--k-muted)",
                padding: 16,
                margin: 0,
                maxHeight: 480,
                overflow: "auto",
                whiteSpace: "pre-wrap",
              }}
            >
              {batch.prompt}
            </pre>
          ) : (
            <p
              className="text-center py-7"
              style={{ fontFamily: T.sans, fontSize: "0.85rem", color: "var(--k-muted)" }}
            >
              No compiled prompt on this batch.
            </p>
          )}
        </Panel>
      </Reveal>

      {/* ── Actions ─────────────────────────────────────────── */}
      <Reveal className="block" delay={0.08}>
        <Panel label="// ACTIONS" className="mt-5">
          <div className="flex flex-col gap-4">
            {batch.status === "compiled" && profile?.repo_full_name && (
              <div className="flex items-center gap-3 flex-wrap">
                <form action={dispatchBatch}>
                  <input type="hidden" name="id" value={batch.id} />
                  <SubmitButton
                    style={btn("var(--k-accent)", "var(--k-on-accent)")}
                    pendingLabel="Dispatching…"
                  >
                    Dispatch to Claude
                  </SubmitButton>
                </form>
                <span
                  style={{ fontFamily: T.mono, fontSize: "10px", color: "var(--k-faint)" }}
                >
                  Files a GitHub issue on {profile.repo_full_name} with an @claude mention.
                </span>
              </div>
            )}
            {!dispatchConfigured && (
              <p
                style={{ fontFamily: T.sans, fontSize: "0.82rem", color: "var(--k-faint)" }}
              >
                Add GITHUB_DISPATCH_TOKEN to enable one-click dispatch — until then, copy
                the work order and paste it into a Claude Code session.
              </p>
            )}
            {batch.status === "compiled" && !profile?.repo_full_name && (
              <p
                style={{ fontFamily: T.sans, fontSize: "0.82rem", color: "var(--k-faint)" }}
              >
                No repository on this system&apos;s passport — copy the work order
                instead, or set repo_full_name on the system profile.
              </p>
            )}

            {batch.status === "compiled" && routineConfigured && (
              <div className="flex items-center gap-3 flex-wrap">
                <form action={fireRoutineAction}>
                  <input type="hidden" name="id" value={batch.id} />
                  <SubmitButton
                    style={btn("var(--k-accent)", "var(--k-on-accent)")}
                    pendingLabel="Firing…"
                  >
                    Fire routine
                  </SubmitButton>
                </form>
                <span
                  style={{ fontFamily: T.mono, fontSize: "10px", color: "var(--k-faint)" }}
                >
                  Starts this system&apos;s Claude Code routine on Anthropic&apos;s cloud
                  with the work order attached — you get a live session link.
                </span>
              </div>
            )}

            {batch.status === "compiled" && maConfigured && profile?.repo_full_name && (
              <div className="flex items-center gap-3 flex-wrap">
                <form action={runManagedAgent}>
                  <input type="hidden" name="id" value={batch.id} />
                  <SubmitButton
                    style={btn("var(--k-accent)", "var(--k-on-accent)")}
                    pendingLabel="Starting session…"
                  >
                    Run managed agent
                  </SubmitButton>
                </form>
                <span
                  style={{ fontFamily: T.mono, fontSize: "10px", color: "var(--k-faint)" }}
                >
                  Anthropic-hosted sandbox session (beta): mounts {profile.repo_full_name},
                  fixes the batch, pushes {maBranch} — no runner timeouts. API-metered.
                </span>
              </div>
            )}

            {active && (
              <form action={recordPr} className="flex items-center gap-2 flex-wrap">
                <input type="hidden" name="id" value={batch.id} />
                <input type="hidden" name="tenant_id" value={batch.tenant_id} />
                <input
                  name="pr_url"
                  type="url"
                  required
                  placeholder="https://github.com/…/pull/…"
                  defaultValue={batch.pr_url ?? ""}
                  style={{ ...inp, width: 320 }}
                />
                <SubmitButton style={btn("var(--k-surface)", "var(--k-fg)", true)}>
                  Record PR
                </SubmitButton>
              </form>
            )}

            {active && (
              <div className="flex items-center gap-2 flex-wrap">
                <form action={markShipped}>
                  <input type="hidden" name="id" value={batch.id} />
                  <SubmitButton
                    style={btn("var(--k-accent)", "var(--k-on-accent)")}
                    pendingLabel="Shipping…"
                  >
                    Mark shipped
                  </SubmitButton>
                </form>
                <form action={cancelBatch}>
                  <input type="hidden" name="id" value={batch.id} />
                  <input type="hidden" name="tenant_id" value={batch.tenant_id} />
                  <SubmitButton style={btn("transparent", "var(--k-muted)", true)}>
                    Cancel batch
                  </SubmitButton>
                </form>
                <span
                  style={{ fontFamily: T.mono, fontSize: "10px", color: "var(--k-faint)" }}
                >
                  Shipping closes every issue, posts client updates and burns build
                  credits. Cancelling returns issues to the queue.
                </span>
              </div>
            )}
          </div>
        </Panel>
      </Reveal>

      {/* ── Managed agent session status ────────────────────── */}
      {batch.ma_session_id && (
        <Reveal className="block" delay={0.09}>
          <Panel label="// AGENT SESSION" className="mt-5">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <StatusChip
                  tone={
                    maStatus?.status === "running"
                      ? "accent"
                      : maStatus?.status === "idle"
                        ? "success"
                        : maStatus?.status === "terminated"
                          ? "muted"
                          : "warning"
                  }
                >
                  {maStatus?.status ?? "status unavailable"}
                </StatusChip>
                <span
                  style={{ fontFamily: T.mono, fontSize: "10px", color: "var(--k-faint)" }}
                >
                  Refreshes on page load. Idle usually means the run finished — check the
                  summary below, then open the branch compare to review and open the PR.
                </span>
                {maCompareUrl && (
                  <a
                    href={maCompareUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="kb kb-outline kb-sm ml-auto"
                  >
                    Compare branch / open PR
                  </a>
                )}
              </div>
              {maStatus?.lastMessage && (
                <pre
                  style={{
                    fontFamily: T.mono,
                    fontSize: 12,
                    lineHeight: 1.6,
                    color: "var(--k-muted)",
                    margin: 0,
                    maxHeight: 260,
                    overflow: "auto",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {maStatus.lastMessage}
                </pre>
              )}
            </div>
          </Panel>
        </Reveal>
      )}

      {/* ── Issues in batch ─────────────────────────────────── */}
      <Reveal className="block" delay={0.1}>
        <Panel label="// ISSUES IN BATCH" pad={false} className="mt-5">
          {issues.length === 0 ? (
            <p
              className="text-center py-7"
              style={{ fontFamily: T.sans, fontSize: "0.85rem", color: "var(--k-muted)" }}
            >
              No issues attached to this batch.
            </p>
          ) : (
            issues.map((issue, i) => (
              <div
                key={issue.id}
                className="flex items-center gap-3 flex-wrap"
                style={{
                  padding: "11px 18px",
                  borderTop: i ? "1px solid var(--k-border)" : "none",
                }}
              >
                <span
                  style={{
                    fontFamily: T.sans,
                    fontWeight: 600,
                    fontSize: "0.87rem",
                    color: "var(--k-fg)",
                  }}
                >
                  {issue.title}
                </span>
                <span className="ml-auto flex items-center gap-2">
                  <StatusChip tone={SEVERITY_META[issue.severity].tone}>
                    {SEVERITY_META[issue.severity].label}
                  </StatusChip>
                  <StatusChip tone={STATUS_TONE[issue.status]}>
                    {issue.status.replace(/_/g, " ")}
                  </StatusChip>
                </span>
              </div>
            ))
          )}
        </Panel>
      </Reveal>
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
