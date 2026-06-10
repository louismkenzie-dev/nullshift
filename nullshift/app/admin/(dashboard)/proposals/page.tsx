"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { T } from "@/lib/tokens";
import { money, proposalRef } from "@/lib/format";

type Phase = { phase: string; items: string[] };
type Week = { week: string; title: string; description: string };
type Proposal = {
  id: string; created_at: string; client_id: string | null; title: string;
  total: number; currency: string; status: string; accepted_at: string | null;
  project_name: string | null; duration: string | null; platform: string | null; team_size: string | null;
  overview: string | null; scope: Phase[]; deliverables: string[]; timeline: Week[];
};
type Client = { id: string; name: string; business_name: string | null };

const DEFAULT_PHASES: Phase[] = [
  { phase: "Discovery & Strategy", items: [""] },
  { phase: "Design & Prototyping", items: [""] },
  { phase: "Development", items: [""] },
  { phase: "Testing & Launch", items: [""] },
];

const statusColor: Record<string, string> = {
  draft: T.muted, sent: "#06b6d4", accepted: T.primary, declined: T.danger,
};

export default function ProposalsPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<Proposal[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [docs, setDocs] = useState<Record<string, Proposal>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: p }, { data: c }] = await Promise.all([
      supabase.from("proposals").select("id,created_at,client_id,title,total,currency,status,accepted_at,project_name,duration,platform,team_size,overview,scope,deliverables,timeline").order("created_at", { ascending: false }),
      supabase.from("clients").select("id,name,business_name"),
    ]);
    const proposals = (p as Proposal[]) ?? [];
    setRows(proposals);
    setClients((c as Client[]) ?? []);
    // Seed the editable doc state with defaults for any missing fields
    const initial: Record<string, Proposal> = {};
    for (const pr of proposals) {
      initial[pr.id] = {
        ...pr,
        scope: pr.scope?.length ? pr.scope.map(s => ({ phase: s.phase, items: s.items?.length ? s.items : [""] })) : DEFAULT_PHASES,
        deliverables: pr.deliverables?.length ? pr.deliverables : [""],
        timeline: pr.timeline?.length ? pr.timeline : [{ week: "Week 1", title: "", description: "" }],
      };
    }
    setDocs(initial);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  function setDoc<K extends keyof Proposal>(id: string, key: K, value: Proposal[K]) {
    setDocs(d => ({ ...d, [id]: { ...d[id], [key]: value } }));
  }

  async function saveDoc(id: string) {
    const doc = docs[id];
    if (!doc) return;
    setSaving(id);
    await supabase.from("proposals").update({
      project_name: doc.project_name, duration: doc.duration,
      platform: doc.platform, team_size: doc.team_size,
      overview: doc.overview, scope: doc.scope,
      deliverables: doc.deliverables, timeline: doc.timeline,
    }).eq("id", id);
    setSaving(null);
    setSaved(id);
    setTimeout(() => setSaved(s => s === id ? null : s), 2000);
  }

  const clientName = (id: string | null) => {
    const c = clients.find(c => c.id === id);
    return c ? (c.business_name || c.name) : null;
  };

  const input: React.CSSProperties = { background: T.bg, border: `1px solid ${T.border}`, padding: "10px 12px", color: T.fg, fontFamily: T.sans, fontSize: "0.9rem", outline: "none", borderRadius: T.r.sm, width: "100%" };
  const labelS: React.CSSProperties = { fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: T.muted, marginBottom: "6px", display: "block" };

  return (
    <div>
      <div className="flex items-end justify-between mb-8">
        <div>
          <div style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: T.primary, marginBottom: "8px" }}>// DOCUMENTS</div>
          <h1 style={{ fontFamily: T.display, fontWeight: 600, fontSize: "2.4rem", color: T.fg }}>PROPOSALS</h1>
        </div>
        <div style={{ fontFamily: T.mono, fontSize: "11px", color: T.muted }}>
          {rows.length} proposal{rows.length !== 1 ? "s" : ""}
        </div>
      </div>

      {loading ? (
        <p style={{ fontFamily: T.mono, fontSize: 12, color: T.muted }}>Loading…</p>
      ) : rows.length === 0 ? (
        <div className="p-8 rounded-lg text-center" style={{ background: T.surface, border: `1px dashed ${T.border}` }}>
          <p style={{ fontFamily: T.sans, fontSize: "0.9rem", color: T.muted, marginBottom: 12 }}>No quotes exist yet — create one first.</p>
          <Link href="/admin/quotes" style={{ fontFamily: T.mono, fontSize: "0.75rem", letterSpacing: "0.06em", textTransform: "uppercase", color: T.primary }}>Go to Quotes →</Link>
        </div>
      ) : (
        <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${T.border}` }}>
          {rows.map((p, i) => {
            const doc = docs[p.id];
            const accepted = p.status === "accepted";
            const isOpen = openId === p.id;
            const docComplete = !!(doc?.project_name && doc?.overview && doc?.scope?.some(s => s.items.some(it => it.trim())));

            return (
              <div key={p.id} style={{ borderTop: i ? `1px solid ${T.border}` : "none", background: T.surface }}>
                {/* Row header */}
                <button
                  onClick={() => setOpenId(isOpen ? null : p.id)}
                  className="w-full text-left px-5 py-4 grid grid-cols-[1fr_120px_120px_120px_auto] gap-4 items-center hover:bg-[#1f1f23] transition-colors">
                  <div className="min-w-0">
                    <div style={{ fontFamily: T.display, fontWeight: 600, fontSize: "1rem", color: T.fg }}>{p.title}</div>
                    {clientName(p.client_id) && <div style={{ fontFamily: T.sans, fontSize: "0.8rem", color: T.muted }}>{clientName(p.client_id)}</div>}
                  </div>
                  <span style={{ fontFamily: T.mono, fontSize: "0.9rem", color: T.primary }}>{money(p.total, p.currency)}</span>
                  <span style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase", color: statusColor[p.status] ?? T.muted }}>● {p.status}</span>
                  <span style={{ fontFamily: T.mono, fontSize: "10px", color: docComplete ? T.primary : T.accent }}>
                    {docComplete ? "✓ doc filled" : "○ doc empty"}
                  </span>
                  <span style={{ fontFamily: T.mono, fontSize: "11px", color: T.muted }}>{isOpen ? "▲" : "▼"}</span>
                </button>

                {isOpen && doc && (
                  <div className="px-5 pb-6 pt-2" style={{ background: T.bg, borderTop: `1px solid ${T.border}` }}>
                    {accepted && (
                      <div className="mb-5 px-4 py-3 rounded-lg flex items-center gap-3" style={{ background: `${T.primary}14`, border: `1px solid ${T.primary}30` }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: T.primary, flexShrink: 0 }} />
                        <span style={{ fontFamily: T.mono, fontSize: 11, color: T.primary, letterSpacing: "0.06em" }}>
                          ACCEPTED — proposal is locked. View it via the client page.
                        </span>
                        {p.client_id && (
                          <Link href={`/admin/clients/${p.client_id}`} style={{ fontFamily: T.mono, fontSize: 10, color: T.muted, marginLeft: "auto", letterSpacing: "0.06em" }}>
                            View client →
                          </Link>
                        )}
                      </div>
                    )}

                    {/* Ref + save */}
                    <div className="flex items-center justify-between mb-5">
                      <span style={{ fontFamily: T.mono, fontSize: "11px", color: T.muted, letterSpacing: "0.06em" }}>
                        REF: <span style={{ color: T.fg }}>{proposalRef(p.id)}</span>
                      </span>
                      {!accepted && (
                        <button onClick={() => saveDoc(p.id)} disabled={saving === p.id} className="px-5 h-9 transition-opacity hover:opacity-90 disabled:opacity-50"
                          style={{ fontFamily: T.mono, fontSize: "0.72rem", letterSpacing: "0.06em", textTransform: "uppercase", background: T.primary, color: T.primaryFg, borderRadius: T.r.sm }}>
                          {saving === p.id ? "Saving…" : saved === p.id ? "Saved ✓" : "Save document"}
                        </button>
                      )}
                    </div>

                    {/* Project overview */}
                    <SectionHead>Project overview</SectionHead>
                    <div className="grid gap-3 mb-5">
                      <div><label style={labelS}>Project name</label><input disabled={accepted} style={input} value={doc.project_name ?? ""} onChange={e => setDoc(p.id, "project_name", e.target.value)} placeholder="e.g. Website Build" /></div>
                      <div className="grid sm:grid-cols-3 gap-3">
                        <div><label style={labelS}>Duration</label><input disabled={accepted} style={input} value={doc.duration ?? ""} onChange={e => setDoc(p.id, "duration", e.target.value)} placeholder="e.g. 12 weeks" /></div>
                        <div><label style={labelS}>Platform</label><input disabled={accepted} style={input} value={doc.platform ?? ""} onChange={e => setDoc(p.id, "platform", e.target.value)} placeholder="e.g. Web + Mobile" /></div>
                        <div><label style={labelS}>Team size</label><input disabled={accepted} style={input} value={doc.team_size ?? ""} onChange={e => setDoc(p.id, "team_size", e.target.value)} placeholder="e.g. 4 specialists" /></div>
                      </div>
                      <div><label style={labelS}>Overview</label>
                        <textarea disabled={accepted} rows={3} style={{ ...input, resize: "vertical" }} value={doc.overview ?? ""} onChange={e => setDoc(p.id, "overview", e.target.value)} placeholder="Short summary of the project and approach." />
                      </div>
                    </div>

                    {/* Scope */}
                    <SectionHead>Scope of work</SectionHead>
                    <div className="flex flex-col gap-4 mb-5">
                      {doc.scope.map((ph, pi) => (
                        <div key={pi}>
                          <div className="flex items-center gap-2 mb-2">
                            <span style={{ fontFamily: T.mono, fontSize: 10, color: T.primary }}>Phase {pi + 1}</span>
                            <input disabled={accepted} style={{ ...input, padding: "6px 10px" }} value={ph.phase} onChange={e => { const s = [...doc.scope]; s[pi] = { ...ph, phase: e.target.value }; setDoc(p.id, "scope", s); }} placeholder="Phase name" />
                          </div>
                          <div className="flex flex-col gap-2 pl-3" style={{ borderLeft: `1px solid ${T.border}` }}>
                            {ph.items.map((it, ii) => (
                              <div key={ii} className="flex items-center gap-2">
                                <input disabled={accepted} style={{ ...input, padding: "8px 10px" }} value={it} onChange={e => { const s = [...doc.scope]; const items = [...ph.items]; items[ii] = e.target.value; s[pi] = { ...ph, items }; setDoc(p.id, "scope", s); }} placeholder="Scope item" />
                                {!accepted && <button onClick={() => { const s = [...doc.scope]; s[pi] = { ...ph, items: ph.items.filter((_, j) => j !== ii) }; setDoc(p.id, "scope", s); }} style={{ color: T.danger, fontFamily: T.mono, fontSize: 16 }}>×</button>}
                              </div>
                            ))}
                            {!accepted && <button onClick={() => { const s = [...doc.scope]; s[pi] = { ...ph, items: [...ph.items, ""] }; setDoc(p.id, "scope", s); }} className="self-start" style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: T.primary }}>+ Add item</button>}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Deliverables */}
                    <SectionHead>Deliverables</SectionHead>
                    <div className="flex flex-col gap-2 mb-5">
                      {doc.deliverables.map((d, di) => (
                        <div key={di} className="flex items-center gap-2">
                          <input disabled={accepted} style={input} value={d} onChange={e => { const a = [...doc.deliverables]; a[di] = e.target.value; setDoc(p.id, "deliverables", a); }} placeholder="Deliverable" />
                          {!accepted && <button onClick={() => setDoc(p.id, "deliverables", doc.deliverables.filter((_, j) => j !== di))} style={{ color: T.danger, fontFamily: T.mono, fontSize: 16 }}>×</button>}
                        </div>
                      ))}
                      {!accepted && <button onClick={() => setDoc(p.id, "deliverables", [...doc.deliverables, ""])} className="self-start mt-1" style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: T.primary }}>+ Add deliverable</button>}
                    </div>

                    {/* Timeline */}
                    <SectionHead>Timeline</SectionHead>
                    <div className="flex flex-col gap-3 mb-4">
                      {doc.timeline.map((w, wi) => (
                        <div key={wi} className="grid grid-cols-[110px_1fr_auto] gap-2 items-start">
                          <input disabled={accepted} style={{ ...input, padding: "8px 10px" }} value={w.week} onChange={e => { const a = [...doc.timeline]; a[wi] = { ...w, week: e.target.value }; setDoc(p.id, "timeline", a); }} placeholder="Week 1" />
                          <div className="flex flex-col gap-2">
                            <input disabled={accepted} style={{ ...input, padding: "8px 10px" }} value={w.title} onChange={e => { const a = [...doc.timeline]; a[wi] = { ...w, title: e.target.value }; setDoc(p.id, "timeline", a); }} placeholder="Milestone / title" />
                            <textarea disabled={accepted} rows={2} style={{ ...input, padding: "8px 10px", resize: "vertical" }} value={w.description} onChange={e => { const a = [...doc.timeline]; a[wi] = { ...w, description: e.target.value }; setDoc(p.id, "timeline", a); }} placeholder="What will happen" />
                          </div>
                          {!accepted && <button onClick={() => setDoc(p.id, "timeline", doc.timeline.filter((_, j) => j !== wi))} style={{ color: T.danger, fontFamily: T.mono, fontSize: 16 }}>×</button>}
                        </div>
                      ))}
                      {!accepted && <button onClick={() => setDoc(p.id, "timeline", [...doc.timeline, { week: `Week ${doc.timeline.length + 1}`, title: "", description: "" }])} className="self-start" style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: T.primary }}>+ Add week</button>}
                    </div>

                    {!accepted && (
                      <div className="flex justify-end pt-3" style={{ borderTop: `1px solid ${T.border}` }}>
                        <button onClick={() => saveDoc(p.id)} disabled={saving === p.id} className="px-6 h-10 transition-opacity hover:opacity-90 disabled:opacity-50"
                          style={{ fontFamily: T.mono, fontSize: "0.75rem", letterSpacing: "0.06em", textTransform: "uppercase", background: T.primary, color: T.primaryFg, borderRadius: T.r.sm }}>
                          {saving === p.id ? "Saving…" : saved === p.id ? "Saved ✓" : "Save document"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SectionHead({ children }: { children: React.ReactNode }) {
  return <div className="mb-3" style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.18em", textTransform: "uppercase", color: T.primary }}>// {children}</div>;
}
