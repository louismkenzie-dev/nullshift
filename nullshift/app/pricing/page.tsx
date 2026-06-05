"use client";

import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import { T } from "@/lib/tokens";
import Link from "next/link";

const tiers = [
  {
    id: "STARTER",
    price: "From £1,500",
    tagline: "For businesses going online for the first time.",
    features: [
      "Up to 5 pages",
      "Mobile-first responsive design",
      "Custom design (no templates)",
      "Contact form",
      "Basic SEO setup",
      "Domain & hosting guidance",
      "2 rounds of revisions",
      "30-day post-launch support",
    ],
    cta: "Get a quote",
    highlight: false,
  },
  {
    id: "STANDARD",
    price: "From £3,500",
    tagline: "For businesses ready to grow their online presence.",
    features: [
      "Up to 12 pages",
      "Advanced UI/UX design",
      "CMS integration (blog, products)",
      "Contact & booking forms",
      "Advanced SEO & performance",
      "Analytics setup",
      "3 rounds of revisions",
      "60-day post-launch support",
    ],
    cta: "Get a quote",
    highlight: true,
  },
  {
    id: "PREMIUM",
    price: "From £7,500",
    tagline: "For established businesses with complex requirements.",
    features: [
      "Unlimited pages",
      "E-commerce / booking systems",
      "Custom integrations & APIs",
      "Full brand identity included",
      "Performance optimisation",
      "Monthly maintenance plan",
      "Unlimited revisions",
      "Ongoing support included",
    ],
    cta: "Get a quote",
    highlight: false,
  },
];

const faqs = [
  { q: "What's included in the price?", a: "Every quote includes design, development, testing, and deployment. We scope everything upfront so you know exactly what you're getting before we start." },
  { q: "Do you offer payment plans?", a: "Yes. We typically work on a 50% deposit / 50% on completion model. For larger projects, staged payments can be arranged — just ask when we speak." },
  { q: "What if I need changes after launch?", a: "All plans include a post-launch support window. After that, we offer affordable ongoing maintenance packages, or you can manage changes yourself — it's your code." },
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
            TRANSPARENT<br /><span className="hero-glow" style={{ color: T.primary }}>PRICING.</span>
          </h1>
          <p className="mt-6 max-w-[44ch]" style={{ fontFamily: T.sans, fontSize: "1.05rem", lineHeight: 1.75, color: T.muted }}>
            Fixed quotes. No hidden fees. Everything scoped before we start. All prices are estimates — your final quote is confirmed after a discovery call.
          </p>
        </section>

        {/* Tiers */}
        <section style={{ borderTop: `1px solid ${T.border}` }}>
          <div className="grid md:grid-cols-3" style={{ borderLeft: `1px solid ${T.border}` }}>
            {tiers.map((tier, i) => (
              <Reveal key={tier.id} delay={i * 0.08}>
                <div className="relative flex flex-col p-10 md:p-12 gap-6" style={{
                  borderRight: `1px solid ${T.border}`,
                  borderBottom: `1px solid ${T.border}`,
                  background: tier.highlight ? T.surface : "transparent",
                  outline: tier.highlight ? `1px solid ${T.primary}55` : "none",
                }}>
                  {tier.highlight && (
                    <div className="absolute top-0 left-0 right-0 h-px" style={{ background: T.primary, boxShadow: `0 0 8px ${T.primary}` }} />
                  )}
                  {tier.highlight && (
                    <span style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: T.primaryFg, background: T.primary, padding: "3px 10px", borderRadius: "2px", alignSelf: "flex-start" }}>
                      MOST POPULAR
                    </span>
                  )}
                  <div>
                    <div style={{ fontFamily: T.mono, fontWeight: 600, fontSize: "0.75rem", letterSpacing: "0.1em", color: T.muted, marginBottom: "8px" }}>{tier.id}</div>
                    <div className="hero-glow" style={{ fontFamily: T.display, fontWeight: 900, fontSize: "clamp(2rem,3.5vw,3rem)", lineHeight: 1, letterSpacing: "-0.01em", color: tier.highlight ? T.primary : T.fg }}>{tier.price}</div>
                    <p className="mt-3" style={{ fontFamily: T.sans, fontSize: "0.875rem", lineHeight: 1.6, color: T.muted }}>{tier.tagline}</p>
                  </div>
                  <div className="w-full h-px" style={{ background: T.border }} />
                  <ul className="flex flex-col gap-3">
                    {tier.features.map(f => (
                      <li key={f} className="flex items-start gap-3">
                        <span style={{ color: T.primary, fontSize: "0.7rem", marginTop: "3px", flexShrink: 0 }}>✓</span>
                        <span style={{ fontFamily: T.sans, fontSize: "0.875rem", color: T.muted }}>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto pt-4">
                    <Link href="/book" className="w-full flex items-center justify-between px-5 h-11 font-semibold transition-opacity hover:opacity-90"
                      style={{ fontFamily: T.mono, fontSize: "0.75rem", letterSpacing: "0.06em", background: tier.highlight ? T.primary : "transparent", color: tier.highlight ? T.primaryFg : T.fg, borderRadius: "2px", border: tier.highlight ? "none" : `1px solid ${T.border}`, boxShadow: tier.highlight ? `0 0 20px color-mix(in oklab, ${T.primary} 25%, transparent)` : "none" }}>
                      <span>{tier.cta}</span><span>→</span>
                    </Link>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal>
            <p className="px-10 py-4 text-center" style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: `${T.muted}88`, borderTop: `1px solid ${T.border}` }}>
              ALL_PRICES_GBP / ESTIMATES_ONLY / FINAL_QUOTE_AFTER_DISCOVERY_CALL
            </p>
          </Reveal>
        </section>

        {/* Quote calculator placeholder */}
        <section className="px-10 md:px-16 py-20" style={{ borderTop: `1px solid ${T.border}`, background: T.surface }}>
          <Reveal>
            <div className="flex items-center gap-3 mb-8" style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: T.primary }}>
              <span>INTERACTIVE_QUOTE_BUILDER</span>
              <span className="h-px w-8" style={{ background: `${T.primary}55` }} />
              <span style={{ color: T.muted }}>COMING_SOON</span>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="max-w-2xl p-8 md:p-12 relative overflow-hidden" style={{ border: `1px solid ${T.border}`, borderRadius: "4px" }}>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span style={{ fontFamily: T.display, fontWeight: 900, fontSize: "clamp(3rem,8vw,6rem)", letterSpacing: "0.02em", color: `${T.border}55`, textTransform: "uppercase" }}>COMING SOON</span>
              </div>
              <div className="relative z-10 flex flex-col gap-4 opacity-40">
                <h3 style={{ fontFamily: T.display, fontWeight: 900, fontSize: "1.6rem", color: T.fg }}>BUILD YOUR ESTIMATE</h3>
                <p style={{ fontFamily: T.sans, fontSize: "0.875rem", color: T.muted }}>Soon you&apos;ll be able to get an instant ballpark estimate by answering a few questions about your project.</p>
                <div className="grid grid-cols-2 gap-3 pt-2">
                  {["Page count", "Project type", "CMS required", "E-commerce", "Branding included", "Timeline"].map(field => (
                    <div key={field} className="px-4 py-3" style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: "2px" }}>
                      <span style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: T.muted }}>{field}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        {/* FAQ strip */}
        <section style={{ borderTop: `1px solid ${T.border}` }}>
          <div className="px-10 md:px-16 pt-16 pb-10">
            <Reveal><h2 style={{ fontFamily: T.display, fontWeight: 900, fontSize: "clamp(2rem,4vw,3.5rem)", lineHeight: 0.95, color: T.fg }}>COMMON <span style={{ color: T.muted }}>QUESTIONS.</span></h2></Reveal>
          </div>
          <div className="grid md:grid-cols-3" style={{ borderTop: `1px solid ${T.border}`, borderLeft: `1px solid ${T.border}` }}>
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
                NOT SURE WHICH TIER?
              </h2>
              <p className="mt-3" style={{ fontFamily: T.sans, fontSize: "0.9rem", color: T.muted }}>Book a call and we&apos;ll scope it together.</p>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <Link href="/book" className="inline-flex items-center gap-3 px-6 h-12 font-semibold transition-opacity hover:opacity-90"
              style={{ fontFamily: T.mono, fontSize: "0.8rem", letterSpacing: "0.06em", background: T.primary, color: T.primaryFg, borderRadius: "2px", boxShadow: `0 0 24px color-mix(in oklab, ${T.primary} 30%, transparent)`, whiteSpace: "nowrap" }}>
              Book a discovery call →
            </Link>
          </Reveal>
        </section>
      </main>
      <Footer />
    </>
  );
}
