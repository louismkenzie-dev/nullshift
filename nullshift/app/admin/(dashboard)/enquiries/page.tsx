"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { T } from "@/lib/tokens";
import { BriefViewer } from "@/components/BriefViewer";
import type { BriefData } from "@/lib/brief";

type Enquiry = {
  id: string;
  created_at: string;
  source: string;
  name: string;
  business_name: string | null;
  email: string;
  phone: string | null;
  message: string | null;
  preferred_date: string | null;
  preferred_time: string | null;
  referral: string | null;
  brief_data: BriefData | null;
  status: string;
};

const STATUSES = ["new", "in_progress", "quoted", "won", "lost"];
const statusColor: Record<string, string> = {
  new: T.primary, in_progress: "#facc15", quoted: "#06b6d4", won: "#10b981", lost: T.danger,
};

export default function EnquiriesPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    // Converted enquiries live on as clients — keep them out of the inbox.
    const { data } = await supabase.from("enquiries").select("*").neq("status", "converted").order("created_at", { ascending: false });
    setRows((data as Enquiry[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  async function setStatus(id: string, status: string) {
    setRows(r => r.map(e => e.id === id ? { ...e, status } : e));
    await supabase.from("enquiries").update({ status }).eq("id", id);
  }

  async function convertToClient(e: Enquiry) {
    // Carry the enquiry's pipeline status onto the new client so it still shows.
    const clientStatus = e.status === "new" ? "lead" : e.status;
    const { data: newClient } = await supabase.from("clients").insert({
      name: e.name, business_name: e.business_name, email: e.email, phone: e.phone, status: clientStatus,
      notes: `Converted from ${e.source} enquiry.`,
      requested_date: e.preferred_date, requested_time: e.preferred_time,
    }).select("id").single();

    if (newClient) {
      // Link any unattached brief submissions from this email to the new client
      // (covers the common case: a visitor fills the brief publicly, then admin
      // converts the resulting enquiry). Match by email — case-insensitive.
      const emailMatch = (e.email || "").trim();
      if (emailMatch) {
        const { data: briefs } = await supabase
          .from("enquiries")
          .select("id, brief_data")
          .eq("source", "brief")
          .is("client_id", null)
          .ilike("email", emailMatch);

        if (briefs && briefs.length > 0) {
          const ids = briefs.map(b => b.id);
          await supabase.from("enquiries").update({ client_id: newClient.id }).in("id", ids);
          // Stamp the most recent brief's completion onto the client so the
          // dashboard card flips to "Brief received ✓" straight away.
          await supabase.from("clients").update({ brief_completed_at: new Date().toISOString() }).eq("id", newClient.id);
        }
      }
    }

    // Mark the enquiry converted and remove it from the inbox immediately.
    await supabase.from("enquiries").update({ status: "converted" }).eq("id", e.id);
    setRows(r => r.filter(x => x.id !== e.id));
    setOpen(null);
  }

  const newCount = rows.filter(r => r.status === "new").length;

  return (
    <div>
      <div className="flex items-end justify-between mb-8">
        <div>
          <div style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: T.primary, marginBottom: "8px" }}>// INBOX</div>
          <h1 style={{ fontFamily: T.display, fontWeight: 600, fontSize: "2.4rem", letterSpacing: "0.01em", color: T.fg }}>ENQUIRIES</h1>
        </div>
        <div style={{ fontFamily: T.mono, fontSize: "11px", color: T.muted }}>
          {rows.length} total · <span style={{ color: T.primary }}>{newCount} new</span>
        </div>
      </div>

      {loading ? (
        <p style={{ fontFamily: T.mono, fontSize: "12px", color: T.muted }}>Loading…</p>
      ) : rows.length === 0 ? (
        <p style={{ fontFamily: T.mono, fontSize: "12px", color: T.muted }}>No enquiries yet.</p>
      ) : (
        <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${T.border}` }}>
          {rows.map((e, i) => (
            <div key={e.id} style={{ borderTop: i ? `1px solid ${T.border}` : "none", background: T.surface }}>
              <button onClick={() => setOpen(open === e.id ? null : e.id)} className="w-full text-left px-5 py-4 grid grid-cols-[90px_1fr_140px_120px] gap-4 items-center hover:bg-[#1f1f23] transition-colors">
                <span style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase", color: T.muted }}>{e.source}</span>
                <span>
                  <span style={{ fontFamily: T.display, fontWeight: 600, fontSize: "1rem", color: T.fg }}>{e.name}</span>
                  {e.business_name && <span style={{ fontFamily: T.sans, fontSize: "0.85rem", color: T.muted }}> · {e.business_name}</span>}
                </span>
                <span style={{ fontFamily: T.mono, fontSize: "10px", color: T.muted }}>{new Date(e.created_at).toLocaleDateString()}</span>
                <span style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase", color: statusColor[e.status] ?? T.muted }}>● {e.status.replace("_", " ")}</span>
              </button>

              {open === e.id && (
                <div className="px-5 pb-5 pt-1" style={{ background: T.bg }}>
                  <div className="grid md:grid-cols-2 gap-x-8 gap-y-2 mb-4" style={{ fontFamily: T.sans, fontSize: "0.85rem", color: T.muted }}>
                    <div><b style={{ color: T.fg }}>Email:</b> <a href={`mailto:${e.email}`} style={{ color: T.primary }}>{e.email}</a></div>
                    {e.phone && <div><b style={{ color: T.fg }}>Phone:</b> {e.phone}</div>}
                    {e.preferred_date && <div><b style={{ color: T.fg }}>Preferred:</b> {e.preferred_date} {e.preferred_time}</div>}
                    {e.referral && <div><b style={{ color: T.fg }}>Heard via:</b> {e.referral}</div>}
                  </div>
                  {e.message && <p className="mb-4" style={{ fontFamily: T.sans, fontSize: "0.9rem", lineHeight: 1.7, color: T.fg, whiteSpace: "pre-wrap" }}>{e.message}</p>}
                  {e.brief_data && <div className="mb-4"><BriefViewer brief={e.brief_data} /></div>}
                  <div className="flex flex-wrap items-center gap-2">
                    <span style={{ fontFamily: T.mono, fontSize: "10px", color: T.muted, marginRight: "4px" }}>STATUS:</span>
                    {STATUSES.map(s => (
                      <button key={s} onClick={() => setStatus(e.id, s)} className="px-3 py-1.5 transition-opacity hover:opacity-90"
                        style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.06em", textTransform: "uppercase", borderRadius: T.r.sm,
                          background: e.status === s ? statusColor[s] : "transparent", color: e.status === s ? T.primaryFg : T.muted, border: `1px solid ${e.status === s ? statusColor[s] : T.border}` }}>
                        {s.replace("_", " ")}
                      </button>
                    ))}
                    <button onClick={() => convertToClient(e)} className="ml-auto px-4 py-1.5 transition-opacity hover:opacity-90"
                      style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.06em", textTransform: "uppercase", background: T.primary, color: T.primaryFg, borderRadius: T.r.sm }}>
                      Convert to client →
                    </button>
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
