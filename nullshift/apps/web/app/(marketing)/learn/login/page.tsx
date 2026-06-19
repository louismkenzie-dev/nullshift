"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@nullshift/db/client";
import { T } from "@nullshift/ui/tokens";
import { LogoMark } from "@nullshift/ui/components/Logo";
import { hasSupabaseBrowserConfig } from "@nullshift/db/env";

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 40,
  background: T.bg,
  border: `1px solid ${T.border}`,
  borderRadius: T.r.md,
  padding: "0 14px",
  color: T.fg,
  fontFamily: T.sans,
  fontSize: "0.9375rem",
  letterSpacing: "-0.005em",
  outline: "none",
  transition: `border-color ${T.duration.base} ${T.ease}, box-shadow ${T.duration.base} ${T.ease}`,
};
function onFocus(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = T.primary;
  e.currentTarget.style.boxShadow = T.shadow.focus;
}
function onBlur(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = T.border;
  e.currentTarget.style.boxShadow = "none";
}

export default function LearnLoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: T.bg }} />}>
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
      if (!cancelled && user) router.replace(next);
    });
    return () => {
      cancelled = true;
    };
  }, [next, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) throw signInError;

      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("user_id", user?.id ?? "")
        .eq("status", "active")
        .maybeSingle();

      if (!sub) {
        const tier = (user?.app_metadata?.subscription_tier as string | undefined) ?? "";
        router.replace(
          tier ? `/onboard?plan=${encodeURIComponent(tier)}&confirmed=true` : "/pricing"
        );
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
      <main
        className="min-h-screen flex items-center justify-center px-6"
        style={{ background: T.bg }}
      >
        <p style={{ fontFamily: T.sans, color: T.muted }}>Supabase not configured.</p>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: T.bg }}
    >
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <LogoMark size={26} />
          <span
            style={{
              fontFamily: T.display,
              fontWeight: 600,
              fontSize: "1.1rem",
              letterSpacing: "-0.01em",
              color: T.fg,
            }}
          >
            Nullshift
          </span>
        </div>

        {/* Eyebrow */}
        <div className="mb-6 text-center">
          <span
            className="inline-flex items-center gap-2"
            style={{
              fontFamily: T.sans,
              fontSize: "0.75rem",
              fontWeight: 500,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: T.muted,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: T.primary,
                boxShadow: `0 0 0 4px ${T.primarySoft}`,
                display: "inline-block",
              }}
            />
            Learn portal — sign in
          </span>
        </div>

        <form
          onSubmit={onSubmit}
          className="flex flex-col gap-4 p-8 rounded-2xl"
          style={{
            background: T.surface,
            border: `1px solid ${T.border}`,
            boxShadow: T.shadow.md,
          }}
        >
          <div className="flex flex-col gap-1.5">
            <label
              style={{
                fontFamily: T.sans,
                fontSize: "0.75rem",
                fontWeight: 500,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: T.muted,
              }}
            >
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
              autoComplete="email"
              onFocus={onFocus}
              onBlur={onBlur}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              style={{
                fontFamily: T.sans,
                fontSize: "0.75rem",
                fontWeight: 500,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: T.muted,
              }}
            >
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
              autoComplete="current-password"
              onFocus={onFocus}
              onBlur={onBlur}
            />
          </div>

          {error && (
            <p style={{ fontFamily: T.sans, fontSize: "0.8125rem", color: T.danger }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-2 h-10 font-medium cursor-pointer"
            style={{
              width: "100%",
              fontFamily: T.sans,
              fontSize: "0.9375rem",
              fontWeight: 500,
              letterSpacing: "-0.005em",
              background: T.primary,
              color: T.primaryFg,
              borderRadius: T.r.md,
              border: "none",
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18)`,
              transition: `background ${T.duration.base} ${T.ease}`,
              opacity: busy ? 0.6 : 1,
            }}
            onMouseEnter={(e) => {
              if (!busy)
                (e.currentTarget as HTMLElement).style.background = T.primaryHover;
            }}
            onMouseLeave={(e) => {
              if (!busy) (e.currentTarget as HTMLElement).style.background = T.primary;
            }}
          >
            {busy ? "Signing in…" : "Sign in →"}
          </button>
        </form>

        <div className="mt-6 text-center flex flex-col gap-3">
          <Link
            href="/pricing"
            style={{
              fontFamily: T.sans,
              fontSize: "0.8125rem",
              fontWeight: 500,
              color: T.primary,
              textDecoration: "none",
            }}
          >
            Don&apos;t have a subscription? View plans →
          </Link>
          <Link
            href="/"
            style={{
              fontFamily: T.sans,
              fontSize: "0.8125rem",
              color: T.muted,
              textDecoration: "none",
            }}
          >
            ← Back to website
          </Link>
        </div>
      </div>
    </main>
  );
}
