"use client";

import React, { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@nullshift/db/client";
import { T } from "@nullshift/ui/tokens";
import { LogoMark } from "@nullshift/ui/components/Logo";
import { Eyebrow, Display } from "@/components/kyma";
import { Reveal } from "@/components/Reveal";

type Step = "form" | "verify";

/* ── Shared input style (KYMA — square, hairline, emerald focus) ── */
const inputBase: React.CSSProperties = {
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
          <Eyebrow
            index="01"
            label={step === "form" ? "Client Portal" : "Verify Email"}
            align="center"
          />
          <Display as="h1" size="md">
            {step === "form" ? "Create account" : "Check your inbox"}
          </Display>
        </div>

        {step === "form" ? (
          <form
            onSubmit={handleSignup}
            className="k-kard flex flex-col gap-4 p-8"
            style={{ background: "var(--k-surface)" }}
          >
            <div className="flex flex-col gap-1.5">
              <label style={labelStyle}>Full name</label>
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
              <label style={labelStyle}>Email</label>
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
              <label style={labelStyle}>Password</label>
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
              <label style={labelStyle}>Confirm password</label>
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
              {busy ? "Creating account…" : "Create account"}
              <span className="k-arrow" aria-hidden>
                →
              </span>
            </button>
          </form>
        ) : (
          <form
            onSubmit={handleVerify}
            className="k-kard flex flex-col gap-5 p-8"
            style={{ background: "var(--k-surface)" }}
          >
            <p
              style={{
                fontFamily: T.sans,
                fontSize: "0.9375rem",
                lineHeight: 1.65,
                letterSpacing: "-0.005em",
                color: "var(--k-muted)",
              }}
            >
              We sent a{" "}
              <strong style={{ color: "var(--k-fg)", fontWeight: 600 }}>
                6-digit code
              </strong>{" "}
              to{" "}
              <strong style={{ color: "var(--k-fg)", fontWeight: 600 }}>{email}</strong>.
              Enter it below to verify your account.
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
                    background: "var(--k-surface)",
                    border: `1px solid ${d ? T.primary : "var(--k-border)"}`,
                    borderRadius: 0,
                    color: "var(--k-fg)",
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
              disabled={busy || digits.join("").length < 6}
              className="kb kb-primary"
              style={{
                width: "100%",
                opacity: busy || digits.join("").length < 6 ? 0.4 : 1,
              }}
            >
              {busy ? "Verifying…" : "Verify & sign in"}
              <span className="k-arrow" aria-hidden>
                →
              </span>
            </button>

            <p
              style={{
                fontFamily: T.mono,
                fontSize: "0.66rem",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--k-muted)",
                textAlign: "center",
              }}
            >
              Didn&apos;t receive it?{" "}
              <button
                type="button"
                onClick={handleResend}
                disabled={resendBusy}
                style={{
                  color: "var(--k-accent)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: T.mono,
                  fontSize: "0.66rem",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
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
              fontFamily: T.mono,
              fontSize: "0.68rem",
              fontWeight: 500,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--k-accent)",
              textDecoration: "none",
            }}
          >
            Already have an account? Sign in →
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

export default function PortalSignupPage() {
  return (
    <Suspense
      fallback={<div style={{ minHeight: "100vh", background: "var(--k-bg)" }} />}
    >
      <SignupFlow />
    </Suspense>
  );
}
