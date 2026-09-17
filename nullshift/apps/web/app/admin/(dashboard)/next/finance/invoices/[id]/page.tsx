import Link from "next/link";
import { notFound } from "next/navigation";
import {
  COLLECTIONS,
  EXCEPTION_KIND_LABEL,
  clientRef,
  creditedMinor,
  exceptionsFor,
  fmtDate,
  gbpMinor,
  invoiceById,
  isOverdue,
  overAllocated,
  paidMinor,
  remainingMinor,
} from "@/lib/next/fixtures-finance";
import {
  Amount,
  ClientLink,
  CollectionStateChip,
  ExceptionStateChip,
  InvoiceStateChip,
  KV,
  SourceNote,
} from "../../ui";
import s from "../../../next.module.css";
import f from "../../finance.module.css";

/**
 * Finance › Invoices › detail (brief §5.6). Obligation, immutable issued lines,
 * tax basis snapshot, amount due, Xero identity, allocations, remaining balance,
 * credits/refunds, collection links and event history.
 */
export default async function InvoiceDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const inv = invoiceById(id);
  if (!inv) notFound();

  const c = clientRef(inv.clientId);
  const paid = paidMinor(inv);
  const credited = creditedMinor(inv);
  const remaining = remainingMinor(inv);
  const overdue = isOverdue(inv);
  const collections = COLLECTIONS.filter((col) => inv.collectionIds.includes(col.id));
  const exceptions = exceptionsFor({ invoiceId: inv.id });
  const events = [...inv.events].sort((a, b) => (a.at < b.at ? 1 : -1));

  return (
    <>
      <p className={s.mono}>
        <Link href="/admin/next/finance/invoices">Invoices</Link> / {inv.id}
      </p>
      <div className={s.pageHead}>
        <div>
          <h2 className={s.h1} style={{ fontSize: 22 }}>
            {inv.id} · {inv.obligation.label}
          </h2>
          <p className={s.lead}>
            <ClientLink id={c.id} name={c.legalName} legacy={c.model === "legacy"} /> ·{" "}
            {c.ref} · issued {fmtDate(inv.issuedAt)} · due {fmtDate(inv.dueAt)}
          </p>
        </div>
        <div className={s.chips}>
          <InvoiceStateChip state={overdue ? "overdue" : inv.state} />
          {overAllocated(inv) ? (
            <span className={`${s.chip} ${s.chipDanger}`}>Over-allocated — defect</span>
          ) : null}
        </div>
      </div>
      <SourceNote />

      <div className={f.detail}>
        <div className={s.stack}>
          <section className={s.card} aria-labelledby="issued-lines">
            <div className={s.cardTitle}>
              <h3 id="issued-lines" className={s.h2}>
                Issued line items
              </h3>
              <span className={`${s.chip}`}>Immutable once issued</span>
            </div>
            <p className={s.muted} style={{ marginTop: 0 }}>
              Editing accepted scope never overwrites these lines. A change creates a
              typed credit note or a new invoice against a new obligation.
            </p>
            <table className={s.table}>
              <thead>
                <tr>
                  <th scope="col">Description</th>
                  <th scope="col" className={s.num}>
                    Qty
                  </th>
                  <th scope="col" className={s.num}>
                    Net
                  </th>
                  <th scope="col" className={s.num}>
                    Tax
                  </th>
                  <th scope="col" className={s.num}>
                    Gross
                  </th>
                </tr>
              </thead>
              <tbody>
                {inv.lines.map((l, n) => (
                  <tr key={n}>
                    <td>{l.description}</td>
                    <td className={s.num}>{l.quantity}</td>
                    <td className={s.num}>
                      <Amount value={gbpMinor(l.netMinor)} />
                    </td>
                    <td className={s.num}>
                      <Amount value={gbpMinor(l.taxMinor)} />
                    </td>
                    <td className={s.num}>
                      <Amount value={gbpMinor(l.grossMinor)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className={f.equation} style={{ marginTop: 12 }}>
              <span className={f.equationLabel}>Net</span>
              <Amount value={gbpMinor(inv.netMinor)} />
              <span className={f.equationLabel}>
                Tax — {inv.tax.code} at {inv.tax.ratePct}%
              </span>
              <Amount value={gbpMinor(inv.taxMinor)} />
              <span className={`${f.equationLabel} ${f.equationTotal}`}>Gross</span>
              <span className={f.equationTotal}>
                <Amount value={gbpMinor(inv.grossMinor)} />
              </span>
            </div>
            <p className={s.muted} style={{ fontSize: 12, marginBottom: 0 }}>
              Tax basis snapshot: {inv.tax.basis}
              {inv.tax.decisionRef ? ` (decision ${inv.tax.decisionRef})` : ""}.
            </p>
          </section>

          <section className={s.card} aria-labelledby="allocations">
            <h3 id="allocations" className={s.h2}>
              Payment allocations
            </h3>
            {inv.allocations.length === 0 ? (
              <p className={s.muted}>No payments allocated yet.</p>
            ) : (
              <table className={s.table}>
                <thead>
                  <tr>
                    <th scope="col">Payment</th>
                    <th scope="col">Source</th>
                    <th scope="col">Date</th>
                    <th scope="col" className={s.num}>
                      Amount
                    </th>
                    <th scope="col">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {inv.allocations.map((a) => (
                    <tr key={`${a.paymentId}-${a.at}`}>
                      <td>
                        {a.source === "credit_note" ? (
                          <span className={s.mono}>{a.paymentId}</span>
                        ) : a.source === "gocardless_collection" ? (
                          <Link
                            href={`/admin/next/finance/collections/${a.paymentId}`}
                            className={s.rowLink}
                          >
                            {a.paymentId}
                          </Link>
                        ) : (
                          <Link
                            href="/admin/next/finance/reconciliation"
                            className={s.rowLink}
                          >
                            {a.paymentId}
                          </Link>
                        )}
                      </td>
                      <td>{a.source.replace(/_/g, " ")}</td>
                      <td>{fmtDate(a.at)}</td>
                      <td className={s.num}>
                        <Amount value={gbpMinor(a.amountMinor)} />
                      </td>
                      <td className={s.muted}>{a.note ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className={s.card} aria-labelledby="credits">
            <h3 id="credits" className={s.h2}>
              Credits and refunds
            </h3>
            {inv.credits.length === 0 ? (
              <p className={s.muted}>
                None. Credits and refunds are typed operations, never negative price
                edits.
              </p>
            ) : (
              <ul className={s.list}>
                {inv.credits.map((cr) => (
                  <li key={cr.id} className={s.listItem}>
                    <span>
                      <span className={s.mono}>
                        {cr.id} · {cr.kind.replace("_", " ")}
                      </span>
                      <span className={f.sub}>
                        {cr.reason} · {fmtDate(cr.at)} · issued by {cr.issuedBy}
                      </span>
                    </span>
                    <Amount value={gbpMinor(-cr.amountMinor)} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={s.card} aria-labelledby="history">
            <h3 id="history" className={s.h2}>
              Event history
            </h3>
            <ol className={f.timeline}>
              {events.map((e, n) => (
                <li key={n}>
                  <span className={f.timelineAt}>
                    {e.at.replace("T", " ").slice(0, 16)} UTC
                  </span>
                  <span className={f.timelineActor}>{e.actor}</span>
                  <span>{e.text}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className={f.side}>
          <section className={s.card} aria-labelledby="balance">
            <h3 id="balance" className={s.h2}>
              Balance
            </h3>
            <div className={f.equation}>
              <span className={f.equationLabel}>Gross issued</span>
              <Amount value={gbpMinor(inv.grossMinor)} />
              <span className={f.equationLabel}>− payments allocated</span>
              <Amount value={gbpMinor(paid)} />
              <span className={f.equationLabel}>− credits and refunds</span>
              <Amount value={gbpMinor(credited)} />
              <span className={`${f.equationLabel} ${f.equationTotal}`}>
                Remaining balance
              </span>
              <span className={f.equationTotal}>
                <Amount value={gbpMinor(remaining)} />
              </span>
            </div>
            <p className={s.muted} style={{ fontSize: 12, marginBottom: 0 }}>
              Amount due {fmtDate(inv.dueAt)} · {inv.currency} ·{" "}
              {overdue ? "overdue" : remaining === 0 ? "settled" : "not yet due or open"}
            </p>
          </section>

          <section className={s.card} aria-labelledby="obligation">
            <h3 id="obligation" className={s.h2}>
              Obligation
            </h3>
            <KV
              rows={[
                {
                  k: "Obligation id",
                  v: <span className={s.mono}>{inv.obligation.id}</span>,
                },
                { k: "Milestone / period", v: inv.obligation.label },
                { k: "Source", v: inv.obligation.source },
                { k: "Issuer", v: "Xero primary (projection of this obligation)" },
              ]}
            />
          </section>

          <section className={s.card} aria-labelledby="xero">
            <h3 id="xero" className={s.h2}>
              Xero identity
            </h3>
            {inv.xero.state === "synced" ? (
              <KV
                rows={[
                  {
                    k: "Xero invoice id",
                    v: <span className={s.mono}>{inv.xero.xeroInvoiceId}</span>,
                  },
                  {
                    k: "Last synced",
                    v: inv.xero.lastSyncedAt.replace("T", " ").slice(0, 16) + " UTC",
                  },
                  {
                    k: "Link",
                    v: <span className={s.faint}>fictional id — no live link</span>,
                  },
                ]}
              />
            ) : inv.xero.state === "payment_sync_failed" ? (
              <KV
                rows={[
                  {
                    k: "Xero invoice id",
                    v: <span className={s.mono}>{inv.xero.xeroInvoiceId}</span>,
                  },
                  {
                    k: "Payment sync",
                    v: <span className={`${s.chip} ${s.chipDanger}`}>Failed</span>,
                  },
                  { k: "Error", v: inv.xero.lastError },
                  {
                    k: "Exception",
                    v: (
                      <Link
                        href={`/admin/next/finance/exceptions/${inv.xero.exceptionId}`}
                      >
                        {inv.xero.exceptionId}
                      </Link>
                    ),
                  },
                ]}
              />
            ) : inv.xero.state === "create_failed" ? (
              <KV
                rows={[
                  {
                    k: "Xero invoice id",
                    v: <span className={`${s.chip} ${s.chipDanger}`}>Not created</span>,
                  },
                  { k: "Attempts", v: String(inv.xero.attempts) },
                  { k: "Error", v: inv.xero.lastError },
                  {
                    k: "Exception",
                    v: (
                      <Link
                        href={`/admin/next/finance/exceptions/${inv.xero.exceptionId}`}
                      >
                        {inv.xero.exceptionId}
                      </Link>
                    ),
                  },
                ]}
              />
            ) : (
              <p className={s.muted}>{inv.xero.reason}</p>
            )}
          </section>

          <section className={s.card} aria-labelledby="collections">
            <h3 id="collections" className={s.h2}>
              Collections
            </h3>
            {collections.length === 0 ? (
              <p className={s.muted}>
                No Direct Debit collection targets this obligation (settled by bank
                transfer or not yet collected).
              </p>
            ) : (
              <ul className={s.list}>
                {collections.map((col) => (
                  <li key={col.id} className={s.listItem}>
                    <span>
                      <Link
                        href={`/admin/next/finance/collections/${col.id}`}
                        className={s.rowLink}
                      >
                        {col.id}
                      </Link>
                      <span className={f.sub}>
                        {col.provider} ·{" "}
                        {col.actualChargeDate
                          ? `charged ${fmtDate(col.actualChargeDate)}`
                          : `requested ${fmtDate(col.requestedChargeDate)}`}
                      </span>
                    </span>
                    <CollectionStateChip state={col.state} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={s.card} aria-labelledby="inv-exceptions">
            <h3 id="inv-exceptions" className={s.h2}>
              Exceptions
            </h3>
            {exceptions.length === 0 ? (
              <p className={s.muted}>None.</p>
            ) : (
              <ul className={s.list}>
                {exceptions.map((e) => (
                  <li key={e.id} className={s.listItem}>
                    <span>
                      <Link
                        href={`/admin/next/finance/exceptions/${e.id}`}
                        className={s.rowLink}
                      >
                        {e.id}
                      </Link>
                      <span className={f.sub}>
                        {EXCEPTION_KIND_LABEL[e.kind]} · {e.owner}
                      </span>
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
