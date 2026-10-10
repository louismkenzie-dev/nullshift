import { C, FONT, esc, wrap, button } from "@/lib/emailLayout";
import type { Brand, ClientRow, InvoiceRow, ProposalRow } from "./data";
import { gbp } from "./money";

const eyebrow = (t: string) =>
  `<p style="margin:0 0 6px;font-family:${FONT};font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:${C.primary}">${esc(t)}</p>`;
const h1 = (t: string) =>
  `<h1 style="margin:0 0 14px;font-family:${FONT};font-size:22px;line-height:1.3;color:${C.fg}">${esc(t)}</h1>`;
const p = (t: string) =>
  `<p style="margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:1.6;color:${C.muted}">${t}</p>`;

export function proposalSentEmail(o: {
  brand: Brand;
  client: ClientRow;
  proposal: ProposalRow;
  url: string;
  total: number;
}) {
  const subject = `${o.brand.name}: proposal ${o.proposal.number} — ${o.proposal.title}`;
  const inner = `<tr><td style="padding:22px 32px 28px">${eyebrow(o.brand.name)}${h1(`Hi ${o.client.name.split(" ")[0]}, your proposal is ready`)}${p(`${esc(o.proposal.title)} comes to <strong style="color:${C.fg}">${esc(gbp(o.total))}</strong>${o.proposal.valid_until ? ` and is valid until ${esc(new Date(o.proposal.valid_until).toLocaleDateString("en-GB", { day: "numeric", month: "long" }))}` : ""}. Open the link to read the scope and accept online.`)}${button(o.url, "Read and accept")}</td></tr>`;
  return {
    subject,
    html: wrap(
      inner,
      subject,
      `Sent by ${esc(o.brand.name)}. Reply to this email to reach them.`
    ),
    text: `${subject}\n${o.url}`,
  };
}

export function proposalAcceptedEmail(o: {
  brand: Brand;
  client: ClientRow;
  proposal: ProposalRow;
  acceptedName: string;
  dashboardUrl: string;
}) {
  const subject = `Accepted: ${o.proposal.number} — ${o.client.company || o.client.name}`;
  const inner = `<tr><td style="padding:22px 32px 28px">${eyebrow("Proposal accepted")}${h1(`${esc(o.acceptedName)} accepted ${esc(o.proposal.title)}`)}${p(`${esc(o.client.company || o.client.name)} accepted ${esc(o.proposal.number)} just now. The exact content has been frozen with a hash. Next: raise the deposit invoice.`)}${button(o.dashboardUrl, "Open proposal")}</td></tr>`;
  const clientInner = `<tr><td style="padding:22px 32px 28px">${eyebrow(o.brand.name)}${h1(`Thanks — ${esc(o.proposal.number)} is accepted`)}${p(`You accepted ${esc(o.proposal.title)} as ${esc(o.acceptedName)}. Keep this email as your record; the proposal stays available at your private link.`)}</td></tr>`;
  return {
    subject,
    html: wrap(inner, subject, "Sent by Nullshift Studio."),
    text: subject,
    clientHtml: wrap(clientInner, subject, `Sent by ${esc(o.brand.name)}.`),
  };
}

export function invoiceSentEmail(o: {
  brand: Brand;
  client: ClientRow;
  invoice: InvoiceRow;
  url: string;
  total: number;
}) {
  const subject = `${o.brand.name}: invoice ${o.invoice.number} for ${gbp(o.total)}`;
  const inner = `<tr><td style="padding:22px 32px 28px">${eyebrow(o.brand.name)}${h1(`Invoice ${esc(o.invoice.number)}`)}${p(`<strong style="color:${C.fg}">${esc(gbp(o.total))}</strong>${o.invoice.due_on ? ` due by ${esc(new Date(o.invoice.due_on).toLocaleDateString("en-GB", { day: "numeric", month: "long" }))}` : ""}. Payment details are on the invoice.`)}${button(o.url, "View invoice")}</td></tr>`;
  return {
    subject,
    html: wrap(
      inner,
      subject,
      `Sent by ${esc(o.brand.name)}. Reply to this email to reach them.`
    ),
    text: `${subject}\n${o.url}`,
  };
}
