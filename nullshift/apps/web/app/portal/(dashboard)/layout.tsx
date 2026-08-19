import { redirect } from "next/navigation";
import { getPortalClient } from "@/lib/clientPreview";
import { PreviewBanner } from "@/components/portal/PreviewBanner";
import { hasSupabaseBrowserConfig } from "@nullshift/db/env";
import { PageHeader, Panel } from "@/components/app/AppKit";
import { PortalHeader } from "./PortalHeader";
import { EntityTypeForm } from "@/components/portal/EntityTypeForm";
import { setEntityType } from "./dpa-actions";
import { dpaReadyToSend } from "@/lib/dpa";
import { ensureClientWorkspace } from "@/lib/ensureClientWorkspace";
import { Atmosphere } from "@/components/funnel/Atmosphere";

// Auth-gated portal — always render per request, never statically prerender,
// so `next build` can't try to reach Supabase with placeholder CI/build env.
export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  if (!hasSupabaseBrowserConfig()) {
    return <>{children}</>;
  }

  // Staff carrying the preview cookie get a tenant-scoped read-only client —
  // the portal renders exactly as that client sees it. Everyone else gets the
  // normal RLS client.
  const { supabase, user, preview } = await getPortalClient();

  if (!user) {
    redirect("/portal/login");
  }

  // A client who books a call only has a `leads` row — provision their workspace
  // (tenant + project + membership) on first landing so the DPA gate has a
  // project to attach to. Idempotent + a no-op for internal staff.
  if (!preview) {
    await ensureClientWorkspace({ userId: user.id, email: user.email ?? null });
  }

  // The client's primary project (RLS scopes to their own tenant). Before they
  // can use the portal they MUST declare their Data Processing Agreement details
  // — a hard gate on landing (the DPA document ports these onto it).
  const { data: projects } = await supabase
    .from("projects")
    .select(
      "id, proposal_status, client_entity_type, dpa_client_company_name, dpa_client_company_number, dpa_client_registered_address, dpa_client_country, dpa_personal_data, dpa_special_category, dpa_special_category_detail, dpa_client_submitted_at"
    )
    .order("created_at", { ascending: false })
    .limit(1);
  const project = projects?.[0] as
    | {
        id: string;
        proposal_status: string;
        client_entity_type: string | null;
        dpa_client_company_name: string | null;
        dpa_client_company_number: string | null;
        dpa_client_registered_address: string | null;
        dpa_client_country: string | null;
        dpa_personal_data: string | null;
        dpa_special_category: boolean | null;
        dpa_special_category_detail: string | null;
        dpa_client_submitted_at: string | null;
      }
    | undefined;

  const needsDpa =
    !!project &&
    project.proposal_status !== "accepted" &&
    project.proposal_status !== "declined" &&
    !dpaReadyToSend(project);

  // Preview never gets trapped behind the client's own DPA gate — staff need
  // to see every page. The banner says the gate is what the client hits first.
  const showGate = needsDpa && !preview;

  return (
    <div
      className={preview ? "relative ns-preview-inert" : "relative"}
      style={{
        minHeight: "100vh",
        background: "var(--k-bg)",
        display: "flex",
        flexDirection: "column",
        zIndex: 1,
      }}
    >
      {/* Shared funnel atmosphere — the same ambient world as /start. The outer
          div's zIndex:1 makes this a contained stacking context, so the -1
          backdrop sits behind the content without escaping behind the page. */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: -1 }}>
        <Atmosphere />
      </div>
      {/* Hairline vertical grid — the same gridded canvas that frames the
          marketing sections (KYMA .k-vgrid). Above the atmosphere, below content. */}
      <div
        aria-hidden
        className="k-vgrid fixed inset-0 pointer-events-none"
        style={{ zIndex: -1, opacity: 0.35 }}
      />
      {preview && (
        <PreviewBanner
          preview={preview}
          gateNote={
            needsDpa
              ? `On first login ${preview.contactName ?? "the client"} must complete the agreement-details (DPA) form before seeing anything below — you're seeing past that gate.`
              : null
          }
        />
      )}
      <PortalHeader email={preview?.contactEmail ?? user.email!} />
      {showGate && project ? (
        <main
          className="px-4 sm:px-6"
          style={{
            flex: 1,
            display: "flex",
            justifyContent: "center",
            paddingTop: 40,
            paddingBottom: 40,
          }}
        >
          <div style={{ maxWidth: 640, width: "100%" }}>
            <PageHeader
              index="00"
              label="One quick step"
              title="Before we begin — your agreement details"
              lead="We need a few details to prepare your Data Processing Agreement. It takes a minute, and unlocks the rest of your portal."
            />
            <Panel pad className="mt-7">
              <EntityTypeForm
                action={setEntityType}
                projectId={project.id}
                heading="Are you a limited company?"
                submitLabel="Save & continue →"
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
            </Panel>
          </div>
        </main>
      ) : (
        <main style={{ flex: 1 }}>{children}</main>
      )}
    </div>
  );
}
