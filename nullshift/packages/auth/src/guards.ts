import { createClient } from "@nullshift/db";
import { isAdminEmail } from "./admin";

/**
 * Auth/role guards shared across apps. Phase 0 ships the staff guard built on the
 * existing email allowlist; Phase 1 replaces the allowlist with membership-based
 * roles (owner|staff|client_admin|client_member) once the multi-tenant schema and
 * `memberships` table land. // PHASE 1: swap allowlist for membership lookup.
 */

export type StaffGuardResult =
  | { ok: true; userId: string; email: string }
  | { ok: false; reason: "unauthenticated" | "forbidden" };

/** Resolve the current user and assert they are Nullshift staff. */
export async function requireStaff(): Promise<StaffGuardResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, reason: "unauthenticated" };
  if (!user.email || !isAdminEmail(user.email)) {
    return { ok: false, reason: "forbidden" };
  }
  return { ok: true, userId: user.id, email: user.email };
}

/** Resolve the current authenticated user (any role) or null. */
export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
