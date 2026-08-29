"use client";

import type { createClient } from "@nullshift/db/client";

/** Where a signed-in user belongs: staff → the admin hub, everyone else → the
 *  client portal (or the explicit ?next= target). Used by every sign-in
 *  surface so an admin never lands in the client portal by accident.
 *
 *  The check is the same `is_internal_staff()` RPC that RLS uses — the
 *  redirect is a convenience; real access control stays on the server. */
export async function resolveDestination(
  supabase: ReturnType<typeof createClient>,
  next?: string | null
): Promise<string> {
  // An explicit admin target always wins; an explicit portal-internal target
  // is honoured for non-staff below.
  if (next && next.startsWith("/admin")) return next;
  try {
    const { data: isStaff } = await supabase.rpc("is_internal_staff");
    if (isStaff === true) return "/admin";
  } catch {
    /* fall through — treat as non-staff */
  }
  return next || "/portal";
}
