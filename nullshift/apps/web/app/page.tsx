"use client";

import React from "react";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import { ScrollProgress } from "@/components/ScrollProgress";
import HeroText from "@/components/HeroText";
import { IntroGate } from "@/components/IntroGate";
import { T } from "@nullshift/ui/tokens";
import { RevenueCalculator } from "@nullshift/ui/components/RevenueCalculator";
import { CLINIC } from "@nullshift/content/marketing";

/* ── Brand assets ───────────────────────────── */
import { ExplodedBuild } from "@/components/assets/ExplodedBuild";
import { SystemsSphere } from "@/components/assets/SystemsSphere";
import { ResponsiveDevices } from "@/components/assets/ResponsiveDevices";
import { AutomationFlow } from "@/components/assets/AutomationFlow";
import { BookingCalendar } from "@/components/assets/BookingCalendar";
import { EmailCampaign } from "@/components/assets/EmailCampaign";
import { ClientPortal } from "@/components/assets/ClientPortal";
import { AnalyticsChart } from "@/components/assets/AnalyticsChart";
import { PerformanceGauge } from "@/components/assets/PerformanceGauge";
import { ProcessTimeline } from "@/components/assets/ProcessTimeline";
import { FixedPricing } from "@/components/assets/FixedPricing";
import { SystemHorizon } from "@/components/assets/SystemHorizon";

/* ── System marker (JetBrains Mono eyebrow) ───── */
function Marker({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontFamily: T.mono,
        fontSize: "0.75rem",
        fontWeight: 500,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: T.primary,
      }}
    >
      {children}
    </span>
  );
}

/* ── Mono tag (with leading hairline) ─────────── */
function MonoTag({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-2"
      style={{
        fontFamily: T.mono,
        fontSize: "0.75rem",
        fontWeight: 500,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: T.primary,
      }}
    >
      <span
        style={{
          height: 1,
          width: 12,
          background: `${T.primary}70`,
          flexShrink: 0,
          display: "inline-block",
        }}
      />
      {children}
    </span>
  );
}

/* ── Band heading ─────────────────────────────── */
function BandHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontFamily: T.display,
        fontWeight: 600,
        fontSize: "clamp(2.2rem,4.6vw,3.6rem)",
        lineHeight: 1.04,
        letterSpacing: "-0.03em",
        color: T.fg,
      }}
    >
      {children}
    </h2>
  );
}

/* ── Thin SystemHorizon divider between bands ─── */
function HorizonDivider() {
  return (
    <div
      aria-hidden
      className="relative w-full overflow-hidden"
      style={{
        height: 96,
        borderTop: `1px solid ${T.border}`,
        borderBottom: `1px solid ${T.border}`,
        background: T.bg,
      }}
    >
      <SystemHorizon style={{ height: 96, minHeight: 96, opacity: 0.55 }} />
    </div>
  );
}

/* ── 03 capability tiles ──────────────────────── */
type Tile = {
  Asset: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  nn: string;
  label: string;
  title: string;
  caption: string;
};

const CAPABILITY_TILES: Tile[] = [
  {
    Asset: SystemsSphere,
    nn: "01",
    label: "ONE SYSTEM",
    title: "Replaces your SaaS stack.",
    caption:
      "Booking, records, reminders and payments in one system you own — not five subscriptions that charge per practitioner.",
  },
  {
    Asset: BookingCalendar,
    nn: "02",
    label: "ONLINE BOOKING",
    title: "Booked while you're with a patient.",
    caption:
      "Patients book online 24/7, pay a deposit, and get an instant confirmation. Your diary fills itself.",
  },
  {
    Asset: AutomationFlow,
    nn: "03",
    label: "REMINDERS",
    title: "No-shows, handled.",
    caption:
      "Automatic SMS and email reminders, plus rebooking nudges — the proven way to cut no-shows.",
  },
  {
    Asset: ClientPortal,
    nn: "04",
    label: "PATIENT RECORDS",
    title: "Notes and history, one place.",
    caption:
      "Records, intake forms and consent — yours, GDPR-safe, UK-hosted, and exportable any time.",
  },
  {
    Asset: EmailCampaign,
    nn: "05",
    label: "RECALL",
    title: "Bring patients back.",
    caption:
      "Automated recall and follow-up — six-month reviews, post-treatment care — sent for you, on time.",
  },
  {
    Asset: AnalyticsChart,
    nn: "06",
    label: "PAYMENTS",
    title: "Take payments at a fraction.",
    caption:
      "Patients pay through your own account — deposits and balances — at a fraction of the usual cut. See the numbers live.",
  },
  {
    Asset: PerformanceGauge,
    nn: "07",
    label: "FAST & FOUND",
    title: "Quick to load, easy to find.",
    caption:
      "Built lean so you load fast and rank well — new patients find you first, on any search.",
  },
  {
    Asset: ResponsiveDevices,
    nn: "08",
    label: "MOBILE BOOKING",
    title: "Books beautifully on a phone.",
    caption:
      "Most patients book after hours from a phone. Your site is built to capture them, on every screen.",
  },
];

/* ── Process steps ────────────────────────────── */
const PROCESS_STEPS = [
  {
    num: "001",
    title: "Discovery",
    desc: "We learn your clinic — services, practitioners, and exactly which subscriptions you pay for and hate.",
  },
  {
    num: "002",
    title: "Build & migrate",
    desc: "We build your bespoke booking, records and payments system, then move your data across — no downtime.",
  },
  {
    num: "003",
    title: "Go live",
    desc: "DPA signed, we switch it on. Patients book, deposits land, reminders fire — and you cancel the old tools.",
  },
  {
    num: "004",
    title: "Own & run",
    desc: "It's yours — code, data, accounts. We host, back up and run it on a care plan you can cancel and keep.",
  },
];

/* ── Why-us value props ───────────────────────── */
const WHY_PROPS = [
  {
    n: "01",
    title: "No per-practitioner fees",
    desc: "Own the system once. The bill doesn't grow every time you add a practitioner — unlike the SaaS you rent today.",
  },
  {
    n: "02",
    title: "Your patient data, GDPR-safe",
    desc: "Records are UK-hosted, encrypted, audit-logged and exportable any time. We sign a DPA before go-live. Your data is never a vendor's hostage.",
  },
  {
    n: "03",
    title: "Payments at a fraction",
    desc: "Patients pay through your own Stripe account. You keep the relationship and pay a small flat fee — not the 2–3% an incumbent skims.",
  },
];

export default function Page() {
  return (
    <>
      {/* First-visit immersive intro (once per session), fades into the site */}
      <IntroGate />
      <ScrollProgress />
      {/* Film-grain atmosphere over the whole experience */}
      <div className="noise-layer" aria-hidden />

      <Nav />

      {/* Hero — owned by HeroText, do not edit here */}
      <div className="relative z-10">
        <HeroText />
      </div>

      <main className="relative z-10">
        {/* ═══════════════ 02 — WHAT WE DO ═══════════════ */}
        <Reveal>
          <section
            id="what-we-do"
            style={{ borderTop: `1px solid ${T.border}`, background: T.bg }}
          >
            <div
              style={{
                maxWidth: T.containerMax,
                margin: "0 auto",
                paddingInline: T.containerPad,
                paddingBlock: "clamp(64px,9vw,112px)",
              }}
            >
              <div className="mb-6">
                <Marker>// 02 — WHAT WE DO</Marker>
              </div>
              <BandHeading>
                We build it. We run it.
                <br />
                You own it.
              </BandHeading>
              <p
                className="mt-6"
                style={{
                  fontFamily: T.sans,
                  fontSize: "1.0625rem",
                  lineHeight: 1.55,
                  letterSpacing: "-0.005em",
                  color: T.muted,
                  maxWidth: "60ch",
                }}
              >
                A booking site that fills your diary, the records and payments your clinic
                runs on, and the automations that kill no-shows — one system you own, not
                a stack of subscriptions you rent.
              </p>

              {/* ExplodedBuild feature surface card */}
              <Reveal delay={0.08}>
                <figure
                  className="mt-10 overflow-hidden"
                  style={{
                    background: T.surface,
                    border: `1px solid ${T.border}`,
                    borderRadius: T.r.xl,
                  }}
                >
                  <div style={{ height: "clamp(360px,42vw,520px)" }}>
                    <ExplodedBuild style={{ height: "100%", minHeight: 0 }} />
                  </div>
                  <figcaption
                    className="px-6 py-5 md:px-8"
                    style={{ borderTop: `1px solid ${T.border}` }}
                  >
                    <span
                      style={{
                        fontFamily: T.display,
                        fontWeight: 600,
                        fontSize: "1.0625rem",
                        letterSpacing: "-0.015em",
                        color: T.fg,
                      }}
                    >
                      One system, every layer yours.
                    </span>
                    <span
                      style={{
                        fontFamily: T.sans,
                        fontSize: "0.9375rem",
                        lineHeight: 1.55,
                        color: T.muted,
                        marginLeft: 12,
                      }}
                    >
                      Booking, records, reminders and payments built into one structure
                      you own — not five subscriptions bolted together and billed per
                      practitioner.
                    </span>
                  </figcaption>
                </figure>
              </Reveal>

              {/* Two pillar cards — bordered 2-col grid */}
              <Reveal delay={0.12}>
                <div
                  className="mt-8 grid grid-cols-1 md:grid-cols-2"
                  style={{
                    borderTop: `1px solid ${T.border}`,
                    borderLeft: `1px solid ${T.border}`,
                    borderRadius: T.r.lg,
                    overflow: "hidden",
                  }}
                >
                  {/* Pillar 1 — Websites */}
                  <article
                    className="flex flex-col p-8 md:p-10"
                    style={{
                      borderRight: `1px solid ${T.border}`,
                      borderBottom: `1px solid ${T.border}`,
                      background: T.surface,
                    }}
                  >
                    <div style={{ height: 200 }}>
                      <ResponsiveDevices style={{ height: 200, minHeight: 0 }} />
                    </div>
                    <h3
                      className="mt-6 mb-3"
                      style={{
                        fontFamily: T.display,
                        fontWeight: 600,
                        fontSize: "clamp(1.25rem,2vw,1.5rem)",
                        letterSpacing: "-0.015em",
                        lineHeight: 1.2,
                        color: T.fg,
                      }}
                    >
                      A booking site that fills your diary
                    </h3>
                    <p
                      className="mb-5"
                      style={{
                        fontFamily: T.sans,
                        fontSize: "0.9375rem",
                        lineHeight: 1.55,
                        letterSpacing: "-0.005em",
                        color: T.muted,
                        maxWidth: "46ch",
                      }}
                    >
                      Fast, bespoke, mobile-first — patients book in seconds, pay a
                      deposit, and your calendar stays in sync. Live in weeks, and you own
                      it.
                    </p>
                    <div className="mt-auto">
                      <MonoTag>BESPOKE_BUILD / NO_TEMPLATES</MonoTag>
                    </div>
                  </article>

                  {/* Pillar 2 — Systems */}
                  <article
                    className="flex flex-col p-8 md:p-10"
                    style={{
                      borderRight: `1px solid ${T.border}`,
                      borderBottom: `1px solid ${T.border}`,
                      background: T.surface,
                    }}
                  >
                    <div style={{ height: 200 }}>
                      <SystemsSphere style={{ height: 200, minHeight: 0 }} />
                    </div>
                    <h3
                      className="mt-6 mb-3"
                      style={{
                        fontFamily: T.display,
                        fontWeight: 600,
                        fontSize: "clamp(1.25rem,2vw,1.5rem)",
                        letterSpacing: "-0.015em",
                        lineHeight: 1.2,
                        color: T.fg,
                      }}
                    >
                      The system that runs your clinic
                    </h3>
                    <p
                      className="mb-5"
                      style={{
                        fontFamily: T.sans,
                        fontSize: "0.9375rem",
                        lineHeight: 1.55,
                        letterSpacing: "-0.005em",
                        color: T.muted,
                        maxWidth: "46ch",
                      }}
                    >
                      Booking, patient records, reminders, recall and payments — wired
                      into one system that replaces your per-practitioner SaaS, on a care
                      plan you can cancel and keep.
                    </p>
                    <div className="mt-auto">
                      <MonoTag>OWNED / NO_PER-SEAT_FEES</MonoTag>
                    </div>
                  </article>
                </div>
              </Reveal>
            </div>
          </section>
        </Reveal>

        <HorizonDivider />

        {/* ═══════════════ 03 — WHAT WE CAN BUILD ═══════════════ */}
        <Reveal>
          <section
            id="capabilities"
            style={{ borderTop: `1px solid ${T.border}`, background: T.bg }}
          >
            <div
              style={{
                maxWidth: T.containerMax,
                margin: "0 auto",
                paddingInline: T.containerPad,
                paddingTop: "clamp(64px,9vw,112px)",
                paddingBottom: "clamp(48px,6vw,72px)",
              }}
            >
              <div className="mb-6">
                <Marker>// 03 — WHAT WE BUILD</Marker>
              </div>
              <BandHeading>Everything your clinic runs on.</BandHeading>
            </div>

            {/* auto-fit tile grid — cells joined by hairlines, not gaps */}
            <div style={{ borderTop: `1px solid ${T.border}` }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                  borderLeft: `1px solid ${T.border}`,
                }}
              >
                {CAPABILITY_TILES.map((t) => (
                  <article
                    key={t.nn}
                    className="flex flex-col p-8 md:p-9"
                    style={{
                      borderRight: `1px solid ${T.border}`,
                      borderBottom: `1px solid ${T.border}`,
                      background: T.surface,
                    }}
                  >
                    <div style={{ height: 200 }}>
                      <t.Asset style={{ height: 200, minHeight: 0 }} />
                    </div>
                    <div className="mt-6 mb-3">
                      <Marker>{`// ${t.nn} — ${t.label}`}</Marker>
                    </div>
                    <h3
                      className="mb-2"
                      style={{
                        fontFamily: T.display,
                        fontWeight: 600,
                        fontSize: "1.25rem",
                        letterSpacing: "-0.015em",
                        lineHeight: 1.2,
                        color: T.fg,
                      }}
                    >
                      {t.title}
                    </h3>
                    <p
                      style={{
                        fontFamily: T.sans,
                        fontSize: "0.9rem",
                        lineHeight: 1.55,
                        letterSpacing: "-0.003em",
                        color: T.muted,
                      }}
                    >
                      {t.caption}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </Reveal>

        <HorizonDivider />

        {/* ═══════════════ THE CUTTABLE BILL — savings calculator ═══════════════ */}
        <Reveal>
          <section
            id="savings"
            style={{ borderTop: `1px solid ${T.border}`, background: T.surface }}
          >
            <div
              style={{
                maxWidth: T.containerMax,
                margin: "0 auto",
                paddingInline: T.containerPad,
                paddingBlock: "clamp(64px,9vw,112px)",
              }}
            >
              <div className="mb-6">
                <Marker>// THE CUTTABLE BILL</Marker>
              </div>
              <BandHeading>Stop renting. Start owning.</BandHeading>
              <p
                className="mt-6 mb-10"
                style={{
                  fontFamily: T.sans,
                  fontSize: "1.0625rem",
                  lineHeight: 1.55,
                  letterSpacing: "-0.005em",
                  color: T.muted,
                  maxWidth: "60ch",
                }}
              >
                Most clinic software charges per practitioner — a bill that grows every
                time you hire. See what you&apos;re renting, and what stops the day you
                own the system outright.
              </p>
              <Reveal delay={0.08}>
                <RevenueCalculator calc={CLINIC.calc} ctaHref="/start" />
              </Reveal>
            </div>
          </section>
        </Reveal>

        <HorizonDivider />

        {/* ═══════════════ 04 — HOW IT WORKS ═══════════════ */}
        <Reveal>
          <section
            id="process"
            style={{ borderTop: `1px solid ${T.border}`, background: T.bg }}
          >
            <div
              style={{
                maxWidth: T.containerMax,
                margin: "0 auto",
                paddingInline: T.containerPad,
                paddingTop: "clamp(64px,9vw,112px)",
                paddingBottom: "clamp(48px,6vw,72px)",
              }}
            >
              <div className="mb-6">
                <Marker>// 04 — HOW IT WORKS</Marker>
              </div>
              <BandHeading>From rented tools to a system you own.</BandHeading>

              {/* ProcessTimeline wide banner */}
              <Reveal delay={0.08}>
                <div
                  className="mt-10 overflow-hidden"
                  style={{
                    background: T.surface,
                    border: `1px solid ${T.border}`,
                    borderRadius: T.r.xl,
                    height: 220,
                  }}
                >
                  <ProcessTimeline style={{ height: 220, minHeight: 0 }} />
                </div>
              </Reveal>
            </div>

            {/* 4-col bordered step grid */}
            <Reveal delay={0.1}>
              <div
                className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4"
                style={{
                  borderTop: `1px solid ${T.border}`,
                  borderLeft: `1px solid ${T.border}`,
                }}
              >
                {PROCESS_STEPS.map((step) => (
                  <article
                    key={step.num}
                    className="flex flex-col justify-start gap-4 p-8 md:p-10"
                    style={{
                      borderRight: `1px solid ${T.border}`,
                      borderBottom: `1px solid ${T.border}`,
                      background: T.surface,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: T.mono,
                        fontWeight: 600,
                        fontSize: "2rem",
                        lineHeight: 1,
                        color: `${T.primary}25`,
                      }}
                    >
                      {step.num}
                    </div>
                    <h3
                      style={{
                        fontFamily: T.display,
                        fontWeight: 600,
                        fontSize: "clamp(1.125rem,1.6vw,1.5rem)",
                        letterSpacing: "-0.015em",
                        lineHeight: 1.2,
                        color: T.fg,
                      }}
                    >
                      {step.title}
                    </h3>
                    <div className="w-5 h-px" style={{ background: T.border }} />
                    <p
                      style={{
                        fontFamily: T.sans,
                        fontSize: "0.9rem",
                        lineHeight: 1.55,
                        letterSpacing: "-0.003em",
                        color: T.muted,
                      }}
                    >
                      {step.desc}
                    </p>
                  </article>
                ))}
              </div>
            </Reveal>

            <div
              style={{
                maxWidth: T.containerMax,
                margin: "0 auto",
                paddingInline: T.containerPad,
                paddingBlock: "28px",
              }}
            >
              <Marker>MOST PROJECTS · 2–4 WEEKS · FIXED PRICING</Marker>
            </div>
          </section>
        </Reveal>

        <HorizonDivider />

        {/* ═══════════════ 05 — WHY US ═══════════════ */}
        <Reveal>
          <section
            id="why"
            style={{ borderTop: `1px solid ${T.border}`, background: T.surface }}
          >
            <div
              style={{
                maxWidth: T.containerMax,
                margin: "0 auto",
                paddingInline: T.containerPad,
                paddingBlock: "clamp(64px,9vw,112px)",
              }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 items-center">
                {/* Left — headline + value props */}
                <div>
                  <div className="mb-6">
                    <Marker>// 05 — WHY US</Marker>
                  </div>
                  <div
                    className="mb-10"
                    style={{
                      fontFamily: T.display,
                      fontWeight: 600,
                      fontSize: "clamp(2.5rem,5vw,4.5rem)",
                      lineHeight: 1.04,
                      letterSpacing: "-0.03em",
                    }}
                  >
                    <span className="block" style={{ color: T.fg }}>
                      No per-seat fees.
                    </span>
                    <span className="block" style={{ color: T.muted }}>
                      No lock-in.
                    </span>
                    <span className="block hero-glow" style={{ color: T.primary }}>
                      No nonsense.
                    </span>
                  </div>
                  <div style={{ borderTop: `1px solid ${T.border}` }}>
                    {WHY_PROPS.map((p) => (
                      <div
                        key={p.n}
                        className="py-6"
                        style={{ borderBottom: `1px solid ${T.border}` }}
                      >
                        <div className="flex items-baseline gap-3 mb-2">
                          <span
                            style={{
                              fontFamily: T.mono,
                              fontWeight: 600,
                              fontSize: "0.9rem",
                              letterSpacing: "-0.02em",
                              color: `${T.primary}60`,
                            }}
                          >
                            {p.n}
                          </span>
                          <h3
                            style={{
                              fontFamily: T.display,
                              fontWeight: 600,
                              fontSize: "1.125rem",
                              letterSpacing: "-0.01em",
                              lineHeight: 1.3,
                              color: T.fg,
                            }}
                          >
                            {p.title}
                          </h3>
                        </div>
                        <p
                          style={{
                            fontFamily: T.sans,
                            fontSize: "0.9rem",
                            lineHeight: 1.55,
                            letterSpacing: "-0.003em",
                            color: T.muted,
                            paddingLeft: 28,
                          }}
                        >
                          {p.desc}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right — FixedPricing asset */}
                <Reveal delay={0.1} direction="left">
                  <div
                    className="overflow-hidden"
                    style={{
                      background: T.bg,
                      border: `1px solid ${T.border}`,
                      borderRadius: T.r.xl,
                      height: 300,
                    }}
                  >
                    <FixedPricing style={{ height: 300, minHeight: 0 }} />
                  </div>
                </Reveal>
              </div>
            </div>
          </section>
        </Reveal>

        {/* ═══════════════ 06 — FREE TAILORED PLAN ═══════════════ */}
        <Reveal>
          <section
            id="free-plan"
            className="relative overflow-hidden"
            style={{ borderTop: `1px solid ${T.border}`, background: T.bg }}
          >
            {/* Ambient SystemHorizon backdrop */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ zIndex: 0, opacity: 0.5 }}
              aria-hidden
            >
              <SystemHorizon style={{ height: "100%", minHeight: 0 }} />
            </div>
            {/* Fade so content stays legible over the backdrop */}
            <div
              className="absolute inset-0 pointer-events-none"
              aria-hidden
              style={{
                zIndex: 1,
                background: `radial-gradient(ellipse 70% 70% at 50% 45%, ${T.bg} 30%, transparent 100%)`,
              }}
            />

            <div
              className="relative flex flex-col items-center text-center"
              style={{
                zIndex: 2,
                maxWidth: 760,
                margin: "0 auto",
                paddingInline: T.containerPad,
                paddingBlock: "clamp(80px,11vw,140px)",
              }}
            >
              <div className="mb-6">
                <Marker>// 06 — FREE TAILORED PLAN</Marker>
              </div>
              <h2
                style={{
                  fontFamily: T.display,
                  fontWeight: 600,
                  fontSize: "clamp(2.4rem,5.2vw,4rem)",
                  lineHeight: 1.04,
                  letterSpacing: "-0.03em",
                  color: T.fg,
                }}
              >
                Get a free, tailored plan
                <br />
                for your clinic.
              </h2>
              <p
                className="mt-6"
                style={{
                  fontFamily: T.sans,
                  fontSize: "1.0625rem",
                  lineHeight: 1.55,
                  letterSpacing: "-0.005em",
                  color: T.muted,
                  maxWidth: "52ch",
                }}
              >
                Answer a few quick questions — under a minute, including what you spend
                now — and we&apos;ll show you exactly what we&apos;d build and what
                you&apos;d save. No commitment.
              </p>

              <div className="mt-10 flex flex-col sm:flex-row items-center gap-4">
                {/* PRIMARY — free plan funnel */}
                <Link
                  href="/start"
                  className="inline-flex items-center justify-center gap-2 font-medium transition-opacity hover:opacity-90"
                  style={{
                    fontFamily: T.sans,
                    fontSize: "0.9375rem",
                    fontWeight: 500,
                    letterSpacing: "-0.005em",
                    height: 48,
                    paddingInline: 24,
                    background: T.primary,
                    color: T.primaryFg,
                    borderRadius: T.r.md,
                    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18), 0 0 28px ${T.primary}35`,
                    textDecoration: "none",
                  }}
                >
                  Get my free plan →
                </Link>
                {/* SECONDARY — ghost, book a call */}
                <Link
                  href="/book"
                  className="inline-flex items-center justify-center gap-2 font-medium transition-colors"
                  style={{
                    fontFamily: T.sans,
                    fontSize: "0.9375rem",
                    fontWeight: 500,
                    letterSpacing: "-0.005em",
                    height: 48,
                    paddingInline: 24,
                    background: "transparent",
                    color: T.fg,
                    border: `1px solid ${T.borderStr}`,
                    borderRadius: T.r.md,
                    textDecoration: "none",
                  }}
                >
                  Book a call
                </Link>
              </div>

              <div
                className="mt-8"
                style={{
                  fontFamily: T.mono,
                  fontSize: "0.75rem",
                  fontWeight: 500,
                  letterSpacing: "0.04em",
                  color: T.muted,
                }}
              >
                Response within 24 hours · UK-based, global reach
              </div>
            </div>
          </section>
        </Reveal>
      </main>

      {/* Systems Lab promo */}
      <div
        className="relative z-10"
        style={{
          borderTop: `1px solid ${T.border}`,
          background: T.surface,
          padding: "72px 24px",
        }}
      >
        <Reveal>
          <div
            style={{
              maxWidth: 1200,
              margin: "0 auto",
              display: "flex",
              flexDirection: "column",
              gap: 24,
            }}
            className="md:flex-row md:items-center md:justify-between"
          >
            <div>
              <div className="flex items-center gap-2 mb-5">
                <span
                  className="inline-flex items-center gap-2"
                  style={{
                    fontFamily: T.sans,
                    fontSize: "0.75rem",
                    fontWeight: 500,
                    letterSpacing: "0.08em",
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
                      boxShadow: `0 0 0 4px ${T.primary}20`,
                      flexShrink: 0,
                      display: "inline-block",
                    }}
                  />
                  New — Systems Lab
                </span>
              </div>
              <h2
                style={{
                  fontFamily: T.display,
                  fontWeight: 600,
                  fontSize: "clamp(1.75rem,3.5vw,2.75rem)",
                  lineHeight: 1.04,
                  letterSpacing: "-0.025em",
                  color: T.fg,
                }}
              >
                See your clinic system
                <br />
                <span style={{ color: T.muted }}>before you build.</span>
              </h2>
              <p
                style={{
                  fontFamily: T.sans,
                  fontSize: "0.9375rem",
                  lineHeight: 1.55,
                  letterSpacing: "-0.005em",
                  color: T.muted,
                  maxWidth: "50ch",
                  marginTop: 16,
                }}
              >
                Live, interactive demos — booking, the client portal, CRM and automations.
                Click around and see exactly what you&apos;d own.
              </p>
            </div>
            <Link
              href="/systems-lab"
              className="inline-flex items-center gap-3 font-medium transition-opacity hover:opacity-90 shrink-0"
              style={{
                fontFamily: T.sans,
                fontSize: "0.875rem",
                fontWeight: 500,
                letterSpacing: "-0.005em",
                height: 44,
                paddingInline: 22,
                background: "transparent",
                color: T.fg,
                borderRadius: 10,
                border: `1px solid ${T.borderStr}`,
              }}
            >
              Enter Systems Lab →
            </Link>
          </div>
        </Reveal>
      </div>

      <div className="relative z-10">
        <Footer />
      </div>
    </>
  );
}
