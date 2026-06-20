import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@nullshift/db";
import { logAudit } from "@nullshift/db/audit";
import { T } from "@nullshift/ui/tokens";
import { clientRef } from "@nullshift/ui/format";
import { carePlan, CARE_PLAN_MRR } from "@/lib/carePlans";
import { generateProjectInvoice } from "@/lib/projectInvoice";
import { DpaTemplate } from "@/components/legal/DpaTemplate";
import { ProposalDocument } from "@/components/portal/ProposalDocument";
import { SignProposal } from "@/components/portal/SignProposal";
import { DownloadDocButton } from "@/components/portal/DownloadDocButton";
import { EntityTypeForm } from "@/components/portal/EntityTypeForm";
import { setEntityType } from "../dpa-actions";
import { dpaReadyToSend } from "@/lib/dpa";
import { sendEmail } from "@/lib/sendEmail";
import { proposalSignedEmail } from "@/lib/clientEmails";

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
  overview: string | null;
  payment_terms: string | null;
  dpa_client_country: string | null;
  dpa_client_company_name: string | null;
  dpa_client_company_number: string | null;
  dpa_client_registered_address: string | null;
  dpa_personal_data: string | null;
  dpa_special_category: boolean | null;
  dpa_special_category_detail: string | null;
  dpa_client_submitted_at: string | null;
  accepted_name: string | null;
  accepted_at: string | null;
  client_entity_type: string | null;
  tenants: { name: string } | null;
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
  const signature = String(formData.get("signature") || "").trim();
  if (!projectId || !signature) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // Confirm the caller can see this project (RLS only returns their tenant's).
  const { data: project } = await supabase
    .from("projects")
    .select(
      "id, tenant_id, proposal_status, proposed_plan, client_entity_type, dpa_client_company_name, dpa_client_company_number, dpa_client_registered_address, dpa_personal_data, dpa_special_category, dpa_special_category_detail"
    )
    .eq("id", projectId)
    .maybeSingle();
  // Must be sent and the client must have submitted a complete DPA declaration.
  if (!project || project.proposal_status !== "sent" || !dpaReadyToSend(project)) return;

  // Trusted writes (projects + compliance are staff-write under RLS). The typed
  // signature is recorded on the project and the DPA compliance record.
  const now = new Date().toISOString();
  const service = createServiceClient();
  await service
    .from("projects")
    .update({
      proposal_status: "accepted",
      accepted_name: signature,
      accepted_signature: signature,
      accepted_at: now,
      // Signing kicks the project into the build stage and unlocks build edits.
      stage: "build",
    })
    .eq("id", projectId);
  // Record the data-processing acceptance (satisfies the DPA-before-live gate for
  // both: a full DPA for limited companies, standard terms for sole traders).
  await service.from("compliance_records").insert({
    tenant_id: project.tenant_id,
    kind: "dpa_signed",
    detail: {
      signed_by: user.id,
      signed_name: signature,
      via: "portal",
      entity_type: project.client_entity_type,
      dpa: project.client_entity_type === "limited",
    },
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

  // Promote the lead to Won — they've signed, so they're committed — and tell the
  // team. Both best-effort; the signature is already recorded above.
  const { data: t } = await service
    .from("tenants")
    .select("name, contact_email")
    .eq("id", project.tenant_id)
    .maybeSingle();
  if (t?.contact_email) {
    await service.from("leads").update({ status: "won" }).ilike("email", t.contact_email);
  }
  try {
    const { data: sumItems } = await service
      .from("project_items")
      .select("amount")
      .eq("project_id", projectId);
    const buildTotal = (sumItems ?? []).reduce(
      (s, i) => s + Number((i as { amount: number }).amount ?? 0),
      0
    );
    const siteUrl = (
      process.env.NEXT_PUBLIC_SITE_URL || "https://nullshift.co.uk"
    ).replace(/\/$/, "");
    const notify = process.env.ENQUIRY_NOTIFY_EMAIL || "louis@nullshift.co.uk";
    const mail = proposalSignedEmail({
      clientName: t?.name ?? "A client",
      reference: clientRef(project.tenant_id),
      total: buildTotal,
      planLabel: carePlan(project.proposed_plan)?.label ?? null,
      adminUrl: `${siteUrl}/admin/clients/${project.tenant_id}`,
    });
    await sendEmail({
      to: notify,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    });
  } catch (e) {
    console.error("proposal-signed admin notify failed (non-fatal):", e);
  }

  // No revalidatePath here — SignProposal plays the success animation, then
  // refreshes the route itself so the celebration isn't cut short.
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
        .select(
          "id, tenant_id, name, stage, proposal_status, proposed_plan, overview, payment_terms, dpa_client_country, dpa_client_company_name, dpa_client_company_number, dpa_client_registered_address, dpa_personal_data, dpa_special_category, dpa_special_category_detail, dpa_client_submitted_at, accepted_name, accepted_at, client_entity_type, tenants(name)"
        )
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
  const projectList = (projects ?? []) as unknown as Project[];
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
        const limited = project.client_entity_type === "limited";
        const declared = !!project.client_entity_type;
        const dpaRequired: boolean | null = declared ? limited : null;
        const accepted = project.proposal_status === "accepted";
        // The full DPA document — reused in the collapsible (while pending) and
        // rendered in full once signed (so it reads cleanly + saves to PDF).
        const dpaDoc = (
          <DpaTemplate
            mode="proposal"
            client={{
              name: project.dpa_client_company_name || project.tenants?.name || "Client",
              country: project.dpa_client_country,
              companyNumber: project.dpa_client_company_number,
              registeredAddress: project.dpa_client_registered_address,
            }}
            effectiveDate={
              project.accepted_at
                ? new Date(project.accepted_at).toLocaleDateString("en-GB")
                : null
            }
            personalDataTypes={project.dpa_personal_data}
            specialCategory={{
              present: !!project.dpa_special_category,
              detail: project.dpa_special_category_detail,
            }}
            accepted={
              project.accepted_at
                ? { name: project.accepted_name ?? "", at: project.accepted_at }
                : null
            }
          />
        );
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

            {/* Your business details — the client fills these as soon as their
                portal exists (the admin can also edit them for discrepancies).
                The DPA applies to limited companies; sole traders sign the
                proposal only. */}
            {project.proposal_status !== "accepted" &&
              project.proposal_status !== "declined" && (
                <div
                  style={{
                    marginBottom: 14,
                    background: T.surface,
                    border: `1px solid ${declared ? T.border : `${T.primary}55`}`,
                    borderRadius: T.r.lg,
                    padding: "20px 22px",
                  }}
                >
                  {declared ? (
                    <>
                      <div
                        className="flex items-center justify-between gap-3 flex-wrap"
                        style={{ marginBottom: limited ? 8 : 0 }}
                      >
                        <span
                          style={{
                            fontFamily: T.sans,
                            fontWeight: 600,
                            fontSize: "0.95rem",
                            color: T.fg,
                          }}
                        >
                          Your business details
                        </span>
                        <span
                          style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}
                        >
                          {limited ? "Limited company" : "Sole trader / other"}
                        </span>
                      </div>
                      {limited && (
                        <p
                          style={{
                            fontFamily: T.sans,
                            fontSize: "0.85rem",
                            color: T.muted,
                            lineHeight: 1.6,
                          }}
                        >
                          {project.dpa_client_company_number
                            ? `Company no. ${project.dpa_client_company_number}`
                            : "Company number — to add"}
                          {project.dpa_client_registered_address
                            ? ` · ${project.dpa_client_registered_address}`
                            : ""}
                        </p>
                      )}
                      <details style={{ marginTop: 10 }}>
                        <summary
                          style={{
                            cursor: "pointer",
                            fontFamily: T.mono,
                            fontSize: 11,
                            color: T.primary,
                          }}
                        >
                          Edit business details
                        </summary>
                        <div style={{ marginTop: 14 }}>
                          <EntityTypeForm
                            action={setEntityType}
                            projectId={project.id}
                            heading="Are you a limited company?"
                            submitLabel="Save business details"
                            defaults={{
                              entityType: project.client_entity_type,
                              companyName: project.dpa_client_company_name,
                              companyNumber: project.dpa_client_company_number,
                              registeredAddress: project.dpa_client_registered_address,
                              country: project.dpa_client_country,
                              personalData: project.dpa_personal_data,
                              specialCategory: project.dpa_special_category,
                              specialCategoryDetail: project.dpa_special_category_detail,
                            }}
                          />
                        </div>
                      </details>
                    </>
                  ) : (
                    <EntityTypeForm
                      action={setEntityType}
                      projectId={project.id}
                      heading="Tell us about your business — for your agreement"
                      submitLabel="Save business details"
                      defaults={{
                        entityType: project.client_entity_type,
                        companyName: project.dpa_client_company_name,
                        companyNumber: project.dpa_client_company_number,
                        registeredAddress: project.dpa_client_registered_address,
                        country: project.dpa_client_country,
                        personalData: project.dpa_personal_data,
                        specialCategory: project.dpa_special_category,
                        specialCategoryDetail: project.dpa_special_category_detail,
                      }}
                    />
                  )}
                </div>
              )}

            {/* Proposal + DPA documents — visible once the admin sends them. */}
            {(project.proposal_status === "sent" || accepted) && (
              <div style={{ marginBottom: 14 }}>
                {/* Download bar — anchored at the top once signed (both docs). */}
                {accepted && (
                  <div
                    style={{
                      position: "sticky",
                      top: 72,
                      zIndex: 5,
                      display: "flex",
                      gap: 10,
                      flexWrap: "wrap",
                      alignItems: "center",
                      marginBottom: 14,
                      padding: "10px 12px",
                      background: `${T.surface}e6`,
                      border: `1px solid ${T.border}`,
                      borderRadius: T.r.md,
                      backdropFilter: "blur(8px)",
                      WebkitBackdropFilter: "blur(8px)",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: T.mono,
                        fontSize: 10,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        color: T.muted,
                        marginRight: "auto",
                      }}
                    >
                      Signed documents
                    </span>
                    <DownloadDocButton
                      targetId={`proposal-document-${project.id}`}
                      filename={`nullshift-proposal-${clientRef(project.tenant_id)}.pdf`}
                      label="Proposal PDF"
                    />
                    {limited && (
                      <DownloadDocButton
                        targetId={`dpa-document-${project.id}`}
                        filename={`nullshift-dpa-${clientRef(project.tenant_id)}.pdf`}
                        label="DPA PDF"
                      />
                    )}
                  </div>
                )}

                <div id={`proposal-document-${project.id}`}>
                  <ProposalDocument
                    reference={clientRef(project.tenant_id)}
                    clientName={project.tenants?.name ?? "Client"}
                    businessName={project.tenants?.name}
                    date={new Date().toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                    overview={project.overview}
                    items={pItems.map((i) => ({ name: i.name, amount: i.amount }))}
                    total={total}
                    carePlan={carePlan(project.proposed_plan)}
                    paymentTerms={project.payment_terms}
                    accepted={
                      project.accepted_at
                        ? { name: project.accepted_name ?? "", at: project.accepted_at }
                        : null
                    }
                    dpaRequired={dpaRequired}
                  />
                </div>

                {/* Full DPA — limited companies only. Collapsible while pending,
                    rendered in full once signed so it reads + saves to PDF. */}
                {limited &&
                  (accepted ? (
                    <div id={`dpa-document-${project.id}`} style={{ marginTop: 12 }}>
                      {dpaDoc}
                    </div>
                  ) : (
                    <details
                      style={{
                        marginTop: 12,
                        background: T.surface,
                        border: `1px solid ${T.border}`,
                        borderRadius: T.r.lg,
                        padding: "14px 18px",
                      }}
                    >
                      <summary
                        style={{
                          cursor: "pointer",
                          fontFamily: T.sans,
                          fontWeight: 600,
                          fontSize: "0.95rem",
                          color: T.fg,
                        }}
                      >
                        View the full Data Processing Agreement
                      </summary>
                      <div style={{ marginTop: 16 }}>{dpaDoc}</div>
                    </details>
                  ))}

                {/* Sign / decline — business details are captured above. */}
                {project.proposal_status === "sent" && dpaReadyToSend(project) && (
                  <SignProposal
                    acceptAction={acceptProposal}
                    declineAction={declineProposal}
                    projectId={project.id}
                    limited={limited}
                    carePlanLabel={carePlan(project.proposed_plan)?.label ?? null}
                  />
                )}
                {project.proposal_status === "sent" && !dpaReadyToSend(project) && (
                  <p
                    style={{
                      fontFamily: T.mono,
                      fontSize: 11,
                      color: T.warning,
                      marginTop: 14,
                    }}
                  >
                    Confirm your business details above, then you can sign.
                  </p>
                )}
              </div>
            )}

            {project.proposal_status === "draft" && (
              <p
                style={{
                  fontFamily: T.mono,
                  fontSize: 11,
                  color: T.muted,
                  marginBottom: 14,
                }}
              >
                Your proposal is being prepared — we&apos;ll email you when it&apos;s
                ready to review and sign.
              </p>
            )}
            {project.proposal_status === "declined" && (
              <p
                style={{
                  fontFamily: T.mono,
                  fontSize: 11,
                  color: T.danger,
                  marginBottom: 14,
                }}
              >
                You declined this proposal. Contact us if you&apos;d like changes.
              </p>
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
