"use client";

import { useActionState } from "react";
import Link from "next/link";
import { T } from "@nullshift/ui/tokens";
import { LogoMark } from "@nullshift/ui/components/Logo";
import { Eyebrow, Display } from "@/components/kyma";
import { Reveal } from "@/components/Reveal";
import { requestPasswordReset, type ForgotResult } from "./actions";

/**
 * "I can't get in." — the page that was missing.
 *
 * A client whose account exists but whose password doesn't work had nowhere to
 * go: sign-in failed, sign-up told them the account already existed, and
 * recovery required a staff member to press a button. This closes the loop.
 */

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 44,
  background: "var(--k-surface)",
  border: "1px solid var(--k-border)",
  borderRadius: 0,
  padding: "0 14px",
  color: "var(--k-fg)",
  fontFamily: T.sans,
  fontSize: "0.9375rem",
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: "0.66rem",
  fontWeight: 500,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--k-muted)",
};

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState<ForgotResult | null, FormData>(
    requestPasswordReset,
    null
  );

  return (
    <main
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: "var(--k-bg)" }}
    >
      <Reveal className="w-full max-w-sm">
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

        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <Eyebrow index="01" label="Client Portal" align="center" />
          <Display as="h1" size="md">
            Reset your password
          </Display>
        </div>

        {state?.ok ? (
          <div
            className="k-kard p-8"
            style={{
              background: "var(--k-surface)",
              borderColor: "color-mix(in oklab, var(--k-accent) 45%, transparent)",
            }}
          >
            <span
              style={{
                ...labelStyle,
                color: "var(--k-accent)",
              }}
            >
              Check your email
            </span>
            <p
              style={{
                fontFamily: T.sans,
                fontSize: "0.92rem",
                lineHeight: 1.7,
                color: "var(--k-fg)",
                marginTop: 10,
              }}
            >
              If that email has a Nullshift portal account, a reset link is on its way.
              It&apos;s valid for one hour — check your spam folder if it doesn&apos;t
              arrive in a few minutes.
            </p>
            <Link
              href="/portal/login"
              style={{
                ...labelStyle,
                color: "var(--k-muted)",
                display: "inline-block",
                marginTop: 18,
                textDecoration: "underline",
                textUnderlineOffset: 3,
              }}
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <form
            action={action}
            className="k-kard flex flex-col gap-4 p-8"
            style={{ background: "var(--k-surface)" }}
          >
            <p
              style={{
                fontFamily: T.sans,
                fontSize: "0.88rem",
                lineHeight: 1.65,
                color: "var(--k-muted)",
              }}
            >
              Enter the email you use for your portal and we&apos;ll send you a link to
              set a new password.
            </p>

            <div className="flex flex-col gap-1.5">
              <label style={labelStyle}>Email</label>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                style={inputStyle}
              />
            </div>

            {state && !state.ok && state.error && (
              <p
                style={{
                  fontFamily: T.mono,
                  fontSize: "0.7rem",
                  letterSpacing: "0.04em",
                  color: T.danger,
                }}
              >
                {state.error}
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="kb kb-primary mt-2"
              style={{ width: "100%" }}
            >
              {pending ? "Sending…" : "Send reset link"}
            </button>

            <Link
              href="/portal/login"
              style={{
                ...labelStyle,
                color: "var(--k-muted)",
                textAlign: "center",
                textDecoration: "underline",
                textUnderlineOffset: 3,
              }}
            >
              Back to sign in
            </Link>
          </form>
        )}
      </Reveal>
    </main>
  );
}
