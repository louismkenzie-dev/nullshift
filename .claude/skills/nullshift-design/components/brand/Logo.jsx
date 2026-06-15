import React from "react";

/**
 * Nullshift parallel-pill mark — two staggered rounded pills lifted from the
 * brand SVG (exact coordinates), so it renders identically everywhere. The left
 * pill colour is configurable for light-on-dark lockups.
 */
export function LogoMark({ size = 24, leftColor = "var(--pill-light)", className = "", style = {} }) {
  return (
    <svg
      width={(size * 44) / 56}
      height={size}
      viewBox="0 0 44 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
      style={style}
    >
      <rect x="2" y="0" width="17" height="52" rx="4.5" fill={leftColor} />
      <rect x="25" y="6" width="17" height="50" rx="4.5" fill="var(--primary)" />
    </svg>
  );
}

/**
 * Full Nullshift lockup: pill mark + "NULLSHIFT" wordmark in Inter 600.
 * On dark backgrounds only. Use `compact` for the sentence-case "Nullshift"
 * lockup used in nav drawers and footers.
 */
export function Logo({ size = 24, compact = false, leftColor = "var(--pill-light)", className = "", style = {} }) {
  return (
    <span
      className={className}
      style={{ display: "inline-flex", alignItems: "center", gap: size * 0.42, ...style }}
    >
      <LogoMark size={size} leftColor={leftColor} />
      <span
        style={{
          fontFamily: "var(--font-sans)",
          fontWeight: compact ? 600 : 800,
          fontSize: size * (compact ? 0.78 : 0.86),
          letterSpacing: compact ? "-0.01em" : "var(--tracking-wordmark)",
          lineHeight: 1,
          color: "var(--fg)",
        }}
      >
        {compact ? "Nullshift" : "NULLSHIFT"}
      </span>
    </span>
  );
}
