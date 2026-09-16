/** Comma-separated allowlist of admin emails, set in env. */
export function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.toLowerCase());
}

export type AdminAccessDecision = "allow" | "mfa" | "forbidden";

/**
 * Decide where an authenticated admin request should go.
 *
 * Authorisation must be evaluated before MFA. Otherwise an authenticated
 * non-staff user with a verified factor can be bounced between the dashboard,
 * security page and login forever.
 */
export function adminAccessDecision(input: {
  authorised: boolean;
  currentLevel?: string | null;
  nextLevel?: string | null;
}): AdminAccessDecision {
  if (!input.authorised) return "forbidden";
  if (input.currentLevel === "aal1" && input.nextLevel === "aal2") return "mfa";
  return "allow";
}
