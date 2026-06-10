"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { T } from "@/lib/tokens";
import { LogoMark } from "@/components/Logo";
import type { SubscriptionTier } from "@/lib/subscriptions";

const TIER_LABEL: Record<SubscriptionTier, string> = {
  core: "CORE",
  grow: "GROW",
  pro: "PRO",
  partner: "PARTNER",
};

const courses = [
  { slug: "ai-fundamentals", title: "AI Fundamentals" },
  { slug: "workflow-automation", title: "Workflow Automation" },
  { slug: "prompt-engineering", title: "Prompt Engineering" },
];

interface LearnNavProps {
  tier: SubscriptionTier;
  email: string;
}

export function LearnNav({ tier, email }: LearnNavProps) {
  const pathname = usePathname();

  return (
    <aside
      className="flex flex-col h-screen sticky top-0 w-72 shrink-0"
      style={{
        background:
          "linear-gradient(180deg, color-mix(in oklab, var(--color-surface) 96%, transparent) 0%, color-mix(in oklab, var(--color-background) 18%, var(--color-surface)) 100%)",
        borderRight: `1px solid ${T.border}`,
        boxShadow: T.shadow.md,
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-2.5 px-6 h-16"
        style={{ borderBottom: `1px solid ${T.border}` }}
      >
        <Link href="/" className="flex items-center gap-2.5">
          <LogoMark size={22} />
          <span style={{ fontFamily: T.display, fontWeight: 900, fontSize: "1rem", letterSpacing: "0.04em", color: T.fg }}>
            NULLSHIFT
          </span>
        </Link>
      </div>

      {/* Tier badge */}
      <div className="px-6 py-5" style={{ borderBottom: `1px solid ${T.border}` }}>
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full"
            style={{
              fontFamily: T.mono,
              fontSize: "10px",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: T.primary,
              background: `${T.primary}12`,
              border: `1px solid ${T.primary}24`,
            }}
          >
            <span className="size-1.5 rounded-full" style={{ background: T.primary }} />
            {TIER_LABEL[tier]}
          </span>
        </div>
        <p
          className="mt-2 truncate"
          style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.04em", color: T.muted }}
        >
          {email}
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-4 py-4">
        <div
          className="px-2 mb-2"
          style={{ fontFamily: T.mono, fontSize: "9px", letterSpacing: "0.16em", textTransform: "uppercase", color: T.muted }}
        >
          COURSES
        </div>
        {courses.map((course) => {
          const active = pathname.startsWith(`/learn/${course.slug}`);
          return (
            <Link
              key={course.slug}
              href={`/learn/${course.slug}`}
              className="flex items-center gap-3 px-3 py-3 rounded-xl mb-1 transition-colors"
              style={{
                fontFamily: T.sans,
                fontSize: "0.875rem",
                fontWeight: active ? 600 : 400,
                color: active ? T.fg : T.muted,
                background: active ? T.surface2 : "transparent",
                border: active ? `1px solid ${T.border}` : "1px solid transparent",
                letterSpacing: "-0.005em",
              }}
            >
              <span
                className="size-2 rounded-full shrink-0"
                style={{ background: active ? T.primary : T.border }}
              />
              {course.title}
            </Link>
          );
        })}

        <div
          className="px-2 mt-6 mb-2"
          style={{ fontFamily: T.mono, fontSize: "9px", letterSpacing: "0.16em", textTransform: "uppercase", color: T.muted }}
        >
          ACCOUNT
        </div>
        <Link
          href="/learn"
          className="flex items-center gap-3 px-3 py-3 rounded-xl mb-1 transition-colors"
          style={{
            fontFamily: T.sans,
            fontSize: "0.875rem",
            fontWeight: pathname === "/learn" ? 600 : 400,
            color: pathname === "/learn" ? T.fg : T.muted,
            background: pathname === "/learn" ? T.surface2 : "transparent",
            border: pathname === "/learn" ? `1px solid ${T.border}` : "1px solid transparent",
          }}
        >
          <span className="size-2 rounded-full shrink-0" style={{ background: pathname === "/learn" ? T.primary : T.border }} />
          Dashboard
        </Link>
      </nav>

      {/* Sign out */}
      <div className="px-4 py-4" style={{ borderTop: `1px solid ${T.border}` }}>
        <form action="/api/auth/signout" method="post">
          <button
            type="submit"
            className="w-full flex items-center justify-between px-4 h-10 rounded-lg transition-opacity hover:opacity-80"
            style={{
              fontFamily: T.mono,
              fontSize: "10px",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: T.muted,
              border: `1px solid ${T.borderStr}`,
              background: T.surface,
            }}
          >
            <span>Sign out</span>
            <span>→</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
