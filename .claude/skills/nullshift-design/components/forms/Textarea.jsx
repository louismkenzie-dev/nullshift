import React from "react";

/**
 * Multi-line text input — same surface/border/focus treatment as Input.
 * Used for project briefs and message bodies.
 */
export function Textarea({
  label = null,
  helper = null,
  error = null,
  id,
  rows = 4,
  className = "",
  style = {},
  ...rest
}) {
  const [focused, setFocused] = React.useState(false);
  const invalid = !!error;
  const borderColor = invalid ? "var(--danger)" : focused ? "var(--primary)" : "var(--border)";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7, width: "100%" }} className={className}>
      {label && (
        <label htmlFor={id} style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-xs)", fontWeight: 500, color: "var(--muted)" }}>
          {label}
        </label>
      )}
      <textarea
        id={id}
        rows={rows}
        onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
        style={{
          width: "100%",
          background: "var(--surface)",
          color: "var(--fg)",
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-base)",
          lineHeight: "var(--leading-body)",
          letterSpacing: "var(--tracking-body)",
          border: `1px solid ${borderColor}`,
          borderRadius: "var(--radius-md)",
          padding: "10px 14px",
          outline: "none",
          resize: "vertical",
          boxShadow: focused && !invalid ? "var(--focus-ring)" : "none",
          transition: "border-color var(--motion-base) var(--easing-standard), box-shadow var(--motion-base) var(--easing-standard)",
          boxSizing: "border-box",
          ...style,
        }}
        {...rest}
      />
      {(error || helper) && (
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-xs)", color: invalid ? "var(--danger)" : "var(--faint)" }}>
          {error || helper}
        </span>
      )}
    </div>
  );
}
