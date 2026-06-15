import React from "react";

/**
 * Stat / metric card — the admin dashboard KPI block. Mono label, large
 * display value (accent-coloured), mono sublabel. Surface tier, hairline
 * border, no shadow.
 */
export function StatCard({ label, value, sublabel = null, accent = "var(--primary)", className = "", style = {} }) {
  return (
    <div
      className={className}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: 20,
        ...style,
      }}
    >
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "1.9rem", lineHeight: 1, letterSpacing: "var(--tracking-display)", color: accent, marginBottom: sublabel ? 6 : 0 }}>
        {value}
      </div>
      {sublabel && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--muted)" }}>{sublabel}</div>
      )}
    </div>
  );
}
