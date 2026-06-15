import React from "react";

/**
 * Tabs — a horizontal segmented selector with an emerald active indicator.
 * Provide `items` as [{ value, label, content? }]. Controlled via `value` +
 * `onChange`, or uncontrolled via `defaultValue`. Renders the active item's
 * `content` below the tab strip when present. `variant="underline"` (default)
 * draws an emerald baseline; `variant="pill"` fills the active tab.
 */
export function Tabs({
  items = [],
  value,
  defaultValue,
  onChange,
  variant = "underline",
  className = "",
  style = {},
}) {
  const isControlled = value !== undefined;
  const [internal, setInternal] = React.useState(defaultValue ?? (items[0] && items[0].value));
  const active = isControlled ? value : internal;
  const select = (v) => {
    if (!isControlled) setInternal(v);
    onChange && onChange(v);
  };
  const current = items.find((i) => i.value === active);

  return (
    <div className={className} style={style}>
      <div
        role="tablist"
        style={{
          display: "inline-flex",
          gap: variant === "pill" ? 4 : 4,
          padding: variant === "pill" ? 4 : 0,
          background: variant === "pill" ? "var(--surface)" : "transparent",
          border: variant === "pill" ? "1px solid var(--border)" : "none",
          borderBottom: variant === "underline" ? "1px solid var(--border)" : undefined,
          borderRadius: variant === "pill" ? "var(--radius-md)" : 0,
          width: variant === "underline" ? "100%" : "auto",
        }}
      >
        {items.map((it) => {
          const on = it.value === active;
          if (variant === "pill") {
            return (
              <button key={it.value} role="tab" aria-selected={on} onClick={() => select(it.value)}
                style={{
                  padding: "7px 14px", border: "none", cursor: "pointer",
                  fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", fontWeight: 500,
                  borderRadius: "var(--radius-sm)",
                  color: on ? "var(--primary)" : "var(--muted)",
                  background: on ? "var(--primary-soft)" : "transparent",
                  transition: "background var(--motion-base), color var(--motion-base)",
                }}
                onMouseEnter={(e) => { if (!on) e.currentTarget.style.color = "var(--fg)"; }}
                onMouseLeave={(e) => { if (!on) e.currentTarget.style.color = "var(--muted)"; }}>
                {it.label}
              </button>
            );
          }
          return (
            <button key={it.value} role="tab" aria-selected={on} onClick={() => select(it.value)}
              style={{
                position: "relative", padding: "10px 14px 12px", border: "none", background: "transparent", cursor: "pointer",
                fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", fontWeight: on ? 600 : 500,
                color: on ? "var(--fg)" : "var(--muted)",
                transition: "color var(--motion-base)",
              }}
              onMouseEnter={(e) => { if (!on) e.currentTarget.style.color = "var(--fg)"; }}
              onMouseLeave={(e) => { if (!on) e.currentTarget.style.color = "var(--muted)"; }}>
              {it.label}
              <span style={{
                position: "absolute", left: 0, right: 0, bottom: -1, height: 2,
                background: on ? "var(--primary)" : "transparent",
                borderRadius: 2,
                transition: "background var(--motion-base)",
              }} />
            </button>
          );
        })}
      </div>
      {current && current.content !== undefined && (
        <div role="tabpanel" style={{ paddingTop: 18 }}>{current.content}</div>
      )}
    </div>
  );
}
