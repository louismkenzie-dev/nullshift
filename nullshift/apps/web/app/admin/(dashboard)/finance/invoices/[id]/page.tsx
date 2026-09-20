import Link from "next/link";
import { notFound } from "next/navigation";
import {
  EXCEPTION_KIND_LABEL,
  fmtDate,
  fmtStamp,
  gbpMinor,
  loadInvoice,
  providerLinks,
} from "@/lib/ops/financeData";
import { Amount, ClientLink, ExceptionStateChip, InvoiceStateChip, KV, ProviderId, SourceNote } from "../../ui";
import s from "../../../shell.module.css";
import f from "../../finance.module.css";

/**
 * Finance › Invoices › detail (brief §5.6): the invoice row, its line items,
 * provider identities as links, the 0062 obligation and allocations when those
 * tables exist, and the exceptions that reference it. Read-only; the client's
 * legacy billing page is where invoices are raised and marked paid.
 */
export default async function InvoiceDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await loadInvoice(id);
  if (!d) notFound();
  const { invoice: inv, items, itemsTotal, obligation, allocations, exceptions } = d;
  const itemsMatch = items.length === 0 || itemsTotal.amountMinor === inv.amount.amountMinor;

  return (
    <>
      <p className={s.mono}>
        <Link href="/admin/finance/invoices">Invoices</Link> / {inv.id}
      </p>
      <div className={s.pageHead}>
        <div>
          <h2 className={s.h1} style={{ fontSize: 22 }}>
            {inv.typeLabel} · <Amount value={inv.amount} />
          </h2>
          <p className={s.lead}>
            <ClientLink id={inv.tenantId} name={inv.tenantName} />
            {d.projectName ? ` · ${d.projectName}` : ""} · issued {fmtDate(inv.createdAt)} ·{" "}
            {inv.dueAt ? `due ${fmtDate(inv.dueAt)}` : "no due date"}
          </p>
        </div>
        <div className={s.chips}>
          <InvoiceStateChip state={inv.state} />
          <Link href={`/admin/clients/${inv.tenantId}/billing`} className={s.btn}>
            Open in client billing
          </Link>
        </div>
      </div>
      <SourceNote />

      <div className={f.detail}>
        <div className={s.stack}>
          <section className={s.card} aria-labelledby="issued-lines">
            <div className={s.cardTitle}>
              <h3 id="issued-lines" className={s.h2}>
                Line items
              </h3>
              <span className={s.chip}>invoice_items</span>
            </div>
            {items.length === 0 ? (
              <p className={s.muted}>
                No itemised lines recorded; the invoice carries a single amount.
              </p>
            ) : (
              <table className={s.table}>
                <thead>
                  <tr>
                    <th scope="col">Description</th>
                    <th scope="col" className={s.num}>
                      Qty
                    </th>
                    <th scope="col" className={s.num}>
                      Unit
                    </th>
                    <th scope="col" className={s.num}>
                      Line
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((l) => (
                    <tr key={l.id}>
                      <td>{l.name}</td>
                      <td className={s.num}>{l.quantity}</td>
                      <td className={s.num}>
                        <Amount value={l.amount} />
                      </td>
                      <td className={s.num}>
                        <Amount value={l.lineTotal} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className={f.equation} style={{ marginTop: 12 }}>
              <span className={f.equationLabel}>Lines total</span>
              <Amount value={itemsTotal} />
              <span className={`${f.equationLabel} ${f.equationTotal}`}>Invoice amount</span>
              <span className={f.equationTotal}>
                <Amount value={inv.amount} />
              </span>
            </div>
            {!itemsMatch ? (
              <p className={s.muted} style={{ fontSize: 12, marginBottom: 0, color: "var(--ns-danger)" }}>
                Line items do not sum to the invoice amount — check the legacy billing page.
              </p>
            ) : null}
            <p className={s.muted} style={{ fontSize: 12, marginBottom: 0 }}>
              Tax: the legacy invoice row stores one amount with no net/tax split. Nullshift
              is not VAT registered; no tax is applied.
            </p>
          </section>

          <section className={s.card} aria-labelledby="allocations">
            <h3 id="allocations" className={s.h2}>
              Payment allocations
            </h3>
            {!allocations.available ? (
              <p className={s.muted}>
                Not recorded — payment_allocations (migration 0062) is not available yet.
                {inv.paidAt
                  ? ` The invoice was marked paid ${fmtDate(inv.paidAt)}${inv.gcPaymentId ? " from a GoCardless payment" : ""}.`
                  : ""}
              </p>
            ) : allocations.rows.length === 0 ? (
              <p className={s.muted}>
                No allocations recorded against this invoice.
                {inv.paidAt ? ` It was marked paid ${fmtDate(inv.paidAt)} before allocations were tracked.` : ""}
              </p>
            ) : (
              <>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th scope="col">Payment</th>
                      <th scope="col">Provider</th>
                      <th scope="col">Kind</th>
                      <th scope="col">Allocated</th>
                      <th scope="col" className={s.num}>
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {allocations.rows.map((a) => (
                      <tr key={a.id}>
                        <td className={s.mono}>{a.provider_payment_id}</td>
                        <td>{a.provider}</td>
                        <td>{a.kind}</td>
                        <td>{fmtDate(a.allocated_at)}</td>
                        <td className={s.num}>
                          <Amount value={gbpMinor(a.kind === "payment" ? a.amount_minor : -a.amount_minor)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className={s.muted} style={{ fontSize: 12, marginBottom: 0 }}>
                  Net allocated <Amount value={gbpMinor(allocations.totalMinor)} /> of{" "}
                  <Amount value={inv.amount} />.
                </p>
              </>
            )}
          </section>

          <section className={s.card} aria-labelledby="history">
            <h3 id="history" className={s.h2}>
              Record history
            </h3>
            <ol className={f.timeline}>
              <li>
                <span className={f.timelineAt}>{fmtStamp(inv.createdAt)}</span>
                <span className={f.timelineActor}>system</span>
                <span>Invoice row created ({inv.status === "draft" ? "draft" : "issued"})</span>
              </li>
              {inv.paidAt ? (
                <li>
                  <span className={f.timelineAt}>{fmtStamp(inv.paidAt)}</span>
                  <span className={f.timelineActor}>{inv.gcPaymentId ? "GoCardless" : "staff / provider"}</span>
                  <span>Marked paid{inv.gcPaymentId ? ` from payment ${inv.gcPaymentId}` : ""}</span>
                </li>
              ) : null}
              <li>
                <span className={f.timelineAt}>{fmtStamp(inv.createdAt)}</span>
                <span className={f.timelineActor}>system</span>
                <span>Created</span>
              </li>
            </ol>
          </section>
        </div>

        <aside className={f.side}>
          <section className={s.card} aria-labelledby="balance">
            <h3 id="balance" className={s.h2}>
              Status
            </h3>
            <KV
              rows={[
                { k: "Status", v: <InvoiceStateChip state={inv.state} /> },
                { k: "Amount", v: <Amount value={inv.amount} /> },
                { k: "Due", v: fmtDate(inv.dueAt) },
                { k: "Paid", v: inv.paidAt ? fmtDate(inv.paidAt) : "not paid" },
                { k: "Owner", v: inv.owner },
              ]}
            />
          </section>

          <section className={s.card} aria-labelledby="obligation">
            <h3 id="obligation" className={s.h2}>
              Obligation
            </h3>
            {!obligation.available ? (
              <p className={s.muted}>Not recorded — billing_obligations (0062) not available yet.</p>
            ) : !obligation.row ? (
              <p className={s.muted}>No obligation linked to this invoice.</p>
            ) : (
              <KV
                rows={[
                  { k: "Obligation id", v: <span className={s.mono}>{obligation.row.id}</span> },
                  { k: "Kind", v: obligation.row.kind.replace(/_/g, " ") },
                  {
                    k: "Label",
                    v:
                      obligation.row.label ??
                      obligation.row.milestone_key ??
                      (obligation.row.period_start
                        ? `${fmtDate(obligation.row.period_start)} – ${fmtDate(obligation.row.period_end)}`
                        : "—"),
                  },
                  { k: "Gross", v: <Amount value={gbpMinor(obligation.row.amount_gross_minor)} /> },
                  { k: "Tax code", v: obligation.row.tax_code_ref },
                  { k: "Orchestrator", v: obligation.row.orchestrator.replace(/_/g, " ") },
                  { k: "State", v: obligation.row.state.replace(/_/g, " ") },
                ]}
              />
            )}
          </section>

          <section className={s.card} aria-labelledby="providers">
            <h3 id="providers" className={s.h2}>
              Provider identities
            </h3>
            <KV
              rows={[
                {
                  k: "Xero invoice",
                  v: inv.xeroInvoiceId ? (
                    <ProviderId id={inv.xeroInvoiceId} href={providerLinks.xero(inv.xeroInvoiceId)} />
                  ) : inv.missingXero ? (
                    <span className={`${s.chip} ${s.chipDanger}`}>Not created</span>
                  ) : (
                    <span className={s.faint}>none</span>
                  ),
                },
                {
                  k: "Stripe invoice",
                  v: (
                    <ProviderId
                      id={inv.stripeInvoiceId}
                      href={inv.stripeInvoiceId ? providerLinks.stripeInvoice(inv.stripeInvoiceId) : undefined}
                      missing="none"
                    />
                  ),
                },
                {
                  k: "GoCardless payment",
                  v: (
                    <ProviderId
                      id={inv.gcPaymentId}
                      href={inv.gcPaymentId ? providerLinks.gcPayment(inv.gcPaymentId) : undefined}
                      missing="none"
                    />
                  ),
                },
                {
                  k: "Hosted invoice",
                  v: inv.hostedInvoiceUrl ? (
                    <a href={inv.hostedInvoiceUrl} target="_blank" rel="noreferrer noopener" className={s.rowLink}>
                      open ↗
                    </a>
                  ) : (
                    <span className={s.faint}>none</span>
                  ),
                },
              ]}
            />
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
                      <Link href={`/admin/finance/exceptions/${e.id}`} className={s.rowLink}>
                        {e.title}
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
