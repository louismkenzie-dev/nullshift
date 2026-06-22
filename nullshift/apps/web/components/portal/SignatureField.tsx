"use client";

import { useState } from "react";
import { T } from "@nullshift/ui/tokens";

/**
 * Typed-name signature field — the client types their full name, which is shown
 * back in a cursive style + dated (a legally valid e-signature, matching the old
 * proposal flow). The typed value posts as the form field `name` (default
 * "signature") to the accept server action.
 */
export function SignatureField({ name = "signature" }: { name?: string }) {
  const [value, setValue] = useState("");
  const today = new Date().toLocaleDateString("en-GB");
  return (
    <div>
      <label
        style={{
          fontFamily: T.mono,
          fontSize: 10,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--k-muted)",
          display: "block",
          marginBottom: 6,
        }}
      >
        Your full name (signature)
      </label>
      <input
        name={name}
        required
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "var(--k-accent)";
          e.currentTarget.style.boxShadow = "0 0 0 3px rgba(16,185,129,0.25)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = "var(--k-border)";
          e.currentTarget.style.boxShadow = "none";
        }}
        placeholder="Type your full name"
        autoComplete="name"
        style={{
          width: "100%",
          maxWidth: 360,
          fontFamily: T.sans,
          fontSize: "0.95rem",
          height: 44,
          padding: "0 14px",
          background: "var(--k-surface)",
          color: "var(--k-fg)",
          border: "1px solid var(--k-border)",
          borderRadius: 0,
          outline: "none",
        }}
      />
      <div
        style={{
          marginTop: 10,
          height: 72,
          borderRadius: 0,
          border: "1px dashed var(--k-border-strong)",
          display: "flex",
          alignItems: "center",
          paddingInline: 18,
          background: "var(--k-surface)",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-sans), cursive",
            fontStyle: "italic",
            fontSize: "1.7rem",
            color: value ? "var(--k-fg)" : "var(--k-faint)",
          }}
        >
          {value || "Your signature"}
        </span>
      </div>
      <div
        style={{
          fontFamily: T.mono,
          fontSize: 11,
          letterSpacing: "0.06em",
          color: "var(--k-muted)",
          marginTop: 8,
        }}
      >
        Dated {today}
      </div>
    </div>
  );
}
