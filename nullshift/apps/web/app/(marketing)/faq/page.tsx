import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import {
  Reveal,
  Section,
  Container,
  Eyebrow,
  Display,
  Lead,
  SectionHeader,
  BtnGhost,
  Accordion,
  CTABand,
  Watermark,
  type FAQItem,
} from "@/components/kyma";
import { T } from "@nullshift/ui/tokens";

export const metadata: Metadata = {
  title: "FAQ — Nullshift",
  description:
    "Everything you need to know about owning your website, systems and automations — ownership, the care plan, data, migration and payments.",
  alternates: { canonical: "/faq" },
};

const FAQS: FAQItem[] = [
  {
    cat: "Data & Compliance",
    q: "Is my customer data safe and GDPR-compliant?",
    a: "Yes. We act as your data processor under a signed DPA, host your system in the UK/EU, and encrypt data in transit and at rest with a full audit trail. Your customer records, CRM and forms live in a system you own — GDPR-compliant, exportable any time, and never sold or locked in. You stay the data controller; we just run the infrastructure on your behalf.",
  },
  {
    cat: "Data & Compliance",
    q: "What does the DPA actually cover?",
    a: "The Data Processing Agreement sets out, in writing, that your business is the data controller and Nullshift is the processor — we only process your customer data on your documented instructions, keep it in the UK/EU, apply the security measures above, and return or delete it if you ever leave. It's signed before any customer data touches the system, so your compliance paperwork is covered from day one.",
  },
  {
    cat: "Migrating Over",
    q: "What about my existing website, systems and records?",
    a: "We migrate them for you. You keep running your current tools as normal until the new system is live and fully tested — there's no gap where you can't take bookings or serve customers. Then we move your data, customer records and history across, you confirm everything looks right, and only then do you cancel the old subscriptions you no longer need.",
  },
  {
    cat: "Migrating Over",
    q: "How long does it take to go live?",
    a: "Most businesses are live in a matter of weeks, not months, once we've had the 15-minute call and you've signed off the design direction. We build, you test it against your real workflow, your data is migrated, and we switch over. You'll get a clear timeline in your proposal before anything starts.",
  },
  {
    cat: "Ownership & Care Plan",
    q: "Do I actually own the system?",
    a: "Yes — completely. You own the code, the customer data and every account it runs on (your domain, your Stripe, your database). You can cancel the care plan at any time and keep everything, with a full export of your records and the running system handed over. There's no hostage situation and no lock-in.",
  },
  {
    cat: "Ownership & Care Plan",
    q: "Why pay a monthly care plan if I own it?",
    a: "Because owning the asset and running it are two different things. The one-off build buys you the website, system and automations outright — the code and data are yours. The care plan covers what it actually takes to keep it running: hosting, storage, email and server costs (we cover Vercel, Resend and the rest) plus our liability cover and ongoing maintenance. Cancel whenever you like and you keep the code and data; you'd just take over hosting and maintenance yourself.",
  },
  {
    cat: "Ownership & Care Plan",
    q: "We're a small or solo business — is this overkill?",
    a: "No — it scales down cleanly. A solo operator or small team owns a tidy website, booking and payments system instead of renting three or four separate SaaS tools each month. Because the rented tools charge per seat, the savings only get bigger as you add team members — but the model already works in your favour from day one.",
  },
  {
    cat: "Payments",
    q: "How do customer payments work?",
    a: "Customers pay through your own Stripe account, so you keep the merchant relationship and the money lands directly with you. Instead of the 2–3% an incumbent tool skims on top, you pay a small flat platform fee. Deposits and prepayment are built into the booking flow, not bolted on as another monthly add-on.",
  },
  {
    cat: "What We Build",
    q: "What's actually included in the build?",
    a: "Whatever your business runs on — a custom website, bespoke systems and software, automations and integrations, online booking with deposits, automatic SMS + email reminders to cut missed bookings, a CRM and customer records, follow-ups, and customer payments through your own Stripe. It's built around how you work, in one system you own outright, and it replaces the stack of per-seat subscriptions you're currently renting.",
  },
];

export default function FaqPage() {
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
              <Eyebrow index="01" label="Frequently asked" />
            </Reveal>
            <div className="mt-7 grid grid-cols-1 lg:grid-cols-[1.25fr_0.75fr] gap-8 lg:gap-12 items-end">
              <Reveal delay={0.05}>
                <Display as="h1" size="hero" style={{ maxWidth: "14ch" }}>
                  Everything you <span style={{ color: "var(--k-accent)" }}>[need]</span>{" "}
                  to know.
                </Display>
              </Reveal>
              <Reveal delay={0.1}>
                <div>
                  <Lead style={{ maxWidth: "44ch" }}>
                    Can&apos;t find your answer? Book a free 15-minute call and we&apos;ll
                    answer everything about your business directly.
                  </Lead>
                  <div className="mt-7">
                    <BtnGhost href="/book" arrow>
                      Book a call
                    </BtnGhost>
                  </div>
                </div>
              </Reveal>
            </div>
            <div className="mt-12 overflow-hidden">
              <Watermark>Questions</Watermark>
            </div>
          </Container>
        </Section>

        {/* ═══════════════ FAQ ACCORDION (cream) ═══════════════ */}
        <Section theme="cream" pad="lg" topBorder>
          <div className="grid grid-cols-1 lg:grid-cols-[0.8fr_1.2fr] gap-10 lg:gap-16">
            <Reveal>
              <div className="lg:sticky lg:top-28 self-start">
                <SectionHeader
                  index="02"
                  label="All questions"
                  title={
                    <>
                      Answers, <span style={{ color: "var(--k-accent)" }}>in full.</span>
                    </>
                  }
                  lead="Ownership, the care plan, your data, migrating over and payments — the things businesses ask us most before they own their system."
                />
                <div className="mt-8">
                  <BtnGhost href="/start" arrow>
                    Get my free plan
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
            index="03"
            label="Still curious"
            title={
              <>
                Still have <span style={{ color: "var(--k-accent)" }}>questions?</span>
              </>
            }
            lead="Book a free 15-minute call and ask us anything about owning your business system."
            primary={{ label: "Book a discovery call", href: "/book" }}
            secondary={{ label: "Get my free plan", href: "/start" }}
            note="Free · No obligation · 15-minute call"
          />
        </div>
      </main>
      <Footer />
    </>
  );
}
