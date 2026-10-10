import type { PartnerPlan } from "@nullshift/agents/partnerPlan";
import { C, FONT, esc, wrap, button } from "@/lib/emailLayout";
import type { EmbedBrand, PlanLeadRow } from "./data";

export function planReadyEmail(o: {
  brand: EmbedBrand;
  lead: PlanLeadRow;
  planUrl: string;
}) {
  const subject = `Your systems plan from ${o.brand.name}`;
  const inner = `<tr><td style="padding:22px 32px 28px">
    <p style="margin:0 0 6px;font-family:${FONT};font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:${C.primary}">${esc(o.brand.name)}</p>
    <h1 style="margin:0 0 14px;font-family:${FONT};font-size:22px;line-height:1.3;color:${C.fg}">Thanks ${esc(o.lead.name)} — your plan for ${esc(o.lead.business_name)} is ready</h1>
    <p style="margin:0 0 18px;font-family:${FONT};font-size:15px;line-height:1.6;color:${C.muted}">Three priorities, a handful of quick wins and a 90-day roadmap, written for your answers. The link is private to you.</p>
    ${button(o.planUrl, "Read your plan")}</td></tr>`;
  return {
    subject,
    html: wrap(inner, subject, `Sent by ${esc(o.brand.name)}.`),
    text: `${subject}\n${o.planUrl}`,
  };
}

export function planNotificationEmail(o: {
  brand: EmbedBrand;
  lead: PlanLeadRow;
  plan: PartnerPlan;
  dashboardUrl: string;
}) {
  const subject = `New plan lead: ${o.lead.name} at ${o.lead.business_name}`;
  const a = o.lead.answers;
  const rows: [string, string][] = [
    ["Name", o.lead.name],
    ["Email", o.lead.email],
    ...(o.lead.phone ? [["Phone", o.lead.phone] as [string, string]] : []),
    ["Business", `${a.businessName} · ${a.sector} · ${a.teamSize}`],
    ["Bottleneck", `${a.bottleneck}: ${a.bottleneckDetail}`],
    ["Tools", a.tools],
    ["90-day goal", a.goal],
    ["Budget", a.budget],
    ["Plan headline", o.plan.headline],
    ["Recommended", o.plan.recommendedServices.map((s) => s.service).join(", ") || "—"],
  ];
  const table = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 0;font-family:${FONT};font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:${C.muted};vertical-align:top;width:34%">${esc(k)}</td><td style="padding:8px 0;font-family:${FONT};font-size:14px;color:${C.fg}">${esc(v)}</td></tr>`
    )
    .join("");
  const inner = `<tr><td style="padding:22px 32px 28px">
    <p style="margin:0 0 6px;font-family:${FONT};font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:${C.primary}">New lead · ${esc(o.brand.name)}</p>
    <h1 style="margin:0 0 14px;font-family:${FONT};font-size:22px;line-height:1.3;color:${C.fg}">${esc(o.lead.name)} asked for a plan</h1>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${C.border}">${table}</table>
    <div style="margin-top:18px">${button(o.dashboardUrl, "Open lead and plan")} &nbsp; ${button(`mailto:${o.lead.email}`, "Reply", false)}</div></td></tr>`;
  return {
    subject,
    html: wrap(inner, subject, "Sent by Nullshift Plans."),
    text: rows.map(([k, v]) => `${k}: ${v}`).join("\n"),
  };
}
