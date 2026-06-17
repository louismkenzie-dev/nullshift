import { redirect } from "next/navigation";
import { createClient } from "@nullshift/db";
import { hasSupabaseBrowserConfig } from "@nullshift/db/env";
import { T } from "@nullshift/ui/tokens";
import Link from "next/link";

export default async function LearnDashboard() {
  if (hasSupabaseBrowserConfig()) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      redirect("/learn/login?next=%2Flearn");
    }
  }

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
          fontWeight: 600,
          fontSize: "clamp(2.6rem, 6vw, 4rem)",
          lineHeight: 1.04,
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
          We&apos;re building the course library right now. Your subscription is active — you&apos;ll be the first to know when it goes live.
        </p>

        {/* Divider */}
        <div style={{ width: "40px", height: "2px", background: T.primary, borderRadius: T.r.md }} />

        {/* Back link */}
        <Link
          href="/"
          style={{
            fontFamily: T.mono,
            fontSize: "0.75rem",
            fontWeight: 600,
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
