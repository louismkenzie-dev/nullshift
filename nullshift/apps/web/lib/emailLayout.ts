/**
 * Shared transactional-email layout primitives — brand palette + a table-based
 * wrapper for broad email-client support. Mirrors the funnel email styling so all
 * Nullshift emails look consistent. Pure (no Resend / network) — safe to import
 * anywhere server-side.
 */
export const C = {
  bg: "#0A0B0F",
  surface: "#14151C",
  surface2: "#1E2029",
  fg: "#F2F4F8",
  muted: "#9AA0AE",
  faint: "#5C6170",
  primary: "#10b981",
  primaryFg: "#0A0B0F",
  border: "#2A2D38",
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
      <span style="display:inline-block;width:9px;height:22px;background:#d6d6d6;border-radius:0;vertical-align:middle"></span><span style="display:inline-block;width:9px;height:22px;background:${C.primary};border-radius:0;margin-left:3px;vertical-align:middle"></span>
    </td>
    <td style="vertical-align:middle"><span style="font-family:${FONT};font-weight:800;font-size:16px;letter-spacing:0.04em;color:${C.fg}">NULLSHIFT</span></td>
  </tr></table>`;
}

export function button(href: string, label: string, primary = true): string {
  const bg = primary ? C.primary : "transparent";
  const color = primary ? C.primaryFg : C.fg;
  const border = primary ? C.primary : C.border;
  return `<a href="${esc(href)}" style="display:inline-block;font-family:${FONT};font-size:15px;font-weight:600;text-decoration:none;color:${color};background:${bg};border:1px solid ${border};border-radius:0;padding:13px 24px">${esc(label)}</a>`;
}

/** Outer shell with a hidden preheader + footer line. */
export function wrap(
  inner: string,
  preheader: string,
  footer = "Nullshift — web, automation &amp; brand · UK-based. Reply any time — a real person reads these."
): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"></head>
<body style="margin:0;padding:0;background:${C.bg}">
<span style="display:none!important;opacity:0;color:transparent;height:0;width:0;overflow:hidden">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg}">
  <tr><td align="center" style="padding:32px 16px">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:${C.surface};border:1px solid ${C.border};border-radius:0;overflow:hidden">
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
