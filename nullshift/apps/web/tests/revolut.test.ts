import { describe, it, expect } from "vitest";
import { generateKeyPairSync, createVerify } from "node:crypto";
import {
  buildAssertionClaims,
  buildClientAssertion,
  decodeAssertion,
  MAX_ASSERTION_TTL_SECONDS,
  REVOLUT_JWT_AUDIENCE,
  normaliseIssuer,
} from "@/lib/revolut/jwt";
import { decryptToken, encryptToken, parseEncryptionKey, sanitiseError } from "@/lib/revolut/crypto";
import { mintState, readState } from "@/lib/revolut/state";
import { buildConsentUrl, readRevolutEnv, RevolutClient } from "@/lib/revolut/client";
import {
  connectionHealth,
  mergeUpsert,
  needsRefresh,
  syncWindow,
  toMinor,
  toTransactionRows,
  LOOKBACK_MS,
  FIRST_SYNC_LOOKBACK_MS,
} from "@/lib/revolut/sync";
import {
  canAutoConfirm,
  suggestForTransaction,
  suggestMatches,
  type InvoiceCandidate,
  type MatchableTransaction,
} from "@/lib/revolut/match";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const PEM = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

/* ── JWT assertion ───────────────────────────────────────────────────────── */

describe("client assertion", () => {
  it("carries the documented claims and stays inside the 40-minute bound", () => {
    const c = buildAssertionClaims({ issuer: "nullshift.co.uk", clientId: "abc123", nowSeconds: 1_000_000 });
    expect(c).toEqual({ iss: "nullshift.co.uk", sub: "abc123", aud: REVOLUT_JWT_AUDIENCE, iat: 1_000_000, exp: 1_000_000 + 20 * 60 });
    expect(c.exp - c.iat).toBeLessThanOrEqual(MAX_ASSERTION_TTL_SECONDS);
    expect(() => buildAssertionClaims({ issuer: "nullshift.co.uk", clientId: "x", ttlSeconds: MAX_ASSERTION_TTL_SECONDS + 1 })).toThrow(/lifetime/);
  });

  it("refuses a URL as issuer (must be a bare domain)", () => {
    expect(() => normaliseIssuer("https://nullshift.co.uk")).toThrow(/bare domain/);
    expect(normaliseIssuer(" Nullshift.co.uk ")).toBe("nullshift.co.uk");
    expect(() => buildAssertionClaims({ issuer: "nullshift.co.uk", clientId: "" })).toThrow(/CLIENT_ID/);
  });

  it("signs RS256 and verifies with the public key", () => {
    const jwt = buildClientAssertion({ issuer: "nullshift.co.uk", clientId: "cid", privateKeyPem: PEM, nowSeconds: 5 });
    const { header, claims } = decodeAssertion(jwt);
    expect(header).toEqual({ alg: "RS256", typ: "JWT" });
    expect(claims.sub).toBe("cid");
    const [h, p, sig] = jwt.split(".");
    const v = createVerify("RSA-SHA256");
    v.update(`${h}.${p}`);
    expect(v.verify(publicKey, Buffer.from(sig, "base64url"))).toBe(true);
  });

  it("accepts a PEM whose newlines were escaped by the env store", () => {
    const escaped = PEM.replace(/\n/g, "\\n");
    expect(() => buildClientAssertion({ issuer: "a.co", clientId: "c", privateKeyPem: escaped })).not.toThrow();
  });
});

/* ── Token encryption ────────────────────────────────────────────────────── */

describe("token encryption", () => {
  const key = parseEncryptionKey("00".repeat(16) + "ff".repeat(16));

  it("round-trips and binds the ciphertext to the connection id", () => {
    const ct = encryptToken("oa_prod_secret", key, "conn-1");
    expect(ct).not.toContain("oa_prod_secret");
    expect(decryptToken(ct, key, "conn-1")).toBe("oa_prod_secret");
    expect(() => decryptToken(ct, key, "conn-2")).toThrow(/decrypted/);
    expect(() => decryptToken(ct, parseEncryptionKey("11".repeat(32)), "conn-1")).toThrow(/decrypted/);
  });

  it("uses a fresh IV per call", () => {
    expect(encryptToken("t", key, "a")).not.toBe(encryptToken("t", key, "a"));
  });

  it("refuses a key that is not 32 bytes of hex", () => {
    expect(() => parseEncryptionKey("abc")).toThrow(/64 hex/);
    expect(() => parseEncryptionKey(undefined)).toThrow(/64 hex/);
  });

  it("sanitises token-looking material out of error text", () => {
    const msg = sanitiseError('token endpoint 400: {"access_token":"oa_prod_AbC123","refresh_token":"oa_prod_Zz9"} Bearer abc.def.ghi');
    expect(msg).not.toContain("AbC123");
    expect(msg).not.toContain("Zz9");
    expect(msg).not.toContain("abc.def.ghi");
  });
});

/* ── Signed state ────────────────────────────────────────────────────────── */

describe("consent state", () => {
  const secret = "s".repeat(32);
  it("round-trips and expires", () => {
    const now = 1_700_000_000_000;
    const tok = mintState({ userId: "user-12345678", environment: "sandbox" }, secret, now);
    expect(readState(tok, secret, now + 1000)).toMatchObject({ u: "user-12345678", v: "sandbox" });
    expect(readState(tok, secret, now + 16 * 60 * 1000)).toBeNull();
    expect(readState(tok, "other-secret", now)).toBeNull();
    expect(readState(tok + "x", secret, now)).toBeNull();
  });
});

/* ── Client: read-only by construction ───────────────────────────────────── */

describe("Revolut client", () => {
  const env = { environment: "sandbox" as const, clientId: "cid", issuer: "nullshift.co.uk", privateKeyPem: PEM };

  it("builds the consent URL per the docs", () => {
    const u = new URL(buildConsentUrl({ environment: "production", clientId: "cid", redirectUri: "https://nullshift.co.uk/api/revolut/callback", state: "st" }));
    expect(u.origin + u.pathname).toBe("https://business.revolut.com/app-confirm");
    expect(u.searchParams.get("response_type")).toBe("code");
    expect(u.searchParams.get("client_id")).toBe("cid");
    expect(u.searchParams.get("state")).toBe("st");
  });

  it("exposes no way to POST to anything but /auth/token", () => {
    const proto = Object.getOwnPropertyNames(RevolutClient.prototype);
    expect(proto.sort()).toEqual(["apiGet", "constructor", "exchangeCode", "listAccounts", "listTransactions", "refreshAccessToken", "token"].sort());
  });

  it("only issues GETs for accounts/transactions and form POSTs for the token endpoint", async () => {
    const calls: { url: string; method: string }[] = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? "GET" });
      if (url.endsWith("/auth/token")) {
        const body = init?.body as URLSearchParams;
        expect(body.get("client_assertion_type")).toBe("urn:ietf:params:oauth:client-assertion-type:jwt-bearer");
        expect(body.get("client_assertion")).toMatch(/^ey/);
        return new Response(JSON.stringify({ access_token: "at", token_type: "bearer", expires_in: 2399, refresh_token: "rt" }), { status: 200 });
      }
      if (url.includes("/accounts")) return new Response(JSON.stringify([{ id: "a1", name: "Main", balance: 12.34, currency: "GBP", state: "active" }]), { status: 200 });
      if (url.includes("/transactions")) return new Response(JSON.stringify([]), { status: 200 });
      return new Response("nope", { status: 404 });
    }) as unknown as typeof fetch;
    const c = new RevolutClient(env, fetchImpl);
    const t = await c.exchangeCode("code");
    expect(t.refresh_token).toBe("rt");
    await c.refreshAccessToken("rt");
    await c.listAccounts("at");
    await c.listTransactions("at", { from: new Date(0), to: new Date(1000) });
    expect(calls.map((x) => x.method)).toEqual(["POST", "POST", "GET", "GET"]);
    expect(calls.filter((x) => x.method === "POST").every((x) => x.url === "https://sandbox-b2b.revolut.com/api/1.0/auth/token")).toBe(true);
  });

  it("pages transactions by moving `to` to the oldest created_at and de-duplicates", async () => {
    const mk = (i: number) => ({ id: `t${i}`, type: "transfer", state: "completed", created_at: new Date(1_000_000 - i * 1000).toISOString(), legs: [] });
    const pages = [[mk(1), mk(2)], [mk(2), mk(3)], [mk(3)]];
    let n = 0;
    const fetchImpl = (async () => new Response(JSON.stringify(pages[n++] ?? []), { status: 200 })) as unknown as typeof fetch;
    const c = new RevolutClient(env, fetchImpl);
    const all = await c.listTransactions("at", { from: new Date(0), to: new Date(2_000_000), count: 2 });
    expect(all.map((t) => t.id)).toEqual(["t1", "t2", "t3"]);
  });

  it("reads env names and reports what is missing", () => {
    const r = readRevolutEnv({ REVOLUT_ENVIRONMENT: "staging" } as unknown as NodeJS.ProcessEnv);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.missing).toEqual(["REVOLUT_CLIENT_ID", "REVOLUT_ISSUER", "REVOLUT_PRIVATE_KEY", "REVOLUT_TOKEN_ENCRYPTION_KEY", "REVOLUT_ENVIRONMENT"]);
  });
});

/* ── Sync arithmetic ─────────────────────────────────────────────────────── */

describe("sync window", () => {
  const now = new Date("2026-09-20T12:00:00Z");
  it("starts 2 days before the last sync", () => {
    const w = syncWindow("2026-09-20T11:30:00Z", now);
    expect(w.from.toISOString()).toBe(new Date(new Date("2026-09-20T11:30:00Z").getTime() - LOOKBACK_MS).toISOString());
    expect(w.to).toBe(now);
  });
  it("first run looks back 90 days", () => {
    expect(syncWindow(null, now).from.getTime()).toBe(now.getTime() - FIRST_SYNC_LOOKBACK_MS);
  });
  it("never starts after now", () => {
    expect(syncWindow("2030-01-01T00:00:00Z", now).from.getTime()).toBeLessThanOrEqual(now.getTime());
  });
  it("refreshes with < 5 minutes left, or when unknown", () => {
    expect(needsRefresh(new Date(now.getTime() + 4 * 60_000).toISOString(), now)).toBe(true);
    expect(needsRefresh(new Date(now.getTime() + 30 * 60_000).toISOString(), now)).toBe(false);
    expect(needsRefresh(null, now)).toBe(true);
  });
  it("health is never 'healthy' unless the last sync succeeded within 2 hours", () => {
    const base = { status: "active" as const, last_sync_status: "ok" as const, last_error: null };
    expect(connectionHealth({ ...base, last_sync_at: new Date(now.getTime() - 60 * 60_000).toISOString() }, now).level).toBe("healthy");
    expect(connectionHealth({ ...base, last_sync_at: new Date(now.getTime() - 3 * 60 * 60_000).toISOString() }, now).level).toBe("stale");
    expect(connectionHealth({ ...base, last_sync_status: "error", last_error: "x", last_sync_at: now.toISOString() }, now).level).toBe("error");
    expect(connectionHealth({ ...base, last_sync_at: null }, now).level).toBe("never");
    expect(connectionHealth(null, now).level).toBe("disconnected");
    expect(connectionHealth({ ...base, status: "revoked", last_sync_at: now.toISOString() }, now).level).toBe("disconnected");
  });
});

describe("transaction rows and idempotent upsert", () => {
  const tx = {
    id: "tx1", type: "transfer", state: "completed", created_at: "2026-09-19T10:00:00Z", completed_at: "2026-09-19T10:01:00Z",
    reference: "INV 1234abcd", legs: [
      { leg_id: "l1", account_id: "a1", amount: 120.5, fee: 0, currency: "gbp", counterparty: { name: "Suffolk Tennis", account_id: "x" } },
    ],
  };
  const ctx = { connectionId: "c1", environment: "production" as const, accountNames: new Map([["a1", "Main"]]) };
  it("maps one row per leg in signed minor units", () => {
    const rows = toTransactionRows(tx, ctx);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ provider_tx_id: "tx1", provider_leg_id: "l1", amount_minor: 12050, currency: "GBP", account_name: "Main", counterparty_name: "Suffolk Tennis", reference: "INV 1234abcd", state: "completed" });
    expect(toMinor(-3.335)).toBe(-334);
    expect(toMinor(0.1 + 0.2)).toBe(30);
  });
  it("re-importing the same key yields one row with the latest values", () => {
    const a = toTransactionRows(tx, ctx);
    const b = toTransactionRows({ ...tx, state: "reverted" }, ctx);
    const merged = mergeUpsert(mergeUpsert([], a), b);
    expect(merged).toHaveLength(1);
    expect(merged[0].state).toBe("reverted");
  });
});

/* ── Matching ────────────────────────────────────────────────────────────── */

const inv = (over: Partial<InvoiceCandidate>): InvoiceCandidate => ({
  id: "11111111-aaaa-bbbb-cccc-000000000001",
  tenantId: "t1",
  tenantName: "Suffolk Tennis",
  references: ["11111111"],
  amountMinor: 50000,
  currency: "GBP",
  status: "open",
  dueAt: "2026-09-20T00:00:00Z",
  obligationId: "ob1",
  ...over,
});
const tx = (over: Partial<MatchableTransaction>): MatchableTransaction => ({
  id: "tx-1",
  amountMinor: 50000,
  feeMinor: 0,
  currency: "GBP",
  state: "completed",
  type: "transfer",
  reference: null,
  counterpartyName: null,
  completedAt: "2026-09-19T10:00:00Z",
  createdAt: "2026-09-19T10:00:00Z",
  ...over,
});

describe("matching rules", () => {
  it("never auto-confirms: every suggestion is 'suggested'", () => {
    expect(canAutoConfirm()).toBe(false);
    const all = suggestMatches([tx({ reference: "11111111" }), tx({ id: "tx-2", reference: "GoCardless payout" })], [inv({})]);
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((s) => s.state === "suggested")).toBe(true);
  });

  it("exact amount + reference names the invoice → high confidence", () => {
    const [s] = suggestForTransaction(tx({ reference: "Payment 11111111" }), [inv({})]);
    expect(s).toMatchObject({ kind: "invoice", invoiceId: inv({}).id, obligationId: "ob1", confidence: 0.95 });
    expect(s.explanation).toContain("names");
  });

  it("client name in the counterparty counts as a reference hit", () => {
    const [s] = suggestForTransaction(tx({ counterpartyName: "SUFFOLK TENNIS CLUB LTD" }), [inv({})]);
    expect(s.confidence).toBe(0.95);
  });

  it("amount-only within the due window → medium; outside → nothing", () => {
    const [s] = suggestForTransaction(tx({}), [inv({})]);
    expect(s).toMatchObject({ confidence: 0.6, kind: "invoice" });
    expect(suggestForTransaction(tx({}), [inv({ dueAt: "2026-06-01T00:00:00Z" })])).toEqual([]);
  });

  it("amount-only with several candidates lists each at low-medium", () => {
    const out = suggestForTransaction(tx({}), [inv({}), inv({ id: "22222222-aaaa-bbbb-cccc-000000000002", tenantName: "Dance Exclusive", references: ["22222222"] })]);
    expect(out).toHaveLength(2);
    expect(out.every((s) => s.confidence === 0.4)).toBe(true);
    expect(new Set(out.map((s) => s.ruleKey)).size).toBe(2);
  });

  it("several invoices summing to one transfer → low-confidence split", () => {
    const a = inv({ id: "aaaaaaaa-0000-0000-0000-000000000001", amountMinor: 30000, references: ["aaaaaaaa"] });
    const b = inv({ id: "bbbbbbbb-0000-0000-0000-000000000002", amountMinor: 20000, references: ["bbbbbbbb"], obligationId: "ob2" });
    const [s] = suggestForTransaction(tx({}), [a, b]);
    expect(s).toMatchObject({ confidence: 0.3, invoiceId: a.id, splitInvoiceIds: [b.id] });
    expect(s.explanation).toMatch(/Several invoices in one transfer/);
  });

  it("GoCardless and Stripe payouts are payout suggestions, not invoices", () => {
    const [g] = suggestForTransaction(tx({ reference: "GOCARDLESS LTD PAYOUT" }), [inv({})]);
    expect(g).toMatchObject({ kind: "payout", ruleKey: "payout:gocardless", invoiceId: null, confidence: 0.9 });
    const [st] = suggestForTransaction(tx({ counterpartyName: "Stripe Payments UK" }), [inv({})]);
    expect(st).toMatchObject({ kind: "payout", ruleKey: "payout:stripe" });
  });

  it("Revolut fees are fee suggestions", () => {
    const [f] = suggestForTransaction(tx({ type: "fee", amountMinor: -250 }), [inv({})]);
    expect(f).toMatchObject({ kind: "fee", confidence: 0.9 });
  });

  it("ignores pending/declined transactions, outbound transfers, other currencies and closed invoices", () => {
    expect(suggestForTransaction(tx({ state: "pending", reference: "11111111" }), [inv({})])).toEqual([]);
    expect(suggestForTransaction(tx({ amountMinor: -50000, reference: "11111111" }), [inv({})])).toEqual([]);
    expect(suggestForTransaction(tx({ currency: "EUR", reference: "11111111" }), [inv({})])).toEqual([]);
    expect(suggestForTransaction(tx({ reference: "11111111" }), [inv({ status: "void" })])).toEqual([]);
  });

  it("skips transactions a person already decided", () => {
    expect(suggestMatches([tx({ reference: "11111111" })], [inv({})], new Set(["tx-1"]))).toEqual([]);
  });
});
