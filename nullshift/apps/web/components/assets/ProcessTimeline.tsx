import React from "react";

export function ProcessTimeline({ className, style }: { className?: string; style?: React.CSSProperties }) {
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
          <svg width="300" height="170" viewBox="0 0 300 170" fill="none">
            <line x1="36" y1="70" x2="264" y2="70" style="stroke:var(--border-strong);" stroke-width="1.5"/>
            <line x1="36" y1="70" x2="264" y2="70" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100" style="stroke:var(--ac,#10B981); animation:ns-draw 5s linear infinite;" stroke-width="1.5"/>
            <circle r="3.2" cx="0" cy="0" style="fill:var(--ac,#10B981); offset-path:path('M36 70 L264 70'); animation:ns-travel 5s linear infinite; filter:drop-shadow(0 0 5px var(--ac,#10B981));"/>
            <g style="font-family:var(--font-mono);">
              <circle cx="36" cy="70" r="11" style="fill:var(--elevated); stroke:var(--ac,#10B981); animation:ns-nodepulse 5s ease-in-out infinite;" stroke-width="1.4"/>
              <text x="36" y="73.5" text-anchor="middle" style="fill:var(--ac,#10B981); font-size:8px;">01</text>
              <text x="36" y="98" text-anchor="middle" style="fill:var(--muted); font-size:8px; letter-spacing:0.06em;">DISCOVER</text>
              <circle cx="112" cy="70" r="11" style="fill:var(--elevated); stroke:var(--ac,#10B981); animation:ns-nodepulse 5s ease-in-out infinite; animation-delay:-1.25s;" stroke-width="1.4"/>
              <text x="112" y="73.5" text-anchor="middle" style="fill:var(--ac,#10B981); font-size:8px;">02</text>
              <text x="112" y="98" text-anchor="middle" style="fill:var(--muted); font-size:8px; letter-spacing:0.06em;">DESIGN</text>
              <circle cx="188" cy="70" r="11" style="fill:var(--elevated); stroke:var(--ac,#10B981); animation:ns-nodepulse 5s ease-in-out infinite; animation-delay:-2.5s;" stroke-width="1.4"/>
              <text x="188" y="73.5" text-anchor="middle" style="fill:var(--ac,#10B981); font-size:8px;">03</text>
              <text x="188" y="98" text-anchor="middle" style="fill:var(--muted); font-size:8px; letter-spacing:0.06em;">BUILD</text>
              <circle cx="264" cy="70" r="11" style="fill:var(--elevated); stroke:var(--ac,#10B981); animation:ns-nodepulse 5s ease-in-out infinite; animation-delay:-3.75s;" stroke-width="1.4"/>
              <text x="264" y="73.5" text-anchor="middle" style="fill:var(--ac,#10B981); font-size:8px;">04</text>
              <text x="264" y="98" text-anchor="middle" style="fill:var(--muted); font-size:8px; letter-spacing:0.06em;">LAUNCH</text>
            </g>
            <text x="150" y="34" text-anchor="middle" style="fill:var(--faint); font-family:var(--font-mono); font-size:8px; letter-spacing:0.12em;">MOST PROJECTS · 2–4 WEEKS</text>
          </svg>
        `,
      }}
    />
  );
}
