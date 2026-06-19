import { T } from "@nullshift/ui/tokens";
import type { ScalingPlan as ScalingPlanData } from "@nullshift/content/scalingPlan";
import { SystemPreview } from "./SystemPreview";

/**
 * The Free Scaling Plan — a consultation-style prospectus generated from the
 * funnel answers: where you are now, the rented software to cut, what we'd build
 * and own, tailored automations, scaling opportunities, the ops insight, and a
 * clear reiteration that booking a call gets a tailored, detailed consultation
 * from a professional. No Nullshift pricing — scoped and priced on the call.
 * Presentational + hook-free so it renders in the funnel result (client) and the
 * /plan/[token] page (server).
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

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section
      style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: T.r.xl,
        padding: 22,
      }}
    >
      {children}
    </section>
  );
}

function ItemList({ items }: { items: { title: string; detail: string }[] }) {
  return (
    <div style={{ borderTop: `1px solid ${T.border}` }}>
      {items.map((it, i) => (
        <div key={i} style={{ padding: "12px 0", borderBottom: `1px solid ${T.border}` }}>
          <div
            style={{
              fontFamily: T.display,
              fontWeight: 600,
              fontSize: "0.98rem",
              letterSpacing: "-0.01em",
              color: T.fg,
            }}
          >
            {it.title}
          </div>
          <p
            style={{
              fontFamily: T.sans,
              fontSize: "0.875rem",
              lineHeight: 1.55,
              color: T.muted,
              marginTop: 3,
              maxWidth: "60ch",
            }}
          >
            {it.detail}
          </p>
        </div>
      ))}
    </div>
  );
}

export function ScalingPlan({ plan }: { plan: ScalingPlanData }) {
  const s = plan.savings;

  return (
    <div className="flex flex-col" style={{ gap: 28 }}>
      {/* ── System mock — "what it could look like" + bespoke disclaimer ── */}
      <section>
        <SectionLabel>What it could look like</SectionLabel>
        <SystemPreview
          businessLabel={plan.businessLabel}
          modules={plan.modules}
          isClinic={plan.isClinic}
        />
        <p
          style={{
            fontFamily: T.sans,
            fontSize: 12.5,
            color: T.faint,
            marginTop: 8,
            lineHeight: 1.5,
          }}
        >
          A general mockup of the kind of system we build — not connected to live data.
          Your actual build is designed bespoke and fully on-brand to your business, and
          will look far more polished than this.
        </p>
      </section>

      {/* ── Hero plan (flagship combos) ── */}
      {plan.hero && (
        <Card>
          <SectionLabel>Your scaling plan</SectionLabel>
          <h3
            style={{
              fontFamily: T.display,
              fontWeight: 600,
              fontSize: "clamp(1.3rem,3vw,1.7rem)",
              letterSpacing: "-0.02em",
              lineHeight: 1.12,
              color: T.fg,
            }}
          >
            {plan.hero.title}
          </h3>
          <div className="mt-3 flex flex-col gap-3">
            {plan.hero.narrative
              .split(/\n{2,}|\n/)
              .filter(Boolean)
              .map((para, i) => (
                <p
                  key={i}
                  style={{
                    fontFamily: T.sans,
                    fontSize: "0.95rem",
                    lineHeight: 1.6,
                    color: T.muted,
                  }}
                >
                  {para}
                </p>
              ))}
          </div>
          {plan.hero.highlights.length > 0 && (
            <div className="mt-4 flex flex-col gap-2">
              {plan.hero.highlights.map((h, i) => (
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
                      fontSize: "0.9rem",
                      lineHeight: 1.5,
                      color: T.fg,
                    }}
                  >
                    {h}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ── Where you are now (diagnosis + savings) ── */}
      <Card>
        <SectionLabel>Where you are now</SectionLabel>
        <p
          style={{
            fontFamily: T.sans,
            fontSize: "0.98rem",
            lineHeight: 1.6,
            color: T.fg,
          }}
        >
          {plan.diagnosis}
        </p>
        {plan.spendFraming && (
          <p
            style={{
              fontFamily: T.sans,
              fontSize: "0.9rem",
              lineHeight: 1.6,
              color: T.muted,
              marginTop: 10,
            }}
          >
            {plan.spendFraming}
          </p>
        )}
        <div
          className="grid grid-cols-2 gap-4"
          style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${T.border}` }}
        >
          <div>
            <div
              style={{
                fontFamily: T.display,
                fontWeight: 700,
                fontSize: "clamp(1.4rem,5vw,1.9rem)",
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
                fontSize: "0.8rem",
                color: T.muted,
                marginTop: 5,
              }}
            >
              Renting software, per year
              {s.perSeat ? ` (~${gbp(s.perSeat)}/practitioner)` : ""}
            </div>
          </div>
          <div>
            <div
              style={{
                fontFamily: T.display,
                fontWeight: 700,
                fontSize: "clamp(1.4rem,5vw,1.9rem)",
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
                fontSize: "0.8rem",
                color: T.muted,
                marginTop: 5,
              }}
            >
              Stops when you own it (per year)
            </div>
          </div>
        </div>
        <p style={{ fontFamily: T.sans, fontSize: 12, color: T.faint, marginTop: 12 }}>
          Estimated from what you told us — we firm it up with your real numbers on the
          call.
        </p>
      </Card>

      {/* ── The software you're renting (cut this) ── */}
      {plan.saasToCut.length > 0 && (
        <Card>
          <SectionLabel>The software you&apos;re renting</SectionLabel>
          <p
            style={{
              fontFamily: T.sans,
              fontSize: "0.9rem",
              lineHeight: 1.55,
              color: T.muted,
              marginBottom: 4,
            }}
          >
            The monthly tools we&apos;d replace with one system you own outright.
          </p>
          <div style={{ borderTop: `1px solid ${T.border}` }}>
            {plan.saasToCut.map((x, i) => (
              <div
                key={i}
                style={{ padding: "12px 0", borderBottom: `1px solid ${T.border}` }}
              >
                <div
                  style={{
                    fontFamily: T.display,
                    fontWeight: 600,
                    fontSize: "0.95rem",
                    color: T.fg,
                  }}
                >
                  {x.name}
                </div>
                <p
                  style={{
                    fontFamily: T.sans,
                    fontSize: "0.85rem",
                    lineHeight: 1.55,
                    color: T.muted,
                    marginTop: 3,
                    maxWidth: "60ch",
                  }}
                >
                  {x.note}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── What we'd build & own ── */}
      {plan.build.length > 0 && (
        <Card>
          <SectionLabel>What we&apos;d build &amp; you&apos;d own</SectionLabel>
          <ItemList items={plan.build} />
        </Card>
      )}

      {/* ── Automations tailored to you ── */}
      {plan.automations.length > 0 && (
        <Card>
          <SectionLabel>Automations that would help</SectionLabel>
          <ItemList items={plan.automations} />
        </Card>
      )}

      {/* ── Scaling opportunities ── */}
      {plan.opportunities.length > 0 && (
        <Card>
          <SectionLabel>Room to scale</SectionLabel>
          <ItemList items={plan.opportunities} />
        </Card>
      )}

      {/* ── The ops insight ── */}
      {plan.opsTrap && (
        <div
          style={{
            borderLeft: `3px solid ${T.primary}`,
            background: T.primarySoft,
            borderRadius: "0 12px 12px 0",
            padding: "16px 18px",
          }}
        >
          <SectionLabel>Stop bending your business to fit the software</SectionLabel>
          <p
            style={{
              fontFamily: T.sans,
              fontSize: "0.95rem",
              lineHeight: 1.6,
              color: T.fg,
            }}
          >
            {plan.opsTrap}
          </p>
        </div>
      )}

      {/* ── Prospectus reiteration ── */}
      <div
        style={{
          border: `1px solid ${T.primary}33`,
          background: T.surface,
          borderRadius: T.r.xl,
          padding: 22,
        }}
      >
        <SectionLabel>This is a starting point</SectionLabel>
        <p
          style={{
            fontFamily: T.sans,
            fontSize: "0.98rem",
            lineHeight: 1.6,
            color: T.fg,
          }}
        >
          This scaling plan is generated from your answers — an indicative prospectus, not
          a finished plan or a quote. Book a call and a Nullshift professional will turn
          it into a tailored, detailed plan mapped to exactly how your business runs, and
          scope and price the build with you. Live in around {plan.timelineWeeks}.
        </p>
      </div>
    </div>
  );
}
