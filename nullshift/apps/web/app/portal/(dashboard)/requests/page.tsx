import { revalidatePath } from "next/cache";
import { createClient } from "@nullshift/db";
import { logAudit } from "@nullshift/db/audit";
import { T } from "@nullshift/ui/tokens";
import { PageHeader, Panel, StatusChip } from "@/components/app/AppKit";
import { Reveal } from "@/components/Reveal";

/**
 * Client portal — requests. The structured intake that replaces email threads:
 * submit a request (→ change_request 'submitted'), then approve or decline the
 * scope + price once staff have quoted it. RLS scopes everything to the client's
 * own tenant; the DB guard trigger only lets clients approve/reject an
 * awaiting_approval request and never touch the staff-set price.
 */

export const dynamic = "force-dynamic";

type Project = { id: string; tenant_id: string; name: string; stage: string };
type CR = {
  id: string;
  project_id: string;
  description: string;
  status: string;
  estimate_hours: number | null;
  quoted_price: number | null;
};

async function submitRequest(formData: FormData) {
  "use server";
  const projectId = String(formData.get("project_id") || "");
  const description = String(formData.get("description") || "").trim();
  if (!projectId || !description) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { data: project } = await supabase
    .from("projects")
    .select("tenant_id")
    .eq("id", projectId)
    .single();
  if (!project) return;
  const { data: cr, error } = await supabase
    .from("change_requests")
    .insert({
      tenant_id: project.tenant_id,
      project_id: projectId,
      submitted_by: user.id,
      description,
      status: "submitted",
    })
    .select("id")
    .single();
  if (error) {
    console.error("submitRequest failed:", error.message);
    return;
  }
  await logAudit({
    action: "change_request.submitted",
    target: `change_request:${cr.id}`,
    tenantId: project.tenant_id,
  });
  revalidatePath("/portal/requests");
}

async function decideRequest(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  const decision = String(formData.get("decision") || ""); // approved | rejected
  if (!id || (decision !== "approved" && decision !== "rejected")) return;
  const supabase = await createClient();
  const patch =
    decision === "approved"
      ? { status: "approved" as const, approved_at: new Date().toISOString() }
      : { status: "rejected" as const };
  const { error } = await supabase.from("change_requests").update(patch).eq("id", id);
  if (error) {
    console.error("decideRequest failed:", error.message);
    return;
  }
  await logAudit({
    action: `change_request.${decision}`,
    target: `change_request:${id}`,
  });
  revalidatePath("/portal/requests");
}

const STATUS_TONE: Record<string, "accent" | "success" | "warning" | "danger" | "muted"> =
  {
    submitted: "muted",
    triaged: "muted",
    scoped: "warning",
    awaiting_approval: "warning",
    approved: "accent",
    rejected: "danger",
    in_progress: "accent",
    review: "warning",
    shipped: "success",
  };

function Pill({ status }: { status: string }) {
  return (
    <StatusChip tone={STATUS_TONE[status] ?? "muted"}>
      {status.replace(/_/g, " ")}
    </StatusChip>
  );
}

const inputStyle = {
  fontFamily: T.sans,
  fontSize: "0.9rem",
  width: "100%",
  height: 44,
  padding: "0 12px",
  background: "var(--k-surface)",
  color: "var(--k-fg)",
  border: "1px solid var(--k-border)",
  borderRadius: 0,
  outline: "none",
} as const;

export default async function PortalRequestsPage() {
  const supabase = await createClient();
  const [{ data: projects }, { data: requests }] = await Promise.all([
    supabase.from("projects").select("id, tenant_id, name, stage").order("created_at"),
    supabase
      .from("change_requests")
      .select("id, project_id, description, status, estimate_hours, quoted_price")
      .order("created_at", { ascending: false }),
  ]);
  const projectList = (projects ?? []) as Project[];
  const requestList = (requests ?? []) as CR[];

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "28px 16px 56px" }}>
      <PageHeader
        index="01"
        label="REQUESTS"
        title="Requests & approvals"
        lead="Submit a change here — never by email. We scope and quote every request before any work starts, and you approve the price below before we begin."
      />

      {/* Submit */}
      <div style={{ margin: "24px 0 20px" }}>
        {projectList.length > 0 ? (
          <Reveal>
            <Panel label="NEW REQUEST" title="Submit a change">
              <form action={submitRequest} className="flex flex-col gap-3">
                {projectList.length > 1 && (
                  <select name="project_id" style={inputStyle} required defaultValue="">
                    <option value="" disabled>
                      Choose a project…
                    </option>
                    {projectList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                )}
                {projectList.length === 1 && (
                  <input type="hidden" name="project_id" value={projectList[0].id} />
                )}
                <textarea
                  name="description"
                  placeholder="What would you like changed or added?"
                  required
                  rows={3}
                  style={{
                    ...inputStyle,
                    height: "auto",
                    padding: 12,
                    resize: "vertical",
                  }}
                />
                <button type="submit" className="kb kb-primary self-start">
                  Submit request
                  <span className="k-arrow" aria-hidden>
                    →
                  </span>
                </button>
              </form>
            </Panel>
          </Reveal>
        ) : (
          <Reveal>
            <p style={{ fontFamily: T.sans, color: "var(--k-muted)" }}>
              Your project is being set up — you&apos;ll be able to submit requests here
              once it&apos;s live.
            </p>
          </Reveal>
        )}
      </div>

      {/* List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {requestList.map((cr, i) => {
          const project = projectList.find((p) => p.id === cr.project_id);
          return (
            <Reveal key={cr.id} delay={i * 0.05}>
              <div
                className="k-kard k-kard-h"
                style={{ background: "var(--k-surface)", padding: "16px 18px" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    {project && (
                      <div
                        style={{
                          fontFamily: T.mono,
                          fontSize: "0.66rem",
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          color: "var(--k-faint)",
                          marginBottom: 4,
                        }}
                      >
                        {project.name}
                      </div>
                    )}
                    <p
                      style={{
                        fontFamily: T.sans,
                        fontSize: "0.92rem",
                        color: "var(--k-fg)",
                        lineHeight: 1.5,
                      }}
                    >
                      {cr.description}
                    </p>
                  </div>
                  <Pill status={cr.status} />
                </div>

                {cr.status === "awaiting_approval" && (
                  <div
                    style={{
                      marginTop: 14,
                      padding: "14px 16px",
                      background: "var(--k-bg)",
                      border: `1px solid ${T.warning}40`,
                      borderRadius: 0,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: T.sans,
                        fontSize: "0.9rem",
                        color: "var(--k-fg)",
                        marginBottom: 4,
                      }}
                    >
                      Quote ready for your approval
                    </div>
                    <div
                      style={{
                        fontFamily: T.mono,
                        fontSize: "0.85rem",
                        color: "var(--k-muted)",
                        marginBottom: 12,
                      }}
                    >
                      {cr.estimate_hours != null && <>est {cr.estimate_hours}h</>}
                      {cr.quoted_price != null && <> · £{cr.quoted_price}</>}
                    </div>
                    <div className="flex gap-2">
                      <form action={decideRequest}>
                        <input type="hidden" name="id" value={cr.id} />
                        <input type="hidden" name="decision" value="approved" />
                        <button type="submit" className="kb kb-primary kb-sm">
                          Approve £{cr.quoted_price}
                        </button>
                      </form>
                      <form action={decideRequest}>
                        <input type="hidden" name="id" value={cr.id} />
                        <input type="hidden" name="decision" value="rejected" />
                        <button type="submit" className="kb kb-outline kb-sm">
                          Decline
                        </button>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            </Reveal>
          );
        })}
        {requestList.length === 0 && (
          <p style={{ fontFamily: T.sans, fontSize: "0.88rem", color: "var(--k-faint)" }}>
            No requests yet.
          </p>
        )}
      </div>
    </div>
  );
}
