import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@nullshift/db";
import { requireStaff } from "@nullshift/auth/guards";
import type { OperationsData } from "./live-model";

/** Independent from financial v2 flags: existing records can be read without migrations. */
export const realDataEnabled = () => process.env.OPS_REAL_DATA === "true";
export const clientCreationEnabled = () =>
  realDataEnabled() && process.env.OPS_CLIENT_CREATE === "true";

export async function operationsSession() {
  const staff = await requireStaff();
  if (!staff.ok)
    redirect(
      staff.reason === "unauthenticated"
        ? "/admin/login?next=%2Fadmin%2Fnext"
        : "/admin/login?error=forbidden"
    );
  const db = await createClient();
  const { data, error } = await db.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data?.currentLevel)
    throw new Error("Could not verify your session. Please sign in again.");
  if (data?.currentLevel === "aal1" && data.nextLevel === "aal2")
    redirect("/admin/security");
  // Cookie-scoped reads/writes retain RLS. Never use a service key for this workspace.
  return { db, staff };
}

/** React cache deduplicates only within this request, not between staff sessions. */
export const loadOperations = cache(async (): Promise<OperationsData> => {
  if (!realDataEnabled()) throw new Error("Real-record mode is not enabled.");
  const { db } = await operationsSession();
  const limit = 1000;
  const result = await db
    .from("tenants")
    .select(
      "id,name,status,contact_name,contact_email,contact_phone,vertical,notes,created_at",
      { count: "exact" }
    )
    .eq("type", "client")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (result.error)
    throw new Error(
      "Your client records could not be loaded. No demo data has been substituted."
    );
  const clients = result.data ?? [];
  const ids = clients.map((c) => c.id);
  const empty = { data: [], error: null, count: 0 };
  const queries = await Promise.all([
    ids.length
      ? db
          .from("projects")
          .select(
            "id,tenant_id,name,stage,overview,next_action,next_action_owner,account_owner,proposal_status,accepted_at,created_at",
            { count: "exact" }
          )
          .in("tenant_id", ids)
          .order("created_at", { ascending: false })
          .limit(limit)
      : empty,
    ids.length
      ? db
          .from("invoices")
          .select("id,tenant_id,project_id,type,amount,status,due_at,created_at", {
            count: "exact",
          })
          .in("tenant_id", ids)
          .order("created_at", { ascending: false })
          .limit(limit)
      : empty,
    ids.length
      ? db
          .from("subscriptions")
          .select("id,tenant_id,plan,mrr,status,provider,created_at", { count: "exact" })
          .in("tenant_id", ids)
          .order("created_at", { ascending: false })
          .limit(limit)
      : empty,
    ids.length
      ? db
          .from("order_forms")
          .select("id,tenant_id,project_id,reference,status,accepted_at,created_at", {
            count: "exact",
          })
          .in("tenant_id", ids)
          .order("created_at", { ascending: false })
          .limit(limit)
      : empty,
    db
      .from("leads")
      .select("id,name,email,status,vertical,created_at", { count: "exact" })
      .neq("status", "lost")
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);
  const labels = ["Projects", "Invoices", "Subscriptions", "Agreements", "Enquiries"];
  const unavailable = queries.flatMap((r, i) => (r.error ? [labels[i]] : []));
  const limited = queries.flatMap((r, i) => ((r.count ?? 0) > limit ? [labels[i]] : []));
  if ((result.count ?? 0) > limit) limited.unshift("Clients");
  return {
    clients,
    projects: queries[0].data ?? [],
    invoices: queries[1].data ?? [],
    subscriptions: queries[2].data ?? [],
    agreements: queries[3].data ?? [],
    leads: queries[4].data ?? [],
    unavailable,
    limited,
    loadedAt: new Date().toISOString(),
  } as OperationsData;
});
