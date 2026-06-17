import React from "react";

export function Gyroscope({ className, style }: { className?: string; style?: React.CSSProperties }) {
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
        perspective: "760px",
        ...style,
      }}
      dangerouslySetInnerHTML={{
        __html: `
        <div style="position:absolute; width:300px; height:300px; border-radius:50%; background:radial-gradient(circle, color-mix(in srgb, var(--ac,#10B981) 12%, transparent), transparent 60%); pointer-events:none;"></div>
        <div style="position:relative; width:200px; height:200px; transform-style:preserve-3d;">
          <div style="position:absolute; inset:0; transform:rotateZ(0deg); transform-style:preserve-3d;">
            <div style="position:absolute; inset:0; border-radius:50%; border:1.5px solid var(--ac,#10B981); animation:ns-flip 9s linear infinite;"></div>
          </div>
          <div style="position:absolute; inset:24px; transform:rotateZ(60deg); transform-style:preserve-3d;">
            <div style="position:absolute; inset:0; border-radius:50%; border:1.5px solid var(--border-strong); animation:ns-flip 6.5s linear infinite reverse;"></div>
          </div>
          <div style="position:absolute; inset:48px; transform:rotateZ(120deg); transform-style:preserve-3d;">
            <div style="position:absolute; inset:0; border-radius:50%; border:1.5px solid color-mix(in srgb, var(--ac,#10B981) 70%, var(--fg));  animation:ns-flip 11s linear infinite;"></div>
          </div>
          <div style="position:absolute; top:50%; left:50%; width:30px; height:30px; margin:-15px 0 0 -15px; border-radius:50%; background:radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--ac,#10B981) 60%, white), var(--ac,#10B981)); box-shadow:0 0 16px color-mix(in srgb, var(--ac,#10B981) 70%, transparent); animation:ns-corepulse 3.2s ease-in-out infinite;"></div>
        </div>`,
      }}
    />
  );
}
