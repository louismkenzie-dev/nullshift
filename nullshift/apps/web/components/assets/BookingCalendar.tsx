import React from "react";

export function BookingCalendar({ className, style }: { className?: string; style?: React.CSSProperties }) {
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
          <div style="width:212px; background:var(--elevated); border:1px solid var(--border); border-radius:12px; padding:14px; box-shadow:0 18px 40px rgba(0,0,0,.4);">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
              <span style="font-family:var(--font-mono); font-size:10px; letter-spacing:0.1em; color:var(--fg);">JUN 2026</span>
              <span style="display:inline-flex; gap:5px;"><span style="width:6px;height:6px;border-radius:999px;background:var(--border-strong);"></span><span style="width:6px;height:6px;border-radius:999px;background:var(--border-strong);"></span></span>
            </div>
            <div style="display:grid; grid-template-columns:repeat(7,1fr); gap:5px; margin-bottom:6px;">
              <span style="text-align:center; font-family:var(--font-mono); font-size:8px; color:var(--faint);">M</span>
              <span style="text-align:center; font-family:var(--font-mono); font-size:8px; color:var(--faint);">T</span>
              <span style="text-align:center; font-family:var(--font-mono); font-size:8px; color:var(--faint);">W</span>
              <span style="text-align:center; font-family:var(--font-mono); font-size:8px; color:var(--faint);">T</span>
              <span style="text-align:center; font-family:var(--font-mono); font-size:8px; color:var(--faint);">F</span>
              <span style="text-align:center; font-family:var(--font-mono); font-size:8px; color:var(--faint);">S</span>
              <span style="text-align:center; font-family:var(--font-mono); font-size:8px; color:var(--faint);">S</span>
            </div>
            <div style="display:grid; grid-template-columns:repeat(7,1fr); gap:5px;">
              <div style="aspect-ratio:1; border-radius:4px; background:#181a22;"></div>
              <div style="aspect-ratio:1; border-radius:4px; background:#181a22;"></div>
              <div style="aspect-ratio:1; border-radius:4px; background:#181a22;"></div>
              <div style="aspect-ratio:1; border-radius:4px; background:color-mix(in srgb, var(--ac,#10B981) 14%, transparent); border:1px solid color-mix(in srgb, var(--ac,#10B981) 45%, transparent); animation:ns-nodepulse 3s ease-in-out infinite;"></div>
              <div style="aspect-ratio:1; border-radius:4px; background:#181a22;"></div>
              <div style="aspect-ratio:1; border-radius:4px; background:#181a22;"></div>
              <div style="aspect-ratio:1; border-radius:4px; background:#181a22;"></div>
              <div style="aspect-ratio:1; border-radius:4px; background:#181a22;"></div>
              <div style="aspect-ratio:1; border-radius:4px; background:var(--ac,#10B981); box-shadow:0 0 10px color-mix(in srgb, var(--ac,#10B981) 60%, transparent); animation:ns-corepulse 2.8s ease-in-out infinite;"></div>
              <div style="aspect-ratio:1; border-radius:4px; background:#181a22;"></div>
              <div style="aspect-ratio:1; border-radius:4px; background:#181a22;"></div>
              <div style="aspect-ratio:1; border-radius:4px; background:color-mix(in srgb, var(--ac,#10B981) 14%, transparent); border:1px solid color-mix(in srgb, var(--ac,#10B981) 45%, transparent); animation:ns-nodepulse 3s ease-in-out infinite; animation-delay:-1.4s;"></div>
              <div style="aspect-ratio:1; border-radius:4px; background:#181a22;"></div>
              <div style="aspect-ratio:1; border-radius:4px; background:#181a22;"></div>
              <div style="aspect-ratio:1; border-radius:4px; background:#181a22;"></div>
              <div style="aspect-ratio:1; border-radius:4px; background:#181a22;"></div>
              <div style="aspect-ratio:1; border-radius:4px; background:#181a22;"></div>
              <div style="aspect-ratio:1; border-radius:4px; background:#181a22;"></div>
              <div style="aspect-ratio:1; border-radius:4px; background:color-mix(in srgb, var(--ac,#10B981) 14%, transparent); border:1px solid color-mix(in srgb, var(--ac,#10B981) 45%, transparent); animation:ns-nodepulse 3s ease-in-out infinite; animation-delay:-2.1s;"></div>
              <div style="aspect-ratio:1; border-radius:4px; background:#181a22;"></div>
              <div style="aspect-ratio:1; border-radius:4px; background:#181a22;"></div>
            </div>
            <div style="margin-top:12px; display:flex; align-items:center; gap:7px; padding:7px 9px; border:1px solid color-mix(in srgb, var(--ac,#10B981) 35%, transparent); border-radius:7px; background:color-mix(in srgb, var(--ac,#10B981) 8%, transparent);">
              <span style="width:14px; height:14px; border-radius:999px; background:var(--ac,#10B981); color:var(--primary-fg); font-size:9px; display:flex; align-items:center; justify-content:center; font-weight:700;">✓</span>
              <span style="font-family:var(--font-mono); font-size:9px; color:var(--ac,#10B981); letter-spacing:0.04em;">CONFIRMED · 10:30</span>
            </div>
          </div>
        `,
      }}
    />
  );
}
