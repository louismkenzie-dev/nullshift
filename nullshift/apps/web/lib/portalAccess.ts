import type { GenerateLinkParams, SupabaseClient } from "@supabase/supabase-js";
import { findUserByEmail } from "@nullshift/auth/confirmation-email";
import { buildPortalResetUrl, siteUrl, type PortalLinkType } from "./portalLinks";

/**
 * Server-only: mint and email-ready portal access links, and make sure a client
 * has a login + membership. Shared by the client hub, the self-serve forgot
 * flow and the Direct Debits board so the three-branch rule lives in ONE place:
 *
 *   • no account            → invite link (creates the user, they choose a password)
 *   • account, never used   → recovery link (the earlier invite went astray)
 *   • account, signed in    → membership only — NEVER reset a working password
 *
 * generateLink returns the link WITHOUT sending Supabase's own email, so the
 * client only ever gets our branded one, and we never learn their password.
 */

export type IssuedLink =
  | { url: string; userId: string | null; error?: undefined }
  | { url: null; userId: null; error: string };

export async function issuePortalLink(
  service: SupabaseClient,
  opts: { email: string; type: PortalLinkType; next?: string | null }
): Promise<IssuedLink> {
  const params = {
    type: opts.type,
    email: opts.email,
    // Belt and braces: Supabase still records a redirect for the token even
    // though we never use its action_link.
    options: { redirectTo: `${siteUrl()}/portal/reset` },
  } as GenerateLinkParams;
  const { data, error } = await service.auth.admin.generateLink(params);
  const hashed = data?.properties?.hashed_token;
  if (error || !hashed) {
    return { url: null, userId: null, error: error?.message ?? "no token returned" };
  }
  return {
    url: buildPortalResetUrl({ hashedToken: hashed, type: opts.type, next: opts.next }),
    userId: data.user?.id ?? null,
  };
}

export type PortalAccessResult =
  | {
      ok: true;
      userId: string;
      /** Null when the client already has a working password. */
      link: string | null;
      kind: "invite" | "recovery" | "existing";
      membershipCreated: boolean;
    }
  | { ok: false; error: string };

export async function ensurePortalAccess(
  service: SupabaseClient,
  opts: { tenantId: string; email: string; next?: string | null }
): Promise<PortalAccessResult> {
  const email = opts.email.trim().toLowerCase();
  if (!email || !opts.tenantId)
    return { ok: false, error: "email and tenant are required" };

  // Paginating lookup — a bare listUsers() only returns the first page.
  const existing = await findUserByEmail(service, email);
  const hasLoggedIn = !!existing?.last_sign_in_at;

  let userId: string | null = existing?.id ?? null;
  let link: string | null = null;
  let kind: "invite" | "recovery" | "existing" = "existing";

  if (!existing) {
    const issued = await issuePortalLink(service, {
      email,
      type: "invite",
      next: opts.next,
    });
    if (!issued.url) return { ok: false, error: `invite link failed: ${issued.error}` };
    userId = issued.userId;
    link = issued.url;
    kind = "invite";
  } else if (!hasLoggedIn) {
    const issued = await issuePortalLink(service, {
      email,
      type: "recovery",
      next: opts.next,
    });
    if (!issued.url) return { ok: false, error: `recovery link failed: ${issued.error}` };
    link = issued.url;
    kind = "recovery";
  }
  if (!userId) return { ok: false, error: `could not resolve a user for ${email}` };

  // Link as a client_admin member of this tenant (idempotent).
  const { data: member } = await service
    .from("memberships")
    .select("id")
    .eq("tenant_id", opts.tenantId)
    .eq("user_id", userId)
    .limit(1);
  let membershipCreated = false;
  if (!member?.length) {
    const { error } = await service
      .from("memberships")
      .insert({ tenant_id: opts.tenantId, user_id: userId, role: "client_admin" });
    if (error) return { ok: false, error: `membership insert failed: ${error.message}` };
    membershipCreated = true;
  }
  return { ok: true, userId, link, kind, membershipCreated };
}

/** Where client replies to portal emails should land — a read inbox, not noreply@. */
export function portalReplyTo(): string | undefined {
  return process.env.ENQUIRY_NOTIFY_EMAIL || undefined;
}
