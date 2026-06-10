"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { T } from "@/lib/tokens";
import { money, WEBSITE_BUILD_ITEMS } from "@/lib/format";

type LineItem = { label: string; qty: number; unit_price: number };
type Client = { id: string; name: string; business_name: string | null; email: string | null };
type Quote = {
  id: string; created_at: string; client_id: string | null; title: string; summary: string | null;
  line_items: LineItem[]; currency: string; total: number; status: string; sent_to: string | null;
};

const isDiscount = (it: LineItem) => Number(it.unit_price) < 0;

function calcTotals(items: LineItem[]) {
  const subtotal = items.filter(it => !isDiscount(it)).reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unit_price) || 0), 0);
  const discountItem = items.find(isDiscount);
  const discountPct = discountItem ? Math.abs(Number(discountItem.unit_price)) : 0;
  const discountAmount = subtotal * (discountPct / 100);
  return { subtotal, discountItem, discountPct, discountAmount, total: subtotal - discountAmount, hasDiscount: !!discountItem };
}

const statusColor: Record<string, string> = { draft: T.muted, sent: "#06b6d4", accepted: T.primary, declined: T.danger };

export default function QuotesPage() {
  return (
    <Suspense fallback={<p style={{ fontFamily: T.mono, fontSize: 12, color: T.muted }}>Loading…</p>}>
      <QuotesInner />
    </Suspense>
  );
}

function QuotesInner() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<Quote[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // New quote composer
  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [items, setItems] = useState<LineItem[]>([{ label: "", qty: 1, unit_price: 0 }]);

  // Inline edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [editItems, setEditItems] = useState<LineItem[]>([]);
  const [editSaving, setEditSaving] = useState(false);

  const newTotals = calcTotals(items);
  const editTotals = calcTotals(editItems);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: p }, { data: c }] = await Promise.all([
      supabase.from("proposals").select("id,created_at,client_id,title,summary,line_items,currency,total,status,sent_to").order("created_at", { ascending: false }),
      supabase.from("clients").select("id,name,business_name,email").order("created_at", { ascending: false }),
    ]);
    setRows((p as Quote[]) ?? []);
    setClients((c as Client[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current || loading) return;
    const clientParam = searchParams.get("client");
    if (!clientParam) return;
    const client = clients.find(c => c.id === clientParam);
    if (!client) return;
    prefilled.current = true;
    setCreating(true);
    setClientId(client.id);
    const who = client.business_name || client.name;
    setTitle(`Website Build — ${who}`);
    setSummary(`Quote for ${who}. Standard website build with the scope below.`);
    if (searchParams.get("template") === "website") setItems(WEBSITE_BUILD_ITEMS.map(i => ({ ...i })));
  }, [loading, clients, searchParams]);

  async function createQuote(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const client = clients.find(c => c.id === clientId);
    await supabase.from("proposals").insert({
      client_id: clientId || null, title, summary,
      line_items: items.filter(i => i.label.trim()), total: newTotals.total, currency: "GBP",
      status: "draft", sent_to: client?.email ?? null,
    });
    setTitle(""); setSummary(""); setItems([{ label: "", qty: 1, unit_price: 0 }]); setClientId(""); setCreating(false);
    load();
  }

  function openEdit(q: Quote) {
    setEditId(q.id);
    setEditTitle(q.title);
    setEditSummary(q.summary ?? "");
    setEditItems(q.line_items?.length ? q.line_items : [{ label: "", qty: 1, unit_price: 0 }]);
  }

  async function saveEdit(q: Quote) {
    setEditSaving(true);
    await supabase.from("proposals").update({
      title: editTitle, summary: editSummary,
      line_items: editItems.filter(i => i.label.trim()),
      total: editTotals.total,
    }).eq("id", q.id);
    setEditSaving(false);
    setEditId(null);
    load();
  }

  async function markSent(q: Quote) {
    await supabase.from("proposals").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", q.id);
    load();
  }
  async function setStatus(q: Quote, status: string) {
    await supabase.from("proposals").update({ status }).eq("id", q.id);
    load();
  }

  const input: React.CSSProperties = { background: T.bg, border: `1px solid ${T.border}`, padding: "10px 12px", color: T.fg, fontFamily: T.sans, fontSize: "0.9rem", outline: "none", borderRadius: T.r.sm, width: "100%" };
  const clientName = (id: string | null) => { const c = clients.find(c => c.id === id); return c ? (c.business_name || c.name) : null; };

  return (
    <div>
      <div className="flex items-end justify-between mb-8">
        <div>
          <div style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: T.primary, marginBottom: "8px" }}>// FINANCIAL</div>
          <h1 style={{ fontFamily: T.display, fontWeight: 600, fontSize: "2.4rem", color: T.fg }}>QUOTES</h1>
        </div>
        <button onClick={() => setCreating(v => !v)} className="px-5 h-11 transition-opacity hover:opacity-90"
          style={{ fontFamily: T.mono, fontSize: "0.75rem", letterSpacing: "0.06em", textTransform: "uppercase", background: creating ? "transparent" : T.primary, color: creating ? T.fg : T.primaryFg, border: creating ? `1px solid ${T.border}` : "none", borderRadius: T.r.sm }}>
          {creating ? "Cancel" : "+ New quote"}
        </button>
      </div>

      {creating && (
        <form onSubmit={createQuote} className="p-6 rounded-lg mb-8 flex flex-col gap-3" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
          <div className="grid md:grid-cols-2 gap-3">
            <select value={clientId} onChange={e => setClientId(e.target.value)} style={{ ...input, appearance: "none" }}>
              <option value="">— No client —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}{c.business_name ? ` (${c.business_name})` : ""}</option>)}
            </select>
            <input placeholder="Quote title *" required value={title} onChange={e => setTitle(e.target.value)} style={input} />
          </div>
          <LineItemsEditor items={items} setItems={setItems} totals={newTotals} input={input} />
          <div className="mt-2 pt-3 flex flex-col gap-1.5" style={{ borderTop: `1px solid ${T.border}` }}>
            <TotalsDisplay totals={newTotals} />
            <div className="flex justify-end mt-1">
              <button type="submit" className="px-6 h-11 transition-opacity hover:opacity-90"
                style={{ fontFamily: T.mono, fontSize: "0.75rem", letterSpacing: "0.06em", textTransform: "uppercase", background: T.primary, color: T.primaryFg, borderRadius: T.r.sm }}>
                Save quote
              </button>
            </div>
          </div>
        </form>
      )}

      {loading ? <p style={{ fontFamily: T.mono, fontSize: 12, color: T.muted }}>Loading…</p>
        : rows.length === 0 ? <p style={{ fontFamily: T.mono, fontSize: 12, color: T.muted }}>No quotes yet.</p>
        : (
          <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${T.border}` }}>
            {rows.map((q, i) => (
              <div key={q.id} style={{ borderTop: i ? `1px solid ${T.border}` : "none", background: T.surface }}>
                <div className="px-5 py-4 grid grid-cols-[1fr_160px_120px_auto] gap-4 items-center">
                  <button className="text-left min-w-0" onClick={() => setEditId(editId === q.id ? null : q.id)}>
                    <div style={{ fontFamily: T.display, fontWeight: 600, fontSize: "1rem", color: T.fg }}>{q.title}</div>
                    {clientName(q.client_id) && <div style={{ fontFamily: T.sans, fontSize: "0.8rem", color: T.muted }}>{clientName(q.client_id)}</div>}
                  </button>
                  <span style={{ fontFamily: T.mono, fontSize: "0.95rem", color: T.primary }}>{money(q.total, q.currency)}</span>
                  <span style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase", color: statusColor[q.status] ?? T.muted }}>● {q.status}</span>
                  <div className="flex gap-2 justify-end">
                    {q.status === "draft" && <button onClick={() => markSent(q)} style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: T.primaryFg, background: T.primary, padding: "6px 12px", borderRadius: 2 }}>Mark sent</button>}
                    {q.status === "sent" && <>
                      <button onClick={() => setStatus(q, "accepted")} style={{ fontFamily: T.mono, fontSize: 10, textTransform: "uppercase", color: "#10b981", border: `1px solid ${T.border}`, padding: "6px 10px", borderRadius: 2 }}>Won</button>
                      <button onClick={() => setStatus(q, "declined")} style={{ fontFamily: T.mono, fontSize: 10, textTransform: "uppercase", color: T.danger, border: `1px solid ${T.border}`, padding: "6px 10px", borderRadius: 2 }}>Lost</button>
                    </>}
                    <button onClick={() => editId === q.id ? setEditId(null) : openEdit(q)} style={{ fontFamily: T.mono, fontSize: 10, textTransform: "uppercase", color: T.muted, border: `1px solid ${T.border}`, padding: "6px 10px", borderRadius: 2 }}>
                      {editId === q.id ? "Close" : "Edit"}
                    </button>
                  </div>
                </div>

                {editId === q.id && (
                  <div className="px-5 pb-5" style={{ borderTop: `1px solid ${T.border}`, background: T.bg }}>
                    <div className="flex flex-col gap-3 pt-4">
                      <input value={editTitle} onChange={e => setEditTitle(e.target.value)} style={input} placeholder="Title" />
                      <LineItemsEditor items={editItems} setItems={setEditItems} totals={editTotals} input={input} />
                      <div className="pt-3 flex flex-col gap-1.5" style={{ borderTop: `1px solid ${T.border}` }}>
                        <TotalsDisplay totals={editTotals} />
                        <div className="flex justify-end mt-1">
                          <button onClick={() => saveEdit(q)} disabled={editSaving} className="px-6 h-10 transition-opacity hover:opacity-90 disabled:opacity-50"
                            style={{ fontFamily: T.mono, fontSize: "0.75rem", letterSpacing: "0.06em", textTransform: "uppercase", background: T.primary, color: T.primaryFg, borderRadius: T.r.sm }}>
                            {editSaving ? "Saving…" : "Save changes"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

function LineItemsEditor({ items, setItems, totals, input }: { items: LineItem[]; setItems: (v: LineItem[]) => void; totals: ReturnType<typeof calcTotals>; input: React.CSSProperties }) {
  return (
    <div className="flex flex-col gap-2">
      <span style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: T.muted }}>Line items</span>
      {items.map((it, i) => {
        const disc = isDiscount(it);
        const lineTotal = disc ? -totals.discountAmount : (it.qty || 0) * (it.unit_price || 0);
        return disc ? (
          <div key={i} className="grid grid-cols-[1fr_auto_100px_auto] gap-2 items-center p-2 rounded-md" style={{ background: `${T.accent}10`, border: `1px solid ${T.accent}30` }}>
            <input placeholder="Discount label" style={{ ...input, fontFamily: T.mono, fontSize: "0.82rem" }} value={it.label} onChange={e => { const a = [...items]; a[i] = { ...it, label: e.target.value }; setItems(a); }} />
            <div className="flex items-center gap-1">
              <span style={{ fontFamily: T.mono, fontSize: "0.82rem", color: T.muted }}>−</span>
              <input type="number" min={0} max={100} placeholder="%" style={{ ...input, width: 72, fontFamily: T.mono }} value={Math.abs(Number(it.unit_price)) || ""} onChange={e => { const a = [...items]; a[i] = { ...it, unit_price: -(Math.abs(+e.target.value)) }; setItems(a); }} />
              <span style={{ fontFamily: T.mono, fontSize: "0.82rem", color: T.muted }}>%</span>
            </div>
            <span className="text-right" style={{ fontFamily: T.mono, fontSize: "0.8rem", color: T.accent }}>{lineTotal < 0 ? `−${money(-lineTotal)}` : "—"}</span>
            <button type="button" onClick={() => setItems(items.filter((_, j) => j !== i))} style={{ color: T.danger, fontFamily: T.mono, fontSize: 16 }}>×</button>
          </div>
        ) : (
          <div key={i} className="grid grid-cols-[1fr_80px_120px_100px_auto] gap-2 items-center">
            <input placeholder="Description" style={input} value={it.label} onChange={e => { const a = [...items]; a[i] = { ...it, label: e.target.value }; setItems(a); }} />
            <input type="number" min={0} placeholder="Qty" style={input} value={it.qty} onChange={e => { const a = [...items]; a[i] = { ...it, qty: +e.target.value }; setItems(a); }} />
            <input type="number" placeholder="Unit £" style={input} value={it.unit_price} onChange={e => { const a = [...items]; a[i] = { ...it, unit_price: +e.target.value }; setItems(a); }} />
            <span className="text-right" style={{ fontFamily: T.mono, fontSize: "0.8rem", color: T.muted }}>{money(lineTotal)}</span>
            <button type="button" onClick={() => setItems(items.filter((_, j) => j !== i))} style={{ color: T.danger, fontFamily: T.mono, fontSize: 16 }}>×</button>
          </div>
        );
      })}
      <div className="flex gap-3">
        <button type="button" onClick={() => setItems([...items, { label: "", qty: 1, unit_price: 0 }])} style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: T.primary }}>+ Add line</button>
        {!totals.hasDiscount && (
          <button type="button" onClick={() => setItems([...items, { label: "Discount", qty: 1, unit_price: 0 }])} style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: T.accent }}>+ Add discount</button>
        )}
      </div>
    </div>
  );
}

function TotalsDisplay({ totals }: { totals: ReturnType<typeof calcTotals> }) {
  return (
    <>
      {totals.hasDiscount && <div className="flex items-center justify-between">
        <span style={{ fontFamily: T.mono, fontSize: "0.85rem", color: T.muted }}>Subtotal</span>
        <span style={{ fontFamily: T.mono, fontSize: "0.85rem", color: T.muted }}>{money(totals.subtotal)}</span>
      </div>}
      {totals.hasDiscount && <div className="flex items-center justify-between">
        <span style={{ fontFamily: T.mono, fontSize: "0.85rem", color: T.accent }}>{totals.discountItem?.label || "Discount"} (−{totals.discountPct}%)</span>
        <span style={{ fontFamily: T.mono, fontSize: "0.85rem", color: T.accent }}>−{money(totals.discountAmount)}</span>
      </div>}
      <div className="flex items-center justify-between">
        <span style={{ fontFamily: T.display, fontWeight: 600, fontSize: "1.3rem", color: T.fg }}>TOTAL: <span style={{ color: T.primary }}>{money(totals.total)}</span></span>
      </div>
    </>
  );
}
