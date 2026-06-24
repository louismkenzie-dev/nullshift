import { T } from "@nullshift/ui/tokens";

// Claude's "book cloth" terracotta — the brand colour of the Claude logomark.
const CLAUDE_ORANGE = "#D97757";

/**
 * Claude logomark — the radial "spark" burst, rendered as rounded spokes with
 * gently varied lengths for the organic look. Pure SVG, no asset dependency.
 */
function ClaudeMark({ size = 16 }: { size?: number }) {
  const cx = 50;
  const cy = 50;
  const inner = 7;
  // Per-spoke tip radius — slight variation gives the burst its organic feel.
  const tips = [46, 38, 44, 36, 47, 39, 45, 37, 46, 40, 43, 38];
  const width = 7.5;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden
      style={{ display: "block", flexShrink: 0 }}
    >
      {tips.map((outer, i) => {
        const a = (i / tips.length) * Math.PI * 2 - Math.PI / 2;
        return (
          <line
            key={i}
            x1={cx + Math.cos(a) * inner}
            y1={cy + Math.sin(a) * inner}
            x2={cx + Math.cos(a) * outer}
            y2={cy + Math.sin(a) * outer}
            stroke={CLAUDE_ORANGE}
            strokeWidth={width}
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}

/**
 * Small co-branded trust chip — Claude logomark + "Official Claude Partner".
 * Sits in the hero trust row; styled to the KYMA editorial system (hairline
 * border, near-sharp corners, mono caps).
 */
export function ClaudePartnerBadge() {
  return (
    <div
      className="inline-flex items-center gap-2.5 shrink-0"
      style={{
        padding: "6px 12px 6px 9px",
        border: "1px solid rgba(244,244,232,0.16)",
        background: "rgba(244,244,232,0.04)",
        borderRadius: 2,
      }}
    >
      <ClaudeMark size={16} />
      <span
        style={{
          fontFamily: T.mono,
          fontSize: "0.66rem",
          fontWeight: 500,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--k-fg)",
          whiteSpace: "nowrap",
        }}
      >
        Official Claude Partner
      </span>
    </div>
  );
}
