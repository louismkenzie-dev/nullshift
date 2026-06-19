/** Branded HTML emails for the /start funnel — built with inline styles +
 *  table layout for broad email-client support. Two emails:
 *   • clientEmail — a beautiful, lead-generating email to the visitor, tailored
 *     to their answers, with their free resource and a clear next step.
 *   • ownerEmail — a branded new-lead notification to Nullshift.
 *  Pure functions: pass data + URLs in, get { subject, html, text } out.
 */

import {
  answeredSummary,
  resourceName,
  type Answers,
  type Recommendation,
  type Segment,
} from "@/lib/funnel";
import type { Blueprint } from "@nullshift/content/blueprint";

const gbp = (n: number) => "£" + Math.round(n).toLocaleString("en-GB");

/* ── Brand palette (Halo / Nullshift) ── */
const C = {
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
const FONT = "'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif";

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Brand wordmark (text-based so it renders without hosted images). */
function logo(): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td style="padding-right:8px;vertical-align:middle">
      <span style="display:inline-block;width:9px;height:22px;background:#d6d6d6;border-radius:3px;vertical-align:middle"></span><span style="display:inline-block;width:9px;height:22px;background:${C.primary};border-radius:3px;margin-left:3px;vertical-align:middle"></span>
    </td>
    <td style="vertical-align:middle"><span style="font-family:${FONT};font-weight:800;font-size:16px;letter-spacing:0.04em;color:${C.fg}">NULLSHIFT</span></td>
  </tr></table>`;
}

function summaryRows(answers: Answers): string {
  return answeredSummary(answers)
    .map(
      (r) => `<tr>
        <td style="padding:9px 0;border-bottom:1px solid ${C.border};font-family:${FONT};font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${C.faint};white-space:nowrap;vertical-align:top;width:42%">${esc(r.label)}</td>
        <td style="padding:9px 0 9px 16px;border-bottom:1px solid ${C.border};font-family:${FONT};font-size:14px;color:${C.fg};vertical-align:top">${esc(r.value)}</td>
      </tr>`
    )
    .join("");
}

function button(href: string, label: string, primary = true): string {
  const bg = primary ? C.primary : "transparent";
  const color = primary ? C.primaryFg : C.fg;
  const border = primary ? C.primary : C.border;
  return `<a href="${esc(href)}" style="display:inline-block;font-family:${FONT};font-size:15px;font-weight:600;text-decoration:none;color:${color};background:${bg};border:1px solid ${border};border-radius:10px;padding:13px 24px">${esc(label)}</a>`;
}

/** Outer shell with preheader + footer. */
function wrap(inner: string, preheader: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"></head>
<body style="margin:0;padding:0;background:${C.bg}">
<span style="display:none!important;opacity:0;color:transparent;height:0;width:0;overflow:hidden">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg}">
  <tr><td align="center" style="padding:32px 16px">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:${C.surface};border:1px solid ${C.border};border-radius:18px;overflow:hidden">
      <tr><td style="padding:26px 32px 0">${logo()}</td></tr>
      ${inner}
      <tr><td style="padding:24px 32px 30px;border-top:1px solid ${C.border}">
        <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.faint}">Nullshift — web, automation &amp; brand · UK-based<br>You're receiving this because you used our quick fit-finder. Reply any time — a real person reads these.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

/* ── Client email (lead-generating) ───────────────────────────────── */
export function clientEmail(opts: {
  name: string;
  segment: Segment;
  recommendation: Recommendation;
  answers: Answers;
  resourceUrl: string;
  bookUrl: string;
}): { subject: string; html: string; text: string } {
  const { name, segment, recommendation, answers, resourceUrl, bookUrl } = opts;
  const first = name.split(" ")[0] || name;
  const kit = resourceName(answers);
  const qualified = segment === "qualified";

  const subject = qualified
    ? `${first}, here's what we'd build for you`
    : `${first}, your free ${kit} (and a smart next step)`;

  const cta = qualified
    ? `<tr><td style="padding:6px 32px 4px">${button(bookUrl, "Book your discovery call →")}</td></tr>
       <tr><td style="padding:8px 32px 0">${button(resourceUrl, `Grab your free ${kit} →`, false)}</td></tr>`
    : `<tr><td style="padding:6px 32px 4px">${button(resourceUrl, `Get your free ${kit} →`)}</td></tr>
       <tr><td style="padding:8px 32px 0">${button(bookUrl, "Or book a quick call →", false)}</td></tr>`;

  const inner = `
    <tr><td style="padding:22px 32px 0">
      <p style="margin:0 0 10px;font-family:${FONT};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${C.primary}">Your recommendation</p>
      <h1 style="margin:0;font-family:${FONT};font-weight:700;font-size:28px;line-height:1.15;letter-spacing:-0.02em;color:${C.fg}">${esc(recommendation.headline)}</h1>
      <p style="margin:14px 0 0;font-family:${FONT};font-size:15px;line-height:1.65;color:${C.muted}">${esc(first)}, ${esc(recommendation.body.charAt(0).toLowerCase() + recommendation.body.slice(1))}</p>
    </td></tr>

    <tr><td style="padding:22px 32px 0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.surface2};border:1px solid ${C.border};border-radius:14px">
        <tr><td style="padding:18px 20px 4px">
          <p style="margin:0 0 4px;font-family:${FONT};font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:${C.faint}">What we'd build</p>
          <p style="margin:0;font-family:${FONT};font-weight:600;font-size:17px;line-height:1.4;color:${C.fg}">${esc(recommendation.planSuggestion)}</p>
        </td></tr>
        <tr><td style="padding:10px 20px 16px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${summaryRows(answers)}</table>
        </td></tr>
      </table>
    </td></tr>

    <tr><td style="padding:22px 32px 0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${C.primary}55;border-radius:12px;background:rgba(16,185,129,0.08)">
        <tr><td style="padding:14px 18px;font-family:${FONT};font-size:14px;line-height:1.5;color:${C.fg}">🎁 Your free <strong style="color:${C.primary}">${esc(kit)}</strong> is ready — a head start tailored to ${esc(first === name ? "your business" : first + "'s business")}.</td></tr>
      </table>
    </td></tr>

    ${cta}
    <tr><td style="padding:14px 32px 4px"><p style="margin:0;font-family:${FONT};font-size:12px;color:${C.faint}">${qualified ? "Free · 30-minute call · no obligation" : "No spam — just genuinely useful help. Unsubscribe anytime."}</p></td></tr>
  `;

  const text = `${recommendation.headline}\n\n${first}, ${recommendation.body}\n\nWhat we'd build: ${recommendation.planSuggestion}\n\nYour answers:\n${answeredSummary(
    answers
  )
    .map((r) => `- ${r.label}: ${r.value}`)
    .join(
      "\n"
    )}\n\nFree ${kit}: ${resourceUrl}\n${qualified ? `Book a call: ${bookUrl}` : `Book a call (optional): ${bookUrl}`}\n\n— Nullshift`;

  return { subject, html: wrap(inner, `Your recommendation + free ${kit}`), text };
}

/* ── Build Blueprint email (the "free plan") ──────────────────────── */
export function blueprintEmail(opts: {
  name: string;
  businessName?: string;
  segment: Segment;
  blueprint: Blueprint;
  planUrl: string;
  bookUrl: string;
}): { subject: string; html: string; text: string } {
  const { name, businessName, segment, blueprint: b, planUrl, bookUrl } = opts;
  const first = name.split(" ")[0] || name;
  const who = businessName || (b.isClinic ? "your clinic" : "your business");
  const qualified = segment === "qualified";

  const subject = `${first}, your build plan for ${who}`;

  const rows = b.modules
    .map(
      (m) => `<tr>
        <td style="padding:9px 0;border-bottom:1px solid ${C.border};font-family:${FONT};font-size:14px;color:${C.fg};vertical-align:top">${esc(m.name)}</td>
        <td style="padding:9px 0;border-bottom:1px solid ${C.border};font-family:${FONT};font-size:14px;color:${C.fg};text-align:right;white-space:nowrap;vertical-align:top">${esc(gbp(m.price))}</td>
      </tr>`
    )
    .join("");

  const inner = `
    <tr><td style="padding:22px 32px 0">
      <p style="margin:0 0 10px;font-family:${FONT};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${C.primary}">Your build plan</p>
      <h1 style="margin:0;font-family:${FONT};font-weight:700;font-size:26px;line-height:1.18;letter-spacing:-0.02em;color:${C.fg}">Here&#39;s exactly what we&#39;d build for ${esc(who)}.</h1>
      <p style="margin:14px 0 0;font-family:${FONT};font-size:15px;line-height:1.65;color:${C.muted}">${esc(first)}, this is an indicative, itemised scope — including a preview of your own system. Open the full plan to see it, with what you&#39;d stop renting.</p>
    </td></tr>

    <tr><td style="padding:20px 32px 0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.surface2};border:1px solid ${C.border};border-radius:14px">
        <tr><td style="padding:16px 20px 4px">
          <p style="margin:0 0 6px;font-family:${FONT};font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:${C.faint}">Your build — itemised</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}
            <tr>
              <td style="padding:12px 0 4px;font-family:${FONT};font-weight:700;font-size:15px;color:${C.fg}">One-off build</td>
              <td style="padding:12px 0 4px;font-family:${FONT};font-weight:700;font-size:18px;color:${C.fg};text-align:right">${esc(gbp(b.oneOffTotal))}</td>
            </tr>
          </table>
          <p style="margin:8px 0 16px;font-family:${FONT};font-size:13px;color:${C.muted}">${esc(b.tier.tier)} care plan ${esc(b.tier.monthly)}/mo · estimated ${esc(gbp(b.savings.kept))}/yr saved by owning it.</p>
        </td></tr>
      </table>
    </td></tr>

    <tr><td style="padding:18px 32px 4px">${button(planUrl, "See your full plan & system preview →")}</td></tr>
    <tr><td style="padding:8px 32px 0">${button(bookUrl, qualified ? "Book a call to make it real →" : "Book a quick call →", false)}</td></tr>
    <tr><td style="padding:14px 32px 4px"><p style="margin:0;font-family:${FONT};font-size:12px;color:${C.faint}">Indicative scope &amp; pricing, confirmed on a quick call — never a surprise.</p></td></tr>
  `;

  const text = `Your build plan for ${who}\n\n${first}, here's exactly what we'd build:\n${b.modules.map((m) => `- ${m.name}: ${gbp(m.price)}`).join("\n")}\nOne-off build: ${gbp(b.oneOffTotal)}\n${b.tier.tier} care plan: ${b.tier.monthly}/mo\nEstimated saved by owning it: ${gbp(b.savings.kept)}/yr\n\nSee your full plan + system preview: ${planUrl}\nBook a call: ${bookUrl}\n\n— Nullshift`;

  return { subject, html: wrap(inner, `Your build plan for ${who}`), text };
}

/* ── Owner notification ───────────────────────────────────────────── */
export function ownerEmail(opts: {
  name: string;
  email: string;
  phone: string | null;
  segment: Segment;
  score: number;
  answers: Answers;
  recommendation: Recommendation;
  resourceUrl: string;
  planUrl?: string;
}): { subject: string; html: string; text: string } {
  const {
    name,
    email,
    phone,
    segment,
    score,
    answers,
    recommendation,
    resourceUrl,
    planUrl,
  } = opts;
  const qualified = segment === "qualified";
  const badge = qualified ? C.primary : C.muted;

  const subject = `New ${qualified ? "QUALIFIED " : ""}lead — ${name} (score ${score})`;

  const inner = `
    <tr><td style="padding:22px 32px 0">
      <span style="display:inline-block;font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${C.primaryFg};background:${badge};border-radius:999px;padding:4px 10px">${esc(segment)} · score ${score}</span>
      <h1 style="margin:14px 0 0;font-family:${FONT};font-weight:700;font-size:26px;line-height:1.15;letter-spacing:-0.02em;color:${C.fg}">${esc(name)}</h1>
      <p style="margin:8px 0 0;font-family:${FONT};font-size:14px;color:${C.muted}">
        <a href="mailto:${esc(email)}" style="color:${C.primary};text-decoration:none">${esc(email)}</a>${phone ? ` · ${esc(phone)}` : ""}
      </p>
    </td></tr>

    <tr><td style="padding:18px 32px 0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.surface2};border:1px solid ${C.border};border-radius:14px">
        <tr><td style="padding:8px 20px 16px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${summaryRows(answers)}</table>
        </td></tr>
      </table>
    </td></tr>

    <tr><td style="padding:18px 32px 0">
      <p style="margin:0;font-family:${FONT};font-size:13px;line-height:1.6;color:${C.muted}"><strong style="color:${C.fg}">Recommended:</strong> ${esc(recommendation.planSuggestion)}</p>
      <p style="margin:8px 0 0;font-family:${FONT};font-size:13px;line-height:1.6;color:${C.muted}"><strong style="color:${C.fg}">Free resource sent:</strong> <a href="${esc(resourceUrl)}" style="color:${C.primary};text-decoration:none">${esc(resourceName(answers))}</a></p>
    </td></tr>

    ${planUrl ? `<tr><td style="padding:18px 32px 0">${button(planUrl, "View their build plan →", false)}</td></tr>` : ""}
    <tr><td style="padding:${planUrl ? "8px" : "20px"} 32px 4px">${button(`mailto:${email}?subject=${encodeURIComponent("Re: your project")}`, `Reply to ${name.split(" ")[0] || name} →`)}</td></tr>
  `;

  const text = `New ${segment} lead — ${name} (score ${score})\nEmail: ${email}\nPhone: ${phone || "—"}\n\nAnswers:\n${answeredSummary(
    answers
  )
    .map((r) => `- ${r.label}: ${r.value}`)
    .join(
      "\n"
    )}\n\nRecommended: ${recommendation.planSuggestion}\nFree resource: ${resourceName(answers)} (${resourceUrl})`;

  return { subject, html: wrap(inner, `${segment} lead — ${name}`), text };
}
