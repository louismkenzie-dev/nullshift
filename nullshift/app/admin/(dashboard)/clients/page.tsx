"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { T } from "@/lib/tokens";

type Client = {
  id: string; created_at: string; name: string; business_name: string | null;
  email: string | null; phone: string | null; status: string;
};

export default function ClientsPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", business_name: "", email: "", phone: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("clients").select("*").order("created_at", { ascending: false });
    const clients = (data as Client[]) ?? [];

    // Sync statuses from the proposal lifecycle: accepted → won, unsigned
    // proposal older than 30 days → lost. Applied lazily on list load.
    const { data: props } = await supabase.from("proposals").select("client_id, created_at, accepted_at");
    const PROPOSAL_VALID_DAYS = 30;
    const desiredFor: Record<string, string> = {};
    for (const p of (props ?? []) as { client_id: string | null; created_at: string; accepted_at: string | null }[]) {
      if (!p.client_id) continue;
      if (p.accepted_at) { desiredFor[p.client_id] = "won"; continue; }
      const expired = Date.now() - new Date(p.created_at).getTime() > PROPOSAL_VALID_DAYS * 86400000;
      if (expired && desiredFor[p.client_id] !== "won") desiredFor[p.client_id] = "lost";
    }
    const updates = clients.filter(c => desiredFor[c.id] && desiredFor[c.id] !== c.status);
    if (updates.length) {
      await Promise.all(updates.map(c => supabase.from("clients").update({ status: desiredFor[c.id] }).eq("id", c.id)));
      for (const c of clients) if (desiredFor[c.id]) c.status = desiredFor[c.id];
    }

    setRows(clients);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  async function addClient(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    await supabase.from("clients").insert({ ...form, status: "lead" });
    setForm({ name: "", business_name: "", email: "", phone: "" });
    setSaving(false);
    load();
  }

  const input: React.CSSProperties = { background: T.bg, border: `1px solid ${T.border}`, padding: "10px 12px", color: T.fg, fontFamily: T.sans, fontSize: "0.9rem", outline: "none", borderRadius: T.r.sm, minWidth: 0, width: "100%" };

  return (
    <div>
      <div className="mb-8">
        <div style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: T.primary, marginBottom: "8px" }}>// ACCOUNTS</div>
        <h1 style={{ fontFamily: T.display, fontWeight: 600, fontSize: "2.4rem", letterSpacing: "0.01em", color: T.fg }}>CLIENTS</h1>
      </div>

      {/* Add client */}
      <form onSubmit={addClient} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 mb-8 p-4 rounded-lg" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
        <input placeholder="Name *" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={input} />
        <input placeholder="Business" value={form.business_name} onChange={e => setForm({ ...form, business_name: e.target.value })} style={input} />
        <input placeholder="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={input} />
        <input placeholder="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} style={input} />
        <button type="submit" disabled={saving} className="px-5 transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ fontFamily: T.mono, fontSize: "11px", letterSpacing: "0.06em", textTransform: "uppercase", background: T.primary, color: T.primaryFg, borderRadius: T.r.sm }}>
          {saving ? "…" : "Add"}
        </button>
      </form>

      {loading ? (
        <p style={{ fontFamily: T.mono, fontSize: "12px", color: T.muted }}>Loading…</p>
      ) : rows.length === 0 ? (
        <p style={{ fontFamily: T.mono, fontSize: "12px", color: T.muted }}>No clients yet. Add one above or convert an enquiry.</p>
      ) : (
        <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${T.border}` }}>
          {rows.map((c, i) => (
            <Link key={c.id} href={`/admin/clients/${c.id}`} className="grid grid-cols-[1fr_100px_auto] md:grid-cols-[1fr_1fr_120px_120px] gap-3 md:gap-4 items-center px-4 sm:px-5 py-4 hover:bg-[#1f1f23] transition-colors"
              style={{ borderTop: i ? `1px solid ${T.border}` : "none", background: T.surface }}>
              <span className="min-w-0 truncate" style={{ fontFamily: T.display, fontWeight: 600, fontSize: "1rem", color: T.fg }}>
                {c.name}
                {c.business_name && <span className="md:hidden" style={{ fontFamily: T.sans, fontWeight: 400, fontSize: "0.78rem", color: T.muted, marginLeft: "8px" }}>· {c.business_name}</span>}
              </span>
              <span className="hidden md:inline min-w-0 truncate" style={{ fontFamily: T.sans, fontSize: "0.85rem", color: T.muted }}>{c.business_name || "—"}</span>
              <span style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase", color: T.primary, whiteSpace: "nowrap" }}>● {c.status}</span>
              <span className="hidden md:inline text-right" style={{ fontFamily: T.mono, fontSize: "10px", color: T.muted, whiteSpace: "nowrap" }}>Brand form →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
