"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@nullshift/db/client";
import { T } from "@nullshift/ui/tokens";
import { formatCallDate, formatCallTime, money, proposalRef } from "@nullshift/ui/format";
import { BriefViewer } from "@/components/BriefViewer";
import type { BriefData } from "@nullshift/content/brief";
import { ProjectUpdatesSection } from "./ProjectUpdatesSection";
import { SUB_PROCESSORS } from "@nullshift/content/legalEntity";

type Client = {
  id: string;
  name: string;
  business_name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  notes: string | null;
  requested_date: string | null;
  requested_time: string | null;
  brief_completed_at: string | null;
  project_phase: string | null;
  auth_user_id: string | null;
};
type Call = {
  id: string;
  client_id: string;
  call_date: string;
  call_time: string;
  duration_min: number;
  status: string;
  meeting_link: string | null;
  meeting_id: string | null;
  meeting_password: string | null;
};
type LineItem = { label: string; qty: number; unit_price: number };
type Phase = { phase: string; items: string[] };
type Week = { week: string; title: string; description: string };
type Proposal = {
  id: string;
  created_at: string;
  client_id: string;
  title: string;
  summary: string | null;
  line_items: LineItem[];
  total: number;
  currency: string;
  status: string;
  project_name: string | null;
  duration: string | null;
  platform: string | null;
  team_size: string | null;
  overview: string | null;
  scope: Phase[];
  deliverables: string[];
  timeline: Week[];
  accepted_at: string | null;
  accepted_name: string | null;
  accepted_signature: string | null;
  payment_terms: string | null;
  // Data Processing Agreement (requires migration 013) — signed with the proposal.
  dpa_enabled: boolean | null;
  dpa_client_country: string | null;
  dpa_client_company_number: string | null;
  dpa_client_registered_address: string | null;
  dpa_personal_data: string | null;
  dpa_special_category: boolean | null;
  dpa_special_category_detail: string | null;
};

// The public booking form offers slots; map them to a concrete start time
// (London) for the Book Call picker, and to a friendly label for display.
const SLOT_TIME: Record<string, string> = {
  morning: "09:00",
  afternoon: "13:00",
  evening: "17:00",
};
const SLOT_LABEL: Record<string, string> = {
  morning: "Morning (9am–12pm)",
  afternoon: "Afternoon (12–5pm)",
  evening: "Evening (5–8pm)",
};

const DEFAULT_PHASES: Phase[] = [
  { phase: "Discovery & Strategy", items: [""] },
  { phase: "Design & Prototyping", items: [""] },
  { phase: "Development", items: [""] },
  { phase: "Testing & Launch", items: [""] },
];

// Card wrapper at module scope so its identity stays stable across renders
// (a render-scoped component would remount inputs and drop focus per keystroke).
const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section
    className="p-6 rounded-lg mb-4"
    style={{ background: T.surface, border: `1px solid ${T.border}` }}
  >
    <h2
      className="mb-4"
      style={{
        fontFamily: T.display,
        fontWeight: 600,
        fontSize: "1.1rem",
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        color: T.primary,
      }}
    >
      {title}
    </h2>
    {children}
  </section>
);

// Small Yes/No (or On/Off) segmented toggle. Module scope keeps identity stable.
const Seg = ({
  value,
  onChange,
  yes = "On",
  no = "Off",
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  yes?: string;
  no?: string;
}) => (
  <div
    style={{
      display: "inline-flex",
      border: `1px solid ${T.border}`,
      borderRadius: T.r.full,
      overflow: "hidden",
    }}
  >
    {(
      [
        [false, no],
        [true, yes],
      ] as [boolean, string][]
    ).map(([v, lbl]) => {
      const active = value === v;
      return (
        <button
          key={String(v)}
          type="button"
          onClick={() => onChange(v)}
          style={{
            fontFamily: T.mono,
            fontSize: 10,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            padding: "5px 16px",
            cursor: "pointer",
            background: active ? (v ? `${T.primary}20` : T.surface2) : "transparent",
            color: active ? (v ? T.primary : T.fg) : T.muted,
          }}
        >
          {lbl}
        </button>
      );
    })}
  </div>
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

  // Meeting details (zoom/link) for booked call
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [meetingLink, setMeetingLink] = useState("");
  const [meetingId, setMeetingId] = useState("");
  const [meetingPassword, setMeetingPassword] = useState("");
  const [meetingSaving, setMeetingSaving] = useState(false);
  const [meetingCopied, setMeetingCopied] = useState(false);

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

  // Portal account creation state
  const [portalPassword, setPortalPassword] = useState("");
  const [portalCreating, setPortalCreating] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [portalSuccess, setPortalSuccess] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: c } = await supabase.from("clients").select("*").eq("id", id).single();
    const cl_ = c as Client;
    setClient(cl_);
    const { data: cl } = await supabase
      .from("calls")
      .select("*")
      .eq("client_id", id)
      .eq("status", "confirmed")
      .order("call_date")
      .limit(1)
      .maybeSingle();
    const callRow = (cl as Call) ?? null;
    setCall(callRow);
    if (callRow) {
      setMeetingLink(callRow.meeting_link ?? "");
      setMeetingId(callRow.meeting_id ?? "");
      setMeetingPassword(callRow.meeting_password ?? "");
    }
    if (!cl) {
      if (cl_?.requested_date) setBookDate(cl_.requested_date);
      if (cl_?.requested_time)
        setBookTime(SLOT_TIME[cl_.requested_time] ?? cl_.requested_time);
    }
    const { data: p } = await supabase
      .from("proposals")
      .select("*")
      .eq("client_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (p) {
      const pr = p as Proposal;
      // Ensure the document shape has sensible defaults to edit against.
      pr.scope = (pr.scope?.length ? pr.scope : DEFAULT_PHASES).map((s) => ({
        phase: s.phase,
        items: s.items?.length ? s.items : [""],
      }));
      pr.deliverables = pr.deliverables?.length ? pr.deliverables : [""];
      pr.timeline = pr.timeline?.length
        ? pr.timeline
        : [{ week: "Week 1", title: "", description: "" }];
      pr.dpa_enabled = pr.dpa_enabled ?? true;
      pr.dpa_client_country = pr.dpa_client_country || "United Kingdom";
      setProposal(pr);

      // Keep the client status in sync with the proposal lifecycle:
      //  • accepted  → won
      //  • unsigned and older than 30 days → lost (expired)
      const PROPOSAL_VALID_DAYS = 30;
      const expired =
        !pr.accepted_at &&
        Date.now() - new Date(pr.created_at).getTime() > PROPOSAL_VALID_DAYS * 86400000;
      const desired = pr.accepted_at ? "won" : expired ? "lost" : null;
      if (desired && cl_ && cl_.status !== desired) {
        await supabase.from("clients").update({ status: desired }).eq("id", id);
        setClient({ ...cl_, status: desired });
      }
    } else {
      setProposal(null);
    }

    // Look up the latest submitted brief linked to this client (if any).
    const { data: linked } = await supabase
      .from("enquiries")
      .select("id, brief_data")
      .eq("client_id", id)
      .eq("source", "brief")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    let briefRow = linked;
    // Fallback: if no brief is linked yet but one exists from the same email,
    // adopt it and stamp brief_completed_at. Covers clients converted before
    // the auto-link fix landed, or briefs submitted after the client existed
    // without using the /brief?client=<id> invite link.
    if (!briefRow && cl_?.email) {
      const { data: orphan } = await supabase
        .from("enquiries")
        .select("id, brief_data")
        .eq("source", "brief")
        .is("client_id", null)
        .ilike("email", cl_.email.trim())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (orphan?.brief_data) {
        await supabase.from("enquiries").update({ client_id: id }).eq("id", orphan.id);
        if (!cl_.brief_completed_at) {
          await supabase
            .from("clients")
            .update({ brief_completed_at: new Date().toISOString() })
            .eq("id", id);
          setClient({ ...cl_, brief_completed_at: new Date().toISOString() });
        }
        briefRow = orphan;
      }
    }
    setBrief((briefRow?.brief_data as BriefData) ?? null);

    setLoading(false);
  }, [supabase, id]);

  useEffect(() => {
    load();
  }, [load]);

  // Mutate a field on the in-memory proposal document.
  function setDoc<K extends keyof Proposal>(key: K, value: Proposal[K]) {
    setProposal((p) => (p ? { ...p, [key]: value } : p));
  }

  async function confirmBooking() {
    if (!bookDate || !bookTime) return;
    setBookingBusy(true);
    const { data } = await supabase
      .from("calls")
      .insert({
        client_id: id,
        call_date: bookDate,
        call_time: bookTime,
        status: "confirmed",
      })
      .select()
      .single();
    if (data) {
      setCall(data as Call);
      setBooking(false);
    }
    setBookingBusy(false);
  }
  async function cancelBooking() {
    if (!call) return;
    await supabase.from("calls").update({ status: "cancelled" }).eq("id", call.id);
    setCall(null);
    setMeetingLink("");
    setMeetingId("");
  }

  async function saveMeeting() {
    if (!call) return;
    setMeetingSaving(true);
    await supabase
      .from("calls")
      .update({
        meeting_link: meetingLink || null,
        meeting_id: meetingId || null,
        meeting_password: meetingPassword || null,
      })
      .eq("id", call.id);
    setCall((c) =>
      c
        ? {
            ...c,
            meeting_link: meetingLink || null,
            meeting_id: meetingId || null,
            meeting_password: meetingPassword || null,
          }
        : c
    );
    setMeetingSaving(false);
    setMeetingOpen(false);
  }
  function draftProposal() {
    router.push(`/admin/quotes?client=${id}&template=website`);
  }

  async function saveProposalDoc() {
    if (!proposal) return;
    setSaving(true);
    await supabase
      .from("proposals")
      .update({
        project_name: proposal.project_name,
        duration: proposal.duration,
        platform: proposal.platform,
        team_size: proposal.team_size,
        overview: proposal.overview,
        scope: proposal.scope,
        deliverables: proposal.deliverables,
        timeline: proposal.timeline,
        payment_terms: proposal.payment_terms || null,
      })
      .eq("id", proposal.id);
    // DPA fields are a separate update so the core proposal save still succeeds
    // if migration 013 (the dpa_* columns) hasn't been applied yet.
    await supabase
      .from("proposals")
      .update({
        dpa_enabled: proposal.dpa_enabled ?? true,
        dpa_client_country: proposal.dpa_client_country || "United Kingdom",
        dpa_client_company_number: proposal.dpa_client_company_number || null,
        dpa_client_registered_address: proposal.dpa_client_registered_address || null,
        dpa_personal_data: proposal.dpa_personal_data || null,
        dpa_special_category: !!proposal.dpa_special_category,
        dpa_special_category_detail: proposal.dpa_special_category
          ? proposal.dpa_special_category_detail || null
          : null,
      })
      .eq("id", proposal.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function deleteClient() {
    if (!client) return;
    if (
      !window.confirm(
        `Permanently delete ${client.name} and ALL their data (proposal, booked calls)?\n\nThis cannot be undone.`
      )
    )
      return;
    setDeleting(true);
    await supabase.from("proposals").delete().eq("client_id", id);
    await supabase.from("calls").delete().eq("client_id", id);
    await supabase.from("brand_guidelines").delete().eq("client_id", id);
    // Brief submissions are kept as enquiries but unlinked when the client is deleted.
    await supabase.from("enquiries").update({ client_id: null }).eq("client_id", id);
    await supabase.from("clients").delete().eq("id", id);
    router.push("/admin/clients");
  }

  async function createPortalAccount() {
    if (!client?.email || !portalPassword) return;
    setPortalCreating(true);
    setPortalError(null);
    try {
      const res = await fetch("/api/admin/create-client-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: id,
          email: client.email,
          password: portalPassword,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setPortalError(json.error ?? "Something went wrong.");
      } else {
        setPortalSuccess(true);
        setPortalPassword("");
        setClient((c) => (c ? { ...c, auth_user_id: json.userId } : c));
      }
    } catch {
      setPortalError("Network error — please try again.");
    } finally {
      setPortalCreating(false);
    }
  }

  if (loading)
    return (
      <p style={{ fontFamily: T.mono, fontSize: "12px", color: T.muted }}>Loading…</p>
    );

  const input: React.CSSProperties = {
    background: T.bg,
    border: `1px solid ${T.border}`,
    padding: "10px 12px",
    color: T.fg,
    fontFamily: T.sans,
    fontSize: "0.9rem",
    outline: "none",
    borderRadius: T.r.sm,
    width: "100%",
  };
  const labelS: React.CSSProperties = {
    fontFamily: T.mono,
    fontSize: "10px",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: T.muted,
    marginBottom: "6px",
    display: "block",
  };

  const requestedHint = client?.requested_date
    ? `${formatCallDate(client.requested_date)}${client.requested_time ? ` · ${SLOT_LABEL[client.requested_time] ?? client.requested_time}` : ""}`
    : null;

  async function savePhase(phase: string) {
    await supabase
      .from("clients")
      .update({ project_phase: phase || null })
      .eq("id", id);
    setClient((c) => (c ? { ...c, project_phase: phase || null } : c));
  }

  const accepted = !!proposal?.accepted_at;
  const proposalUrl = proposal
    ? typeof window !== "undefined"
      ? `${window.location.origin}/proposal/${proposal.id}`
      : `/proposal/${proposal.id}`
    : "";

  // Workflow: Book Call → Draft Proposal → Send & Accept.
  const callComplete = !!call && !!call.meeting_link;
  const done = [callComplete, !!brief, !!proposal, accepted];
  const nextIndex = done.findIndex((d) => !d);
  const stepCardStyle = (i: number, locked = false): React.CSSProperties => {
    const isDone = done[i],
      isNext = !locked && i === nextIndex;
    return {
      background: T.surface,
      border: `1px solid ${isNext ? T.accent : T.border}`,
      borderRadius: 14,
      padding: 18,
      opacity: isDone || locked ? 0.5 : 1,
      boxShadow: isNext ? `0 0 0 1px ${T.accent}, 0 0 26px -6px ${T.accent}` : "none",
      transition: "box-shadow .25s, opacity .25s, border-color .25s",
    };
  };
  const StepHead = ({ i, label }: { i: number; label: string }) => {
    const isDone = done[i],
      isNext = i === nextIndex;
    const c = isDone ? T.primary : isNext ? T.accent : T.muted;
    return (
      <div className="flex items-center justify-between mb-2.5">
        <span
          style={{
            fontFamily: T.mono,
            fontSize: 10,
            letterSpacing: "0.14em",
            color: T.muted,
          }}
        >
          0{i + 1}
        </span>
        <span
          style={{
            fontFamily: T.mono,
            fontSize: 9,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: c,
          }}
        >
          {isDone ? `✓ ${label}` : isNext ? "● Next step" : "○ Pending"}
        </span>
      </div>
    );
  };

  return (
    <div className="max-w-3xl">
      <Link
        href="/admin/clients"
        style={{
          fontFamily: T.mono,
          fontSize: "10px",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: T.muted,
        }}
      >
        ← Clients
      </Link>
      <div className="mt-3 mb-8 flex items-end justify-between gap-4">
        <div>
          <h1
            style={{
              fontFamily: T.display,
              fontWeight: 600,
              fontSize: "2.2rem",
              color: T.fg,
            }}
          >
            {client?.name}
          </h1>
          <p style={{ fontFamily: T.sans, fontSize: "0.9rem", color: T.muted }}>
            {client?.business_name} · {client?.email}
          </p>
          {proposal && (
            <button
              onClick={() => {
                navigator.clipboard?.writeText(proposalRef(proposal.id)).catch(() => {});
                setCopiedRef(true);
                setTimeout(() => setCopiedRef(false), 1500);
              }}
              title="Click to copy for invoicing"
              className="mt-2 inline-flex items-center gap-2 px-2.5 h-7 transition-colors hover:bg-[#1f1f23]"
              style={{
                fontFamily: T.mono,
                fontSize: "11px",
                letterSpacing: "0.06em",
                color: copiedRef ? T.primary : T.fg,
                border: `1px solid ${T.border}`,
                borderRadius: T.r.sm,
              }}
            >
              <span style={{ color: T.muted }}>REF</span>
              <span>{proposalRef(proposal.id)}</span>
              <span style={{ color: T.muted, fontSize: "10px" }}>
                {copiedRef ? "✓ copied" : "⧉"}
              </span>
            </button>
          )}
        </div>
        {proposal && (
          <button
            onClick={saveProposalDoc}
            disabled={saving}
            className="px-5 h-11 transition-opacity hover:opacity-90 disabled:opacity-50 shrink-0"
            style={{
              fontFamily: T.mono,
              fontSize: "0.75rem",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              background: T.primary,
              color: T.primaryFg,
              borderRadius: T.r.sm,
            }}
          >
            {saving ? "Saving…" : saved ? "Saved ✓" : "Save proposal"}
          </button>
        )}
      </div>

      {/* Project phase selector */}
      <div className="mb-6 flex items-center gap-3 flex-wrap">
        <span
          style={{
            fontFamily: T.mono,
            fontSize: "10px",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: T.muted,
          }}
        >
          Project phase:
        </span>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[
            { value: "", label: "Not started" },
            { value: "discovery", label: "Discovery" },
            { value: "design", label: "Design" },
            { value: "development", label: "Development" },
            { value: "review", label: "Review" },
            { value: "live", label: "Live" },
          ].map(({ value, label }) => {
            const active = (client?.project_phase ?? "") === value;
            return (
              <button
                key={value}
                onClick={() => savePhase(value)}
                style={{
                  fontFamily: T.mono,
                  fontSize: "10px",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  padding: "4px 10px",
                  borderRadius: T.r.full,
                  cursor: "pointer",
                  border: `1px solid ${active ? T.primary : T.border}`,
                  background: active ? `${T.primary}20` : "transparent",
                  color: active ? T.primary : T.muted,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Acceptance banner */}
      {accepted && (
        <div
          className="mb-6 p-4 rounded-lg"
          style={{ background: `${T.primary}14`, border: `1px solid ${T.primary}` }}
        >
          <div className="flex items-center gap-3">
            <span
              style={{ width: 8, height: 8, borderRadius: "50%", background: T.primary }}
            />
            <span
              style={{
                fontFamily: T.mono,
                fontSize: 11,
                letterSpacing: "0.06em",
                color: T.fg,
              }}
            >
              PROPOSAL ACCEPTED by {proposal?.accepted_name} on{" "}
              {new Date(proposal!.accepted_at!).toLocaleString("en-GB", {
                timeZone: "Europe/London",
              })}
            </span>
          </div>
          <a
            href={proposalUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 mt-2 ml-5 transition-opacity hover:opacity-80"
            style={{
              fontFamily: T.mono,
              fontSize: 11,
              letterSpacing: "0.04em",
              color: T.primary,
            }}
          >
            View signed proposal ↗
          </a>
        </div>
      )}

      {/* ── Workflow ───────────────────────────────────────── */}
      <div
        style={{
          fontFamily: T.mono,
          fontSize: "10px",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: T.primary,
          marginBottom: "12px",
        }}
      >
        // WORKFLOW
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {/* 01 — Book Call */}
        <div
          style={{
            background: T.surface,
            borderRadius: 14,
            padding: 18,
            opacity: 1,
            transition: "box-shadow .25s, border-color .25s",
            ...(callComplete
              ? {
                  border: `1px solid ${T.primary}`,
                  boxShadow: `0 0 0 1px ${T.primary}, 0 0 28px -4px ${T.primary}`,
                }
              : {
                  border: `1px solid ${T.accent}`,
                  boxShadow: `0 0 0 1px ${T.accent}, 0 0 26px -6px ${T.accent}`,
                }),
          }}
        >
          <StepHead i={0} label="Booked" />
          {call ? (
            <div className="flex flex-col gap-1">
              <span
                style={{
                  fontFamily: T.display,
                  fontWeight: 600,
                  fontSize: "1.05rem",
                  color: T.fg,
                }}
              >
                Call confirmed
              </span>
              <span style={{ fontFamily: T.sans, fontSize: "0.82rem", color: T.muted }}>
                {formatCallDate(call.call_date)}
              </span>
              <span style={{ fontFamily: T.mono, fontSize: "0.74rem", color: T.primary }}>
                {formatCallTime(call.call_time)} · {call.duration_min} min
              </span>

              {/* Meeting set-up status */}
              <div
                className="mt-2 pt-2 flex items-center justify-between"
                style={{ borderTop: `1px solid ${T.border}` }}
              >
                <div>
                  <span
                    style={{
                      fontFamily: T.mono,
                      fontSize: 9,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: T.muted,
                    }}
                  >
                    Meeting set up
                  </span>
                  <div
                    style={{
                      fontFamily: T.mono,
                      fontSize: "0.74rem",
                      marginTop: 2,
                      color: call.meeting_link ? T.primary : T.accent,
                    }}
                  >
                    {call.meeting_link ? "● Yes" : "○ No"}
                  </div>
                </div>
                <button
                  onClick={() => setMeetingOpen((v) => !v)}
                  style={{
                    fontFamily: T.mono,
                    fontSize: "9px",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: T.muted,
                    border: `1px solid ${T.border}`,
                    padding: "3px 8px",
                    borderRadius: 3,
                  }}
                >
                  {call.meeting_link ? "Edit" : "Add"}
                </button>
              </div>

              {call.meeting_link && (
                <a
                  href={call.meeting_link}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1.5 transition-opacity hover:opacity-80"
                  style={{
                    fontFamily: T.mono,
                    fontSize: "0.72rem",
                    color: T.primary,
                    letterSpacing: "0.04em",
                  }}
                >
                  Join meeting ↗
                </a>
              )}

              <button
                onClick={cancelBooking}
                className="self-start mt-2"
                style={{
                  fontFamily: T.mono,
                  fontSize: "9px",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: T.danger,
                }}
              >
                Cancel booking
              </button>
            </div>
          ) : (
            <button onClick={() => setBooking((v) => !v)} className="text-left w-full">
              <div
                style={{
                  fontFamily: T.display,
                  fontWeight: 600,
                  fontSize: "1.05rem",
                  color: T.fg,
                }}
              >
                Book Call
              </div>
              <div
                style={{
                  fontFamily: T.sans,
                  fontSize: "0.8rem",
                  color: T.muted,
                  marginTop: 4,
                }}
              >
                Schedule a discovery call (London time).
              </div>
              {requestedHint && (
                <div className="mt-2 pt-2" style={{ borderTop: `1px solid ${T.border}` }}>
                  <span
                    style={{
                      fontFamily: T.mono,
                      fontSize: 9,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: T.muted,
                    }}
                  >
                    Client requested
                  </span>
                  <div
                    style={{
                      fontFamily: T.sans,
                      fontSize: "0.82rem",
                      color: T.accent,
                      marginTop: 2,
                    }}
                  >
                    {requestedHint}
                  </div>
                </div>
              )}
            </button>
          )}
        </div>

        {/* 02 — Brief collection */}
        <div style={stepCardStyle(1)}>
          <StepHead i={1} label={brief ? "Complete" : "Pending"} />
          <button
            onClick={() =>
              brief ? setBriefViewerOpen((v) => !v) : setBriefOpen((v) => !v)
            }
            className="text-left w-full"
          >
            <div
              style={{
                fontFamily: T.display,
                fontWeight: 600,
                fontSize: "1.05rem",
                color: T.fg,
              }}
            >
              {brief ? "Brief received ✓" : "Send Brief Collection"}
            </div>
            <div
              style={{
                fontFamily: T.sans,
                fontSize: "0.8rem",
                color: T.muted,
                marginTop: 4,
              }}
            >
              {brief
                ? "View the full brief the client submitted."
                : "Share the 5-step intake form link."}
            </div>
            {/* Brief status indicator */}
            <div className="mt-2 pt-2" style={{ borderTop: `1px solid ${T.border}` }}>
              <span
                style={{
                  fontFamily: T.mono,
                  fontSize: 9,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: T.muted,
                }}
              >
                Brief status
              </span>
              <div
                style={{
                  fontFamily: T.mono,
                  fontSize: "0.74rem",
                  marginTop: 2,
                  color: brief
                    ? T.primary
                    : client?.brief_completed_at
                      ? T.primary
                      : T.accent,
                }}
              >
                {brief ? "● Submitted" : "○ Not submitted"}
              </div>
              {client?.brief_completed_at && (
                <div
                  style={{
                    fontFamily: T.sans,
                    fontSize: "0.78rem",
                    color: T.muted,
                    marginTop: 2,
                  }}
                >
                  {new Date(client.brief_completed_at).toLocaleDateString("en-GB")}
                </div>
              )}
            </div>
          </button>
        </div>

        {/* 03 — Draft Proposal */}
        <div style={stepCardStyle(2)}>
          <StepHead i={2} label="Drafted" />
          <button onClick={draftProposal} className="text-left w-full">
            <div
              style={{
                fontFamily: T.display,
                fontWeight: 600,
                fontSize: "1.05rem",
                color: T.fg,
              }}
            >
              Draft Proposal
            </div>
            <div
              style={{
                fontFamily: T.sans,
                fontSize: "0.8rem",
                color: T.muted,
                marginTop: 4,
              }}
            >
              {proposal
                ? "Quote created. Fill in the proposal below."
                : "Pre-fill a proposal with this client's details."}
            </div>
          </button>
        </div>

        {/* 04 — Send Documents */}
        <div style={stepCardStyle(3, !proposal)}>
          <StepHead i={3} label="Accepted" />
          <button
            onClick={() => setDocsOpen((v) => !v)}
            className="text-left w-full"
            disabled={!proposal}
            style={{ cursor: proposal ? "pointer" : "not-allowed" }}
          >
            <div
              style={{
                fontFamily: T.display,
                fontWeight: 600,
                fontSize: "1.05rem",
                color: T.fg,
              }}
            >
              Send Documents
            </div>
            <div
              style={{
                fontFamily: T.sans,
                fontSize: "0.8rem",
                color: T.muted,
                marginTop: 4,
              }}
            >
              {accepted
                ? "Accepted by the client."
                : proposal
                  ? "Share the proposal link for signature."
                  : "Draft a proposal first."}
            </div>
          </button>
        </div>
      </div>

      {/* Booking panel */}
      {booking && !call && (
        <div
          className="mb-4"
          style={{
            background: T.surface,
            border: `1px solid ${T.primary}`,
            borderRadius: 14,
            padding: 24,
          }}
        >
          {requestedHint && (
            <div
              className="mb-5"
              style={{ fontFamily: T.sans, fontSize: "0.82rem", color: T.muted }}
            >
              <span
                style={{
                  fontFamily: T.mono,
                  fontSize: 9,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: T.muted,
                }}
              >
                Client requested:{" "}
              </span>
              <span style={{ color: T.accent }}>{requestedHint}</span>
              <span style={{ color: T.muted }}>
                {" "}
                — prefilled below, adjust as needed.
              </span>
            </div>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label style={labelS}>Date</label>
              <input
                type="date"
                value={bookDate}
                onChange={(e) => setBookDate(e.target.value)}
                style={{ ...input, colorScheme: "dark", width: "auto" }}
              />
            </div>
            <div>
              <label style={labelS}>Time (London)</label>
              <input
                type="time"
                value={bookTime}
                onChange={(e) => setBookTime(e.target.value)}
                style={{ ...input, colorScheme: "dark", width: "auto" }}
              />
            </div>
            <button
              onClick={confirmBooking}
              disabled={!bookDate || bookingBusy}
              className="inline-flex items-center justify-center gap-2.5 px-14 h-12 transition-all duration-200 disabled:opacity-40 disabled:shadow-none"
              style={{
                fontFamily: T.mono,
                fontSize: "0.74rem",
                textTransform: "uppercase",
                fontWeight: 600,
                background: T.primary,
                color: T.primaryFg,
                borderRadius: "8px",
                boxShadow: `0 0 28px -6px ${T.primary}, 0 0 0 1px ${T.primary}`,
              }}
            >
              <span style={{ letterSpacing: "0.1em" }}>
                {bookingBusy ? "Confirming…" : "Confirm booking"}
              </span>
              {!bookingBusy && (
                <span aria-hidden style={{ fontSize: "1rem" }}>
                  →
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Meeting details panel */}
      {meetingOpen && call && (
        <div
          className="mb-4 p-6 rounded-lg"
          style={{ background: T.surface, border: `1px solid ${T.accent}` }}
        >
          <div
            style={{
              fontFamily: T.mono,
              fontSize: 10,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: T.muted,
              marginBottom: 10,
            }}
          >
            Zoom / meeting details
          </div>
          <p
            style={{
              fontFamily: T.sans,
              fontSize: "0.85rem",
              color: T.muted,
              marginBottom: 14,
              lineHeight: 1.6,
            }}
          >
            Add the meeting link and ID so you can join directly from this page.
          </p>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                placeholder="Meeting link (e.g. https://zoom.us/j/…)"
                value={meetingLink}
                onChange={(e) => setMeetingLink(e.target.value)}
                style={{
                  ...input,
                  flex: "1 1 320px",
                  fontFamily: T.mono,
                  fontSize: "0.78rem",
                }}
              />
              {meetingLink && (
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(meetingLink).catch(() => {});
                    setMeetingCopied(true);
                    setTimeout(() => setMeetingCopied(false), 1500);
                  }}
                  className="px-4 h-10 transition-opacity hover:opacity-90"
                  style={{
                    fontFamily: T.mono,
                    fontSize: "0.72rem",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: T.fg,
                    border: `1px solid ${T.border}`,
                    borderRadius: T.r.sm,
                  }}
                >
                  {meetingCopied ? "Copied ✓" : "Copy"}
                </button>
              )}
            </div>
            <input
              placeholder="Meeting ID (optional, e.g. 123 456 7890)"
              value={meetingId}
              onChange={(e) => setMeetingId(e.target.value)}
              style={{ ...input, fontFamily: T.mono, fontSize: "0.78rem" }}
            />
            <input
              placeholder="Meeting password (optional)"
              value={meetingPassword}
              onChange={(e) => setMeetingPassword(e.target.value)}
              style={{ ...input, fontFamily: T.mono, fontSize: "0.78rem" }}
            />
            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={saveMeeting}
                disabled={meetingSaving}
                className="px-5 h-10 transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{
                  fontFamily: T.mono,
                  fontSize: "0.72rem",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  background: T.accent,
                  color: T.primaryFg,
                  borderRadius: T.r.sm,
                }}
              >
                {meetingSaving ? "Saving…" : "Save meeting details"}
              </button>
              <button
                onClick={() => setMeetingOpen(false)}
                className="px-5 h-10 transition-opacity hover:opacity-90"
                style={{
                  fontFamily: T.mono,
                  fontSize: "0.72rem",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: T.muted,
                  border: `1px solid ${T.border}`,
                  borderRadius: T.r.sm,
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Brief Collection panel */}
      {briefOpen &&
        !brief &&
        (() => {
          const briefUrl =
            typeof window !== "undefined"
              ? `${window.location.origin}/brief?client=${id}`
              : "";
          return (
            <div
              className="mb-4 p-6 rounded-lg"
              style={{ background: T.surface, border: `1px solid ${T.primary}` }}
            >
              <div
                style={{
                  fontFamily: T.mono,
                  fontSize: 10,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: T.muted,
                  marginBottom: 10,
                }}
              >
                Brief intake link
              </div>
              <p
                style={{
                  fontFamily: T.sans,
                  fontSize: "0.85rem",
                  color: T.muted,
                  marginBottom: 14,
                  lineHeight: 1.6,
                }}
              >
                Send this link to {client?.name}. They&apos;ll fill in a 5-step brief
                (pages, style, budget, timeline). The submission will appear here
                automatically.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  readOnly
                  value={briefUrl}
                  style={{
                    ...input,
                    flex: "1 1 320px",
                    fontFamily: T.mono,
                    fontSize: "0.78rem",
                  }}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(briefUrl).catch(() => {});
                    setBriefLinkCopied(true);
                    setTimeout(() => setBriefLinkCopied(false), 1500);
                  }}
                  className="px-5 h-10 transition-opacity hover:opacity-90"
                  style={{
                    fontFamily: T.mono,
                    fontSize: "0.72rem",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    background: T.primary,
                    color: T.primaryFg,
                    borderRadius: T.r.sm,
                  }}
                >
                  {briefLinkCopied ? "Copied ✓" : "Copy link"}
                </button>
                <a
                  href={briefUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-5 h-10 inline-flex items-center transition-opacity hover:opacity-90"
                  style={{
                    fontFamily: T.mono,
                    fontSize: "0.72rem",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: T.fg,
                    border: `1px solid ${T.border}`,
                    borderRadius: T.r.sm,
                  }}
                >
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
        <div
          className="mb-4 p-6 rounded-lg"
          style={{ background: T.surface, border: `1px solid ${T.primary}` }}
        >
          <div
            style={{
              fontFamily: T.mono,
              fontSize: 10,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: T.muted,
              marginBottom: 10,
            }}
          >
            Proposal link
          </div>
          <p
            style={{
              fontFamily: T.sans,
              fontSize: "0.85rem",
              color: T.muted,
              marginBottom: 14,
              lineHeight: 1.6,
            }}
          >
            Send this link to {client?.name}. They can review the full proposal and sign
            &amp; accept it at the bottom. You&apos;ll see their acceptance here.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              readOnly
              value={proposalUrl}
              style={{
                ...input,
                flex: "1 1 320px",
                fontFamily: T.mono,
                fontSize: "0.78rem",
              }}
              onFocus={(e) => e.currentTarget.select()}
            />
            <button
              onClick={() => {
                navigator.clipboard?.writeText(proposalUrl).catch(() => {});
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="px-5 h-10 transition-opacity hover:opacity-90"
              style={{
                fontFamily: T.mono,
                fontSize: "0.72rem",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                background: T.primary,
                color: T.primaryFg,
                borderRadius: T.r.sm,
              }}
            >
              {copied ? "Copied ✓" : "Copy link"}
            </button>
            <a
              href={proposalUrl}
              target="_blank"
              rel="noreferrer"
              className="px-5 h-10 inline-flex items-center transition-opacity hover:opacity-90"
              style={{
                fontFamily: T.mono,
                fontSize: "0.72rem",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: T.fg,
                border: `1px solid ${T.border}`,
                borderRadius: T.r.sm,
              }}
            >
              Open ↗
            </a>
          </div>
          <div
            className="mt-4 pt-4"
            style={{
              borderTop: `1px solid ${T.border}`,
              fontFamily: T.mono,
              fontSize: 11,
              color: accepted ? T.primary : T.muted,
            }}
          >
            {accepted
              ? `✓ Accepted by ${proposal.accepted_name} — ${new Date(proposal.accepted_at!).toLocaleString("en-GB", { timeZone: "Europe/London" })}`
              : "○ Awaiting client signature"}
          </div>
        </div>
      )}

      {/* ── Proposal builder ───────────────────────────────── */}
      <div
        className="mt-8 mb-4"
        style={{
          fontFamily: T.mono,
          fontSize: "10px",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: T.primary,
        }}
      >
        // PROPOSAL
      </div>

      {!proposal ? (
        <div
          className="p-8 rounded-lg text-center"
          style={{ background: T.surface, border: `1px dashed ${T.border}` }}
        >
          <div
            style={{
              fontFamily: T.display,
              fontWeight: 600,
              fontSize: "1.1rem",
              color: T.fg,
              marginBottom: 8,
            }}
          >
            No proposal yet
          </div>
          <p
            style={{
              fontFamily: T.sans,
              fontSize: "0.88rem",
              color: T.muted,
              marginBottom: 16,
            }}
          >
            Create the quote first, then fill in the proposal details here.
          </p>
          <button
            onClick={draftProposal}
            className="px-6 h-11 transition-opacity hover:opacity-90"
            style={{
              fontFamily: T.mono,
              fontSize: "0.75rem",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              background: T.primary,
              color: T.primaryFg,
              borderRadius: T.r.sm,
            }}
          >
            Draft proposal →
          </button>
        </div>
      ) : (
        <>
          <Card title="Project overview">
            <div className="grid gap-4">
              <div>
                <label style={labelS}>Project name</label>
                <input
                  style={input}
                  value={proposal.project_name ?? ""}
                  onChange={(e) => setDoc("project_name", e.target.value)}
                  placeholder="e.g. Website Build"
                />
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <label style={labelS}>Duration</label>
                  <input
                    style={input}
                    value={proposal.duration ?? ""}
                    onChange={(e) => setDoc("duration", e.target.value)}
                    placeholder="e.g. 12 weeks"
                  />
                </div>
                <div>
                  <label style={labelS}>Platform</label>
                  <input
                    style={input}
                    value={proposal.platform ?? ""}
                    onChange={(e) => setDoc("platform", e.target.value)}
                    placeholder="e.g. Web + Mobile"
                  />
                </div>
                <div>
                  <label style={labelS}>Team size</label>
                  <input
                    style={input}
                    value={proposal.team_size ?? ""}
                    onChange={(e) => setDoc("team_size", e.target.value)}
                    placeholder="e.g. 4 specialists"
                  />
                </div>
              </div>
              <div>
                <label style={labelS}>Overview</label>
                <textarea
                  rows={3}
                  style={{ ...input, resize: "vertical" }}
                  value={proposal.overview ?? ""}
                  onChange={(e) => setDoc("overview", e.target.value)}
                  placeholder="Short summary of the project and approach."
                />
              </div>
            </div>
          </Card>

          <Card title="Scope of work — 4 phases">
            <div className="flex flex-col gap-5">
              {proposal.scope.map((ph, pi) => (
                <div key={pi}>
                  <div className="flex items-center gap-2 mb-2">
                    <span style={{ fontFamily: T.mono, fontSize: 10, color: T.primary }}>
                      Phase {pi + 1}
                    </span>
                    <input
                      style={{ ...input, padding: "6px 10px" }}
                      value={ph.phase}
                      onChange={(e) => {
                        const s = [...proposal.scope];
                        s[pi] = { ...ph, phase: e.target.value };
                        setDoc("scope", s);
                      }}
                      placeholder="Phase name"
                    />
                  </div>
                  <div
                    className="flex flex-col gap-2 pl-3"
                    style={{ borderLeft: `1px solid ${T.border}` }}
                  >
                    {ph.items.map((it, ii) => (
                      <div key={ii} className="flex items-center gap-2">
                        <input
                          style={{ ...input, padding: "8px 10px" }}
                          value={it}
                          onChange={(e) => {
                            const s = [...proposal.scope];
                            const items = [...ph.items];
                            items[ii] = e.target.value;
                            s[pi] = { ...ph, items };
                            setDoc("scope", s);
                          }}
                          placeholder="Scope item"
                        />
                        <button
                          onClick={() => {
                            const s = [...proposal.scope];
                            s[pi] = { ...ph, items: ph.items.filter((_, j) => j !== ii) };
                            setDoc("scope", s);
                          }}
                          style={{ color: T.danger, fontFamily: T.mono, fontSize: 16 }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => {
                        const s = [...proposal.scope];
                        s[pi] = { ...ph, items: [...ph.items, ""] };
                        setDoc("scope", s);
                      }}
                      className="self-start"
                      style={{
                        fontFamily: T.mono,
                        fontSize: 10,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: T.primary,
                      }}
                    >
                      + Add item
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Deliverables">
            <div className="flex flex-col gap-2">
              {proposal.deliverables.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    style={input}
                    value={d}
                    onChange={(e) => {
                      const a = [...proposal.deliverables];
                      a[i] = e.target.value;
                      setDoc("deliverables", a);
                    }}
                    placeholder="Deliverable"
                  />
                  <button
                    onClick={() =>
                      setDoc(
                        "deliverables",
                        proposal.deliverables.filter((_, j) => j !== i)
                      )
                    }
                    style={{ color: T.danger, fontFamily: T.mono, fontSize: 16 }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => setDoc("deliverables", [...proposal.deliverables, ""])}
              className="mt-3"
              style={{
                fontFamily: T.mono,
                fontSize: 10,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: T.primary,
              }}
            >
              + Add deliverable
            </button>
          </Card>

          <Card title="Timeline">
            <div className="flex flex-col gap-3">
              {proposal.timeline.map((w, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[110px_1fr_auto] gap-2 items-start"
                >
                  <input
                    style={{ ...input, padding: "8px 10px" }}
                    value={w.week}
                    onChange={(e) => {
                      const a = [...proposal.timeline];
                      a[i] = { ...w, week: e.target.value };
                      setDoc("timeline", a);
                    }}
                    placeholder="Week 1"
                  />
                  <div className="flex flex-col gap-2">
                    <input
                      style={{ ...input, padding: "8px 10px" }}
                      value={w.title}
                      onChange={(e) => {
                        const a = [...proposal.timeline];
                        a[i] = { ...w, title: e.target.value };
                        setDoc("timeline", a);
                      }}
                      placeholder="Milestone / title"
                    />
                    <textarea
                      rows={2}
                      style={{ ...input, padding: "8px 10px", resize: "vertical" }}
                      value={w.description}
                      onChange={(e) => {
                        const a = [...proposal.timeline];
                        a[i] = { ...w, description: e.target.value };
                        setDoc("timeline", a);
                      }}
                      placeholder="What will happen this week"
                    />
                  </div>
                  <button
                    onClick={() =>
                      setDoc(
                        "timeline",
                        proposal.timeline.filter((_, j) => j !== i)
                      )
                    }
                    style={{ color: T.danger, fontFamily: T.mono, fontSize: 16 }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() =>
                setDoc("timeline", [
                  ...proposal.timeline,
                  {
                    week: `Week ${proposal.timeline.length + 1}`,
                    title: "",
                    description: "",
                  },
                ])
              }
              className="mt-3"
              style={{
                fontFamily: T.mono,
                fontSize: 10,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: T.primary,
              }}
            >
              + Add week
            </button>
          </Card>

          <Card title="Payment terms">
            <textarea
              rows={4}
              style={{ ...input, resize: "vertical" }}
              value={proposal.payment_terms ?? ""}
              onChange={(e) => setDoc("payment_terms", e.target.value || null)}
              placeholder={
                "e.g. 50% deposit on acceptance, 50% on launch.\nAll payments due within 14 days of invoice."
              }
            />
          </Card>

          <Card title="Data Processing Agreement">
            <p
              style={{
                fontFamily: T.sans,
                fontSize: "0.85rem",
                color: T.muted,
                lineHeight: 1.6,
                maxWidth: "62ch",
                marginBottom: 16,
              }}
            >
              A DPA is generated from these fields and signed as part of this proposal —
              the client signs once. Effective on acceptance; the five sub-processors
              below are included in every case.
            </p>

            <div className="flex items-center gap-3 mb-5">
              <span style={{ ...labelS, marginBottom: 0 }}>
                Attach DPA to this proposal
              </span>
              <Seg
                value={proposal.dpa_enabled ?? true}
                onChange={(v) => setDoc("dpa_enabled", v)}
              />
            </div>

            {(proposal.dpa_enabled ?? true) && (
              <div className="flex flex-col gap-3">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label style={labelS}>Client legal name (auto)</label>
                    <input
                      readOnly
                      value={client?.business_name || client?.name || ""}
                      style={{ ...input, opacity: 0.65 }}
                    />
                  </div>
                  <div>
                    <label style={labelS}>Country of registration</label>
                    <input
                      style={input}
                      value={proposal.dpa_client_country ?? "United Kingdom"}
                      onChange={(e) => setDoc("dpa_client_country", e.target.value)}
                      placeholder="United Kingdom"
                    />
                  </div>
                  <div>
                    <label style={labelS}>Client company number</label>
                    <input
                      style={input}
                      value={proposal.dpa_client_company_number ?? ""}
                      onChange={(e) =>
                        setDoc("dpa_client_company_number", e.target.value)
                      }
                      placeholder="e.g. 12345678"
                    />
                  </div>
                  <div>
                    <label style={labelS}>Client registered address</label>
                    <textarea
                      rows={2}
                      style={{ ...input, resize: "vertical" }}
                      value={proposal.dpa_client_registered_address ?? ""}
                      onChange={(e) =>
                        setDoc("dpa_client_registered_address", e.target.value)
                      }
                      placeholder="Registered office address"
                    />
                  </div>
                </div>

                <div>
                  <label style={labelS}>Types of personal data processed (Annex 1)</label>
                  <textarea
                    rows={3}
                    style={{ ...input, resize: "vertical" }}
                    value={proposal.dpa_personal_data ?? ""}
                    onChange={(e) => setDoc("dpa_personal_data", e.target.value)}
                    placeholder="e.g. names, email addresses, phone numbers, booking/order details, IP addresses…"
                  />
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <span style={{ ...labelS, marginBottom: 0 }}>
                    Special category data? (e.g. health / wellness — needs extra
                    safeguards)
                  </span>
                  <Seg
                    value={!!proposal.dpa_special_category}
                    onChange={(v) => setDoc("dpa_special_category", v)}
                    yes="Yes"
                    no="No"
                  />
                </div>

                {proposal.dpa_special_category && (
                  <div>
                    <label style={labelS}>Which data, and what category?</label>
                    <textarea
                      rows={2}
                      style={{ ...input, resize: "vertical" }}
                      value={proposal.dpa_special_category_detail ?? ""}
                      onChange={(e) =>
                        setDoc("dpa_special_category_detail", e.target.value)
                      }
                      placeholder="e.g. Health information (special category under UK GDPR Art. 9) — client intake notes for a wellness clinic."
                    />
                  </div>
                )}

                <div
                  className="mt-1 p-3 rounded"
                  style={{ background: T.bg, border: `1px solid ${T.border}` }}
                >
                  <div style={{ ...labelS, marginBottom: 8 }}>
                    Authorised sub-processors — included in all cases
                  </div>
                  <ul
                    style={{
                      margin: 0,
                      padding: 0,
                      listStyle: "none",
                      display: "flex",
                      flexDirection: "column",
                      gap: 5,
                    }}
                  >
                    {SUB_PROCESSORS.map((s) => (
                      <li
                        key={s.name}
                        style={{
                          fontFamily: T.sans,
                          fontSize: "0.82rem",
                          color: T.muted,
                        }}
                      >
                        <span style={{ color: T.primary }}>•</span> {s.name}{" "}
                        <span style={{ color: `${T.muted}99` }}>— {s.service}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex items-center justify-between flex-wrap gap-3 mt-1">
                  {!(
                    proposal.dpa_client_company_number &&
                    proposal.dpa_client_registered_address &&
                    proposal.dpa_personal_data
                  ) ? (
                    <span
                      style={{
                        fontFamily: T.mono,
                        fontSize: 10,
                        letterSpacing: "0.04em",
                        color: T.warning,
                      }}
                    >
                      ⚠ Add company number, registered address &amp; personal-data types
                      before sending.
                    </span>
                  ) : (
                    <span
                      style={{
                        fontFamily: T.mono,
                        fontSize: 10,
                        letterSpacing: "0.04em",
                        color: T.primary,
                      }}
                    >
                      ✓ DPA ready
                    </span>
                  )}
                  <a
                    href={`/proposal/${proposal.id}/dpa`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      fontFamily: T.mono,
                      fontSize: 10,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: T.primary,
                    }}
                  >
                    Preview DPA ↗
                  </a>
                </div>
              </div>
            )}
          </Card>

          <Card title="Investment — pulled from the quote">
            <div className="flex flex-col gap-2">
              {(() => {
                const lineItems = proposal.line_items ?? [];
                const regularItems = lineItems.filter((li) => (li.unit_price || 0) >= 0);
                const discountItem = lineItems.find((li) => (li.unit_price || 0) < 0);
                const subtotal = regularItems.reduce(
                  (s, li) => s + (li.qty || 0) * (li.unit_price || 0),
                  0
                );
                const discountPct = discountItem ? Math.abs(discountItem.unit_price) : 0;
                const discountAmount = subtotal * (discountPct / 100);
                return (
                  <>
                    {regularItems.length ? (
                      regularItems.map((li, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between py-2"
                          style={{ borderBottom: `1px solid ${T.border}` }}
                        >
                          <span
                            style={{
                              fontFamily: T.sans,
                              fontSize: "0.88rem",
                              color: T.fg,
                            }}
                          >
                            {li.label}
                          </span>
                          <span
                            style={{
                              fontFamily: T.mono,
                              fontSize: "0.85rem",
                              color: T.muted,
                            }}
                          >
                            {money(
                              (li.qty || 0) * (li.unit_price || 0),
                              proposal.currency
                            )}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p
                        style={{
                          fontFamily: T.sans,
                          fontSize: "0.85rem",
                          color: T.muted,
                        }}
                      >
                        No line items on the quote yet — add them in the Quotes tab.
                      </p>
                    )}
                    {discountItem && (
                      <>
                        <div
                          className="flex items-center justify-between py-2 mt-1"
                          style={{ borderBottom: `1px solid ${T.border}` }}
                        >
                          <span
                            style={{
                              fontFamily: T.mono,
                              fontSize: "0.85rem",
                              color: T.muted,
                            }}
                          >
                            Subtotal
                          </span>
                          <span
                            style={{
                              fontFamily: T.mono,
                              fontSize: "0.85rem",
                              color: T.muted,
                            }}
                          >
                            {money(subtotal, proposal.currency)}
                          </span>
                        </div>
                        <div
                          className="flex items-center justify-between py-2"
                          style={{ borderBottom: `1px solid ${T.border}` }}
                        >
                          <span
                            style={{
                              fontFamily: T.sans,
                              fontSize: "0.88rem",
                              color: T.accent,
                            }}
                          >
                            {discountItem.label || "Discount"}{" "}
                            <span style={{ fontFamily: T.mono, fontSize: "0.78rem" }}>
                              (−{discountPct}%)
                            </span>
                          </span>
                          <span
                            style={{
                              fontFamily: T.mono,
                              fontSize: "0.85rem",
                              color: T.accent,
                            }}
                          >
                            −{money(discountAmount, proposal.currency)}
                          </span>
                        </div>
                      </>
                    )}
                    <div className="flex items-center justify-between pt-3 mt-1">
                      <span
                        style={{
                          fontFamily: T.display,
                          fontWeight: 600,
                          fontSize: "1.2rem",
                          color: T.fg,
                        }}
                      >
                        TOTAL
                      </span>
                      <span
                        style={{
                          fontFamily: T.display,
                          fontWeight: 600,
                          fontSize: "1.4rem",
                          color: T.primary,
                        }}
                      >
                        {money(proposal.total || 0, proposal.currency)}
                      </span>
                    </div>
                  </>
                );
              })()}
              <Link
                href={`/admin/quotes?client=${id}`}
                style={{
                  fontFamily: T.mono,
                  fontSize: 10,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: T.muted,
                  marginTop: 6,
                }}
              >
                Edit quote in Quotes →
              </Link>
            </div>
          </Card>
        </>
      )}

      {/* ── Project Updates ──────────────────────────────── */}
      <div className="mt-10 mb-4">
        <ProjectUpdatesSection clientId={id} clientName={client?.name ?? "this client"} />
      </div>

      {/* ── Portal Account ───────────────────────────────── */}
      <div
        className="mt-10 mb-4"
        style={{
          fontFamily: T.mono,
          fontSize: "10px",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: T.primary,
        }}
      >
        // PORTAL ACCESS
      </div>
      <div
        className="p-5 rounded-lg mb-4"
        style={{
          background: T.surface,
          border: `1px solid ${client?.auth_user_id ? T.primary : T.border}`,
        }}
      >
        {client?.auth_user_id ? (
          <div className="flex items-start gap-3">
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: T.primary,
                marginTop: 4,
                flexShrink: 0,
              }}
            />
            <div>
              <div
                style={{
                  fontFamily: T.display,
                  fontWeight: 600,
                  fontSize: "1rem",
                  color: T.fg,
                }}
              >
                Portal account active
              </div>
              <div
                style={{
                  fontFamily: T.sans,
                  fontSize: "0.82rem",
                  color: T.muted,
                  marginTop: 2,
                }}
              >
                {client.name} can log in to the client portal with{" "}
                <span style={{ color: T.fg }}>{client.email}</span>.
              </div>
              <div
                style={{
                  fontFamily: T.mono,
                  fontSize: "10px",
                  letterSpacing: "0.08em",
                  color: T.muted,
                  marginTop: 8,
                }}
              >
                USER ID: {client.auth_user_id}
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div
              style={{
                fontFamily: T.display,
                fontWeight: 600,
                fontSize: "1rem",
                color: T.fg,
                marginBottom: 4,
              }}
            >
              Create portal account
            </div>
            <div
              style={{
                fontFamily: T.sans,
                fontSize: "0.82rem",
                color: T.muted,
                marginBottom: 16,
                lineHeight: 1.6,
              }}
            >
              Set up a login for <span style={{ color: T.fg }}>{client?.name}</span> so
              they can access the client portal. Their email (
              <span style={{ color: T.fg }}>{client?.email ?? "no email on record"}</span>
              ) will be used as the username. All existing proposal and call data will
              remain associated.
            </div>
            {!client?.email && (
              <div
                className="mb-4 px-4 py-3 rounded"
                style={{
                  background: `${T.danger}18`,
                  border: `1px solid ${T.danger}40`,
                  fontFamily: T.sans,
                  fontSize: "0.82rem",
                  color: T.danger,
                }}
              >
                No email address on this client record — add one above before creating an
                account.
              </div>
            )}
            {portalSuccess ? (
              <div
                className="px-4 py-3 rounded flex items-center gap-2"
                style={{
                  background: `${T.primary}14`,
                  border: `1px solid ${T.primary}`,
                  fontFamily: T.mono,
                  fontSize: "0.78rem",
                  color: T.primary,
                }}
              >
                ✓ Account created — {client?.name} can now log in with their email.
              </div>
            ) : (
              <div className="flex flex-wrap items-end gap-3">
                <div style={{ flex: "1 1 240px" }}>
                  <label style={labelS}>Password for {client?.name}</label>
                  <input
                    type="password"
                    placeholder="Min. 8 characters"
                    value={portalPassword}
                    onChange={(e) => {
                      setPortalPassword(e.target.value);
                      setPortalError(null);
                    }}
                    disabled={!client?.email || portalCreating}
                    style={{ ...input, fontFamily: T.mono, fontSize: "0.82rem" }}
                  />
                </div>
                <button
                  onClick={createPortalAccount}
                  disabled={!client?.email || portalPassword.length < 8 || portalCreating}
                  className="px-5 h-10 transition-opacity hover:opacity-90 disabled:opacity-40"
                  style={{
                    fontFamily: T.mono,
                    fontSize: "0.72rem",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    background: T.primary,
                    color: T.primaryFg,
                    borderRadius: T.r.sm,
                    flexShrink: 0,
                  }}
                >
                  {portalCreating ? "Creating…" : "Create account"}
                </button>
              </div>
            )}
            {portalError && (
              <div
                className="mt-3 px-4 py-2 rounded"
                style={{
                  background: `${T.danger}18`,
                  border: `1px solid ${T.danger}40`,
                  fontFamily: T.sans,
                  fontSize: "0.82rem",
                  color: T.danger,
                }}
              >
                {portalError}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Danger zone ──────────────────────────────────── */}
      <div
        className="mt-10 mb-4"
        style={{
          fontFamily: T.mono,
          fontSize: "10px",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: T.danger,
        }}
      >
        // DANGER ZONE
      </div>
      <div
        className="p-5 rounded-lg flex flex-wrap items-center justify-between gap-4"
        style={{ background: T.surface, border: `1px solid ${T.danger}40` }}
      >
        <div>
          <div
            style={{
              fontFamily: T.display,
              fontWeight: 600,
              fontSize: "1rem",
              color: T.fg,
            }}
          >
            Remove client
          </div>
          <div
            style={{
              fontFamily: T.sans,
              fontSize: "0.82rem",
              color: T.muted,
              marginTop: 2,
            }}
          >
            Permanently deletes this client and all their data — proposal, booked calls.
          </div>
        </div>
        <button
          onClick={deleteClient}
          disabled={deleting}
          className="px-5 h-11 shrink-0 transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{
            fontFamily: T.mono,
            fontSize: "0.72rem",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            background: "transparent",
            color: T.danger,
            border: `1px solid ${T.danger}`,
            borderRadius: T.r.sm,
          }}
        >
          {deleting ? "Removing…" : "Remove client"}
        </button>
      </div>
    </div>
  );
}
