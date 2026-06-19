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
          color: T.muted,
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
        placeholder="Type your full name"
        autoComplete="name"
        style={{
          width: "100%",
          maxWidth: 360,
          fontFamily: T.sans,
          fontSize: "0.95rem",
          height: 44,
          padding: "0 14px",
          background: T.bg,
          color: T.fg,
          border: `1px solid ${T.border}`,
          borderRadius: T.r.sm,
          outline: "none",
        }}
      />
      <div
        style={{
          marginTop: 10,
          height: 72,
          borderRadius: T.r.md,
          border: `1px dashed ${T.border}`,
          display: "flex",
          alignItems: "center",
          paddingInline: 18,
          background: T.surface,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-sans), cursive",
            fontStyle: "italic",
            fontSize: "1.7rem",
            color: value ? T.fg : T.faint,
          }}
        >
          {value || "Your signature"}
        </span>
      </div>
      <div style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, marginTop: 8 }}>
        Dated {today}
      </div>
    </div>
  );
}
