"use client";

import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import { T } from "@/lib/tokens";
import Link from "next/link";

const projects = [
  {
    id: "01",
    title: "Project Alpha",
    type: "Web Design & Development",
    tags: ["Retail", "E-Commerce", "Branding"],
    desc: "A full bespoke e-commerce build for a UK retail brand. Custom checkout flow, mobile-first design, zero platform fees.",
    status: "Placeholder — replace with real project",
  },
  {
    id: "02",
    title: "Project Beta",
    type: "Branding & Identity",
    tags: ["Hospitality", "Identity", "Web"],
    desc: "Complete brand identity and web presence for a boutique hospitality business. Logo system, colour palette, full site build.",
    status: "Placeholder — replace with real project",
  },
  {
    id: "03",
    title: "Project Gamma",
    type: "Web Design & Development",
    tags: ["Professional Services", "Web"],
    desc: "Professional services firm website with booking integration and custom CMS. Fast, clean, fully owned by the client.",
    status: "Placeholder — replace with real project",
  },
];

const testimonials = [
  {
    quote: "Nullshift delivered exactly what we needed — a site that actually looks like us. No templates, no compromises. We own it outright and it cost less than 6 months of our old Wix subscription.",
    name: "Client Name",
    business: "Business Name",
    industry: "Retail",
  },
  {
    quote: "The turnaround was faster than any agency we'd used before. Two weeks from brief to live. The site is fast, it ranks well, and we've had more enquiries in the first month than the whole of last year.",
    name: "Client Name",
    business: "Business Name",
    industry: "Hospitality",
  },
  {
    quote: "Finally a web developer that speaks plain English. No jargon, clear pricing, and the end product is exactly what we asked for. Couldn't recommend Nullshift more.",
    name: "Client Name",
    business: "Business Name",
    industry: "Trades",
  },
];

/* ── Halo eyebrow ────────────────────────────────────────────── */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2" style={{ fontFamily: T.sans, fontSize: "0.75rem", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: T.muted }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.primary, boxShadow: `0 0 0 4px ${T.primarySoft}`, flexShrink: 0, display: "inline-block" }} />
      {children}
    </span>
  );
}

export default function WorkPage() {
  return (
    <>
      <Nav />
      <main>
        {/* Hero */}
        <section className="pt-28 pb-20 px-8 md:px-16 min-h-[50vh] flex flex-col justify-end" style={{
          backgroundImage: `radial-gradient(ellipse 50% 60% at 80% 30%, ${T.primarySoft} 0%, transparent 70%)`,
        }}>
          <div className="mb-7"><Eyebrow>Our work</Eyebrow></div>
          <h1 style={{ fontFamily: T.display, fontWeight: 600, fontSize: "clamp(3rem, 8vw, 7rem)", lineHeight: 1.04, letterSpacing: "-0.03em", color: T.fg }}>
            Built to last.<br /><span className="hero-glow" style={{ color: T.primary }}>Results that speak.</span>
          </h1>
          <p className="mt-8 max-w-[44ch]" style={{ fontFamily: T.sans, fontSize: "1rem", lineHeight: 1.65, letterSpacing: "-0.005em", color: T.muted }}>
            Every project is bespoke. Every client owns their code. Here&apos;s what we&apos;ve built.
          </p>
        </section>

        {/* Projects */}
        <section style={{ borderTop: `1px solid ${T.border}` }}>
          <div className="px-10 md:px-16 pt-16 pb-10 flex items-end justify-between gap-6">
            <Reveal>
              <h2 style={{ fontFamily: T.display, fontWeight: 600, fontSize: "clamp(2rem, 4vw, 3rem)", lineHeight: 1.08, letterSpacing: "-0.025em", color: T.fg }}>
                Featured <span style={{ color: T.muted }}>projects.</span>
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <span style={{ fontFamily: T.mono, fontSize: "0.75rem", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: T.muted, border: `1px solid ${T.border}`, padding: "5px 12px", borderRadius: T.r.full }}>
                More coming soon
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
                      <span style={{ fontFamily: T.mono, fontSize: "0.75rem", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: T.faint }}>Project image</span>
                      <span style={{ fontFamily: T.sans, fontSize: "0.8125rem", color: T.faint }}>Replace with screenshot</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4 p-8">
                    <div className="flex items-center justify-between">
                      <span style={{ fontFamily: T.mono, fontWeight: 600, fontSize: "0.75rem", letterSpacing: "0.04em", color: `${T.primary}80` }}>{p.id}</span>
                      <span style={{ fontFamily: T.sans, fontSize: "0.75rem", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: T.faint, border: `1px solid ${T.border}`, padding: "2px 10px", borderRadius: T.r.full }}>Placeholder</span>
                    </div>
                    <h3 style={{ fontFamily: T.display, fontWeight: 600, fontSize: "1.25rem", letterSpacing: "-0.015em", lineHeight: 1.2, color: T.fg }}>{p.title}</h3>
                    <p style={{ fontFamily: T.sans, fontSize: "0.875rem", lineHeight: 1.65, letterSpacing: "-0.003em", color: T.muted }}>{p.desc}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {p.tags.map(tag => (
                        <span key={tag} style={{ fontFamily: T.mono, fontSize: "0.75rem", fontWeight: 500, letterSpacing: "0em", color: T.primary, background: T.primarySoft, padding: "3px 10px", borderRadius: T.r.full, border: `1px solid transparent` }}>{tag}</span>
                      ))}
                    </div>
                    <div className="pt-2">
                      <span style={{ fontFamily: T.sans, fontSize: "0.8125rem", color: T.faint }}>View project — coming soon</span>
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
              <h2 style={{ fontFamily: T.display, fontWeight: 600, fontSize: "clamp(2rem, 4vw, 3rem)", lineHeight: 1.08, letterSpacing: "-0.025em", color: T.fg }}>
                Client <span style={{ color: T.primary }}>feedback.</span>
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
                  <p style={{ fontFamily: T.sans, fontSize: "0.9375rem", lineHeight: 1.7, letterSpacing: "-0.005em", color: T.muted, fontStyle: "italic" }}>{t.quote}</p>
                  <div className="mt-auto pt-6" style={{ borderTop: `1px solid ${T.border}` }}>
                    <div style={{ fontFamily: T.sans, fontWeight: 600, fontSize: "0.875rem", letterSpacing: "-0.005em", color: T.fg, marginBottom: 2 }}>{t.name}</div>
                    <div style={{ fontFamily: T.sans, fontSize: "0.8125rem", color: T.muted }}>{t.business}</div>
                    <span className="inline-block mt-3" style={{ fontFamily: T.mono, fontSize: "0.75rem", fontWeight: 500, color: T.primary, background: T.primarySoft, padding: "3px 10px", borderRadius: T.r.full }}>{t.industry}</span>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="px-10 md:px-16 py-24 flex flex-col md:flex-row items-start md:items-center justify-between gap-8" style={{ borderTop: `1px solid ${T.border}` }}>
          <Reveal>
            <h2 style={{ fontFamily: T.display, fontWeight: 600, fontSize: "clamp(2rem, 4vw, 3rem)", lineHeight: 1.08, letterSpacing: "-0.025em", color: T.fg }}>
              Want to be <span style={{ color: T.primary }}>next?</span>
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <Link href="/book" className="inline-flex items-center gap-2 font-medium"
              style={{ fontFamily: T.sans, fontSize: "0.9375rem", fontWeight: 500, letterSpacing: "-0.005em", height: 48, paddingInline: 24, background: T.primary, color: T.primaryFg, borderRadius: T.r.md, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18)`, whiteSpace: "nowrap", textDecoration: "none", transition: `background ${T.duration.base} ${T.ease}` }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = T.primaryHover}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = T.primary}
            >
              Book a discovery call →
            </Link>
          </Reveal>
        </section>
      </main>
      <Footer />
    </>
  );
}
