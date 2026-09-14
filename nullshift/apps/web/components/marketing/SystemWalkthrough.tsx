import { T } from "@nullshift/ui/tokens";

/* ════════════════════════════════════════════════════════════════
   SYSTEM WALKTHROUGH — what we build, shown rather than named.

   The homepage used to describe the work in the language of the
   people who build it: agents, orchestration, integrations. A dance
   school owner or a counsellor cannot buy any of that, because they
   cannot picture it. So this walks the one chain every client of ours
   actually has — someone books, you get paid, your team sees who is
   coming, the register gets marked, the message goes home — and draws
   each step as the screen it becomes.

   The panels are schematic on purpose: brand-neutral, obviously drawn,
   and captioned as an illustration. They show the shape of the thing,
   not a screenshot of any one client's system.
   ════════════════════════════════════════════════════════════════ */

const mono: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: "0.62rem",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
};

/* ── Small parts the panels are drawn from ──────────────────────── */

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div
      aria-hidden
      style={{
        background: "var(--k-surface)",
        border: "1px solid var(--k-border)",
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 9,
        // Fixed, not min: the five panels hold different amounts, and only a
        // shared height puts all five step titles on the same baseline.
        height: 200,
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}

function Row({
  label,
  meta,
  tone = "default",
}: {
  label: string;
  meta?: string;
  tone?: "default" | "accent" | "faint";
}) {
  const color =
    tone === "accent"
      ? "var(--k-accent)"
      : tone === "faint"
        ? "var(--k-faint)"
        : "var(--k-fg)";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        paddingBlock: 6,
        borderBottom: "1px solid var(--k-border)",
      }}
    >
      <span style={{ fontFamily: T.sans, fontSize: "0.74rem", color }}>{label}</span>
      {meta && (
        <span style={{ ...mono, fontSize: "0.58rem", color: "var(--k-muted)" }}>
          {meta}
        </span>
      )}
    </div>
  );
}

function Chip({ text, tone = "accent" }: { text: string; tone?: "accent" | "muted" }) {
  const on = tone === "accent";
  return (
    <span
      style={{
        ...mono,
        fontSize: "0.54rem",
        padding: "3px 7px",
        color: on ? "var(--k-accent)" : "var(--k-muted)",
        border: `1px solid ${on ? "var(--k-accent)" : "var(--k-border)"}`,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

function Button({ text }: { text: string }) {
  return (
    <span
      style={{
        ...mono,
        fontSize: "0.58rem",
        background: "var(--k-accent)",
        color: "var(--k-on-accent)",
        padding: "8px 10px",
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
        width: 14,
        height: 14,
        flex: "0 0 14px",
        display: "grid",
        placeItems: "center",
        fontSize: "0.55rem",
        border: `1px solid ${on ? "var(--k-accent)" : "var(--k-border-strong)"}`,
        color: on ? "var(--k-accent)" : "transparent",
      }}
    >
      ✓
    </span>
  );
}

/* ── The five screens ───────────────────────────────────────────── */

const STEPS = [
  {
    n: "01",
    title: "They book",
    body: "Your customer picks a class, a session or an appointment on your own website — on their phone, at 10pm, without ringing you.",
    panel: (
      <Panel>
        <span style={{ ...mono, color: "var(--k-muted)" }}>Book a class</span>
        <Row label="Street — Ages 7–9" meta="Tue 17:30" />
        <Row label="Braintree studio" meta="4 left" />
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          <Chip text="Trial" tone="muted" />
          <Chip text="Monthly" />
        </div>
        <Button text="Book now" />
      </Panel>
    ),
  },
  {
    n: "02",
    title: "You get paid",
    body: "The card is charged the moment they book, and the money lands in your own bank account. No invoice to raise, no transfer to chase.",
    panel: (
      <Panel>
        <span style={{ ...mono, color: "var(--k-muted)" }}>Payment</span>
        <div
          style={{
            fontFamily: T.sans,
            fontWeight: 700,
            fontSize: "1.5rem",
            letterSpacing: "-0.03em",
            color: "var(--k-fg)",
          }}
        >
          £32.00
        </div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          <Chip text="Paid" />
        </div>
        <Row label="Monthly membership" meta="5th" tone="faint" />
        <span
          style={{
            ...mono,
            fontSize: "0.54rem",
            color: "var(--k-muted)",
            marginTop: "auto",
          }}
        >
          → Your account
        </span>
      </Panel>
    ),
  },
  {
    n: "03",
    title: "Your team sees who's coming",
    body: "Every booking lands on one screen. Who is in the room tonight, who has paid, who is new — without anyone opening a spreadsheet.",
    panel: (
      <Panel>
        <span style={{ ...mono, color: "var(--k-muted)" }}>Tonight · 17:30</span>
        <Row label="Poppy H." meta="Paid" tone="accent" />
        <Row label="Jonah R." meta="Paid" tone="accent" />
        <Row label="Mia T." meta="Trial" />
        <span
          style={{
            ...mono,
            fontSize: "0.58rem",
            color: "var(--k-muted)",
            marginTop: "auto",
          }}
        >
          12 booked · 12 paid
        </span>
      </Panel>
    ),
  },
  {
    n: "04",
    title: "The register gets marked",
    body: "Staff tap each name as people arrive, on a phone. Allergies, medical notes and who is allowed to collect a child sit right there on the row.",
    panel: (
      <Panel>
        <span style={{ ...mono, color: "var(--k-muted)" }}>Register</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Tick on />
          <span style={{ fontFamily: T.sans, fontSize: "0.74rem", color: "var(--k-fg)" }}>
            Poppy H.
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Tick on />
          <span style={{ fontFamily: T.sans, fontSize: "0.74rem", color: "var(--k-fg)" }}>
            Jonah R.
          </span>
          <Chip text="EpiPen" tone="muted" />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Tick on={false} />
          <span
            style={{ fontFamily: T.sans, fontSize: "0.74rem", color: "var(--k-faint)" }}
          >
            Mia T.
          </span>
        </div>
        <span
          style={{
            ...mono,
            fontSize: "0.54rem",
            color: "var(--k-muted)",
            marginTop: "auto",
          }}
        >
          Collected by — Dad
        </span>
      </Panel>
    ),
  },
  {
    n: "05",
    title: "The message goes home",
    body: "Confirmations, reminders and reports send themselves — and you can see whether each one actually arrived, so nobody says they were never told.",
    panel: (
      <Panel>
        <span style={{ ...mono, color: "var(--k-muted)" }}>Sent</span>
        <Row label="Booking confirmed" meta="Delivered" tone="accent" />
        <Row label="Class reminder" meta="Delivered" tone="accent" />
        <Row label="Session report" meta="Delivered" tone="accent" />
        <span
          style={{
            ...mono,
            fontSize: "0.54rem",
            color: "var(--k-muted)",
            marginTop: "auto",
          }}
        >
          Automatic · no one pressed send
        </span>
      </Panel>
    ),
  },
];

export function SystemWalkthrough() {
  return (
    <div>
      <div
        className="ns-walk"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
          borderTop: "1px solid var(--k-border)",
          borderLeft: "1px solid var(--k-border)",
        }}
      >
        {STEPS.map((s) => (
          <div
            key={s.n}
            style={{
              borderRight: "1px solid var(--k-border)",
              borderBottom: "1px solid var(--k-border)",
              padding: "clamp(16px,1.6vw,22px)",
              display: "flex",
              flexDirection: "column",
              gap: 14,
              minWidth: 0,
            }}
          >
            <span style={{ ...mono, fontSize: "0.66rem", color: "var(--k-accent)" }}>
              {s.n}
            </span>
            {s.panel}
            <div>
              <h3
                style={{
                  fontFamily: T.sans,
                  fontWeight: 700,
                  fontSize: "1rem",
                  letterSpacing: "-0.02em",
                  color: "var(--k-fg)",
                  margin: 0,
                }}
              >
                {s.title}
              </h3>
              <p
                style={{
                  fontFamily: T.sans,
                  fontSize: "0.86rem",
                  lineHeight: 1.55,
                  color: "var(--k-muted)",
                  marginTop: 8,
                }}
              >
                {s.body}
              </p>
            </div>
          </div>
        ))}
      </div>

      <p
        style={{
          ...mono,
          fontSize: "0.62rem",
          color: "var(--k-faint)",
          marginTop: 16,
        }}
      >
        Illustration of the flow — your screens are built around your business
      </p>

      {/* Five equal columns only survive to about tablet width; below that the
          chain reads better as a stack than as five slivers. */}
      <style>{`
        @media (max-width: 1080px) {
          .ns-walk { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        }
        @media (max-width: 620px) {
          .ns-walk { grid-template-columns: minmax(0, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}
