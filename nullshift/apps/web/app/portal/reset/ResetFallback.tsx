"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@nullshift/db/client";
import { T } from "@nullshift/ui/tokens";
import { hasSupabaseBrowserConfig } from "@nullshift/db/env";
import { safePortalNext } from "@/lib/portalLinks";

/**
 * Shown when the page is opened WITHOUT a token_hash — i.e. an old-style
 * Supabase action_link that redirected here with the session in the URL
 * fragment, or an expired/used link that arrived as `#error=…`. The server
 * can't see a fragment, so this small client piece reads it:
 *
 *   • #access_token + #refresh_token → adopt the session (setSession) and let
 *     the client choose a password right here, so the last emails sent under
 *     the old flow still work now that the redirect allow-list is right.
 *   • #error_code=otp_expired (or any error) → say so plainly and offer a new link.
 *   • nothing useful → the link was incomplete; offer a new link.
 */
type Mode = "checking" | "legacy" | "expired" | "missing";

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
const copy: React.CSSProperties = {
  fontFamily: T.sans,
  fontSize: "0.92rem",
  lineHeight: 1.7,
  color: "var(--k-fg)",
};

export function ResetFallback({ next }: { next: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("checking");
  const [message, setMessage] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const errorCode = hash.get("error_code") || hash.get("error");
    if (errorCode) {
      setMessage(
        errorCode === "otp_expired"
          ? "This link has expired or was already used."
          : hash.get("error_description")?.replace(/\+/g, " ") ||
              "This link could not be opened."
      );
      setMode("expired");
      return;
    }
    const access = hash.get("access_token");
    const refresh = hash.get("refresh_token");
    if (access && refresh && hasSupabaseBrowserConfig()) {
      createClient()
        .auth.setSession({ access_token: access, refresh_token: refresh })
        .then(({ error: e }) => {
          if (e) {
            setMessage("This link has expired or was already used.");
            setMode("expired");
          } else {
            // Don't leave tokens sitting in the address bar / history.
            window.history.replaceState(
              window.history.state,
              "",
              window.location.pathname
            );
            setMode("legacy");
          }
        });
      return;
    }
    setMode("missing");
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    setBusy(true);
    const { error: updErr } = await createClient().auth.updateUser({ password });
    if (updErr) {
      setError(updErr.message);
      setBusy(false);
      return;
    }
    router.replace(safePortalNext(next));
    router.refresh();
  }

  if (mode === "checking") {
    return (
      <p
        className="k-kard text-center p-8"
        style={{ ...copy, background: "var(--k-surface)" }}
      >
        Checking your link…
      </p>
    );
  }

  if (mode === "legacy") {
    return (
      <form
        onSubmit={onSubmit}
        className="k-kard flex flex-col gap-4 p-8"
        style={{ background: "var(--k-surface)" }}
      >
        <div className="flex flex-col gap-1.5">
          <label style={labelStyle}>New password</label>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            placeholder="Min. 8 characters"
            style={inputStyle}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label style={labelStyle}>Confirm password</label>
          <input
            type="password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            placeholder="Re-enter password"
            style={inputStyle}
          />
        </div>
        {error && (
          <p style={{ fontFamily: T.mono, fontSize: "0.7rem", color: T.danger }}>
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="kb kb-primary mt-2"
          style={{ width: "100%", opacity: busy ? 0.6 : 1 }}
        >
          {busy ? "Saving…" : "Save password and sign in"}
          <span className="k-arrow" aria-hidden>
            →
          </span>
        </button>
      </form>
    );
  }

  return (
    <div className="k-kard p-8" style={{ background: "var(--k-surface)" }}>
      <p style={copy}>
        {mode === "expired"
          ? message
          : "This link is incomplete — it may have been cut short by your email app."}{" "}
        Request a fresh one and it will arrive within a couple of minutes.
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
