import type { Metadata } from "next";
import React from "react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { T } from "@nullshift/ui/tokens";
import {
  Reveal,
  Section,
  Container,
  Eyebrow,
  Display,
  Lead,
  SectionHeader,
  MonoTag,
  StatGrid,
  ServiceGrid,
  CellGrid,
  Cell,
  Watermark,
  CTABand,
  BookingPreview,
  DashboardPreview,
  type ServiceItem,
  type Stat,
} from "@/components/kyma";

export const metadata: Metadata = {
  title: "About — Nullshift",
  description:
    "We're an agentic AI automation partner. Bring any idea — or just a pain point — and we build the systems that automate the work draining your staff cost, time and revenue. Any industry. Owned by you.",
  alternates: { canonical: "/about" },
};

const RENT = [
  { label: "Staff doing it by hand", value: "Salary spent on work a system should do" },
  { label: "Cost grows with every hire", value: "You hire to keep up, not to grow" },
  {
    label: "Human error and dropped balls",
    value: "Missed follow-ups, revenue leaking out",
  },
  { label: "Everything refers back to you", value: "Founders are the bottleneck" },
  {
    label: "Wired together yourself with AI tools",
    value: "A prototype you're left to defend",
  },
];
const OWN = [
  { label: "Agentic systems do the work", value: "Around the clock, no salary attached" },
  { label: "Scales without the headcount", value: "Add volume, not per-seat fees" },
  { label: "Built to run, not to break", value: "On time, every time, no one watching" },
  { label: "Bottlenecks automated away", value: "Set up for exponential growth" },
  {
    label: "Built by senior developers, owned by you",
    value: "Watertight, and yours outright",
  },
];

const SYSTEM: ServiceItem[] = [
  {
    n: "01",
    label: "Agentic AI",
    title: "Agents that do the work.",
    desc: "Autonomous agents that take on multi-step operational work end to end — deciding, acting and reporting back, not just answering questions.",
  },
  {
    n: "02",
    label: "Automation",
    title: "Work that runs itself.",
    desc: "The repetitive ops, admin and hand-offs your team does by hand — mapped, built and run for you, on time, every time, with no one watching.",
  },
  {
    n: "03",
    label: "Integrations",
    title: "Everything connected.",
    desc: "Your tools, data and AI wired into one system you own — nothing left in a silo, nothing re-keyed by hand, all of it yours to log into.",
  },
];

const PROCESS = [
  {
    num: "001",
    title: "Deep dive",
    desc: "Our automation specialists map your operations and find exactly what should become a system — even if you only brought a pain point.",
  },
  {
    num: "002",
    title: "Design the agents",
    desc: "We design the systems and agentic workflows, scope it tightly, and show you what you'll get before a line is built.",
  },
  {
    num: "003",
    title: "Build & integrate",
    desc: "Our senior developers build it fast with cutting-edge AI, wire it into your tools and migrate your data — no downtime.",
  },
  {
    num: "004",
    title: "Run & scale",
    desc: "It's yours — code, data, accounts. We run it, carry the liability, and keep optimising so it scales as you do.",
  },
];

const COMMITMENT: Stat[] = [
  {
    value: "Liability",
    label: "Carried by us",
    sub: "We take responsibility for data breaches, security and compliance — a watertight system, not a prototype you defend.",
  },
  {
    value: "Yours",
    label: "You own everything",
    sub: "Code, data and every account are yours from day one — no per-seat fees, no lock-in, cancel anytime and keep the lot.",
  },
  {
    value: "Scale",
    label: "Built past the ceiling",
    sub: "We automate the bottlenecks that funnel back to you and set your business up for exponential, not linear, growth.",
  },
];

const SKILLS = [
  "Full-Stack Development",
  "Brand Creation",
  "Front-End Design",
  "Back-End Function",
  "Photo / Video",
  "AI Optimisation",
];

function CompareList({
  items,
  tone,
}: {
  items: { label: string; value: string }[];
  tone: "primary" | "danger";
}) {
  const accent = tone === "danger" ? T.danger : "var(--k-accent)";
  return (
    <div className="flex flex-col">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex flex-col gap-1 py-3.5"
          style={{ borderBottom: "1px solid var(--k-border)" }}
        >
          <span
            style={{
              fontFamily: T.sans,
              fontSize: "0.95rem",
              letterSpacing: "-0.01em",
              color: "var(--k-fg)",
            }}
          >
            {item.label}
          </span>
          <span
            style={{
              fontFamily: T.mono,
              fontSize: "0.74rem",
              letterSpacing: "0.02em",
              color: accent,
            }}
          >
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function AboutPage() {
  return (
    <>
      <Nav />
      <main>
        {/* ═══════════════ HERO (dark) ═══════════════ */}
        <Section theme="dark" pad="none" grid className="overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background: `radial-gradient(70% 50% at 18% 8%, ${T.primary}1a 0%, transparent 60%)`,
            }}
          />
          <Container
            style={{
              paddingTop: "clamp(116px,15vh,168px)",
              paddingBottom: "clamp(40px,6vw,72px)",
              position: "relative",
              zIndex: 1,
            }}
          >
            <Reveal>
              <Eyebrow index="00" label="About us" />
            </Reveal>

            <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-10 lg:gap-16 items-center">
              <div>
                <Reveal delay={0.05}>
                  <Display as="h1" size="xl" style={{ maxWidth: "16ch" }}>
                    We build the agentic AI your business{" "}
                    <span style={{ color: "var(--k-accent)" }}>[owns].</span>
                  </Display>
                </Reveal>
                <Reveal delay={0.1}>
                  <Lead
                    className="mt-7"
                    style={{ maxWidth: "48ch", fontSize: "1.125rem" }}
                  >
                    Bring any idea — or just a pain point. We build agentic AI systems
                    that automate the operational work draining your staff cost, time and
                    revenue. Any industry. Owned outright by you.
                  </Lead>
                </Reveal>
              </div>
              <Reveal delay={0.14} direction="left">
                <div className="k-kard" style={{ padding: 14 }}>
                  <p
                    style={{
                      fontFamily: T.mono,
                      fontSize: "0.72rem",
                      lineHeight: 1.5,
                      letterSpacing: "0.02em",
                      textTransform: "uppercase",
                      color: "var(--k-muted)",
                      padding: "4px 6px 14px",
                    }}
                  >
                    The agents, automations and systems your operation runs on — in one
                    system you own.
                  </p>
                  <BookingPreview />
                  <div className="flex items-center justify-between px-1.5 pt-3">
                    <span
                      className="inline-flex items-center gap-2"
                      style={{
                        fontFamily: T.mono,
                        fontSize: "0.66rem",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "var(--k-accent)",
                      }}
                    >
                      <span
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: 999,
                          background: "var(--k-accent)",
                        }}
                      />
                      Live · owned
                    </span>
                    <span
                      style={{
                        fontFamily: T.mono,
                        fontSize: "0.66rem",
                        color: "var(--k-faint)",
                      }}
                    >
                      2026
                    </span>
                  </div>
                </div>
              </Reveal>
            </div>

            <div className="mt-12 overflow-hidden">
              <Watermark>Nullshift</Watermark>
            </div>
          </Container>
        </Section>

        {/* ═══════════════ 01 — RENT VS OWN (cream comparison) ═══════════════ */}
        <Section theme="cream" pad="lg" topBorder className="overflow-hidden">
          <Reveal>
            <Eyebrow index="01" label="By hand vs automated" />
          </Reveal>
          <div
            className="mt-10 grid md:grid-cols-2"
            style={{
              borderTop: "1px solid var(--k-border)",
              borderLeft: "1px solid var(--k-border)",
            }}
          >
            <div
              className="p-8 md:p-12"
              style={{
                borderRight: "1px solid var(--k-border)",
                borderBottom: "1px solid var(--k-border)",
              }}
            >
              <Reveal>
                <Eyebrow label="Doing it by hand" tone="danger" />
                <Display size="md" className="mt-6 mb-8">
                  Your team,
                  <br />
                  <span style={{ color: T.danger }}>doing the work.</span>
                </Display>
                <CompareList items={RENT} tone="danger" />
              </Reveal>
            </div>
            <div
              className="p-8 md:p-12"
              style={{
                borderRight: "1px solid var(--k-border)",
                borderBottom: "1px solid var(--k-border)",
              }}
            >
              <Reveal delay={0.08}>
                <Eyebrow label="The Nullshift way" tone="accent" />
                <Display size="md" className="mt-6 mb-8">
                  Our agents.
                  <br />
                  <span style={{ color: "var(--k-accent)" }}>Your system.</span>
                </Display>
                <CompareList items={OWN} tone="primary" />
              </Reveal>
            </div>
          </div>
        </Section>

        {/* ═══════════════ 02 — HOW WE BUILD (dark + DashboardPreview) ═══════════════ */}
        <Section theme="dark" pad="lg" topBorder>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <Reveal>
              <div>
                <Eyebrow index="02" label="How we build" />
                <Display size="lg" className="mt-6">
                  Pioneering systems.
                  <br />
                  <span style={{ color: "var(--k-muted)" }}>Built fast.</span>
                </Display>
                <div className="mt-8">
                  <DashboardPreview />
                </div>
              </div>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="flex flex-col gap-5">
                <Lead>
                  We&apos;re a team of senior developers using cutting-edge AI and agentic
                  techniques to build complex, pioneering systems — fast, and at a
                  fraction of agency cost. Whatever you can imagine, however complicated,
                  we know how to build it.
                </Lead>
                <Lead>
                  This is far more than you&apos;d get wiring it together yourself with AI
                  tools. We come from a real R&amp;D background applying the latest AI to
                  automate businesses — so we build the systems others can&apos;t, and we
                  carry the liability so they&apos;re watertight.
                </Lead>
                <Lead>
                  The result: agentic systems that are faster, cheaper to run, and built
                  exactly to how your operation works — hosted in the UK/EU, encrypted,
                  with a full audit trail, and no lock-in whatsoever. You own all of it.
                </Lead>
                <div className="pt-2">
                  <MonoTag>Cutting-edge AI · Senior developers · Your ownership</MonoTag>
                </div>
              </div>
            </Reveal>
          </div>
        </Section>

        {/* ═══════════════ 03 — WHAT WE BUILD (cream services) ═══════════════ */}
        <Section theme="cream" pad="lg" topBorder>
          <Reveal>
            <SectionHeader
              index="03"
              label="What we build"
              title={
                <>
                  More than a tool.{" "}
                  <span style={{ color: "var(--k-accent)" }}>A system.</span>
                </>
              }
            />
          </Reveal>
          <Reveal delay={0.08}>
            <div className="mt-12">
              <ServiceGrid items={SYSTEM} cols={3} />
            </div>
          </Reveal>
        </Section>

        {/* ═══════════════ 04 — PROCESS (dark timeline) ═══════════════ */}
        <Section theme="dark" pad="lg" topBorder>
          <Reveal>
            <SectionHeader
              index="04"
              label="How it works"
              title={
                <>
                  Pain point to <span style={{ color: "var(--k-accent)" }}>system.</span>
                </>
              }
              lead="A clear path from first conversation to autonomous systems you own outright. We do the finding, the building and the running."
            />
          </Reveal>
          <Reveal delay={0.08}>
            <div className="mt-12">
              <CellGrid cols={4}>
                {PROCESS.map((step) => (
                  <Cell key={step.num} className="gap-4">
                    <span
                      style={{
                        fontFamily: T.mono,
                        fontWeight: 500,
                        fontSize: "1.6rem",
                        lineHeight: 1,
                        color: "var(--k-accent)",
                      }}
                    >
                      {step.num}
                    </span>
                    <h3
                      style={{
                        fontFamily: T.sans,
                        fontWeight: 700,
                        fontSize: "clamp(1.1rem,1.6vw,1.4rem)",
                        letterSpacing: "-0.02em",
                        textTransform: "uppercase",
                        color: "var(--k-fg)",
                      }}
                    >
                      {step.title}
                    </h3>
                    <div
                      className="h-px w-5"
                      style={{ background: "var(--k-border-strong)" }}
                    />
                    <p
                      style={{
                        fontFamily: T.sans,
                        fontSize: "0.88rem",
                        lineHeight: 1.5,
                        color: "var(--k-muted)",
                      }}
                    >
                      {step.desc}
                    </p>
                  </Cell>
                ))}
              </CellGrid>
            </div>
          </Reveal>
          <div className="mt-7">
            <MonoTag>You bring the problem · we bring the system</MonoTag>
          </div>
        </Section>

        {/* ═══════════════ 05 — FOUNDER (cream) ═══════════════ */}
        <Section theme="cream" pad="none" topBorder bare>
          <div className="grid md:grid-cols-2">
            <Reveal className="relative">
              <div
                className="relative h-full min-h-[420px] md:min-h-[600px]"
                style={{
                  borderBottom: "1px solid var(--k-border)",
                  borderRight: "1px solid var(--k-border)",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/louis-mckenzie.jpg"
                  alt="Louis McKenzie — Founder & Lead Developer of Nullshift"
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ objectPosition: "center 25%" }}
                />
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      "linear-gradient(to top, var(--k-bg) 0%, transparent 45%), linear-gradient(to right, transparent 60%, color-mix(in oklab, var(--k-bg) 70%, transparent) 100%)",
                  }}
                />
                <div className="absolute bottom-0 left-0 p-6 md:p-8">
                  <Eyebrow label="Founder · Lead developer" />
                  <div
                    className="mt-3"
                    style={{
                      fontFamily: T.sans,
                      fontWeight: 800,
                      fontSize: "clamp(1.75rem,3vw,2.5rem)",
                      letterSpacing: "-0.03em",
                      textTransform: "uppercase",
                      color: "var(--k-fg)",
                    }}
                  >
                    Louis McKenzie
                  </div>
                </div>
              </div>
            </Reveal>

            <div
              className="p-8 md:p-14 flex flex-col justify-center"
              style={{ borderBottom: "1px solid var(--k-border)" }}
            >
              <Reveal>
                <Eyebrow index="05" label="Who builds it" />
                <Display size="md" className="mt-6 mb-6">
                  Meet the <span style={{ color: "var(--k-accent)" }}>maker.</span>
                </Display>
                <div
                  className="flex flex-col gap-5"
                  style={{
                    fontFamily: T.sans,
                    fontSize: "0.95rem",
                    lineHeight: 1.65,
                    color: "var(--k-muted)",
                    maxWidth: "52ch",
                  }}
                >
                  <p>
                    Nullshift is led by{" "}
                    <span style={{ color: "var(--k-fg)" }}>Louis McKenzie</span> — a
                    Newcastle University student with a rich background in brand creation
                    and site development.
                  </p>
                  <p>
                    With a creative eye, Louis has worked with many brands to shoot video
                    and photography for seamless, polished output — and has since made the
                    switch to building full digital presences end to end.
                  </p>
                  <p>
                    He&apos;s a{" "}
                    <span style={{ color: "var(--k-fg)" }}>full-stack developer</span> who
                    takes care of both the front-end design and the back-end function — so
                    your project is handled, start to finish, by one person who genuinely
                    cares how it looks and how it works.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 mt-8">
                  {SKILLS.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center"
                      style={{
                        fontFamily: T.mono,
                        fontWeight: 500,
                        fontSize: "0.72rem",
                        height: 28,
                        paddingInline: 12,
                        background:
                          "color-mix(in oklab, var(--k-accent) 12%, transparent)",
                        color: "var(--k-accent)",
                        borderRadius: 999,
                        border:
                          "1px solid color-mix(in oklab, var(--k-accent) 32%, transparent)",
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </Reveal>
            </div>
          </div>
        </Section>

        {/* ═══════════════ 06 — COMMITMENT (dark) ═══════════════ */}
        <Section theme="dark" pad="lg" topBorder>
          <Reveal>
            <SectionHeader
              index="06"
              label="Our commitment"
              title={
                <>
                  Our <span style={{ color: "var(--k-accent)" }}>commitment.</span>
                </>
              }
            />
          </Reveal>
          <Reveal delay={0.08}>
            <div className="mt-12">
              <StatGrid stats={COMMITMENT} cols={3} />
            </div>
          </Reveal>
        </Section>

        {/* ═══════════════ FINAL CTA (dark) ═══════════════ */}
        <div style={{ borderTop: "1px solid var(--k-border)" }}>
          <CTABand
            theme="dark"
            index="07"
            label="Get started"
            title={
              <>
                Ready to move into the{" "}
                <span style={{ color: "var(--k-accent)" }}>AI era?</span>
              </>
            }
            lead="Tell us an idea or just a pain point and we'll show you exactly what we'd automate and what it'd save. No commitment."
            primary={{ label: "Get my free plan", href: "/start" }}
            secondary={{ label: "Book a call", href: "/book" }}
            note="Response within 24 hours · UK-based, global reach"
          />
        </div>
      </main>
      <Footer />
    </>
  );
}
