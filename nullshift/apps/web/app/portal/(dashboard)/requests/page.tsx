import { revalidatePath } from "next/cache";
import { createClient } from "@nullshift/db";
import { logAudit } from "@nullshift/db/audit";
import { T } from "@nullshift/ui/tokens";

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
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px" }}>
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
        {"// Requests"}
      </div>
      <h1
        style={{
          fontFamily: T.display,
          fontWeight: 600,
          fontSize: "1.8rem",
          color: T.fg,
          marginBottom: 6,
        }}
      >
        Requests &amp; approvals
      </h1>
      <p
        style={{
          fontFamily: T.sans,
          fontSize: "0.9rem",
          color: T.muted,
          marginBottom: 28,
          lineHeight: 1.6,
        }}
      >
        Submit a change here — never by email. We scope and quote every request before any
        work starts, and you approve the price below before we begin.
      </p>

      {/* Submit */}
      {projectList.length > 0 ? (
        <form
          action={submitRequest}
          style={{
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: T.r.lg,
            padding: 20,
            marginBottom: 28,
          }}
        >
          <div
            style={{
              fontFamily: T.sans,
              fontWeight: 600,
              fontSize: "0.95rem",
              color: T.fg,
              marginBottom: 12,
            }}
          >
            New request
          </div>
          {projectList.length > 1 && (
            <select name="project_id" style={selectStyle} required defaultValue="">
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
              ...selectStyle,
              height: "auto",
              padding: 12,
              resize: "vertical",
              marginTop: projectList.length > 1 ? 10 : 0,
            }}
          />
          <button
            type="submit"
            style={{
              fontFamily: T.sans,
              fontWeight: 600,
              fontSize: "0.9rem",
              height: 42,
              paddingInline: 20,
              background: T.primary,
              color: T.primaryFg,
              border: "none",
              borderRadius: T.r.md,
              cursor: "pointer",
              marginTop: 12,
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18)`,
            }}
          >
            Submit request →
          </button>
        </form>
      ) : (
        <p style={{ fontFamily: T.sans, color: T.muted, marginBottom: 28 }}>
          Your project is being set up — you&apos;ll be able to submit requests here once
          it&apos;s live.
        </p>
      )}

      {/* List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {requestList.map((cr) => {
          const project = projectList.find((p) => p.id === cr.project_id);
          return (
            <div
              key={cr.id}
              style={{
                background: T.surface,
                border: `1px solid ${T.border}`,
                borderRadius: T.r.lg,
                padding: "16px 18px",
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  {project && (
                    <div
                      style={{
                        fontFamily: T.mono,
                        fontSize: "10px",
                        color: T.faint,
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
                      color: T.fg,
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
                    background: T.bg,
                    border: `1px solid ${T.warning}40`,
                    borderRadius: T.r.md,
                  }}
                >
                  <div
                    style={{
                      fontFamily: T.sans,
                      fontSize: "0.9rem",
                      color: T.fg,
                      marginBottom: 4,
                    }}
                  >
                    Quote ready for your approval
                  </div>
                  <div
                    style={{
                      fontFamily: T.mono,
                      fontSize: "0.85rem",
                      color: T.muted,
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
                      <button
                        type="submit"
                        style={{
                          fontFamily: T.sans,
                          fontWeight: 600,
                          fontSize: "0.85rem",
                          height: 38,
                          paddingInline: 18,
                          background: T.primary,
                          color: T.primaryFg,
                          border: "none",
                          borderRadius: T.r.md,
                          cursor: "pointer",
                        }}
                      >
                        Approve £{cr.quoted_price}
                      </button>
                    </form>
                    <form action={decideRequest}>
                      <input type="hidden" name="id" value={cr.id} />
                      <input type="hidden" name="decision" value="rejected" />
                      <button
                        type="submit"
                        style={{
                          fontFamily: T.sans,
                          fontWeight: 500,
                          fontSize: "0.85rem",
                          height: 38,
                          paddingInline: 16,
                          background: "transparent",
                          color: T.muted,
                          border: `1px solid ${T.borderStr}`,
                          borderRadius: T.r.md,
                          cursor: "pointer",
                        }}
                      >
                        Decline
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {requestList.length === 0 && (
          <p style={{ fontFamily: T.sans, fontSize: "0.88rem", color: T.faint }}>
            No requests yet.
          </p>
        )}
      </div>
    </div>
  );
}

const selectStyle = {
  fontFamily: T.sans,
  fontSize: "0.9rem",
  width: "100%",
  height: 42,
  padding: "0 12px",
  background: T.bg,
  color: T.fg,
  border: `1px solid ${T.border}`,
  borderRadius: T.r.md,
} as const;
