"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@nullshift/db/client";
import { T } from "@nullshift/ui/tokens";
import { LogoMark } from "@nullshift/ui/components/Logo";
import { hasSupabaseBrowserConfig } from "@nullshift/db/env";
import { Eyebrow, Display } from "@/components/kyma";
import { Reveal } from "@/components/Reveal";

/* ── Shared input style (KYMA — square, hairline, emerald focus) ── */
const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 44,
  background: "var(--k-surface)",
  border: "1px solid var(--k-border)",
  borderRadius: 0,
  padding: "0 14px",
  color: "var(--k-fg)",
  fontFamily: T.sans,
  fontSize: "0.9375rem",
  letterSpacing: "-0.005em",
  outline: "none",
  transition: `border-color ${T.duration.base} ${T.ease}, box-shadow ${T.duration.base} ${T.ease}`,
};

const labelStyle: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: "0.66rem",
  fontWeight: 500,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--k-muted)",
};

function onFocus(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = T.primary;
  e.currentTarget.style.boxShadow = T.shadow.focus;
}
function onBlur(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = "var(--k-border)";
  e.currentTarget.style.boxShadow = "none";
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/portal";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!hasSupabaseBrowserConfig()) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.replace(next);
    });
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
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed.");
      setBusy(false);
    }
  }

  if (!hasSupabaseBrowserConfig()) {
    return (
      <p style={{ fontFamily: T.sans, color: "var(--k-muted)" }}>Auth not configured.</p>
    );
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: "var(--k-bg)" }}
    >
      <Reveal className="w-full max-w-sm">
        {/* Brand */}
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <LogoMark size={26} />
          <span
            style={{
              fontFamily: T.display,
              fontWeight: 700,
              fontSize: "1.1rem",
              letterSpacing: "-0.01em",
              textTransform: "uppercase",
              color: "var(--k-fg)",
            }}
          >
            Nullshift
          </span>
        </div>

        {/* Eyebrow + title */}
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <Eyebrow index="01" label="Client Portal" align="center" />
          <Display as="h1" size="md">
            Sign in
          </Display>
        </div>

        {/* Card */}
        <form
          onSubmit={onSubmit}
          className="k-kard flex flex-col gap-4 p-8"
          style={{ background: "var(--k-surface)" }}
        >
          <div className="flex flex-col gap-1.5">
            <label style={labelStyle}>Email</label>
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
            <label style={labelStyle}>Password</label>
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
            <p
              style={{
                fontFamily: T.mono,
                fontSize: "0.7rem",
                letterSpacing: "0.04em",
                color: T.danger,
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="kb kb-primary mt-2"
            style={{ width: "100%", opacity: busy ? 0.6 : 1 }}
          >
            {busy ? "Signing in…" : "Sign in"}
            <span className="k-arrow" aria-hidden>
              →
            </span>
          </button>
        </form>

        <div className="mt-6 text-center flex flex-col gap-3">
          <Link
            href="/portal/signup"
            style={{
              fontFamily: T.mono,
              fontSize: "0.68rem",
              fontWeight: 500,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--k-accent)",
              textDecoration: "none",
            }}
          >
            New client? Create an account →
          </Link>
          <Link
            href="/"
            style={{
              fontFamily: T.mono,
              fontSize: "0.66rem",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--k-muted)",
              textDecoration: "none",
            }}
          >
            ← Back to website
          </Link>
        </div>
      </Reveal>
    </main>
  );
}

export default function PortalLoginPage() {
  return (
    <Suspense
      fallback={<div style={{ minHeight: "100vh", background: "var(--k-bg)" }} />}
    >
      <LoginForm />
    </Suspense>
  );
}
