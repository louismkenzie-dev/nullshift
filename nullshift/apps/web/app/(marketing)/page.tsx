import type { Metadata } from "next";
import React from "react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Parallax } from "@/components/Parallax";
import { NeuralField } from "@/components/NeuralField";
import { ClipReveal } from "@/components/anim/ClipReveal";
import { ClaudePartnerBadge } from "@/components/ClaudePartnerBadge";
import {
  Reveal,
  Section,
  Container,
  Eyebrow,
  Lead,
  SectionHeader,
  BtnGhost,
  BarButton,
  TextLink,
  Watermark,
  CTABand,
} from "@/components/kyma";
import { T } from "@nullshift/ui/tokens";
import { CLIENT_STORIES, OWN_SYSTEM_PROOF_LINE } from "@nullshift/content/clientStories";
import { StoryCard } from "@/components/marketing/StoryCard";
import { storyHref } from "@/lib/clientStories";
import { SystemWalkthrough } from "@/components/marketing/SystemWalkthrough";
import { BeforeAfter } from "@/components/marketing/BeforeAfter";

export const metadata: Metadata = {
  title: "Nullshift — We build the system your business runs on",
  description:
    "Bookings, payments, registers, records and the messages that go home — one system built around how your business actually works. You own it outright, and we run it for you.",
  alternates: { canonical: "/" },
};

/* ── Data ───────────────────────────────────────────────────────── */

/* What a client ends up owning. Ownership is the one thing no booking
   platform will ever match us on, so it gets its own section rather
   than a bullet buried in a feature list. */
const OWNERSHIP = [
  {
    n: "01",
    title: "The system is yours",
    body: "The code and every account it runs on are in your name from the first day, not ours. Nothing has to be bought back later.",
  },
  {
    n: "02",
    title: "The money is yours",
    body: "Card payments settle straight into your own bank account. You keep the relationship with your customer, and nobody stands in the middle of it.",
  },
  {
    n: "03",
    title: "The data is yours",
    body: "Your customer list, your history, your records — exportable any time, in a normal format. We sign a data agreement before anything goes live.",
  },
  {
    n: "04",
    title: "You can leave",
    body: "Stop the monthly plan and you keep the whole system. No per-person fees, no contract that locks you in, no holding your business hostage.",
  },
];

/* Four steps in plain English. The old version described a "deep dive"
   that would "map operational workflows and design agentic systems" —
   true, and meaningless to someone who runs a dance school. */
const PROCESS = [
  {
    n: "01",
    title: "We learn how you work",
    body: "A conversation, not a questionnaire. What happens between someone getting in touch and you getting paid — and which bits are eating your evenings.",
  },
  {
    n: "02",
    title: "We show you it first",
    body: "You see the screens and the price before anything is built. Fixed quote, agreed up front, and it only moves if you ask for something new.",
  },
  {
    n: "03",
    title: "We build it and move your data across",
    body: "Usually live in two to four weeks, with everything you already have brought over. Your customers get the new thing, not a gap.",
  },
  {
    n: "04",
    title: "We run it, you use it",
    body: "Hosting, security, fixes and the things that run on a timer are ours to worry about. You get on with the business.",
  },
];

/* Hero headline line — matches Display size="hero", as its own clip-reveal block. */
const heroLine: React.CSSProperties = {
  display: "block",
  fontFamily: T.sans,
  fontWeight: 700,
  fontSize: "clamp(2.3rem,5.9vw,4.3rem)",
  lineHeight: 1.02,
  letterSpacing: "-0.03em",
  textTransform: "uppercase",
  color: "var(--k-fg)",
};

/* ════════════════════════════════════════════════════════════════ */

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        {/* ═══════════════ HERO (dark) ═══════════════ */}
        <section
          className="k-dark relative overflow-hidden"
          style={{ background: "var(--k-bg)", color: "var(--k-fg)" }}
        >
          <NeuralField className="absolute inset-0" style={{ zIndex: 0 }} />
          <Parallax
            distance={-28}
            className="pointer-events-none absolute inset-0"
            style={{ zIndex: 1 }}
          >
            <div
              className="k-vgrid absolute inset-0"
              style={{
                opacity: 0.4,
                WebkitMaskImage: "linear-gradient(180deg,#000,transparent 82%)",
                maskImage: "linear-gradient(180deg,#000,transparent 82%)",
              }}
            />
          </Parallax>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              zIndex: 1,
              background:
                "radial-gradient(125% 95% at 50% 0%, transparent 28%, var(--k-bg) 94%)",
            }}
          />
          <Container
            style={{
              paddingTop: "clamp(116px,15vh,168px)",
              paddingBottom: "clamp(40px,6vw,72px)",
              position: "relative",
              zIndex: 2,
            }}
          >
            <Reveal>
              <Eyebrow index="01" label="Custom business systems" />
            </Reveal>

            <div className="mt-6" style={{ maxWidth: "22ch" }}>
              <h1 style={{ margin: 0 }}>
                <ClipReveal delay={0.05}>
                  <span style={heroLine}>We build the system</span>
                </ClipReveal>
                <ClipReveal delay={0.18}>
                  <span style={heroLine}>
                    your business runs{" "}
                    <span style={{ color: "var(--k-accent)" }}>by hand</span>.
                  </span>
                </ClipReveal>
              </h1>
            </div>

            <Reveal delay={0.1}>
              <Lead className="mt-7" style={{ maxWidth: "56ch", fontSize: "1.125rem" }}>
                Your customers book and pay online. Your staff get a register on their
                phone. The confirmations, reminders and reports send themselves. It is one
                system, built around how you actually work — and you own it outright.
              </Lead>
            </Reveal>

            <Reveal delay={0.16}>
              <div className="mt-9" style={{ maxWidth: 460 }}>
                <BarButton href="/start" meta="60 sec">
                  Show me what you&apos;d build
                </BarButton>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <BtnGhost href="/book" size="sm">
                  Book a call
                </BtnGhost>
              </div>
            </Reveal>

            <Reveal delay={0.24}>
              <div className="mt-10">
                <ClaudePartnerBadge />
              </div>
            </Reveal>

            <Parallax distance={42} className="mt-8 overflow-hidden">
              <Watermark>Nullshift</Watermark>
            </Parallax>
          </Container>
        </section>

        {/* ═══════════════ 02 — THE WALKTHROUGH (cream) ═══════════════ */}
        <Section theme="cream" id="capabilities" pad="lg" topBorder>
          <Reveal>
            <SectionHeader
              index="02"
              label="What we build"
              title="One system, from the booking to the message home."
              lead="Most businesses we meet are holding this chain together with a spreadsheet, a WhatsApp group and a bank transfer. Here is the same chain as one system."
              maxLead="64ch"
            />
          </Reveal>
          <Reveal delay={0.08}>
            <div className="mt-12">
              <SystemWalkthrough />
            </div>
          </Reveal>
          <Reveal delay={0.12}>
            <p
              className="mt-8"
              style={{
                fontFamily: T.sans,
                fontSize: "1rem",
                lineHeight: 1.6,
                color: "var(--k-muted)",
                maxWidth: "72ch",
              }}
            >
              <span style={{ color: "var(--k-fg)", fontWeight: 600 }}>
                Not every business is classes and registers.{" "}
              </span>
              Swap the words and the shape is the same — appointments, memberships,
              enquiries, orders, courses. If the same people come back to you, we can
              build it.
            </p>
          </Reveal>
        </Section>

        {/* ═══════════════ 03 — BEFORE / AFTER (dark) ═══════════════ */}
        <Section theme="dark" id="problem" pad="lg" topBorder>
          <Reveal>
            <SectionHeader
              index="03"
              label="What changes"
              title="The jobs that stop being yours."
              lead="Every client we have taken on arrived running on the same three things: a spreadsheet, WhatsApp and manual bank transfers. This is what happened to the work."
              maxLead="64ch"
            />
          </Reveal>
          <Reveal delay={0.08}>
            <div className="mt-12">
              <BeforeAfter />
            </div>
          </Reveal>
        </Section>

        {/* ═══════════════ 04 — CLIENT STORIES (cream) ═══════════════ */}
        <Section theme="cream" id="stories" pad="lg" topBorder>
          <Reveal>
            <SectionHeader
              index="04"
              label="Systems we have built"
              title="Three real businesses. Three systems they own."
              lead="A dance school across nine Essex towns, a county tennis organisation, and a counselling practice. Different work, same problem underneath."
              maxLead="64ch"
            />
          </Reveal>
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4">
            {CLIENT_STORIES.map((story, i) => (
              <Reveal key={story.slug} delay={i * 0.07}>
                <StoryCard story={story} href={storyHref(story)} theme="cream" />
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.2}>
            <div
              className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
              style={{
                border: "1px solid var(--k-border)",
                background: "var(--k-surface)",
                padding: "16px 20px",
              }}
            >
              <span
                style={{
                  fontFamily: T.sans,
                  fontSize: "0.9rem",
                  lineHeight: 1.55,
                  color: "var(--k-muted)",
                  maxWidth: "72ch",
                }}
              >
                <span style={{ color: "var(--k-fg)", fontWeight: 600 }}>
                  Under the hood.{" "}
                </span>
                {OWN_SYSTEM_PROOF_LINE}
              </span>
              <TextLink href="/about">How we run</TextLink>
            </div>
          </Reveal>
        </Section>

        {/* ═══════════════ 05 — WHAT YOU OWN (dark) ═══════════════ */}
        <Section theme="dark" id="why" pad="lg" topBorder>
          <Reveal>
            <SectionHeader
              index="05"
              label="What you own"
              title="It is yours. Not rented from us."
              lead="Booking platforms keep your customers, your data and a slice of your money, and you stop paying the day you stop using them. This is the opposite arrangement."
              maxLead="64ch"
            />
          </Reveal>
          <div
            className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
            style={{
              borderTop: "1px solid var(--k-border)",
              borderLeft: "1px solid var(--k-border)",
            }}
          >
            {OWNERSHIP.map((o, i) => (
              <Reveal key={o.n} delay={i * 0.06}>
                <div
                  style={{
                    borderRight: "1px solid var(--k-border)",
                    borderBottom: "1px solid var(--k-border)",
                    padding: "clamp(22px,2.4vw,30px)",
                    height: "100%",
                  }}
                >
                  <span
                    style={{
                      fontFamily: T.mono,
                      fontSize: "0.66rem",
                      letterSpacing: "0.1em",
                      color: "var(--k-accent)",
                    }}
                  >
                    {o.n}
                  </span>
                  <h3
                    className="mt-4"
                    style={{
                      fontFamily: T.sans,
                      fontWeight: 700,
                      fontSize: "1.05rem",
                      letterSpacing: "-0.02em",
                      color: "var(--k-fg)",
                      margin: 0,
                    }}
                  >
                    {o.title}
                  </h3>
                  <p
                    className="mt-3"
                    style={{
                      fontFamily: T.sans,
                      fontSize: "0.9rem",
                      lineHeight: 1.6,
                      color: "var(--k-muted)",
                    }}
                  >
                    {o.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </Section>

        {/* ═══════════════ 06 — HOW IT WORKS (cream) ═══════════════ */}
        <Section theme="cream" id="process" pad="lg" topBorder>
          <Reveal>
            <SectionHeader
              index="06"
              label="How it works"
              title="Four steps, and only one of them is yours."
              lead="You do not need to know what any of it is called. That is our job."
              maxLead="60ch"
            />
          </Reveal>
          <div
            className="mt-12 grid grid-cols-1 md:grid-cols-2"
            style={{
              borderTop: "1px solid var(--k-border)",
              borderLeft: "1px solid var(--k-border)",
            }}
          >
            {PROCESS.map((p, i) => (
              <Reveal key={p.n} delay={i * 0.06}>
                <div
                  style={{
                    borderRight: "1px solid var(--k-border)",
                    borderBottom: "1px solid var(--k-border)",
                    padding: "clamp(24px,2.6vw,34px)",
                    height: "100%",
                  }}
                >
                  <span
                    style={{
                      fontFamily: T.mono,
                      fontSize: "0.66rem",
                      letterSpacing: "0.1em",
                      color: "var(--k-accent)",
                    }}
                  >
                    {p.n}
                  </span>
                  <h3
                    className="mt-4"
                    style={{
                      fontFamily: T.sans,
                      fontWeight: 700,
                      fontSize: "1.15rem",
                      letterSpacing: "-0.02em",
                      color: "var(--k-fg)",
                      margin: 0,
                    }}
                  >
                    {p.title}
                  </h3>
                  <p
                    className="mt-3"
                    style={{
                      fontFamily: T.sans,
                      fontSize: "0.94rem",
                      lineHeight: 1.6,
                      color: "var(--k-muted)",
                      maxWidth: "46ch",
                    }}
                  >
                    {p.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </Section>

        {/* ═══════════════ FINAL CTA (dark) ═══════════════ */}
        <div style={{ borderTop: "1px solid var(--k-border)" }}>
          <CTABand
            theme="dark"
            index="07"
            label="Start here"
            title={
              <>
                Tell us what you do{" "}
                <span style={{ color: "var(--k-accent)" }}>by hand.</span>
              </>
            }
            lead="Takes under a minute. We will come back with what we would build, what it would do for you, and what it would cost. No commitment."
            primary={{ label: "Show me what you'd build", href: "/start" }}
            secondary={{ label: "Book a call", href: "/book" }}
            note="Response within 24 hours · UK-based"
          />
        </div>
      </main>

      <Footer />
    </>
  );
}
