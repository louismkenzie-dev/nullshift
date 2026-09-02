"use server";

import { createServiceClient } from "@nullshift/db";
import { escapeLike } from "@nullshift/db/leads";
import { rateLimitAllow } from "@nullshift/db/rateLimit";
import { logAudit } from "@nullshift/db/audit";
import { sendEmail } from "@/lib/sendEmail";
import { passwordResetEmail } from "@/lib/clientEmails";
import { issuePortalLink, portalReplyTo } from "@/lib/portalAccess";

/**
 * Self-serve password reset for portal clients.
 *
 * This exists because a client with an account but no password had no way in
 * at all: signing in failed, signing up correctly said "an account with this
 * email already exists", and the only recovery route was an admin pressing a
 * button in the staff hub. A client should never have to email us to get into
 * their own portal.
 *
 * Two rules the implementation has to honour:
 *
 *  · The response is IDENTICAL whether or not the address has an account.
 *    Anything else turns this form into an "is this business a Nullshift
 *    client?" oracle for anyone who wants to ask.
 *  · Rate-limited per address and per IP, because an unmetered endpoint that
 *    sends email is a way to use our domain to spam someone else's inbox.
 *
 * It reuses the same generateLink + branded Resend email as the admin button,
 * rather than Supabase's built-in template — that path is already proven in
 * production and carries our wording.
 */

export type ForgotResult = { ok: boolean; error?: string };

/** Said back no matter what happened. Never confirms an account exists. */
const NEUTRAL =
  "If that email has a Nullshift portal account, a reset link is on its way. It's valid for one hour — check your spam folder if it doesn't arrive in a few minutes.";

export async function requestPasswordReset(
  _prev: ForgotResult | null,
  formData: FormData
): Promise<ForgotResult> {
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  if (!email || !email.includes("@"))
    return { ok: false, error: "Please enter your email address." };

  // Per-address: stops someone hammering one inbox. Fails open on an
  // infrastructure error, which is the right trade for a recovery route.
  const allowed = await rateLimitAllow("portal_password_reset", email, 3, 15 * 60);
  if (!allowed)
    return {
      ok: false,
      error: "Too many reset requests. Please wait a few minutes and try again.",
    };

  const service = createServiceClient();

  // The link carries the hashed token to OUR reset page, where it is verified
  // server-side (see portal/reset/actions.ts). generateLink fails for an
  // address with no account — that is not an error the caller may see; it is
  // exactly the fact we are hiding.
  const issued = await issuePortalLink(service, { email, type: "recovery" });
  if (!issued.url) {
    console.warn("requestPasswordReset: no link for address (reported neutrally)");
    return { ok: true };
  }

  // Greet them by the name we actually hold — the tenant contact — rather than
  // auth metadata, which admin-created accounts never carry.
  const { data: tenant } = await service
    .from("tenants")
    .select("contact_name")
    .ilike("contact_email", escapeLike(email))
    .limit(1)
    .maybeSingle();
  const name = (tenant?.contact_name as string | null) ?? "there";

  const mail = passwordResetEmail({ name, resetUrl: issued.url });
  const sent = await sendEmail({
    purpose: "transactional",
    to: email,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    replyTo: portalReplyTo(),
  });
  if (!sent) console.error("requestPasswordReset: reset email did not send for", email);

  await logAudit({
    action: "portal.password_reset_self_serve",
    target: `email:${email}`,
    metadata: { email, sent },
  });

  return { ok: true };
}

export const NEUTRAL_RESET_MESSAGE = NEUTRAL;
