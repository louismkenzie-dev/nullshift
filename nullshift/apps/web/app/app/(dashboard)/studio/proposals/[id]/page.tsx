import Link from "next/link";
import { notFound } from "next/navigation";
import { T } from "@nullshift/ui/tokens";
import { PageHeader, Panel, StatusChip } from "@/components/app/AppKit";
import { ProductGate } from "@/components/products/ProductGate";
import { requireProduct } from "@/lib/products/session";
import { getClient, getProfile, getProposal } from "@/lib/studio/data";
import {
  duplicateProposalAction,
  invoiceFromProposalAction,
  sendProposalAction,
} from "../../actions";
import { ProposalEditor } from "./ProposalEditor";

export const dynamic = "force-dynamic";

export default async function ProposalPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { workspace, email, entitlement } = await requireProduct(
    "studio",
    `/app/studio/proposals/${id}`
  );
  if (!entitlement.entitled)
    return <ProductGate product="studio" entitlement={entitlement} />;
  const tid = workspace.tenantId;
  const p = await getProposal(tid, id);
  if (!p) notFound();
  const [client, profile] = await Promise.all([
    getClient(tid, p.client_id),
    getProfile(tid, workspace.tenantName, email),
  ]);
  if (!client) notFound();
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://nullshift.co.uk").replace(
    /\/$/,
    ""
  );
  const tone =
    p.status === "accepted"
      ? "success"
      : p.status === "sent"
        ? "accent"
        : p.status === "declined"
          ? "danger"
          : "muted";
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        index="05"
        label="Nullshift Studio"
        title={`${p.number} · ${client.company || client.name}`}
        lead={p.title}
        actions={
          <>
            <Link href={`/app/studio/clients/${client.id}`} className="kb kb-outline">
              Client
            </Link>
            <a
              href={`${site}/c/${client.token}/proposal/${p.id}`}
              target="_blank"
              rel="noreferrer"
              className="kb kb-outline"
            >
              Preview as client
            </a>
            {(p.status === "draft" || p.status === "sent") && (
              <form action={sendProposalAction}>
                <input type="hidden" name="id" value={p.id} />
                <button type="submit" className="kb kb-primary">
                  {p.status === "sent" ? "Resend to client" : "Send to client"}
                </button>
              </form>
            )}
            <StatusChip tone={tone}>{p.status}</StatusChip>
          </>
        }
      />
      {sp.sent && (
        <Panel>
          <p style={{ fontFamily: T.sans, color: T.success }}>
            Sent to {client.email}. They accept at their private link.
          </p>
        </Panel>
      )}
      {sp.error && (
        <Panel>
          <p style={{ fontFamily: T.sans, color: T.danger }}>{sp.error}</p>
        </Panel>
      )}
      {p.status === "accepted" && (
        <Panel
          label="Accepted"
          title={`by ${p.accepted_name}`}
          actions={
            <span
              style={{ fontFamily: T.mono, fontSize: "0.68rem", color: "var(--k-muted)" }}
            >
              {new Date(p.accepted_at!).toLocaleString("en-GB")}
            </span>
          }
        >
          <p
            style={{
              fontFamily: T.mono,
              fontSize: "0.72rem",
              color: "var(--k-faint)",
              wordBreak: "break-all",
            }}
          >
            SHA-256 {p.accepted_hash}
          </p>
          <p
            className="mt-2"
            style={{ fontFamily: T.sans, fontSize: "0.9rem", color: "var(--k-muted)" }}
          >
            The content below is frozen. Raise an invoice from it, or duplicate it to
            propose changes.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <form action={invoiceFromProposalAction} className="flex items-center gap-2">
              <input type="hidden" name="id" value={p.id} />
              <select
                name="percent"
                className="k-select"
                style={{ minHeight: 40, width: 150 }}
                defaultValue="50"
              >
                <option value="25">25% deposit</option>
                <option value="50">50% deposit</option>
                <option value="100">Full amount</option>
              </select>
              <button type="submit" className="kb kb-primary kb-sm">
                Create invoice
              </button>
            </form>
            <form action={duplicateProposalAction}>
              <input type="hidden" name="id" value={p.id} />
              <button type="submit" className="kb kb-outline kb-sm">
                Duplicate as new version
              </button>
            </form>
          </div>
        </Panel>
      )}
      {p.status === "declined" && (
        <Panel>
          <p style={{ fontFamily: T.sans, color: "var(--k-muted)" }}>
            Declined{" "}
            {p.declined_at ? new Date(p.declined_at).toLocaleDateString("en-GB") : ""}.{" "}
            <form action={duplicateProposalAction} style={{ display: "inline" }}>
              <input type="hidden" name="id" value={p.id} />
              <button
                type="submit"
                className="kb kb-outline kb-sm"
                style={{ marginLeft: 8 }}
              >
                Duplicate and revise
              </button>
            </form>
          </p>
        </Panel>
      )}
      <ProposalEditor p={p} vatPct={profile.vat.registered ? profile.vat.ratePct : 0} />
    </div>
  );
}
