// Halo UI Design System — Nullshift brand edition
// Brand green replaces Halo indigo everywhere.
// All other surface, border, text, and signal values match Halo spec exactly.

export const T = {
  // ── Surface tiers ────────────────────────────────────────────
  bg: "#0A0B0F", // Page canvas
  surface: "#14151C", // Cards, panels, inputs
  surface2: "#1E2029", // Elevated: modals, popovers, active tabs
  elevated: "#1E2029", // Alias of surface2

  // ── Foreground ───────────────────────────────────────────────
  fg: "#F2F4F8", // Primary text
  muted: "#9AA0AE", // Secondary / supporting text
  faint: "#5C6170", // Helper text, placeholders, captions

  // ── Brand / primary (Nullshift green) ────────────────────────
  primary: "#10b981",
  primaryHover: "#34d399",
  primaryPressed: "#059669",
  primarySoft: "rgba(16, 185, 129, 0.12)",
  primaryFg: "#0A0B0F", // Text on primary-colored backgrounds

  // ── Signal colours ───────────────────────────────────────────
  accent: "#3DD7E5", // Halo info/cyan — replaces old orange accent
  success: "#2BE08C",
  warning: "#F5D547",
  info: "#3DD7E5",
  danger: "#FF3A5C",

  successSoft: "rgba(43, 224, 140, 0.12)",
  warningSoft: "rgba(245, 213, 71, 0.14)",
  infoSoft: "rgba(61, 215, 229, 0.14)",
  dangerSoft: "rgba(255, 58, 92, 0.14)",

  // ── Borders ──────────────────────────────────────────────────
  border: "#2A2D38", // Hairline dividers, default outlines
  borderStr: "#3A3D4A", // Inputs, secondary buttons, strong dividers

  // ── Typography stacks ────────────────────────────────────────
  display:
    "var(--font-sans), Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  sans: "var(--font-sans), Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  mono: "var(--font-mono), 'JetBrains Mono', ui-monospace, monospace",

  // ── Radius scale (Halo) ──────────────────────────────────────
  // Kyma clone: square corners everywhere. Only true circles
  // (avatars, dots, toggles) use `full`.
  r: {
    none: "0px",
    sm: "0px",
    md: "0px",
    lg: "0px",
    xl: "0px",
    full: "999px",
  },

  // ── Spacing scale (4px base) ─────────────────────────────────
  sp: {
    1: "4px",
    2: "8px",
    3: "12px",
    4: "16px",
    5: "20px",
    6: "24px",
    8: "32px",
    10: "40px",
    12: "48px",
    16: "64px",
    20: "80px",
  },

  // ── Elevation ────────────────────────────────────────────────
  shadow: {
    sm: "0 1px 0 rgba(255,255,255,0.02) inset, 0 1px 2px rgba(0,0,0,0.4)",
    md: "0 8px 24px rgba(0,0,0,0.45), 0 1px 0 rgba(255,255,255,0.03) inset",
    lg: "0 24px 60px rgba(0,0,0,0.55), 0 1px 0 rgba(255,255,255,0.04) inset",
    focus: "0 0 0 3px rgba(16, 185, 129, 0.30)",
  },

  // ── Motion ───────────────────────────────────────────────────
  ease: "cubic-bezier(0.2, 0.6, 0.2, 1)",
  duration: { fast: "120ms", base: "150ms", slow: "240ms" },

  // ── Layout ───────────────────────────────────────────────────
  containerMax: "1200px",
  containerPad: "clamp(20px, 4vw, 48px)",
} as const;
