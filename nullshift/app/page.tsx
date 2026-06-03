"use client";

import React, { useState } from "react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
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
function Hero() {
  return (
    <section id="hero" className="relative min-h-screen flex flex-col justify-end overflow-hidden">
      <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover" style={{ zIndex: 0 }}>
        <source src="/hero.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 z-[1]" style={{
        background: `linear-gradient(to top, rgba(9,9,11,0.96) 0%, rgba(9,9,11,0.65) 35%, rgba(9,9,11,0.2) 65%, transparent 100%), linear-gradient(to right, rgba(9,9,11,0.45) 0%, transparent 55%), radial-gradient(ellipse 65% 50% at 20% 70%, color-mix(in oklab, ${T.primary} 9%, transparent) 0%, transparent 70%)`,
      }} />
      <div className="relative z-[2] px-8 md:px-16 pb-20 md:pb-28 max-w-5xl">
        <div className="flex items-center gap-3 mb-6" style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: T.primary }}>
          <span className="size-1.5 rounded-full pulse-dot flex-shrink-0" style={{ background: T.primary }} />
          <span>SYS_01 / WEB_STUDIO</span>
        </div>
        <h1 className="mb-8" style={{ fontFamily: T.display, fontWeight: 900, fontSize: "clamp(2.2rem, 4.5vw, 4.8rem)", lineHeight: 0.95, letterSpacing: "-0.01em", color: T.fg }}>
          WE BUILD<br />
          <span style={{ color: T.muted }}>THE INTERNET</span><br />
          PRESENCE<br />
          <span className="hero-glow" style={{ color: T.primary }}>YOU DESERVE.</span>
        </h1>
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-8 sm:gap-12">
          <p style={{ fontFamily: T.sans, fontWeight: 400, fontSize: "clamp(0.9rem,1.3vw,1rem)", lineHeight: 1.65, color: T.muted, maxWidth: "38ch" }}>
            Nullshift Studio helps established businesses make the move online — with websites and branding built to last.
          </p>
          <PrimaryBtn href="/book">Book a discovery call →</PrimaryBtn>
        </div>
      </div>
    </section>
  );
}

/* ── SERVICES ───────────────────────────────── */
function Services() {
  const cards = [
    { num: "01", title: "Web Design & Development", desc: "From strategy to launch, we design and build fast, beautiful websites that convert visitors into customers. Every pixel considered. Every line of code clean.", tag: "CUSTOM_BUILD / NO_TEMPLATES" },
    { num: "02", title: "Branding & Identity", desc: "Logos, colour systems, and visual identity built for businesses ready to show up professionally online. We make sure your brand is unforgettable from the first glance.", tag: "IDENTITY_SYSTEMS / SCALABLE" },
  ];
  return (
    <section id="services" style={{ borderTop: `1px solid ${T.border}` }}>
      <div className="grid md:grid-cols-[280px_1fr]">
        <div className="p-10 md:py-20 md:px-10 flex flex-col justify-between gap-12" style={{ borderBottom: `1px solid ${T.border}` }}>
          <div>
            <Label>// 02 — Services</Label>
            <Reveal delay={0.1}>
              <h2 style={{ fontFamily: T.display, fontWeight: 900, fontSize: "clamp(2.8rem,5.5vw,5.5rem)", lineHeight: 0.95, letterSpacing: "-0.01em", color: T.fg }}>
                WHAT WE<br /><span style={{ color: T.muted }}>DO.</span>
              </h2>
            </Reveal>
          </div>
          <Reveal delay={0.2}><PrimaryBtn href="/book">Enquire now →</PrimaryBtn></Reveal>
        </div>
        <div style={{ borderLeft: `1px solid ${T.border}` }}>
          {cards.map((card, i) => (
            <Reveal key={card.num} delay={i * 0.08}>
              <article className="group relative p-10 md:p-14 grid grid-cols-[48px_1fr] gap-8 items-start"
                style={{ borderBottom: `1px solid ${T.border}`, transition: "background 0.2s" }}
                onMouseEnter={e => (e.currentTarget.style.background = T.surface)}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                <span className="absolute top-0 left-0 h-px" style={{ width: 0, background: T.primary, transition: "width 0.5s cubic-bezier(.2,.8,.2,1)" }}
                  ref={el => { if (!el) return; const art = el.parentElement!; art.addEventListener("mouseenter", () => { el.style.width = "100%"; }); art.addEventListener("mouseleave", () => { el.style.width = "0"; }); }} />
                <div style={{ fontFamily: T.mono, fontWeight: 600, fontSize: "1.6rem", lineHeight: 1, color: `${T.primary}40`, paddingTop: "3px" }}>{card.num}</div>
                <div className="flex flex-col gap-4">
                  <h3 style={{ fontFamily: T.display, fontWeight: 900, fontSize: "clamp(1.4rem,2.2vw,1.9rem)", letterSpacing: "0.01em", color: T.fg }}>{card.title}</h3>
                  <p style={{ fontFamily: T.sans, fontWeight: 400, fontSize: "0.9rem", lineHeight: 1.75, color: T.muted, maxWidth: "46ch" }}>{card.desc}</p>
                  <span className="flex items-center gap-2.5 mt-1" style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: T.primary }}>
                    <span className="h-px w-3 shrink-0" style={{ background: `${T.primary}80` }} />{card.tag}
                  </span>
                </div>
              </article>
            </Reveal>
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
    <section id="clients" className="px-10 md:px-12 py-24 grid md:grid-cols-2 gap-16 md:gap-24 items-end" style={{ borderTop: `1px solid ${T.border}`, background: T.surface }}>
      <div>
        <Label>// 03 — Clients</Label>
        <Reveal delay={0.1}>
          <h2 style={{ fontFamily: T.display, fontWeight: 900, fontSize: "clamp(2.8rem,5.5vw,5.5rem)", lineHeight: 0.95, letterSpacing: "-0.01em", color: T.fg }}>
            BUILT FOR<br /><span style={{ color: T.muted }}>BUSINESSES</span><br /><span style={{ color: T.primary }}>DOING THE WORK.</span>
          </h2>
        </Reveal>
      </div>
      <div className="flex flex-col gap-9">
        <Reveal delay={0.2}><p style={{ fontFamily: T.sans, fontWeight: 400, fontSize: "1rem", lineHeight: 1.75, color: T.muted, maxWidth: "44ch" }}>Nullshift works with small and medium-sized businesses — trades, retail, hospitality, services — who are ready to take their operation online without the jargon, the delays, or the inflated agency prices.</p></Reveal>
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
    <section id="process" style={{ borderTop: `1px solid ${T.border}` }}>
      <div className="px-10 md:px-12 pt-20 pb-12 flex flex-col md:flex-row items-start md:items-end justify-between gap-10">
        <div>
          <Label>// 04 — How it works</Label>
          <Reveal delay={0.1}><h2 style={{ fontFamily: T.display, fontWeight: 900, fontSize: "clamp(2.8rem,5.5vw,5.5rem)", lineHeight: 0.95, letterSpacing: "-0.01em", color: T.fg }}>THE <span style={{ color: T.muted }}>PROCESS.</span></h2></Reveal>
        </div>
        <Reveal delay={0.2}><p style={{ fontFamily: T.sans, fontSize: "0.9rem", lineHeight: 1.75, color: T.muted, maxWidth: "36ch" }}>A clear, four-step process to get your business online with minimal friction.</p></Reveal>
      </div>
      <div className="grid md:grid-cols-4" style={{ borderTop: `1px solid ${T.border}`, borderLeft: `1px solid ${T.border}` }}>
        {steps.map((step, i) => (
          <Reveal key={step.num} delay={i * 0.08}>
            <article className="group relative flex flex-col gap-6 p-10 md:p-11" style={{ borderRight: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}` }}>
              <span className="absolute bottom-0 left-0 h-0.5" style={{ width: 0, background: T.primary, transition: "width 0.5s cubic-bezier(.2,.8,.2,1)" }}
                ref={el => { if (!el) return; const art = el.parentElement!; art.addEventListener("mouseenter", () => { el.style.width = "100%"; }); art.addEventListener("mouseleave", () => { el.style.width = "0"; }); }} />
              <div style={{ fontFamily: T.mono, fontWeight: 600, fontSize: "2.4rem", lineHeight: 1, color: `${T.primary}28` }}>{step.num}</div>
              <h3 style={{ fontFamily: T.display, fontWeight: 900, fontSize: "clamp(1.3rem,1.8vw,1.7rem)", letterSpacing: "0.01em", color: T.fg }}>{step.title}</h3>
              <div className="w-5 h-px" style={{ background: T.border }} />
              <p style={{ fontFamily: T.sans, fontSize: "0.875rem", lineHeight: 1.75, color: T.muted }}>{step.desc}</p>
            </article>
          </Reveal>
        ))}
      </div>
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
    <section id="why" className="relative overflow-hidden" style={{ borderTop: `1px solid ${T.border}`, background: T.surface }}>
      <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse 60% 50% at 50% 50%, color-mix(in oklab, ${T.primary} 5%, transparent) 0%, transparent 70%)` }} />
      <div className="relative z-10 px-10 md:px-12 pt-40 pb-32">
        <Reveal>
          <div className="flex items-center justify-center gap-3 mb-20" style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: T.primary }}>
            <span>// 05 — Why us</span><span className="h-px w-8" style={{ background: `${T.primary}55` }} />
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="text-center mb-24" style={{ fontFamily: T.display, fontWeight: 900, fontSize: "clamp(3.5rem,8vw,9.5rem)", lineHeight: 0.92, letterSpacing: "-0.01em" }}>
            <span className="block" style={{ color: T.fg }}>NO TEMPLATES.</span>
            <span className="block" style={{ color: T.muted }}>NO BLOAT.</span>
            <span className="block hero-glow" style={{ color: T.primary }}>NO NONSENSE.</span>
          </div>
        </Reveal>
        <Reveal delay={0.2}>
          <div className="grid md:grid-cols-3" style={{ borderTop: `1px solid ${T.border}`, borderLeft: `1px solid ${T.border}` }}>
            {props.map(p => (
              <div key={p.n} className="p-10 md:p-12" style={{ borderRight: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}` }}>
                <div className="mb-5" style={{ fontFamily: T.mono, fontWeight: 600, fontSize: "1.1rem", letterSpacing: "-0.02em", color: `${T.primary}70` }}>{p.n}</div>
                <h3 className="mb-3" style={{ fontFamily: T.display, fontWeight: 900, fontSize: "1.2rem", letterSpacing: "0.01em", color: T.fg }}>{p.title}</h3>
                <p style={{ fontFamily: T.sans, fontSize: "0.875rem", lineHeight: 1.75, color: T.muted }}>{p.desc}</p>
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
  const [submitted, setSubmitted] = useState(false);
  const fields = [
    { id: "name",     label: "YOUR_NAME",     type: "text" },
    { id: "business", label: "BUSINESS_NAME", type: "text" },
    { id: "email",    label: "EMAIL_ADDRESS", type: "email" },
  ];
  const inputStyle: React.CSSProperties = { background: T.bg, border: `1px solid ${T.border}`, borderTop: "none", padding: "8px 16px 14px", color: T.fg, fontFamily: T.sans, fontSize: "0.9rem", fontWeight: 400, outline: "none", marginBottom: "2px" };
  return (
    <section id="contact" style={{ borderTop: `1px solid ${T.border}` }}>
      <div className="grid md:grid-cols-2" style={{ minHeight: "78vh" }}>
        <div className="p-10 md:px-12 md:py-24 flex flex-col justify-between gap-14" style={{ borderBottom: `1px solid ${T.border}` }}>
          <div>
            <Label>// 06 — Get in touch</Label>
            <Reveal delay={0.1}>
              <h2 className="mb-7" style={{ fontFamily: T.display, fontWeight: 900, fontSize: "clamp(3rem,6.5vw,7rem)", lineHeight: 0.92, letterSpacing: "-0.01em", color: T.fg }}>
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
              <div style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: `${T.muted}88`, paddingLeft: "20px" }}>COORD / AU — GLOBAL_REACH</div>
            </div>
          </Reveal>
        </div>
        <div className="p-10 md:px-12 md:py-24" style={{ borderLeft: `1px solid ${T.border}` }}>
          <Reveal delay={0.2}>
            <form className="flex flex-col gap-0.5" onSubmit={e => { e.preventDefault(); setSubmitted(true); }}>
              {fields.map(f => (
                <div key={f.id} className="flex flex-col">
                  <label htmlFor={f.id} style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: T.muted, padding: "14px 16px 4px", background: T.surface, border: `1px solid ${T.border}`, borderBottom: "none" }}>{f.label}</label>
                  <input id={f.id} name={f.id} type={f.type} required disabled={submitted} style={inputStyle}
                    onFocus={e => { e.currentTarget.style.borderColor = `${T.primary}66`; e.currentTarget.style.boxShadow = `inset 0 0 0 1px ${T.primary}44`; }}
                    onBlur={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = "none"; }} />
                </div>
              ))}
              <div className="flex flex-col">
                <label htmlFor="message" style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: T.muted, padding: "14px 16px 4px", background: T.surface, border: `1px solid ${T.border}`, borderBottom: "none" }}>PROJECT_BRIEF</label>
                <textarea id="message" name="message" rows={5} required disabled={submitted} style={{ ...inputStyle, resize: "none", borderTop: "none" }}
                  onFocus={e => { e.currentTarget.style.borderColor = `${T.primary}66`; e.currentTarget.style.boxShadow = `inset 0 0 0 1px ${T.primary}44`; }}
                  onBlur={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = "none"; }} />
              </div>
              <button type="submit" disabled={submitted} className="mt-3 w-full flex items-center justify-between px-5 h-11 font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
                style={{ fontFamily: T.mono, fontSize: "0.75rem", letterSpacing: "0.06em", background: T.primary, color: T.primaryFg, borderRadius: "2px", boxShadow: `0 0 24px color-mix(in oklab, ${T.primary} 25%, transparent)` }}>
                <span>{submitted ? "MSG_SENT ✓" : "SEND_MESSAGE"}</span><span>→</span>
              </button>
            </form>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

export default function Page() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Services />
        <WhoWeHelp />
        <Process />
        <WhyNullshift />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
