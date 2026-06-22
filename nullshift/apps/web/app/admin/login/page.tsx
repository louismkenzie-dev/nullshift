"use client";

import { Suspense, useState } from "react";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@nullshift/db/client";
import { T } from "@nullshift/ui/tokens";
import { LogoMark } from "@nullshift/ui/components/Logo";
import { Eyebrow, Reveal } from "@/components/kyma";
import {
  hasSupabaseBrowserConfig,
  getMissingSupabaseBrowserEnv,
} from "@nullshift/db/env";

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={<div style={{ minHeight: "100vh", background: "var(--k-bg)" }} />}
    >
      <AdminLogin />
    </Suspense>
  );
}

const monoLabel: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: "0.66rem",
  fontWeight: 500,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--k-muted)",
};

function AdminLogin() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/admin";
  const setupMode = params.get("setup") === "1" || !hasSupabaseBrowserConfig();
  const missing = getMissingSupabaseBrowserEnv();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
      setBusy(false);
    }
  }

  const inputStyle = (name: string): React.CSSProperties => ({
    background: "var(--k-surface)",
    border: "1px solid var(--k-border)",
    padding: "12px 16px",
    color: "var(--k-fg)",
    fontFamily: T.mono,
    fontSize: "0.9rem",
    letterSpacing: "0.02em",
    outline: "none",
    borderRadius: 0,
    boxShadow: focused === name ? "var(--focus-ring)" : undefined,
    borderColor: focused === name ? "var(--k-accent)" : "var(--k-border)",
    transition: "border-color 150ms ease, box-shadow 150ms ease",
  });

  return (
    <main
      className="min-h-screen flex items-center justify-center px-6 relative"
      style={{ background: "var(--k-bg)" }}
    >
      <div
        aria-hidden
        className="k-vgrid pointer-events-none absolute inset-0"
        style={{ opacity: 0.5 }}
      />
      <Reveal className="w-full max-w-sm relative">
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <LogoMark size={26} />
          <span
            style={{
              fontFamily: T.sans,
              fontWeight: 700,
              fontSize: "1.3rem",
              letterSpacing: "-0.02em",
              textTransform: "uppercase",
              color: "var(--k-fg)",
            }}
          >
            Nullshift
          </span>
        </div>
        <div className="mb-6 flex justify-center">
          <Eyebrow index="ADMIN" label="SECURE_LOGIN" align="center" />
        </div>
        {setupMode ? (
          <div
            className="k-kard flex flex-col gap-4 p-8"
            style={{ background: "var(--k-surface)" }}
          >
            <div
              style={{
                fontFamily: T.mono,
                fontSize: "0.66rem",
                fontWeight: 500,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: T.danger,
              }}
            >
              SUPABASE_SETUP_REQUIRED
            </div>
            <p
              style={{
                fontFamily: T.sans,
                fontSize: "0.95rem",
                lineHeight: 1.6,
                color: "var(--k-muted)",
              }}
            >
              The admin login screen is ready, but the Supabase runtime variables are
              missing, so the form cannot connect yet.
            </p>
            <p
              style={{
                fontFamily: T.mono,
                fontSize: "0.66rem",
                letterSpacing: "0.08em",
                color: "var(--k-muted)",
              }}
            >
              Missing: {missing.join(", ")}
            </p>
            <div style={{ fontFamily: T.sans, fontSize: "0.9rem", color: "var(--k-fg)" }}>
              Add the values from your Supabase project to <code>.env.local</code>,
              restart <code>npm run dev</code>, then come back here.
            </div>
            <a href="/" className="kb kb-primary mt-2">
              Back Home
            </a>
          </div>
        ) : (
          <form
            onSubmit={onSubmit}
            className="k-kard flex flex-col gap-3 p-8"
            style={{ background: "var(--k-surface)" }}
          >
            <label style={monoLabel}>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setFocused("email")}
              onBlur={() => setFocused(null)}
              style={inputStyle("email")}
              autoComplete="email"
            />
            <label className="mt-2" style={monoLabel}>
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setFocused("password")}
              onBlur={() => setFocused(null)}
              style={inputStyle("password")}
              autoComplete="current-password"
            />
            {error && (
              <p
                style={{
                  fontFamily: T.mono,
                  fontSize: "0.7rem",
                  letterSpacing: "0.04em",
                  color: T.danger,
                  marginTop: "4px",
                }}
              >
                {error}
              </p>
            )}
            <SubmitButton
              disabled={busy}
              className="kb kb-primary mt-4 disabled:opacity-50"
            >
              {busy ? "Signing in…" : "Sign in →"}
            </SubmitButton>
          </form>
        )}
        <a
          href="/"
          className="mt-4 h-10 flex items-center justify-center transition-opacity hover:opacity-80"
          style={{
            fontFamily: T.mono,
            fontSize: "0.66rem",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--k-muted)",
          }}
        >
          ← Back to website
        </a>
      </Reveal>
    </main>
  );
}
