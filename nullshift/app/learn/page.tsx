import { T } from "@/lib/tokens";
import Link from "next/link";

export default function LearnComingSoon() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 py-20"
      style={{ background: T.bg }}
    >
      <div className="max-w-lg w-full flex flex-col items-center text-center gap-8">

        {/* Label */}
        <p style={{
          fontFamily: T.mono,
          fontSize: "11px",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: T.primary,
        }}>
          LEARN_PORTAL / COMING_SOON
        </p>

        {/* Heading */}
        <h1 style={{
          fontFamily: T.display,
          fontWeight: 900,
          fontSize: "clamp(2.6rem, 6vw, 4rem)",
          lineHeight: 0.92,
          letterSpacing: "-0.03em",
          color: T.fg,
        }}>
          SOMETHING&apos;S<br />
          <span style={{ color: T.primary }}>COMING.</span>
        </h1>

        {/* Body */}
        <p style={{
          fontFamily: T.sans,
          fontSize: "1rem",
          lineHeight: 1.7,
          color: T.muted,
          maxWidth: "36ch",
        }}>
          We&apos;re building the course library. Subscribers will be the first to get access when it goes live.
        </p>

        {/* Divider */}
        <div style={{ width: "40px", height: "2px", background: T.primary, borderRadius: "2px" }} />

        {/* Sign in link for existing subscribers */}
        <Link
          href="/portal/login"
          className="inline-flex items-center justify-center transition-opacity hover:opacity-90"
          style={{
            fontFamily: T.mono,
            fontSize: "0.75rem",
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            height: 44,
            paddingInline: 24,
            background: T.primary,
            color: T.primaryFg,
            borderRadius: "10px",
            textDecoration: "none",
          }}
        >
          Subscriber login →
        </Link>

        <Link
          href="/"
          style={{
            fontFamily: T.mono,
            fontSize: "0.75rem",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
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
