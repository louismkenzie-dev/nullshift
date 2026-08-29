import { createClient, createServiceClient } from "@nullshift/db";
import { requireStaff } from "@nullshift/auth/guards";
import type { ProgrammeRole } from "./types";

/**
 * Server-side authorisation for the Security & SOC 2 Readiness area.
 *
 * Two layers, both server-side:
 *  1. `requireStaff()` — the same gate as the rest of /admin (client users can
 *     never reach any soc2_* record: RLS has no is_member_of() path).
 *  2. A programme role — being staff opens /admin; a soc2_programme_roles row
 *     is what opens this area. Auditor rows are read-only and time-limited.
 *
 * Bootstrap: while NO programme roles exist yet, any staff member may view the
 * area's setup state and appoint the first Programme Owner (the appointment is
 * audited). Anything else requires a live role.
 */

export type Soc2Guard =
  | {
      ok: true;
      email: string;
      userId: string;
      roles: ProgrammeRole[];
      /** True while no roles exist anywhere — setup mode. */
      bootstrap: boolean;
    }
  | { ok: false; reason: "unauthenticated" | "forbidden" | "no_role" };

const now = () => new Date().toISOString();

export async function requireSoc2(
  ...anyOf: ProgrammeRole[]
): Promise<Soc2Guard> {
  const staff = await requireStaff();
  if (!staff.ok) return { ok: false, reason: staff.reason };

  const supabase = await createClient();
  const email = staff.email.toLowerCase();

  const [{ data: mine }, { count }] = await Promise.all([
    supabase
      .from("soc2_programme_roles")
      .select("role, expires_at")
      .ilike("user_email", email),
    supabase
      .from("soc2_programme_roles")
      .select("id", { count: "exact", head: true }),
  ]);

  const live = (mine ?? []).filter((r) => !r.expires_at || r.expires_at > now());
  const roles = live.map((r) => r.role as ProgrammeRole);
  const bootstrap = (count ?? 0) === 0;

  if (bootstrap) {
    // Setup mode: staff may LOOK (and Settings lets them appoint the first
    // Programme Owner via its own bootstrap-aware action). Anything that asks
    // for a specific role — approvals, seeding, sweeps, closures — stays
    // locked until that owner exists: bootstrap widens visibility, never
    // authority.
    if (anyOf.length > 0) return { ok: false, reason: "no_role" };
    return { ok: true, email: staff.email, userId: staff.userId, roles: [], bootstrap: true };
  }
  if (roles.length === 0) return { ok: false, reason: "no_role" };
  if (anyOf.length > 0 && !anyOf.some((r) => roles.includes(r))) {
    return { ok: false, reason: "no_role" };
  }
  return { ok: true, email: staff.email, userId: staff.userId, roles, bootstrap: false };
}

/** Roles allowed to WRITE programme records (auditors are read-only). */
export const WRITE_ROLES: ProgrammeRole[] = [
  "programme_owner",
  "control_owner",
  "evidence_reviewer",
  "system_owner",
  "staff",
];

/** Convenience: any live (non-auditor) role, for viewing pages. */
export async function requireSoc2Viewer(): Promise<Soc2Guard> {
  return requireSoc2();
}

/** Programme Owner emails, for alert routing. Service-side helper. */
export async function programmeOwnerEmails(): Promise<string[]> {
  const db = createServiceClient();
  const { data } = await db
    .from("soc2_programme_roles")
    .select("user_email, expires_at")
    .eq("role", "programme_owner");
  return (data ?? [])
    .filter((r) => !r.expires_at || r.expires_at > now())
    .map((r) => r.user_email);
}
