import { createClient } from "@/lib/supabase/server";
import { getActiveSubscription } from "@/lib/subscriptions";
import { T } from "@/lib/tokens";
import Link from "next/link";

const courses = [
  {
    slug: "ai-fundamentals",
    title: "AI Fundamentals",
    description: "Understand how modern AI tools work, where they're headed, and how to evaluate them for your workflow.",
    lessons: 8,
    duration: "~3 hours",
    tier: "core" as const,
    progress: 0,
  },
  {
    slug: "workflow-automation",
    title: "Workflow Automation",
    description: "Connect your tools, eliminate repetitive tasks, and build automated systems that run without you.",
    lessons: 10,
    duration: "~4.5 hours",
    tier: "grow" as const,
    progress: 0,
  },
  {
    slug: "prompt-engineering",
    title: "Prompt Engineering",
    description: "Get consistently great output from AI. Learn the patterns, structures, and techniques that actually work.",
    lessons: 6,
    duration: "~2 hours",
    tier: "core" as const,
    progress: 0,
  },
];

const TIER_RANK = { core: 1, grow: 2, pro: 3, partner: 4 } as const;

export default async function LearnDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const subscription = await getActiveSubscription();
  const userRank = subscription ? TIER_RANK[subscription.tier] : 0;

  return (
    <div className="px-8 md:px-12 py-10">
      {/* Header */}
      <div className="mb-10">
        <div
          className="flex items-center gap-2 mb-3"
          style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: T.primary }}
        >
          <span className="size-1.5 rounded-full pulse-dot" style={{ background: T.primary }} />
          <span>LEARN / DASHBOARD</span>
        </div>
        <h1
          style={{
            fontFamily: T.display,
            fontWeight: 900,
            fontSize: "clamp(2.5rem,5vw,4rem)",
            lineHeight: 0.95,
            letterSpacing: "-0.02em",
            color: T.fg,
          }}
        >
          WELCOME BACK
          {user?.email && (
            <span style={{ color: T.muted, display: "block", fontSize: "clamp(1.2rem,2.5vw,1.8rem)", marginTop: "0.4rem" }}>
              {user.email.split("@")[0].toUpperCase()}
            </span>
          )}
        </h1>
      </div>

      {/* Course grid */}
      <div
        className="mb-4"
        style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.16em", textTransform: "uppercase", color: T.muted }}
      >
        YOUR COURSES
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {courses.map((course) => {
          const locked = TIER_RANK[course.tier] > userRank;
          return (
            <div
              key={course.slug}
              className="flex flex-col gap-4 p-6 rounded-xl"
              style={{
                border: `1px solid ${locked ? T.border : T.border}`,
                background: locked ? T.bg : T.surface,
                opacity: locked ? 0.55 : 1,
              }}
            >
              {locked && (
                <span
                  style={{
                    fontFamily: T.mono,
                    fontSize: "9px",
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: T.muted,
                    background: T.surface2,
                    border: `1px solid ${T.border}`,
                    padding: "2px 8px",
                    borderRadius: T.r.full,
                    alignSelf: "flex-start",
                  }}
                >
                  🔒 {course.tier.toUpperCase()}+ REQUIRED
                </span>
              )}
              <div>
                <h2
                  style={{
                    fontFamily: T.display,
                    fontWeight: 700,
                    fontSize: "1.25rem",
                    letterSpacing: "-0.015em",
                    color: T.fg,
                    marginBottom: "8px",
                  }}
                >
                  {course.title}
                </h2>
                <p style={{ fontFamily: T.sans, fontSize: "0.875rem", lineHeight: 1.6, color: T.muted }}>
                  {course.description}
                </p>
              </div>
              <div className="flex items-center gap-4 mt-auto">
                <span style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.08em", color: T.muted }}>
                  {course.lessons} lessons · {course.duration}
                </span>
              </div>
              {locked ? (
                <Link
                  href="/pricing"
                  className="flex items-center justify-between px-4 h-10 rounded-lg transition-opacity hover:opacity-80"
                  style={{
                    fontFamily: T.mono,
                    fontSize: "0.7rem",
                    letterSpacing: "0.06em",
                    color: T.muted,
                    border: `1px solid ${T.border}`,
                  }}
                >
                  <span>Upgrade to unlock</span>
                  <span>→</span>
                </Link>
              ) : (
                <Link
                  href={`/learn/${course.slug}`}
                  className="flex items-center justify-between px-4 h-10 rounded-lg transition-opacity hover:opacity-90"
                  style={{
                    fontFamily: T.mono,
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                    background: T.primary,
                    color: T.primaryFg,
                    borderRadius: T.r.md,
                    boxShadow: `0 0 16px color-mix(in oklab, ${T.primary} 20%, transparent)`,
                  }}
                >
                  <span>Start course</span>
                  <span>→</span>
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
