import Link from "next/link";
import {
  INVOICES,
  clientRef,
  fmtDate,
  gbpMinor,
  isOverdue,
  paidMinor,
  remainingMinor,
  type Invoice,
} from "@/lib/next/fixtures-finance";
import { Amount, ClientLink, Empty, InvoiceStateChip, SourceNote } from "../ui";
import s from "../../next.module.css";
import f from "../finance.module.css";

type Filter = "all" | "open" | "overdue" | "paid" | "exceptions";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "overdue", label: "Overdue" },
  { key: "paid", label: "Paid" },
  { key: "exceptions", label: "With exceptions" },
];

const KIND_LABEL: Record<Invoice["kind"], string> = {
  build_milestone: "Build milestone",
  service_period: "Service period",
  handover_fee: "Handover fee",
};

function applyFilter(list: Invoice[], filter: Filter): Invoice[] {
  switch (filter) {
    case "open":
      return list.filter((i) => remainingMinor(i) > 0 && i.state !== "void");
    case "overdue":
      return list.filter((i) => isOverdue(i));
    case "paid":
      return list.filter((i) => remainingMinor(i) === 0 && i.state === "paid");
    case "exceptions":
      return list.filter((i) => i.exceptionIds.length > 0);
    default:
      return list;
  }
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string | string[] }>;
}) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.filter) ? sp.filter[0] : sp.filter;
  const filter: Filter = FILTERS.some((x) => x.key === raw) ? (raw as Filter) : "all";
  const rows = applyFilter(INVOICES, filter).sort((a, b) =>
    a.issuedAt < b.issuedAt ? 1 : -1
  );

  return (
    <>
      <SourceNote />
      <nav className={f.filters} aria-label="Invoice filters">
        {FILTERS.map((x) => (
          <Link
            key={x.key}
            href={
              x.key === "all"
                ? "/admin/next/finance/invoices"
                : `/admin/next/finance/invoices?filter=${x.key}`
            }
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
          body="Issued invoices appear here once an accepted obligation is invoiced. Drafts are never listed."
        />
      ) : (
        <table className={s.table}>
          <thead>
            <tr>
              <th scope="col">Invoice</th>
              <th scope="col">Client</th>
              <th scope="col">Obligation</th>
              <th scope="col">Issued · due</th>
              <th scope="col" className={s.num}>
                Gross
              </th>
              <th scope="col" className={s.num}>
                Paid
              </th>
              <th scope="col" className={s.num}>
                Remaining
              </th>
              <th scope="col">State</th>
              <th scope="col">Xero</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => {
              const c = clientRef(i.clientId);
              return (
                <tr key={i.id} className={c.model === "legacy" ? f.legacy : undefined}>
                  <td>
                    <Link
                      href={`/admin/next/finance/invoices/${i.id}`}
                      className={s.rowLink}
                    >
                      {i.id}
                    </Link>
                    <span className={f.sub}>{KIND_LABEL[i.kind]}</span>
                  </td>
                  <td>
                    <ClientLink
                      id={c.id}
                      name={c.legalName}
                      legacy={c.model === "legacy"}
                    />
                  </td>
                  <td>
                    {i.obligation.label}
                    <span className={f.sub}>{i.obligation.id}</span>
                  </td>
                  <td>
                    {fmtDate(i.issuedAt)}
                    <span className={f.sub}>due {fmtDate(i.dueAt)}</span>
                  </td>
                  <td className={s.num}>
                    <Amount value={gbpMinor(i.grossMinor)} />
                  </td>
                  <td className={s.num}>
                    <Amount value={gbpMinor(paidMinor(i))} />
                  </td>
                  <td className={s.num}>
                    <Amount value={gbpMinor(remainingMinor(i))} />
                  </td>
                  <td>
                    <InvoiceStateChip state={isOverdue(i) ? "overdue" : i.state} />
                    {i.exceptionIds.length > 0 ? (
                      <span className={f.sub}>
                        {i.exceptionIds.map((id, n) => (
                          <span key={id}>
                            {n > 0 ? ", " : ""}
                            <Link href={`/admin/next/finance/exceptions/${id}`}>
                              {id}
                            </Link>
                          </span>
                        ))}
                      </span>
                    ) : null}
                  </td>
                  <td>
                    {i.xero.state === "synced" ||
                    i.xero.state === "payment_sync_failed" ? (
                      <span className={s.mono}>{i.xero.xeroInvoiceId}</span>
                    ) : i.xero.state === "create_failed" ? (
                      <span className={`${s.chip} ${s.chipDanger}`}>Not created</span>
                    ) : (
                      <span className={s.faint}>{i.xero.reason}</span>
                    )}
                    {i.xero.state === "payment_sync_failed" ? (
                      <span className={f.sub}>payment sync failed</span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
