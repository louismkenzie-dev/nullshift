/**
 * Shared transactional-email layout primitives — brand palette + a table-based
 * wrapper for broad email-client support. Pure (no Resend / network) — safe to
 * import anywhere server-side.
 *
 * LIGHT GROUND, ON PURPOSE. Email clients are allowed to drop `background`
 * (new Outlook strips it on tables, cells, links and spans; Gmail clips long
 * messages; corporate filters flatten styles), so legibility must never
 * depend on a background being painted. Every text colour here is dark enough
 * to read on plain white, and the one filled element — the button — keeps
 * dark text and a visible border so it still reads as a button when its fill
 * is lost. Backgrounds are declared twice (the `bgcolor` attribute and
 * `background-color`) for the clients that honour one but not the other.
 */
export const C = {
  /** Page ground behind the card. */
  bg: "#F3F4F1",
  /** The card. */
  surface: "#FFFFFF",
  /** A quiet panel inside the card (key/value tables, quotes). */
  surface2: "#F6F7F5",
  /** Body text. */
  fg: "#0A0B0F",
  /** Secondary text — still AA on white. */
  muted: "#4B5160",
  /** Tertiary text (footers, expiry lines) — AA on white. */
  faint: "#667085",
  /** Emerald for small text (eyebrows, links): the darker step so it reads on white. */
  primary: "#047857",
  /** The brand emerald, used as a fill behind dark text. */
  primaryBg: "#10B981",
  primaryFg: "#0A0B0F",
  border: "#E4E6E1",
};
export const FONT =
  "'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif";

export function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Brand wordmark (text-based so it renders without hosted images). */
export function logo(): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td style="padding-right:8px;vertical-align:middle">
      <span style="display:inline-block;width:9px;height:22px;background-color:${C.fg};border-radius:0;vertical-align:middle"></span><span style="display:inline-block;width:9px;height:22px;background-color:${C.primaryBg};border-radius:0;margin-left:3px;vertical-align:middle"></span>
    </td>
    <td style="vertical-align:middle"><span style="font-family:${FONT};font-weight:800;font-size:16px;letter-spacing:0.04em;color:${C.fg}">NULLSHIFT</span></td>
  </tr></table>`;
}

/**
 * A button that survives losing its fill: dark text, a solid border in the
 * same colour as the fill, and a bulletproof table cell so Outlook paints
 * the background from `bgcolor` even when it ignores the CSS.
 */
export function button(href: string, label: string, primary = true): string {
  const bg = primary ? C.primaryBg : C.surface;
  const color = C.primaryFg;
  const border = primary ? C.primaryBg : C.fg;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="${bg}" style="background-color:${bg};border:1px solid ${border};border-radius:0"><a href="${esc(href)}" style="display:inline-block;font-family:${FONT};font-size:15px;font-weight:600;text-decoration:none;color:${color};padding:13px 24px">${esc(label)}</a></td></tr></table>`;
}

/** Outer shell with a hidden preheader + footer line. */
export function wrap(
  inner: string,
  preheader: string,
  footer = "Nullshift Development Ltd — web, automation &amp; brand · UK-based. Reply any time — a real person reads these."
): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"></head>
<body bgcolor="${C.bg}" style="margin:0;padding:0;background-color:${C.bg};color:${C.fg}">
<span style="display:none!important;opacity:0;color:transparent;height:0;width:0;overflow:hidden">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.bg}" style="background-color:${C.bg}">
  <tr><td align="center" style="padding:32px 16px">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.surface}" style="width:600px;max-width:600px;background-color:${C.surface};border:1px solid ${C.border};border-radius:0;overflow:hidden">
      <tr><td style="padding:26px 32px 0">${logo()}</td></tr>
      ${inner}
      <tr><td style="padding:24px 32px 30px;border-top:1px solid ${C.border}">
        <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.faint}">${footer}</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}
