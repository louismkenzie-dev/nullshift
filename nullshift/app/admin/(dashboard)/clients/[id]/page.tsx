"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { T } from "@/lib/tokens";

type Client = { id: string; name: string; business_name: string | null; email: string | null; phone: string | null; status: string; notes: string | null };
type Colour = { name: string; hex: string; role: string };
type TypeRow = { role: string; font: string; weights: string; usage: string };
type Guidelines = {
  id?: string; client_id: string; brand_name: string; tagline: string; mission: string;
  colours: Colour[]; typography: TypeRow[]; voice: string;
  dos_donts: { dos: string[]; donts: string[] }; notes: string;
};

const blank = (clientId: string): Guidelines => ({
  client_id: clientId, brand_name: "", tagline: "", mission: "",
  colours: [{ name: "", hex: "#10b981", role: "" }],
  typography: [{ role: "", font: "", weights: "", usage: "" }],
  voice: "", dos_donts: { dos: [""], donts: [""] }, notes: "",
});

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const supabase = createClient();
  const [client, setClient] = useState<Client | null>(null);
  const [g, setG] = useState<Guidelines | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: c } = await supabase.from("clients").select("*").eq("id", id).single();
    setClient(c as Client);
    const { data: bg } = await supabase.from("brand_guidelines").select("*").eq("client_id", id).maybeSingle();
    setG(bg ? (bg as Guidelines) : blank(id));
    setLoading(false);
  }, [supabase, id]);

  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!g) return;
    setSaving(true);
    const payload = { ...g, client_id: id, updated_at: new Date().toISOString() };
    if (g.id) await supabase.from("brand_guidelines").update(payload).eq("id", g.id);
    else {
      const { data } = await supabase.from("brand_guidelines").insert(payload).select().single();
      if (data) setG(data as Guidelines);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading || !g) return <p style={{ fontFamily: T.mono, fontSize: "12px", color: T.muted }}>Loading…</p>;

  const input: React.CSSProperties = { background: T.bg, border: `1px solid ${T.border}`, padding: "10px 12px", color: T.fg, fontFamily: T.sans, fontSize: "0.9rem", outline: "none", borderRadius: "3px", width: "100%" };
  const labelS: React.CSSProperties = { fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: T.muted, marginBottom: "6px", display: "block" };
  const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="p-6 rounded-lg mb-4" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
      <h2 className="mb-4" style={{ fontFamily: T.display, fontWeight: 900, fontSize: "1.1rem", letterSpacing: "0.04em", textTransform: "uppercase", color: T.primary }}>{title}</h2>
      {children}
    </section>
  );

  return (
    <div className="max-w-3xl">
      <Link href="/admin/clients" style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: T.muted }}>← Clients</Link>
      <div className="mt-3 mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 style={{ fontFamily: T.display, fontWeight: 900, fontSize: "2.2rem", color: T.fg }}>{client?.name}</h1>
          <p style={{ fontFamily: T.sans, fontSize: "0.9rem", color: T.muted }}>{client?.business_name} · {client?.email}</p>
        </div>
        <button onClick={save} disabled={saving} className="px-5 h-11 transition-opacity hover:opacity-90 disabled:opacity-50 shrink-0"
          style={{ fontFamily: T.mono, fontSize: "0.75rem", letterSpacing: "0.06em", textTransform: "uppercase", background: T.primary, color: T.primaryFg, borderRadius: "3px" }}>
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save brand form"}
        </button>
      </div>

      <Card title="Brand basics">
        <div className="grid gap-4">
          <div><label style={labelS}>Brand name</label><input style={input} value={g.brand_name} onChange={e => setG({ ...g, brand_name: e.target.value })} /></div>
          <div><label style={labelS}>Tagline</label><input style={input} value={g.tagline} onChange={e => setG({ ...g, tagline: e.target.value })} /></div>
          <div><label style={labelS}>Mission</label><textarea rows={2} style={{ ...input, resize: "vertical" }} value={g.mission} onChange={e => setG({ ...g, mission: e.target.value })} /></div>
        </div>
      </Card>

      <Card title="Colours">
        <div className="flex flex-col gap-2">
          {g.colours.map((c, i) => (
            <div key={i} className="grid grid-cols-[44px_1fr_1fr_1fr_auto] gap-2 items-center">
              <input type="color" value={c.hex} onChange={e => { const cs = [...g.colours]; cs[i] = { ...c, hex: e.target.value }; setG({ ...g, colours: cs }); }} style={{ width: 44, height: 38, background: "transparent", border: `1px solid ${T.border}`, borderRadius: 3 }} />
              <input placeholder="Name" style={input} value={c.name} onChange={e => { const cs = [...g.colours]; cs[i] = { ...c, name: e.target.value }; setG({ ...g, colours: cs }); }} />
              <input placeholder="Hex" style={input} value={c.hex} onChange={e => { const cs = [...g.colours]; cs[i] = { ...c, hex: e.target.value }; setG({ ...g, colours: cs }); }} />
              <input placeholder="Role" style={input} value={c.role} onChange={e => { const cs = [...g.colours]; cs[i] = { ...c, role: e.target.value }; setG({ ...g, colours: cs }); }} />
              <button onClick={() => setG({ ...g, colours: g.colours.filter((_, j) => j !== i) })} style={{ color: "#f87171", fontFamily: T.mono, fontSize: 16 }}>×</button>
            </div>
          ))}
        </div>
        <button onClick={() => setG({ ...g, colours: [...g.colours, { name: "", hex: "#10b981", role: "" }] })} className="mt-3" style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: T.primary }}>+ Add colour</button>
      </Card>

      <Card title="Typography">
        <div className="flex flex-col gap-2">
          {g.typography.map((t, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
              <input placeholder="Role (e.g. Display)" style={input} value={t.role} onChange={e => { const ts = [...g.typography]; ts[i] = { ...t, role: e.target.value }; setG({ ...g, typography: ts }); }} />
              <input placeholder="Font" style={input} value={t.font} onChange={e => { const ts = [...g.typography]; ts[i] = { ...t, font: e.target.value }; setG({ ...g, typography: ts }); }} />
              <input placeholder="Weights / usage" style={input} value={t.usage} onChange={e => { const ts = [...g.typography]; ts[i] = { ...t, usage: e.target.value }; setG({ ...g, typography: ts }); }} />
              <button onClick={() => setG({ ...g, typography: g.typography.filter((_, j) => j !== i) })} style={{ color: "#f87171", fontFamily: T.mono, fontSize: 16 }}>×</button>
            </div>
          ))}
        </div>
        <button onClick={() => setG({ ...g, typography: [...g.typography, { role: "", font: "", weights: "", usage: "" }] })} className="mt-3" style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: T.primary }}>+ Add typeface</button>
      </Card>

      <Card title="Voice & notes">
        <label style={labelS}>Brand voice</label>
        <textarea rows={3} style={{ ...input, resize: "vertical" }} value={g.voice} onChange={e => setG({ ...g, voice: e.target.value })} />
        <label style={{ ...labelS, marginTop: 16 }}>Internal notes</label>
        <textarea rows={3} style={{ ...input, resize: "vertical" }} value={g.notes} onChange={e => setG({ ...g, notes: e.target.value })} />
      </Card>
    </div>
  );
}
