import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import { T } from "@/lib/tokens";
import { BookCta } from "./BookCta";

const steps = [
  { n: "01", title: "Create your account", desc: "Sign up with your details, preferred call date, and time slot. Takes under two minutes." },
  { n: "02", title: "Complete your brief", desc: "Answer five short questions about your project — pages, style, goals, and budget. We use this to make the call count." },
  { n: "03", title: "You get a clear proposal", desc: "Within 48 hours of our call, you'll receive a fixed-price proposal with full scope, timeline, and deliverables. No surprises." },
];

export default function BookPage() {
  return (
    <>
      <Nav />
      <main>
        {/* Hero */}
        <section className="pt-28 pb-20 px-8 md:px-16" style={{
          backgroundImage: `radial-gradient(ellipse 60% 55% at 60% 40%, ${T.primarySoft} 0%, transparent 70%)`,
        }}>
          <div className="mb-7">
            <span className="inline-flex items-center gap-2" style={{ fontFamily: T.sans, fontSize: "0.75rem", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: T.muted }}>
              <span className="pulse-dot" style={{ width: 8, height: 8, borderRadius: "50%", background: T.primary, display: "inline-block" }} />
              Book a call
            </span>
          </div>
          <h1 style={{ fontFamily: T.display, fontWeight: 600, fontSize: "clamp(3.5rem, 10vw, 8rem)", lineHeight: 1.04, letterSpacing: "-0.03em", color: T.fg }}>
            Let&apos;s<br /><span className="hero-glow" style={{ color: T.primary }}>talk.</span>
          </h1>
          <p className="mt-8 max-w-[44ch]" style={{ fontFamily: T.sans, fontSize: "1rem", lineHeight: 1.65, letterSpacing: "-0.005em", color: T.muted }}>
            30-minute discovery call. No pressure. Just a conversation about your business and what you want to build.
          </p>
        </section>

        {/* What to expect */}
        <section style={{ borderTop: `1px solid ${T.border}`, background: T.surface }}>
          <div className="px-10 md:px-16 pt-16 pb-10">
            <Reveal>
              <h2 style={{ fontFamily: T.display, fontWeight: 600, fontSize: "clamp(2rem, 4vw, 3rem)", lineHeight: 1.08, letterSpacing: "-0.025em", color: T.fg }}>
                What to <span style={{ color: T.muted }}>expect.</span>
              </h2>
            </Reveal>
          </div>
          <div className="grid md:grid-cols-3" style={{ borderTop: `1px solid ${T.border}`, borderLeft: `1px solid ${T.border}` }}>
            {steps.map((s, i) => (
              <Reveal key={s.n} delay={i * 0.08}>
                <div className="p-10 md:p-12 flex flex-col gap-5" style={{ borderRight: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}` }}>
                  <div style={{ fontFamily: T.mono, fontWeight: 600, fontSize: "2rem", lineHeight: 1, color: `${T.primary}30` }}>{s.n}</div>
                  <h3 style={{ fontFamily: T.display, fontWeight: 600, fontSize: "1.125rem", letterSpacing: "-0.01em", lineHeight: 1.3, color: T.fg }}>{s.title}</h3>
                  <div className="w-5 h-px" style={{ background: T.border }} />
                  <p style={{ fontFamily: T.sans, fontSize: "0.9375rem", lineHeight: 1.65, letterSpacing: "-0.005em", color: T.muted }}>{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section style={{ borderTop: `1px solid ${T.border}` }}>
          <div className="grid md:grid-cols-[1fr_480px]">
            {/* Left */}
            <div className="p-10 md:px-16 md:py-20 flex flex-col gap-8" style={{ borderRight: `1px solid ${T.border}` }}>
              <Reveal>
                <h2 style={{ fontFamily: T.display, fontWeight: 600, fontSize: "clamp(2.5rem, 5vw, 4.5rem)", lineHeight: 1.04, letterSpacing: "-0.03em", color: T.fg }}>
                  Ready to<br /><span style={{ color: T.primary }}>start?</span>
                </h2>
              </Reveal>
              <Reveal delay={0.1}>
                <p style={{ fontFamily: T.sans, fontSize: "0.9375rem", lineHeight: 1.65, letterSpacing: "-0.005em", color: T.muted, maxWidth: "36ch" }}>
                  Create your client account in under two minutes. Pick your preferred date and time, then we&apos;ll take you straight to your project brief.
                </p>
              </Reveal>
              <Reveal delay={0.2}>
                <div className="flex flex-col gap-3 pt-8" style={{ borderTop: `1px solid ${T.border}` }}>
                  {[
                    "Same-day response",
                    "Platform — Zoom, free to join",
                    "UK-based — global reach",
                  ].map((t, i) => (
                    <div key={t} className="flex items-center gap-2.5" style={{ fontFamily: T.sans, fontSize: "0.8125rem", fontWeight: i === 0 ? 500 : 400, letterSpacing: "0.08em", textTransform: "uppercase", color: i === 0 ? T.muted : T.faint }}>
                      {i === 0 && <span className="pulse-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: T.primary, display: "inline-block", flexShrink: 0 }} />}
                      {i > 0 && <span style={{ width: 6, height: 6, flexShrink: 0 }} />}
                      {t}
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>

            {/* Right — CTA card */}
            <div className="p-10 md:px-12 md:py-20 flex items-start">
              <Reveal delay={0.1} className="w-full">
                <div className="flex flex-col gap-6 p-8 rounded-2xl" style={{ background: T.surface, border: `1px solid ${T.border}`, boxShadow: T.shadow.md }}>
                  <div>
                    <p style={{ fontFamily: T.sans, fontSize: "0.75rem", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: T.muted, marginBottom: 8 }}>What happens next</p>
                    <ol className="flex flex-col gap-3">
                      {["Create your account — 2 min", "Complete your project brief", "We book your call and confirm"].map((s, i) => (
                        <li key={s} className="flex items-center gap-3" style={{ fontFamily: T.sans, fontSize: "0.875rem", color: T.muted }}>
                          <span style={{ width: 22, height: 22, borderRadius: "50%", background: T.primarySoft, border: `1px solid ${T.primary}44`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontFamily: T.mono, fontSize: "10px", fontWeight: 600, color: T.primary }}>{i + 1}</span>
                          {s}
                        </li>
                      ))}
                    </ol>
                  </div>
                  <div className="h-px" style={{ background: T.border }} />
                  <BookCta />
                  <p className="text-center" style={{ fontFamily: T.sans, fontSize: "0.8125rem", color: T.faint }}>
                    Free · No obligation · 30-minute call
                  </p>
                </div>
              </Reveal>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
