"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { T } from "@/lib/tokens";
import { formatCallDate, formatCallTime, money, proposalRef } from "@/lib/format";
import { BriefViewer } from "@/components/BriefViewer";
import type { BriefData } from "@/lib/brief";

type Client = { id: string; name: string; business_name: string | null; email: string | null; phone: string | null; status: string; notes: string | null; requested_date: string | null; requested_time: string | null; brief_completed_at: string | null };
type Call = { id: string; client_id: string; call_date: string; call_time: string; duration_min: number; status: string };
type LineItem = { label: string; qty: number; unit_price: number };
type Phase = { phase: string; items: string[] };
type Week = { week: string; title: string; description: string };
type Proposal = {
  id: string; created_at: string; client_id: string; title: string; summary: string | null;
  line_items: LineItem[]; total: number; currency: string; status: string;
  project_name: string | null; duration: string | null; platform: string | null; team_size: string | null;
  overview: string | null; scope: Phase[]; deliverables: string[]; timeline: Week[];
  accepted_at: string | null; accepted_name: string | null; accepted_signature: string | null;
};

// The public booking form offers slots; map them to a concrete start time
// (London) for the Book Call picker, and to a friendly label for display.
const SLOT_TIME: Record<string, string> = { morning: "09:00", afternoon: "13:00", evening: "17:00" };
const SLOT_LABEL: Record<string, string> = { morning: "Morning (9am–12pm)", afternoon: "Afternoon (12–5pm)", evening: "Evening (5–8pm)" };

const DEFAULT_PHASES: Phase[] = [
  { phase: "Discovery & Strategy", items: [""] },
  { phase: "Design & Prototyping", items: [""] },
  { phase: "Development", items: [""] },
  { phase: "Testing & Launch", items: [""] },
];

// Card wrapper at module scope so its identity stays stable across renders
// (a render-scoped component would remount inputs and drop focus per keystroke).
const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="p-6 rounded-lg mb-4" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
    <h2 className="mb-4" style={{ fontFamily: T.display, fontWeight: 900, fontSize: "1.1rem", letterSpacing: "0.04em", textTransform: "uppercase", color: T.primary }}>{title}</h2>
    {children}
  </section>
);

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Booking state
  const [call, setCall] = useState<Call | null>(null);
  const [booking, setBooking] = useState(false);
  const [bookDate, setBookDate] = useState("");
  const [bookTime, setBookTime] = useState("10:00");
  const [bookingBusy, setBookingBusy] = useState(false);

  // Proposal (quote + document) for this client
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [docsOpen, setDocsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedRef, setCopiedRef] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Brief intake form state
  const [brief, setBrief] = useState<BriefData | null>(null);
  const [briefOpen, setBriefOpen] = useState(false);
  const [briefViewerOpen, setBriefViewerOpen] = useState(false);
  const [briefLinkCopied, setBriefLinkCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: c } = await supabase.from("clients").select("*").eq("id", id).single();
    const cl_ = c as Client;
    setClient(cl_);
    const { data: cl } = await supabase.from("calls").select("*").eq("client_id", id).eq("status", "confirmed").order("call_date").limit(1).maybeSingle();
    setCall((cl as Call) ?? null);
    if (!cl) {
      if (cl_?.requested_date) setBookDate(cl_.requested_date);
      if (cl_?.requested_time) setBookTime(SLOT_TIME[cl_.requested_time] ?? cl_.requested_time);
    }
    const { data: p } = await supabase.from("proposals").select("*").eq("client_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (p) {
      const pr = p as Proposal;
      // Ensure the document shape has sensible defaults to edit against.
      pr.scope = (pr.scope?.length ? pr.scope : DEFAULT_PHASES).map(s => ({ phase: s.phase, items: s.items?.length ? s.items : [""] }));
      pr.deliverables = pr.deliverables?.length ? pr.deliverables : [""];
      pr.timeline = pr.timeline?.length ? pr.timeline : [{ week: "Week 1", title: "", description: "" }];
      setProposal(pr);

      // Keep the client status in sync with the proposal lifecycle:
      //  • accepted  → won
      //  • unsigned and older than 30 days → lost (expired)
      const PROPOSAL_VALID_DAYS = 30;
      const expired = !pr.accepted_at && Date.now() - new Date(pr.created_at).getTime() > PROPOSAL_VALID_DAYS * 86400000;
      const desired = pr.accepted_at ? "won" : expired ? "lost" : null;
      if (desired && cl_ && cl_.status !== desired) {
        await supabase.from("clients").update({ status: desired }).eq("id", id);
        setClient({ ...cl_, status: desired });
      }
    } else {
      setProposal(null);
    }

    // Look up the latest submitted brief linked to this client (if any).
    const { data: b } = await supabase.from("enquiries").select("brief_data").eq("client_id", id).eq("source", "brief").order("created_at", { ascending: false }).limit(1).maybeSingle();
    setBrief((b?.brief_data as BriefData) ?? null);

    setLoading(false);
  }, [supabase, id]);

  useEffect(() => { load(); }, [load]);

  // Mutate a field on the in-memory proposal document.
  function setDoc<K extends keyof Proposal>(key: K, value: Proposal[K]) {
    setProposal(p => (p ? { ...p, [key]: value } : p));
  }

  async function confirmBooking() {
    if (!bookDate || !bookTime) return;
    setBookingBusy(true);
    const { data } = await supabase.from("calls").insert({ client_id: id, call_date: bookDate, call_time: bookTime, status: "confirmed" }).select().single();
    if (data) { setCall(data as Call); setBooking(false); }
    setBookingBusy(false);
  }
  async function cancelBooking() {
    if (!call) return;
    await supabase.from("calls").update({ status: "cancelled" }).eq("id", call.id);
    setCall(null);
  }
  function draftProposal() { router.push(`/admin/proposals?client=${id}&template=website`); }

  async function saveProposalDoc() {
    if (!proposal) return;
    setSaving(true);
    await supabase.from("proposals").update({
      project_name: proposal.project_name, duration: proposal.duration, platform: proposal.platform,
      team_size: proposal.team_size, overview: proposal.overview,
      scope: proposal.scope, deliverables: proposal.deliverables, timeline: proposal.timeline,
    }).eq("id", proposal.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function deleteClient() {
    if (!client) return;
    if (!window.confirm(`Permanently delete ${client.name} and ALL their data (proposal, booked calls)?\n\nThis cannot be undone.`)) return;
    setDeleting(true);
    await supabase.from("proposals").delete().eq("client_id", id);
    await supabase.from("calls").delete().eq("client_id", id);
    await supabase.from("brand_guidelines").delete().eq("client_id", id);
    // Brief submissions are kept as enquiries but unlinked when the client is deleted.
    await supabase.from("enquiries").update({ client_id: null }).eq("client_id", id);
    await supabase.from("clients").delete().eq("id", id);
    router.push("/admin/clients");
  }

  if (loading) return <p style={{ fontFamily: T.mono, fontSize: "12px", color: T.muted }}>Loading…</p>;

  const input: React.CSSProperties = { background: T.bg, border: `1px solid ${T.border}`, padding: "10px 12px", color: T.fg, fontFamily: T.sans, fontSize: "0.9rem", outline: "none", borderRadius: "3px", width: "100%" };
  const labelS: React.CSSProperties = { fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: T.muted, marginBottom: "6px", display: "block" };

  const requestedHint = client?.requested_date
    ? `${formatCallDate(client.requested_date)}${client.requested_time ? ` · ${SLOT_LABEL[client.requested_time] ?? client.requested_time}` : ""}`
    : null;

  const accepted = !!proposal?.accepted_at;
  const proposalUrl = proposal ? (typeof window !== "undefined" ? `${window.location.origin}/proposal/${proposal.id}` : `/proposal/${proposal.id}`) : "";

  // Workflow: Book Call → Draft Proposal → Send & Accept.
  const done = [!!call, !!proposal, accepted];
  const nextIndex = done.findIndex(d => !d);
  const stepCardStyle = (i: number): React.CSSProperties => {
    const isDone = done[i], isNext = i === nextIndex;
    return {
      background: T.surface, border: `1px solid ${isNext ? T.accent : T.border}`, borderRadius: 14, padding: 18,
      opacity: isDone ? 0.5 : 1,
      boxShadow: isNext ? `0 0 0 1px ${T.accent}, 0 0 26px -6px ${T.accent}` : "none",
      transition: "box-shadow .25s, opacity .25s, border-color .25s",
    };
  };
  const StepHead = ({ i, label }: { i: number; label: string }) => {
    const isDone = done[i], isNext = i === nextIndex;
    const c = isDone ? T.primary : isNext ? T.accent : T.muted;
    return (
      <div className="flex items-center justify-between mb-2.5">
        <span style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: "0.14em", color: T.muted }}>0{i + 1}</span>
        <span style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: c }}>
          {isDone ? `✓ ${label}` : isNext ? "● Next step" : "○ Pending"}
        </span>
      </div>
    );
  };

  return (
    <div className="max-w-3xl">
      <Link href="/admin/clients" style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: T.muted }}>← Clients</Link>
      <div className="mt-3 mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 style={{ fontFamily: T.display, fontWeight: 900, fontSize: "2.2rem", color: T.fg }}>{client?.name}</h1>
          <p style={{ fontFamily: T.sans, fontSize: "0.9rem", color: T.muted }}>{client?.business_name} · {client?.email}</p>
          {proposal && (
            <button
              onClick={() => { navigator.clipboard?.writeText(proposalRef(proposal.id)).catch(() => {}); setCopiedRef(true); setTimeout(() => setCopiedRef(false), 1500); }}
              title="Click to copy for invoicing"
              className="mt-2 inline-flex items-center gap-2 px-2.5 h-7 transition-colors hover:bg-[#1f1f23]"
              style={{ fontFamily: T.mono, fontSize: "11px", letterSpacing: "0.06em", color: copiedRef ? T.primary : T.fg, border: `1px solid ${T.border}`, borderRadius: "4px" }}>
              <span style={{ color: T.muted }}>REF</span>
              <span>{proposalRef(proposal.id)}</span>
              <span style={{ color: T.muted, fontSize: "10px" }}>{copiedRef ? "✓ copied" : "⧉"}</span>
            </button>
          )}
        </div>
        {proposal && (
          <button onClick={saveProposalDoc} disabled={saving} className="px-5 h-11 transition-opacity hover:opacity-90 disabled:opacity-50 shrink-0"
            style={{ fontFamily: T.mono, fontSize: "0.75rem", letterSpacing: "0.06em", textTransform: "uppercase", background: T.primary, color: T.primaryFg, borderRadius: "3px" }}>
            {saving ? "Saving…" : saved ? "Saved ✓" : "Save proposal"}
          </button>
        )}
      </div>

      {/* Acceptance banner */}
      {accepted && (
        <div className="mb-6 p-4 rounded-lg" style={{ background: `${T.primary}14`, border: `1px solid ${T.primary}` }}>
          <div className="flex items-center gap-3">
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.primary }} />
            <span style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: "0.06em", color: T.fg }}>
              PROPOSAL ACCEPTED by {proposal?.accepted_name} on {new Date(proposal!.accepted_at!).toLocaleString("en-GB", { timeZone: "Europe/London" })}
            </span>
          </div>
          <a href={proposalUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 mt-2 ml-5 transition-opacity hover:opacity-80"
            style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: "0.04em", color: T.primary }}>
            View signed proposal ↗
          </a>
        </div>
      )}

      {/* ── Workflow ───────────────────────────────────────── */}
      <div style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: T.primary, marginBottom: "12px" }}>// WORKFLOW</div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {/* 01 — Book Call */}
        <div style={stepCardStyle(0)}>
          <StepHead i={0} label="Booked" />
          {call ? (
            <div className="flex flex-col gap-1">
              <span style={{ fontFamily: T.display, fontWeight: 900, fontSize: "1.05rem", color: T.fg }}>Call confirmed</span>
              <span style={{ fontFamily: T.sans, fontSize: "0.82rem", color: T.muted }}>{formatCallDate(call.call_date)}</span>
              <span style={{ fontFamily: T.mono, fontSize: "0.74rem", color: T.primary }}>{formatCallTime(call.call_time)} · {call.duration_min} min</span>
              <button onClick={cancelBooking} className="self-start mt-2" style={{ fontFamily: T.mono, fontSize: "9px", letterSpacing: "0.08em", textTransform: "uppercase", color: T.danger }}>Cancel booking</button>
            </div>
          ) : (
            <button onClick={() => setBooking(v => !v)} className="text-left w-full">
              <div style={{ fontFamily: T.display, fontWeight: 900, fontSize: "1.05rem", color: T.fg }}>Book Call</div>
              <div style={{ fontFamily: T.sans, fontSize: "0.8rem", color: T.muted, marginTop: 4 }}>Schedule a discovery call (London time).</div>
              {requestedHint && (
                <div className="mt-2 pt-2" style={{ borderTop: `1px solid ${T.border}` }}>
                  <span style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: T.muted }}>Client requested</span>
                  <div style={{ fontFamily: T.sans, fontSize: "0.82rem", color: T.accent, marginTop: 2 }}>{requestedHint}</div>
                </div>
              )}
            </button>
          )}
        </div>

        {/* 02 — Brief collection */}
        <div style={stepCardStyle(brief ? 1 : 0)}>
          <StepHead i={1} label={brief ? "Complete" : "Pending"} />
          <button onClick={() => brief ? setBriefViewerOpen(v => !v) : setBriefOpen(v => !v)} className="text-left w-full">
            <div style={{ fontFamily: T.display, fontWeight: 900, fontSize: "1.05rem", color: T.fg }}>
              {brief ? "Brief received ✓" : "Send Brief Collection"}
            </div>
            <div style={{ fontFamily: T.sans, fontSize: "0.8rem", color: T.muted, marginTop: 4 }}>
              {brief ? "View the full brief the client submitted." : "Share the 5-step intake form link."}
            </div>
            {client?.brief_completed_at && (
              <div className="mt-2 pt-2" style={{ borderTop: `1px solid ${T.border}` }}>
                <span style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: T.muted }}>Submitted</span>
                <div style={{ fontFamily: T.sans, fontSize: "0.82rem", color: T.accent ?? T.primary, marginTop: 2 }}>{new Date(client.brief_completed_at).toLocaleDateString()}</div>
              </div>
            )}
          </button>
        </div>

        {/* 03 — Draft Proposal */}
        <div style={stepCardStyle(proposal ? 2 : 1)}>
          <StepHead i={2} label="Drafted" />
          <button onClick={draftProposal} className="text-left w-full">
            <div style={{ fontFamily: T.display, fontWeight: 900, fontSize: "1.05rem", color: T.fg }}>Draft Proposal</div>
            <div style={{ fontFamily: T.sans, fontSize: "0.8rem", color: T.muted, marginTop: 4 }}>
              {proposal ? "Quote created. Fill in the proposal below." : "Pre-fill a proposal with this client's details."}
            </div>
          </button>
        </div>

        {/* 04 — Send Documents */}
        <div style={stepCardStyle(3)}>
          <StepHead i={3} label="Accepted" />
          <button onClick={() => setDocsOpen(v => !v)} className="text-left w-full" disabled={!proposal} style={{ cursor: proposal ? "pointer" : "not-allowed" }}>
            <div style={{ fontFamily: T.display, fontWeight: 900, fontSize: "1.05rem", color: T.fg }}>Send Documents</div>
            <div style={{ fontFamily: T.sans, fontSize: "0.8rem", color: T.muted, marginTop: 4 }}>
              {accepted ? "Accepted by the client." : proposal ? "Share the proposal link for signature." : "Draft a proposal first."}
            </div>
          </button>
        </div>
      </div>

      {/* Booking panel */}
      {booking && !call && (
        <div className="mb-4" style={{ background: T.surface, border: `1px solid ${T.primary}`, borderRadius: 14, padding: 24 }}>
          {requestedHint && (
            <div className="mb-5" style={{ fontFamily: T.sans, fontSize: "0.82rem", color: T.muted }}>
              <span style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: T.muted }}>Client requested: </span>
              <span style={{ color: T.accent }}>{requestedHint}</span>
              <span style={{ color: T.muted }}> — prefilled below, adjust as needed.</span>
            </div>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <div><label style={labelS}>Date</label><input type="date" value={bookDate} onChange={e => setBookDate(e.target.value)} style={{ ...input, colorScheme: "dark", width: "auto" }} /></div>
            <div><label style={labelS}>Time (London)</label><input type="time" value={bookTime} onChange={e => setBookTime(e.target.value)} style={{ ...input, colorScheme: "dark", width: "auto" }} /></div>
            <button onClick={confirmBooking} disabled={!bookDate || bookingBusy} className="inline-flex items-center justify-center gap-2.5 px-14 h-12 transition-all duration-200 disabled:opacity-40 disabled:shadow-none"
              style={{ fontFamily: T.mono, fontSize: "0.74rem", textTransform: "uppercase", fontWeight: 600, background: T.primary, color: T.primaryFg, borderRadius: "8px", boxShadow: `0 0 28px -6px ${T.primary}, 0 0 0 1px ${T.primary}` }}>
              <span style={{ letterSpacing: "0.1em" }}>{bookingBusy ? "Confirming…" : "Confirm booking"}</span>
              {!bookingBusy && <span aria-hidden style={{ fontSize: "1rem" }}>→</span>}
            </button>
          </div>
        </div>
      )}

      {/* Send Brief Collection panel */}
      {briefOpen && !brief && (() => {
        const briefUrl = typeof window !== "undefined" ? `${window.location.origin}/brief?client=${id}` : "";
        return (
          <div className="mb-4 p-6 rounded-lg" style={{ background: T.surface, border: `1px solid ${T.primary}` }}>
            <div style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: T.muted, marginBottom: 10 }}>Brief intake link</div>
            <p style={{ fontFamily: T.sans, fontSize: "0.85rem", color: T.muted, marginBottom: 14, lineHeight: 1.6 }}>
              Send this link to {client?.name}. They&apos;ll fill in a 5-step brief (pages, style, budget, timeline). The submission will appear here automatically.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input readOnly value={briefUrl} style={{ ...input, flex: "1 1 320px", fontFamily: T.mono, fontSize: "0.78rem" }} onFocus={e => e.currentTarget.select()} />
              <button onClick={() => { navigator.clipboard?.writeText(briefUrl).catch(() => {}); setBriefLinkCopied(true); setTimeout(() => setBriefLinkCopied(false), 1500); }}
                className="px-5 h-10 transition-opacity hover:opacity-90" style={{ fontFamily: T.mono, fontSize: "0.72rem", letterSpacing: "0.06em", textTransform: "uppercase", background: T.primary, color: T.primaryFg, borderRadius: "3px" }}>
                {briefLinkCopied ? "Copied ✓" : "Copy link"}
              </button>
              <a href={briefUrl} target="_blank" rel="noreferrer" className="px-5 h-10 inline-flex items-center transition-opacity hover:opacity-90"
                style={{ fontFamily: T.mono, fontSize: "0.72rem", letterSpacing: "0.06em", textTransform: "uppercase", color: T.fg, border: `1px solid ${T.border}`, borderRadius: "3px" }}>
                Preview ↗
              </a>
            </div>
          </div>
        );
      })()}

      {/* Brief viewer */}
      {briefViewerOpen && brief && (
        <div className="mb-4">
          <BriefViewer brief={brief} />
        </div>
      )}

      {/* Send Documents panel */}
      {docsOpen && proposal && (
        <div className="mb-4 p-6 rounded-lg" style={{ background: T.surface, border: `1px solid ${T.primary}` }}>
          <div style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: T.muted, marginBottom: 10 }}>Proposal link</div>
          <p style={{ fontFamily: T.sans, fontSize: "0.85rem", color: T.muted, marginBottom: 14, lineHeight: 1.6 }}>
            Send this link to {client?.name}. They can review the full proposal and sign &amp; accept it at the bottom. You&apos;ll see their acceptance here.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input readOnly value={proposalUrl} style={{ ...input, flex: "1 1 320px", fontFamily: T.mono, fontSize: "0.78rem" }} onFocus={e => e.currentTarget.select()} />
            <button onClick={() => { navigator.clipboard?.writeText(proposalUrl).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              className="px-5 h-10 transition-opacity hover:opacity-90" style={{ fontFamily: T.mono, fontSize: "0.72rem", letterSpacing: "0.06em", textTransform: "uppercase", background: T.primary, color: T.primaryFg, borderRadius: "3px" }}>
              {copied ? "Copied ✓" : "Copy link"}
            </button>
            <a href={proposalUrl} target="_blank" rel="noreferrer" className="px-5 h-10 inline-flex items-center transition-opacity hover:opacity-90"
              style={{ fontFamily: T.mono, fontSize: "0.72rem", letterSpacing: "0.06em", textTransform: "uppercase", color: T.fg, border: `1px solid ${T.border}`, borderRadius: "3px" }}>
              Open ↗
            </a>
          </div>
          <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${T.border}`, fontFamily: T.mono, fontSize: 11, color: accepted ? T.primary : T.muted }}>
            {accepted ? `✓ Accepted by ${proposal.accepted_name} — ${new Date(proposal.accepted_at!).toLocaleString("en-GB", { timeZone: "Europe/London" })}` : "○ Awaiting client signature"}
          </div>
        </div>
      )}

      {/* ── Proposal builder ───────────────────────────────── */}
      <div className="mt-8 mb-4" style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: T.primary }}>// PROPOSAL</div>

      {!proposal ? (
        <div className="p-8 rounded-lg text-center" style={{ background: T.surface, border: `1px dashed ${T.border}` }}>
          <div style={{ fontFamily: T.display, fontWeight: 900, fontSize: "1.1rem", color: T.fg, marginBottom: 8 }}>No proposal yet</div>
          <p style={{ fontFamily: T.sans, fontSize: "0.88rem", color: T.muted, marginBottom: 16 }}>Create the quote first, then fill in the proposal details here.</p>
          <button onClick={draftProposal} className="px-6 h-11 transition-opacity hover:opacity-90"
            style={{ fontFamily: T.mono, fontSize: "0.75rem", letterSpacing: "0.06em", textTransform: "uppercase", background: T.primary, color: T.primaryFg, borderRadius: "3px" }}>
            Draft proposal →
          </button>
        </div>
      ) : (
        <>
          <Card title="Project overview">
            <div className="grid gap-4">
              <div><label style={labelS}>Project name</label><input style={input} value={proposal.project_name ?? ""} onChange={e => setDoc("project_name", e.target.value)} placeholder="e.g. Website Build" /></div>
              <div className="grid sm:grid-cols-3 gap-3">
                <div><label style={labelS}>Duration</label><input style={input} value={proposal.duration ?? ""} onChange={e => setDoc("duration", e.target.value)} placeholder="e.g. 12 weeks" /></div>
                <div><label style={labelS}>Platform</label><input style={input} value={proposal.platform ?? ""} onChange={e => setDoc("platform", e.target.value)} placeholder="e.g. Web + Mobile" /></div>
                <div><label style={labelS}>Team size</label><input style={input} value={proposal.team_size ?? ""} onChange={e => setDoc("team_size", e.target.value)} placeholder="e.g. 4 specialists" /></div>
              </div>
              <div><label style={labelS}>Overview</label><textarea rows={3} style={{ ...input, resize: "vertical" }} value={proposal.overview ?? ""} onChange={e => setDoc("overview", e.target.value)} placeholder="Short summary of the project and approach." /></div>
            </div>
          </Card>

          <Card title="Scope of work — 4 phases">
            <div className="flex flex-col gap-5">
              {proposal.scope.map((ph, pi) => (
                <div key={pi}>
                  <div className="flex items-center gap-2 mb-2">
                    <span style={{ fontFamily: T.mono, fontSize: 10, color: T.primary }}>Phase {pi + 1}</span>
                    <input style={{ ...input, padding: "6px 10px" }} value={ph.phase} onChange={e => { const s = [...proposal.scope]; s[pi] = { ...ph, phase: e.target.value }; setDoc("scope", s); }} placeholder="Phase name" />
                  </div>
                  <div className="flex flex-col gap-2 pl-3" style={{ borderLeft: `1px solid ${T.border}` }}>
                    {ph.items.map((it, ii) => (
                      <div key={ii} className="flex items-center gap-2">
                        <input style={{ ...input, padding: "8px 10px" }} value={it} onChange={e => { const s = [...proposal.scope]; const items = [...ph.items]; items[ii] = e.target.value; s[pi] = { ...ph, items }; setDoc("scope", s); }} placeholder="Scope item" />
                        <button onClick={() => { const s = [...proposal.scope]; s[pi] = { ...ph, items: ph.items.filter((_, j) => j !== ii) }; setDoc("scope", s); }} style={{ color: T.danger, fontFamily: T.mono, fontSize: 16 }}>×</button>
                      </div>
                    ))}
                    <button onClick={() => { const s = [...proposal.scope]; s[pi] = { ...ph, items: [...ph.items, ""] }; setDoc("scope", s); }} className="self-start" style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: T.primary }}>+ Add item</button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Deliverables">
            <div className="flex flex-col gap-2">
              {proposal.deliverables.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input style={input} value={d} onChange={e => { const a = [...proposal.deliverables]; a[i] = e.target.value; setDoc("deliverables", a); }} placeholder="Deliverable" />
                  <button onClick={() => setDoc("deliverables", proposal.deliverables.filter((_, j) => j !== i))} style={{ color: T.danger, fontFamily: T.mono, fontSize: 16 }}>×</button>
                </div>
              ))}
            </div>
            <button onClick={() => setDoc("deliverables", [...proposal.deliverables, ""])} className="mt-3" style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: T.primary }}>+ Add deliverable</button>
          </Card>

          <Card title="Timeline">
            <div className="flex flex-col gap-3">
              {proposal.timeline.map((w, i) => (
                <div key={i} className="grid grid-cols-[110px_1fr_auto] gap-2 items-start">
                  <input style={{ ...input, padding: "8px 10px" }} value={w.week} onChange={e => { const a = [...proposal.timeline]; a[i] = { ...w, week: e.target.value }; setDoc("timeline", a); }} placeholder="Week 1" />
                  <div className="flex flex-col gap-2">
                    <input style={{ ...input, padding: "8px 10px" }} value={w.title} onChange={e => { const a = [...proposal.timeline]; a[i] = { ...w, title: e.target.value }; setDoc("timeline", a); }} placeholder="Milestone / title" />
                    <textarea rows={2} style={{ ...input, padding: "8px 10px", resize: "vertical" }} value={w.description} onChange={e => { const a = [...proposal.timeline]; a[i] = { ...w, description: e.target.value }; setDoc("timeline", a); }} placeholder="What will happen this week" />
                  </div>
                  <button onClick={() => setDoc("timeline", proposal.timeline.filter((_, j) => j !== i))} style={{ color: T.danger, fontFamily: T.mono, fontSize: 16 }}>×</button>
                </div>
              ))}
            </div>
            <button onClick={() => setDoc("timeline", [...proposal.timeline, { week: `Week ${proposal.timeline.length + 1}`, title: "", description: "" }])} className="mt-3" style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: T.primary }}>+ Add week</button>
          </Card>

          <Card title="Investment — pulled from the quote">
            <div className="flex flex-col gap-2">
              {proposal.line_items?.length ? proposal.line_items.map((li, i) => (
                <div key={i} className="flex items-center justify-between py-2" style={{ borderBottom: `1px solid ${T.border}` }}>
                  <span style={{ fontFamily: T.sans, fontSize: "0.88rem", color: T.fg }}>{li.label}</span>
                  <span style={{ fontFamily: T.mono, fontSize: "0.85rem", color: T.muted }}>{money((li.qty || 0) * (li.unit_price || 0), proposal.currency)}</span>
                </div>
              )) : <p style={{ fontFamily: T.sans, fontSize: "0.85rem", color: T.muted }}>No line items on the quote yet — add them in the Proposals tab.</p>}
              <div className="flex items-center justify-between pt-3 mt-1">
                <span style={{ fontFamily: T.display, fontWeight: 900, fontSize: "1.2rem", color: T.fg }}>TOTAL</span>
                <span style={{ fontFamily: T.display, fontWeight: 900, fontSize: "1.4rem", color: T.primary }}>{money(proposal.total || 0, proposal.currency)}</span>
              </div>
              <Link href={`/admin/proposals?client=${id}`} style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: T.muted, marginTop: 6 }}>Edit quote in Proposals →</Link>
            </div>
          </Card>
        </>
      )}

      {/* ── Danger zone ──────────────────────────────────── */}
      <div className="mt-10 mb-4" style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: T.danger }}>// DANGER ZONE</div>
      <div className="p-5 rounded-lg flex flex-wrap items-center justify-between gap-4" style={{ background: T.surface, border: `1px solid ${T.danger}40` }}>
        <div>
          <div style={{ fontFamily: T.display, fontWeight: 900, fontSize: "1rem", color: T.fg }}>Remove client</div>
          <div style={{ fontFamily: T.sans, fontSize: "0.82rem", color: T.muted, marginTop: 2 }}>Permanently deletes this client and all their data — proposal, booked calls.</div>
        </div>
        <button onClick={deleteClient} disabled={deleting} className="px-5 h-11 shrink-0 transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ fontFamily: T.mono, fontSize: "0.72rem", letterSpacing: "0.08em", textTransform: "uppercase", background: "transparent", color: T.danger, border: `1px solid ${T.danger}`, borderRadius: "3px" }}>
          {deleting ? "Removing…" : "Remove client"}
        </button>
      </div>
    </div>
  );
}
