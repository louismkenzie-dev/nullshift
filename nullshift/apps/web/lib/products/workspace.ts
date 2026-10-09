import { createServiceClient } from "@nullshift/db";

type Service = ReturnType<typeof createServiceClient>;

export type ProductWorkspace = {
  tenantId: string;
  tenantName: string;
  role: string;
  selfServe: boolean;
};

/**
 * Resolve (or provision) the workspace a signed-in self-serve user acts in.
 *
 * A user who signs up at /app has an auth account and nothing else. On first
 * landing we give them a tenant (`self_serve = true`) and a `client_admin`
 * membership so the same RLS helpers the bespoke portal uses
 * (`is_member_of`) scope every product table to them. Idempotent: an existing
 * membership is reused, whichever surface created it.
 *
 * Internal staff get their internal tenant back so they can trial products
 * without polluting the client list.
 */
export async function ensureProductWorkspace(opts: {
  userId: string;
  email: string | null;
  name?: string | null;
}): Promise<ProductWorkspace> {
  const service = createServiceClient();

  const { data: memberships } = await service
    .from("memberships")
    .select("tenant_id, role, tenants(name, self_serve)")
    .eq("user_id", opts.userId)
    .order("created_at", { ascending: true });

  const rows = (memberships ?? []) as unknown as {
    tenant_id: string;
    role: string;
    tenants: { name: string; self_serve: boolean } | null;
  }[];

  // Prefer a workspace they administer; staff fall back to their internal tenant.
  const preferred =
    rows.find((m) => m.role === "client_admin" || m.role === "owner") ??
    rows.find((m) => m.role === "staff") ??
    rows[0];

  if (preferred) {
    return {
      tenantId: preferred.tenant_id,
      tenantName: preferred.tenants?.name ?? "Workspace",
      role: preferred.role,
      selfServe: preferred.tenants?.self_serve ?? false,
    };
  }

  const name =
    (opts.name ?? "").trim() || (opts.email ? opts.email.split("@")[0] : "Workspace");
  const { data: tenant, error } = await service
    .from("tenants")
    .insert({
      name,
      type: "client",
      self_serve: true,
      contact_email: opts.email,
      contact_name: opts.name ?? null,
    })
    .select("id, name")
    .single();
  if (error || !tenant) throw new Error(error?.message ?? "Could not create workspace");

  await service
    .from("profiles")
    .upsert(
      { id: opts.userId, email: opts.email, full_name: opts.name ?? null },
      { onConflict: "id" }
    );
  await service
    .from("memberships")
    .insert({ user_id: opts.userId, tenant_id: tenant.id, role: "client_admin" });

  return {
    tenantId: tenant.id,
    tenantName: tenant.name,
    role: "client_admin",
    selfServe: true,
  };
}

/** Rename the workspace (shown in the console header and on client-facing pages). */
export async function renameWorkspace(service: Service, tenantId: string, name: string) {
  await service
    .from("tenants")
    .update({ name: name.trim().slice(0, 120) })
    .eq("id", tenantId);
}
