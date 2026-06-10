"use client";

import React, { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { T } from "@/lib/tokens";
import { LogoMark } from "@/components/Logo";

type Step = "form" | "verify";

function SignupFlow() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const inputRefs = Array.from({ length: 6 }, () => React.createRef<HTMLInputElement>());
  const [busy, setBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    width: "100%",
  };

  // ── Step 1: Create account ─────────────────────────────────────────────────
  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/client-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sign up failed.");
      setStep("verify");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed.");
    } finally {
      setBusy(false);
    }
  }

  // ── Step 2: Verify code + sign in ─────────────────────────────────────────
  function handleDigitChange(i: number, value: string) {
    const sanitized = value.replace(/\D/g, "").slice(-1);
    const next = [...digits]; next[i] = sanitized; setDigits(next);
    if (sanitized && i < 5) inputRefs[i + 1].current?.focus();
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) inputRefs[i - 1].current?.focus();
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = ["", "", "", "", "", ""];
    pasted.split("").forEach((ch, i) => { next[i] = ch; });
    setDigits(next);
    inputRefs[Math.min(pasted.length, 5)].current?.focus();
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    const code = digits.join("");
    if (code.length < 6) { setError("Please enter all 6 digits."); return; }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed.");

      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;

      router.replace("/portal");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
      setBusy(false);
    }
  }

  async function handleResend(e: React.MouseEvent) {
    e.preventDefault();
    setResendBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/resend-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend code.");
    } finally {
      setResendBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6" style={{ background: T.bg }}>
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <LogoMark size={26} />
          <span style={{ fontFamily: T.display, fontWeight: 900, fontSize: "1.3rem", letterSpacing: "0.02em", color: T.fg }}>NULLSHIFT</span>
        </div>

        <div className="mb-6 text-center" style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: T.primary }}>
          CLIENT_PORTAL / {step === "form" ? "CREATE_ACCOUNT" : "VERIFY_EMAIL"}
        </div>

        {step === "form" ? (
          <form onSubmit={handleSignup} className="flex flex-col gap-3 p-8 rounded-2xl" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
            <label style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: T.muted }}>Full name</label>
            <input type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="Your name" style={inputStyle} autoComplete="name" />

            <label className="mt-2" style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: T.muted }}>Email</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" style={inputStyle} autoComplete="email" />

            <label className="mt-2" style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: T.muted }}>Password</label>
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 8 characters" style={inputStyle} autoComplete="new-password" />

            <label className="mt-1" style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: T.muted }}>Confirm password</label>
            <input type="password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repeat password" style={inputStyle} autoComplete="new-password" />

            {error && <p style={{ fontFamily: T.mono, fontSize: "11px", color: T.danger }}>{error}</p>}

            <button type="submit" disabled={busy} className="mt-4 h-11 font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ fontFamily: T.mono, fontSize: "0.78rem", letterSpacing: "0.08em", textTransform: "uppercase", background: T.primary, color: T.primaryFg, borderRadius: T.r.md, boxShadow: busy ? "none" : `0 0 20px color-mix(in oklab, ${T.primary} 25%, transparent)` }}>
              {busy ? "Creating account…" : "Create account →"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="flex flex-col gap-5 p-8 rounded-2xl" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
            <p style={{ fontFamily: T.sans, fontSize: "0.875rem", lineHeight: 1.65, color: T.muted }}>
              We sent a <strong style={{ color: T.fg }}>6-digit code</strong> to <strong style={{ color: T.fg }}>{email}</strong>. Enter it below to verify your account.
            </p>

            <div className="flex gap-2 justify-between" onPaste={handlePaste}>
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={inputRefs[i]}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  autoFocus={i === 0}
                  onChange={e => handleDigitChange(i, e.target.value)}
                  onKeyDown={e => handleKeyDown(i, e)}
                  style={{
                    width: 44, height: 56, background: T.bg,
                    border: `1.5px solid ${d ? T.primary : T.border}`,
                    borderRadius: T.r.md, color: T.fg,
                    fontFamily: T.display, fontWeight: 900, fontSize: "1.4rem",
                    textAlign: "center", outline: "none", caretColor: "transparent",
                    boxShadow: d ? `0 0 10px color-mix(in oklab, ${T.primary} 20%, transparent)` : "none",
                  }}
                />
              ))}
            </div>

            {error && <p style={{ fontFamily: T.mono, fontSize: "11px", color: T.danger }}>{error}</p>}

            <button type="submit" disabled={busy || digits.join("").length < 6} className="h-11 font-semibold transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ fontFamily: T.mono, fontSize: "0.78rem", letterSpacing: "0.08em", textTransform: "uppercase", background: T.primary, color: T.primaryFg, borderRadius: T.r.md, boxShadow: busy ? "none" : `0 0 20px color-mix(in oklab, ${T.primary} 25%, transparent)` }}>
              {busy ? "Verifying…" : "Verify & sign in →"}
            </button>

            <p style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.06em", textTransform: "uppercase", color: T.muted, textAlign: "center" }}>
              Didn&apos;t receive it?{" "}
              <button type="button" onClick={handleResend} disabled={resendBusy}
                style={{ color: T.primary, background: "none", border: "none", cursor: "pointer", fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.06em", textTransform: "uppercase", opacity: resendBusy ? 0.6 : 1 }}>
                {resendBusy ? "sending…" : "resend code"}
              </button>
            </p>
          </form>
        )}

        <div className="mt-6 text-center flex flex-col gap-3">
          <Link href="/portal/login" style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: T.muted, textDecoration: "none" }}>
            Already have an account? Sign in →
          </Link>
          <Link href="/" style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: T.muted, textDecoration: "none" }}>
            ← Back to website
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function PortalSignupPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: T.bg }} />}>
      <SignupFlow />
    </Suspense>
  );
}
