"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@nullshift/db/client";
import { T } from "@nullshift/ui/tokens";
import { LogoMark } from "@nullshift/ui/components/Logo";
import { hasSupabaseBrowserConfig } from "@nullshift/db/env";
import { Eyebrow, Display } from "@/components/kyma";
import { Reveal } from "@/components/Reveal";

/**
 * Set-a-new-password page. The admin sends a branded recovery email whose link
 * lands here with a recovery session in the URL — the Supabase browser client
 * picks it up automatically (detectSessionInUrl), then the client sets a new
 * password via updateUser. Used only for clients who've already signed in and
 * forgotten their password (admin can't re-issue a login once they're active).
 */
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

function ResetForm() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  // Wait for the recovery session the link drops in the URL to be picked up.
  useEffect(() => {
    if (!hasSupabaseBrowserConfig()) return;
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const { error: updErr } = await supabase.auth.updateUser({ password });
      if (updErr) throw updErr;
      setDone(true);
      setTimeout(() => router.replace("/portal"), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset your password.");
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

        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <Eyebrow index="01" label="Account Recovery" align="center" />
          <Display as="h1" size="md">
            Set a new password
          </Display>
        </div>

        {done ? (
          <p
            className="k-kard text-center p-8"
            style={{
              background: "var(--k-surface)",
              fontFamily: T.sans,
              fontSize: "0.9rem",
              color: "var(--k-accent)",
            }}
          >
            Password updated — taking you to your portal…
          </p>
        ) : !ready ? (
          <p
            className="k-kard text-center p-8"
            style={{
              background: "var(--k-surface)",
              fontFamily: T.sans,
              fontSize: "0.875rem",
              color: "var(--k-muted)",
            }}
          >
            Opening your secure reset link… If nothing happens, the link may have expired
            — ask us to send a new one.
          </p>
        ) : (
          <form
            onSubmit={onSubmit}
            className="k-kard flex flex-col gap-4 p-8"
            style={{ background: "var(--k-surface)" }}
          >
            <div className="flex flex-col gap-1.5">
              <label style={labelStyle}>New password</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={inputStyle}
                autoComplete="new-password"
                placeholder="Min. 8 characters"
                onFocus={onFocus}
                onBlur={onBlur}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label style={labelStyle}>Confirm password</label>
              <input
                type="password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                style={inputStyle}
                autoComplete="new-password"
                placeholder="Re-enter password"
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
              {busy ? "Saving…" : "Update password"}
              <span className="k-arrow" aria-hidden>
                →
              </span>
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <Link
            href="/portal/login"
            style={{
              fontFamily: T.mono,
              fontSize: "0.66rem",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--k-muted)",
              textDecoration: "none",
            }}
          >
            ← Back to sign in
          </Link>
        </div>
      </Reveal>
    </main>
  );
}

export default function PortalResetPage() {
  return (
    <Suspense
      fallback={<div style={{ minHeight: "100vh", background: "var(--k-bg)" }} />}
    >
      <ResetForm />
    </Suspense>
  );
}
