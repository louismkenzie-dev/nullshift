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
export function portalInviteEmail(opts: { name: string; inviteUrl: string }): {
  subject: string;
  html: string;
  text: string;
} {
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

/**
 * The Order Form (and the Master Services Agreement it incorporates) is in
 * the portal awaiting signature. Sent by sendOrderForm; names the application
 * fee when one is on the form so nobody signs a fee they did not see coming.
 */
export function agreementReadyEmail(opts: {
  name: string;
  reference: string;
  portalUrl: string;
  feeClause: string | null;
}): { subject: string; html: string; text: string } {
  const { name, reference, portalUrl, feeClause } = opts;
  const first = name.split(" ")[0] || name || "there";
  const subject = `${reference}: your Order Form and Master Services Agreement are ready to sign`;
  const feeHtml = feeClause
    ? `<p style="margin:12px 0 0;font-family:${FONT};font-size:13px;line-height:1.6;color:${C.muted}"><strong>Please note:</strong> ${esc(feeClause)}</p>`
    : "";
  const inner = `
    <tr><td style="padding:22px 32px 0">
      <p style="margin:0 0 10px;font-family:${FONT};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${C.primary}">Action needed</p>
      <h1 style="margin:0;font-family:${FONT};font-weight:700;font-size:26px;line-height:1.18;letter-spacing:-0.02em;color:${C.fg}">Your agreement is ready to sign</h1>
      <p style="margin:14px 0 0;font-family:${FONT};font-size:15px;line-height:1.65;color:${C.muted}">Hi ${esc(first)}, Order Form ${esc(reference)} is in your portal, together with the Master Services Agreement it sits under. Please read both and sign when you are happy — nothing is charged and no payments run through your Stripe account until you have.</p>
      ${feeHtml}
    </td></tr>
    <tr><td style="padding:22px 32px 6px">${button(portalUrl + "/legal", "Read & sign the agreement →")}</td></tr>
    <tr><td style="padding:0 32px 8px">
      <p style="margin:8px 0 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.faint}">Signing records the scope, the fees and the versions of every document you agreed to.</p>
    </td></tr>`;
  const html = wrap(
    inner,
    `Order Form ${reference} and the Master Services Agreement are ready to sign.`
  );
  const text = `Hi ${first},

Order Form ${reference} is in your Nullshift portal together with the Master Services Agreement it sits under. Please read both and sign when you are happy. Nothing is charged and no payments run through your Stripe account until you have.
${feeClause ? "\nPlease note: " + feeClause + "\n" : ""}
Read and sign: ${portalUrl}/legal
`;
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
    <tr><td style="padding:22px 32px 6px">${button(portalUrl, "Review & sign your documents →")}</td></tr>
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
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${C.surface2};border:1px solid ${C.border};border-radius:0">
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
 * The bank-transfer block every invoice email carries: account details, the
 * amount and the invoice's own payment reference (NS-<client>-<invoice>).
 * The reference is what the bank feed matches on, so it is the one line a
 * client must copy; everything else is there so the transfer screen can be
 * filled in 1:1.
 */
export function bankTransferBlock(opts: { reference: string; amount: string; lead?: string }): string {
  const lead = opts.lead ?? "Pay by bank transfer";
  return `<p style="margin:0 0 8px;font-family:${FONT};font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${C.primary}">${esc(lead)}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.surface2}" style="background-color:${C.surface2};border:1px solid ${C.border}">
        ${(
          [
            ["Account name", BANK_DETAILS.accountName],
            ["Sort code", BANK_DETAILS.sortCode],
            ["Account number", BANK_DETAILS.accountNumber],
            ["Amount", opts.amount],
            ["Payment reference", opts.reference],
          ] as [string, string][]
        )
          .map(
            ([k, v], i) => `<tr>
          <td style="padding:9px 14px;border-top:${i ? `1px solid ${C.border}` : "none"};font-family:${FONT};font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:${C.faint};vertical-align:middle">${esc(k)}</td>
          <td style="padding:9px 14px;border-top:${i ? `1px solid ${C.border}` : "none"};font-family:${FONT};font-size:${k === "Payment reference" ? "15px;font-weight:700" : "13px"};color:${C.fg};text-align:right;white-space:nowrap;vertical-align:middle">${esc(v)}</td>
        </tr>`
          )
          .join("")}
      </table>
      <p style="margin:10px 0 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.faint}">Faster Payments, BACS and CHAPS all work. Please put <strong style="color:${C.fg}">${esc(opts.reference)}</strong> as the payment reference — our bank feed matches it to this invoice and marks it paid the moment it lands, usually the same day. No card fees either way.</p>`;
}

export function bankTransferText(opts: { reference: string; amount: string }): string {
  return `  Account name:      ${BANK_DETAILS.accountName}
  Sort code:         ${BANK_DETAILS.sortCode}
  Account number:    ${BANK_DETAILS.accountNumber}
  Amount:            ${opts.amount}
  Payment reference: ${opts.reference}

Faster Payments, BACS and CHAPS all work. Please put ${opts.reference} as the
payment reference — our bank feed matches it to this invoice and marks it
paid the moment it lands.`;
}

/**
 * Branded invoice email — sent to the client when an itemised build, one-off
 * or manual invoice is raised. Bank transfer is the way to pay: the account
 * details and the invoice's own payment reference lead, and the bank feed
 * matches that reference automatically. The optional link opens the invoice
 * document (Xero's online view) — it is for viewing and downloading, not a
 * card route.
 */
export function buildInvoiceReadyEmail(opts: {
  name: string;
  total: number;
  /** The invoice document, when there is one to show (Xero online invoice). */
  payUrl: string | null;
  /** Kept for callers; only "xero" (a view link) is produced now. */
  payVia?: "xero" | "stripe" | null;
  items: { name: string; amount: number; quantity?: number }[];
  /** The invoice's own payment reference (e.g. NS-2E458EB1-89FAB7). */
  reference: string;
  /** "24 October 2026" — shown when the caller knows the due date. */
  dueOn?: string | null;
}): { subject: string; html: string; text: string } {
  const { name, total, payUrl, items, reference, dueOn } = opts;
  const first = name.split(" ")[0] || name || "there";
  const gbp = (n: number) =>
    "£" + n.toLocaleString("en-GB", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 });
  const subject = `Your Nullshift invoice — ${gbp(total)} · ref ${reference}`;

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
      <p style="margin:0 0 10px;font-family:${FONT};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${C.primary}">Invoice · ${esc(reference)}</p>
      <h1 style="margin:0;font-family:${FONT};font-weight:700;font-size:26px;line-height:1.18;letter-spacing:-0.02em;color:${C.fg}">Your invoice is ready</h1>
      <p style="margin:14px 0 0;font-family:${FONT};font-size:15px;line-height:1.65;color:${C.muted}">Hi ${esc(first)}, here is your invoice${dueOn ? ` — due <strong style="color:${C.fg}">${esc(dueOn)}</strong>` : ""}. Please pay by bank transfer using the details below, quoting the payment reference.</p>
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
    <tr><td style="padding:22px 32px 8px">
      ${bankTransferBlock({ reference, amount: gbp(total) })}
    </td></tr>
    ${payUrl ? `<tr><td style="padding:14px 32px 6px">${button(payUrl, "View the invoice →", false)}</td></tr><tr><td style="padding:0 32px 8px"><p style="margin:6px 0 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.faint}">The link opens the invoice document to view or download; your copy is also in your Nullshift client portal.</p></td></tr>` : `<tr><td style="padding:0 32px 8px"><p style="margin:6px 0 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.faint}">Your copy of the invoice is in your Nullshift client portal.</p></td></tr>`}`;

  const html = wrap(inner, `Your Nullshift invoice for ${gbp(total)} — pay by bank transfer quoting ${reference}.`);
  const text = `Hi ${first},

Your invoice is ready${dueOn ? ` — due ${dueOn}` : ""}. Total due ${gbp(total)}.

${items
  .map(
    (it) =>
      `- ${it.name}${(it.quantity ?? 1) > 1 ? ` ×${it.quantity}` : ""}: ${gbp(Number(it.amount) * (it.quantity ?? 1))}`
  )
  .join("\n")}

Total due: ${gbp(total)}

Pay by bank transfer:
${bankTransferText({ reference, amount: gbp(total) })}
${payUrl ? `\nView the invoice document:\n${payUrl}\n` : ""}
Your copy is also in your Nullshift client portal.

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

/**
 * Plan invite — sent from the Direct Debits board once the client has been
 * scored: their three monthly options at THEIR price, and one link into the
 * portal (a set-your-password link for a client who has never signed in, the
 * sign-in page otherwise) landing on the plan page.
 */
export function planInviteEmail(opts: {
  name: string;
  options: { label: string; mrr: number; blurb: string; note?: string | null }[];
  url: string;
  /** True when the link sets their password (first sign-in). */
  firstSignIn: boolean;
}): { subject: string; html: string; text: string } {
  const { name, options, url, firstSignIn } = opts;
  const first = name.split(" ")[0] || name || "there";
  const gbp = (n: number) => "£" + Math.round(n).toLocaleString("en-GB");
  const subject = "Your Nullshift plan options are ready";

  const rows = options
    .map(
      (o, i) => `<tr>
        <td style="padding:12px 16px;border-top:${i ? `1px solid ${C.border}` : "none"};font-family:${FONT};font-size:14px;font-weight:700;color:${C.fg};vertical-align:top;white-space:nowrap">${esc(o.label)}</td>
        <td style="padding:12px 16px;border-top:${i ? `1px solid ${C.border}` : "none"};font-family:${FONT};font-size:13px;line-height:1.55;color:${C.muted};vertical-align:top">${esc(o.blurb)}${o.note ? `<br/><span style="color:${C.fg}">Why this price: ${esc(o.note)}</span>` : ""}</td>
        <td style="padding:12px 16px;border-top:${i ? `1px solid ${C.border}` : "none"};font-family:${FONT};font-size:14px;color:${C.fg};text-align:right;white-space:nowrap;vertical-align:top">${gbp(o.mrr)}<span style="color:${C.faint};font-size:12px">/month</span></td>
      </tr>`
    )
    .join("");

  const inner = `
    <tr><td style="padding:22px 32px 0">
      <p style="margin:0 0 10px;font-family:${FONT};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${C.primary}">Your monthly plan</p>
      <h1 style="margin:0;font-family:${FONT};font-weight:700;font-size:26px;line-height:1.18;letter-spacing:-0.02em;color:${C.fg}">Three ways we can look after your system</h1>
      <p style="margin:14px 0 0;font-family:${FONT};font-size:15px;line-height:1.65;color:${C.muted}">Hi ${esc(first)}, your plan options are ready. These are priced for your system — pick whichever suits, and it's collected monthly by Direct Debit. Cancel any time.</p>
    </td></tr>
    <tr><td style="padding:18px 32px 0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${C.surface2};border:1px solid ${C.border};border-radius:0">${rows}</table>
    </td></tr>
    <tr><td style="padding:22px 32px 6px">${button(url, firstSignIn ? "Choose your password & pick a plan →" : "Sign in & pick a plan →")}</td></tr>
    <tr><td style="padding:0 32px 8px">
      <p style="margin:8px 0 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.faint}">${
        firstSignIn
          ? "This is your Nullshift client portal — a separate login from any system we built for you, even if it uses the same email. The link is single-use and expires after an hour; if it has run out, use &ldquo;Forgot your password?&rdquo; on the sign-in page."
          : "This is your Nullshift client portal — a separate login from any system we built for you, even if it uses the same email."
      } Protected by the Direct Debit Guarantee.</p>
    </td></tr>`;

  const html = wrap(
    inner,
    "Your Nullshift plan options are ready — three levels, priced for you."
  );
  const text = `Hi ${first},

Your plan options are ready — priced for your system, collected monthly by Direct Debit, cancel any time:

${options.map((o) => `- ${o.label}: ${gbp(o.mrr)}/month — ${o.blurb}${o.note ? ` (Why this price: ${o.note})` : ""}`).join("\n")}

${firstSignIn ? "Choose your password and pick a plan here (single-use link, valid for one hour):" : "Sign in and pick a plan here:"}
${url}

This is your Nullshift client portal — a separate login from any system we built for you, even if it uses the same email.

— Nullshift`;
  return { subject, html, text };
}

/**
 * The daily chase for a Direct Debit that was started and never finished.
 *
 * Deliberately links to the PORTAL, not to GoCardless. A GoCardless
 * authorisation link is superseded the moment a new one is minted, so a run of
 * daily emails carrying links would be a run of dead links with only the newest
 * one alive. The portal page is permanent and mints a live link on the spot.
 *
 * The copy hardens as the days pass — `reminderTone` in lib/billing/
 * mandateReminders.ts decides which of the three it is. The last one says
 * plainly that a person will pick it up, because by then something is actually
 * wrong and pretending otherwise wastes everybody's time.
 */
export function mandateReminderEmail(opts: {
  name: string;
  planLabel: string;
  mrr: number;
  url: string;
  tone: "nudge" | "check" | "final";
}): { subject: string; html: string; text: string } {
  const { name, planLabel, mrr, url, tone } = opts;
  const first = name.split(" ")[0] || name || "there";
  const gbp = (n: number) => "£" + Math.round(n).toLocaleString("en-GB");

  const subject =
    tone === "nudge"
      ? `One step left on your ${planLabel} plan`
      : tone === "final"
        ? `Your ${planLabel} plan is still waiting on a Direct Debit`
        : `Finish setting up your ${planLabel} plan`;

  const heading =
    tone === "final" ? "Shall we give you a call?" : "One step left";

  const openingHtml =
    tone === "nudge"
      ? `Hi ${esc(first)}, you picked the <strong style="color:${C.fg}">${esc(planLabel)}</strong> plan and agreed the terms — thank you. The last step is the Direct Debit, and it looks like that didn't finish.`
      : tone === "final"
        ? `Hi ${esc(first)}, your <strong style="color:${C.fg}">${esc(planLabel)}</strong> plan is still waiting on its Direct Debit. This is the last automatic reminder — after this one of us will pick it up with you directly.`
        : `Hi ${esc(first)}, your <strong style="color:${C.fg}">${esc(planLabel)}</strong> plan is ready to go, but the Direct Debit isn't set up yet.`;

  const openingText =
    tone === "nudge"
      ? `you picked the ${planLabel} plan and agreed the terms — thank you. The last step is the Direct Debit, and it looks like that didn't finish.`
      : tone === "final"
        ? `your ${planLabel} plan is still waiting on its Direct Debit. This is the last automatic reminder — after this one of us will pick it up with you directly.`
        : `your ${planLabel} plan is ready to go, but the Direct Debit isn't set up yet.`;

  const inner = `
    <tr><td style="padding:22px 32px 0">
      <p style="margin:0 0 10px;font-family:${FONT};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${C.primary}">Care plan setup</p>
      <h1 style="margin:0;font-family:${FONT};font-weight:700;font-size:26px;line-height:1.18;letter-spacing:-0.02em;color:${C.fg}">${esc(heading)}</h1>
      <p style="margin:14px 0 0;font-family:${FONT};font-size:15px;line-height:1.65;color:${C.muted}">${openingHtml}</p>
      <p style="margin:12px 0 0;font-family:${FONT};font-size:15px;line-height:1.65;color:${C.muted}">It takes about a minute and you'll need your sort code and account number. <strong style="color:${C.fg}">Nothing is collected until the mandate is set up</strong>, and you can cancel any time.</p>
    </td></tr>
    <tr><td style="padding:22px 32px 6px">${button(url, "Set up your Direct Debit →")}</td></tr>
    <tr><td style="padding:0 32px 8px">
      <p style="margin:8px 0 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.faint}">${esc(planLabel)} plan — ${gbp(mrr)}/month, protected by the Direct Debit Guarantee. If you've changed your mind, just reply and tell us — we'd far rather know than keep sending these.</p>
    </td></tr>`;

  const html = wrap(
    inner,
    `Your ${planLabel} plan still needs its Direct Debit — ${gbp(mrr)}/month.`
  );
  const text = `Hi ${first},

${openingText}

It takes about a minute and you'll need your sort code and account number.
Nothing is collected until the mandate is set up, and you can cancel any time.

Set it up here:
${url}

${planLabel} plan — ${gbp(mrr)}/month, protected by the Direct Debit Guarantee.
If you've changed your mind, just reply and tell us — we'd far rather know than
keep sending these.

— Nullshift`;
  return { subject, html, text };
}

/* ── Invoiced care plans (migration 0072) ─────────────────────────────────── */

const gbpFull = (n: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);

/**
 * The month's invoice, the day its period starts. Links to the invoice in
 * Xero's online view when there is one (view, download, pay by card or bank
 * where a payment service is connected), else to the portal's payments page.
 */
export function carePlanInvoiceEmail(opts: {
  name: string;
  planLabel: string;
  periodLabel: string;
  amount: number;
  dueOn: string;
  reference: string;
  url: string | null;
  note?: string | null;
}): { subject: string; html: string; text: string } {
  const { name, planLabel, periodLabel, amount, dueOn, reference, url, note } = opts;
  const first = name.split(" ")[0] || name || "there";
  const subject = `Invoice: ${planLabel} care plan — ${periodLabel} (${gbpFull(amount)})`;
  const inner = `
    <tr><td style="padding:22px 32px 0">
      <p style="margin:0 0 10px;font-family:${FONT};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${C.primary}">Care plan invoice · ${esc(reference)}</p>
      <h1 style="margin:0;font-family:${FONT};font-weight:700;font-size:26px;line-height:1.18;letter-spacing:-0.02em;color:${C.fg}">${esc(planLabel)} care plan — ${esc(periodLabel)}</h1>
      <p style="margin:14px 0 0;font-family:${FONT};font-size:15px;line-height:1.65;color:${C.muted}">Hi ${esc(first)}, here is this month's invoice for your <strong style="color:${C.fg}">${esc(planLabel)}</strong> care plan.</p>
    </td></tr>
    <tr><td style="padding:16px 32px 0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.surface2}" style="background-color:${C.surface2};border:1px solid ${C.border}">
        <tr><td style="padding:10px 14px;font-family:${FONT};font-size:13px;color:${C.muted}">Amount</td><td align="right" style="padding:10px 14px;font-family:${FONT};font-size:15px;font-weight:600;color:${C.fg}">${esc(gbpFull(amount))}</td></tr>
        <tr><td style="padding:10px 14px;font-family:${FONT};font-size:13px;color:${C.muted};border-top:1px solid ${C.border}">Period</td><td align="right" style="padding:10px 14px;font-family:${FONT};font-size:13px;color:${C.fg};border-top:1px solid ${C.border}">${esc(periodLabel)}</td></tr>
        <tr><td style="padding:10px 14px;font-family:${FONT};font-size:13px;color:${C.muted};border-top:1px solid ${C.border}">Due</td><td align="right" style="padding:10px 14px;font-family:${FONT};font-size:13px;color:${C.fg};border-top:1px solid ${C.border}">${esc(dueOn)}</td></tr>
        <tr><td style="padding:10px 14px;font-family:${FONT};font-size:13px;color:${C.muted};border-top:1px solid ${C.border}">Reference</td><td align="right" style="padding:10px 14px;font-family:${FONT};font-size:13px;color:${C.fg};border-top:1px solid ${C.border}">${esc(reference)}</td></tr>
      </table>
    </td></tr>
    ${note ? `<tr><td style="padding:14px 32px 0"><p style="margin:0;font-family:${FONT};font-size:14px;line-height:1.6;color:${C.fg};padding-left:14px;border-left:2px solid ${C.primary}">${esc(note)}</p></td></tr>` : ""}
    <tr><td style="padding:20px 32px 8px">
      ${bankTransferBlock({ reference, amount: gbpFull(amount) })}
    </td></tr>
    ${url ? `<tr><td style="padding:14px 32px 6px">${button(url, "View the invoice →", false)}</td></tr>` : ""}
    <tr><td style="padding:0 32px 8px">
      <p style="margin:8px 0 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.faint}">${
        url ? "The link opens the invoice document to view or download. " : "The invoice document follows from our accounts system. "
      }Invoiced monthly by agreement, instead of a Direct Debit. Reply if anything looks wrong — a real person reads these.</p>
    </td></tr>`;
  const html = wrap(inner, `${planLabel} care plan — ${periodLabel}: ${gbpFull(amount)} due ${dueOn}. Pay by bank transfer quoting ${reference}.`);
  const text = `Hi ${first},

Here is this month's invoice for your ${planLabel} care plan.

Amount: ${gbpFull(amount)}
Period: ${periodLabel}
Due: ${dueOn}
Reference: ${reference}
${note ? `\n${note}\n` : ""}
Pay by bank transfer:
${bankTransferText({ reference, amount: gbpFull(amount) })}
${url ? `\nView the invoice document:\n${url}\n` : ""}
Invoiced monthly by agreement, instead of a Direct Debit. Reply if anything looks wrong.

— Nullshift`;
  return { subject, html, text };
}

/** Overdue chaser: three steps, each a little firmer, then staff take over. */
export function carePlanInvoiceReminderEmail(opts: {
  name: string;
  planLabel: string;
  periodLabel: string;
  amount: number;
  dueOn: string;
  daysOverdue: number;
  reference: string;
  url: string | null;
  tone: "nudge" | "check" | "final";
}): { subject: string; html: string; text: string } {
  const { name, planLabel, periodLabel, amount, dueOn, daysOverdue, reference, url, tone } = opts;
  const first = name.split(" ")[0] || name || "there";
  const subject =
    tone === "nudge"
      ? `A gentle reminder: ${planLabel} care plan invoice — ${periodLabel}`
      : tone === "final"
        ? `Final reminder: ${planLabel} care plan invoice — ${periodLabel}`
        : `Still open: ${planLabel} care plan invoice — ${periodLabel}`;
  const heading =
    tone === "nudge" ? "Did this one slip past?" : tone === "final" ? "One last nudge from us" : "Still open";
  const opening =
    tone === "nudge"
      ? `the ${planLabel} care plan invoice for ${periodLabel} (${gbpFull(amount)}) was due on ${dueOn} and we have not seen it yet. No problem if it is already on its way.`
      : tone === "final"
        ? `the ${planLabel} care plan invoice for ${periodLabel} (${gbpFull(amount)}) is now ${daysOverdue} days past its due date of ${dueOn}. This is the last automatic reminder — after this one of us will get in touch directly.`
        : `the ${planLabel} care plan invoice for ${periodLabel} (${gbpFull(amount)}) is ${daysOverdue} days past its due date of ${dueOn}. Could you check it has gone through?`;
  const inner = `
    <tr><td style="padding:22px 32px 0">
      <p style="margin:0 0 10px;font-family:${FONT};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${C.primary}">Care plan invoice · ${esc(reference)}</p>
      <h1 style="margin:0;font-family:${FONT};font-weight:700;font-size:26px;line-height:1.18;letter-spacing:-0.02em;color:${C.fg}">${esc(heading)}</h1>
      <p style="margin:14px 0 0;font-family:${FONT};font-size:15px;line-height:1.65;color:${C.muted}">Hi ${esc(first)}, ${esc(opening)}</p>
    </td></tr>
    <tr><td style="padding:20px 32px 8px">
      ${bankTransferBlock({ reference, amount: gbpFull(amount) })}
    </td></tr>
    ${url ? `<tr><td style="padding:14px 32px 6px">${button(url, "View the invoice →", false)}</td></tr>` : ""}
    <tr><td style="padding:0 32px 8px">
      <p style="margin:8px 0 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.faint}">If you have paid already, or something is wrong with the invoice, just reply and we will sort it.</p>
    </td></tr>`;
  const html = wrap(inner, `${planLabel} care plan — ${periodLabel}: ${gbpFull(amount)} was due ${dueOn}.`);
  const text = `Hi ${first},

${opening}

Pay by bank transfer:
${bankTransferText({ reference, amount: gbpFull(amount) })}
${url ? `\nView the invoice document:\n${url}\n` : ""}
If you have paid already, or something is wrong with the invoice, just reply and we will sort it.

— Nullshift`;
  return { subject, html, text };
}

/* ── E-signature (signature_requests, migration 0068) ─────────────────────── */

const SIGN_FOOT = `This link is personal to you and expires. If it has run out, reply to this email and we will send a fresh one. Nothing is agreed until you sign, and you can decline from the same page.`;

/**
 * "Please sign": the one email a signer needs. Links to the signing page,
 * never attaches the document — the page is the document, frozen and hashed,
 * and an attachment would be a second copy that could drift from it.
 */
export function signatureRequestEmail(opts: {
  name: string;
  title: string;
  reference: string;
  clientName: string;
  url: string;
  expiresOn: string;
  /** One or two sentences from staff, shown above the button. Optional. */
  message?: string | null;
  totalLabel?: string | null;
}): { subject: string; html: string; text: string } {
  const { name, title, reference, clientName, url, expiresOn, message, totalLabel } = opts;
  const first = name.split(" ")[0] || name || "there";
  const subject = `Please sign: ${title} (${reference})`;
  const inner = `
    <tr><td style="padding:22px 32px 0">
      <p style="margin:0 0 10px;font-family:${FONT};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${C.primary}">For signature · ${esc(reference)}</p>
      <h1 style="margin:0;font-family:${FONT};font-weight:700;font-size:26px;line-height:1.18;letter-spacing:-0.02em;color:${C.fg}">${esc(title)}</h1>
      <p style="margin:14px 0 0;font-family:${FONT};font-size:15px;line-height:1.65;color:${C.muted}">Hi ${esc(first)}, Nullshift has sent ${esc(clientName)} a document to sign. Please read it through on the signing page and, if you are happy, sign it there — it takes a minute, and you will get a signed copy by email once we have countersigned.</p>
      ${message ? `<p style="margin:12px 0 0;font-family:${FONT};font-size:15px;line-height:1.65;color:${C.fg};padding-left:14px;border-left:2px solid ${C.primary}">${esc(message)}</p>` : ""}
      ${totalLabel ? `<p style="margin:12px 0 0;font-family:${FONT};font-size:14px;color:${C.muted}">${esc(totalLabel)}</p>` : ""}
    </td></tr>
    <tr><td style="padding:22px 32px 6px">${button(url, "Review & sign →")}</td></tr>
    <tr><td style="padding:0 32px 8px">
      <p style="margin:8px 0 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.faint}">The link expires on ${esc(expiresOn)}. ${SIGN_FOOT}</p>
    </td></tr>`;
  const html = wrap(inner, `${title} — ready for your signature.`);
  const text = `Hi ${first},

Nullshift has sent ${clientName} a document to sign: ${title} (${reference}).
${message ? `\n${message}\n` : ""}${totalLabel ? `\n${totalLabel}\n` : ""}
Read and sign it here:
${url}

The link expires on ${expiresOn}. ${SIGN_FOOT}

— Nullshift`;
  return { subject, html, text };
}

/** To the signer, the moment they sign: what happens next, and where their copy is. */
export function signatureSignedClientEmail(opts: {
  name: string;
  title: string;
  reference: string;
  signedAt: string;
  certificateUrl: string;
}): { subject: string; html: string; text: string } {
  const { name, title, reference, signedAt, certificateUrl } = opts;
  const first = name.split(" ")[0] || name || "there";
  const subject = `Signed: ${title} (${reference})`;
  const inner = `
    <tr><td style="padding:22px 32px 0">
      <p style="margin:0 0 10px;font-family:${FONT};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${C.primary}">Signature recorded · ${esc(reference)}</p>
      <h1 style="margin:0;font-family:${FONT};font-weight:700;font-size:26px;line-height:1.18;letter-spacing:-0.02em;color:${C.fg}">Thank you — that's signed</h1>
      <p style="margin:14px 0 0;font-family:${FONT};font-size:15px;line-height:1.65;color:${C.muted}">Hi ${esc(first)}, we recorded your signature on <strong style="color:${C.fg}">${esc(title)}</strong> at ${esc(signedAt)}. Nullshift will countersign shortly, and you will receive the completed copy with both signatures and the full signing record.</p>
    </td></tr>
    <tr><td style="padding:22px 32px 6px">${button(certificateUrl, "Download your signed copy (PDF) ↓", false)}</td></tr>
    <tr><td style="padding:0 32px 8px">
      <p style="margin:8px 0 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.faint}">The PDF carries the document exactly as you signed it, its SHA-256 fingerprint, and the time-stamped record of each step. Keep it with your records.</p>
    </td></tr>`;
  const html = wrap(inner, `Your signature on ${title} has been recorded.`);
  const text = `Hi ${first},

We recorded your signature on ${title} (${reference}) at ${signedAt}. Nullshift will countersign shortly and you will receive the completed copy with both signatures and the signing record.

Your signed copy (PDF):
${certificateUrl}

— Nullshift`;
  return { subject, html, text };
}

/** To both parties when Nullshift countersigns: the completed document. */
export function signatureCompletedEmail(opts: {
  name: string;
  title: string;
  reference: string;
  signedBy: string;
  signedAt: string;
  countersignedBy: string;
  countersignedAt: string;
  certificateUrl: string;
}): { subject: string; html: string; text: string } {
  const { name, title, reference, signedBy, signedAt, countersignedBy, countersignedAt, certificateUrl } = opts;
  const first = name.split(" ")[0] || name || "there";
  const subject = `Completed: ${title} (${reference})`;
  const inner = `
    <tr><td style="padding:22px 32px 0">
      <p style="margin:0 0 10px;font-family:${FONT};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${C.primary}">Completed · ${esc(reference)}</p>
      <h1 style="margin:0;font-family:${FONT};font-weight:700;font-size:26px;line-height:1.18;letter-spacing:-0.02em;color:${C.fg}">${esc(title)}</h1>
      <p style="margin:14px 0 0;font-family:${FONT};font-size:15px;line-height:1.65;color:${C.muted}">Hi ${esc(first)}, this document is now signed by both parties and is in force.</p>
    </td></tr>
    <tr><td style="padding:16px 32px 0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${C.surface2};border:1px solid ${C.border}">
        <tr><td style="padding:10px 14px;font-family:${FONT};font-size:13px;color:${C.muted}">Signed by</td><td style="padding:10px 14px;font-family:${FONT};font-size:13px;color:${C.fg}">${esc(signedBy)} · ${esc(signedAt)}</td></tr>
        <tr><td style="padding:10px 14px;font-family:${FONT};font-size:13px;color:${C.muted};border-top:1px solid ${C.border}">Countersigned by</td><td style="padding:10px 14px;font-family:${FONT};font-size:13px;color:${C.fg};border-top:1px solid ${C.border}">${esc(countersignedBy)} · ${esc(countersignedAt)}</td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:22px 32px 6px">${button(certificateUrl, "Download the completed copy (PDF) ↓")}</td></tr>
    <tr><td style="padding:0 32px 8px">
      <p style="margin:8px 0 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.faint}">The PDF carries the document exactly as signed, its SHA-256 fingerprint, both signatures and the time-stamped signing record. Keep it with your records.</p>
    </td></tr>`;
  const html = wrap(inner, `${title} is signed by both parties.`);
  const text = `Hi ${first},

${title} (${reference}) is now signed by both parties and is in force.

Signed by: ${signedBy} · ${signedAt}
Countersigned by: ${countersignedBy} · ${countersignedAt}

Completed copy (PDF):
${certificateUrl}

— Nullshift`;
  return { subject, html, text };
}

/** To the signer when Nullshift withdraws a document before it is completed. */
export function signatureVoidedEmail(opts: {
  name: string;
  title: string;
  reference: string;
  reason: string | null;
}): { subject: string; html: string; text: string } {
  const { name, title, reference, reason } = opts;
  const first = name.split(" ")[0] || name || "there";
  const subject = `Withdrawn: ${title} (${reference})`;
  const inner = `
    <tr><td style="padding:22px 32px 0">
      <p style="margin:0 0 10px;font-family:${FONT};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${C.muted}">Withdrawn · ${esc(reference)}</p>
      <h1 style="margin:0;font-family:${FONT};font-weight:700;font-size:26px;line-height:1.18;letter-spacing:-0.02em;color:${C.fg}">${esc(title)}</h1>
      <p style="margin:14px 0 0;font-family:${FONT};font-size:15px;line-height:1.65;color:${C.muted}">Hi ${esc(first)}, Nullshift has withdrawn this document, so the signing link no longer works and nothing is agreed under it.${reason ? ` ${esc(reason)}` : ""} If a revised version is needed we will send a new one.</p>
    </td></tr>`;
  const html = wrap(inner, `${title} has been withdrawn.`);
  const text = `Hi ${first},

Nullshift has withdrawn ${title} (${reference}). The signing link no longer works and nothing is agreed under it.${reason ? ` ${reason}` : ""} If a revised version is needed we will send a new one.

— Nullshift`;
  return { subject, html, text };
}

/** Internal notice: a client signed or declined. Plain, to the legal inbox. */
export function signatureStaffNoticeEmail(opts: {
  title: string;
  reference: string;
  clientName: string;
  signerName: string;
  what: "signed" | "declined";
  detail: string | null;
  adminUrl: string;
}): { subject: string; html: string; text: string } {
  const { title, reference, clientName, signerName, what, detail, adminUrl } = opts;
  const subject = `${what === "signed" ? "Signed" : "Declined"}: ${clientName} — ${title} (${reference})`;
  const lead =
    what === "signed"
      ? `${signerName} has signed on behalf of ${clientName}. Countersign it to complete.`
      : `${signerName} has declined on behalf of ${clientName}.`;
  const inner = `
    <tr><td style="padding:22px 32px 0">
      <p style="margin:0 0 10px;font-family:${FONT};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${what === "signed" ? C.primary : C.muted}">${esc(reference)} · ${what}</p>
      <h1 style="margin:0;font-family:${FONT};font-weight:700;font-size:22px;line-height:1.2;color:${C.fg}">${esc(title)}</h1>
      <p style="margin:14px 0 0;font-family:${FONT};font-size:15px;line-height:1.65;color:${C.muted}">${esc(lead)}</p>
      ${detail ? `<p style="margin:10px 0 0;font-family:${FONT};font-size:14px;line-height:1.6;color:${C.fg};padding-left:14px;border-left:2px solid ${C.border}">${esc(detail)}</p>` : ""}
    </td></tr>
    <tr><td style="padding:22px 32px 6px">${button(adminUrl, what === "signed" ? "Open & countersign →" : "Open in admin →", false)}</td></tr>`;
  const html = wrap(inner, lead);
  const text = `${lead}\n${detail ? `\n${detail}\n` : ""}\n${adminUrl}\n`;
  return { subject, html, text };
}
