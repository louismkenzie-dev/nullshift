"use client";

import React, { useState, useEffect } from "react";
import {
  LayoutDashboard,
  FileText,
  Users,
  BarChart3,
  Globe,
  GraduationCap,
  Search,
  Bell,
  TrendingUp,
  TrendingDown,
  Check,
  Clock,
  AlertCircle,
} from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { T } from "@nullshift/ui/tokens";

/* ════════════════════════════════════════════════════════════════
   Nullshift × Halo — Auto-playing dashboard showcase
   Non-interactive. Cycles through 5 product surfaces on a timer.
   Pure CSS animation (no framer) for rock-solid rendering.
   ════════════════════════════════════════════════════════════════ */

type ViewKey = "invoices" | "crm" | "analytics" | "pages" | "courses";

const NAV: { key: ViewKey; label: string; icon: React.ReactNode }[] = [
  { key: "invoices",  label: "Invoicing", icon: <FileText size={15} /> },
  { key: "crm",       label: "CRM",       icon: <Users size={15} /> },
  { key: "analytics", label: "Analytics", icon: <BarChart3 size={15} /> },
  { key: "pages",     label: "Website",   icon: <Globe size={15} /> },
  { key: "courses",   label: "Courses",   icon: <GraduationCap size={15} /> },
];

const CYCLE = NAV.map((n) => n.key);
const DWELL_MS = 4200;

/* ── Shared bits ─────────────────────────────────────────────── */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontFamily: T.sans, fontSize: "0.6875rem", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: T.muted }}>
      {children}
    </span>
  );
}

function Pill({ tone, children }: { tone: "ok" | "warn" | "bad" | "info" | "neutral"; children: React.ReactNode }) {
  const map = {
    ok:      { c: T.primary, b: `${T.primary}22`, bd: `${T.primary}44` },
    warn:    { c: "#f59e0b", b: "rgba(245,158,11,0.14)", bd: "rgba(245,158,11,0.33)" },
    bad:     { c: T.danger,  b: "rgba(248,113,113,0.14)", bd: "rgba(248,113,113,0.33)" },
    info:    { c: "#3b82f6", b: "rgba(59,130,246,0.14)", bd: "rgba(59,130,246,0.33)" },
    neutral: { c: T.muted,   b: T.surface2, bd: T.border },
  }[tone];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontFamily: T.mono, fontSize: "0.625rem", fontWeight: 500, letterSpacing: "0.04em", padding: "2px 8px", borderRadius: 999, background: map.b, color: map.c, border: `1px solid ${map.bd}`, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

/* Each view auto-swaps on a timer (setState-driven, works everywhere). Content
   is fully visible by default — no opacity/transform gating — so it never
   depends on the animation clock, which some embed/screenshot environments
   freeze. The cycling between surfaces is the demonstration. */
function rowStyle(_i: number): React.CSSProperties {
  return {};
}

/* ════════════════════════════════════════════════════════════════
   VIEW — INVOICING
   ════════════════════════════════════════════════════════════════ */
const INVOICES = [
  { id: "INV-0241", client: "Bloom & Co",    amount: "£4,200", status: "Paid",    tone: "ok"   as const, icon: <Check size={11} /> },
  { id: "INV-0240", client: "Forge Digital", amount: "£2,800", status: "Pending", tone: "warn" as const, icon: <Clock size={11} /> },
  { id: "INV-0239", client: "Studio Priya",  amount: "£1,500", status: "Paid",    tone: "ok"   as const, icon: <Check size={11} /> },
  { id: "INV-0238", client: "Webb Media",    amount: "£3,600", status: "Overdue", tone: "bad"  as const, icon: <AlertCircle size={11} /> },
];

function InvoicesView() {
  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {[
          { label: "Outstanding", value: "£6,400", c: "#f59e0b" },
          { label: "Paid this month", value: "£18,900", c: T.primary },
          { label: "Overdue", value: "£3,600", c: T.danger },
        ].map((s, i) => (
          <div key={s.label} style={{ ...rowStyle(i), background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 16px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: s.c }} />
            <Eyebrow>{s.label}</Eyebrow>
            <p style={{ fontFamily: T.mono, fontSize: "1.5rem", fontWeight: 600, letterSpacing: "-0.02em", color: T.fg, marginTop: 6, lineHeight: 1 }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div className="flex items-center justify-between" style={{ padding: "12px 16px", borderBottom: `1px solid ${T.border}` }}>
          <span style={{ fontFamily: T.sans, fontWeight: 600, fontSize: "0.875rem", color: T.fg }}>Recent invoices</span>
          <Eyebrow>June 2025</Eyebrow>
        </div>
        <div className="grid" style={{ gridTemplateColumns: "90px 1fr 90px 90px", gap: 12, padding: "8px 16px", borderBottom: `1px solid ${T.border}` }}>
          {["Invoice", "Client", "Amount", "Status"].map((h) => <Eyebrow key={h}>{h}</Eyebrow>)}
        </div>
        {INVOICES.map((inv, i) => (
          <div
            key={inv.id}
            className="grid items-center"
            style={{ ...rowStyle(i + 1), gridTemplateColumns: "90px 1fr 90px 90px", gap: 12, padding: "11px 16px", borderBottom: i < INVOICES.length - 1 ? `1px solid ${T.border}` : "none" }}
          >
            <span style={{ fontFamily: T.mono, fontSize: "0.75rem", color: T.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{inv.id}</span>
            <span style={{ fontFamily: T.sans, fontSize: "0.8125rem", fontWeight: 500, color: T.fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{inv.client}</span>
            <span style={{ fontFamily: T.mono, fontSize: "0.8125rem", fontWeight: 600, color: T.fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{inv.amount}</span>
            <span><Pill tone={inv.tone}>{inv.icon}{inv.status}</Pill></span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   VIEW — CRM
   ════════════════════════════════════════════════════════════════ */
const PIPELINE = [
  { stage: "New",       count: 8,  value: "£14.2k", color: "#3b82f6" },
  { stage: "Contacted", count: 5,  value: "£9.8k",  color: "#f59e0b" },
  { stage: "Qualified", count: 3,  value: "£7.1k",  color: "#a78bfa" },
  { stage: "Won",       count: 6,  value: "£21.4k", color: T.primary },
];
const CRM_LEADS = [
  { name: "Sophie Clarke", company: "Bloom & Co",    value: "£4,200", tone: "ok"   as const, status: "Won" },
  { name: "James Okafor",  company: "Forge Digital", value: "£2,800", tone: "info" as const, status: "Qualified" },
  { name: "Marcus Webb",   company: "Webb Media",    value: "£3,600", tone: "warn" as const, status: "Contacted" },
];

function CRMView() {
  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {PIPELINE.map((p, i) => (
          <div
            key={p.stage}
            style={{ ...rowStyle(i), background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 14px", position: "relative", overflow: "hidden" }}
          >
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: p.color }} />
            <Eyebrow>{p.stage}</Eyebrow>
            <p style={{ fontFamily: T.mono, fontSize: "1.375rem", fontWeight: 600, color: T.fg, marginTop: 4, lineHeight: 1 }}>{p.count}</p>
            <p style={{ fontFamily: T.mono, fontSize: "0.6875rem", color: p.color, marginTop: 4 }}>{p.value}</p>
          </div>
        ))}
      </div>

      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, flex: 1, overflow: "hidden" }}>
        <div className="flex items-center justify-between" style={{ padding: "12px 16px", borderBottom: `1px solid ${T.border}` }}>
          <span style={{ fontFamily: T.sans, fontWeight: 600, fontSize: "0.875rem", color: T.fg }}>Active leads</span>
          <Pill tone="ok"><span style={{ width: 6, height: 6, borderRadius: 999, background: T.primary, display: "inline-block" }} />22 open</Pill>
        </div>
        {CRM_LEADS.map((l, i) => (
          <div
            key={l.name}
            className="flex items-center justify-between"
            style={{ ...rowStyle(i + 1), padding: "12px 16px", borderBottom: i < CRM_LEADS.length - 1 ? `1px solid ${T.border}` : "none" }}
          >
            <div className="flex items-center gap-3">
              <div style={{ width: 34, height: 34, borderRadius: 999, background: `${T.primary}18`, border: `1px solid ${T.primary}33`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: T.sans, fontSize: "0.75rem", fontWeight: 600, color: T.primary }}>
                {l.name.split(" ").map((w) => w[0]).join("")}
              </div>
              <div>
                <p style={{ fontFamily: T.sans, fontSize: "0.8125rem", fontWeight: 500, color: T.fg }}>{l.name}</p>
                <p style={{ fontFamily: T.mono, fontSize: "0.6875rem", color: T.muted }}>{l.company}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span style={{ fontFamily: T.mono, fontSize: "0.8125rem", fontWeight: 600, color: T.fg }}>{l.value}</span>
              <Pill tone={l.tone}>{l.status}</Pill>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   VIEW — ANALYTICS
   ════════════════════════════════════════════════════════════════ */
const ANALYTICS_KPI = [
  { label: "Revenue",    value: "£12,480", delta: "+18%", up: true },
  { label: "New users",  value: "342",     delta: "+24%", up: true },
  { label: "Conversion", value: "3.2%",    delta: "+0.4%", up: true },
  { label: "Bounce",     value: "38%",     delta: "-5%",  up: false },
];
const BARS = [42, 67, 55, 89, 73, 94, 81, 62, 78, 88, 70, 96];

function AnalyticsView() {
  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {ANALYTICS_KPI.map((k, i) => (
          <div
            key={k.label}
            style={{ ...rowStyle(i), background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 14px" }}
          >
            <Eyebrow>{k.label}</Eyebrow>
            <p style={{ fontFamily: T.mono, fontSize: "1.375rem", fontWeight: 600, letterSpacing: "-0.02em", color: T.fg, marginTop: 4, lineHeight: 1 }}>{k.value}</p>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontFamily: T.mono, fontSize: "0.6875rem", color: k.up ? T.primary : T.danger, marginTop: 5 }}>
              {k.up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}{k.delta}
            </span>
          </div>
        ))}
      </div>

      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, flex: 1, padding: "16px 18px", display: "flex", flexDirection: "column" }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
          <span style={{ fontFamily: T.sans, fontWeight: 600, fontSize: "0.875rem", color: T.fg }}>Sessions overview</span>
          <Pill tone="neutral">Last 12 weeks</Pill>
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 8 }}>
          {BARS.map((v, i) => (
            <div key={i} style={{ flex: 1, height: "100%", display: "flex", alignItems: "flex-end" }}>
              <div
                style={{
                  width: "100%", height: `${v}%`,
                  background: i === BARS.length - 1 ? T.primary : `${T.primary}40`,
                  borderRadius: "4px 4px 0 0", minHeight: 4,
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   VIEW — WEBSITE PAGES
   ════════════════════════════════════════════════════════════════ */
const PAGES = [
  { path: "/",         title: "Home",        views: "8,240", change: "+12%", tone: "ok"   as const, status: "Published" },
  { path: "/work",     title: "Our Work",    views: "3,180", change: "+8%",  tone: "ok"   as const, status: "Published" },
  { path: "/pricing",  title: "Pricing",     views: "2,940", change: "+21%", tone: "ok"   as const, status: "Published" },
  { path: "/about",    title: "About",       views: "1,560", change: "-3%",  tone: "warn" as const, status: "Draft" },
];

function PagesView() {
  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {[
          { label: "Total pages", value: "14" },
          { label: "Monthly views", value: "16.2k" },
          { label: "Avg. load", value: "0.8s" },
        ].map((s, i) => (
          <div key={s.label} style={{ ...rowStyle(i), background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 16px" }}>
            <Eyebrow>{s.label}</Eyebrow>
            <p style={{ fontFamily: T.mono, fontSize: "1.5rem", fontWeight: 600, letterSpacing: "-0.02em", color: T.fg, marginTop: 6, lineHeight: 1 }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, flex: 1, overflow: "hidden" }}>
        <div className="flex items-center justify-between" style={{ padding: "12px 16px", borderBottom: `1px solid ${T.border}` }}>
          <span style={{ fontFamily: T.sans, fontWeight: 600, fontSize: "0.875rem", color: T.fg }}>Pages</span>
          <Eyebrow>Traffic · 30d</Eyebrow>
        </div>
        {PAGES.map((p, i) => (
          <div
            key={p.path}
            className="flex items-center justify-between"
            style={{ ...rowStyle(i + 1), padding: "12px 16px", borderBottom: i < PAGES.length - 1 ? `1px solid ${T.border}` : "none" }}
          >
            <div className="flex items-center gap-3">
              <div style={{ width: 32, height: 32, borderRadius: 8, background: T.surface2, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", color: T.muted }}>
                <Globe size={14} />
              </div>
              <div>
                <p style={{ fontFamily: T.sans, fontSize: "0.8125rem", fontWeight: 500, color: T.fg }}>{p.title}</p>
                <p style={{ fontFamily: T.mono, fontSize: "0.6875rem", color: T.muted }}>{p.path}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div style={{ textAlign: "right" }}>
                <p style={{ fontFamily: T.mono, fontSize: "0.8125rem", fontWeight: 600, color: T.fg }}>{p.views}</p>
                <span style={{ fontFamily: T.mono, fontSize: "0.625rem", color: p.tone === "ok" ? T.primary : "#f59e0b" }}>{p.change}</span>
              </div>
              <Pill tone={p.status === "Published" ? "ok" : "neutral"}>{p.status}</Pill>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   VIEW — COURSES
   ════════════════════════════════════════════════════════════════ */
const COURSES = [
  { title: "Brand Strategy",   progress: 100, tag: "Complete",    color: T.primary,  active: false },
  { title: "Web Fundamentals", progress: 72,  tag: "In progress", color: "#3b82f6",  active: true },
  { title: "Email Marketing",  progress: 40,  tag: "In progress", color: "#f59e0b",  active: false },
  { title: "SEO Basics",       progress: 0,   tag: "Not started", color: T.muted,    active: false },
];

function CoursesView() {
  return (
    <div className="flex flex-col gap-4 h-full">
      <div style={{ ...rowStyle(0), background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 16px" }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
          <span style={{ fontFamily: T.sans, fontWeight: 600, fontSize: "0.875rem", color: T.fg }}>My learning path</span>
          <Pill tone="ok">3 / 8 modules</Pill>
        </div>
        <div style={{ height: 6, background: T.border, borderRadius: 999, overflow: "hidden" }}>
          <div style={{ height: "100%", width: "37%", background: T.primary, borderRadius: 999 }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 flex-1">
        {COURSES.map((c, i) => (
          <div
            key={c.title}
            style={{
              ...rowStyle(i + 1),
              background: T.surface,
              border: c.active ? `1px solid ${T.primary}66` : `1px solid ${T.border}`,
              borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10,
              boxShadow: c.active ? `0 0 24px ${T.primary}18` : "none",
            }}
          >
            <div className="flex items-start justify-between">
              <div style={{ width: 34, height: 34, borderRadius: 8, background: `${c.color}18`, border: `1px solid ${c.color}33`, display: "flex", alignItems: "center", justifyContent: "center", color: c.color }}>
                <GraduationCap size={16} />
              </div>
              {c.active && <Pill tone="ok">Active</Pill>}
            </div>
            <div>
              <p style={{ fontFamily: T.sans, fontSize: "0.8125rem", fontWeight: 600, color: T.fg, marginBottom: 3 }}>{c.title}</p>
              <Eyebrow>{c.tag}</Eyebrow>
            </div>
            <div style={{ height: 4, background: T.border, borderRadius: 999, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${c.progress}%`, background: c.color, borderRadius: 999 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   SHELL
   ════════════════════════════════════════════════════════════════ */
const VIEWS: Record<ViewKey, React.ReactNode> = {
  invoices: <InvoicesView />,
  crm: <CRMView />,
  analytics: <AnalyticsView />,
  pages: <PagesView />,
  courses: <CoursesView />,
};

const TITLES: Record<ViewKey, string> = {
  invoices: "Invoicing",
  crm: "CRM · Leads pipeline",
  analytics: "Analytics",
  pages: "Website pages",
  courses: "Courses",
};

export function DashboardShowcase() {
  const [idx, setIdx] = useState(0);
  const active = CYCLE[idx];

  useEffect(() => {
    const t = setTimeout(() => setIdx((p) => (p + 1) % CYCLE.length), DWELL_MS);
    return () => clearTimeout(t);
  }, [idx]);

  return (
    <div
      className="relative w-full overflow-hidden aspect-[4/3] sm:aspect-[16/10]"
      style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 16,
        boxShadow: `0 0 0 1px rgba(255,255,255,0.03) inset, 0 50px 120px -16px rgba(0,0,0,0.9)`,
      }}
    >
      <div className="flex absolute inset-0" style={{ background: T.bg }}>
        {/* ── Sidebar ─────────────────────────────── */}
        <aside
          className="hidden sm:flex flex-col shrink-0"
          style={{ width: "clamp(150px, 18%, 200px)", background: T.surface, borderRight: `1px solid ${T.border}` }}
        >
          <div className="flex items-center gap-2" style={{ padding: "16px 16px", borderBottom: `1px solid ${T.border}`, height: 56 }}>
            <LogoMark size={20} />
            <span style={{ fontFamily: T.sans, fontWeight: 700, fontSize: "0.875rem", letterSpacing: "-0.01em", color: T.fg }}>Nullshift</span>
          </div>

          <div style={{ padding: "12px 10px 6px" }}>
            <span style={{ fontFamily: T.sans, fontSize: "0.625rem", fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: T.muted, paddingLeft: 8 }}>Workspace</span>
          </div>
          <nav className="flex flex-col gap-1" style={{ padding: "0 10px" }}>
            <SidebarItem icon={<LayoutDashboard size={15} />} label="Dashboard" active={false} />
            {NAV.map((n) => (
              <SidebarItem key={n.key} icon={n.icon} label={n.label} active={n.key === active} />
            ))}
          </nav>

          <div style={{ marginTop: "auto", padding: 12, borderTop: `1px solid ${T.border}` }}>
            <div className="flex items-center gap-2.5" style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 10, padding: "8px 10px" }}>
              <div style={{ width: 28, height: 28, borderRadius: 999, background: `${T.primary}18`, border: `1px solid ${T.primary}33`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: T.sans, fontSize: "0.6875rem", fontWeight: 600, color: T.primary }}>SC</div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontFamily: T.sans, fontSize: "0.6875rem", fontWeight: 600, color: T.fg, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Sophie Clarke</p>
                <p style={{ fontFamily: T.mono, fontSize: "0.5625rem", color: T.muted }}>Admin</p>
              </div>
            </div>
          </div>
        </aside>

        {/* ── Main ────────────────────────────────── */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Topbar */}
          <div className="flex items-center justify-between shrink-0" style={{ padding: "0 18px", height: 56, borderBottom: `1px solid ${T.border}`, background: T.surface }}>
            <span style={{ fontFamily: T.sans, fontWeight: 600, fontSize: "0.9375rem", letterSpacing: "-0.01em", color: T.fg }}>
              {TITLES[active]}
            </span>
            <div className="flex items-center gap-2">
              <div className="hidden md:flex items-center gap-2" style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 999, padding: "6px 12px", width: 160 }}>
                <Search size={13} color={T.muted} />
                <span style={{ fontFamily: T.sans, fontSize: "0.75rem", color: T.muted }}>Search…</span>
              </div>
              <div style={{ width: 32, height: 32, borderRadius: 999, background: T.surface2, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", color: T.muted, position: "relative" }}>
                <Bell size={14} />
                <span style={{ position: "absolute", top: 6, right: 7, width: 6, height: 6, borderRadius: 999, background: T.primary, border: `1.5px solid ${T.surface}` }} />
              </div>
            </div>
          </div>

          {/* Tab strip */}
          <div className="flex items-center gap-1 shrink-0 overflow-hidden" style={{ padding: "10px 16px 0", background: T.bg }}>
            {NAV.map((n) => (
              <div
                key={n.key}
                className="flex items-center gap-1.5"
                style={{
                  fontFamily: T.sans, fontSize: "0.75rem", fontWeight: 500,
                  padding: "6px 12px", borderRadius: "8px 8px 0 0",
                  color: n.key === active ? T.fg : T.muted,
                  background: n.key === active ? T.surface : "transparent",
                  borderTop: `1px solid ${n.key === active ? T.border : "transparent"}`,
                  borderLeft: `1px solid ${n.key === active ? T.border : "transparent"}`,
                  borderRight: `1px solid ${n.key === active ? T.border : "transparent"}`,
                  whiteSpace: "nowrap", transition: "color 0.3s, background 0.3s",
                }}
              >
                <span style={{ color: n.key === active ? T.primary : T.muted, display: "inline-flex" }}>{n.icon}</span>
                <span className="hidden md:inline">{n.label}</span>
              </div>
            ))}
          </div>

          {/* View body — swaps on `active`. transition: opacity keeps a soft
              crossfade in real browsers without ever gating base visibility. */}
          <div className="flex-1 min-h-0" style={{ padding: "16px 18px", background: T.surface, borderTop: `1px solid ${T.border}` }}>
            <div className="h-full">
              {VIEWS[active]}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SidebarItem({ icon, label, active }: { icon: React.ReactNode; label: string; active: boolean }) {
  return (
    <div
      className="flex items-center gap-2.5"
      style={{
        padding: "8px 10px", borderRadius: 8,
        background: active ? `${T.primary}14` : "transparent",
        borderLeft: `2px solid ${active ? T.primary : "transparent"}`,
        transition: "background 0.3s, border-color 0.3s",
      }}
    >
      <span style={{ color: active ? T.primary : T.muted, display: "inline-flex" }}>{icon}</span>
      <span style={{ fontFamily: T.sans, fontSize: "0.8125rem", fontWeight: active ? 600 : 500, color: active ? T.fg : T.muted, whiteSpace: "nowrap" }}>{label}</span>
    </div>
  );
}
