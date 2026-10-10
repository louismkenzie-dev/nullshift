/**
 * Partner application emails (pure builders → { subject, html, text }).
 *   • partnerApplicationOwnerEmail — the internal heads-up with every answer.
 *   • partnerApplicationReceiptEmail — the applicant's acknowledgement. Says
 *     plainly that this is an application, not an acceptance: every partner
 *     and every client goes through the acceptance review first.
 */
import { C, FONT, esc, wrap } from "./emailLayout";
import { partnerApplicationLabels, type PartnerApplication } from "./partnerApplication";

const row = (k: string, v: string) =>
  `<tr><td style="padding:8px 0;border-bottom:1px solid ${C.border};font-family:${FONT};font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:${C.faint};vertical-align:top;width:160px">${esc(k)}</td><td style="padding:8px 0 8px 12px;border-bottom:1px solid ${C.border};font-family:${FONT};font-size:14px;line-height:1.6;color:${C.fg};white-space:pre-wrap">${esc(v)}</td></tr>`;

export function partnerApplicationSummary(data: PartnerApplication): [string, string][] {
  const labels = partnerApplicationLabels(data);
  return [
    ["Agency", data.agencyName],
    ["Website", data.website || "Not supplied"],
    ["Country", data.country],
    ["Contact", data.contactName + (data.role ? ` — ${data.role}` : "")],
    ["Email", data.email],
    ["Agency type", labels.agencyType],
    ["Team size", labels.teamSize],
    ["Model", labels.modelInterest],
    ["Typical clients", data.clientTypes || "Not supplied"],
    ["Message", data.message || "Not supplied"],
  ];
}

export function partnerApplicationOwnerEmail(data: PartnerApplication) {
  const summary = partnerApplicationSummary(data);
  const subject = `Partner application — ${data.agencyName}`;
  const inner = `
    <tr><td style="padding:22px 32px 0">
      <p style="margin:0 0 10px;font-family:${FONT};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${C.primary}">Partner programme</p>
      <h1 style="margin:0;font-family:${FONT};font-weight:700;font-size:24px;line-height:1.2;letter-spacing:-0.02em;color:${C.fg}">${esc(data.agencyName)} has applied</h1>
      <p style="margin:12px 0 0;font-family:${FONT};font-size:14px;line-height:1.6;color:${C.muted}">Reply to this email to go straight back to ${esc(data.contactName)}. Nothing has been promised — the application is subject to acceptance review.</p>
    </td></tr>
    <tr><td style="padding:18px 32px 24px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${summary
      .map(([k, v]) => row(k, v))
      .join("")}</table></td></tr>`;
  const html = wrap(inner, `${data.agencyName} applied to the partner programme.`);
  const text = `Partner application\n\n${summary.map(([k, v]) => `${k}: ${v}`).join("\n")}`;
  return { subject, html, text };
}

export function partnerApplicationReceiptEmail(data: PartnerApplication) {
  const first = data.contactName.split(" ")[0] || "there";
  const subject = "We’ve received your partner application";
  const inner = `
    <tr><td style="padding:22px 32px 0">
      <p style="margin:0 0 10px;font-family:${FONT};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${C.primary}">Partner programme</p>
      <h1 style="margin:0;font-family:${FONT};font-weight:700;font-size:26px;line-height:1.18;letter-spacing:-0.02em;color:${C.fg}">Your application is with us</h1>
      <p style="margin:14px 0 0;font-family:${FONT};font-size:15px;line-height:1.65;color:${C.muted}">Hi ${esc(first)}, thanks for applying on behalf of ${esc(data.agencyName)}. We read every application ourselves and will reply within two working days with next steps, which usually means a short call.</p>
      <p style="margin:14px 0 0;font-family:${FONT};font-size:15px;line-height:1.65;color:${C.muted}">Every partnership, and every client introduced through one, goes through our acceptance review before anything is agreed. This email confirms receipt only.</p>
    </td></tr>
    <tr><td style="padding:18px 32px 24px">
      <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.faint}">No account has been created and you have not been subscribed to marketing emails. Reply to this message if anything in your application has changed.</p>
    </td></tr>`;
  const html = wrap(inner, "Thanks for applying to the Nullshift partner programme.");
  const text = `Hi ${first},

Thanks for applying to the Nullshift partner programme on behalf of ${data.agencyName}. We read every application ourselves and will reply within two working days with next steps, which usually means a short call.

Every partnership, and every client introduced through one, goes through our acceptance review before anything is agreed. This email confirms receipt only.

No account has been created and you have not been subscribed to marketing emails.

— Nullshift`;
  return { subject, html, text };
}
