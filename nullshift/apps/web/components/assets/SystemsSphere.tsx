import React from "react";

export function SystemsSphere({ className, style }: { className?: string; style?: React.CSSProperties }) {
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
        <div style="position:absolute; width:340px; height:340px; border-radius:50%; background:radial-gradient(circle, color-mix(in srgb, var(--ac,#10B981) 12%, transparent), transparent 60%); pointer-events:none;"></div>
        <svg width="240" height="240" viewBox="0 0 240 240" fill="none">
          <circle cx="120" cy="120" r="100" style="stroke:var(--border-strong);" stroke-width="1"/>
          <g style="transform-box:view-box; transform-origin:120px 120px; animation:ns-spin 30s linear infinite;">
            <ellipse cx="120" cy="120" rx="100" ry="34" style="stroke:color-mix(in srgb, var(--ac,#10B981) 38%, transparent);" stroke-width="1"/>
            <ellipse cx="120" cy="120" rx="100" ry="70" style="stroke:color-mix(in srgb, var(--ac,#10B981) 22%, transparent);" stroke-width="1"/>
            <ellipse cx="120" cy="120" rx="34" ry="100" style="stroke:color-mix(in srgb, var(--ac,#10B981) 38%, transparent);" stroke-width="1"/>
            <ellipse cx="120" cy="120" rx="70" ry="100" style="stroke:color-mix(in srgb, var(--ac,#10B981) 22%, transparent);" stroke-width="1"/>
            <line x1="120" y1="20" x2="186" y2="150" style="stroke:color-mix(in srgb, var(--ac,#10B981) 30%, transparent);" stroke-width="1"/>
            <line x1="54" y1="90" x2="186" y2="150" style="stroke:color-mix(in srgb, var(--ac,#10B981) 22%, transparent);" stroke-width="1"/>
            <line x1="54" y1="90" x2="120" y2="220" style="stroke:color-mix(in srgb, var(--ac,#10B981) 22%, transparent);" stroke-width="1"/>
            <circle cx="120" cy="20" r="4" style="fill:var(--ac,#10B981); animation:ns-nodepulse 2.6s ease-in-out infinite;"/>
            <circle cx="186" cy="150" r="4" style="fill:var(--ac,#10B981); animation:ns-nodepulse 2.6s ease-in-out infinite; animation-delay:-.6s;"/>
            <circle cx="54" cy="90" r="3.5" style="fill:var(--ac,#10B981); animation:ns-nodepulse 2.6s ease-in-out infinite; animation-delay:-1.2s;"/>
            <circle cx="120" cy="220" r="3.5" style="fill:var(--ac,#10B981); animation:ns-nodepulse 2.6s ease-in-out infinite; animation-delay:-1.8s;"/>
            <circle cx="40" cy="150" r="3" style="fill:var(--ac,#10B981); animation:ns-nodepulse 2.6s ease-in-out infinite; animation-delay:-2.2s;"/>
            <circle cx="200" cy="92" r="3" style="fill:var(--ac,#10B981); animation:ns-nodepulse 2.6s ease-in-out infinite; animation-delay:-1.5s;"/>
          </g>
          <circle cx="120" cy="120" r="7" style="fill:var(--ac,#10B981); transform-box:view-box; transform-origin:120px 120px; animation:ns-corepulse 3s ease-in-out infinite; filter:drop-shadow(0 0 8px color-mix(in srgb, var(--ac,#10B981) 80%, transparent));"/>
        </svg>`,
      }}
    />
  );
}
