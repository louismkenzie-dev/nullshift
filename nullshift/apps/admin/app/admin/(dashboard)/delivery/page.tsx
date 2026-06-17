import { revalidatePath } from "next/cache";
import { createClient } from "@nullshift/db";
import { logAudit } from "@nullshift/db/audit";
import { uploadDeliverable } from "@nullshift/db/documents";
import { T } from "@nullshift/ui/tokens";

/**
 * Delivery — the ops-hub view of client tenants → projects → change requests.
 * Staff (is_internal_staff) get cross-tenant read via RLS. Drives the change-
 * request workflow: submitted → triaged → scoped → awaiting_approval →
 * (client approves in the portal) → approved → in_progress → review → shipped.
 * Every transition writes an audit_log entry. Server-action forms only.
 */

export const dynamic = "force-dynamic";

type CR = {
  id: string;
  tenant_id: string;
  project_id: string;
  description: string;
  status: string;
  estimate_hours: number | null;
  quoted_price: number | null;
};
type Project = { id: string; tenant_id: string; name: string; stage: string };
type Tenant = { id: string; name: string; vertical: string | null };
type Doc = {
  id: string;
  project_id: string;
  kind: string;
  storage_path: string;
  version: number;
};

const NEXT_STATUS: Record<string, string> = {
  approved: "in_progress",
  in_progress: "review",
  review: "shipped",
};

// ── Server actions ─────────────────────────────────────────────
async function createProject(formData: FormData) {
  "use server";
  const tenantId = String(formData.get("tenant_id") || "");
  const name = String(formData.get("name") || "").trim();
  if (!tenantId || !name) return;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .insert({
      tenant_id: tenantId,
      name,
      stage: "build",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (!error && data) {
    await logAudit({
      action: "project.created",
      target: `project:${data.id}`,
      tenantId,
      metadata: { name },
    });
  }
  revalidatePath("/admin/delivery");
}

async function triageRequest(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  const tenantId = String(formData.get("tenant_id") || "");
  const supabase = await createClient();
  await supabase.from("change_requests").update({ status: "triaged" }).eq("id", id);
  await logAudit({
    action: "change_request.triaged",
    target: `change_request:${id}`,
    tenantId,
  });
  revalidatePath("/admin/delivery");
}

async function scopeRequest(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  const tenantId = String(formData.get("tenant_id") || "");
  const hours = Number(formData.get("estimate_hours") || 0);
  const price = Number(formData.get("quoted_price") || 0);
  const supabase = await createClient();
  // Scope it, then put it up for the client to approve in the portal.
  await supabase
    .from("change_requests")
    .update({ status: "awaiting_approval", estimate_hours: hours, quoted_price: price })
    .eq("id", id);
  await logAudit({
    action: "change_request.scoped",
    target: `change_request:${id}`,
    tenantId,
    metadata: { estimate_hours: hours, quoted_price: price },
  });
  revalidatePath("/admin/delivery");
}

async function advanceRequest(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  const tenantId = String(formData.get("tenant_id") || "");
  const from = String(formData.get("from") || "");
  const next = NEXT_STATUS[from];
  if (!next) return;
  const supabase = await createClient();
  await supabase.from("change_requests").update({ status: next }).eq("id", id);
  await logAudit({
    action: `change_request.${next}`,
    target: `change_request:${id}`,
    tenantId,
    metadata: { from },
  });
  revalidatePath("/admin/delivery");
}

async function uploadDoc(formData: FormData) {
  "use server";
  const tenantId = String(formData.get("tenant_id") || "");
  const projectId = String(formData.get("project_id") || "");
  const kind = String(formData.get("kind") || "asset");
  const file = formData.get("file");
  if (!tenantId || !projectId || !(file instanceof File) || file.size === 0) return;
  const supabase = await createClient();
  const res = await uploadDeliverable(supabase, {
    tenantId,
    projectId,
    kind,
    fileName: file.name,
    body: await file.arrayBuffer(),
    contentType: file.type || undefined,
  });
  if (res.ok) {
    await logAudit({
      action: "document.uploaded",
      target: `project:${projectId}`,
      tenantId,
      metadata: { path: res.path, version: res.version },
    });
  } else {
    console.error("uploadDoc failed:", res.error);
  }
  revalidatePath("/admin/delivery");
}

// ── UI bits ────────────────────────────────────────────────────
const STATUS_TONE: Record<string, string> = {
  submitted: T.info,
  triaged: T.info,
  scoped: T.warning,
  awaiting_approval: T.warning,
  approved: T.primary,
  rejected: T.danger,
  in_progress: T.primary,
  review: T.warning,
  shipped: T.success,
};

function Pill({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? T.muted;
  return (
    <span
      style={{
        fontFamily: T.mono,
        fontSize: "10px",
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: tone,
        background: `${tone}14`,
        border: `1px solid ${tone}40`,
        borderRadius: 999,
        padding: "2px 8px",
      }}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

const btn = (bg: string, fg: string) => ({
  fontFamily: T.mono,
  fontSize: "11px",
  letterSpacing: "0.05em",
  textTransform: "uppercase" as const,
  height: 30,
  paddingInline: 12,
  background: bg,
  color: fg,
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
});

const input = {
  fontFamily: T.mono,
  fontSize: "12px",
  height: 30,
  padding: "0 8px",
  background: T.bg,
  color: T.fg,
  border: `1px solid ${T.border}`,
  borderRadius: 6,
  width: 80,
};

export default async function DeliveryPage() {
  const supabase = await createClient();
  const [{ data: tenants }, { data: projects }, { data: requests }, { data: documents }] =
    await Promise.all([
      supabase
        .from("tenants")
        .select("id, name, vertical")
        .eq("type", "client")
        .order("name"),
      supabase.from("projects").select("id, tenant_id, name, stage").order("created_at"),
      supabase
        .from("change_requests")
        .select(
          "id, tenant_id, project_id, description, status, estimate_hours, quoted_price"
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("documents")
        .select("id, project_id, kind, storage_path, version")
        .order("created_at", { ascending: false }),
    ]);

  const tenantList = (tenants ?? []) as Tenant[];
  const projectList = (projects ?? []) as Project[];
  const requestList = (requests ?? []) as CR[];
  const docList = (documents ?? []) as Doc[];

  return (
    <div>
      <div
        style={{
          fontFamily: T.mono,
          fontSize: "10px",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: T.primary,
          marginBottom: 8,
        }}
      >
        // Delivery
      </div>
      <h1
        style={{
          fontFamily: T.display,
          fontWeight: 600,
          fontSize: "1.9rem",
          color: T.fg,
          marginBottom: 4,
        }}
      >
        Projects &amp; change requests
      </h1>
      <p
        style={{
          fontFamily: T.sans,
          fontSize: "0.9rem",
          color: T.muted,
          marginBottom: 28,
          maxWidth: "62ch",
        }}
      >
        Nothing client-requested is built before it&apos;s scoped and the client approves
        the price in their portal. Every step is logged.
      </p>

      {tenantList.length === 0 && (
        <p style={{ fontFamily: T.sans, color: T.muted }}>
          No client tenants yet. Promote a won lead from the pipeline to create one.
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {tenantList.map((tenant) => {
          const tProjects = projectList.filter((p) => p.tenant_id === tenant.id);
          return (
            <section
              key={tenant.id}
              style={{
                background: T.surface,
                border: `1px solid ${T.border}`,
                borderRadius: T.r.lg,
                padding: "20px 22px",
              }}
            >
              <div
                className="flex items-center justify-between"
                style={{ marginBottom: 14 }}
              >
                <div>
                  <span
                    style={{
                      fontFamily: T.display,
                      fontWeight: 600,
                      fontSize: "1.1rem",
                      color: T.fg,
                    }}
                  >
                    {tenant.name}
                  </span>
                  {tenant.vertical && (
                    <span
                      style={{
                        fontFamily: T.mono,
                        fontSize: "10px",
                        color: T.muted,
                        marginLeft: 10,
                      }}
                    >
                      {tenant.vertical}
                    </span>
                  )}
                </div>
                <form action={createProject} className="flex items-center gap-2">
                  <input type="hidden" name="tenant_id" value={tenant.id} />
                  <input
                    name="name"
                    placeholder="New project name"
                    style={{ ...input, width: 180 }}
                    required
                  />
                  <button type="submit" style={btn(T.surface2, T.fg)}>
                    + Project
                  </button>
                </form>
              </div>

              {tProjects.length === 0 && (
                <p style={{ fontFamily: T.sans, fontSize: "0.85rem", color: T.faint }}>
                  No projects yet.
                </p>
              )}

              {tProjects.map((project) => {
                const crs = requestList.filter((r) => r.project_id === project.id);
                return (
                  <div
                    key={project.id}
                    style={{
                      borderTop: `1px solid ${T.border}`,
                      paddingTop: 14,
                      marginTop: 14,
                    }}
                  >
                    <div className="flex items-center gap-3" style={{ marginBottom: 10 }}>
                      <span
                        style={{
                          fontFamily: T.sans,
                          fontWeight: 600,
                          fontSize: "0.95rem",
                          color: T.fg,
                        }}
                      >
                        {project.name}
                      </span>
                      <Pill status={project.stage} />
                    </div>

                    {crs.length === 0 && (
                      <p
                        style={{
                          fontFamily: T.sans,
                          fontSize: "0.82rem",
                          color: T.faint,
                        }}
                      >
                        No change requests. The client submits these from their portal.
                      </p>
                    )}

                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {crs.map((cr) => (
                        <div
                          key={cr.id}
                          style={{
                            background: T.bg,
                            border: `1px solid ${T.border}`,
                            borderRadius: 8,
                            padding: "12px 14px",
                          }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <p
                              style={{
                                fontFamily: T.sans,
                                fontSize: "0.88rem",
                                color: T.fg,
                                lineHeight: 1.5,
                              }}
                            >
                              {cr.description}
                            </p>
                            <Pill status={cr.status} />
                          </div>
                          {(cr.estimate_hours != null || cr.quoted_price != null) && (
                            <div
                              style={{
                                fontFamily: T.mono,
                                fontSize: "11px",
                                color: T.muted,
                                marginTop: 6,
                              }}
                            >
                              {cr.estimate_hours != null && <>est {cr.estimate_hours}h</>}
                              {cr.quoted_price != null && <> · £{cr.quoted_price}</>}
                            </div>
                          )}
                          <div
                            className="flex items-center gap-2"
                            style={{ marginTop: 10, flexWrap: "wrap" }}
                          >
                            {cr.status === "submitted" && (
                              <form action={triageRequest}>
                                <input type="hidden" name="id" value={cr.id} />
                                <input
                                  type="hidden"
                                  name="tenant_id"
                                  value={cr.tenant_id}
                                />
                                <button type="submit" style={btn(T.surface2, T.fg)}>
                                  Triage
                                </button>
                              </form>
                            )}
                            {(cr.status === "triaged" ||
                              cr.status === "scoped" ||
                              cr.status === "submitted") && (
                              <form
                                action={scopeRequest}
                                className="flex items-center gap-2"
                              >
                                <input type="hidden" name="id" value={cr.id} />
                                <input
                                  type="hidden"
                                  name="tenant_id"
                                  value={cr.tenant_id}
                                />
                                <input
                                  name="estimate_hours"
                                  type="number"
                                  step="0.5"
                                  placeholder="hrs"
                                  style={input}
                                  required
                                />
                                <input
                                  name="quoted_price"
                                  type="number"
                                  step="1"
                                  placeholder="£"
                                  style={input}
                                  required
                                />
                                <button type="submit" style={btn(T.warning, "#1a1300")}>
                                  Scope → approval
                                </button>
                              </form>
                            )}
                            {NEXT_STATUS[cr.status] && (
                              <form action={advanceRequest}>
                                <input type="hidden" name="id" value={cr.id} />
                                <input
                                  type="hidden"
                                  name="tenant_id"
                                  value={cr.tenant_id}
                                />
                                <input type="hidden" name="from" value={cr.status} />
                                <button type="submit" style={btn(T.primary, T.primaryFg)}>
                                  Move to {NEXT_STATUS[cr.status].replace(/_/g, " ")}
                                </button>
                              </form>
                            )}
                            {cr.status === "awaiting_approval" && (
                              <span
                                style={{
                                  fontFamily: T.mono,
                                  fontSize: "11px",
                                  color: T.warning,
                                }}
                              >
                                waiting on client approval in portal
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Deliverables — versioned document store */}
                    <div style={{ marginTop: 12 }}>
                      <div
                        style={{
                          fontFamily: T.mono,
                          fontSize: "10px",
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          color: T.muted,
                          marginBottom: 6,
                        }}
                      >
                        Deliverables
                      </div>
                      {docList
                        .filter((d) => d.project_id === project.id)
                        .map((d) => (
                          <div
                            key={d.id}
                            className="flex items-center gap-2"
                            style={{
                              fontFamily: T.mono,
                              fontSize: "11px",
                              color: T.muted,
                              padding: "2px 0",
                            }}
                          >
                            <span style={{ color: T.primary }}>v{d.version}</span>
                            <span style={{ color: T.faint }}>{d.kind}</span>
                            <span>{d.storage_path.split("/").pop()}</span>
                          </div>
                        ))}
                      <form
                        action={uploadDoc}
                        className="flex items-center gap-2"
                        style={{ marginTop: 6, flexWrap: "wrap" }}
                      >
                        <input type="hidden" name="tenant_id" value={tenant.id} />
                        <input type="hidden" name="project_id" value={project.id} />
                        <select
                          name="kind"
                          defaultValue="asset"
                          style={{ ...input, width: 110 }}
                        >
                          <option value="asset">asset</option>
                          <option value="brief">brief</option>
                          <option value="contract">contract</option>
                          <option value="consent">consent</option>
                        </select>
                        <input
                          type="file"
                          name="file"
                          required
                          style={{ fontFamily: T.mono, fontSize: "11px", color: T.muted }}
                        />
                        <button type="submit" style={btn(T.surface2, T.fg)}>
                          Upload
                        </button>
                      </form>
                    </div>
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>
    </div>
  );
}
