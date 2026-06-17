import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import { T } from "@nullshift/ui/tokens";
import {
  PROOF_PILLARS,
  BRAND_LINE,
  type VerticalConfig,
} from "@nullshift/content/marketing";
import { RevenueCalculator } from "@nullshift/ui/components/RevenueCalculator";

const PrimaryBtn = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Link
    href={href}
    className="inline-flex items-center justify-center gap-2 font-medium transition-opacity hover:opacity-90"
    style={{
      fontFamily: T.sans,
      fontSize: "0.95rem",
      fontWeight: 600,
      height: 48,
      paddingInline: 24,
      background: T.primary,
      color: T.primaryFg,
      borderRadius: T.r.md,
      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18), 0 0 28px ${T.primary}30`,
      textDecoration: "none",
    }}
  >
    {children}
  </Link>
);
const GhostBtn = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Link
    href={href}
    className="inline-flex items-center justify-center gap-2 font-medium"
    style={{
      fontFamily: T.sans,
      fontSize: "0.95rem",
      fontWeight: 500,
      height: 48,
      paddingInline: 22,
      background: "transparent",
      color: T.muted,
      borderRadius: T.r.md,
      border: `1px solid ${T.borderStr}`,
      textDecoration: "none",
    }}
  >
    {children}
  </Link>
);

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <div
    className="inline-flex items-center gap-2"
    style={{
      fontFamily: T.mono,
      fontSize: "0.72rem",
      fontWeight: 500,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      color: T.muted,
    }}
  >
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: T.primary,
        boxShadow: `0 0 0 4px ${T.primary}22`,
        flexShrink: 0,
      }}
    />
    {children}
  </div>
);

export function VerticalLanding({ config }: { config: VerticalConfig }) {
  const c = config;
  return (
    <>
      <Nav />
      <main style={{ background: T.bg }}>
        {/* ── Hero ─────────────────────────────────────────── */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(ellipse 55% 50% at 50% 0%, ${T.primary}12 0%, transparent 65%)`,
            }}
          />
          <div
            className="relative mx-auto max-w-5xl px-6 text-center"
            style={{
              paddingTop: "clamp(120px, 18vh, 180px)",
              paddingBottom: "clamp(40px, 6vw, 72px)",
            }}
          >
            <Reveal>
              <div className="flex justify-center">
                <Eyebrow>{c.eyebrow}</Eyebrow>
              </div>
            </Reveal>
            <Reveal delay={0.06}>
              <h1
                style={{
                  fontFamily: T.display,
                  fontWeight: 600,
                  fontSize: "clamp(2.4rem, 6vw, 4.6rem)",
                  lineHeight: 1.04,
                  letterSpacing: "-0.03em",
                  color: T.fg,
                  marginTop: 22,
                }}
              >
                {c.headline[0]}
                <br />
                <span className="hero-glow" style={{ color: T.primary }}>
                  {c.headline[1]}
                </span>
              </h1>
            </Reveal>
            <Reveal delay={0.12}>
              <p
                className="mx-auto"
                style={{
                  fontFamily: T.sans,
                  fontSize: "clamp(1rem, 1.5vw, 1.15rem)",
                  lineHeight: 1.65,
                  color: T.muted,
                  maxWidth: "60ch",
                  marginTop: 24,
                }}
              >
                {c.sub}
              </p>
            </Reveal>
            <Reveal delay={0.18}>
              <div
                className="flex flex-col sm:flex-row gap-3 justify-center"
                style={{ marginTop: 34 }}
              >
                <PrimaryBtn href="/book">Book a free 15-min call →</PrimaryBtn>
                <GhostBtn href="/systems-lab">Try the live demos</GhostBtn>
              </div>
            </Reveal>
            <Reveal delay={0.24}>
              <p
                style={{
                  fontFamily: T.mono,
                  fontSize: "0.72rem",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: T.faint,
                  marginTop: 20,
                }}
              >
                {BRAND_LINE}
              </p>
            </Reveal>
          </div>
        </section>

        {/* ── The hook stat ────────────────────────────────── */}
        <section
          className="mx-auto max-w-5xl px-6"
          style={{ paddingBlock: "clamp(28px, 5vw, 56px)" }}
        >
          <Reveal>
            <div
              className="grid md:grid-cols-[auto_1fr] gap-6 md:gap-10 items-center"
              style={{
                background: T.surface,
                border: `1px solid ${T.border}`,
                borderRadius: T.r.xl,
                padding: "clamp(24px, 4vw, 40px)",
              }}
            >
              <div
                style={{
                  fontFamily: T.display,
                  fontWeight: 700,
                  fontSize: "clamp(2.6rem, 7vw, 4.2rem)",
                  letterSpacing: "-0.03em",
                  color: T.primary,
                  lineHeight: 1,
                }}
                className="hero-glow"
              >
                {c.hook.stat}
              </div>
              <p
                style={{
                  fontFamily: T.sans,
                  fontSize: "clamp(1rem, 1.6vw, 1.2rem)",
                  lineHeight: 1.55,
                  color: T.fg,
                  maxWidth: "48ch",
                }}
              >
                {c.hook.claim}
              </p>
            </div>
          </Reveal>
        </section>

        {/* ── Calculator ───────────────────────────────────── */}
        <section
          className="mx-auto max-w-5xl px-6"
          style={{ paddingBottom: "clamp(28px, 5vw, 56px)" }}
        >
          <Reveal>
            <RevenueCalculator calc={c.calc} />
          </Reveal>
        </section>

        {/* ── How it works / outcomes ──────────────────────── */}
        <section
          className="mx-auto max-w-6xl px-6"
          style={{
            paddingBlock: "clamp(40px, 7vw, 80px)",
            borderTop: `1px solid ${T.border}`,
          }}
        >
          <Reveal>
            <Eyebrow>How {c.offer} works</Eyebrow>
          </Reveal>
          <Reveal delay={0.06}>
            <h2
              style={{
                fontFamily: T.display,
                fontWeight: 600,
                fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)",
                letterSpacing: "-0.03em",
                lineHeight: 1.06,
                color: T.fg,
                marginTop: 16,
                maxWidth: "20ch",
              }}
            >
              We don&apos;t hand you a website.{" "}
              <span style={{ color: T.muted }}>We run the system.</span>
            </h2>
          </Reveal>
          <div className="grid sm:grid-cols-2 gap-4" style={{ marginTop: 32 }}>
            {c.outcomes.map((o, i) => (
              <Reveal key={o.title} delay={0.05 * i}>
                <div
                  style={{
                    background: T.surface,
                    border: `1px solid ${T.border}`,
                    borderRadius: T.r.lg,
                    padding: "22px 24px",
                    height: "100%",
                  }}
                >
                  <div
                    style={{
                      fontFamily: T.mono,
                      fontSize: "0.8rem",
                      color: `${T.primary}80`,
                      fontWeight: 600,
                    }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <h3
                    style={{
                      fontFamily: T.display,
                      fontWeight: 600,
                      fontSize: "1.2rem",
                      letterSpacing: "-0.015em",
                      color: T.fg,
                      marginTop: 10,
                    }}
                  >
                    {o.title}
                  </h3>
                  <p
                    style={{
                      fontFamily: T.sans,
                      fontSize: "0.92rem",
                      lineHeight: 1.6,
                      color: T.muted,
                      marginTop: 8,
                    }}
                  >
                    {o.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── Plans ladder ─────────────────────────────────── */}
        <section
          id="plans"
          className="mx-auto max-w-6xl px-6"
          style={{
            paddingBlock: "clamp(40px, 7vw, 80px)",
            borderTop: `1px solid ${T.border}`,
          }}
        >
          <Reveal>
            <Eyebrow>{c.offer} · plans</Eyebrow>
          </Reveal>
          <Reveal delay={0.06}>
            <h2
              style={{
                fontFamily: T.display,
                fontWeight: 600,
                fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)",
                letterSpacing: "-0.03em",
                lineHeight: 1.06,
                color: T.fg,
                marginTop: 16,
              }}
            >
              A small setup fee.{" "}
              <span style={{ color: T.primary }}>Then we earn it every month.</span>
            </h2>
          </Reveal>
          <p
            style={{
              fontFamily: T.sans,
              fontSize: "0.95rem",
              lineHeight: 1.6,
              color: T.muted,
              marginTop: 12,
              maxWidth: "60ch",
            }}
          >
            The build is the on-ramp; the monthly plan is the system that keeps the work
            coming in. You own the code and every account — cancel anytime and keep it
            all.
          </p>
          <div
            className="grid md:grid-cols-3 gap-4"
            style={{ marginTop: 32, alignItems: "stretch" }}
          >
            {c.plans.map((p) => (
              <Reveal key={p.tier}>
                <div
                  style={{
                    background: p.highlighted
                      ? `linear-gradient(${T.surface}, ${T.surface})`
                      : T.surface,
                    border: `1px solid ${p.highlighted ? T.primary : T.border}`,
                    boxShadow: p.highlighted
                      ? `inset 0 0 0 1px ${T.primary}40, 0 0 40px ${T.primary}18`
                      : "none",
                    borderRadius: T.r.xl,
                    padding: "26px 24px",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span
                      style={{
                        fontFamily: T.display,
                        fontWeight: 600,
                        fontSize: "1.15rem",
                        color: T.fg,
                      }}
                    >
                      {p.tier}
                    </span>
                    {p.highlighted && (
                      <span
                        style={{
                          fontFamily: T.mono,
                          fontSize: "0.62rem",
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          color: T.primary,
                          background: `${T.primary}14`,
                          border: `1px solid ${T.primary}44`,
                          borderRadius: 999,
                          padding: "3px 9px",
                        }}
                      >
                        Most popular
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      marginTop: 16,
                      display: "flex",
                      alignItems: "baseline",
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: T.display,
                        fontWeight: 700,
                        fontSize: "2.2rem",
                        letterSpacing: "-0.03em",
                        color: T.fg,
                      }}
                    >
                      {p.monthly}
                    </span>
                    <span
                      style={{ fontFamily: T.sans, fontSize: "0.95rem", color: T.muted }}
                    >
                      /mo
                    </span>
                  </div>
                  <div
                    style={{
                      fontFamily: T.mono,
                      fontSize: "0.74rem",
                      color: T.faint,
                      marginTop: 4,
                    }}
                  >
                    + {p.setup} one-off setup
                  </div>
                  <ul
                    className="list-none"
                    style={{
                      marginTop: 18,
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                      flex: 1,
                    }}
                  >
                    {p.inside.map((f) => (
                      <li
                        key={f}
                        className="flex gap-2.5"
                        style={{
                          fontFamily: T.sans,
                          fontSize: "0.88rem",
                          lineHeight: 1.45,
                          color: T.muted,
                        }}
                      >
                        <span
                          style={{
                            flex: "0 0 16px",
                            height: 16,
                            marginTop: 2,
                            borderRadius: "50%",
                            background: `${T.primary}1f`,
                            border: `1px solid ${T.primary}55`,
                            color: T.primary,
                            display: "grid",
                            placeItems: "center",
                            fontSize: "0.6rem",
                          }}
                        >
                          ✓
                        </span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/book"
                    className="inline-flex items-center justify-center font-medium transition-opacity hover:opacity-90"
                    style={{
                      marginTop: 22,
                      fontFamily: T.sans,
                      fontSize: "0.9rem",
                      fontWeight: 600,
                      height: 44,
                      background: p.highlighted ? T.primary : "transparent",
                      color: p.highlighted ? T.primaryFg : T.fg,
                      border: p.highlighted ? "none" : `1px solid ${T.borderStr}`,
                      borderRadius: T.r.md,
                      boxShadow: p.highlighted
                        ? `inset 0 1px 0 rgba(255,255,255,0.18)`
                        : "none",
                      textDecoration: "none",
                    }}
                  >
                    Book a call →
                  </Link>
                </div>
              </Reveal>
            ))}
          </div>
          <p
            style={{
              fontFamily: T.mono,
              fontSize: "0.72rem",
              letterSpacing: "0.04em",
              color: T.faint,
              marginTop: 16,
            }}
          >
            Every plan includes a monthly report of the{" "}
            {c.reportLine ??
              (c.slug === "trades" ? "jobs recovered" : "no-shows prevented")}
            . No hidden fees, no rebilled-tool markups.
          </p>
        </section>

        {/* ── Proof pillars ────────────────────────────────── */}
        <section
          className="mx-auto max-w-6xl px-6"
          style={{
            paddingBlock: "clamp(40px, 7vw, 80px)",
            borderTop: `1px solid ${T.border}`,
          }}
        >
          <div
            className="grid md:grid-cols-3"
            style={{
              borderTop: `1px solid ${T.border}`,
              borderLeft: `1px solid ${T.border}`,
            }}
          >
            {PROOF_PILLARS.map((p) => (
              <Reveal key={p.n}>
                <div
                  style={{
                    borderRight: `1px solid ${T.border}`,
                    borderBottom: `1px solid ${T.border}`,
                    padding: "28px 26px",
                    height: "100%",
                  }}
                >
                  <div
                    style={{
                      fontFamily: T.mono,
                      fontSize: "0.95rem",
                      fontWeight: 600,
                      color: `${T.primary}66`,
                    }}
                  >
                    {p.n}
                  </div>
                  <h3
                    style={{
                      fontFamily: T.display,
                      fontWeight: 600,
                      fontSize: "1.25rem",
                      letterSpacing: "-0.015em",
                      color: T.fg,
                      marginTop: 10,
                    }}
                  >
                    {p.title}
                  </h3>
                  <p
                    style={{
                      fontFamily: T.sans,
                      fontSize: "0.9rem",
                      lineHeight: 1.55,
                      color: T.muted,
                      marginTop: 8,
                    }}
                  >
                    {p.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── FAQ / objection-busters ──────────────────────── */}
        <section
          className="mx-auto max-w-3xl px-6"
          style={{
            paddingBlock: "clamp(40px, 7vw, 80px)",
            borderTop: `1px solid ${T.border}`,
          }}
        >
          <Reveal>
            <Eyebrow>Straight answers</Eyebrow>
          </Reveal>
          <div
            style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 12 }}
          >
            {c.faqs.map((f) => (
              <Reveal key={f.q}>
                <div
                  style={{
                    background: T.surface,
                    border: `1px solid ${T.border}`,
                    borderRadius: T.r.lg,
                    padding: "20px 22px",
                  }}
                >
                  <h3
                    style={{
                      fontFamily: T.display,
                      fontWeight: 600,
                      fontSize: "1.05rem",
                      letterSpacing: "-0.01em",
                      color: T.fg,
                    }}
                  >
                    {f.q}
                  </h3>
                  <p
                    style={{
                      fontFamily: T.sans,
                      fontSize: "0.92rem",
                      lineHeight: 1.6,
                      color: T.muted,
                      marginTop: 8,
                    }}
                  >
                    {f.a}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── Final CTA ────────────────────────────────────── */}
        <section
          className="mx-auto max-w-4xl px-6 text-center"
          style={{
            paddingBlock: "clamp(48px, 8vw, 96px)",
            borderTop: `1px solid ${T.border}`,
          }}
        >
          <Reveal>
            <h2
              style={{
                fontFamily: T.display,
                fontWeight: 600,
                fontSize: "clamp(2rem, 5vw, 3.4rem)",
                letterSpacing: "-0.03em",
                lineHeight: 1.05,
                color: T.fg,
              }}
            >
              Ready to{" "}
              <span className="hero-glow" style={{ color: T.primary }}>
                {c.ctaQuestion ??
                  (c.slug === "trades"
                    ? "never miss another job?"
                    : "fill your calendar?")}
              </span>
            </h2>
          </Reveal>
          <Reveal delay={0.08}>
            <p
              className="mx-auto"
              style={{
                fontFamily: T.sans,
                fontSize: "1.05rem",
                lineHeight: 1.6,
                color: T.muted,
                maxWidth: "46ch",
                marginTop: 18,
              }}
            >
              Book a free 15-minute call. We&apos;ll show you the exact system live, and
              what it would recover for your business. No commitment.
            </p>
          </Reveal>
          <Reveal delay={0.14}>
            <div
              className="flex flex-col sm:flex-row gap-3 justify-center"
              style={{ marginTop: 32 }}
            >
              <PrimaryBtn href="/book">Book a free call →</PrimaryBtn>
              <GhostBtn href="/systems-lab">See the live demos</GhostBtn>
            </div>
          </Reveal>
        </section>
      </main>
      <Footer />
    </>
  );
}
