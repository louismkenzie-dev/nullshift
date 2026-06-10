"use client";

import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import { PricingCard } from "@/components/PricingCard";
import { T } from "@/lib/tokens";
import { pricingPlans } from "@/lib/pricingPlans";
import Link from "next/link";

const tiers = pricingPlans;

const faqs = [
  {
    q: "Why subscriptions instead of one-off projects?",
    a: "AI tools are evolving fast. A one-time build goes stale. A subscription means you're continuously learning, adapting, and getting support as the landscape changes — not just a deliverable and a goodbye.",
  },
  {
    q: "What makes Nullshift different?",
    a: "The tools exist. The training doesn't. We sit between cutting-edge AI capability and the individuals and businesses who need to use it — translating tools into real workflows and building genuine digital independence.",
  },
  {
    q: "What is the Partner tier about?",
    a: "We build your site or system, then spend 12 months teaching you to manage and maintain it yourself. The goal isn't dependency — it's full capability. By month 12, you own it completely.",
  },
  {
    q: "Who is Nullshift for?",
    a: "Individuals and businesses who know AI tools matter but haven't had the support to use them properly. Whether you're starting out or scaling up, we meet you where you are and give you the skills to move forward.",
  },
];

export default function PricingPage() {
  return (
    <>
      <Nav />
      <main>
        {/* Hero */}
        <section className="pt-28 pb-20 px-8 md:px-16" style={{
          backgroundImage: `radial-gradient(ellipse 55% 50% at 55% 40%, color-mix(in oklab, ${T.primary} 6%, transparent) 0%, transparent 70%)`,
        }}>
          <div className="flex items-center gap-3 mb-6" style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: T.primary }}>
            <span className="size-1.5 rounded-full pulse-dot" style={{ background: T.primary }} />
            <span>SYS_04 / PRICING</span>
          </div>
          <h1 style={{ fontFamily: T.display, fontWeight: 900, fontSize: "clamp(3.5rem,9vw,9rem)", lineHeight: 0.92, letterSpacing: "-0.01em", color: T.fg }}>
            TOOLS EXIST.<br /><span className="hero-glow" style={{ color: T.primary }}>TRAINING DOESN'T.</span>
          </h1>
          <p className="mt-6 max-w-[52ch]" style={{ fontFamily: T.sans, fontSize: "1.05rem", lineHeight: 1.75, color: T.muted }}>
            AI has created the most powerful productivity tools in history. Most people have no idea how to use them. We fix that — with structured learning, real support, and a goal of genuine independence.
          </p>
        </section>

        {/* USP strip */}
        <section style={{ borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`, background: T.surface }}>
          <div className="grid md:grid-cols-3" style={{ borderLeft: `1px solid ${T.border}` }}>
            {[
              { label: "PRODUCTIVITY", body: "Give individuals and businesses the tools and knowledge to work faster, smarter, and more independently." },
              { label: "UPSKILLING", body: "Occupational mobility matters more than ever. We build capability that stays with you through rapidly changing workflows." },
              { label: "INDEPENDENCE", body: "We're not building dependency. We're building the skills, systems, and confidence for you to operate fully on your own." },
            ].map((item, i) => (
              <Reveal key={item.label} delay={i * 0.08}>
                <div className="px-10 py-8 md:px-12" style={{ borderRight: `1px solid ${T.border}` }}>
                  <div className="mb-3" style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.14em", color: T.primary }}>{item.label}</div>
                  <p style={{ fontFamily: T.sans, fontSize: "0.875rem", lineHeight: 1.7, color: T.muted }}>{item.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Pricing cards */}
        <section className="px-8 md:px-16 py-20" style={{ borderTop: `1px solid ${T.border}` }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {tiers.map((tier) => (
              <PricingCard key={tier.tier} {...tier} />
            ))}
          </div>
          <p className="mt-6 text-center" style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: `${T.muted}88` }}>
            ALL_PRICES_GBP / BILLED_MONTHLY / CANCEL_ANYTIME_EXCEPT_PARTNER_TIER
          </p>
        </section>

        {/* FAQ strip */}
        <section style={{ borderTop: `1px solid ${T.border}` }}>
          <div className="px-10 md:px-16 pt-16 pb-10">
            <Reveal>
              <h2 style={{ fontFamily: T.display, fontWeight: 900, fontSize: "clamp(2rem,4vw,3.5rem)", lineHeight: 0.95, color: T.fg }}>
                COMMON <span style={{ color: T.muted }}>QUESTIONS.</span>
              </h2>
            </Reveal>
          </div>
          <div className="grid md:grid-cols-2" style={{ borderTop: `1px solid ${T.border}`, borderLeft: `1px solid ${T.border}` }}>
            {faqs.map((f, i) => (
              <Reveal key={i} delay={i * 0.08}>
                <div className="p-10 md:p-12" style={{ borderRight: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}` }}>
                  <h3 className="mb-4" style={{ fontFamily: T.display, fontWeight: 900, fontSize: "1.2rem", letterSpacing: "0.01em", color: T.fg }}>{f.q}</h3>
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
              <h2 style={{ fontFamily: T.display, fontWeight: 900, fontSize: "clamp(2rem,4vw,3.5rem)", lineHeight: 0.95, letterSpacing: "-0.01em", color: T.fg }}>
                NOT SURE WHERE<br />TO START?
              </h2>
              <p className="mt-3" style={{ fontFamily: T.sans, fontSize: "0.9rem", color: T.muted }}>Book a free call — we&apos;ll work out the right tier for where you are now.</p>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <Link href="/book" className="inline-flex items-center gap-3 px-6 h-12 font-semibold transition-opacity hover:opacity-90"
              style={{ fontFamily: T.mono, fontSize: "0.8rem", letterSpacing: "0.06em", background: T.primary, color: T.primaryFg, borderRadius: "2px", boxShadow: `0 0 24px color-mix(in oklab, ${T.primary} 30%, transparent)`, whiteSpace: "nowrap" }}>
              Book a free call →
            </Link>
          </Reveal>
        </section>
      </main>
      <Footer />
    </>
  );
}
