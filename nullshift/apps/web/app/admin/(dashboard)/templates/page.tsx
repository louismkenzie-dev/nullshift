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
 * Template bank — the reusable system blueprints Nullshift stamps new client
 * systems from. Each template records a GitHub template repo, its feature list
 * and stack; "Stamp a new system" turns one into a real tenant + project +
 * system passport (env checklist included) in one click, then hands off to the
 * system page for provisioning.
 */

export const dynamic = "force-dynamic";

type TemplateRow = {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  features: unknown;
  stack: Record<string, string> | null;
  repo_template: string | null;
  status: string;
  times_used: number;
};
type Tenant = { id: string; name: string };

const TEMPLATE_TONE: Record<string, "success" | "warning" | "muted"> = {
  ready: "success",
  draft: "warning",
  retired: "muted",
};

/** jsonb features can be [{name}] (canonical) or plain strings — normalise. */
function featureNames(features: unknown): string[] {
  if (!Array.isArray(features)) return [];
  return features
    .map((f) => (typeof f === "string" ? f : ((f as { name?: string })?.name ?? "")))
    .filter(Boolean);
}

/* ── Server actions ─────────────────────────────────────────────── */

async function createTemplate(formData: FormData) {
  "use server";
  if (!(await requireStaff()).ok) return;
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  const slugIn = String(formData.get("slug") || "").trim();
  const slug = (slugIn || name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const description = String(formData.get("description") || "").trim() || null;
  const repoTemplate = String(formData.get("repo_template") || "").trim() || null;
  const features = String(formData.get("features") || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((n) => ({ name: n }));
  const stack: Record<string, string> = {};
  // Keyed to match the passport's STACK_KEYS ("db", not "database"), so
  // stamped systems render every stack value on /admin/systems/[id].
  for (const [field, key] of [
    ["framework", "framework"],
    ["database", "db"],
    ["payments", "payments"],
    ["email", "email"],
    ["ai", "ai"],
  ] as const) {
    const v = String(formData.get(field) || "").trim();
    if (v) stack[key] = v;
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("system_templates")
    .insert({
      name,
      slug: slug || null,
      description,
      repo_template: repoTemplate,
      features,
      stack,
      status: "ready",
    })
    .select("id")
    .single();
  if (error) {
    console.error("createTemplate:", error.message);
    return;
  }
  await logAudit({
    action: "template.created",
    target: `template:${data.id}`,
    metadata: { name, slug, repo_template: repoTemplate },
  });
  revalidatePath("/admin/templates");
}

/**
 * Stamp a new system from a template: tenant (existing or brand-new) + project
 * + system passport with the provisioning env checklist, in one click. Redirects
 * to the system page, which renders the checklist.
 */
async function stampSystem(formData: FormData) {
  "use server";
  if (!(await requireStaff()).ok) return;
  const templateId = String(formData.get("template_id") || "");
  if (!templateId) return;
  const supabase = await createClient();
  const { data: template } = await supabase
    .from("system_templates")
    .select("id, name, repo_template, features, stack, times_used")
    .eq("id", templateId)
    .maybeSingle();
  if (!template) return;

  // Resolve the tenant: an existing client, or a brand-new one.
  let tenantId = String(formData.get("tenant_id") || "");
  let tenantName = "";
  if (tenantId) {
    const { data: t } = await supabase
      .from("tenants")
      .select("id, name")
      .eq("id", tenantId)
      .maybeSingle();
    if (!t) return;
    tenantName = t.name as string;
  } else {
    const businessName = String(formData.get("business_name") || "").trim();
    if (!businessName) return;
    const { data: t, error } = await supabase
      .from("tenants")
      .insert({
        name: businessName,
        type: "client",
        status: "active",
        contact_name: String(formData.get("contact_name") || "").trim() || null,
        contact_email: String(formData.get("contact_email") || "").trim() || null,
      })
      .select("id, name")
      .single();
    if (error || !t) {
      console.error("stampSystem tenant insert:", error?.message);
      return;
    }
    tenantId = t.id as string;
    tenantName = t.name as string;
  }

  const { data: project, error: projErr } = await supabase
    .from("projects")
    .insert({
      tenant_id: tenantId,
      name: `${template.name} — ${tenantName}`,
      stage: "build",
    })
    .select("id")
    .single();
  if (projErr || !project) {
    console.error("stampSystem project insert:", projErr?.message);
    return;
  }

  const features = featureNames(template.features).map((n) => ({
    name: n,
    status: "planned",
    note: null,
  }));
  const envChecklist = [
    {
      name: `Create repo from template ${template.repo_template ?? "(set repo_template)"}`,
      done: false,
    },
    { name: "Create Supabase project + run base migrations", done: false },
    { name: "Create Vercel project + connect repo", done: false },
    { name: "Set env vars (Supabase, Stripe, Resend keys)", done: false },
    { name: "Install claude-code-action + ANTHROPIC_API_KEY secret on the repo", done: false },
    { name: "Point domain + go-live checklist", done: false },
  ];
  const { error: profileErr } = await supabase.from("system_profiles").insert({
    project_id: project.id,
    tenant_id: tenantId,
    template_id: template.id,
    stack: template.stack ?? {},
    features,
    default_branch: "main",
    env_checklist: envChecklist,
  });
  if (profileErr) console.error("stampSystem profile insert:", profileErr.message);

  await supabase
    .from("system_templates")
    .update({ times_used: Number(template.times_used ?? 0) + 1 })
    .eq("id", template.id);

  await logAudit({
    action: "system.stamped",
    target: `project:${project.id}`,
    tenantId,
    metadata: { template: template.name, template_id: template.id },
  });
  revalidatePath("/admin/templates");
  redirect(`/admin/systems/${project.id}`);
}

/* ── Page ───────────────────────────────────────────────────────── */

export default async function TemplatesPage() {
  const supabase = await createClient();
  const [{ data: templates }, { data: tenants }] = await Promise.all([
    supabase
      .from("system_templates")
      .select("id, name, slug, description, features, stack, repo_template, status, times_used")
      .order("created_at"),
    supabase.from("tenants").select("id, name").eq("type", "client").order("name"),
  ]);
  const templateList = (templates ?? []) as TemplateRow[];
  const tenantList = (tenants ?? []) as Tenant[];
  const stampable = templateList.filter((t) => t.status !== "retired");

  return (
    <div>
      <PageHeader
        index="11"
        label="Templates"
        title="Template bank"
        lead="Reusable system blueprints — stamp a proven system onto a new client in one click."
      />

      {/* ── Template cards ────────────────────────────────────── */}
      <div className="mt-7">
        <div
          style={{
            fontFamily: T.mono,
            fontSize: "0.66rem",
            fontWeight: 500,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--k-muted)",
            marginBottom: 12,
          }}
        >
          {"// TEMPLATES"}
        </div>
        {templateList.length === 0 ? (
          <p
            style={{
              fontFamily: T.sans,
              fontSize: "0.85rem",
              color: "var(--k-muted)",
            }}
          >
            No templates yet — capture your first one below.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 items-stretch">
            {templateList.map((t, i) => {
              const feats = featureNames(t.features);
              return (
                <Reveal key={t.id} delay={Math.min(i, 8) * 0.05} className="block h-full">
                  <div
                    className="k-kard flex flex-col gap-3 h-full"
                    style={{ background: "var(--k-surface)", padding: 18 }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span
                        style={{
                          fontFamily: T.sans,
                          fontWeight: 700,
                          fontSize: "1.05rem",
                          letterSpacing: "-0.02em",
                          textTransform: "uppercase",
                          color: "var(--k-fg)",
                          lineHeight: 1.2,
                        }}
                      >
                        {t.name}
                      </span>
                      <StatusChip tone={TEMPLATE_TONE[t.status] ?? "muted"}>
                        {t.status}
                      </StatusChip>
                    </div>
                    {t.description && (
                      <p
                        style={{
                          fontFamily: T.sans,
                          fontSize: "0.84rem",
                          lineHeight: 1.5,
                          color: "var(--k-muted)",
                        }}
                      >
                        {t.description}
                      </p>
                    )}
                    {feats.length > 0 && (
                      <div className="flex flex-col gap-1">
                        {feats.slice(0, 6).map((f, fi) => (
                          <span
                            key={fi}
                            style={{
                              fontFamily: T.mono,
                              fontSize: "11px",
                              letterSpacing: "0.04em",
                              color: "var(--k-muted)",
                            }}
                          >
                            ▪ {f}
                          </span>
                        ))}
                        {feats.length > 6 && (
                          <span
                            style={{
                              fontFamily: T.mono,
                              fontSize: "11px",
                              letterSpacing: "0.04em",
                              color: "var(--k-faint)",
                            }}
                          >
                            +{feats.length - 6} more
                          </span>
                        )}
                      </div>
                    )}
                    <div
                      className="flex items-center justify-between gap-3 flex-wrap mt-auto"
                      style={{
                        borderTop: "1px solid var(--k-border)",
                        paddingTop: 12,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: T.mono,
                          fontSize: "11px",
                          letterSpacing: "0.04em",
                          color: t.repo_template ? "var(--k-muted)" : "var(--k-faint)",
                        }}
                      >
                        {t.repo_template ?? "no repo template"}
                      </span>
                      <span
                        style={{
                          fontFamily: T.mono,
                          fontSize: "10px",
                          fontWeight: 500,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color: t.times_used ? "var(--k-accent)" : "var(--k-faint)",
                        }}
                      >
                        Used {t.times_used} time{t.times_used === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        )}
      </div>

      {/* ── New template ──────────────────────────────────────── */}
      <Reveal className="block" delay={0.1}>
        <Panel label="// NEW TEMPLATE" title="Capture a blueprint" className="mt-7">
          <form action={createTemplate} className="grid gap-2 md:grid-cols-2">
            <input name="name" placeholder="Name" required style={inp} />
            <input name="slug" placeholder="Slug (optional — derived from name)" style={inp} />
            <input
              name="repo_template"
              placeholder="GitHub template repo (owner/repo)"
              className="md:col-span-2"
              style={inp}
            />
            <textarea
              name="description"
              placeholder="What this system does, in a sentence or two"
              rows={2}
              className="md:col-span-2"
              style={txt}
            />
            <textarea
              name="features"
              placeholder={"Features — one per line\nBooking calendar\nStripe payments\nClient portal"}
              rows={4}
              className="md:col-span-2"
              style={txt}
            />
            <div className="md:col-span-2 flex items-center gap-2 flex-wrap">
              <input name="framework" defaultValue="nextjs" placeholder="Framework" style={{ ...inp, width: 120 }} />
              <input name="database" defaultValue="supabase" placeholder="Database" style={{ ...inp, width: 120 }} />
              <input name="payments" placeholder="Payments" style={{ ...inp, width: 120 }} />
              <input name="email" defaultValue="resend" placeholder="Email" style={{ ...inp, width: 120 }} />
              <input name="ai" placeholder="AI" style={{ ...inp, width: 120 }} />
            </div>
            <div className="md:col-span-2">
              <SubmitButton style={btn("var(--k-surface)", "var(--k-fg)", true)}>
                + Template
              </SubmitButton>
            </div>
          </form>
        </Panel>
      </Reveal>

      {/* ── Stamp a new system ────────────────────────────────── */}
      <Reveal className="block" delay={0.15}>
        <Panel label="// STAMP A NEW SYSTEM" title="One-click provisioning" className="mt-7">
          <p
            style={{
              fontFamily: T.sans,
              fontSize: "0.84rem",
              lineHeight: 1.5,
              color: "var(--k-muted)",
              maxWidth: "64ch",
              marginBottom: 14,
            }}
          >
            Pick a template, pick (or create) the client, and this creates the tenant,
            the build project and the system passport with its provisioning checklist —
            then takes you straight to the system page.
          </p>
          {stampable.length === 0 ? (
            <p style={{ fontFamily: T.sans, fontSize: "0.85rem", color: "var(--k-muted)" }}>
              No usable templates yet — add one above first.
            </p>
          ) : (
            <form action={stampSystem} className="flex flex-col gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <select name="template_id" required defaultValue="" style={inp}>
                  <option value="" disabled>
                    Template…
                  </option>
                  {stampable.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <select name="tenant_id" defaultValue="" style={inp}>
                  <option value="">New client…</option>
                  {tenantList.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div
                style={{
                  fontFamily: T.mono,
                  fontSize: "10px",
                  fontWeight: 500,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--k-faint)",
                  marginTop: 4,
                }}
              >
                New client only — leave blank when picking an existing client
              </div>
              <div className="grid gap-2 md:grid-cols-3">
                <input name="business_name" placeholder="Business name" style={inp} />
                <input name="contact_name" placeholder="Contact name" style={inp} />
                <input name="contact_email" type="email" placeholder="Contact email" style={inp} />
              </div>
              <div style={{ marginTop: 6 }}>
                <SubmitButton
                  pendingLabel="Stamping…"
                  style={btn("var(--k-accent)", "var(--k-on-accent)")}
                >
                  Stamp system →
                </SubmitButton>
              </div>
            </form>
          )}
        </Panel>
      </Reveal>
    </div>
  );
}

/* ── Local style consts (house pattern) ─────────────────────────── */

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
const txt = {
  ...inp,
  height: "auto",
  padding: 12,
  resize: "vertical",
  lineHeight: 1.5,
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
