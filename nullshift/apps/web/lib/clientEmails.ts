/**
 * Transactional client emails (pure builders → { subject, html, text }):
 *   • portalReadyEmail — sent when an admin creates the client's portal login;
 *     gives them their username (email) + password (their reference) + a login link.
 *   • documentsReadyEmail — sent when an admin sends the proposal; prompts the
 *     client to review + sign their documents in the portal.
 */
import { C, FONT, esc, button, wrap } from "./emailLayout";

export function portalReadyEmail(opts: {
  name: string;
  email: string;
  password: string;
  loginUrl: string;
}): { subject: string; html: string; text: string } {
  const { name, email, password, loginUrl } = opts;
  const first = name.split(" ")[0] || name || "there";
  const subject = "Your Nullshift client portal is ready";

  const cred = (label: string, value: string) =>
    `<tr>
      <td style="padding:11px 0;border-bottom:1px solid ${C.border};font-family:${FONT};font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${C.faint};white-space:nowrap;vertical-align:middle;width:38%">${esc(label)}</td>
      <td style="padding:11px 0 11px 16px;border-bottom:1px solid ${C.border};font-family:${FONT};font-size:15px;color:${C.fg};vertical-align:middle"><span style="font-family:ui-monospace,Menlo,Consolas,monospace">${esc(value)}</span></td>
    </tr>`;

  const inner = `
    <tr><td style="padding:22px 32px 0">
      <p style="margin:0 0 10px;font-family:${FONT};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${C.primary}">Portal access</p>
      <h1 style="margin:0;font-family:${FONT};font-weight:700;font-size:26px;line-height:1.18;letter-spacing:-0.02em;color:${C.fg}">Your client portal is ready</h1>
      <p style="margin:14px 0 0;font-family:${FONT};font-size:15px;line-height:1.65;color:${C.muted}">Hi ${esc(first)}, your Nullshift portal is set up. Sign in to track your project, review &amp; sign documents, see your invoices, and submit requests.</p>
    </td></tr>
    <tr><td style="padding:20px 32px 0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.surface2};border:1px solid ${C.border};border-radius:14px">
        <tr><td style="padding:6px 20px 6px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            ${cred("Sign-in link", loginUrl)}
            ${cred("Username", email)}
            ${cred("Password", password)}
          </table>
        </td></tr>
      </table>
      <p style="margin:12px 0 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.faint}">For your security, please change your password after your first sign-in.</p>
    </td></tr>
    <tr><td style="padding:20px 32px 6px">${button(loginUrl, "Sign in to your portal →")}</td></tr>
    <tr><td style="padding:0 32px 8px"></td></tr>`;

  const html = wrap(
    inner,
    "Your Nullshift client portal is ready — sign in to get started."
  );
  const text = `Hi ${first},

Your Nullshift client portal is ready.

Sign-in link: ${loginUrl}
Username: ${email}
Password: ${password}

Please change your password after your first sign-in.

— Nullshift`;
  return { subject, html, text };
}

export function documentsReadyEmail(opts: { name: string; portalUrl: string }): {
  subject: string;
  html: string;
  text: string;
} {
  const { name, portalUrl } = opts;
  const first = name.split(" ")[0] || name || "there";
  const subject = "You have documents to review and sign";

  const inner = `
    <tr><td style="padding:22px 32px 0">
      <p style="margin:0 0 10px;font-family:${FONT};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${C.primary}">Action needed</p>
      <h1 style="margin:0;font-family:${FONT};font-weight:700;font-size:26px;line-height:1.18;letter-spacing:-0.02em;color:${C.fg}">Your proposal is ready to review</h1>
      <p style="margin:14px 0 0;font-family:${FONT};font-size:15px;line-height:1.65;color:${C.muted}">Hi ${esc(first)}, we've sent your proposal and Data Processing Agreement to your portal. Please open them, give them a read, and add your signature so we can get started.</p>
    </td></tr>
    <tr><td style="padding:22px 32px 6px">${button(portalUrl, "Review &amp; sign your documents →")}</td></tr>
    <tr><td style="padding:0 32px 8px">
      <p style="margin:8px 0 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.faint}">Signing confirms the scope, price and care plan, and accepts the DPA so we can begin.</p>
    </td></tr>`;

  const html = wrap(
    inner,
    "Your proposal and DPA are ready to review and sign in your portal."
  );
  const text = `Hi ${first},

We've sent your proposal and Data Processing Agreement to your Nullshift portal. Please review and sign them so we can get started.

Open your portal: ${portalUrl}

— Nullshift`;
  return { subject, html, text };
}
