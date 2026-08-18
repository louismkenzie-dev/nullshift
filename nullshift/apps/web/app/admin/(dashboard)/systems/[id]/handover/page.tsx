import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@nullshift/db";
import { logAudit } from "@nullshift/db/audit";
import { requireStaff } from "@nullshift/auth/guards";
import { T } from "@nullshift/ui/tokens";
import { PageHeader, Panel, StatusChip } from "@/components/app/AppKit";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Reveal } from "@/components/kyma";
import { OPEN_STATUSES } from "@/lib/ops/issues";
import { draftHandoverSummary } from "@/lib/ops/assistants";

/**
 * Handover assistant (audit 4.2): stitches the page's own sources into a
 * "read this first" block, saved as an internal project note labelled as an
 * AI draft — the human decides whether it earns a place in the runbook.
 */
async function draftSummary(formData: FormData) {
  "use server";
  if (!(await requireStaff()).ok) return;
  const projectId = String(formData.get("project_id") || "");
  const tenantId = String(formData.get("tenant_id") || "");
  if (!projectId || !tenantId) return;
  const supabase = await createClient();
  const [
    { data: proj },
    { data: t },
    { data: prof },
    { data: decs },
    { data: rks },
    { data: open },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("name, stage, overview, accepted_snapshot")
      .eq("id", projectId)
      .maybeSingle(),
    supabase.from("tenants").select("name").eq("id", tenantId).maybeSingle(),
    supabase
      .from("system_profiles")
      .select("quirks")
      .eq("project_id", projectId)
      .maybeSingle(),
    supabase
      .from("decisions")
      .select("decision")
      .eq("project_id", projectId)
      .order("decided_at", { ascending: false })
      .limit(10),
    supabase
      .from("risks")
      .select("title")
      .eq("project_id", projectId)
      .eq("status", "open"),
    supabase
      .from("issues")
      .select("title")
      .eq("project_id", projectId)
      .in("status", OPEN_STATUSES)
      .limit(15),
  ]);
  if (!proj) return;
  const snap = proj.accepted_snapshot as {
    items?: { name: string }[];
    overview?: string | null;
  } | null;
  const draft = await draftHandoverSummary({
    projectName: proj.name,
    clientName: t?.name ?? "the client",
    stage: proj.stage,
    purpose: snap?.overview ?? proj.overview,
    scopeItems: (snap?.items ?? []).map((i) => i.name),
    decisions: ((decs ?? []) as { decision: string }[]).map((d) => d.decision),
    risks: ((rks ?? []) as { title: string }[]).map((r) => r.title),
    openWork: ((open ?? []) as { title: string }[]).map((i) => i.title),
    quirks: prof?.quirks ?? null,
  });
  if (draft) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.from("project_notes").insert({
      tenant_id: tenantId,
      project_id: projectId,
      author: user?.id ?? null,
      body: `AI DRAFT — Handover summary (verify before relying on it)\n\n${draft.summary}`,
    });
    await logAudit({
      action: "ai.handover_summary_drafted",
      target: `project:${projectId}`,
      tenantId,
    });
  }
  revalidatePath(`/admin/systems/${projectId}/handover`);
}

/**
 * Handover — one compact page a new team member reads to take a project over
 * safely (brief §5): purpose, current position, agreed scope, completed work,
 * decisions, risks, access references, client preferences, next actions. Read
 * only — every section links to where it's edited. The completeness rail at
 * the top says exactly what's still missing before handover is safe.
 */
export const dynamic = "force-dynamic";

const mono: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: 10,
  fontWeight: 500,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};
const body: React.CSSProperties = {
  fontFamily: T.sans,
  fontSize: "0.88rem",
  lineHeight: 1.6,
  color: "var(--k-fg)",
};
const dim: React.CSSProperties = { ...body, color: "var(--k-muted)" };
const missingNote = (text: string) => <p style={{ ...dim, color: T.danger }}>{text}</p>;
const dateGB = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

export default async function HandoverPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select(
      "id, tenant_id, name, stage, overview, accepted_snapshot, accepted_at, live_url, account_owner, delivery_owner, technical_owner, finance_owner, next_action, next_action_owner"
    )
    .eq("id", id)
    .maybeSingle();
  if (!project) notFound();

  const [
    { data: tenant },
    { data: profile },
    { data: decisions },
    { data: risks },
    { data: milestones },
    { data: openIssues },
    { data: shippedIssues },
  ] = await Promise.all([
    supabase
      .from("tenants")
      .select("id, name, contact_name, contact_email")
      .eq("id", project.tenant_id)
      .maybeSingle(),
    supabase
      .from("system_profiles")
      .select(
        "repo_full_name, default_branch, vercel_project, supabase_ref, stack, runbook, quirks, client_preferences, features"
      )
      .eq("project_id", id)
      .maybeSingle(),
    supabase
      .from("decisions")
      .select("id, decision, rationale, approver, impact, decided_at")
      .eq("project_id", id)
      .order("decided_at", { ascending: false })
      .limit(12),
    supabase
      .from("risks")
      .select("id, title, impact, owner, mitigation, review_date, status")
      .eq("project_id", id)
      .eq("status", "open"),
    supabase
      .from("milestones")
      .select("id, title, target_date, owner, health")
      .eq("project_id", id)
      .neq("health", "done")
      .order("target_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("issues")
      .select("id, title, status, severity, assignee")
      .eq("project_id", id)
      .in("status", OPEN_STATUSES)
      .order("created_at", { ascending: false }),
    supabase
      .from("issues")
      .select("id, title, resolved_at")
      .eq("project_id", id)
      .in("status", ["shipped", "fixed"])
      .order("resolved_at", { ascending: false })
      .limit(10),
  ]);

  const { data: aiSummaryNote } = await supabase
    .from("project_notes")
    .select("body, created_at")
    .eq("project_id", id)
    .like("body", "AI DRAFT — Handover summary%")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const snapshot = project.accepted_snapshot as {
    items?: { name: string; amount: number }[];
    total?: number;
    overview?: string | null;
  } | null;
  const features = (
    (profile?.features ?? []) as {
      name: string;
      status?: string;
    }[]
  ).filter((f) => f.status === "built");

  // The completeness rail: what a safe handover still needs. Each check maps
  // to one section below and one place to fix it.
  const owners = [
    project.account_owner,
    project.delivery_owner,
    project.technical_owner,
    project.finance_owner,
  ];
  const checks: { label: string; ok: boolean }[] = [
    { label: "Purpose written", ok: !!(snapshot?.overview ?? project.overview) },
    { label: "Agreed scope snapshot", ok: !!snapshot?.items?.length },
    { label: "All four owners named", ok: owners.every(Boolean) },
    { label: "Next action set", ok: !!project.next_action },
    { label: "Repo reference", ok: !!profile?.repo_full_name },
    { label: "Runbook written", ok: !!profile?.runbook },
    { label: "Client preferences recorded", ok: !!profile?.client_preferences },
    { label: "Decisions logged", ok: (decisions ?? []).length > 0 },
  ];
  const missing = checks.filter((c) => !c.ok);

  return (
    <div>
      <PageHeader
        index="02"
        label="HANDOVER"
        title={`${project.name} — handover`}
        lead={`${tenant?.name ?? "Client"} · ${project.stage.replace(/_/g, " ")} · everything a new owner needs, on one page.`}
        actions={
          <div className="flex items-center gap-4">
            <form action={draftSummary}>
              <input type="hidden" name="project_id" value={id} />
              <input type="hidden" name="tenant_id" value={project.tenant_id} />
              <SubmitButton
                title="AI-drafts a 'read this first' block from this page's sources — saved as an internal note for you to verify"
                style={{
                  ...mono,
                  fontSize: 11,
                  color: "var(--k-accent)",
                  background: "transparent",
                  border: "1px solid var(--k-border)",
                  height: 28,
                  paddingInline: 10,
                  cursor: "pointer",
                }}
              >
                ✦ Draft summary
              </SubmitButton>
            </form>
            <Link
              href={`/admin/systems/${id}`}
              style={{ ...mono, fontSize: 11, color: "var(--k-muted)" }}
            >
              ← Passport
            </Link>
          </div>
        }
      />

      {/* AI "read this first" — a draft, clearly labelled, human-verified */}
      {aiSummaryNote && (
        <Reveal>
          <Panel
            label="// READ THIS FIRST"
            title="AI-drafted orientation"
            className="mt-4"
          >
            <p style={{ ...dim, whiteSpace: "pre-wrap" }}>
              {aiSummaryNote.body.replace(/^AI DRAFT[^\n]*\n+/, "")}
            </p>
            <p style={{ ...mono, color: T.warning, marginTop: 8 }}>
              AI DRAFT — verify against the sections below before relying on it
            </p>
          </Panel>
        </Reveal>
      )}

      {/* Completeness rail */}
      <Reveal>
        <Panel
          label="// READINESS"
          title={
            missing.length === 0
              ? "Safe to hand over ✓"
              : `${missing.length} thing${missing.length === 1 ? "" : "s"} missing before handover is safe`
          }
          className="mt-6 mb-4"
        >
          <div className="flex flex-wrap gap-1.5">
            {checks.map((c) => (
              <StatusChip key={c.label} tone={c.ok ? "success" : "danger"}>
                {c.ok ? "✓ " : "✗ "}
                {c.label}
              </StatusChip>
            ))}
          </div>
        </Panel>
      </Reveal>

      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <div className="flex flex-col gap-4">
          {/* Purpose */}
          <Reveal>
            <Panel label="// PURPOSE" title="Why this system exists">
              {snapshot?.overview || project.overview ? (
                <p style={body}>{snapshot?.overview ?? project.overview}</p>
              ) : (
                missingNote(
                  "No purpose written — the proposal overview is empty. Fix on the client hub."
                )
              )}
            </Panel>
          </Reveal>

          {/* Current position */}
          <Reveal>
            <Panel label="// POSITION" title="Where it is right now">
              <div className="flex flex-col gap-1.5" style={body}>
                <span>
                  Stage: <strong>{project.stage.replace(/_/g, " ")}</strong>
                  {project.live_url && (
                    <>
                      {" · "}
                      <a
                        href={project.live_url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "var(--k-accent)" }}
                      >
                        live site ↗
                      </a>
                    </>
                  )}
                </span>
                <span>
                  Owners: account <strong>{project.account_owner ?? "—"}</strong> ·
                  delivery <strong>{project.delivery_owner ?? "—"}</strong> · technical{" "}
                  <strong>{project.technical_owner ?? "—"}</strong> · finance{" "}
                  <strong>{project.finance_owner ?? "—"}</strong>
                </span>
                {project.next_action ? (
                  <span>
                    Next action: <strong>{project.next_action}</strong>
                    {project.next_action_owner && <> — {project.next_action_owner}</>}
                  </span>
                ) : (
                  missingNote("No next action set — fix on the client hub.")
                )}
                {(milestones ?? []).length > 0 && (
                  <span>
                    Upcoming:{" "}
                    {(milestones ?? [])
                      .slice(0, 3)
                      .map(
                        (m) =>
                          `${m.title}${m.target_date ? ` (${dateGB(m.target_date)})` : ""}`
                      )
                      .join(" · ")}
                  </span>
                )}
              </div>
            </Panel>
          </Reveal>

          {/* Agreed scope */}
          <Reveal>
            <Panel label="// SCOPE" title="What was agreed (signed baseline)">
              {snapshot?.items?.length ? (
                <div className="flex flex-col gap-1" style={body}>
                  {snapshot.items.map((i) => (
                    <span key={i.name}>
                      {i.name} — £{Math.round(i.amount).toLocaleString("en-GB")}
                    </span>
                  ))}
                  <span style={{ ...mono, color: "var(--k-muted)", marginTop: 4 }}>
                    TOTAL £{Math.round(snapshot.total ?? 0).toLocaleString("en-GB")} ·
                    signed {dateGB(project.accepted_at)}
                  </span>
                </div>
              ) : (
                missingNote(
                  "No signed scope snapshot — either the proposal isn't accepted yet or it predates snapshots. Changes since go through the quote flow."
                )
              )}
            </Panel>
          </Reveal>

          {/* Completed work */}
          <Reveal>
            <Panel label="// DONE" title="Completed work">
              {features.length === 0 && (shippedIssues ?? []).length === 0 ? (
                <p style={dim}>Nothing marked built or shipped yet.</p>
              ) : (
                <div className="flex flex-col gap-1" style={body}>
                  {features.map((f) => (
                    <span key={f.name}>✓ {f.name}</span>
                  ))}
                  {(shippedIssues ?? []).map((i) => (
                    <span key={i.id} style={{ color: "var(--k-muted)" }}>
                      ✓ {i.title}
                    </span>
                  ))}
                </div>
              )}
            </Panel>
          </Reveal>
        </div>

        <div className="flex flex-col gap-4">
          {/* Access references */}
          <Reveal>
            <Panel label="// ACCESS" title="Where everything lives">
              <div className="flex flex-col gap-1.5" style={body}>
                <span>Repo: {profile?.repo_full_name ?? "—"}</span>
                <span>Branch: {profile?.default_branch ?? "—"}</span>
                <span>Vercel: {profile?.vercel_project ?? "—"}</span>
                <span>Supabase: {profile?.supabase_ref ?? "—"}</span>
                <span>Stack: {profile?.stack ?? "—"}</span>
              </div>
              {profile?.runbook ? (
                <p style={{ ...dim, whiteSpace: "pre-wrap", marginTop: 10 }}>
                  {profile.runbook}
                </p>
              ) : (
                missingNote("No runbook — write one on the passport before handing over.")
              )}
              {profile?.quirks && (
                <p
                  style={{
                    ...dim,
                    whiteSpace: "pre-wrap",
                    marginTop: 8,
                    color: T.warning,
                  }}
                >
                  ⚠ {profile.quirks}
                </p>
              )}
            </Panel>
          </Reveal>

          {/* Client preferences */}
          <Reveal>
            <Panel label="// CLIENT" title="How they like to work">
              <p style={body}>
                {tenant?.contact_name ?? "—"}
                {tenant?.contact_email && (
                  <span style={{ color: "var(--k-muted)" }}>
                    {" "}
                    · {tenant.contact_email}
                  </span>
                )}
              </p>
              {profile?.client_preferences ? (
                <p style={{ ...dim, whiteSpace: "pre-wrap", marginTop: 6 }}>
                  {profile.client_preferences}
                </p>
              ) : (
                missingNote(
                  "No preferences recorded — add them on the passport runbook form."
                )
              )}
            </Panel>
          </Reveal>

          {/* Decisions */}
          <Reveal>
            <Panel label="// DECISIONS" title="Decisions that shaped it">
              {(decisions ?? []).length === 0 ? (
                missingNote(
                  "No decisions logged — record the big calls on the client hub."
                )
              ) : (
                <div className="flex flex-col gap-2">
                  {(decisions ?? []).map((d) => (
                    <div key={d.id}>
                      <span style={body}>{d.decision}</span>
                      <div style={{ ...mono, color: "var(--k-faint)", marginTop: 2 }}>
                        {dateGB(d.decided_at)}
                        {d.approver && <> · {d.approver}</>}
                        {d.impact && <> · {d.impact}</>}
                      </div>
                      {d.rationale && (
                        <div style={{ ...dim, fontSize: "0.8rem" }}>{d.rationale}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </Reveal>

          {/* Risks + open work */}
          <Reveal>
            <Panel label="// WATCH OUT" title="Open risks & work">
              {(risks ?? []).length === 0 && (openIssues ?? []).length === 0 ? (
                <p style={dim}>Nothing open — quiet account.</p>
              ) : (
                <div className="flex flex-col gap-1.5" style={body}>
                  {(risks ?? []).map((r) => (
                    <span key={r.id} style={{ color: T.warning }}>
                      ⚠ {r.title}
                      {r.owner && (
                        <span style={{ color: "var(--k-faint)" }}> — {r.owner}</span>
                      )}
                    </span>
                  ))}
                  {(openIssues ?? []).map((i) => (
                    <span key={i.id}>
                      {i.title}
                      <span style={{ color: "var(--k-faint)" }}>
                        {" "}
                        — {i.status.replace(/_/g, " ")}
                        {i.assignee && <> · {i.assignee}</>}
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </Panel>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
