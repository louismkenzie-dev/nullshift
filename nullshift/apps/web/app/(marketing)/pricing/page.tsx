import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Parallax } from "@/components/Parallax";
import { NeuralField } from "@/components/NeuralField";
import { T } from "@nullshift/ui/tokens";
import { PROOF_PILLARS, BRAND_LINE, CLINIC } from "@nullshift/content/marketing";
import { PRICING_FAQS, PRICING_FROM } from "@nullshift/content/pricing";
import { PricingTiers } from "@/components/marketing/PricingTiers";
import { SupportBoundary } from "@/components/marketing/SupportBoundary";
import { ClipReveal } from "@/components/anim/ClipReveal";
import {
  Reveal,
  Section,
  Container,
  Eyebrow,
  Display,
  Lead,
  SectionHeader,
  Accordion,
  CTABand,
  Tag,
  Watermark,
  type FAQItem,
} from "@/components/kyma";

export const metadata: Metadata = {
  title: "Pricing — Nullshift",
  description:
    "One build to own your website and systems outright, then a monthly plan from \u00a330 that covers your running costs and keeps everything online. Four tiers \u2014 Core, Pro, Max and Enterprise \u2014 no per-seat fees, cancel any month.",
  alternates: { canonical: "/pricing" },
};

const faqs: FAQItem[] = [...PRICING_FAQS, ...CLINIC.faqs].map(
  (f: { q: string; a: string }) => ({ q: f.q, a: f.a })
);

const BUILD = [
  "Custom website, designed & built from scratch",
  "Bespoke systems — booking, CRM, dashboards, portals",
  "Workflow automations wired in",
  "Your existing data migrated across, no downtime",
  "Code, data & every account handed to you",
  "Live in 2–4 weeks",
];

const OWNERSHIP = [
  "Every account in your name — hosting, domain, database, email, AI",
  "The full source code, in your repository",
  "Your data, exportable any time, in a standard format",
  "A signed DPA before anything goes live",
  "Payments through your own Stripe — no 2\u20133% skim",
  "Cancel the monthly plan and keep the whole system",
];

function PriceCard({
  name,
  price,
  unit,
  desc,
  items,
  featured,
}: {
  name: string;
  price: string;
  unit: string;
  desc: string;
  items: string[];
  featured?: boolean;
}) {
  return (
    <div
      className="relative flex flex-col p-8 md:p-10"
      style={{
        borderRight: "1px solid var(--k-border)",
        borderBottom: "1px solid var(--k-border)",
        background: featured ? "var(--k-surface)" : "transparent",
      }}
    >
      {featured && (
        <span className="absolute right-8 top-8">
          <Tag>You own it</Tag>
        </span>
      )}
      <span
        style={{
          fontFamily: T.mono,
          fontSize: "0.72rem",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--k-accent)",
        }}
      >
        [{name}]
      </span>
      <div className="mt-5 flex items-baseline gap-2">
        <span
          style={{
            fontFamily: T.sans,
            fontWeight: 800,
            fontSize: "clamp(2rem,3vw,2.7rem)",
            letterSpacing: "-0.03em",
            textTransform: "uppercase",
            color: "var(--k-fg)",
          }}
        >
          {price}
        </span>
        <span
          style={{
            fontFamily: T.mono,
            fontSize: "0.78rem",
            textTransform: "uppercase",
            color: "var(--k-muted)",
          }}
        >
          {unit}
        </span>
      </div>
      <p
        className="mt-4"
        style={{
          fontFamily: T.sans,
          fontSize: "0.95rem",
          lineHeight: 1.55,
          color: "var(--k-muted)",
          maxWidth: "44ch",
        }}
      >
        {desc}
      </p>
      <ul
        className="mt-7 flex flex-col gap-3"
        style={{ listStyle: "none", margin: 0, padding: 0 }}
      >
        {items.map((it) => (
          <li
            key={it}
            className="flex items-start gap-3"
            style={{ fontFamily: T.sans, fontSize: "0.9rem", color: "var(--k-fg)" }}
          >
            <span aria-hidden style={{ color: "var(--k-accent)", marginTop: 1 }}>
              ▸
            </span>
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function PricingPage() {
  return (
    <>
      <Nav />
      <main>
        {/* ═══════════════ HERO (dark · layered WebGL depth) ═══════════════ */}
        <section
          className="k-dark relative overflow-hidden"
          style={{ background: "var(--k-bg)", color: "var(--k-fg)" }}
        >
          {/* deep layer — raw-WebGL emerald field, drifts with scroll + cursor */}
          <NeuralField className="absolute inset-0" style={{ zIndex: 0 }} />
          {/* mid layer — parallaxing hairline grid */}
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
          {/* keep the field from ever fighting the headline */}
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
              <Eyebrow index="00" label="Pricing" />
            </Reveal>

            <ClipReveal delay={0.05}>
              <Display as="h1" size="hero" className="mt-6" style={{ maxWidth: "16ch" }}>
                Own your systems.{" "}
                <span style={{ color: "var(--k-accent)" }}>We run them.</span>
              </Display>
            </ClipReveal>

            <Reveal delay={0.1}>
              <Lead className="mt-7" style={{ maxWidth: "58ch", fontSize: "1.125rem" }}>
                One build to own your website and systems outright — quoted to your scope,
                never off a price list. Then a monthly plan from {PRICING_FROM} keeps it
                running: your plan sets the service your platform needs, and your rate
                scales with the size and importance of the system. No per-seat fees,
                cancel any month.
              </Lead>
            </Reveal>

            <Reveal delay={0.16}>
              <Link
                href="/work"
                className="mt-9 inline-flex flex-col gap-1.5"
                style={{
                  maxWidth: "60ch",
                  background: "var(--k-surface)",
                  border: "1px solid var(--k-border-strong)",
                  padding: "16px 20px",
                  textDecoration: "none",
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
                  Client stories
                </span>
                <span
                  style={{
                    fontFamily: T.sans,
                    fontSize: "0.98rem",
                    lineHeight: 1.6,
                    color: "var(--k-fg)",
                  }}
                >
                  See what owning the system looks like — real platforms doing real daily
                  work for the businesses that own them.{" "}
                  <span style={{ color: "var(--k-accent)" }}>
                    See the client stories →
                  </span>
                </span>
              </Link>
            </Reveal>

            <Parallax distance={42} className="mt-8 overflow-hidden">
              <Watermark>Pricing</Watermark>
            </Parallax>
          </Container>
        </section>

        {/* ═══════════════ MONTHLY TIERS (dark) ═══════════════ */}
        <Section theme="dark" pad="lg" topBorder>
          <Reveal>
            <SectionHeader
              index="01"
              label="Monthly plans"
              title={
                <>
                  Four tiers.{" "}
                  <span style={{ color: "var(--k-muted)" }}>Pick your pace.</span>
                </>
              }
              lead="Your plan is based on the service your platform needs. Your monthly rate then scales with the size, usage, complexity and commercial importance of the system — so the figures below are where each level starts, and we tell you your rate before you commit. Every level is month-to-month. Open “what this adds” on any card to see what it gets you over the level below."
              maxLead="68ch"
            />
          </Reveal>
          <Reveal delay={0.08}>
            <div className="mt-12">
              <PricingTiers />
            </div>
          </Reveal>
        </Section>

        {/* ═══════════════ PROOF PILLARS (cream) ═══════════════ */}
        <Section theme="cream" pad="none" topBorder bare>
          <div
            className="grid md:grid-cols-3"
            style={{ borderLeft: "1px solid var(--k-border)" }}
          >
            {PROOF_PILLARS.map(
              (item: { n: string; title: string; body: string }, i: number) => (
                <Reveal key={item.n} delay={i * 0.08}>
                  <div
                    className="px-8 py-9 md:px-12 h-full"
                    style={{
                      borderRight: "1px solid var(--k-border)",
                      borderBottom: "1px solid var(--k-border)",
                    }}
                  >
                    <div className="mb-4">
                      <Eyebrow index={item.n} label={item.title} />
                    </div>
                    <p
                      style={{
                        fontFamily: T.sans,
                        fontSize: "0.9rem",
                        lineHeight: 1.7,
                        color: "var(--k-muted)",
                      }}
                    >
                      {item.body}
                    </p>
                  </div>
                </Reveal>
              )
            )}
          </div>
        </Section>

        {/* ═══════════════ THE BUILD (dark) ═══════════════ */}
        <Section theme="dark" pad="lg" topBorder>
          <Reveal>
            <SectionHeader
              index="02"
              label="Before the monthly"
              title="Build it once. Own it outright."
              lead="The monthly tiers start once your system is live. The build that gets it there is a one-off, quoted to your scope — a booking form and a multi-site operations platform are not the same job, so neither are their prices. You get a fixed figure up front, and it only moves if you ask for something new."
              maxLead="66ch"
            />
          </Reveal>
          <Reveal delay={0.08}>
            <div
              className="mt-12 grid grid-cols-1 md:grid-cols-2"
              style={{
                borderTop: "1px solid var(--k-border)",
                borderLeft: "1px solid var(--k-border)",
              }}
            >
              <PriceCard
                name="One-off build"
                price="Quoted"
                unit="to your scope"
                desc="We design, build and migrate your website and systems. Fixed price agreed before we start, live in 2–4 weeks, and when it's done it's yours — for good."
                items={BUILD}
                featured
              />
              <PriceCard
                name="On handover"
                price="All yours"
                unit="from day one"
                desc="Ownership isn't a promise we make at the end — it's how the build is set up from the first commit. Nothing sits in our name that you'd have to buy back."
                items={OWNERSHIP}
              />
            </div>
          </Reveal>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href="/start" className="kb kb-primary k-dark">
              Get a fixed quote
              <span className="k-arrow" aria-hidden>
                →
              </span>
            </Link>
            <span
              style={{
                fontFamily: T.mono,
                fontSize: "0.72rem",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: "var(--k-muted)",
              }}
            >
              Payments run through your own Stripe — keep the relationship, no 2–3% skim
            </span>
          </div>
        </Section>

        {/* ═══════════════ SUPPORT BOUNDARY (cream) ═══════════════ */}
        <Section theme="cream" pad="lg" topBorder>
          <Reveal>
            <SectionHeader
              index="03"
              label="What the monthly covers"
              title={
                <>
                  Support, or a{" "}
                  <span style={{ color: "var(--k-muted)" }}>new build?</span>
                </>
              }
              lead="The honest version, up front. Your plan covers keeping what you have working, and configuring it within its design. Anything that changes what the product can do is a separate fixed-price project — scoped and priced in writing before we start."
              maxLead="66ch"
            />
          </Reveal>
          <Reveal delay={0.08}>
            <div className="mt-12">
              <SupportBoundary />
            </div>
          </Reveal>
        </Section>

        {/* ═══════════════ FAQ (cream) ═══════════════ */}
        <Section theme="cream" pad="lg" topBorder>
          <Reveal>
            <SectionHeader
              index="04"
              label="Straight answers"
              title={
                <>
                  Straight <span style={{ color: "var(--k-muted)" }}>answers.</span>
                </>
              }
            />
          </Reveal>
          <Reveal delay={0.08}>
            <div className="mt-10">
              <Accordion items={faqs} defaultOpen={null} />
            </div>
          </Reveal>
        </Section>

        {/* ═══════════════ FINAL CTA (dark) ═══════════════ */}
        <div style={{ borderTop: "1px solid var(--k-border)" }}>
          <CTABand
            theme="dark"
            index="05"
            label="Not sure yet"
            title={
              <>
                Not sure where <span style={{ color: "var(--k-accent)" }}>to start?</span>
              </>
            }
            lead={`Book a free 15-minute call — we'll work out the right plan and show you the system live. ${BRAND_LINE}`}
            primary={{ label: "Book a free call", href: "/book" }}
            secondary={{ label: "Get my free plan", href: "/start" }}
          />
        </div>
      </main>
      <Footer />
    </>
  );
}
