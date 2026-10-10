"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./project.module.css";
import b from "./booking.module.css";

/**
 * The website booking picker: month → day → slot → details → confirmed.
 * Availability comes from /api/bookings/slots (already filtered for notice,
 * buffer, exceptions and the diary); the booking is posted to /api/bookings.
 * Everything is shown in London time, which is what the rules are set in.
 */

type Slot = { startsAt: string; endsAt: string; date: string; time: string };
type SlotsResponse = {
  from: string;
  to: string;
  today: string;
  horizon: string;
  active: boolean;
  slots: Slot[];
};
type Confirmed = {
  id: string;
  startsAt: string;
  endsAt: string;
  date: string;
  time: string;
  meetingLink: string | null;
  googleCalendarUrl: string;
  cancelPath: string;
  confirmationSent: boolean;
};
type Field = "name" | "email" | "company" | "website" | "phone" | "notes";
type Errors = Partial<Record<Field | "startsAt", string>>;

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const pad = (n: number) => String(n).padStart(2, "0");
const londonToday = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const monthKey = (y: number, m: number) => `${y}-${pad(m + 1)}`;
const longDate = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
};

const FIELDS: { key: Field; label: string; type?: string; optional?: boolean }[] = [
  { key: "name", label: "Your name" },
  { key: "email", label: "Email address", type: "email" },
  { key: "company", label: "Company", optional: true },
  { key: "website", label: "Website", type: "url", optional: true },
  { key: "phone", label: "Phone", type: "tel", optional: true },
];

export function BookingPicker({
  kind,
  contactEmail,
}: {
  kind: "client" | "partner";
  contactEmail: string;
}) {
  const today = useMemo(() => londonToday(), []);
  const [view, setView] = useState(() => {
    const [y, m] = today.split("-").map(Number);
    return { y, m: m - 1 };
  });
  const [months, setMonths] = useState<
    Record<string, SlotsResponse | "loading" | "error">
  >({});
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [step, setStep] = useState<"time" | "details" | "done">("time");
  const [values, setValues] = useState<Record<Field, string>>({
    name: "",
    email: "",
    company: "",
    website: "",
    phone: "",
    notes: "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmed, setConfirmed] = useState<Confirmed | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  const key = monthKey(view.y, view.m);
  const month = months[key];

  const monthFirst = `${key}-01`;
  const monthLast = `${key}-${pad(new Date(view.y, view.m + 1, 0).getDate())}`;
  const pastMonth = monthLast < today;

  useEffect(() => {
    if (pastMonth || months[key]) return;
    const from = monthFirst < today ? today : monthFirst;
    let cancelled = false;
    fetch(`/api/bookings/slots?from=${from}&to=${monthLast}&kind=${kind}`, {
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: SlotsResponse) => {
        if (!cancelled) setMonths((m) => ({ ...m, [key]: data }));
      })
      .catch(() => {
        if (!cancelled) setMonths((m) => ({ ...m, [key]: "error" }));
      });
    return () => {
      cancelled = true;
    };
  }, [key, kind, monthFirst, monthLast, months, pastMonth, today]);

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [step]);

  const byDate = useMemo(() => {
    const map: Record<string, Slot[]> = {};
    if (month && typeof month !== "string")
      for (const s of month.slots) (map[s.date] ??= []).push(s);
    return map;
  }, [month]);

  const cells = useMemo(() => {
    const firstWeekday = (new Date(view.y, view.m, 1).getDay() + 6) % 7;
    const days = new Date(view.y, view.m + 1, 0).getDate();
    const out: (string | null)[] = Array(firstWeekday).fill(null);
    for (let d = 1; d <= days; d++) out.push(`${key}-${pad(d)}`);
    return out;
  }, [key, view.m, view.y]);

  const horizon = month && typeof month !== "string" ? month.horizon : null;
  const canGoBack = key > today.slice(0, 7);
  const canGoForward = !horizon || `${key}-31` < horizon;

  function shift(delta: number) {
    setView((v) => {
      const m = v.m + delta;
      return { y: v.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 };
    });
    setDate(null);
    setSlot(null);
  }

  function refreshMonth() {
    setMonths((m) => {
      const next = { ...m };
      delete next[key];
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!slot) return;
    const form = e.currentTarget as HTMLFormElement;
    const honeypot = (form.elements.namedItem("fax") as HTMLInputElement | null)?.value;
    setPending(true);
    setError(null);
    setErrors({});
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          startsAt: slot.startsAt,
          ...values,
          fax: honeypot,
          source: `web:${kind}`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.code === "taken") {
          refreshMonth();
          setSlot(null);
          setStep("time");
        }
        setErrors(data.errors ?? {});
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setConfirmed(data.booking);
      setStep("done");
    } catch {
      setError(
        "We couldn’t reach the server. Please check your connection and try again."
      );
    } finally {
      setPending(false);
    }
  }

  const steps = [
    { id: "time", label: "Pick a time" },
    { id: "details", label: "Your details" },
    { id: "done", label: "Confirmed" },
  ];

  return (
    <div className={styles.card}>
      <ol className={styles.progress} aria-label="Progress">
        {steps.map((s, i) => (
          <li key={s.id} aria-current={step === s.id ? "step" : undefined}>
            <span>0{i + 1}</span>
            {s.label}
          </li>
        ))}
      </ol>

      {step === "time" && (
        <div>
          <h2 ref={heading} tabIndex={-1}>
            {date ? longDate(date) : "Choose a day."}
          </h2>
          <p className={b.tz}>All times London (UK)</p>

          <div className={b.dayHead}>
            <button
              type="button"
              className={b.navBtn}
              onClick={() => shift(-1)}
              disabled={!canGoBack}
              aria-label="Previous month"
            >
              ‹
            </button>
            <span className={b.monthLabel}>
              {MONTHS[view.m]} {view.y}
            </span>
            <button
              type="button"
              className={b.navBtn}
              onClick={() => shift(1)}
              disabled={!canGoForward}
              aria-label="Next month"
            >
              ›
            </button>
          </div>

          <div className={b.days} role="grid" aria-label={`${MONTHS[view.m]} ${view.y}`}>
            {WEEKDAYS.map((w) => (
              <div key={w} className={b.weekday} role="columnheader">
                {w}
              </div>
            ))}
            {cells.map((d, i) =>
              d === null ? (
                <div key={`pad-${i}`} aria-hidden />
              ) : (
                <button
                  key={d}
                  type="button"
                  role="gridcell"
                  disabled={!byDate[d]}
                  aria-selected={date === d}
                  className={[
                    b.day,
                    byDate[d] ? b.dayOpen : "",
                    d < today ? b.dayOut : "",
                    date === d ? b.daySelected : "",
                  ].join(" ")}
                  onClick={() => {
                    setDate(d);
                    setSlot(null);
                  }}
                >
                  {Number(d.slice(-2))}
                </button>
              )
            )}
          </div>

          {!pastMonth && !month && <p className={b.status}>Checking availability…</p>}
          {pastMonth && (
            <p className={b.status}>That month has passed — try a later one.</p>
          )}
          {month === "error" && (
            <p className={styles.error}>
              We couldn’t load availability. Refresh, or email{" "}
              <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
            </p>
          )}
          {month && typeof month !== "string" && !month.active && (
            <p className={b.status}>
              Online booking is paused right now. Email{" "}
              <a href={`mailto:${contactEmail}`}>{contactEmail}</a> and we’ll find a time.
            </p>
          )}
          {month && typeof month !== "string" && month.active && !month.slots.length && (
            <p className={b.status}>
              Nothing free this month — try the next one, or email{" "}
              <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
            </p>
          )}
          {error && <p className={styles.error}>{error}</p>}

          {date && byDate[date] && (
            <>
              <div className={b.slots} role="listbox" aria-label="Available times">
                {byDate[date].map((s) => (
                  <button
                    key={s.startsAt}
                    type="button"
                    role="option"
                    aria-selected={slot?.startsAt === s.startsAt}
                    className={`${b.slot} ${slot?.startsAt === s.startsAt ? b.slotSelected : ""}`}
                    onClick={() => setSlot(s)}
                  >
                    {s.time}
                  </button>
                ))}
              </div>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.submit}
                  disabled={!slot}
                  onClick={() => setStep("details")}
                >
                  {slot ? `Continue with ${slot.time}` : "Choose a time"}{" "}
                  <span aria-hidden="true">↗</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {step === "details" && slot && (
        <form onSubmit={submit} aria-busy={pending}>
          <h2 ref={heading} tabIndex={-1}>
            Nearly there.
          </h2>
          <div className={b.chosen}>
            <div>
              <strong>
                {longDate(slot.date)} · {slot.time}
              </strong>
              <span>30 minutes · video call · London time</span>
            </div>
            <button type="button" className={styles.back} onClick={() => setStep("time")}>
              Change
            </button>
          </div>
          <fieldset disabled={pending}>
            {FIELDS.map((f) => (
              <label className={styles.field} key={f.key} htmlFor={`book-${f.key}`}>
                {f.label} {f.optional && <span>(optional)</span>}
                <input
                  id={`book-${f.key}`}
                  name={f.key}
                  type={f.type ?? "text"}
                  inputMode={f.type === "url" ? "url" : undefined}
                  autoComplete={
                    f.key === "name"
                      ? "name"
                      : f.key === "email"
                        ? "email"
                        : f.key === "company"
                          ? "organization"
                          : f.key === "website"
                            ? "url"
                            : f.key === "phone"
                              ? "tel"
                              : undefined
                  }
                  required={!f.optional}
                  value={values[f.key]}
                  aria-invalid={errors[f.key] ? true : undefined}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                />
                {errors[f.key] && (
                  <span className={styles.fieldError}>{errors[f.key]}</span>
                )}
              </label>
            ))}
            <label className={styles.field} htmlFor="book-notes">
              {kind === "partner"
                ? "What kind of clients do you work with?"
                : "What would you like to talk about?"}{" "}
              <span>(optional)</span>
              <textarea
                id="book-notes"
                name="notes"
                rows={4}
                value={values.notes}
                onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
              />
            </label>
            <label className={styles.trap} aria-hidden="true">
              Fax
              <input type="text" name="fax" tabIndex={-1} autoComplete="off" />
            </label>
          </fieldset>
          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.actions}>
            <button type="button" className={styles.back} onClick={() => setStep("time")}>
              ← Back
            </button>
            <button type="submit" className={styles.submit} disabled={pending}>
              {pending ? "Booking…" : "Confirm booking"} <span aria-hidden="true">↗</span>
            </button>
          </div>
          <p className={styles.privacy}>
            We’ll use these details to run the call and follow up, not to subscribe you to
            marketing. <Link href="/legal/privacy">Privacy notice</Link>.
          </p>
        </form>
      )}

      {step === "done" && confirmed && (
        <div className={styles.received}>
          <p className={styles.eyebrow}>Booking confirmed</p>
          <h2 ref={heading} tabIndex={-1}>
            See you {longDate(confirmed.date)} at {confirmed.time}.
          </h2>
          <p>
            {confirmed.confirmationSent
              ? `A confirmation with a calendar invite is on its way to ${values.email}.`
              : `Your call is booked. Keep this page or the links below handy.`}
            {confirmed.meetingLink
              ? " The video link is below and in the invite."
              : " We’ll send the video link before the call."}
          </p>
          <div className={b.links}>
            <a
              href={confirmed.googleCalendarUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Add to Google Calendar ↗
            </a>
            {confirmed.meetingLink && (
              <a href={confirmed.meetingLink} target="_blank" rel="noopener noreferrer">
                Video call link ↗
              </a>
            )}
            <Link href={confirmed.cancelPath}>Cancel or rebook</Link>
          </div>
          <p className={styles.contact}>
            Something changed? Email <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
            .
          </p>
          <Link className={styles.back} href="/">
            Back to Nullshift ↗
          </Link>
        </div>
      )}
    </div>
  );
}
