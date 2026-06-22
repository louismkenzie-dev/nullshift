import { T } from "@nullshift/ui/tokens";

/**
 * Branded route loader for the client hub. Shows instantly during navigation
 * while the (data-heavy) page renders server-side, so opening a profile never
 * feels like a dead click. The Nullshift parallel-pill mark "shifts" — the two
 * pills breathe in opposite phase, looping.
 */
export default function Loading() {
  return (
    <div
      style={{
        minHeight: "70vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
      }}
    >
      <style>{`
        @keyframes ns-pill-a { 0%,100% { opacity:.35; transform: translateY(2px) } 50% { opacity:1; transform: translateY(-2px) } }
        @keyframes ns-pill-b { 0%,100% { opacity:1; transform: translateY(-2px) } 50% { opacity:.35; transform: translateY(2px) } }
      `}</style>
      <svg
        width={(52 * 44) / 56}
        height={52}
        viewBox="0 0 44 56"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Loading"
        role="img"
      >
        <rect
          x="2"
          y="0"
          width="17"
          height="52"
          rx="4.5"
          fill="#d6d6d6"
          style={{ animation: "ns-pill-a 1.05s ease-in-out infinite" }}
        />
        <rect
          x="25"
          y="6"
          width="17"
          height="50"
          rx="4.5"
          fill="var(--k-accent)"
          style={{ animation: "ns-pill-b 1.05s ease-in-out infinite" }}
        />
      </svg>
      <span
        style={{
          fontFamily: T.mono,
          fontSize: 11,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--k-muted)",
        }}
      >
        Loading client…
      </span>
    </div>
  );
}
