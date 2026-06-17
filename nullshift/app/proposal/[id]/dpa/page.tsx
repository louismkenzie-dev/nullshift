import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { T } from "@/lib/tokens";
import { proposalRef } from "@/lib/format";
import { Logo } from "@/components/Logo";
import { DpaTemplate } from "@/components/legal/DpaTemplate";

export const dynamic = "force-dynamic";

const fmt = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

export default async function ProposalDpaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServiceClient();
  const { data: p } = await supabase
    .from("proposals")
    .select("*, clients(name, business_name)")
    .eq("id", id)
    .maybeSingle();
  if (!p) notFound();
  // The DPA only exists where it's attached to the proposal.
  if (p.dpa_enabled === false) notFound();

  const clientName = p.clients?.business_name || p.clients?.name || "Client";
  const accepted = p.accepted_at
    ? { name: p.accepted_name as string, at: fmt(p.accepted_at) }
    : null;

  return (
    <div style={{ minHeight: "100vh", background: T.bg, padding: "48px 24px" }}>
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        {/* Header */}
        <header style={{ borderBottom: `1px solid ${T.borderStr}`, paddingBottom: 28, marginBottom: 32 }}>
          <div className="flex items-center justify-between mb-6">
            <Logo markSize={32} />
            <div style={{ textAlign: "right" }}>
              <p style={{ fontFamily: T.mono, fontSize: "0.72rem", letterSpacing: "0.15em", textTransform: "uppercase", color: T.muted }}>Data Processing Agreement</p>
              <p style={{ fontFamily: T.mono, color: T.fg }}>{proposalRef(id)}</p>
            </div>
          </div>
          <h1 style={{ fontFamily: T.display, fontWeight: 600, fontSize: "1.9rem", letterSpacing: "-0.02em", color: T.fg }}>
            Data Processing Agreement
          </h1>
          <p className="mt-2" style={{ fontFamily: T.sans, fontSize: "0.9rem", color: T.muted }}>
            Between {clientName} (Controller) and Nullshift (Processor).
          </p>
        </header>

        {/* Status / hand-off banner */}
        <div
          className="mb-10 flex items-start gap-3 px-5 py-4"
          style={{ border: `1px solid ${accepted ? T.primary : T.borderStr}`, background: accepted ? `${T.primary}14` : T.surface, borderRadius: T.r.md }}
        >
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: accepted ? T.primary : T.muted, flexShrink: 0, marginTop: 6 }} />
          {accepted ? (
            <p style={{ fontFamily: T.sans, fontSize: "0.9rem", lineHeight: 1.6, color: T.fg }}>
              Accepted as part of proposal <strong>{proposalRef(id)}</strong> by <strong>{accepted.name}</strong> on {accepted.at}. This agreement is in force for the duration of the Services.
            </p>
          ) : (
            <p style={{ fontFamily: T.sans, fontSize: "0.9rem", lineHeight: 1.6, color: T.fg }}>
              This agreement is part of your proposal — you don&apos;t sign it separately. Review it here, then{" "}
              <Link href={`/proposal/${id}`} style={{ color: T.primary, textDecoration: "none" }}>return to the proposal</Link>{" "}
              to accept; your signature there covers this agreement too.
            </p>
          )}
        </div>

        {/* The agreement */}
        <DpaTemplate
          mode="proposal"
          client={{
            name: clientName,
            country: p.dpa_client_country ?? null,
            companyNumber: p.dpa_client_company_number ?? null,
            registeredAddress: p.dpa_client_registered_address ?? null,
          }}
          effectiveDate={accepted ? accepted.at : null}
          personalDataTypes={p.dpa_personal_data ?? null}
          specialCategory={{ present: !!p.dpa_special_category, detail: p.dpa_special_category_detail ?? null }}
          accepted={accepted}
        />

        {/* Footer */}
        <footer style={{ borderTop: `1px solid ${T.border}`, marginTop: 48, paddingTop: 28, textAlign: "center" }}>
          <Link href={`/proposal/${id}`} style={{ fontFamily: T.mono, fontSize: "0.78rem", letterSpacing: "0.08em", textTransform: "uppercase", color: T.primary, textDecoration: "none" }}>
            ← Back to proposal
          </Link>
        </footer>
      </div>
    </div>
  );
}
