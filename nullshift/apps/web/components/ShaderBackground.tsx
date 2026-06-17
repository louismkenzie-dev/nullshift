"use client";

/**
 * Fixed full-screen grid backdrop — the same computer/grid texture used in the
 * hero, pinned behind all content. Pure CSS, so it renders on every device.
 */
export function ShaderBackground() {
  return (
    <div
      aria-hidden
      className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 0, background: "#09090b" }}
    >
      {/* Grid lines */}
      <div
        className="absolute inset-0"
        style={{
          opacity: 0.16,
          backgroundImage:
            "linear-gradient(to right, #888 1px, transparent 1px), linear-gradient(to bottom, #888 1px, transparent 1px)",
          backgroundSize: "clamp(28px, 5vw, 64px) clamp(28px, 5vw, 64px)",
          maskImage:
            "radial-gradient(ellipse 90% 90% at 50% 45%, black 35%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 90% 90% at 50% 45%, black 35%, transparent 100%)",
        }}
      />
      {/* Ambient emerald glow */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 45% at 50% 50%, color-mix(in oklab, #10b981 8%, transparent) 0%, transparent 70%)",
        }}
      />
    </div>
  );
}
