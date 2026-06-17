import { T } from "@nullshift/ui/tokens";

/* Brand data — single source of truth for on-page guidelines + printable PDF.
   Updated to reflect the Halo UI design system (Nullshift edition, 2025).     */

// ── Colour palette ────────────────────────────────────────────────────────────
export const COLORS = [
  // Surfaces
  { name: "Background",    token: "bg",         hex: T.bg,         role: "Page canvas — cool near-black. Nothing sits below this." },
  { name: "Surface",       token: "surface",    hex: T.surface,    role: "Cards, panels, inputs, nav bar." },
  { name: "Elevated",      token: "elevated",   hex: T.elevated,   role: "Modals, dropdowns, active tab fill." },
  // Foreground
  { name: "Foreground",    token: "fg",         hex: T.fg,         role: "Primary text — off-white, not pure white." },
  { name: "Muted",         token: "muted",      hex: T.muted,      role: "Secondary / supporting text." },
  { name: "Faint",         token: "faint",      hex: T.faint,      role: "Placeholders, captions, helper text." },
  // Brand
  { name: "Primary",       token: "primary",    hex: T.primary,    role: "Emerald — CTAs, focus rings, active states, brand dot." },
  { name: "Primary FG",    token: "primaryFg",  hex: T.primaryFg,  role: "Text/icon colour on emerald backgrounds." },
  // Borders
  { name: "Border",        token: "border",     hex: T.border,     role: "Hairline dividers, default card outlines." },
  { name: "Border Strong", token: "borderStr",  hex: T.borderStr,  role: "Inputs, secondary buttons, strong dividers." },
  // Signal
  { name: "Danger",        token: "danger",     hex: T.danger,     role: "Errors, destructive actions — never decorative." },
  { name: "Warning",       token: "warning",    hex: T.warning,    role: "Warnings, soft alerts — never decorative." },
];

// ── Typography ────────────────────────────────────────────────────────────────
export const TYPE = [
  {
    role: "Display / Headings",
    font: "Inter",
    weights: "600 (semibold) — max weight",
    cssVar: "--font-sans",
    usage: "All headings — sentence case, weight 600, -0.03em tracking, 1.04 line-height. Never weight 900.",
  },
  {
    role: "Body / UI",
    font: "Inter",
    weights: "400 / 500 / 600",
    cssVar: "--font-sans",
    usage: "Paragraphs, labels, nav, descriptions. 0.9375rem base, -0.005em tracking, 1.55 line-height.",
  },
  {
    role: "Mono",
    font: "JetBrains Mono",
    weights: "400 / 500 / 600",
    cssVar: "--font-mono",
    usage: "Code, admin labels, reference IDs, system markers. Never used on public-facing buttons.",
  },
];

// ── Design principles ─────────────────────────────────────────────────────────
export const PRINCIPLES = [
  {
    title: "Dark architectural system",
    desc: "Three surface tiers: background → surface → elevated. Components live at their tier. No arbitrary depth or shadow stacking — only modals get drop shadows.",
  },
  {
    title: "One brand colour, used precisely",
    desc: "Emerald #10b981 is reserved for actions: CTAs, focus rings, active states, the brand dot. Signal colours (danger, warning, success) are for status only — never as decoration.",
  },
  {
    title: "Typography as structure",
    desc: "Inter 600 for all headings — sentence case, -0.03em tracking, 1.04 line-height. Hairline 1px borders define geometry. Layout communicates hierarchy before colour does.",
  },
];

/**
 * Render a styled DOM node to a multi-page A4 PDF.
 * Captures the real rendered HTML (web fonts, spacing, swatches) so the
 * output mimics the on-page guidelines exactly.
 */
export async function generateBrandPdf(node: HTMLElement) {
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
    backgroundColor: T.bg,
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

  pdf.setFillColor(T.bg);
  pdf.rect(0, 0, pageW, pageH, "F");
  pdf.addImage(imgData, "JPEG", 0, position, imgW, imgH);
  heightLeft -= pageH;

  while (heightLeft > 0) {
    position -= pageH;
    pdf.addPage();
    pdf.setFillColor(T.bg);
    pdf.rect(0, 0, pageW, pageH, "F");
    pdf.addImage(imgData, "JPEG", 0, position, imgW, imgH);
    heightLeft -= pageH;
  }

  pdf.save("nullshift-brand-guidelines.pdf");
}
