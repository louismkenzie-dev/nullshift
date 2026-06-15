import React from "react";

/**
 * Eyebrow — the section label. Emerald dot + soft ring, uppercase sans,
 * 0.08em tracking. Used once per section to name the topic. Set `mono` for the
 * "// 01 — SECTION" code-marker variant.
 */
export function Eyebrow({ children, mono = false, className = "", style = {} }) {
  if (mono) {
    return (
      <span
        className={className}
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-mono)",
          fontWeight: 500,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--primary)",
          ...style,
        }}
      >
        {children}
      </span>
    );
  }
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-mono)",
        fontWeight: 500,
        letterSpacing: "var(--tracking-eyebrow)",
        textTransform: "uppercase",
        color: "var(--muted)",
        ...style,
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: "var(--radius-full)", background: "var(--primary)", boxShadow: "0 0 0 4px var(--primary-soft)", flexShrink: 0 }} />
      {children}
    </span>
  );
}
