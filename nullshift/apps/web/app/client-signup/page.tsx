"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import { createClient } from "@nullshift/db/client";
import { hasSupabaseBrowserConfig } from "@nullshift/db/env";
import { T } from "@nullshift/ui/tokens";
import { Logo } from "@nullshift/ui/components/Logo";
import { Atmosphere } from "@/components/funnel/Atmosphere";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type StepKey = "name" | "business" | "email" | "when" | "password";
const ALL_STEPS: StepKey[] = ["name", "business", "email", "when", "password"];

/* ── OTP digit input ─────────────────────────────────────────────── */
function OtpInput({ digits, onChange, inputRefs }: {
  digits: string[];
  onChange: (i: number, v: string) => void;
  inputRefs: React.RefObject<HTMLInputElement | null>[];
}) {
  const box: React.CSSProperties = {
    width: 46, height: 58, background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: T.r.md,
    color: T.fg, fontFamily: T.display, fontWeight: 600, fontSize: "1.5rem", textAlign: "center", outline: "none", caretColor: "transparent",
  };
  function handleKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) inputRefs[i - 1].current?.focus();
  }
  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    pasted.split("").forEach((ch, i) => onChange(i, ch));
    inputRefs[Math.min(pasted.length, 5)].current?.focus();
  }
  return (
    <div className="flex gap-2 justify-center">
      {digits.map((d, i) => (
        <input key={i} ref={inputRefs[i]} type="text" inputMode="numeric" maxLength={1} value={d} style={box}
          onFocus={e => { e.currentTarget.style.borderColor = T.primary; e.currentTarget.style.boxShadow = T.shadow.focus; }}
          onBlur={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = "none"; }}
          onChange={e => onChange(i, e.target.value)} onKeyDown={e => handleKey(i, e)} onPaste={handlePaste} />
      ))}
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────── */
export default function ClientSignupPage() {
  const router = useRouter();
  const reduce = useReducedMotion();

  // Fields
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [prefDate, setPrefDate] = useState("");
  const [prefTime, setPrefTime] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  // Wizard
  const [steps, setSteps] = useState<StepKey[]>(ALL_STEPS);
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<"form" | "verify">("form");
  const [clientId, setClientId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // OTP
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  // Fixed-length (6) array → hook order is stable across renders, so this is
  // safe despite calling useRef in a callback. (OTP digit inputs.)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const inputRefs = Array.from({ length: 6 }, () => useRef<HTMLInputElement>(null));
  const [resendBusy, setResendBusy] = useState(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);

  // Prefill from the funnel (query + stored email) and drop known steps.
  const hydrated = useRef(false);
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    const p = new URLSearchParams(window.location.search);
    let n = p.get("name") || "";
    let em = p.get("email") || "";
    const b = p.get("business") || "";
    try {
      if (!em) em = localStorage.getItem("ns_email") || "";
      if (!n) n = localStorage.getItem("ns_name") || "";
    } catch { /* ignore */ }
    if (n) setName(n);
    if (em) setEmail(em);
    if (b) setBusinessName(b);
    const skip = new Set<StepKey>();
    if (n.trim()) skip.add("name");
    if (em.trim()) skip.add("email");
    setSteps(ALL_STEPS.filter(s => !skip.has(s)));
  }, []);

  // Remember the email as it's entered.
  useEffect(() => {
    try { if (email.trim()) localStorage.setItem("ns_email", email.trim()); } catch { /* ignore */ }
  }, [email]);

  const cur = steps[idx];
  const lastIdx = steps.length - 1;

  function validateStep(): boolean {
    setError(null);
    if (cur === "name" && !name.trim()) { setError("Please enter your name."); return false; }
    if (cur === "email" && (!email.trim() || !EMAIL_RE.test(email.trim()))) { setError("Enter a valid email address."); return false; }
    if (cur === "when") {
      if (!prefDate) { setError("Please choose a preferred date."); return false; }
      if (!prefTime) { setError("Please choose a time."); return false; }
    }
    if (cur === "password") {
      if (password.length < 8) { setError("Password must be at least 8 characters."); return false; }
      if (password !== confirmPw) { setError("Passwords don't match."); return false; }
    }
    return true;
  }

  async function next() {
    if (busy) return;
    if (!validateStep()) return;
    if (idx < lastIdx) { setIdx(i => i + 1); return; }
    await submit();
  }
  function back() { setError(null); if (idx > 0) setIdx(i => i - 1); }
  function skip() { if (cur === "business" && idx < lastIdx) { setError(null); setIdx(i => i + 1); } }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const onboardRes = await fetch("/api/client-onboard", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(), email: email.trim().toLowerCase(), business_name: businessName.trim() || undefined,
          requested_date: prefDate, requested_time: prefTime,
        }),
      });
      const onboardData = await onboardRes.json();
      if (!onboardRes.ok) throw new Error(onboardData.error || "Could not create client record.");
      setClientId(onboardData.clientId);

      const signupRes = await fetch("/api/auth/client-signup", {
        method: "POST", headers: { "Content-Type": "application/json" },
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

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    const code = digits.join("");
    if (code.length < 6) { setError("Please enter all 6 digits."); return; }
    setBusy(true);
    setError(null);
    try {
      const verifyRes = await fetch("/api/auth/verify-code", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(verifyData.error || "Verification failed.");
      if (hasSupabaseBrowserConfig()) {
        const supabase = createClient();
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
        if (signInError) throw signInError;
      }
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
        method: "POST", headers: { "Content-Type": "application/json" },
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
    const nextD = [...digits];
    nextD[i] = v;
    setDigits(nextD);
    if (v && i < 5) inputRefs[i + 1].current?.focus();
  }

  const panel: Variants = reduce
    ? { enter: { opacity: 0 }, center: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        enter: { opacity: 0, x: 28, filter: "blur(8px)" },
        center: { opacity: 1, x: 0, filter: "blur(0px)", transition: { duration: 0.36, ease: [0.16, 1, 0.3, 1] } },
        exit: { opacity: 0, x: -24, filter: "blur(8px)", transition: { duration: 0.2 } },
      };

  return (
    <main className="relative min-h-[100dvh] flex flex-col" style={{ background: T.bg }}>
      <Atmosphere />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-5 sm:px-8" style={{ height: 64 }}>
        <Link href="/" aria-label="Nullshift home"><Logo markSize={18} /></Link>
        <Link href="/portal/login" style={{ fontFamily: T.mono, fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: T.faint }}>
          Sign in
        </Link>
      </header>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-5 sm:px-8 py-10">
        <div className="w-full max-w-md">
          {phase === "form" ? (
            <>
              {/* Progress */}
              <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                <span style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.16em", textTransform: "uppercase", color: T.muted }}>
                  Set up · {idx + 1} / {steps.length}
                </span>
              </div>
              <div style={{ height: 3, borderRadius: 999, background: T.surface2, overflow: "hidden", marginBottom: 40 }}>
                <div style={{ height: "100%", width: `${((idx + 1) / steps.length) * 100}%`, background: T.primary, borderRadius: 999, boxShadow: `0 0 12px ${T.primarySoft}`, transition: "width .5s cubic-bezier(.16,1,.3,1)" }} />
              </div>

              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={cur} variants={panel} initial="enter" animate="center" exit="exit">
                  <StepBody
                    cur={cur}
                    name={name} setName={setName}
                    businessName={businessName} setBusinessName={setBusinessName}
                    email={email} setEmail={setEmail}
                    prefDate={prefDate} setPrefDate={setPrefDate}
                    prefTime={prefTime} setPrefTime={setPrefTime}
                    password={password} setPassword={setPassword}
                    confirmPw={confirmPw} setConfirmPw={setConfirmPw}
                    onEnter={next}
                  />
                </motion.div>
              </AnimatePresence>

              {error && <p className="mt-4" style={{ fontFamily: T.mono, fontSize: "12px", color: T.danger }}>{error}</p>}

              <div className="mt-9 flex items-center justify-between gap-4">
                <button type="button" onClick={back}
                  style={{ fontFamily: T.mono, fontSize: "12px", letterSpacing: "0.04em", textTransform: "uppercase", color: T.muted, visibility: idx === 0 ? "hidden" : "visible" }}>
                  ← Back
                </button>
                <div className="flex items-center gap-4">
                  {cur === "business" && (
                    <button type="button" onClick={skip} style={{ fontFamily: T.mono, fontSize: "11px", letterSpacing: "0.06em", textTransform: "uppercase", color: T.faint }}>
                      Skip
                    </button>
                  )}
                  <button type="button" onClick={next} disabled={busy}
                    className="inline-flex items-center justify-center font-medium disabled:opacity-60"
                    style={{ height: 48, paddingInline: 26, background: T.primary, color: T.primaryFg, borderRadius: T.r.md, fontFamily: T.sans, fontSize: "0.9375rem", fontWeight: 500, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18)` }}>
                    {idx < lastIdx ? "Continue →" : busy ? "Creating account…" : "Create account →"}
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* ── Verify (OTP) ── */
            <div>
              <span className="inline-flex items-center gap-2" style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: T.primary }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.primary, display: "inline-block", boxShadow: `0 0 0 4px ${T.primarySoft}` }} />
                Verify email
              </span>
              <h1 className="mt-4" style={{ fontFamily: T.display, fontWeight: 600, fontSize: "clamp(1.9rem,5.2vw,2.6rem)", lineHeight: 1.06, letterSpacing: "-0.03em", color: T.fg }}>
                Check your inbox.
              </h1>
              <p className="mt-3" style={{ fontFamily: T.sans, fontSize: "0.95rem", lineHeight: 1.6, color: T.muted }}>
                We&apos;ve sent a 6-digit code to <span style={{ color: T.fg }}>{email}</span>. Enter it to confirm your account.
              </p>
              <form onSubmit={handleVerify} className="mt-8 flex flex-col gap-6">
                <OtpInput digits={digits} onChange={handleDigitChange} inputRefs={inputRefs} />
                {error && <p className="text-center" style={{ fontFamily: T.mono, fontSize: "12px", color: T.danger }}>{error}</p>}
                <button type="submit" disabled={busy || digits.join("").length < 6}
                  className="inline-flex items-center justify-center font-medium disabled:opacity-50"
                  style={{ height: 50, background: T.primary, color: T.primaryFg, borderRadius: T.r.md, fontFamily: T.sans, fontSize: "0.9375rem", fontWeight: 500, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18)` }}>
                  {busy ? "Verifying…" : "Verify & continue to brief →"}
                </button>
              </form>
              <div className="mt-5 text-center">
                <button onClick={handleResend} disabled={resendBusy} style={{ fontFamily: T.sans, fontSize: "0.8125rem", color: T.muted, background: "none", border: "none", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: "3px" }}>
                  {resendBusy ? "Sending…" : "Resend code"}
                </button>
                {resendMsg && <p className="mt-2" style={{ fontFamily: T.sans, fontSize: "0.8125rem", color: resendMsg.includes("Could not") ? T.danger : T.primary }}>{resendMsg}</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

/* ── Per-step screen body ────────────────────────────────────────── */
function StepBody(props: {
  cur: StepKey;
  name: string; setName: (v: string) => void;
  businessName: string; setBusinessName: (v: string) => void;
  email: string; setEmail: (v: string) => void;
  prefDate: string; setPrefDate: (v: string) => void;
  prefTime: string; setPrefTime: (v: string) => void;
  password: string; setPassword: (v: string) => void;
  confirmPw: string; setConfirmPw: (v: string) => void;
  onEnter: () => void;
}) {
  const { cur, onEnter } = props;
  const firstRef = useRef<HTMLInputElement>(null);
  useEffect(() => { firstRef.current?.focus(); }, [cur]);
  const enter = (e: React.KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); onEnter(); } };

  const Eyebrow = ({ children }: { children: React.ReactNode }) => (
    <span className="inline-flex items-center gap-2" style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: T.primary }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.primary, display: "inline-block", boxShadow: `0 0 0 4px ${T.primarySoft}` }} />
      {children}
    </span>
  );
  const H = ({ children }: { children: React.ReactNode }) => (
    <h1 className="mt-4" style={{ fontFamily: T.display, fontWeight: 600, fontSize: "clamp(1.9rem,5.2vw,2.75rem)", lineHeight: 1.06, letterSpacing: "-0.03em", color: T.fg }}>{children}</h1>
  );
  const Sub = ({ children }: { children: React.ReactNode }) => (
    <p className="mt-3 max-w-[42ch]" style={{ fontFamily: T.sans, fontSize: "0.95rem", lineHeight: 1.6, color: T.muted }}>{children}</p>
  );

  if (cur === "name") {
    return (
      <div>
        <Eyebrow>Let&apos;s get you set up</Eyebrow>
        <H>First, your name?</H>
        <Sub>So we know who we&apos;re speaking with.</Sub>
        <input ref={firstRef} className="brief-input mt-7" type="text" autoComplete="name" placeholder="Alex Johnson"
          value={props.name} onChange={e => props.setName(e.target.value)} onKeyDown={enter} />
      </div>
    );
  }
  if (cur === "business") {
    return (
      <div>
        <Eyebrow>Your business</Eyebrow>
        <H>What&apos;s it called?</H>
        <Sub>Optional — helps us prep for your call.</Sub>
        <input ref={firstRef} className="brief-input mt-7" type="text" autoComplete="organization" placeholder="Acme Ltd"
          value={props.businessName} onChange={e => props.setBusinessName(e.target.value)} onKeyDown={enter} />
      </div>
    );
  }
  if (cur === "email") {
    return (
      <div>
        <Eyebrow>Contact</Eyebrow>
        <H>What&apos;s your email?</H>
        <Sub>We&apos;ll send your account details and call confirmation here.</Sub>
        <input ref={firstRef} className="brief-input mt-7" type="email" inputMode="email" autoComplete="email" placeholder="you@company.com"
          value={props.email} onChange={e => props.setEmail(e.target.value)} onKeyDown={enter} />
      </div>
    );
  }
  if (cur === "when") {
    return (
      <div>
        <Eyebrow>Your call</Eyebrow>
        <H>When suits you?</H>
        <Sub>Pick a preferred slot — we&apos;ll confirm the exact time.</Sub>
        <div className="mt-7 flex flex-col gap-3">
          <input ref={firstRef} className="brief-input" type="date" style={{ colorScheme: "dark" }}
            value={props.prefDate} onChange={e => props.setPrefDate(e.target.value)} />
          <div className="grid grid-cols-3 gap-2">
            {[["morning", "Morning"], ["afternoon", "Afternoon"], ["evening", "Evening"]].map(([id, label]) => {
              const sel = props.prefTime === id;
              return (
                <button key={id} type="button" onClick={() => props.setPrefTime(id)}
                  className="ns-funnel-option" aria-pressed={sel}
                  style={{ height: 48, borderRadius: T.r.md, border: `1px solid ${sel ? T.primary : T.border}`, background: sel ? T.primarySoft : T.surface, color: sel ? T.fg : T.muted, fontFamily: T.sans, fontSize: "0.875rem", fontWeight: 500 }}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }
  // password
  return (
    <div>
      <Eyebrow>Last step</Eyebrow>
      <H>Set a password.</H>
      <Sub>
        This creates your client account{props.email ? <> for <span style={{ color: T.fg }}>{props.email}</span></> : null}.
      </Sub>
      <div className="mt-7 flex flex-col gap-3">
        <input ref={firstRef} className="brief-input" type="password" autoComplete="new-password" placeholder="Min. 8 characters"
          value={props.password} onChange={e => props.setPassword(e.target.value)} onKeyDown={enter} />
        <input className="brief-input" type="password" autoComplete="new-password" placeholder="Confirm password"
          value={props.confirmPw} onChange={e => props.setConfirmPw(e.target.value)} onKeyDown={enter} />
      </div>
    </div>
  );
}
