"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { T } from "@/lib/tokens";

type LineItem = { label: string; qty: number; unit_price: number };
type Client = { id: string; name: string; business_name: string | null; email: string | null };
type Proposal = {
  id: string; created_at: string; client_id: string | null; title: string; summary: string | null;
  line_items: LineItem[]; currency: string; total: number; status: string; sent_to: string | null;
};

const money = (n: number, c = "AUD") => new Intl.NumberFormat("en-AU", { style: "currency", currency: c }).format(n);

export default function ProposalsPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<Proposal[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // composer state
  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [items, setItems] = useState<LineItem[]>([{ label: "", qty: 1, unit_price: 0 }]);

  const total = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unit_price) || 0), 0);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: p }, { data: c }] = await Promise.all([
      supabase.from("proposals").select("*").order("created_at", { ascending: false }),
      supabase.from("clients").select("id,name,business_name,email").order("created_at", { ascending: false }),
    ]);
    setRows((p as Proposal[]) ?? []);
    setClients((c as Client[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  async function createProposal(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const client = clients.find(c => c.id === clientId);
    await supabase.from("proposals").insert({
      client_id: clientId || null, title, summary,
      line_items: items.filter(i => i.label.trim()), total, currency: "AUD",
      status: "draft", sent_to: client?.email ?? null,
    });
    setTitle(""); setSummary(""); setItems([{ label: "", qty: 1, unit_price: 0 }]); setClientId(""); setCreating(false);
    load();
  }

  async function markSent(p: Proposal) {
    await supabase.from("proposals").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", p.id);
    load();
  }
  async function setStatus(p: Proposal, status: string) {
    await supabase.from("proposals").update({ status }).eq("id", p.id);
    load();
  }

  const input: React.CSSProperties = { background: T.bg, border: `1px solid ${T.border}`, padding: "10px 12px", color: T.fg, fontFamily: T.sans, fontSize: "0.9rem", outline: "none", borderRadius: "3px", width: "100%" };

  return (
    <div>
      <div className="flex items-end justify-between mb-8">
        <div>
          <div style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: T.primary, marginBottom: "8px" }}>// QUOTES</div>
          <h1 style={{ fontFamily: T.display, fontWeight: 900, fontSize: "2.4rem", color: T.fg }}>PROPOSALS</h1>
        </div>
        <button onClick={() => setCreating(v => !v)} className="px-5 h-11 transition-opacity hover:opacity-90"
          style={{ fontFamily: T.mono, fontSize: "0.75rem", letterSpacing: "0.06em", textTransform: "uppercase", background: creating ? "transparent" : T.primary, color: creating ? T.fg : T.primaryFg, border: creating ? `1px solid ${T.border}` : "none", borderRadius: "3px" }}>
          {creating ? "Cancel" : "+ New proposal"}
        </button>
      </div>

      {creating && (
        <form onSubmit={createProposal} className="p-6 rounded-lg mb-8 flex flex-col gap-3" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
          <div className="grid md:grid-cols-2 gap-3">
            <select value={clientId} onChange={e => setClientId(e.target.value)} style={{ ...input, appearance: "none" }}>
              <option value="">— No client —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}{c.business_name ? ` (${c.business_name})` : ""}</option>)}
            </select>
            <input placeholder="Proposal title *" required value={title} onChange={e => setTitle(e.target.value)} style={input} />
          </div>
          <textarea placeholder="Summary / scope" rows={2} value={summary} onChange={e => setSummary(e.target.value)} style={{ ...input, resize: "vertical" }} />

          <div className="flex flex-col gap-2 mt-1">
            <span style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: T.muted }}>Line items</span>
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-[1fr_80px_120px_100px_auto] gap-2 items-center">
                <input placeholder="Description" style={input} value={it.label} onChange={e => { const a = [...items]; a[i] = { ...it, label: e.target.value }; setItems(a); }} />
                <input type="number" min={0} placeholder="Qty" style={input} value={it.qty} onChange={e => { const a = [...items]; a[i] = { ...it, qty: +e.target.value }; setItems(a); }} />
                <input type="number" min={0} placeholder="Unit $" style={input} value={it.unit_price} onChange={e => { const a = [...items]; a[i] = { ...it, unit_price: +e.target.value }; setItems(a); }} />
                <span className="text-right" style={{ fontFamily: T.mono, fontSize: "0.8rem", color: T.muted }}>{money((it.qty || 0) * (it.unit_price || 0))}</span>
                <button type="button" onClick={() => setItems(items.filter((_, j) => j !== i))} style={{ color: "#f87171", fontFamily: T.mono, fontSize: 16 }}>×</button>
              </div>
            ))}
            <button type="button" onClick={() => setItems([...items, { label: "", qty: 1, unit_price: 0 }])} style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: T.primary, alignSelf: "flex-start" }}>+ Add line</button>
          </div>

          <div className="flex items-center justify-between mt-2 pt-3" style={{ borderTop: `1px solid ${T.border}` }}>
            <span style={{ fontFamily: T.display, fontWeight: 900, fontSize: "1.4rem", color: T.fg }}>TOTAL: <span style={{ color: T.primary }}>{money(total)}</span></span>
            <button type="submit" className="px-6 h-11 transition-opacity hover:opacity-90"
              style={{ fontFamily: T.mono, fontSize: "0.75rem", letterSpacing: "0.06em", textTransform: "uppercase", background: T.primary, color: T.primaryFg, borderRadius: "3px" }}>
              Save proposal
            </button>
          </div>
        </form>
      )}

      {loading ? <p style={{ fontFamily: T.mono, fontSize: 12, color: T.muted }}>Loading…</p>
        : rows.length === 0 ? <p style={{ fontFamily: T.mono, fontSize: 12, color: T.muted }}>No proposals yet.</p>
        : (
          <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${T.border}` }}>
            {rows.map((p, i) => (
              <div key={p.id} className="px-5 py-4 grid grid-cols-[1fr_140px_120px_auto] gap-4 items-center" style={{ borderTop: i ? `1px solid ${T.border}` : "none", background: T.surface }}>
                <div>
                  <div style={{ fontFamily: T.display, fontWeight: 900, fontSize: "1rem", color: T.fg }}>{p.title}</div>
                  {p.sent_to && <div style={{ fontFamily: T.sans, fontSize: "0.8rem", color: T.muted }}>{p.sent_to}</div>}
                </div>
                <span style={{ fontFamily: T.mono, fontSize: "0.95rem", color: T.primary }}>{money(p.total, p.currency)}</span>
                <span style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase", color: T.muted }}>● {p.status}</span>
                <div className="flex gap-2 justify-end">
                  {p.status === "draft" && <button onClick={() => markSent(p)} style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: T.primaryFg, background: T.primary, padding: "6px 12px", borderRadius: 2 }}>Mark sent</button>}
                  {p.status === "sent" && <>
                    <button onClick={() => setStatus(p, "accepted")} style={{ fontFamily: T.mono, fontSize: 10, textTransform: "uppercase", color: "#10b981", border: `1px solid ${T.border}`, padding: "6px 10px", borderRadius: 2 }}>Won</button>
                    <button onClick={() => setStatus(p, "declined")} style={{ fontFamily: T.mono, fontSize: 10, textTransform: "uppercase", color: "#f87171", border: `1px solid ${T.border}`, padding: "6px 10px", borderRadius: 2 }}>Lost</button>
                  </>}
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}
