"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@nullshift/db/client";
import { T } from "@nullshift/ui/tokens";
import { LogoMark } from "@/components/Logo";
import { hasSupabaseBrowserConfig, getMissingSupabaseBrowserEnv } from "@nullshift/db/env";

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: T.bg }} />}>
      <AdminLogin />
    </Suspense>
  );
}

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

  const inputStyle: React.CSSProperties = {
    background: T.bg, border: `1px solid ${T.border}`, padding: "12px 16px",
    color: T.fg, fontFamily: T.sans, fontSize: "0.95rem", outline: "none", borderRadius: T.r.sm,
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-6" style={{ background: T.bg }}>
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <LogoMark size={26} />
          <span style={{ fontFamily: T.display, fontWeight: 600, fontSize: "1.3rem", letterSpacing: "0.02em", color: T.fg }}>Nullshift</span>
        </div>
        <div className="mb-6 text-center" style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: T.primary }}>
          ADMIN_PORTAL / SECURE_LOGIN
        </div>
        {setupMode ? (
          <div className="flex flex-col gap-4 p-8 rounded-xl" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
            <div style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.16em", textTransform: "uppercase", color: T.danger }}>
              SUPABASE_SETUP_REQUIRED
            </div>
            <p style={{ fontFamily: T.sans, fontSize: "0.95rem", lineHeight: 1.7, color: T.muted }}>
              The admin login screen is ready, but the Supabase runtime variables are missing, so the form cannot connect yet.
            </p>
            <p style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.08em", color: T.muted }}>
              Missing: {missing.join(", ")}
            </p>
            <div style={{ fontFamily: T.sans, fontSize: "0.9rem", color: T.fg }}>
              Add the values from your Supabase project to <code>.env.local</code>, restart <code>npm run dev</code>, then come back here.
            </div>
            <a
              href="/"
              className="mt-2 h-11 inline-flex items-center justify-center font-semibold transition-opacity hover:opacity-90"
              style={{ fontFamily: T.mono, fontSize: "0.78rem", letterSpacing: "0.08em", textTransform: "uppercase", background: T.primary, color: T.primaryFg, borderRadius: T.r.sm }}
            >
              Back Home
            </a>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-3 p-8 rounded-xl"
            style={{ background: T.surface, border: `1px solid ${T.border}` }}>
            <label style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: T.muted }}>Email</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} autoComplete="email" />
            <label className="mt-2" style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: T.muted }}>Password</label>
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} autoComplete="current-password" />
            {error && <p style={{ fontFamily: T.mono, fontSize: "11px", color: T.danger, marginTop: "4px" }}>{error}</p>}
            <button type="submit" disabled={busy} className="mt-4 h-11 font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ fontFamily: T.mono, fontSize: "0.78rem", letterSpacing: "0.08em", textTransform: "uppercase", background: T.primary, color: T.primaryFg, borderRadius: T.r.sm }}>
              {busy ? "Signing in…" : "Sign in →"}
            </button>
          </form>
        )}
        <a href="/" className="mt-4 h-10 flex items-center justify-center transition-opacity hover:opacity-80"
          style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: T.muted }}>
          ← Back to website
        </a>
      </div>
    </main>
  );
}
