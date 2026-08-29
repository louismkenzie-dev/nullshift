/**
 * Transactional client emails (pure builders → { subject, html, text }):
 *   • portalInviteEmail — the invite that replaced emailing a generated
 *     password: a single-use link the client uses to set their own.
 *   • documentsReadyEmail — sent when an admin sends the proposal; prompts the
 *     client to review + sign their documents in the portal.
 *   • passwordResetEmail — sent when an admin triggers a password reset for a
 *     client who's already signed in; carries a branded Supabase recovery link.
 *   • proposalSignedEmail — sent to the team when a client signs their proposal;
 *     confirms the lead is Won and links straight to their client hub.
 */
import { C, FONT, esc, button, wrap } from "./emailLayout";
import { BANK_DETAILS } from "@nullshift/content/legalEntity";

/**
 * The invite that replaced emailing a generated password.
 *
 * A password in an inbox is a password in an inbox forever — one spam filter,
 * one forwarded thread or one stale archive away from being either lost or
 * leaked. This sends a single-use link instead: the client sets their own
 * password, we never know it, and the link expires.
 */
export function portalInviteEmail(opts: {
  name: string;
  inviteUrl: string;
}): { subject: string; html: string; text: string } {
  const { name, inviteUrl } = opts;
  const first = name.split(" ")[0] || name || "there";
  const subject = "Set up your Nullshift client portal";

  const inner = `
    <tr><td style="padding:22px 32px 0">
      <p style="margin:0 0 10px;font-family:${FONT};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${C.primary}">Portal access</p>
      <h1 style="margin:0;font-family:${FONT};font-weight:700;font-size:26px;line-height:1.18;letter-spacing:-0.02em;color:${C.fg}">Set up your client portal</h1>
      <p style="margin:14px 0 0;font-family:${FONT};font-size:15px;line-height:1.65;color:${C.muted}">Hi ${esc(first)}, your Nullshift portal is ready. Choose a password using the link below and you're in — you'll be able to track your project, review and sign documents, see your invoices and raise requests.</p>
    </td></tr>
    <tr><td style="padding:22px 32px 6px">${button(inviteUrl, "Choose your password →")}</td></tr>
    <tr><td style="padding:6px 32px 8px">
      <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.faint}">This link is single-use and expires. If it has run out, use &ldquo;Forgot your password?&rdquo; on the sign-in page and we&rsquo;ll send a fresh one. We never see or store your password.</p>
    </td></tr>`;

  const html = wrap(inner, "Set up your Nullshift client portal.");
  const text = `Hi ${first},

Your Nullshift portal is ready. Choose a password here:

${inviteUrl}

This link is single-use and expires. If it has run out, use "Forgot your password?" on the sign-in page and we'll send a fresh one. We never see or store your password.

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
 * Branded invoice email — sent to the client when their itemised build invoice
 * is generated. Offers both payment routes: the Stripe "Pay by card" link
 * (`payUrl`, when Stripe is configured — complements Stripe's own invoice
 * email) and a bank transfer to the business account (no card fees), with the
 * client's payment reference so transfers can be matched.
 */
export function buildInvoiceReadyEmail(opts: {
  name: string;
  total: number;
  payUrl: string | null;
  items: { name: string; amount: number; quantity?: number }[];
  /** Payment reference for bank transfers (e.g. NS-2E458EB1). */
  reference: string;
}): { subject: string; html: string; text: string } {
  const { name, total, payUrl, items, reference } = opts;
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
      <p style="margin:14px 0 0;font-family:${FONT};font-size:15px;line-height:1.65;color:${C.muted}">Hi ${esc(first)}, here's your itemised invoice for the build. ${payUrl ? "Pay securely below — your card is handled by Stripe and you'll get a receipt automatically." : "Pay by bank transfer using the details below — we'll confirm as soon as it arrives."}</p>
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
    ${payUrl ? `<tr><td style="padding:22px 32px 6px">${button(payUrl, "Pay by card →")}</td></tr>` : ""}
    <tr><td style="padding:${payUrl ? "10px" : "22px"} 32px 8px">
      <p style="margin:0 0 8px;font-family:${FONT};font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${C.faint}">${payUrl ? "Or pay" : "Pay"} by bank transfer</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${C.border}">
        ${(
          [
            ["Account name", BANK_DETAILS.accountName],
            ["Sort code", BANK_DETAILS.sortCode],
            ["Account number", BANK_DETAILS.accountNumber],
            ["Amount", gbp(total)],
            ["Payment reference", reference],
          ] as [string, string][]
        )
          .map(
            ([k, v], i) => `<tr>
          <td style="padding:9px 14px;border-top:${i ? `1px solid ${C.border}` : "none"};font-family:${FONT};font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:${C.faint};vertical-align:middle">${esc(k)}</td>
          <td style="padding:9px 14px;border-top:${i ? `1px solid ${C.border}` : "none"};font-family:${FONT};font-size:13px;color:${C.fg};text-align:right;white-space:nowrap;vertical-align:middle">${esc(v)}</td>
        </tr>`
          )
          .join("")}
      </table>
      <p style="margin:10px 0 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.faint}">Faster Payments, BACS and CHAPS all work — please include the payment reference so we can match your transfer. We mark the invoice paid as soon as it arrives.${payUrl ? " You can also pay any time from your Nullshift client portal — the card link is personal to you." : ""}</p>
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
${
  payUrl
    ? `
Pay by card here:
${payUrl}
`
    : ""
}
${payUrl ? "Or pay" : "Pay"} by bank transfer:
  Account name:      ${BANK_DETAILS.accountName}
  Sort code:         ${BANK_DETAILS.sortCode}
  Account number:    ${BANK_DETAILS.accountNumber}
  Amount:            ${gbp(total)}
  Payment reference: ${reference}

Faster Payments, BACS and CHAPS all work — please include the payment
reference so we can match your transfer.

You can also pay any time from your client portal.

— Nullshift`;
  return { subject, html, text };
}

/**
 * Care-plan Direct Debit authorisation email — sent when the admin attaches a
 * plan and starts GoCardless setup. One link: the client authorises the BACS
 * mandate and the plan activates automatically once it's confirmed.
 */
export function buildDirectDebitEmail(opts: {
  name: string;
  planLabel: string;
  mrr: number;
  url: string;
}): { subject: string; html: string; text: string } {
  const { name, planLabel, mrr, url } = opts;
  const first = name.split(" ")[0] || name || "there";
  const gbp = (n: number) => "£" + Math.round(n).toLocaleString("en-GB");
  const subject = `Set up your Nullshift ${planLabel} plan — ${gbp(mrr)}/month by Direct Debit`;

  const inner = `
    <tr><td style="padding:22px 32px 0">
      <p style="margin:0 0 10px;font-family:${FONT};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${C.primary}">Care plan setup</p>
      <h1 style="margin:0;font-family:${FONT};font-weight:700;font-size:26px;line-height:1.18;letter-spacing:-0.02em;color:${C.fg}">Authorise your Direct Debit</h1>
      <p style="margin:14px 0 0;font-family:${FONT};font-size:15px;line-height:1.65;color:${C.muted}">Hi ${esc(first)}, your <strong style="color:${C.fg}">${esc(planLabel)}</strong> care plan is ready to start — <strong style="color:${C.fg}">${gbp(mrr)}/month</strong>, collected by Direct Debit. Authorise the mandate below (it takes about a minute, powered by GoCardless) and your plan activates automatically.</p>
    </td></tr>
    <tr><td style="padding:22px 32px 6px">${button(url, "Set up Direct Debit →")}</td></tr>
    <tr><td style="padding:0 32px 8px">
      <p style="margin:8px 0 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.faint}">Protected by the Direct Debit Guarantee. You can cancel any time. If you weren't expecting this, just reply and tell us.</p>
    </td></tr>`;

  const html = wrap(
    inner,
    `Authorise your ${planLabel} care plan Direct Debit — ${gbp(mrr)}/month.`
  );
  const text = `Hi ${first},

Your ${planLabel} care plan is ready to start — ${gbp(mrr)}/month, collected
by Direct Debit and protected by the Direct Debit Guarantee.

Authorise the mandate here (takes about a minute, powered by GoCardless):
${url}

Your plan activates automatically once the mandate is confirmed. You can
cancel any time. If you weren't expecting this, just reply and tell us.

— Nullshift`;
  return { subject, html, text };
}
