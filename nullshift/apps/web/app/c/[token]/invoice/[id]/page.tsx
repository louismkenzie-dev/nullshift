import { notFound } from "next/navigation";
import { getInvoice, resolveClientByToken } from "@/lib/studio/data";
import { ClientShell, InvoiceDocument } from "@/components/studio/Documents";

export const dynamic = "force-dynamic";

export default async function ClientInvoicePage({
  params,
}: {
  params: Promise<{ token: string; id: string }>;
}) {
  const { token, id } = await params;
  const hit = await resolveClientByToken(token);
  if (!hit) notFound();
  const inv = await getInvoice(hit.client.tenant_id, id);
  if (
    !inv ||
    inv.client_id !== hit.client.id ||
    inv.status === "draft" ||
    inv.status === "void"
  )
    notFound();
  return (
    <ClientShell brand={hit.profile.brand} poweredBy={hit.trialing}>
      <a
        href={`/c/${token}`}
        style={{ fontSize: 13, color: "#6b7280", textDecoration: "none" }}
      >
        ← All documents
      </a>
      <div style={{ marginTop: 12 }}>
        <InvoiceDocument inv={inv} profile={hit.profile} client={hit.client} />
      </div>
      <p style={{ marginTop: 16, fontSize: 13, color: "#9ca3af" }}>
        Use your browser&apos;s print option to save this invoice as a PDF.
      </p>
    </ClientShell>
  );
}
