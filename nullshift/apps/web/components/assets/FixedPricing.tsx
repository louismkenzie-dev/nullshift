import React from "react";

export function FixedPricing({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
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
        __html: `<div style="position:absolute; width:280px; height:240px; border-radius:50%; background:radial-gradient(circle, color-mix(in srgb, var(--ac,#10B981) 11%, transparent), transparent 62%); pointer-events:none;"></div>
          <div style="position:relative; width:208px; background:var(--elevated); border:1px solid color-mix(in srgb, var(--ac,#10B981) 38%, transparent); border-radius:14px; padding:20px 18px; box-shadow:0 18px 44px rgba(0,0,0,.45); animation:ns-float 7s ease-in-out infinite;">
            <div style="position:absolute; top:0; left:18px; right:18px; height:2px; background:var(--ac,#10B981); box-shadow:0 0 10px color-mix(in srgb, var(--ac,#10B981) 70%, transparent);"></div>
            <span style="display:inline-block; font-family:var(--font-mono); font-size:9px; letter-spacing:0.1em; color:var(--ac,#10B981); background:color-mix(in srgb, var(--ac,#10B981) 12%, transparent); border:1px solid color-mix(in srgb, var(--ac,#10B981) 32%, transparent); padding:3px 8px; border-radius:5px;">OWN IT</span>
            <div style="display:flex; align-items:baseline; gap:4px; margin:14px 0 16px;">
              <span style="font-family:var(--font-display); font-weight:600; font-size:34px; letter-spacing:-0.03em; color:var(--fg);">£149</span>
              <span style="font-family:var(--font-mono); font-size:10px; color:var(--faint);">/ month</span>
            </div>
            <div style="display:flex; flex-direction:column; gap:9px;">
              <div style="display:flex; align-items:center; gap:9px;"><span style="width:16px; height:16px; border-radius:999px; background:color-mix(in srgb, var(--ac,#10B981) 16%, transparent); color:var(--ac,#10B981); font-size:9px; display:flex; align-items:center; justify-content:center;">✓</span><span style="font-size:12px; color:var(--fg);">Booking, records &amp; payments</span></div>
              <div style="display:flex; align-items:center; gap:9px;"><span style="width:16px; height:16px; border-radius:999px; background:color-mix(in srgb, var(--ac,#10B981) 16%, transparent); color:var(--ac,#10B981); font-size:9px; display:flex; align-items:center; justify-content:center;">✓</span><span style="font-size:12px; color:var(--fg);">Unlimited practitioners</span></div>
              <div style="display:flex; align-items:center; gap:9px;"><span style="width:16px; height:16px; border-radius:999px; background:color-mix(in srgb, var(--ac,#10B981) 16%, transparent); color:var(--ac,#10B981); font-size:9px; display:flex; align-items:center; justify-content:center;">✓</span><span style="font-size:12px; color:var(--fg);">Hosting, backups &amp; updates</span></div>
            </div>
            <div style="margin-top:16px; padding-top:13px; border-top:1px solid var(--border); font-family:var(--font-mono); font-size:9px; letter-spacing:0.08em; color:var(--faint);">REPLACES 4 SUBSCRIPTIONS</div>
          </div>`,
      }}
    />
  );
}
