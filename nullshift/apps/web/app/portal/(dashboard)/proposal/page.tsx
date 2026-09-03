import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@nullshift/db";
import { getPortalClient, isClientPreview } from "@/lib/clientPreview";
import { logAudit } from "@nullshift/db/audit";
import { T } from "@nullshift/ui/tokens";
import { clientRef, invoiceRef } from "@nullshift/ui/format";
import { carePlan } from "@/lib/carePlans";
import { generateProjectInvoice } from "@/lib/projectInvoice";
import { DpaTemplate } from "@/components/legal/DpaTemplate";
import { ServiceTermsTemplate } from "@/components/legal/ServiceTermsTemplate";
import { Contract } from "@/components/portal/Contract";
import {
  SERVICE_TERMS_ACKNOWLEDGEMENTS,
  SERVICE_TERMS_VERSION,
} from "@nullshift/content/serviceTerms";
import { BankTransferDetails } from "@/components/portal/BankTransferDetails";
import { ProposalDocument } from "@/components/portal/ProposalDocument";
import { SignProposal } from "@/components/portal/SignProposal";
import { EntityTypeForm } from "@/components/portal/EntityTypeForm";
import { setEntityType } from "../dpa-actions";
import { dpaReadyToSend } from "@/lib/dpa";
import { recordClientViews, recordDocumentEvent } from "@/lib/documentEvents";
import { advanceOnly } from "@/lib/projectStage";
import { sendEmail } from "@/lib/sendEmail";
import { proposalSignedEmail } from "@/lib/clientEmails";
import { PageHeader, StatusChip } from "@/components/app/AppKit";
import { Reveal, MonoTag } from "@/components/kyma";

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

async function acceptProposal(formData: FormData): Promise<{ ok: boolean }> {
  "use server";
  // Staff view-as-client preview is read-only — a preview click must never
  // sign the client's agreement.
  if (await isClientPreview()) return { ok: false };
  const projectId = String(formData.get("project_id") || "");
  const signature = String(formData.get("signature") || "").trim();
  if (!projectId || !signature) return { ok: false };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  // Confirm the caller can see this project (RLS only returns their tenant's).
  // NB: dpa_client_submitted_at is required by dpaReadyToSend() — without it
  // dpaSubmitted() is always false and signing silently no-ops.
  const { data: project } = await supabase
    .from("projects")
    .select(
      "id, tenant_id, proposal_status, proposed_plan, stage, overview, payment_terms, client_entity_type, dpa_client_company_name, dpa_client_company_number, dpa_client_registered_address, dpa_personal_data, dpa_special_category, dpa_special_category_detail, dpa_client_submitted_at"
    )
    .eq("id", projectId)
    .maybeSingle();
  // Must be sent and the client must have submitted a complete DPA declaration.
  // Returning {ok:false} (rather than letting the UI celebrate) when the proposal
  // was already actioned elsewhere or the row moved on.
  if (!project || project.proposal_status !== "sent" || !dpaReadyToSend(project))
    return { ok: false };

  // The core write: flip to accepted + record the typed signature. The
  // `.eq("proposal_status","sent")` + `.select()` make this a guarded compare-
  // and-set, so a concurrent accept (e.g. a second tab) updates 0 rows and we
  // report failure instead of celebrating a sign that didn't take.
  const now = new Date().toISOString();
  const service = createServiceClient();
  // Signing opens onboarding — the deposit invoice goes out now, and the move
  // to 'build' is gated on payment (or a recorded staff override) in the admin
  // stage control. Work is not committed before money moves.
  //
  // Forward only. A client who was delivered before the portal existed can sign
  // retrospectively while sitting on `care`, and writing `onboarding` over that
  // would tell everyone their live system is a fresh build.
  const nextStage = advanceOnly(project.stage, "onboarding");
  const { data: updated, error: acceptErr } = await service
    .from("projects")
    .update({
      proposal_status: "accepted",
      accepted_name: signature,
      accepted_signature: signature,
      accepted_at: now,
      ...(nextStage ? { stage: nextStage } : {}),
    })
    .eq("id", projectId)
    .eq("proposal_status", "sent")
    .select("id");
  if (acceptErr || !updated || updated.length === 0) return { ok: false };

  // Everything past here is best-effort — the proposal IS accepted, so a hiccup
  // in a downstream step must never turn the client's success into an error.
  try {
    // Read receipts: one signature signs both the proposal and the DPA.
    for (const documentType of ["proposal", "dpa"] as const)
      await recordDocumentEvent(service, {
        tenantId: project.tenant_id,
        documentType,
        documentId: projectId,
        event: "signed",
        actor: user.id,
        actorKind: "client",
        meta: { signed_name: signature },
      });
    // Freeze the accepted agreement (migration 0025): the exact modules,
    // overview, payment terms and care plan at the moment of signature. The
    // signed PDF renders from THIS — scope edits after acceptance can never
    // change what the legal record says was agreed.
    const { data: snapItems } = await service
      .from("project_items")
      .select("name, amount")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });
    const snapshotItems = ((snapItems ?? []) as { name: string; amount: number }[]).map(
      (i) => ({ name: i.name, amount: Number(i.amount) })
    );
    await service
      .from("projects")
      .update({
        accepted_snapshot: {
          items: snapshotItems,
          total: snapshotItems.reduce((s, i) => s + i.amount, 0),
          overview: project.overview ?? null,
          payment_terms: project.payment_terms ?? null,
          proposed_plan: project.proposed_plan ?? null,
          client_entity_type: project.client_entity_type ?? null,
          accepted_name: signature,
          accepted_at: now,
        },
      })
      .eq("id", projectId);

    // Record the data-processing acceptance (satisfies the DPA-before-live gate
    // for both: a full DPA for limited companies, standard terms for sole traders).
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

    // The same signature accepts the Service & Support Terms — what the plan
    // covers, what "support" means, that new capability is quoted separately,
    // and that without a plan the client runs hosting and maintenance
    // themselves. Recorded as its own compliance record with the version, so
    // "which terms did they actually agree to?" has an answer years later.
    await service.from("compliance_records").insert({
      tenant_id: project.tenant_id,
      kind: "service_terms_signed",
      detail: {
        signed_by: user.id,
        signed_name: signature,
        via: "portal",
        version: SERVICE_TERMS_VERSION,
        project_id: projectId,
        care_plan: project.proposed_plan ?? null,
        acknowledged: SERVICE_TERMS_ACKNOWLEDGEMENTS,
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
    await logAudit({
      action: "service_terms.signed",
      target: `tenant:${project.tenant_id}`,
      tenantId: project.tenant_id,
      metadata: { version: SERVICE_TERMS_VERSION },
    });

    // The care plan is NOT auto-activated here — the admin sends the client a
    // Stripe Checkout sign-up from the client hub (they add a card to start the
    // recurring plan), mirroring the build-invoice flow.

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

    // Promote the lead to Won — they've signed, so they're committed — and tell
    // the team. Escape LIKE metacharacters so ilike matches the email exactly.
    const { data: t } = await service
      .from("tenants")
      .select("name, contact_email")
      .eq("id", project.tenant_id)
      .maybeSingle();
    if (t?.contact_email) {
      const emailPattern = t.contact_email.replace(/([\\%_])/g, "\\$1");
      await service.from("leads").update({ status: "won" }).ilike("email", emailPattern);
    }
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
      adminUrl: `${siteUrl}/admin/clients/${project.tenant_id}/docs`,
    });
    await sendEmail({
      purpose: "transactional",
      to: notify,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    });
  } catch (e) {
    console.error("post-accept steps (non-fatal):", e);
  }

  // No revalidatePath here — SignProposal plays the success animation, then
  // refreshes the route itself so the celebration isn't cut short.
  return { ok: true };
}

async function declineProposal(formData: FormData) {
  "use server";
  if (await isClientPreview()) return;
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

// Status → StatusChip tone. Square mono chips, brand-aligned (no rounded pills).
const tone: Record<string, "accent" | "success" | "warning" | "danger" | "muted"> = {
  draft: "muted",
  sent: "warning",
  accepted: "accent",
  declined: "danger",
  paid: "success",
  open: "warning",
  void: "muted",
};
function Badge({ s }: { s: string }) {
  return <StatusChip tone={tone[s] ?? "muted"}>{s.replace(/_/g, " ")}</StatusChip>;
}

export default async function PortalProposal() {
  const { supabase, user, preview } = await getPortalClient();
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

  // Read receipt: the real client (never a staff preview) has now opened the
  // proposal and the DPA that travels with it. First view only is kept.
  if (user && !preview) {
    const sent = projectList.filter((p) => p.proposal_status !== "draft");
    const tenantId = sent[0]?.tenant_id;
    if (tenantId)
      await recordClientViews(createServiceClient(), {
        tenantId,
        userId: user.id,
        documents: sent.flatMap((p) => [
          { documentType: "proposal" as const, documentId: p.id },
          { documentType: "dpa" as const, documentId: p.id },
        ]),
      });
  }

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px" }}>
      <PageHeader
        index="02"
        label="Proposal & invoices"
        title="Your project"
        className="mb-8"
      />

      {projectList.length === 0 && (
        <Reveal>
          <p style={{ fontFamily: T.sans, color: "var(--k-muted)" }}>
            Your project is being set up — your proposal will appear here.
          </p>
        </Reveal>
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
        const termsDoc = (
          <ServiceTermsTemplate
            mode="proposal"
            clientName={project.tenants?.name ?? null}
            effectiveDate={
              project.accepted_at
                ? new Date(project.accepted_at).toLocaleDateString("en-GB")
                : null
            }
            carePlanLabel={carePlan(project.proposed_plan)?.label ?? null}
            accepted={
              project.accepted_at
                ? { name: project.accepted_name ?? "", at: project.accepted_at }
                : null
            }
          />
        );
        return (
          <Reveal key={project.id} className="block" delay={0.05}>
            <div style={{ marginBottom: 32 }}>
              <div className="flex items-center gap-3" style={{ marginBottom: 14 }}>
                <span
                  style={{
                    fontFamily: T.sans,
                    fontWeight: 700,
                    fontSize: "1.1rem",
                    letterSpacing: "-0.01em",
                    textTransform: "uppercase",
                    color: "var(--k-fg)",
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
                    className="k-kard"
                    style={{
                      marginBottom: 14,
                      background: "var(--k-surface)",
                      borderColor: declared ? "var(--k-border)" : "var(--k-accent)",
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
                              fontWeight: 700,
                              fontSize: "0.95rem",
                              textTransform: "uppercase",
                              letterSpacing: "-0.01em",
                              color: "var(--k-fg)",
                            }}
                          >
                            Your business details
                          </span>
                          <span
                            style={{
                              fontFamily: T.mono,
                              fontSize: 11,
                              letterSpacing: "0.08em",
                              textTransform: "uppercase",
                              color: "var(--k-muted)",
                            }}
                          >
                            {limited ? "Limited company" : "Sole trader / other"}
                          </span>
                        </div>
                        {limited && (
                          <p
                            style={{
                              fontFamily: T.sans,
                              fontSize: "0.85rem",
                              color: "var(--k-muted)",
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
                              letterSpacing: "0.08em",
                              textTransform: "uppercase",
                              color: "var(--k-accent)",
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
                                specialCategoryDetail:
                                  project.dpa_special_category_detail,
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
                        background:
                          "color-mix(in oklab, var(--k-surface) 90%, transparent)",
                        border: "1px solid var(--k-border)",
                        backdropFilter: "blur(8px)",
                        WebkitBackdropFilter: "blur(8px)",
                      }}
                    >
                      <span style={{ marginRight: "auto" }}>
                        <MonoTag>Signed documents</MonoTag>
                      </span>
                      <a
                        href={`/api/documents/proposal/${project.id}`}
                        className="kb kb-sm"
                      >
                        ↓ Proposal PDF
                      </a>
                      {limited && (
                        <a href={`/api/documents/dpa/${project.id}`} className="kb kb-sm">
                          ↓ DPA PDF
                        </a>
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

                  {/* Everything the signature binds, readable BEFORE signing.
                    Collapsible while pending; rendered in full once signed so
                    each reads cleanly and saves to PDF.

                    The DPA is no longer limited-company-only: a sole trader is
                    still a controller whose customers' data we process, and
                    gating the document on an entity type the client hasn't
                    declared yet meant nobody could read it before signing. */}
                  <Contract
                    id={`terms-document-${project.id}`}
                    title="Service & Support Terms"
                    summary="View the Service & Support Terms"
                    blurb="What your monthly fee covers, what counts as support, how new work is quoted, and what happens if you don't take a plan."
                    accepted={accepted}
                    href={`/api/documents/terms/${project.id}`}
                  >
                    {termsDoc}
                  </Contract>

                  <Contract
                    id={`dpa-document-${project.id}`}
                    title="Data Processing Agreement"
                    summary="View the full Data Processing Agreement"
                    blurb={
                      limited
                        ? "How we handle personal data on your behalf, as your processor under UK GDPR."
                        : "How we handle personal data on your behalf. The full agreement applies where you're a limited company; as a sole trader the same data-protection commitments apply to us as your processor."
                    }
                    accepted={accepted}
                    href={`/api/documents/dpa/${project.id}`}
                  >
                    {dpaDoc}
                  </Contract>

                  {/* Sign / decline — business details are captured above. */}
                  {project.proposal_status === "sent" && dpaReadyToSend(project) && (
                    <SignProposal
                      acceptAction={acceptProposal}
                      declineAction={declineProposal}
                      projectId={project.id}
                      carePlanLabel={carePlan(project.proposed_plan)?.label ?? null}
                    />
                  )}
                  {project.proposal_status === "sent" && !dpaReadyToSend(project) && (
                    <p
                      style={{
                        fontFamily: T.mono,
                        fontSize: 11,
                        letterSpacing: "0.06em",
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
                    letterSpacing: "0.06em",
                    color: "var(--k-muted)",
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
                    letterSpacing: "0.06em",
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
                    className="k-kard"
                    style={{
                      background: "var(--k-surface)",
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
                          fontWeight: 700,
                          fontSize: "0.95rem",
                          textTransform: "uppercase",
                          letterSpacing: "-0.01em",
                          color: "var(--k-fg)",
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
                          padding: "8px 0",
                          borderTop: "1px solid var(--k-border)",
                          fontFamily: T.sans,
                          fontSize: "0.84rem",
                          color: "var(--k-muted)",
                        }}
                      >
                        <span>
                          {l.name}
                          {l.quantity > 1 ? ` ×${l.quantity}` : ""}
                        </span>
                        <span style={{ fontFamily: T.mono, color: "var(--k-fg)" }}>
                          {gbp(Number(l.amount) * l.quantity)}
                        </span>
                      </div>
                    ))}
                    {inv.status !== "paid" && inv.status !== "void" && (
                      <>
                        {inv.hosted_invoice_url && (
                          <a
                            href={inv.hosted_invoice_url}
                            target="_blank"
                            rel="noreferrer"
                            className="kb kb-primary kb-sm"
                            style={{ marginTop: 14 }}
                          >
                            Pay by card
                            <span className="k-arrow" aria-hidden>
                              →
                            </span>
                          </a>
                        )}
                        <BankTransferDetails
                          reference={invoiceRef(project.tenant_id, inv.id)}
                          amount={Number(inv.amount)}
                          only={!inv.hosted_invoice_url}
                        />
                      </>
                    )}
                    {inv.status === "paid" && (
                      <p
                        style={{
                          fontFamily: T.mono,
                          fontSize: 11,
                          letterSpacing: "0.06em",
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
          </Reveal>
        );
      })}
    </div>
  );
}
