"use client";

import React from "react";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import HeroText from "@/components/HeroText";
import { T } from "@/lib/tokens";

/* ── Section label (Halo eyebrow) ───────────── */
function Label({ children }: { children: React.ReactNode }) {
  return (
    <Reveal>
      <div className="flex items-center gap-2 mb-8">
        <span
          className="inline-flex items-center gap-2"
          style={{ fontFamily: T.sans, fontSize: "0.75rem", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: T.muted }}
        >
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.primary, boxShadow: `0 0 0 4px ${T.primary}20`, flexShrink: 0, display: "inline-block" }} />
          {children}
        </span>
      </div>
    </Reveal>
  );
}

/* ── Primary button (Halo btn-primary) ──────── */
function PrimaryBtn({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="inline-flex items-center gap-2 font-medium transition-opacity hover:opacity-90"
      style={{
        fontFamily: T.sans, fontSize: "0.875rem", fontWeight: 500, letterSpacing: "-0.005em",
        height: 40, paddingInline: 18,
        background: T.primary, color: T.primaryFg,
        borderRadius: "10px",
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18), 0 0 20px ${T.primary}30`,
        textDecoration: "none",
      }}>
      {children}
    </a>
  );
}

/* ── HERO ───────────────────────────────────── */
/* ── SERVICES ───────────────────────────────── */
function Services() {
  const cards = [
    { num: "01", title: "Web Design & Development", desc: "From strategy to launch, we design and build fast, beautiful websites that convert visitors into customers. Every pixel considered. Every line of code clean.", tag: "CUSTOM_BUILD / NO_TEMPLATES" },
    { num: "02", title: "Branding & Identity", desc: "Logos, colour systems, and visual identity built for businesses ready to show up professionally online. We make sure your brand is unforgettable from the first glance.", tag: "IDENTITY_SYSTEMS / SCALABLE" },
  ];
  return (
    <section id="services" style={{ borderTop: `1px solid ${T.border}` }}>
      <div className="grid md:grid-cols-[300px_1fr] h-full">
        <div className="p-8 md:p-10 flex flex-col justify-between gap-8" style={{ borderBottom: `1px solid ${T.border}` }}>
          <div>
            <Label>02 — Services</Label>
            <Reveal delay={0.1}>
              <h2 style={{ fontFamily: T.display, fontWeight: 600, fontSize: "clamp(2.2rem,4.5vw,4rem)", lineHeight: 1.04, letterSpacing: "-0.03em", color: T.fg }}>
                What we<br /><span style={{ color: T.muted }}>do.</span>
              </h2>
            </Reveal>
          </div>
          <Reveal delay={0.2}><PrimaryBtn href="/about">About us →</PrimaryBtn></Reveal>
        </div>
        <div className="grid grid-rows-1 md:grid-rows-2 h-full" style={{ borderLeft: `1px solid ${T.border}` }}>
          {cards.map((card, i) => (
            <article key={card.num} className="group relative p-8 md:p-10 grid grid-cols-[48px_1fr] gap-5 content-center"
              style={{ borderBottom: i === 0 ? `1px solid ${T.border}` : "none", transition: `background ${T.ease} 150ms, border-color 150ms` }}
              onMouseEnter={e => (e.currentTarget.style.background = T.surface2)}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
              <span className="absolute top-0 left-0 h-px" style={{ width: 0, background: T.primary, transition: "width 500ms cubic-bezier(.2,.8,.2,1)" }}
                ref={el => { if (!el) return; const art = el.parentElement!; art.addEventListener("mouseenter", () => { el.style.width = "100%"; }); art.addEventListener("mouseleave", () => { el.style.width = "0"; }); }} />
              <div style={{ fontFamily: T.mono, fontWeight: 600, fontSize: "1.5rem", lineHeight: 1, color: `${T.primary}38`, paddingTop: "3px" }}>{card.num}</div>
              <div className="flex flex-col gap-3">
                <h3 style={{ fontFamily: T.display, fontWeight: 600, fontSize: "clamp(1.125rem,2vw,1.5rem)", letterSpacing: "-0.015em", lineHeight: 1.2, color: T.fg }}>{card.title}</h3>
                <p style={{ fontFamily: T.sans, fontWeight: 400, fontSize: "0.9375rem", lineHeight: 1.55, letterSpacing: "-0.005em", color: T.muted, maxWidth: "46ch" }}>{card.desc}</p>
                <span className="flex items-center gap-2 mt-1" style={{ fontFamily: T.mono, fontSize: "0.75rem", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: T.primary }}>
                  <span style={{ height: 1, width: 12, background: `${T.primary}70`, flexShrink: 0, display: "inline-block" }} />{card.tag}
                </span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── WHO WE HELP ────────────────────────────── */
function WhoWeHelp() {
  const tags = ["Retail", "Hospitality", "Trades", "Professional Services", "Health & Wellness"];
  return (
    <section id="clients" className="px-8 md:px-12 py-10 grid md:grid-cols-2 gap-12 md:gap-20 items-center h-full" style={{ borderTop: `1px solid ${T.border}`, background: T.surface }}>
      <div>
        <Label>03 — Clients</Label>
        <Reveal delay={0.1}>
          <h2 className="mb-7" style={{ fontFamily: T.display, fontWeight: 600, fontSize: "clamp(2.2rem,5.5vw,4.5rem)", lineHeight: 1.04, letterSpacing: "-0.03em", color: T.fg }}>
            Built for<br /><span style={{ color: T.muted }}>businesses</span><br /><span style={{ color: T.primary }}>doing the work.</span>
          </h2>
        </Reveal>
        <Reveal delay={0.2}><PrimaryBtn href="/systems-lab">What we create →</PrimaryBtn></Reveal>
      </div>
      <div className="flex flex-col gap-9">
        <Reveal delay={0.2}><p style={{ fontFamily: T.sans, fontWeight: 400, fontSize: "0.9375rem", lineHeight: 1.55, letterSpacing: "-0.005em", color: T.muted, maxWidth: "46ch" }}>We build more than websites. From bespoke booking systems and automated email campaigns to interactive courses and custom business workflows, we create digital solutions tailored to your brand that save time, improve customer experiences, and help your business grow.</p></Reveal>
        <Reveal delay={0.3}>
          <div className="flex flex-wrap gap-2">
            {tags.map(tag => (
              <span key={tag} className="inline-flex items-center cursor-default transition-colors"
                style={{ fontFamily: T.mono, fontWeight: 500, fontSize: "0.75rem", letterSpacing: "0em", height: 28, paddingInline: 12, background: `${T.primary}14`, color: T.primary, borderRadius: "999px", border: `1px solid ${T.primary}30`, transition: "background 150ms, border-color 150ms" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${T.primary}22`; (e.currentTarget as HTMLElement).style.borderColor = `${T.primary}55`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `${T.primary}14`; (e.currentTarget as HTMLElement).style.borderColor = `${T.primary}30`; }}>
                {tag}
              </span>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── PROCESS ────────────────────────────────── */
function Process() {
  const steps = [
    { num: "001", title: "Discovery", desc: "We learn your business, your goals, and your customers. No assumptions — just honest conversation." },
    { num: "002", title: "Design", desc: "A bespoke visual direction built around your brand. We present options, you give feedback, we refine." },
    { num: "003", title: "Build", desc: "Fast, clean code. Mobile-first. No templates, no page builders — a real website crafted for you." },
    { num: "004", title: "Launch", desc: "We handle hosting, domain, deployment. You just go live — with ongoing support whenever you need us." },
  ];
  return (
    <section id="process" className="flex flex-col h-full" style={{ borderTop: `1px solid ${T.border}` }}>
      <div className="px-8 md:px-12 pt-10 pb-8 flex flex-col md:flex-row items-start md:items-end justify-between gap-6 shrink-0">
        <div>
          <Label>04 — How it works</Label>
          <Reveal delay={0.1}><h2 style={{ fontFamily: T.display, fontWeight: 600, fontSize: "clamp(2.2rem,4.5vw,4rem)", lineHeight: 1.04, letterSpacing: "-0.03em", color: T.fg }}>The <span style={{ color: T.muted }}>process.</span></h2></Reveal>
        </div>
        <Reveal delay={0.2}><p style={{ fontFamily: T.sans, fontSize: "0.9375rem", lineHeight: 1.55, letterSpacing: "-0.005em", color: T.muted, maxWidth: "36ch" }}>A clear, four-step process to get your business online with minimal friction.</p></Reveal>
      </div>
      <Reveal delay={0.1} className="flex-1 min-h-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 h-full" style={{ borderTop: `1px solid ${T.border}`, borderLeft: `1px solid ${T.border}` }}>
          {steps.map(step => (
            <article key={step.num} className="group relative flex flex-col justify-center gap-4 p-8 md:p-10" style={{ borderRight: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`, transition: `background 150ms` }}
              onMouseEnter={e => (e.currentTarget.style.background = T.surface2)}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
              <span className="absolute bottom-0 left-0 h-px" style={{ width: 0, background: T.primary, transition: "width 500ms cubic-bezier(.2,.8,.2,1)" }}
                ref={el => { if (!el) return; const art = el.parentElement!; art.addEventListener("mouseenter", () => { el.style.width = "100%"; }); art.addEventListener("mouseleave", () => { el.style.width = "0"; }); }} />
              <div style={{ fontFamily: T.mono, fontWeight: 600, fontSize: "2rem", lineHeight: 1, color: `${T.primary}25` }}>{step.num}</div>
              <h3 style={{ fontFamily: T.display, fontWeight: 600, fontSize: "clamp(1.125rem,1.6vw,1.5rem)", letterSpacing: "-0.015em", lineHeight: 1.2, color: T.fg }}>{step.title}</h3>
              <div className="w-5 h-px" style={{ background: T.border }} />
              <p style={{ fontFamily: T.sans, fontSize: "0.9rem", lineHeight: 1.55, letterSpacing: "-0.003em", color: T.muted }}>{step.desc}</p>
            </article>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

/* ── WHY NULLSHIFT ──────────────────────────── */
function WhyNullshift() {
  const props = [
    { n: "01", title: "Fast turnaround", desc: "Most projects delivered in 2–4 weeks. We move quickly because your time matters as much as ours." },
    { n: "02", title: "Fixed pricing", desc: "You'll know exactly what you're paying before we start. No hidden fees. No surprise invoices." },
    { n: "03", title: "Ongoing support", desc: "We don't disappear after launch. Updates, changes, questions — we're always available." },
  ];
  return (
    <section id="why" className="relative overflow-hidden w-full h-full" style={{ borderTop: `1px solid ${T.border}`, background: T.surface }}>
      <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse 60% 50% at 50% 50%, color-mix(in oklab, ${T.primary} 6%, transparent) 0%, transparent 70%)` }} />
      <div className="relative z-10 h-full px-8 md:px-12 py-10 flex flex-col items-center justify-center text-center">
        <Reveal>
          <div className="flex items-center justify-center gap-2 mb-10">
            <span className="inline-flex items-center gap-2" style={{ fontFamily: T.sans, fontSize: "0.75rem", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: T.muted }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.primary, boxShadow: `0 0 0 4px ${T.primary}20`, flexShrink: 0, display: "inline-block" }} />
              05 — Why us
            </span>
          </div>
        </Reveal>
        <Reveal delay={0.08}>
          <div className="text-center mb-12" style={{ fontFamily: T.display, fontWeight: 600, fontSize: "clamp(2.5rem,6vw,5.5rem)", lineHeight: 1.04, letterSpacing: "-0.03em" }}>
            <span className="block" style={{ color: T.fg }}>No templates.</span>
            <span className="block" style={{ color: T.muted }}>No bloat.</span>
            <span className="block hero-glow" style={{ color: T.primary }}>No nonsense.</span>
          </div>
        </Reveal>
        <Reveal delay={0.16}>
          <div className="grid md:grid-cols-3 w-full max-w-5xl" style={{ borderTop: `1px solid ${T.border}`, borderLeft: `1px solid ${T.border}` }}>
            {props.map(p => (
              <div key={p.n} className="p-8 text-left" style={{ borderRight: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}` }}>
                <div className="mb-4" style={{ fontFamily: T.mono, fontWeight: 600, fontSize: "1rem", letterSpacing: "-0.02em", color: `${T.primary}60` }}>{p.n}</div>
                <h3 className="mb-2" style={{ fontFamily: T.display, fontWeight: 600, fontSize: "1.125rem", letterSpacing: "-0.01em", lineHeight: 1.3, color: T.fg }}>{p.title}</h3>
                <p style={{ fontFamily: T.sans, fontSize: "0.9rem", lineHeight: 1.55, letterSpacing: "-0.003em", color: T.muted }}>{p.desc}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── CONTACT ────────────────────────────────── */
function Contact() {
  return (
    <section id="contact" className="h-full" style={{ borderTop: `1px solid ${T.border}` }}>
      <div className="grid md:grid-cols-2 h-full">
        <div className="p-8 md:px-12 md:py-10 flex flex-col justify-center gap-8" style={{ borderBottom: `1px solid ${T.border}` }}>
          <div>
            <Label>06 — Get in touch</Label>
            <Reveal delay={0.1}>
              <h2 className="mb-4" style={{ fontFamily: T.display, fontWeight: 600, fontSize: "clamp(2.2rem,4.5vw,4rem)", lineHeight: 1.04, letterSpacing: "-0.03em", color: T.fg }}>
                Ready to<br /><span className="hero-glow" style={{ color: T.primary }}>go online?</span>
              </h2>
            </Reveal>
            <Reveal delay={0.2}><p style={{ fontFamily: T.sans, fontSize: "0.9375rem", lineHeight: 1.55, letterSpacing: "-0.005em", color: T.muted, maxWidth: "40ch" }}>Tell us about your business and we&apos;ll be in touch within 24 hours. No commitment required.</p></Reveal>
          </div>
          <Reveal delay={0.3}>
            <div className="flex flex-col gap-3 pt-10" style={{ borderTop: `1px solid ${T.border}` }}>
              <div className="flex items-center gap-2.5" style={{ fontFamily: T.mono, fontSize: "0.75rem", fontWeight: 500, letterSpacing: "0.04em", color: T.muted }}>
                <span className="size-1.5 rounded-full pulse-dot flex-shrink-0" style={{ background: T.primary }} />Response within 24 hours
              </div>
              <div style={{ fontFamily: T.mono, fontSize: "0.75rem", letterSpacing: "0.04em", color: `${T.muted}88`, paddingLeft: "20px" }}>UK-based — Global reach</div>
            </div>
          </Reveal>
        </div>
        <div className="p-10 md:px-12 md:py-10 flex items-center justify-center" style={{ borderLeft: `1px solid ${T.border}` }}>
          <Reveal delay={0.2} className="w-full max-w-md">
            <div className="flex flex-col gap-6">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.primary, boxShadow: `0 0 0 4px ${T.primary}20`, flexShrink: 0, display: "inline-block" }} />
                  <span style={{ fontFamily: T.sans, fontSize: "0.75rem", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: T.muted }}>5-step brief</span>
                </div>
                <h3 className="mb-3" style={{ fontFamily: T.display, fontWeight: 600, fontSize: "1.75rem", lineHeight: 1.08, letterSpacing: "-0.025em", color: T.fg }}>
                  Tell us about<br />your project.
                </h3>
                <p style={{ fontFamily: T.sans, fontSize: "0.9375rem", lineHeight: 1.55, letterSpacing: "-0.005em", color: T.muted, maxWidth: "38ch" }}>
                  A quick 2-minute brief — pages, style, budget, timeline. We&apos;ll send back a clear proposal.
                </p>
              </div>
              <Link
                href="/book"
                className="inline-flex items-center justify-between font-medium transition-opacity hover:opacity-90"
                style={{ fontFamily: T.sans, fontSize: "0.875rem", fontWeight: 500, letterSpacing: "-0.005em", height: 48, paddingInline: 20, background: T.primary, color: T.primaryFg, borderRadius: "10px", boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18), 0 0 24px ${T.primary}30` }}
              >
                <span>Tell us more</span>
                <span>→</span>
              </Link>
              <div style={{ fontFamily: T.mono, fontSize: "0.75rem", fontWeight: 500, letterSpacing: "0.04em", color: `${T.muted}70` }}>
                ~2 min · no commitment
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* Uniform frosted-glass card — every card is the same size so that when one
   slides up and pins, it fully covers the identical card beneath it. */
function StackCard({ children, z }: { children: React.ReactNode; z: number }) {
  return (
    /* Sticky directly within <main> so each card pins centred and STAYS while
       the next card slides up and covers it. Higher z stacks over lower. */
    <div className="sticky-stick px-3 sm:px-5 md:px-8" style={{ zIndex: z }}>
      <div
        className="glass-card max-w-6xl mx-auto w-full overflow-hidden rounded-2xl"
        style={{
          height: "var(--card-h)",
          minHeight: "var(--card-h)",
          background: "rgba(10,10,14,0.94)",
          backdropFilter: "blur(20px) saturate(130%)",
          WebkitBackdropFilter: "blur(20px) saturate(130%)",
          border: `1px solid #3d3d42`,
          boxShadow: "0 0 0 1px rgba(255,255,255,0.03) inset, 0 50px 120px -16px rgba(0,0,0,0.9)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <>
      <Nav />
      {/* Hero stays full-bleed as the opening */}
      <div className="relative z-10">
        <HeroText />
      </div>

      {/* Uniform cards stack over one another. The first pins centred; each
          subsequent card slides up, covers it, then pins in its place. */}
      <main className="relative">
        <StackCard z={1}><Services /></StackCard>
        <StackCard z={2}><WhoWeHelp /></StackCard>
        <StackCard z={3}><Process /></StackCard>
        <StackCard z={4}><WhyNullshift /></StackCard>
        <StackCard z={5}><Contact /></StackCard>
      </main>

      {/* Systems Lab promo */}
      <div className="relative" style={{ zIndex: 6, marginTop: "12vh", borderTop: `1px solid ${T.border}`, background: T.surface, padding: "72px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }} className="md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-5">
              <span className="inline-flex items-center gap-2" style={{ fontFamily: T.sans, fontSize: "0.75rem", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: T.muted }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.primary, boxShadow: `0 0 0 4px ${T.primary}20`, flexShrink: 0, display: "inline-block" }} />
                New — Systems Lab
              </span>
            </div>
            <h2 style={{ fontFamily: T.display, fontWeight: 600, fontSize: "clamp(1.75rem,3.5vw,2.75rem)", lineHeight: 1.08, letterSpacing: "-0.025em", color: T.fg }}>
              Experience our systems<br /><span style={{ color: T.muted }}>before you build.</span>
            </h2>
            <p style={{ fontFamily: T.sans, fontSize: "0.9375rem", lineHeight: 1.55, letterSpacing: "-0.005em", color: T.muted, maxWidth: "50ch", marginTop: 16 }}>
              12 live interactive demos — booking systems, CRMs, client portals, AI chatbots and more. Click around and see exactly what we build.
            </p>
          </div>
          <Link
            href="/systems-lab"
            className="inline-flex items-center gap-3 font-medium transition-opacity hover:opacity-90 shrink-0"
            style={{ fontFamily: T.sans, fontSize: "0.875rem", fontWeight: 500, letterSpacing: "-0.005em", height: 44, paddingInline: 22, background: T.primary, color: T.primaryFg, borderRadius: 10, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18), 0 0 24px ${T.primary}35` }}
          >
            Enter Systems Lab →
          </Link>
        </div>
      </div>

      <div className="relative" style={{ zIndex: 6 }}>
        <Footer />
      </div>
    </>
  );
}
