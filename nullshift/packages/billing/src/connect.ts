import Stripe from "stripe";
import { getStripe } from "./stripe";

/**
 * Stripe Connect OAuth — attaching an EXISTING Stripe account to the Nullshift
 * platform (Nullshift Development Ltd).
 *
 * This is deliberately NOT account creation. The client already runs their own
 * Standard, full-dashboard Stripe account; the OAuth handshake authorises the
 * platform to act on it (and to take the 2% application fee — see fees.ts),
 * leaving them the owner of the account, the dashboard and the payouts. So
 * nothing here calls accounts.create, account links or Express/Custom
 * onboarding: the only two moves are "send them to Stripe's authorize screen"
 * and "swap the code Stripe hands back for the connected account id".
 *
 * The access token the exchange returns is intentionally NOT persisted. With a
 * Standard account the platform acts on the connected account by passing
 * `stripeAccount: <acct_…>` with its OWN secret key, so storing a second live
 * credential per client would be a liability with no use. All we keep is the
 * account id (see tenants.stripe_connect_account_id, migration 0051).
 *
 * Server-only — the platform secret key signs the token exchange. NEVER import
 * from a client component.
 */

/** Stripe's Connect OAuth authorize endpoint (the token endpoint is below). */
export const STRIPE_CONNECT_AUTHORIZE_URL = "https://connect.stripe.com/oauth/authorize";

/** The platform's Connect client id (Dashboard → Connect → Settings, `ca_…`). */
export function connectClientId(): string | null {
  return process.env.STRIPE_CONNECT_CLIENT_ID || null;
}

/** Both halves must be present: the client id names the platform, the secret key signs the exchange. */
export function isConnectOAuthConfigured(): boolean {
  return !!process.env.STRIPE_CONNECT_CLIENT_ID && !!process.env.STRIPE_SECRET_KEY;
}

/** `acct_…` — the shape Stripe returns as stripe_user_id. */
export const CONNECTED_ACCOUNT_RE = /^acct_[A-Za-z0-9]{8,}$/;

/**
 * The URL we send the client to. `scope=read_write` is what lets the platform
 * charge on their behalf; `stripe_landing=login` matters because the account
 * ALREADY EXISTS — the default for read_write is Stripe's "create an account"
 * screen, which is exactly the wrong door for this flow.
 */
export function buildConnectAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  /** Prefills Stripe's sign-in screen — never trusted, never authorisation. */
  email?: string | null;
  businessName?: string | null;
}): string {
  const q = new URLSearchParams({
    response_type: "code",
    client_id: params.clientId,
    scope: "read_write",
    redirect_uri: params.redirectUri,
    state: params.state,
    stripe_landing: "login",
  });
  if (params.email) q.set("stripe_user[email]", params.email);
  if (params.businessName) q.set("stripe_user[business_name]", params.businessName);
  return `${STRIPE_CONNECT_AUTHORIZE_URL}?${q.toString()}`;
}

export type ConnectExchangeFailure =
  | "unconfigured"
  | "expired_code"
  | "stripe_error"
  | "no_account_id";

export type ConnectExchangeResult =
  | { ok: true; accountId: string; livemode: boolean; scope: string | null }
  | { ok: false; failure: ConnectExchangeFailure; message: string };

/**
 * Swap the one-shot authorization code for the connected account id, against
 * `POST https://connect.stripe.com/oauth/token` with the platform secret key.
 *
 * Codes are single-use and short-lived, so `invalid_grant` — a refresh, a
 * re-used link, a code left sitting — is a normal outcome, not a bug, and is
 * reported separately so the caller can say "start the flow again" rather than
 * "something went wrong".
 */
export async function exchangeAuthorizationCode(
  code: string
): Promise<ConnectExchangeResult> {
  const stripe = getStripe();
  if (!stripe) {
    return { ok: false, failure: "unconfigured", message: "Stripe is not configured." };
  }
  try {
    const token = await stripe.oauth.token({ grant_type: "authorization_code", code });
    const accountId = token.stripe_user_id;
    if (!accountId || !CONNECTED_ACCOUNT_RE.test(accountId)) {
      return {
        ok: false,
        failure: "no_account_id",
        message: "Stripe authorised the connection but returned no account id.",
      };
    }
    return {
      ok: true,
      accountId,
      livemode: token.livemode === true,
      scope: token.scope ?? null,
    };
  } catch (e) {
    // Stripe's own message is safe to surface (it never echoes the secret key);
    // the raw error object is not logged anywhere, so nothing leaks with it.
    const message = e instanceof Error ? e.message : "Stripe token exchange failed.";
    if (e instanceof Stripe.errors.StripeInvalidGrantError) {
      return { ok: false, failure: "expired_code", message };
    }
    return { ok: false, failure: "stripe_error", message };
  }
}
