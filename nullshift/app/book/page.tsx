import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { T } from "@/lib/tokens";
import { BookCta } from "./BookCta";

export default function BookPage() {
  return (
    <>
      <Nav />
      <main
        style={{
          minHeight: "calc(100dvh - 64px)",
          display: "flex",
          flexDirection: "column",
          backgroundImage: `radial-gradient(ellipse 70% 60% at 10% 50%, ${T.primarySoft} 0%, transparent 60%)`,
        }}
      >
        <style>{`
          @media (min-width: 1024px) {
            .book-left  { border-bottom: none !important; border-right: 1px solid #2A2D38 !important; }
          }
        `}</style>

        {/* Two-column split on lg+, stacked below */}
        <div className="flex-1 flex flex-col lg:flex-row">

          {/* ── Left: headline ───────────────────────────────── */}
          <div
            className="book-left flex flex-col justify-center gap-8 px-6 py-12 sm:px-12 sm:py-16 lg:px-20 lg:py-20 lg:flex-1"
            style={{ borderBottom: `1px solid ${T.border}` }}
          >
            {/* Eyebrow */}
            <div className="flex items-center gap-2">
              <span
                style={{ width: 8, height: 8, borderRadius: "50%", background: T.primary, boxShadow: `0 0 0 3px ${T.primarySoft}`, display: "inline-block", flexShrink: 0 }}
              />
              <span style={{ fontFamily: T.sans, fontSize: "0.75rem", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: T.muted }}>
                Book a call
              </span>
            </div>

            {/* Heading + body */}
            <div>
              <h1 style={{ fontFamily: T.display, fontWeight: 600, fontSize: "clamp(2.75rem, 7vw, 5rem)", lineHeight: 1.04, letterSpacing: "-0.03em", color: T.fg }}>
                Ready to<br />
                <span className="hero-glow" style={{ color: T.primary }}>start?</span>
              </h1>
              <p className="mt-5 max-w-[38ch]" style={{ fontFamily: T.sans, fontSize: "1rem", lineHeight: 1.65, letterSpacing: "-0.005em", color: T.muted }}>
                Create your client account in under two minutes. Pick your preferred date and time, then we&apos;ll take you straight to your project brief.
              </p>
            </div>

            {/* Trust signals — hidden on mobile to keep it tight */}
            <div className="hidden sm:flex flex-col gap-2.5 pt-6" style={{ borderTop: `1px solid ${T.border}` }}>
              {[
                { text: "Same-day response", dot: true },
                { text: "Platform — Zoom, free to join", dot: false },
                { text: "UK-based — global reach", dot: false },
              ].map(({ text, dot }) => (
                <div key={text} className="flex items-center gap-2.5" style={{ fontFamily: T.sans, fontSize: "0.8125rem", fontWeight: dot ? 500 : 400, letterSpacing: "0.06em", textTransform: "uppercase", color: dot ? T.muted : T.faint }}>
                  {dot
                    ? <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.primary, display: "inline-block", flexShrink: 0 }} />
                    : <span style={{ width: 6, flexShrink: 0 }} />
                  }
                  {text}
                </div>
              ))}
            </div>
          </div>

          {/* ── Right: CTA card ───────────────────────────────── */}
          <div
            className="flex items-center justify-center px-6 py-10 sm:px-12 sm:py-14 lg:px-14 lg:py-20"
            style={{ borderLeft: "none" }}
          >
            <div
              className="w-full flex flex-col gap-5 sm:gap-6 p-6 sm:p-8"
              style={{
                background: T.surface,
                border: `1px solid ${T.border}`,
                borderRadius: T.r.xl,
                boxShadow: T.shadow.md,
                maxWidth: 440,
                width: "100%",
              }}
            >
              <div>
                <p style={{ fontFamily: T.sans, fontSize: "0.75rem", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: T.muted, marginBottom: 14 }}>
                  What happens next
                </p>
                <ol className="flex flex-col gap-3.5">
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
