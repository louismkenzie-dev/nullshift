import React from "react";

export function EmailCampaign({ className, style }: { className?: string; style?: React.CSSProperties }) {
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
            <path d="M70 100 C 140 60, 180 50, 240 44" style="stroke:color-mix(in srgb, var(--ac,#10B981) 22%, transparent);" stroke-width="1.2"/>
            <path d="M70 100 C 140 80, 180 76, 240 74" style="stroke:color-mix(in srgb, var(--ac,#10B981) 22%, transparent);" stroke-width="1.2"/>
            <path d="M70 100 C 140 110, 180 122, 240 126" style="stroke:color-mix(in srgb, var(--ac,#10B981) 22%, transparent);" stroke-width="1.2"/>
            <path d="M70 100 C 140 132, 180 150, 240 156" style="stroke:color-mix(in srgb, var(--ac,#10B981) 22%, transparent);" stroke-width="1.2"/>
            <circle r="3.4" cx="0" cy="0" style="fill:var(--ac,#10B981); offset-path:path('M70 100 C 140 60, 180 50, 240 44'); animation:ns-travel 2.6s linear infinite; filter:drop-shadow(0 0 5px var(--ac,#10B981));"/>
            <circle r="3.4" cx="0" cy="0" style="fill:var(--ac,#10B981); offset-path:path('M70 100 C 140 80, 180 76, 240 74'); animation:ns-travel 2.6s linear infinite; animation-delay:-.7s; filter:drop-shadow(0 0 5px var(--ac,#10B981));"/>
            <circle r="3.4" cx="0" cy="0" style="fill:var(--ac,#10B981); offset-path:path('M70 100 C 140 110, 180 122, 240 126'); animation:ns-travel 2.6s linear infinite; animation-delay:-1.3s; filter:drop-shadow(0 0 5px var(--ac,#10B981));"/>
            <circle r="3.4" cx="0" cy="0" style="fill:var(--ac,#10B981); offset-path:path('M70 100 C 140 132, 180 150, 240 156'); animation:ns-travel 2.6s linear infinite; animation-delay:-1.9s; filter:drop-shadow(0 0 5px var(--ac,#10B981));"/>
            <!-- source envelope -->
            <rect x="36" y="84" width="44" height="32" rx="5" style="fill:var(--elevated); stroke:var(--ac,#10B981);" stroke-width="1.4"/>
            <path d="M38 88 L58 102 L78 88" fill="none" style="stroke:var(--ac,#10B981);" stroke-width="1.4"/>
            <!-- recipients -->
            <circle cx="244" cy="44" r="6" style="fill:var(--surface); stroke:var(--ac,#10B981); animation:ns-nodepulse 2.6s ease-in-out infinite;" stroke-width="1.3"/>
            <circle cx="244" cy="74" r="6" style="fill:var(--surface); stroke:var(--ac,#10B981); animation:ns-nodepulse 2.6s ease-in-out infinite; animation-delay:-.7s;" stroke-width="1.3"/>
            <circle cx="244" cy="126" r="6" style="fill:var(--surface); stroke:var(--ac,#10B981); animation:ns-nodepulse 2.6s ease-in-out infinite; animation-delay:-1.3s;" stroke-width="1.3"/>
            <circle cx="244" cy="156" r="6" style="fill:var(--surface); stroke:var(--ac,#10B981); animation:ns-nodepulse 2.6s ease-in-out infinite; animation-delay:-1.9s;" stroke-width="1.3"/>
          </svg>
        `,
      }}
    />
  );
}
