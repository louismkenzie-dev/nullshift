/**
 * Manual-mode email: when a scheduled post comes due and no connected
 * Instagram account can publish it, Louis gets the caption, the media links
 * and a "mark as published" link so it can be posted by hand. Pure HTML
 * assembly; sending happens in publish.ts via lib/sendEmail.ts.
 */

import { C, FONT, button, esc, wrap } from "@/lib/emailLayout";
import type { MediaItem, PostKind } from "./rules";

export const MANUAL_MODE_RECIPIENT = "louis@nullshift.co.uk";

export function manualPostEmail(input: {
  postId: string;
  kind: PostKind;
  caption: string;
  firstComment: string | null;
  media: MediaItem[];
  scheduledAt: string | null;
  pillar: string | null;
  siteUrl: string;
  reason: string;
}): { subject: string; html: string; text: string } {
  const when = input.scheduledAt
    ? new Date(input.scheduledAt).toLocaleString("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Europe/London",
      })
    : "unscheduled";
  const editUrl = `${input.siteUrl}/admin/social/${input.postId}`;
  const markUrl = `${input.siteUrl}/admin/social/${input.postId}?mark=published`;
  const subject = `Post by hand: ${input.kind} due ${when}`;

  const mediaRows = input.media
    .map(
      (m, i) =>
        `<tr><td style="padding:4px 0;font-family:${FONT};font-size:13px;color:${C.muted}">${i + 1}. ${m.type} — <a href="${esc(m.url)}" style="color:${C.primary}">${esc(m.url)}</a>${m.alt ? `<br><span style="color:${C.faint}">alt: ${esc(m.alt)}</span>` : ""}</td></tr>`
    )
    .join("");

  const inner = `
    <tr><td style="padding:22px 32px 0">
      <p style="margin:0 0 6px;font-family:${FONT};font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:${C.faint}">Social scheduler · manual mode</p>
      <h1 style="margin:0 0 10px;font-family:${FONT};font-size:22px;line-height:1.3;color:${C.fg}">A ${esc(input.kind)} is due ${esc(when)}</h1>
      <p style="margin:0 0 16px;font-family:${FONT};font-size:14px;line-height:1.6;color:${C.muted}">${esc(input.reason)} Post it from the @nullshift.dev app, then mark it published so the queue stays honest.</p>
    </td></tr>
    <tr><td style="padding:0 32px">
      <p style="margin:0 0 6px;font-family:${FONT};font-size:12px;color:${C.faint}">Caption${input.pillar ? ` · ${esc(input.pillar)}` : ""}</p>
      <div style="padding:14px 16px;background-color:${C.surface2};border:1px solid ${C.border};font-family:${FONT};font-size:14px;line-height:1.6;color:${C.fg};white-space:pre-wrap">${esc(input.caption) || "<em>(no caption)</em>"}</div>
      ${
        input.firstComment
          ? `<p style="margin:14px 0 6px;font-family:${FONT};font-size:12px;color:${C.faint}">First comment</p>
      <div style="padding:12px 16px;background-color:${C.surface2};border:1px solid ${C.border};font-family:${FONT};font-size:14px;line-height:1.6;color:${C.fg};white-space:pre-wrap">${esc(input.firstComment)}</div>`
          : ""
      }
      <p style="margin:14px 0 6px;font-family:${FONT};font-size:12px;color:${C.faint}">Media</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">${mediaRows || `<tr><td style="font-family:${FONT};font-size:13px;color:${C.muted}">No media attached.</td></tr>`}</table>
    </td></tr>
    <tr><td style="padding:22px 32px 26px">
      ${button(markUrl, "Mark as published")}
      <span style="display:inline-block;width:10px"></span>
      ${button(editUrl, "Open in admin", false)}
    </td></tr>`;

  const text = [
    `A ${input.kind} is due ${when}. ${input.reason}`,
    "",
    "CAPTION:",
    input.caption,
    input.firstComment ? `\nFIRST COMMENT:\n${input.firstComment}` : "",
    "",
    "MEDIA:",
    ...input.media.map((m, i) => `${i + 1}. ${m.type} ${m.url}`),
    "",
    `Mark as published: ${markUrl}`,
    `Open in admin: ${editUrl}`,
  ].join("\n");

  return { subject, html: wrap(inner, subject), text };
}
