import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/app/admin/(dashboard)/AdminShell";
import { TodayView } from "@/app/admin/(dashboard)/TodayView";
import { ClientWorkspaceView } from "@/app/admin/(dashboard)/clients/[id]/ClientWorkspaceView";
import {
  Badge,
  TilePage,
  btn,
  card,
  h2,
  inp,
  monoLink,
} from "@/app/admin/(dashboard)/clients/[id]/_shared";
import { Panel, StatCard, StatusChip } from "@/components/app/AppKit";
import { CLIENT, CLIENTS, TODAY } from "../fixtures";

/**
 * Design preview of the admin shell with fixtures — so the chrome and the
 * two main pages can be looked at in a real browser without a Supabase
 * session. Only exists when ADMIN_PREVIEW=1 (a local design check); in
 * every other environment it is a 404.
 */
export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

const VIEWS = ["today", "client", "kit"] as const;

export default async function AdminPreview({ params }: { params: Promise<{ view: string }> }) {
  if (process.env.ADMIN_PREVIEW !== "1") notFound();
  const { view } = await params;
  if (!(VIEWS as readonly string[]).includes(view)) notFound();

  return (
    <AdminShell email="louis@nullshift.co.uk" clients={CLIENTS}>
      {view === "today" && <TodayView today={TODAY} />}
      {view === "client" && <ClientWorkspaceView id={CLIENT.id} c={CLIENT} />}
      {view === "kit" && <KitSample />}
    </AdminShell>
  );
}

/** The tile-page primitives (Docs, E-signatures, Care plan…) in one place. */
function KitSample() {
  return (
    <TilePage
      tenantId={CLIENT.id}
      tenantName={CLIENT.legalName}
      index="08"
      label="E-signatures"
      title={CLIENT.legalName}
      lead="Documents sent for formal signature — frozen and hashed when issued, signed through a single-use link, countersigned by Nullshift."
      actions={
        <>
          <StatusChip tone="accent">1 to countersign</StatusChip>
          <StatusChip tone="warning">2 awaiting signature</StatusChip>
        </>
      }
      maxWidth={960}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" style={{ marginBottom: 16 }}>
        <StatCard value="3" label="Documents" sub="This client" />
        <StatCard value="£986" label="Awaiting signature" accent />
        <StatCard value="12 days" label="Average time to sign" />
      </div>
      <section style={card}>
        <h2 style={{ ...h2, marginBottom: 0 }}>Documents</h2>
        <div className="flex flex-col" style={{ marginTop: 10 }}>
          {[
            ["SR-2026-0003", "Rising Stars Talent ID — proposal follow-up", "issued"],
            ["SR-2026-0002", "Holiday camp add-on", "signed"],
            ["SR-2026-0001", "Parent hub — change order", "completed"],
          ].map(([ref, title, status]) => (
            <Link
              key={ref}
              href="#"
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1"
              style={{ padding: "10px 0", borderTop: "1px solid var(--k-border)", textDecoration: "none" }}
            >
              <span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--k-accent)" }}>{ref}</span>
                <span style={{ fontSize: "0.92rem", color: "var(--k-fg)", marginLeft: 10 }}>{title}</span>
              </span>
              <Badge s={status} />
            </Link>
          ))}
        </div>
      </section>
      <Panel label="// New document" title="Send a document for signature">
        <form className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <input style={{ ...inp, width: "100%" }} defaultValue="Olivia Sutton" aria-label="Signer name" />
            <input style={{ ...inp, width: "100%" }} defaultValue="olivia@exampletennis.test" aria-label="Signer email" />
            <select style={{ ...inp, width: "100%" }} aria-label="Template" defaultValue="rising">
              <option value="rising">Rising Stars Talent ID — follow-up</option>
              <option value="blank">Blank document</option>
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" style={btn("var(--k-accent)", "var(--k-on-accent)")}>
              Create draft →
            </button>
            <button type="button" style={btn("transparent", "var(--k-fg)")}>
              Cancel
            </button>
            <Link href="#" style={monoLink}>
              Agreement page →
            </Link>
          </div>
        </form>
      </Panel>
    </TilePage>
  );
}
