import React from "react";

export function AnalyticsChart({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      aria-hidden
      className={className}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: 300,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        ...style,
      }}
      dangerouslySetInnerHTML={{
        __html: `<svg width="300" height="180" viewBox="0 0 300 180" fill="none">
            <defs>
              <linearGradient id="ns-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="var(--ac,#10B981)" stop-opacity="0.28"/>
                <stop offset="100%" stop-color="var(--ac,#10B981)" stop-opacity="0"/>
              </linearGradient>
            </defs>
            <line x1="30" y1="40" x2="278" y2="40" style="stroke:var(--border);" stroke-width="1" stroke-dasharray="2 4"/>
            <line x1="30" y1="90" x2="278" y2="90" style="stroke:var(--border);" stroke-width="1" stroke-dasharray="2 4"/>
            <line x1="30" y1="140" x2="278" y2="140" style="stroke:var(--border-strong);" stroke-width="1"/>
            <path d="M30 140 L80 122 L130 128 L180 86 L230 66 L272 36 L272 140 L30 140 Z" fill="url(#ns-area)"/>
            <path d="M30 140 L80 122 L130 128 L180 86 L230 66 L272 36" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100" style="stroke:var(--ac,#10B981); animation:ns-draw 4.5s ease-in-out infinite; filter:drop-shadow(0 0 4px color-mix(in srgb, var(--ac,#10B981) 50%, transparent));" stroke-width="2" fill="none" stroke-linejoin="round"/>
            <circle cx="180" cy="86" r="3.5" style="fill:var(--ac,#10B981); animation:ns-nodepulse 2.4s ease-in-out infinite;"/>
            <circle cx="230" cy="66" r="3.5" style="fill:var(--ac,#10B981); animation:ns-nodepulse 2.4s ease-in-out infinite; animation-delay:-.8s;"/>
            <circle cx="272" cy="36" r="4" style="fill:var(--ac,#10B981); animation:ns-corepulse 2.4s ease-in-out infinite; filter:drop-shadow(0 0 6px var(--ac,#10B981));"/>
            <g transform="translate(36 26)">
              <rect x="0" y="-12" width="58" height="20" rx="5" style="fill:color-mix(in srgb, var(--ac,#10B981) 14%, transparent); stroke:color-mix(in srgb, var(--ac,#10B981) 40%, transparent);" stroke-width="1"/>
              <text x="29" y="2" text-anchor="middle" style="fill:var(--ac,#10B981); font-family:var(--font-mono); font-size:10px; font-weight:600;">↑ +38%</text>
            </g>
          </svg>`,
      }}
    />
  );
}
