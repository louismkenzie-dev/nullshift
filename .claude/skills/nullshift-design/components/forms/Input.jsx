import React from "react";

/**
 * Text input — surface fill, hairline border, emerald focus ring. Matches the
 * `.brief-input` pattern from the live intake forms. Supports an optional
 * label, helper/error text, and an error state.
 */
export function Input({
  label = null,
  helper = null,
  error = null,
  id,
  className = "",
  style = {},
  ...rest
}) {
  const [focused, setFocused] = React.useState(false);
  const invalid = !!error;
  const borderColor = invalid
    ? "var(--danger)"
    : focused
    ? "var(--primary)"
    : "var(--border)";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7, width: "100%" }} className={className}>
      {label && (
        <label htmlFor={id} style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-xs)", fontWeight: 500, color: "var(--muted)" }}>
          {label}
        </label>
      )}
      <input
        id={id}
        onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
        style={{
          width: "100%",
          background: "var(--surface)",
          color: "var(--fg)",
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-base)",
          letterSpacing: "var(--tracking-body)",
          border: `1px solid ${borderColor}`,
          borderRadius: "var(--radius-md)",
          padding: "10px 14px",
          outline: "none",
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
