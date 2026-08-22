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

/**
 * Module detail — edit the cached build prompt. The key is immutable once
 * created (batches snapshot by key, plans reference by key); everything else
 * is a living document. Retire instead of delete: retired modules vanish from
 * pickers but stay for provenance in old batches.
 */

export const dynamic = "force-dynamic";

type ModuleFull = {
  id: string;
  key: string;
  title: string;
  summary: string;
  prompt: string;
  category: string | null;
  project_id: string | null;
  active: boolean;
  sort: number;
  created_at: string;
  updated_at: string;
};

const pagePath = (id: string) => `/admin/modules/${id}`;

async function saveModule(formData: FormData) {
  "use server";
  if (!(await requireStaff()).ok) return;
  const id = String(formData.get("id") || "");
  const title = String(formData.get("title") || "").trim();
  const summary = String(formData.get("summary") || "").trim();
  const prompt = String(formData.get("prompt") || "").trim();
  if (!id || !title || !summary || !prompt) return;
  const category = String(formData.get("category") || "").trim() || null;
  const projectId = String(formData.get("project_id") || "") || null;
  const sortRaw = Number(formData.get("sort"));
  const sort = Number.isFinite(sortRaw) ? sortRaw : 100;

  const supabase = await createClient();
  const { error } = await supabase
    .from("build_modules")
    .update({ title, summary, prompt, category, project_id: projectId, sort })
    .eq("id", id);
  if (error) redirect(`${pagePath(id)}?err=${encodeURIComponent(error.message)}`);
  await logAudit({ action: "module.saved", target: `module:${id}`, metadata: { title } });
  revalidatePath(pagePath(id));
  revalidatePath("/admin/modules");
}

async function toggleActive(formData: FormData) {
  "use server";
  if (!(await requireStaff()).ok) return;
  const id = String(formData.get("id") || "");
  if (!id) return;
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("build_modules")
    .select("id, active, key")
    .eq("id", id)
    .maybeSingle();
  if (!row) return;
  await supabase.from("build_modules").update({ active: !row.active }).eq("id", id);
  await logAudit({
    action: row.active ? "module.retired" : "module.reactivated",
    target: `module:${id}`,
    metadata: { key: row.key },
  });
  revalidatePath(pagePath(id));
  revalidatePath("/admin/modules");
}

export default async function ModuleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ err?: string }>;
}) {
  const { id } = await params;
  const { err } = await searchParams;
  const supabase = await createClient();
  const [{ data: row }, { data: projects }] = await Promise.all([
    supabase.from("build_modules").select("*").eq("id", id).maybeSingle(),
    supabase.from("projects").select("id, name").order("name"),
  ]);
  if (!row) notFound();
  const m = row as ModuleFull;
  const projectList = (projects ?? []) as { id: string; name: string }[];

  return (
    <div>
      <PageHeader
        index="05"
        label="Module library"
        title={m.title}
        lead={m.summary}
        actions={
          <div className="flex items-center gap-2">
            <StatusChip tone={m.active ? "success" : "muted"}>
              {m.active ? "active" : "retired"}
            </StatusChip>
            {m.category && <StatusChip tone="muted">{m.category}</StatusChip>}
          </div>
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

      <Reveal delay={0.05}>
        <Panel
          label="// EDIT"
          title={
            <span>
              <code style={{ fontFamily: T.mono, fontSize: "0.8rem", color: "var(--k-accent)" }}>{m.key}</code>
              <span style={{ ...mono, marginLeft: 10 }}>key is immutable — batches snapshot by it</span>
            </span>
          }
          actions={<CopyButton text={m.prompt} label="Copy prompt" />}
          className="mt-7"
        >
          <form action={saveModule} className="flex flex-col gap-3">
            <input type="hidden" name="id" value={m.id} />
            <div className="flex flex-wrap gap-3">
              <Field label="Title" grow>
                <input name="title" style={inp} required maxLength={120} defaultValue={m.title} />
              </Field>
              <Field label="Category">
                <input name="category" style={inp} maxLength={40} defaultValue={m.category ?? ""} />
              </Field>
              <Field label="Sort">
                <input name="sort" type="number" style={{ ...inp, width: 90 }} defaultValue={m.sort} />
              </Field>
            </div>
            <Field label="Summary — one line, shown in pickers and given to the AI planner">
              <input name="summary" style={inp} required maxLength={300} defaultValue={m.summary} />
            </Field>
            <Field label="Prompt — the full build brief a Claude Code session receives">
              <textarea name="prompt" style={{ ...ta, minHeight: 260 }} required defaultValue={m.prompt} />
            </Field>
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Pin to one system (blank = global)">
                <select name="project_id" style={inp} defaultValue={m.project_id ?? ""}>
                  <option value="">Global — house library</option>
                  {projectList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
              <SubmitButton style={btnPrimary} pendingLabel="Saving…">
                Save module
              </SubmitButton>
            </div>
          </form>
          <div
            className="flex items-center justify-between gap-3 flex-wrap"
            style={{ borderTop: "1px solid var(--k-border)", marginTop: 16, paddingTop: 14 }}
          >
            <p style={body}>
              {m.active
                ? "Retiring hides this module from pickers; shipped batches keep their snapshot."
                : "Retired — invisible in pickers. Reactivate to use it again."}
            </p>
            <form action={toggleActive}>
              <input type="hidden" name="id" value={m.id} />
              <SubmitButton style={btnOutline}>{m.active ? "Retire module" : "Reactivate"}</SubmitButton>
            </form>
          </div>
        </Panel>
      </Reveal>

      <p style={{ ...mono, marginTop: 14 }}>
        <Link href="/admin/modules" style={{ color: "var(--k-accent)" }}>
          ← All modules
        </Link>
      </p>
    </div>
  );
}

/* ── local styles ── */

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
const btnOutline: React.CSSProperties = {
  ...btnPrimary,
  background: "var(--k-surface)",
  color: "var(--k-fg)",
  border: "1px solid var(--k-border)",
};
