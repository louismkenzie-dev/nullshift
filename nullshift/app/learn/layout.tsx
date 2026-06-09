import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveSubscription } from "@/lib/subscriptions";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/env";
import { LearnNav } from "./_components/LearnNav";
import { T } from "@/lib/tokens";

export default async function LearnLayout({ children }: { children: React.ReactNode }) {
  if (!hasSupabaseBrowserConfig()) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6" style={{ background: T.bg }}>
        <div className="text-center max-w-md">
          <div style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: "#f87171", marginBottom: "16px" }}>
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

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/learn/login");
  }

  const subscription = await getActiveSubscription();

  if (!subscription) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6" style={{ background: T.bg }}>
        <div
          className="w-full max-w-md p-10 rounded-2xl flex flex-col gap-6"
          style={{ background: T.surface, border: `1px solid ${T.border}` }}
        >
          <div style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: T.primary }}>
            SUBSCRIPTION_REQUIRED
          </div>
          <h1 style={{ fontFamily: T.display, fontWeight: 900, fontSize: "2rem", lineHeight: 1, color: T.fg }}>
            ACCESS THE<br /><span style={{ color: T.primary }}>COURSE LIBRARY</span>
          </h1>
          <p style={{ fontFamily: T.sans, fontSize: "0.9rem", lineHeight: 1.65, color: T.muted }}>
            You&apos;re logged in as <span style={{ color: T.fg }}>{user.email}</span>, but you don&apos;t have an active subscription. Pick a plan to unlock the course content.
          </p>
          <a
            href="/pricing"
            className="inline-flex items-center justify-between px-5 h-11 transition-opacity hover:opacity-90"
            style={{
              fontFamily: T.mono,
              fontSize: "0.75rem",
              fontWeight: 600,
              letterSpacing: "0.06em",
              background: T.primary,
              color: T.primaryFg,
              borderRadius: T.r.md,
              boxShadow: `0 0 20px color-mix(in oklab, ${T.primary} 25%, transparent)`,
            }}
          >
            <span>View plans</span>
            <span>→</span>
          </a>
          <a
            href="/"
            style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: T.muted, textAlign: "center" }}
          >
            ← Back to website
          </a>
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
