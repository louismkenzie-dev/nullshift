import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveSubscription } from "@/lib/subscriptions";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/env";
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
  if (!hasSupabaseBrowserConfig()) {
    return <SetupScreen />;
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/learn/login?next=%2Flearn");
  }
  const subscription = await getActiveSubscription();
  const userRank = subscription ? TIER_RANK[subscription.tier] : 0;

  return (
    <div
      className="px-6 md:px-10 py-10"
      style={{
        background:
          "radial-gradient(circle at top right, color-mix(in oklab, var(--color-primary) 12%, transparent) 0%, transparent 34%), radial-gradient(circle at left 18%, color-mix(in oklab, var(--color-info) 8%, transparent) 0%, transparent 28%)",
      }}
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-10">
          <div
            className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full"
            style={{
              fontFamily: T.mono,
              fontSize: "10px",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: T.primary,
              background: `${T.primary}12`,
              border: `1px solid ${T.primary}24`,
            }}
          >
            <span className="size-1.5 rounded-full" style={{ background: T.primary }} />
            <span>Learn / Dashboard</span>
          </div>
          <h1
            style={{
              fontFamily: T.display,
              fontWeight: 600,
              fontSize: "clamp(2.5rem,5vw,4.5rem)",
              lineHeight: 1.04,
              letterSpacing: "-0.03em",
              color: T.fg,
            }}
          >
            Welcome back
            {user?.email && (
              <span style={{ color: T.muted, display: "block", fontSize: "clamp(1.15rem,2.2vw,1.75rem)", marginTop: "0.5rem" }}>
                {user.email.split("@")[0]}
              </span>
            )}
          </h1>
        </div>

        <div className="grid gap-4 md:grid-cols-3 mb-10">
          <StatTile label="Access tier" value={subscription?.tier ?? "None"} tone="primary" />
          <StatTile label="Courses" value="3" tone="neutral" />
          <StatTile label="Status" value={subscription ? "Active" : "Locked"} tone={subscription ? "success" : "warning"} />
        </div>

        {/* Course grid */}
        <div
          className="mb-4"
          style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.16em", textTransform: "uppercase", color: T.muted }}
        >
          Your courses
        </div>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {courses.map((course) => {
          const locked = TIER_RANK[course.tier] > userRank;
          return (
            <div
              key={course.slug}
              className="flex flex-col gap-4 p-6 rounded-2xl"
              style={{
                border: `1px solid ${locked ? T.border : T.borderStr}`,
                background: locked ? T.surface : T.surface,
                boxShadow: T.shadow.md,
                opacity: locked ? 0.7 : 1,
              }}
            >
              <div className="h-1 rounded-full" style={{ background: locked ? T.borderStr : T.primary }} />
              {locked && (
                <span
                  style={{
                    fontFamily: T.mono,
                    fontSize: "9px",
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: T.muted,
                    background: T.surface2,
                    border: `1px solid ${T.borderStr}`,
                    padding: "3px 10px",
                    borderRadius: T.r.full,
                    alignSelf: "flex-start",
                  }}
                >
                  {course.tier.toUpperCase()}+ REQUIRED
                </span>
              )}
              <div>
                <h2
                  style={{
                    fontFamily: T.display,
                    fontWeight: 600,
                    fontSize: "1.25rem",
                    letterSpacing: "-0.02em",
                    color: T.fg,
                    marginBottom: "8px",
                  }}
                >
                  {course.title}
                </h2>
                <p style={{ fontFamily: T.sans, fontSize: "0.9375rem", lineHeight: 1.55, color: T.muted }}>
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
                    fontSize: "0.75rem",
                    letterSpacing: "0.06em",
                    color: T.fg,
                    border: `1px solid ${T.borderStr}`,
                    background: T.elevated,
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
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                    background: T.primary,
                    color: T.primaryFg,
                    borderRadius: T.r.md,
                    boxShadow: `0 0 20px color-mix(in oklab, ${T.primary} 20%, transparent)`,
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
    </div>
  );
}

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "primary" | "success" | "warning" | "neutral";
}) {
  const accent =
    tone === "primary"
      ? T.primary
      : tone === "success"
        ? "#2BE08C"
        : tone === "warning"
          ? T.accent
          : T.borderStr;

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        boxShadow: T.shadow.sm,
      }}
    >
      <div
        style={{
          fontFamily: T.mono,
          fontSize: "10px",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: T.muted,
          marginBottom: "10px",
        }}
      >
        {label}
      </div>
      <div style={{ fontFamily: T.display, fontWeight: 600, fontSize: "1.35rem", color: accent, letterSpacing: "-0.02em" }}>
        {value}
      </div>
    </div>
  );
}

function SetupScreen() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6" style={{ background: T.bg }}>
      <div className="text-center max-w-md">
        <div
          style={{
            fontFamily: T.mono,
            fontSize: "10px",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "#f87171",
            marginBottom: "16px",
          }}
        >
          SETUP_REQUIRED
        </div>
        <h1 style={{ fontFamily: T.display, fontWeight: 900, fontSize: "2rem", color: T.fg, marginBottom: "12px" }}>
          NOT CONFIGURED
        </h1>
        <p style={{ fontFamily: T.sans, fontSize: "0.9rem", color: T.muted }}>
          Supabase environment variables are missing. Add them to <code>.env.local</code> and restart.
        </p>
      </div>
    </main>
  );
}
