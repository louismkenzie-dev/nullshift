export const T = {
  // Preserve the original brand color scheme
  bg:        "#09090b",
  surface:   "#18181b",
  surface2:  "#262629",
  elevated:  "#262629",
  fg:        "#fafafa",
  muted:     "#a1a1a6",
  primary:   "#10b981",
  primaryFg: "#131316",
  accent:    "#fb923c",
  danger:    "#f87171",
  border:    "#3d3d42",
  borderStr: "#505055",

  // Halo typography
  display:   "var(--font-sans), Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  sans:      "var(--font-sans), Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  mono:      "var(--font-mono), 'JetBrains Mono', ui-monospace, monospace",

  // Halo radius scale
  r: { sm: "6px", md: "10px", lg: "16px", xl: "24px", full: "999px" },

  // Halo spacing scale
  sp: { 1: "4px", 2: "8px", 3: "12px", 4: "16px", 5: "20px", 6: "24px", 8: "32px", 10: "40px", 12: "48px", 16: "64px", 20: "80px" },

  // Halo elevation
  shadow: {
    sm: "0 1px 0 rgba(255,255,255,0.02) inset, 0 1px 2px rgba(0,0,0,0.4)",
    md: "0 8px 24px rgba(0,0,0,0.45), 0 1px 0 rgba(255,255,255,0.03) inset",
  },

  // Halo motion
  ease: "cubic-bezier(0.2, 0.6, 0.2, 1)",
} as const;
