import Link from "next/link";
import { notFound } from "next/navigation";
import { EXCEPTION_KIND_LABEL, fmtDate, loadCollection, providerLinks } from "@/lib/ops/financeData";
import {
  Amount,
  ClientLink,
  CollectionStateChip,
  ExceptionStateChip,
  InvoiceStateChip,
  KV,
  ProviderId,
  SourceNote,
} from "../../ui";
import s from "../../../shell.module.css";
import f from "../../finance.module.css";

/**
 * Finance › Collections › detail: the subscription row, its GoCardless
 * identities, terms evidence, the care_plan invoices minted from provider
 * payments and any exceptions. The Direct Debits board remains the only place
 * that sends links or cancels mandates.
 */
export default async function CollectionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await loadCollection(id);
  if (!d) notFound();
  const { row: c, collectedInvoices, exceptions } = d;

  const explain: Record<typeof c.collection, string> = {
    link_sent:
      "A GoCardless billing request was created and the link sent; the client has not authorised a mandate. Nothing can be collected until they do.",
    mandate_active:
      "The client authorised a mandate and the subscription is active. GoCardless schedules the monthly collections; the charge dates are held there, not here.",
    collection_failed:
      "The provider reported a failed collection (past_due). The obligation stays open; any retry is a new attempt from the GoCardless dashboard.",
    trialing: "The subscription is in a trial state at the provider.",
    cancelled: "The subscription is cancelled. No further collections will be attempted.",
  };

  return (
    <>
      <p className={s.mono}>
        <Link href="/admin/finance/collections">Collections</Link> / {c.id}
      </p>
      <div className={s.pageHead}>
        <div>
          <h2 className={s.h1} style={{ fontSize: 22 }}>
            {c.tenantName} · {c.planLabel}
          </h2>
          <p className={s.lead}>
            <ClientLink id={c.tenantId} name={c.tenantName} legacy={c.legacy} /> · {c.provider} ·{" "}
            <Amount value={c.mrr} /> per month ·{" "}
            {c.startedAt ? `started ${fmtDate(c.startedAt)}` : "not started"}
          </p>
        </div>
        <div className={s.chips}>
          <CollectionStateChip state={c.collection} />
          <Link href="/admin/billing/direct-debits" className={s.btnPrimary}>
            Manage on Direct Debits board
          </Link>
        </div>
      </div>
      <SourceNote />

      <div className={f.detail}>
        <div className={s.stack}>
          <section className={s.card} aria-labelledby="state">
            <h3 id="state" className={s.h2}>
              What this state means
            </h3>
            <p style={{ margin: 0 }}>{explain[c.collection]}</p>
          </section>

          <section className={s.card} aria-labelledby="collected">
            <h3 id="collected" className={s.h2}>
              Collections recorded as invoices
            </h3>
            <p className={s.muted} style={{ marginTop: 0 }}>
              Each confirmed GoCardless payment mints a paid care_plan invoice keyed on its
              payment id. This is the only per-collection record held locally.
            </p>
            {collectedInvoices.length === 0 ? (
              <p className={s.muted}>No collections recorded yet.</p>
            ) : (
              <table className={s.table}>
                <thead>
                  <tr>
                    <th scope="col">Invoice</th>
                    <th scope="col">Created</th>
                    <th scope="col">Paid</th>
                    <th scope="col" className={s.num}>
                      Amount
                    </th>
                    <th scope="col">GoCardless payment</th>
                    <th scope="col">Xero</th>
                    <th scope="col">State</th>
                  </tr>
                </thead>
                <tbody>
                  {collectedInvoices.map((i) => (
                    <tr key={i.id}>
                      <td>
                        <Link href={`/admin/finance/invoices/${i.id}`} className={`${s.rowLink} ${s.mono}`}>
                          {i.id.slice(0, 8)}
                        </Link>
                      </td>
                      <td>{fmtDate(i.createdAt)}</td>
                      <td>{fmtDate(i.paidAt)}</td>
                      <td className={s.num}>
                        <Amount value={i.amount} />
                      </td>
                      <td>
                        <ProviderId
                          id={i.gcPaymentId}
                          href={i.gcPaymentId ? providerLinks.gcPayment(i.gcPaymentId) : undefined}
                        />
                      </td>
                      <td>
                        <ProviderId
                          id={i.xeroInvoiceId}
                          href={i.xeroInvoiceId ? providerLinks.xero(i.xeroInvoiceId) : undefined}
                          missing="not mirrored"
                        />
                      </td>
                      <td>
                        <InvoiceStateChip state={i.state} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>

        <aside className={f.side}>
          <section className={s.card} aria-labelledby="ids">
            <h3 id="ids" className={s.h2}>
              Provider identities
            </h3>
            <KV
              rows={[
                { k: "Billing request", v: <ProviderId id={c.gcBillingRequestId} missing="none" /> },
                {
                  k: "Mandate",
                  v: (
                    <ProviderId
                      id={c.gcMandateId}
                      href={c.gcMandateId ? providerLinks.gcMandate(c.gcMandateId) : undefined}
                      missing="none"
                    />
                  ),
                },
                {
                  k: "Subscription",
                  v: (
                    <ProviderId
                      id={c.gcSubscriptionId}
                      href={c.gcSubscriptionId ? providerLinks.gcSubscription(c.gcSubscriptionId) : undefined}
                      missing="none"
                    />
                  ),
                },
                { k: "Local row", v: <span className={s.mono}>{c.id}</span> },
                { k: "Raw status", v: <span className={s.mono}>{c.status}</span> },
              ]}
            />
          </section>

          <section className={s.card} aria-labelledby="terms">
            <h3 id="terms" className={s.h2}>
              Terms evidence
            </h3>
            <KV
              rows={[
                { k: "Terms version", v: c.termsVersion ?? <span className={s.faint}>not recorded</span> },
                { k: "Accepted", v: c.termsAcceptedAt ? fmtDate(c.termsAcceptedAt) : <span className={s.faint}>not recorded</span> },
                { k: "Plan", v: `${c.planLabel}${c.legacy ? " (legacy)" : ""}` },
                { k: "Owner", v: c.owner },
              ]}
            />
          </section>

          <section className={s.card} aria-labelledby="col-exceptions">
            <h3 id="col-exceptions" className={s.h2}>
              Exceptions
            </h3>
            {exceptions.length === 0 ? (
              <p className={s.muted}>None.</p>
            ) : (
              <ul className={s.list}>
                {exceptions.map((e) => (
                  <li key={e.id} className={s.listItem}>
                    <span>
                      <Link href={`/admin/finance/exceptions/${e.id}`} className={s.rowLink}>
                        {e.title}
                      </Link>
                      <span className={f.sub}>{EXCEPTION_KIND_LABEL[e.kind]}</span>
                    </span>
                    <ExceptionStateChip state={e.state} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
