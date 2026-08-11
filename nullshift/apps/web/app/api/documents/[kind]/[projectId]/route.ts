import { createElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@nullshift/db";
import { clientRef } from "@nullshift/ui/format";
import { carePlan } from "@/lib/carePlans";
import { ProposalPdf } from "@/lib/pdf/ProposalPdf";
import { DpaPdf } from "@/lib/pdf/DpaPdf";

/**
 * Server-rendered document downloads for the client portal:
 *
 *   GET /api/documents/proposal/{projectId} → formal A4 proposal PDF
 *   GET /api/documents/dpa/{projectId}      → formal A4 DPA PDF (limited cos only)
 *
 * Auth is the caller's own cookie session; the project is fetched with the
 * RLS-scoped client, so a client can only ever download their own tenant's
 * documents (staff see all, per the projects policies). Rendered with
 * @react-pdf/renderer on the Node runtime — no browser, no screenshots.
 */
export const dynamic = "force-dynamic";

type Project = {
  id: string;
  tenant_id: string;
  name: string;
  stage: string;
  proposal_status: string;
  proposal_sent_at: string | null;
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
  created_at: string;
  tenants: { name: string } | null;
};
type Item = { id: string; project_id: string; name: string; amount: number };

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ kind: string; projectId: string }> }
) {
  const { kind, projectId } = await params;
  if (kind !== "proposal" && kind !== "dpa")
    return new Response("Not found", { status: 404 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorised", { status: 401 });

  // Same columns as the portal proposal page. RLS returns nothing unless the
  // caller belongs to the project's tenant (or is staff) → 404, not 403.
  const { data: project } = (await supabase
    .from("projects")
    .select(
      "id, tenant_id, name, stage, proposal_status, proposal_sent_at, proposed_plan, overview, payment_terms, dpa_client_country, dpa_client_company_name, dpa_client_company_number, dpa_client_registered_address, dpa_personal_data, dpa_special_category, dpa_special_category_detail, dpa_client_submitted_at, accepted_name, accepted_at, client_entity_type, created_at, tenants(name)"
    )
    .eq("id", projectId)
    .maybeSingle()) as { data: Project | null };
  if (!project) return new Response("Not found", { status: 404 });

  // Draft and declined documents are internal — only proposals the admin has
  // actually sent (or the client has accepted) are downloadable, matching what
  // the portal UI shows.
  if (project.proposal_status !== "sent" && project.proposal_status !== "accepted")
    return new Response("Not found", { status: 404 });

  // The full DPA only exists for limited companies.
  if (kind === "dpa" && project.client_entity_type !== "limited")
    return new Response("Not found", { status: 404 });

  const ref = clientRef(project.tenant_id);
  const accepted = project.accepted_at
    ? { name: project.accepted_name ?? "", at: project.accepted_at }
    : null;
  // The document carries its own date — when it was sent (falling back to
  // acceptance/creation for older rows) — never the download time, so a
  // re-download months later still matches the copy saved at signing.
  const date = new Date(
    project.proposal_sent_at ?? project.accepted_at ?? project.created_at
  ).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  let doc: React.ReactElement<DocumentProps>;
  if (kind === "proposal") {
    const { data: items } = await supabase
      .from("project_items")
      .select("id, project_id, name, amount")
      .eq("project_id", projectId)
      .order("sort")
      .order("created_at");
    const itemList = (items ?? []) as Item[];
    const total = itemList.reduce((s, i) => s + Number(i.amount), 0);
    const declared = !!project.client_entity_type;
    const dpaRequired: boolean | null = declared
      ? project.client_entity_type === "limited"
      : null;

    doc = createElement(ProposalPdf, {
      reference: ref,
      clientName: project.tenants?.name ?? "Client",
      businessName: project.tenants?.name,
      date,
      overview: project.overview,
      items: itemList.map((i) => ({ name: i.name, amount: Number(i.amount) })),
      total,
      carePlan: carePlan(project.proposed_plan),
      paymentTerms: project.payment_terms,
      accepted,
      dpaRequired,
    }) as React.ReactElement<DocumentProps>;
  } else {
    doc = createElement(DpaPdf, {
      reference: ref,
      date,
      client: {
        name: project.dpa_client_company_name || project.tenants?.name || "Client",
        country: project.dpa_client_country,
        companyNumber: project.dpa_client_company_number,
        registeredAddress: project.dpa_client_registered_address,
      },
      effectiveDate: project.accepted_at
        ? new Date(project.accepted_at).toLocaleDateString("en-GB")
        : null,
      personalDataTypes: project.dpa_personal_data,
      specialCategory: {
        present: !!project.dpa_special_category,
        detail: project.dpa_special_category_detail,
      },
      accepted,
    }) as React.ReactElement<DocumentProps>;
  }

  const buffer = await renderToBuffer(doc);
  const filename = `nullshift-${kind}-${ref}.pdf`;
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
