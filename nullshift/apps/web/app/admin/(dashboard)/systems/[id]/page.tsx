import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@nullshift/db";
import { logAudit } from "@nullshift/db/audit";
import { requireStaff } from "@nullshift/auth/guards";
import { T } from "@nullshift/ui/tokens";
import { money } from "@nullshift/ui/format";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { PageHeader, Panel, StatusChip } from "@/components/app/AppKit";
import { Reveal } from "@/components/kyma";
import { carePlan, currentPeriodStart, remainingAllowance } from "@/lib/carePlans";
import { OPEN_STATUSES, SEVERITY_META, STATUS_TONE, type IssueRow } from "@/lib/ops/issues";

/**
 * System passport — everything a teammate (human or Claude session) needs to
 * pick this system up cold: repo/infra facts, the stack, what's built and
 * what's left, provisioning state, open issues, batches, runbook and plan.
 * [id] is the project id. Staff-only via RLS.
 */

export const dynamic = "force-dynamic";

type ProjectRow = {
  id: string;
  tenant_id: string;
  name: string;
  stage: string;
  live_url: string | null;
};
type Feature = { name: string; status: "planned" | "in_progress" | "built"; note: string | null };
type EnvItem = { label?: string; name?: string; done?: boolean };
type ProfileRow = {
  project_id: string;
  tenant_id: string;
  repo_full_name: string | null;
  default_branch: string;
  vercel_project: string | null;
  supabase_ref: string | null;
  stack: Record<string, unknown>;
  env_checklist: EnvItem[];
  features: Feature[];
  runbook: string | null;
  quirks: string | null;
  health: string;
  routine_fire_url: string | null;
  routine_token: string | null;
};
type PassportIssue = Pick<IssueRow, "id" | "title" | "severity" | "status" | "created_at">;
type BatchRow = { id: string; title: string; status: string; created_at: string };
type UpdateRow = { id: string; title: string; type: string; created_at: string };
type SubRow = { plan: string | null; mrr: number | null };

const STACK_KEYS = ["framework", "db", "payments", "email", "ai"] as const;
const NEXT_FEATURE: Record<string, Feature["status"]> = {
  planned: "in_progress",
  in_progress: "built",
  built: "planned",
};
const BATCH_TONE: Record<string, "accent" | "success" | "warning" | "danger" | "muted"> = {
  draft: "muted",
  compiled: "accent",
  dispatched: "accent",
  pr_open: "warning",
  shipped: "success",
  cancelled: "muted",
};

/* ── Server actions ─────────────────────────────────────────── */

/** Upsert the passport facts. Only patches fields present in the form, so the
 *  facts form and the runbook form can share it without clobbering each other. */
async function saveProfile(formData: FormData) {
  "use server";
  if (!(await requireStaff()).ok) return;
  const projectId = String(formData.get("project_id") || "");
  const tenantId = String(formData.get("tenant_id") || "");
  if (!projectId || !tenantId) return;
  const str = (k: string) => String(formData.get(k) ?? "").trim() || null;
  const patch: Record<string, unknown> = { project_id: projectId, tenant_id: tenantId };
  if (formData.has("repo_full_name")) patch.repo_full_name = str("repo_full_name");
  if (formData.has("default_branch"))
    patch.default_branch = str("default_branch") ?? "main";
  if (formData.has("vercel_project")) patch.vercel_project = str("vercel_project");
  if (formData.has("supabase_ref")) patch.supabase_ref = str("supabase_ref");
  if (formData.has("health")) patch.health = String(formData.get("health") || "unknown");
  if (formData.has("runbook")) patch.runbook = str("runbook");
  if (formData.has("quirks")) patch.quirks = str("quirks");
  if (formData.has("routine_fire_url")) patch.routine_fire_url = str("routine_fire_url");
  if (formData.has("routine_token")) patch.routine_token = str("routine_token");
  // Stack facts arrive as individual inputs, folded into the stack jsonb.
  if (STACK_KEYS.some((k) => formData.has(`stack_${k}`))) {
    const stack: Record<string, string> = {};
    for (const k of STACK_KEYS) {
      const v = String(formData.get(`stack_${k}`) ?? "").trim();
      if (v) stack[k] = v;
    }
    patch.stack = stack;
  }
  const supabase = await createClient();
  await supabase.from("system_profiles").upsert(patch);
  await logAudit({
    action: "system_profile.saved",
    target: `project:${projectId}`,
    tenantId,
  });
  revalidatePath(`/admin/systems/${projectId}`);
  revalidatePath("/admin/systems");
}

/** Append a planned feature to the passport's features jsonb. */
async function addFeature(formData: FormData) {
  "use server";
  if (!(await requireStaff()).ok) return;
  const projectId = String(formData.get("project_id") || "");
  const tenantId = String(formData.get("tenant_id") || "");
  const name = String(formData.get("name") || "").trim();
  if (!projectId || !tenantId || !name) return;
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("system_profiles")
    .select("features")
    .eq("project_id", projectId)
    .maybeSingle();
  const features = ((profile?.features ?? []) as Feature[]).concat({
    name,
    status: "planned",
    note: null,
  });
  await supabase
    .from("system_profiles")
    .upsert({ project_id: projectId, tenant_id: tenantId, features });
  await logAudit({
    action: "system_profile.feature_added",
    target: `project:${projectId}`,
    tenantId,
    metadata: { name },
  });
  revalidatePath(`/admin/systems/${projectId}`);
}

/** Cycle a feature planned → in_progress → built (→ planned). */
async function toggleFeature(formData: FormData) {
  "use server";
  if (!(await requireStaff()).ok) return;
  const projectId = String(formData.get("project_id") || "");
  const tenantId = String(formData.get("tenant_id") || "");
  const index = Number(formData.get("index"));
  const current = String(formData.get("current") || "planned");
  if (!projectId || Number.isNaN(index)) return;
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("system_profiles")
    .select("features")
    .eq("project_id", projectId)
    .maybeSingle();
  const features = (profile?.features ?? []) as Feature[];
  if (!features[index]) return;
  features[index] = { ...features[index], status: NEXT_FEATURE[current] ?? "planned" };
  await supabase.from("system_profiles").update({ features }).eq("project_id", projectId);
  await logAudit({
    action: "system_profile.feature_toggled",
    target: `project:${projectId}`,
    tenantId,
    metadata: { index, to: features[index].status },
  });
  revalidatePath(`/admin/systems/${projectId}`);
}

/** Flip the done flag on a provisioning checklist item. */
async function toggleEnvItem(formData: FormData) {
  "use server";
  if (!(await requireStaff()).ok) return;
  const projectId = String(formData.get("project_id") || "");
  const tenantId = String(formData.get("tenant_id") || "");
  const index = Number(formData.get("index"));
  if (!projectId || Number.isNaN(index)) return;
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("system_profiles")
    .select("env_checklist")
    .eq("project_id", projectId)
    .maybeSingle();
  const checklist = (profile?.env_checklist ?? []) as EnvItem[];
  if (!checklist[index]) return;
  checklist[index] = { ...checklist[index], done: !checklist[index].done };
  await supabase
    .from("system_profiles")
    .update({ env_checklist: checklist })
    .eq("project_id", projectId);
  await logAudit({
    action: "system_profile.env_toggled",
    target: `project:${projectId}`,
    tenantId,
    metadata: { index, done: checklist[index].done },
  });
  revalidatePath(`/admin/systems/${projectId}`);
}

/* ── Page ───────────────────────────────────────────────────── */

export default async function SystemPassportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: projectRaw } = await supabase
    .from("projects")
    .select("id, tenant_id, name, stage, live_url")
    .eq("id", id)
    .maybeSingle();
  if (!projectRaw) notFound();
  const project = projectRaw as ProjectRow;

  const [
    { data: tenantRaw },
    { data: profileRaw },
    { data: issuesRaw },
    { data: batchesRaw },
    { data: updatesRaw },
    { data: subRaw },
    { data: creditsRaw },
  ] = await Promise.all([
    supabase.from("tenants").select("id, name").eq("id", project.tenant_id).maybeSingle(),
    supabase
      .from("system_profiles")
      .select(
        "project_id, tenant_id, repo_full_name, default_branch, vercel_project, supabase_ref, stack, env_checklist, features, runbook, quirks, health, routine_fire_url, routine_token"
      )
      .eq("project_id", id)
      .maybeSingle(),
    supabase
      .from("issues")
      .select("id, title, severity, status, created_at")
      .eq("project_id", id)
      .in("status", OPEN_STATUSES)
      .order("created_at", { ascending: false }),
    supabase
      .from("fix_batches")
      .select("id, title, status, created_at")
      .eq("project_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("project_updates")
      .select("id, title, type, created_at")
      .eq("project_id", id)
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("subscriptions")
      .select("plan, mrr")
      .eq("tenant_id", project.tenant_id)
      .in("status", ["active", "trialing"])
      .limit(1)
      .maybeSingle(),
    supabase
      .from("build_credit_events")
      .select("delta")
      .eq("tenant_id", project.tenant_id)
      .eq("period", currentPeriodStart()),
  ]);

  const tenant = tenantRaw as { id: string; name: string } | null;
  const profile = (profileRaw ?? null) as ProfileRow | null;
  const issues = (issuesRaw ?? []) as PassportIssue[];
  const batches = (batchesRaw ?? []) as BatchRow[];
  const updates = (updatesRaw ?? []) as UpdateRow[];
  const sub = (subRaw ?? null) as SubRow | null;
  const plan = carePlan(sub?.plan);
  const deltaSum = ((creditsRaw ?? []) as { delta: number }[]).reduce(
    (sum, e) => sum + (Number(e.delta) || 0),
    0
  );
  const remaining = remainingAllowance(plan, deltaSum);

  const features = (profile?.features ?? []).map((f, idx) => ({ ...f, idx }));
  const envChecklist = profile?.env_checklist ?? [];
  const stack = (profile?.stack ?? {}) as Record<string, unknown>;
  const stackVal = (k: string) => (stack[k] == null ? "" : String(stack[k]));

  const featureGroups: {
    key: Feature["status"];
    label: string;
    color: string;
    mark: string;
  }[] = [
    { key: "built", label: "Built", color: T.success, mark: "✓" },
    { key: "in_progress", label: "In progress", color: "var(--k-accent)", mark: "●" },
    { key: "planned", label: "Planned", color: "var(--k-muted)", mark: "○" },
  ];

  return (
    <div>
      <PageHeader
        index="02"
        label="System passport"
        title={project.name}
        lead={`${tenant?.name ?? "Client"} · ${plan ? `${plan.label} plan` : "No care plan"} · ${project.stage}`}
        actions={
          <Link
            href="/admin/systems"
            style={{ ...mono, fontSize: 11, color: "var(--k-muted)" }}
          >
            ← All systems
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2 items-start mt-8">
        {/* ── Left column ─────────────────────────────────── */}
        <div className="flex flex-col gap-6">
          {/* Facts */}
          <Reveal delay={0.05}>
            <Panel label="// FACTS" title="The system">
              {(profile?.repo_full_name || project.live_url) && (
                <div className="flex flex-wrap items-center gap-4 mb-4">
                  {profile?.repo_full_name && (
                    <a
                      href={`https://github.com/${profile.repo_full_name}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ ...mono, fontSize: 11, color: "var(--k-accent)" }}
                    >
                      {profile.repo_full_name} ↗
                    </a>
                  )}
                  {project.live_url && (
                    <a
                      href={project.live_url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ ...mono, fontSize: 11, color: "var(--k-accent)" }}
                    >
                      Live site ↗
                    </a>
                  )}
                </div>
              )}
              <form action={saveProfile} className="flex flex-col gap-3">
                <input type="hidden" name="project_id" value={project.id} />
                <input type="hidden" name="tenant_id" value={project.tenant_id} />
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="Repo (owner/name)">
                    <input
                      name="repo_full_name"
                      defaultValue={profile?.repo_full_name ?? ""}
                      placeholder="nullshift/system"
                      style={monoInp}
                    />
                  </Field>
                  <Field label="Default branch">
                    <input
                      name="default_branch"
                      defaultValue={profile?.default_branch ?? "main"}
                      style={monoInp}
                    />
                  </Field>
                  <Field label="Vercel project">
                    <input
                      name="vercel_project"
                      defaultValue={profile?.vercel_project ?? ""}
                      style={monoInp}
                    />
                  </Field>
                  <Field label="Supabase ref">
                    <input
                      name="supabase_ref"
                      defaultValue={profile?.supabase_ref ?? ""}
                      style={monoInp}
                    />
                  </Field>
                </div>
                <Field label="Health">
                  <select
                    name="health"
                    defaultValue={profile?.health ?? "unknown"}
                    style={inp}
                  >
                    <option value="ok">ok</option>
                    <option value="warning">warning</option>
                    <option value="down">down</option>
                    <option value="unknown">unknown</option>
                  </select>
                </Field>
                <div className="grid sm:grid-cols-2 gap-3">
                  {STACK_KEYS.map((k) => (
                    <Field key={k} label={`Stack · ${k}`}>
                      <input
                        name={`stack_${k}`}
                        defaultValue={stackVal(k)}
                        placeholder="—"
                        style={inp}
                      />
                    </Field>
                  ))}
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="Routine fire URL">
                    <input
                      name="routine_fire_url"
                      defaultValue={profile?.routine_fire_url ?? ""}
                      placeholder="https://api.anthropic.com/v1/claude_code/routines/…/fire"
                      style={monoInp}
                    />
                  </Field>
                  <Field label="Routine token">
                    <input
                      name="routine_token"
                      type="password"
                      defaultValue={profile?.routine_token ?? ""}
                      placeholder="sk-ant-oat01-…"
                      autoComplete="off"
                      style={monoInp}
                    />
                  </Field>
                </div>
                <p
                  style={{
                    fontFamily: T.mono,
                    fontSize: "10px",
                    color: "var(--k-faint)",
                    margin: 0,
                  }}
                >
                  From claude.ai/code/routines: a routine with this repo + an API trigger.
                  Its saved prompt must say to act on the routine-fire-payload block — see
                  docs/OPERATIONS.md. Enables &quot;Fire routine&quot; on fix batches.
                </p>
                <div>
                  <SubmitButton style={btn("var(--k-accent)", T.primaryFg)}>
                    Save facts
                  </SubmitButton>
                </div>
              </form>
            </Panel>
          </Reveal>

          {/* Runbook + quirks */}
          <Reveal delay={0.1}>
            <Panel label="// RUNBOOK" title="How to run it">
              <form action={saveProfile} className="flex flex-col gap-3">
                <input type="hidden" name="project_id" value={project.id} />
                <input type="hidden" name="tenant_id" value={project.tenant_id} />
                <Field label="Runbook — deploys, migrations, checks">
                  <textarea
                    name="runbook"
                    defaultValue={profile?.runbook ?? ""}
                    rows={5}
                    placeholder="How to deploy, run migrations, verify a fix went live…"
                    style={textarea}
                  />
                </Field>
                <Field label="Quirks / footguns">
                  <textarea
                    name="quirks"
                    defaultValue={profile?.quirks ?? ""}
                    rows={4}
                    placeholder="The things that bite — odd env vars, fragile flows, client-specific rules…"
                    style={textarea}
                  />
                </Field>
                <div>
                  <SubmitButton style={btn("var(--k-surface)", "var(--k-fg)", true)}>
                    Save runbook
                  </SubmitButton>
                </div>
              </form>
            </Panel>
          </Reveal>

          {/* Plan + allowance */}
          <Reveal delay={0.15}>
            <Panel label="// PLAN" title="Care plan">
              {!plan ? (
                <p style={{ fontFamily: T.sans, fontSize: "0.85rem", color: "var(--k-muted)" }}>
                  No active care plan for this client yet.
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-4">
                    <StatusChip tone="accent">{plan.label}</StatusChip>
                    <span
                      style={{
                        fontFamily: T.mono,
                        fontSize: 12,
                        letterSpacing: "0.04em",
                        color: "var(--k-accent)",
                      }}
                    >
                      {money(Number(sub?.mrr ?? plan.mrr))}/mo
                    </span>
                  </div>
                  {plan.buildAllowance > 0 && (
                    <div>
                      <div
                        style={{
                          height: 6,
                          background: "var(--k-border)",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${Math.min(100, (remaining / plan.buildAllowance) * 100)}%`,
                            background: "var(--k-accent)",
                          }}
                        />
                      </div>
                      <div style={{ ...mono, color: "var(--k-muted)", marginTop: 8 }}>
                        {remaining} of {plan.buildAllowance} build items left this month
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Panel>
          </Reveal>
        </div>

        {/* ── Right column ────────────────────────────────── */}
        <div className="flex flex-col gap-6">
          {/* What's built */}
          <Reveal delay={0.05}>
            <Panel label="// WHAT'S BUILT" title="Features">
              {features.length === 0 && (
                <p
                  style={{
                    fontFamily: T.sans,
                    fontSize: "0.85rem",
                    color: "var(--k-muted)",
                    marginBottom: 14,
                  }}
                >
                  No features logged yet — add the first one below.
                </p>
              )}
              {featureGroups.map((g) => {
                const items = features.filter((f) => f.status === g.key);
                if (items.length === 0) return null;
                return (
                  <div key={g.key} style={{ marginBottom: 14 }}>
                    <div style={{ ...mono, color: "var(--k-faint)", marginBottom: 6 }}>
                      {g.label} · {items.length}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {items.map((f) => (
                        <div key={f.idx} className="flex items-start gap-2.5">
                          <form action={toggleFeature}>
                            <input type="hidden" name="project_id" value={project.id} />
                            <input
                              type="hidden"
                              name="tenant_id"
                              value={project.tenant_id}
                            />
                            <input type="hidden" name="index" value={f.idx} />
                            <input type="hidden" name="current" value={f.status} />
                            <SubmitButton
                              title="Cycle planned → in progress → built"
                              style={{
                                width: 24,
                                height: 24,
                                fontFamily: T.mono,
                                fontSize: 12,
                                lineHeight: 1,
                                background: "var(--k-bg)",
                                color: g.color,
                                border: "1px solid var(--k-border)",
                                borderRadius: 0,
                                cursor: "pointer",
                              }}
                            >
                              {g.mark}
                            </SubmitButton>
                          </form>
                          <div className="min-w-0" style={{ paddingTop: 3 }}>
                            <span
                              style={{
                                fontFamily: T.sans,
                                fontSize: "0.85rem",
                                fontWeight: g.key === "built" ? 600 : 400,
                                color: g.key === "planned" ? "var(--k-muted)" : "var(--k-fg)",
                              }}
                            >
                              {f.name}
                            </span>
                            {f.note && (
                              <span
                                style={{
                                  fontFamily: T.sans,
                                  fontSize: "0.78rem",
                                  color: "var(--k-faint)",
                                  display: "block",
                                }}
                              >
                                {f.note}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              <form
                action={addFeature}
                className="flex items-center gap-2"
                style={{
                  marginTop: 4,
                  paddingTop: 14,
                  borderTop: "1px solid var(--k-border)",
                }}
              >
                <input type="hidden" name="project_id" value={project.id} />
                <input type="hidden" name="tenant_id" value={project.tenant_id} />
                <input
                  name="name"
                  required
                  placeholder="Feature name"
                  style={{ ...inp, flex: 1, minWidth: 0 }}
                />
                <SubmitButton style={btn("var(--k-surface)", "var(--k-fg)", true)}>
                  + Feature
                </SubmitButton>
              </form>
            </Panel>
          </Reveal>

          {/* Provisioning checklist */}
          {envChecklist.length > 0 && (
            <Reveal delay={0.1}>
              <Panel label="// PROVISIONING" title="Environment checklist">
                <div className="flex flex-col gap-1.5">
                  {envChecklist.map((item, i) => {
                    const done = !!item.done;
                    return (
                      <div key={i} className="flex items-center gap-2.5">
                        <form action={toggleEnvItem}>
                          <input type="hidden" name="project_id" value={project.id} />
                          <input type="hidden" name="tenant_id" value={project.tenant_id} />
                          <input type="hidden" name="index" value={i} />
                          <SubmitButton
                            title={done ? "Mark not done" : "Mark done"}
                            style={{
                              width: 24,
                              height: 24,
                              fontFamily: T.mono,
                              fontSize: 12,
                              lineHeight: 1,
                              background: "var(--k-bg)",
                              color: done ? T.success : "var(--k-muted)",
                              border: "1px solid var(--k-border)",
                              borderRadius: 0,
                              cursor: "pointer",
                            }}
                          >
                            {done ? "✓" : "○"}
                          </SubmitButton>
                        </form>
                        <span
                          style={{
                            fontFamily: T.sans,
                            fontSize: "0.85rem",
                            color: done ? "var(--k-faint)" : "var(--k-fg)",
                            textDecoration: done ? "line-through" : "none",
                          }}
                        >
                          {item.label ?? item.name ?? `Step ${i + 1}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Panel>
            </Reveal>
          )}

          {/* Open issues */}
          <Reveal delay={0.15}>
            <Panel
              label="// OPEN ISSUES"
              title="Issue bank"
              pad={false}
              actions={
                <Link
                  href={`/admin/batches?project=${project.id}`}
                  style={{ ...mono, fontSize: 11, color: "var(--k-accent)" }}
                >
                  Compile batch →
                </Link>
              }
            >
              {issues.length === 0 ? (
                <EmptyState text="No open issues on this system — lovely." />
              ) : (
                issues.map((iss, i) => (
                  <Reveal key={iss.id} delay={Math.min(i, 8) * 0.04}>
                    <Link
                      href="/admin/issues"
                      className="flex items-center justify-between gap-4 py-3 px-4 hover:bg-[var(--k-bg)]"
                      style={{
                        borderTop: i ? "1px solid var(--k-border)" : "none",
                        transition: "background-color 0.15s ease",
                      }}
                    >
                      <span
                        className="min-w-0"
                        style={{
                          fontFamily: T.sans,
                          fontWeight: 600,
                          fontSize: "0.85rem",
                          color: "var(--k-fg)",
                        }}
                      >
                        {iss.title}
                      </span>
                      <span className="flex items-center gap-2 shrink-0">
                        <StatusChip tone={SEVERITY_META[iss.severity].tone}>
                          {SEVERITY_META[iss.severity].label}
                        </StatusChip>
                        <StatusChip tone={STATUS_TONE[iss.status]}>
                          {iss.status.replace(/_/g, " ")}
                        </StatusChip>
                      </span>
                    </Link>
                  </Reveal>
                ))
              )}
            </Panel>
          </Reveal>

          {/* Batches */}
          <Reveal delay={0.2}>
            <Panel label="// BATCHES" title="Fix batches" pad={false}>
              {batches.length === 0 ? (
                <EmptyState text="No batches for this system yet." />
              ) : (
                batches.map((b, i) => (
                  <Reveal key={b.id} delay={Math.min(i, 8) * 0.04}>
                    <Link
                      href={`/admin/batches/${b.id}`}
                      className="flex items-center justify-between gap-4 py-3 px-4 hover:bg-[var(--k-bg)]"
                      style={{
                        borderTop: i ? "1px solid var(--k-border)" : "none",
                        transition: "background-color 0.15s ease",
                      }}
                    >
                      <span className="min-w-0">
                        <span
                          style={{
                            fontFamily: T.sans,
                            fontWeight: 600,
                            fontSize: "0.85rem",
                            color: "var(--k-fg)",
                            display: "block",
                          }}
                        >
                          {b.title}
                        </span>
                        <span style={{ ...mono, color: "var(--k-faint)" }}>
                          {new Date(b.created_at).toLocaleDateString("en-GB")}
                        </span>
                      </span>
                      <StatusChip tone={BATCH_TONE[b.status] ?? "muted"}>
                        {b.status.replace(/_/g, " ")}
                      </StatusChip>
                    </Link>
                  </Reveal>
                ))
              )}
            </Panel>
          </Reveal>

          {/* Client feed */}
          <Reveal delay={0.25}>
            <Panel label="// CLIENT FEED" title="Recent updates" pad={false}>
              {updates.length === 0 ? (
                <EmptyState text="Nothing posted to the client feed yet." />
              ) : (
                updates.map((u, i) => (
                  <div
                    key={u.id}
                    className="py-3 px-4"
                    style={{ borderTop: i ? "1px solid var(--k-border)" : "none" }}
                  >
                    <div
                      style={{
                        fontFamily: T.sans,
                        fontWeight: 600,
                        fontSize: "0.85rem",
                        color: "var(--k-fg)",
                      }}
                    >
                      {u.title}
                    </div>
                    <div style={{ ...mono, color: "var(--k-faint)", marginTop: 4 }}>
                      {u.type} · {new Date(u.created_at).toLocaleDateString("en-GB")}
                    </div>
                  </div>
                ))
              )}
            </Panel>
          </Reveal>
        </div>
      </div>
    </div>
  );
}

/* ── Local building blocks ──────────────────────────────────── */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span style={{ ...mono, color: "var(--k-muted)" }}>{label}</span>
      {children}
    </label>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-7 px-4 text-center">
      <span style={{ fontFamily: T.sans, fontSize: "0.85rem", color: "var(--k-muted)" }}>
        {text}
      </span>
    </div>
  );
}

const mono: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: 10,
  fontWeight: 500,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};
const inp: React.CSSProperties = {
  fontFamily: T.sans,
  fontSize: "0.85rem",
  height: 36,
  padding: "0 11px",
  background: "var(--k-surface)",
  color: "var(--k-fg)",
  border: "1px solid var(--k-border)",
  borderRadius: 0,
  width: "100%",
};
// Repo / infra facts read best in mono.
const monoInp: React.CSSProperties = {
  ...inp,
  fontFamily: T.mono,
  fontSize: "0.78rem",
  letterSpacing: "0.02em",
};
const textarea: React.CSSProperties = {
  ...inp,
  height: "auto",
  padding: 12,
  resize: "vertical",
  lineHeight: 1.5,
};
const btn = (bg: string, fg: string, outline = false): React.CSSProperties => ({
  fontFamily: T.mono,
  fontSize: "11px",
  fontWeight: 500,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  height: 36,
  paddingInline: 14,
  background: bg,
  color: fg,
  border: outline ? "1px solid var(--k-border)" : "1px solid transparent",
  borderRadius: 0,
  cursor: "pointer",
});
