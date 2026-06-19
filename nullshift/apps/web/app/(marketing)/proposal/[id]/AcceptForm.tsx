"use client";

import { useState } from "react";
import { T } from "@nullshift/ui/tokens";

export function AcceptForm({ proposalId }: { proposalId: string }) {
  const [name, setName] = useState("");
  const [date] = useState(() => new Date().toLocaleDateString("en-GB"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function accept() {
    if (!name.trim()) {
      setError("Please type your full name to sign.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/proposals/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: proposalId, name, signature: name }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Something went wrong.");
      }
      setDone(true);
      // Reload so the server re-renders with accepted=true, enabling the PDF button.
      setTimeout(() => window.location.reload(), 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <p
        style={{
          textAlign: "center",
          fontFamily: T.mono,
          fontSize: "0.9rem",
          color: T.primary,
        }}
      >
        ✓ Thank you, {name}. Your acceptance has been recorded — we&apos;ll be in touch
        shortly.
      </p>
    );
  }

  const input: React.CSSProperties = {
    background: T.bg,
    border: `1px solid ${T.border}`,
    borderRadius: 6,
    padding: "12px 16px",
    color: T.fg,
    fontFamily: T.sans,
    fontSize: "0.95rem",
    outline: "none",
    width: "100%",
  };
  const label: React.CSSProperties = {
    fontFamily: T.mono,
    fontSize: "0.72rem",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: T.muted,
    marginBottom: 8,
    display: "block",
  };

  return (
    <div>
      <div className="grid sm:grid-cols-2 gap-6 mb-6">
        <div>
          <label style={label}>Your name (signature)</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            style={input}
            autoComplete="name"
          />
        </div>
        <div>
          <label style={label}>Date</label>
          <input value={date} readOnly style={{ ...input, color: T.muted }} />
        </div>
      </div>

      {/* Signature preview — typed name rendered as a script-style signature */}
      <div className="mb-6">
        <label style={label}>Signature preview</label>
        <div
          style={{
            background: T.bg,
            border: `1px solid ${T.borderStr}`,
            borderRadius: 6,
            height: 96,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-sans), cursive",
              fontStyle: "italic",
              fontSize: "2rem",
              color: name ? T.fg : T.muted,
            }}
          >
            {name || "Type your name above"}
          </span>
        </div>
      </div>

      {error && (
        <p
          style={{
            fontFamily: T.mono,
            fontSize: "0.8rem",
            color: T.danger,
            marginBottom: 12,
            textAlign: "center",
          }}
        >
          {error}
        </p>
      )}

      <button
        onClick={accept}
        disabled={busy}
        className="w-full transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{
          background: T.primary,
          color: T.primaryFg,
          padding: "16px",
          borderRadius: 8,
          fontFamily: T.display,
          fontWeight: 800,
          fontSize: "1.1rem",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {busy ? "Recording…" : "Accept Proposal"}
      </button>
    </div>
  );
}
