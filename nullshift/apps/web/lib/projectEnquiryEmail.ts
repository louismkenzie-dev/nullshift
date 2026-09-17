import type { ProjectEnquiry } from "./projectEnquiry";

const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!
  );

export function projectEnquiryEmails(data: ProjectEnquiry) {
  const summary = [
    ["Name", data.name],
    ["Company", data.business],
    ["Email", data.email],
    ["Challenge", data.challenge],
    ["Budget", data.budget || "Not supplied"],
    ["Timing", data.timing || "Not supplied"],
    [
      "Call preference (Europe/London, not confirmed)",
      [data.preferredDate, data.preferredTime].filter(Boolean).join(" · ") ||
        "Arrange by email / calendar",
    ],
  ];
  const text = summary.map(([key, value]) => `${key}: ${value}`).join("\n\n");
  return {
    owner: {
      subject: "New project enquiry — Nullshift",
      text,
      html: `<!doctype html><html lang="en"><body><h1>New project enquiry</h1>${summary.map(([key, value]) => `<h2>${escape(key)}</h2><p style="white-space:pre-wrap">${escape(value)}</p>`).join("")}<p>This is an enquiry, not a confirmed booking or a client account.</p></body></html>`,
    },
    receipt: {
      subject: "We’ve received your project enquiry",
      text: "Thank you for contacting Nullshift. We’ve received your project enquiry and will be in touch to discuss the next step. If you requested a call time, it is a preference only until we confirm it. If you book through our calendar, your booking confirmation will come separately. No account has been created and you have not been subscribed to marketing emails.",
      html: '<!doctype html><html lang="en"><body><h1>Your enquiry is with Nullshift.</h1><p>Thank you for getting in touch. We’ll review your enquiry and contact you about the next step.</p><p>A requested call time is a preference only until we confirm it. If you book through our calendar, your booking confirmation will come separately.</p><p>No account has been created and you have not been subscribed to marketing emails.</p></body></html>',
    },
  };
}
