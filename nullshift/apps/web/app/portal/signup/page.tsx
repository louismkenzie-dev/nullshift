"use client";

import React, { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@nullshift/db/client";
import { T } from "@nullshift/ui/tokens";
import { LogoMark } from "@nullshift/ui/components/Logo";

type Step = "form" | "verify";

/* ── Shared Halo input style ────────────────────────────────── */
const inputBase: React.CSSProperties = {
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

  /* ── Step 1: create account ──────────────────────────────── */
  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
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

  /* ── Step 2: 6-digit verify ──────────────────────────────── */
  function handleDigitChange(i: number, value: string) {
    const sanitized = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = sanitized;
    setDigits(next);
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
    pasted.split("").forEach((ch, i) => {
      next[i] = ch;
    });
    setDigits(next);
    inputRefs[Math.min(pasted.length, 5)].current?.focus();
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    const code = digits.join("");
    if (code.length < 6) {
      setError("Please enter all 6 digits.");
      return;
    }
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
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
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
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend code.");
    } finally {
      setResendBusy(false);
    }
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
            Client portal — {step === "form" ? "create account" : "verify email"}
          </span>
        </div>

        {step === "form" ? (
          <form
            onSubmit={handleSignup}
            className="flex flex-col gap-4 p-8 rounded-none"
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
                Full name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                style={inputBase}
                autoComplete="name"
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
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={inputBase}
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
                placeholder="Min. 8 characters"
                style={inputBase}
                autoComplete="new-password"
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
                Confirm password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
                style={inputBase}
                autoComplete="new-password"
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
              {busy ? "Creating account…" : "Create account →"}
            </button>
          </form>
        ) : (
          <form
            onSubmit={handleVerify}
            className="flex flex-col gap-5 p-8 rounded-none"
            style={{
              background: T.surface,
              border: `1px solid ${T.border}`,
              boxShadow: T.shadow.md,
            }}
          >
            <p
              style={{
                fontFamily: T.sans,
                fontSize: "0.9375rem",
                lineHeight: 1.65,
                letterSpacing: "-0.005em",
                color: T.muted,
              }}
            >
              We sent a{" "}
              <strong style={{ color: T.fg, fontWeight: 600 }}>6-digit code</strong> to{" "}
              <strong style={{ color: T.fg, fontWeight: 600 }}>{email}</strong>. Enter it
              below to verify your account.
            </p>

            {/* Digit boxes */}
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
                  onChange={(e) => handleDigitChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  style={{
                    width: 44,
                    height: 56,
                    background: T.bg,
                    border: `1.5px solid ${d ? T.primary : T.border}`,
                    borderRadius: T.r.md,
                    color: T.fg,
                    fontFamily: T.mono,
                    fontWeight: 600,
                    fontSize: "1.4rem",
                    textAlign: "center",
                    outline: "none",
                    caretColor: "transparent",
                    boxShadow: d ? T.shadow.focus : "none",
                    transition: `border-color ${T.duration.base} ${T.ease}, box-shadow ${T.duration.base} ${T.ease}`,
                  }}
                />
              ))}
            </div>

            {error && (
              <p style={{ fontFamily: T.sans, fontSize: "0.8125rem", color: T.danger }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy || digits.join("").length < 6}
              className="h-10 font-medium cursor-pointer"
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
                opacity: busy || digits.join("").length < 6 ? 0.4 : 1,
              }}
            >
              {busy ? "Verifying…" : "Verify & sign in →"}
            </button>

            <p
              style={{
                fontFamily: T.sans,
                fontSize: "0.8125rem",
                letterSpacing: "-0.003em",
                color: T.muted,
                textAlign: "center",
              }}
            >
              Didn&apos;t receive it?{" "}
              <button
                type="button"
                onClick={handleResend}
                disabled={resendBusy}
                style={{
                  color: T.primary,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: T.sans,
                  fontSize: "0.8125rem",
                  opacity: resendBusy ? 0.6 : 1,
                  textDecoration: "underline",
                }}
              >
                {resendBusy ? "Sending…" : "Resend code"}
              </button>
            </p>
          </form>
        )}

        <div className="mt-6 text-center flex flex-col gap-3">
          <Link
            href="/portal/login"
            style={{
              fontFamily: T.sans,
              fontSize: "0.8125rem",
              color: T.muted,
              textDecoration: "none",
            }}
          >
            Already have an account? Sign in →
          </Link>
          <Link
            href="/"
            style={{
              fontFamily: T.sans,
              fontSize: "0.8125rem",
              color: T.faint,
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

export default function PortalSignupPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: T.bg }} />}>
      <SignupFlow />
    </Suspense>
  );
}
