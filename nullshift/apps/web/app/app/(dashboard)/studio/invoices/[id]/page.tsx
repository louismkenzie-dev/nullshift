import Link from "next/link";
import { notFound } from "next/navigation";
import { T } from "@nullshift/ui/tokens";
import { PageHeader, Panel, StatusChip } from "@/components/app/AppKit";
import { ProductGate } from "@/components/products/ProductGate";
import { requireProduct } from "@/lib/products/session";
import { getClient, getInvoice } from "@/lib/studio/data";
import { invoiceStatusAction } from "../../actions";
import { InvoiceEditor } from "./InvoiceEditor";

export const dynamic = "force-dynamic";

export default async function InvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { workspace, entitlement } = await requireProduct(
    "studio",
    `/app/studio/invoices/${id}`
  );
  if (!entitlement.entitled)
    return <ProductGate product="studio" entitlement={entitlement} />;
  const inv = await getInvoice(workspace.tenantId, id);
  if (!inv) notFound();
  const client = await getClient(workspace.tenantId, inv.client_id);
  if (!client) notFound();
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://nullshift.co.uk").replace(
    /\/$/,
    ""
  );
  const btn = (status: string, label: string, primary = false) => (
    <form action={invoiceStatusAction}>
      <input type="hidden" name="id" value={inv.id} />
      <input type="hidden" name="status" value={status} />
      <button type="submit" className={`kb ${primary ? "kb-primary" : "kb-outline"}`}>
        {label}
      </button>
    </form>
  );
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        index="05"
        label="Nullshift Studio"
        title={`${inv.number} · ${client.company || client.name}`}
        actions={
          <>
            <Link href={`/app/studio/clients/${client.id}`} className="kb kb-outline">
              Client
            </Link>
            {inv.status !== "draft" && inv.status !== "void" && (
              <a
                href={`${site}/c/${client.token}/invoice/${inv.id}`}
                target="_blank"
                rel="noreferrer"
                className="kb kb-outline"
              >
                View as client
              </a>
            )}
            {inv.status === "draft" && btn("sent", "Send to client", true)}
            {inv.status === "sent" && (
              <>
                {btn("sent", "Resend")}
                {btn("paid", "Mark paid", true)}
              </>
            )}
            {(inv.status === "draft" || inv.status === "sent") && btn("void", "Void")}
            <StatusChip
              tone={
                inv.status === "paid"
                  ? "success"
                  : inv.status === "sent"
                    ? "warning"
                    : inv.status === "void"
                      ? "danger"
                      : "muted"
              }
            >
              {inv.status}
            </StatusChip>
          </>
        }
      />
      {sp.saved && (
        <Panel>
          <p style={{ fontFamily: T.sans, color: T.success }}>Done.</p>
        </Panel>
      )}
      {sp.error && (
        <Panel>
          <p style={{ fontFamily: T.sans, color: T.danger }}>{sp.error}</p>
        </Panel>
      )}
      {inv.status === "paid" && (
        <Panel>
          <p style={{ fontFamily: T.sans, color: T.success }}>
            Paid {inv.paid_at ? new Date(inv.paid_at).toLocaleDateString("en-GB") : ""}.
          </p>
        </Panel>
      )}
      <InvoiceEditor inv={inv} />
    </div>
  );
}
