import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Parallax } from "@/components/Parallax";
import { NeuralField } from "@/components/NeuralField";
import { T } from "@nullshift/ui/tokens";
import { PROOF_PILLARS, BRAND_LINE, CLINIC } from "@nullshift/content/marketing";
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
    "One build to own your website and systems outright, then a simple care plan that covers your running costs and keeps everything online. No per-seat fees, cancel anytime.",
  alternates: { canonical: "/pricing" },
};

const faqs: FAQItem[] = CLINIC.faqs.map((f: { q: string; a: string }) => ({
  q: f.q,
  a: f.a,
}));

const BUILD = [
  "Custom website, designed & built from scratch",
  "Bespoke systems — booking, CRM, dashboards, portals",
  "Workflow automations wired in",
  "Your existing data migrated across, no downtime",
  "Code, data & every account handed to you",
  "Live in 2–4 weeks",
];

const CARE = [
  "Hosting, storage & email (we cover Vercel, Resend & co.)",
  "Domain & SSL kept live",
  "Security patches & updates",
  "Daily backups & monitoring",
  "Our liability cover",
  "Cancel anytime — keep everything",
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
                One build to own your website and systems outright. Then a simple care
                plan covers the running costs — hosting, storage, email and servers — and
                keeps everything online. No per-seat fees, and you can cancel anytime.
              </Lead>
            </Reveal>

            <Reveal delay={0.16}>
              <Link
                href="/#savings"
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
                  The cuttable bill
                </span>
                <span
                  style={{
                    fontFamily: T.sans,
                    fontSize: "0.98rem",
                    lineHeight: 1.6,
                    color: "var(--k-fg)",
                  }}
                >
                  Renting per-seat software that grows with every hire? Own it instead,
                  and stop the line on your P&amp;L from climbing.{" "}
                  <span style={{ color: "var(--k-accent)" }}>
                    See what you&apos;d save →
                  </span>
                </span>
              </Link>
            </Reveal>

            <Parallax distance={42} className="mt-8 overflow-hidden">
              <Watermark>Pricing</Watermark>
            </Parallax>
          </Container>
        </section>

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

        {/* ═══════════════ BUILD + CARE (dark) ═══════════════ */}
        <Section theme="dark" pad="lg" topBorder>
          <Reveal>
            <SectionHeader
              index="01"
              label="Two things, no surprises"
              title="Build it. Own it. We run it."
              lead="One build to own everything outright, then a care plan that covers what it costs to keep it online. No tiers to decode, no per-seat fees — every project is scoped and quoted to you."
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
                price="You own it"
                unit="outright"
                desc="We design, build and migrate your website and systems. When it's done, it's yours — for good. Priced to your scope, never off-the-shelf."
                items={BUILD}
                featured
              />
              <PriceCard
                name="Care plan"
                price="Monthly"
                unit="we run it"
                desc="Not rent on something you own — us covering your running costs and liability, and keeping everything online, secure and up to date."
                items={CARE}
              />
            </div>
          </Reveal>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href="/start" className="kb kb-primary k-dark">
              Get a tailored plan
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

        {/* ═══════════════ FAQ (cream) ═══════════════ */}
        <Section theme="cream" pad="lg" topBorder>
          <Reveal>
            <SectionHeader
              index="02"
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
            index="03"
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
