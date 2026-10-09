import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Parallax } from "@/components/Parallax";
import { ClipReveal } from "@/components/anim/ClipReveal";
import { T } from "@nullshift/ui/tokens";
import { CLIENT_STORIES } from "@nullshift/content/clientStories";
import { legalConfig } from "@nullshift/content/legal/config";
import { PARTNER_TERMS } from "@nullshift/content/legal/partnerAgreement";
import { hasSupabaseServerConfig } from "@nullshift/db/env";
import { StoryCard } from "@/components/marketing/StoryCard";
import { partnerPlanPrices } from "@/lib/partnerPricing";
import { pricingHref, showsFigures } from "@/lib/pricingVisibility";
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
import { PartnerApplicationForm } from "./PartnerApplicationForm";
import styles from "./partners.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Partner programme — Nullshift",
  description:
    "Build with Nullshift, sell under your name. Two ways to partner: refer a client and earn 10% of the build fee, or white-label our builds and monthly plans at 25% off list while we run delivery, hosting and support.",
  alternates: { canonical: "/partners" },
};

const PLANS = partnerPlanPrices();
const FIGURES = showsFigures();
const fromLine = (key: "list" | "partner") => PLANS.map((p) => `£${p[key]}`).join(" / ");

const REFERRAL = [
  `${PARTNER_TERMS.referralFeePercent}% of the build fee on every client you introduce`,
  `Paid pro-rata as each build milestone clears, within ${PARTNER_TERMS.referralPaymentDays} days`,
  `${PARTNER_TERMS.attributionMonths}-month attribution window from your introduction`,
  "We sell, contract, build and support under the Nullshift name",
  "Nothing for you to deliver — introduce, then step back",
];

const WHITE_LABEL = [
  `${PARTNER_TERMS.whiteLabelDiscountPercent}% off list on builds and monthly plans`,
  "You set the retail price and keep the difference",
  "We design, build, host, support and maintain, through your brand where needed",
  "Your client owns their code and accounts, as every Nullshift client does",
  "No minimum volume, no fee to join",
];

const GETS = [
  {
    n: "01",
    title: "Fixed quotes from the estimator",
    body: "Plug in the client's size and what they need; our guided estimator returns a build fee you can put in front of them the same day. Fixed in writing, moves only if the scope does.",
  },
  {
    n: "02",
    title: "Builds in 2–4 weeks",
    body: "Bespoke websites, booking systems, portals, CRMs, dashboards, automation, AI assistants, e-commerce, course and membership platforms. Most go live inside a month.",
  },
  {
    n: "03",
    title: "A client portal for every project",
    body: "Proposal, signed agreement, progress, invoices and change requests in one place. In white-label it carries your name where the client sees it.",
  },
  {
    n: "04",
    title: "Monthly plans we run for you",
    body: FIGURES
      ? `Core, Pro and Max from ${fromLine("list")} a month at list, scale-banded to the system. Hosting, monitoring, support and upkeep are ours to carry, not yours.`
      : "Core, Pro and Max, priced to the system and quoted in writing. Hosting, monitoring, support and upkeep are ours to carry, not yours.",
  },
];

const STEPS = [
  {
    title: "Apply",
    body: "Tell us who you are, who your clients are and which model you want. We reply within two working days, usually to set up a short call.",
  },
  {
    title: "Acceptance review",
    body: "Every partnership, and every client that follows, goes through our acceptance review. We check the fit, the data and the risk before we commit.",
  },
  {
    title: "Introduce or quote",
    body: "Referral: send us the introduction and we take it from there. White-label: run the estimator, we confirm the partner price, you set your retail.",
  },
  {
    title: "We build and run it",
    body: "Delivery, hosting, support and the monthly plan are on us. You get paid on each milestone, or invoice your client at your price.",
  },
];

const FAQS: FAQItem[] = [
  {
    q: "What does the acceptance review look at?",
    a: "The business, the system they want, the data it will handle and any regulatory or safety considerations. No sector is refused outright; every piece of work is reviewed on its own terms. We tell you plainly if we decline, and a declined project costs you nothing.",
  },
  {
    q: "Who owns the code?",
    a: "The end client, under the same client terms every Nullshift client gets: the delivered code, the data and every account the system runs on are theirs from handover. In white-label, that means your client, not you, unless the Order Form says otherwise.",
  },
  {
    q: "In white-label, who does the client talk to?",
    a: "You. You own the relationship, the retail invoice and first-line contact. We work behind your brand: support replies, status pages and documentation can carry your name, and we will not contact your client directly without your agreement unless safety or the law requires it.",
  },
  {
    q: "How and when are referral fees paid?",
    a: `Clients pay the build fee in three milestones: 50% to start, 25% at design sign-off and 25% before go-live. We pay your ${PARTNER_TERMS.referralFeePercent}% pro-rata as each milestone clears, within ${PARTNER_TERMS.referralPaymentDays} days of each, by bank transfer against your invoice. No fee is payable on monthly plans or on a business already in our pipeline.`,
  },
  {
    q: "How much notice to end it?",
    a: `${PARTNER_TERMS.noticeDays} days from either side, by email. Fees already earned are still paid, white-label projects already signed are finished, and live client systems are never switched off because a partnership ended.`,
  },
  {
    q: "Do you work with agencies outside the UK?",
    a: "Yes. The programme is international. The agreement is under English law, prices are in pounds sterling, and we pay referral fees to a business account in your name wherever it is held.",
  },
  {
    q: "Is it exclusive?",
    a: "No, on either side. You can work with other developers; we work with other partners and sell directly. There is no minimum number of introductions.",
  },
];

export default function PartnersPage() {
  const preview = process.env.NODE_ENV === "development" && !hasSupabaseServerConfig();

  return (
    <>
      <Nav />
      <main>
        {/* ═══════════════ HERO (dark) ═══════════════ */}
        <section
          className="k-dark relative overflow-hidden"
          style={{ background: "var(--k-bg)", color: "var(--k-fg)" }}
        >
          <Parallax
            distance={-28}
            className="pointer-events-none absolute inset-0"
            style={{ zIndex: 0 }}
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
          <Container
            style={{
              paddingTop: "clamp(116px,15vh,168px)",
              paddingBottom: "clamp(40px,6vw,72px)",
              position: "relative",
              zIndex: 2,
            }}
          >
            <Reveal>
              <Eyebrow index="00" label="Partner programme" />
            </Reveal>
            <ClipReveal delay={0.05}>
              <Display as="h1" size="hero" className="mt-6" style={{ maxWidth: "15ch" }}>
                Build with Nullshift.{" "}
                <span style={{ color: "var(--k-accent)" }}>Sell under your name.</span>
              </Display>
            </ClipReveal>
            <Reveal delay={0.1}>
              <Lead className="mt-7" style={{ maxWidth: "58ch", fontSize: "1.125rem" }}>
                For consultancies, agencies and studios whose clients need software but
                who don’t want a dev team. Introduce a client and earn on the build, or
                sell our builds and monthly plans under your own brand while we deliver,
                host and support. Either way, we do the engineering.
              </Lead>
            </Reveal>
            <Reveal delay={0.16}>
              <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3">
                <a href="#apply" className="kb kb-primary">
                  Apply to partner
                  <span className="k-arrow" aria-hidden>
                    →
                  </span>
                </a>
                <Link href={legalConfig.routes.partnerAgreement} className="kb kb-outline">
                  Read the agreement
                </Link>
              </div>
            </Reveal>
            <Parallax distance={42} className="mt-8 overflow-hidden">
              <Watermark>Partners</Watermark>
            </Parallax>
          </Container>
        </section>

        {/* ═══════════════ TWO MODELS (cream) ═══════════════ */}
        <Section theme="cream" pad="lg" topBorder id="models">
          <Reveal>
            <SectionHeader
              index="01"
              label="Two ways in"
              title={
                <>
                  Refer it. <span style={{ color: "var(--k-muted)" }}>Or resell it.</span>
                </>
              }
              lead="Pick the model that fits how you sell. Both are non-exclusive, both run through our acceptance review, and you can add the other later."
              maxLead="60ch"
            />
          </Reveal>
          <Reveal delay={0.08}>
            <div className={styles.models}>
              <div className={styles.model}>
                <span className={styles.modelName}>[Referral]</span>
                <div className={styles.modelHeadline}>
                  <span className={styles.modelFigure}>
                    {PARTNER_TERMS.referralFeePercent}%
                  </span>
                  <span className={styles.modelUnit}>of the build fee</span>
                </div>
                <p className={styles.modelDesc}>
                  You know a business that needs a system. Introduce them, we take the
                  sale, the build and the running of it under the Nullshift name, and you
                  earn a share of what they pay to have it built.
                </p>
                <ul className={styles.modelList}>
                  {REFERRAL.map((it) => (
                    <li key={it}>{it}</li>
                  ))}
                </ul>
                <p className={styles.modelFoot}>
                  No share of monthly plans. No fee on clients already in our pipeline.
                </p>
              </div>
              <div className={`${styles.model} ${styles.modelFeatured}`}>
                <span className={styles.modelTag}>
                  <Tag>Your brand</Tag>
                </span>
                <span className={styles.modelName}>[White-label]</span>
                <div className={styles.modelHeadline}>
                  <span className={styles.modelFigure}>
                    {PARTNER_TERMS.whiteLabelDiscountPercent}% off
                  </span>
                  <span className={styles.modelUnit}>list price</span>
                </div>
                <p className={styles.modelDesc}>
                  Sell the system as yours. You buy builds and plans from us at the
                  partner price, set your own retail, and hand delivery, hosting, support
                  and maintenance to us. We stay invisible to your client.
                </p>
                <ul className={styles.modelList}>
                  {WHITE_LABEL.map((it) => (
                    <li key={it}>{it}</li>
                  ))}
                </ul>
                <p className={styles.modelFoot}>
                  {FIGURES
                    ? `Plans at list from ${fromLine("list")} a month become ${fromLine("partner")} to you. Builds take the same ${PARTNER_TERMS.whiteLabelDiscountPercent}% off the estimator quote.`
                    : `Builds and monthly plans both take ${PARTNER_TERMS.whiteLabelDiscountPercent}% off the written quote.`}
                </p>
              </div>
            </div>
          </Reveal>
        </Section>

        {/* ═══════════════ WHAT PARTNERS GET (dark) ═══════════════ */}
        <Section theme="dark" pad="lg" topBorder>
          <Reveal>
            <SectionHeader
              index="02"
              label="What you get"
              title={
                <>
                  A studio behind you.{" "}
                  <span style={{ color: "var(--k-muted)" }}>Not a contractor.</span>
                </>
              }
              lead="The same delivery system our direct clients get, with your name on the front where you want it."
              maxLead="56ch"
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
              {GETS.map((g) => (
                <div
                  key={g.n}
                  className="p-8 md:p-10"
                  style={{
                    borderRight: "1px solid var(--k-border)",
                    borderBottom: "1px solid var(--k-border)",
                  }}
                >
                  <Eyebrow index={g.n} label={g.title} cursor={false} />
                  <p
                    className="mt-4"
                    style={{
                      fontFamily: T.sans,
                      fontSize: "0.92rem",
                      lineHeight: 1.7,
                      color: "var(--k-muted)",
                      maxWidth: "48ch",
                    }}
                  >
                    {g.body}
                  </p>
                </div>
              ))}
            </div>
          </Reveal>
          {FIGURES && (
            <p
              className="mt-6"
              style={{
                fontFamily: T.mono,
                fontSize: "0.72rem",
                lineHeight: 1.7,
                letterSpacing: "0.02em",
                color: "var(--k-muted)",
                maxWidth: "72ch",
              }}
            >
              Plan prices are “from” figures for standard-scale systems, excluding VAT
              where applicable; the rate scales with the size and importance of the system
              and is confirmed in writing before anyone commits.{" "}
              <Link href={pricingHref()} style={{ color: "var(--k-accent)" }}>
                See the full pricing page →
              </Link>
            </p>
          )}
        </Section>

        {/* ═══════════════ HOW IT WORKS (cream) ═══════════════ */}
        <Section theme="cream" pad="lg" topBorder>
          <Reveal>
            <SectionHeader
              index="03"
              label="How it works"
              title={
                <>
                  Four steps. <span style={{ color: "var(--k-muted)" }}>One review.</span>
                </>
              }
            />
          </Reveal>
          <Reveal delay={0.08}>
            <div className={styles.steps}>
              {STEPS.map((s, i) => (
                <div key={s.title} className={styles.step}>
                  <span className={styles.stepIndex}>[0{i + 1}]</span>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </Section>

        {/* ═══════════════ PROOF (dark) ═══════════════ */}
        <Section theme="dark" pad="lg" topBorder>
          <Reveal>
            <SectionHeader
              index="04"
              label="Proof"
              title={
                <>
                  Systems{" "}
                  <span style={{ color: "var(--k-muted) " }}>already running.</span>
                </>
              }
              lead="What your clients would be getting: real platforms doing daily work for the businesses that own them."
              maxLead="56ch"
            />
          </Reveal>
          <Reveal delay={0.08}>
            <div className={styles.stories}>
              {CLIENT_STORIES.map((s) => (
                <StoryCard
                  key={s.slug}
                  story={s}
                  href={`/client-stories#${s.slug}`}
                  theme="dark"
                />
              ))}
            </div>
          </Reveal>
        </Section>

        {/* ═══════════════ FAQ (cream) ═══════════════ */}
        <Section theme="cream" pad="lg" topBorder>
          <Reveal>
            <SectionHeader
              index="05"
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
              <Accordion items={FAQS} defaultOpen={null} />
            </div>
          </Reveal>
          <p
            className="mt-8"
            style={{
              fontFamily: T.sans,
              fontSize: "0.88rem",
              lineHeight: 1.6,
              color: "var(--k-muted)",
              maxWidth: "72ch",
            }}
          >
            The full terms are in the{" "}
            <Link
              href={legalConfig.routes.partnerAgreement}
              style={{ color: "var(--k-accent)" }}
            >
              Partner Programme Agreement
            </Link>
            , written in plain English and published so you can read it before you apply.
          </p>
        </Section>

        {/* ═══════════════ APPLY (dark) ═══════════════ */}
        <Section theme="dark" pad="lg" topBorder id="apply">
          <Reveal>
            <SectionHeader
              index="06"
              label="Apply"
              title={
                <>
                  Tell us <span style={{ color: "var(--k-accent)" }}>who you are.</span>
                </>
              }
            />
          </Reveal>
          <div className={styles.applyLayout}>
            <Reveal delay={0.06}>
              <div className={styles.applyAside}>
                <Lead style={{ maxWidth: "44ch" }}>
                  We’re looking for consultancies, agencies and studios of any size whose
                  clients need software built properly. International is fine. A dev team
                  is not required; that is the point.
                </Lead>
                <ul className={styles.applyPromises}>
                  <li>A reply within two working days.</li>
                  <li>A short call before anything is agreed.</li>
                  <li>No fee to join, no minimum volume.</li>
                </ul>
                <p className={styles.applyScope}>
                  Applying is not an acceptance. Every partner, and every client
                  introduced through one, goes through our acceptance review first. Prefer
                  to talk first? <Link href="/book/partner">Book a partner call</Link>.
                </p>
              </div>
            </Reveal>
            <Reveal delay={0.1}>
              <PartnerApplicationForm
                preview={preview}
                contactEmail={legalConfig.contact.general}
              />
            </Reveal>
          </div>
        </Section>

        <div style={{ borderTop: "1px solid var(--k-border)" }}>
          <CTABand
            theme="cream"
            index="07"
            label="Not an agency?"
            title={
              <>
                Need a system <span style={{ color: "var(--k-accent)" }}>yourself?</span>
              </>
            }
            lead="If you’re the business rather than the agency, start with a free tailored plan and a fixed quote."
            primary={{ label: "Get my free plan", href: "/start" }}
            secondary={{ label: "Book a partner call", href: "/book/partner" }}
          />
        </div>
      </main>
      <Footer />
    </>
  );
}
