import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@nullshift/db";
import { logAudit } from "@nullshift/db/audit";
import { T } from "@nullshift/ui/tokens";
import { carePlan, CARE_PLAN_MRR } from "@/lib/carePlans";
import { generateProjectInvoice } from "@/lib/projectInvoice";

/**
 * Client portal — proposal & invoices. The client reviews the itemised proposal
 * (the build modules + total), accepts it and signs the DPA in one step, then
 * sees + pays itemised invoices. RLS scopes everything to their own tenant;
 * acceptance + the DPA record are written by a trusted server action after the
 * membership is confirmed (projects/compliance are staff-write under RLS).
 */
export const dynamic = "force-dynamic";

type Project = {
  id: string;
  tenant_id: string;
  name: string;
  stage: string;
  proposal_status: string;
  proposed_plan: string | null;
};
type Item = { id: string; project_id: string; name: string; amount: number };
type Invoice = {
  id: string;
  project_id: string;
  amount: number;
  status: string;
  hosted_invoice_url: string | null;
};
type InvItem = { invoice_id: string; name: string; amount: number; quantity: number };

const gbp = (n: number) => "£" + Math.round(n).toLocaleString("en-GB");

async function acceptProposal(formData: FormData) {
  "use server";
  const projectId = String(formData.get("project_id") || "");
  if (!projectId) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // Confirm the caller can see this project (RLS only returns their tenant's).
  const { data: project } = await supabase
    .from("projects")
    .select("id, tenant_id, proposal_status, proposed_plan")
    .eq("id", projectId)
    .maybeSingle();
  if (!project || project.proposal_status !== "sent") return;

  // Trusted writes (projects + compliance are staff-write under RLS).
  const service = createServiceClient();
  await service
    .from("projects")
    .update({ proposal_status: "accepted" })
    .eq("id", projectId);
  await service.from("compliance_records").insert({
    tenant_id: project.tenant_id,
    kind: "dpa_signed",
    detail: { signed_by: user.id, via: "portal" },
  });

  await logAudit({
    action: "proposal.accepted",
    target: `project:${projectId}`,
    tenantId: project.tenant_id,
  });
  await logAudit({
    action: "dpa.signed",
    target: `tenant:${project.tenant_id}`,
    tenantId: project.tenant_id,
  });

  // Activate the proposed care plan (if any) — only if there's no active
  // subscription yet, so re-accepting can't double-subscribe.
  if (project.proposed_plan && project.proposed_plan in CARE_PLAN_MRR) {
    const { data: activeSub } = await service
      .from("subscriptions")
      .select("id")
      .eq("tenant_id", project.tenant_id)
      .eq("status", "active")
      .limit(1);
    if (!activeSub?.length) {
      await service.from("subscriptions").insert({
        tenant_id: project.tenant_id,
        plan: project.proposed_plan,
        mrr: CARE_PLAN_MRR[project.proposed_plan],
        status: "active",
        started_at: new Date().toISOString(),
      });
      await logAudit({
        action: "subscription.activated",
        target: `tenant:${project.tenant_id}`,
        tenantId: project.tenant_id,
        metadata: { plan: project.proposed_plan },
      });
    }
  }

  // Auto-draft & send the itemised build invoice on acceptance.
  const inv = await generateProjectInvoice(service, {
    tenantId: project.tenant_id,
    projectId,
  });
  if (inv.ok)
    await logAudit({
      action: "invoice.generated",
      target: `project:${projectId}`,
      tenantId: project.tenant_id,
      metadata: { total: inv.total, via: "auto-accept" },
    });

  revalidatePath("/portal/proposal");
}

async function declineProposal(formData: FormData) {
  "use server";
  const projectId = String(formData.get("project_id") || "");
  if (!projectId) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: project } = await supabase
    .from("projects")
    .select("id, tenant_id, proposal_status")
    .eq("id", projectId)
    .maybeSingle();
  if (!project || project.proposal_status !== "sent") return;

  const service = createServiceClient();
  await service
    .from("projects")
    .update({ proposal_status: "declined" })
    .eq("id", projectId);
  await logAudit({
    action: "proposal.declined",
    target: `project:${projectId}`,
    tenantId: project.tenant_id,
  });
  revalidatePath("/portal/proposal");
}

const tone: Record<string, string> = {
  draft: T.muted,
  sent: T.warning,
  accepted: T.primary,
  declined: T.danger,
  paid: T.success,
  open: T.warning,
  void: T.muted,
};
function Badge({ s }: { s: string }) {
  const c = tone[s] ?? T.muted;
  return (
    <span
      style={{
        fontFamily: T.mono,
        fontSize: "10px",
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        color: c,
        background: `${c}14`,
        border: `1px solid ${c}40`,
        borderRadius: 999,
        padding: "2px 8px",
      }}
    >
      {s.replace(/_/g, " ")}
    </span>
  );
}

export default async function PortalProposal() {
  const supabase = await createClient();
  const [{ data: projects }, { data: items }, { data: invoices }, { data: invItems }] =
    await Promise.all([
      supabase
        .from("projects")
        .select("id, tenant_id, name, stage, proposal_status, proposed_plan")
        .order("created_at"),
      supabase
        .from("project_items")
        .select("id, project_id, name, amount")
        .order("sort")
        .order("created_at"),
      supabase
        .from("invoices")
        .select("id, project_id, amount, status, hosted_invoice_url")
        .order("created_at", { ascending: false }),
      supabase.from("invoice_items").select("invoice_id, name, amount, quantity"),
    ]);
  const projectList = (projects ?? []) as Project[];
  const itemList = (items ?? []) as Item[];
  const invoiceList = (invoices ?? []) as Invoice[];
  const invItemList = (invItems ?? []) as InvItem[];

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
        {"// Proposal & invoices"}
      </div>
      <h1
        style={{
          fontFamily: T.display,
          fontWeight: 600,
          fontSize: "1.8rem",
          color: T.fg,
          marginBottom: 24,
        }}
      >
        Your project
      </h1>

      {projectList.length === 0 && (
        <p style={{ fontFamily: T.sans, color: T.muted }}>
          Your project is being set up — your proposal will appear here.
        </p>
      )}

      {projectList.map((project) => {
        const pItems = itemList.filter((i) => i.project_id === project.id);
        const total = pItems.reduce((s, i) => s + Number(i.amount), 0);
        const pInvoices = invoiceList.filter((i) => i.project_id === project.id);
        return (
          <div key={project.id} style={{ marginBottom: 32 }}>
            <div className="flex items-center gap-3" style={{ marginBottom: 14 }}>
              <span
                style={{
                  fontFamily: T.display,
                  fontWeight: 600,
                  fontSize: "1.1rem",
                  color: T.fg,
                }}
              >
                {project.name}
              </span>
              <Badge s={project.stage} />
            </div>

            {/* Proposal */}
            {pItems.length > 0 && (
              <div
                style={{
                  background: T.surface,
                  border: `1px solid ${T.border}`,
                  borderRadius: T.r.lg,
                  padding: "20px 22px",
                  marginBottom: 14,
                }}
              >
                <div
                  className="flex items-center justify-between"
                  style={{ marginBottom: 12 }}
                >
                  <span
                    style={{
                      fontFamily: T.sans,
                      fontWeight: 600,
                      fontSize: "0.95rem",
                      color: T.fg,
                    }}
                  >
                    Proposed build
                  </span>
                  <Badge s={project.proposal_status} />
                </div>
                {pItems.map((it) => (
                  <div
                    key={it.id}
                    className="flex items-center justify-between"
                    style={{ padding: "8px 0", borderTop: `1px solid ${T.border}` }}
                  >
                    <span style={{ fontFamily: T.sans, fontSize: "0.9rem", color: T.fg }}>
                      {it.name}
                    </span>
                    <span
                      style={{ fontFamily: T.mono, fontSize: "0.85rem", color: T.muted }}
                    >
                      {gbp(Number(it.amount))}
                    </span>
                  </div>
                ))}
                <div
                  className="flex items-center justify-between"
                  style={{
                    padding: "12px 0 0",
                    borderTop: `1px solid ${T.border}`,
                    marginTop: 4,
                  }}
                >
                  <span style={{ fontFamily: T.sans, fontWeight: 600, color: T.fg }}>
                    Total
                  </span>
                  <span
                    style={{
                      fontFamily: T.display,
                      fontWeight: 700,
                      fontSize: "1.3rem",
                      color: T.fg,
                    }}
                  >
                    {gbp(total)}
                  </span>
                </div>

                {carePlan(project.proposed_plan) && (
                  <div
                    className="flex items-center justify-between"
                    style={{
                      padding: "12px 0 0",
                      marginTop: 8,
                      borderTop: `1px solid ${T.border}`,
                    }}
                  >
                    <span style={{ fontFamily: T.sans, fontSize: "0.9rem", color: T.fg }}>
                      Ongoing care · {carePlan(project.proposed_plan)!.label}
                    </span>
                    <span
                      style={{ fontFamily: T.mono, fontSize: "0.85rem", color: T.muted }}
                    >
                      {gbp(carePlan(project.proposed_plan)!.mrr)}/mo
                    </span>
                  </div>
                )}

                {project.proposal_status === "sent" && (
                  <div style={{ marginTop: 16 }}>
                    <p
                      style={{
                        fontFamily: T.sans,
                        fontSize: "0.82rem",
                        color: T.muted,
                        marginBottom: 12,
                        lineHeight: 1.6,
                      }}
                    >
                      Accepting confirms this scope and price
                      {carePlan(project.proposed_plan)
                        ? ` and the ${carePlan(project.proposed_plan)!.label} care plan`
                        : ""}
                      , and signs the Data Processing Agreement so we can begin.
                      We&apos;ll email your invoice straight away.
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <form action={acceptProposal}>
                        <input type="hidden" name="project_id" value={project.id} />
                        <button
                          type="submit"
                          style={{
                            fontFamily: T.sans,
                            fontWeight: 600,
                            fontSize: "0.9rem",
                            height: 44,
                            paddingInline: 22,
                            background: T.primary,
                            color: T.primaryFg,
                            border: "none",
                            borderRadius: T.r.md,
                            cursor: "pointer",
                            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18)`,
                          }}
                        >
                          Accept proposal &amp; sign DPA →
                        </button>
                      </form>
                      <form action={declineProposal}>
                        <input type="hidden" name="project_id" value={project.id} />
                        <button
                          type="submit"
                          style={{
                            fontFamily: T.sans,
                            fontWeight: 600,
                            fontSize: "0.9rem",
                            height: 44,
                            paddingInline: 18,
                            background: "transparent",
                            color: T.muted,
                            border: `1px solid ${T.border}`,
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
                {project.proposal_status === "declined" && (
                  <p
                    style={{
                      fontFamily: T.mono,
                      fontSize: 11,
                      color: T.danger,
                      marginTop: 14,
                    }}
                  >
                    You declined this proposal. Contact us if you&apos;d like changes.
                  </p>
                )}
                {project.proposal_status === "accepted" && (
                  <p
                    style={{
                      fontFamily: T.mono,
                      fontSize: 11,
                      color: T.primary,
                      marginTop: 14,
                    }}
                  >
                    Accepted · DPA signed ✓ — we&apos;re on it.
                  </p>
                )}
                {project.proposal_status === "draft" && (
                  <p
                    style={{
                      fontFamily: T.mono,
                      fontSize: 11,
                      color: T.muted,
                      marginTop: 14,
                    }}
                  >
                    Your proposal is being prepared.
                  </p>
                )}
              </div>
            )}

            {/* Invoices */}
            {pInvoices.map((inv) => {
              const lines = invItemList.filter((l) => l.invoice_id === inv.id);
              return (
                <div
                  key={inv.id}
                  style={{
                    background: T.surface,
                    border: `1px solid ${T.border}`,
                    borderRadius: T.r.lg,
                    padding: "18px 20px",
                    marginBottom: 10,
                  }}
                >
                  <div
                    className="flex items-center justify-between"
                    style={{ marginBottom: 10 }}
                  >
                    <span
                      style={{
                        fontFamily: T.sans,
                        fontWeight: 600,
                        fontSize: "0.95rem",
                        color: T.fg,
                      }}
                    >
                      Invoice · {gbp(Number(inv.amount))}
                    </span>
                    <Badge s={inv.status} />
                  </div>
                  {lines.map((l, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between"
                      style={{
                        padding: "5px 0",
                        borderTop: `1px solid ${T.border}`,
                        fontFamily: T.sans,
                        fontSize: "0.84rem",
                        color: T.muted,
                      }}
                    >
                      <span>
                        {l.name}
                        {l.quantity > 1 ? ` ×${l.quantity}` : ""}
                      </span>
                      <span style={{ fontFamily: T.mono }}>
                        {gbp(Number(l.amount) * l.quantity)}
                      </span>
                    </div>
                  ))}
                  {inv.status !== "paid" && inv.hosted_invoice_url && (
                    <a
                      href={inv.hosted_invoice_url}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: "inline-block",
                        marginTop: 14,
                        fontFamily: T.sans,
                        fontWeight: 600,
                        fontSize: "0.88rem",
                        height: 40,
                        lineHeight: "40px",
                        paddingInline: 20,
                        background: T.primary,
                        color: T.primaryFg,
                        borderRadius: T.r.md,
                        textDecoration: "none",
                      }}
                    >
                      Pay now →
                    </a>
                  )}
                  {inv.status === "paid" && (
                    <p
                      style={{
                        fontFamily: T.mono,
                        fontSize: 11,
                        color: T.success,
                        marginTop: 12,
                      }}
                    >
                      Paid ✓ — thank you.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
