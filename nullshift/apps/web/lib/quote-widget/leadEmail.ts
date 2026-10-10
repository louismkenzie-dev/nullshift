import { C, FONT, esc, wrap, button } from "@/lib/emailLayout";
import { gbp, type Estimate } from "./engine";

export function leadNotificationEmail(opts: {
  businessName: string;
  lead: {
    name: string;
    email: string;
    phone?: string | null;
    postcode?: string | null;
    message?: string | null;
  };
  estimate: Estimate;
  sourceUrl?: string | null;
  dashboardUrl: string;
}): { subject: string; html: string; text: string } {
  const { lead, estimate: e } = opts;
  const range = `${gbp(e.lowPence)} – ${gbp(e.highPence)}`;
  const subject = `New quote lead: ${lead.name} · ${e.service.name} · ${range}`;
  const rows = [
    ["Name", lead.name],
    ["Email", lead.email],
    lead.phone ? ["Phone", lead.phone] : null,
    lead.postcode ? ["Postcode", lead.postcode] : null,
    [
      "Job",
      e.service.mode === "per_unit"
        ? `${e.service.name} × ${e.quantity}`
        : e.service.name,
    ],
    ...e.answerSummary.map((a) => [a.question, a.answer] as [string, string]),
    ["Guide price shown", `${range}${e.includesVat ? " inc VAT" : ""}`],
    lead.message ? ["Message", lead.message] : null,
    opts.sourceUrl ? ["From page", opts.sourceUrl] : null,
  ].filter(Boolean) as [string, string][];

  const table = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 0;font-family:${FONT};font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:${C.muted};vertical-align:top;width:40%">${esc(k)}</td><td style="padding:8px 0;font-family:${FONT};font-size:14px;color:${C.fg}">${esc(v)}</td></tr>`
    )
    .join("");

  const inner = `
    <tr><td style="padding:22px 32px 0">
      <p style="margin:0 0 6px;font-family:${FONT};font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:${C.primary}">New lead · ${esc(opts.businessName)}</p>
      <h1 style="margin:0 0 14px;font-family:${FONT};font-size:22px;line-height:1.3;color:${C.fg}">${esc(lead.name)} wants a price for ${esc(e.service.name)}</h1>
      <p style="margin:0 0 18px;font-family:${FONT};font-size:15px;line-height:1.6;color:${C.muted}">They were shown <strong style="color:${C.fg}">${esc(range)}</strong>. Reply within the hour and you will usually win it.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${C.border}">${table}</table>
    </td></tr>
    <tr><td style="padding:22px 32px 28px">${button(`mailto:${lead.email}?subject=${encodeURIComponent(`Your quote for ${e.service.name}`)}`, "Reply to " + lead.name)} &nbsp; ${button(opts.dashboardUrl, "Open dashboard", false)}</td></tr>`;

  const text = rows.map(([k, v]) => `${k}: ${v}`).join("\n");
  return {
    subject,
    html: wrap(
      inner,
      subject,
      "Sent by Nullshift Quote on behalf of your website's quote widget."
    ),
    text,
  };
}

export function leadConfirmationEmail(opts: {
  businessName: string;
  lead: { name: string };
  estimate: Estimate;
  disclaimer: string;
}): { subject: string; html: string; text: string } {
  const e = opts.estimate;
  const range = `${gbp(e.lowPence)} – ${gbp(e.highPence)}`;
  const subject = `Your guide price from ${opts.businessName}: ${range}`;
  const inner = `
    <tr><td style="padding:22px 32px 28px">
      <p style="margin:0 0 6px;font-family:${FONT};font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:${C.primary}">${esc(opts.businessName)}</p>
      <h1 style="margin:0 0 14px;font-family:${FONT};font-size:22px;line-height:1.3;color:${C.fg}">Thanks ${esc(opts.lead.name)} — here is your guide price</h1>
      <p style="margin:0 0 10px;font-family:${FONT};font-size:28px;font-weight:700;color:${C.fg}">${esc(range)}${e.includesVat ? ` <span style="font-size:13px;color:${C.muted};font-weight:400">inc VAT</span>` : ""}</p>
      <p style="margin:0 0 16px;font-family:${FONT};font-size:14px;color:${C.muted}">${esc(e.service.mode === "per_unit" ? `${e.service.name} × ${e.quantity}` : e.service.name)}${e.answerSummary.length ? " · " + esc(e.answerSummary.map((a) => a.answer).join(", ")) : ""}</p>
      <p style="margin:0;font-family:${FONT};font-size:13px;line-height:1.6;color:${C.faint}">${esc(opts.disclaimer)} ${esc(opts.businessName)} will be in touch shortly.</p>
    </td></tr>`;
  return {
    subject,
    html: wrap(
      inner,
      subject,
      `Sent on behalf of ${esc(opts.businessName)} via Nullshift Quote.`
    ),
    text: `${subject}\n\n${opts.disclaimer}`,
  };
}
