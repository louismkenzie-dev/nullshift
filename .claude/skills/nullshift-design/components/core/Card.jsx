import React from "react";

/**
 * Surface card — the default container at the `surface` tier. Hairline border
 * defines geometry; no drop shadow (only modals earn that). `interactive` adds
 * a hover lift to --elevated. `highlighted` adds an emerald edge for the
 * featured card in a set.
 */
export function Card({
  children,
  interactive = false,
  highlighted = false,
  padding = 24,
  radius = "var(--radius-lg)",
  className = "",
  style = {},
  ...rest
}) {
  const base = {
    background: "var(--surface)",
    border: `1px solid ${highlighted ? "color-mix(in oklab, var(--primary) 38%, var(--border))" : "var(--border)"}`,
    borderRadius: radius,
    padding,
    boxShadow: highlighted ? "0 0 0 1px var(--primary-soft)" : "none",
    transition: "background var(--motion-base) var(--easing-standard), border-color var(--motion-base) var(--easing-standard)",
  };
  const hoverIn = (e) => {
    if (!interactive) return;
    e.currentTarget.style.background = "var(--elevated)";
    e.currentTarget.style.borderColor = "var(--border-strong)";
  };
  const hoverOut = (e) => {
    if (!interactive) return;
    e.currentTarget.style.background = "var(--surface)";
    e.currentTarget.style.borderColor = highlighted ? "color-mix(in oklab, var(--primary) 38%, var(--border))" : "var(--border)";
  };
  return (
    <div className={className} style={{ ...base, ...style }} onMouseEnter={hoverIn} onMouseLeave={hoverOut} {...rest}>
      {children}
    </div>
  );
}
