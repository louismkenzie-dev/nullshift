import Link from "next/link";
import { notFound } from "next/navigation";
import { T } from "@nullshift/ui/tokens";
import { PageHeader, Panel, StatusChip } from "@/components/app/AppKit";
import { ProductGate } from "@/components/products/ProductGate";
import { PlanView } from "@/components/plan-embed/PlanView";
import { requireProduct } from "@/lib/products/session";
import { getEmbed, getLead } from "@/lib/plan-embed/data";

export const dynamic = "force-dynamic";

export default async function PlanLeadPage({
  params,
}: {
  params: Promise<{ leadId: string }>;
}) {
  const { leadId } = await params;
  const { workspace, entitlement } = await requireProduct(
    "plans",
    `/app/plans/leads/${leadId}`
  );
  if (!entitlement.entitled)
    return <ProductGate product="plans" entitlement={entitlement} />;
  const lead = await getLead(workspace.tenantId, leadId);
  if (!lead) notFound();
  const embed = await getEmbed(workspace.tenantId, lead.embed_id);
  const a = lead.answers;
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        index="04"
        label="Nullshift Plans"
        title={`${lead.name} · ${lead.business_name}`}
        lead={
          <>
            <a href={`mailto:${lead.email}`} style={{ color: "var(--k-accent)" }}>
              {lead.email}
            </a>
            {lead.phone ? ` · ${lead.phone}` : ""}
          </>
        }
        actions={
          <>
            <Link href="/app/plans/leads" className="kb kb-outline">
              All leads
            </Link>
            <StatusChip
              tone={
                lead.status === "ready"
                  ? "success"
                  : lead.status === "failed"
                    ? "danger"
                    : "warning"
              }
            >
              {lead.status}
            </StatusChip>
          </>
        }
      />
      <Panel label="Their answers">
        <dl
          className="grid gap-x-8 gap-y-3 sm:grid-cols-2"
          style={{ fontFamily: T.sans, fontSize: "0.9rem" }}
        >
          {[
            ["Sector", a.sector],
            ["Team", a.teamSize],
            ["Bottleneck", a.bottleneck],
            ["In their words", a.bottleneckDetail],
            ["Tools", a.tools],
            ["90-day goal", a.goal],
            ["Budget", a.budget],
            ["From page", lead.source_url ?? "—"],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="k-label">{k}</dt>
              <dd style={{ color: "var(--k-fg)", marginTop: 4 }}>{v}</dd>
            </div>
          ))}
        </dl>
        {lead.error && (
          <p
            className="mt-4"
            style={{ fontFamily: T.mono, fontSize: "0.75rem", color: T.danger }}
          >
            {lead.error}
          </p>
        )}
      </Panel>
      {lead.plan && embed && (
        <div className="k-kard" style={{ overflow: "hidden" }}>
          <PlanView
            plan={lead.plan}
            brand={embed.brand}
            businessName={lead.business_name}
            forName={lead.name}
            poweredBy={false}
          />
        </div>
      )}
    </div>
  );
}
