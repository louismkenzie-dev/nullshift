"use client";

import { T } from "@/lib/tokens";
import Link from "next/link";

export default function LearnComingSoon() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 py-20"
      style={{ background: T.bg }}
    >
      <div className="max-w-lg w-full flex flex-col items-center text-center gap-8">

        {/* Eyebrow */}
        <span className="inline-flex items-center gap-2" style={{ fontFamily: T.sans, fontSize: "0.75rem", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: T.muted }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.primary, boxShadow: `0 0 0 4px ${T.primarySoft}`, display: "inline-block" }} />
          Learn portal — coming soon
        </span>

        {/* Heading */}
        <h1 style={{
          fontFamily: T.display,
          fontWeight: 600,
          fontSize: "clamp(2.75rem, 6vw, 4.5rem)",
          lineHeight: 1.04,
          letterSpacing: "-0.03em",
          color: T.fg,
        }}>
          Something&apos;s<br />
          <span className="hero-glow" style={{ color: T.primary }}>coming.</span>
        </h1>

        {/* Body */}
        <p style={{
          fontFamily: T.sans,
          fontSize: "1rem",
          lineHeight: 1.65,
          letterSpacing: "-0.005em",
          color: T.muted,
          maxWidth: "36ch",
        }}>
          We&apos;re building the course library. Subscribers will be the first to get access when it goes live.
        </p>

        {/* Divider */}
        <div style={{ width: 40, height: 2, background: T.primary, borderRadius: 2 }} />

        {/* Sign in */}
        <Link
          href="/portal/login"
          className="inline-flex items-center justify-center font-medium"
          style={{
            fontFamily: T.sans,
            fontSize: "0.9375rem",
            fontWeight: 500,
            letterSpacing: "-0.005em",
            height: 44,
            paddingInline: 24,
            background: T.primary,
            color: T.primaryFg,
            borderRadius: T.r.md,
            textDecoration: "none",
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18)`,
            transition: `background ${T.duration.base} ${T.ease}`,
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = T.primaryHover}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = T.primary}
        >
          Subscriber login →
        </Link>

        <Link
          href="/"
          style={{
            fontFamily: T.sans,
            fontSize: "0.8125rem",
            letterSpacing: "-0.003em",
            color: T.muted,
            textDecoration: "none",
          }}
        >
          ← Back to site
        </Link>

      </div>
    </div>
  );
}
