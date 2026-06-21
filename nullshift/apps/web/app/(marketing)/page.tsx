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
  title: "Nullshift — Agentic AI that automates your business operations",
  description:
    "Bring any idea — or just a pain point. We build agentic AI systems that automate the operational work draining your staff cost, time and revenue. Any industry. Owned by you.",
  alternates: { canonical: "/" },
};

/* ── Data ───────────────────────────────────────────────────────── */
const MARQUEE = [
  "Agentic AI",
  "Process automation",
  "Custom systems",
  "Tool & data integrations",
  "Customer-facing AI",
  "Document processing",
  "Workflow orchestration",
  "Websites & portals",
];

const COMMITMENT = [
  { value: "100%", label: "Custom-built for you" },
  { value: "Weeks", label: "Not months to live" },
  { value: "Liability", label: "Carried by us" },
  { value: "Yours", label: "Code, data & accounts" },
];

const PAIN: ServiceItem[] = [
  {
    n: "01",
    label: "Staff cost",
    title: "Salary on busywork",
    desc: "Every manual process is wages spent on work a system should do. You end up hiring to keep up, not to grow.",
  },
  {
    n: "02",
    label: "Wasted time",
    title: "Hours no one sees",
    desc: "Admin, data entry, chasing, copying between tools — hours a week per person, gone, on work no customer ever notices.",
  },
  {
    n: "03",
    label: "Leakage",
    title: "Revenue slipping out",
    desc: "Manual means missed follow-ups, dropped balls and human error — money and trust leaking where no one's watching.",
  },
  {
    n: "04",
    label: "The ceiling",
    title: "It all funnels back to you",
    desc: "As you grow, everything refers back to the founders. Too many people, too many moving parts — and growth stalls under its own weight.",
  },
];

const SERVICES: ServiceItem[] = [
  {
    n: "01",
    label: "Agentic AI",
    title: "Agents that do the work",
    desc: "Autonomous agents that take on multi-step work end to end — deciding, acting and reporting back, not just answering questions.",
  },
  {
    n: "02",
    label: "Automation",
    title: "Process automation",
    desc: "The repetitive ops, admin and hand-offs your team does by hand — mapped, built and run for you, around the clock.",
  },
  {
    n: "03",
    label: "Systems",
    title: "Custom systems",
    desc: "Bespoke software your operation runs on — built to fit exactly how you work, not bent around someone else's tool.",
  },
  {
    n: "04",
    label: "Integrations",
    title: "Everything connected",
    desc: "We wire your tools, data and AI into one system, so nothing lives in a silo or gets re-keyed by hand.",
  },
  {
    n: "05",
    label: "Customer AI",
    title: "Customer-facing AI",
    desc: "Support, qualification, onboarding and drafting — on-brand, instant and 24/7, handled by agents that know your business.",
  },
  {
    n: "06",
    label: "Front end",
    title: "Websites & portals",
    desc: "The fast website and the logins your customers actually use — owned, and wired into everything running behind them.",
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
    desc: "Our developers build it fast with cutting-edge AI, wire it into your tools and migrate your data — no downtime.",
  },
  {
    num: "004",
    title: "Run & scale",
    desc: "We run it, carry the liability, and keep optimising — so the system scales as you do, and you own all of it.",
  },
];

const GUARANTEES: ServiceItem[] = [
  {
    n: "01",
    label: "Watertight",
    title: "We carry the liability",
    desc: "We take responsibility for data breaches, security and compliance — a watertight system, not a prototype you're left to defend.",
  },
  {
    n: "02",
    label: "Proven AI",
    title: "Real AI R&D, not a prompt",
    desc: "A genuine R&D background applying the latest AI and agentic techniques — complex, pioneering systems, built fast and at low cost.",
  },
  {
    n: "03",
    label: "Owned",
    title: "You own all of it",
    desc: "Code, data and every account are yours outright. No per-seat fees, no lock-in, no holding your business hostage.",
  },
];

const PRICING = [
  {
    name: "One-off build",
    price: "You own it",
    unit: "outright",
    desc: "We design, build and integrate the systems and agents that run your operations. When it's done, the code, data and accounts are yours — for good.",
    points: [
      "Scoped to your business",
      "Built fast with cutting-edge AI",
      "Live in weeks, not months",
    ],
    featured: true,
  },
  {
    name: "Care plan",
    price: "Monthly",
    unit: "we run it",
    desc: "We host and run it, keep the agents optimised, and carry your liability cover and running costs (hosting, storage, email, servers).",
    points: [
      "Hosting, storage & servers",
      "Liability & compliance cover",
      "Cancel anytime, keep everything",
    ],
    featured: false,
  },
  {
    name: "Consulting",
    price: "Free plan",
    unit: "to start",
    desc: "No idea where to begin? Our specialists deep-dive your operations and map exactly what to automate — start with a free tailored plan.",
    points: ["Operations deep-dive", "What to automate, ranked", "No commitment"],
    featured: false,
  },
];

const HUNT = [
  "Bottlenecks that funnel back to you",
  "Manual hand-offs between tools",
  "Repetitive admin & data entry",
  "Work that scales with headcount",
  "Anything a person does the same way twice",
];

const FAQS: FAQItem[] = [
  {
    cat: "No idea?",
    q: "I just have problems, not a spec — can you still help?",
    a: "That's the ideal starting point. Our automation consultants deep-dive your operations, work out what can and should become a system, and rank it by impact. You bring the pain points; we bring the ideas, the build and the agents that run it. Start with a free tailored plan and we'll show you exactly what we'd automate.",
  },
  {
    cat: "Why us",
    q: "Why not just build it myself with AI tools?",
    a: "AI tools can draft code — they can't take responsibility for it. We're a team of senior developers with a real R&D background in agentic AI, building complex, pioneering systems fast and at low cost — and we carry the liability for data breaches, security and compliance. You get a watertight, production-grade system that scales, not a prototype you're left to defend.",
  },
  {
    cat: "Liability",
    q: "Who's responsible if something goes wrong?",
    a: "We are. We take on a portion of your liability — responsible for data breaches, security and compliance on the systems we build and run for you. We host in the UK/EU, encrypt in transit and at rest, keep an audit trail, and sign a DPA before go-live. Your business gets the watertight system it requires.",
  },
  {
    cat: "Ownership",
    q: "Do I actually own what you build?",
    a: "Yes — completely. You own the code, the data and every account it runs on. You can cancel the care plan at any time and keep everything, with a full export and the running system handed over. No per-seat fees, no lock-in, no hostage situation.",
  },
  {
    cat: "Scale",
    q: "We've hit a ceiling — too much refers back to us. Can you fix that?",
    a: "That's exactly what we're for. We automate the bottlenecks and hand-offs that funnel back to the founders, turn the manual work into systems and agents, and optimise your operations for scale — so growth stops stalling under its own weight and your business is set up for exponential, not linear, growth.",
  },
  {
    cat: "Industry",
    q: "Does this work for my industry?",
    a: "Yes. The work that drains time and money — admin, ops, data, follow-ups, customer handling — looks similar across every industry. We've automated it for businesses in very different sectors; the agentic approach adapts to whatever your operation actually does.",
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
              <Eyebrow index="01" label="Bring the idea — or just the pain point" />
            </Reveal>

            <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1.25fr_0.75fr] gap-10 lg:gap-12 items-start">
              <div>
                <Reveal delay={0.05}>
                  <Display as="h1" size="hero" style={{ maxWidth: "16ch" }}>
                    Any idea. Any pain point.{" "}
                    <span style={{ color: "var(--k-accent)" }}>[automated]</span> by AI
                    you <span style={{ color: "var(--k-accent)" }}>[own]</span>.
                  </Display>
                </Reveal>
                <Reveal delay={0.1}>
                  <Lead
                    className="mt-7"
                    style={{ maxWidth: "56ch", fontSize: "1.125rem" }}
                  >
                    Bring us anything that eats your team&apos;s time — the admin, the
                    ops, the work that keeps funnelling back to you — and we build agentic
                    AI systems that run it end to end. Cut staff cost, time and leakage.
                    Any industry. Owned outright by you.
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
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background: `radial-gradient(52% 52% at 60% 44%, ${T.primary}33 0%, transparent 62%)`,
                  }}
                />
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
                  Agentic automation for businesses across every industry
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

        {/* ═══════════════ 02 — WHY US / TEAM (cream) ═══════════════ */}
        <Section theme="cream" pad="lg" topBorder className="overflow-hidden">
          <Reveal>
            <Eyebrow index="02" label="Why us, not DIY" />
          </Reveal>
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
            <Reveal delay={0.05}>
              <Display size="xl" style={{ maxWidth: "14ch" }}>
                We build the systems others{" "}
                <span style={{ color: "var(--k-accent)" }}>can&apos;t.</span>
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
                  A team of{" "}
                  <span style={{ color: "var(--k-fg)" }}>senior developers</span> using
                  cutting-edge AI and agentic techniques to build complex, pioneering
                  systems — fast, and at a fraction of agency cost. Whatever you can
                  imagine, however complicated,{" "}
                  <span style={{ color: "var(--k-fg)" }}>we know how to build it</span> —
                  and we carry the liability so it&apos;s watertight.
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

        {/* ═══════════════ 03 — THE COST OF DOING IT BY HAND (dark) ═══════════════ */}
        <Section theme="dark" id="problem" pad="lg" topBorder>
          <Reveal>
            <SectionHeader
              index="03"
              label="The cost of doing it by hand"
              tone="danger"
              title={
                <>
                  Manual work is{" "}
                  <span style={{ color: "var(--k-muted)" }}>leaking money.</span>
                </>
              }
              lead="The repetitive operational work your staff do by hand is quietly costing you — in salary, in hours, and in the deals that slip through the cracks."
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
              title="Own the system. Cut the bill."
              lead="Every seat of rented software is a bill that grows as you hire. Own the system that does the work instead — and watch what stops the day it's yours."
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
              title="Automate anything you run by hand"
              lead="From a single agent to a whole connected system — we build, integrate and run the automation your operation needs, whatever it is."
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
              title="From a pain point to a system that runs itself"
              lead="A clear path from first conversation to autonomous systems you own. We do the finding, the building and the running."
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

        {/* ═══════════════ 07 — NO IDEA? / SCALE (cream) ═══════════════ */}
        <Section theme="cream" id="scale" pad="lg" topBorder>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <Reveal>
              <div>
                <Eyebrow index="07" label="No idea? Just pain points?" />
                <Display size="xl" className="mt-6" style={{ maxWidth: "13ch" }}>
                  You don&apos;t need the idea.{" "}
                  <span style={{ color: "var(--k-accent)" }}>We find it.</span>
                </Display>
                <Lead className="mt-6">
                  Just point at what&apos;s painful. Our automation consultants deep-dive
                  your operations, work out what can and should become a system, and
                  automate everything that can be. We optimise your business for scale —
                  past the ceiling where everything refers back to you — and set it up for
                  exponential growth. You know you need to move into the AI era; we do the
                  how.
                </Lead>
                <div className="mt-9 flex flex-wrap gap-3">
                  <BtnPrimary href="/start">Get my free plan</BtnPrimary>
                  <BtnGhost href="/book">Book a discovery call</BtnGhost>
                </div>
              </div>
            </Reveal>
            <Reveal delay={0.1} direction="left">
              <div style={{ border: "1px solid var(--k-border)" }}>
                <div
                  className="p-6"
                  style={{ borderBottom: "1px solid var(--k-border)" }}
                >
                  <span
                    style={{
                      fontFamily: T.mono,
                      fontSize: "0.7rem",
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "var(--k-accent)",
                    }}
                  >
                    What we hunt for
                  </span>
                </div>
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {HUNT.map((h) => (
                    <li
                      key={h}
                      className="flex items-center gap-3 px-6 py-4"
                      style={{
                        fontFamily: T.sans,
                        fontSize: "0.95rem",
                        color: "var(--k-fg)",
                        borderBottom: "1px solid var(--k-border)",
                      }}
                    >
                      <span aria-hidden style={{ color: "var(--k-accent)" }}>
                        ▸
                      </span>
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </Section>

        {/* ═══════════════ 08 — WHY US / GUARANTEES (dark) ═══════════════ */}
        <Section theme="dark" id="why" pad="lg" topBorder>
          <Reveal>
            <SectionHeader
              index="08"
              label="Why Nullshift"
              title={
                <>
                  Built fast. Built watertight.{" "}
                  <span style={{ color: "var(--k-accent)" }}>Built yours.</span>
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
              lead="One build to own the systems and agents outright, then a simple care plan that runs them, carries your liability and covers the running costs. Every project scoped to you."
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
                  lead="Can't find your answer? Book a free 15-minute call and we'll answer everything about your business directly."
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
            label="Join the curve"
            title={
              <>
                Move your business into the{" "}
                <span style={{ color: "var(--k-accent)" }}>AI era.</span>
              </>
            }
            lead="Tell us an idea or just a pain point — under a minute — and we'll show you exactly what we'd automate and what it'd save. No commitment."
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
                  See it run{" "}
                  <span style={{ color: "var(--k-muted)" }}>before you build.</span>
                </Display>
                <Lead className="mt-4" style={{ maxWidth: "52ch" }}>
                  Live, interactive demos — agents, automations, the client portal and
                  CRM. Click around and see exactly what you&apos;d own.
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
