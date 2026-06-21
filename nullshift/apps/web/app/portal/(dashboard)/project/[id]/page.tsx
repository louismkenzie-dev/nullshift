import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@nullshift/db";
import { logAudit } from "@nullshift/db/audit";
import { T } from "@nullshift/ui/tokens";
import { carePlan } from "@/lib/carePlans";
import { StageStepper } from "@/components/portal/StageStepper";

/**
 * Client project hub — everything for one project on a single mobile-first page:
 * status, the live site link, what they've invested + their care plan, outstanding
 * tasks, updates from the team, their documents to review/sign, deliverables, and
 * change requests (submit + approve/reject). RLS scopes every read to the client's
 * own tenant.
 */
export const dynamic = "force-dynamic";

const gbp = (n: number) => "£" + Math.round(n).toLocaleString("en-GB");

type Project = {
  id: string;
  tenant_id: string;
  name: string;
  stage: string;
  proposal_status: string;
  live_url: string | null;
};
type Task = { id: string; title: string; status: string };
type Update = {
  id: string;
  created_at: string;
  type: string;
  title: string;
  body: string | null;
};
type CR = {
  id: string;
  description: string;
  status: string;
  estimate_hours: number | null;
  quoted_price: number | null;
};

const TONE: Record<string, string> = {
  backlog: T.faint,
  scoped: T.warning,
  approved: T.primary,
  in_progress: T.primary,
  review: T.warning,
  shipped: T.success,
  submitted: T.info,
  triaged: T.info,
  awaiting_approval: T.warning,
  rejected: T.danger,
};

function Pill({ s }: { s: string }) {
  const c = TONE[s] ?? T.muted;
  return (
    <span
      style={{
        fontFamily: T.mono,
        fontSize: 10,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        color: c,
        background: `${c}14`,
        border: `1px solid ${c}40`,
        borderRadius: 999,
        padding: "2px 8px",
        whiteSpace: "nowrap",
      }}
    >
      {s.replace(/_/g, " ")}
    </span>
  );
}

const card = {
  background: T.surface,
  border: `1px solid ${T.border}`,
  borderRadius: T.r.lg,
  padding: "18px 18px",
  marginBottom: 14,
} as const;
const h2 = {
  fontFamily: T.display,
  fontWeight: 600,
  fontSize: "1.05rem",
  color: T.fg,
  marginBottom: 12,
} as const;

// ── server actions ─────────────────────────────────────────────
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
    .select("tenant_id, proposal_status")
    .eq("id", projectId)
    .single();
  // Build edits unlock only after the client has signed the proposal.
  if (!project || project.proposal_status !== "accepted") return;
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
  revalidatePath(`/portal/project/${projectId}`);
}

async function decideRequest(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  const projectId = String(formData.get("project_id") || "");
  const decision = String(formData.get("decision") || "");
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
  revalidatePath(`/portal/project/${projectId}`);
}

export default async function PortalProject({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, tenant_id, name, stage, proposal_status, live_url")
    .eq("id", id)
    .maybeSingle();
  if (!project) notFound();
  const p = project as Project;

  const [
    { data: tasks },
    { data: updates },
    { data: crs },
    { data: invoices },
    { data: subs },
    { count: docCount },
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, status")
      .eq("project_id", id)
      .neq("status", "shipped")
      .order("created_at", { ascending: false }),
    supabase
      .from("project_updates")
      .select("id, created_at, type, title, body")
      .eq("project_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("change_requests")
      .select("id, description, status, estimate_hours, quoted_price")
      .eq("project_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("invoices").select("amount, status").eq("tenant_id", p.tenant_id),
    supabase
      .from("subscriptions")
      .select("plan, mrr, status")
      .eq("tenant_id", p.tenant_id)
      .eq("status", "active"),
    supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("project_id", id),
  ]);

  const taskList = (tasks ?? []) as Task[];
  const updateList = (updates ?? []) as Update[];
  const crList = (crs ?? []) as CR[];
  const invList = (invoices ?? []) as { amount: number; status: string }[];
  const invested = invList
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + Number(i.amount), 0);
  const sub = (subs ?? [])[0] as { plan: string; mrr: number } | undefined;
  const plan = sub ? carePlan(sub.plan) : null;

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: "24px 16px 56px" }}>
      <Link
        href="/portal"
        style={{
          fontFamily: T.mono,
          fontSize: 11,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: T.muted,
          textDecoration: "none",
        }}
      >
        ← Your projects
      </Link>

      <h1
        style={{
          fontFamily: T.display,
          fontWeight: 600,
          fontSize: "1.7rem",
          color: T.fg,
          margin: "12px 0 14px",
        }}
      >
        {p.name}
      </h1>
      <div style={{ marginBottom: 18 }}>
        <StageStepper stage={p.stage} />
      </div>

      {/* Live site */}
      {p.live_url && (
        <a
          href={p.live_url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between"
          style={{
            ...card,
            textDecoration: "none",
            borderColor: `${T.primary}66`,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: T.mono,
                fontSize: 10,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: T.primary,
              }}
            >
              Your live site
            </div>
            <div
              style={{
                fontFamily: T.sans,
                fontSize: "0.92rem",
                color: T.fg,
                marginTop: 2,
                wordBreak: "break-all",
              }}
            >
              {p.live_url.replace(/^https?:\/\//, "")}
            </div>
          </div>
          <span style={{ fontFamily: T.mono, fontSize: 12, color: T.primary }}>
            Open ↗
          </span>
        </a>
      )}

      {/* Invested + plan */}
      <div className="grid grid-cols-2 gap-3" style={{ marginBottom: 14 }}>
        <div style={{ ...card, marginBottom: 0 }}>
          <div
            style={{
              fontFamily: T.mono,
              fontSize: 10,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: T.muted,
            }}
          >
            Invested
          </div>
          <div
            style={{
              fontFamily: T.display,
              fontWeight: 700,
              fontSize: "1.4rem",
              color: T.fg,
              marginTop: 4,
            }}
          >
            {gbp(invested)}
          </div>
        </div>
        <div style={{ ...card, marginBottom: 0 }}>
          <div
            style={{
              fontFamily: T.mono,
              fontSize: 10,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: T.muted,
            }}
          >
            Care plan
          </div>
          <div
            style={{
              fontFamily: T.display,
              fontWeight: 700,
              fontSize: "1.05rem",
              color: plan ? T.fg : T.faint,
              marginTop: 4,
            }}
          >
            {plan ? `${plan.label} · ${gbp(plan.mrr)}/mo` : "None yet"}
          </div>
        </div>
      </div>

      {/* Documents + deliverables */}
      <section style={card}>
        <h2 style={h2}>Documents</h2>
        <div className="flex flex-col gap-2">
          <Link
            href="/portal/proposal"
            className="flex items-center justify-between"
            style={{
              padding: "11px 13px",
              background: p.proposal_status === "sent" ? `${T.primary}14` : T.bg,
              border: `1px solid ${p.proposal_status === "sent" ? T.primary : T.border}`,
              borderRadius: T.r.md,
              textDecoration: "none",
            }}
          >
            <span style={{ fontFamily: T.sans, fontSize: "0.92rem", color: T.fg }}>
              {p.proposal_status === "sent"
                ? "Review & sign your proposal + DPA"
                : "Your proposal & DPA"}
            </span>
            <span style={{ fontFamily: T.mono, fontSize: 12, color: T.primary }}>
              {p.proposal_status === "sent" ? "Action →" : "View →"}
            </span>
          </Link>
          <Link
            href="/portal/deliverables"
            className="flex items-center justify-between"
            style={{
              padding: "11px 13px",
              background: T.bg,
              border: `1px solid ${T.border}`,
              borderRadius: T.r.md,
              textDecoration: "none",
            }}
          >
            <span style={{ fontFamily: T.sans, fontSize: "0.92rem", color: T.fg }}>
              Deliverables{docCount ? ` (${docCount})` : ""}
            </span>
            <span style={{ fontFamily: T.mono, fontSize: 12, color: T.primary }}>
              View →
            </span>
          </Link>
        </div>
      </section>

      {/* Outstanding tasks */}
      <section style={card}>
        <h2 style={h2}>What we're working on</h2>
        {taskList.length === 0 ? (
          <p style={{ fontFamily: T.sans, fontSize: "0.85rem", color: T.faint }}>
            No outstanding tasks right now.
          </p>
        ) : (
          <div className="flex flex-col">
            {taskList.map((t, i) => (
              <div
                key={t.id}
                className="flex items-center justify-between gap-3"
                style={{
                  padding: "9px 0",
                  borderTop: i ? `1px solid ${T.border}` : "none",
                }}
              >
                <span style={{ fontFamily: T.sans, fontSize: "0.9rem", color: T.fg }}>
                  {t.title}
                </span>
                <Pill s={t.status} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Team updates */}
      <section style={card}>
        <h2 style={h2}>Updates from the team</h2>
        {updateList.length === 0 ? (
          <p style={{ fontFamily: T.sans, fontSize: "0.85rem", color: T.faint }}>
            No updates yet — we'll post progress here.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {updateList.map((u) => (
              <div
                key={u.id}
                style={{ padding: "8px 0", borderTop: `1px solid ${T.border}` }}
              >
                <div
                  className="flex items-center justify-between gap-2"
                  style={{ marginBottom: 4 }}
                >
                  <span
                    style={{
                      fontFamily: T.sans,
                      fontWeight: 600,
                      fontSize: "0.9rem",
                      color: T.fg,
                    }}
                  >
                    {u.title}
                  </span>
                  <span style={{ fontFamily: T.mono, fontSize: 10, color: T.faint }}>
                    {new Date(u.created_at).toLocaleDateString("en-GB")}
                  </span>
                </div>
                {u.body && (
                  <p
                    style={{
                      fontFamily: T.sans,
                      fontSize: "0.86rem",
                      color: T.muted,
                      lineHeight: 1.6,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {u.body}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Change requests */}
      <section style={card}>
        <h2 style={h2}>Requests & changes</h2>
        {p.proposal_status === "accepted" ? (
          <form
            action={submitRequest}
            className="flex flex-col gap-2"
            style={{ marginBottom: 14 }}
          >
            <input type="hidden" name="project_id" value={p.id} />
            <textarea
              name="description"
              required
              rows={2}
              placeholder="Request a change or ask for something new…"
              style={{
                fontFamily: T.sans,
                fontSize: "0.9rem",
                padding: "10px 12px",
                background: T.bg,
                color: T.fg,
                border: `1px solid ${T.border}`,
                borderRadius: T.r.sm,
                outline: "none",
                resize: "vertical",
              }}
            />
            <button
              type="submit"
              className="self-start"
              style={{
                fontFamily: T.sans,
                fontWeight: 600,
                fontSize: "0.85rem",
                height: 40,
                paddingInline: 18,
                background: T.primary,
                color: T.primaryFg,
                border: "none",
                borderRadius: T.r.md,
                cursor: "pointer",
              }}
            >
              Submit request
            </button>
          </form>
        ) : (
          <p
            style={{
              fontFamily: T.sans,
              fontSize: "0.85rem",
              color: T.muted,
              lineHeight: 1.6,
              marginBottom: 14,
            }}
          >
            You&apos;ll be able to request build edits here once you&apos;ve signed your
            proposal.
          </p>
        )}
        {crList.length === 0 ? (
          <p style={{ fontFamily: T.sans, fontSize: "0.82rem", color: T.faint }}>
            No requests yet.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {crList.map((cr) => (
              <div
                key={cr.id}
                style={{
                  background: T.bg,
                  border: `1px solid ${T.border}`,
                  borderRadius: 0,
                  padding: "10px 12px",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <p style={{ fontFamily: T.sans, fontSize: "0.88rem", color: T.fg }}>
                    {cr.description}
                  </p>
                  <Pill s={cr.status} />
                </div>
                {cr.status === "awaiting_approval" && (
                  <div style={{ marginTop: 8 }}>
                    <p
                      style={{
                        fontFamily: T.mono,
                        fontSize: 11,
                        color: T.muted,
                        marginBottom: 8,
                      }}
                    >
                      Quote: {cr.estimate_hours ?? "—"}h
                      {cr.quoted_price != null ? ` · £${cr.quoted_price}` : ""}
                    </p>
                    <div className="flex items-center gap-2">
                      <form action={decideRequest}>
                        <input type="hidden" name="id" value={cr.id} />
                        <input type="hidden" name="project_id" value={p.id} />
                        <input type="hidden" name="decision" value="approved" />
                        <button
                          type="submit"
                          style={{
                            fontFamily: T.mono,
                            fontSize: 11,
                            textTransform: "uppercase",
                            height: 32,
                            paddingInline: 12,
                            background: T.primary,
                            color: T.primaryFg,
                            border: "none",
                            borderRadius: 0,
                            cursor: "pointer",
                          }}
                        >
                          Approve
                        </button>
                      </form>
                      <form action={decideRequest}>
                        <input type="hidden" name="id" value={cr.id} />
                        <input type="hidden" name="project_id" value={p.id} />
                        <input type="hidden" name="decision" value="rejected" />
                        <button
                          type="submit"
                          style={{
                            fontFamily: T.mono,
                            fontSize: 11,
                            textTransform: "uppercase",
                            height: 32,
                            paddingInline: 12,
                            background: "transparent",
                            color: T.muted,
                            border: `1px solid ${T.border}`,
                            borderRadius: 0,
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
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
