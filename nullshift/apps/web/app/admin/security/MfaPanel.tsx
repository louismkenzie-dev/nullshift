"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@nullshift/db/client";
import { T } from "@nullshift/ui/tokens";

/**
 * Staff TOTP 2FA (brief §9). Handles two flows:
 *  - ENROLL: no verified factor yet → scan a QR, verify a code, factor is active.
 *  - STEP-UP: a verified factor exists but the session is aal1 → enter a code to
 *    reach aal2 (the dashboard layout redirects here when that's required).
 * Lives outside the dashboard route group so enforcement can't lock anyone out.
 */
type Factor = { id: string; friendly_name?: string | null; status: string };

export function MfaPanel() {
  const router = useRouter();
  const supabase = createClient();

  const [factors, setFactors] = useState<Factor[]>([]);
  const [aal, setAal] = useState<{ current: string; next: string } | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [enrollId, setEnrollId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  async function refresh() {
    const [{ data: f }, { data: a }] = await Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);
    setFactors((f?.all ?? []) as Factor[]);
    if (a) setAal({ current: a.currentLevel ?? "aal1", next: a.nextLevel ?? "aal1" });
    setLoaded(true);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const verified = factors.find((f) => f.status === "verified");
  const needsStepUp = aal?.current === "aal1" && aal?.next === "aal2";

  async function startEnroll() {
    setError(null);
    setBusy(true);
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `nullshift-${Date.now()}`,
    });
    setBusy(false);
    if (error) return setError(error.message);
    setQr(data.totp.qr_code);
    setEnrollId(data.id);
  }

  async function verifyEnroll() {
    if (!enrollId) return;
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: enrollId,
      code: code.trim(),
    });
    setBusy(false);
    if (error) return setError(error.message);
    setQr(null);
    setEnrollId(null);
    setCode("");
    await refresh();
    router.refresh();
  }

  async function stepUp() {
    if (!verified) return;
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: verified.id,
      code: code.trim(),
    });
    setBusy(false);
    if (error) return setError(error.message);
    setCode("");
    router.replace("/admin");
    router.refresh();
  }

  async function unenroll(factorId: string) {
    setBusy(true);
    await supabase.auth.mfa.unenroll({ factorId });
    setBusy(false);
    await refresh();
    router.refresh();
  }

  if (!loaded) {
    return <p style={{ fontFamily: T.mono, fontSize: 12, color: T.muted }}>Loading…</p>;
  }

  return (
    <div style={{ maxWidth: 460 }}>
      {error && (
        <p
          style={{ fontFamily: T.mono, fontSize: 12, color: T.danger, marginBottom: 14 }}
        >
          {error}
        </p>
      )}

      {/* Step-up challenge (verified factor, session still aal1) */}
      {verified && needsStepUp && (
        <div style={card}>
          <div style={cardLabel}>Two-factor required</div>
          <p style={cardBody}>
            Enter the 6-digit code from your authenticator app to continue.
          </p>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            placeholder="123456"
            style={input}
          />
          <button onClick={stepUp} disabled={busy} style={primaryBtn}>
            Verify &amp; continue
          </button>
        </div>
      )}

      {/* Enrollment */}
      {!verified && !qr && (
        <div style={card}>
          <div style={cardLabel}>Set up two-factor authentication</div>
          <p style={cardBody}>
            Protect the ops hub with a TOTP authenticator (Google Authenticator,
            1Password, etc.).
          </p>
          <button onClick={startEnroll} disabled={busy} style={primaryBtn}>
            Begin setup
          </button>
        </div>
      )}

      {qr && (
        <div style={card}>
          <div style={cardLabel}>Scan this QR, then enter the code</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qr}
            alt="TOTP QR code"
            style={{
              width: 180,
              height: 180,
              background: "#fff",
              borderRadius: 8,
              padding: 8,
              margin: "8px 0",
            }}
          />
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            placeholder="123456"
            style={input}
          />
          <button onClick={verifyEnroll} disabled={busy} style={primaryBtn}>
            Verify &amp; enable
          </button>
        </div>
      )}

      {/* Existing factors */}
      {verified && !needsStepUp && (
        <div style={card}>
          <div style={cardLabel}>Two-factor is on ✓</div>
          {factors
            .filter((f) => f.status === "verified")
            .map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between"
                style={{ marginTop: 10 }}
              >
                <span style={{ fontFamily: T.mono, fontSize: 12, color: T.muted }}>
                  {f.friendly_name || "TOTP"}
                </span>
                <button onClick={() => unenroll(f.id)} disabled={busy} style={ghostBtn}>
                  Remove
                </button>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

const card = {
  background: T.surface,
  border: `1px solid ${T.border}`,
  borderRadius: T.r.lg,
  padding: "20px 22px",
} as const;
const cardLabel = {
  fontFamily: T.display,
  fontWeight: 600,
  fontSize: "1.05rem",
  color: T.fg,
  marginBottom: 6,
} as const;
const cardBody = {
  fontFamily: T.sans,
  fontSize: "0.88rem",
  color: T.muted,
  lineHeight: 1.6,
  marginBottom: 14,
} as const;
const input = {
  fontFamily: T.mono,
  fontSize: "1rem",
  letterSpacing: "0.3em",
  height: 44,
  width: "100%",
  padding: "0 14px",
  background: T.bg,
  color: T.fg,
  border: `1px solid ${T.border}`,
  borderRadius: T.r.md,
  marginBottom: 12,
} as const;
const primaryBtn = {
  fontFamily: T.sans,
  fontWeight: 600,
  fontSize: "0.9rem",
  height: 42,
  paddingInline: 20,
  background: T.primary,
  color: T.primaryFg,
  border: "none",
  borderRadius: T.r.md,
  cursor: "pointer",
} as const;
const ghostBtn = {
  fontFamily: T.mono,
  fontSize: 11,
  height: 28,
  paddingInline: 10,
  background: "transparent",
  color: T.danger,
  border: `1px solid ${T.danger}40`,
  borderRadius: 5,
  cursor: "pointer",
} as const;
