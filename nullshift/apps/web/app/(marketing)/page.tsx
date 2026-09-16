import type { Metadata } from "next";
import React from "react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { ClipReveal } from "@/components/anim/ClipReveal";
import { Reveal, Section, SectionHeader, TextLink, CTABand } from "@/components/kyma";
import { T } from "@nullshift/ui/tokens";
import { OWN_SYSTEM_PROOF_LINE } from "@nullshift/content/clientStories";
import { StepReveal } from "@/components/marketing/StepReveal";
import { ScrollFilmHero } from "@/components/marketing/immersive/ScrollFilmHero";
import { SystemAssembly } from "@/components/marketing/immersive/SystemAssembly";
import { LiveSystems } from "@/components/marketing/immersive/LiveSystems";
import { DemoReel } from "@/components/marketing/immersive/DemoReel";
import {
  ScreenBook,
  ScreenPaid,
  ScreenTonight,
  ScreenRegister,
  ScreenMessage,
} from "@/components/marketing/stepScreens";
import { BeforeAfter } from "@/components/marketing/BeforeAfter";

export const metadata: Metadata = {
  title: "Nullshift — We build anything your business needs",
  description:
    "Bespoke business systems, designed and built around how you actually work — bookings, payments, records, people, stock, jobs. Beautiful to use, yours to own, and we run it for you.",
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

/* ════════════════════════════════════════════════════════════════ */

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        {/* ═══════════════ HERO (dark) ═══════════════ */}
        <ScrollFilmHero />
        <div id="home-after-hero" tabIndex={-1} />

        <SystemAssembly />

        {/* ═══════════════ 03 — ONE EXAMPLE, END TO END ═══════════════ */}
        <Section
          theme="dark"
          id="capabilities"
          pad="lg"
          topBorder
          style={{ minHeight: "70svh", display: "flex", alignItems: "center" }}
        >
          <Reveal>
            <span
              style={{
                fontFamily: T.mono,
                fontSize: "0.66rem",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--k-accent)",
              }}
            >
              [03] One example, end to end
            </span>
          </Reveal>
          <ClipReveal delay={0.06} className="mt-8">
            <h2
              style={{
                margin: 0,
                fontFamily: T.sans,
                fontWeight: 500,
                fontSize: "clamp(2rem,5vw,3.6rem)",
                lineHeight: 0.9,
                letterSpacing: "normal",
                textTransform: "uppercase",
                color: "var(--k-fg)",
                maxWidth: "18ch",
              }}
            >
              One booking. Everything connected.
            </h2>
          </ClipReveal>
          <Reveal delay={0.14}>
            <p
              className="mt-10"
              style={{
                fontFamily: T.sans,
                fontWeight: 400,
                fontSize: "clamp(1.05rem,1.7vw,1.5rem)",
                lineHeight: 1.26,
                color: "var(--k-fg)",
                maxWidth: "36ch",
              }}
            >
              Try a fictional studio taking bookings. Yours might be jobs, orders,
              patients, members, stock or something nobody has built before. The shape
              holds; the parts change.
            </p>
          </Reveal>
          <Reveal delay={0.2}>
            <p
              className="mt-10"
              style={{
                fontFamily: T.mono,
                fontSize: "0.68rem",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--k-faint)",
              }}
            >
              <TextLink href="/demo">Try the interactive demo ↗</TextLink>
            </p>
          </Reveal>
        </Section>

        <DemoReel />

        <StepReveal
          index="01"
          kicker="Someone asks for something"
          heading="On their phone. At ten at night."
          body="A booking, an appointment, a quote, an order — whatever your version is, they do it themselves, and nobody has to ring them back in the morning."
          aside="Example shown — a class booking"
          screen={<ScreenBook />}
        />

        <StepReveal
          index="02"
          kicker="You get paid"
          heading="Before they leave the page."
          body="The card is charged there and then, and the money settles into your own account. No invoice to raise, no transfer to chase on a Sunday night."
          aside="One-offs · subscriptions · deposits · staged payments"
          screen={<ScreenPaid />}
        />

        <StepReveal
          index="03"
          kicker="Your team sees it"
          heading="One screen. Always right."
          body="Everything that has come in lands in one place, current to the second. The question that used to take three tabs and a phone call now takes a glance."
          aside="Built around your words, not a template's"
          screen={<ScreenTonight />}
        />

        <StepReveal
          index="04"
          kicker="The work gets recorded"
          heading="A thumb. Not a clipboard."
          body="Whoever is doing the work records it as it happens, on a phone — and the things that matter are right there on the row instead of in somebody's head."
          aside="Example shown — a register with safeguarding flags"
          screen={<ScreenRegister />}
        />

        <StepReveal
          index="05"
          kicker="Everyone gets told"
          heading="Sent by nobody. Proven anyway."
          body="Confirmations, reminders, receipts and reports send themselves — and each one records whether it actually arrived, so nobody can say they were never told."
          aside="Delivery tracked · bounces caught · no one presses send"
          screen={<ScreenMessage />}
        />

        {/* ═══════════════ 04 — LIVE SYSTEMS ═══════════════ */}
        <Section theme="dark" id="stories" pad="lg" topBorder>
          <Reveal>
            <span
              style={{
                fontFamily: T.mono,
                fontSize: "0.66rem",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--k-accent)",
              }}
            >
              [04] Running right now
            </span>
          </Reveal>
          <ClipReveal delay={0.06} className="mt-8">
            <h2
              style={{
                margin: 0,
                fontFamily: T.sans,
                fontWeight: 500,
                fontSize: "clamp(2rem,5vw,3.6rem)",
                lineHeight: 0.9,
                letterSpacing: "normal",
                textTransform: "uppercase",
                color: "var(--k-fg)",
                maxWidth: "18ch",
              }}
            >
              Three businesses. Nothing alike.
            </h2>
          </ClipReveal>
          <Reveal delay={0.14}>
            <p
              className="mt-10"
              style={{
                fontFamily: T.sans,
                fontWeight: 400,
                fontSize: "clamp(1.05rem,1.7vw,1.5rem)",
                lineHeight: 1.26,
                color: "var(--k-fg)",
                maxWidth: "36ch",
              }}
            >
              A dance school, a county tennis body and a counselling practice. Same
              studio, three systems that share nothing but the care that went into them.
            </p>
          </Reveal>
          <div className="mt-4">
            <LiveSystems />
          </div>
          <Reveal delay={0.1}>
            <div
              className="mt-10 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
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
              <TextLink href="/client-stories">All three stories</TextLink>
            </div>
          </Reveal>
        </Section>

        {/* ═══════════════ 05 — BEFORE / AFTER (dark) ═══════════════ */}
        <Section theme="dark" id="problem" pad="lg" topBorder>
          <Reveal>
            <SectionHeader
              index="05"
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

        {/* ═══════════════ 06 — WHAT YOU OWN (cream) ═══════════════ */}
        <Section theme="dark" id="why" pad="lg" topBorder>
          <Reveal>
            <SectionHeader
              index="06"
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
              index="07"
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
            index="08"
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
