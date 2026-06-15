import React from "react";

/**
 * Status badge. Signal-coloured, soft-filled, for STATUS only (new, accepted,
 * pending, lost) — never decoration. Includes a leading dot by default.
 */
export function Badge({ children, tone = "neutral", dot = true, className = "", style = {} }) {
  const tones = {
    neutral: { color: "var(--muted)", bg: "var(--elevated)", border: "var(--border)" },
    primary: { color: "var(--primary)", bg: "var(--primary-soft)", border: "color-mix(in oklab, var(--primary) 35%, transparent)" },
    success: { color: "var(--success)", bg: "var(--success-soft)", border: "color-mix(in oklab, var(--success) 35%, transparent)" },
    warning: { color: "var(--warning)", bg: "var(--warning-soft)", border: "color-mix(in oklab, var(--warning) 35%, transparent)" },
    info:    { color: "var(--info)",    bg: "var(--info-soft)",    border: "color-mix(in oklab, var(--info) 35%, transparent)" },
    danger:  { color: "var(--danger)",  bg: "var(--danger-soft)",  border: "color-mix(in oklab, var(--danger) 35%, transparent)" },
  };
  const t = tones[tone] || tones.neutral;
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 22,
        paddingInline: 9,
        fontFamily: "var(--font-mono)",
        fontSize: "var(--text-mono-sm)",
        fontWeight: 500,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        color: t.color,
        background: t.bg,
        border: `1px solid ${t.border}`,
        borderRadius: "var(--radius-sm)",
        ...style,
      }}
    >
      {dot && <span style={{ width: 5, height: 5, borderRadius: "var(--radius-full)", background: t.color, flexShrink: 0 }} />}
      {children}
    </span>
  );
}
