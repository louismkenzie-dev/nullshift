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
      className="flex flex-col h-screen sticky top-0 w-64 shrink-0"
      style={{ background: T.surface, borderRight: `1px solid ${T.border}` }}
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
      <div className="px-6 py-4" style={{ borderBottom: `1px solid ${T.border}` }}>
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
            style={{
              fontFamily: T.mono,
              fontSize: "9px",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: T.primary,
              background: `${T.primary}15`,
              border: `1px solid ${T.primary}30`,
            }}
          >
            <span className="size-1.5 rounded-full" style={{ background: T.primary }} />
            {TIER_LABEL[tier]}
          </span>
        </div>
        <p
          className="mt-1.5 truncate"
          style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.04em", color: T.muted }}
        >
          {email}
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div
          className="px-3 mb-2"
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
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg mb-1 transition-colors"
              style={{
                fontFamily: T.sans,
                fontSize: "0.875rem",
                fontWeight: active ? 500 : 400,
                color: active ? T.fg : T.muted,
                background: active ? T.surface2 : "transparent",
                letterSpacing: "-0.005em",
              }}
            >
              <span
                className="size-1.5 rounded-full shrink-0"
                style={{ background: active ? T.primary : T.border }}
              />
              {course.title}
            </Link>
          );
        })}

        <div
          className="px-3 mt-6 mb-2"
          style={{ fontFamily: T.mono, fontSize: "9px", letterSpacing: "0.16em", textTransform: "uppercase", color: T.muted }}
        >
          ACCOUNT
        </div>
        <Link
          href="/learn"
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg mb-1 transition-colors"
          style={{
            fontFamily: T.sans,
            fontSize: "0.875rem",
            color: pathname === "/learn" ? T.fg : T.muted,
            background: pathname === "/learn" ? T.surface2 : "transparent",
          }}
        >
          <span className="size-1.5 rounded-full shrink-0" style={{ background: pathname === "/learn" ? T.primary : T.border }} />
          Dashboard
        </Link>
      </nav>

      {/* Sign out */}
      <div className="px-4 py-4" style={{ borderTop: `1px solid ${T.border}` }}>
        <form action="/api/auth/signout" method="post">
          <button
            type="submit"
            className="w-full flex items-center justify-between px-4 h-9 rounded-lg transition-opacity hover:opacity-80"
            style={{
              fontFamily: T.mono,
              fontSize: "10px",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: T.muted,
              border: `1px solid ${T.border}`,
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
