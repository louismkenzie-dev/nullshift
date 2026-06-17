import { T } from "@nullshift/ui/tokens";

/**
 * Nullshift parallel-pill mark — two staggered rounded pills, taken from the
 * brand SVG (paths only, so it renders identically everywhere). The left pill
 * colour is configurable so it works on dark (light pill) lockups.
 */
export function LogoMark({
  size = 22,
  leftColor = "#d6d6d6",
}: {
  size?: number;
  leftColor?: string;
}) {
  return (
    <svg
      width={(size * 44) / 56}
      height={size}
      viewBox="0 0 44 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect x="2" y="0" width="17" height="52" rx="4.5" fill={leftColor} />
      <rect x="25" y="6" width="17" height="50" rx="4.5" fill={T.primary} />
    </svg>
  );
}

/**
 * Full logo lockup: pill mark + "NULLSHIFT" wordmark in Barlow Condensed Black
 * (the logo's own typeface).
 */
export function Logo({
  markSize = 22,
  className = "",
}: {
  markSize?: number;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={markSize} />
      <span
        style={{
          fontFamily: T.display,
          fontWeight: 900,
          fontSize: `${markSize * 0.86}px`,
          letterSpacing: "0.02em",
          lineHeight: 1,
          color: T.fg,
        }}
      >
        NULLSHIFT
      </span>
    </span>
  );
}
