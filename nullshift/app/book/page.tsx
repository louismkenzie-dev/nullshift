"use client";

import { useState } from "react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import { T } from "@/lib/tokens";

const steps = [
  { n: "01", title: "Tell us about your project", desc: "Fill in the form with details about your business and what you want to build. No brief too big or too small." },
  { n: "02", title: "We ask the right questions", desc: "We'll review your submission and reach out to confirm the call — with focused questions to make the most of our time together." },
  { n: "03", title: "You get a clear proposal", desc: "Within 48 hours of our call, you'll receive a fixed-price proposal with full scope, timeline, and deliverables. No surprises." },
];

const fieldStyle: React.CSSProperties = {
  width: "100%",
  background: T.surface,
  color: T.fg,
  fontFamily: T.sans,
  fontSize: "0.9375rem",
  letterSpacing: "-0.005em",
  border: `1px solid ${T.border}`,
  borderRadius: T.r.md,
  padding: "10px 14px",
  outline: "none",
  height: 44,
  transition: `border-color ${T.duration.base} ${T.ease}, box-shadow ${T.duration.base} ${T.ease}`,
};

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

  function onFocus(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    e.currentTarget.style.borderColor = T.primary;
    e.currentTarget.style.boxShadow = T.shadow.focus;
  }
  function onBlur(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    e.currentTarget.style.borderColor = T.border;
    e.currentTarget.style.boxShadow = "none";
  }

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

        {/* Booking form */}
        <section style={{ borderTop: `1px solid ${T.border}` }}>
          <div className="grid md:grid-cols-[1fr_480px]">
            {/* Left info */}
            <div className="p-10 md:px-16 md:py-20 flex flex-col gap-8" style={{ borderRight: `1px solid ${T.border}` }}>
              <Reveal>
                <h2 style={{ fontFamily: T.display, fontWeight: 600, fontSize: "clamp(2.5rem, 5vw, 4.5rem)", lineHeight: 1.04, letterSpacing: "-0.03em", color: T.fg }}>
                  Request<br />a <span style={{ color: T.primary }}>call.</span>
                </h2>
              </Reveal>
              <Reveal delay={0.1}>
                <p style={{ fontFamily: T.sans, fontSize: "0.9375rem", lineHeight: 1.65, letterSpacing: "-0.005em", color: T.muted, maxWidth: "36ch" }}>
                  Fill in the form and we&apos;ll confirm your preferred time within a few hours. All calls are via Zoom.
                </p>
              </Reveal>
              <Reveal delay={0.2}>
                <div className="flex flex-col gap-3 pt-8" style={{ borderTop: `1px solid ${T.border}` }}>
                  <div className="flex items-center gap-2.5" style={{ fontFamily: T.sans, fontSize: "0.8125rem", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: T.muted }}>
                    <span className="pulse-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: T.primary, display: "inline-block", flexShrink: 0 }} />
                    Same-day response
                  </div>
                  <div style={{ fontFamily: T.sans, fontSize: "0.8125rem", letterSpacing: "0.08em", textTransform: "uppercase", color: T.faint, paddingLeft: "22px" }}>
                    Platform — Zoom, free to join
                  </div>
                  <div style={{ fontFamily: T.sans, fontSize: "0.8125rem", letterSpacing: "0.08em", textTransform: "uppercase", color: T.faint, paddingLeft: "22px" }}>
                    UK-based — global reach
                  </div>
                </div>
              </Reveal>
            </div>

            {/* Form */}
            <div className="p-10 md:px-12 md:py-20">
              <Reveal delay={0.1}>
                <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
                  {[
                    { id: "name",     label: "Your name",     type: "text",  required: true },
                    { id: "business", label: "Business name", type: "text",  required: true },
                    { id: "email",    label: "Email address", type: "email", required: true },
                    { id: "phone",    label: "Phone (optional)", type: "tel", required: false },
                  ].map(f => (
                    <div key={f.id} className="flex flex-col gap-1.5">
                      <label htmlFor={f.id} style={{ fontFamily: T.sans, fontSize: "0.75rem", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: T.muted }}>{f.label}</label>
                      <input id={f.id} name={f.id} type={f.type} required={f.required} disabled={submitted} style={fieldStyle} onFocus={onFocus} onBlur={onBlur} />
                    </div>
                  ))}

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="date" style={{ fontFamily: T.sans, fontSize: "0.75rem", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: T.muted }}>Preferred date</label>
                    <input id="date" name="date" type="date" required disabled={submitted} style={{ ...fieldStyle, colorScheme: "dark" }} onFocus={onFocus} onBlur={onBlur} />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="time" style={{ fontFamily: T.sans, fontSize: "0.75rem", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: T.muted }}>Preferred time</label>
                    <select id="time" name="time" required disabled={submitted} style={{ ...fieldStyle, appearance: "none" }} onFocus={onFocus} onBlur={onBlur}>
                      <option value="">Select a time…</option>
                      <option value="morning">Morning (9am–12pm London)</option>
                      <option value="afternoon">Afternoon (12pm–5pm London)</option>
                      <option value="evening">Evening (5pm–8pm London)</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="brief" style={{ fontFamily: T.sans, fontSize: "0.75rem", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: T.muted }}>Project brief</label>
                    <textarea id="brief" name="brief" rows={4} required disabled={submitted} style={{ ...fieldStyle, height: "auto", resize: "none", padding: "12px 14px", lineHeight: 1.55 }} onFocus={onFocus} onBlur={onBlur} />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="referral" style={{ fontFamily: T.sans, fontSize: "0.75rem", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: T.muted }}>How did you find us</label>
                    <select id="referral" name="referral" disabled={submitted} style={{ ...fieldStyle, appearance: "none" }} onFocus={onFocus} onBlur={onBlur}>
                      <option value="">Select an option…</option>
                      <option value="google">Google search</option>
                      <option value="referral">Word of mouth / referral</option>
                      <option value="social">Social media</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={submitted || sending}
                    className="mt-2 w-full flex items-center justify-between px-5 font-medium cursor-pointer"
                    style={{ height: 48, fontFamily: T.sans, fontSize: "0.9375rem", fontWeight: 500, letterSpacing: "-0.005em", background: submitted ? T.surface2 : T.primary, color: submitted ? T.muted : T.primaryFg, borderRadius: T.r.md, boxShadow: submitted ? "none" : `inset 0 1px 0 rgba(255,255,255,0.18)`, border: "none", transition: `background ${T.duration.base} ${T.ease}`, opacity: sending ? 0.7 : 1 }}
                  >
                    <span>{submitted ? "Request sent — we'll be in touch" : sending ? "Sending…" : "Request a call"}</span>
                    {!submitted && !sending && <span>→</span>}
                  </button>
                  {error && <p style={{ fontFamily: T.sans, fontSize: "0.8125rem", color: T.danger, marginTop: 4 }}>{error}</p>}
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
