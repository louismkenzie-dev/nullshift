import type { Metadata } from "next";
import React from "react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { SplineScene } from "@/components/SplineScene";
import { Parallax } from "@/components/Parallax";
import { RevenueCalculator } from "@nullshift/ui/components/RevenueCalculator";
import { CLINIC } from "@nullshift/content/marketing";
import {
  Reveal,
  Section,
  Container,
  Eyebrow,
  Display,
  Lead,
  SectionHeader,
  BtnPrimary,
  BtnGhost,
  BarButton,
  TextLink,
  Tag,
  MonoTag,
  StatBig,
  ServiceGrid,
  CellGrid,
  Cell,
  Marquee,
  Watermark,
  CTABand,
  Accordion,
  type ServiceItem,
  type FAQItem,
} from "@/components/kyma";
import { T } from "@nullshift/ui/tokens";

export const metadata: Metadata = {
  title: "Nullshift — Websites, systems & automations your business owns",
  description:
    "We design, build and run bespoke websites, custom systems and the automations behind them — owned outright by you. No per-seat SaaS fees, live in weeks.",
  alternates: { canonical: "/" },
};

/* ── Data ───────────────────────────────────────────────────────── */
const MARQUEE = [
  "Custom websites",
  "Bespoke systems",
  "Workflow automation",
  "Booking & payments",
  "CRM & client portals",
  "Integrations & APIs",
  "AI workflows",
  "Hosting & care",
];

const COMMITMENT = [
  { value: "100%", label: "Custom code, no templates" },
  { value: "2–4 wks", label: "From kickoff to live" },
  { value: "£0", label: "Per-seat software fees" },
  { value: "Yours", label: "Code, data & accounts" },
];

const PAIN: ServiceItem[] = [
  {
    n: "01",
    label: "Per-seat fees",
    title: "You pay to grow",
    desc: "Most business software bills per seat, every month. Every hire makes the bill bigger — you're charged more for getting busier.",
  },
  {
    n: "02",
    label: "Payment skim",
    title: "A cut of every sale",
    desc: "Booking and checkout tools skim 2–3% on top of card fees. On a busy month that's real money leaving your account for nothing.",
  },
  {
    n: "03",
    label: "Data hostage",
    title: "Leave, lose everything",
    desc: "Your customers, content and history live in someone else's database. Cancel and it's gone — so you never feel free to leave.",
  },
  {
    n: "04",
    label: "Generic templates",
    title: "Looks like everyone else",
    desc: "Drag-and-drop themes mean your business looks like every competitor, and bends to the tool instead of how you actually work.",
  },
];

const SERVICES: ServiceItem[] = [
  {
    n: "01",
    label: "Websites",
    title: "Custom-built websites",
    desc: "Fast, bespoke, mobile-first sites that win you work — designed around your brand and built from scratch, never templated.",
  },
  {
    n: "02",
    label: "Systems",
    title: "Bespoke business systems",
    desc: "The software your operation runs on — booking, records, dashboards, portals — built to fit exactly how your team works.",
  },
  {
    n: "03",
    label: "Automation",
    title: "Workflow automation",
    desc: "Reminders, follow-ups, hand-offs and reports — the repetitive work, triggered on time, every time, with no one watching.",
  },
  {
    n: "04",
    label: "Payments",
    title: "Bookings & payments",
    desc: "Take bookings, deposits and payments through your own account — keep the relationship and a far bigger slice of every sale.",
  },
  {
    n: "05",
    label: "Portals",
    title: "CRM & client portals",
    desc: "A place your customers log in, and a CRM that keeps the pipeline moving — records, jobs and accounts in one owned system.",
  },
  {
    n: "06",
    label: "Integrations",
    title: "Integrations & AI",
    desc: "We wire your tools together and add AI where it earns its keep — chat, qualification, drafting — connected to the rest.",
  },
];

const PROCESS = [
  {
    num: "001",
    title: "Discovery",
    desc: "We learn your business — how you work, what you sell, and the subscriptions you pay for and hate.",
  },
  {
    num: "002",
    title: "Build & migrate",
    desc: "We build your bespoke website and systems, then move your data across — no downtime, nothing lost.",
  },
  {
    num: "003",
    title: "Go live",
    desc: "We switch it on. Customers book, payments land, automations fire — and you cancel the old tools.",
  },
  {
    num: "004",
    title: "Own & run",
    desc: "It's yours — code, data, accounts. We host and run it on a care plan you can cancel and keep.",
  },
];

const GUARANTEES: ServiceItem[] = [
  {
    n: "01",
    label: "No lock-in",
    title: "No per-seat fees",
    desc: "Own your systems once. The bill doesn't grow every time you add a person — unlike the SaaS you rent today.",
  },
  {
    n: "02",
    label: "GDPR-safe",
    title: "Your data, protected",
    desc: "Everything is UK-hosted, encrypted, audit-logged and exportable any time. We sign a DPA before go-live — your data is never a vendor's hostage.",
  },
  {
    n: "03",
    label: "Fair payments",
    title: "Payments at a fraction",
    desc: "Customers pay through your own Stripe account. You keep the relationship and pay a small flat fee — not the 2–3% an incumbent skims.",
  },
];

const PRICING = [
  {
    name: "One-off build",
    price: "You own it",
    unit: "outright",
    desc: "We design, build and migrate your website and systems. When it's done, the code, the data and every account are yours — for good.",
    points: ["Bespoke, never templated", "Data migrated for you", "Live in 2–4 weeks"],
    featured: true,
  },
  {
    name: "Care plan",
    price: "Monthly",
    unit: "we run it",
    desc: "Not rent — us covering your running costs (hosting, storage, email and servers) plus our liability cover, keeping everything online and updated.",
    points: [
      "Hosting, storage & email",
      "Security & updates",
      "Cancel anytime, keep everything",
    ],
    featured: false,
  },
  {
    name: "Payments",
    price: "Your Stripe",
    unit: "+ flat fee",
    desc: "Take bookings, deposits and payments through your own account. Keep the customer relationship — no 2–3% skim.",
    points: ["Money lands with you", "Deposits cut no-shows", "No per-sale commission"],
    featured: false,
  },
];

const SWITCH_RENT = [
  "Website builder — £29/mo",
  "Booking SaaS — £39/mo / seat",
  "CRM add-on — £25/mo",
  "Email & automation — £29/mo",
  "Payment skim — 2.4%",
];
const SWITCH_OWN = [
  "Custom website you own",
  "Booking, payments & deposits",
  "CRM & client portal",
  "Automations built in",
  "Everything in one system",
];

const FAQS: FAQItem[] = [
  {
    cat: "Ownership",
    q: "Do I actually own it?",
    a: "Yes — completely. You own the code, the data and every account it runs on (your domain, your Stripe, your database). You can cancel the care plan at any time and keep everything, with a full export and the running system handed over. There's no hostage situation and no lock-in.",
  },
  {
    cat: "Care plan",
    q: "Why pay a monthly care plan if I own it?",
    a: "The care plan isn't rent on something you own — it's us covering your running costs (hosting, storage, email and server costs like Vercel and Resend) plus our liability cover, and keeping everything online, secure and updated. Cancel whenever you like and you keep the code and data; you'd just take over the running costs yourself.",
  },
  {
    cat: "Data",
    q: "Is my data safe and GDPR-compliant?",
    a: "Yes. We act as your data processor under a signed DPA, host your system in the UK/EU, and encrypt data in transit and at rest with a full audit trail. Your customers, content and records live in a system you own — GDPR-compliant, exportable any time, and never sold or locked in.",
  },
  {
    cat: "Migrating",
    q: "What about my existing site and tools?",
    a: "We migrate them for you. You keep running your current tools as normal until the new system is live and fully tested — there's no gap. Then we move your data across, you confirm everything looks right, and only then do you cancel the old subscriptions you no longer need.",
  },
  {
    cat: "Payments",
    q: "How do payments work?",
    a: "Customers pay through your own Stripe account, so you keep the merchant relationship and the money lands directly with you. Instead of the 2–3% an incumbent tool skims on top, you pay a small flat platform fee. Deposits and prepayment are built into the flow.",
  },
  {
    cat: "Fit",
    q: "We're a small business — is this overkill?",
    a: "No — it scales down cleanly. A solo operator or small team owns a tidy website-and-systems setup for less than it would rent three or four separate SaaS tools each month. Because the rented tools charge per seat, the savings only get bigger as you grow.",
  },
];

/* ── helpers ────────────────────────────────────────────────────── */
function Stars() {
  return (
    <span
      aria-hidden
      style={{ color: "var(--k-accent)", letterSpacing: 2, fontSize: "0.8rem" }}
    >
      ★★★★★
    </span>
  );
}

/* ════════════════════════════════════════════════════════════════ */
export default function Page() {
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
              <Eyebrow index="01" label="Build it · Run it · You own it" />
            </Reveal>

            <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1.25fr_0.75fr] gap-10 lg:gap-12 items-start">
              <div>
                <Reveal delay={0.05}>
                  <Display as="h1" size="hero" style={{ maxWidth: "16ch" }}>
                    Websites, systems &amp; automations —{" "}
                    <span style={{ color: "var(--k-accent)" }}>[built]</span> and{" "}
                    <span style={{ color: "var(--k-accent)" }}>[owned]</span>.
                  </Display>
                </Reveal>
                <Reveal delay={0.1}>
                  <Lead
                    className="mt-7"
                    style={{ maxWidth: "54ch", fontSize: "1.125rem" }}
                  >
                    We design, build and run bespoke websites, custom systems and the
                    automations behind them — owned outright by you. No per-seat SaaS
                    fees, no lock-in, live in weeks.
                  </Lead>
                </Reveal>
                <Reveal delay={0.16}>
                  <div className="mt-9" style={{ maxWidth: 460 }}>
                    <BarButton href="/start" meta="60 sec">
                      Get my free plan
                    </BarButton>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <BtnGhost href="/book" size="sm">
                      Book a call
                    </BtnGhost>
                    <TextLink href="/systems-lab">Try the live demos</TextLink>
                  </div>
                </Reveal>
              </div>

              {/* Right — interactive 3D Spline scene (desktop only, never stacks) */}
              <div
                className="hidden lg:block relative self-stretch"
                style={{ minHeight: "clamp(440px,40vw,560px)" }}
              >
                {/* emerald spotlight behind the scene */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background: `radial-gradient(52% 52% at 60% 44%, ${T.primary}33 0%, transparent 62%)`,
                  }}
                />
                {/* masked canvas — bleeds past the edges and fades out so there is
                    no hard rectangular cutoff; blends into the dark hero. */}
                <div
                  className="absolute"
                  style={{
                    inset: "-10% -8% -16% -10%",
                    WebkitMaskImage:
                      "radial-gradient(58% 58% at 56% 46%, #000 46%, rgba(0,0,0,0) 100%)",
                    maskImage:
                      "radial-gradient(58% 58% at 56% 46%, #000 46%, rgba(0,0,0,0) 100%)",
                  }}
                >
                  <SplineScene
                    scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
                    className="!w-full !h-full"
                  />
                </div>
              </div>
            </div>

            {/* trust */}
            <div className="mt-12 flex items-end justify-between gap-6 flex-wrap">
              <div className="flex items-center gap-4">
                <Stars />
                <span
                  style={{
                    fontFamily: T.mono,
                    fontSize: "0.7rem",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--k-muted)",
                  }}
                >
                  For clinics · trades · agencies · e-commerce · any ambitious business
                </span>
              </div>
            </div>
            <Parallax distance={42} className="mt-2 overflow-hidden">
              <Watermark>Nullshift</Watermark>
            </Parallax>
          </Container>
        </Section>

        {/* ═══════════════ MARQUEE (cream strip) ═══════════════ */}
        <Section theme="cream" pad="none" topBorder>
          <div style={{ paddingBlock: 22 }}>
            <Marquee items={MARQUEE} />
          </div>
        </Section>

        {/* ═══════════════ WHO WE ARE / COMMITMENT (cream) ═══════════════ */}
        <Section theme="cream" pad="lg" topBorder className="overflow-hidden">
          <Reveal>
            <Eyebrow index="02" label="Who we are" />
          </Reveal>
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
            <Reveal delay={0.05}>
              <Display size="xl" style={{ maxWidth: "16ch" }}>
                We build it. We run it.{" "}
                <span style={{ color: "var(--k-muted)" }}>You own it.</span>
              </Display>
            </Reveal>
            <Reveal delay={0.1}>
              <div>
                <p
                  style={{
                    fontFamily: T.sans,
                    fontSize: "clamp(1.25rem,2.2vw,1.7rem)",
                    fontWeight: 400,
                    lineHeight: 1.3,
                    letterSpacing: "-0.02em",
                    color: "var(--k-muted)",
                  }}
                >
                  <span style={{ color: "var(--k-fg)" }}>
                    A website that wins you work
                  </span>
                  , the systems your operation runs on, and the automations that handle
                  the <span style={{ color: "var(--k-fg)" }}>repetitive work</span> — one
                  stack you own, not a pile of subscriptions you rent.
                </p>
                <div className="mt-6">
                  <TextLink href="/about">More about Nullshift</TextLink>
                </div>
              </div>
            </Reveal>
          </div>

          {/* Giant stats */}
          <Reveal delay={0.1}>
            <div className="mt-14 grid grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-10">
              {COMMITMENT.map((s) => (
                <StatBig key={s.label} value={s.value} label={s.label} size="md" />
              ))}
            </div>
          </Reveal>
        </Section>

        {/* ═══════════════ 03 — RENTAL TRAP (dark) ═══════════════ */}
        <Section theme="dark" id="problem" pad="lg" topBorder>
          <Reveal>
            <SectionHeader
              index="03"
              label="The rental trap"
              tone="danger"
              title={
                <>
                  You&apos;re renting,{" "}
                  <span style={{ color: "var(--k-muted)" }}>not owning.</span>
                </>
              }
              lead="Most businesses run on a stack of subscriptions they rent — and the meter runs against you. Here's what it actually costs."
            />
          </Reveal>
          <Reveal delay={0.08}>
            <div className="mt-12">
              <ServiceGrid items={PAIN} cols={2} />
            </div>
          </Reveal>
        </Section>

        {/* ═══════════════ 04 — THE CUTTABLE BILL (dark calculator) ═══════════════ */}
        <Section theme="dark" id="savings" pad="lg" topBorder>
          <Reveal>
            <SectionHeader
              index="04"
              label="The cuttable bill"
              title="Stop renting. Start owning."
              lead="Most business software charges per seat — a bill that grows every time you hire. See what you're renting, and what stops the day you own your systems outright."
            />
          </Reveal>
          <Reveal delay={0.08}>
            <div className="mt-12">
              <RevenueCalculator calc={CLINIC.calc} ctaHref="/start" />
            </div>
          </Reveal>
        </Section>

        {/* ═══════════════ 05 — WHAT WE BUILD (cream services) ═══════════════ */}
        <Section theme="cream" id="capabilities" pad="lg" topBorder>
          <Reveal>
            <SectionHeader
              index="05"
              label="What we build"
              title="Everything your business runs on"
              lead="Website, systems and automations — built into one stack you own, not bolted together from a dozen subscriptions billed per seat."
            />
          </Reveal>
          <Reveal delay={0.08}>
            <div className="mt-12">
              <ServiceGrid items={SERVICES} cols={3} />
            </div>
          </Reveal>
          <div className="mt-8">
            <TextLink href="/systems-lab">See it live in the Systems Lab</TextLink>
          </div>
        </Section>

        {/* ═══════════════ 06 — HOW IT WORKS (dark timeline) ═══════════════ */}
        <Section theme="dark" id="process" pad="lg" topBorder>
          <Reveal>
            <SectionHeader
              index="06"
              label="How it works"
              title="From rented tools to a system you own"
              lead="A clear path from first conversation to a system you own outright. Fixed scope, no surprises."
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
            <MonoTag>Most projects · 2–4 weeks · fixed scope</MonoTag>
          </div>
        </Section>

        {/* ═══════════════ 07 — THE SWITCH (cream comparison) ═══════════════ */}
        <Section theme="cream" id="switch" pad="lg" topBorder>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <Reveal>
              <div>
                <Eyebrow index="07" label="The switch" />
                <Display size="xl" className="mt-6" style={{ maxWidth: "12ch" }}>
                  Cancel the stack.{" "}
                  <span style={{ color: "var(--k-accent)" }}>Own one system.</span>
                </Display>
                <Lead className="mt-6">
                  The day you go live, the rented tools switch off — and the bill that
                  grew with every hire stops with them. One system, every layer yours.
                </Lead>
                <div className="mt-9 flex flex-wrap gap-3">
                  <BtnPrimary href="/start">See what you&apos;d save</BtnPrimary>
                  <BtnGhost href="/about">Why Nullshift</BtnGhost>
                </div>
              </div>
            </Reveal>
            <Reveal delay={0.1} direction="left">
              <div
                className="grid grid-cols-1 sm:grid-cols-2"
                style={{ border: "1px solid var(--k-border)" }}
              >
                <div className="p-6" style={{ borderRight: "1px solid var(--k-border)" }}>
                  <div className="flex items-center justify-between mb-5">
                    <span
                      style={{
                        fontFamily: T.mono,
                        fontSize: "0.66rem",
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
                        fontSize: "0.66rem",
                        color: "var(--k-faint)",
                      }}
                    >
                      per seat
                    </span>
                  </div>
                  <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                    {SWITCH_RENT.map((r) => (
                      <li
                        key={r}
                        className="flex items-center gap-3 py-2.5"
                        style={{
                          fontFamily: T.sans,
                          fontSize: "0.82rem",
                          color: "var(--k-muted)",
                          borderBottom: "1px solid var(--k-border)",
                        }}
                      >
                        <span aria-hidden style={{ color: T.danger }}>
                          ✕
                        </span>
                        <span style={{ textDecoration: "line-through" }}>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="p-6">
                  <div className="flex items-center justify-between mb-5">
                    <span
                      style={{
                        fontFamily: T.mono,
                        fontSize: "0.66rem",
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: "var(--k-accent)",
                      }}
                    >
                      What you own
                    </span>
                    <span
                      style={{
                        fontFamily: T.mono,
                        fontSize: "0.66rem",
                        color: "var(--k-accent)",
                      }}
                    >
                      £0 / seat
                    </span>
                  </div>
                  <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                    {SWITCH_OWN.map((o) => (
                      <li
                        key={o}
                        className="flex items-center gap-3 py-2.5"
                        style={{
                          fontFamily: T.sans,
                          fontSize: "0.82rem",
                          color: "var(--k-fg)",
                          borderBottom: "1px solid var(--k-border)",
                        }}
                      >
                        <span aria-hidden style={{ color: "var(--k-accent)" }}>
                          ✓
                        </span>
                        {o}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Reveal>
          </div>
        </Section>

        {/* ═══════════════ 08 — GUARANTEES (dark) ═══════════════ */}
        <Section theme="dark" id="why" pad="lg" topBorder>
          <Reveal>
            <SectionHeader
              index="08"
              label="Why us"
              title={
                <>
                  No per-seat fees. No lock-in.{" "}
                  <span style={{ color: "var(--k-accent)" }}>No nonsense.</span>
                </>
              }
              lead="Not testimonials — commitments. This is what you get in writing, every time."
            />
          </Reveal>
          <Reveal delay={0.08}>
            <div className="mt-12">
              <ServiceGrid items={GUARANTEES} cols={3} />
            </div>
          </Reveal>
        </Section>

        {/* ═══════════════ 09 — PRICING (cream) ═══════════════ */}
        <Section theme="cream" id="pricing" pad="lg" topBorder>
          <Reveal>
            <SectionHeader
              index="09"
              label="Pricing"
              title="Build it. Own it. We run it."
              lead="One build to own your website and systems outright, then a simple care plan that covers the running costs and keeps it all online. No per-seat fees, cancel anytime."
            />
          </Reveal>
          <Reveal delay={0.08}>
            <div
              className="mt-12 grid grid-cols-1 md:grid-cols-3"
              style={{
                borderTop: "1px solid var(--k-border)",
                borderLeft: "1px solid var(--k-border)",
              }}
            >
              {PRICING.map((p) => (
                <div
                  key={p.name}
                  className="relative flex flex-col p-7 md:p-8"
                  style={{
                    borderRight: "1px solid var(--k-border)",
                    borderBottom: "1px solid var(--k-border)",
                    background: p.featured ? "var(--k-surface)" : "transparent",
                  }}
                >
                  {p.featured && (
                    <span className="absolute right-7 top-7">
                      <Tag>You own it</Tag>
                    </span>
                  )}
                  <span
                    style={{
                      fontFamily: T.mono,
                      fontSize: "0.7rem",
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "var(--k-accent)",
                    }}
                  >
                    [{p.name}]
                  </span>
                  <div className="mt-5 flex items-baseline gap-2">
                    <span
                      style={{
                        fontFamily: T.sans,
                        fontWeight: 800,
                        fontSize: "clamp(1.7rem,2.6vw,2.3rem)",
                        letterSpacing: "-0.03em",
                        textTransform: "uppercase",
                        color: "var(--k-fg)",
                      }}
                    >
                      {p.price}
                    </span>
                    <span
                      style={{
                        fontFamily: T.mono,
                        fontSize: "0.74rem",
                        textTransform: "uppercase",
                        color: "var(--k-muted)",
                      }}
                    >
                      {p.unit}
                    </span>
                  </div>
                  <p
                    className="mt-4"
                    style={{
                      fontFamily: T.sans,
                      fontSize: "0.9rem",
                      lineHeight: 1.5,
                      color: "var(--k-muted)",
                    }}
                  >
                    {p.desc}
                  </p>
                  <ul
                    className="mt-6 flex flex-col gap-2.5"
                    style={{ listStyle: "none", margin: 0, padding: 0 }}
                  >
                    {p.points.map((pt) => (
                      <li
                        key={pt}
                        className="flex items-start gap-2.5"
                        style={{
                          fontFamily: T.mono,
                          fontSize: "0.74rem",
                          letterSpacing: "0.02em",
                          color: "var(--k-fg)",
                        }}
                      >
                        <span aria-hidden style={{ color: "var(--k-accent)" }}>
                          ▸
                        </span>
                        {pt}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Reveal>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <BtnPrimary href="/start">Get a tailored plan</BtnPrimary>
            <span
              style={{
                fontFamily: T.mono,
                fontSize: "0.72rem",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: "var(--k-muted)",
              }}
            >
              Every build is scoped and quoted to you — no off-the-shelf pricing
            </span>
          </div>
        </Section>

        {/* ═══════════════ 10 — FAQ (dark) ═══════════════ */}
        <Section theme="dark" id="faq" pad="lg" topBorder>
          <div className="grid grid-cols-1 lg:grid-cols-[0.8fr_1.2fr] gap-10 lg:gap-16">
            <Reveal>
              <div className="lg:sticky lg:top-28 self-start">
                <SectionHeader
                  index="10"
                  label="FAQ"
                  title="Everything you need to know"
                  lead="Can't find your answer? Book a free 15-minute call and we'll answer everything about your project directly."
                />
                <div className="mt-8">
                  <BtnGhost href="/faq" arrow>
                    All questions
                  </BtnGhost>
                </div>
              </div>
            </Reveal>
            <Reveal delay={0.08}>
              <Accordion items={FAQS} defaultOpen={null} />
            </Reveal>
          </div>
        </Section>

        {/* ═══════════════ FINAL CTA (dark) ═══════════════ */}
        <div style={{ borderTop: "1px solid var(--k-border)" }}>
          <CTABand
            theme="dark"
            index="11"
            label="Free tailored plan"
            title={
              <>
                Get a free, tailored plan{" "}
                <span style={{ color: "var(--k-accent)" }}>for your business.</span>
              </>
            }
            lead="Answer a few quick questions — under a minute — and we'll show you exactly what we'd build and what you'd save. No commitment."
            primary={{ label: "Get my free plan", href: "/start" }}
            secondary={{ label: "Book a call", href: "/book" }}
            note="Response within 24 hours · UK-based, global reach"
          />
        </div>

        {/* ═══════════════ SYSTEMS LAB (cream) ═══════════════ */}
        <Section theme="cream" pad="md" topBorder>
          <Reveal>
            <div className="flex flex-col gap-7 md:flex-row md:items-center md:justify-between">
              <div>
                <Eyebrow label="New — Systems Lab" />
                <Display size="lg" className="mt-5">
                  See your system{" "}
                  <span style={{ color: "var(--k-muted)" }}>before you build.</span>
                </Display>
                <Lead className="mt-4" style={{ maxWidth: "52ch" }}>
                  Live, interactive demos — booking, the client portal, CRM and
                  automations. Click around and see exactly what you&apos;d own.
                </Lead>
              </div>
              <BtnPrimary href="/systems-lab">Enter Systems Lab</BtnPrimary>
            </div>
          </Reveal>
        </Section>
      </main>

      <Footer />
    </>
  );
}
