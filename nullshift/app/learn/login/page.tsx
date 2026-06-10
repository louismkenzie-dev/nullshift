"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { T } from "@/lib/tokens";
import { LogoMark } from "@/components/Logo";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/env";

function LoginSkeleton() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6" style={{ background: T.bg }}>
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <LogoMark size={26} />
          <span style={{ fontFamily: T.display, fontWeight: 900, fontSize: "1.3rem", letterSpacing: "0.02em", color: T.fg }}>NULLSHIFT</span>
        </div>
        <div className="mb-6 text-center" style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: T.primary }}>
          LEARN_PORTAL / SIGN_IN
        </div>
        <div className="flex flex-col gap-3 p-8 rounded-2xl" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
          <div className="h-3 w-12 rounded" style={{ background: T.border }} />
          <div className="h-11 rounded" style={{ background: T.bg, border: `1px solid ${T.border}` }} />
          <div className="h-3 w-16 rounded mt-2" style={{ background: T.border }} />
          <div className="h-11 rounded" style={{ background: T.bg, border: `1px solid ${T.border}` }} />
          <div className="h-11 rounded mt-4" style={{ background: `${T.primary}40` }} />
        </div>
      </div>
    </main>
  );
}

export default function LearnLoginPage() {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LearnLogin />
    </Suspense>
  );
}

function LearnLogin() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/learn";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!hasSupabaseBrowserConfig()) return;

    const supabase = createClient();
    let cancelled = false;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!cancelled && user) {
        router.replace(next);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [next, router]);

  const inputStyle: React.CSSProperties = {
    background: T.bg,
    border: `1px solid ${T.border}`,
    padding: "12px 16px",
    color: T.fg,
    fontFamily: T.sans,
    fontSize: "0.9375rem",
    outline: "none",
    borderRadius: T.r.sm,
    letterSpacing: "-0.005em",
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;

      // Check whether this user already has an active subscription.
      // If not, route them to the checkout for the plan stored in their profile
      // (or a generic plan selection page) before they can access the portal.
      const { data: { user } } = await supabase.auth.getUser();
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("user_id", user?.id ?? "")
        .eq("status", "active")
        .maybeSingle();

      if (!sub) {
        // No active subscription — send them to onboarding checkout.
        // Use the tier stored in app_metadata if available, otherwise pricing page.
        const tier = (user?.app_metadata?.subscription_tier as string | undefined) ?? "";
        const dest = tier
          ? `/onboard?plan=${encodeURIComponent(tier)}&confirmed=true`
          : "/pricing";
        router.replace(dest);
      } else {
        router.replace(next);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
      setBusy(false);
    }
  }

  if (!hasSupabaseBrowserConfig()) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6" style={{ background: T.bg }}>
        <p style={{ fontFamily: T.sans, color: T.muted }}>Supabase not configured.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6" style={{ background: T.bg }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <LogoMark size={26} />
          <span style={{ fontFamily: T.display, fontWeight: 900, fontSize: "1.3rem", letterSpacing: "0.02em", color: T.fg }}>
            NULLSHIFT
          </span>
        </div>

        <div
          className="mb-6 text-center"
          style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: T.primary }}
        >
          LEARN_PORTAL / SIGN_IN
        </div>

        <form
          onSubmit={onSubmit}
          className="flex flex-col gap-3 p-8 rounded-2xl"
          style={{ background: T.surface, border: `1px solid ${T.border}` }}
        >
          <label style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: T.muted }}>
            Email
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={inputStyle}
            autoComplete="email"
          />
          <label
            className="mt-2"
            style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: T.muted }}
          >
            Password
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={inputStyle}
            autoComplete="current-password"
          />
          {error && (
            <p style={{ fontFamily: T.mono, fontSize: "11px", color: "#f87171", marginTop: "4px" }}>{error}</p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="mt-4 h-11 font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{
              fontFamily: T.mono,
              fontSize: "0.78rem",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              background: T.primary,
              color: T.primaryFg,
              borderRadius: T.r.md,
              boxShadow: busy ? "none" : `0 0 20px color-mix(in oklab, ${T.primary} 25%, transparent)`,
            }}
          >
            {busy ? "Signing in…" : "Sign in →"}
          </button>
        </form>

        <div className="mt-6 text-center flex flex-col gap-3">
          <Link
            href="/pricing"
            style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: T.primary }}
          >
            Don&apos;t have a subscription? View plans →
          </Link>
          <Link
            href="/"
            style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: T.muted }}
          >
            ← Back to website
          </Link>
        </div>
      </div>
    </main>
  );
}
