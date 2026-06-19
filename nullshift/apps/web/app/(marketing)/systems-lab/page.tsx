"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { T } from "@nullshift/ui/tokens";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/Reveal";

/* ─────────────────────────────────────────────────────────────
   SHARED HELPERS
───────────────────────────────────────────────────────────── */
function MonoTag({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontFamily: T.mono,
        fontSize: "10px",
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: T.primary,
      }}
    >
      {children}
    </span>
  );
}

function MutedTag({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontFamily: T.mono,
        fontSize: "10px",
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: T.muted,
      }}
    >
      {children}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────
   DEMO 01 — BOOKING SYSTEM
───────────────────────────────────────────────────────────── */
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TIMES = ["9:00 AM", "11:00 AM", "2:00 PM", "4:00 PM"];
const TODAY_IDX = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;

function BookingDemo() {
  const [selected, setSelected] = useState<{ day: number; time: string } | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  if (confirmed && selected) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 h-full text-center px-4">
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: `${T.primary}22`,
            border: `1.5px solid ${T.primary}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path
              d="M4 11.5l5 5 9-9"
              stroke={T.primary}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div>
          <p
            style={{
              fontFamily: T.sans,
              fontWeight: 600,
              fontSize: "0.9rem",
              color: T.fg,
              marginBottom: 4,
            }}
          >
            Booked for {DAYS[selected.day]} at {selected.time}
          </p>
          <p
            style={{
              fontFamily: T.mono,
              fontSize: "10px",
              color: T.muted,
              letterSpacing: "0.06em",
            }}
          >
            A confirmation email is on its way.
          </p>
        </div>
        <button
          onClick={() => {
            setSelected(null);
            setConfirmed(false);
          }}
          style={{
            fontFamily: T.mono,
            fontSize: "10px",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: T.primary,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            marginTop: 4,
          }}
        >
          ← Book another
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Day header */}
      <div className="grid grid-cols-7 gap-1">
        {DAYS.map((d, i) => (
          <div key={d} className="flex flex-col items-center gap-1">
            <span
              style={{
                fontFamily: T.mono,
                fontSize: "9px",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: i === TODAY_IDX ? T.primary : T.muted,
              }}
            >
              {d}
            </span>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: i === TODAY_IDX ? `${T.primary}22` : "transparent",
                border:
                  i === TODAY_IDX ? `1px solid ${T.primary}55` : `1px solid ${T.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "10px",
                fontFamily: T.mono,
                color: i === TODAY_IDX ? T.primary : T.muted,
              }}
            >
              {i + 1}
            </div>
          </div>
        ))}
      </div>

      {/* Time slots */}
      <div className="flex-1 overflow-y-auto">
        {DAYS.map((day, di) => (
          <div key={day} className="mb-3">
            <p
              style={{
                fontFamily: T.mono,
                fontSize: "9px",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: di === TODAY_IDX ? T.primary : T.muted,
                marginBottom: 4,
              }}
            >
              {day} {di === TODAY_IDX ? "· Today" : ""}
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {TIMES.map((t) => {
                const isSelected = selected?.day === di && selected.time === t;
                return (
                  <button
                    key={t}
                    onClick={() => setSelected({ day: di, time: t })}
                    style={{
                      fontFamily: T.mono,
                      fontSize: "9px",
                      letterSpacing: "0.08em",
                      padding: "5px 2px",
                      borderRadius: 3,
                      cursor: "pointer",
                      transition: "all 0.15s",
                      background: isSelected ? T.primary : `${T.surface2}`,
                      color: isSelected ? T.primaryFg : T.muted,
                      border: isSelected
                        ? `1px solid ${T.primary}`
                        : `1px solid ${T.border}`,
                      fontWeight: isSelected ? 600 : 400,
                    }}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Confirm button */}
      <div
        style={{
          borderTop: `1px solid ${T.border}`,
          paddingTop: 10,
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        {selected ? (
          <button
            onClick={() => setConfirmed(true)}
            style={{
              fontFamily: T.mono,
              fontSize: "10px",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              padding: "8px 18px",
              background: T.primary,
              color: T.primaryFg,
              border: "none",
              borderRadius: 3,
              cursor: "pointer",
              fontWeight: 600,
              boxShadow: `0 0 18px ${T.primary}40`,
            }}
          >
            Confirm — {DAYS[selected.day]} {selected.time} →
          </button>
        ) : (
          <span
            style={{
              fontFamily: T.mono,
              fontSize: "9px",
              letterSpacing: "0.1em",
              color: `${T.muted}66`,
            }}
          >
            Select a time slot to continue
          </span>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   DEMO 02 — AI CHATBOT
───────────────────────────────────────────────────────────── */
type ChatMsg = { role: "bot" | "user"; text: string };

const SEED_MSGS: ChatMsg[] = [
  {
    role: "bot",
    text: "Hey there 👋 I'm the Nullshift assistant. How can I help you today?",
  },
  {
    role: "bot",
    text: "You can ask me about pricing, timelines, booking a call, or anything else about our services.",
  },
];

function getBotReply(msg: string): string {
  const lower = msg.toLowerCase();
  if (/price|cost|pricing|how much|fee/.test(lower))
    return "Clinic builds start from £2,950 for a system you own outright, plus a care plan from £49/mo. Want me to connect you with the team?";
  if (/time|how long|timeline|turnaround|weeks/.test(lower))
    return "Most projects take 2–4 weeks from kickoff to launch. Complex systems like CRMs or course platforms may take 6–8 weeks.";
  if (/book|call|meeting|chat|speak/.test(lower))
    return "I can help with that! Head to nullshift.co.uk/book to pick a time that works for you. The team will be in touch within 24 hours.";
  if (/hello|hi|hey|sup/.test(lower))
    return "Great to hear from you! What are you looking to build? I can help with websites, booking systems, CRMs, course platforms, and more.";
  return "Great question! Let me connect you with a human from the Nullshift team. In the meantime, can you tell me a bit more about your project?";
}

function ChatbotDemo() {
  const [messages, setMessages] = useState<ChatMsg[]>(SEED_MSGS);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const send = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text }]);
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setMessages((prev) => [...prev, { role: "bot", text: getBotReply(text) }]);
    }, 900);
  }, [input]);

  return (
    <div className="flex flex-col h-full" style={{ gap: 0 }}>
      {/* Header */}
      <div
        className="flex items-center gap-2 pb-2 mb-2"
        style={{ borderBottom: `1px solid ${T.border}` }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: `${T.primary}22`,
            border: `1px solid ${T.primary}44`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ fontSize: "13px" }}>✦</span>
        </div>
        <div>
          <p
            style={{ fontFamily: T.sans, fontSize: "12px", fontWeight: 600, color: T.fg }}
          >
            Nullshift AI
          </p>
          <p
            style={{
              fontFamily: T.mono,
              fontSize: "8px",
              letterSpacing: "0.1em",
              color: T.primary,
            }}
          >
            ONLINE
          </p>
        </div>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1"
        style={{ minHeight: 0 }}
      >
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              style={{
                maxWidth: "82%",
                padding: "7px 11px",
                borderRadius:
                  m.role === "user" ? "10px 10px 2px 10px" : "10px 10px 10px 2px",
                background: m.role === "user" ? T.primary : T.surface2,
                color: m.role === "user" ? T.primaryFg : T.fg,
                fontFamily: T.sans,
                fontSize: "12px",
                lineHeight: 1.5,
                border: m.role === "bot" ? `1px solid ${T.border}` : "none",
              }}
            >
              {m.text}
            </div>
          </div>
        ))}
        {typing && (
          <div className="flex justify-start">
            <div
              style={{
                padding: "9px 14px",
                borderRadius: "10px 10px 10px 2px",
                background: T.surface2,
                border: `1px solid ${T.border}`,
                display: "flex",
                gap: 4,
                alignItems: "center",
              }}
            >
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: T.muted,
                    display: "block",
                    animation: "blink 1.2s infinite",
                    animationDelay: `${i * 0.2}s`,
                  }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div
        className="flex gap-2 pt-2 mt-2"
        style={{ borderTop: `1px solid ${T.border}` }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Type a message…"
          style={{
            flex: 1,
            background: T.surface2,
            border: `1px solid ${T.border}`,
            borderRadius: 4,
            padding: "7px 10px",
            fontFamily: T.sans,
            fontSize: "12px",
            color: T.fg,
            outline: "none",
          }}
        />
        <button
          onClick={send}
          style={{
            background: T.primary,
            color: T.primaryFg,
            border: "none",
            borderRadius: 4,
            padding: "0 14px",
            fontFamily: T.mono,
            fontSize: "9px",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Send
        </button>
      </div>

      <style>{`@keyframes blink { 0%,80%,100%{opacity:.2} 40%{opacity:1} }`}</style>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   DEMO 03 — CRM DASHBOARD
───────────────────────────────────────────────────────────── */
type Lead = {
  id: number;
  name: string;
  company: string;
  status: "New" | "Contacted" | "Qualified" | "Won";
  value: string;
  date: string;
  notes: string;
};

const LEADS: Lead[] = [
  {
    id: 1,
    name: "Sophie Clarke",
    company: "Bloom & Co",
    status: "Won",
    value: "£4,200",
    date: "3 Jun",
    notes:
      "Full branding + website package. Signed contract on 1 June. Launch date: 20 June.",
  },
  {
    id: 2,
    name: "James Okafor",
    company: "Forge Digital",
    status: "Qualified",
    value: "£2,800",
    date: "5 Jun",
    notes:
      "E-commerce site + booking integration. Decision by end of month. Sent proposal.",
  },
  {
    id: 3,
    name: "Priya Nair",
    company: "Studio Priya",
    status: "Contacted",
    value: "£1,500",
    date: "6 Jun",
    notes:
      "Intro call done. Wants a portfolio site. Following up Friday with package options.",
  },
  {
    id: 4,
    name: "Marcus Webb",
    company: "Webb Media",
    status: "New",
    value: "£3,600",
    date: "Today",
    notes: "Came in via contact form. Looking for CRM + automation. No call booked yet.",
  },
];

const STATUS_COLORS: Record<string, string> = {
  New: "#3b82f6",
  Contacted: "#f59e0b",
  Qualified: T.primary,
  Won: T.primary,
};

function CRMDemo() {
  const [filter, setFilter] = useState<"All" | "New" | "Qualified" | "Won">("All");
  const [expanded, setExpanded] = useState<number | null>(null);

  const visible = filter === "All" ? LEADS : LEADS.filter((l) => l.status === filter);

  return (
    <div className="flex flex-col h-full gap-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span
            style={{ fontFamily: T.sans, fontWeight: 700, fontSize: "13px", color: T.fg }}
          >
            Leads Pipeline
          </span>
          <span
            style={{
              background: `${T.primary}22`,
              color: T.primary,
              fontFamily: T.mono,
              fontSize: "9px",
              letterSpacing: "0.08em",
              padding: "2px 7px",
              borderRadius: 20,
              border: `1px solid ${T.primary}44`,
            }}
          >
            {LEADS.length}
          </span>
        </div>
        <span
          style={{
            fontFamily: T.mono,
            fontSize: "9px",
            color: T.muted,
            letterSpacing: "0.08em",
          }}
        >
          JUNE 2025
        </span>
      </div>

      {/* Filters */}
      <div className="flex gap-1.5">
        {(["All", "New", "Qualified", "Won"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              fontFamily: T.mono,
              fontSize: "9px",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              padding: "4px 10px",
              borderRadius: 3,
              cursor: "pointer",
              transition: "all 0.15s",
              background: filter === f ? T.primary : T.surface2,
              color: filter === f ? T.primaryFg : T.muted,
              border: `1px solid ${filter === f ? T.primary : T.border}`,
              fontWeight: filter === f ? 600 : 400,
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      <div
        className="flex-1 overflow-y-auto flex flex-col gap-1"
        style={{ minHeight: 0 }}
      >
        {/* Column headers */}
        <div
          className="grid grid-cols-[1fr_70px_50px_44px] gap-2 px-2 pb-1"
          style={{ borderBottom: `1px solid ${T.border}` }}
        >
          {["Contact", "Status", "Value", "Date"].map((h) => (
            <span
              key={h}
              style={{
                fontFamily: T.mono,
                fontSize: "8px",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: `${T.muted}88`,
              }}
            >
              {h}
            </span>
          ))}
        </div>

        {visible.map((lead) => (
          <div key={lead.id}>
            <button
              onClick={() => setExpanded(expanded === lead.id ? null : lead.id)}
              className="w-full text-left"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 70px 50px 44px",
                gap: 8,
                padding: "8px",
                borderRadius: 3,
                cursor: "pointer",
                transition: "background 0.12s",
                background: expanded === lead.id ? `${T.primary}0d` : "transparent",
                border: `1px solid ${expanded === lead.id ? T.primary + "44" : "transparent"}`,
              }}
            >
              <div>
                <p
                  style={{
                    fontFamily: T.sans,
                    fontSize: "12px",
                    fontWeight: 600,
                    color: T.fg,
                  }}
                >
                  {lead.name}
                </p>
                <p
                  style={{
                    fontFamily: T.mono,
                    fontSize: "8px",
                    letterSpacing: "0.06em",
                    color: T.muted,
                  }}
                >
                  {lead.company}
                </p>
              </div>
              <div className="self-center">
                <span
                  style={{
                    fontFamily: T.mono,
                    fontSize: "8px",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    padding: "3px 7px",
                    borderRadius: 20,
                    fontWeight: lead.status === "Won" ? 700 : 400,
                    background: `${STATUS_COLORS[lead.status]}22`,
                    color: STATUS_COLORS[lead.status],
                    border: `1px solid ${STATUS_COLORS[lead.status]}44`,
                  }}
                >
                  {lead.status}
                </span>
              </div>
              <span
                style={{
                  fontFamily: T.mono,
                  fontSize: "11px",
                  color: T.fg,
                  alignSelf: "center",
                  fontWeight: 600,
                }}
              >
                {lead.value}
              </span>
              <span
                style={{
                  fontFamily: T.mono,
                  fontSize: "9px",
                  color: T.muted,
                  alignSelf: "center",
                }}
              >
                {lead.date}
              </span>
            </button>

            {expanded === lead.id && (
              <div
                style={{
                  background: `${T.surface2}`,
                  borderRadius: 3,
                  padding: "10px 12px",
                  marginBottom: 2,
                  border: `1px solid ${T.border}`,
                }}
              >
                <p
                  style={{
                    fontFamily: T.sans,
                    fontSize: "11px",
                    color: T.muted,
                    lineHeight: 1.6,
                    marginBottom: 8,
                  }}
                >
                  {lead.notes}
                </p>
                <div className="flex gap-2">
                  {["Email", "Schedule call"].map((action) => (
                    <button
                      key={action}
                      style={{
                        fontFamily: T.mono,
                        fontSize: "9px",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        padding: "5px 12px",
                        borderRadius: 3,
                        cursor: "pointer",
                        background: "transparent",
                        color: T.primary,
                        border: `1px solid ${T.primary}55`,
                      }}
                    >
                      {action}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   DEMO 04 — CLIENT PORTAL (ANIMATED)
───────────────────────────────────────────────────────────── */
const PROJECTS = [
  { name: "Website Redesign", pct: 65, color: T.primary },
  { name: "Brand Identity", pct: 90, color: "#3b82f6" },
  { name: "Email Campaign", pct: 32, color: "#f59e0b" },
];

function ClientPortalDemo() {
  const [phase, setPhase] = useState<"login" | "typing" | "dashboard">("login");
  const [emailTyped, setEmailTyped] = useState("");
  const [passTyped, setPassTyped] = useState("");
  const [bars, setBars] = useState([0, 0, 0]);

  useEffect(() => {
    const fullEmail = "sarah@bloomco.com";
    const fullPass = "••••••••";
    let timeout: ReturnType<typeof setTimeout>;

    if (phase === "login") {
      timeout = setTimeout(() => setPhase("typing"), 1200);
    } else if (phase === "typing") {
      let ei = 0,
        pi = 0;
      const typeEmail = () => {
        if (ei < fullEmail.length) {
          setEmailTyped(fullEmail.slice(0, ++ei));
          timeout = setTimeout(typeEmail, 55);
        } else {
          const typePass = () => {
            if (pi < fullPass.length) {
              setPassTyped(fullPass.slice(0, ++pi));
              timeout = setTimeout(typePass, 80);
            } else {
              timeout = setTimeout(() => setPhase("dashboard"), 700);
            }
          };
          timeout = setTimeout(typePass, 300);
        }
      };
      timeout = setTimeout(typeEmail, 400);
    } else if (phase === "dashboard") {
      setBars([0, 0, 0]);
      setTimeout(() => setBars([PROJECTS[0].pct, 0, 0]), 200);
      setTimeout(() => setBars([PROJECTS[0].pct, PROJECTS[1].pct, 0]), 500);
      setTimeout(() => setBars([PROJECTS[0].pct, PROJECTS[1].pct, PROJECTS[2].pct]), 800);
      timeout = setTimeout(() => {
        setPhase("login");
        setEmailTyped("");
        setPassTyped("");
        setBars([0, 0, 0]);
      }, 7000);
    }
    return () => clearTimeout(timeout);
  }, [phase]);

  if (phase === "login" || phase === "typing") {
    return (
      <div className="flex items-center justify-center h-full">
        <div
          style={{
            width: "100%",
            maxWidth: 280,
            background: T.surface2,
            border: `1px solid ${T.border}`,
            borderRadius: 8,
            padding: "28px 24px",
          }}
        >
          <div className="flex items-center gap-2 mb-6">
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 4,
                background: `${T.primary}22`,
                border: `1px solid ${T.primary}44`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
              }}
            >
              ⬡
            </div>
            <span
              style={{
                fontFamily: T.display,
                fontSize: "13px",
                fontWeight: 800,
                letterSpacing: "0.05em",
                color: T.fg,
              }}
            >
              CLIENT PORTAL
            </span>
          </div>
          <p
            style={{
              fontFamily: T.sans,
              fontSize: "11px",
              color: T.muted,
              marginBottom: 16,
            }}
          >
            Sign in to your account
          </p>
          <div className="flex flex-col gap-3">
            <div>
              <label
                style={{
                  fontFamily: T.mono,
                  fontSize: "8px",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: T.muted,
                  display: "block",
                  marginBottom: 4,
                }}
              >
                Email
              </label>
              <div
                style={{
                  background: T.surface,
                  border: `1px solid ${emailTyped ? T.primary + "55" : T.border}`,
                  borderRadius: 4,
                  padding: "8px 10px",
                  fontFamily: T.sans,
                  fontSize: "12px",
                  color: T.fg,
                  minHeight: 34,
                  transition: "border-color 0.2s",
                }}
              >
                {emailTyped || (
                  <span style={{ color: `${T.muted}44` }}>you@company.com</span>
                )}
                {phase === "typing" && emailTyped.length < 22 && (
                  <span style={{ animation: "blink2 1s infinite" }}>|</span>
                )}
              </div>
            </div>
            <div>
              <label
                style={{
                  fontFamily: T.mono,
                  fontSize: "8px",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: T.muted,
                  display: "block",
                  marginBottom: 4,
                }}
              >
                Password
              </label>
              <div
                style={{
                  background: T.surface,
                  border: `1px solid ${passTyped ? T.primary + "55" : T.border}`,
                  borderRadius: 4,
                  padding: "8px 10px",
                  fontFamily: T.sans,
                  fontSize: "12px",
                  color: T.fg,
                  minHeight: 34,
                  transition: "border-color 0.2s",
                }}
              >
                {passTyped || <span style={{ color: `${T.muted}44` }}>Password</span>}
                {phase === "typing" && passTyped.length > 0 && passTyped.length < 8 && (
                  <span style={{ animation: "blink2 1s infinite" }}>|</span>
                )}
              </div>
            </div>
            <div
              style={{
                background:
                  emailTyped.length > 5 && passTyped.length > 5
                    ? T.primary
                    : `${T.primary}44`,
                borderRadius: 4,
                padding: "9px",
                textAlign: "center",
                fontFamily: T.mono,
                fontSize: "10px",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: T.primaryFg,
                fontWeight: 600,
                transition: "background 0.3s",
              }}
            >
              Sign in
            </div>
          </div>
        </div>
        <style>{`@keyframes blink2 { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
      </div>
    );
  }

  return (
    <div className="flex h-full gap-0" style={{ animation: "fadeIn 0.4s ease" }}>
      {/* Sidebar */}
      <div
        style={{
          width: 110,
          background: T.surface2,
          borderRight: `1px solid ${T.border}`,
          padding: "16px 0",
          display: "flex",
          flexDirection: "column",
          gap: 2,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            padding: "0 12px 12px",
            borderBottom: `1px solid ${T.border}`,
            marginBottom: 8,
          }}
        >
          <div
            style={{
              fontFamily: T.display,
              fontSize: "10px",
              fontWeight: 800,
              letterSpacing: "0.1em",
              color: T.fg,
            }}
          >
            CLIENT
          </div>
          <div
            style={{
              fontFamily: T.display,
              fontSize: "10px",
              fontWeight: 800,
              letterSpacing: "0.1em",
              color: T.primary,
            }}
          >
            PORTAL
          </div>
        </div>
        {["Dashboard", "Projects", "Invoices", "Files", "Messages"].map((item, i) => (
          <div
            key={item}
            style={{
              padding: "7px 12px",
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: i === 0 ? `${T.primary}15` : "transparent",
              borderLeft: i === 0 ? `2px solid ${T.primary}` : "2px solid transparent",
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: "10px" }}>{["◈", "◻", "◷", "⊡", "◉"][i]}</span>
            <span
              style={{
                fontFamily: T.mono,
                fontSize: "9px",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: i === 0 ? T.primary : T.muted,
              }}
            >
              {item}
            </span>
            {item === "Messages" && (
              <span
                style={{
                  marginLeft: "auto",
                  background: T.primary,
                  color: T.primaryFg,
                  borderRadius: 20,
                  fontSize: "7px",
                  fontFamily: T.mono,
                  padding: "1px 4px",
                }}
              >
                2
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Main */}
      <div className="flex-1 overflow-y-auto p-3" style={{ minWidth: 0 }}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <p
              style={{
                fontFamily: T.sans,
                fontSize: "13px",
                fontWeight: 700,
                color: T.fg,
              }}
            >
              Welcome back, Sarah 👋
            </p>
            <p
              style={{
                fontFamily: T.mono,
                fontSize: "8px",
                letterSpacing: "0.08em",
                color: T.muted,
              }}
            >
              BLOOM & CO — ACTIVE CLIENT
            </p>
          </div>
        </div>
        <p
          style={{
            fontFamily: T.mono,
            fontSize: "8px",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: T.muted,
            marginBottom: 8,
          }}
        >
          Active Projects
        </p>
        <div className="flex flex-col gap-2">
          {PROJECTS.map((p, i) => (
            <div
              key={p.name}
              style={{
                background: T.surface2,
                border: `1px solid ${T.border}`,
                borderRadius: 4,
                padding: "10px 12px",
              }}
            >
              <div className="flex justify-between mb-2">
                <span
                  style={{
                    fontFamily: T.sans,
                    fontSize: "11px",
                    fontWeight: 600,
                    color: T.fg,
                  }}
                >
                  {p.name}
                </span>
                <span
                  style={{
                    fontFamily: T.mono,
                    fontSize: "9px",
                    color: p.color,
                    fontWeight: 600,
                  }}
                >
                  {p.pct}%
                </span>
              </div>
              <div
                style={{
                  height: 4,
                  background: T.border,
                  borderRadius: 2,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${bars[i]}%`,
                    background: p.color,
                    borderRadius: 2,
                    transition: "width 0.9s cubic-bezier(.2,.8,.2,1)",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      <style>{`@keyframes fadeIn { from{opacity:0;transform:translateX(8px)} to{opacity:1;transform:translateX(0)} }`}</style>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   DEMO 05 — COURSE PLATFORM (ANIMATED)
───────────────────────────────────────────────────────────── */
const COURSES = [
  {
    icon: "◈",
    title: "Brand Strategy",
    progress: 100,
    tag: "COMPLETE",
    color: T.primary,
  },
  {
    icon: "◻",
    title: "Web Fundamentals",
    progress: 72,
    tag: "IN_PROGRESS",
    color: "#3b82f6",
    active: true,
  },
  {
    icon: "⊙",
    title: "Email Marketing",
    progress: 40,
    tag: "IN_PROGRESS",
    color: "#f59e0b",
  },
  { icon: "⌖", title: "SEO Basics", progress: 0, tag: "NOT_STARTED", color: T.muted },
];

function CourseDemo() {
  const [bars, setBars] = useState([0, 0, 0, 0]);

  useEffect(() => {
    COURSES.forEach((c, i) => {
      setTimeout(
        () => {
          setBars((prev) => {
            const next = [...prev];
            next[i] = c.progress;
            return next;
          });
        },
        300 + i * 220
      );
    });
  }, []);

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Header */}
      <div style={{ borderBottom: `1px solid ${T.border}`, paddingBottom: 10 }}>
        <div className="flex items-center justify-between mb-1">
          <span
            style={{ fontFamily: T.sans, fontWeight: 700, fontSize: "13px", color: T.fg }}
          >
            My Learning
          </span>
          <span
            style={{
              fontFamily: T.mono,
              fontSize: "8px",
              letterSpacing: "0.1em",
              color: T.primary,
              background: `${T.primary}15`,
              border: `1px solid ${T.primary}33`,
              borderRadius: 20,
              padding: "2px 8px",
            }}
          >
            3 / 8 MODULES
          </span>
        </div>
        <div
          style={{ height: 3, background: T.border, borderRadius: 2, overflow: "hidden" }}
        >
          <div
            style={{
              height: "100%",
              width: "37%",
              background: T.primary,
              borderRadius: 2,
              transition: "width 1s ease",
            }}
          />
        </div>
        <p
          style={{
            fontFamily: T.mono,
            fontSize: "8px",
            letterSpacing: "0.06em",
            color: T.muted,
            marginTop: 4,
          }}
        >
          37% complete — keep going!
        </p>
      </div>

      {/* Course cards */}
      <div className="grid grid-cols-2 gap-2 flex-1">
        {COURSES.map((c, i) => (
          <div
            key={c.title}
            style={{
              background: T.surface2,
              border: c.active ? `1px solid ${T.primary}66` : `1px solid ${T.border}`,
              borderRadius: 6,
              padding: "12px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              boxShadow: c.active ? `0 0 16px ${T.primary}20` : "none",
              animation: c.active ? "pulse 2.5s ease-in-out infinite" : "none",
            }}
          >
            <div className="flex items-start justify-between">
              <span style={{ fontSize: "18px", color: c.color }}>{c.icon}</span>
              {c.active && (
                <span
                  style={{
                    fontFamily: T.mono,
                    fontSize: "7px",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: T.primary,
                    background: `${T.primary}15`,
                    border: `1px solid ${T.primary}33`,
                    borderRadius: 20,
                    padding: "2px 6px",
                  }}
                >
                  ACTIVE
                </span>
              )}
            </div>
            <div>
              <p
                style={{
                  fontFamily: T.sans,
                  fontSize: "11px",
                  fontWeight: 600,
                  color: T.fg,
                  marginBottom: 2,
                }}
              >
                {c.title}
              </p>
              <p
                style={{
                  fontFamily: T.mono,
                  fontSize: "7px",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: c.color,
                }}
              >
                {c.tag.replace("_", " ")}
              </p>
            </div>
            <div>
              <div
                style={{
                  height: 3,
                  background: T.border,
                  borderRadius: 2,
                  overflow: "hidden",
                  marginBottom: 6,
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${bars[i]}%`,
                    background: c.color,
                    borderRadius: 2,
                    transition: "width 1s cubic-bezier(.2,.8,.2,1)",
                  }}
                />
              </div>
              <button
                style={{
                  fontFamily: T.mono,
                  fontSize: "8px",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  padding: "4px 10px",
                  borderRadius: 3,
                  background:
                    c.progress > 0 && c.progress < 100
                      ? c.color
                      : c.progress === 100
                        ? "transparent"
                        : T.surface,
                  color:
                    c.progress > 0 && c.progress < 100
                      ? T.primaryFg
                      : c.progress === 100
                        ? c.color
                        : T.muted,
                  border: `1px solid ${c.progress === 100 ? c.color + "55" : T.border}`,
                  cursor: "pointer",
                }}
              >
                {c.progress === 0
                  ? "Start →"
                  : c.progress === 100
                    ? "✓ Done"
                    : "Continue →"}
              </button>
            </div>
          </div>
        ))}
      </div>
      <style>{`@keyframes pulse { 0%,100%{box-shadow:0 0 16px ${T.primary}20} 50%{box-shadow:0 0 28px ${T.primary}40} }`}</style>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   DEMO 06 — MEMBERSHIP AREA (ANIMATED)
───────────────────────────────────────────────────────────── */
const TIERS = [
  {
    name: "Starter",
    price: "£29",
    features: ["1 user", "Core content access", "Email support", "Monthly newsletter"],
    color: T.muted,
  },
  {
    name: "Pro",
    price: "£79",
    features: [
      "Up to 5 users",
      "Full content library",
      "Live Q&A sessions",
      "Priority support",
    ],
    color: T.primary,
    recommended: true,
  },
  {
    name: "Elite",
    price: "£149",
    features: [
      "Unlimited users",
      "1-to-1 coaching",
      "Private community",
      "Early access content",
    ],
    color: "#f59e0b",
  },
];

const CONTENT_CARDS = [
  { title: "Growth Playbook 2025", locked: false, type: "PDF Guide" },
  { title: "Advanced Automation Workshop", locked: true, type: "Video Series" },
  { title: "Client Retention Secrets", locked: true, type: "Private Module" },
];

function MembershipDemo() {
  const [unlockIdx, setUnlockIdx] = useState(-1);

  useEffect(() => {
    const cycle = () => {
      setUnlockIdx(1);
      setTimeout(() => setUnlockIdx(2), 1800);
      setTimeout(() => setUnlockIdx(-1), 4000);
    };
    const t = setTimeout(cycle, 1200);
    const interval = setInterval(cycle, 5500);
    return () => {
      clearTimeout(t);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Tier cards */}
      <div className="grid grid-cols-3 gap-1.5">
        {TIERS.map((tier) => (
          <div
            key={tier.name}
            style={{
              background: T.surface2,
              borderRadius: 6,
              padding: "10px 8px",
              border: tier.recommended
                ? `1px solid ${T.primary}`
                : `1px solid ${T.border}`,
              boxShadow: tier.recommended ? `0 0 20px ${T.primary}20` : "none",
              position: "relative",
            }}
          >
            {tier.recommended && (
              <div
                style={{
                  position: "absolute",
                  top: -9,
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: T.primary,
                  color: T.primaryFg,
                  fontFamily: T.mono,
                  fontSize: "7px",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  padding: "2px 7px",
                  borderRadius: 20,
                  whiteSpace: "nowrap",
                  fontWeight: 700,
                }}
              >
                Popular
              </div>
            )}
            <p
              style={{
                fontFamily: T.sans,
                fontSize: "11px",
                fontWeight: 700,
                color: tier.recommended ? T.primary : T.fg,
                marginBottom: 2,
              }}
            >
              {tier.name}
            </p>
            <p
              style={{
                fontFamily: T.display,
                fontSize: "16px",
                fontWeight: 600,
                color: tier.color,
                letterSpacing: "-0.02em",
                marginBottom: 6,
              }}
            >
              {tier.price}
              <span
                style={{
                  fontFamily: T.mono,
                  fontSize: "8px",
                  color: T.muted,
                  fontWeight: 400,
                }}
              >
                /mo
              </span>
            </p>
            <div className="flex flex-col gap-1">
              {tier.features.map((f) => (
                <div key={f} className="flex items-start gap-1">
                  <span style={{ color: tier.color, fontSize: "9px", marginTop: 1 }}>
                    ✓
                  </span>
                  <span
                    style={{
                      fontFamily: T.sans,
                      fontSize: "8.5px",
                      color: T.muted,
                      lineHeight: 1.4,
                    }}
                  >
                    {f}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Members area preview */}
      <div
        style={{
          background: T.surface2,
          border: `1px solid ${T.border}`,
          borderRadius: 6,
          padding: 10,
          flex: 1,
        }}
      >
        <p
          style={{
            fontFamily: T.mono,
            fontSize: "8px",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: T.muted,
            marginBottom: 8,
          }}
        >
          Members Area
        </p>
        <div className="flex flex-col gap-2">
          {CONTENT_CARDS.map((card, i) => {
            const isUnlocking = unlockIdx === i && card.locked;
            const isUnlocked = !card.locked || isUnlocking;
            return (
              <div
                key={card.title}
                style={{
                  background: isUnlocked ? T.bg : `${T.surface}`,
                  border: `1px solid ${isUnlocked ? T.primary + "55" : T.border}`,
                  borderRadius: 4,
                  padding: "8px 10px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  filter: card.locked && !isUnlocking ? "blur(0.5px)" : "none",
                  transition: "all 0.5s ease",
                  opacity: card.locked && !isUnlocking ? 0.55 : 1,
                }}
              >
                <div>
                  <p
                    style={{
                      fontFamily: T.sans,
                      fontSize: "11px",
                      fontWeight: 600,
                      color: isUnlocked ? T.fg : T.muted,
                    }}
                  >
                    {card.title}
                  </p>
                  <p
                    style={{
                      fontFamily: T.mono,
                      fontSize: "8px",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: isUnlocked ? T.primary : `${T.muted}66`,
                    }}
                  >
                    {card.type}
                  </p>
                </div>
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: isUnlocked ? `${T.primary}22` : `${T.muted}22`,
                    border: `1px solid ${isUnlocked ? T.primary + "55" : T.border}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    transition: "all 0.5s ease",
                  }}
                >
                  {isUnlocked ? "▶" : "🔒"}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   DEMO 07 — AUTOMATED LEAD FUNNEL (ANIMATED)
───────────────────────────────────────────────────────────── */
const FUNNEL_STAGES = [
  {
    label: "Visitor lands on page",
    count: 1000,
    widthPct: 100,
    note: "Retargeting pixel fires",
    color: T.muted,
  },
  {
    label: "Engages with content",
    count: 420,
    widthPct: 80,
    note: "→ Retargeting ad triggered",
    color: "#a78bfa",
  },
  {
    label: "Submits lead form",
    count: 180,
    widthPct: 60,
    note: "→ Email sequence sent",
    color: "#60a5fa",
  },
  {
    label: "Books a call",
    count: 64,
    widthPct: 42,
    note: "→ CRM entry created",
    color: T.accent,
  },
  {
    label: "Becomes a client",
    count: 22,
    widthPct: 26,
    note: "→ Onboarding triggered",
    color: T.primary,
  },
];

function useCountUp(target: number, duration = 1200) {
  const [val, setVal] = useState(0);
  const started = useRef(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const tick = (now: number) => {
            const progress = Math.min((now - start) / duration, 1);
            setVal(Math.round(progress * target));
            if (progress < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [target, duration]);

  return { ref, val };
}

function FunnelStage({
  stage,
  index,
}: {
  stage: (typeof FUNNEL_STAGES)[0];
  index: number;
}) {
  const { ref, val } = useCountUp(stage.count, 1400);

  return (
    <div ref={ref} className="flex flex-col items-center gap-0.5">
      <div
        style={{
          width: `${stage.widthPct}%`,
          height: 32,
          borderRadius: 3,
          background: `${stage.color}22`,
          border: `1px solid ${stage.color}55`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 10px",
          transition: "width 0.8s ease",
        }}
      >
        <span
          style={{
            fontFamily: T.sans,
            fontSize: "10px",
            fontWeight: 600,
            color: stage.color,
          }}
        >
          {stage.label}
        </span>
        <span
          style={{
            fontFamily: T.display,
            fontSize: "13px",
            fontWeight: 600,
            color: stage.color,
            letterSpacing: "-0.02em",
          }}
        >
          {val.toLocaleString()}
        </span>
      </div>
      {index < FUNNEL_STAGES.length - 1 && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 0" }}>
          <span
            style={{
              fontFamily: T.mono,
              fontSize: "7.5px",
              letterSpacing: "0.08em",
              color: `${T.muted}88`,
            }}
          >
            {stage.note}
          </span>
        </div>
      )}
    </div>
  );
}

function FunnelDemo() {
  return (
    <div className="flex flex-col justify-center gap-1.5 h-full px-2">
      <div className="flex items-center justify-between mb-1">
        <span
          style={{ fontFamily: T.sans, fontWeight: 700, fontSize: "12px", color: T.fg }}
        >
          Automated Lead Funnel
        </span>
        <span
          style={{
            fontFamily: T.mono,
            fontSize: "8px",
            color: T.primary,
            letterSpacing: "0.1em",
          }}
        >
          LIVE_SIMULATION
        </span>
      </div>
      {FUNNEL_STAGES.map((s, i) => (
        <FunnelStage key={s.label} stage={s} index={i} />
      ))}
      <div
        style={{
          marginTop: 6,
          padding: "6px 10px",
          background: `${T.primary}10`,
          border: `1px solid ${T.primary}33`,
          borderRadius: 4,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontFamily: T.mono,
            fontSize: "8px",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: T.muted,
          }}
        >
          Conversion rate
        </span>
        <span
          style={{
            fontFamily: T.display,
            fontSize: "14px",
            fontWeight: 600,
            color: T.primary,
          }}
        >
          2.2%
        </span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   DEMO 08 — E-COMMERCE STORE
───────────────────────────────────────────────────────────── */
const PRODUCTS = [
  { id: 1, name: "Brand Strategy Kit", price: "£49", tag: "DIGITAL", color: T.primary },
  { id: 2, name: "Website Audit Report", price: "£79", tag: "REPORT", color: "#3b82f6" },
  { id: 3, name: "Logo Design Pack", price: "£129", tag: "DESIGN", color: "#f59e0b" },
  { id: 4, name: "SEO Starter Bundle", price: "£99", tag: "BUNDLE", color: "#a78bfa" },
];

function EcommerceDemo() {
  const [cart, setCart] = useState<number[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [added, setAdded] = useState<number | null>(null);

  const addToCart = (id: number) => {
    setCart((p) => [...p, id]);
    setAdded(id);
    setShowCart(true);
    setTimeout(() => setAdded(null), 1000);
  };

  const cartItems = PRODUCTS.filter((p) => cart.includes(p.id));
  const total = cartItems.reduce(
    (s, p) => s + parseInt(p.price.replace(/[^0-9]/g, "")),
    0
  );

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span
          style={{ fontFamily: T.sans, fontWeight: 700, fontSize: "13px", color: T.fg }}
        >
          Shop
        </span>
        <button
          onClick={() => setShowCart(!showCart)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "transparent",
            border: `1px solid ${T.border}`,
            borderRadius: 3,
            padding: "4px 10px",
            cursor: "pointer",
            position: "relative",
          }}
        >
          <span style={{ fontSize: "12px" }}>🛒</span>
          <span style={{ fontFamily: T.mono, fontSize: "9px", color: T.fg }}>
            {cart.length}
          </span>
          {cart.length > 0 && (
            <span
              style={{
                position: "absolute",
                top: -4,
                right: -4,
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: T.primary,
                border: `1px solid ${T.bg}`,
              }}
            />
          )}
        </button>
      </div>

      {showCart && cart.length > 0 ? (
        /* Cart view */
        <div className="flex flex-col gap-2 flex-1">
          <div
            style={{
              borderBottom: `1px solid ${T.border}`,
              paddingBottom: 8,
              marginBottom: 4,
            }}
          >
            <span
              style={{
                fontFamily: T.mono,
                fontSize: "9px",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: T.muted,
              }}
            >
              Your cart — {cart.length} item{cart.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div
            className="flex flex-col gap-2 flex-1 overflow-y-auto"
            style={{ minHeight: 0 }}
          >
            {cartItems.map((p, i) => (
              <div
                key={i}
                className="flex items-center justify-between"
                style={{
                  background: T.surface2,
                  border: `1px solid ${T.border}`,
                  borderRadius: 4,
                  padding: "8px 10px",
                }}
              >
                <div>
                  <p
                    style={{
                      fontFamily: T.sans,
                      fontSize: "11px",
                      fontWeight: 600,
                      color: T.fg,
                    }}
                  >
                    {p.name}
                  </p>
                  <span
                    style={{
                      fontFamily: T.mono,
                      fontSize: "8px",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: p.color,
                    }}
                  >
                    {p.tag}
                  </span>
                </div>
                <span
                  style={{
                    fontFamily: T.mono,
                    fontSize: "12px",
                    fontWeight: 700,
                    color: T.fg,
                  }}
                >
                  {p.price}
                </span>
              </div>
            ))}
          </div>
          <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 10 }}>
            <div className="flex justify-between items-center mb-3">
              <span
                style={{
                  fontFamily: T.mono,
                  fontSize: "9px",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: T.muted,
                }}
              >
                Total
              </span>
              <span
                style={{
                  fontFamily: T.display,
                  fontSize: "16px",
                  fontWeight: 600,
                  color: T.fg,
                }}
              >
                £{total}
              </span>
            </div>
            <button
              style={{
                width: "100%",
                padding: "9px",
                background: T.primary,
                color: T.primaryFg,
                border: "none",
                borderRadius: 3,
                fontFamily: T.mono,
                fontSize: "10px",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                cursor: "pointer",
                fontWeight: 600,
                boxShadow: `0 0 16px ${T.primary}40`,
              }}
            >
              Checkout →
            </button>
            <button
              onClick={() => setShowCart(false)}
              style={{
                width: "100%",
                padding: "6px",
                background: "transparent",
                color: T.muted,
                border: "none",
                fontFamily: T.mono,
                fontSize: "9px",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                cursor: "pointer",
                marginTop: 4,
              }}
            >
              ← Continue shopping
            </button>
          </div>
        </div>
      ) : (
        /* Product grid */
        <div className="grid grid-cols-2 gap-2 flex-1" style={{ minHeight: 0 }}>
          {PRODUCTS.map((p) => (
            <div
              key={p.id}
              style={{
                background: T.surface2,
                border: `1px solid ${added === p.id ? T.primary : T.border}`,
                borderRadius: 6,
                padding: "12px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                transition: "border-color 0.2s",
                boxShadow: added === p.id ? `0 0 14px ${T.primary}30` : "none",
              }}
            >
              {/* Product colour swatch */}
              <div
                style={{
                  height: 48,
                  borderRadius: 4,
                  background: `${p.color}18`,
                  border: `1px solid ${p.color}33`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span
                  style={{
                    fontFamily: T.mono,
                    fontSize: "8px",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: p.color,
                  }}
                >
                  {p.tag}
                </span>
              </div>
              <div style={{ flex: 1 }}>
                <p
                  style={{
                    fontFamily: T.sans,
                    fontSize: "11px",
                    fontWeight: 600,
                    color: T.fg,
                    marginBottom: 2,
                    lineHeight: 1.3,
                  }}
                >
                  {p.name}
                </p>
                <p
                  style={{
                    fontFamily: T.mono,
                    fontSize: "12px",
                    fontWeight: 700,
                    color: T.fg,
                  }}
                >
                  {p.price}
                </p>
              </div>
              <button
                onClick={() => addToCart(p.id)}
                style={{
                  padding: "6px",
                  background: added === p.id ? T.primary : "transparent",
                  color: added === p.id ? T.primaryFg : T.primary,
                  border: `1px solid ${T.primary}55`,
                  borderRadius: 3,
                  fontFamily: T.mono,
                  fontSize: "8px",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                {added === p.id ? "✓ Added" : "Add to cart"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   DEMO 09 — ANALYTICS DASHBOARD
───────────────────────────────────────────────────────────── */
const ANALYTICS_RANGES = ["7D", "30D", "90D"] as const;
const CHART_DATA: Record<string, number[]> = {
  "7D": [42, 67, 55, 89, 73, 94, 81],
  "30D": [
    38, 52, 61, 44, 78, 65, 90, 55, 70, 83, 48, 92, 67, 75, 58, 88, 63, 77, 95, 51, 69,
    84, 72, 91, 59, 76, 87, 64, 93, 80,
  ],
  "90D": [
    55, 62, 48, 71, 83, 59, 76, 88, 64, 92, 57, 74, 85, 61, 78, 90, 53, 69, 82, 67, 94,
    50, 73, 86, 58, 75, 89, 63, 77, 91,
  ],
};
const KPI = [
  { label: "Revenue", value: "£12,480", delta: "+18%", up: true },
  { label: "New Users", value: "342", delta: "+24%", up: true },
  { label: "Conversion", value: "3.2%", delta: "+0.4%", up: true },
  { label: "Bounce", value: "38%", delta: "-5%", up: true },
];

function AnalyticsDemo() {
  const [range, setRange] = useState<(typeof ANALYTICS_RANGES)[number]>("7D");
  const data = CHART_DATA[range].slice(0, 14);
  const max = Math.max(...data);

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span
          style={{ fontFamily: T.sans, fontWeight: 700, fontSize: "13px", color: T.fg }}
        >
          Analytics
        </span>
        <div className="flex gap-1">
          {ANALYTICS_RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              style={{
                fontFamily: T.mono,
                fontSize: "8px",
                letterSpacing: "0.1em",
                padding: "3px 8px",
                borderRadius: 3,
                cursor: "pointer",
                transition: "all 0.15s",
                background: range === r ? T.primary : "transparent",
                color: range === r ? T.primaryFg : T.muted,
                border: `1px solid ${range === r ? T.primary : T.border}`,
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-2">
        {KPI.map((k) => (
          <div
            key={k.label}
            style={{
              background: T.surface2,
              border: `1px solid ${T.border}`,
              borderRadius: 4,
              padding: "8px 6px",
            }}
          >
            <p
              style={{
                fontFamily: T.mono,
                fontSize: "7px",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: T.muted,
                marginBottom: 4,
              }}
            >
              {k.label}
            </p>
            <p
              style={{
                fontFamily: T.display,
                fontSize: "14px",
                fontWeight: 600,
                color: T.fg,
                letterSpacing: "-0.02em",
                lineHeight: 1,
              }}
            >
              {k.value}
            </p>
            <p
              style={{
                fontFamily: T.mono,
                fontSize: "8px",
                color: T.primary,
                marginTop: 2,
              }}
            >
              {k.delta}
            </p>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 6,
          minHeight: 0,
        }}
      >
        <span
          style={{
            fontFamily: T.mono,
            fontSize: "8px",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: T.muted,
          }}
        >
          Sessions
        </span>
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "flex-end",
            gap: 3,
            padding: "0 0 4px",
          }}
        >
          {data.map((v, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
                height: "100%",
              }}
            >
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "flex-end",
                  width: "100%",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    height: `${(v / max) * 100}%`,
                    background: i === data.length - 1 ? T.primary : `${T.primary}44`,
                    borderRadius: "2px 2px 0 0",
                    transition: "height 0.4s ease",
                    minHeight: 3,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
        <div style={{ height: 1, background: T.border }} />
        <div className="flex justify-between">
          <span style={{ fontFamily: T.mono, fontSize: "7px", color: `${T.muted}88` }}>
            {range === "7D" ? "Mon" : range === "30D" ? "1 Jun" : "1 Apr"}
          </span>
          <span style={{ fontFamily: T.mono, fontSize: "7px", color: `${T.muted}88` }}>
            {range === "7D" ? "Sun" : range === "30D" ? "30 Jun" : "30 Jun"}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   DEMO 10 — EMAIL AUTOMATION BUILDER
───────────────────────────────────────────────────────────── */
const EMAIL_STEPS = [
  { icon: "◈", label: "Form submitted", type: "TRIGGER", delay: "", color: T.primary },
  { icon: "⏱", label: "Wait 1 hour", type: "DELAY", delay: "1h", color: T.muted },
  { icon: "✉", label: "Welcome email", type: "EMAIL", delay: "", color: "#3b82f6" },
  { icon: "⏱", label: "Wait 2 days", type: "DELAY", delay: "2d", color: T.muted },
  {
    icon: "✉",
    label: "Follow-up + case study",
    type: "EMAIL",
    delay: "",
    color: "#3b82f6",
  },
  { icon: "⏱", label: "Wait 3 days", type: "DELAY", delay: "3d", color: T.muted },
  { icon: "✉", label: "Limited offer", type: "EMAIL", delay: "", color: T.accent },
  {
    icon: "⊙",
    label: "Tag: nurture_complete",
    type: "ACTION",
    delay: "",
    color: "#a78bfa",
  },
];

function EmailAutomationDemo() {
  const [active, setActive] = useState<number | null>(null);

  return (
    <div className="flex flex-col h-full gap-2">
      <div className="flex items-center justify-between">
        <span
          style={{ fontFamily: T.sans, fontWeight: 700, fontSize: "13px", color: T.fg }}
        >
          Email Sequence
        </span>
        <span
          style={{
            fontFamily: T.mono,
            fontSize: "8px",
            letterSpacing: "0.1em",
            color: T.primary,
            background: `${T.primary}15`,
            border: `1px solid ${T.primary}33`,
            borderRadius: 20,
            padding: "2px 8px",
          }}
        >
          LIVE
        </span>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
        {EMAIL_STEPS.map((step, i) => (
          <div key={i}>
            <button
              onClick={() => setActive(active === i ? null : i)}
              className="w-full text-left"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 8px",
                borderRadius: 4,
                cursor: "pointer",
                transition: "background 0.12s",
                background: active === i ? `${step.color}12` : "transparent",
                border: `1px solid ${active === i ? step.color + "44" : "transparent"}`,
              }}
            >
              {/* Connector line above (except first) */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: step.type === "DELAY" ? 4 : "50%",
                    background: `${step.color}18`,
                    border: `1px solid ${step.color}55`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "11px",
                    color: step.color,
                  }}
                >
                  {step.icon}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    fontFamily: T.sans,
                    fontSize: "11px",
                    fontWeight: 600,
                    color: T.fg,
                    margin: 0,
                  }}
                >
                  {step.label}
                </p>
              </div>
              <span
                style={{
                  fontFamily: T.mono,
                  fontSize: "7px",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: step.color,
                  flexShrink: 0,
                  background: `${step.color}12`,
                  padding: "2px 5px",
                  borderRadius: 3,
                }}
              >
                {step.type}
              </span>
            </button>
            {/* Connector line */}
            {i < EMAIL_STEPS.length - 1 && (
              <div
                style={{
                  marginLeft: 20,
                  width: 1,
                  height: 6,
                  background: `${T.border}`,
                  marginBottom: 0,
                }}
              />
            )}
          </div>
        ))}
      </div>

      <div
        style={{
          borderTop: `1px solid ${T.border}`,
          paddingTop: 8,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontFamily: T.mono,
            fontSize: "8px",
            letterSpacing: "0.06em",
            color: T.muted,
          }}
        >
          8 steps · ~6 days total
        </span>
        <span
          style={{
            fontFamily: T.mono,
            fontSize: "8px",
            color: T.primary,
            letterSpacing: "0.08em",
          }}
        >
          ● Running
        </span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   DEMO 11 — MULTI-STEP ONBOARDING WIZARD
───────────────────────────────────────────────────────────── */
const WIZARD_STEPS = [
  {
    title: "What do you need?",
    type: "choice" as const,
    options: ["New website", "Rebrand", "Booking system", "Custom build"],
  },
  {
    title: "About your business",
    type: "fields" as const,
    fields: ["Business name", "Industry"],
  },
  {
    title: "What's your budget?",
    type: "choice" as const,
    options: ["£500–£1,500", "£1,500–£5,000", "£5,000–£15,000", "£15,000+"],
  },
  {
    title: "You're all set!",
    type: "success" as const,
  },
];

function WizardDemo() {
  const [step, setStep] = useState(0);
  const [choice, setChoice] = useState<string | null>(null);
  const current = WIZARD_STEPS[step];
  const progress = (step / (WIZARD_STEPS.length - 1)) * 100;

  const next = () => {
    setChoice(null);
    setStep((s) => Math.min(s + 1, WIZARD_STEPS.length - 1));
  };
  const reset = () => {
    setStep(0);
    setChoice(null);
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Progress */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span
            style={{
              fontFamily: T.mono,
              fontSize: "9px",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: T.muted,
            }}
          >
            Step {step + 1} of {WIZARD_STEPS.length}
          </span>
          <span style={{ fontFamily: T.mono, fontSize: "9px", color: T.primary }}>
            {Math.round(progress)}%
          </span>
        </div>
        <div
          style={{ height: 3, background: T.border, borderRadius: 2, overflow: "hidden" }}
        >
          <div
            style={{
              height: "100%",
              width: `${progress}%`,
              background: T.primary,
              borderRadius: 2,
              transition: "width 0.4s ease",
            }}
          />
        </div>
      </div>

      {/* Step content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
        <h4
          style={{
            fontFamily: T.display,
            fontWeight: 600,
            fontSize: "1.1rem",
            letterSpacing: "-0.01em",
            color: T.fg,
            margin: 0,
          }}
        >
          {current.title}
        </h4>

        {current.type === "choice" && (
          <div className="grid grid-cols-2 gap-2 flex-1">
            {current.options!.map((opt) => (
              <button
                key={opt}
                onClick={() => setChoice(opt)}
                style={{
                  padding: "10px 8px",
                  background: choice === opt ? `${T.primary}15` : T.surface2,
                  border: `1px solid ${choice === opt ? T.primary : T.border}`,
                  borderRadius: 4,
                  fontFamily: T.sans,
                  fontSize: "11px",
                  fontWeight: choice === opt ? 600 : 400,
                  color: choice === opt ? T.primary : T.muted,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  textAlign: "left",
                  lineHeight: 1.3,
                }}
              >
                {choice === opt && (
                  <span
                    style={{
                      display: "block",
                      color: T.primary,
                      fontSize: "10px",
                      marginBottom: 2,
                    }}
                  >
                    ✓
                  </span>
                )}
                {opt}
              </button>
            ))}
          </div>
        )}

        {current.type === "fields" && (
          <div className="flex flex-col gap-3 flex-1">
            {current.fields!.map((f) => (
              <div key={f}>
                <label
                  style={{
                    display: "block",
                    fontFamily: T.mono,
                    fontSize: "8px",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: T.muted,
                    marginBottom: 4,
                  }}
                >
                  {f}
                </label>
                <input
                  placeholder={f}
                  style={{
                    width: "100%",
                    background: T.surface2,
                    border: `1px solid ${T.border}`,
                    borderRadius: 3,
                    padding: "8px 10px",
                    fontFamily: T.sans,
                    fontSize: "12px",
                    color: T.fg,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            ))}
          </div>
        )}

        {current.type === "success" && (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                background: `${T.primary}18`,
                border: `1.5px solid ${T.primary}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <path
                  d="M4 11.5l5 5 9-9"
                  stroke={T.primary}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <p
                style={{
                  fontFamily: T.sans,
                  fontWeight: 700,
                  fontSize: "13px",
                  color: T.fg,
                  marginBottom: 4,
                }}
              >
                Thanks! We'll be in touch.
              </p>
              <p
                style={{
                  fontFamily: T.mono,
                  fontSize: "9px",
                  color: T.muted,
                  letterSpacing: "0.06em",
                }}
              >
                Expect a reply within 24 hours.
              </p>
            </div>
            <button
              onClick={reset}
              style={{
                fontFamily: T.mono,
                fontSize: "9px",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: T.primary,
                background: "transparent",
                border: "none",
                cursor: "pointer",
              }}
            >
              ← Start over
            </button>
          </div>
        )}
      </div>

      {/* Next button */}
      {current.type !== "success" && (
        <button
          onClick={next}
          disabled={current.type === "choice" && !choice}
          style={{
            padding: "9px",
            background:
              current.type === "choice" && !choice ? `${T.primary}33` : T.primary,
            color: T.primaryFg,
            border: "none",
            borderRadius: 3,
            fontFamily: T.mono,
            fontSize: "10px",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            cursor: current.type === "choice" && !choice ? "default" : "pointer",
            fontWeight: 600,
            transition: "background 0.2s",
          }}
        >
          {step === WIZARD_STEPS.length - 2 ? "Submit →" : "Next →"}
        </button>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   DEMO 12 — REVIEW & TESTIMONIALS SYSTEM
───────────────────────────────────────────────────────────── */
const REVIEWS = [
  {
    name: "Sophie Clarke",
    company: "Bloom & Co",
    rating: 5,
    text: "Nullshift delivered a website that completely transformed our online presence. The booking system alone doubled our enquiries.",
    avatar: "SC",
  },
  {
    name: "James Okafor",
    company: "Forge Digital",
    rating: 5,
    text: "Professional, fast, and genuinely listened to what we needed. The CRM they built saves us hours every week.",
    avatar: "JO",
  },
  {
    name: "Priya Nair",
    company: "Studio Priya",
    rating: 5,
    text: "From concept to launch in 3 weeks. The attention to detail was exceptional — I couldn't be happier.",
    avatar: "PN",
  },
];

function ReviewsDemo() {
  const [hoverStar, setHoverStar] = useState(0);
  const [selectedStar, setSelectedStar] = useState(0);
  const [reviewIdx, setReviewIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setReviewIdx((i) => (i + 1) % REVIEWS.length), 3500);
    return () => clearInterval(t);
  }, []);

  const avgRating = 4.9;

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Rating summary */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-baseline gap-2">
            <span
              style={{
                fontFamily: T.display,
                fontSize: "28px",
                fontWeight: 600,
                color: T.fg,
                letterSpacing: "-0.02em",
                lineHeight: 1,
              }}
            >
              {avgRating}
            </span>
            <span
              style={{
                fontFamily: T.mono,
                fontSize: "9px",
                color: T.muted,
                letterSpacing: "0.08em",
              }}
            >
              / 5.0
            </span>
          </div>
          <div className="flex gap-0.5 mt-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <span
                key={s}
                style={{
                  fontSize: "11px",
                  color: s <= Math.round(avgRating) ? T.primary : T.border,
                }}
              >
                ★
              </span>
            ))}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <p
            style={{
              fontFamily: T.mono,
              fontSize: "9px",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: T.muted,
            }}
          >
            Based on
          </p>
          <p
            style={{ fontFamily: T.mono, fontSize: "11px", fontWeight: 700, color: T.fg }}
          >
            47 reviews
          </p>
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${T.border}` }} />

      {/* Cycling review card */}
      <div
        style={{
          background: T.surface2,
          border: `1px solid ${T.border}`,
          borderRadius: 6,
          padding: "12px",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div className="flex gap-0.5 mb-3">
          {[1, 2, 3, 4, 5].map((s) => (
            <span key={s} style={{ fontSize: "11px", color: T.primary }}>
              ★
            </span>
          ))}
        </div>
        <div style={{ flex: 1 }}>
          <p
            style={{
              fontFamily: T.sans,
              fontSize: "12px",
              lineHeight: 1.65,
              color: T.fg,
              fontStyle: "italic",
            }}
          >
            &ldquo;{REVIEWS[reviewIdx].text}&rdquo;
          </p>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: `${T.primary}22`,
              border: `1px solid ${T.primary}44`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: T.mono,
              fontSize: "9px",
              color: T.primary,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {REVIEWS[reviewIdx].avatar}
          </div>
          <div>
            <p
              style={{
                fontFamily: T.sans,
                fontSize: "11px",
                fontWeight: 600,
                color: T.fg,
                margin: 0,
              }}
            >
              {REVIEWS[reviewIdx].name}
            </p>
            <p
              style={{
                fontFamily: T.mono,
                fontSize: "8px",
                letterSpacing: "0.06em",
                color: T.muted,
              }}
            >
              {REVIEWS[reviewIdx].company}
            </p>
          </div>
          {/* Pagination dots */}
          <div className="flex gap-1 ml-auto">
            {REVIEWS.map((_, i) => (
              <div
                key={i}
                style={{
                  width: i === reviewIdx ? 14 : 5,
                  height: 5,
                  borderRadius: 3,
                  background: i === reviewIdx ? T.primary : T.border,
                  transition: "all 0.3s",
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Leave a review */}
      <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 10 }}>
        <p
          style={{
            fontFamily: T.mono,
            fontSize: "8px",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: T.muted,
            marginBottom: 6,
          }}
        >
          Leave a review
        </p>
        <div className="flex items-center gap-4">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                onMouseEnter={() => setHoverStar(s)}
                onMouseLeave={() => setHoverStar(0)}
                onClick={() => setSelectedStar(s)}
                style={{
                  fontSize: "16px",
                  color: s <= (hoverStar || selectedStar) ? T.primary : T.border,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: "0 1px",
                  transition: "color 0.1s",
                  lineHeight: 1,
                }}
              >
                ★
              </button>
            ))}
          </div>
          {selectedStar > 0 && (
            <span
              style={{
                fontFamily: T.mono,
                fontSize: "9px",
                color: T.primary,
                letterSpacing: "0.06em",
              }}
            >
              {["", "Poor", "Fair", "Good", "Great", "Excellent!"][selectedStar]}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   DEMOS CONFIG
───────────────────────────────────────────────────────────── */
const DEMOS = [
  {
    num: "01",
    tag: "BOOKING_SYSTEM",
    title: "Booking System",
    desc: "Live calendar with real-time slot selection and instant confirmation flow.",
    component: <BookingDemo />,
  },
  {
    num: "02",
    tag: "AI_CHATBOT",
    title: "AI Chatbot",
    desc: "Intelligent assistant that handles FAQs, qualifies leads, and routes enquiries.",
    component: <ChatbotDemo />,
  },
  {
    num: "03",
    tag: "CRM_DASHBOARD",
    title: "CRM Dashboard",
    desc: "Full lead pipeline with contact management, notes, and status tracking.",
    component: <CRMDemo />,
  },
  {
    num: "04",
    tag: "CLIENT_PORTAL",
    title: "Client Portal",
    desc: "Branded login portal with project tracking, invoices, and file sharing.",
    component: <ClientPortalDemo />,
  },
  {
    num: "05",
    tag: "COURSE_PLATFORM",
    title: "Course Platform",
    desc: "Structured learning hub with progress tracking, modules, and certificates.",
    component: <CourseDemo />,
  },
  {
    num: "06",
    tag: "MEMBERSHIP_AREA",
    title: "Membership Area",
    desc: "Gated content tiers with subscriber management and locked content unlocking.",
    component: <MembershipDemo />,
  },
  {
    num: "07",
    tag: "LEAD_FUNNEL",
    title: "Automated Lead Funnel",
    desc: "End-to-end funnel with retargeting, email sequences, and CRM automation.",
    component: <FunnelDemo />,
  },
  {
    num: "08",
    tag: "ECOMMERCE_STORE",
    title: "E-Commerce Store",
    desc: "Product listings, cart management, and a full checkout experience.",
    component: <EcommerceDemo />,
  },
  {
    num: "09",
    tag: "ANALYTICS_DASH",
    title: "Analytics Dashboard",
    desc: "Real-time KPIs, session charts, and conversion tracking in one view.",
    component: <AnalyticsDemo />,
  },
  {
    num: "10",
    tag: "EMAIL_AUTOMATION",
    title: "Email Automation Builder",
    desc: "Visual sequence builder with triggers, delays, and branching email flows.",
    component: <EmailAutomationDemo />,
  },
  {
    num: "11",
    tag: "ONBOARDING_WIZARD",
    title: "Onboarding Wizard",
    desc: "Multi-step form that qualifies leads and routes them to the right offer.",
    component: <WizardDemo />,
  },
  {
    num: "12",
    tag: "REVIEW_SYSTEM",
    title: "Reviews & Testimonials",
    desc: "Collect, display, and manage social proof to convert more visitors.",
    component: <ReviewsDemo />,
  },
];

/* ─────────────────────────────────────────────────────────────
   PAGE
───────────────────────────────────────────────────────────── */
export default function SystemsLabPage() {
  return (
    <>
      <Nav />
      <main style={{ background: T.bg, minHeight: "100vh", paddingTop: 48 }}>
        {/* Hero */}
        <section
          style={{
            minHeight: "58vh",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "80px 24px 64px",
            position: "relative",
            overflow: "hidden",
            borderBottom: `1px solid ${T.border}`,
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `linear-gradient(${T.border}44 1px, transparent 1px), linear-gradient(90deg, ${T.border}44 1px, transparent 1px)`,
              backgroundSize: "48px 48px",
              opacity: 0.4,
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: "40%",
              left: "50%",
              transform: "translate(-50%,-50%)",
              width: 600,
              height: 300,
              background: `radial-gradient(ellipse, ${T.primary}18, transparent 70%)`,
              pointerEvents: "none",
            }}
          />

          <div
            style={{
              maxWidth: 1120,
              margin: "0 auto",
              width: "100%",
              position: "relative",
            }}
          >
            <Reveal>
              <div className="flex items-center gap-3 mb-8">
                <MonoTag>01 — Systems Lab</MonoTag>
                <span
                  style={{
                    display: "block",
                    width: 32,
                    height: 1,
                    background: `${T.primary}55`,
                  }}
                />
              </div>
            </Reveal>
            <Reveal delay={0.08}>
              <h1
                style={{
                  fontFamily: T.display,
                  fontWeight: 600,
                  fontSize: "clamp(3.2rem,7vw,7.5rem)",
                  lineHeight: 1.04,
                  letterSpacing: "-0.03em",
                  color: T.fg,
                  marginBottom: 0,
                }}
              >
                EXPERIENCE
                <br />
                <span style={{ color: T.muted }}>THE SYSTEM.</span>
              </h1>
              <h2
                style={{
                  fontFamily: T.display,
                  fontWeight: 600,
                  fontSize: "clamp(3.2rem,7vw,7.5rem)",
                  lineHeight: 1.04,
                  letterSpacing: "-0.02em",
                  color: T.primary,
                  marginTop: 0,
                }}
              >
                BEFORE YOU BUILD IT.
              </h2>
            </Reveal>
            <Reveal delay={0.18}>
              <p
                style={{
                  fontFamily: T.sans,
                  fontSize: "1rem",
                  lineHeight: 1.75,
                  color: T.muted,
                  maxWidth: "52ch",
                  marginTop: 28,
                }}
              >
                A handful of examples showing what we can build — this is far from a
                complete list. If you can imagine it, we can build it. Click through,
                explore, and see what&apos;s possible.
              </p>
            </Reveal>
            <Reveal delay={0.22}>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  marginTop: 20,
                  maxWidth: "52ch",
                  padding: "14px 16px",
                  background: `${T.primary}0a`,
                  border: `1px solid ${T.primary}33`,
                  borderRadius: 4,
                }}
              >
                <span
                  style={{
                    color: T.primary,
                    fontSize: "14px",
                    flexShrink: 0,
                    marginTop: 1,
                  }}
                >
                  ◈
                </span>
                <p
                  style={{
                    fontFamily: T.sans,
                    fontSize: "0.85rem",
                    lineHeight: 1.7,
                    color: T.muted,
                    margin: 0,
                  }}
                >
                  These demos use Nullshift&apos;s own branding as a placeholder — but
                  everything is built from scratch, so your finished system will be fully
                  bespoke to your clinic. Already have a brand? We&apos;ll match it
                  exactly. Starting fresh? We&apos;ll build one for you.
                </p>
              </div>
            </Reveal>
            <Reveal delay={0.26}>
              <div className="flex items-center gap-4 mt-8">
                <Link
                  href="/book"
                  className="inline-flex items-center gap-3 px-5 h-10 font-medium transition-opacity hover:opacity-90"
                  style={{
                    fontFamily: T.mono,
                    fontSize: "0.78rem",
                    letterSpacing: "0.04em",
                    background: T.primary,
                    color: T.primaryFg,
                    borderRadius: T.r.md,
                    boxShadow: `0 0 24px color-mix(in oklab, ${T.primary} 30%, transparent)`,
                    outline: `1px solid ${T.primary}66`,
                  }}
                >
                  Book a call →
                </Link>
                <span
                  style={{
                    fontFamily: T.mono,
                    fontSize: "9px",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: T.muted,
                  }}
                >
                  {DEMOS.length} live demos below ↓
                </span>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Demo grid */}
        <section style={{ maxWidth: 1120, margin: "0 auto", padding: "80px 24px" }}>
          <div className="grid md:grid-cols-2 gap-5">
            {DEMOS.map((demo, i) => (
              <Reveal key={demo.num} delay={i % 2 === 0 ? 0 : 0.08}>
                <div
                  style={{
                    background: T.surface,
                    border: `1px solid ${T.border}`,
                    borderRadius: 8,
                    padding: 24,
                    display: "flex",
                    flexDirection: "column",
                    gap: 16,
                    height: 580,
                    boxSizing: "border-box",
                    transition: "border-color 0.2s",
                  }}
                  className="group hover:border-[#505055]"
                >
                  {/* Card header */}
                  <div className="flex items-start justify-between">
                    <MonoTag>{demo.num}</MonoTag>
                    <MutedTag>{demo.tag}</MutedTag>
                  </div>

                  {/* Card title + desc */}
                  <div>
                    <h3
                      style={{
                        fontFamily: T.display,
                        fontWeight: 600,
                        fontSize: "1.4rem",
                        letterSpacing: "-0.01em",
                        color: T.fg,
                        marginBottom: 4,
                      }}
                    >
                      {demo.title}
                    </h3>
                    <p
                      style={{
                        fontFamily: T.sans,
                        fontSize: "13px",
                        lineHeight: 1.6,
                        color: T.muted,
                      }}
                    >
                      {demo.desc}
                    </p>
                  </div>

                  {/* Demo area — flex:1 fills exactly the remaining space in the fixed-height card */}
                  <div
                    style={{
                      flex: 1,
                      background: T.bg,
                      border: `1px solid ${T.border}`,
                      borderRadius: 6,
                      padding: 14,
                      overflow: "hidden",
                      position: "relative",
                      minHeight: 0,
                    }}
                  >
                    {/* Toolbar dots */}
                    <div className="flex items-center gap-1.5 mb-3">
                      {["#f87171", "#f59e0b", "#10b981"].map((c) => (
                        <div
                          key={c}
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            background: c,
                            opacity: 0.6,
                          }}
                        />
                      ))}
                      <div
                        style={{
                          flex: 1,
                          height: 1,
                          background: T.border,
                          marginLeft: 4,
                          borderRadius: 1,
                        }}
                      />
                    </div>
                    <div style={{ height: "calc(100% - 24px)" }}>{demo.component}</div>
                  </div>

                  {/* Card footer */}
                  <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
                    <Link
                      href="/book"
                      style={{
                        fontFamily: T.mono,
                        fontSize: "10px",
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: T.primary,
                        textDecoration: "none",
                        transition: "opacity 0.15s",
                      }}
                      className="hover:opacity-70"
                    >
                      Get this built →
                    </Link>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section
          style={{
            borderTop: `1px solid ${T.border}`,
            background: T.surface,
            padding: "80px 24px",
          }}
        >
          <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
            <Reveal>
              <MonoTag>Ready?</MonoTag>
            </Reveal>
            <Reveal delay={0.1}>
              <h2
                style={{
                  fontFamily: T.display,
                  fontWeight: 600,
                  fontSize: "clamp(2.4rem,5vw,5rem)",
                  lineHeight: 1.04,
                  letterSpacing: "-0.03em",
                  color: T.fg,
                  margin: "20px 0 16px",
                }}
              >
                READY TO BUILD
                <br />
                <span style={{ color: T.primary }}>YOUR SYSTEM?</span>
              </h2>
            </Reveal>
            <Reveal delay={0.18}>
              <p
                style={{
                  fontFamily: T.sans,
                  fontSize: "1rem",
                  lineHeight: 1.75,
                  color: T.muted,
                  maxWidth: "46ch",
                  margin: "0 auto 32px",
                }}
              >
                Every system you just explored can be built for your clinic. Let&apos;s
                talk about what you need.
              </p>
            </Reveal>
            <Reveal delay={0.24}>
              <Link
                href="/book"
                className="inline-flex items-center gap-3 px-8 h-12 font-semibold transition-opacity hover:opacity-90"
                style={{
                  fontFamily: T.mono,
                  fontSize: "12px",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  background: T.primary,
                  color: T.primaryFg,
                  borderRadius: 2,
                  boxShadow: `0 0 32px ${T.primary}50`,
                  outline: `1px solid ${T.primary}66`,
                }}
              >
                Book a free call →
              </Link>
            </Reveal>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
