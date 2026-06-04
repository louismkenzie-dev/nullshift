"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { T } from "@/lib/tokens";
import { LogoMark } from "@/components/Logo";

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
    color: T.fg, fontFamily: T.sans, fontSize: "0.95rem", outline: "none", borderRadius: "3px",
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-6" style={{ background: T.bg }}>
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <LogoMark size={26} />
          <span style={{ fontFamily: T.display, fontWeight: 900, fontSize: "1.3rem", letterSpacing: "0.02em", color: T.fg }}>NULLSHIFT</span>
        </div>
        <div className="mb-6 text-center" style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: T.primary }}>
          ADMIN_PORTAL / SECURE_LOGIN
        </div>
        <form onSubmit={onSubmit} className="flex flex-col gap-3 p-8 rounded-xl"
          style={{ background: T.surface, border: `1px solid ${T.border}` }}>
          <label style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: T.muted }}>Email</label>
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} autoComplete="email" />
          <label className="mt-2" style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: T.muted }}>Password</label>
          <input type="password" required value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} autoComplete="current-password" />
          {error && <p style={{ fontFamily: T.mono, fontSize: "11px", color: "#f87171", marginTop: "4px" }}>{error}</p>}
          <button type="submit" disabled={busy} className="mt-4 h-11 font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ fontFamily: T.mono, fontSize: "0.78rem", letterSpacing: "0.08em", textTransform: "uppercase", background: T.primary, color: T.primaryFg, borderRadius: "3px" }}>
            {busy ? "Signing in…" : "Sign in →"}
          </button>
        </form>
      </div>
    </main>
  );
}
