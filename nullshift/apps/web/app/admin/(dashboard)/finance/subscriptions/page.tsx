import Link from "next/link";
import { fmtDate, loadSubscriptions, providerLinks } from "@/lib/ops/financeData";
import { Amount, Chip, ClientLink, ProviderId, SourceNote } from "../ui";
import s from "../../shell.module.css";
import f from "../finance.module.css";

/**
 * Finance › Subscriptions (brief §5.6): one row per subscription row, with the
 * legacy marker (hosting / hosting_api / build_3 / build_10), plan label from
 * lib/carePlans, agreed monthly amount, provider ids and start. The catalogue
 * price is never read here — mrr on the row is the contracted figure.
 */
export default async function SubscriptionsPage() {
  const { rows, electedWithoutRow } = await loadSubscriptions();

  return (
    <>
      <SourceNote extra="Newest 100 subscription rows." />
      <p className={s.muted} style={{ marginTop: 0 }}>
        One row per subscription. The monthly amount is the row&apos;s contracted mrr, not
        the catalogue price. Legacy plans are marked and read-only.
      </p>

      {rows.length === 0 ? (
        <p className={s.muted}>No subscription rows.</p>
      ) : (
        <table className={s.table}>
          <thead>
            <tr>
              <th scope="col">Client</th>
              <th scope="col">Plan</th>
              <th scope="col" className={s.num}>
                Monthly
              </th>
              <th scope="col">Status</th>
              <th scope="col">Provider</th>
              <th scope="col">Provider ids</th>
              <th scope="col">Terms</th>
              <th scope="col">Started</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={r.legacy ? f.legacy : undefined}>
                <td>
                  <ClientLink id={r.tenantId} name={r.tenantName} legacy={r.legacy} />
                  <span className={f.sub}>
                    <span className={s.mono}>{r.id.slice(0, 8)}</span>
                  </span>
                </td>
                <td>
                  <strong>{r.planLabel}</strong>
                  <span className={f.sub}>
                    <span className={s.mono}>{r.plan ?? "—"}</span>
                    {r.legacy ? " · legacy · read-only" : ""}
                  </span>
                </td>
                <td className={s.num}>
                  <Amount value={r.mrr} />
                  <span className={f.sub}>per month</span>
                </td>
                <td>
                  <Chip state={r.status} />
                </td>
                <td>{r.provider}</td>
                <td>
                  {r.provider === "gocardless" || r.gcMandateId ? (
                    <>
                      <ProviderId
                        id={r.gcMandateId}
                        href={r.gcMandateId ? providerLinks.gcMandate(r.gcMandateId) : undefined}
                        missing="no mandate"
                      />
                      <span className={f.sub}>
                        <ProviderId
                          id={r.gcSubscriptionId}
                          href={r.gcSubscriptionId ? providerLinks.gcSubscription(r.gcSubscriptionId) : undefined}
                          missing="no GoCardless subscription"
                        />
                      </span>
                    </>
                  ) : (
                    <ProviderId
                      id={r.stripeSubscriptionId}
                      href={r.stripeSubscriptionId ? providerLinks.stripeSubscription(r.stripeSubscriptionId) : undefined}
                      missing="no provider id"
                    />
                  )}
                </td>
                <td>
                  {r.termsVersion ? (
                    <>
                      <span className={s.mono}>{r.termsVersion}</span>
                      <span className={f.sub}>{fmtDate(r.termsAcceptedAt)}</span>
                    </>
                  ) : (
                    <span className={s.faint}>none recorded</span>
                  )}
                </td>
                <td>{r.startedAt ? fmtDate(r.startedAt) : <span className={s.faint}>—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <section className={s.card} style={{ marginTop: 24 }} aria-labelledby="no-row">
        <h3 id="no-row" className={s.h2}>
          Plan elected in the portal, no subscription row
        </h3>
        <p className={s.muted} style={{ marginTop: 0 }}>
          tenants.care_plan_choice is set but no live subscription exists. The Direct Debit
          link has not been completed; send or re-send it from the{" "}
          <Link href="/admin/billing/direct-debits">Direct Debits board</Link>.
        </p>
        {electedWithoutRow.length === 0 ? (
          <p className={s.muted}>None.</p>
        ) : (
          <ul className={s.list}>
            {electedWithoutRow.map((n) => (
              <li key={n.tenantId} className={s.listItem}>
                <span>
                  <ClientLink id={n.tenantId} name={n.tenantName} />
                  <span className={f.sub}>chose {n.choice}</span>
                </span>
                <span className={s.chip}>No row</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
