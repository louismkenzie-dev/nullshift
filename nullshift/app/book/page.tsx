"use client";

import { useState } from "react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import { T } from "@/lib/tokens";

const steps = [
  { n: "01", title: "Tell us about your project", desc: "Fill in the form with the details of your business and what you want to build. No brief too big or too small." },
  { n: "02", title: "We ask the right questions", desc: "We'll review your submission and reach out to confirm the call — with a focused set of questions to make the most of our time together." },
  { n: "03", title: "You get a clear proposal", desc: "Within 48 hours of our call, you'll receive a fixed-price proposal with full scope, timeline, and deliverables. No surprises." },
];

const inputStyle = (T: { bg: string; border: string; fg: string; sans: string }) => ({
  background: T.bg,
  border: `1px solid ${T.border}`,
  borderTop: "none" as const,
  padding: "8px 16px 14px",
  color: T.fg,
  fontFamily: T.sans,
  fontSize: "0.9rem",
  fontWeight: 400,
  outline: "none",
  marginBottom: "2px",
  width: "100%",
});

export default function BookPage() {
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    setError(null);
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    try {
      const res = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, source: "booking" }),
      });
      if (!res.ok) throw new Error();
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please email us directly.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Nav />
      <main>
        {/* Hero */}
        <section className="pt-28 pb-20 px-8 md:px-16" style={{
          backgroundImage: `radial-gradient(ellipse 60% 55% at 60% 40%, color-mix(in oklab, ${T.primary} 6%, transparent) 0%, transparent 70%)`,
        }}>
          <div className="flex items-center gap-3 mb-6" style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: T.primary }}>
            <span className="size-1.5 rounded-full pulse-dot" style={{ background: T.primary }} />
            <span>SYS_05 / BOOK_A_CALL</span>
          </div>
          <h1 style={{ fontFamily: T.display, fontWeight: 900, fontSize: "clamp(4rem,10vw,10rem)", lineHeight: 0.9, letterSpacing: "-0.01em", color: T.fg }}>
            LET&apos;S<br /><span className="hero-glow" style={{ color: T.primary }}>TALK.</span>
          </h1>
          <p className="mt-8 max-w-[44ch]" style={{ fontFamily: T.sans, fontSize: "1.05rem", lineHeight: 1.75, color: T.muted }}>
            30-minute discovery call. No pressure. Just a conversation about your business and what you want to build.
          </p>
        </section>

        {/* What to expect */}
        <section style={{ borderTop: `1px solid ${T.border}`, background: T.surface }}>
          <div className="px-10 md:px-16 pt-16 pb-10">
            <Reveal><h2 style={{ fontFamily: T.display, fontWeight: 900, fontSize: "clamp(2rem,4vw,3.5rem)", lineHeight: 0.95, color: T.fg }}>WHAT TO <span style={{ color: T.muted }}>EXPECT.</span></h2></Reveal>
          </div>
          <div className="grid md:grid-cols-3" style={{ borderTop: `1px solid ${T.border}`, borderLeft: `1px solid ${T.border}` }}>
            {steps.map((s, i) => (
              <Reveal key={s.n} delay={i * 0.08}>
                <div className="p-10 md:p-12 flex flex-col gap-5" style={{ borderRight: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}` }}>
                  <div style={{ fontFamily: T.mono, fontWeight: 600, fontSize: "2.2rem", lineHeight: 1, color: `${T.primary}30` }}>{s.n}</div>
                  <h3 style={{ fontFamily: T.display, fontWeight: 900, fontSize: "1.3rem", letterSpacing: "0.01em", color: T.fg }}>{s.title}</h3>
                  <div className="w-5 h-px" style={{ background: T.border }} />
                  <p style={{ fontFamily: T.sans, fontSize: "0.875rem", lineHeight: 1.75, color: T.muted }}>{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Booking form */}
        <section style={{ borderTop: `1px solid ${T.border}` }}>
          <div className="grid md:grid-cols-[1fr_480px]">
            {/* Left info */}
            <div className="p-10 md:px-16 md:py-20 flex flex-col gap-8" style={{ borderRight: `1px solid ${T.border}` }}>
              <Reveal>
                <h2 style={{ fontFamily: T.display, fontWeight: 900, fontSize: "clamp(2.5rem,5vw,5rem)", lineHeight: 0.95, letterSpacing: "-0.01em", color: T.fg }}>
                  REQUEST<br />A <span style={{ color: T.primary }}>CALL.</span>
                </h2>
              </Reveal>
              <Reveal delay={0.1}>
                <p style={{ fontFamily: T.sans, fontSize: "0.95rem", lineHeight: 1.8, color: T.muted, maxWidth: "36ch" }}>
                  Fill in the form and we&apos;ll confirm your preferred time within a few hours. All calls are via Zoom.
                </p>
              </Reveal>
              <Reveal delay={0.2}>
                <div className="flex flex-col gap-3 pt-8" style={{ borderTop: `1px solid ${T.border}` }}>
                  <div className="flex items-center gap-2.5" style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: T.muted }}>
                    <span className="size-1.5 rounded-full pulse-dot flex-shrink-0" style={{ background: T.primary }} />
                    SYS_RESPONSE / SAME_DAY
                  </div>
                  <div style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: `${T.muted}88`, paddingLeft: "20px" }}>
                    PLATFORM / ZOOM — FREE_TO_JOIN
                  </div>
                  <div style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: `${T.muted}88`, paddingLeft: "20px" }}>
                    COORD / UK — GLOBAL_REACH
                  </div>
                </div>
              </Reveal>
            </div>

            {/* Form */}
            <div className="p-10 md:px-12 md:py-20">
              <Reveal delay={0.1}>
                <form className="flex flex-col gap-0.5" onSubmit={handleSubmit}>
                  {[
                    { id: "name",     label: "YOUR_NAME",     type: "text",  required: true },
                    { id: "business", label: "BUSINESS_NAME", type: "text",  required: true },
                    { id: "email",    label: "EMAIL_ADDRESS", type: "email", required: true },
                    { id: "phone",    label: "PHONE (OPTIONAL)", type: "tel", required: false },
                  ].map(f => (
                    <div key={f.id} className="flex flex-col">
                      <label htmlFor={f.id} style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: T.muted, padding: "14px 16px 4px", background: T.surface, border: `1px solid ${T.border}`, borderBottom: "none" }}>{f.label}</label>
                      <input id={f.id} name={f.id} type={f.type} required={f.required} disabled={submitted} style={inputStyle(T)}
                        onFocus={e => { e.currentTarget.style.borderColor = `${T.primary}66`; e.currentTarget.style.boxShadow = `inset 0 0 0 1px ${T.primary}44`; }}
                        onBlur={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = "none"; }} />
                    </div>
                  ))}

                  {/* Date */}
                  <div className="flex flex-col">
                    <label htmlFor="date" style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: T.muted, padding: "14px 16px 4px", background: T.surface, border: `1px solid ${T.border}`, borderBottom: "none" }}>PREFERRED_DATE</label>
                    <input id="date" name="date" type="date" required disabled={submitted} style={{ ...inputStyle(T), colorScheme: "dark" }}
                      onFocus={e => { e.currentTarget.style.borderColor = `${T.primary}66`; }}
                      onBlur={e => { e.currentTarget.style.borderColor = T.border; }} />
                  </div>

                  {/* Time */}
                  <div className="flex flex-col">
                    <label htmlFor="time" style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: T.muted, padding: "14px 16px 4px", background: T.surface, border: `1px solid ${T.border}`, borderBottom: "none" }}>PREFERRED_TIME</label>
                    <select id="time" name="time" required disabled={submitted} style={{ ...inputStyle(T), appearance: "none" as const }}
                      onFocus={e => { e.currentTarget.style.borderColor = `${T.primary}66`; }}
                      onBlur={e => { e.currentTarget.style.borderColor = T.border; }}>
                      <option value="">Select a time...</option>
                      <option value="morning">Morning (9am–12pm London)</option>
                      <option value="afternoon">Afternoon (12pm–5pm London)</option>
                      <option value="evening">Evening (5pm–8pm London)</option>
                    </select>
                  </div>

                  {/* Brief */}
                  <div className="flex flex-col">
                    <label htmlFor="brief" style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: T.muted, padding: "14px 16px 4px", background: T.surface, border: `1px solid ${T.border}`, borderBottom: "none" }}>PROJECT_BRIEF</label>
                    <textarea id="brief" name="brief" rows={4} required disabled={submitted} style={{ ...inputStyle(T), resize: "none", borderTop: "none" }}
                      onFocus={e => { e.currentTarget.style.borderColor = `${T.primary}66`; e.currentTarget.style.boxShadow = `inset 0 0 0 1px ${T.primary}44`; }}
                      onBlur={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = "none"; }} />
                  </div>

                  {/* Referral */}
                  <div className="flex flex-col">
                    <label htmlFor="referral" style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: T.muted, padding: "14px 16px 4px", background: T.surface, border: `1px solid ${T.border}`, borderBottom: "none" }}>HOW_DID_YOU_FIND_US</label>
                    <select id="referral" name="referral" disabled={submitted} style={{ ...inputStyle(T), appearance: "none" as const }}
                      onFocus={e => { e.currentTarget.style.borderColor = `${T.primary}66`; }}
                      onBlur={e => { e.currentTarget.style.borderColor = T.border; }}>
                      <option value="">Select an option...</option>
                      <option value="google">Google search</option>
                      <option value="referral">Word of mouth / referral</option>
                      <option value="social">Social media</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <button type="submit" disabled={submitted || sending} className="mt-4 w-full flex items-center justify-between px-5 h-12 font-semibold transition-opacity hover:opacity-90 disabled:opacity-60 cursor-pointer"
                    style={{ fontFamily: T.mono, fontSize: "0.78rem", letterSpacing: "0.08em", background: T.primary, color: T.primaryFg, borderRadius: "2px", boxShadow: `0 0 24px color-mix(in oklab, ${T.primary} 25%, transparent)` }}>
                    <span>{submitted ? "REQUEST_SENT ✓ — WE'LL BE IN TOUCH" : sending ? "SENDING…" : "REQUEST_A_CALL"}</span>
                    {!submitted && !sending && <span>→</span>}
                  </button>
                  {error && <p style={{ fontFamily: T.mono, fontSize: "10px", color: "#f87171", marginTop: "8px" }}>{error}</p>}
                </form>
              </Reveal>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
