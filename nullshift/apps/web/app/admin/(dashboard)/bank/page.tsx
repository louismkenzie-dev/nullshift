import Link from "next/link";
import { createClient } from "@nullshift/db";
import { isRevolutConfigured, readRevolutEnv } from "@/lib/revolut/client";
import { connectionHealth } from "@/lib/revolut/sync";
import { confirmMatchForm, disconnectRevolutForm, rejectMatchForm } from "@/lib/revolut/actions";
import s from "../shell.module.css";
import b from "./bank.module.css";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

type Connection = {
  id: string;
  environment: "production" | "sandbox";
  client_id: string;
  connected_at: string;
  last_sync_at: string | null;
  last_sync_status: "ok" | "error" | null;
  last_error: string | null;
  access_expires_at: string | null;
  accounts_snapshot: { id: string; name: string | null; currency: string; balance_minor: number; state: string }[];
  accounts_snapshot_at: string | null;
  status: "active" | "revoked";
};

type Tx = {
  id: string;
  account_name: string | null;
  currency: string;
  amount_minor: number;
  fee_minor: number;
  state: string;
  type: string;
  reference: string | null;
  counterparty_name: string | null;
  created_at_provider: string;
  completed_at_provider: string | null;
};

type Match = {
  id: string;
  transaction_id: string;
  kind: string;
  invoice_id: string | null;
  split_invoice_ids: string[];
  confidence: number;
  explanation: string;
  state: "suggested" | "confirmed" | "rejected";
  decided_at: string | null;
};

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const money = (minor: number, ccy: string) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: ccy }).format(minor / 100);

const when = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }) : "—";

const NOTICES: Record<string, { tone: "success" | "warning" | "danger"; text: string }> = {
  connected: { tone: "success", text: "Revolut connected. The first sync runs on the next cron tick (every 30 minutes)." },
  bad_state: { tone: "danger", text: "The consent round trip could not be verified (state expired or did not match). Start again." },
  no_code: { tone: "danger", text: "Revolut returned without an authorisation code." },
  no_refresh_token: { tone: "danger", text: "Revolut did not issue a refresh token; check the API certificate settings." },
  exchange_failed: { tone: "danger", text: "The authorisation code could not be exchanged. Check REVOLUT_CLIENT_ID, REVOLUT_ISSUER and the private key." },
  not_configured: { tone: "warning", text: "Revolut is not configured on this deployment." },
};

export default async function BankPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const notice = first(sp.notice);
  const filter = first(sp.filter) === "matched" ? "matched" : first(sp.filter) === "unmatched" ? "unmatched" : "all";
  const page = Math.max(1, Number(first(sp.page) ?? "1") || 1);

  const configured = isRevolutConfigured();
  const env = readRevolutEnv();
  const environment = env.ok ? env.value.environment : null;
  const supabase = await createClient();

  const { data: connRow } = environment
    ? await supabase.from("revolut_connections").select("*").eq("environment", environment).eq("status", "active").maybeSingle()
    : { data: null };
  const conn = (connRow as Connection | null) ?? null;
  const health = connectionHealth(conn);

  // Transactions (paginated) with their match state.
  const fromIdx = (page - 1) * PAGE_SIZE;
  let txQuery = supabase
    .from("bank_transactions")
    .select("id, account_name, currency, amount_minor, fee_minor, state, type, reference, counterparty_name, created_at_provider, completed_at_provider", { count: "exact" })
    .order("created_at_provider", { ascending: false });
  if (environment) txQuery = txQuery.eq("environment", environment);

  const { data: confirmedRows } = await supabase.from("bank_matches").select("transaction_id").eq("state", "confirmed");
  const confirmedIds = ((confirmedRows ?? []) as { transaction_id: string }[]).map((r) => r.transaction_id);
  if (filter === "matched") txQuery = confirmedIds.length ? txQuery.in("id", confirmedIds) : txQuery.eq("id", "00000000-0000-0000-0000-000000000000");
  if (filter === "unmatched" && confirmedIds.length) txQuery = txQuery.not("id", "in", `(${confirmedIds.join(",")})`);

  const { data: txRows, count } = await txQuery.range(fromIdx, fromIdx + PAGE_SIZE - 1);
  const txs = (txRows ?? []) as Tx[];
  const total = count ?? 0;
  const confirmedSet = new Set(confirmedIds);

  const { data: suggRows } = await supabase
    .from("bank_matches")
    .select("id, transaction_id, kind, invoice_id, split_invoice_ids, confidence, explanation, state, decided_at")
    .eq("state", "suggested")
    .order("confidence", { ascending: false })
    .limit(100);
  const suggestions = (suggRows ?? []) as Match[];
  const suggTxIds = [...new Set(suggestions.map((m) => m.transaction_id))];
  const { data: suggTxRows } = suggTxIds.length
    ? await supabase.from("bank_transactions").select("id, account_name, currency, amount_minor, fee_minor, state, type, reference, counterparty_name, created_at_provider, completed_at_provider").in("id", suggTxIds)
    : { data: [] };
  const suggTx = new Map(((suggTxRows ?? []) as Tx[]).map((t) => [t.id, t]));

  const n = notice ? NOTICES[notice] : null;
  const missing = first(sp.missing);

  return (
    <>
      <div className={s.pageHead}>
        <div>
          <p className={s.mono}>Finance · Bank feed · Revolut Business ({environment ?? "not configured"}) · read-only</p>
          <h1 className={s.h1}>Bank</h1>
          <p className={s.lead}>
            Imported bank movements with reconciliation suggestions. A bank line is evidence: confirming a
            match records an allocation against the invoice&apos;s obligation; it never marks an invoice paid,
            and nothing here can move money.
          </p>
        </div>
        <div className={b.actions}>
          {conn ? (
            <form action={disconnectRevolutForm}>
              <input type="hidden" name="connectionId" value={conn.id} />
              <button type="submit" className={s.btn}>Disconnect</button>
            </form>
          ) : null}
          <a
            className={configured ? s.btnPrimary : s.btn}
            href="/api/revolut/connect"
            aria-disabled={!configured}
          >
            {conn ? "Reconnect Revolut" : "Connect Revolut"}
          </a>
        </div>
      </div>

      {n ? (
        <div className={`${b.notice} ${n.tone === "success" ? b.noticeSuccess : n.tone === "warning" ? b.noticeWarning : b.noticeDanger}`} role="status">
          {n.text}
          {notice === "not_configured" && missing ? ` Missing: ${missing}.` : ""}
        </div>
      ) : null}
      {!configured ? (
        <div className={`${b.notice} ${b.noticeWarning}`}>
          Set REVOLUT_CLIENT_ID, REVOLUT_ISSUER, REVOLUT_PRIVATE_KEY, REVOLUT_ENVIRONMENT and
          REVOLUT_TOKEN_ENCRYPTION_KEY, then use Connect Revolut. See docs/admin-redesign/revolut-bank-feed.md.
        </div>
      ) : null}

      <div className={s.grid12}>
        <section className={`${s.card} ${s.span4}`} aria-labelledby="conn">
          <div className={s.cardTitle}>
            <h2 className={s.h2} id="conn" style={{ margin: 0 }}>Connection</h2>
            <span className={`${s.chip} ${health.level === "healthy" ? s.chipSuccess : health.level === "stale" || health.level === "never" ? s.chipWarning : health.level === "error" ? s.chipDanger : ""}`}>
              {health.label}
            </span>
          </div>
          <p className={s.metricNote} style={{ marginBottom: 12 }}>{health.detail}</p>
          {conn ? (
            <dl className={s.kv}>
              <dt>Environment</dt><dd>{conn.environment}</dd>
              <dt>Connected</dt><dd>{when(conn.connected_at)}</dd>
              <dt>Last sync</dt><dd>{when(conn.last_sync_at)}</dd>
              <dt>Last status</dt><dd>{conn.last_sync_status ?? "—"}</dd>
              <dt>Access token expires</dt><dd>{when(conn.access_expires_at)}</dd>
              {conn.last_error ? (<><dt>Last error</dt><dd style={{ textAlign: "left" }}>{conn.last_error}</dd></>) : null}
            </dl>
          ) : (
            <p className={s.muted} style={{ margin: 0 }}>No active consent for this environment.</p>
          )}
        </section>

        <section className={`${s.card} ${s.span8}`} aria-labelledby="accts">
          <div className={s.cardTitle}>
            <h2 className={s.h2} id="accts" style={{ margin: 0 }}>Accounts and balances</h2>
            <span className={s.mono}>as of {when(conn?.accounts_snapshot_at)}</span>
          </div>
          {conn && conn.accounts_snapshot?.length ? (
            <table className={s.table}>
              <thead><tr><th>Account</th><th>Currency</th><th>State</th><th className={s.num}>Balance</th></tr></thead>
              <tbody>
                {conn.accounts_snapshot.map((a) => (
                  <tr key={a.id}>
                    <td>{a.name ?? a.id}</td>
                    <td>{a.currency}</td>
                    <td><span className={`${s.chip} ${a.state === "active" ? s.chipSuccess : ""}`}>{a.state}</span></td>
                    <td className={s.num}>{money(a.balance_minor, a.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className={b.empty} role="status">
              <p className={b.emptyTitle}>No balances yet</p>
              <p style={{ margin: 0 }}>Balances appear after the first successful sync.</p>
            </div>
          )}
        </section>

        <section className={`${s.card} ${s.span12}`} aria-labelledby="sugg">
          <div className={s.cardTitle}>
            <h2 className={s.h2} id="sugg" style={{ margin: 0 }}>Suggested matches</h2>
            <span className={s.mono}>{suggestions.length} awaiting a decision · nothing is confirmed automatically</span>
          </div>
          {suggestions.length ? (
            <table className={s.table}>
              <thead><tr><th>Transaction</th><th>Suggestion</th><th>Confidence</th><th>Decision</th></tr></thead>
              <tbody>
                {suggestions.map((m) => {
                  const t = suggTx.get(m.transaction_id);
                  return (
                    <tr key={m.id}>
                      <td>
                        {t ? (
                          <>
                            <div className={t.amount_minor > 0 ? b.in : b.out}>{money(t.amount_minor, t.currency)}</div>
                            <div className={s.muted}>{t.counterparty_name ?? "—"} · {t.reference ?? "no reference"}</div>
                            <div className={s.faint}>{when(t.completed_at_provider ?? t.created_at_provider)}</div>
                          </>
                        ) : "—"}
                      </td>
                      <td>
                        <div><span className={s.chip}>{m.kind}</span>{m.invoice_id ? <Link className={s.rowLink} style={{ marginLeft: 8 }} href={`/admin/finance?invoice=${m.invoice_id}`}>invoice {m.invoice_id.slice(0, 8)}</Link> : null}{m.split_invoice_ids?.length ? <span className={s.muted}> + {m.split_invoice_ids.length} more</span> : null}</div>
                        <p className={b.explanation} style={{ margin: "6px 0 0" }}>{m.explanation}</p>
                      </td>
                      <td className={b.confidence}>{Math.round(m.confidence * 100)}%</td>
                      <td>
                        <div className={b.actions}>
                          <form action={confirmMatchForm}><input type="hidden" name="matchId" value={m.id} /><button type="submit" className={`${s.btnPrimary} ${s.btnSmall}`}>Confirm</button></form>
                          <form action={rejectMatchForm}><input type="hidden" name="matchId" value={m.id} /><button type="submit" className={`${s.btn} ${s.btnSmall}`}>Reject</button></form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className={b.empty} role="status">
              <p className={b.emptyTitle}>No suggestions waiting</p>
              <p style={{ margin: 0 }}>Suggestions appear after a sync finds completed inbound transactions that fit an open or paid invoice, a payout, or a fee.</p>
            </div>
          )}
        </section>

        <section className={`${s.card} ${s.span12}`} aria-labelledby="txs">
          <div className={s.cardTitle}>
            <h2 className={s.h2} id="txs" style={{ margin: 0 }}>Transactions</h2>
            <span className={s.mono}>{total} in {environment ?? "—"}</span>
          </div>
          <nav className={b.filters} aria-label="Filter">
            {(["all", "unmatched", "matched"] as const).map((f) => (
              <Link key={f} href={`/admin/bank?filter=${f}`} className={`${b.filterLink} ${filter === f ? b.filterLinkActive : ""}`} aria-current={filter === f ? "page" : undefined}>{f}</Link>
            ))}
          </nav>
          {txs.length ? (
            <table className={s.table}>
              <thead><tr><th>Date</th><th>Account</th><th>Counterparty</th><th>Reference</th><th>Type</th><th>State</th><th className={s.num}>Amount</th><th>Match</th></tr></thead>
              <tbody>
                {txs.map((t) => (
                  <tr key={t.id}>
                    <td>{when(t.completed_at_provider ?? t.created_at_provider)}</td>
                    <td>{t.account_name ?? "—"}</td>
                    <td>{t.counterparty_name ?? "—"}</td>
                    <td className={s.muted}>{t.reference ?? "—"}</td>
                    <td>{t.type}</td>
                    <td><span className={`${s.chip} ${t.state === "completed" ? s.chipSuccess : t.state === "pending" ? s.chipWarning : s.chipDanger}`}>{t.state}</span></td>
                    <td className={`${s.num} ${t.amount_minor > 0 ? b.in : b.out}`}>{money(t.amount_minor, t.currency)}{t.fee_minor ? <span className={s.faint}> (fee {money(t.fee_minor, t.currency)})</span> : null}</td>
                    <td>{confirmedSet.has(t.id) ? <span className={`${s.chip} ${s.chipSuccess}`}>matched</span> : <span className={s.chip}>unmatched</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className={b.empty} role="status">
              <p className={b.emptyTitle}>No transactions</p>
              <p style={{ margin: 0 }}>{conn ? "Nothing imported for this filter yet." : "Connect Revolut to start importing."}</p>
            </div>
          )}
          <div className={b.pager}>
            <span>Page {page} of {Math.max(1, Math.ceil(total / PAGE_SIZE))}</span>
            <span className={b.actions}>
              {page > 1 ? <Link className={`${s.btn} ${s.btnSmall}`} href={`/admin/bank?filter=${filter}&page=${page - 1}`}>Previous</Link> : null}
              {fromIdx + PAGE_SIZE < total ? <Link className={`${s.btn} ${s.btnSmall}`} href={`/admin/bank?filter=${filter}&page=${page + 1}`}>Next</Link> : null}
            </span>
          </div>
        </section>
      </div>
    </>
  );
}
