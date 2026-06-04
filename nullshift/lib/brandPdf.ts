import { T } from "@/lib/tokens";

/* Brand data — single source mirrored by the on-page guidelines + printable */
export const COLORS = [
  { name: "Background", token: "bg", hex: T.bg, role: "Page background (cool near-black)" },
  { name: "Surface", token: "surface", hex: T.surface, role: "Cards, alternating sections, inputs" },
  { name: "Surface 2", token: "surface2", hex: T.surface2, role: "Tertiary surface / placeholders" },
  { name: "Foreground", token: "fg", hex: T.fg, role: "Primary text (off-white)" },
  { name: "Muted", token: "muted", hex: T.muted, role: "Secondary / body text (grey)" },
  { name: "Primary", token: "primary", hex: T.primary, role: "Emerald accent — buttons, glows, hovers" },
  { name: "Primary FG", token: "primaryFg", hex: T.primaryFg, role: "Text on the emerald accent" },
  { name: "Border", token: "border", hex: T.border, role: "Standard borders / dividers" },
  { name: "Border Strong", token: "borderStr", hex: T.borderStr, role: "Stronger borders" },
];

export const TYPE = [
  { role: "Display", font: "Barlow Condensed", weights: "700 / 800 / 900", cssVar: "--font-display", usage: "Large headlines — uppercase, weight 900, tight tracking" },
  { role: "Body / UI", font: "IBM Plex Sans", weights: "400 / 500 / 600 / 700", cssVar: "--font-sans", usage: "Paragraphs, descriptions, navigation, sub-text" },
  { role: "Mono", font: "IBM Plex Mono", weights: "400 / 500 / 600", cssVar: "--font-mono", usage: "Labels, section markers, coordinate tags, buttons" },
];

export const PRINCIPLES = [
  { title: "BOLD & UNAPOLOGETIC", desc: "Strong display headlines, high contrast, confident positioning. Never timid." },
  { title: "TECHNICAL PRECISION", desc: "Monospace labels, coordinate tags, structured layouts. Everything has a purpose." },
  { title: "RESTRAINED COLOUR", desc: "A single emerald accent against near-black. Used sparingly, never decoratively." },
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
