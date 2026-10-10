import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app/AppKit";
import { ProductGate, TrialStrip } from "@/components/products/ProductGate";
import { requireProduct } from "@/lib/products/session";
import { getWidget } from "@/lib/quote-widget/data";
import { WidgetEditor } from "./WidgetEditor";

export const dynamic = "force-dynamic";

export default async function WidgetEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { workspace, entitlement } = await requireProduct("quote", `/app/quote/${id}`);
  if (!entitlement.entitled)
    return <ProductGate product="quote" entitlement={entitlement} />;
  const widget = await getWidget(workspace.tenantId, id);
  if (!widget) notFound();
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://nullshift.co.uk").replace(
    /\/$/,
    ""
  );
  return (
    <div className="flex flex-col gap-8">
      <TrialStrip entitlement={entitlement} product="quote" />
      <PageHeader
        index="01"
        label="Nullshift Quote"
        title={widget.name}
        lead="Edit your rates and questions on the left; the live preview on the right is exactly what customers see."
      />
      <WidgetEditor widget={widget} siteUrl={site} poweredBy={entitlement.trialing} />
    </div>
  );
}
