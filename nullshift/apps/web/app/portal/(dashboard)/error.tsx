"use client";

import { useEffect } from "react";
import { T } from "@nullshift/ui/tokens";

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Portal error:", error);
  }, [error]);

  return (
    <div style={{ padding: "60px 24px", maxWidth: 520, margin: "0 auto" }}>
      <div
        style={{
          fontFamily: T.mono,
          fontSize: "10px",
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: T.danger,
          marginBottom: 12,
        }}
      >
        {"// Portal error"}
      </div>
      <h2
        style={{
          fontFamily: T.display,
          fontWeight: 600,
          fontSize: "1.4rem",
          color: T.fg,
          marginBottom: 12,
        }}
      >
        Something went wrong
      </h2>
      <p
        style={{
          fontFamily: T.mono,
          fontSize: "0.78rem",
          color: T.danger,
          background: `${T.danger}12`,
          border: `1px solid ${T.danger}30`,
          borderRadius: 8,
          padding: "10px 14px",
          marginBottom: 20,
          wordBreak: "break-all",
          lineHeight: 1.6,
        }}
      >
        {error.message || "Unknown error"}
        {error.digest && (
          <span
            style={{ display: "block", marginTop: 6, color: T.muted, fontSize: "0.7rem" }}
          >
            Digest: {error.digest}
          </span>
        )}
      </p>
      <button
        onClick={reset}
        style={{
          fontFamily: T.mono,
          fontSize: "0.72rem",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          background: T.primary,
          color: T.primaryFg,
          border: "none",
          borderRadius: 8,
          padding: "10px 20px",
          cursor: "pointer",
        }}
      >
        Try again
      </button>
    </div>
  );
}
