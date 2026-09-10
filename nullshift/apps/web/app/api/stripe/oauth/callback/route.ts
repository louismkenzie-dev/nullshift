import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@nullshift/db";
import { logAuditAsService } from "@nullshift/db/audit";
import { exchangeAuthorizationCode } from "@nullshift/billing/connect";
import {
  CONNECT_STATE_COOKIE,
  CONNECT_STATE_COOKIE_PATH,
  type ConnectOrigin,
  type ConnectOutcome,
  type ConnectState,
  connectSigningSecret,
  expectedAccountMatch,
  readConnectState,
  safeEqual,
  signTenantLink,
} from "@/lib/billing/stripeConnect";

export const dynamic = "force-dynamic";

/**
 * Finish the Stripe Connect OAuth handshake: Stripe redirects the client here
 * with `code` + `state` once they have authorised their existing account.
 *
 * Order matters. The state is verified BEFORE the code is spent — signature,
 * cookie match, expiry — because an authorization code is single-use and
 * spending one on an unverified callback is exactly the CSRF this protects
 * against. Only then is the code exchanged for the connected account id, which
 * is written to the tenant. The access token from that exchange is used for
 * nothing and stored nowhere (see packages/billing/src/connect.ts).
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const base = req.url;
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const stripeError = url.searchParams.get("error");
  const stripeErrorDescription = url.searchParams.get("error_description");

  const secret = connectSigningSecret();

  /** Every response clears the state cookie — it is single-use either way. */
  const respond = (to: string) => {
    const res = NextResponse.redirect(new URL(to, base));
    res.cookies.set(CONNECT_STATE_COOKIE, "", {
      path: CONNECT_STATE_COOKIE_PATH,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 0,
    });
    res.headers.set("Cache-Control", "no-store");
    return res;
  };

  /** Nothing trustworthy to route on — say so plainly and stop. */
  const unverifiable = (why: string) => {
    console.warn(`[stripe-connect] callback refused: ${why}`);
    return respond(
      `/error?message=${encodeURIComponent(
        "This Stripe connection could not be verified. Please start the connection again."
      )}`
    );
  };

  if (!secret) return unverifiable("no signing secret configured");

  // 1. The state must be one we signed, unexpired, and byte-identical to the
  //    cookie we set when the flow started.
  const state: ConnectState | null = readConnectState(stateParam, secret);
  if (!state) return unverifiable("state missing, forged or expired");

  const cookieState = req.cookies.get(CONNECT_STATE_COOKIE)?.value;
  const tenantId = state.t;
  const origin: ConnectOrigin = state.o;

  const settle = (outcome: ConnectOutcome, accountId?: string, expected?: string) => {
    if (origin === "admin") {
      const q = new URLSearchParams({ stripe_connect: outcome });
      if (accountId) q.set("account", accountId);
      if (expected) q.set("expected", expected);
      return respond(`/admin/clients/${tenantId}/billing?${q.toString()}`);
    }
    const q = new URLSearchParams({
      tenant: tenantId,
      sig: signTenantLink(tenantId, secret),
    });
    if (outcome !== "connected") q.set("outcome", outcome);
    return respond(`/stripe/connected?${q.toString()}`);
  };

  if (!cookieState || !safeEqual(cookieState, stateParam ?? "")) {
    console.warn(
      `[stripe-connect] state/cookie mismatch for tenant ${tenantId} — refusing to spend the code`
    );
    return settle("state_invalid");
  }

  // 2. Stripe's own refusals (the client cancelled, or the request was bad).
  if (stripeError) {
    console.warn(
      `[stripe-connect] Stripe returned ${stripeError} for tenant ${tenantId}: ${stripeErrorDescription ?? "no description"}`
    );
    return settle(stripeError === "access_denied" ? "access_denied" : "stripe_error");
  }
  if (!code) return settle("missing_code");

  // 3. Spend the code. Nothing about the token is logged or persisted.
  const exchange = await exchangeAuthorizationCode(code);
  if (!exchange.ok) {
    console.error(
      `[stripe-connect] token exchange failed (${exchange.failure}) for tenant ${tenantId}: ${exchange.message}`
    );
    const outcome: ConnectOutcome =
      exchange.failure === "expired_code"
        ? "expired_code"
        : exchange.failure === "no_account_id"
          ? "no_account_id"
          : exchange.failure === "unconfigured"
            ? "not_configured"
            : "stripe_error";
    return settle(outcome);
  }

  const { accountId, livemode } = exchange;
  const match = expectedAccountMatch(accountId, state.x);
  // The onboarding check: did the account we were aiming at come back? Logged
  // whichever way, so a mismatch is visible in the platform logs and not only
  // on whichever screen the client happened to land on.
  console.info(
    `[stripe-connect] tenant ${tenantId} connected ${accountId} (livemode=${livemode}, expected=${
      state.x ?? "none"
    }, ${match})`
  );

  // 4. Persist. The connection is worthless if this does not land, so a failure
  //    is surfaced rather than swallowed behind a success page.
  const service = createServiceClient();
  // `.select()` so a client deleted mid-handshake — an update that matches no
  // row and reports no error — is caught rather than confirmed as connected.
  const { data: written, error: writeError } = await service
    .from("tenants")
    .update({
      stripe_connect_account_id: accountId,
      stripe_connect_status: "connected",
      stripe_connected_at: new Date().toISOString(),
      stripe_connect_livemode: livemode,
    })
    .eq("id", tenantId)
    .select("id");

  if (writeError || !written?.length) {
    const taken = writeError?.code === "23505";
    console.error(
      `[stripe-connect] persisting ${accountId} for tenant ${tenantId} failed: ${
        writeError?.message ?? "no such client"
      }`
    );
    await logAuditAsService({
      action: "stripe_connect.failed",
      target: `tenant:${tenantId}`,
      tenantId,
      metadata: {
        account_id: accountId,
        reason: taken ? "account_already_connected" : "persist_failed",
        origin,
      },
    });
    return settle(taken ? "account_taken" : "persist_failed", accountId, match);
  }

  await logAuditAsService({
    action: "stripe_connect.connected",
    target: `tenant:${tenantId}`,
    tenantId,
    metadata: {
      account_id: accountId,
      livemode,
      origin,
      expected_account_id: state.x ?? null,
      expected_match: match,
    },
  });

  return settle("connected", accountId, match);
}
