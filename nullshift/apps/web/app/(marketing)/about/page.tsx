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
    "We build businesses bespoke websites, systems and automations they own outright. No per-seat SaaS fees, no payment skim, no data held hostage.",
  alternates: { canonical: "/about" },
};

const RENT = [
  { label: "Per-seat SaaS fees", value: "Billed per team member, every month" },
  { label: "Bill grows with every hire", value: "More seats, bigger bill" },
  { label: "Payment skim on transactions", value: "2–3% of every payment" },
  { label: "Your customer data is held hostage", value: "Leave? Lose the records." },
  { label: "Generic templates", value: "Looks like every other business" },
];
const OWN = [
  { label: "One-off build you own outright", value: "Fixed quote, no surprises" },
  { label: "Add team members for free", value: "No per-seat fees, ever" },
  { label: "Keep 100% of every payment", value: "No skim on transactions" },
  { label: "You own the code + the data", value: "Cancel anytime, keep everything" },
  { label: "100% bespoke to your business", value: "Built around how you work" },
];

const SYSTEM: ServiceItem[] = [
  {
    n: "01",
    label: "Connected",
    title: "Connected as one.",
    desc: "Website, booking, CRM, payments, portals — wired into a single system that fits how your business actually works.",
  },
  {
    n: "02",
    label: "Automated",
    title: "Work that runs itself.",
    desc: "Reminders, follow-ups, integrations — triggered on time, every time, with no one watching.",
  },
  {
    n: "03",
    label: "Owned",
    title: "A place to log in.",
    desc: "Dashboards and portals your customers actually want to open — their records, their bookings, one login.",
  },
];

const PROCESS = [
  {
    num: "001",
    title: "Discovery",
    desc: "We learn your business — what you offer, your team, and the subscriptions you pay for and hate.",
  },
  {
    num: "002",
    title: "Build & migrate",
    desc: "We build your bespoke system, then move your data across — no downtime, no lost leads.",
  },
  {
    num: "003",
    title: "Go live",
    desc: "DPA signed, we switch it on. Customers book, payments land, automations fire.",
  },
  {
    num: "004",
    title: "Own & run",
    desc: "It's yours — code, data, accounts. We host and run it on a care plan you can cancel and keep.",
  },
];

const COMMITMENT: Stat[] = [
  {
    value: "100%",
    label: "Custom code",
    sub: "Every build written from scratch, no templates used.",
  },
  {
    value: "Yours",
    label: "You own everything",
    sub: "Code and every account are yours from day one — cancel anytime and keep the lot.",
  },
  {
    value: "1 plan",
    label: "We host, you own",
    sub: "Your care plan is us hosting, running and covering the software — not a licence to use your own system.",
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
                    We build the software your business{" "}
                    <span style={{ color: "var(--k-accent)" }}>[owns].</span>
                  </Display>
                </Reveal>
                <Reveal delay={0.1}>
                  <Lead
                    className="mt-7"
                    style={{ maxWidth: "48ch", fontSize: "1.125rem" }}
                  >
                    No per-seat SaaS fees. No payment skim. No data held hostage. Just
                    bespoke websites, systems and automations your business keeps forever.
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
                    The website, systems and payments your business runs on — in one
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
            <Eyebrow index="01" label="Rent vs own" />
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
                <Eyebrow label="The rental trap" tone="danger" />
                <Display size="md" className="mt-6 mb-8">
                  You&apos;re renting,
                  <br />
                  <span style={{ color: T.danger }}>not owning.</span>
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
                  Your site.
                  <br />
                  <span style={{ color: "var(--k-accent)" }}>Your code.</span>
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
                  Precision code.
                  <br />
                  <span style={{ color: "var(--k-muted)" }}>Fast delivery.</span>
                </Display>
                <div className="mt-8">
                  <DashboardPreview />
                </div>
              </div>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="flex flex-col gap-5">
                <Lead>
                  Every line of code in your business&apos;s software is written with
                  purpose. We don&apos;t use drag-and-drop builders, generic theme
                  frameworks, or off-the-shelf templates — because your business
                  isn&apos;t generic.
                </Lead>
                <Lead>
                  Our development process combines modern engineering practices with
                  precision tooling — allowing us to build at a pace that traditional
                  agencies simply can&apos;t match, without compromising on quality or
                  code integrity.
                </Lead>
                <Lead>
                  The result: websites, systems and portals that are faster, cheaper to
                  run, and built exactly to your business&apos;s specification — with zero
                  platform dependency and no lock-in whatsoever.
                </Lead>
                <div className="pt-2">
                  <MonoTag>Bespoke code · No builders · Your ownership</MonoTag>
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
                  More than a site.{" "}
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
                  Discover to <span style={{ color: "var(--k-accent)" }}>launch.</span>
                </>
              }
              lead="A clear path from first conversation to a system you own outright. Fixed pricing, no surprises."
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
            <MonoTag>Most projects · 2–4 weeks · fixed pricing</MonoTag>
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
                Ready to own your{" "}
                <span style={{ color: "var(--k-accent)" }}>online presence?</span>
              </>
            }
            lead="Answer a few quick questions and we'll show you exactly what we'd build and what you'd save. No commitment."
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
