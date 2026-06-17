import React from "react";

export function SystemHorizon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      aria-hidden
      className={className}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: 240,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        ...style,
      }}
      dangerouslySetInnerHTML={{
        __html: `<div style="position:absolute; inset:0; overflow:hidden;">
        <!-- grid floor -->
        <div style="position:absolute; left:-50%; right:-50%; bottom:0; height:200px; transform-origin:bottom center; transform:rotateX(76deg); background-image:linear-gradient(color-mix(in srgb, var(--ac,#10B981) 32%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--ac,#10B981) 32%, transparent) 1px, transparent 1px); background-size:36px 36px; animation:ns-grid 2.6s linear infinite; mask-image:linear-gradient(to top, #000 0%, transparent 92%); -webkit-mask-image:linear-gradient(to top, #000 0%, transparent 92%);"></div>
        <!-- horizon glow -->
        <div style="position:absolute; left:0; right:0; top:48%; height:80px; background:radial-gradient(ellipse 60% 100% at 50% 0%, color-mix(in srgb, var(--ac,#10B981) 45%, transparent), transparent 70%); filter:blur(6px); animation:ns-breath 5s ease-in-out infinite;"></div>
        <!-- floating nodes -->
        <div style="position:absolute; left:24%; top:30%; width:5px; height:5px; border-radius:999px; background:var(--ac,#10B981); box-shadow:0 0 8px var(--ac,#10B981); animation:ns-float 6s ease-in-out infinite;"></div>
        <div style="position:absolute; left:70%; top:24%; width:4px; height:4px; border-radius:999px; background:var(--ac,#10B981); box-shadow:0 0 8px var(--ac,#10B981); animation:ns-float 7s ease-in-out infinite; animation-delay:-2s;"></div>
        <div style="position:absolute; left:52%; top:38%; width:3px; height:3px; border-radius:999px; background:var(--ac,#10B981); box-shadow:0 0 8px var(--ac,#10B981); animation:ns-float 5.5s ease-in-out infinite; animation-delay:-3.4s;"></div>
      </div>`,
      }}
    />
  );
}
