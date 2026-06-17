import React from "react";

export function AutomationFlow({ className, style }: { className?: string; style?: React.CSSProperties }) {
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
        <svg width="300" height="200" viewBox="0 0 300 200" fill="none">
          <path d="M58 100 C 110 72, 112 50, 150 50 C 198 50, 208 88, 244 100" pathLength="100" style="stroke:color-mix(in srgb, var(--ac,#10B981) 26%, transparent);" stroke-width="1.4"/>
          <path d="M58 100 L244 100" pathLength="100" style="stroke:color-mix(in srgb, var(--ac,#10B981) 26%, transparent);" stroke-width="1.4"/>
          <path d="M58 100 C 110 128, 112 150, 150 150 C 198 150, 208 112, 244 100" pathLength="100" style="stroke:color-mix(in srgb, var(--ac,#10B981) 26%, transparent);" stroke-width="1.4"/>
          <!-- pulses -->
          <circle r="3.6" cx="0" cy="0" style="fill:var(--ac,#10B981); offset-path:path('M58 100 C 110 72, 112 50, 150 50 C 198 50, 208 88, 244 100'); animation:ns-travel 2.8s linear infinite; filter:drop-shadow(0 0 5px var(--ac,#10B981));"/>
          <circle r="3.6" cx="0" cy="0" style="fill:var(--ac,#10B981); offset-path:path('M58 100 L244 100'); animation:ns-travel 2.8s linear infinite; animation-delay:-.9s; filter:drop-shadow(0 0 5px var(--ac,#10B981));"/>
          <circle r="3.6" cx="0" cy="0" style="fill:var(--ac,#10B981); offset-path:path('M58 100 C 110 128, 112 150, 150 150 C 198 150, 208 112, 244 100'); animation:ns-travel 2.8s linear infinite; animation-delay:-1.8s; filter:drop-shadow(0 0 5px var(--ac,#10B981));"/>
          <!-- nodes -->
          <g style="font-family:var(--font-mono); font-size:8px;">
            <rect x="22" y="86" width="38" height="28" rx="7" style="fill:var(--elevated); stroke:color-mix(in srgb, var(--ac,#10B981) 45%, transparent);" stroke-width="1"/>
            <text x="41" y="103" text-anchor="middle" style="fill:var(--ac,#10B981);">IN</text>
            <rect x="132" y="38" width="40" height="24" rx="6" style="fill:var(--surface); stroke:var(--border-strong);" stroke-width="1"/>
            <text x="152" y="53" text-anchor="middle" style="fill:var(--muted);">MAIL</text>
            <rect x="132" y="88" width="40" height="24" rx="6" style="fill:var(--surface); stroke:var(--border-strong);" stroke-width="1"/>
            <text x="152" y="103" text-anchor="middle" style="fill:var(--muted);">SYNC</text>
            <rect x="132" y="138" width="40" height="24" rx="6" style="fill:var(--surface); stroke:var(--border-strong);" stroke-width="1"/>
            <text x="152" y="153" text-anchor="middle" style="fill:var(--muted);">TASK</text>
            <rect x="240" y="86" width="40" height="28" rx="7" style="fill:var(--elevated); stroke:color-mix(in srgb, var(--ac,#10B981) 45%, transparent);" stroke-width="1"/>
            <text x="260" y="103" text-anchor="middle" style="fill:var(--ac,#10B981);">DONE</text>
          </g>
        </svg>`,
      }}
    />
  );
}
