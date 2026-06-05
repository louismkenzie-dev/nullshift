"use client";

import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import { T } from "@/lib/tokens";
import Link from "next/link";

const projects = [
  {
    id: "01",
    title: "PROJECT_ALPHA",
    type: "Web Design & Development",
    tags: ["Retail", "E-Commerce", "Branding"],
    desc: "A full bespoke e-commerce build for a UK retail brand. Custom checkout flow, mobile-first design, zero platform fees.",
    status: "PLACEHOLDER — REPLACE WITH REAL PROJECT",
  },
  {
    id: "02",
    title: "PROJECT_BETA",
    type: "Branding & Identity",
    tags: ["Hospitality", "Identity", "Web"],
    desc: "Complete brand identity and web presence for a boutique hospitality business. Logo system, colour palette, full site build.",
    status: "PLACEHOLDER — REPLACE WITH REAL PROJECT",
  },
  {
    id: "03",
    title: "PROJECT_GAMMA",
    type: "Web Design & Development",
    tags: ["Professional Services", "Web"],
    desc: "Professional services firm website with booking integration and custom CMS. Fast, clean, fully owned by the client.",
    status: "PLACEHOLDER — REPLACE WITH REAL PROJECT",
  },
];

const testimonials = [
  {
    quote: "Nullshift delivered exactly what we needed — a site that actually looks like us. No templates, no compromises. We own it outright and it cost less than 6 months of our old Wix subscription.",
    name: "CLIENT_NAME",
    business: "BUSINESS_NAME",
    industry: "Retail",
    status: "PLACEHOLDER",
  },
  {
    quote: "The turnaround was faster than any agency we'd used before. Two weeks from brief to live. The site is fast, it ranks well, and we've had more enquiries in the first month than the whole of last year.",
    name: "CLIENT_NAME",
    business: "BUSINESS_NAME",
    industry: "Hospitality",
    status: "PLACEHOLDER",
  },
  {
    quote: "Finally a web developer that speaks plain English. No jargon, clear pricing, and the end product is exactly what we asked for. Couldn't recommend Nullshift more.",
    name: "CLIENT_NAME",
    business: "BUSINESS_NAME",
    industry: "Trades",
    status: "PLACEHOLDER",
  },
];

export default function WorkPage() {
  return (
    <>
      <Nav />
      <main>
        {/* Hero */}
        <section className="pt-28 pb-20 px-8 md:px-16 min-h-[50vh] flex flex-col justify-end" style={{
          backgroundImage: `radial-gradient(ellipse 50% 60% at 80% 30%, color-mix(in oklab, ${T.primary} 5%, transparent) 0%, transparent 70%)`,
        }}>
          <div className="flex items-center gap-3 mb-6" style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: T.primary }}>
            <span className="size-1.5 rounded-full pulse-dot" style={{ background: T.primary }} />
            <span>SYS_03 / WORK_&_RESULTS</span>
          </div>
          <h1 style={{ fontFamily: T.display, fontWeight: 900, fontSize: "clamp(3.5rem,9vw,9rem)", lineHeight: 0.92, letterSpacing: "-0.01em", color: T.fg }}>
            BUILT TO LAST.<br /><span className="hero-glow" style={{ color: T.primary }}>RESULTS THAT SPEAK.</span>
          </h1>
          <p className="mt-8 max-w-[44ch]" style={{ fontFamily: T.sans, fontSize: "1rem", lineHeight: 1.75, color: T.muted }}>
            Every project is bespoke. Every client owns their code. Here&apos;s what we&apos;ve built.
          </p>
        </section>

        {/* Projects */}
        <section style={{ borderTop: `1px solid ${T.border}` }}>
          <div className="px-10 md:px-16 pt-16 pb-10 flex items-end justify-between gap-6">
            <Reveal>
              <h2 style={{ fontFamily: T.display, fontWeight: 900, fontSize: "clamp(2rem,4vw,3.5rem)", lineHeight: 0.95, color: T.fg }}>
                FEATURED <span style={{ color: T.muted }}>PROJECTS.</span>
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <span style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: T.muted, border: `1px solid ${T.border}`, padding: "6px 12px", borderRadius: "2px" }}>
                MORE_PROJECTS / COMING_SOON
              </span>
            </Reveal>
          </div>

          <div className="grid md:grid-cols-3" style={{ borderTop: `1px solid ${T.border}`, borderLeft: `1px solid ${T.border}` }}>
            {projects.map((p, i) => (
              <Reveal key={p.id} delay={i * 0.08}>
                <article className="group relative flex flex-col" style={{ borderRight: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}` }}>
                  <span className="absolute top-0 left-0 h-px" style={{ width: 0, background: T.primary, transition: "width 0.5s cubic-bezier(.2,.8,.2,1)" }}
                    ref={el => { if (!el) return; const art = el.parentElement!; art.addEventListener("mouseenter", () => { el.style.width = "100%"; }); art.addEventListener("mouseleave", () => { el.style.width = "0"; }); }} />

                  {/* Image placeholder */}
                  <div className="w-full aspect-video flex items-center justify-center" style={{ background: T.surface2, borderBottom: `1px solid ${T.border}` }}>
                    <div className="flex flex-col items-center gap-2">
                      <span style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: T.muted }}>PROJECT_IMAGE</span>
                      <span style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.1em", color: `${T.muted}55` }}>REPLACE WITH SCREENSHOT</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4 p-8">
                    <div className="flex items-center justify-between">
                      <span style={{ fontFamily: T.mono, fontWeight: 600, fontSize: "0.7rem", letterSpacing: "0.1em", color: `${T.primary}70` }}>{p.id}</span>
                      <span style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.08em", color: `${T.muted}55`, border: `1px solid ${T.border}`, padding: "2px 8px" }}>{p.status}</span>
                    </div>
                    <h3 style={{ fontFamily: T.display, fontWeight: 900, fontSize: "1.4rem", letterSpacing: "0.02em", color: T.fg }}>{p.title}</h3>
                    <p style={{ fontFamily: T.sans, fontSize: "0.875rem", lineHeight: 1.7, color: T.muted }}>{p.desc}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {p.tags.map(tag => (
                        <span key={tag} style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: T.primary, border: `1px solid ${T.primary}44`, padding: "2px 8px", borderRadius: "2px" }}>{tag}</span>
                      ))}
                    </div>
                    <div className="pt-2">
                      <span style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: T.muted, cursor: "default" }}>VIEW_PROJECT → (coming soon)</span>
                    </div>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Testimonials */}
        <section style={{ borderTop: `1px solid ${T.border}`, background: T.surface }}>
          <div className="px-10 md:px-16 pt-16 pb-10">
            <Reveal>
              <h2 style={{ fontFamily: T.display, fontWeight: 900, fontSize: "clamp(2rem,4vw,3.5rem)", lineHeight: 0.95, color: T.fg }}>
                CLIENT <span style={{ color: T.primary }}>FEEDBACK.</span>
              </h2>
            </Reveal>
          </div>
          <div className="grid md:grid-cols-3" style={{ borderTop: `1px solid ${T.border}`, borderLeft: `1px solid ${T.border}` }}>
            {testimonials.map((t, i) => (
              <Reveal key={i} delay={i * 0.08}>
                <article className="group relative flex flex-col gap-6 p-10" style={{ borderRight: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}` }}>
                  <span className="absolute top-0 left-0 h-px" style={{ width: 0, background: T.primary, transition: "width 0.5s cubic-bezier(.2,.8,.2,1)" }}
                    ref={el => { if (!el) return; const art = el.parentElement!; art.addEventListener("mouseenter", () => { el.style.width = "100%"; }); art.addEventListener("mouseleave", () => { el.style.width = "0"; }); }} />
                  <div style={{ fontFamily: T.mono, fontSize: "2rem", lineHeight: 1, color: `${T.primary}40` }}>&ldquo;</div>
                  <p style={{ fontFamily: T.sans, fontSize: "0.9rem", lineHeight: 1.8, color: T.muted, fontStyle: "italic" }}>{t.quote}</p>
                  <div className="mt-auto pt-6" style={{ borderTop: `1px solid ${T.border}` }}>
                    <div style={{ fontFamily: T.mono, fontWeight: 600, fontSize: "0.75rem", letterSpacing: "0.06em", color: T.fg }}>{t.name}</div>
                    <div style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: T.muted }}>{t.business}</div>
                    <span className="inline-block mt-2" style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: T.primary, border: `1px solid ${T.primary}44`, padding: "2px 8px", borderRadius: "2px" }}>{t.industry}</span>
                  </div>
                  <span style={{ fontFamily: T.mono, fontSize: "9px", color: `${T.muted}55`, letterSpacing: "0.08em" }}>⚠ {t.status}</span>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="px-10 md:px-16 py-24 flex flex-col md:flex-row items-start md:items-center justify-between gap-8" style={{ borderTop: `1px solid ${T.border}` }}>
          <Reveal>
            <h2 style={{ fontFamily: T.display, fontWeight: 900, fontSize: "clamp(2rem,4vw,3.5rem)", lineHeight: 0.95, letterSpacing: "-0.01em", color: T.fg }}>
              WANT TO BE <span style={{ color: T.primary }}>NEXT?</span>
            </h2>
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
