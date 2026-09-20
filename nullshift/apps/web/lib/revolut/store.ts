/**
 * Revolut bank feed — server-side persistence (service role) and the sync
 * runner. This is the ONLY module that touches `revolut_secrets`, and the
 * only place plaintext tokens exist: decrypted just before a Revolut call,
 * never logged, never returned.
 *
 * Writes:
 *   - revolut_connections / revolut_secrets (consent, refresh, revoke)
 *   - bank_transactions (idempotent upsert on the provider key)
 *   - bank_matches with state 'suggested' only (the matcher)
 *
 * Nothing here edits invoices, subscriptions or obligations.
 */

import { createServiceClient } from "@nullshift/db";
import { RevolutClient, readRevolutEnv, type RevolutAccount, type RevolutEnvironment } from "./client";
import { decryptToken, encryptToken, parseEncryptionKey, sanitiseError } from "./crypto";
import { suggestMatches, type InvoiceCandidate, type MatchableTransaction } from "./match";
import { mergeUpsert, needsRefresh, syncWindow, toTransactionRows, type BankTransactionRow } from "./sync";

export type ConnectionRow = {
  id: string;
  environment: RevolutEnvironment;
  client_id: string;
  connected_by: string | null;
  connected_at: string;
  last_sync_at: string | null;
  last_sync_status: "ok" | "error" | null;
  last_error: string | null;
  access_expires_at: string | null;
  status: "active" | "revoked";
  revoked_at: string | null;
};

type Service = ReturnType<typeof createServiceClient>;

const key = () => parseEncryptionKey(process.env.REVOLUT_TOKEN_ENCRYPTION_KEY);

export async function activeConnection(
  service: Service,
  environment: RevolutEnvironment
): Promise<ConnectionRow | null> {
  const { data } = await service
    .from("revolut_connections")
    .select("*")
    .eq("environment", environment)
    .eq("status", "active")
    .maybeSingle();
  return (data as ConnectionRow | null) ?? null;
}

/** Store a fresh consent: revoke any previous active row for the environment. */
export async function storeConsent(input: {
  environment: RevolutEnvironment;
  clientId: string;
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}): Promise<{ connectionId: string }> {
  const service = createServiceClient();
  const k = key();
  const now = new Date();
  await service
    .from("revolut_connections")
    .update({ status: "revoked", revoked_at: now.toISOString(), revoked_by: input.userId })
    .eq("environment", input.environment)
    .eq("status", "active");

  const accessExpires = new Date(now.getTime() + input.expiresInSeconds * 1000).toISOString();
  const { data, error } = await service
    .from("revolut_connections")
    .insert({
      environment: input.environment,
      client_id: input.clientId,
      connected_by: input.userId,
      connected_at: now.toISOString(),
      access_expires_at: accessExpires,
      status: "active",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`connection insert failed: ${error?.message ?? "no row"}`);
  const id = (data as { id: string }).id;

  const { error: sErr } = await service.from("revolut_secrets").insert({
    connection_id: id,
    encrypted_refresh_token: encryptToken(input.refreshToken, k, id),
    encrypted_access_token: encryptToken(input.accessToken, k, id),
    access_expires_at: accessExpires,
  });
  if (sErr) {
    await service.from("revolut_connections").delete().eq("id", id);
    throw new Error(`secret insert failed: ${sErr.message}`);
  }
  return { connectionId: id };
}

/** Mark revoked and delete the secrets row. Idempotent. */
export async function revokeConnection(connectionId: string, userId: string | null): Promise<void> {
  const service = createServiceClient();
  await service.from("revolut_secrets").delete().eq("connection_id", connectionId);
  await service
    .from("revolut_connections")
    .update({ status: "revoked", revoked_at: new Date().toISOString(), revoked_by: userId })
    .eq("id", connectionId)
    .eq("status", "active");
}

/** A usable access token, refreshing when it has < 5 minutes left. */
async function accessTokenFor(
  service: Service,
  client: RevolutClient,
  conn: ConnectionRow,
  now: Date
): Promise<string> {
  const k = key();
  const { data } = await service
    .from("revolut_secrets")
    .select("encrypted_refresh_token, encrypted_access_token, access_expires_at")
    .eq("connection_id", conn.id)
    .maybeSingle();
  const row = data as
    | { encrypted_refresh_token: string; encrypted_access_token: string | null; access_expires_at: string | null }
    | null;
  if (!row) throw new Error("No secrets for this connection; reconnect.");

  if (row.encrypted_access_token && !needsRefresh(row.access_expires_at, now))
    return decryptToken(row.encrypted_access_token, k, conn.id);

  const refresh = decryptToken(row.encrypted_refresh_token, k, conn.id);
  const t = await client.refreshAccessToken(refresh);
  const expires = new Date(now.getTime() + t.expires_in * 1000).toISOString();
  await service
    .from("revolut_secrets")
    .update({
      encrypted_access_token: encryptToken(t.access_token, k, conn.id),
      // Revolut may rotate the refresh token; keep the newest.
      ...(t.refresh_token ? { encrypted_refresh_token: encryptToken(t.refresh_token, k, conn.id) } : {}),
      access_expires_at: expires,
      updated_at: now.toISOString(),
    })
    .eq("connection_id", conn.id);
  await service.from("revolut_connections").update({ access_expires_at: expires }).eq("id", conn.id);
  return t.access_token;
}

export type SyncOutcome =
  | { ok: true; connectionId: string; accounts: number; transactions: number; legs: number; suggestions: number }
  | { ok: false; connectionId: string | null; error: string; reconsent?: boolean }
  | { ok: false; connectionId: null; skipped: "not_configured" | "not_connected"; missing?: string[] };

/**
 * One sync run: refresh if needed → accounts → transactions in the window →
 * upsert → matcher. Safe to re-run: every write is an upsert on a stable key.
 * Errors are recorded on the connection row, sanitised.
 */
export async function runSync(now: Date = new Date()): Promise<SyncOutcome> {
  const env = readRevolutEnv();
  if (!env.ok) return { ok: false, connectionId: null, skipped: "not_configured", missing: env.missing };
  const service = createServiceClient();
  const conn = await activeConnection(service, env.value.environment);
  if (!conn) return { ok: false, connectionId: null, skipped: "not_connected" };

  const client = new RevolutClient(env.value);
  try {
    const token = await accessTokenFor(service, client, conn, now);
    const accounts = await client.listAccounts(token);
    await service
      .from("revolut_connections")
      .update({ accounts_snapshot: snapshot(accounts), accounts_snapshot_at: now.toISOString() })
      .eq("id", conn.id);

    const { from, to } = syncWindow(conn.last_sync_at, now);
    const txs = await client.listTransactions(token, { from, to });
    const names = new Map(accounts.map((a) => [a.id, a.name ?? a.currency]));
    const rows: BankTransactionRow[] = [];
    for (const tx of txs) rows.push(...toTransactionRows(tx, { connectionId: conn.id, environment: conn.environment, accountNames: names }));
    const deduped = mergeUpsert([], rows);
    for (let i = 0; i < deduped.length; i += 500) {
      const { error } = await service
        .from("bank_transactions")
        .upsert(deduped.slice(i, i + 500), { onConflict: "provider,environment,provider_tx_id,provider_leg_id" });
      if (error) throw new Error(`bank_transactions upsert: ${error.message}`);
    }

    const suggestions = await runMatching(service, conn.environment);

    await service
      .from("revolut_connections")
      .update({ last_sync_at: now.toISOString(), last_sync_status: "ok", last_error: null })
      .eq("id", conn.id);
    return { ok: true, connectionId: conn.id, accounts: accounts.length, transactions: txs.length, legs: deduped.length, suggestions };
  } catch (e) {
    const message = sanitiseError(e instanceof Error ? e.message : "sync failed");
    const reconsent = !!(e && typeof e === "object" && "reconsent" in e && (e as { reconsent?: boolean }).reconsent);
    await service
      .from("revolut_connections")
      .update({ last_sync_status: "error", last_error: reconsent ? `Consent no longer valid: ${message}` : message })
      .eq("id", conn.id);
    return { ok: false, connectionId: conn.id, error: message, reconsent };
  }
}

function snapshot(accounts: RevolutAccount[]) {
  return accounts.map((a) => ({
    id: a.id,
    name: a.name ?? null,
    currency: a.currency,
    balance_minor: Math.round(a.balance * 100),
    state: a.state,
  }));
}

/* ── Matching ────────────────────────────────────────────────────────────── */

type InvoiceRow = {
  id: string;
  tenant_id: string;
  amount: string | number;
  status: InvoiceCandidate["status"];
  due_at: string | null;
  obligation_id: string | null;
  tenants: { name: string } | { name: string }[] | null;
  billing_obligations: { label: string | null; currency: string } | { label: string | null; currency: string }[] | null;
};

const one = <T>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

export async function loadInvoiceCandidates(service: Service): Promise<InvoiceCandidate[]> {
  const since = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await service
    .from("invoices")
    .select("id, tenant_id, amount, status, due_at, obligation_id, tenants(name), billing_obligations(label, currency)")
    .in("status", ["open", "paid"])
    .gte("created_at", since)
    .limit(500);
  return ((data ?? []) as InvoiceRow[]).map((r) => {
    const t = one(r.tenants);
    const o = one(r.billing_obligations);
    return {
      id: r.id,
      tenantId: r.tenant_id,
      tenantName: t?.name ?? "",
      references: [r.id.slice(0, 8), ...(o?.label ? [o.label] : [])],
      amountMinor: Math.round(Number(r.amount) * 100),
      currency: o?.currency ?? "GBP",
      status: r.status,
      dueAt: r.due_at,
      obligationId: r.obligation_id,
    };
  });
}

/** Suggest for completed transactions with no decided match; upsert suggestions. */
export async function runMatching(service: Service, environment: RevolutEnvironment): Promise<number> {
  const { data: txs } = await service
    .from("bank_transactions")
    .select("id, amount_minor, fee_minor, currency, state, type, reference, counterparty_name, completed_at_provider, created_at_provider")
    .eq("environment", environment)
    .eq("state", "completed")
    .order("created_at_provider", { ascending: false })
    .limit(1000);
  const list = (txs ?? []) as {
    id: string; amount_minor: number; fee_minor: number; currency: string; state: string; type: string;
    reference: string | null; counterparty_name: string | null; completed_at_provider: string | null; created_at_provider: string;
  }[];
  if (list.length === 0) return 0;

  const { data: decided } = await service
    .from("bank_matches")
    .select("transaction_id")
    .in("state", ["confirmed", "rejected"])
    .in("transaction_id", list.map((t) => t.id));
  const decidedSet = new Set(((decided ?? []) as { transaction_id: string }[]).map((d) => d.transaction_id));

  const matchable: MatchableTransaction[] = list.map((t) => ({
    id: t.id,
    amountMinor: t.amount_minor,
    feeMinor: t.fee_minor,
    currency: t.currency,
    state: t.state,
    type: t.type,
    reference: t.reference,
    counterpartyName: t.counterparty_name,
    completedAt: t.completed_at_provider,
    createdAt: t.created_at_provider,
  }));
  const invoices = await loadInvoiceCandidates(service);
  const suggestions = suggestMatches(matchable, invoices, decidedSet);
  if (suggestions.length === 0) return 0;

  const rows = suggestions.map((s) => ({
    transaction_id: s.transactionId,
    kind: s.kind,
    invoice_id: s.invoiceId,
    obligation_id: s.obligationId,
    split_invoice_ids: s.splitInvoiceIds,
    confidence: s.confidence,
    explanation: s.explanation,
    rule_key: s.ruleKey,
    state: "suggested",
  }));
  // Upsert on (transaction_id, rule_key); rows a person already decided are
  // excluded above, so this can never overwrite a confirmed/rejected row —
  // and the partial unique index would refuse a second confirmed one anyway.
  const { error } = await service
    .from("bank_matches")
    .upsert(rows, { onConflict: "transaction_id,rule_key", ignoreDuplicates: true });
  if (error) throw new Error(`bank_matches upsert: ${error.message}`);
  return rows.length;
}
