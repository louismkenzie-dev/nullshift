"use client";

import { T } from "@nullshift/ui/tokens";
import { LogoMark } from "@nullshift/ui/components/Logo";
import { ScrambleLoop } from "@/components/anim/ScrambleLoop";

/**
 * The full-bleed Nullshift loading treatment — logo mark over a scrambling
 * wordmark on the KYMA canvas, with the page-transition's emerald sweep line
 * running underneath. One component, two uses: route `loading.tsx` files
 * (navigation queries) and the OperationOverlay (pressed actions).
 */
export function NullshiftLoader({ overlay = false }: { overlay?: boolean }) {
  return (
    <div
      className={overlay ? "fixed inset-0" : "min-h-[60vh]"}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
        background: overlay ? "rgba(10,10,10,0.92)" : "transparent",
        backdropFilter: overlay ? "blur(10px)" : undefined,
        WebkitBackdropFilter: overlay ? "blur(10px)" : undefined,
        zIndex: overlay ? 90 : undefined,
      }}
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex items-center gap-3">
        <LogoMark size={30} />
        <ScrambleLoop
          text="NULLSHIFT"
          style={{
            fontFamily: T.display,
            fontWeight: 700,
            fontSize: "1.35rem",
            letterSpacing: "0.02em",
            textTransform: "uppercase",
            color: "var(--k-fg)",
          }}
        />
      </div>
      {/* Emerald sweep — the page-transition wipe, miniaturised */}
      <div
        aria-hidden
        style={{
          position: "relative",
          width: 180,
          height: 2,
          background: "var(--k-border)",
          overflow: "hidden",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            width: 64,
            background: "var(--k-accent)",
            animation: "ns-loader-sweep 1.1s cubic-bezier(0.16,1,0.3,1) infinite",
          }}
        />
        <style>{`@keyframes ns-loader-sweep {
          0% { left: -64px; }
          100% { left: 180px; }
        }`}</style>
      </div>
    </div>
  );
}
