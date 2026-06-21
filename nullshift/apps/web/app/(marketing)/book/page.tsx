import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { T } from "@nullshift/ui/tokens";
import { BookCta } from "./BookCta";
import { CalEmbed } from "@/components/CalEmbed";
import { Eyebrow, Display, Lead } from "@/components/kyma";

export default function BookPage() {
  return (
    <>
      <Nav />
      <main
        className="k-dark"
        style={{
          minHeight: "calc(100dvh - 64px)",
          paddingTop: 64,
          display: "flex",
          flexDirection: "column",
          background: "var(--k-bg)",
          color: "var(--k-fg)",
        }}
      >
        <style>{`
          @media (min-width: 1024px) {
            .book-left  { border-bottom: none !important; border-right: 1px solid var(--k-border) !important; }
          }
        `}</style>

        {/* Two-column split on lg+, stacked below */}
        <div className="flex-1 flex flex-col lg:flex-row">
          {/* ── Left: headline ───────────────────────────────── */}
          <div
            className="book-left flex flex-col justify-center gap-8 px-6 py-12 sm:px-12 sm:py-16 lg:px-20 lg:py-20 lg:flex-1"
            style={{ borderBottom: "1px solid var(--k-border)" }}
          >
            {/* Eyebrow */}
            <Eyebrow index="00" label="Book a call" />

            {/* Heading + body */}
            <div>
              <Display as="h1" size="hero" style={{ maxWidth: "14ch" }}>
                Ready to <span style={{ color: "var(--k-accent)" }}>start?</span>
              </Display>
              <Lead className="mt-6" style={{ maxWidth: "42ch" }}>
                Pick your preferred date and time, set a password to confirm your account,
                and we&apos;ll lock in your call — all in under two minutes.
              </Lead>
            </div>

            {/* Trust signals — hidden on mobile to keep it tight */}
            <div
              className="hidden sm:flex flex-col gap-2.5 pt-6"
              style={{ borderTop: "1px solid var(--k-border)" }}
            >
              {[
                { text: "Same-day response", dot: true },
                { text: "Platform — Zoom, free to join", dot: false },
                { text: "UK-based — global reach", dot: false },
              ].map(({ text, dot }) => (
                <div
                  key={text}
                  className="flex items-center gap-2.5"
                  style={{
                    fontFamily: T.mono,
                    fontSize: "0.8125rem",
                    fontWeight: dot ? 500 : 400,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: dot ? "var(--k-muted)" : "var(--k-faint)",
                  }}
                >
                  {dot ? (
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "var(--k-accent)",
                        display: "inline-block",
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <span style={{ width: 6, flexShrink: 0 }} />
                  )}
                  {text}
                </div>
              ))}
            </div>
          </div>

          {/* ── Right: CTA card ───────────────────────────────── */}
          <div
            className="flex items-center justify-center px-3 py-6 sm:py-14 lg:w-[480px] lg:shrink-0 lg:px-6 lg:py-20"
            style={{ borderLeft: "none" }}
          >
            <div
              className="w-full flex flex-col gap-5 sm:gap-6 p-6 sm:p-8"
              style={{
                background: "var(--k-surface)",
                border: "1px solid var(--k-border)",
                borderRadius: T.r.xl,
                boxShadow: T.shadow.md,
                width: "100%",
              }}
            >
              <div>
                <p
                  style={{
                    fontFamily: T.mono,
                    fontSize: "0.75rem",
                    fontWeight: 500,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--k-muted)",
                    marginBottom: 14,
                  }}
                >
                  What happens next
                </p>
                <ol className="flex flex-col gap-3.5">
                  {[
                    "Pick your preferred slot",
                    "Set a password & verify your email",
                    "Your call is booked — we confirm",
                  ].map((step, i) => (
                    <li key={step} className="flex items-center gap-3">
                      <span
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: "50%",
                          background: "var(--k-bg)",
                          border: "1px solid var(--k-border-strong)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          fontFamily: T.mono,
                          fontSize: "11px",
                          fontWeight: 600,
                          color: "var(--k-accent)",
                        }}
                      >
                        {i + 1}
                      </span>
                      <span
                        style={{
                          fontFamily: T.sans,
                          fontSize: "0.9375rem",
                          color: "var(--k-muted)",
                        }}
                      >
                        {step}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>

              <div style={{ height: 1, background: "var(--k-border)" }} />
              <BookCta />
              <p
                className="text-center"
                style={{
                  fontFamily: T.sans,
                  fontSize: "0.8125rem",
                  color: "var(--k-faint)",
                }}
              >
                Free · No obligation · 15-minute call
              </p>
            </div>
          </div>
        </div>
        <CalEmbed />
      </main>
      <Footer />
    </>
  );
}
