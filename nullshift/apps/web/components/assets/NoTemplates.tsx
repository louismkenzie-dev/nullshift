import React from "react";

export function NoTemplates({ className, style }: { className?: string; style?: React.CSSProperties }) {
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
        __html: `
          <svg width="280" height="200" viewBox="0 0 280 200" fill="none">
            <defs>
              <pattern id="ns-dots" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="1.2" cy="1.2" r="1.2" style="fill:var(--border-strong);"/>
              </pattern>
            </defs>
            <rect x="0" y="0" width="280" height="200" fill="url(#ns-dots)" opacity="0.5"/>
            <!-- ghost templates -->
            <g style="stroke:var(--border-strong);" stroke-width="1" stroke-dasharray="4 4" fill="none" opacity="0.45">
              <rect x="78" y="58" width="120" height="84" rx="6"/>
              <rect x="88" y="48" width="120" height="84" rx="6"/>
            </g>
            <!-- bespoke drawn outline -->
            <path d="M62 44 H172 a8 8 0 0 1 8 8 V96 H214 a8 8 0 0 1 8 8 V150 a8 8 0 0 1 -8 8 H104 a8 8 0 0 1 -8 -8 V112 H62 a8 8 0 0 1 -8 -8 V52 a8 8 0 0 1 8 -8 Z"
              pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"
              style="stroke:var(--ac,#10B981); animation:ns-draw 4.5s ease-in-out infinite; filter:drop-shadow(0 0 4px color-mix(in srgb, var(--ac,#10B981) 50%, transparent));" stroke-width="2" fill="none" stroke-linejoin="round"/>
            <circle cx="138" cy="100" r="4" style="fill:var(--ac,#10B981); animation:ns-nodepulse 2.4s ease-in-out infinite;"/>
            <!-- registration crosshairs -->
            <g style="stroke:var(--ac,#10B981);" stroke-width="1" opacity="0.7">
              <path d="M24 24 h10 M24 24 v10"/>
              <path d="M256 176 h-10 M256 176 v-10"/>
            </g>
            <text x="24" y="186" style="fill:var(--faint); font-family:var(--font-mono); font-size:8px; letter-spacing:0.08em;">BESPOKE / 1 OF 1</text>
          </svg>
        `,
      }}
    />
  );
}
