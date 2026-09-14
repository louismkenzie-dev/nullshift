import React from "react";
import { T } from "@nullshift/ui/tokens";

/* ════════════════════════════════════════════════════════════════
   THE FIVE OBJECTS.

   Each step of the system, drawn as the screen it becomes and held in
   the middle of its own viewport. They are schematic on purpose —
   brand-neutral, obviously drawn, captioned as illustrations — so they
   show the shape of the thing without pretending to be a screenshot of
   any one client's system.
   ════════════════════════════════════════════════════════════════ */

const mono: React.CSSProperties = {
  fontFamily: T.mono,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
};

/** A phone-shaped stage. Fixed size so all five sit identically in the void. */
function Phone({ children }: { children: React.ReactNode }) {
  return (
    <div
      aria-hidden
      style={{
        width: "min(300px, 78vw)",
        minHeight: 420,
        maxHeight: "66svh",
        background: "var(--k-surface)",
        border: "1px solid var(--k-border-strong)",
        borderRadius: 22,
        padding: 18,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      {children}
    </div>
  );
}

function ScreenLabel({ text, meta }: { text: string; meta?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
      <span style={{ ...mono, fontSize: "0.6rem", color: "var(--k-muted)" }}>{text}</span>
      {meta && (
        <span style={{ ...mono, fontSize: "0.6rem", color: "var(--k-faint)" }}>
          {meta}
        </span>
      )}
    </div>
  );
}

function Line({
  label,
  sub,
  meta,
  on = false,
}: {
  label: string;
  sub?: string;
  meta?: string;
  on?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        padding: "11px 12px",
        border: `1px solid ${on ? "var(--k-accent)" : "var(--k-border)"}`,
        background: on
          ? "color-mix(in oklab, var(--k-accent) 10%, transparent)"
          : "transparent",
      }}
    >
      <span style={{ minWidth: 0 }}>
        <span
          style={{
            display: "block",
            fontFamily: T.sans,
            fontSize: "0.82rem",
            color: "var(--k-fg)",
          }}
        >
          {label}
        </span>
        {sub && (
          <span
            style={{
              display: "block",
              fontFamily: T.sans,
              fontSize: "0.72rem",
              color: "var(--k-muted)",
              marginTop: 2,
            }}
          >
            {sub}
          </span>
        )}
      </span>
      {meta && (
        <span
          style={{
            ...mono,
            fontSize: "0.58rem",
            color: on ? "var(--k-accent)" : "var(--k-muted)",
            whiteSpace: "nowrap",
          }}
        >
          {meta}
        </span>
      )}
    </div>
  );
}

function Cta({ text }: { text: string }) {
  return (
    <span
      style={{
        ...mono,
        fontSize: "0.62rem",
        background: "var(--k-accent)",
        color: "var(--k-on-accent)",
        padding: "13px 12px",
        textAlign: "center",
        marginTop: "auto",
      }}
    >
      {text}
    </span>
  );
}

function Tick({ on }: { on: boolean }) {
  return (
    <span
      style={{
        width: 20,
        height: 20,
        flex: "0 0 20px",
        display: "grid",
        placeItems: "center",
        fontSize: "0.68rem",
        border: `1px solid ${on ? "var(--k-accent)" : "var(--k-border-strong)"}`,
        background: on
          ? "color-mix(in oklab, var(--k-accent) 14%, transparent)"
          : "transparent",
        color: on ? "var(--k-accent)" : "transparent",
      }}
    >
      ✓
    </span>
  );
}

function Flag({ text }: { text: string }) {
  return (
    <span
      style={{
        ...mono,
        fontSize: "0.54rem",
        padding: "3px 7px",
        border: "1px solid var(--k-border-strong)",
        color: "var(--k-muted)",
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

/* ── 01 · They book ─────────────────────────────────────────────── */
export function ScreenBook() {
  return (
    <Phone>
      <ScreenLabel text="Book a class" meta="Tue" />
      <Line label="Street — Ages 7–9" sub="Braintree · 17:30" meta="4 left" on />
      <Line label="Commercial — Ages 10–13" sub="Braintree · 18:30" meta="Full" />
      <Line label="Adult street" sub="Braintree · 19:45" meta="9 left" />
      <div
        aria-hidden
        style={{ borderTop: "1px dashed var(--k-border)", marginBlock: 2 }}
      />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Flag text="Trial £6" />
        <Flag text="Monthly" />
        <Flag text="Termly" />
      </div>
      <Cta text="Book now" />
    </Phone>
  );
}

/* ── 02 · You get paid ──────────────────────────────────────────── */
export function ScreenPaid() {
  return (
    <Phone>
      <ScreenLabel text="Payment" meta="Card" />
      <span
        style={{
          fontFamily: T.sans,
          fontWeight: 500,
          fontSize: "2.6rem",
          lineHeight: 0.9,
          color: "var(--k-fg)",
          marginBlock: 6,
        }}
      >
        £32.00
      </span>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <span
          style={{
            ...mono,
            fontSize: "0.58rem",
            padding: "4px 9px",
            border: "1px solid var(--k-accent)",
            color: "var(--k-accent)",
          }}
        >
          Paid
        </span>
      </div>
      <div
        aria-hidden
        style={{ borderTop: "1px dashed var(--k-border)", marginBlock: 4 }}
      />
      <Line label="Monthly membership" sub="Renews on the 5th" meta="Auto" />
      <Line label="Poppy H." sub="Street — Ages 7–9" />
      <span
        style={{
          ...mono,
          fontSize: "0.58rem",
          color: "var(--k-muted)",
          marginTop: "auto",
          lineHeight: 1.7,
        }}
      >
        Settles into
        <br />
        your own account
      </span>
    </Phone>
  );
}

/* ── 03 · Who is coming ─────────────────────────────────────────── */
export function ScreenTonight() {
  return (
    <Phone>
      <ScreenLabel text="Tonight" meta="17:30" />
      <Line label="Poppy H." sub="Monthly" meta="Paid" on />
      <Line label="Jonah R." sub="Monthly" meta="Paid" on />
      <Line label="Mia T." sub="First class" meta="Trial" />
      <Line label="Alfie W." sub="Termly" meta="Paid" on />
      <div
        aria-hidden
        style={{ borderTop: "1px dashed var(--k-border)", marginBlock: 2 }}
      />
      <span
        style={{
          ...mono,
          fontSize: "0.62rem",
          color: "var(--k-muted)",
          marginTop: "auto",
          lineHeight: 1.7,
        }}
      >
        12 booked · 12 paid
        <br />
        <span style={{ color: "var(--k-faint)" }}>No spreadsheet open</span>
      </span>
    </Phone>
  );
}

/* ── 04 · The register ──────────────────────────────────────────── */
export function ScreenRegister() {
  const rows: { name: string; on: boolean; flag?: string }[] = [
    { name: "Poppy H.", on: true },
    { name: "Jonah R.", on: true, flag: "EpiPen" },
    { name: "Alfie W.", on: true },
    { name: "Mia T.", on: false, flag: "Trial" },
  ];
  return (
    <Phone>
      <ScreenLabel text="Register" meta="Braintree" />
      {rows.map((r) => (
        <div
          key={r.name}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 11,
            padding: "10px 12px",
            border: "1px solid var(--k-border)",
          }}
        >
          <Tick on={r.on} />
          <span
            style={{
              fontFamily: T.sans,
              fontSize: "0.84rem",
              color: r.on ? "var(--k-fg)" : "var(--k-faint)",
              flex: 1,
              minWidth: 0,
            }}
          >
            {r.name}
          </span>
          {r.flag && <Flag text={r.flag} />}
        </div>
      ))}
      <div
        aria-hidden
        style={{ borderTop: "1px dashed var(--k-border)", marginBlock: 2 }}
      />
      <span
        style={{
          ...mono,
          fontSize: "0.58rem",
          color: "var(--k-muted)",
          marginTop: "auto",
          lineHeight: 1.7,
        }}
      >
        Jonah — collected by Dad
        <br />
        <span style={{ color: "var(--k-faint)" }}>Nobody else on the list</span>
      </span>
    </Phone>
  );
}

/* ── 05 · The message home ──────────────────────────────────────── */
export function ScreenMessage() {
  return (
    <Phone>
      <ScreenLabel text="Sent" meta="Today" />
      <Line label="Booking confirmed" sub="To Poppy's mum" meta="Delivered" on />
      <Line label="Class reminder" sub="Sent 2 hours before" meta="Delivered" on />
      <Line label="Session report" sub="What she worked on" meta="Delivered" on />
      <Line label="Payment receipt" sub="Monthly membership" meta="Delivered" on />
      <div
        aria-hidden
        style={{ borderTop: "1px dashed var(--k-border)", marginBlock: 2 }}
      />
      <span
        style={{
          ...mono,
          fontSize: "0.58rem",
          color: "var(--k-muted)",
          marginTop: "auto",
          lineHeight: 1.7,
        }}
      >
        Nobody pressed send
        <br />
        <span style={{ color: "var(--k-faint)" }}>And you can prove it arrived</span>
      </span>
    </Phone>
  );
}
