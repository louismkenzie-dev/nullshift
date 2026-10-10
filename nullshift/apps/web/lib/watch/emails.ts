import { C, FONT, esc, wrap, button } from "@/lib/emailLayout";
import type { BrokenLink } from "./checks";

const p = (t: string, color = C.muted) =>
  `<p style="margin:0 0 12px;font-family:${FONT};font-size:15px;line-height:1.6;color:${color}">${t}</p>`;
const h1 = (t: string) =>
  `<h1 style="margin:0 0 14px;font-family:${FONT};font-size:22px;line-height:1.3;color:${C.fg}">${esc(t)}</h1>`;
const eyebrow = (t: string) =>
  `<p style="margin:0 0 6px;font-family:${FONT};font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:${C.primary}">${esc(t)}</p>`;
const FOOT =
  "Sent by Nullshift Watch. Alerts go to the address set on the site in your dashboard.";

export function downEmail(o: {
  label: string;
  url: string;
  status: number | null;
  error?: string;
  dashboardUrl: string;
}) {
  const subject = `${o.label} is down`;
  const inner = `<tr><td style="padding:22px 32px 28px">${eyebrow("Downtime alert")}${h1(`${o.label} is not responding`)}${p(`Two checks in a row failed for <a href="${esc(o.url)}" style="color:${C.fg}">${esc(o.url)}</a>${o.status ? ` (HTTP ${o.status})` : o.error ? ` (${esc(o.error)})` : ""}. We will email again when it recovers.`)}${button(o.dashboardUrl, "Open dashboard")}</td></tr>`;
  return {
    subject,
    html: wrap(inner, subject, FOOT),
    text: `${subject}\n${o.url}\n${o.error ?? ""}`,
  };
}

export function recoveredEmail(o: {
  label: string;
  url: string;
  downForMinutes: number;
  dashboardUrl: string;
}) {
  const subject = `${o.label} is back up`;
  const inner = `<tr><td style="padding:22px 32px 28px">${eyebrow("Recovered")}${h1(`${o.label} is responding again`)}${p(`${esc(o.url)} was down for about ${o.downForMinutes} minute${o.downForMinutes === 1 ? "" : "s"}.`)}${button(o.dashboardUrl, "Open dashboard", false)}</td></tr>`;
  return { subject, html: wrap(inner, subject, FOOT), text: `${subject}\n${o.url}` };
}

export function sslEmail(o: {
  label: string;
  url: string;
  daysLeft: number;
  expiresAt: string;
  dashboardUrl: string;
}) {
  const subject = `${o.label}: SSL certificate expires in ${o.daysLeft} day${o.daysLeft === 1 ? "" : "s"}`;
  const inner = `<tr><td style="padding:22px 32px 28px">${eyebrow("Certificate expiry")}${h1(subject)}${p(`The certificate for ${esc(o.url)} expires on ${esc(new Date(o.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }))}. Most hosts renew automatically; if yours does not, renew it before then or visitors will see a security warning.`)}${button(o.dashboardUrl, "Open dashboard", false)}</td></tr>`;
  return { subject, html: wrap(inner, subject, FOOT), text: subject };
}

export type ReportInput = {
  label: string;
  url: string;
  from: string;
  to: string;
  uptimePct: number | null;
  incidents: number;
  avgMs: number | null;
  speedMobile: number | null;
  speedDesktop: number | null;
  sslDaysLeft: number | null;
  brokenLinks: BrokenLink[];
  linksChecked: number;
  senderName: string;
};

export function plainEnglishVerdict(r: ReportInput): string {
  const bits: string[] = [];
  if (r.uptimePct === null)
    bits.push("We have not been watching long enough for an uptime figure yet.");
  else if (r.uptimePct >= 99.9) bits.push("The site stayed online all month.");
  else if (r.uptimePct >= 99)
    bits.push(
      `The site was online ${r.uptimePct}% of the time with ${r.incidents} short outage${r.incidents === 1 ? "" : "s"}.`
    );
  else
    bits.push(
      `The site had ${r.incidents} outage${r.incidents === 1 ? "" : "s"} and was online ${r.uptimePct}% of the time — worth raising with your host.`
    );
  if (r.speedMobile !== null)
    bits.push(
      r.speedMobile >= 90
        ? "Mobile speed is excellent."
        : r.speedMobile >= 50
          ? "Mobile speed is acceptable; there is room to improve."
          : "Mobile speed is poor and likely costing visitors."
    );
  if (r.brokenLinks.length)
    bits.push(
      `${r.brokenLinks.length} broken link${r.brokenLinks.length === 1 ? "" : "s"} need${r.brokenLinks.length === 1 ? "s" : ""} fixing.`
    );
  else if (r.linksChecked) bits.push("No broken links found.");
  if (r.sslDaysLeft !== null && r.sslDaysLeft < 30)
    bits.push(`The SSL certificate expires in ${r.sslDaysLeft} days.`);
  return bits.join(" ");
}

export function monthlyReportEmail(r: ReportInput, dashboardUrl: string) {
  const subject = `${r.label} — website report, ${r.from} to ${r.to}`;
  const stat = (v: string, l: string) =>
    `<td style="padding:14px 12px;border:1px solid ${C.border};vertical-align:top"><div style="font-family:${FONT};font-size:24px;font-weight:700;color:${C.fg}">${esc(v)}</div><div style="font-family:${FONT};font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:${C.muted};margin-top:4px">${esc(l)}</div></td>`;
  const broken = r.brokenLinks.length
    ? `<p style="margin:18px 0 6px;font-family:${FONT};font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:${C.muted}">Broken links</p><ul style="margin:0;padding-left:18px;font-family:${FONT};font-size:13px;line-height:1.7;color:${C.muted}">${r.brokenLinks
        .slice(0, 15)
        .map((b) => `<li>${esc(b.href)} — ${b.status ?? esc(b.error ?? "failed")}</li>`)
        .join("")}</ul>`
    : "";
  const inner = `<tr><td style="padding:22px 32px 28px">${eyebrow(`Monthly report · ${esc(r.senderName)}`)}${h1(`${r.label}`)}${p(esc(plainEnglishVerdict(r)), C.fg)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-top:10px"><tr>
      ${stat(r.uptimePct === null ? "—" : `${r.uptimePct}%`, "Uptime")}${stat(r.avgMs === null ? "—" : `${(r.avgMs / 1000).toFixed(1)}s`, "Avg response")}${stat(r.speedMobile === null ? "—" : String(r.speedMobile), "Mobile speed /100")}${stat(r.speedDesktop === null ? "—" : String(r.speedDesktop), "Desktop speed /100")}
    </tr></table>
    ${p(`${r.incidents} outage${r.incidents === 1 ? "" : "s"} · ${r.linksChecked} links checked · SSL ${r.sslDaysLeft === null ? "not checked" : `valid for ${r.sslDaysLeft} days`}`)}
    ${broken}
    <div style="margin-top:20px">${button(dashboardUrl, "Full history", false)}</div></td></tr>`;
  return {
    subject,
    html: wrap(inner, subject, `Prepared by ${esc(r.senderName)} with Nullshift Watch.`),
    text: `${subject}\n\n${plainEnglishVerdict(r)}`,
  };
}
