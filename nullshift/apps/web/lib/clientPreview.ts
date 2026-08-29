import { cookies } from "next/headers";
import { createClient, createServiceClient } from "@nullshift/db";
import { isAdminEmail } from "@nullshift/auth/admin";
import type { User } from "@supabase/supabase-js";

/**
 * Staff "view as client" preview for the portal.
 *
 * A staff member opens a client's portal exactly as that client sees it: the
 * real pages, the real gates, the real data — read-only. The mechanism is a
 * cookie scoped to /portal naming the tenant; when it's present AND the caller
 * is verified staff, getPortalClient() hands the portal pages a tenant-scoped
 * READ-ONLY data client instead of the usual RLS client:
 *
 * - every `.from(table).select(...)` is force-filtered to the previewed tenant
 *   (staff-wide RLS visibility would otherwise blend every tenant's rows into
 *   pages that rely on RLS to mean "just mine");
 * - writes through the page client throw — preview never mutates;
 * - the portal's server actions must ALSO call isClientPreview() and bail, as
 *   they build their own clients and several (sign, decide) would otherwise
 *   act on the client's real data under a staff caller.
 *
 * The cookie alone grants nothing: a non-staff user carrying it just gets the
 * normal RLS client. Nothing here changes what real clients see.
 */

export const PREVIEW_COOKIE = "ns_client_preview";

/** Which column pins a table to a tenant. Everything else uses tenant_id —
 *  a table without one fails the query, so unknown tables fail closed. */
const TENANT_COL: Record<string, string> = { tenants: "id" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type AnyDb = {
  from(table: string): {
    select(...args: unknown[]): unknown;
  };
  storage: unknown;
  rpc(...args: unknown[]): unknown;
  auth: { getUser(): Promise<{ data: { user: User | null }; error: null }> };
};

/**
 * Tenant-scoped read-only facade over the service client. Reads chain exactly
 * like the real client (`select()` returns the genuine PostgREST builder with
 * the tenant filter already applied); writes throw.
 */
export function scopedReadOnlyDb(
  service: ReturnType<typeof createServiceClient>,
  tenantId: string,
  user: User | null
) {
  const wrapped: AnyDb = {
    from(table: string) {
      const col = TENANT_COL[table] ?? "tenant_id";
      const blocked = () => {
        throw new Error(`client preview is read-only — write to "${table}" blocked`);
      };
      return {
        select: (...args: unknown[]) =>
          (
            service.from(table).select as unknown as (
              ...a: unknown[]
            ) => ReturnType<ReturnType<typeof service.from>["select"]>
          )(...args).eq(col, tenantId),
        insert: blocked,
        update: blocked,
        upsert: blocked,
        delete: blocked,
      };
    },
    storage: service.storage,
    rpc: (...args: unknown[]) =>
      (service.rpc as unknown as (...a: unknown[]) => unknown)(...args),
    auth: { getUser: async () => ({ data: { user }, error: null }) },
  };
  return wrapped as unknown as Awaited<ReturnType<typeof createClient>>;
}

export type PortalPreview = {
  tenantId: string;
  tenantName: string;
  contactName: string | null;
  contactEmail: string | null;
};

/**
 * The one data-client entry point for portal pages. Normal visitors get the
 * usual RLS client; verified staff carrying the preview cookie get the scoped
 * read-only client plus the preview descriptor for the banner.
 */
export async function getPortalClient(): Promise<{
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: User | null;
  preview: PortalPreview | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const tenantId = (await cookies()).get(PREVIEW_COOKIE)?.value ?? "";
  if (!user || !UUID_RE.test(tenantId)) return { supabase, user, preview: null };

  // Same staff test as requireStaff() — membership RPC, allowlist fallback.
  const { data: isStaff } = await supabase.rpc("is_internal_staff");
  const allowed = isStaff === true || (user.email ? isAdminEmail(user.email) : false);
  if (!allowed) return { supabase, user, preview: null };

  const service = createServiceClient();
  const { data: tenant } = await service
    .from("tenants")
    .select("id, name, contact_name, contact_email")
    .eq("id", tenantId)
    .maybeSingle();
  if (!tenant) return { supabase, user, preview: null };

  return {
    supabase: scopedReadOnlyDb(service, tenantId, user),
    user,
    preview: {
      tenantId,
      tenantName: tenant.name as string,
      contactName: (tenant.contact_name as string | null) ?? null,
      contactEmail: (tenant.contact_email as string | null) ?? null,
    },
  };
}

/**
 * Guard for the portal's server actions: true when the request carries the
 * preview cookie. Every portal action must bail out when this is set — the
 * preview is view-only, and several actions (signing, deciding) would act on
 * the client's REAL data under the staff caller otherwise. Deliberately
 * cookie-only: if the cookie is present at all, acting is never right (a real
 * client never has it; path-scoping keeps it off non-portal routes).
 */
export async function isClientPreview(): Promise<boolean> {
  return !!(await cookies()).get(PREVIEW_COOKIE)?.value;
}
