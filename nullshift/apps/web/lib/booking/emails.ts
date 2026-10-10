import { C, FONT, button, esc, wrap } from "@/lib/emailLayout";
import { siteUrl } from "@/lib/portalLinks";
import { londonParts } from "./slots";

/**
 * Confirmation (to the booker) and notification (to Louis) for a website
 * booking, plus the .ics attachment and a Google Calendar link so the call
 * lands in the booker's diary whichever client they use. Pure — no network.
 */

export type BookingForEmail = {
  id: string;
  kind: "client" | "partner";
  name: string;
  email: string;
  company: string | null;
  website: string | null;
  phone: string | null;
  notes: string | null;
  starts_at: string;
  ends_at: string;
  cancel_token: string;
};

export const NOTIFY_EMAIL = process.env.BOOKING_NOTIFY_EMAIL || "louis@nullshift.co.uk";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** "Monday 13 October 2026 · 10:00–10:30 (London)". */
export function describeSlot(startsAt: string, endsAt: string): string {
  const start = Date.parse(startsAt);
  const end = Date.parse(endsAt);
  return `${dateFmt.format(new Date(start))} · ${londonParts(start).time}–${londonParts(end).time} (London)`;
}

export function callTitle(kind: "client" | "partner") {
  return kind === "partner" ? "Partner call with Nullshift" : "Call with Nullshift";
}

const icsStamp = (iso: string) =>
  new Date(iso)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
const icsText = (s: string) =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");

export function bookingIcs(b: BookingForEmail, meetingLink: string | null): string {
  const title = callTitle(b.kind);
  const description = [
    `${title} — ${b.name}${b.company ? ` (${b.company})` : ""}.`,
    meetingLink ? `Join: ${meetingLink}` : "",
    `Need to move it? ${cancelUrl(b.cancel_token)}`,
  ]
    .filter(Boolean)
    .join("\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Nullshift//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:booking-${b.id}@nullshift.co.uk`,
    `DTSTAMP:${icsStamp(new Date().toISOString())}`,
    `DTSTART:${icsStamp(b.starts_at)}`,
    `DTEND:${icsStamp(b.ends_at)}`,
    `SUMMARY:${icsText(title)}`,
    `DESCRIPTION:${icsText(description)}`,
    meetingLink ? `LOCATION:${icsText(meetingLink)}` : "LOCATION:Video call",
    meetingLink ? `URL:${meetingLink}` : "",
    `ORGANIZER;CN=Nullshift:mailto:${NOTIFY_EMAIL}`,
    `ATTENDEE;CN=${icsText(b.name)};RSVP=FALSE:mailto:${b.email}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}

export function googleCalendarUrl(
  b: BookingForEmail,
  meetingLink: string | null
): string {
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: callTitle(b.kind),
    dates: `${icsStamp(b.starts_at)}/${icsStamp(b.ends_at)}`,
    details: meetingLink ? `Join: ${meetingLink}` : "Video call — link to follow.",
    location: meetingLink ?? "Video call",
    ctz: "Europe/London",
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

export function cancelUrl(token: string) {
  return `${siteUrl()}/book/cancel/${encodeURIComponent(token)}`;
}

const p = (s: string, color = C.fg) =>
  `<p style="margin:0 0 14px;font-family:${FONT};font-size:15px;line-height:1.65;color:${color}">${s}</p>`;
const row = (inner: string) => `<tr><td style="padding:0 32px">${inner}</td></tr>`;
const h1 = (s: string) =>
  `<h1 style="margin:22px 0 10px;font-family:${FONT};font-size:24px;line-height:1.25;letter-spacing:-0.02em;color:${C.fg}">${s}</h1>`;

const slotBox = (b: BookingForEmail, meetingLink: string | null) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 20px;background:${C.surface2};border:1px solid ${C.border}"><tr><td style="padding:16px 18px">
    <p style="margin:0 0 6px;font-family:${FONT};font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:${C.muted}">${esc(callTitle(b.kind))}</p>
    <p style="margin:0;font-family:${FONT};font-size:17px;font-weight:600;color:${C.fg}">${esc(describeSlot(b.starts_at, b.ends_at))}</p>
    ${
      meetingLink
        ? `<p style="margin:10px 0 0;font-family:${FONT};font-size:14px;color:${C.muted}">Join: <a href="${esc(meetingLink)}" style="color:${C.primary}">${esc(meetingLink)}</a></p>`
        : `<p style="margin:10px 0 0;font-family:${FONT};font-size:14px;color:${C.muted}">We’ll send the video link before the call.</p>`
    }
  </td></tr></table>`;

export function confirmationEmail(b: BookingForEmail, meetingLink: string | null) {
  const first = b.name.split(/\s+/)[0] || b.name;
  const subject = `Confirmed: ${callTitle(b.kind).toLowerCase()} — ${describeSlot(b.starts_at, b.ends_at)}`;
  const inner =
    row(h1(`You’re booked, ${esc(first)}.`)) +
    row(slotBox(b, meetingLink)) +
    row(
      p(
        b.kind === "partner"
          ? "Thanks for booking a partner call. We’ll talk through how Nullshift builds and runs software for your clients, how referrals and white-label work, and what a first project would look like."
          : "Thanks for booking. Come with whatever you have — a rough idea is plenty. We’ll talk through what needs to work better and whether Nullshift is the right team to build it.",
        C.muted
      )
    ) +
    row(
      `<p style="margin:4px 0 22px">${button(googleCalendarUrl(b, meetingLink), "Add to Google Calendar")} &nbsp; ${button(cancelUrl(b.cancel_token), "Cancel or rebook", false)}</p>`
    ) +
    row(
      p(
        `A calendar file (.ics) is attached for Outlook and Apple Calendar. Reply to this email if you have any questions beforehand.`,
        C.faint
      )
    );
  const text = [
    `You're booked, ${first}.`,
    describeSlot(b.starts_at, b.ends_at),
    meetingLink ? `Join: ${meetingLink}` : "We'll send the video link before the call.",
    `Add to Google Calendar: ${googleCalendarUrl(b, meetingLink)}`,
    `Cancel or rebook: ${cancelUrl(b.cancel_token)}`,
  ].join("\n\n");
  return {
    subject,
    html: wrap(inner, `${callTitle(b.kind)} — ${describeSlot(b.starts_at, b.ends_at)}`),
    text,
  };
}

export function notifyEmail(b: BookingForEmail, meetingLink: string | null) {
  const label = b.kind === "partner" ? "Partner call" : "Client call";
  const subject = `New booking: ${label} — ${b.name}${b.company ? `, ${b.company}` : ""} — ${describeSlot(b.starts_at, b.ends_at)}`;
  const kv = (k: string, v: string | null) =>
    v
      ? `<tr><td style="padding:6px 12px 6px 0;font-family:${FONT};font-size:13px;color:${C.muted};white-space:nowrap;vertical-align:top">${k}</td><td style="padding:6px 0;font-family:${FONT};font-size:14px;color:${C.fg}">${esc(v)}</td></tr>`
      : "";
  const inner =
    row(h1(`${label} booked`)) +
    row(slotBox(b, meetingLink)) +
    row(
      `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px">${kv("Name", b.name)}${kv("Email", b.email)}${kv("Company", b.company)}${kv("Website", b.website)}${kv("Phone", b.phone)}${kv("Notes", b.notes)}</table>`
    ) +
    row(
      `<p style="margin:0 0 24px">${button(`${siteUrl()}/admin/calendar`, "Open calendar")}</p>`
    );
  return {
    subject,
    html: wrap(inner, `${label}: ${b.name} — ${describeSlot(b.starts_at, b.ends_at)}`),
    text: `${label} booked\n${describeSlot(b.starts_at, b.ends_at)}\n\n${b.name} <${b.email}>\n${b.company ?? ""}\n${b.website ?? ""}\n${b.phone ?? ""}\n\n${b.notes ?? ""}`,
  };
}

export function cancelledEmail(b: BookingForEmail) {
  const label = b.kind === "partner" ? "Partner call" : "Client call";
  return {
    subject: `Cancelled: ${label} — ${b.name} — ${describeSlot(b.starts_at, b.ends_at)}`,
    html: wrap(
      row(h1(`${label} cancelled`)) +
        row(p(`${esc(b.name)} (${esc(b.email)}) cancelled their call.`, C.muted)) +
        row(p(esc(describeSlot(b.starts_at, b.ends_at)))) +
        row(
          `<p style="margin:0 0 24px">${button(`${siteUrl()}/admin/calendar`, "Open calendar")}</p>`
        ),
      `${label} cancelled: ${b.name}`
    ),
    text: `${label} cancelled\n${b.name} <${b.email}>\n${describeSlot(b.starts_at, b.ends_at)}`,
  };
}
