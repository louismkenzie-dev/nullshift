import React from "react";

export function ResponsiveDevices({ className, style }: { className?: string; style?: React.CSSProperties }) {
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
        __html: `<div style="position:relative; flex:1; min-height:0; height:100%; display:flex; align-items:flex-end; justify-content:center; gap:14px; padding:34px 16px;">
          <!-- desktop -->
          <div style="width:148px; height:104px; border-radius:9px; background:#16171f; border:1px solid var(--border-strong); overflow:hidden; animation:ns-float 6s ease-in-out infinite;">
            <div style="height:16px; display:flex; align-items:center; gap:3px; padding:0 7px; border-bottom:1px solid var(--border);"><span style="width:4px;height:4px;border-radius:999px;background:#2f323d;"></span><span style="width:4px;height:4px;border-radius:999px;background:#2f323d;"></span></div>
            <div style="padding:9px; display:flex; flex-direction:column; gap:5px;"><div style="height:7px; width:55%; border-radius:2px; background:var(--fg); opacity:.9;"></div><div style="height:4px; width:88%; border-radius:2px; background:#2a2d38;"></div><div style="height:13px; width:46px; border-radius:4px; background:var(--ac,#10B981); margin-top:2px;"></div></div>
          </div>
          <!-- tablet -->
          <div style="width:72px; height:96px; border-radius:9px; background:#16171f; border:1px solid var(--border-strong); overflow:hidden; animation:ns-float 6s ease-in-out infinite; animation-delay:-1.8s;">
            <div style="height:13px; border-bottom:1px solid var(--border);"></div>
            <div style="padding:8px; display:flex; flex-direction:column; gap:5px;"><div style="height:6px; width:70%; border-radius:2px; background:var(--fg); opacity:.9;"></div><div style="height:4px; width:95%; border-radius:2px; background:#2a2d38;"></div><div style="height:11px; width:40px; border-radius:4px; background:var(--ac,#10B981); margin-top:2px;"></div></div>
          </div>
          <!-- phone -->
          <div style="width:46px; height:86px; border-radius:11px; background:#16171f; border:1px solid var(--border-strong); overflow:hidden; animation:ns-float 6s ease-in-out infinite; animation-delay:-3.4s; padding:6px; box-sizing:border-box; display:flex; flex-direction:column; gap:4px;">
            <div style="height:5px; width:60%; border-radius:2px; background:var(--fg); opacity:.9; margin:0 auto 0 0;"></div>
            <div style="height:3px; width:100%; border-radius:2px; background:#2a2d38;"></div>
            <div style="height:3px; width:80%; border-radius:2px; background:#2a2d38;"></div>
            <div style="height:10px; width:100%; border-radius:4px; background:var(--ac,#10B981); margin-top:auto;"></div>
          </div>
        </div>`,
      }}
    />
  );
}
