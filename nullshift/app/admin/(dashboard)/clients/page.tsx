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
    setRows((data as Client[]) ?? []);
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

  const input: React.CSSProperties = { background: T.bg, border: `1px solid ${T.border}`, padding: "10px 12px", color: T.fg, fontFamily: T.sans, fontSize: "0.9rem", outline: "none", borderRadius: "3px" };

  return (
    <div>
      <div className="mb-8">
        <div style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: T.primary, marginBottom: "8px" }}>// ACCOUNTS</div>
        <h1 style={{ fontFamily: T.display, fontWeight: 900, fontSize: "2.4rem", letterSpacing: "0.01em", color: T.fg }}>CLIENTS</h1>
      </div>

      {/* Add client */}
      <form onSubmit={addClient} className="grid md:grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 mb-8 p-4 rounded-lg" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
        <input placeholder="Name *" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={input} />
        <input placeholder="Business" value={form.business_name} onChange={e => setForm({ ...form, business_name: e.target.value })} style={input} />
        <input placeholder="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={input} />
        <input placeholder="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} style={input} />
        <button type="submit" disabled={saving} className="px-5 transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ fontFamily: T.mono, fontSize: "11px", letterSpacing: "0.06em", textTransform: "uppercase", background: T.primary, color: T.primaryFg, borderRadius: "3px" }}>
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
            <Link key={c.id} href={`/admin/clients/${c.id}`} className="grid grid-cols-[1fr_1fr_120px_120px] gap-4 items-center px-5 py-4 hover:bg-[#1f1f23] transition-colors"
              style={{ borderTop: i ? `1px solid ${T.border}` : "none", background: T.surface }}>
              <span style={{ fontFamily: T.display, fontWeight: 900, fontSize: "1rem", color: T.fg }}>{c.name}</span>
              <span style={{ fontFamily: T.sans, fontSize: "0.85rem", color: T.muted }}>{c.business_name || "—"}</span>
              <span style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase", color: T.primary }}>● {c.status}</span>
              <span className="text-right" style={{ fontFamily: T.mono, fontSize: "10px", color: T.muted }}>Brand form →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
