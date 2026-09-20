import Link from "next/link";
import { fmtDate, loadInvoices, providerLinks, type InvoiceFilter } from "@/lib/ops/financeData";
import { Amount, ClientLink, Empty, InvoiceStateChip, ProviderId, SourceNote } from "../ui";
import s from "../../shell.module.css";
import f from "../finance.module.css";

const FILTERS: { key: InvoiceFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "overdue", label: "Overdue" },
  { key: "paid", label: "Paid" },
  { key: "unsynced", label: "No Xero record" },
];

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string | string[] }>;
}) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.filter) ? sp.filter[0] : sp.filter;
  const filter: InvoiceFilter = FILTERS.some((x) => x.key === raw) ? (raw as InvoiceFilter) : "all";
  const { rows, total, xeroPrimary } = await loadInvoices(filter);

  return (
    <>
      <SourceNote
        extra={`Newest 100 non-draft invoices (${total} loaded). Invoice rail: ${xeroPrimary ? "Xero primary" : "Stripe hosted invoices"}.`}
      />
      <nav className={f.filters} aria-label="Invoice filters">
        {FILTERS.map((x) => (
          <Link
            key={x.key}
            href={x.key === "all" ? "/admin/finance/invoices" : `/admin/finance/invoices?filter=${x.key}`}
            className={`${f.filter} ${x.key === filter ? f.filterActive : ""}`}
            aria-current={x.key === filter ? "page" : undefined}
          >
            {x.label}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <Empty
          title="No invoices match this filter"
          body="Issued invoices appear here once raised from a client's billing page. Drafts are never listed."
        />
      ) : (
        <table className={s.table}>
          <thead>
            <tr>
              <th scope="col">Invoice</th>
              <th scope="col">Client</th>
              <th scope="col">Type</th>
              <th scope="col">Issued · due</th>
              <th scope="col" className={s.num}>
                Amount
              </th>
              <th scope="col">State</th>
              <th scope="col">Paid</th>
              <th scope="col">Xero</th>
              <th scope="col">Stripe · GoCardless</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => (
              <tr key={i.id}>
                <td>
                  <Link href={`/admin/finance/invoices/${i.id}`} className={`${s.rowLink} ${s.mono}`}>
                    {i.id.slice(0, 8)}
                  </Link>
                  {i.hostedInvoiceUrl ? (
                    <span className={f.sub}>
                      <a href={i.hostedInvoiceUrl} target="_blank" rel="noreferrer noopener">
                        hosted invoice ↗
                      </a>
                    </span>
                  ) : null}
                </td>
                <td>
                  <ClientLink id={i.tenantId} name={i.tenantName} />
                </td>
                <td>{i.typeLabel}</td>
                <td>
                  {fmtDate(i.createdAt)}
                  <span className={f.sub}>{i.dueAt ? `due ${fmtDate(i.dueAt)}` : "no due date"}</span>
                </td>
                <td className={s.num}>
                  <Amount value={i.amount} />
                </td>
                <td>
                  <InvoiceStateChip state={i.state} />
                </td>
                <td>{i.paidAt ? fmtDate(i.paidAt) : <span className={s.faint}>—</span>}</td>
                <td>
                  {i.xeroInvoiceId ? (
                    <ProviderId id={i.xeroInvoiceId} href={providerLinks.xero(i.xeroInvoiceId)} />
                  ) : i.missingXero ? (
                    <span className={`${s.chip} ${s.chipDanger}`}>Not created</span>
                  ) : (
                    <span className={s.faint}>—</span>
                  )}
                </td>
                <td>
                  <ProviderId
                    id={i.stripeInvoiceId}
                    href={i.stripeInvoiceId ? providerLinks.stripeInvoice(i.stripeInvoiceId) : undefined}
                  />
                  <span className={f.sub}>
                    <ProviderId
                      id={i.gcPaymentId}
                      href={i.gcPaymentId ? providerLinks.gcPayment(i.gcPaymentId) : undefined}
                      missing="no GoCardless payment"
                    />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
