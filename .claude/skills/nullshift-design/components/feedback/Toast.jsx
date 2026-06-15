import React from "react";

/**
 * Toast — a transient notification on the elevated tier with a signal-coloured
 * accent rail and status dot. Render one directly, or stack several inside a
 * `ToastViewport`. Presentational: drive visibility / timing from your app.
 */
export function Toast({
  tone = "neutral",
  title,
  message = null,
  onClose = null,
  action = null,
  className = "",
  style = {},
}) {
  const tones = {
    neutral: "var(--muted)",
    primary: "var(--primary)",
    success: "var(--success)",
    warning: "var(--warning)",
    info: "var(--info)",
    danger: "var(--danger)",
  };
  const accent = tones[tone] || tones.neutral;
  return (
    <div
      role="status"
      className={className}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        width: "min(380px, 100%)",
        padding: "14px 16px",
        paddingLeft: 18,
        background: "var(--elevated)",
        border: "1px solid var(--border-strong)",
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--shadow-lg)",
        overflow: "hidden",
        ...style,
      }}
    >
      <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: accent }} />
      <span style={{ width: 8, height: 8, marginTop: 5, borderRadius: "var(--radius-full)", background: accent, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--fg)" }}>{title}</div>
        {message && <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-xs)", color: "var(--muted)", marginTop: 3, lineHeight: 1.5 }}>{message}</div>}
        {action && <div style={{ marginTop: 10 }}>{action}</div>}
      </div>
      {onClose && (
        <button onClick={onClose} aria-label="Dismiss" style={{ background: "none", border: "none", color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: 16, lineHeight: 1, cursor: "pointer", flexShrink: 0, marginTop: -1 }}>×</button>
      )}
    </div>
  );
}

/**
 * Fixed stack container for toasts. `position` controls the corner.
 */
export function ToastViewport({ children, position = "bottom-right", style = {} }) {
  const pos = {
    "bottom-right": { bottom: 20, right: 20, alignItems: "flex-end" },
    "bottom-left": { bottom: 20, left: 20, alignItems: "flex-start" },
    "top-right": { top: 20, right: 20, alignItems: "flex-end" },
    "top-left": { top: 20, left: 20, alignItems: "flex-start" },
  }[position];
  return (
    <div style={{ position: "fixed", zIndex: 120, display: "flex", flexDirection: "column", gap: 10, ...pos, ...style }}>
      {children}
    </div>
  );
}
