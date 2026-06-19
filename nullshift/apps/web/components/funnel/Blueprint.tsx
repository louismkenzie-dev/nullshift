import { T } from "@nullshift/ui/tokens";
import type { Blueprint as BlueprintData } from "@nullshift/content/blueprint";
import { SystemPreview } from "./SystemPreview";

/**
 * Blueprint — the body of the auto-generated "free plan". Order leads with the
 * VISUAL (a preview of their own system), then the itemised, priced build (the
 * hero substance), then the supporting savings/payback and pain-specific quick
 * wins. Presentational + hook-free so it renders in both the funnel result
 * (client) and the permanent /plan/[token] page (server).
 */

const gbp = (n: number) => "£" + Math.round(n).toLocaleString("en-GB");

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: T.mono,
        fontSize: 10,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: T.primary,
        marginBottom: 12,
      }}
    >
      {children}
    </div>
  );
}

export function Blueprint({ blueprint }: { blueprint: BlueprintData }) {
  const b = blueprint;
  const s = b.savings;

  return (
    <div className="flex flex-col" style={{ gap: 28 }}>
      {/* ── The visual — a preview of their own system ── */}
      <section>
        <SectionLabel>Here&apos;s what your software looks like</SectionLabel>
        <SystemPreview
          businessLabel={b.businessLabel}
          modules={b.modules}
          isClinic={b.isClinic}
        />
        <p
          style={{
            fontFamily: T.sans,
            fontSize: 12.5,
            color: T.faint,
            marginTop: 8,
          }}
        >
          An indicative preview, branded to you — built and owned by you, not rented.
        </p>
      </section>

      {/* ── The build, itemised (the hero) ── */}
      <section
        style={{
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: T.r.xl,
          padding: "22px 22px 18px",
        }}
      >
        <SectionLabel>Your build — itemised</SectionLabel>
        <div style={{ borderTop: `1px solid ${T.border}` }}>
          {b.modules.map((m) => (
            <div
              key={m.name}
              style={{ padding: "13px 0", borderBottom: `1px solid ${T.border}` }}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span
                  style={{
                    fontFamily: T.display,
                    fontWeight: 600,
                    fontSize: "1rem",
                    letterSpacing: "-0.01em",
                    color: T.fg,
                  }}
                >
                  {m.name}
                </span>
                <span
                  style={{
                    fontFamily: T.mono,
                    fontSize: "0.9rem",
                    color: T.fg,
                    whiteSpace: "nowrap",
                  }}
                >
                  {gbp(m.price)}
                </span>
              </div>
              <p
                style={{
                  fontFamily: T.sans,
                  fontSize: "0.85rem",
                  lineHeight: 1.5,
                  color: T.muted,
                  marginTop: 4,
                  maxWidth: "52ch",
                }}
              >
                {m.why}
              </p>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="flex items-baseline justify-between" style={{ paddingTop: 14 }}>
          <span style={{ fontFamily: T.sans, fontWeight: 600, color: T.fg }}>
            One-off build
          </span>
          <span
            style={{
              fontFamily: T.display,
              fontWeight: 700,
              fontSize: "1.5rem",
              letterSpacing: "-0.02em",
              color: T.fg,
            }}
          >
            {gbp(b.oneOffTotal)}
          </span>
        </div>

        {/* Care tier */}
        <div
          style={{
            marginTop: 14,
            padding: "13px 15px",
            borderRadius: T.r.md,
            border: `1px solid ${T.primary}33`,
            background: T.primarySoft,
          }}
        >
          <div className="flex items-baseline justify-between gap-3">
            <span
              style={{
                fontFamily: T.sans,
                fontWeight: 600,
                fontSize: "0.95rem",
                color: T.fg,
              }}
            >
              {b.tier.tier} care plan
            </span>
            <span style={{ fontFamily: T.mono, fontSize: "0.9rem", color: T.primary }}>
              {b.tier.monthly}/mo
            </span>
          </div>
          <p
            style={{
              fontFamily: T.sans,
              fontSize: "0.85rem",
              lineHeight: 1.5,
              color: T.muted,
              marginTop: 4,
            }}
          >
            {b.tier.why} Hosting, backups, updates and support — cancel any time and keep
            the system.
          </p>
        </div>
        <p style={{ fontFamily: T.sans, fontSize: 12, color: T.faint, marginTop: 12 }}>
          Indicative scope and pricing — confirmed on a quick call, never a surprise.
        </p>
      </section>

      {/* ── Supporting: what you stop renting + payback ── */}
      <section
        style={{
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: T.r.xl,
          padding: 22,
        }}
      >
        <SectionLabel>What you stop renting</SectionLabel>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div
              style={{
                fontFamily: T.display,
                fontWeight: 700,
                fontSize: "clamp(1.5rem,5vw,2rem)",
                letterSpacing: "-0.02em",
                color: T.warning,
                lineHeight: 1,
              }}
            >
              {gbp(s.annualRent)}
            </div>
            <div
              style={{
                fontFamily: T.sans,
                fontSize: "0.82rem",
                color: T.muted,
                marginTop: 5,
              }}
            >
              Renting your software, per year
              {s.perSeat ? ` (~${gbp(s.perSeat)}/practitioner)` : ""}
            </div>
          </div>
          <div>
            <div
              style={{
                fontFamily: T.display,
                fontWeight: 700,
                fontSize: "clamp(1.5rem,5vw,2rem)",
                letterSpacing: "-0.02em",
                color: T.primary,
                lineHeight: 1,
              }}
            >
              {gbp(s.kept)}
            </div>
            <div
              style={{
                fontFamily: T.sans,
                fontSize: "0.82rem",
                color: T.muted,
                marginTop: 5,
              }}
            >
              Gone when you own it (per year)
            </div>
          </div>
        </div>
        <div
          className="flex flex-wrap gap-x-6 gap-y-2"
          style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${T.border}` }}
        >
          {b.paybackMonths != null && (
            <Fact
              k="Pays for itself in"
              v={`~${b.paybackMonths} month${b.paybackMonths === 1 ? "" : "s"}`}
            />
          )}
          <Fact k="Live in" v={b.timelineWeeks} />
        </div>
        <p style={{ fontFamily: T.sans, fontSize: 12, color: T.faint, marginTop: 12 }}>
          Estimated from what you told us — we&apos;ll firm it up with your real numbers.
        </p>
      </section>

      {/* ── Quick wins ── */}
      {b.quickWins.length > 0 && (
        <section>
          <SectionLabel>Quick wins for you</SectionLabel>
          <div className="flex flex-col gap-2.5">
            {b.quickWins.map((w, i) => (
              <div key={i} className="flex items-start gap-3">
                <span
                  aria-hidden
                  style={{
                    marginTop: 7,
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    background: T.primary,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontFamily: T.sans,
                    fontSize: "0.95rem",
                    lineHeight: 1.55,
                    color: T.fg,
                  }}
                >
                  {w}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div
        style={{
          fontFamily: T.mono,
          fontSize: 9.5,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: T.faint,
        }}
      >
        {k}
      </div>
      <div
        style={{
          fontFamily: T.sans,
          fontSize: "0.95rem",
          fontWeight: 600,
          color: T.fg,
          marginTop: 2,
        }}
      >
        {v}
      </div>
    </div>
  );
}
