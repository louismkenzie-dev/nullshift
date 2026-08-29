import Link from "next/link";
import { revalidatePath } from "next/cache";
import { createClient } from "@nullshift/db";
import { logAudit } from "@nullshift/db/audit";
import { requireStaff } from "@nullshift/auth/guards";
import { T } from "@nullshift/ui/tokens";
import { PageHeader, Panel, StatusChip } from "@/components/app/AppKit";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Reveal } from "@/components/kyma";
import { RISK_TIER_LABEL, type AgentRow } from "@/lib/aiw";

/** Approval inbox (Phase 2) — every proposed agent action that needs a named
 *  human, in one place: what's proposed, by which agent, the exact preview,
 *  risk tier, evidence, expiry. Decisions are attributable, time-stamped and
 *  scoped to the single item — approving one action never approves the next.
 *  Escalations live here too. */

export const dynamic = "force-dynamic";

type ApprovalRow = {
  id: string;
  agent_id: string | null;
  task_id: string | null;
  tenant_id: string | null;
  proposed: string;
  preview: string | null;
  risk_tier: number;
  status: string;
  approver_email: string | null;
  decision_note: string | null;
  decided_at: string | null;
  expires_at: string;
  created_at: string;
};

type EscalationRow = {
  id: string;
  agent_id: string | null;
  task_id: string | null;
  reason: string;
  severity: string;
  status: string;
  sla_due_at: string | null;
  created_at: string;
};

async function decide(formData: FormData) {
  "use server";
  const staff = await requireStaff();
  if (!staff.ok) return;
  const id = String(formData.get("id") || "");
  const decision = String(formData.get("decision") || "");
  const note = String(formData.get("note") || "").trim() || null;
  if (!id || !["approved", "rejected", "changes_requested"].includes(decision)) return;

  const supabase = await createClient();
  // Only a pending, unexpired item can be decided; decision is attributable.
  const { data: updated } = await supabase
    .from("agent_approvals")
    .update({
      status: decision,
      approver_email: staff.email,
      decision_note: note,
      decided_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .select("task_id, agent_id, proposed");
  const row = updated?.[0];
  if (!row) return;

  // Reflect the decision on the linked task.
  if (row.task_id) {
    const next =
      decision === "approved"
        ? {
            status: "complete",
            result_summary: `Approved by ${staff.email}${note ? ` — ${note}` : ""}`,
          }
        : decision === "rejected"
          ? {
              status: "cancelled",
              result_summary: `Rejected by ${staff.email}${note ? ` — ${note}` : ""}`,
            }
          : { status: "queued" }; // changes requested → back to the queue
    await supabase
      .from("agent_tasks")
      .update(next)
      .eq("id", row.task_id)
      .eq("status", "waiting_approval");
  }
  await supabase.from("agent_events").insert({
    agent_id: row.agent_id,
    task_id: row.task_id,
    type: `approval.${decision}`,
    summary: `${staff.email} ${decision.replace("_", " ")}: ${String(row.proposed).slice(0, 100)}`,
    actor: staff.email,
    detail: { note },
  });
  await logAudit({
    action: `agent_approval.${decision}`,
    target: `agent_approval:${id}`,
  });
  revalidatePath("/admin/ai/approvals");
  revalidatePath("/admin/ai");
}

async function resolveEscalation(formData: FormData) {
  "use server";
  const staff = await requireStaff();
  if (!staff.ok) return;
  const id = String(formData.get("id") || "");
  const to = String(formData.get("to") || "");
  if (!id || !["acknowledged", "resolved"].includes(to)) return;
  const supabase = await createClient();
  await supabase
    .from("agent_escalations")
    .update({
      status: to,
      ...(to === "resolved"
        ? {
            resolved_at: new Date().toISOString(),
            resolution: `Resolved by ${staff.email}`,
          }
        : {}),
    })
    .eq("id", id);
  await logAudit({ action: `agent_escalation.${to}`, target: `agent_escalation:${id}` });
  revalidatePath("/admin/ai/approvals");
}

export default async function ApprovalsPage() {
  const supabase = await createClient();
  const [
    { data: pendingRaw },
    { data: recentRaw },
    { data: escRaw },
    { data: agentsRaw },
  ] = await Promise.all([
    supabase
      .from("agent_approvals")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
    supabase
      .from("agent_approvals")
      .select("*")
      .neq("status", "pending")
      .order("decided_at", { ascending: false })
      .limit(10),
    supabase
      .from("agent_escalations")
      .select("*")
      .neq("status", "resolved")
      .order("created_at", { ascending: false }),
    supabase.from("agents").select("id, name"),
  ]);

  const pending = (pendingRaw ?? []) as ApprovalRow[];
  const recent = (recentRaw ?? []) as ApprovalRow[];
  const escalations = (escRaw ?? []) as EscalationRow[];
  const agentName = new Map(
    ((agentsRaw ?? []) as Pick<AgentRow, "id" | "name">[]).map((a) => [a.id, a.name])
  );

  return (
    <div>
      <PageHeader
        index="AI"
        label="Approval inbox"
        title="Waiting on you"
        lead={`${pending.length} proposed action${pending.length === 1 ? "" : "s"} pending · ${escalations.length} open escalation${escalations.length === 1 ? "" : "s"}. Approvals are per-item and expire — nothing is ever pre-approved.`}
        className="mb-8"
      />

      {/* Pending approvals */}
      <div className="flex flex-col gap-4">
        {pending.length === 0 ? (
          <Reveal className="block">
            <Panel label="// PENDING" title="Nothing awaiting approval">
              <p style={body}>
                When an agent drafts a Tier 2+ action, the exact proposal appears here for
                a named human decision.
              </p>
            </Panel>
          </Reveal>
        ) : (
          pending.map((ap, i) => (
            <Reveal key={ap.id} className="block" delay={i * 0.04}>
              <Panel
                label={`// ${RISK_TIER_LABEL[ap.risk_tier] ?? `TIER ${ap.risk_tier}`}`}
                title={ap.proposed}
                actions={
                  <span style={monoFaint}>
                    {agentName.get(ap.agent_id ?? "") ?? "Unknown agent"} · expires{" "}
                    {new Date(ap.expires_at).toLocaleDateString("en-GB")}
                  </span>
                }
              >
                {ap.preview && (
                  <div
                    style={{
                      border: "1px solid var(--k-border)",
                      background: "var(--k-bg)",
                      padding: 14,
                      marginBottom: 12,
                      whiteSpace: "pre-wrap",
                      fontFamily: T.sans,
                      fontSize: "0.85rem",
                      lineHeight: 1.6,
                      color: "var(--k-fg)",
                      maxHeight: 340,
                      overflowY: "auto",
                    }}
                  >
                    {ap.preview}
                  </div>
                )}
                <form action={decide} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="id" value={ap.id} />
                  <input
                    name="note"
                    className="brief-input"
                    style={{ flex: 1, minWidth: 220 }}
                    placeholder="Decision note (recorded)"
                  />
                  <SubmitButton
                    name="decision"
                    value="approved"
                    className="kb kb-primary kb-sm"
                    pendingLabel="Recording…"
                  >
                    Approve
                  </SubmitButton>
                  <SubmitButton
                    name="decision"
                    value="changes_requested"
                    className="kb kb-outline kb-sm"
                    pendingLabel="Recording…"
                  >
                    Request changes
                  </SubmitButton>
                  <SubmitButton
                    name="decision"
                    value="rejected"
                    className="kb kb-outline kb-sm"
                    pendingLabel="Recording…"
                  >
                    Reject
                  </SubmitButton>
                  {ap.task_id && (
                    <Link
                      href={`/admin/ai/tasks/${ap.task_id}`}
                      className="kb kb-outline kb-sm"
                    >
                      Task
                    </Link>
                  )}
                </form>
              </Panel>
            </Reveal>
          ))
        )}

        {/* Escalations */}
        <Reveal className="block">
          <Panel label="// ESCALATIONS" title="Needs a human decision">
            {escalations.length === 0 ? (
              <p style={body}>No open escalations.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {escalations.map((e) => (
                  <div
                    key={e.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                    style={{ border: "1px solid var(--k-border)" }}
                  >
                    <span className="flex items-center gap-2" style={{ minWidth: 0 }}>
                      <StatusChip
                        tone={
                          e.severity === "critical" || e.severity === "high"
                            ? "danger"
                            : e.severity === "normal"
                              ? "warning"
                              : "muted"
                        }
                      >
                        {e.severity}
                      </StatusChip>
                      <span style={{ ...body, color: "var(--k-fg)" }}>{e.reason}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span style={monoFaint}>
                        {agentName.get(e.agent_id ?? "") ?? "system"} ·{" "}
                        {new Date(e.created_at).toLocaleDateString("en-GB")}
                      </span>
                      {e.status === "open" && (
                        <form action={resolveEscalation}>
                          <input type="hidden" name="id" value={e.id} />
                          <input type="hidden" name="to" value="acknowledged" />
                          <SubmitButton className="kb kb-outline kb-sm" pendingLabel="…">
                            Acknowledge
                          </SubmitButton>
                        </form>
                      )}
                      <form action={resolveEscalation}>
                        <input type="hidden" name="id" value={e.id} />
                        <input type="hidden" name="to" value="resolved" />
                        <SubmitButton className="kb kb-primary kb-sm" pendingLabel="…">
                          Resolve
                        </SubmitButton>
                      </form>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </Reveal>

        {/* Recent decisions */}
        <Reveal className="block">
          <Panel label="// DECIDED" title="Recent decisions">
            {recent.length === 0 ? (
              <p style={body}>No decisions yet.</p>
            ) : (
              <div className="flex flex-col">
                {recent.map((ap) => (
                  <div
                    key={ap.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 py-2"
                    style={{ borderBottom: "1px solid var(--k-border)" }}
                  >
                    <span style={{ ...body, color: "var(--k-fg)" }}>
                      <StatusChip
                        tone={
                          ap.status === "approved"
                            ? "success"
                            : ap.status === "rejected"
                              ? "danger"
                              : "warning"
                        }
                      >
                        {ap.status.replace("_", " ")}
                      </StatusChip>{" "}
                      {ap.proposed}
                    </span>
                    <span style={monoFaint}>
                      {ap.approver_email ?? "—"} ·{" "}
                      {ap.decided_at
                        ? new Date(ap.decided_at).toLocaleString("en-GB")
                        : "expired"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </Reveal>
      </div>
    </div>
  );
}

const body: React.CSSProperties = {
  fontFamily: T.sans,
  fontSize: "0.88rem",
  lineHeight: 1.55,
  color: "var(--k-muted)",
};
const monoFaint: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: "10px",
  letterSpacing: "0.04em",
  color: "var(--k-faint)",
};
