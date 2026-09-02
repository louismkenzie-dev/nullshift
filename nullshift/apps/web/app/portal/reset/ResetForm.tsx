"use client";

import { useActionState } from "react";
import Link from "next/link";
import { T } from "@nullshift/ui/tokens";
import { setPasswordFromLink, type ResetResult } from "./actions";

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

/**
 * The choose-your-password form. Renders IMMEDIATELY — the token travels as a
 * hidden field and is verified server-side on submit, so there is no
 * "opening your secure link…" wait and nothing for a mail scanner to consume
 * before the client has even seen the page.
 */
export function ResetForm({
  tokenHash,
  type,
  next,
}: {
  tokenHash: string;
  type: string;
  next: string;
}) {
  const [state, action, pending] = useActionState<ResetResult, FormData>(
    setPasswordFromLink,
    null
  );

  if (state && !state.ok && state.expired) {
    return (
      <div className="k-kard p-8" style={{ background: "var(--k-surface)" }}>
        <p
          style={{
            fontFamily: T.sans,
            fontSize: "0.92rem",
            lineHeight: 1.7,
            color: "var(--k-fg)",
          }}
        >
          {state.error}
        </p>
        <Link
          href="/portal/forgot"
          className="kb kb-primary mt-5"
          style={{ width: "100%" }}
        >
          Send me a new link
          <span className="k-arrow" aria-hidden>
            →
          </span>
        </Link>
      </div>
    );
  }

  return (
    <form
      action={action}
      className="k-kard flex flex-col gap-4 p-8"
      style={{ background: "var(--k-surface)" }}
    >
      <input type="hidden" name="token_hash" value={tokenHash} />
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="next" value={next} />

      <div className="flex flex-col gap-1.5">
        <label style={labelStyle}>New password</label>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="Min. 8 characters"
          style={inputStyle}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label style={labelStyle}>Confirm password</label>
        <input
          name="confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="Re-enter password"
          style={inputStyle}
        />
      </div>

      {state && !state.ok && (
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
        style={{ width: "100%", opacity: pending ? 0.6 : 1 }}
      >
        {pending ? "Saving…" : "Save password and sign in"}
        <span className="k-arrow" aria-hidden>
          →
        </span>
      </button>
    </form>
  );
}
