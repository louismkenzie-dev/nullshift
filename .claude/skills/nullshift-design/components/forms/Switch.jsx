import React from "react";

/**
 * Toggle switch. Emerald track when on; surface track with a strong border when
 * off. Works controlled (`checked` + `onChange`) or uncontrolled
 * (`defaultChecked`). Optional inline label.
 */
export function Switch({
  checked,
  defaultChecked = false,
  onChange,
  disabled = false,
  label = null,
  id,
  className = "",
  style = {},
}) {
  const isControlled = checked !== undefined;
  const [internal, setInternal] = React.useState(defaultChecked);
  const on = isControlled ? checked : internal;

  const toggle = () => {
    if (disabled) return;
    const next = !on;
    if (!isControlled) setInternal(next);
    onChange && onChange(next);
  };

  const sw = (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-labelledby={label && id ? id + "-label" : undefined}
      disabled={disabled}
      onClick={toggle}
      style={{
        position: "relative",
        width: 40,
        height: 24,
        flexShrink: 0,
        borderRadius: "var(--radius-full)",
        border: `1px solid ${on ? "var(--primary)" : "var(--border-strong)"}`,
        background: on ? "var(--primary)" : "var(--surface)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        padding: 0,
        transition: "background var(--motion-base) var(--easing-standard), border-color var(--motion-base) var(--easing-standard)",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: on ? 18 : 2,
          width: 18,
          height: 18,
          borderRadius: "var(--radius-full)",
          background: on ? "var(--primary-fg)" : "var(--muted)",
          boxShadow: "0 1px 2px rgba(0,0,0,0.4)",
          transition: "left var(--motion-base) var(--easing-standard), background var(--motion-base)",
        }}
      />
    </button>
  );

  if (!label) return <span className={className} style={style}>{sw}</span>;
  return (
    <label htmlFor={id} className={className} style={{ display: "inline-flex", alignItems: "center", gap: 10, cursor: disabled ? "not-allowed" : "pointer", ...style }}>
      {sw}
      <span id={id ? id + "-label" : undefined} style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", color: "var(--fg)" }}>{label}</span>
    </label>
  );
}
