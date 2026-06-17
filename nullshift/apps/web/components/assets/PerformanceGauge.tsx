import React from "react";

export function PerformanceGauge({ className, style }: { className?: string; style?: React.CSSProperties }) {
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
          <div style="position:absolute; width:300px; height:300px; border-radius:50%; background:radial-gradient(circle, color-mix(in srgb, var(--ac,#10B981) 11%, transparent), transparent 60%); pointer-events:none;"></div>
          <svg width="220" height="200" viewBox="0 0 220 200" fill="none">
            <path d="M58.6 161.4 A 72 72 0 1 1 161.4 161.4" style="stroke:var(--border-strong);" stroke-width="9" stroke-linecap="round"/>
            <path d="M58.6 161.4 A 72 72 0 1 1 161.4 161.4" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100" style="stroke:var(--ac,#10B981); animation:ns-draw 4s ease-in-out infinite; filter:drop-shadow(0 0 6px color-mix(in srgb, var(--ac,#10B981) 55%, transparent));" stroke-width="9" stroke-linecap="round"/>
            <text x="110" y="106" text-anchor="middle" style="fill:var(--ac,#10B981); font-family:var(--font-display); font-weight:600; font-size:34px; letter-spacing:-0.03em;">0.4s</text>
            <text x="110" y="128" text-anchor="middle" style="fill:var(--faint); font-family:var(--font-mono); font-size:9px; letter-spacing:0.14em;">LOAD TIME</text>
            <text x="48" y="190" text-anchor="middle" style="fill:var(--faint); font-family:var(--font-mono); font-size:9px;">0</text>
            <text x="172" y="190" text-anchor="middle" style="fill:var(--faint); font-family:var(--font-mono); font-size:9px;">100</text>
          </svg>
        `,
      }}
    />
  );
}
