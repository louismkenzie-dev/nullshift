import { emailPurpose, type EmailPurpose } from "@nullshift/content/legal/email";

/**
 * Thin Resend wrapper. Best-effort: if RESEND_API_KEY is unset (e.g. local dev)
 * it logs and no-ops rather than throwing, so the calling server action never
 * fails because email couldn't send. Server-only.
 *
 * `purpose` is REQUIRED (spec §15). Making it a mandatory argument rather than
 * an optional tag is the whole control: it is not possible to send from this
 * codebase without stating what kind of message it is, and a marketing send
 * has to prove a lawful permission before it goes anywhere.
 */
export async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
  purpose: EmailPurpose;
  text?: string;
  replyTo?: string;
  /** Required for marketing. Ignored for everything else. */
  unsubscribeUrl?: string;
}): Promise<boolean> {
  const rules = emailPurpose(opts.purpose);
  const recipients = Array.isArray(opts.to) ? opts.to : [opts.to];

  if (rules.needsMarketingPermission) {
    const allowed = await marketingAllowedFor(recipients);
    if (!allowed.length) {
      console.warn(
        `sendEmail: refused marketing send "${opts.subject}" — no lawful permission on record for any recipient.`
      );
      return false;
    }
    if (allowed.length !== recipients.length)
      console.warn(
        `sendEmail: dropped ${recipients.length - allowed.length} marketing recipient(s) without permission.`
      );
    if (!opts.unsubscribeUrl) {
      console.warn(
        `sendEmail: refused marketing send "${opts.subject}" — no unsubscribe route supplied.`
      );
      return false;
    }
    return deliver({ ...opts, to: allowed });
  }

  return deliver(opts);
}

/**
 * Which of these addresses may lawfully be marketed to right now. Suppression
 * wins over permission, and the check runs at send time rather than at list
 * build time — an unsubscribe between the two must still take effect.
 */
async function marketingAllowedFor(recipients: string[]): Promise<string[]> {
  try {
    const { createServiceClient } = await import("@nullshift/db");
    const db = createServiceClient();
    const results = await Promise.all(
      recipients.map(async (addr) => {
        const { data } = await db.rpc("marketing_allowed", { addr });
        return data === true ? addr : null;
      })
    );
    return results.filter((r): r is string => !!r);
  } catch (e) {
    // Fail CLOSED. If we cannot prove permission, we do not send.
    console.error("sendEmail: marketing permission check failed — refusing send.", e);
    return [];
  }
}

async function deliver(opts: {
  to: string | string[];
  subject: string;
  html: string;
  purpose: EmailPurpose;
  text?: string;
  replyTo?: string;
  unsubscribeUrl?: string;
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
      headers: opts.unsubscribeUrl
        ? {
            "List-Unsubscribe": `<${opts.unsubscribeUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          }
        : undefined,
    });
    return true;
  } catch (e) {
    console.error("sendEmail failed (non-fatal):", e);
    return false;
  }
}
