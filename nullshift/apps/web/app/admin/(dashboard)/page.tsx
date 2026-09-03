import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@nullshift/auth/guards";
import { T } from "@nullshift/ui/tokens";
import { PageHeader } from "@/components/app/AppKit";
import { loadClientBlocks } from "@/lib/hub/load";
import { TILE_ORDER, TILE_TITLE, tileStates, type Block } from "@/lib/hub/rules";
import { ClientGrid, type GridBlock, type GridLead } from "./ClientGrid";

/**
 * Dashboard — the client grid. One block per client (tenant), coloured by the
 * signature state (blockColour), with seven dots for the seven tiles. Leads
 * with no client yet sit in an "Enquiries" row above; the internal tenant sits
 * in a "Platform" row below. One loadClientBlocks() call, no per-client I/O;
 * the search box and count strip are client-side over the folded rows.
 */
export const dynamic = "force-dynamic";

const STAGE_LABEL: Record<string, string> = {
  discovery: "Discovery",
  onboarding: "Onboarding",
  build: "Build",
  review: "Review",
  launch_prep: "Launch prep",
  live: "Live",
  care: "In care",
  complete: "Complete",
};

const mono: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: 11,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  textDecoration: "none",
};

const gbp = (n: number) => "£" + Math.round(n).toLocaleString("en-GB");

/** Fold a Block into the serialisable shape the client grid renders. */
function toGridBlock(block: Block): GridBlock {
  const tiles = tileStates(block);
  const p = block.project;
  const systems = block.projects.length;
  const summary = [
    p ? (STAGE_LABEL[p.stage ?? ""] ?? p.stage ?? "No stage") : "No system yet",
    systems > 0 ? `${systems} system${systems === 1 ? "" : "s"}` : null,
    block.subscription &&
    (block.subscription.status === "active" || block.subscription.status === "trialing")
      ? `${block.subscription.planLabel ?? "Plan"} ${gbp(block.subscription.mrr)}/mo`
      : block.tenant.type === "internal"
        ? null
        : "No care plan",
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    id: block.tenant.id,
    name: block.tenant.name,
    search: [block.tenant.name, block.tenant.contactName, block.tenant.contactEmail]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
    vertical: block.tenant.vertical,
    contact: block.tenant.contactName ?? block.tenant.contactEmail,
    colour: block.colour,
    summary,
    awaitingSignature: block.awaitingSignature,
    dots: TILE_ORDER.map((key) => ({
      key,
      title: TILE_TITLE[key],
      tone: tiles[key].tone,
      label: tiles[key].label,
    })),
  };
}

export default async function DashboardGridPage() {
  if (!(await requireStaff()).ok) notFound();
  const { clients, enquiries, platform } = await loadClientBlocks();

  const clientBlocks = clients.map(toGridBlock);
  const platformBlocks = platform.map(toGridBlock);
  const leads: GridLead[] = enquiries.map((l) => ({
    id: l.id,
    name: l.businessName || l.name || l.email || "Unnamed enquiry",
    sub: [l.name && l.businessName ? l.name : null, l.email, l.vertical]
      .filter(Boolean)
      .join(" · "),
    search: [l.name, l.businessName, l.email].filter(Boolean).join(" ").toLowerCase(),
    status: l.status,
    leadScore: l.leadScore,
    requestedDate: l.requestedDate,
    canOpen: !!l.email,
  }));

  return (
    <div>
      <PageHeader
        index="01"
        label="Dashboard"
        title="Clients & systems"
        lead="One block per client. Green = signed, orange = awaiting signature, red = nothing sent yet. Open a block for its seven tiles."
        actions={
          <>
            <Link href="/admin/clients" style={{ ...mono, color: "var(--k-muted)" }}>
              + Add client
            </Link>
            <Link href="/admin/overview" style={{ ...mono, color: "var(--k-accent)" }}>
              Overview →
            </Link>
          </>
        }
      />
      <ClientGrid clients={clientBlocks} enquiries={leads} platform={platformBlocks} />
    </div>
  );
}
