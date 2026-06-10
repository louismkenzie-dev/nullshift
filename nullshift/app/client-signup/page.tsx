"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { T } from "@/lib/tokens";
import { LogoMark } from "@/components/Logo";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/env";

/* ── Shared input style ────────────────────────────────────────────── */
const inputBase: React.CSSProperties = {
  width: "100%",
  height: 42,
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

function onFocus(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = T.primary;
  e.currentTarget.style.boxShadow = T.shadow.focus;
}
function onBlur(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = T.border;
  e.currentTarget.style.boxShadow = "none";
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ fontFamily: T.sans, fontSize: "0.75rem", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: T.muted }}>
      {children}
    </label>
  );
}

/* ── OTP digit input component ───────────────────────────────────── */
function OtpInput({ digits, onChange, inputRefs }: {
  digits: string[];
  onChange: (i: number, v: string) => void;
  inputRefs: React.RefObject<HTMLInputElement | null>[];
}) {
  const digitBox: React.CSSProperties = {
    width: 48, height: 60,
    background: T.surface,
    border: `1.5px solid ${T.border}`,
    borderRadius: T.r.md,
    color: T.fg,
    fontFamily: T.display,
    fontWeight: 600,
    fontSize: "1.6rem",
    textAlign: "center",
    outline: "none",
    caretColor: "transparent",
    transition: `border-color ${T.duration.base} ${T.ease}, box-shadow ${T.duration.base} ${T.ease}`,
  };

  function handleKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      inputRefs[i - 1].current?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = ["", "", "", "", "", ""];
    pasted.split("").forEach((ch, i) => { next[i] = ch; });
    next.forEach((v, i) => onChange(i, v));
    inputRefs[Math.min(pasted.length, 5)].current?.focus();
  }

  return (
    <div className="flex gap-2 justify-center">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={inputRefs[i]}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          style={digitBox}
          onFocus={e => { e.currentTarget.style.borderColor = T.primary; e.currentTarget.style.boxShadow = T.shadow.focus; }}
          onBlur={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = "none"; }}
          onChange={e => onChange(i, e.target.value)}
          onKeyDown={e => handleKey(i, e)}
          onPaste={handlePaste}
        />
      ))}
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────────── */
export default function ClientSignupPage() {
  const router = useRouter();

  // ── Form fields ──
  const [name, setName]                 = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail]               = useState("");
  const [password, setPassword]         = useState("");
  const [confirmPw, setConfirmPw]       = useState("");
  const [prefDate, setPrefDate]         = useState("");
  const [prefTime, setPrefTime]         = useState("");

  // ── State machine ──
  const [phase, setPhase]   = useState<"form" | "verify">("form");
  const [clientId, setClientId] = useState<string | null>(null);
  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState<string | null>(null);

  // ── OTP ──
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const inputRefs = Array.from({ length: 6 }, () => useRef<HTMLInputElement>(null));
  const [resendBusy, setResendBusy] = useState(false);
  const [resendMsg, setResendMsg]   = useState<string | null>(null);

  /* Step 1: create client record + create auth user → show OTP screen */
  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirmPw) { setError("Passwords do not match."); return; }
    if (!prefDate) { setError("Please choose a preferred date."); return; }
    if (!prefTime) { setError("Please choose a preferred time."); return; }

    setBusy(true);
    try {
      // 1. Create/update the client record and get the clientId
      const onboardRes = await fetch("/api/client-onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          business_name: businessName.trim() || undefined,
          requested_date: prefDate,
          requested_time: prefTime,
        }),
      });
      const onboardData = await onboardRes.json();
      if (!onboardRes.ok) throw new Error(onboardData.error || "Could not create client record.");
      setClientId(onboardData.clientId);

      // 2. Create the auth account + send verification email
      const signupRes = await fetch("/api/auth/client-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim().toLowerCase(), password }),
      });
      const signupData = await signupRes.json();
      if (!signupRes.ok) throw new Error(signupData.error || "Account creation failed.");

      setPhase("verify");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  /* Step 2: verify OTP → sign in → redirect to brief */
  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    const code = digits.join("");
    if (code.length < 6) { setError("Please enter all 6 digits."); return; }

    setBusy(true);
    setError(null);
    try {
      // Verify code server-side (confirms email in Supabase)
      const verifyRes = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(verifyData.error || "Verification failed.");

      // Sign in now that the email is confirmed
      if (hasSupabaseBrowserConfig()) {
        const supabase = createClient();
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        if (signInError) throw signInError;
      }

      // Redirect to brief with clientId pre-linked
      router.replace(`/brief?client=${clientId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
      setBusy(false);
    }
  }

  async function handleResend(e: React.MouseEvent) {
    e.preventDefault();
    if (resendBusy) return;
    setResendBusy(true);
    setResendMsg(null);
    try {
      const res = await fetch("/api/auth/resend-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not resend code.");
      setResendMsg("Code resent — check your inbox.");
    } catch (err) {
      setResendMsg(err instanceof Error ? err.message : "Could not resend code.");
    } finally {
      setResendBusy(false);
    }
  }

  function handleDigitChange(i: number, raw: string) {
    const v = raw.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = v;
    setDigits(next);
    if (v && i < 5) inputRefs[i + 1].current?.focus();
  }

  /* ── Render ──────────────────────────────────────────────────── */
  return (
    <main className="min-h-screen flex flex-col items-center justify-start px-6 py-16" style={{ background: T.bg }}>

      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5 mb-12">
        <LogoMark size={24} />
        <span style={{ fontFamily: T.display, fontWeight: 600, fontSize: "1.1rem", letterSpacing: "-0.01em", color: T.fg }}>
          Nullshift
        </span>
      </Link>

      {/* Step pills */}
      <div className="flex items-center gap-3 mb-10">
        {(["Details", "Verify"] as const).map((label, i) => {
          const active = (i === 0 && phase === "form") || (i === 1 && phase === "verify");
          const done   = i === 0 && phase === "verify";
          return (
            <React.Fragment key={label}>
              <div className="flex items-center gap-2">
                <div className="size-7 rounded-full flex items-center justify-center"
                  style={{ background: done || active ? T.primary : T.surface2, border: `1px solid ${done || active ? T.primary : T.border}`, fontFamily: T.mono, fontSize: "10px", fontWeight: 600, color: done || active ? T.primaryFg : T.muted, transition: "all 0.3s" }}>
                  {done ? "✓" : i + 1}
                </div>
                <span style={{ fontFamily: T.sans, fontSize: "0.8125rem", fontWeight: 500, color: active ? T.fg : T.muted }}>{label}</span>
              </div>
              {i < 1 && <div className="w-8 h-px" style={{ background: phase === "verify" ? T.primary : T.border, transition: "background 0.3s" }} />}
            </React.Fragment>
          );
        })}
      </div>

      <div className="w-full max-w-md">

        {/* ── Phase: form ──────────────────────────────────── */}
        {phase === "form" && (
          <div className="flex flex-col gap-6">
            <div>
              <span className="inline-flex items-center gap-2 mb-4" style={{ fontFamily: T.sans, fontSize: "0.75rem", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: T.muted }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.primary, boxShadow: `0 0 0 4px ${T.primarySoft}`, display: "inline-block" }} />
                Book a call
              </span>
              <h1 style={{ fontFamily: T.display, fontWeight: 600, fontSize: "2.25rem", lineHeight: 1.04, letterSpacing: "-0.03em", color: T.fg }}>
                Let&apos;s get you<br /><span style={{ color: T.primary }}>set up.</span>
              </h1>
              <p className="mt-3" style={{ fontFamily: T.sans, fontSize: "0.9rem", lineHeight: 1.65, color: T.muted }}>
                Create your client account to book a discovery call. We&apos;ll confirm your slot and take you straight to your project brief.
              </p>
            </div>

            <form onSubmit={handleSignup} className="flex flex-col gap-4 p-7 rounded-2xl" style={{ background: T.surface, border: `1px solid ${T.border}`, boxShadow: T.shadow.md }}>

              {/* Name + Business */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <FieldLabel>Your name</FieldLabel>
                  <input type="text" required value={name} onChange={e => setName(e.target.value)} style={inputBase} autoComplete="name" onFocus={onFocus} onBlur={onBlur} placeholder="Alex Johnson" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <FieldLabel>Business name</FieldLabel>
                  <input type="text" value={businessName} onChange={e => setBusinessName(e.target.value)} style={inputBase} autoComplete="organization" onFocus={onFocus} onBlur={onBlur} placeholder="Acme Ltd" />
                </div>
              </div>

              {/* Email */}
              <div className="flex flex-col gap-1.5">
                <FieldLabel>Email address</FieldLabel>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} style={inputBase} autoComplete="email" onFocus={onFocus} onBlur={onBlur} placeholder="you@company.com" />
              </div>

              {/* Date + Time */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <FieldLabel>Preferred date</FieldLabel>
                  <input type="date" required value={prefDate} onChange={e => setPrefDate(e.target.value)} style={{ ...inputBase, colorScheme: "dark" }} onFocus={onFocus} onBlur={onBlur} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <FieldLabel>Preferred time</FieldLabel>
                  <select required value={prefTime} onChange={e => setPrefTime(e.target.value)} style={{ ...inputBase, appearance: "none" as const }} onFocus={onFocus} onBlur={onBlur}>
                    <option value="">Select…</option>
                    <option value="morning">Morning (9am–12pm)</option>
                    <option value="afternoon">Afternoon (12pm–5pm)</option>
                    <option value="evening">Evening (5pm–8pm)</option>
                  </select>
                </div>
              </div>

              {/* Divider */}
              <div className="h-px my-1" style={{ background: T.border }} />

              {/* Password */}
              <div className="flex flex-col gap-1.5">
                <FieldLabel>Password</FieldLabel>
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)} style={inputBase} autoComplete="new-password" onFocus={onFocus} onBlur={onBlur} placeholder="Min. 8 characters" />
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel>Confirm password</FieldLabel>
                <input type="password" required value={confirmPw} onChange={e => setConfirmPw(e.target.value)} style={inputBase} autoComplete="new-password" onFocus={onFocus} onBlur={onBlur} placeholder="Repeat password" />
              </div>

              {error && <p style={{ fontFamily: T.sans, fontSize: "0.8125rem", color: T.danger }}>{error}</p>}

              <button
                type="submit"
                disabled={busy}
                className="mt-1 w-full h-11 flex items-center justify-between px-5 font-medium cursor-pointer disabled:opacity-50"
                style={{ fontFamily: T.sans, fontSize: "0.9375rem", fontWeight: 500, letterSpacing: "-0.005em", background: T.primary, color: T.primaryFg, borderRadius: T.r.md, border: "none", boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18)`, transition: `background ${T.duration.base} ${T.ease}` }}
                onMouseEnter={e => { if (!busy) (e.currentTarget as HTMLElement).style.background = T.primaryHover; }}
                onMouseLeave={e => { if (!busy) (e.currentTarget as HTMLElement).style.background = T.primary; }}
              >
                <span>{busy ? "Creating account…" : "Create account & continue"}</span>
                {!busy && <span>→</span>}
              </button>
            </form>

            <p className="text-center" style={{ fontFamily: T.sans, fontSize: "0.8125rem", color: T.muted }}>
              Already have an account?{" "}
              <Link href="/portal/login" style={{ color: T.primary, textDecoration: "none", fontWeight: 500 }}>Sign in →</Link>
            </p>
          </div>
        )}

        {/* ── Phase: verify ─────────────────────────────── */}
        {phase === "verify" && (
          <div className="flex flex-col gap-6">
            <div>
              <span className="inline-flex items-center gap-2 mb-4" style={{ fontFamily: T.sans, fontSize: "0.75rem", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: T.muted }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.primary, boxShadow: `0 0 0 4px ${T.primarySoft}`, display: "inline-block" }} />
                Verify email
              </span>
              <h1 style={{ fontFamily: T.display, fontWeight: 600, fontSize: "2.25rem", lineHeight: 1.04, letterSpacing: "-0.03em", color: T.fg }}>
                Check your<br /><span style={{ color: T.primary }}>inbox.</span>
              </h1>
              <p className="mt-3" style={{ fontFamily: T.sans, fontSize: "0.9rem", lineHeight: 1.65, color: T.muted }}>
                We&apos;ve sent a 6-digit code to <span style={{ color: T.fg }}>{email}</span>. Enter it below to confirm your account.
              </p>
            </div>

            <form onSubmit={handleVerify} className="flex flex-col gap-6 p-7 rounded-2xl" style={{ background: T.surface, border: `1px solid ${T.border}`, boxShadow: T.shadow.md }}>
              <OtpInput digits={digits} onChange={handleDigitChange} inputRefs={inputRefs} />

              {error && <p className="text-center" style={{ fontFamily: T.sans, fontSize: "0.8125rem", color: T.danger }}>{error}</p>}

              <button
                type="submit"
                disabled={busy || digits.join("").length < 6}
                className="w-full h-11 flex items-center justify-between px-5 font-medium cursor-pointer disabled:opacity-50"
                style={{ fontFamily: T.sans, fontSize: "0.9375rem", fontWeight: 500, letterSpacing: "-0.005em", background: T.primary, color: T.primaryFg, borderRadius: T.r.md, border: "none", boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18)`, transition: `background ${T.duration.base} ${T.ease}` }}
                onMouseEnter={e => { if (!busy) (e.currentTarget as HTMLElement).style.background = T.primaryHover; }}
                onMouseLeave={e => { if (!busy) (e.currentTarget as HTMLElement).style.background = T.primary; }}
              >
                <span>{busy ? "Verifying…" : "Verify & continue to brief"}</span>
                {!busy && <span>→</span>}
              </button>
            </form>

            <div className="text-center">
              <button onClick={handleResend} disabled={resendBusy} style={{ fontFamily: T.sans, fontSize: "0.8125rem", color: T.muted, background: "none", border: "none", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: "3px" }}>
                {resendBusy ? "Sending…" : "Resend code"}
              </button>
              {resendMsg && <p className="mt-2" style={{ fontFamily: T.sans, fontSize: "0.8125rem", color: resendMsg.includes("Could not") ? T.danger : T.primary }}>{resendMsg}</p>}
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
