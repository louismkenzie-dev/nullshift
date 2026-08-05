import { revalidatePath } from "next/cache";
import Link from "next/link";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { createClient } from "@nullshift/db";
import { requireStaff } from "@nullshift/auth/guards";
import { logAudit } from "@nullshift/db/audit";
import { T } from "@nullshift/ui/tokens";
import { PageHeader, Panel, StatusChip } from "@/components/app/AppKit";
import { Reveal } from "@/components/kyma";
import { parseIngest } from "@/lib/ops/ingest";
import {
  KIND_LABEL,
  OPEN_STATUSES,
  SEVERITY_META,
  SOURCE_LABEL,
  type IssueRow,
  type IssueSource,
} from "@/lib/ops/issues";

/**
 * Inbox — the WhatsApp/Zoom ingest funnel. Paste a chat export, call
 * transcript or forwarded email against a project; Claude splits it into
 * draft issues (hidden from the client) which are confirmed, kept private
 * or discarded below. Degrades to filing the raw paste as a single issue
 * when no API key is configured.
 */

export const dynamic = "force-dynamic";

type Tenant = { id: string; name: string };
type Project = { id: string; tenant_id: string; name: string };

const PASTE_SOURCES: IssueSource[] = ["whatsapp", "zoom", "email", "phone"];

// ── server actions ─────────────────────────────────────────────

async function ingestSource(formData: FormData) {
  "use server";
  if (!(await requireStaff()).ok) return;
  const projectId = String(formData.get("project_id") || "");
  const sourceRaw = String(formData.get("source") || "whatsapp");
  const source = (PASTE_SOURCES as string[]).includes(sourceRaw) ? sourceRaw : "whatsapp";
  const text = String(formData.get("text") || "").trim();
  if (!projectId || !text) return;

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, tenant_id, name")
    .eq("id", projectId)
    .single();
  if (!project) return;
  const [{ data: tenant }, { data: openRows }] = await Promise.all([
    supabase.from("tenants").select("id, name").eq("id", project.tenant_id).single(),
    supabase
      .from("issues")
      .select("title")
      .eq("project_id", projectId)
      .in("status", OPEN_STATUSES),
  ]);

  const drafts = await parseIngest({
    text,
    systemName: project.name,
    clientName: tenant?.name ?? "the client",
    existingOpenTitles: ((openRows ?? []) as { title: string }[]).map((r) => r.title),
  });

  const now = new Date().toISOString();
  let count = 0;
  if (!drafts) {
    // No API key or the call failed — file the raw paste as one issue so
    // nothing is lost, and triage it by hand in the Issue bank.
    const title =
      text.split(/\s+/).slice(0, 8).join(" ").slice(0, 140) || "Pasted source";
    await supabase.from("issues").insert({
      tenant_id: project.tenant_id,
      project_id: project.id,
      source,
      kind: "task",
      title,
      description: text,
      status: "new",
      client_visible: false,
    });
    count = 1;
  } else if (drafts.length > 0) {
    await supabase.from("issues").insert(
      drafts.map((d) => ({
        tenant_id: project.tenant_id,
        project_id: project.id,
        source,
        kind: d.kind,
        severity: d.severity,
        title: d.title,
        description: d.description,
        source_quote: d.source_quote,
        client_visible: false,
        status: "new",
        promised_at: d.is_promise ? now : null,
        promised_note: d.promised_note,
        ai: { from: "ingest" },
      }))
    );
    count = drafts.length;
  }

  await logAudit({
    action: "inbox.ingested",
    target: `project:${projectId}`,
    tenantId: project.tenant_id,
    metadata: { source, count, parsed: drafts !== null },
  });
  revalidatePath("/admin/inbox");
  revalidatePath("/admin/issues");
}

async function confirmIssue(formData: FormData) {
  "use server";
  if (!(await requireStaff()).ok) return;
  const id = String(formData.get("id") || "");
  const tenantId = String(formData.get("tenant_id") || "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("issues").update({ client_visible: true }).eq("id", id);
  await logAudit({ action: "issue.confirmed", target: `issue:${id}`, tenantId });
  revalidatePath("/admin/inbox");
  revalidatePath("/admin/issues");
}

async function confirmPrivate(formData: FormData) {
  "use server";
  if (!(await requireStaff()).ok) return;
  const id = String(formData.get("id") || "");
  const tenantId = String(formData.get("tenant_id") || "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("issues").update({ status: "triaged" }).eq("id", id);
  await logAudit({ action: "issue.confirmed_private", target: `issue:${id}`, tenantId });
  revalidatePath("/admin/inbox");
  revalidatePath("/admin/issues");
}

async function discardIssue(formData: FormData) {
  "use server";
  if (!(await requireStaff()).ok) return;
  const id = String(formData.get("id") || "");
  const tenantId = String(formData.get("tenant_id") || "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("issues").delete().eq("id", id);
  await logAudit({ action: "issue.discarded", target: `issue:${id}`, tenantId });
  revalidatePath("/admin/inbox");
  revalidatePath("/admin/issues");
}

// ── page ───────────────────────────────────────────────────────

export default async function InboxPage() {
  const supabase = await createClient();
  const [{ data: tenantRows }, { data: projectRows }, { data: draftRows }] =
    await Promise.all([
      supabase.from("tenants").select("id, name").order("name"),
      supabase.from("projects").select("id, tenant_id, name").order("created_at"),
      supabase
        .from("issues")
        .select("*")
        .eq("client_visible", false)
        .eq("status", "new")
        .order("created_at", { ascending: false }),
    ]);
  const tenants = (tenantRows ?? []) as Tenant[];
  const projects = (projectRows ?? []) as Project[];
  const drafts = (draftRows ?? []) as IssueRow[];
  const tenantName = (id: string) => tenants.find((t) => t.id === id)?.name ?? "—";
  const projectOptions = projects
    .map((p) => ({ id: p.id, label: `${tenantName(p.tenant_id)} — ${p.name}` }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const aiConfigured = Boolean(process.env.ANTHROPIC_API_KEY);

  return (
    <div>
      <PageHeader
        index="11"
        label="Ops"
        title="Ingest inbox"
        lead="Paste a WhatsApp export, Zoom transcript or forwarded email — it gets split into draft issues for you to confirm."
      />

      {/* ── Paste source ────────────────────────────────────── */}
      <Reveal className="block" delay={0.05}>
        <Panel label="// PASTE SOURCE" className="mt-7">
          <form action={ingestSource} className="flex flex-col gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <select name="project_id" required defaultValue="" style={inp}>
                <option value="" disabled>
                  Client — project…
                </option>
                {projectOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <select name="source" defaultValue="whatsapp" style={inp}>
                {PASTE_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {SOURCE_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              name="text"
              required
              rows={9}
              placeholder="Paste the chat export or transcript here…"
              style={{
                ...inp,
                height: "auto",
                padding: 12,
                resize: "vertical" as const,
                lineHeight: 1.6,
              }}
            />
            <div className="flex items-center gap-3 flex-wrap">
              <SubmitButton
                style={btn("var(--k-accent)", "var(--k-on-accent)")}
                pendingLabel="Parsing…"
              >
                Ingest
              </SubmitButton>
              {!aiConfigured && (
                <span
                  style={{ fontFamily: T.sans, fontSize: "0.82rem", color: "var(--k-faint)" }}
                >
                  Add ANTHROPIC_API_KEY to enable AI parsing — pasting currently files
                  the raw text as a single issue.
                </span>
              )}
            </div>
          </form>
        </Panel>
      </Reveal>

      {/* ── Awaiting review ─────────────────────────────────── */}
      <Reveal className="block" delay={0.08}>
        <Panel
          label="// AWAITING REVIEW"
          pad={false}
          className="mt-5"
          actions={
            <Link href="/admin/issues" className="kb kb-outline kb-sm">
              Open in Issues
            </Link>
          }
        >
          {drafts.length === 0 ? (
            <p
              className="text-center py-7"
              style={{ fontFamily: T.sans, fontSize: "0.85rem", color: "var(--k-muted)" }}
            >
              Nothing awaiting review — paste a source above to create drafts.
            </p>
          ) : (
            drafts.map((d, i) => (
              <Reveal key={d.id} delay={Math.min(i, 8) * 0.04}>
                <div
                  className="flex flex-col gap-2"
                  style={{
                    padding: "13px 18px",
                    borderTop: i ? "1px solid var(--k-border)" : "none",
                  }}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      style={{
                        fontFamily: T.sans,
                        fontWeight: 600,
                        fontSize: "0.88rem",
                        color: "var(--k-fg)",
                      }}
                    >
                      {d.title}
                    </span>
                    <StatusChip tone="muted">{KIND_LABEL[d.kind]}</StatusChip>
                    <StatusChip tone={SEVERITY_META[d.severity].tone}>
                      {SEVERITY_META[d.severity].label}
                    </StatusChip>
                    {d.promised_at && <StatusChip tone="warning">promised</StatusChip>}
                    <span
                      className="ml-auto"
                      style={{ fontFamily: T.mono, fontSize: "10px", color: "var(--k-faint)" }}
                    >
                      {tenantName(d.tenant_id)} · {SOURCE_LABEL[d.source]}
                    </span>
                  </div>
                  {d.source_quote && (
                    <p
                      className="line-clamp-2"
                      style={{
                        fontFamily: T.mono,
                        fontSize: "11px",
                        lineHeight: 1.6,
                        color: "var(--k-faint)",
                        margin: 0,
                        maxWidth: "80ch",
                      }}
                    >
                      {d.source_quote}
                    </p>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    <form action={confirmIssue}>
                      <input type="hidden" name="id" value={d.id} />
                      <input type="hidden" name="tenant_id" value={d.tenant_id} />
                      <SubmitButton style={btnSm("var(--k-accent)", "var(--k-on-accent)")}>
                        Confirm
                      </SubmitButton>
                    </form>
                    <form action={confirmPrivate}>
                      <input type="hidden" name="id" value={d.id} />
                      <input type="hidden" name="tenant_id" value={d.tenant_id} />
                      <SubmitButton style={btnSm("var(--k-surface)", "var(--k-fg)", true)}>
                        Confirm private
                      </SubmitButton>
                    </form>
                    <form action={discardIssue}>
                      <input type="hidden" name="id" value={d.id} />
                      <input type="hidden" name="tenant_id" value={d.tenant_id} />
                      <SubmitButton style={btnSm("transparent", "var(--k-muted)", true)}>
                        Discard
                      </SubmitButton>
                    </form>
                  </div>
                </div>
              </Reveal>
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
const btnSm = (bg: string, fg: string, outline = false) => ({
  ...btn(bg, fg, outline),
  fontSize: "10px",
  height: 30,
  paddingInline: 11,
});
