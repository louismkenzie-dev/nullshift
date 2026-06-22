import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@nullshift/db";
import { logAudit } from "@nullshift/db/audit";
import { T } from "@nullshift/ui/tokens";
import { carePlan } from "@/lib/carePlans";
import { StageStepper } from "@/components/portal/StageStepper";
import { PageHeader, Panel, StatCard, StatusChip } from "@/components/app/AppKit";
import { Reveal } from "@/components/Reveal";

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

// Map each workflow status onto a StatusChip tone (mono uppercase, square).
type Tone = "accent" | "success" | "warning" | "danger" | "muted";
const TONE: Record<string, Tone> = {
  backlog: "muted",
  scoped: "warning",
  approved: "accent",
  in_progress: "accent",
  review: "warning",
  shipped: "success",
  submitted: "accent",
  triaged: "accent",
  awaiting_approval: "warning",
  rejected: "danger",
};

function Pill({ s }: { s: string }) {
  return <StatusChip tone={TONE[s] ?? "muted"}>{s.replace(/_/g, " ")}</StatusChip>;
}

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

  // Square link-row style shared by the documents block.
  const docRow: React.CSSProperties = {
    padding: "11px 13px",
    textDecoration: "none",
  };

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: "24px 16px 56px" }}>
      <Reveal>
        <Link
          href="/portal"
          className="inline-flex items-center gap-2"
          style={{
            fontFamily: T.mono,
            fontSize: "0.68rem",
            fontWeight: 500,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--k-muted)",
            textDecoration: "none",
          }}
        >
          <span aria-hidden>←</span> Your projects
        </Link>
      </Reveal>

      <div style={{ marginTop: 14 }}>
        <PageHeader index="02" label="PROJECT" title={p.name} />
      </div>
      <div style={{ margin: "16px 0 18px" }}>
        <StageStepper stage={p.stage} />
      </div>

      {/* Live site */}
      {p.live_url && (
        <Reveal>
          <a
            href={p.live_url}
            target="_blank"
            rel="noreferrer"
            className="k-kard k-kard-h flex items-center justify-between"
            style={{
              background: "var(--k-surface)",
              borderColor: "var(--k-accent)",
              padding: "18px",
              marginBottom: 14,
              textDecoration: "none",
            }}
          >
            <div>
              <div
                className="inline-flex items-center gap-2"
                style={{
                  fontFamily: T.mono,
                  fontSize: "0.66rem",
                  fontWeight: 500,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--k-accent)",
                }}
              >
                <span className="k-livedot" aria-hidden />
                Your live site
              </div>
              <div
                style={{
                  fontFamily: T.sans,
                  fontSize: "0.92rem",
                  color: "var(--k-fg)",
                  marginTop: 4,
                  wordBreak: "break-all",
                }}
              >
                {p.live_url.replace(/^https?:\/\//, "")}
              </div>
            </div>
            <span
              className="inline-flex items-center gap-1.5"
              style={{
                fontFamily: T.mono,
                fontSize: "0.68rem",
                fontWeight: 500,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--k-accent)",
              }}
            >
              Open
              <span className="k-arrow" aria-hidden>
                ↗
              </span>
            </span>
          </a>
        </Reveal>
      )}

      {/* Invested + plan */}
      <div className="grid grid-cols-2 gap-3" style={{ marginBottom: 14 }}>
        <Reveal delay={0}>
          <StatCard value={gbp(invested)} label="Invested" />
        </Reveal>
        <Reveal delay={0.05}>
          <StatCard
            value={plan ? plan.label : "None yet"}
            label="Care plan"
            sub={plan ? `${gbp(plan.mrr)}/mo` : undefined}
            accent={!!plan}
          />
        </Reveal>
      </div>

      {/* Documents + deliverables */}
      <Reveal>
        <Panel label="DOCUMENTS" title="Documents" className="mb-[14px]">
          <div className="flex flex-col gap-2">
            <Link
              href="/portal/proposal"
              className="flex items-center justify-between"
              style={{
                ...docRow,
                background:
                  p.proposal_status === "sent" ? "rgba(16,185,129,0.12)" : "var(--k-bg)",
                border: `1px solid ${
                  p.proposal_status === "sent" ? "var(--k-accent)" : "var(--k-border)"
                }`,
              }}
            >
              <span
                style={{
                  fontFamily: T.sans,
                  fontSize: "0.92rem",
                  color: "var(--k-fg)",
                }}
              >
                {p.proposal_status === "sent"
                  ? "Review & sign your proposal + DPA"
                  : "Your proposal & DPA"}
              </span>
              <span
                className="inline-flex items-center gap-1.5"
                style={{
                  fontFamily: T.mono,
                  fontSize: "0.66rem",
                  fontWeight: 500,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--k-accent)",
                }}
              >
                {p.proposal_status === "sent" ? "Action" : "View"}
                <span className="k-arrow" aria-hidden>
                  →
                </span>
              </span>
            </Link>
            <Link
              href="/portal/deliverables"
              className="flex items-center justify-between"
              style={{
                ...docRow,
                background: "var(--k-bg)",
                border: "1px solid var(--k-border)",
              }}
            >
              <span
                style={{
                  fontFamily: T.sans,
                  fontSize: "0.92rem",
                  color: "var(--k-fg)",
                }}
              >
                Deliverables{docCount ? ` (${docCount})` : ""}
              </span>
              <span
                className="inline-flex items-center gap-1.5"
                style={{
                  fontFamily: T.mono,
                  fontSize: "0.66rem",
                  fontWeight: 500,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--k-accent)",
                }}
              >
                View
                <span className="k-arrow" aria-hidden>
                  →
                </span>
              </span>
            </Link>
          </div>
        </Panel>
      </Reveal>

      {/* Outstanding tasks */}
      <Reveal>
        <Panel label="IN PROGRESS" title="What we're working on" className="mb-[14px]">
          {taskList.length === 0 ? (
            <p
              style={{ fontFamily: T.sans, fontSize: "0.85rem", color: "var(--k-faint)" }}
            >
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
                    borderTop: i ? "1px solid var(--k-border)" : "none",
                  }}
                >
                  <span
                    style={{
                      fontFamily: T.sans,
                      fontSize: "0.9rem",
                      color: "var(--k-fg)",
                    }}
                  >
                    {t.title}
                  </span>
                  <Pill s={t.status} />
                </div>
              ))}
            </div>
          )}
        </Panel>
      </Reveal>

      {/* Team updates */}
      <Reveal>
        <Panel label="UPDATES" title="Updates from the team" className="mb-[14px]">
          {updateList.length === 0 ? (
            <p
              style={{ fontFamily: T.sans, fontSize: "0.85rem", color: "var(--k-faint)" }}
            >
              No updates yet — we&apos;ll post progress here.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {updateList.map((u, i) => (
                <div
                  key={u.id}
                  style={{
                    padding: "8px 0",
                    borderTop: i ? "1px solid var(--k-border)" : "none",
                  }}
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
                        color: "var(--k-fg)",
                      }}
                    >
                      {u.title}
                    </span>
                    <span
                      style={{
                        fontFamily: T.mono,
                        fontSize: "0.62rem",
                        letterSpacing: "0.06em",
                        color: "var(--k-faint)",
                      }}
                    >
                      {new Date(u.created_at).toLocaleDateString("en-GB")}
                    </span>
                  </div>
                  {u.body && (
                    <p
                      style={{
                        fontFamily: T.sans,
                        fontSize: "0.86rem",
                        color: "var(--k-muted)",
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
        </Panel>
      </Reveal>

      {/* Change requests */}
      <Reveal>
        <Panel label="REQUESTS" title="Requests & changes">
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
                  background: "var(--k-surface)",
                  color: "var(--k-fg)",
                  border: "1px solid var(--k-border)",
                  borderRadius: 0,
                  outline: "none",
                  resize: "vertical",
                }}
              />
              <button type="submit" className="kb kb-primary kb-sm self-start">
                Submit request
              </button>
            </form>
          ) : (
            <p
              style={{
                fontFamily: T.sans,
                fontSize: "0.85rem",
                color: "var(--k-muted)",
                lineHeight: 1.6,
                marginBottom: 14,
              }}
            >
              You&apos;ll be able to request build edits here once you&apos;ve signed your
              proposal.
            </p>
          )}
          {crList.length === 0 ? (
            <p
              style={{ fontFamily: T.sans, fontSize: "0.82rem", color: "var(--k-faint)" }}
            >
              No requests yet.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {crList.map((cr) => (
                <div
                  key={cr.id}
                  style={{
                    background: "var(--k-bg)",
                    border: "1px solid var(--k-border)",
                    borderRadius: 0,
                    padding: "10px 12px",
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p
                      style={{
                        fontFamily: T.sans,
                        fontSize: "0.88rem",
                        color: "var(--k-fg)",
                      }}
                    >
                      {cr.description}
                    </p>
                    <Pill s={cr.status} />
                  </div>
                  {cr.status === "awaiting_approval" && (
                    <div style={{ marginTop: 8 }}>
                      <p
                        style={{
                          fontFamily: T.mono,
                          fontSize: "0.66rem",
                          letterSpacing: "0.06em",
                          color: "var(--k-muted)",
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
                          <button type="submit" className="kb kb-primary kb-sm">
                            Approve
                          </button>
                        </form>
                        <form action={decideRequest}>
                          <input type="hidden" name="id" value={cr.id} />
                          <input type="hidden" name="project_id" value={p.id} />
                          <input type="hidden" name="decision" value="rejected" />
                          <button type="submit" className="kb kb-outline kb-sm">
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
        </Panel>
      </Reveal>
    </div>
  );
}
