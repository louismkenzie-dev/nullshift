import React from "react";

/**
 * Tag / chip — a full-radius pill for categories and filters (industries,
 * services). Emerald-tinted by default; `interactive` brightens on hover.
 */
export function Tag({ children, interactive = false, className = "", style = {}, ...rest }) {
  const hoverIn = (e) => {
    if (!interactive) return;
    e.currentTarget.style.background = "color-mix(in oklab, var(--primary) 14%, transparent)";
    e.currentTarget.style.borderColor = "color-mix(in oklab, var(--primary) 55%, transparent)";
  };
  const hoverOut = (e) => {
    if (!interactive) return;
    e.currentTarget.style.background = "color-mix(in oklab, var(--primary) 8%, transparent)";
    e.currentTarget.style.borderColor = "color-mix(in oklab, var(--primary) 30%, transparent)";
  };
  return (
    <span
      className={className}
      onMouseEnter={hoverIn}
      onMouseLeave={hoverOut}
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 28,
        paddingInline: 12,
        fontFamily: "var(--font-mono)",
        fontSize: "var(--text-mono)",
        fontWeight: 500,
        color: "var(--primary)",
        background: "color-mix(in oklab, var(--primary) 8%, transparent)",
        border: "1px solid color-mix(in oklab, var(--primary) 30%, transparent)",
        borderRadius: "var(--radius-full)",
        cursor: interactive ? "pointer" : "default",
        transition: "background var(--motion-base), border-color var(--motion-base)",
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  );
}
