"use client";

import React from "react";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import HeroText from "@/components/HeroText";
import { ShaderBackground } from "@/components/ShaderBackground";
import { T } from "@/lib/tokens";

/* ── Section label ──────────────────────────── */
function Label({ children }: { children: React.ReactNode }) {
  return (
    <Reveal>
      <div className="flex items-center gap-3 mb-8">
        <span style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.22em", textTransform: "uppercase", color: T.primary, fontWeight: 600 }}>
          {children}
        </span>
        <span className="block w-8 h-px" style={{ background: `${T.primary}55` }} />
      </div>
    </Reveal>
  );
}

/* ── Primary button ─────────────────────────── */
function PrimaryBtn({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="inline-flex items-center gap-3 px-5 h-10 font-medium transition-opacity hover:opacity-90"
      style={{ fontFamily: T.mono, fontSize: "0.78rem", letterSpacing: "0.04em", background: T.primary, color: T.primaryFg, borderRadius: "2px", boxShadow: `0 0 24px color-mix(in oklab, ${T.primary} 30%, transparent)`, outline: `1px solid ${T.primary}66` }}>
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
              <h2 style={{ fontFamily: T.display, fontWeight: 900, fontSize: "clamp(2.4rem,4.5vw,4.5rem)", lineHeight: 0.95, letterSpacing: "-0.01em", color: T.fg }}>
                WHAT WE<br /><span style={{ color: T.muted }}>DO.</span>
              </h2>
            </Reveal>
          </div>
          <Reveal delay={0.2}><PrimaryBtn href="/about">About us →</PrimaryBtn></Reveal>
        </div>
        <div className="grid grid-rows-1 md:grid-rows-2 h-full" style={{ borderLeft: `1px solid ${T.border}` }}>
          {cards.map((card, i) => (
            <article key={card.num} className="group relative p-8 md:p-12 grid grid-cols-[48px_1fr] gap-6 content-center"
              style={{ borderBottom: i === 0 ? `1px solid ${T.border}` : "none", transition: "background 0.2s" }}
              onMouseEnter={e => (e.currentTarget.style.background = T.surface)}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
              <span className="absolute top-0 left-0 h-px" style={{ width: 0, background: T.primary, transition: "width 0.5s cubic-bezier(.2,.8,.2,1)" }}
                ref={el => { if (!el) return; const art = el.parentElement!; art.addEventListener("mouseenter", () => { el.style.width = "100%"; }); art.addEventListener("mouseleave", () => { el.style.width = "0"; }); }} />
              <div style={{ fontFamily: T.mono, fontWeight: 600, fontSize: "1.6rem", lineHeight: 1, color: `${T.primary}40`, paddingTop: "3px" }}>{card.num}</div>
              <div className="flex flex-col gap-3">
                <h3 style={{ fontFamily: T.display, fontWeight: 900, fontSize: "clamp(1.3rem,2vw,1.8rem)", letterSpacing: "0.01em", color: T.fg }}>{card.title}</h3>
                <p style={{ fontFamily: T.sans, fontWeight: 400, fontSize: "0.9rem", lineHeight: 1.7, color: T.muted, maxWidth: "46ch" }}>{card.desc}</p>
                <span className="flex items-center gap-2.5 mt-1" style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: T.primary }}>
                  <span className="h-px w-3 shrink-0" style={{ background: `${T.primary}80` }} />{card.tag}
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
          <h2 className="mb-7" style={{ fontFamily: T.display, fontWeight: 900, fontSize: "clamp(2.8rem,5.5vw,5.5rem)", lineHeight: 0.95, letterSpacing: "-0.01em", color: T.fg }}>
            BUILT FOR<br /><span style={{ color: T.muted }}>BUSINESSES</span><br /><span style={{ color: T.primary }}>DOING THE WORK.</span>
          </h2>
        </Reveal>
        <Reveal delay={0.2}><PrimaryBtn href="/work">View our work →</PrimaryBtn></Reveal>
      </div>
      <div className="flex flex-col gap-9">
        <Reveal delay={0.2}><p style={{ fontFamily: T.sans, fontWeight: 400, fontSize: "1rem", lineHeight: 1.75, color: T.muted, maxWidth: "46ch" }}>We build more than websites. From bespoke booking systems and automated email campaigns to interactive courses and custom business workflows, we create digital solutions tailored to your brand that save time, improve customer experiences, and help your business grow.</p></Reveal>
        <Reveal delay={0.3}>
          <div className="flex flex-wrap gap-2">
            {tags.map(tag => (
              <span key={tag} className="px-4 py-2 transition-colors cursor-default"
                style={{ fontFamily: T.mono, fontWeight: 500, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: T.muted, border: `1px solid ${T.border}`, borderRadius: "2px" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${T.primary}88`; (e.currentTarget as HTMLElement).style.color = T.primary; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = T.border; (e.currentTarget as HTMLElement).style.color = T.muted; }}>
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
          <Reveal delay={0.1}><h2 style={{ fontFamily: T.display, fontWeight: 900, fontSize: "clamp(2.4rem,4.5vw,4.5rem)", lineHeight: 0.95, letterSpacing: "-0.01em", color: T.fg }}>THE <span style={{ color: T.muted }}>PROCESS.</span></h2></Reveal>
        </div>
        <Reveal delay={0.2}><p style={{ fontFamily: T.sans, fontSize: "0.9rem", lineHeight: 1.75, color: T.muted, maxWidth: "36ch" }}>A clear, four-step process to get your business online with minimal friction.</p></Reveal>
      </div>
      <Reveal delay={0.1} className="flex-1 min-h-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 h-full" style={{ borderTop: `1px solid ${T.border}`, borderLeft: `1px solid ${T.border}` }}>
          {steps.map(step => (
            <article key={step.num} className="group relative flex flex-col justify-center gap-5 p-8 md:p-10" style={{ borderRight: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}` }}>
              <span className="absolute bottom-0 left-0 h-0.5" style={{ width: 0, background: T.primary, transition: "width 0.5s cubic-bezier(.2,.8,.2,1)" }}
                ref={el => { if (!el) return; const art = el.parentElement!; art.addEventListener("mouseenter", () => { el.style.width = "100%"; }); art.addEventListener("mouseleave", () => { el.style.width = "0"; }); }} />
              <div style={{ fontFamily: T.mono, fontWeight: 600, fontSize: "2.2rem", lineHeight: 1, color: `${T.primary}28` }}>{step.num}</div>
              <h3 style={{ fontFamily: T.display, fontWeight: 900, fontSize: "clamp(1.2rem,1.6vw,1.6rem)", letterSpacing: "0.01em", color: T.fg }}>{step.title}</h3>
              <div className="w-5 h-px" style={{ background: T.border }} />
              <p style={{ fontFamily: T.sans, fontSize: "0.84rem", lineHeight: 1.7, color: T.muted }}>{step.desc}</p>
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
          <div className="flex items-center justify-center gap-3 mb-10" style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: T.primary }}>
            <span>05 — Why us</span><span className="h-px w-8" style={{ background: `${T.primary}55` }} />
          </div>
        </Reveal>
        <Reveal delay={0.08}>
          <div className="text-center mb-12" style={{ fontFamily: T.display, fontWeight: 900, fontSize: "clamp(2.8rem,6vw,6.5rem)", lineHeight: 0.95, letterSpacing: "-0.01em" }}>
            <span className="block" style={{ color: T.fg }}>NO TEMPLATES.</span>
            <span className="block" style={{ color: T.muted }}>NO BLOAT.</span>
            <span className="block hero-glow" style={{ color: T.primary }}>NO NONSENSE.</span>
          </div>
        </Reveal>
        <Reveal delay={0.16}>
          <div className="grid md:grid-cols-3 w-full max-w-5xl" style={{ borderTop: `1px solid ${T.border}`, borderLeft: `1px solid ${T.border}` }}>
            {props.map(p => (
              <div key={p.n} className="p-8 text-left" style={{ borderRight: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}` }}>
                <div className="mb-4" style={{ fontFamily: T.mono, fontWeight: 600, fontSize: "1rem", letterSpacing: "-0.02em", color: `${T.primary}70` }}>{p.n}</div>
                <h3 className="mb-2" style={{ fontFamily: T.display, fontWeight: 900, fontSize: "1.1rem", letterSpacing: "0.01em", color: T.fg }}>{p.title}</h3>
                <p style={{ fontFamily: T.sans, fontSize: "0.82rem", lineHeight: 1.7, color: T.muted }}>{p.desc}</p>
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
              <h2 className="mb-4" style={{ fontFamily: T.display, fontWeight: 900, fontSize: "clamp(2.4rem,4.5vw,4.5rem)", lineHeight: 0.92, letterSpacing: "-0.01em", color: T.fg }}>
                READY TO<br /><span className="hero-glow" style={{ color: T.primary }}>GO ONLINE?</span>
              </h2>
            </Reveal>
            <Reveal delay={0.2}><p style={{ fontFamily: T.sans, fontSize: "0.95rem", lineHeight: 1.75, color: T.muted, maxWidth: "40ch" }}>Tell us about your business and we&apos;ll be in touch within 24 hours. No commitment required.</p></Reveal>
          </div>
          <Reveal delay={0.3}>
            <div className="flex flex-col gap-3 pt-10" style={{ borderTop: `1px solid ${T.border}` }}>
              <div className="flex items-center gap-2.5" style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: T.muted }}>
                <span className="size-1.5 rounded-full pulse-dot flex-shrink-0" style={{ background: T.primary }} />SYS_RESPONSE / 24H_MAX
              </div>
              <div style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: `${T.muted}88`, paddingLeft: "20px" }}>COORD / UK — GLOBAL_REACH</div>
            </div>
          </Reveal>
        </div>
        <div className="p-10 md:px-12 md:py-10 flex items-center justify-center" style={{ borderLeft: `1px solid ${T.border}` }}>
          <Reveal delay={0.2} className="w-full max-w-md">
            <div className="flex flex-col gap-6">
              <div>
                <div className="mb-3" style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.18em", textTransform: "uppercase", color: T.primary }}>// 5-STEP BRIEF</div>
                <h3 className="mb-3" style={{ fontFamily: T.display, fontWeight: 900, fontSize: "1.8rem", lineHeight: 1, letterSpacing: "-0.01em", color: T.fg, textTransform: "uppercase" }}>
                  TELL US ABOUT<br />YOUR PROJECT.
                </h3>
                <p style={{ fontFamily: T.sans, fontSize: "0.92rem", lineHeight: 1.7, color: T.muted, maxWidth: "38ch" }}>
                  A quick 2-minute brief — pages, style, budget, timeline. We&apos;ll send back a clear proposal.
                </p>
              </div>
              <Link
                href="/brief"
                className="inline-flex items-center justify-between px-5 h-12 font-semibold transition-opacity hover:opacity-90"
                style={{ fontFamily: T.mono, fontSize: "0.78rem", letterSpacing: "0.08em", textTransform: "uppercase", background: T.primary, color: T.primaryFg, borderRadius: "3px", boxShadow: `0 0 24px color-mix(in oklab, ${T.primary} 25%, transparent)` }}
              >
                <span>TELL US MORE</span>
                <span>→</span>
              </Link>
              <div style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: `${T.muted}88` }}>
                ~ 2 MIN · NO COMMITMENT
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
          background: "rgba(11,11,14,0.92)",
          backdropFilter: "blur(18px) saturate(120%)",
          WebkitBackdropFilter: "blur(18px) saturate(120%)",
          border: "1px solid rgba(245,242,238,0.08)",
          boxShadow: "0 50px 120px -16px rgba(0,0,0,0.9)",
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
      <ShaderBackground />
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

      <div className="relative" style={{ zIndex: 6 }}>
        <Footer />
      </div>
    </>
  );
}
