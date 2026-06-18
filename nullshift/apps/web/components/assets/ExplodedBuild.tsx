import React from "react";

export function ExplodedBuild({
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
        minHeight: 440,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        perspective: "1500px",
        ...style,
      }}
      dangerouslySetInnerHTML={{
        __html: `
        <div style="position:absolute; width:560px; height:560px; border-radius:50%; background:radial-gradient(circle, color-mix(in srgb, var(--ac,#10B981) 14%, transparent), transparent 62%); filter:blur(8px); pointer-events:none;"></div>
        <div style="perspective:1500px; position:relative;">
          <div style="position:relative; width:280px; height:175px; transform-style:preserve-3d; animation:ns-wobble 16s ease-in-out infinite;">

            <!-- back → front -->
            <div style="position:absolute; top:50%; left:50%; width:280px; height:175px; margin:-87px 0 0 -140px; transform:translateZ(-220px); transform-style:preserve-3d;">
              <div style="width:100%; height:100%; border-radius:10px; background:var(--surface); border:1px solid var(--border-soft); background-image:linear-gradient(color-mix(in srgb, var(--ac,#10B981) 12%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--ac,#10B981) 12%, transparent) 1px, transparent 1px); background-size:22px 22px; animation:ns-zbob 7s ease-in-out infinite; box-sizing:border-box; padding:10px;">
                <span style="font-family:var(--font-mono); font-size:9px; letter-spacing:0.1em; color:var(--faint);">01 / FOUNDATION</span>
              </div>
            </div>

            <div style="position:absolute; top:50%; left:50%; width:280px; height:175px; margin:-87px 0 0 -140px; transform:translateZ(-115px); transform-style:preserve-3d;">
              <div style="width:100%; height:100%; border-radius:10px; background:var(--surface); border:1px solid var(--border); animation:ns-zbob 7s ease-in-out infinite; animation-delay:-1.1s; box-sizing:border-box; padding:14px; display:flex; flex-direction:column; gap:8px;">
                <span style="font-family:var(--font-mono); font-size:9px; letter-spacing:0.1em; color:var(--faint);">02 / STRUCTURE</span>
                <div style="height:8px; width:62%; border-radius:3px; background:var(--border-strong);"></div>
                <div style="display:flex; gap:8px; flex:1;">
                  <div style="flex:1; border-radius:5px; background:#22242e;"></div>
                  <div style="flex:2; border-radius:5px; background:#1b1d25;"></div>
                </div>
                <div style="height:8px; width:40%; border-radius:3px; background:#22242e;"></div>
              </div>
            </div>

            <div style="position:absolute; top:50%; left:50%; width:280px; height:175px; margin:-87px 0 0 -140px; transform:translateZ(-10px); transform-style:preserve-3d;">
              <div style="width:100%; height:100%; border-radius:10px; background:var(--surface); border:1px solid var(--border); animation:ns-zbob 7s ease-in-out infinite; animation-delay:-2.2s; box-sizing:border-box; padding:14px; display:flex; flex-direction:column; gap:12px;">
                <span style="font-family:var(--font-mono); font-size:9px; letter-spacing:0.1em; color:var(--faint);">03 / SYSTEMS</span>
                <div style="display:flex; gap:9px; flex:1;">
                  <div style="flex:1; border-radius:6px; background:color-mix(in srgb, var(--ac,#10B981) 8%, transparent); border:1px solid color-mix(in srgb, var(--ac,#10B981) 42%, transparent); box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--ac,#10B981) 16%, transparent); display:flex; align-items:flex-end; padding:7px; font-family:var(--font-mono); font-size:9px; color:var(--ac,#10B981);">BOOK</div>
                  <div style="flex:1; border-radius:6px; background:color-mix(in srgb, var(--ac,#10B981) 8%, transparent); border:1px solid color-mix(in srgb, var(--ac,#10B981) 42%, transparent); box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--ac,#10B981) 16%, transparent); display:flex; align-items:flex-end; padding:7px; font-family:var(--font-mono); font-size:9px; color:var(--ac,#10B981);">RECORDS</div>
                  <div style="flex:1; border-radius:6px; background:color-mix(in srgb, var(--ac,#10B981) 8%, transparent); border:1px solid color-mix(in srgb, var(--ac,#10B981) 42%, transparent); box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--ac,#10B981) 16%, transparent); display:flex; align-items:flex-end; padding:7px; font-family:var(--font-mono); font-size:9px; color:var(--ac,#10B981);">PAY</div>
                </div>
              </div>
            </div>

            <div style="position:absolute; top:50%; left:50%; width:280px; height:175px; margin:-87px 0 0 -140px; transform:translateZ(95px); transform-style:preserve-3d;">
              <div style="width:100%; height:100%; border-radius:10px; background:var(--surface); border:1px solid var(--border); animation:ns-zbob 7s ease-in-out infinite; animation-delay:-3.3s; box-sizing:border-box; padding:14px; display:flex; flex-direction:column; gap:9px;">
                <span style="font-family:var(--font-mono); font-size:9px; letter-spacing:0.1em; color:var(--faint);">04 / COMPONENTS</span>
                <div style="height:9px; width:70%; border-radius:3px; background:var(--border-strong);"></div>
                <div style="height:7px; width:88%; border-radius:3px; background:#22242e;"></div>
                <div style="height:7px; width:54%; border-radius:3px; background:#22242e;"></div>
                <div style="margin-top:auto; height:22px; width:96px; border-radius:7px; background:var(--ac,#10B981); box-shadow:inset 0 1px 0 rgba(255,255,255,.18);"></div>
              </div>
            </div>

            <div style="position:absolute; top:50%; left:50%; width:280px; height:175px; margin:-87px 0 0 -140px; transform:translateZ(205px); transform-style:preserve-3d;">
              <div style="width:100%; height:100%; border-radius:10px; background:#16171f; border:1px solid color-mix(in srgb, var(--ac,#10B981) 40%, transparent); box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--ac,#10B981) 22%, transparent); animation:ns-zbob 7s ease-in-out infinite; animation-delay:-4.4s; box-sizing:border-box; overflow:hidden;">
                <div style="height:24px; display:flex; align-items:center; gap:5px; padding:0 12px; border-bottom:1px solid var(--border);">
                  <span style="width:6px; height:6px; border-radius:999px; background:#2f323d;"></span>
                  <span style="width:6px; height:6px; border-radius:999px; background:#2f323d;"></span>
                  <span style="width:6px; height:6px; border-radius:999px; background:#2f323d;"></span>
                  <span style="margin-left:auto; font-family:var(--font-mono); font-size:8px; color:var(--faint);">nullshift.studio</span>
                </div>
                <div style="padding:14px; display:flex; flex-direction:column; gap:8px;">
                  <div style="height:11px; width:64%; border-radius:3px; background:var(--fg); opacity:.92;"></div>
                  <div style="height:6px; width:90%; border-radius:3px; background:#2a2d38;"></div>
                  <div style="height:6px; width:72%; border-radius:3px; background:#2a2d38;"></div>
                  <div style="margin-top:5px; height:20px; width:88px; border-radius:6px; background:var(--ac,#10B981); box-shadow:inset 0 1px 0 rgba(255,255,255,.18);"></div>
                </div>
              </div>
            </div>

          </div>
        </div>`,
      }}
    />
  );
}
