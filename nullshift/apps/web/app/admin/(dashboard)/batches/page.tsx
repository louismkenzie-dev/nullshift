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
import {
  compileBatchPrompt,
  type BatchExceptionInput,
  type BatchModuleInput,
  type SystemProfileRow,
} from "@/lib/ops/batchCompiler";
import {
  QUEUEABLE_STATUSES,
  isBatchable,
  type IssueRow,
  type IssueSeverity,
} from "@/lib/ops/issues";
import { requireSoc2, WRITE_ROLES } from "@/lib/soc2/guard";
import { logSoc2Event } from "@/lib/soc2/events";
import { OPEN_EXCEPTION_STATUSES } from "@/lib/soc2/types";

/**
 * Batches — compile anything hand-off-able into one context-complete Claude
 * Code work order (a fix_batches row): the project's queueable issues, cached
 * module prompts from the library, and — on the Null Shift Ops system only —
 * SOC 2 exception remediations. Tracked from compiled through dispatched /
 * PR open / shipped on the detail page.
 */

export const dynamic = "force-dynamic";

type Tenant = { id: string; name: string; type: "internal" | "client" };
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

const pickLabel: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: "10px",
  fontWeight: 500,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--k-muted)",
};

// ── server actions ─────────────────────────────────────────────

async function compileBatch(formData: FormData) {
  "use server";
  if (!(await requireStaff()).ok) return;
  const projectId = String(formData.get("project_id") || "");
  const title = String(formData.get("title") || "").trim();
  const moduleIds = formData.getAll("modules").map(String).filter(Boolean);
  const exceptionIds = formData.getAll("exceptions").map(String).filter(Boolean);
  if (!projectId || !title) return;
  const fail = (msg: string) =>
    redirect(`/admin/batches?project=${projectId}&err=${encodeURIComponent(msg)}`);

  // Queueing an exception into a batch is a programme act, not just an ops
  // act — it needs a live SOC 2 programme role, and the trail records it.
  let soc2Actor: string | null = null;
  if (exceptionIds.length) {
    const guard = await requireSoc2(...WRITE_ROLES);
    if (!guard.ok) fail("SOC 2 exceptions need a programme role (Programme Owner appoints on /admin/soc2/settings).");
    else soc2Actor = guard.email;
  }

  const supabase = await createClient();

  const { data: issueRows } = await supabase
    .from("issues")
    .select("*")
    .eq("project_id", projectId)
    .in("status", QUEUEABLE_STATUSES);
  // isBatchable: no unreviewed inbox drafts (a human must confirm first) and
  // no unclassified/out_of_scope billing — billable work can't be built,
  // shipped and announced before anyone approved or paid for it.
  const issues = ((issueRows ?? []) as IssueRow[])
    .filter(isBatchable)
    .sort(
      (a, b) =>
        SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
        a.created_at.localeCompare(b.created_at)
    );
  if (issues.length === 0 && moduleIds.length === 0 && exceptionIds.length === 0) {
    fail("Nothing to compile: no queueable issues on this system, and no modules or exceptions selected.");
  }

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
    .select("id, name, type")
    .eq("id", project.tenant_id)
    .single();
  const tenantType = (tenant?.type === "internal" ? "internal" : "client") as
    | "internal"
    | "client";

  // Exception remediations target the Ops monorepo — compiling one onto a
  // client system would hand a session two contradictory repos. Hard gate.
  if (exceptionIds.length && tenantType !== "internal") {
    fail("SOC 2 exceptions compile onto the Null Shift Ops system only — their fixes live in this platform's repo, not a client's.");
  }

  // Modules: active, and either global or pinned to THIS system.
  let modules: (BatchModuleInput & { id: string })[] = [];
  if (moduleIds.length) {
    const { data: moduleRows } = await supabase
      .from("build_modules")
      .select("id, key, title, summary, prompt, project_id, active")
      .in("id", moduleIds)
      .order("sort")
      .order("title");
    const rows = (moduleRows ?? []) as {
      id: string; key: string; title: string; summary: string; prompt: string;
      project_id: string | null; active: boolean;
    }[];
    const bad = rows.find((m) => !m.active || (m.project_id && m.project_id !== projectId));
    if (bad || rows.length !== moduleIds.length) {
      fail("A selected module is retired, missing, or pinned to a different system.");
    }
    modules = rows.map(({ id, key, title: t, summary, prompt }) => ({ id, key, title: t, summary, prompt }));
  }

  // Exceptions: open ones only, with their control and recent trail so the
  // embedded section carries the same substance as the standalone work order.
  let exceptions: (BatchExceptionInput & { id: string })[] = [];
  if (exceptionIds.length) {
    const { data: excRows } = await supabase
      .from("soc2_exceptions")
      .select(
        "id, ref, title, severity, status, detail, rule_key, trigger_ref, recommended_action, severity_rationale, remediation_plan, affected, control_id"
      )
      .in("id", exceptionIds)
      .in("status", OPEN_EXCEPTION_STATUSES);
    const excs = (excRows ?? []) as {
      id: string; ref: string; title: string; severity: string; status: string;
      detail: string | null; rule_key: string | null; trigger_ref: string | null;
      recommended_action: string | null; severity_rationale: string | null;
      remediation_plan: string | null; affected: Record<string, string[]> | null;
      control_id: string | null;
    }[];
    if (excs.length !== exceptionIds.length) {
      fail("A selected exception is no longer open — refresh and re-pick.");
    }
    // One remediation vehicle at a time: an exception already riding an
    // active batch can't be compiled into a second one.
    const { data: existingJoins } = await supabase
      .from("fix_batch_exceptions")
      .select("exception_id, exception_ref, fix_batches(status)")
      .in("exception_id", exceptionIds);
    const activeStatuses = ["draft", "compiled", "dispatched", "pr_open"];
    const alreadyActive = ((existingJoins ?? []) as {
      exception_id: string; exception_ref: string; fix_batches: unknown;
    }[]).filter((j) => {
      const b = Array.isArray(j.fix_batches) ? j.fix_batches[0] : j.fix_batches;
      return b && activeStatuses.includes((b as { status: string }).status);
    });
    if (alreadyActive.length) {
      fail(
        `${alreadyActive.map((j) => j.exception_ref).join(", ")} already in an active batch — one remediation vehicle at a time.`
      );
    }
    const controlIds = [...new Set(excs.map((e) => e.control_id).filter(Boolean))] as string[];
    const [{ data: controlRows }, { data: eventRows }] = await Promise.all([
      controlIds.length
        ? supabase
            .from("soc2_controls")
            .select("id, key, name, objective, test_procedure, evidence_requirements")
            .in("id", controlIds)
        : Promise.resolve({ data: [] as never[] }),
      supabase
        .from("soc2_events")
        .select("record_id, type, summary, created_at")
        .eq("record_type", "exception")
        .in("record_id", exceptionIds)
        .order("created_at", { ascending: true }),
    ]);
    const controls = new Map(
      ((controlRows ?? []) as {
        id: string; key: string; name: string; objective: string;
        test_procedure: string | null; evidence_requirements: string | null;
      }[]).map((c) => [c.id, c])
    );
    const trails = new Map<string, string[]>();
    for (const ev of (eventRows ?? []) as {
      record_id: string; type: string; summary: string; created_at: string;
    }[]) {
      const list = trails.get(ev.record_id) ?? [];
      list.push(`${ev.created_at.slice(0, 10)} · ${ev.type} · ${ev.summary}`);
      trails.set(ev.record_id, list);
    }
    exceptions = excs.map((e) => {
      const c = e.control_id ? controls.get(e.control_id) : undefined;
      return {
        id: e.id,
        ref: e.ref,
        title: e.title,
        severity: e.severity,
        status: e.status,
        detail: e.detail,
        ruleKey: e.rule_key,
        triggerRef: e.trigger_ref,
        recommendedAction: e.recommended_action,
        severityRationale: e.severity_rationale,
        remediationPlan: e.remediation_plan,
        affected: e.affected ?? {},
        control: c
          ? {
              key: c.key,
              name: c.name,
              objective: c.objective,
              testProcedure: c.test_procedure,
              evidenceRequirements: c.evidence_requirements,
            }
          : null,
        trail: (trails.get(e.id) ?? []).slice(-6),
      };
    });
  }

  const prompt = compileBatchPrompt({
    tenantName: tenant?.name ?? "the client",
    projectName: project.name,
    liveUrl: project.live_url ?? null,
    profile: (profileRow as SystemProfileRow | null) ?? null,
    issues,
    batchTitle: title,
    modules,
    exceptions,
    tenantType,
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

  if (issues.length) {
    await supabase
      .from("issues")
      .update({ batch_id: batch.id, status: "batched" })
      .in(
        "id",
        issues.map((i) => i.id)
      );
  }
  if (modules.length) {
    await supabase.from("fix_batch_modules").insert(
      modules.map((m, i) => ({
        batch_id: batch.id,
        module_id: m.id,
        module_key: m.key,
        title: m.title,
        position: i,
      }))
    );
  }
  if (exceptions.length) {
    await supabase.from("fix_batch_exceptions").insert(
      exceptions.map((e) => ({
        batch_id: batch.id,
        exception_id: e.id,
        exception_ref: e.ref,
      }))
    );
    for (const e of exceptions) {
      await logSoc2Event({
        recordType: "exception",
        recordId: e.id,
        type: "queued_into_batch",
        summary: `${e.ref} compiled into batch "${title}" for Claude Code remediation.`,
        detail: { batch_id: batch.id },
        actor: soc2Actor ?? "staff",
      });
    }
  }

  await logAudit({
    action: "batch.compiled",
    target: `batch:${batch.id}`,
    tenantId: project.tenant_id,
    metadata: {
      title,
      issues: issues.length,
      modules: modules.length,
      exceptions: exceptions.length,
    },
  });
  revalidatePath("/admin/batches");
  revalidatePath("/admin/issues");
  redirect(`/admin/batches/${batch.id}`);
}

// ── page ───────────────────────────────────────────────────────

export default async function BatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; err?: string }>;
}) {
  const { project: preselect, err } = await searchParams;
  const supabase = await createClient();
  const [
    { data: batchRows },
    { data: tenantRows },
    { data: projectRows },
    { data: batchedIssues },
    { data: moduleRows },
    { data: exceptionRows },
    { data: exceptionJoinRows },
  ] = await Promise.all([
    supabase
      .from("fix_batches")
      .select("id, tenant_id, project_id, title, status, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("tenants").select("id, name, type").order("name"),
    supabase.from("projects").select("id, tenant_id, name, live_url").order("created_at"),
    supabase.from("issues").select("id, batch_id").not("batch_id", "is", null),
    supabase
      .from("build_modules")
      .select("id, key, title, summary, project_id")
      .eq("active", true)
      .order("sort")
      .order("title"),
    supabase
      .from("soc2_exceptions")
      .select("id, ref, title, severity, status")
      .in("status", OPEN_EXCEPTION_STATUSES)
      .order("detected_at", { ascending: false })
      .limit(50),
    supabase
      .from("fix_batch_exceptions")
      .select("exception_id, fix_batches(status)"),
  ]);
  const batches = (batchRows ?? []) as BatchRow[];
  const tenants = (tenantRows ?? []) as Tenant[];
  const projects = (projectRows ?? []) as Project[];
  const counts = new Map<string, number>();
  for (const row of (batchedIssues ?? []) as { id: string; batch_id: string }[]) {
    counts.set(row.batch_id, (counts.get(row.batch_id) ?? 0) + 1);
  }
  const tenantName = (id: string) => tenants.find((t) => t.id === id)?.name ?? "—";
  const modules = (moduleRows ?? []) as {
    id: string; key: string; title: string; summary: string; project_id: string | null;
  }[];
  const exceptions = (exceptionRows ?? []) as {
    id: string; ref: string; title: string; severity: string; status: string;
  }[];
  const queuedExceptionIds = new Set(
    ((exceptionJoinRows ?? []) as { exception_id: string; fix_batches: unknown }[])
      .filter((j) => {
        const b = Array.isArray(j.fix_batches) ? j.fix_batches[0] : j.fix_batches;
        return b && ["draft", "compiled", "dispatched", "pr_open"].includes((b as { status: string }).status);
      })
      .map((j) => j.exception_id)
  );
  const projectLabel = (id: string) => projects.find((p) => p.id === id)?.name ?? "?";
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
        title="Batches"
        lead="Anything hand-off-able, compiled into one Claude Code work order per system — queued issues, cached build modules, SOC 2 exception remediations. One batch, one PR, one shipped update."
      />

      {err && (
        <p
          style={{
            fontFamily: T.mono,
            fontSize: "11px",
            letterSpacing: "0.04em",
            color: T.danger,
            border: `1px solid ${T.danger}40`,
            padding: "10px 14px",
            marginTop: 16,
          }}
        >
          {err}
        </p>
      )}

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
              className="max-md:w-full"
              style={{ ...inp, maxWidth: "100%" }}
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
              className="w-full md:w-[260px]"
              style={inp}
            />
            <SubmitButton style={btn("var(--k-accent)", "var(--k-on-accent)")}>
              Compile
            </SubmitButton>
            <span
              style={{ fontFamily: T.sans, fontSize: "0.82rem", color: "var(--k-faint)" }}
            >
              Pulls every new / triaged / queued issue on the project, worst first — plus
              anything ticked below.
            </span>

            {modules.length > 0 && (
              <div className="w-full" style={{ borderTop: "1px solid var(--k-border)", marginTop: 10, paddingTop: 12 }}>
                <span style={pickLabel}>
                  Modules to build · from the{" "}
                  <Link href="/admin/modules" style={{ color: "var(--k-accent)" }}>
                    library
                  </Link>{" "}
                  · pinned modules only compile on their own system
                </span>
                <div className="flex flex-col gap-1.5" style={{ marginTop: 8 }}>
                  {modules.map((m) => (
                    <label key={m.id} className="flex items-baseline gap-2.5 cursor-pointer">
                      <input type="checkbox" name="modules" value={m.id} style={{ accentColor: "var(--k-accent)" }} />
                      <span style={{ fontFamily: T.mono, fontSize: "11px", color: "var(--k-accent)" }}>{m.key}</span>
                      <span style={{ fontFamily: T.sans, fontSize: "0.82rem", color: "var(--k-muted)" }}>
                        {m.summary}
                        {m.project_id && (
                          <span style={{ color: "var(--k-faint)" }}> · pinned: {projectLabel(m.project_id)}</span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {exceptions.length > 0 && (
              <div className="w-full" style={{ borderTop: "1px solid var(--k-border)", marginTop: 10, paddingTop: 12 }}>
                <span style={pickLabel}>
                  SOC 2 exceptions to remediate · compile onto the Null Shift Ops system only
                  · needs a programme role
                </span>
                <div className="flex flex-col gap-1.5" style={{ marginTop: 8 }}>
                  {exceptions.map((e) => (
                    <label
                      key={e.id}
                      className="flex items-baseline gap-2.5"
                      style={queuedExceptionIds.has(e.id) ? { opacity: 0.5 } : { cursor: "pointer" }}
                    >
                      <input
                        type="checkbox"
                        name="exceptions"
                        value={e.id}
                        disabled={queuedExceptionIds.has(e.id)}
                        style={{ accentColor: "var(--k-accent)" }}
                      />
                      <span style={{ fontFamily: T.mono, fontSize: "11px", color: "var(--k-accent)" }}>{e.ref}</span>
                      <StatusChip tone={e.severity === "critical" || e.severity === "high" ? "danger" : e.severity === "medium" ? "warning" : "muted"}>
                        {e.severity}
                      </StatusChip>
                      <span style={{ fontFamily: T.sans, fontSize: "0.82rem", color: "var(--k-muted)" }}>
                        {e.title}
                        {queuedExceptionIds.has(e.id) && (
                          <span style={{ color: "var(--k-faint)" }}> · already in an active batch</span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </form>
        </Panel>
      </Reveal>

      {/* ── All batches ─────────────────────────────────────── */}
      <div className="mt-6" style={{ border: "1px solid var(--k-border)" }}>
        <div
          className="max-md:hidden md:grid gap-3 items-center px-4 py-2.5"
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
              className="max-md:flex max-md:flex-wrap max-md:items-center max-md:gap-x-3 max-md:gap-y-1.5 md:grid md:gap-3 items-center px-4 py-3 hover:bg-[var(--k-surface)] transition-colors"
              style={{
                gridTemplateColumns: GRID,
                borderTop: i ? "1px solid var(--k-border)" : "none",
              }}
            >
              <span
                className="truncate min-w-0 max-md:w-full"
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
                className="truncate min-w-0 max-md:w-full"
                style={{
                  fontFamily: T.sans,
                  fontSize: "0.85rem",
                  color: "var(--k-muted)",
                }}
              >
                {tenantName(b.tenant_id)}
              </span>
              <span>
                <StatusChip tone={BATCH_TONE[b.status]}>
                  {b.status.replace(/_/g, " ")}
                </StatusChip>
              </span>
              <span
                style={{ fontFamily: T.mono, fontSize: "11px", color: "var(--k-muted)" }}
              >
                {counts.get(b.id) ?? 0}
                <span className="md:hidden"> issues</span>
              </span>
              <span
                style={{ fontFamily: T.mono, fontSize: "10px", color: "var(--k-faint)" }}
              >
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
