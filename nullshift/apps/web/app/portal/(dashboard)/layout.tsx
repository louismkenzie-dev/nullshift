import { redirect } from "next/navigation";
import { createClient } from "@nullshift/db";
import { hasSupabaseBrowserConfig } from "@nullshift/db/env";
import { T } from "@nullshift/ui/tokens";
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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/portal/login");
  }

  // A client who books a call only has a `leads` row — provision their workspace
  // (tenant + project + membership) on first landing so the DPA gate has a
  // project to attach to. Idempotent + a no-op for internal staff.
  await ensureClientWorkspace({ userId: user.id, email: user.email ?? null });

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

  return (
    <div
      className="relative"
      style={{
        minHeight: "100vh",
        background: T.bg,
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
      <PortalHeader email={user.email!} />
      {needsDpa && project ? (
        <main
          style={{
            flex: 1,
            display: "flex",
            justifyContent: "center",
            padding: "40px 24px",
          }}
        >
          <div style={{ maxWidth: 640, width: "100%" }}>
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
              {"// One quick step"}
            </div>
            <h1
              style={{
                fontFamily: T.display,
                fontWeight: 600,
                fontSize: "1.6rem",
                color: T.fg,
                marginBottom: 6,
              }}
            >
              Before we begin — your agreement details
            </h1>
            <p
              style={{
                fontFamily: T.sans,
                fontSize: "0.95rem",
                lineHeight: 1.6,
                color: T.muted,
                marginBottom: 20,
              }}
            >
              We need a few details to prepare your Data Processing Agreement. It takes a
              minute, and unlocks the rest of your portal.
            </p>
            <div
              style={{
                background: T.surface,
                border: `1px solid ${T.border}`,
                borderRadius: T.r.lg,
                padding: "22px 22px 24px",
              }}
            >
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
            </div>
          </div>
        </main>
      ) : (
        <main style={{ flex: 1 }}>{children}</main>
      )}
    </div>
  );
}
