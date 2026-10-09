import Link from "next/link";
import { createClient } from "@nullshift/db";
import { requireStaff } from "@nullshift/auth/guards";
import { redirect } from "next/navigation";
import { SubmitButton } from "@/components/admin/SubmitButton";
import s from "../../shell.module.css";
import { Notice } from "../../sales/ops-ui";
import {
  addException,
  deleteException,
  deleteRule,
  saveRule,
  saveSettings,
} from "./actions";

export const dynamic = "force-dynamic";

const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const hhmm = (t: string | null) => (t ? t.slice(0, 5) : "");

type Rule = {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  slot_minutes: number;
  active: boolean;
};
type Exception = {
  id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
};
type Settings = {
  min_notice_hours: number;
  max_days_ahead: number;
  buffer_minutes: number;
  meeting_link: string | null;
  active: boolean;
};

const input: React.CSSProperties = {
  height: 36,
  padding: "0 10px",
  background: "var(--ns-bg, transparent)",
  border: "1px solid var(--ns-border-strong)",
  color: "var(--ns-fg)",
  font: "inherit",
  fontSize: 13,
  minWidth: 0,
};
const row: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 10,
};
const label: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  fontSize: 12,
  color: "var(--ns-muted)",
};

export default async function AvailabilityPage() {
  const staff = await requireStaff();
  if (!staff.ok)
    redirect(
      staff.reason === "unauthenticated"
        ? "/admin/login?next=%2Fadmin%2Fcalendar%2Favailability"
        : "/admin/login?error=forbidden"
    );
  const db = await createClient();
  const [rules, exceptions, settings] = await Promise.all([
    db.from("availability_rules").select("*").order("weekday").order("start_time"),
    db
      .from("availability_exceptions")
      .select("*")
      .gte("date", new Date().toISOString().slice(0, 10))
      .order("date"),
    db.from("booking_settings").select("*").eq("id", 1).maybeSingle(),
  ]);
  const missing = rules.error?.code === "42P01" || settings.error?.code === "42P01";
  const RULES = (rules.data ?? []) as Rule[];
  const EXCEPTIONS = (exceptions.data ?? []) as Exception[];
  const SETTINGS: Settings = (settings.data as Settings | null) ?? {
    min_notice_hours: 12,
    max_days_ahead: 30,
    buffer_minutes: 15,
    meeting_link: null,
    active: true,
  };
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <div className={s.pageHead}>
        <div>
          <p className={s.mono}>Schedule · availability · London time</p>
          <h1 className={s.h1}>Availability</h1>
          <p className={s.lead}>
            What the website offers on <Link href="/book/call">/book/call</Link> and{" "}
            <Link href="/book/partner">/book/partner</Link>. Weekly windows minus blocked
            dates, minus anything already in the diary (website bookings and legacy
            calls), padded by the buffer. Changes are live immediately.
          </p>
        </div>
        <div style={row}>
          <Link href="/admin/calendar" className={s.btn}>
            ← Calendar
          </Link>
        </div>
      </div>

      {missing && (
        <Notice tone="warning">
          Migration 0070_bookings.sql has not been applied to this database yet. Apply it
          and reload.
        </Notice>
      )}

      <div className={s.grid12} style={{ marginTop: 24 }}>
        <section className={`${s.card} ${s.span8}`} aria-labelledby="rules">
          <div className={s.cardTitle}>
            <h2 className={s.h2} id="rules" style={{ margin: 0 }}>
              Weekly windows
            </h2>
            <span className={s.mono}>{RULES.filter((r) => r.active).length} active</span>
          </div>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Day</th>
                <th>From</th>
                <th>To</th>
                <th>Slot</th>
                <th>On</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {RULES.map((r) => (
                <tr key={r.id}>
                  <td colSpan={6} style={{ padding: "8px 12px" }}>
                    <form action={saveRule} style={row}>
                      <input type="hidden" name="id" value={r.id} />
                      <select name="weekday" defaultValue={r.weekday} style={input}>
                        {WEEKDAYS.map((d, i) => (
                          <option key={d} value={i}>
                            {d}
                          </option>
                        ))}
                      </select>
                      <input
                        type="time"
                        name="start_time"
                        defaultValue={hhmm(r.start_time)}
                        required
                        style={input}
                      />
                      <span className={s.faint}>to</span>
                      <input
                        type="time"
                        name="end_time"
                        defaultValue={hhmm(r.end_time)}
                        required
                        style={input}
                      />
                      <select
                        name="slot_minutes"
                        defaultValue={r.slot_minutes}
                        style={input}
                      >
                        {[15, 20, 30, 45, 60].map((m) => (
                          <option key={m} value={m}>
                            {m} min
                          </option>
                        ))}
                      </select>
                      <label style={{ ...row, gap: 6, fontSize: 13 }}>
                        <input type="checkbox" name="active" defaultChecked={r.active} />{" "}
                        on
                      </label>
                      <SubmitButton className={`${s.btn} ${s.btnSmall}`}>
                        Save
                      </SubmitButton>
                      <SubmitButton
                        className={`${s.btn} ${s.btnSmall}`}
                        formAction={deleteRule}
                        style={{ color: "var(--ns-danger, #ffa5a0)" }}
                      >
                        Remove
                      </SubmitButton>
                    </form>
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={6} style={{ padding: "8px 12px" }}>
                  <form action={saveRule} style={row}>
                    <select name="weekday" defaultValue={0} style={input}>
                      {WEEKDAYS.map((d, i) => (
                        <option key={d} value={i}>
                          {d}
                        </option>
                      ))}
                    </select>
                    <input
                      type="time"
                      name="start_time"
                      defaultValue="10:00"
                      required
                      style={input}
                    />
                    <span className={s.faint}>to</span>
                    <input
                      type="time"
                      name="end_time"
                      defaultValue="12:00"
                      required
                      style={input}
                    />
                    <select name="slot_minutes" defaultValue={30} style={input}>
                      {[15, 20, 30, 45, 60].map((m) => (
                        <option key={m} value={m}>
                          {m} min
                        </option>
                      ))}
                    </select>
                    <label style={{ ...row, gap: 6, fontSize: 13 }}>
                      <input type="checkbox" name="active" defaultChecked /> on
                    </label>
                    <SubmitButton className={`${s.btnPrimary} ${s.btnSmall}`}>
                      Add window
                    </SubmitButton>
                  </form>
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className={`${s.card} ${s.span4}`} aria-labelledby="settings">
          <h2 className={s.h2} id="settings">
            Booking settings
          </h2>
          <form action={saveSettings} className={s.stack} style={{ gap: 12 }}>
            <label style={label}>
              Meeting link (Teams / Meet) — sent in every confirmation
              <input
                type="url"
                name="meeting_link"
                defaultValue={SETTINGS.meeting_link ?? ""}
                placeholder="https://teams.microsoft.com/…"
                style={input}
              />
            </label>
            <div style={row}>
              <label style={label}>
                Min notice (hours)
                <input
                  type="number"
                  name="min_notice_hours"
                  min={0}
                  max={720}
                  defaultValue={SETTINGS.min_notice_hours}
                  style={{ ...input, width: 90 }}
                />
              </label>
              <label style={label}>
                Days ahead
                <input
                  type="number"
                  name="max_days_ahead"
                  min={1}
                  max={365}
                  defaultValue={SETTINGS.max_days_ahead}
                  style={{ ...input, width: 90 }}
                />
              </label>
              <label style={label}>
                Buffer (min)
                <input
                  type="number"
                  name="buffer_minutes"
                  min={0}
                  max={240}
                  defaultValue={SETTINGS.buffer_minutes}
                  style={{ ...input, width: 90 }}
                />
              </label>
            </div>
            <label style={{ ...row, gap: 8, fontSize: 13 }}>
              <input type="checkbox" name="active" defaultChecked={SETTINGS.active} />
              Online booking is on
            </label>
            <div>
              <SubmitButton className={s.btnPrimary}>Save settings</SubmitButton>
            </div>
          </form>
        </section>

        <section className={`${s.card} ${s.span12}`} aria-labelledby="exceptions">
          <div className={s.cardTitle}>
            <h2 className={s.h2} id="exceptions" style={{ margin: 0 }}>
              Blocked dates
            </h2>
            <span className={s.mono}>holidays · appointments · part-days</span>
          </div>
          <form action={addException} style={{ ...row, marginBottom: 16 }}>
            <label style={label}>
              Date
              <input type="date" name="date" min={today} required style={input} />
            </label>
            <label style={label}>
              From (blank = whole day)
              <input type="time" name="start_time" style={input} />
            </label>
            <label style={label}>
              To
              <input type="time" name="end_time" style={input} />
            </label>
            <label style={{ ...label, flex: 1, minWidth: 160 }}>
              Reason (optional)
              <input type="text" name="reason" maxLength={200} style={input} />
            </label>
            <SubmitButton className={`${s.btnPrimary}`} style={{ alignSelf: "flex-end" }}>
              Block
            </SubmitButton>
          </form>
          {EXCEPTIONS.length === 0 ? (
            <p className={s.muted} style={{ margin: 0 }}>
              No upcoming blocked dates.
            </p>
          ) : (
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Window</th>
                  <th>Reason</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {EXCEPTIONS.map((e) => (
                  <tr key={e.id}>
                    <td className={s.mono}>{e.date}</td>
                    <td>
                      {e.start_time
                        ? `${hhmm(e.start_time)}–${hhmm(e.end_time)}`
                        : "All day"}
                    </td>
                    <td className={s.muted}>{e.reason ?? "—"}</td>
                    <td style={{ textAlign: "right" }}>
                      <form action={deleteException}>
                        <input type="hidden" name="id" value={e.id} />
                        <SubmitButton className={`${s.btn} ${s.btnSmall}`}>
                          Unblock
                        </SubmitButton>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </>
  );
}
