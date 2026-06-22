/* Brand data — single source of truth for the on-page guidelines + the
   downloadable PDF. Reflects the current Nullshift design system: alternating
   cream / near-black sections, a single emerald accent, square corners,
   TASA Orbiter (display + body) and Roboto Mono (labels). 2026 edition.        */

/* ── Explicit hex palette (for the off-screen PDF capture, which can't read
   the .k-dark / .k-cream CSS variables) ─────────────────────────────────── */
export const PRINT = {
  ink: "#0a0a0a", // dark canvas / ink
  bone: "#f4f4e8", // warm off-white (dark-theme text AND cream-theme bg)
  darkSurface: "#141414",
  darkMuted: "#9a9a90",
  darkFaint: "#6a6a62",
  darkBorder: "rgba(244,244,232,0.16)",
  darkBorderStrong: "rgba(244,244,232,0.30)",
  creamSurface: "#ecece0",
  creamMuted: "#55554c",
  creamBorder: "rgba(10,10,10,0.18)",
  emerald: "#10b981",
  emerald2: "#34d399",
  onEmerald: "#04140d",
  success: "#2BE08C",
  warning: "#F5D547",
  info: "#3DD7E5",
  danger: "#FF3A5C",
} as const;

// ── Colour palette ────────────────────────────────────────────────────────────
// group: which band the colour belongs to (drives the on-page sub-headers).
export const COLORS: {
  name: string;
  token: string;
  hex: string;
  role: string;
  group: "Dark theme" | "Cream theme" | "Brand" | "Signal";
}[] = [
  // Dark theme
  {
    name: "Ink",
    token: "k-bg · dark",
    hex: "#0a0a0a",
    role: "Near-black canvas. Hero and every dark band.",
    group: "Dark theme",
  },
  {
    name: "Bone",
    token: "k-fg · dark",
    hex: "#f4f4e8",
    role: "Warm off-white text on dark — never pure white.",
    group: "Dark theme",
  },
  {
    name: "Surface",
    token: "k-surface · dark",
    hex: "#141414",
    role: "Cards, panels and inputs on dark.",
    group: "Dark theme",
  },
  {
    name: "Muted",
    token: "k-muted · dark",
    hex: "#9a9a90",
    role: "Secondary / supporting text on dark.",
    group: "Dark theme",
  },
  // Cream theme
  {
    name: "Cream",
    token: "k-bg · cream",
    hex: "#f4f4e8",
    role: "Warm paper canvas. Alternates with dark, band to band.",
    group: "Cream theme",
  },
  {
    name: "Ink on cream",
    token: "k-fg · cream",
    hex: "#0a0a0a",
    role: "Near-black text on cream.",
    group: "Cream theme",
  },
  {
    name: "Surface",
    token: "k-surface · cream",
    hex: "#ecece0",
    role: "Cards and panels on cream.",
    group: "Cream theme",
  },
  {
    name: "Muted",
    token: "k-muted · cream",
    hex: "#55554c",
    role: "Secondary / supporting text on cream.",
    group: "Cream theme",
  },
  // Brand
  {
    name: "Emerald",
    token: "k-accent",
    hex: "#10b981",
    role: "The single accent — one word per headline, CTAs, focus, logo pill.",
    group: "Brand",
  },
  {
    name: "Emerald bright",
    token: "k-accent-2",
    hex: "#34d399",
    role: "Hover, active, and the data-pulses in the node-network.",
    group: "Brand",
  },
  {
    name: "On emerald",
    token: "k-on-accent",
    hex: "#04140d",
    role: "Text / icons on an emerald fill.",
    group: "Brand",
  },
  // Signal — status only, never decorative
  {
    name: "Success",
    token: "success",
    hex: "#2BE08C",
    role: "Positive status only. Never decoration.",
    group: "Signal",
  },
  {
    name: "Warning",
    token: "warning",
    hex: "#F5D547",
    role: "Caution status only. Never decoration.",
    group: "Signal",
  },
  {
    name: "Danger",
    token: "danger",
    hex: "#FF3A5C",
    role: "Errors & destructive actions only.",
    group: "Signal",
  },
];

// ── Typography ────────────────────────────────────────────────────────────────
export const TYPE = [
  {
    role: "Display / Headings",
    font: "TASA Orbiter",
    weights: "700 · UPPERCASE",
    cssVar: "--font-sans",
    usage:
      "Every heading — UPPERCASE, weight 700, -0.03em tracking, ~1.04 line-height. The voice of the brand.",
  },
  {
    role: "Body / Lead",
    font: "TASA Orbiter",
    weights: "400 / 500",
    cssVar: "--font-sans",
    usage:
      "Paragraphs and leads — sentence case, ~1.06rem, -0.01em tracking, 1.5 line-height.",
  },
  {
    role: "Labels / Mono",
    font: "Roboto Mono",
    weights: "500",
    cssVar: "--font-mono",
    usage:
      "Eyebrows, tags, numbers, system markers — UPPERCASE, 0.1em tracking. Never on headings.",
  },
];

// ── Design principles ─────────────────────────────────────────────────────────
export const PRINCIPLES = [
  {
    title: "Cream & dark, in rhythm",
    desc: "The site alternates warm cream and near-black, section to section. Two themes, one system — the warm off-white that's text on dark becomes the canvas on cream.",
  },
  {
    title: "One emerald, used sparingly",
    desc: "Emerald #10b981 is the only colour — one highlighted word per headline, CTAs, focus, the logo pill. Signal colours (success, warning, danger) are status only, never decoration.",
  },
  {
    title: "Square, hairline, uppercase",
    desc: "Corners are square — radius 0, only true circles round. 1px hairline borders draw the geometry. TASA Orbiter sets UPPERCASE headings; Roboto Mono sets the labels.",
  },
  {
    title: "Systems you can see",
    desc: "The agentic node-network — nodes wired together, data pulses routing the edges — is the signature motif: intelligence, connection, and work routed end to end.",
  },
];

/**
 * Render a styled DOM node to a multi-page A4 PDF.
 * Captures the real rendered HTML (web fonts, spacing, swatches) so the
 * output mirrors the on-page guidelines exactly.
 */
export async function generateBrandPdf(node: HTMLElement, bg: string = PRINT.ink) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);

  // Ensure brand web-fonts are fully loaded before capture
  if (typeof document !== "undefined" && document.fonts?.ready) {
    await document.fonts.ready;
  }

  const canvas = await html2canvas(node, {
    scale: 2,
    backgroundColor: bg,
    useCORS: true,
    logging: false,
    windowWidth: node.scrollWidth,
    windowHeight: node.scrollHeight,
  });

  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  // Scale the captured image to the PDF page width, paginate vertically.
  const imgW = pageW;
  const imgH = (canvas.height * imgW) / canvas.width;
  const imgData = canvas.toDataURL("image/jpeg", 0.95);

  let heightLeft = imgH;
  let position = 0;

  pdf.setFillColor(bg);
  pdf.rect(0, 0, pageW, pageH, "F");
  pdf.addImage(imgData, "JPEG", 0, position, imgW, imgH);
  heightLeft -= pageH;

  while (heightLeft > 0) {
    position -= pageH;
    pdf.addPage();
    pdf.setFillColor(bg);
    pdf.rect(0, 0, pageW, pageH, "F");
    pdf.addImage(imgData, "JPEG", 0, position, imgW, imgH);
    heightLeft -= pageH;
  }

  pdf.save("nullshift-brand-guidelines.pdf");
}
