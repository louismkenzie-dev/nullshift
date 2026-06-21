/* ════════════════════════════════════════════════════════════════
   FLAT PRODUCT PREVIEWS — Kyma-style "screenshot" mocks
   ----------------------------------------------------------------
   Replaces the old WebGL/3D brand assets with flat, on-brand UI
   mockups (pure CSS/SVG, server-safe). These sit in the slots where
   Kyma uses product screenshots / data-viz.
   ════════════════════════════════════════════════════════════════ */
import React from "react";
import { T } from "@nullshift/ui/tokens";

/* Faux app chrome (window header) ------------------------------------ */
function Chrome({ label }: { label: string }) {
  return (
    <div
      className="flex items-center gap-2 px-4"
      style={{
        height: 38,
        borderBottom: `1px solid ${T.border}`,
        background: T.bg,
      }}
    >
      <span style={{ display: "flex", gap: 6 }} aria-hidden>
        {[T.border, T.border, T.border].map((c, i) => (
          <span
            key={i}
            style={{ width: 9, height: 9, borderRadius: 999, background: c }}
          />
        ))}
      </span>
      <span
        className="ml-2 truncate"
        style={{
          fontFamily: T.mono,
          fontSize: "0.7rem",
          letterSpacing: "0.02em",
          color: T.faint,
        }}
      >
        {label}
      </span>
    </div>
  );
}

function CardShell({
  label,
  children,
  style,
}: {
  label: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="overflow-hidden"
      style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: T.r.xl,
        boxShadow: T.shadow.lg,
        ...style,
      }}
    >
      <Chrome label={label} />
      {children}
    </div>
  );
}

/* ── Booking preview (hero / "online booking") ──────────────────── */
export function BookingPreview({ style }: { style?: React.CSSProperties }) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const slots = ["09:00", "10:30", "13:00", "14:30", "16:00"];
  return (
    <CardShell label="yourclinic.co.uk/book" style={style}>
      <div className="p-5 md:p-6">
        <div className="flex items-center justify-between">
          <div>
            <div
              style={{
                fontFamily: T.display,
                fontWeight: 600,
                fontSize: "1.05rem",
                letterSpacing: "-0.015em",
                color: T.fg,
              }}
            >
              Book an appointment
            </div>
            <div
              style={{
                fontFamily: T.sans,
                fontSize: "0.8rem",
                color: T.muted,
                marginTop: 2,
              }}
            >
              Initial consultation · 45 min · £55
            </div>
          </div>
          <span
            className="inline-flex items-center gap-1.5"
            style={{
              fontFamily: T.mono,
              fontSize: "0.66rem",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: T.primary,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: 999,
                background: T.primary,
                boxShadow: `0 0 0 3px ${T.primary}22`,
              }}
            />
            Live
          </span>
        </div>

        {/* Week selector */}
        <div className="mt-5 grid gap-2" style={{ gridTemplateColumns: "repeat(5,1fr)" }}>
          {days.map((d, i) => (
            <div
              key={d}
              className="flex flex-col items-center gap-1 py-2"
              style={{
                borderRadius: T.r.md,
                border: `1px solid ${i === 2 ? T.primary : T.border}`,
                background: i === 2 ? `${T.primary}14` : T.bg,
              }}
            >
              <span
                style={{
                  fontFamily: T.mono,
                  fontSize: "0.6rem",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: i === 2 ? T.primary : T.faint,
                }}
              >
                {d}
              </span>
              <span
                style={{
                  fontFamily: T.display,
                  fontWeight: 600,
                  fontSize: "0.95rem",
                  color: i === 2 ? T.fg : T.muted,
                }}
              >
                {12 + i}
              </span>
            </div>
          ))}
        </div>

        {/* Time slots */}
        <div className="mt-4 flex flex-wrap gap-2">
          {slots.map((s, i) => (
            <span
              key={s}
              style={{
                fontFamily: T.mono,
                fontSize: "0.74rem",
                letterSpacing: "0.02em",
                color: i === 1 ? T.primaryFg : T.fg,
                background: i === 1 ? T.primary : T.bg,
                border: `1px solid ${i === 1 ? T.primary : T.border}`,
                borderRadius: T.r.sm,
                padding: "7px 12px",
              }}
            >
              {s}
            </span>
          ))}
        </div>

        {/* Confirm bar */}
        <div
          className="mt-5 flex items-center justify-between rounded-none px-4 py-3"
          style={{ background: T.bg, border: `1px solid ${T.border}` }}
        >
          <span style={{ fontFamily: T.sans, fontSize: "0.82rem", color: T.muted }}>
            Wed 14 · 10:30 · deposit £20
          </span>
          <span
            style={{
              fontFamily: T.sans,
              fontWeight: 500,
              fontSize: "0.8rem",
              color: T.primaryFg,
              background: T.primary,
              borderRadius: T.r.sm,
              padding: "7px 14px",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18)",
            }}
          >
            Confirm & pay
          </span>
        </div>
      </div>
    </CardShell>
  );
}

/* ── Dashboard preview (metrics / "you own the data") ───────────── */
export function DashboardPreview({ style }: { style?: React.CSSProperties }) {
  const kpis = [
    { v: "248", l: "Bookings" },
    { v: "3.1%", l: "No-shows" },
    { v: "£11k", l: "Taken" },
  ];
  const bars = [42, 58, 49, 71, 64, 83, 76];
  return (
    <CardShell label="yourclinic.co.uk/admin" style={style}>
      <div className="p-5 md:p-6">
        <div className="grid grid-cols-3 gap-3">
          {kpis.map((k) => (
            <div
              key={k.l}
              className="flex flex-col gap-1 rounded-none p-3"
              style={{ background: T.bg, border: `1px solid ${T.border}` }}
            >
              <span
                style={{
                  fontFamily: T.display,
                  fontWeight: 600,
                  fontSize: "1.3rem",
                  letterSpacing: "-0.02em",
                  color: T.fg,
                }}
              >
                {k.v}
              </span>
              <span
                style={{
                  fontFamily: T.sans,
                  fontSize: "0.68rem",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: T.muted,
                }}
              >
                {k.l}
              </span>
            </div>
          ))}
        </div>

        {/* Bar chart */}
        <div
          className="mt-4 rounded-none p-4"
          style={{ background: T.bg, border: `1px solid ${T.border}` }}
        >
          <div className="flex items-center justify-between mb-3">
            <span
              style={{
                fontFamily: T.sans,
                fontSize: "0.78rem",
                fontWeight: 500,
                color: T.fg,
              }}
            >
              Bookings this week
            </span>
            <span
              style={{
                fontFamily: T.mono,
                fontSize: "0.66rem",
                letterSpacing: "0.06em",
                color: T.primary,
              }}
            >
              +18%
            </span>
          </div>
          <div className="flex items-end gap-2" style={{ height: 96 }} aria-hidden>
            {bars.map((h, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: `${h}%`,
                  borderRadius: 0,
                  background:
                    i === bars.length - 1
                      ? T.primary
                      : `linear-gradient(180deg, ${T.primary}66, ${T.primary}1a)`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </CardShell>
  );
}

/* ── Rent vs own comparison (the "switch") ──────────────────────── */
export function StackSwitch({ style }: { style?: React.CSSProperties }) {
  const rented = [
    "Booking SaaS — £39/mo / seat",
    "Records add-on — £25/mo",
    "Reminders — £18/mo",
    "Payment skim — 2.4%",
    "Email tool — £29/mo",
  ];
  const owned = [
    "Online booking + deposits",
    "Patient records & intake",
    "Automatic reminders & recall",
    "Payments via your Stripe",
    "Everything in one system",
  ];
  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 overflow-hidden"
      style={{
        border: `1px solid ${T.border}`,
        borderRadius: T.r.xl,
        boxShadow: T.shadow.lg,
        ...style,
      }}
    >
      {/* Rented */}
      <div
        className="p-6"
        style={{ background: T.bg, borderRight: `1px solid ${T.border}` }}
      >
        <div className="flex items-center justify-between mb-5">
          <span
            style={{
              fontFamily: T.mono,
              fontSize: "0.7rem",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: T.danger,
            }}
          >
            What you rent
          </span>
          <span
            style={{
              fontFamily: T.mono,
              fontSize: "0.7rem",
              color: T.faint,
            }}
          >
            per practitioner
          </span>
        </div>
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {rented.map((r) => (
            <li
              key={r}
              className="flex items-center gap-3 py-2.5"
              style={{
                fontFamily: T.sans,
                fontSize: "0.83rem",
                color: T.muted,
                borderBottom: `1px solid ${T.border}`,
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 999,
                  border: `1px solid ${T.danger}66`,
                  color: T.danger,
                  fontSize: 10,
                  lineHeight: "14px",
                  textAlign: "center",
                  flexShrink: 0,
                }}
              >
                ×
              </span>
              <span style={{ textDecoration: "line-through", opacity: 0.85 }}>{r}</span>
            </li>
          ))}
        </ul>
        <div
          className="mt-4"
          style={{
            fontFamily: T.mono,
            fontSize: "0.72rem",
            letterSpacing: "0.04em",
            color: T.danger,
          }}
        >
          Bill grows with every hire
        </div>
      </div>

      {/* Owned */}
      <div className="p-6" style={{ background: T.surface }}>
        <div className="flex items-center justify-between mb-5">
          <span
            style={{
              fontFamily: T.mono,
              fontSize: "0.7rem",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: T.primary,
            }}
          >
            What you own
          </span>
          <span
            style={{
              fontFamily: T.mono,
              fontSize: "0.7rem",
              color: T.primary,
            }}
          >
            £0 / seat
          </span>
        </div>
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {owned.map((o) => (
            <li
              key={o}
              className="flex items-center gap-3 py-2.5"
              style={{
                fontFamily: T.sans,
                fontSize: "0.83rem",
                color: T.fg,
                borderBottom: `1px solid ${T.border}`,
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 999,
                  background: `${T.primary}1f`,
                  color: T.primary,
                  fontSize: 10,
                  lineHeight: "16px",
                  textAlign: "center",
                  flexShrink: 0,
                }}
              >
                ✓
              </span>
              {o}
            </li>
          ))}
        </ul>
        <div
          className="mt-4"
          style={{
            fontFamily: T.mono,
            fontSize: "0.72rem",
            letterSpacing: "0.04em",
            color: T.primary,
          }}
        >
          Add practitioners for free
        </div>
      </div>
    </div>
  );
}
