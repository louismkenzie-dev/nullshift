/**
 * Thin Resend wrapper for transactional emails. Best-effort: if RESEND_API_KEY is
 * unset (e.g. local dev) it logs and no-ops rather than throwing, so the calling
 * server action never fails because email couldn't send. Server-only.
 */
export async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`sendEmail: RESEND_API_KEY unset — skipping "${opts.subject}"`);
    return false;
  }
  const from =
    process.env.RESEND_FROM_EMAIL ||
    process.env.ENQUIRY_FROM_EMAIL ||
    "Nullshift <onboarding@resend.dev>";
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      replyTo: opts.replyTo,
    });
    return true;
  } catch (e) {
    console.error("sendEmail failed (non-fatal):", e);
    return false;
  }
}
