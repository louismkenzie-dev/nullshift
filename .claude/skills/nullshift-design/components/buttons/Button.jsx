import React from "react";

/**
 * Nullshift button. Primary is the one emerald fill with a top-light inset.
 * Secondary and ghost stay neutral; destructive is danger-tinted. Sentence
 * case, --font-sans (never mono), --radius-md, 40–48px tall.
 */
export function Button({
  children,
  variant = "primary",
  size = "md",
  disabled = false,
  iconStart = null,
  iconEnd = null,
  as = "button",
  className = "",
  style = {},
  ...rest
}) {
  const heights = { sm: 32, md: 40, lg: 48 };
  const pads = { sm: 12, md: 16, lg: 20 };
  const fontSizes = { sm: "var(--text-xs)", md: "var(--text-sm)", lg: "var(--text-sm)" };

  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: heights[size],
    paddingInline: pads[size],
    fontFamily: "var(--font-sans)",
    fontSize: fontSizes[size],
    fontWeight: 500,
    letterSpacing: "var(--tracking-body)",
    lineHeight: 1,
    whiteSpace: "nowrap",
    borderRadius: "var(--radius-md)",
    border: "1px solid transparent",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    textDecoration: "none",
    transition: "background var(--motion-base) var(--easing-standard), border-color var(--motion-base) var(--easing-standard), opacity var(--motion-base)",
  };

  const variants = {
    primary: {
      background: "var(--primary)",
      color: "var(--primary-fg)",
      boxShadow: "var(--inset-top-light)",
    },
    secondary: {
      background: "transparent",
      color: "var(--fg)",
      borderColor: "var(--border-strong)",
    },
    ghost: {
      background: "transparent",
      color: "var(--muted)",
    },
    destructive: {
      background: "transparent",
      color: "var(--danger)",
      borderColor: "color-mix(in oklab, var(--danger) 28%, transparent)",
    },
  };

  const hoverIn = (e) => {
    if (disabled) return;
    const el = e.currentTarget;
    if (variant === "primary") el.style.background = "var(--primary-hover)";
    else if (variant === "secondary") { el.style.background = "var(--elevated)"; }
    else if (variant === "ghost") { el.style.background = "var(--elevated)"; el.style.color = "var(--fg)"; }
    else if (variant === "destructive") el.style.background = "var(--danger-soft)";
  };
  const hoverOut = (e) => {
    const el = e.currentTarget;
    el.style.background = variants[variant].background;
    if (variant === "ghost") el.style.color = "var(--muted)";
  };

  const Comp = as;
  return (
    <Comp
      className={className}
      style={{ ...base, ...variants[variant], ...style }}
      disabled={as === "button" ? disabled : undefined}
      aria-disabled={disabled || undefined}
      onMouseEnter={hoverIn}
      onMouseLeave={hoverOut}
      {...rest}
    >
      {iconStart}
      {children}
      {iconEnd}
    </Comp>
  );
}
