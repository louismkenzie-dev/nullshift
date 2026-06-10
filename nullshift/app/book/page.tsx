import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { T } from "@/lib/tokens";
import { BookCta } from "./BookCta";

export default function BookPage() {
  return (
    <>
      <Nav />
      <main style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
        <div
          className="flex-1 grid md:grid-cols-[1fr_520px]"
          style={{
            flex: 1,
            backgroundImage: `radial-gradient(ellipse 55% 60% at 20% 50%, ${T.primarySoft} 0%, transparent 65%)`,
          }}
        >
          {/* Left — headline + details */}
          <div
            className="flex flex-col justify-center p-10 md:px-20 md:py-28 gap-10"
            style={{ borderRight: `1px solid ${T.border}` }}
          >
            {/* Eyebrow */}
            <div className="flex items-center gap-2">
              <span className="pulse-dot" style={{ width: 8, height: 8, borderRadius: "50%", background: T.primary, boxShadow: `0 0 0 3px ${T.primarySoft}`, display: "inline-block", flexShrink: 0 }} />
              <span style={{ fontFamily: T.sans, fontSize: "0.75rem", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: T.muted }}>
                Book a call
              </span>
            </div>

            {/* Heading */}
            <div>
              <h1 style={{ fontFamily: T.display, fontWeight: 600, fontSize: "clamp(2.75rem, 6vw, 5rem)", lineHeight: 1.04, letterSpacing: "-0.03em", color: T.fg }}>
                Ready to<br />
                <span className="hero-glow" style={{ color: T.primary }}>start?</span>
              </h1>
              <p className="mt-6 max-w-[38ch]" style={{ fontFamily: T.sans, fontSize: "1rem", lineHeight: 1.65, letterSpacing: "-0.005em", color: T.muted }}>
                Create your client account in under two minutes. Pick your preferred date and time, then we&apos;ll take you straight to your project brief.
              </p>
            </div>

            {/* Details list */}
            <div className="flex flex-col gap-3 pt-8" style={{ borderTop: `1px solid ${T.border}` }}>
              {[
                { text: "Same-day response", active: true },
                { text: "Platform — Zoom, free to join", active: false },
                { text: "UK-based — global reach", active: false },
              ].map(({ text, active }) => (
                <div key={text} className="flex items-center gap-2.5" style={{ fontFamily: T.sans, fontSize: "0.8125rem", fontWeight: active ? 500 : 400, letterSpacing: "0.06em", textTransform: "uppercase", color: active ? T.muted : T.faint }}>
                  {active
                    ? <span className="pulse-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: T.primary, display: "inline-block", flexShrink: 0 }} />
                    : <span style={{ width: 6, flexShrink: 0 }} />
                  }
                  {text}
                </div>
              ))}
            </div>
          </div>

          {/* Right — CTA card */}
          <div className="flex items-center justify-center p-10 md:px-14 md:py-28">
            <div
              className="w-full flex flex-col gap-6 p-8"
              style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r.xl, boxShadow: T.shadow.md }}
            >
              {/* Steps */}
              <div>
                <p style={{ fontFamily: T.sans, fontSize: "0.75rem", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: T.muted, marginBottom: 14 }}>
                  What happens next
                </p>
                <ol className="flex flex-col gap-4">
                  {[
                    "Create your account — 2 min",
                    "Complete your project brief",
                    "We book your call and confirm",
                  ].map((step, i) => (
                    <li key={step} className="flex items-center gap-3">
                      <span style={{ width: 24, height: 24, borderRadius: "50%", background: T.primarySoft, border: `1px solid ${T.primary}44`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontFamily: T.mono, fontSize: "11px", fontWeight: 600, color: T.primary }}>
                        {i + 1}
                      </span>
                      <span style={{ fontFamily: T.sans, fontSize: "0.9375rem", color: T.muted }}>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div style={{ height: 1, background: T.border }} />

              <BookCta />

              <p className="text-center" style={{ fontFamily: T.sans, fontSize: "0.8125rem", color: T.faint }}>
                Free · No obligation · 30-minute call
              </p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
