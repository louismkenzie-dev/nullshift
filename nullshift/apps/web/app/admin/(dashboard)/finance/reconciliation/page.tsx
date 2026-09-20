import Link from "next/link";
import { fmtDate, gbpMinor, loadReconciliation } from "@/lib/ops/financeData";
import { Amount, ClientLink, Empty, SourceNote } from "../ui";
import s from "../../shell.module.css";
import f from "../finance.module.css";

/**
 * Finance › Reconciliation (brief §5.6). The only ledger this database holds
 * is connect_application_fees (Stripe Connect fees Nullshift earned); it is
 * shown gross − refunded = net, live mode only, by client. Payouts, bank
 * receipts and matching have no local record, so those sections are honest
 * empty states rather than numbers.
 */
export default async function ReconciliationPage() {
  const { fees, allocations } = await loadReconciliation();

  return (
    <>
      <SourceNote extra={fees.lastSyncedAt ? `Latest fee in ledger: ${fmtDate(fees.lastSyncedAt)}.` : undefined} />

      <div className={s.grid12}>
        <section className={`${s.card} ${s.span8}`} aria-labelledby="fee-ledger">
          <div className={s.cardTitle}>
            <h2 id="fee-ledger" className={s.h2}>
              Stripe Connect application fee ledger
            </h2>
            <Link href="/admin/billing/fees" className={f.drill}>
              Sync and manage →
            </Link>
          </div>
          <div className={f.equation}>
            <span className={f.equationLabel}>Gross fees (live, all time)</span>
            <Amount value={gbpMinor(fees.live.grossPence)} />
            <span className={f.equationLabel}>− fee refunds</span>
            <Amount value={gbpMinor(fees.live.refundedPence)} />
            <span className={`${f.equationLabel} ${f.equationTotal}`}>= net earned</span>
            <span className={f.equationTotal}>
              <Amount value={gbpMinor(fees.live.netPence)} />
            </span>
            <span className={f.equationLabel}>This month (net)</span>
            <Amount value={gbpMinor(fees.thisMonth.netPence)} />
          </div>
          <p className={s.muted} style={{ fontSize: 12 }}>
            {fees.live.count} live fee{fees.live.count === 1 ? "" : "s"} recorded.
            {fees.testModeRows > 0
              ? ` ${fees.testModeRows} test-mode row${fees.testModeRows === 1 ? "" : "s"} exist and are excluded from every total.`
              : ""}{" "}
            The ledger fills from the Stripe webhook or the Sync action on the fees page;
            it is a fee record, not a payout record.
          </p>

          {fees.byClient.length === 0 ? (
            <Empty title="No live fees recorded" body="Nothing has been collected through Stripe Connect, or the ledger has not been synced." />
          ) : (
            <table className={s.table}>
              <thead>
                <tr>
                  <th scope="col">Client</th>
                  <th scope="col">Connected account</th>
                  <th scope="col" className={s.num}>
                    Gross
                  </th>
                  <th scope="col" className={s.num}>
                    Refunded
                  </th>
                  <th scope="col" className={s.num}>
                    Net
                  </th>
                  <th scope="col" className={s.num}>
                    Fees
                  </th>
                  <th scope="col">Last collected</th>
                </tr>
              </thead>
              <tbody>
                {fees.byClient.map((b) => (
                  <tr key={b.tenantId ?? b.stripeAccountId}>
                    <td>
                      {b.tenantId ? (
                        <ClientLink id={b.tenantId} name={b.tenantName} />
                      ) : (
                        <span className={`${s.chip} ${s.chipWarning}`}>{b.tenantName}</span>
                      )}
                    </td>
                    <td>
                      <span className={s.mono}>{b.stripeAccountId}</span>
                      {b.stripeAccountName ? <span className={f.sub}>{b.stripeAccountName}</span> : null}
                    </td>
                    <td className={s.num}>
                      <Amount value={gbpMinor(b.totals.grossPence)} />
                    </td>
                    <td className={s.num}>
                      <Amount value={gbpMinor(b.totals.refundedPence)} />
                    </td>
                    <td className={s.num}>
                      <Amount value={gbpMinor(b.totals.netPence)} />
                    </td>
                    <td className={s.num}>{b.totals.count}</td>
                    <td>{fmtDate(b.lastCollectedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <div className={`${s.span4} ${s.stack}`}>
          <section className={s.card} aria-labelledby="payouts">
            <h2 id="payouts" className={s.h2}>
              Payouts
            </h2>
            <Empty
              title="No bank feed connected"
              body="GoCardless and Stripe payouts are not synced into this database and no Revolut bank feed reaches it. Gross − refunds − fees = net payout cannot be reconciled here until a payout or bank record exists."
            />
          </section>

          <section className={s.card} aria-labelledby="bank">
            <h2 id="bank" className={s.h2}>
              Bank receipts and matching
            </h2>
            <Empty
              title="Not recorded"
              body={
                allocations.available
                  ? `payment_allocations is available (${allocations.count} row${allocations.count === 1 ? "" : "s"}), but there is no bank receipt source to match against. Bank transfers are marked paid on the client's billing page.`
                  : "payment_allocations (migration 0062) is not available yet. Bank transfers are marked paid on the client's billing page, with no allocation record."
              }
            />
          </section>
        </div>
      </div>
    </>
  );
}
