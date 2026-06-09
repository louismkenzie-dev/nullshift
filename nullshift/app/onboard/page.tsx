"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { T } from "@/lib/tokens";
import { LogoMark } from "@/components/Logo";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/env";

type Plan = "core" | "grow" | "pro";

const PLAN_META: Record<Plan, { label: string; price: string; features: string[] }> = {
  core: {
    label: "Core",
    price: "£19.99 / month",
    features: ["Full video library", "AI tool tutorials", "New content monthly", "Self-paced learning"],
  },
  grow: {
    label: "Grow",
    price: "£49 / month",
    features: ["Everything in Core", "Email support", "Live chat assistance", "Priority response"],
  },
  pro: {
    label: "Pro",
    price: "£249 / month",
    features: ["Everything in Grow", "All resources", "Bespoke 1-to-1 call support", "Workflow strategy"],
  },
};

export default function OnboardPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: T.bg }} />}>
      <OnboardFlow />
    </Suspense>
  );
}

function OnboardFlow() {
  const params = useSearchParams();
  const rawPlan = params.get("plan") ?? "core";
  const plan: Plan = rawPlan in PLAN_META ? (rawPlan as Plan) : "core";
  const meta = PLAN_META[plan];

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

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
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed.");
    } finally {
      setBusy(false);
    }
  }

  const isConfigured = hasSupabaseBrowserConfig();

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-start px-6 py-16"
      style={{ background: T.bg }}
    >
      {/* Logo */}
      <a href="/" className="flex items-center gap-2.5 mb-12">
        <LogoMark size={24} />
        <span style={{ fontFamily: T.display, fontWeight: 900, fontSize: "1.1rem", letterSpacing: "0.04em", color: T.fg }}>
          NULLSHIFT
        </span>
      </a>

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
                YOU'VE CHOSEN<br /><span style={{ color: T.primary }}>{meta.label.toUpperCase()}</span>
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
                <a
                  href="/pricing"
                  style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: T.muted, textDecoration: "none" }}
                >
                  Change plan
                </a>
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
              <a href="/learn/login" style={{ color: T.primary, textDecoration: "none" }}>Sign in →</a>
            </p>
          </div>
        )}

        {/* ── Step 3: Payment placeholder ── */}
        {step === 3 && (
          <div className="flex flex-col gap-6">
            <div>
              <div
                className="mb-2"
                style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: T.primary }}
              >
                STEP 03 / PAYMENT
              </div>
              <h1 style={{ fontFamily: T.display, fontWeight: 900, fontSize: "2.2rem", lineHeight: 0.95, letterSpacing: "-0.02em", color: T.fg }}>
                ALMOST<br /><span style={{ color: T.primary }}>THERE</span>
              </h1>
            </div>

            <div
              className="rounded-xl p-8 flex flex-col items-center gap-4 text-center"
              style={{ background: T.surface, border: `1px solid ${T.border}` }}
            >
              {/* Placeholder icon */}
              <div
                className="size-14 rounded-full grid place-content-center"
                style={{ background: `${T.primary}15`, border: `1px solid ${T.primary}30` }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <rect x="2" y="5" width="20" height="14" rx="2" stroke={T.primary} strokeWidth="1.5" />
                  <path d="M2 10h20" stroke={T.primary} strokeWidth="1.5" />
                  <path d="M6 15h4" stroke={T.primary} strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <div style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: T.primary, marginBottom: "8px" }}>
                  PAYMENT_INTEGRATION / COMING_SOON
                </div>
                <p style={{ fontFamily: T.sans, fontSize: "0.9rem", lineHeight: 1.65, color: T.muted, maxWidth: "36ch" }}>
                  Stripe payment is being wired up. Your account has been created — we'll email you at <span style={{ color: T.fg }}>{email || "your address"}</span> when billing goes live.
                </p>
              </div>
              <div className="w-full h-px" style={{ background: T.border }} />
              <div className="w-full flex flex-col gap-2 text-left">
                <div style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: T.muted }}>
                  SELECTED PLAN
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ fontFamily: T.sans, fontSize: "0.9rem", color: T.fg }}>{meta.label}</span>
                  <span style={{ fontFamily: T.display, fontWeight: 700, fontSize: "1rem", color: T.primary }}>{meta.price}</span>
                </div>
              </div>
            </div>

            <a
              href="/learn"
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
                textDecoration: "none",
              }}
            >
              <span>Go to my dashboard</span>
              <span>→</span>
            </a>

            <p style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.06em", textTransform: "uppercase", color: T.muted, textAlign: "center" }}>
              Questions? <a href="/book" style={{ color: T.primary, textDecoration: "none" }}>Book a call →</a>
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
