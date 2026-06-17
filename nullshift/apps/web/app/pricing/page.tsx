"use client";

import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import { PricingCard } from "@/components/PricingCard";
import { PlanLadder } from "@nullshift/ui/components/PlanLadder";
import { T } from "@nullshift/ui/tokens";
import { pricingPlans } from "@nullshift/billing/pricing";
import { PROOF_PILLARS, BRAND_LINE } from "@nullshift/content/marketing";
import Link from "next/link";

const learningTiers = pricingPlans; // Core / Grow / Pro / Partner

const faqs = [
  {
    q: "Why monthly — I thought you let me own it?",
    a: "You do. You own the code and every account (hosting, domain, booking, AI), and can cancel anytime and keep everything. The monthly isn't rent on your website — it's us running the system that brings you customers, and reporting the revenue we recover. No hostage situation, no rebilled-tool markups.",
  },
  {
    q: "What's the setup fee for?",
    a: "It covers the bespoke build — your fast, custom site and the automations wired to your business. It makes acquisition pay back almost immediately, so the monthly is pure value from day one.",
  },
  {
    q: "Too expensive — I'll just use Wix.",
    a: "Wix is ~£30/mo forever and you never own it. One missed job (or a week of no-shows) costs more than a month with us — and we recover that for you while you own the asset. We compete on outcome and ownership, never on cheapest monthly.",
  },
  {
    q: "What's the Partner tier?",
    a: "\"Done-with-you\": we build your site or system and spend 12 months teaching you to own and run it yourself. By month 12 you're fully independent. Perfect for ambitious owners who want capability, not dependency.",
  },
];

export default function PricingPage() {
  return (
    <>
      <Nav />
      <main>
        {/* Hero */}
        <section className="pt-28 pb-16 px-8 md:px-16" style={{
          backgroundImage: `radial-gradient(ellipse 55% 50% at 55% 30%, color-mix(in oklab, ${T.primary} 7%, transparent) 0%, transparent 70%)`,
        }}>
          <span className="inline-flex items-center gap-2 mb-6" style={{ fontFamily: T.sans, fontSize: "0.75rem", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: T.muted }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.primary, boxShadow: `0 0 0 4px ${T.primarySoft}`, display: "inline-block" }} />
            Pricing
          </span>
          <h1 style={{ fontFamily: T.display, fontWeight: 600, fontSize: "clamp(3rem,8vw,7rem)", lineHeight: 1.04, letterSpacing: "-0.03em", color: T.fg }}>
            Own your system.<br /><span className="hero-glow" style={{ color: T.primary }}>Subscribe to results.</span>
          </h1>
          <p className="mt-6 max-w-[56ch]" style={{ fontFamily: T.sans, fontSize: "1.05rem", lineHeight: 1.7, color: T.muted }}>
            A small setup fee builds your bespoke site. Then a simple monthly plan runs the system that brings the work in — and we show you the revenue recovered, every month. You own everything, and you can cancel anytime.
          </p>
        </section>

        {/* Proof pillars */}
        <section style={{ borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`, background: T.surface }}>
          <div className="grid md:grid-cols-3" style={{ borderLeft: `1px solid ${T.border}` }}>
            {PROOF_PILLARS.map((item, i) => (
              <Reveal key={item.n} delay={i * 0.08}>
                <div className="px-10 py-8 md:px-12" style={{ borderRight: `1px solid ${T.border}` }}>
                  <div className="mb-3" style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.14em", color: T.primary }}>{item.n} — {item.title.toUpperCase()}</div>
                  <p style={{ fontFamily: T.sans, fontSize: "0.875rem", lineHeight: 1.7, color: T.muted }}>{item.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* The Growth System — recurring care-plan ladder */}
        <section className="px-8 md:px-16 py-20" style={{ borderTop: `1px solid ${T.border}` }}>
          <Reveal>
            <h2 style={{ fontFamily: T.display, fontWeight: 600, fontSize: "clamp(2rem,4vw,3.2rem)", lineHeight: 1.05, letterSpacing: "-0.03em", color: T.fg }}>
              The Growth System.
            </h2>
            <p className="mt-3 max-w-[60ch]" style={{ fontFamily: T.sans, fontSize: "1rem", lineHeight: 1.65, color: T.muted }}>
              Productised plans for the businesses we serve. Pick your world — the build is the on-ramp, the monthly plan is the machine.
            </p>
          </Reveal>
          <div className="mt-8">
            <PlanLadder />
          </div>
        </section>

        {/* Learning subscriptions — self-serve / done-with-you */}
        <section className="px-8 md:px-16 py-20" style={{ borderTop: `1px solid ${T.border}`, background: T.surface }}>
          <Reveal>
            <h2 style={{ fontFamily: T.display, fontWeight: 600, fontSize: "clamp(1.8rem,3.6vw,2.8rem)", lineHeight: 1.05, letterSpacing: "-0.03em", color: T.fg }}>
              Prefer to <span style={{ color: T.primary }}>learn it yourself?</span>
            </h2>
            <p className="mt-3 max-w-[60ch]" style={{ fontFamily: T.sans, fontSize: "1rem", lineHeight: 1.65, color: T.muted }}>
              Start here. Self-serve learning for DIY-ers, plus our premium &ldquo;done-with-you&rdquo; Partner tier — we build it and teach you to own it in 12 months.
            </p>
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mt-10">
            {learningTiers.map((tier) => (
              <PricingCard key={tier.tier} {...tier} />
            ))}
          </div>
          <p className="mt-6" style={{ fontFamily: T.sans, fontSize: "0.75rem", letterSpacing: "0.02em", color: T.faint }}>
            All prices GBP · billed monthly · cancel anytime (except Partner tier)
          </p>
        </section>

        {/* FAQ strip */}
        <section style={{ borderTop: `1px solid ${T.border}` }}>
          <div className="px-10 md:px-16 pt-16 pb-10">
            <Reveal>
              <h2 style={{ fontFamily: T.display, fontWeight: 600, fontSize: "clamp(2rem,4vw,3.5rem)", lineHeight: 1.04, letterSpacing: "-0.03em", color: T.fg }}>
                Straight <span style={{ color: T.muted }}>answers.</span>
              </h2>
            </Reveal>
          </div>
          <div className="grid md:grid-cols-2" style={{ borderTop: `1px solid ${T.border}`, borderLeft: `1px solid ${T.border}` }}>
            {faqs.map((f, i) => (
              <Reveal key={i} delay={i * 0.08}>
                <div className="p-10 md:p-12" style={{ borderRight: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}` }}>
                  <h3 className="mb-4" style={{ fontFamily: T.display, fontWeight: 600, fontSize: "1.2rem", letterSpacing: "0.01em", color: T.fg }}>{f.q}</h3>
                  <p style={{ fontFamily: T.sans, fontSize: "0.875rem", lineHeight: 1.75, color: T.muted }}>{f.a}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="px-10 md:px-16 py-24 flex flex-col md:flex-row items-start md:items-center justify-between gap-8" style={{ borderTop: `1px solid ${T.border}`, background: T.surface }}>
          <Reveal>
            <div>
              <h2 style={{ fontFamily: T.display, fontWeight: 600, fontSize: "clamp(2rem,4vw,3.5rem)", lineHeight: 1.04, letterSpacing: "-0.03em", color: T.fg }}>
                Not sure where<br />to start?
              </h2>
              <p className="mt-3" style={{ fontFamily: T.sans, fontSize: "0.9rem", color: T.muted }}>Book a free 15-minute call — we&apos;ll work out the right plan and show you the system live. {BRAND_LINE}</p>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <Link href="/book" className="inline-flex items-center justify-center font-medium"
              style={{ fontFamily: T.sans, fontSize: "0.9375rem", fontWeight: 500, letterSpacing: "-0.005em", height: 48, paddingInline: 28, background: T.primary, color: T.primaryFg, borderRadius: T.r.md, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18)`, textDecoration: "none", whiteSpace: "nowrap", transition: `background ${T.duration.base} ${T.ease}` }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = T.primaryHover}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = T.primary}
            >
              Book a free call →
            </Link>
          </Reveal>
        </section>
      </main>
      <Footer />
    </>
  );
}
