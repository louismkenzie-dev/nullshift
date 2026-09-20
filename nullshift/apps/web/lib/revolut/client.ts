/**
 * Revolut Business API client — READ-ONLY by construction.
 *
 * The only non-GET requests this module can make are the two OAuth token
 * calls (`POST /auth/token` for authorization_code and refresh_token). There
 * is no generic `post()`; `apiGet` is the only path to the business
 * endpoints, so payment initiation, beneficiaries, transfers and exchanges
 * cannot be reached from here (brief §10.4).
 *
 * Environments (per the Business API reference):
 *   production  https://b2b.revolut.com/api/1.0          consent https://business.revolut.com/app-confirm
 *   sandbox     https://sandbox-b2b.revolut.com/api/1.0  consent https://sandbox-business.revolut.com/app-confirm
 *
 * Tokens: access tokens live 40 minutes; the refresh token is obtained once
 * at consent and is used with a fresh client assertion to mint new access
 * tokens. Revolut can require re-consent (e.g. after the refresh token is
 * revoked or the certificate changes); the sync surfaces that as an error
 * and the page offers "Connect Revolut" again.
 *
 * Nothing here logs tokens or includes them in thrown errors.
 */

import { buildClientAssertion } from "./jwt";
import { sanitiseError } from "./crypto";

export type RevolutEnvironment = "production" | "sandbox";

export const BASE_URLS: Record<RevolutEnvironment, string> = {
  production: "https://b2b.revolut.com/api/1.0",
  sandbox: "https://sandbox-b2b.revolut.com/api/1.0",
};

export const CONSENT_URLS: Record<RevolutEnvironment, string> = {
  production: "https://business.revolut.com/app-confirm",
  sandbox: "https://sandbox-business.revolut.com/app-confirm",
};

export const CLIENT_ASSERTION_TYPE = "urn:ietf:params:oauth:client-assertion-type:jwt-bearer";

/** Documented maximum page size for GET /transactions. */
export const MAX_TRANSACTIONS_PER_PAGE = 1000;

export type RevolutEnv = {
  environment: RevolutEnvironment;
  clientId: string;
  issuer: string;
  privateKeyPem: string;
};

export function readRevolutEnv(
  env: NodeJS.ProcessEnv = process.env
): { ok: true; value: RevolutEnv } | { ok: false; missing: string[] } {
  const missing: string[] = [];
  const clientId = env.REVOLUT_CLIENT_ID?.trim();
  const issuer = env.REVOLUT_ISSUER?.trim();
  const privateKeyPem = env.REVOLUT_PRIVATE_KEY;
  const rawEnv = (env.REVOLUT_ENVIRONMENT ?? "sandbox").trim().toLowerCase();
  if (!clientId) missing.push("REVOLUT_CLIENT_ID");
  if (!issuer) missing.push("REVOLUT_ISSUER");
  if (!privateKeyPem) missing.push("REVOLUT_PRIVATE_KEY");
  if (!env.REVOLUT_TOKEN_ENCRYPTION_KEY) missing.push("REVOLUT_TOKEN_ENCRYPTION_KEY");
  if (rawEnv !== "production" && rawEnv !== "sandbox") missing.push("REVOLUT_ENVIRONMENT");
  if (missing.length) return { ok: false, missing };
  return {
    ok: true,
    value: {
      environment: rawEnv as RevolutEnvironment,
      clientId: clientId!,
      issuer: issuer!,
      privateKeyPem: privateKeyPem!,
    },
  };
}

export function isRevolutConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return readRevolutEnv(env).ok;
}

/** The consent URL the staff user is redirected to. */
export function buildConsentUrl(input: {
  environment: RevolutEnvironment;
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const u = new URL(CONSENT_URLS[input.environment]);
  u.searchParams.set("client_id", input.clientId);
  u.searchParams.set("redirect_uri", input.redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("state", input.state);
  return u.toString();
}

/* ── Types (subset of the API reference we read) ─────────────────────────── */

export type RevolutTokenResponse = {
  access_token: string;
  token_type: "bearer" | string;
  expires_in: number;
  refresh_token?: string;
};

export type RevolutAccount = {
  id: string;
  name?: string;
  balance: number;
  currency: string;
  state: "active" | "inactive" | string;
  public?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type RevolutTransactionLeg = {
  leg_id: string;
  account_id: string;
  amount: number;
  fee?: number;
  currency: string;
  description?: string;
  balance?: number;
  bill_amount?: number;
  bill_currency?: string;
  counterparty?: {
    id?: string;
    account_id?: string;
    account_type?: string;
    name?: string;
  };
};

export type RevolutTransaction = {
  id: string;
  type: string;
  state: string;
  request_id?: string;
  created_at: string;
  updated_at?: string;
  completed_at?: string;
  reference?: string;
  reason_code?: string;
  merchant?: { name?: string; city?: string; category_code?: string; country?: string };
  card?: { card_number?: string; first_name?: string; last_name?: string; phone?: string };
  legs: RevolutTransactionLeg[];
};

export class RevolutApiError extends Error {
  status: number;
  /** True when the token is unusable and a new consent is needed. */
  reconsent: boolean;
  constructor(message: string, status: number, reconsent = false) {
    super(sanitiseError(message));
    this.name = "RevolutApiError";
    this.status = status;
    this.reconsent = reconsent;
  }
}

/* ── Client ──────────────────────────────────────────────────────────────── */

export type Fetch = typeof fetch;

export class RevolutClient {
  private readonly base: string;
  constructor(
    private readonly env: RevolutEnv,
    private readonly fetchImpl: Fetch = fetch
  ) {
    this.base = BASE_URLS[env.environment];
  }

  /* — OAuth (the only POSTs in this module) — */

  private async token(params: Record<string, string>): Promise<RevolutTokenResponse> {
    const body = new URLSearchParams({
      client_id: this.env.clientId,
      client_assertion_type: CLIENT_ASSERTION_TYPE,
      client_assertion: buildClientAssertion(this.env),
      ...params,
    });
    const res = await this.fetchImpl(`${this.base}/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      // 400 invalid_grant / 401 on refresh means the consent is dead.
      const reconsent = res.status === 400 || res.status === 401;
      throw new RevolutApiError(`token endpoint ${res.status}: ${text}`, res.status, reconsent);
    }
    const json = (await res.json()) as RevolutTokenResponse;
    if (!json.access_token || typeof json.expires_in !== "number")
      throw new RevolutApiError("token endpoint returned no access token", 502);
    return json;
  }

  /** authorization_code → access + refresh token. */
  exchangeCode(code: string): Promise<RevolutTokenResponse> {
    return this.token({ grant_type: "authorization_code", code });
  }

  /** refresh_token → new access token. */
  refreshAccessToken(refreshToken: string): Promise<RevolutTokenResponse> {
    return this.token({ grant_type: "refresh_token", refresh_token: refreshToken });
  }

  /* — Read-only API — */

  private async apiGet<T>(accessToken: string, path: string, query?: Record<string, string>): Promise<T> {
    const u = new URL(`${this.base}${path}`);
    for (const [k, v] of Object.entries(query ?? {})) if (v !== "") u.searchParams.set(k, v);
    const res = await this.fetchImpl(u.toString(), {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new RevolutApiError(`GET ${path} ${res.status}: ${text}`, res.status, res.status === 401);
    }
    return (await res.json()) as T;
  }

  listAccounts(accessToken: string): Promise<RevolutAccount[]> {
    return this.apiGet<RevolutAccount[]>(accessToken, "/accounts");
  }

  /**
   * All transactions in [from, to], walking pages. Revolut pages by `count`
   * (max 1000) newest-first; the next page is requested with `to` set to the
   * created_at of the oldest item seen (per the "Retrieve a list of
   * transactions" reference). Bounded by maxPages so a runaway never loops.
   */
  async listTransactions(
    accessToken: string,
    opts: { from: Date; to: Date; count?: number; maxPages?: number }
  ): Promise<RevolutTransaction[]> {
    const count = Math.min(opts.count ?? MAX_TRANSACTIONS_PER_PAGE, MAX_TRANSACTIONS_PER_PAGE);
    const maxPages = opts.maxPages ?? 20;
    const seen = new Set<string>();
    const out: RevolutTransaction[] = [];
    let to = opts.to;
    for (let page = 0; page < maxPages; page += 1) {
      const batch = await this.apiGet<RevolutTransaction[]>(accessToken, "/transactions", {
        from: opts.from.toISOString(),
        to: to.toISOString(),
        count: String(count),
      });
      let added = 0;
      for (const tx of batch) {
        if (seen.has(tx.id)) continue;
        seen.add(tx.id);
        out.push(tx);
        added += 1;
      }
      if (batch.length < count || added === 0) break;
      const oldest = batch.reduce(
        (min, tx) => (tx.created_at < min ? tx.created_at : min),
        batch[0].created_at
      );
      const next = new Date(oldest);
      if (!(next < to)) break;
      to = next;
    }
    return out;
  }
}
