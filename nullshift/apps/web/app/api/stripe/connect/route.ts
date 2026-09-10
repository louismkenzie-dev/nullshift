import { NextResponse, type NextRequest } from "next/server";
import { requireStaff } from "@nullshift/auth/guards";
import { createServiceClient } from "@nullshift/db";
import {
  CONNECTED_ACCOUNT_RE,
  buildConnectAuthorizeUrl,
  connectClientId,
  isConnectOAuthConfigured,
} from "@nullshift/billing/connect";
import {
  CONNECT_STATE_COOKIE,
  CONNECT_STATE_COOKIE_PATH,
  CONNECT_STATE_TTL_MS,
  TENANT_ID_RE,
  type ConnectOrigin,
  type ConnectOutcome,
  connectRedirectUri,
  connectSigningSecret,
  mintConnectState,
  verifyTenantLink,
} from "@/lib/billing/stripeConnect";

export const dynamic = "force-dynamic";

/**
 * Start the Stripe Connect OAuth flow for one client.
 *
 *   /api/stripe/connect?tenant=<uuid>&sig=<signature>[&expect=acct_…]
 *
 * The client authorises their OWN existing Stripe account — this route never
 * creates one. It mints a signed, expiring `state`, parks the same value in an
 * httpOnly cookie, and redirects to Stripe's authorize screen with
 * scope=read_write. /api/stripe/oauth/callback finishes the handshake.
 *
 * Who may start it: staff (session), or anyone holding a link we signed. The
 * signature is the whole access control for the emailed case — see
 * lib/billing/stripeConnect.ts.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const tenantId = (url.searchParams.get("tenant") ?? "").trim();
  const sig = url.searchParams.get("sig");
  const expectParam = (url.searchParams.get("expect") ?? "").trim();

  // Relative to the request, never NEXT_PUBLIC_SITE_URL — on a preview
  // deployment that points at production and would throw staff out to the live
  // hub mid-flow (same reasoning as the client-preview route).
  const base = req.url;
  const refuse = (code: ConnectOutcome, origin: ConnectOrigin) => {
    const to =
      origin === "admin"
        ? TENANT_ID_RE.test(tenantId)
          ? `/admin/clients/${tenantId}/billing?stripe_connect=${code}`
          : `/admin/clients?stripe_connect=${code}`
        : `/error?message=${encodeURIComponent(
            "This Stripe connection link could not be opened. Ask Nullshift for a fresh one."
          )}`;
    return NextResponse.redirect(new URL(to, base));
  };

  const staff = await requireStaff();
  const origin: ConnectOrigin = staff.ok ? "admin" : "link";

  const secret = connectSigningSecret();
  if (!secret || !isConnectOAuthConfigured()) return refuse("not_configured", origin);

  if (!TENANT_ID_RE.test(tenantId)) return refuse("missing_tenant", origin);

  // A session authorises staff; everyone else needs the signature we minted.
  if (!staff.ok && !verifyTenantLink(tenantId, sig, secret)) {
    return refuse("link_invalid", origin);
  }

  // Service client: the client following an emailed link has no session, so
  // there is no RLS context to read the tenant under.
  const { data: tenant } = await createServiceClient()
    .from("tenants")
    .select("id, name, contact_email")
    .eq("id", tenantId)
    .maybeSingle();
  if (!tenant) return refuse("unknown_client", origin);

  const clientId = connectClientId();
  if (!clientId) return refuse("not_configured", origin);

  const expectedAccountId = CONNECTED_ACCOUNT_RE.test(expectParam) ? expectParam : null;
  const state = mintConnectState({ tenantId, origin, expectedAccountId }, secret);

  const authorizeUrl = buildConnectAuthorizeUrl({
    clientId,
    redirectUri: connectRedirectUri(),
    state,
    email: (tenant as { contact_email?: string | null }).contact_email ?? null,
    businessName: (tenant as { name?: string | null }).name ?? null,
  });

  const res = NextResponse.redirect(authorizeUrl);
  res.cookies.set(CONNECT_STATE_COOKIE, state, {
    path: CONNECT_STATE_COOKIE_PATH,
    httpOnly: true,
    // Stripe sends the browser back with a top-level GET, which "lax" allows
    // and "strict" would strip — stripping it turns every real return into a
    // CSRF refusal.
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: Math.floor(CONNECT_STATE_TTL_MS / 1000),
  });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
