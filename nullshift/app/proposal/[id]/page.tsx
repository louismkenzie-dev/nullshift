import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { T } from "@/lib/tokens";
import { money, proposalRef } from "@/lib/format";
import { AcceptForm } from "./AcceptForm";

type LineItem = { label: string; qty: number; unit_price: number };
type Phase = { phase: string; items: string[] };
type Week = { week: string; title: string; description: string };

export const dynamic = "force-dynamic";

export default async function ProposalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServiceClient();
  const { data: p } = await supabase.from("proposals").select("*, clients(name, business_name)").eq("id", id).maybeSingle();
  if (!p) notFound();

  const clientName = p.clients?.business_name || p.clients?.name || "Client";
  const scope: Phase[] = (p.scope ?? []).filter((s: Phase) => s.phase || s.items?.some(Boolean));
  const deliverables: string[] = (p.deliverables ?? []).filter(Boolean);
  const timeline: Week[] = (p.timeline ?? []).filter((w: Week) => w.week || w.title || w.description);
  const items: LineItem[] = (p.line_items ?? []).filter((l: LineItem) => l.label);
  const accepted = !!p.accepted_at;

  const wrap: React.CSSProperties = { minHeight: "100vh", background: T.bg, padding: "48px 24px" };
  const sectionTitle: React.CSSProperties = { fontFamily: T.display, fontWeight: 800, fontSize: "1.5rem", letterSpacing: "0.02em", textTransform: "uppercase", color: T.fg };
  const card: React.CSSProperties = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 28 };
  const mono: React.CSSProperties = { fontFamily: T.mono };

  const SectionHead = ({ n, label }: { n: string; label: string }) => (
    <div className="flex items-center gap-3 mb-4">
      <div style={{ width: 32, height: 32, background: T.surface2, borderRadius: 6, display: "grid", placeItems: "center", color: T.primary, fontFamily: T.mono, fontSize: 12 }}>{n}</div>
      <h3 style={sectionTitle}>{n} — {label}</h3>
    </div>
  );

  return (
    <div style={wrap}>
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        {/* Header */}
        <header style={{ borderBottom: `1px solid ${T.borderStr}`, paddingBottom: 32, marginBottom: 48 }}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div style={{ width: 12, height: 12, background: T.primary, borderRadius: "50%" }} />
              <h1 style={{ fontFamily: T.display, fontWeight: 900, fontSize: "2.5rem", letterSpacing: "-0.01em", textTransform: "uppercase", color: T.fg }}>NULLSHIFT</h1>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ ...mono, fontSize: "0.72rem", letterSpacing: "0.15em", textTransform: "uppercase", color: T.muted }}>Proposal</p>
              <p style={{ ...mono, color: T.fg }}>{proposalRef(id)}</p>
            </div>
          </div>
          <div className="flex justify-between items-end gap-6 flex-wrap">
            <div>
              <p style={{ ...mono, fontSize: "0.8rem", letterSpacing: "0.08em", textTransform: "uppercase", color: T.muted, marginBottom: 6 }}>Web Design &amp; Development</p>
              <h2 style={{ fontFamily: T.display, fontWeight: 800, fontSize: "1.9rem", textTransform: "uppercase", color: T.fg }}>{p.project_name || p.title || "Project Proposal"}</h2>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontFamily: T.sans, fontSize: "0.85rem", color: T.muted }}>Prepared for</p>
              <p style={{ fontFamily: T.sans, color: T.fg }}>{clientName}</p>
              <p style={{ fontFamily: T.sans, fontSize: "0.85rem", color: T.muted, marginTop: 2 }}>{new Date(p.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
            </div>
          </div>
        </header>

        {/* 01 Overview */}
        <section style={{ marginBottom: 48 }}>
          <SectionHead n="01" label="Project Overview" />
          <div style={card}>
            {p.overview && <p style={{ fontFamily: T.sans, lineHeight: 1.7, color: T.fg, marginBottom: 24 }}>{p.overview}</p>}
            <div className="grid sm:grid-cols-3 gap-4">
              {[["Duration", p.duration], ["Team Size", p.team_size], ["Platform", p.platform]].map(([k, v]) => (
                <div key={k} style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: 16 }}>
                  <p style={{ ...mono, fontSize: "0.72rem", letterSpacing: "0.1em", textTransform: "uppercase", color: T.muted, marginBottom: 4 }}>{k}</p>
                  <p style={{ fontFamily: T.sans, color: T.fg }}>{v || "—"}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 02 Scope */}
        {scope.length > 0 && (
          <section style={{ marginBottom: 48 }}>
            <SectionHead n="02" label="Scope of Work" />
            <div className="flex flex-col gap-3">
              {scope.map((ph, i) => (
                <div key={i} style={card}>
                  <h4 style={{ ...mono, fontSize: "0.85rem", letterSpacing: "0.06em", textTransform: "uppercase", color: T.primary, marginBottom: 12 }}>Phase {i + 1}: {ph.phase}</h4>
                  <ul className="flex flex-col gap-2" style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {ph.items.filter(Boolean).map((it, j) => (
                      <li key={j} className="flex items-start gap-3">
                        <span style={{ color: T.primary, marginTop: 2 }}>✓</span>
                        <span style={{ fontFamily: T.sans, color: T.fg }}>{it}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 03 Deliverables */}
        {deliverables.length > 0 && (
          <section style={{ marginBottom: 48 }}>
            <SectionHead n="03" label="Deliverables" />
            <div style={card}>
              <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4">
                {deliverables.map((d, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.primary, marginTop: 8, flexShrink: 0 }} />
                    <span style={{ fontFamily: T.sans, color: T.fg }}>{d}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* 04 Timeline */}
        {timeline.length > 0 && (
          <section style={{ marginBottom: 48 }}>
            <SectionHead n="04" label="Timeline" />
            <div style={card}>
              <div className="flex flex-col">
                {timeline.map((w, i) => (
                  <div key={i} className="flex items-start gap-4" style={{ paddingBottom: 16, marginBottom: 16, borderBottom: i < timeline.length - 1 ? `1px solid ${T.border}` : "none" }}>
                    <div style={{ width: 80, flexShrink: 0 }}>
                      <span style={{ ...mono, fontSize: "0.72rem", letterSpacing: "0.08em", textTransform: "uppercase", color: T.primary }}>{w.week}</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      {w.title && <p style={{ fontFamily: T.sans, color: T.fg }}>{w.title}</p>}
                      {w.description && <p style={{ fontFamily: T.sans, fontSize: "0.85rem", color: T.muted, marginTop: 2 }}>{w.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* 05 Investment */}
        <section style={{ marginBottom: 48 }}>
          <SectionHead n="05" label="Investment" />
          <div style={card}>
            <div className="flex flex-col">
              {items.map((li, i) => (
                <div key={i} className="flex items-center justify-between" style={{ padding: "12px 0", borderBottom: `1px solid ${T.border}` }}>
                  <span style={{ fontFamily: T.sans, color: T.fg }}>{li.label}</span>
                  <span style={{ ...mono, color: T.fg }}>{money((li.qty || 0) * (li.unit_price || 0), p.currency || "GBP")}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between" style={{ paddingTop: 24, marginTop: 8, borderTop: `2px solid ${T.primary}` }}>
              <span style={{ fontFamily: T.display, fontWeight: 800, fontSize: "1.25rem", textTransform: "uppercase", color: T.fg }}>Total Investment</span>
              <span style={{ fontFamily: T.display, fontWeight: 900, fontSize: "2rem", color: T.primary }}>{money(p.total || 0, p.currency || "GBP")}</span>
            </div>
          </div>
        </section>

        {/* Acceptance */}
        <section style={{ marginBottom: 48 }}>
          <div style={{ background: `linear-gradient(135deg, ${T.surface}, ${T.surface2})`, border: `2px solid ${T.primary}`, borderRadius: 12, padding: 36 }}>
            <h3 style={{ fontFamily: T.display, fontWeight: 900, fontSize: "1.75rem", textTransform: "uppercase", color: T.primary, textAlign: "center", marginBottom: 16 }}>
              {accepted ? "Proposal Accepted" : "Ready to build?"}
            </h3>
            {accepted ? (
              <p style={{ textAlign: "center", fontFamily: T.sans, color: T.fg, maxWidth: 560, margin: "0 auto" }}>
                Accepted by <strong>{p.accepted_name}</strong> on {new Date(p.accepted_at).toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "long", timeStyle: "short" })}. We&apos;ll be in touch to schedule your kickoff.
              </p>
            ) : (
              <>
                <p style={{ textAlign: "center", fontFamily: T.sans, color: T.fg, maxWidth: 560, margin: "0 auto 28px" }}>
                  Sign below to accept this proposal and begin your project. We&apos;ll schedule a kickoff call within 48 hours.
                </p>
                <AcceptForm proposalId={id} />
              </>
            )}
          </div>
        </section>

        {/* Footer */}
        <footer style={{ borderTop: `1px solid ${T.border}`, paddingTop: 32, textAlign: "center" }}>
          <div className="flex items-center justify-center gap-3 mb-3">
            <div style={{ width: 8, height: 8, background: T.primary, borderRadius: "50%" }} />
            <span style={{ ...mono, fontSize: "0.8rem", letterSpacing: "0.12em", textTransform: "uppercase", color: T.muted }}>Nullshift — Web Design &amp; Development</span>
          </div>
          <p style={{ fontFamily: T.sans, fontSize: "0.8rem", color: T.muted }}>This proposal is valid for 30 days from the date above.</p>
        </footer>
      </div>
    </div>
  );
}
