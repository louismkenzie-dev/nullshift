"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { T } from "@/lib/tokens";
import { formatCallDate, formatCallTime, LONDON_TZ } from "@/lib/format";

type Call = {
  id: string; client_id: string; call_date: string; call_time: string; duration_min: number; status: string;
  clients: { name: string; business_name: string | null } | null;
};

const pad = (n: number) => String(n).padStart(2, "0");
const dateKey = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
// Today's date in London, as YYYY-MM-DD (en-CA yields ISO-style output).
const londonToday = () => new Date().toLocaleDateString("en-CA", { timeZone: LONDON_TZ });
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type Cell = { day: number; m: number; y: number; inMonth: boolean; key: string };

export default function CalendarPage() {
  const supabase = createClient();
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);

  const todayStr = londonToday();
  const [view, setView] = useState(() => {
    const [y, m] = todayStr.split("-").map(Number);
    return { y, m: m - 1 };
  });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("calls")
      .select("*, clients(name, business_name)")
      .eq("status", "confirmed")
      .order("call_date").order("call_time");
    setCalls((data as Call[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const byDate = useMemo(() => {
    const map: Record<string, Call[]> = {};
    for (const c of calls) (map[c.call_date] ??= []).push(c);
    return map;
  }, [calls]);

  const upcoming = useMemo(() => calls.filter(c => c.call_date >= todayStr), [calls, todayStr]);

  // Full weeks (Monday-first), padded with trailing/leading days from adjacent
  // months — the way Apple Calendar fills out the grid.
  const cells = useMemo<Cell[]>(() => {
    const firstWeekday = (new Date(view.y, view.m, 1).getDay() + 6) % 7; // Mon=0
    const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
    const prevDays = new Date(view.y, view.m, 0).getDate();
    const out: Cell[] = [];
    for (let i = firstWeekday - 1; i >= 0; i--) {
      const d = prevDays - i;
      const m = view.m === 0 ? 11 : view.m - 1, y = view.m === 0 ? view.y - 1 : view.y;
      out.push({ day: d, m, y, inMonth: false, key: dateKey(y, m, d) });
    }
    for (let d = 1; d <= daysInMonth; d++) out.push({ day: d, m: view.m, y: view.y, inMonth: true, key: dateKey(view.y, view.m, d) });
    let nd = 1;
    while (out.length % 7 !== 0) {
      const m = view.m === 11 ? 0 : view.m + 1, y = view.m === 11 ? view.y + 1 : view.y;
      out.push({ day: nd, m, y, inMonth: false, key: dateKey(y, m, nd) }); nd++;
    }
    return out;
  }, [view]);

  function shift(delta: number) {
    setView(v => {
      const m = v.m + delta;
      return { y: v.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 };
    });
  }
  function goToday() {
    const [y, m] = todayStr.split("-").map(Number);
    setView({ y, m: m - 1 });
  }

  const cellName = (c: Call) => c.clients?.business_name || c.clients?.name || "Client";
  const navBtn: React.CSSProperties = { width: 30, height: 30, display: "grid", placeItems: "center", fontFamily: T.mono, fontSize: 13, color: T.fg, background: T.surface2, borderRadius: 8 };

  return (
    <div>
      <div className="flex items-end justify-between mb-8">
        <div>
          <div style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: T.primary, marginBottom: "8px" }}>// SCHEDULE</div>
          <h1 style={{ fontFamily: T.display, fontWeight: 900, fontSize: "2.4rem", color: T.fg }}>CALL CALENDAR</h1>
        </div>
        <div style={{ fontFamily: T.mono, fontSize: "11px", color: T.muted }}>
          {upcoming.length} upcoming · London time
        </div>
      </div>

      {loading ? (
        <p style={{ fontFamily: T.mono, fontSize: 12, color: T.muted }}>Loading…</p>
      ) : (
        <div className="grid lg:grid-cols-[1fr_300px] gap-6">
          {/* Month grid */}
          <div className="rounded-2xl overflow-hidden" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${T.border}` }}>
              <div className="flex items-baseline gap-2">
                <span style={{ fontFamily: T.display, fontWeight: 900, fontSize: "1.4rem", color: T.fg }}>{MONTHS[view.m]}</span>
                <span style={{ fontFamily: T.display, fontWeight: 900, fontSize: "1.4rem", color: T.muted }}>{view.y}</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={goToday} className="transition-opacity hover:opacity-80" style={{ ...navBtn, width: "auto", padding: "0 12px", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: T.muted }}>Today</button>
                <button onClick={() => shift(-1)} className="transition-opacity hover:opacity-80" style={navBtn}>‹</button>
                <button onClick={() => shift(1)} className="transition-opacity hover:opacity-80" style={navBtn}>›</button>
              </div>
            </div>

            {/* Weekday header */}
            <div className="grid grid-cols-7 px-3 pt-3">
              {WEEKDAYS.map((w, i) => (
                <div key={w} className="text-center pb-2" style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: i >= 5 ? `${T.muted}88` : T.muted }}>{w}</div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-px px-3 pb-3" style={{ background: "transparent" }}>
              {cells.map((c, i) => {
                const dayCalls = c.inMonth ? (byDate[c.key] ?? []) : [];
                const isToday = c.key === todayStr;
                const weekend = i % 7 >= 5;
                return (
                  <div key={c.key + i} className="min-h-[92px] p-2 rounded-lg" style={{ background: c.inMonth ? T.bg : "transparent", opacity: c.inMonth ? 1 : 0.35 }}>
                    <div className="flex justify-end mb-1">
                      <span className="grid place-items-center" style={{
                        width: 22, height: 22, borderRadius: "50%",
                        fontFamily: T.mono, fontSize: 11, lineHeight: 1,
                        background: isToday ? T.primary : "transparent",
                        color: isToday ? T.primaryFg : weekend ? `${T.muted}aa` : T.fg,
                        fontWeight: isToday ? 700 : 400,
                      }}>{c.day}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      {dayCalls.map(call => (
                        <Link key={call.id} href={`/admin/clients/${call.client_id}`}
                          className="block transition-opacity hover:opacity-80 rounded-md px-1.5 py-1"
                          style={{ background: `${T.primary}22`, borderLeft: `2px solid ${T.primary}` }}>
                          <div className="truncate" style={{ fontFamily: T.sans, fontSize: 11, fontWeight: 600, color: T.fg }}>{cellName(call)}</div>
                          <div style={{ fontFamily: T.mono, fontSize: 9, color: T.primary }}>{call.call_time}</div>
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Upcoming list */}
          <div className="rounded-2xl p-5" style={{ background: T.surface, border: `1px solid ${T.border}`, alignSelf: "start" }}>
            <div className="mb-4" style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: T.muted }}>Upcoming calls</div>
            {upcoming.length === 0 ? (
              <p style={{ fontFamily: T.sans, fontSize: "0.85rem", color: T.muted }}>No upcoming calls booked.</p>
            ) : (
              <div className="flex flex-col">
                {upcoming.map((c, i) => (
                  <Link key={c.id} href={`/admin/clients/${c.client_id}`} className="block transition-opacity hover:opacity-80 py-3"
                    style={{ borderTop: i ? `1px solid ${T.border}` : "none" }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.primary, flexShrink: 0 }} />
                      <span style={{ fontFamily: T.display, fontWeight: 900, fontSize: "0.95rem", color: T.fg }}>{cellName(c)}</span>
                    </div>
                    <div style={{ fontFamily: T.sans, fontSize: "0.8rem", color: T.muted, paddingLeft: 14 }}>{formatCallDate(c.call_date)}</div>
                    <div style={{ fontFamily: T.mono, fontSize: "0.74rem", color: T.primary, paddingLeft: 14 }}>{formatCallTime(c.call_time)} · {c.duration_min} min</div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
