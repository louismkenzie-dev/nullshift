import { createClient } from "@nullshift/db";
import { isAdminEmail } from "./admin";

/**
 * Auth/role guards shared across apps.
 *
 * Roles now come from the `memberships` table (Phase 1 multi-tenant core):
 * - internal staff  → is_internal_staff() RLS helper
 * - tenant member   → is_member_of(tenant_id) RLS helper
 *
 * The email allowlist remains a TRANSITIONAL fallback for staff so the admin app
 * keeps working before staff memberships are seeded. Phase 3 rewires the admin
 * app fully onto memberships and the allowlist fallback can then be removed.
 */

export type StaffGuardResult =
  | { ok: true; userId: string; email: string }
  | { ok: false; reason: "unauthenticated" | "forbidden" };

export type TenantGuardResult =
  | { ok: true; userId: string; email: string; tenantId: string }
  | { ok: false; reason: "unauthenticated" | "forbidden" };

/** Resolve the current user and assert they are Nullshift staff. */
export async function requireStaff(): Promise<StaffGuardResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, reason: "unauthenticated" };

  // Membership-based check (canonical).
  const { data: isStaff } = await supabase.rpc("is_internal_staff");
  const allowlisted = user.email ? isAdminEmail(user.email) : false;

  if (isStaff === true || allowlisted) {
    return { ok: true, userId: user.id, email: user.email ?? "" };
  }
  return { ok: false, reason: "forbidden" };
}

/** Assert the current user is a member of the given tenant (or internal staff). */
export async function requireTenantMember(tenantId: string): Promise<TenantGuardResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, reason: "unauthenticated" };

  const [{ data: isMember }, { data: isStaff }] = await Promise.all([
    supabase.rpc("is_member_of", { tid: tenantId }),
    supabase.rpc("is_internal_staff"),
  ]);

  if (isMember === true || isStaff === true) {
    return { ok: true, userId: user.id, email: user.email ?? "", tenantId };
  }
  return { ok: false, reason: "forbidden" };
}

/** Resolve the current authenticated user (any role) or null. */
export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
