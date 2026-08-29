import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { createClient } from "@nullshift/db";
import { requireStaff } from "@nullshift/auth/guards";
import { logAudit } from "@nullshift/db/audit";
import { T } from "@nullshift/ui/tokens";
import { PageHeader, Panel, StatusChip } from "@/components/app/AppKit";
import { CopyButton } from "@/components/app/CopyButton";
import { Reveal } from "@/components/kyma";
import { CLAUDE_MODEL, hasClaude } from "@/lib/ops/claude";
import type { SystemProfileRow } from "@/lib/ops/batchCompiler";
import {
  generateBuildPlan,
  planToPrompt,
  type BuildPlan,
} from "@/lib/ops/buildPlanner";

/**
 * Build planner — the human writes the goal on the passport; here the AI
 * turns it plus the system's real context (passport, features, open issues,
 * the module library) into a structured, chronological plan. A person reviews
 * the draft, then one click hands it off: the plan becomes a compiled batch
 * riding the existing dispatch transports (GitHub @claude, routine, managed
 * agent, or copy-paste).
 */

export const dynamic = "force-dynamic";
// Planning a whole build at high effort is the slowest AI call in the app —
// same ceiling as the consultation route, which is proven in production.
export const maxDuration = 300;

type ProjectRow = {
  id: string;
  tenant_id: string;
  name: string;
  stage: string;
  live_url: string | null;
};
type PlanRow = {
  id: string;
  status: "draft" | "handed_off" | "archived";
  goal: string;
  guidance: string | null;
  model: string;
  plan: BuildPlan;
  prompt: string;
  module_keys: string[];
  batch_id: string | null;
  created_by: string | null;
  created_at: string;
};
type ModuleRow = {
  id: string;
  key: string;
  title: string;
  summary: string;
  prompt: string;
  project_id: string | null;
};

const pagePath = (id: string) => `/admin/systems/${id}/plan`;

// ── server actions ─────────────────────────────────────────────

async function generatePlan(formData: FormData) {
  "use server";
  const staff = await requireStaff();
  if (!staff.ok) return;
  const projectId = String(formData.get("project_id") || "");
  if (!projectId) return;
  const guidance = String(formData.get("guidance") || "").trim() || null;
  const moduleIds = formData.getAll("modules").map(String).filter(Boolean);
  const fail = (msg: string) =>
    redirect(`${pagePath(projectId)}?err=${encodeURIComponent(msg)}`);

  const supabase = await createClient();
  const [{ data: project }, { data: profileRow }, { data: issueRows }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, tenant_id, name, stage, live_url")
      .eq("id", projectId)
      .maybeSingle(),
    supabase
      .from("system_profiles")
      .select(
        "project_id, repo_full_name, default_branch, vercel_project, supabase_ref, stack, runbook, quirks, features, build_goal"
      )
      .eq("project_id", projectId)
      .maybeSingle(),
    supabase
      .from("issues")
      .select("title")
      .eq("project_id", projectId)
      .in("status", ["new", "triaged", "queued", "batched", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  if (!project) return;
  const profile = (profileRow ?? null) as
    | (SystemProfileRow & { features: { name: string; status: string }[]; build_goal: string | null })
    | null;
  const goal = profile?.build_goal?.trim();
  if (!goal) {
    fail("Write the build goal on the passport first — the planner needs to know what this system is for.");
  }

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name, type")
    .eq("id", project.tenant_id)
    .single();
  const tenantType = (tenant?.type === "internal" ? "internal" : "client") as
    | "internal"
    | "client";

  // The ticked modules are the candidates the planner may draw on.
  let modules: ModuleRow[] = [];
  if (moduleIds.length) {
    const { data: moduleRows } = await supabase
      .from("build_modules")
      .select("id, key, title, summary, prompt, project_id")
      .in("id", moduleIds)
      .eq("active", true);
    modules = ((moduleRows ?? []) as ModuleRow[]).filter(
      (m) => !m.project_id || m.project_id === projectId
    );
  }

  const plan = await generateBuildPlan({
    goal: goal!,
    guidance,
    projectName: project.name,
    tenantName: tenant?.name ?? "the client",
    tenantType,
    profile,
    liveUrl: project.live_url,
    features: profile?.features ?? [],
    openIssueTitles: ((issueRows ?? []) as { title: string }[]).map((i) => i.title),
    modules: modules.map(({ key, title, summary }) => ({ key, title, summary })),
  });
  if (!plan) {
    fail(
      hasClaude()
        ? "The planner call failed — try again, or with less guidance."
        : "ANTHROPIC_API_KEY is not set on this deployment, so the planner can't run."
    );
  }

  const prompt = planToPrompt({
    plan: plan!,
    goal: goal!,
    planTitle: `Build plan — ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`,
    projectName: project.name,
    tenantName: tenant?.name ?? "the client",
    tenantType,
    profile,
    liveUrl: project.live_url,
    modules: modules.map(({ key, title, summary, prompt: body }) => ({
      key,
      title,
      summary,
      prompt: body,
    })),
  });

  const { data: created, error } = await supabase
    .from("build_plans")
    .insert({
      tenant_id: project.tenant_id,
      project_id: projectId,
      goal: goal!,
      guidance,
      model: CLAUDE_MODEL,
      plan: plan!,
      prompt,
      module_keys: modules.map((m) => m.key),
      created_by: staff.email,
    })
    .select("id")
    .single();
  if (error || !created) fail(error?.message ?? "Saving the plan failed.");

  // The fresh draft supersedes previous ones — archived AFTER the new draft
  // is durably saved, so a failed insert never destroys a reviewed plan.
  await supabase
    .from("build_plans")
    .update({ status: "archived" })
    .eq("project_id", projectId)
    .eq("status", "draft")
    .neq("id", created!.id);

  await logAudit({
    action: "build_plan.generated",
    target: `plan:${created!.id}`,
    tenantId: project.tenant_id,
    metadata: { project: project.name, phases: plan!.phases.length, modules: modules.length },
  });
  revalidatePath(pagePath(projectId));
  revalidatePath(`/admin/systems/${projectId}`);
}

async function handOffPlan(formData: FormData) {
  "use server";
  if (!(await requireStaff()).ok) return;
  const planId = String(formData.get("plan_id") || "");
  if (!planId) return;
  const supabase = await createClient();
  const { data: planRow } = await supabase
    .from("build_plans")
    .select("id, project_id, tenant_id, status, prompt, module_keys, plan")
    .eq("id", planId)
    .maybeSingle();
  if (!planRow || planRow.status !== "draft") return;

  // Atomic claim (same pattern as batch dispatch): the conditional update
  // means a double-click or second tab finds nothing to claim and returns,
  // instead of compiling the plan into two duplicate batches.
  const { data: claimed } = await supabase
    .from("build_plans")
    .update({ status: "handed_off" })
    .eq("id", planId)
    .eq("status", "draft")
    .select("id");
  if (!claimed?.length) return;

  const title = `Build plan — ${new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}`;
  const { data: batch, error } = await supabase
    .from("fix_batches")
    .insert({
      tenant_id: planRow.tenant_id,
      project_id: planRow.project_id,
      title,
      status: "compiled",
      prompt: planRow.prompt,
    })
    .select("id")
    .single();
  if (error || !batch) {
    // Definitely no batch — release the claim so the draft stays actionable.
    await supabase
      .from("build_plans")
      .update({ status: "draft" })
      .eq("id", planId)
      .eq("status", "handed_off");
    redirect(`${pagePath(planRow.project_id)}?err=${encodeURIComponent(error?.message ?? "Creating the batch failed.")}`);
  }

  // Provenance: which library modules the plan actually uses.
  const referenced = [
    ...new Set(((planRow.plan as BuildPlan)?.phases ?? []).flatMap((p) => p.modules ?? [])),
  ];
  if (referenced.length) {
    const { data: moduleRows } = await supabase
      .from("build_modules")
      .select("id, key, title")
      .in("key", referenced);
    const rows = (moduleRows ?? []) as { id: string; key: string; title: string }[];
    if (rows.length) {
      await supabase.from("fix_batch_modules").insert(
        rows.map((m, i) => ({
          batch_id: batch!.id,
          module_id: m.id,
          module_key: m.key,
          title: m.title,
          position: i,
        }))
      );
    }
  }

  await supabase.from("build_plans").update({ batch_id: batch!.id }).eq("id", planId);
  await logAudit({
    action: "build_plan.handed_off",
    target: `plan:${planId}`,
    tenantId: planRow.tenant_id,
    metadata: { batch_id: batch!.id },
  });
  revalidatePath(pagePath(planRow.project_id));
  redirect(`/admin/batches/${batch!.id}`);
}

async function archivePlan(formData: FormData) {
  "use server";
  if (!(await requireStaff()).ok) return;
  const planId = String(formData.get("plan_id") || "");
  if (!planId) return;
  const supabase = await createClient();
  const { data: planRow } = await supabase
    .from("build_plans")
    .select("id, project_id, status")
    .eq("id", planId)
    .maybeSingle();
  if (!planRow || planRow.status !== "draft") return;
  await supabase.from("build_plans").update({ status: "archived" }).eq("id", planId);
  await logAudit({ action: "build_plan.archived", target: `plan:${planId}` });
  revalidatePath(pagePath(planRow.project_id));
}

// ── page ───────────────────────────────────────────────────────

export default async function BuildPlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ err?: string }>;
}) {
  const { id } = await params;
  const { err } = await searchParams;
  const supabase = await createClient();

  const { data: projectRaw } = await supabase
    .from("projects")
    .select("id, tenant_id, name, stage, live_url")
    .eq("id", id)
    .maybeSingle();
  if (!projectRaw) notFound();
  const project = projectRaw as ProjectRow;

  const [{ data: profileRaw }, { data: plansRaw }, { data: modulesRaw }] = await Promise.all([
    supabase
      .from("system_profiles")
      .select("project_id, build_goal")
      .eq("project_id", id)
      .maybeSingle(),
    supabase
      .from("build_plans")
      .select(
        "id, status, goal, guidance, model, plan, prompt, module_keys, batch_id, created_by, created_at"
      )
      .eq("project_id", id)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("build_modules")
      .select("id, key, title, summary, project_id")
      .eq("active", true)
      .order("sort")
      .order("title"),
  ]);
  const goal = (profileRaw as { build_goal: string | null } | null)?.build_goal?.trim() ?? "";
  const plans = (plansRaw ?? []) as PlanRow[];
  const modules = ((modulesRaw ?? []) as Omit<ModuleRow, "prompt">[]).filter(
    (m) => !m.project_id || m.project_id === id
  );
  const draft = plans.find((p) => p.status === "draft");
  const past = plans.filter((p) => p.id !== draft?.id);

  return (
    <div>
      <PageHeader
        index="02"
        label="Build planner"
        title={project.name}
        lead="Goal in, chronological plan out — reviewed by you, executed by Claude Code."
        actions={
          <Link href={`/admin/systems/${project.id}`} style={{ ...mono, fontSize: 11, color: "var(--k-muted)" }}>
            ← Passport
          </Link>
        }
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

      {!hasClaude() && (
        <p style={{ ...body, border: "1px solid var(--k-border)", padding: "10px 14px", marginTop: 16 }}>
          ANTHROPIC_API_KEY is not set on this deployment — the planner can&apos;t run until it is.
        </p>
      )}

      {/* ── The goal being planned from ── */}
      <Reveal delay={0.04}>
        <Panel
          label="// THE GOAL"
          className="mt-7"
          actions={
            <Link
              href={`/admin/systems/${project.id}#build-goal`}
              style={{ ...mono, fontSize: 11, color: "var(--k-accent)" }}
            >
              Edit on passport →
            </Link>
          }
        >
          {goal ? (
            <p style={{ ...body, color: "var(--k-fg)" }}>{goal}</p>
          ) : (
            <p style={body}>
              No build goal yet. Write one on the{" "}
              <Link href={`/admin/systems/${project.id}#build-goal`} style={{ color: "var(--k-accent)" }}>
                passport
              </Link>{" "}
              first — the planner refuses to plan without knowing what this system is for.
            </p>
          )}
        </Panel>
      </Reveal>

      {/* ── Draft plan ── */}
      {draft && (
        <Reveal delay={0.06}>
          <Panel
            label="// DRAFT PLAN"
            title={`${draft.plan.phases.length} phases · drafted by ${draft.model} · ${new Date(draft.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`}
            className="mt-5"
            actions={<CopyButton text={draft.prompt} label="Copy work order" />}
          >
            <div className="flex flex-col gap-4">
              <p style={{ ...body, color: "var(--k-fg)" }}>{draft.plan.overview}</p>
              <p style={faint}>Sequencing: {draft.plan.sequencing_rationale}</p>

              {draft.plan.phases.map((phase, i) => (
                <div key={i} style={{ borderTop: "1px solid var(--k-border)", paddingTop: 12 }}>
                  <p style={{ fontFamily: T.sans, fontWeight: 600, fontSize: "0.9rem", color: "var(--k-fg)" }}>
                    <span style={{ ...mono, color: "var(--k-accent)", marginRight: 8 }}>
                      phase {i + 1}
                    </span>
                    {phase.title}
                  </p>
                  <p style={{ ...body, marginTop: 4 }}>{phase.objective}</p>
                  <ol style={{ ...body, marginTop: 6, paddingLeft: 18, listStyle: "decimal" }}>
                    {phase.steps.map((step, n) => (
                      <li key={n} style={{ marginTop: 2 }}>
                        {step}
                      </li>
                    ))}
                  </ol>
                  {phase.modules.length > 0 && (
                    <p style={{ ...faint, marginTop: 6 }}>
                      modules: {phase.modules.join(", ")}
                    </p>
                  )}
                  <p style={{ ...faint, marginTop: 6 }}>
                    accept when: {phase.acceptance.join(" · ")}
                  </p>
                </div>
              ))}

              {draft.plan.risks.length > 0 && (
                <div style={{ borderTop: "1px solid var(--k-border)", paddingTop: 12 }}>
                  <span style={mono}>risks</span>
                  <ul style={{ ...body, marginTop: 4, paddingLeft: 18, listStyle: "disc" }}>
                    {draft.plan.risks.map((r, n) => (
                      <li key={n}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div
                className="flex flex-wrap items-center gap-3"
                style={{ borderTop: "1px solid var(--k-border)", paddingTop: 14 }}
              >
                <form action={handOffPlan}>
                  <input type="hidden" name="plan_id" value={draft.id} />
                  <SubmitButton style={btnPrimary} pendingLabel="Compiling batch…">
                    Hand off to Claude Code
                  </SubmitButton>
                </form>
                <form action={archivePlan}>
                  <input type="hidden" name="plan_id" value={draft.id} />
                  <SubmitButton style={btnOutline}>Archive draft</SubmitButton>
                </form>
                <span style={faint}>
                  Hand-off compiles this plan into a batch — dispatch it from the batch page
                  (GitHub @claude, routine, managed agent) or paste the copied work order into
                  a session at claude.ai/code. Not right? Regenerate below with guidance.
                </span>
              </div>
            </div>
          </Panel>
        </Reveal>
      )}

      {/* ── Generate ── */}
      <Reveal delay={0.08}>
        <Panel
          label="// GENERATE"
          title={draft ? "Regenerate (archives the current draft)" : "Draft a build plan"}
          className="mt-5"
        >
          <form action={generatePlan} className="flex flex-col gap-3">
            <input type="hidden" name="project_id" value={project.id} />
            {modules.length > 0 && (
              <div>
                <span style={mono}>
                  module library the planner may draw on ·{" "}
                  <Link href="/admin/modules" style={{ color: "var(--k-accent)" }}>
                    edit library
                  </Link>
                </span>
                <div className="flex flex-col gap-1.5" style={{ marginTop: 8 }}>
                  {modules.map((m) => (
                    <label key={m.id} className="flex items-baseline gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        name="modules"
                        value={m.id}
                        defaultChecked
                        style={{ accentColor: "var(--k-accent)" }}
                      />
                      <span style={{ fontFamily: T.mono, fontSize: "11px", color: "var(--k-accent)" }}>
                        {m.key}
                      </span>
                      <span style={body}>{m.summary}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <label className="flex flex-col gap-1.5">
              <span style={mono}>guidance for this plan (optional — priorities, constraints, order preferences)</span>
              <textarea name="guidance" rows={3} style={ta} maxLength={2000} />
            </label>
            <div>
              <SubmitButton
                style={btnPrimary}
                pendingLabel="Planning… (up to a minute)"
                disabled={!goal || !hasClaude()}
              >
                {draft ? "Regenerate plan" : "Generate plan"}
              </SubmitButton>
            </div>
          </form>
        </Panel>
      </Reveal>

      {/* ── Past plans ── */}
      {past.length > 0 && (
        <Reveal delay={0.1}>
          <Panel label="// PAST PLANS" pad={false} className="mt-5">
            {past.map((p, i) => (
              <div
                key={p.id}
                className="flex items-center gap-3 flex-wrap px-4 py-3"
                style={{ borderTop: i ? "1px solid var(--k-border)" : "none" }}
              >
                <StatusChip tone={p.status === "handed_off" ? "success" : "muted"}>
                  {p.status.replace(/_/g, " ")}
                </StatusChip>
                <span style={body}>
                  {p.plan.phases.length} phases · {new Date(p.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  {p.created_by ? ` · ${p.created_by}` : ""}
                </span>
                {p.batch_id && (
                  <Link
                    href={`/admin/batches/${p.batch_id}`}
                    style={{ ...mono, fontSize: 11, color: "var(--k-accent)", marginLeft: "auto" }}
                  >
                    Batch →
                  </Link>
                )}
              </div>
            ))}
          </Panel>
        </Reveal>
      )}
    </div>
  );
}

/* ── local styles ── */

const mono: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: "10px",
  fontWeight: 500,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--k-muted)",
};
const body: React.CSSProperties = {
  fontFamily: T.sans,
  fontSize: "0.85rem",
  lineHeight: 1.55,
  color: "var(--k-muted)",
};
const faint: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: "10px",
  letterSpacing: "0.06em",
  color: "var(--k-faint)",
};
const ta: React.CSSProperties = {
  fontFamily: T.sans,
  fontSize: "0.85rem",
  padding: 12,
  background: "var(--k-surface)",
  color: "var(--k-fg)",
  border: "1px solid var(--k-border)",
  borderRadius: 0,
  width: "100%",
  resize: "vertical",
  lineHeight: 1.5,
};
const btnPrimary: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: "11px",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  height: 36,
  paddingInline: 14,
  background: "var(--k-accent)",
  color: "var(--k-on-accent)",
  border: "1px solid transparent",
  borderRadius: 0,
  cursor: "pointer",
};
const btnOutline: React.CSSProperties = {
  ...btnPrimary,
  background: "var(--k-surface)",
  color: "var(--k-fg)",
  border: "1px solid var(--k-border)",
};
