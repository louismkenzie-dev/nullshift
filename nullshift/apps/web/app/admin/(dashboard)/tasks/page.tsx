import { revalidatePath } from "next/cache";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { createClient } from "@nullshift/db";
import { logAudit } from "@nullshift/db/audit";
import { T } from "@nullshift/ui/tokens";
import { PageHeader, Panel } from "@/components/app/AppKit";
import { Reveal } from "@/components/kyma";

/**
 * Tasks board — the internal delivery engine, a Kanban over tasks.status across
 * all client projects. Staff-only (cross-tenant via RLS). Lean: create a task on
 * a project, then advance it through the lifecycle.
 */

export const dynamic = "force-dynamic";

type Task = {
  id: string;
  tenant_id: string;
  project_id: string;
  title: string;
  status: string;
  estimate_hours: number | null;
  origin: string;
};
type Project = { id: string; tenant_id: string; name: string };

const FLOW = [
  "backlog",
  "scoped",
  "approved",
  "in_progress",
  "review",
  "shipped",
] as const;
const NEXT: Record<string, string> = {
  backlog: "scoped",
  scoped: "approved",
  approved: "in_progress",
  in_progress: "review",
  review: "shipped",
};

async function createTask(formData: FormData) {
  "use server";
  const projectId = String(formData.get("project_id") || "");
  const title = String(formData.get("title") || "").trim();
  const estimate = Number(formData.get("estimate_hours") || 0) || null;
  if (!projectId || !title) return;
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("tenant_id")
    .eq("id", projectId)
    .single();
  if (!project) return;
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      tenant_id: project.tenant_id,
      project_id: projectId,
      title,
      estimate_hours: estimate,
      origin: "internal",
      status: "backlog",
    })
    .select("id")
    .single();
  if (!error && data) {
    await logAudit({
      action: "task.created",
      target: `task:${data.id}`,
      tenantId: project.tenant_id,
    });
  }
  revalidatePath("/admin/tasks");
}

async function advanceTask(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  const tenantId = String(formData.get("tenant_id") || "");
  const from = String(formData.get("from") || "");
  const next = NEXT[from];
  if (!next) return;
  const supabase = await createClient();
  await supabase.from("tasks").update({ status: next }).eq("id", id);
  await logAudit({
    action: `task.${next}`,
    target: `task:${id}`,
    tenantId,
    metadata: { from },
  });
  revalidatePath("/admin/tasks");
}

export default async function TasksPage() {
  const supabase = await createClient();
  const [{ data: tasks }, { data: projects }] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, tenant_id, project_id, title, status, estimate_hours, origin")
      .order("created_at"),
    supabase.from("projects").select("id, tenant_id, name").order("created_at"),
  ]);
  const taskList = (tasks ?? []) as Task[];
  const projectList = (projects ?? []) as Project[];
  const nameOf = (id: string) => projectList.find((p) => p.id === id)?.name ?? "—";

  return (
    <div>
      <PageHeader
        index="08"
        label="Tasks"
        title="Delivery tasks"
        lead="The internal delivery engine — every client project tracked across the lifecycle."
      />

      <Reveal className="block" delay={0.05}>
        <Panel label="New task" className="mt-7">
          <form action={createTask} className="flex items-center gap-2 flex-wrap">
            <select name="project_id" required defaultValue="" style={inp}>
              <option value="" disabled>
                Project…
              </option>
              {projectList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <input
              name="title"
              placeholder="Task title"
              required
              style={{ ...inp, width: 220 }}
            />
            <input
              name="estimate_hours"
              type="number"
              step="0.5"
              placeholder="hrs"
              style={{ ...inp, width: 70 }}
            />
            <SubmitButton style={btn("var(--k-surface)", "var(--k-fg)", true)}>
              + Task
            </SubmitButton>
          </form>
        </Panel>
      </Reveal>

      {projectList.length === 0 && (
        <p style={{ fontFamily: T.sans, color: "var(--k-muted)", marginTop: 22 }}>
          No projects yet — create one in Delivery.
        </p>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          alignItems: "start",
          marginTop: 22,
        }}
      >
        {FLOW.map((col, ci) => {
          const items = taskList.filter((t) => t.status === col);
          return (
            <Reveal key={col} delay={ci * 0.05}>
              <div
                className="k-kard"
                style={{ background: "var(--k-surface)", padding: 12 }}
              >
                <div
                  className="flex items-center justify-between"
                  style={{
                    marginBottom: 10,
                    paddingBottom: 8,
                    borderBottom: "1px solid var(--k-border)",
                  }}
                >
                  <span
                    style={{
                      fontFamily: T.mono,
                      fontSize: "10px",
                      fontWeight: 500,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "var(--k-muted)",
                    }}
                  >
                    {col.replace(/_/g, " ")}
                  </span>
                  <span
                    style={{
                      fontFamily: T.mono,
                      fontSize: "10px",
                      color: items.length ? "var(--k-accent)" : "var(--k-faint)",
                    }}
                  >
                    {items.length}
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {items.map((t) => (
                    <div
                      key={t.id}
                      className="k-kard-h"
                      style={{
                        background: "var(--k-bg)",
                        border: "1px solid var(--k-border)",
                        borderRadius: 0,
                        padding: "10px 11px",
                      }}
                    >
                      <div
                        style={{
                          fontFamily: T.sans,
                          fontWeight: 600,
                          fontSize: "0.84rem",
                          color: "var(--k-fg)",
                          lineHeight: 1.35,
                        }}
                      >
                        {t.title}
                      </div>
                      <div
                        style={{
                          fontFamily: T.mono,
                          fontSize: "10px",
                          letterSpacing: "0.04em",
                          color: "var(--k-faint)",
                          marginTop: 5,
                        }}
                      >
                        {nameOf(t.project_id)}
                        {t.estimate_hours != null && <> · {t.estimate_hours}h</>}
                      </div>
                      {NEXT[t.status] && (
                        <form action={advanceTask} style={{ marginTop: 9 }}>
                          <input type="hidden" name="id" value={t.id} />
                          <input type="hidden" name="tenant_id" value={t.tenant_id} />
                          <input type="hidden" name="from" value={t.status} />
                          <SubmitButton
                            style={{
                              fontFamily: T.mono,
                              fontSize: "10px",
                              fontWeight: 500,
                              letterSpacing: "0.06em",
                              textTransform: "uppercase",
                              height: 26,
                              paddingInline: 9,
                              background: "var(--k-surface)",
                              color: "var(--k-accent)",
                              border: "1px solid var(--k-border)",
                              borderRadius: 0,
                              cursor: "pointer",
                            }}
                          >
                            → {NEXT[t.status].replace(/_/g, " ")}
                          </SubmitButton>
                        </form>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          );
        })}
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
