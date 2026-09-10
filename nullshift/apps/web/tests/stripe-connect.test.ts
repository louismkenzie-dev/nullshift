import { describe, it, expect } from "vitest";
import {
  STRIPE_CONNECT_AUTHORIZE_URL,
  buildConnectAuthorizeUrl,
} from "@nullshift/billing/connect";
import {
  CONNECT_STATE_TTL_MS,
  buildConnectStartUrl,
  connectOutcomeMessage,
  expectedAccountMatch,
  mintConnectState,
  readConnectState,
  signTenantLink,
  verifyTenantLink,
} from "@/lib/billing/stripeConnect";

/**
 * Stripe Connect OAuth: connecting a client's EXISTING Stripe account to the
 * platform. Everything asserted here is the part that has to be right before
 * an authorization code is ever spent — the authorize URL Stripe is handed,
 * and the two signatures that decide who may start the flow and whether the
 * callback is genuine.
 */

const SECRET = "sk_test_not_a_real_key";
const TENANT = "11111111-2222-4333-8444-555555555555";
const SUFFOLK = "acct_1UC2iME3tB9ZkF3C";
const REDIRECT = "https://nullshift.co.uk/api/stripe/oauth/callback";

describe("authorize URL", () => {
  const url = new URL(
    buildConnectAuthorizeUrl({
      clientId: "ca_test_client",
      redirectUri: REDIRECT,
      state: "state-token",
      email: "finance@example.com",
      businessName: "Suffolk Tennis",
    })
  );

  it("points at Stripe's Connect authorize endpoint", () => {
    expect(`${url.origin}${url.pathname}`).toBe(STRIPE_CONNECT_AUTHORIZE_URL);
  });

  it("asks for a read_write authorization code against our redirect", () => {
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe("read_write");
    expect(url.searchParams.get("client_id")).toBe("ca_test_client");
    expect(url.searchParams.get("redirect_uri")).toBe(REDIRECT);
    expect(url.searchParams.get("state")).toBe("state-token");
  });

  it("lands on sign-in, not sign-up — the account already exists", () => {
    expect(url.searchParams.get("stripe_landing")).toBe("login");
  });

  it("prefills the client's details when we know them", () => {
    expect(url.searchParams.get("stripe_user[email]")).toBe("finance@example.com");
    expect(url.searchParams.get("stripe_user[business_name]")).toBe("Suffolk Tennis");
    const bare = new URL(
      buildConnectAuthorizeUrl({
        clientId: "ca_test_client",
        redirectUri: REDIRECT,
        state: "s",
      })
    );
    expect(bare.searchParams.has("stripe_user[email]")).toBe(false);
  });
});

describe("state token", () => {
  it("round-trips the tenant, origin and expected account", () => {
    const token = mintConnectState(
      { tenantId: TENANT, origin: "link", expectedAccountId: SUFFOLK },
      SECRET
    );
    const state = readConnectState(token, SECRET);
    expect(state?.t).toBe(TENANT);
    expect(state?.o).toBe("link");
    expect(state?.x).toBe(SUFFOLK);
  });

  it("is unique per mint — the nonce is fresh", () => {
    const a = mintConnectState({ tenantId: TENANT, origin: "admin" }, SECRET);
    const b = mintConnectState({ tenantId: TENANT, origin: "admin" }, SECRET);
    expect(a).not.toBe(b);
  });

  it("refuses a forged, tampered or wrongly-keyed token", () => {
    const token = mintConnectState({ tenantId: TENANT, origin: "admin" }, SECRET);
    const [payload, sig] = token.split(".");
    expect(readConnectState(token, "another-secret")).toBeNull();
    expect(readConnectState(`${payload}.${"x".repeat(sig.length)}`, SECRET)).toBeNull();
    // Re-signing a swapped payload with a key the attacker does not have.
    const swapped = Buffer.from(
      JSON.stringify({ t: TENANT, n: "n".repeat(32), e: Date.now() + 1000, o: "admin" })
    ).toString("base64url");
    expect(readConnectState(`${swapped}.${sig}`, SECRET)).toBeNull();
    expect(readConnectState("not-a-token", SECRET)).toBeNull();
    expect(readConnectState(null, SECRET)).toBeNull();
  });

  it("expires", () => {
    const now = Date.now();
    const token = mintConnectState({ tenantId: TENANT, origin: "admin" }, SECRET, now);
    expect(
      readConnectState(token, SECRET, now + CONNECT_STATE_TTL_MS - 1000)
    ).not.toBeNull();
    expect(readConnectState(token, SECRET, now + CONNECT_STATE_TTL_MS + 1)).toBeNull();
  });

  it("drops an expected account id that is not an acct_ reference", () => {
    const token = mintConnectState(
      { tenantId: TENANT, origin: "link", expectedAccountId: "acct_../../evil" },
      SECRET
    );
    expect(readConnectState(token, SECRET)?.x).toBeUndefined();
  });
});

describe("start link signature", () => {
  it("only verifies for the tenant it was minted for", () => {
    const sig = signTenantLink(TENANT, SECRET);
    expect(verifyTenantLink(TENANT, sig, SECRET)).toBe(true);
    expect(verifyTenantLink("99999999-2222-4333-8444-555555555555", sig, SECRET)).toBe(
      false
    );
    expect(verifyTenantLink(TENANT, sig, "another-secret")).toBe(false);
    expect(verifyTenantLink(TENANT, null, SECRET)).toBe(false);
    expect(verifyTenantLink(TENANT, "", SECRET)).toBe(false);
  });

  it("builds a link the connect route accepts", () => {
    const url = new URL(
      buildConnectStartUrl({
        tenantId: TENANT,
        secret: SECRET,
        expectedAccountId: SUFFOLK,
        base: "https://nullshift.co.uk",
      })
    );
    expect(url.pathname).toBe("/api/stripe/connect");
    expect(url.searchParams.get("tenant")).toBe(TENANT);
    expect(url.searchParams.get("expect")).toBe(SUFFOLK);
    expect(verifyTenantLink(TENANT, url.searchParams.get("sig"), SECRET)).toBe(true);
  });

  it("leaves out an expectation that is not an account id", () => {
    const url = new URL(
      buildConnectStartUrl({
        tenantId: TENANT,
        secret: SECRET,
        expectedAccountId: "not-an-account",
        base: "https://nullshift.co.uk",
      })
    );
    expect(url.searchParams.has("expect")).toBe(false);
  });
});

describe("expected account check", () => {
  it("reports the match without ever gating on it", () => {
    expect(expectedAccountMatch(SUFFOLK, SUFFOLK)).toBe("match");
    expect(expectedAccountMatch("acct_1SomethingElse", SUFFOLK)).toBe("mismatch");
    expect(expectedAccountMatch(SUFFOLK, null)).toBe("unset");
  });
});

describe("outcome messages", () => {
  it("names every failure and falls back for anything unrecognised", () => {
    expect(connectOutcomeMessage("expired_code")).toMatch(/expired/i);
    expect(connectOutcomeMessage("state_invalid")).toMatch(/verify/i);
    expect(connectOutcomeMessage("account_taken")).toMatch(/different client/i);
    expect(connectOutcomeMessage("something-made-up")).toBe(
      connectOutcomeMessage("stripe_error")
    );
    expect(connectOutcomeMessage(null)).toBeNull();
  });
});
