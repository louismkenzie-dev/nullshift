"use client";

import React from "react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import { T } from "@nullshift/ui/tokens";
import Link from "next/link";
import { Gyroscope } from "@/components/assets/Gyroscope";
import { NoTemplates } from "@/components/assets/NoTemplates";
import { SystemsSphere } from "@/components/assets/SystemsSphere";
import { AutomationFlow } from "@/components/assets/AutomationFlow";
import { ClientPortal } from "@/components/assets/ClientPortal";
import { ProcessTimeline } from "@/components/assets/ProcessTimeline";

/* ── Halo eyebrow (dot + ring + label-sm) ─────── */
function Eyebrow({
  children,
  tone = T.primary,
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return (
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
          background: tone,
          boxShadow: `0 0 0 4px ${tone}22`,
          flexShrink: 0,
          display: "inline-block",
        }}
      />
      {children}
    </span>
  );
}

function PageHero() {
  return (
    <section
      className="pt-32 pb-0 px-8 md:px-16 min-h-[55vh] flex flex-col justify-end"
      style={{
        background: `${T.bg}`,
        backgroundImage: `radial-gradient(ellipse 60% 50% at 70% 40%, color-mix(in oklab, ${T.primary} 6%, transparent) 0%, transparent 70%)`,
      }}
    >
      <div className="w-full pb-20 grid md:grid-cols-[1fr_auto] gap-10 md:gap-16 items-end">
        <div className="max-w-5xl">
          <div className="mb-7">
            <Eyebrow>About us</Eyebrow>
          </div>
          <h1
            style={{
              fontFamily: T.display,
              fontWeight: 600,
              fontSize: "clamp(3rem,9vw,7.5rem)",
              lineHeight: 1.04,
              letterSpacing: "-0.03em",
              color: T.fg,
            }}
          >
            We build the practice
            <br />
            software{" "}
            <span className="hero-glow" style={{ color: T.primary }}>
              your clinic owns.
            </span>
          </h1>
          <p
            className="mt-8 max-w-[46ch]"
            style={{
              fontFamily: T.sans,
              fontSize: "1.0625rem",
              lineHeight: 1.65,
              letterSpacing: "-0.005em",
              color: T.muted,
            }}
          >
            No per-seat booking fees. No payment skim. No data held hostage. Just bespoke
            booking, records and patient portals your clinic keeps forever.
          </p>
        </div>
        <div className="w-full md:w-[clamp(300px,32vw,420px)] order-first md:order-none">
          <Gyroscope
            style={{
              height: "clamp(300px,32vw,420px)",
              minHeight: "clamp(300px,32vw,420px)",
            }}
          />
        </div>
      </div>
    </section>
  );
}

function TheProblem() {
  return (
    <section style={{ borderTop: `1px solid ${T.border}` }}>
      <div
        className="grid md:grid-cols-2"
        style={{ borderLeft: `1px solid ${T.border}` }}
      >
        {/* Left — The Wix trap */}
        <div
          className="p-10 md:p-16"
          style={{
            borderRight: `1px solid ${T.border}`,
            borderBottom: `1px solid ${T.border}`,
          }}
        >
          <Reveal>
            <div className="mb-8">
              <Eyebrow tone={T.danger}>The Wix trap</Eyebrow>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <h2
              className="mb-8"
              style={{
                fontFamily: T.display,
                fontWeight: 600,
                fontSize: "clamp(1.875rem,3.5vw,2.75rem)",
                lineHeight: 1.08,
                letterSpacing: "-0.025em",
                color: T.fg,
              }}
            >
              You&apos;re renting,
              <br />
              <span style={{ color: T.danger }}>not owning.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.2}>
            <div className="flex flex-col gap-1">
              {[
                { label: "Per-seat booking fees", value: "£20–£60/mo per practitioner" },
                {
                  label: "Bill grows with every hire",
                  value: "More clinicians, bigger bill",
                },
                { label: "Payment skim on bookings", value: "2–3% of every payment" },
                {
                  label: "Your patient data is held hostage",
                  value: "Leave? Lose the records.",
                },
                { label: "Generic templates", value: "Looks like every other clinic" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-start justify-between gap-4 py-3.5"
                  style={{ borderBottom: `1px solid ${T.border}` }}
                >
                  <span
                    style={{
                      fontFamily: T.sans,
                      fontSize: "0.9375rem",
                      letterSpacing: "-0.005em",
                      color: T.muted,
                    }}
                  >
                    {item.label}
                  </span>
                  <span
                    style={{
                      fontFamily: T.mono,
                      fontSize: "0.8125rem",
                      color: T.danger,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>

        {/* Right — The Nullshift way */}
        <div className="p-10 md:p-16" style={{ borderBottom: `1px solid ${T.border}` }}>
          <Reveal>
            <div className="mb-8">
              <Eyebrow>The Nullshift way</Eyebrow>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <h2
              className="mb-8"
              style={{
                fontFamily: T.display,
                fontWeight: 600,
                fontSize: "clamp(1.875rem,3.5vw,2.75rem)",
                lineHeight: 1.08,
                letterSpacing: "-0.025em",
                color: T.fg,
              }}
            >
              Your site.
              <br />
              <span className="hero-glow" style={{ color: T.primary }}>
                Your code.
              </span>
            </h2>
          </Reveal>
          <Reveal delay={0.2}>
            <div className="flex flex-col gap-1">
              {[
                { label: "One-time build cost", value: "Fixed quote, no surprises" },
                { label: "Add clinicians for free", value: "No per-seat fees, ever" },
                { label: "Keep 100% of every payment", value: "No skim on bookings" },
                {
                  label: "You own the code + the data",
                  value: "Cancel anytime, keep everything",
                },
                {
                  label: "100% bespoke to your clinic",
                  value: "Built around how you work",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-start justify-between gap-4 py-3.5"
                  style={{ borderBottom: `1px solid ${T.border}` }}
                >
                  <span
                    style={{
                      fontFamily: T.sans,
                      fontSize: "0.9375rem",
                      letterSpacing: "-0.005em",
                      color: T.muted,
                    }}
                  >
                    {item.label}
                  </span>
                  <span
                    style={{
                      fontFamily: T.mono,
                      fontSize: "0.8125rem",
                      color: T.primary,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function HowWeBuild() {
  return (
    <section
      className="px-10 md:px-16 py-24"
      style={{ borderTop: `1px solid ${T.border}`, background: T.surface }}
    >
      <Reveal>
        <div className="mb-12">
          <Eyebrow>How we build</Eyebrow>
        </div>
      </Reveal>
      <div className="grid md:grid-cols-2 gap-16 items-start">
        <Reveal delay={0.1}>
          <h2
            style={{
              fontFamily: T.display,
              fontWeight: 600,
              fontSize: "clamp(2.25rem,5vw,4rem)",
              lineHeight: 1.04,
              letterSpacing: "-0.03em",
              color: T.fg,
            }}
          >
            Precision code.
            <br />
            <span style={{ color: T.muted }}>Fast delivery.</span>
          </h2>
          <div className="mt-10">
            <NoTemplates style={{ height: 300, minHeight: 300 }} />
          </div>
        </Reveal>
        <Reveal delay={0.2}>
          <div className="flex flex-col gap-6">
            <p
              style={{
                fontFamily: T.sans,
                fontSize: "0.9375rem",
                lineHeight: 1.65,
                letterSpacing: "-0.005em",
                color: T.muted,
              }}
            >
              Every line of code in your clinic&apos;s software is written with purpose.
              We don&apos;t use drag-and-drop builders, generic theme frameworks, or
              off-the-shelf templates — because your clinic isn&apos;t generic.
            </p>
            <p
              style={{
                fontFamily: T.sans,
                fontSize: "0.9375rem",
                lineHeight: 1.65,
                letterSpacing: "-0.005em",
                color: T.muted,
              }}
            >
              Our development process combines modern engineering practices with precision
              tooling — allowing us to build at a pace that traditional agencies simply
              can&apos;t match, without compromising on quality or code integrity.
            </p>
            <p
              style={{
                fontFamily: T.sans,
                fontSize: "0.9375rem",
                lineHeight: 1.65,
                letterSpacing: "-0.005em",
                color: T.muted,
              }}
            >
              The result: booking, records and patient portals that are faster, cheaper to
              run, and built exactly to your clinic&apos;s specification — with zero
              platform dependency and no lock-in whatsoever.
            </p>
            <div className="pt-2">
              <Eyebrow>Bespoke code · No builders · Your ownership</Eyebrow>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function WhatWeBuild() {
  const caps = [
    {
      Asset: SystemsSphere,
      title: "Connected as one.",
      caption:
        "Booking, records, portals — wired into a single system that fits how your clinic actually works.",
    },
    {
      Asset: AutomationFlow,
      title: "Work that runs itself.",
      caption:
        "Reminders, follow-ups, recalls — triggered on time, every time, with no one watching.",
    },
    {
      Asset: ClientPortal,
      title: "A place to log in.",
      caption:
        "Dashboards and portals your patients actually want to open — their records, their appointments, one login.",
    },
  ];
  return (
    <section style={{ borderTop: `1px solid ${T.border}`, background: T.bg }}>
      <div className="px-10 md:px-16 pt-20 pb-12">
        <Reveal>
          <div
            className="mb-7"
            style={{
              fontFamily: T.mono,
              fontSize: "0.75rem",
              fontWeight: 500,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: T.primary,
            }}
          >
            // WHAT WE BUILD
          </div>
        </Reveal>
        <Reveal delay={0.05}>
          <h2
            style={{
              fontFamily: T.display,
              fontWeight: 600,
              fontSize: "clamp(2.25rem,5vw,4rem)",
              lineHeight: 1.04,
              letterSpacing: "-0.03em",
              color: T.fg,
            }}
          >
            More than a site. <span style={{ color: T.muted }}>A system.</span>
          </h2>
        </Reveal>
      </div>
      <div
        className="grid md:grid-cols-3"
        style={{
          borderTop: `1px solid ${T.border}`,
          borderLeft: `1px solid ${T.border}`,
        }}
      >
        {caps.map(({ Asset, title, caption }, i) => (
          <Reveal key={title} delay={i * 0.1}>
            <div
              className="flex flex-col h-full"
              style={{
                borderRight: `1px solid ${T.border}`,
                borderBottom: `1px solid ${T.border}`,
              }}
            >
              <div style={{ borderBottom: `1px solid ${T.border}` }}>
                <Asset style={{ height: 200, minHeight: 200 }} />
              </div>
              <div className="p-8 md:p-10">
                <h3
                  className="mb-3"
                  style={{
                    fontFamily: T.display,
                    fontWeight: 600,
                    fontSize: "1.25rem",
                    letterSpacing: "-0.015em",
                    color: T.fg,
                  }}
                >
                  {title}
                </h3>
                <p
                  style={{
                    fontFamily: T.sans,
                    fontSize: "0.9375rem",
                    lineHeight: 1.55,
                    letterSpacing: "-0.005em",
                    color: T.muted,
                  }}
                >
                  {caption}
                </p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function ProcessBand() {
  return (
    <section style={{ borderTop: `1px solid ${T.border}`, background: T.surface }}>
      <div className="grid md:grid-cols-[auto_1fr] items-center">
        <div
          className="p-10 md:p-16 md:max-w-sm"
          style={{ borderBottom: `1px solid ${T.border}` }}
        >
          <Reveal>
            <div className="mb-7">
              <Eyebrow>How it works</Eyebrow>
            </div>
          </Reveal>
          <Reveal delay={0.05}>
            <h2
              className="mb-5"
              style={{
                fontFamily: T.display,
                fontWeight: 600,
                fontSize: "clamp(2rem,4vw,3rem)",
                lineHeight: 1.04,
                letterSpacing: "-0.03em",
                color: T.fg,
              }}
            >
              Discover to <span style={{ color: T.muted }}>launch.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p
              style={{
                fontFamily: T.sans,
                fontSize: "0.9375rem",
                lineHeight: 1.65,
                letterSpacing: "-0.005em",
                color: T.muted,
                maxWidth: "40ch",
              }}
            >
              A clear path from first conversation to live site. Fixed pricing, no
              surprises.
            </p>
          </Reveal>
        </div>
        <div
          className="md:border-l"
          style={{ borderColor: T.border, borderBottom: `1px solid ${T.border}` }}
        >
          <ProcessTimeline style={{ height: 220, minHeight: 220 }} />
        </div>
      </div>
    </section>
  );
}

function Founder() {
  const tags = [
    "Full-Stack Development",
    "Brand Creation",
    "Front-End Design",
    "Back-End Function",
    "Photo / Video",
    "AI Optimisation",
  ];
  return (
    <section style={{ borderTop: `1px solid ${T.border}`, background: T.surface }}>
      <div className="grid md:grid-cols-2">
        {/* Photo */}
        <Reveal className="relative">
          <div
            className="relative h-full min-h-[420px] md:min-h-[600px]"
            style={{ borderBottom: `1px solid ${T.border}` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/louis-mckenzie.jpg"
              alt="Louis McKenzie — Lead Developer & Founder of Nullshift"
              className="absolute inset-0 w-full h-full object-cover"
              style={{ objectPosition: "center 25%" }}
            />
            {/* Brand wash + grain so the photo sits in the dark palette */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `linear-gradient(to top, ${T.bg} 0%, transparent 45%), linear-gradient(to right, transparent 60%, color-mix(in oklab, ${T.bg} 70%, transparent) 100%)`,
              }}
            />
            {/* Name plate */}
            <div className="absolute bottom-0 left-0 p-6 md:p-8">
              <div className="mb-3">
                <Eyebrow>Founder · Lead developer</Eyebrow>
              </div>
              <div
                style={{
                  fontFamily: T.display,
                  fontWeight: 600,
                  fontSize: "clamp(1.75rem,3vw,2.5rem)",
                  letterSpacing: "-0.02em",
                  color: T.fg,
                }}
              >
                Louis McKenzie
              </div>
            </div>
          </div>
        </Reveal>

        {/* Bio */}
        <div
          className="p-10 md:p-16 flex flex-col justify-center"
          style={{ borderBottom: `1px solid ${T.border}` }}
        >
          <Reveal>
            <div className="mb-8">
              <Eyebrow>Who builds it</Eyebrow>
            </div>
          </Reveal>
          <Reveal delay={0.05}>
            <h2
              className="mb-6"
              style={{
                fontFamily: T.display,
                fontWeight: 600,
                fontSize: "clamp(2rem,4vw,3rem)",
                lineHeight: 1.04,
                letterSpacing: "-0.03em",
                color: T.fg,
              }}
            >
              Meet the <span style={{ color: T.muted }}>maker.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <div
              className="flex flex-col gap-5"
              style={{
                fontFamily: T.sans,
                fontSize: "0.9375rem",
                lineHeight: 1.65,
                letterSpacing: "-0.005em",
                color: T.muted,
                maxWidth: "52ch",
              }}
            >
              <p>
                Nullshift is led by <span style={{ color: T.fg }}>Louis McKenzie</span> —
                a Newcastle University student with a rich background in brand creation
                and site development.
              </p>
              <p>
                With a creative eye, Louis has worked with many brands to shoot video and
                photography for seamless, polished output — and has since made the switch
                to building full digital presences end to end.
              </p>
              <p>
                He&apos;s a <span style={{ color: T.fg }}>full-stack developer</span> who
                takes care of both the front-end design and the back-end function — so
                your project is handled, start to finish, by one person who genuinely
                cares how it looks and how it works.
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.15}>
            <div className="flex flex-wrap gap-2 mt-8">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center"
                  style={{
                    fontFamily: T.mono,
                    fontWeight: 500,
                    fontSize: "0.75rem",
                    letterSpacing: "0em",
                    height: 28,
                    paddingInline: 12,
                    background: `${T.primary}14`,
                    color: T.primary,
                    borderRadius: "999px",
                    border: `1px solid ${T.primary}30`,
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function Commitment() {
  const stats = [
    {
      value: "100%",
      label: "Custom code",
      sub: "Every clinic build written from scratch, no templates used.",
    },
    {
      value: "Yours",
      label: "You own everything",
      sub: "The code and every account are yours from day one — cancel anytime and keep the lot.",
    },
    {
      value: "1 plan",
      label: "We host it, you own it",
      sub: "Your monthly is us hosting and running the software — not a licence to use your own clinic.",
    },
  ];
  return (
    <section style={{ borderTop: `1px solid ${T.border}` }}>
      <div className="px-10 md:px-16 pt-20 pb-12">
        <Reveal>
          <h2
            style={{
              fontFamily: T.display,
              fontWeight: 600,
              fontSize: "clamp(2.25rem,5vw,4rem)",
              lineHeight: 1.04,
              letterSpacing: "-0.03em",
              color: T.fg,
            }}
          >
            Our <span style={{ color: T.muted }}>commitment.</span>
          </h2>
        </Reveal>
      </div>
      <div
        className="grid md:grid-cols-3"
        style={{
          borderTop: `1px solid ${T.border}`,
          borderLeft: `1px solid ${T.border}`,
        }}
      >
        {stats.map((s, i) => (
          <Reveal key={s.label} delay={i * 0.1}>
            <div
              className="p-10 md:p-14"
              style={{
                borderRight: `1px solid ${T.border}`,
                borderBottom: `1px solid ${T.border}`,
              }}
            >
              <div
                className="mb-4 hero-glow"
                style={{
                  fontFamily: T.mono,
                  fontWeight: 600,
                  fontSize: "3rem",
                  lineHeight: 1,
                  letterSpacing: "-0.02em",
                  color: T.primary,
                }}
              >
                {s.value}
              </div>
              <h3
                className="mb-3"
                style={{
                  fontFamily: T.display,
                  fontWeight: 600,
                  fontSize: "1.25rem",
                  letterSpacing: "-0.015em",
                  color: T.fg,
                }}
              >
                {s.label}
              </h3>
              <p
                style={{
                  fontFamily: T.sans,
                  fontSize: "0.9375rem",
                  lineHeight: 1.55,
                  letterSpacing: "-0.005em",
                  color: T.muted,
                }}
              >
                {s.sub}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function CtaStrip() {
  return (
    <section
      className="px-10 md:px-16 py-24 flex flex-col md:flex-row items-start md:items-center justify-between gap-8"
      style={{ borderTop: `1px solid ${T.border}`, background: T.surface }}
    >
      <Reveal>
        <h2
          style={{
            fontFamily: T.display,
            fontWeight: 600,
            fontSize: "clamp(2rem,4vw,3.25rem)",
            lineHeight: 1.04,
            letterSpacing: "-0.03em",
            color: T.fg,
          }}
        >
          Ready to own your
          <br />
          <span style={{ color: T.primary }}>online presence?</span>
        </h2>
      </Reveal>
      <Reveal delay={0.1}>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <Link
            href="/start"
            className="inline-flex items-center justify-center gap-2 font-medium"
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
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18)`,
              whiteSpace: "nowrap",
              textDecoration: "none",
              transition: `background ${T.duration.base} ${T.ease}`,
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLElement).style.background = T.primaryHover)
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLElement).style.background = T.primary)
            }
          >
            Get my free plan →
          </Link>
          <Link
            href="/book"
            className="inline-flex items-center justify-center gap-2 font-medium"
            style={{
              fontFamily: T.sans,
              fontSize: "0.9375rem",
              fontWeight: 500,
              letterSpacing: "-0.005em",
              height: 48,
              paddingInline: 24,
              background: "transparent",
              color: T.fg,
              borderRadius: T.r.md,
              border: `1px solid ${T.borderStr}`,
              whiteSpace: "nowrap",
              textDecoration: "none",
              transition: `border-color ${T.duration.base} ${T.ease}, background ${T.duration.base} ${T.ease}`,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = T.primary;
              (e.currentTarget as HTMLElement).style.background = T.primarySoft;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = T.borderStr;
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            Book a call
          </Link>
        </div>
      </Reveal>
    </section>
  );
}

export default function AboutPage() {
  return (
    <>
      <Nav />
      <main>
        <PageHero />
        <TheProblem />
        <HowWeBuild />
        <WhatWeBuild />
        <ProcessBand />
        <Founder />
        <Commitment />
        <CtaStrip />
      </main>
      <Footer />
    </>
  );
}
