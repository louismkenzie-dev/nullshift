import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@nullshift/db";
import { requireStaff } from "@nullshift/auth/guards";
import { T } from "@nullshift/ui/tokens";
import { clientRef } from "@nullshift/ui/format";
import { carePlan } from "@/lib/carePlans";
import { DpaTemplate } from "@/components/legal/DpaTemplate";
import { ProposalDocument } from "@/components/portal/ProposalDocument";
import { DownloadDocButton } from "@/components/portal/DownloadDocButton";

/**
 * Admin view of a client's signable documents — the same ProposalDocument +
 * DpaTemplate the client sees in their portal, rendered in full so an admin can
 * read them and save each to PDF. Linked from the client hub.
 */
export const dynamic = "force-dynamic";

type Project = {
  id: string;
  name: string;
  stage: string;
  proposal_status: string;
  proposed_plan: string | null;
  overview: string | null;
  payment_terms: string | null;
  client_entity_type: string | null;
  dpa_client_country: string | null;
  dpa_client_company_name: string | null;
  dpa_client_company_number: string | null;
  dpa_client_registered_address: string | null;
  dpa_personal_data: string | null;
  dpa_special_category: boolean | null;
  dpa_special_category_detail: string | null;
  accepted_name: string | null;
  accepted_at: string | null;
};

export default async function ClientDocuments({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: tenantId } = await params;
  if (!(await requireStaff()).ok) notFound();
  const supabase = await createClient();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name")
    .eq("id", tenantId)
    .maybeSingle();
  if (!tenant) notFound();
  const t = tenant as { id: string; name: string };

  const { data: projects } = await supabase
    .from("projects")
    .select(
      "id, name, stage, proposal_status, proposed_plan, overview, payment_terms, client_entity_type, dpa_client_country, dpa_client_company_name, dpa_client_company_number, dpa_client_registered_address, dpa_personal_data, dpa_special_category, dpa_special_category_detail, accepted_name, accepted_at"
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1);
  const project = (projects ?? [])[0] as Project | undefined;

  let itemList: { name: string; amount: number }[] = [];
  if (project) {
    const { data: items } = await supabase
      .from("project_items")
      .select("name, amount")
      .eq("project_id", project.id)
      .order("sort")
      .order("created_at");
    itemList = (items ?? []) as { name: string; amount: number }[];
  }
  const total = itemList.reduce((s, i) => s + Number(i.amount), 0);

  const back = (
    <Link
      href={`/admin/clients/${tenantId}`}
      style={{
        fontFamily: T.mono,
        fontSize: 11,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: T.muted,
        textDecoration: "none",
      }}
    >
      ← Back to client
    </Link>
  );

  if (!project) {
    return (
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        {back}
        <p style={{ fontFamily: T.sans, color: T.muted, marginTop: 20 }}>
          No project documents for {t.name} yet.
        </p>
      </div>
    );
  }

  const limited = project.client_entity_type === "limited";
  const declared = !!project.client_entity_type;
  const dpaRequired: boolean | null = declared ? limited : null;
  const ref = clientRef(t.id);
  const acceptedBlock = project.accepted_at
    ? { name: project.accepted_name ?? "", at: project.accepted_at }
    : null;

  return (
    <div style={{ maxWidth: 820, margin: "0 auto" }}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        {back}
        <div className="flex items-center gap-2 flex-wrap">
          <DownloadDocButton
            targetId="admin-proposal-document"
            filename={`nullshift-proposal-${ref}.pdf`}
            label="Proposal PDF"
          />
          {limited && (
            <DownloadDocButton
              targetId="admin-dpa-document"
              filename={`nullshift-dpa-${ref}.pdf`}
              label="DPA PDF"
            />
          )}
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <div
          style={{
            fontFamily: T.mono,
            fontSize: 10,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: T.primary,
            marginBottom: 8,
          }}
        >
          {"// Documents"}
        </div>
        <h1
          style={{
            fontFamily: T.display,
            fontWeight: 600,
            fontSize: "1.6rem",
            color: T.fg,
            marginBottom: 4,
          }}
        >
          {t.name}
        </h1>
        <p style={{ fontFamily: T.sans, fontSize: "0.9rem", color: T.muted }}>
          {project.proposal_status === "accepted"
            ? "Signed proposal" + (limited ? " and DPA." : ".")
            : "Draft / sent — not yet signed."}
        </p>
      </div>

      <div id="admin-proposal-document" style={{ marginTop: 18 }}>
        <ProposalDocument
          reference={ref}
          clientName={t.name}
          businessName={t.name}
          date={new Date().toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
          overview={project.overview}
          items={itemList.map((i) => ({ name: i.name, amount: i.amount }))}
          total={total}
          carePlan={carePlan(project.proposed_plan)}
          paymentTerms={project.payment_terms}
          accepted={acceptedBlock}
          dpaRequired={dpaRequired}
        />
      </div>

      {limited && (
        <div id="admin-dpa-document" style={{ marginTop: 14 }}>
          <DpaTemplate
            mode="proposal"
            client={{
              name: project.dpa_client_company_name || t.name || "Client",
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
            accepted={acceptedBlock}
          />
        </div>
      )}
    </div>
  );
}
