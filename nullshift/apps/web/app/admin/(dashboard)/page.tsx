"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@nullshift/db/client";
import { T } from "@nullshift/ui/tokens";
import { formatCallDate, formatCallTime, money, LONDON_TZ } from "@nullshift/ui/format";

type Call = {
  id: string;
  client_id: string;
  call_date: string;
  call_time: string;
  duration_min: number;
  status: string;
  clients: { name: string; business_name: string | null } | null;
};

type Enquiry = {
  id: string;
  created_at: string;
  name: string;
  business_name: string | null;
  email: string;
  status: string;
  source: string;
};

type Client = {
  id: string;
  name: string;
  business_name: string | null;
  email: string | null;
  status: string;
  brief_completed_at: string | null;
};

type Proposal = {
  id: string;
  title: string;
  total: number;
  currency: string;
  status: string;
  accepted_at: string | null;
  client_id: string | null;
};

const pad = (n: number) => String(n).padStart(2, "0");
const londonToday = () => new Date().toLocaleDateString("en-CA", { timeZone: LONDON_TZ });
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function DashboardPage() {
  const supabase = createClient();
  const [calls, setCalls] = useState<Call[]>([]);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);

  const todayStr = londonToday();
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const load = useCallback(async () => {
    setLoading(true);
    const [
      { data: callsData },
      { data: enqData },
      { data: clientsData },
      { data: proposalsData },
    ] = await Promise.all([
      supabase
        .from("calls")
        .select("*, clients(name, business_name)")
        .eq("status", "confirmed")
        .gte("call_date", todayStr)
        .order("call_date")
        .order("call_time"),
      supabase
        .from("enquiries")
        .select("id, created_at, name, business_name, email, status, source")
        .neq("status", "converted")
        .order("created_at", { ascending: false }),
      supabase
        .from("clients")
        .select("id, name, business_name, email, status, brief_completed_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("proposals")
        .select("id, title, total, currency, status, accepted_at, client_id")
        .order("created_at", { ascending: false }),
    ]);
    setCalls((callsData as Call[]) ?? []);
    setEnquiries((enqData as Enquiry[]) ?? []);
    setClients((clientsData as Client[]) ?? []);
    setProposals((proposalsData as Proposal[]) ?? []);
    setLoading(false);
  }, [supabase, todayStr]);

  useEffect(() => {
    load();
  }, [load]);

  const nextCall = calls[0] ?? null;
  const newEnquiries = enquiries.filter((e) => e.status === "new");
  const missingBriefClients = clients.filter(
    (c) => !c.brief_completed_at && !["won", "lost"].includes(c.status)
  );

  const monthlyIncome = proposals
    .filter((p) => {
      if (p.status !== "accepted" || !p.accepted_at) return false;
      const d = new Date(p.accepted_at);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    })
    .reduce((sum, p) => sum + (p.total || 0), 0);

  // Mini calendar
  const calView = useMemo(() => {
    const [y, m] = todayStr.split("-").map(Number);
    return { y, m: m - 1 };
  }, [todayStr]);

  const callDates = useMemo(() => {
    const s = new Set<string>();
    for (const c of calls) s.add(c.call_date);
    return s;
  }, [calls]);

  const cells = useMemo(() => {
    const firstWeekday = (new Date(calView.y, calView.m, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(calView.y, calView.m + 1, 0).getDate();
    const out: { day: number; key: string; inMonth: boolean }[] = [];
    for (let i = 0; i < firstWeekday; i++)
      out.push({ day: 0, key: `pre-${i}`, inMonth: false });
    for (let d = 1; d <= daysInMonth; d++) {
      out.push({
        day: d,
        key: `${calView.y}-${pad(calView.m + 1)}-${pad(d)}`,
        inMonth: true,
      });
    }
    return out;
  }, [calView]);

  const todayDay = parseInt(todayStr.split("-")[2]);

  if (loading) {
    return (
      <p style={{ fontFamily: T.mono, fontSize: "12px", color: T.muted }}>
        Loading dashboard…
      </p>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <div
            style={{
              fontFamily: T.mono,
              fontSize: "10px",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: T.primary,
              marginBottom: "8px",
            }}
          >
            // OVERVIEW
          </div>
          <h1
            style={{
              fontFamily: T.display,
              fontWeight: 600,
              fontSize: "2.4rem",
              letterSpacing: "0.01em",
              color: T.fg,
            }}
          >
            DASHBOARD
          </h1>
        </div>
        <div style={{ fontFamily: T.mono, fontSize: "11px", color: T.muted }}>
          {new Date().toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
            timeZone: LONDON_TZ,
          })}
        </div>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard
          label="Expected income"
          sublabel={`${MONTHS[currentMonth]} ${currentYear} · signed proposals`}
          value={money(monthlyIncome)}
          accent={T.primary}
        />
        <StatCard
          label="New enquiries"
          sublabel="Awaiting action"
          value={String(newEnquiries.length)}
          accent={newEnquiries.length > 0 ? "#facc15" : T.primary}
        />
        <StatCard
          label="Missing brief link"
          sublabel="Active clients"
          value={String(missingBriefClients.length)}
          accent={missingBriefClients.length > 0 ? T.accent : T.primary}
        />
      </div>

      {/* Main grid */}
      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        {/* Left: tasks */}
        <div className="flex flex-col gap-6">
          {/* New enquiries */}
          <Section title="New enquiries" label="// INBOX" href="/admin/enquiries">
            {newEnquiries.length === 0 ? (
              <EmptyState text="No new enquiries — you're all caught up." />
            ) : (
              <>
                {newEnquiries.slice(0, 6).map((e, i) => (
                  <Link
                    key={e.id}
                    href="/admin/enquiries"
                    className="flex items-center justify-between py-3 px-3 hover:bg-[#1f1f23] rounded-lg transition-colors"
                    style={{ borderTop: i ? `1px solid ${T.border}` : "none" }}
                  >
                    <div className="min-w-0">
                      <div
                        style={{
                          fontFamily: T.display,
                          fontWeight: 600,
                          fontSize: "0.95rem",
                          color: T.fg,
                        }}
                      >
                        {e.name}
                      </div>
                      {e.business_name && (
                        <div
                          style={{
                            fontFamily: T.sans,
                            fontSize: "0.8rem",
                            color: T.muted,
                          }}
                        >
                          {e.business_name}
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <div
                        style={{
                          fontFamily: T.mono,
                          fontSize: "10px",
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          color: "#facc15",
                        }}
                      >
                        ● new
                      </div>
                      <div
                        style={{ fontFamily: T.mono, fontSize: "10px", color: T.muted }}
                      >
                        {new Date(e.created_at).toLocaleDateString("en-GB")}
                      </div>
                    </div>
                  </Link>
                ))}
                {newEnquiries.length > 6 && (
                  <div
                    style={{
                      borderTop: `1px solid ${T.border}`,
                      paddingTop: "10px",
                      paddingLeft: "12px",
                    }}
                  >
                    <Link
                      href="/admin/enquiries"
                      style={{
                        fontFamily: T.mono,
                        fontSize: "10px",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: T.primary,
                      }}
                    >
                      +{newEnquiries.length - 6} more →
                    </Link>
                  </div>
                )}
              </>
            )}
          </Section>

          {/* Missing brief */}
          <Section
            title="Brief link not sent"
            label="// ACTION NEEDED"
            href="/admin/clients"
          >
            {missingBriefClients.length === 0 ? (
              <EmptyState text="All active clients have received their brief link." />
            ) : (
              <>
                {missingBriefClients.slice(0, 6).map((c, i) => (
                  <Link
                    key={c.id}
                    href={`/admin/clients/${c.id}`}
                    className="flex items-center justify-between py-3 px-3 hover:bg-[#1f1f23] rounded-lg transition-colors"
                    style={{ borderTop: i ? `1px solid ${T.border}` : "none" }}
                  >
                    <div className="min-w-0">
                      <div
                        style={{
                          fontFamily: T.display,
                          fontWeight: 600,
                          fontSize: "0.95rem",
                          color: T.fg,
                        }}
                      >
                        {c.name}
                      </div>
                      {c.business_name && (
                        <div
                          style={{
                            fontFamily: T.sans,
                            fontSize: "0.8rem",
                            color: T.muted,
                          }}
                        >
                          {c.business_name}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 ml-4">
                      <span
                        style={{
                          fontFamily: T.mono,
                          fontSize: "10px",
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          color: T.accent,
                        }}
                      >
                        Send brief →
                      </span>
                    </div>
                  </Link>
                ))}
                {missingBriefClients.length > 6 && (
                  <div
                    style={{
                      borderTop: `1px solid ${T.border}`,
                      paddingTop: "10px",
                      paddingLeft: "12px",
                    }}
                  >
                    <Link
                      href="/admin/clients"
                      style={{
                        fontFamily: T.mono,
                        fontSize: "10px",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: T.primary,
                      }}
                    >
                      +{missingBriefClients.length - 6} more →
                    </Link>
                  </div>
                )}
              </>
            )}
          </Section>
        </div>

        {/* Right: calendar + next call */}
        <div className="flex flex-col gap-6">
          {/* Next call */}
          <div
            className="rounded-2xl p-5"
            style={{
              background: T.surface,
              border: `1px solid ${nextCall ? T.primary : T.border}`,
              boxShadow: nextCall ? `0 0 30px -8px ${T.primary}50` : "none",
            }}
          >
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
              // NEXT CALL
            </div>
            {nextCall ? (
              <Link
                href={`/admin/clients/${nextCall.client_id}`}
                className="block hover:opacity-90 transition-opacity"
              >
                <div
                  style={{
                    fontFamily: T.display,
                    fontWeight: 600,
                    fontSize: "1.3rem",
                    color: T.fg,
                    marginBottom: "2px",
                  }}
                >
                  {nextCall.clients?.business_name || nextCall.clients?.name || "Client"}
                </div>
                {nextCall.clients?.business_name && (
                  <div
                    style={{
                      fontFamily: T.sans,
                      fontSize: "0.82rem",
                      color: T.muted,
                      marginBottom: "10px",
                    }}
                  >
                    {nextCall.clients.name}
                  </div>
                )}
                <div
                  className="flex items-center gap-3 p-3 rounded-lg"
                  style={{
                    background: `${T.primary}14`,
                    border: `1px solid ${T.primary}30`,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: T.primary,
                      flexShrink: 0,
                    }}
                  />
                  <div>
                    <div
                      style={{
                        fontFamily: T.sans,
                        fontSize: "0.88rem",
                        color: T.fg,
                        fontWeight: 600,
                      }}
                    >
                      {formatCallDate(nextCall.call_date)}
                    </div>
                    <div
                      style={{
                        fontFamily: T.mono,
                        fontSize: "0.78rem",
                        color: T.primary,
                      }}
                    >
                      {formatCallTime(nextCall.call_time)} · {nextCall.duration_min} min
                    </div>
                  </div>
                </div>
                {calls.length > 1 && (
                  <div
                    className="mt-3"
                    style={{
                      fontFamily: T.mono,
                      fontSize: "10px",
                      color: T.muted,
                      letterSpacing: "0.06em",
                    }}
                  >
                    +{calls.length - 1} more upcoming call{calls.length > 2 ? "s" : ""}
                  </div>
                )}
              </Link>
            ) : (
              <div>
                <p
                  style={{
                    fontFamily: T.sans,
                    fontSize: "0.88rem",
                    color: T.muted,
                    marginBottom: "12px",
                  }}
                >
                  No upcoming calls booked.
                </p>
                <Link
                  href="/admin/calendar"
                  style={{
                    fontFamily: T.mono,
                    fontSize: "10px",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: T.primary,
                  }}
                >
                  View calendar →
                </Link>
              </div>
            )}
          </div>

          {/* Mini calendar */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: T.surface, border: `1px solid ${T.border}` }}
          >
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: `1px solid ${T.border}` }}
            >
              <span
                style={{
                  fontFamily: T.display,
                  fontWeight: 600,
                  fontSize: "1rem",
                  color: T.fg,
                }}
              >
                {MONTHS[calView.m]} <span style={{ color: T.muted }}>{calView.y}</span>
              </span>
              <Link
                href="/admin/calendar"
                style={{
                  fontFamily: T.mono,
                  fontSize: "10px",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: T.muted,
                }}
              >
                Full calendar →
              </Link>
            </div>
            <div className="p-3">
              <div className="grid grid-cols-7 mb-1">
                {WEEKDAYS.map((w, i) => (
                  <div
                    key={w}
                    className="text-center py-1"
                    style={{
                      fontFamily: T.mono,
                      fontSize: 8,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: i >= 5 ? `${T.muted}55` : T.muted,
                    }}
                  >
                    {w}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {cells.map((c, i) => {
                  if (!c.inMonth) return <div key={c.key} />;
                  const isToday = c.day === todayDay;
                  const hasCall = callDates.has(c.key);
                  return (
                    <div
                      key={c.key}
                      className="aspect-square flex flex-col items-center justify-center rounded-md relative"
                      style={{
                        background: isToday
                          ? T.primary
                          : hasCall
                            ? `${T.primary}20`
                            : "transparent",
                      }}
                    >
                      <span
                        style={{
                          fontFamily: T.mono,
                          fontSize: 10,
                          color: isToday ? T.primaryFg : T.fg,
                          fontWeight: isToday ? 700 : 400,
                        }}
                      >
                        {c.day}
                      </span>
                      {hasCall && !isToday && (
                        <span
                          style={{
                            position: "absolute",
                            bottom: 3,
                            width: 3,
                            height: 3,
                            borderRadius: "50%",
                            background: T.primary,
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  sublabel,
  value,
  accent,
}: {
  label: string;
  sublabel: string;
  value: string;
  accent: string;
}) {
  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: T.surface, border: `1px solid ${T.border}` }}
    >
      <div
        style={{
          fontFamily: T.mono,
          fontSize: "10px",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: T.muted,
          marginBottom: "8px",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: T.display,
          fontWeight: 600,
          fontSize: "1.9rem",
          color: accent,
          lineHeight: 1,
          marginBottom: "6px",
        }}
      >
        {value}
      </div>
      <div style={{ fontFamily: T.mono, fontSize: "10px", color: T.muted }}>
        {sublabel}
      </div>
    </div>
  );
}

function Section({
  title,
  label,
  href,
  children,
}: {
  title: string;
  label: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: T.surface, border: `1px solid ${T.border}` }}
    >
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: `1px solid ${T.border}` }}
      >
        <div>
          <div
            style={{
              fontFamily: T.mono,
              fontSize: "9px",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: T.primary,
              marginBottom: "2px",
            }}
          >
            {label}
          </div>
          <div
            style={{
              fontFamily: T.display,
              fontWeight: 600,
              fontSize: "1rem",
              color: T.fg,
            }}
          >
            {title}
          </div>
        </div>
        <Link
          href={href}
          style={{
            fontFamily: T.mono,
            fontSize: "10px",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: T.muted,
          }}
        >
          View all →
        </Link>
      </div>
      <div className="px-2 py-1">{children}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-6 px-3 text-center">
      <span style={{ fontFamily: T.sans, fontSize: "0.85rem", color: T.muted }}>
        {text}
      </span>
    </div>
  );
}
