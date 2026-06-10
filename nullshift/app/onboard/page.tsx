"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { T } from "@/lib/tokens";
import { LogoMark } from "@/components/Logo";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/env";

import { PLAN_META_ONBOARD } from "@/lib/pricingPlans";

type Plan = keyof typeof PLAN_META_ONBOARD;

export default function OnboardPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: T.bg }} />}>
      <OnboardFlow />
    </Suspense>
  );
}

/** Returns true if the signed-in user has an active subscription. */
async function checkHasActiveSubscription(): Promise<boolean> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  return !!data;
}

function OnboardFlow() {
  const params = useSearchParams();
  const router = useRouter();
  const rawPlan = params.get("plan") ?? "core";
  const plan: Plan = (rawPlan.toLowerCase() in PLAN_META_ONBOARD ? rawPlan.toLowerCase() : "core") as Plan;
  const meta = PLAN_META_ONBOARD[plan];

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  useEffect(() => {
    const isConfirmed = params.get("confirmed") === "true";
    if (isConfirmed) {
      setStep(3);
      return;
    }

    if (!hasSupabaseBrowserConfig()) return;

    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email_confirmed_at) {
        setStep(3);
      }
    });
  }, [params]);

  const inputStyle: React.CSSProperties = {
    background: T.bg,
    border: `1px solid ${T.border}`,
    padding: "12px 16px",
    color: T.fg,
    fontFamily: T.sans,
    fontSize: "0.9375rem",
    letterSpacing: "-0.005em",
    outline: "none",
    borderRadius: T.r.sm,
    width: "100%",
  };

  async function createAccount(e: React.FormEvent) {
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
      const response = await fetch('/api/auth/signup-with-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password, plan: plan }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create account.');
      }

      setStep(4); // Move to awaiting email confirmation
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed.");
    } finally {
      setBusy(false);
    }
  }

  async function resendConfirmationEmail(e: React.MouseEvent) {
    e.preventDefault();
    if (!email || resendBusy) return;

    setResendBusy(true);
    setResendMessage(null);
    try {
      const response = await fetch("/api/auth/resend-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not resend confirmation email.");
      }
      setResendMessage(data.message || "Confirmation email sent.");
    } catch (err) {
      setResendMessage(
        err instanceof Error ? err.message : "Could not resend confirmation email."
      );
    } finally {
      setResendBusy(false);
    }
  }

  const isConfigured = hasSupabaseBrowserConfig();

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-start px-6 py-16"
      style={{ background: T.bg }}
    >
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5 mb-12">
        <LogoMark size={24} />
        <span style={{ fontFamily: T.display, fontWeight: 900, fontSize: "1.1rem", letterSpacing: "0.04em", color: T.fg }}>
          NULLSHIFT
        </span>
      </Link>

      {/* Step indicator */}
      <div className="flex items-center gap-3 mb-10">
        {([1, 2, 3] as const).map((s) => (
          <div key={s} className="flex items-center gap-3">
            <div
              className="flex items-center justify-center size-7 rounded-full"
              style={{
                background: step >= s ? T.primary : T.surface2,
                border: `1px solid ${step >= s ? T.primary : T.border}`,
                fontFamily: T.mono,
                fontSize: "10px",
                fontWeight: 600,
                color: step >= s ? T.primaryFg : T.muted,
                transition: "all 0.3s ease",
              }}
            >
              {step > s ? "✓" : s}
            </div>
            {s < 3 && (
              <div
                className="w-10 h-px"
                style={{ background: step > s ? T.primary : T.border, transition: "background 0.3s ease" }}
              />
            )}
          </div>
        ))}
      </div>

      <div className="w-full max-w-md">

        {/* ── Step 1: Plan summary ── */}
        {step === 1 && (
          <div className="flex flex-col gap-6">
            <div>
              <div
                className="mb-2"
                style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: T.primary }}
              >
                STEP 01 / YOUR PLAN
              </div>
              <h1 style={{ fontFamily: T.display, fontWeight: 900, fontSize: "2.2rem", lineHeight: 0.95, letterSpacing: "-0.02em", color: T.fg }}>
                YOU&apos;VE CHOSEN<br /><span style={{ color: T.primary }}>{meta.label.toUpperCase()}</span>
              </h1>
            </div>

            <div
              className="rounded-xl p-6 flex flex-col gap-4"
              style={{ background: T.surface, border: `1px solid ${T.border}` }}
            >
              <div className="flex items-end justify-between">
                <div>
                  <div style={{ fontFamily: T.mono, fontWeight: 600, fontSize: "0.7rem", letterSpacing: "0.14em", textTransform: "uppercase", color: T.muted, marginBottom: "6px" }}>
                    {meta.label}
                  </div>
                  <div style={{ fontFamily: T.display, fontWeight: 800, fontSize: "2rem", letterSpacing: "-0.03em", color: T.primary }}>
                    {meta.price}
                  </div>
                </div>
                <Link
                  href="/pricing"
                  style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: T.muted, textDecoration: "none" }}
                >
                  Change plan
                </Link>
              </div>
              <div className="h-px" style={{ background: T.border }} />
              <ul className="flex flex-col gap-2.5">
                {meta.features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5">
                    <span
                      className="size-4 rounded-full grid place-content-center shrink-0"
                      style={{ background: `${T.primary}20`, border: `1px solid ${T.primary}40` }}
                    >
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                        <path d="M1 4l2 2 4-4" stroke={T.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <span style={{ fontFamily: T.sans, fontSize: "0.875rem", color: T.muted }}>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            <button
              onClick={() => setStep(2)}
              className="w-full h-12 flex items-center justify-between px-5 transition-opacity hover:opacity-90"
              style={{
                fontFamily: T.mono,
                fontSize: "0.78rem",
                fontWeight: 600,
                letterSpacing: "0.06em",
                background: T.primary,
                color: T.primaryFg,
                borderRadius: T.r.md,
                boxShadow: `0 0 24px color-mix(in oklab, ${T.primary} 25%, transparent)`,
              }}
            >
              <span>Create your account</span>
              <span>→</span>
            </button>

            <p style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.06em", textTransform: "uppercase", color: T.muted, textAlign: "center" }}>
              Cancel anytime · No hidden fees
            </p>
          </div>
        )}

        {/* ── Step 2: Create account ── */}
        {step === 2 && (
          <div className="flex flex-col gap-6">
            <div>
              <div
                className="mb-2"
                style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: T.primary }}
              >
                STEP 02 / CREATE ACCOUNT
              </div>
              <h1 style={{ fontFamily: T.display, fontWeight: 900, fontSize: "2.2rem", lineHeight: 0.95, letterSpacing: "-0.02em", color: T.fg }}>
                SET UP YOUR<br /><span style={{ color: T.primary }}>LOGIN</span>
              </h1>
            </div>

            {!isConfigured ? (
              <div
                className="rounded-xl p-6"
                style={{ background: T.surface, border: `1px solid ${T.border}` }}
              >
                <p style={{ fontFamily: T.sans, fontSize: "0.9rem", color: T.muted }}>
                  Supabase is not configured — account creation is unavailable in this environment.
                </p>
                <button
                  onClick={() => setStep(3)}
                  className="mt-4 w-full h-11 flex items-center justify-between px-5 transition-opacity hover:opacity-90"
                  style={{ fontFamily: T.mono, fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.06em", background: T.primary, color: T.primaryFg, borderRadius: T.r.md }}
                >
                  <span>Continue to payment</span>
                  <span>→</span>
                </button>
              </div>
            ) : (
              <form onSubmit={createAccount} className="flex flex-col gap-4 rounded-xl p-6" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
                <div className="flex flex-col gap-1.5">
                  <label style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: T.muted }}>
                    Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Your name"
                    style={{ ...inputStyle, color: T.fg }}
                    autoComplete="name"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: T.muted }}>
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    style={{ ...inputStyle, color: T.fg }}
                    autoComplete="email"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: T.muted }}>
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    style={inputStyle}
                    autoComplete="new-password"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: T.muted }}>
                    Confirm password
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    style={inputStyle}
                    autoComplete="new-password"
                  />
                </div>
                {error && (
                  <p style={{ fontFamily: T.mono, fontSize: "11px", color: "#f87171" }}>{error}</p>
                )}
                <button
                  type="submit"
                  disabled={busy}
                  className="mt-2 w-full h-11 flex items-center justify-between px-5 transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{
                    fontFamily: T.mono,
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                    background: T.primary,
                    color: T.primaryFg,
                    borderRadius: T.r.md,
                    boxShadow: busy ? "none" : `0 0 20px color-mix(in oklab, ${T.primary} 22%, transparent)`,
                  }}
                >
                  <span>{busy ? "Creating account…" : "Continue to payment"}</span>
                  {!busy && <span>→</span>}
                </button>
              </form>
            )}

            <button
              onClick={() => setStep(1)}
              style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: T.muted, background: "none", border: "none", cursor: "pointer" }}
            >
              ← Back
            </button>

            <p style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.06em", color: T.muted, textAlign: "center" }}>
              Already have an account?{" "}
              <Link href="/learn/login" style={{ color: T.primary, textDecoration: "none" }}>Sign in →</Link>
            </p>
          </div>
        )}

        {/* ── Step 3: Payment ── */}
        {step === 3 && (
          <StripeCheckoutRedirect plan={plan} email={email} />
        )}

        {/* ── Step 4: Check Email ── */}
        {step === 4 && (
          <CheckEmailStep
            email={email}
            plan={plan}
            resendBusy={resendBusy}
            resendMessage={resendMessage}
            onResend={resendConfirmationEmail}
            onAdvance={(hasSubscription) => {
              if (hasSubscription) {
                router.replace("/learn");
              } else {
                setStep(3);
              }
            }}
          />
        )}

      </div>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 4: Check email + inline sign-in after verification
// ─────────────────────────────────────────────────────────────────────────────

interface CheckEmailStepProps {
  email: string;
  plan: Plan;
  resendBusy: boolean;
  resendMessage: string | null;
  onResend: (e: React.MouseEvent) => void;
  /** Called once sign-in succeeds. Pass true if user already has a subscription. */
  onAdvance: (hasSubscription: boolean) => void;
}

function CheckEmailStep({ email, plan, resendBusy, resendMessage, onResend, onAdvance }: CheckEmailStepProps) {
  const [showLogin, setShowLogin] = useState(false);
  const [loginPassword, setLoginPassword] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const inputStyle: React.CSSProperties = {
    background: T.bg,
    border: `1px solid ${T.border}`,
    padding: "12px 16px",
    color: T.fg,
    fontFamily: T.sans,
    fontSize: "0.9375rem",
    letterSpacing: "-0.005em",
    outline: "none",
    borderRadius: T.r.sm,
    width: "100%",
  };

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginBusy(true);
    setLoginError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password: loginPassword });
      if (error) throw error;
      const hasSub = await checkHasActiveSubscription();
      onAdvance(hasSub);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Sign in failed.");
      setLoginBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Heading */}
      <div className="text-center">
        <div className="mb-2" style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: T.primary }}>
          STEP 02 COMPLETE
        </div>
        <h1 style={{ fontFamily: T.display, fontWeight: 900, fontSize: "2.2rem", lineHeight: 0.95, letterSpacing: "-0.02em", color: T.fg }}>
          CHECK YOUR<br /><span style={{ color: T.primary }}>EMAIL</span>
        </h1>
      </div>

      {/* Info card */}
      <div className="rounded-xl p-6 flex flex-col gap-3" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
        <p style={{ fontFamily: T.sans, fontSize: "0.9rem", lineHeight: 1.6, color: T.muted }}>
          We&apos;ve sent a confirmation link to{" "}
          <span style={{ color: T.fg, fontWeight: 600 }}>{email || "your email"}</span>.
          Click the link in that email to verify your account, then come back here and sign in.
        </p>
        <div className="h-px" style={{ background: T.border }} />
        <p style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.06em", textTransform: "uppercase", color: T.muted }}>
          Didn&apos;t receive it? Check your spam folder or{" "}
          <button
            type="button"
            onClick={onResend}
            disabled={resendBusy}
            style={{ color: T.primary, background: "none", border: "none", cursor: resendBusy ? "default" : "pointer", fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.06em", textTransform: "uppercase", opacity: resendBusy ? 0.6 : 1 }}
          >
            {resendBusy ? "sending…" : "resend email"}
          </button>
          .
        </p>
        {resendMessage && (
          <p style={{ fontFamily: T.mono, fontSize: "11px", color: T.muted }}>{resendMessage}</p>
        )}
      </div>

      {/* CTA — reveal sign-in form */}
      {!showLogin ? (
        <button
          onClick={() => setShowLogin(true)}
          className="w-full h-12 flex items-center justify-between px-5 transition-opacity hover:opacity-90"
          style={{
            fontFamily: T.mono,
            fontSize: "0.78rem",
            fontWeight: 600,
            letterSpacing: "0.06em",
            background: T.primary,
            color: T.primaryFg,
            borderRadius: T.r.md,
            boxShadow: `0 0 24px color-mix(in oklab, ${T.primary} 25%, transparent)`,
          }}
        >
          <span>I&apos;ve verified my email — sign in</span>
          <span>→</span>
        </button>
      ) : (
        <form onSubmit={handleLogin} className="flex flex-col gap-4 rounded-xl p-6" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
          <div style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.18em", textTransform: "uppercase", color: T.primary }}>
            SIGN IN TO CONTINUE
          </div>

          {/* Email — read-only, pre-filled */}
          <div className="flex flex-col gap-1.5">
            <label style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: T.muted }}>Email</label>
            <input
              type="email"
              value={email}
              readOnly
              style={{ ...inputStyle, opacity: 0.6, cursor: "not-allowed" }}
            />
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <label style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: T.muted }}>Password</label>
            <input
              type="password"
              required
              autoFocus
              value={loginPassword}
              onChange={e => setLoginPassword(e.target.value)}
              placeholder="Your password"
              style={inputStyle}
              autoComplete="current-password"
            />
          </div>

          {loginError && (
            <p style={{ fontFamily: T.mono, fontSize: "11px", color: "#f87171" }}>{loginError}</p>
          )}

          <button
            type="submit"
            disabled={loginBusy}
            className="mt-1 w-full h-11 flex items-center justify-between px-5 transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{
              fontFamily: T.mono,
              fontSize: "0.78rem",
              fontWeight: 600,
              letterSpacing: "0.06em",
              background: T.primary,
              color: T.primaryFg,
              borderRadius: T.r.md,
              boxShadow: loginBusy ? "none" : `0 0 20px color-mix(in oklab, ${T.primary} 22%, transparent)`,
            }}
          >
            <span>{loginBusy ? "Signing in…" : "Sign in & continue to payment"}</span>
            {!loginBusy && <span>→</span>}
          </button>
        </form>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3: Stripe checkout redirect
// ─────────────────────────────────────────────────────────────────────────────

interface StripeCheckoutRedirectProps {
  plan: Plan;
  email: string; // may be empty if coming from a fresh email confirmation link
}

function StripeCheckoutRedirect({ plan, email: emailProp }: StripeCheckoutRedirectProps) {
  const [error, setError] = useState<string | null>(null);
  // "waiting" → resolving session, "redirecting" → hitting Stripe API, "failed" → show manual button
  const [phase, setPhase] = useState<"waiting" | "redirecting" | "failed">("waiting");
  const [resolvedEmail, setResolvedEmail] = useState(emailProp);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function resolveAndCheckout(attempts = 0): Promise<void> {
      // --- 1. Resolve session (retry up to 5× every 900 ms) ---
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;

      if (!user?.id) {
        if (attempts < 5) {
          setTimeout(() => resolveAndCheckout(attempts + 1), 900);
          return;
        }
        // After all retries, fall through to manual button
        setPhase("failed");
        setError("Session not detected. Please use the button below or sign in.");
        return;
      }

      const uid = user.id;
      const email = resolvedEmail || user.email || "";
      setUserId(uid);
      if (!resolvedEmail && user.email) setResolvedEmail(user.email);
      setPhase("redirecting");

      // --- 2. Create Stripe checkout session and redirect ---
      try {
        const response = await fetch("/api/stripe/create-checkout-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan, userId: uid, userEmail: email }),
        });
        if (cancelled) return;
        const sessionData = await response.json();
        if (!response.ok) throw new Error(sessionData.error || "Failed to create checkout session.");
        const { url } = sessionData;
        if (!url) throw new Error("No checkout URL returned from Stripe.");
        window.location.href = url;
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to initiate payment.");
        setPhase("failed");
      }
    }

    resolveAndCheckout();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Manual retry / fallback button handler
  async function handleManualCheckout() {
    setPhase("redirecting");
    setError(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const uid = userId || user?.id;
      const email = resolvedEmail || user?.email || "";
      if (!uid) {
        setError("Session not found. Please sign in first.");
        setPhase("failed");
        return;
      }
      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, userId: uid, userEmail: email }),
      });
      const sessionData = await response.json();
      if (!response.ok) throw new Error(sessionData.error || "Failed to create checkout session.");
      const { url } = sessionData;
      if (!url) throw new Error("No checkout URL returned from Stripe.");
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initiate payment.");
      setPhase("failed");
    }
  }

  // --- Waiting for session ---
  if (phase === "waiting") {
    return (
      <div className="flex flex-col gap-4 items-center text-center">
        <div style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: T.primary }}>
          EMAIL CONFIRMED ✓
        </div>
        <h1 style={{ fontFamily: T.display, fontWeight: 900, fontSize: "2.2rem", lineHeight: 0.95, letterSpacing: "-0.02em", color: T.fg }}>
          VERIFYING<br /><span style={{ color: T.primary }}>YOUR SESSION</span>
        </h1>
        <p style={{ fontFamily: T.sans, fontSize: "0.9rem", color: T.muted }}>
          Just a moment while we confirm your account…
        </p>
      </div>
    );
  }

  // --- Redirecting to Stripe ---
  if (phase === "redirecting") {
    return (
      <div className="flex flex-col gap-4 items-center text-center">
        <div style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: T.primary }}>
          EMAIL CONFIRMED ✓
        </div>
        <h1 style={{ fontFamily: T.display, fontWeight: 900, fontSize: "2.2rem", lineHeight: 0.95, letterSpacing: "-0.02em", color: T.fg }}>
          REDIRECTING<br /><span style={{ color: T.primary }}>TO CHECKOUT</span>
        </h1>
        <p style={{ fontFamily: T.sans, fontSize: "0.9rem", color: T.muted }}>
          Taking you to Stripe to complete your subscription…
        </p>
      </div>
    );
  }

  // --- Failed / manual fallback ---
  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="mb-2" style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: T.primary }}>
          EMAIL CONFIRMED ✓
        </div>
        <h1 style={{ fontFamily: T.display, fontWeight: 900, fontSize: "2.2rem", lineHeight: 0.95, letterSpacing: "-0.02em", color: T.fg }}>
          PROCEED TO<br /><span style={{ color: T.primary }}>PAYMENT</span>
        </h1>
      </div>

      <div className="rounded-xl p-5 flex flex-col gap-3" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
        {error ? (
          <p style={{ fontFamily: T.mono, fontSize: "11px", color: "#f87171" }}>{error}</p>
        ) : (
          <p style={{ fontFamily: T.sans, fontSize: "0.9rem", color: T.muted }}>
            Your email is confirmed. Click below to complete your subscription via Stripe.
          </p>
        )}
        {!userId && (
          <p style={{ fontFamily: T.mono, fontSize: "11px", color: T.muted }}>
            No session?{" "}
            <Link href="/learn/login" style={{ color: T.primary, textDecoration: "none" }}>
              Sign in →
            </Link>{" "}
            then return to this page.
          </p>
        )}
      </div>

      <button
        onClick={handleManualCheckout}
        className="w-full h-12 flex items-center justify-between px-5 transition-opacity hover:opacity-90"
        style={{
          fontFamily: T.mono,
          fontSize: "0.78rem",
          fontWeight: 600,
          letterSpacing: "0.06em",
          background: T.primary,
          color: T.primaryFg,
          borderRadius: T.r.md,
          boxShadow: `0 0 24px color-mix(in oklab, ${T.primary} 25%, transparent)`,
        }}
      >
        <span>Proceed to payment</span>
        <span>→</span>
      </button>

      <Link
        href="/pricing"
        style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: T.muted, textAlign: "center", textDecoration: "none" }}
      >
        ← Change plan
      </Link>
    </div>
  );
}
