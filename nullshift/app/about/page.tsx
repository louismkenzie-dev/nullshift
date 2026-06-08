"use client";

import React from "react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import { T } from "@/lib/tokens";
import Link from "next/link";

/* ── Halo eyebrow (dot + ring + label-sm) ─────── */
function Eyebrow({ children, tone = T.primary }: { children: React.ReactNode; tone?: string }) {
  return (
    <span className="inline-flex items-center gap-2" style={{ fontFamily: T.sans, fontSize: "0.75rem", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: T.muted }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: tone, boxShadow: `0 0 0 4px ${tone}20`, flexShrink: 0, display: "inline-block" }} />
      {children}
    </span>
  );
}

function PageHero() {
  return (
    <section className="pt-32 pb-0 px-8 md:px-16 min-h-[55vh] flex flex-col justify-end" style={{
      background: `${T.bg}`,
      backgroundImage: `radial-gradient(ellipse 60% 50% at 70% 40%, color-mix(in oklab, ${T.primary} 6%, transparent) 0%, transparent 70%)`,
    }}>
      <div className="max-w-5xl pb-20">
        <div className="mb-7"><Eyebrow>About us</Eyebrow></div>
        <h1 style={{ fontFamily: T.display, fontWeight: 600, fontSize: "clamp(3rem,9vw,7.5rem)", lineHeight: 1.04, letterSpacing: "-0.03em", color: T.fg }}>
          We build the web<br />
          <span className="hero-glow" style={{ color: T.primary }}>your business owns.</span>
        </h1>
        <p className="mt-8 max-w-[46ch]" style={{ fontFamily: T.sans, fontSize: "1.0625rem", lineHeight: 1.65, letterSpacing: "-0.005em", color: T.muted }}>
          No Wix. No templates. No monthly ransom. Just bespoke code your business keeps forever.
        </p>
      </div>
    </section>
  );
}

function TheProblem() {
  return (
    <section style={{ borderTop: `1px solid ${T.border}` }}>
      <div className="grid md:grid-cols-2" style={{ borderLeft: `1px solid ${T.border}` }}>
        {/* Left — The Wix trap */}
        <div className="p-10 md:p-16" style={{ borderRight: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}` }}>
          <Reveal>
            <div className="mb-8"><Eyebrow tone={T.danger}>The Wix trap</Eyebrow></div>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="mb-8" style={{ fontFamily: T.display, fontWeight: 600, fontSize: "clamp(1.875rem,3.5vw,2.75rem)", lineHeight: 1.08, letterSpacing: "-0.025em", color: T.fg }}>
              You&apos;re renting,<br /><span style={{ color: T.danger }}>not owning.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.2}>
            <div className="flex flex-col gap-1">
              {[
                { label: "Monthly platform fees", value: "$25–$300/mo forever" },
                { label: "Transaction fees on sales", value: "Up to 3% per sale" },
                { label: "App/plugin royalties", value: "$10–$80/mo per plugin" },
                { label: "You own nothing", value: "Switch platforms? Start over." },
                { label: "Generic templates", value: "Looks like everyone else" },
              ].map(item => (
                <div key={item.label} className="flex items-start justify-between gap-4 py-3.5" style={{ borderBottom: `1px solid ${T.border}` }}>
                  <span style={{ fontFamily: T.sans, fontSize: "0.9375rem", letterSpacing: "-0.005em", color: T.muted }}>{item.label}</span>
                  <span style={{ fontFamily: T.mono, fontSize: "0.8125rem", color: T.danger, whiteSpace: "nowrap" }}>{item.value}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>

        {/* Right — The Nullshift way */}
        <div className="p-10 md:p-16" style={{ borderBottom: `1px solid ${T.border}` }}>
          <Reveal>
            <div className="mb-8"><Eyebrow>The Nullshift way</Eyebrow></div>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="mb-8" style={{ fontFamily: T.display, fontWeight: 600, fontSize: "clamp(1.875rem,3.5vw,2.75rem)", lineHeight: 1.08, letterSpacing: "-0.025em", color: T.fg }}>
              Your site.<br /><span className="hero-glow" style={{ color: T.primary }}>Your code.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.2}>
            <div className="flex flex-col gap-1">
              {[
                { label: "One-time build cost", value: "Fixed quote, no surprises" },
                { label: "Zero platform fees", value: "You own the code outright" },
                { label: "No plugin dependencies", value: "Built exactly as you need" },
                { label: "Full code ownership", value: "Move hosts anytime, freely" },
                { label: "100% bespoke design", value: "Unique to your brand" },
              ].map(item => (
                <div key={item.label} className="flex items-start justify-between gap-4 py-3.5" style={{ borderBottom: `1px solid ${T.border}` }}>
                  <span style={{ fontFamily: T.sans, fontSize: "0.9375rem", letterSpacing: "-0.005em", color: T.muted }}>{item.label}</span>
                  <span style={{ fontFamily: T.mono, fontSize: "0.8125rem", color: T.primary, whiteSpace: "nowrap" }}>{item.value}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function HowWeBuild() {
  return (
    <section className="px-10 md:px-16 py-24" style={{ borderTop: `1px solid ${T.border}`, background: T.surface }}>
      <Reveal>
        <div className="mb-12"><Eyebrow>How we build</Eyebrow></div>
      </Reveal>
      <div className="grid md:grid-cols-2 gap-16 items-start">
        <Reveal delay={0.1}>
          <h2 style={{ fontFamily: T.display, fontWeight: 600, fontSize: "clamp(2.25rem,5vw,4rem)", lineHeight: 1.04, letterSpacing: "-0.03em", color: T.fg }}>
            Precision code.<br /><span style={{ color: T.primary }}>Fast delivery.</span>
          </h2>
        </Reveal>
        <Reveal delay={0.2}>
          <div className="flex flex-col gap-6">
            <p style={{ fontFamily: T.sans, fontSize: "0.9375rem", lineHeight: 1.65, letterSpacing: "-0.005em", color: T.muted }}>
              Every line of code in your site is written with purpose. We don&apos;t use drag-and-drop builders, generic theme frameworks, or off-the-shelf templates — because your business isn&apos;t generic.
            </p>
            <p style={{ fontFamily: T.sans, fontSize: "0.9375rem", lineHeight: 1.65, letterSpacing: "-0.005em", color: T.muted }}>
              Our development process combines modern engineering practices with precision tooling — allowing us to build at a pace that traditional agencies simply can&apos;t match, without compromising on quality or code integrity.
            </p>
            <p style={{ fontFamily: T.sans, fontSize: "0.9375rem", lineHeight: 1.65, letterSpacing: "-0.005em", color: T.muted }}>
              The result: a website that&apos;s faster, cheaper to maintain, and built exactly to your specification — with zero platform dependency and no lock-in whatsoever.
            </p>
            <div className="pt-2"><Eyebrow>Bespoke code · No builders · Your ownership</Eyebrow></div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Founder() {
  const tags = ["Full-Stack Development", "Brand Creation", "Front-End Design", "Back-End Function", "Photo / Video", "AI Optimisation"];
  return (
    <section style={{ borderTop: `1px solid ${T.border}`, background: T.surface }}>
      <div className="grid md:grid-cols-2">
        {/* Photo */}
        <Reveal className="relative" >
          <div className="relative h-full min-h-[420px] md:min-h-[600px]" style={{ borderBottom: `1px solid ${T.border}` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/louis-mckenzie.jpg"
              alt="Louis McKenzie — Lead Developer & Founder of Nullshift"
              className="absolute inset-0 w-full h-full object-cover"
              style={{ objectPosition: "center 25%" }}
            />
            {/* Brand wash + grain so the photo sits in the dark palette */}
            <div className="absolute inset-0 pointer-events-none" style={{
              background: `linear-gradient(to top, ${T.bg} 0%, transparent 45%), linear-gradient(to right, transparent 60%, color-mix(in oklab, ${T.bg} 70%, transparent) 100%)`,
            }} />
            {/* Name plate */}
            <div className="absolute bottom-0 left-0 p-6 md:p-8">
              <div className="mb-3"><Eyebrow>Founder · Lead developer</Eyebrow></div>
              <div style={{ fontFamily: T.display, fontWeight: 600, fontSize: "clamp(1.75rem,3vw,2.5rem)", letterSpacing: "-0.02em", color: T.fg }}>
                Louis McKenzie
              </div>
            </div>
          </div>
        </Reveal>

        {/* Bio */}
        <div className="p-10 md:p-16 flex flex-col justify-center" style={{ borderBottom: `1px solid ${T.border}` }}>
          <Reveal>
            <div className="mb-8"><Eyebrow>Who builds it</Eyebrow></div>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="mb-6" style={{ fontFamily: T.display, fontWeight: 600, fontSize: "clamp(2rem,4vw,3rem)", lineHeight: 1.04, letterSpacing: "-0.03em", color: T.fg }}>
              Meet the <span style={{ color: T.primary }}>maker.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="flex flex-col gap-5" style={{ fontFamily: T.sans, fontSize: "0.9375rem", lineHeight: 1.65, letterSpacing: "-0.005em", color: T.muted, maxWidth: "52ch" }}>
              <p>
                Nullshift is led by <span style={{ color: T.fg }}>Louis McKenzie</span> — a Newcastle University student with a rich background in brand creation and site development.
              </p>
              <p>
                With a creative eye, Louis has worked with many brands to shoot video and photography for seamless, polished output — and has since made the switch to building full digital presences end to end.
              </p>
              <p>
                He&apos;s a <span style={{ color: T.fg }}>full-stack developer</span> who takes care of both the front-end design and the back-end function — so your project is handled, start to finish, by one person who genuinely cares how it looks and how it works.
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.15}>
            <div className="flex flex-wrap gap-2 mt-8">
              {tags.map(tag => (
                <span key={tag} className="inline-flex items-center"
                  style={{ fontFamily: T.mono, fontWeight: 500, fontSize: "0.75rem", letterSpacing: "0em", height: 28, paddingInline: 12, background: `${T.primary}14`, color: T.primary, borderRadius: "999px", border: `1px solid ${T.primary}30` }}>
                  {tag}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function Commitment() {
  const stats = [
    { value: "100%", label: "Custom code", sub: "Every project written from scratch, no templates used." },
    { value: "Yours", label: "You own everything", sub: "Full code ownership from day one. No platform lock-in." },
    { value: "£0", label: "Ongoing platform fees", sub: "No monthly subscriptions. No per-sale royalties. Ever." },
  ];
  return (
    <section style={{ borderTop: `1px solid ${T.border}` }}>
      <div className="px-10 md:px-16 pt-20 pb-12">
        <Reveal>
          <h2 style={{ fontFamily: T.display, fontWeight: 600, fontSize: "clamp(2.25rem,5vw,4rem)", lineHeight: 1.04, letterSpacing: "-0.03em", color: T.fg }}>
            Our <span style={{ color: T.primary }}>commitment.</span>
          </h2>
        </Reveal>
      </div>
      <div className="grid md:grid-cols-3" style={{ borderTop: `1px solid ${T.border}`, borderLeft: `1px solid ${T.border}` }}>
        {stats.map((s, i) => (
          <Reveal key={s.label} delay={i * 0.1}>
            <div className="p-10 md:p-14" style={{ borderRight: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}` }}>
              <div className="mb-4 hero-glow" style={{ fontFamily: T.mono, fontWeight: 600, fontSize: "3rem", lineHeight: 1, letterSpacing: "-0.02em", color: T.primary }}>{s.value}</div>
              <h3 className="mb-3" style={{ fontFamily: T.display, fontWeight: 600, fontSize: "1.25rem", letterSpacing: "-0.015em", color: T.fg }}>{s.label}</h3>
              <p style={{ fontFamily: T.sans, fontSize: "0.9375rem", lineHeight: 1.55, letterSpacing: "-0.005em", color: T.muted }}>{s.sub}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function CtaStrip() {
  return (
    <section className="px-10 md:px-16 py-24 flex flex-col md:flex-row items-start md:items-center justify-between gap-8" style={{ borderTop: `1px solid ${T.border}`, background: T.surface }}>
      <Reveal>
        <h2 style={{ fontFamily: T.display, fontWeight: 600, fontSize: "clamp(2rem,4vw,3.25rem)", lineHeight: 1.04, letterSpacing: "-0.03em", color: T.fg }}>
          Ready to own your<br /><span style={{ color: T.primary }}>online presence?</span>
        </h2>
      </Reveal>
      <Reveal delay={0.1}>
        <Link href="/book"
          className="inline-flex items-center gap-2 font-medium transition-opacity hover:opacity-90"
          style={{ fontFamily: T.sans, fontSize: "0.9375rem", fontWeight: 500, letterSpacing: "-0.005em", height: 48, paddingInline: 24, background: T.primary, color: T.primaryFg, borderRadius: "10px", boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18), 0 0 28px ${T.primary}35`, whiteSpace: "nowrap" }}>
          Book a discovery call →
        </Link>
      </Reveal>
    </section>
  );
}

export default function AboutPage() {
  return (
    <>
      <Nav />
      <main>
        <PageHero />
        <TheProblem />
        <HowWeBuild />
        <Founder />
        <Commitment />
        <CtaStrip />
      </main>
      <Footer />
    </>
  );
}
