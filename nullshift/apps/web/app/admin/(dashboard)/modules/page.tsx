import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { createClient } from "@nullshift/db";
import { requireStaff } from "@nullshift/auth/guards";
import { logAudit } from "@nullshift/db/audit";
import { T } from "@nullshift/ui/tokens";
import { PageHeader, Panel, StatusChip } from "@/components/app/AppKit";
import { Reveal } from "@/components/kyma";

/**
 * Module library — pre-planned, cached build prompts ("build Stripe billing",
 * "build the client portal") written once and compiled into any batch or
 * build plan. Global modules are the house library; a module pinned to a
 * system only appears when compiling for that system. The batch snapshots
 * whatever the prompt said at compile time, so editing here never rewrites
 * history.
 */

export const dynamic = "force-dynamic";

type ModuleRow = {
  id: string;
  key: string;
  title: string;
  summary: string;
  category: string | null;
  project_id: string | null;
  active: boolean;
  sort: number;
  updated_at: string;
};
type ProjectRef = { id: string; name: string };

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

async function createModule(formData: FormData) {
  "use server";
  if (!(await requireStaff()).ok) return;
  const title = String(formData.get("title") || "").trim();
  const summary = String(formData.get("summary") || "").trim();
  const prompt = String(formData.get("prompt") || "").trim();
  if (!title || !summary || !prompt) return;
  const key = slugify(String(formData.get("key") || "").trim() || title);
  if (!key) return;
  const category = String(formData.get("category") || "").trim() || null;
  const projectId = String(formData.get("project_id") || "") || null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("build_modules")
    .insert({ key, title, summary, prompt, category, project_id: projectId })
    .select("id")
    .single();
  if (error) {
    redirect(`/admin/modules?err=${encodeURIComponent(error.code === "23505" ? `A module with key "${key}" already exists.` : error.message)}`);
  }
  await logAudit({
    action: "module.created",
    target: `module:${data!.id}`,
    metadata: { key, title, pinned: Boolean(projectId) },
  });
  revalidatePath("/admin/modules");
  redirect(`/admin/modules/${data!.id}`);
}

export default async function ModulesPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>;
}) {
  const { err } = await searchParams;
  const supabase = await createClient();
  const [{ data: modules }, { data: projects }] = await Promise.all([
    supabase
      .from("build_modules")
      .select("id, key, title, summary, category, project_id, active, sort, updated_at")
      .order("sort")
      .order("title"),
    supabase.from("projects").select("id, name").order("name"),
  ]);
  const all = (modules ?? []) as ModuleRow[];
  const projectList = (projects ?? []) as ProjectRef[];
  const projectName = new Map(projectList.map((p) => [p.id, p.name]));
  const globals = all.filter((m) => !m.project_id);
  const pinned = all.filter((m) => m.project_id);

  const row = (m: ModuleRow, i: number) => (
    <Reveal key={m.id} delay={Math.min(i, 8) * 0.03}>
      <Link
        href={`/admin/modules/${m.id}`}
        className="flex items-baseline gap-3 px-4 py-3"
        style={{ borderTop: i ? "1px solid var(--k-border)" : "none" }}
      >
        <span style={{ ...mono, color: "var(--k-accent)", minWidth: 150 }}>{m.key}</span>
        <span className="flex-1 min-w-0">
          <span style={{ fontFamily: T.sans, fontSize: "0.9rem", fontWeight: 600, color: "var(--k-fg)" }}>
            {m.title}
          </span>
          <span className="block" style={{ ...body, marginTop: 2 }}>
            {m.summary}
          </span>
        </span>
        {m.category && <StatusChip tone="muted">{m.category}</StatusChip>}
        {m.project_id && (
          <StatusChip tone="accent">{projectName.get(m.project_id) ?? "pinned"}</StatusChip>
        )}
        {!m.active && <StatusChip tone="muted">retired</StatusChip>}
      </Link>
    </Reveal>
  );

  return (
    <div>
      <PageHeader
        index="05"
        label="Module library"
        title="Cached build prompts"
        lead="Pre-planned module briefs, written once and compiled into any batch or build plan. Batches snapshot the prompt at compile time — editing here never rewrites a shipped work order."
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

      <Reveal delay={0.05}>
        <Panel label="// HOUSE LIBRARY" title="Global modules" pad={false} className="mt-7">
          {globals.length === 0 ? (
            <p className="text-center py-6" style={body}>
              No modules yet — write the first one below.
            </p>
          ) : (
            <div className="flex flex-col">{globals.map(row)}</div>
          )}
        </Panel>
      </Reveal>

      {pinned.length > 0 && (
        <Reveal delay={0.08}>
          <Panel label="// PINNED" title="System-specific modules" pad={false} className="mt-5">
            <div className="flex flex-col">{pinned.map(row)}</div>
          </Panel>
        </Reveal>
      )}

      <Reveal delay={0.1}>
        <Panel label="// NEW MODULE" title="Write a build prompt once, reuse it everywhere" className="mt-5">
          <form action={createModule} className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-3">
              <Field label="Title" grow>
                <input name="title" style={inp} required maxLength={120} placeholder="Stripe billing" />
              </Field>
              <Field label="Key (blank = from title)">
                <input name="key" style={inp} maxLength={60} placeholder="stripe-billing" />
              </Field>
              <Field label="Category">
                <input name="category" style={inp} maxLength={40} placeholder="billing" />
              </Field>
            </div>
            <Field label="Summary — one line, shown in pickers and given to the AI planner">
              <input name="summary" style={inp} required maxLength={300} />
            </Field>
            <Field label="Prompt — the full build brief a Claude Code session receives">
              <textarea name="prompt" style={{ ...ta, minHeight: 180 }} required />
            </Field>
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Pin to one system (blank = global)">
                <select name="project_id" style={inp} defaultValue="">
                  <option value="">Global — house library</option>
                  {projectList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
              <SubmitButton style={btnPrimary} pendingLabel="Creating…">
                Create module
              </SubmitButton>
            </div>
          </form>
        </Panel>
      </Reveal>
    </div>
  );
}

/* ── local styles (KYMA voice, matching batches/systems pages) ── */

function Field({ label, children, grow }: { label: string; children: React.ReactNode; grow?: boolean }) {
  return (
    <label className={`flex flex-col gap-1.5 ${grow ? "flex-1 min-w-[220px]" : ""}`}>
      <span style={mono}>{label}</span>
      {children}
    </label>
  );
}

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
  fontSize: "0.82rem",
  lineHeight: 1.5,
  color: "var(--k-muted)",
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
const ta: React.CSSProperties = {
  ...inp,
  height: "auto",
  padding: 12,
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
