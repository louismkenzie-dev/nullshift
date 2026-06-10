import { createClient } from "@/lib/supabase/server";
import { getActiveSubscription } from "@/lib/subscriptions";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/env";
import { LearnNav } from "./_components/LearnNav";
import { T } from "@/lib/tokens";
import Link from "next/link";

const PLAN_CHOICES = [
  {
    tier: "core",
    label: "Core",
    description: "Full course library access for self-paced learning.",
  },
  {
    tier: "grow",
    label: "Grow",
    description: "Adds live support and quicker help while you test.",
  },
  {
    tier: "pro",
    label: "Pro",
    description: "Best for full dashboard testing and premium access.",
  },
  {
    tier: "partner",
    label: "Partner",
    description: "Highest access tier for internal or client demos.",
  },
] as const;

export default async function LearnLayout({ children }: { children: React.ReactNode }) {
  if (!hasSupabaseBrowserConfig()) {
    return <>{children}</>;
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return <>{children}</>;
  }

  const subscription = await getActiveSubscription();

  if (!subscription) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6" style={{ background: T.bg }}>
        <div className="w-full max-w-3xl">
          <div className="mb-8 text-center">
            <div
              style={{
                fontFamily: T.mono,
                fontSize: "10px",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: T.primary,
                marginBottom: "14px",
              }}
            >
              SUBSCRIPTION_REQUIRED
            </div>
            <h1 style={{ fontFamily: T.display, fontWeight: 900, fontSize: "clamp(2rem, 4vw, 3rem)", lineHeight: 1, color: T.fg }}>
              CHOOSE A PLAN TO UNLOCK THE
              <span style={{ color: T.primary, display: "block" }}>COURSE DASHBOARD</span>
            </h1>
            <p style={{ fontFamily: T.sans, fontSize: "0.95rem", lineHeight: 1.65, color: T.muted, marginTop: "16px" }}>
              You&apos;re signed in as <span style={{ color: T.fg }}>{user.email}</span>. For testing, skip payment and assign this account to a plan here.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {PLAN_CHOICES.map((plan, index) => (
              <form key={plan.tier} action="/api/learn/subscribe" method="post">
                <input type="hidden" name="tier" value={plan.tier} />
                <input type="hidden" name="next" value="/learn" />
                <button
                  type="submit"
                  className="w-full text-left p-6 rounded-2xl transition-transform hover:scale-[1.01] hover:opacity-95"
                  style={{
                    background: T.surface,
                    border: `1px solid ${index === 2 ? T.primary : T.border}`,
                    boxShadow: index === 2 ? `0 0 24px color-mix(in oklab, ${T.primary} 16%, transparent)` : "none",
                  }}
                >
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <div>
                      <div
                        style={{
                          fontFamily: T.mono,
                          fontSize: "10px",
                          letterSpacing: "0.16em",
                          textTransform: "uppercase",
                          color: index === 2 ? T.primary : T.muted,
                        }}
                      >
                        {plan.tier.toUpperCase()}
                      </div>
                      <h2 style={{ fontFamily: T.display, fontWeight: 800, fontSize: "1.5rem", color: T.fg, marginTop: "6px" }}>
                        {plan.label}
                      </h2>
                    </div>
                    <span style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: T.primary }}>
                      SELECT
                    </span>
                  </div>
                  <p style={{ fontFamily: T.sans, fontSize: "0.9rem", lineHeight: 1.65, color: T.muted }}>
                    {plan.description}
                  </p>
                </button>
              </form>
            ))}
          </div>

          <div className="mt-8 text-center">
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center px-5 h-11 transition-opacity hover:opacity-80"
              style={{
                fontFamily: T.mono,
                fontSize: "0.75rem",
                fontWeight: 600,
                letterSpacing: "0.06em",
                color: T.muted,
                border: `1px solid ${T.border}`,
                borderRadius: T.r.md,
              }}
            >
              View pricing page
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen" style={{ background: T.bg }}>
      <LearnNav tier={subscription.tier} email={user.email ?? ""} />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
