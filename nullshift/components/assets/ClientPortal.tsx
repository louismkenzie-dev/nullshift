import React from "react";

export function ClientPortal({ className, style }: { className?: string; style?: React.CSSProperties }) {
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
        perspective: "1100px",
        ...style,
      }}
      dangerouslySetInnerHTML={{
        __html: `
          <div style="position:absolute; width:320px; height:240px; border-radius:50%; background:radial-gradient(circle, color-mix(in srgb, var(--ac,#10B981) 13%, transparent), transparent 62%); pointer-events:none;"></div>
          <div style="width:300px; height:200px; border-radius:12px; background:#16171f; border:1px solid var(--border-strong); overflow:hidden; transform-style:preserve-3d; animation:ns-devwob 12s ease-in-out infinite; box-shadow:0 24px 60px rgba(0,0,0,.5);">
            <div style="height:26px; display:flex; align-items:center; gap:5px; padding:0 12px; border-bottom:1px solid var(--border);">
              <span style="width:7px; height:7px; border-radius:999px; background:#2f323d;"></span>
              <span style="width:7px; height:7px; border-radius:999px; background:#2f323d;"></span>
              <span style="width:7px; height:7px; border-radius:999px; background:#2f323d;"></span>
              <span style="margin-left:auto; font-family:var(--font-mono); font-size:8px; color:var(--faint);">app.nullshift.studio</span>
            </div>
            <div style="display:flex; height:174px;">
              <div style="width:46px; border-right:1px solid var(--border); display:flex; flex-direction:column; align-items:center; gap:14px; padding-top:14px; font-family:var(--font-mono); font-size:13px; color:var(--faint);">
                <span style="color:var(--ac,#10B981);">◫</span><span>◈</span><span>◇</span><span>○</span>
              </div>
              <div style="flex:1; padding:13px; display:flex; flex-direction:column; gap:10px;">
                <div style="display:flex; gap:9px;">
                  <div style="flex:1; border:1px solid var(--border); border-radius:8px; padding:8px;">
                    <div style="font-family:var(--font-mono); font-size:7px; color:var(--faint); letter-spacing:0.06em;">INCOME</div>
                    <div style="font-family:var(--font-display); font-weight:600; font-size:15px; color:var(--ac,#10B981); letter-spacing:-0.02em;">£8,400</div>
                  </div>
                  <div style="flex:1; border:1px solid var(--border); border-radius:8px; padding:8px;">
                    <div style="font-family:var(--font-mono); font-size:7px; color:var(--faint); letter-spacing:0.06em;">ENQUIRIES</div>
                    <div style="font-family:var(--font-display); font-weight:600; font-size:15px; letter-spacing:-0.02em;">3</div>
                  </div>
                </div>
                <div style="display:flex; align-items:flex-end; gap:6px; height:38px; padding:0 2px;">
                  <div style="flex:1; height:40%; border-radius:3px 3px 0 0; background:var(--border-strong);"></div>
                  <div style="flex:1; height:62%; border-radius:3px 3px 0 0; background:var(--border-strong);"></div>
                  <div style="flex:1; height:48%; border-radius:3px 3px 0 0; background:var(--border-strong);"></div>
                  <div style="flex:1; height:84%; border-radius:3px 3px 0 0; background:var(--ac,#10B981);"></div>
                  <div style="flex:1; height:70%; border-radius:3px 3px 0 0; background:color-mix(in srgb, var(--ac,#10B981) 55%, var(--surface));"></div>
                </div>
                <div style="display:flex; flex-direction:column; gap:6px;">
                  <div style="height:6px; width:100%; border-radius:3px; background:#22242e;"></div>
                  <div style="height:6px; width:78%; border-radius:3px; background:#22242e;"></div>
                </div>
              </div>
            </div>
          </div>
        `,
      }}
    />
  );
}
