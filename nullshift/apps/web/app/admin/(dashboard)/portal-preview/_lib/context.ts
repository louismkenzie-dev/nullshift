import {
  DEFAULT_PORTAL_CLIENT,
  isPortalRole,
  portalClientById,
  type PortalClient,
  type PortalRole,
} from "@/lib/next/fixtures-portal";

/**
 * Preview context for the portal prototype, taken from the URL only:
 *   ?client=northline|harbour|orbit|cedar|brightwell
 *   ?role=signatory|project|billing
 *   ?wide=1
 * Unknown values fall back to the defaults; nothing is read from cookies, the
 * database or a session, so staff can share a link that reproduces a screen.
 */
export type PortalCtx = {
  client: PortalClient;
  role: PortalRole;
  wide: boolean;
};

export type SearchParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

export function resolveCtx(sp: SearchParams): PortalCtx {
  const client =
    portalClientById(first(sp.client)) ?? portalClientById(DEFAULT_PORTAL_CLIENT)!;
  const roleRaw = first(sp.role);
  const role: PortalRole = isPortalRole(roleRaw) ? roleRaw : "signatory";
  const wide = first(sp.wide) === "1";
  return { client, role, wide };
}

export const PORTAL_BASE = "/admin/portal-preview";

/** Build a link inside the preview that preserves client, role and width. */
export function portalHref(
  path: string,
  ctx: PortalCtx,
  overrides: Partial<{ client: string; role: PortalRole; wide: boolean }> = {}
): string {
  const q = new URLSearchParams();
  const client = overrides.client ?? ctx.client.id;
  const role = overrides.role ?? ctx.role;
  const wide = overrides.wide ?? ctx.wide;
  if (client !== DEFAULT_PORTAL_CLIENT) q.set("client", client);
  if (role !== "signatory") q.set("role", role);
  if (wide) q.set("wide", "1");
  const qs = q.toString();
  const p = path === "" ? PORTAL_BASE : `${PORTAL_BASE}/${path}`;
  return qs ? `${p}?${qs}` : p;
}
