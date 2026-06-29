/**
 * Transactional client emails (pure builders → { subject, html, text }):
 *   • portalReadyEmail — sent when an admin creates the client's portal login;
 *     gives them their username (email) + password (their reference) + a login link.
 *   • documentsReadyEmail — sent when an admin sends the proposal; prompts the
 *     client to review + sign their documents in the portal.
 *   • passwordResetEmail — sent when an admin triggers a password reset for a
 *     client who's already signed in; carries a branded Supabase recovery link.
 *   • proposalSignedEmail — sent to the team when a client signs their proposal;
 *     confirms the lead is Won and links straight to their client hub.
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
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.surface2};border:1px solid ${C.border};border-radius:0">
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

export function portalAccessEmail(opts: { name: string; loginUrl: string }): {
  subject: string;
  html: string;
  text: string;
} {
  const { name, loginUrl } = opts;
  const first = name.split(" ")[0] || name || "there";
  const subject = "Your Nullshift project portal is ready";

  const inner = `
    <tr><td style="padding:22px 32px 0">
      <p style="margin:0 0 10px;font-family:${FONT};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${C.primary}">Portal access</p>
      <h1 style="margin:0;font-family:${FONT};font-weight:700;font-size:26px;line-height:1.18;letter-spacing:-0.02em;color:${C.fg}">Your project portal is ready</h1>
      <p style="margin:14px 0 0;font-family:${FONT};font-size:15px;line-height:1.65;color:${C.muted}">Hi ${esc(first)}, your project is set up in your Nullshift portal. Sign in with the password you already created to track progress, review &amp; sign documents, and see your invoices.</p>
    </td></tr>
    <tr><td style="padding:22px 32px 6px">${button(loginUrl, "Sign in to your portal →")}</td></tr>
    <tr><td style="padding:0 32px 8px">
      <p style="margin:8px 0 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.faint}">Forgotten your password? Just ask us and we'll send you a reset link.</p>
    </td></tr>`;

  const html = wrap(
    inner,
    "Your Nullshift project portal is ready — sign in to get started."
  );
  const text = `Hi ${first},

Your project is set up in your Nullshift portal. Sign in with the password you already created:

${loginUrl}

Forgotten your password? Just ask us and we'll send you a reset link.

— Nullshift`;
  return { subject, html, text };
}

export function passwordResetEmail(opts: { name: string; resetUrl: string }): {
  subject: string;
  html: string;
  text: string;
} {
  const { name, resetUrl } = opts;
  const first = name.split(" ")[0] || name || "there";
  const subject = "Reset your Nullshift portal password";

  const inner = `
    <tr><td style="padding:22px 32px 0">
      <p style="margin:0 0 10px;font-family:${FONT};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${C.primary}">Account access</p>
      <h1 style="margin:0;font-family:${FONT};font-weight:700;font-size:26px;line-height:1.18;letter-spacing:-0.02em;color:${C.fg}">Reset your password</h1>
      <p style="margin:14px 0 0;font-family:${FONT};font-size:15px;line-height:1.65;color:${C.muted}">Hi ${esc(first)}, you can set a new password for your Nullshift portal using the link below. For your security it expires in 1 hour.</p>
    </td></tr>
    <tr><td style="padding:22px 32px 6px">${button(resetUrl, "Set a new password →")}</td></tr>
    <tr><td style="padding:0 32px 8px">
      <p style="margin:8px 0 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.faint}">If you didn't expect this, you can ignore this email — your password won't change until you set a new one.</p>
    </td></tr>`;

  const html = wrap(inner, "Set a new password for your Nullshift portal.");
  const text = `Hi ${first},

You can set a new password for your Nullshift portal using the link below (it expires in 1 hour):

${resetUrl}

If you didn't expect this, you can ignore this email.

— Nullshift`;
  return { subject, html, text };
}

export function proposalSignedEmail(opts: {
  clientName: string;
  reference: string;
  total: number;
  planLabel: string | null;
  adminUrl: string;
}): { subject: string; html: string; text: string } {
  const { clientName, reference, total, planLabel, adminUrl } = opts;
  const gbp = "£" + Math.round(total).toLocaleString("en-GB");
  const subject = `Signed — ${clientName} accepted their proposal`;

  const row = (label: string, value: string) =>
    `<tr>
      <td style="padding:11px 0;border-bottom:1px solid ${C.border};font-family:${FONT};font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${C.faint};white-space:nowrap;vertical-align:middle;width:42%">${esc(label)}</td>
      <td style="padding:11px 0 11px 16px;border-bottom:1px solid ${C.border};font-family:${FONT};font-size:15px;color:${C.fg};vertical-align:middle">${esc(value)}</td>
    </tr>`;

  const inner = `
    <tr><td style="padding:22px 32px 0">
      <p style="margin:0 0 10px;font-family:${FONT};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${C.primary}">Proposal signed</p>
      <h1 style="margin:0;font-family:${FONT};font-weight:700;font-size:26px;line-height:1.18;letter-spacing:-0.02em;color:${C.fg}">${esc(clientName)} is ready to build</h1>
      <p style="margin:14px 0 0;font-family:${FONT};font-size:15px;line-height:1.65;color:${C.muted}">They've signed the proposal${planLabel ? " and care plan" : ""}${" "}and accepted the agreement. The lead is now <strong style="color:${C.fg}">Won</strong>, and the itemised build invoice has been drafted.</p>
    </td></tr>
    <tr><td style="padding:20px 32px 0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.surface2};border:1px solid ${C.border};border-radius:0">
        <tr><td style="padding:6px 20px 6px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            ${row("Reference", reference)}
            ${row("Build total", gbp)}
            ${row("Care plan", planLabel ?? "—")}
          </table>
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:20px 32px 8px">${button(adminUrl, "Open client →")}</td></tr>`;

  const html = wrap(inner, `${clientName} signed their proposal — lead is now Won.`);
  const text = `${clientName} has signed their proposal${planLabel ? " and care plan" : ""}.

Reference: ${reference}
Build total: ${gbp}
Care plan: ${planLabel ?? "—"}

The lead is now Won and the build invoice has been drafted.

Open the client: ${adminUrl}

— Nullshift`;
  return { subject, html, text };
}

export function subscriptionSignupEmail(opts: {
  name: string;
  planLabel: string;
  mrr: number;
  url: string;
}): { subject: string; html: string; text: string } {
  const { name, planLabel, mrr, url } = opts;
  const first = name.split(" ")[0] || name || "there";
  const gbp = "£" + Math.round(mrr).toLocaleString("en-GB");
  const subject = `Set up your ${planLabel} care plan`;

  const inner = `
    <tr><td style="padding:22px 32px 0">
      <p style="margin:0 0 10px;font-family:${FONT};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${C.primary}">Your care plan</p>
      <h1 style="margin:0;font-family:${FONT};font-weight:700;font-size:26px;line-height:1.18;letter-spacing:-0.02em;color:${C.fg}">Set up your ${esc(planLabel)} care plan</h1>
      <p style="margin:14px 0 0;font-family:${FONT};font-size:15px;line-height:1.65;color:${C.muted}">Hi ${esc(first)}, your <strong style="color:${C.fg}">${esc(planLabel)}</strong> care plan keeps your system hosted, secure and improving. Add your card below to start it — it's <strong style="color:${C.fg}">${gbp}/month</strong>, billed automatically, and you can cancel any time.</p>
    </td></tr>
    <tr><td style="padding:22px 32px 6px">${button(url, "Set up my care plan →")}</td></tr>
    <tr><td style="padding:0 32px 8px">
      <p style="margin:8px 0 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.faint}">You'll be taken to our secure Stripe checkout — nothing is charged until you confirm. This link is personal to you.</p>
    </td></tr>`;

  const html = wrap(inner, `Set up your ${planLabel} care plan (${gbp}/month).`);
  const text = `Hi ${first},

Set up your ${planLabel} care plan (${gbp}/month, billed automatically, cancel any time). Add your card on our secure Stripe checkout:

${url}

Nothing is charged until you confirm.

— Nullshift`;
  return { subject, html, text };
}

/**
 * Branded invoice email with a Stripe "Pay now" link — sent to the client when
 * their itemised build invoice is generated. Complements Stripe's own invoice
 * email; `payUrl` is the Stripe hosted_invoice_url.
 */
export function buildInvoiceReadyEmail(opts: {
  name: string;
  total: number;
  payUrl: string;
  items: { name: string; amount: number; quantity?: number }[];
}): { subject: string; html: string; text: string } {
  const { name, total, payUrl, items } = opts;
  const first = name.split(" ")[0] || name || "there";
  const gbp = (n: number) => "£" + Math.round(n).toLocaleString("en-GB");
  const subject = `Your Nullshift invoice — ${gbp(total)}`;

  const rows = items
    .map(
      (it) => `<tr>
        <td style="padding:10px 0;border-bottom:1px solid ${C.border};font-family:${FONT};font-size:14px;color:${C.muted};vertical-align:middle">${esc(it.name)}${(it.quantity ?? 1) > 1 ? ` ×${it.quantity}` : ""}</td>
        <td style="padding:10px 0;border-bottom:1px solid ${C.border};font-family:${FONT};font-size:14px;color:${C.fg};text-align:right;white-space:nowrap;vertical-align:middle">${gbp(Number(it.amount) * (it.quantity ?? 1))}</td>
      </tr>`
    )
    .join("");

  const inner = `
    <tr><td style="padding:22px 32px 0">
      <p style="margin:0 0 10px;font-family:${FONT};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${C.primary}">Invoice ready</p>
      <h1 style="margin:0;font-family:${FONT};font-weight:700;font-size:26px;line-height:1.18;letter-spacing:-0.02em;color:${C.fg}">Your invoice is ready to pay</h1>
      <p style="margin:14px 0 0;font-family:${FONT};font-size:15px;line-height:1.65;color:${C.muted}">Hi ${esc(first)}, here's your itemised invoice for the build. Pay securely below — your card is handled by Stripe and you'll get a receipt automatically.</p>
    </td></tr>
    <tr><td style="padding:18px 32px 0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${rows}
        <tr>
          <td style="padding:13px 0 0;font-family:${FONT};font-size:13px;letter-spacing:0.06em;text-transform:uppercase;color:${C.faint};vertical-align:middle">Total due</td>
          <td style="padding:13px 0 0;font-family:${FONT};font-size:18px;font-weight:700;color:${C.fg};text-align:right;vertical-align:middle">${gbp(total)}</td>
        </tr>
      </table>
    </td></tr>
    <tr><td style="padding:22px 32px 6px">${button(payUrl, "Pay now →")}</td></tr>
    <tr><td style="padding:0 32px 8px">
      <p style="margin:8px 0 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.faint}">You can also pay any time from your Nullshift client portal. This link is personal to you.</p>
    </td></tr>`;

  const html = wrap(inner, `Your Nullshift invoice for ${gbp(total)} is ready to pay.`);
  const text = `Hi ${first},

Your itemised invoice for the build is ready — total due ${gbp(total)}.

${items
  .map(
    (it) =>
      `- ${it.name}${(it.quantity ?? 1) > 1 ? ` ×${it.quantity}` : ""}: ${gbp(Number(it.amount) * (it.quantity ?? 1))}`
  )
  .join("\n")}

Total due: ${gbp(total)}

Pay securely here:
${payUrl}

You can also pay any time from your client portal.

— Nullshift`;
  return { subject, html, text };
}
