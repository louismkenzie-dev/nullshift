"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@nullshift/db/client";
import { T } from "@nullshift/ui/tokens";
import { formatCallDate, formatCallTime, money, LONDON_TZ } from "@nullshift/ui/format";
import { PageHeader, Panel, StatCard, StatusChip } from "@/components/app/AppKit";
import { Reveal } from "@/components/kyma";

// Dashboard reads the unified multi-tenant model: calls + projects + invoices are
// all tenant-scoped, and every client link points at the unified hub
// /admin/clients/[tenantId].
type Call = {
  id: string;
  tenant_id: string;
  call_date: string;
  call_time: string;
  duration_min: number;
  status: string;
  tenants: { name: string } | null;
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

type AwaitingProject = {
  id: string;
  tenant_id: string;
  name: string;
  proposal_status: string;
  tenants: { name: string } | null;
};

type InvoiceRow = { amount: number; status: string; created_at: string };

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

// KYMA app-surface tokens (dark): the dashboard wears the same hairline /
// emerald language as the marketing site via the shared --k-* vars.
const monoLabel: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: "0.62rem",
  fontWeight: 500,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--k-muted)",
};

export default function DashboardPage() {
  const supabase = createClient();
  const [calls, setCalls] = useState<Call[]>([]);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [awaiting, setAwaiting] = useState<AwaitingProject[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
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
      { data: awaitingData },
      { data: invoiceData },
    ] = await Promise.all([
      supabase
        .from("calls")
        .select(
          "id, tenant_id, call_date, call_time, duration_min, status, tenants(name)"
        )
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
        .from("projects")
        .select("id, tenant_id, name, proposal_status, tenants(name)")
        .eq("proposal_status", "sent")
        .order("proposal_sent_at", { ascending: false }),
      supabase.from("invoices").select("amount, status, created_at"),
    ]);
    setCalls((callsData as unknown as Call[]) ?? []);
    setEnquiries((enqData as Enquiry[]) ?? []);
    setAwaiting((awaitingData as unknown as AwaitingProject[]) ?? []);
    setInvoices((invoiceData as InvoiceRow[]) ?? []);
    setLoading(false);
  }, [supabase, todayStr]);

  useEffect(() => {
    load();
  }, [load]);

  const nextCall = calls[0] ?? null;
  const newEnquiries = enquiries.filter((e) => e.status === "new");

  // Invoiced this month (the unified income signal — invoices come from the
  // itemised build modules on each client's hub).
  const monthlyIncome = invoices
    .filter((inv) => {
      const d = new Date(inv.created_at);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    })
    .reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0);

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
      <p style={{ fontFamily: T.mono, fontSize: "12px", color: "var(--k-muted)" }}>
        Loading dashboard…
      </p>
    );
  }

  return (
    <div>
      {/* Header */}
      <PageHeader
        index="01"
        label="OVERVIEW"
        title="DASHBOARD"
        actions={
          <span style={{ ...monoLabel, fontSize: "0.66rem" }}>
            {new Date().toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
              timeZone: LONDON_TZ,
            })}
          </span>
        }
        className="mb-8"
      />

      {/* Stat row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          {
            value: money(monthlyIncome),
            label: "Invoiced this month",
            sub: `${MONTHS[currentMonth]} ${currentYear}`,
            accent: true,
          },
          {
            value: String(newEnquiries.length),
            label: "New enquiries",
            sub: "Awaiting action",
            accent: false,
          },
          {
            value: String(awaiting.length),
            label: "Awaiting acceptance",
            sub: "Proposals sent to clients",
            accent: false,
          },
        ].map((s, i) => (
          <Reveal key={s.label} delay={i * 0.05}>
            <StatCard value={s.value} label={s.label} sub={s.sub} accent={s.accent} />
          </Reveal>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        {/* Left: tasks */}
        <div className="flex flex-col gap-6">
          {/* New enquiries */}
          <Reveal delay={0.1}>
            <Panel
              label="// INBOX"
              title="New enquiries"
              pad={false}
              actions={<ViewAll href="/admin/enquiries" />}
            >
              {newEnquiries.length === 0 ? (
                <EmptyState text="No new enquiries — you're all caught up." />
              ) : (
                <>
                  {newEnquiries.slice(0, 6).map((e, i) => (
                    <Link
                      key={e.id}
                      href="/admin/enquiries"
                      className="flex items-center justify-between py-3.5 px-4 transition-colors"
                      style={{
                        borderTop: i ? "1px solid var(--k-border)" : "none",
                      }}
                      onMouseEnter={(ev) =>
                        (ev.currentTarget.style.background = "rgba(255,255,255,0.03)")
                      }
                      onMouseLeave={(ev) =>
                        (ev.currentTarget.style.background = "transparent")
                      }
                    >
                      <div className="min-w-0">
                        <div
                          style={{
                            fontFamily: T.sans,
                            fontWeight: 700,
                            fontSize: "0.95rem",
                            letterSpacing: "-0.01em",
                            color: "var(--k-fg)",
                          }}
                        >
                          {e.name}
                        </div>
                        {e.business_name && (
                          <div
                            style={{
                              fontFamily: T.sans,
                              fontSize: "0.8rem",
                              color: "var(--k-muted)",
                            }}
                          >
                            {e.business_name}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0 ml-4">
                        <StatusChip tone="warning">
                          <span className="k-livedot" aria-hidden>
                            ●
                          </span>
                          NEW
                        </StatusChip>
                        <span style={{ ...monoLabel, fontSize: "0.6rem" }}>
                          {new Date(e.created_at).toLocaleDateString("en-GB")}
                        </span>
                      </div>
                    </Link>
                  ))}
                  {newEnquiries.length > 6 && (
                    <MoreLink href="/admin/enquiries" count={newEnquiries.length - 6} />
                  )}
                </>
              )}
            </Panel>
          </Reveal>

          {/* Awaiting client acceptance */}
          <Reveal delay={0.15}>
            <Panel
              label="// PROPOSALS SENT"
              title="Awaiting client acceptance"
              pad={false}
              actions={<ViewAll href="/admin/clients" />}
            >
              {awaiting.length === 0 ? (
                <EmptyState text="No proposals are waiting on a client signature." />
              ) : (
                <>
                  {awaiting.slice(0, 6).map((p, i) => (
                    <Link
                      key={p.id}
                      href={`/admin/clients/${p.tenant_id}`}
                      className="flex items-center justify-between py-3.5 px-4 transition-colors"
                      style={{
                        borderTop: i ? "1px solid var(--k-border)" : "none",
                      }}
                      onMouseEnter={(ev) =>
                        (ev.currentTarget.style.background = "rgba(255,255,255,0.03)")
                      }
                      onMouseLeave={(ev) =>
                        (ev.currentTarget.style.background = "transparent")
                      }
                    >
                      <div className="min-w-0">
                        <div
                          style={{
                            fontFamily: T.sans,
                            fontWeight: 700,
                            fontSize: "0.95rem",
                            letterSpacing: "-0.01em",
                            color: "var(--k-fg)",
                          }}
                        >
                          {p.tenants?.name ?? "Client"}
                        </div>
                        <div
                          style={{
                            fontFamily: T.sans,
                            fontSize: "0.8rem",
                            color: "var(--k-muted)",
                          }}
                        >
                          {p.name}
                        </div>
                      </div>
                      <span
                        className="shrink-0 ml-4 inline-flex items-center gap-1.5"
                        style={{
                          fontFamily: T.mono,
                          fontSize: "0.62rem",
                          fontWeight: 500,
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          color: "var(--k-accent)",
                        }}
                      >
                        OPEN
                        <span aria-hidden>→</span>
                      </span>
                    </Link>
                  ))}
                  {awaiting.length > 6 && (
                    <MoreLink href="/admin/clients" count={awaiting.length - 6} />
                  )}
                </>
              )}
            </Panel>
          </Reveal>
        </div>

        {/* Right: calendar + next call */}
        <div className="flex flex-col gap-6">
          {/* Next call */}
          <Reveal delay={0.1}>
            <div
              className="k-kard p-5"
              style={{
                background: "var(--k-surface)",
                border: `1px solid ${nextCall ? "var(--k-accent)" : "var(--k-border)"}`,
              }}
            >
              <div
                style={{
                  fontFamily: T.mono,
                  fontSize: "0.62rem",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--k-accent)",
                  marginBottom: "14px",
                }}
              >
                {"// NEXT CALL"}
              </div>
              {nextCall ? (
                <Link
                  href={`/admin/clients/${nextCall.tenant_id}`}
                  className="block hover:opacity-90 transition-opacity"
                >
                  <div
                    style={{
                      fontFamily: T.sans,
                      fontWeight: 700,
                      fontSize: "1.3rem",
                      letterSpacing: "-0.02em",
                      textTransform: "uppercase",
                      color: "var(--k-fg)",
                      marginBottom: "12px",
                    }}
                  >
                    {nextCall.tenants?.name || "Client"}
                  </div>
                  <div
                    className="flex items-center gap-3 p-3"
                    style={{
                      background: "rgba(16,185,129,0.10)",
                      border: "1px solid rgba(16,185,129,0.28)",
                    }}
                  >
                    <span
                      className="k-livedot"
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: "var(--k-accent)",
                        flexShrink: 0,
                      }}
                    />
                    <div>
                      <div
                        style={{
                          fontFamily: T.sans,
                          fontSize: "0.88rem",
                          color: "var(--k-fg)",
                          fontWeight: 600,
                        }}
                      >
                        {formatCallDate(nextCall.call_date)}
                      </div>
                      <div
                        style={{
                          fontFamily: T.mono,
                          fontSize: "0.78rem",
                          color: "var(--k-accent)",
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
                        fontSize: "0.62rem",
                        color: "var(--k-muted)",
                        letterSpacing: "0.08em",
                      }}
                    >
                      +{calls.length - 1} more upcoming call
                      {calls.length > 2 ? "s" : ""}
                    </div>
                  )}
                </Link>
              ) : (
                <div>
                  <p
                    style={{
                      fontFamily: T.sans,
                      fontSize: "0.88rem",
                      color: "var(--k-muted)",
                      marginBottom: "14px",
                    }}
                  >
                    No upcoming calls booked.
                  </p>
                  <InlineLink href="/admin/calendar" label="VIEW CALENDAR" />
                </div>
              )}
            </div>
          </Reveal>

          {/* Mini calendar */}
          <Reveal delay={0.15}>
            <div
              className="k-kard overflow-hidden"
              style={{
                background: "var(--k-surface)",
                border: "1px solid var(--k-border)",
              }}
            >
              <div
                className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: "1px solid var(--k-border)" }}
              >
                <span
                  style={{
                    fontFamily: T.sans,
                    fontWeight: 700,
                    fontSize: "1rem",
                    letterSpacing: "-0.01em",
                    textTransform: "uppercase",
                    color: "var(--k-fg)",
                  }}
                >
                  {MONTHS[calView.m]}{" "}
                  <span style={{ color: "var(--k-muted)" }}>{calView.y}</span>
                </span>
                <InlineLink href="/admin/calendar" label="FULL CALENDAR" tone="muted" />
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
                        color: i >= 5 ? "var(--k-faint)" : "var(--k-muted)",
                      }}
                    >
                      {w}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-0.5">
                  {cells.map((c) => {
                    if (!c.inMonth) return <div key={c.key} />;
                    const isToday = c.day === todayDay;
                    const hasCall = callDates.has(c.key);
                    return (
                      <div
                        key={c.key}
                        className="aspect-square flex flex-col items-center justify-center relative"
                        style={{
                          background: isToday
                            ? "var(--k-accent)"
                            : hasCall
                              ? "rgba(16,185,129,0.16)"
                              : "transparent",
                        }}
                      >
                        <span
                          style={{
                            fontFamily: T.mono,
                            fontSize: 10,
                            color: isToday ? T.primaryFg : "var(--k-fg)",
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
                              background: "var(--k-accent)",
                            }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </div>
  );
}

/** Mono uppercase "view all →" link for Panel headers. */
function ViewAll({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5"
      style={{
        fontFamily: T.mono,
        fontSize: "0.62rem",
        fontWeight: 500,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "var(--k-muted)",
      }}
    >
      VIEW ALL
      <span aria-hidden>→</span>
    </Link>
  );
}

/** Mono inline link with optional emerald/muted tone. */
function InlineLink({
  href,
  label,
  tone = "accent",
}: {
  href: string;
  label: string;
  tone?: "accent" | "muted";
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5"
      style={{
        fontFamily: T.mono,
        fontSize: "0.62rem",
        fontWeight: 500,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: tone === "muted" ? "var(--k-muted)" : "var(--k-accent)",
      }}
    >
      {label}
      <span aria-hidden>→</span>
    </Link>
  );
}

/** "+N more" footer row inside a list Panel. */
function MoreLink({ href, count }: { href: string; count: number }) {
  return (
    <div style={{ borderTop: "1px solid var(--k-border)", padding: "12px 16px" }}>
      <Link
        href={href}
        className="inline-flex items-center gap-1.5"
        style={{
          fontFamily: T.mono,
          fontSize: "0.62rem",
          fontWeight: 500,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--k-accent)",
        }}
      >
        +{count} more
        <span aria-hidden>→</span>
      </Link>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-7 px-4 text-center">
      <span style={{ fontFamily: T.sans, fontSize: "0.85rem", color: "var(--k-muted)" }}>
        {text}
      </span>
    </div>
  );
}
