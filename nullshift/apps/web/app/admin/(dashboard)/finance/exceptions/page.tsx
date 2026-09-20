import Link from "next/link";
import {
  EXCEPTION_KIND_LABEL,
  fmtDate,
  loadExceptions,
  type ExceptionFilter,
  type ExceptionKind,
} from "@/lib/ops/financeData";
import { Amount, ClientLink, Empty, ExceptionStateChip, SourceNote } from "../ui";
import s from "../../shell.module.css";
import f from "../finance.module.css";

const KINDS = Object.keys(EXCEPTION_KIND_LABEL) as ExceptionKind[];

const FILTERS: { key: ExceptionFilter; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "all", label: "All" },
  { key: "resolved", label: "Resolved" },
  ...KINDS.map((k) => ({ key: k as ExceptionFilter, label: EXCEPTION_KIND_LABEL[k] })),
];

/**
 * Finance › Exceptions: recorded rows from finance_exceptions (when 0065 is
 * applied) plus exceptions derived on every read from live subscriptions and
 * invoices. Each carries an owner (projects.finance_owner or Unassigned) and
 * a link to the legacy page that can act on it.
 */
export default async function ExceptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string | string[] }>;
}) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.filter) ? sp.filter[0] : sp.filter;
  const filter: ExceptionFilter = FILTERS.some((x) => x.key === raw) ? (raw as ExceptionFilter) : "open";
  const { rows, recordedAvailable } = await loadExceptions(filter);

  return (
    <>
      <SourceNote
        extra={
          recordedAvailable
            ? "Recorded exceptions come from finance_exceptions; derived ones are recomputed from live rows on every read."
            : "finance_exceptions (migration 0065) is not available yet; every exception shown is derived from live subscription and invoice rows."
        }
      />
      <nav className={f.filters} aria-label="Exception filters">
        {FILTERS.map((x) => (
          <Link
            key={x.key}
            href={x.key === "open" ? "/admin/finance/exceptions" : `/admin/finance/exceptions?filter=${x.key}`}
            className={`${f.filter} ${x.key === filter ? f.filterActive : ""}`}
            aria-current={x.key === filter ? "page" : undefined}
          >
            {x.label}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <Empty
          title="No exceptions of this kind"
          body="Derived exceptions open when a subscription is past_due, a Direct Debit link is older than three days with no mandate, an open invoice has no Xero record while Xero is the rail, or an invoice is past its due date."
        />
      ) : (
        <table className={s.table}>
          <thead>
            <tr>
              <th scope="col">Exception</th>
              <th scope="col">Kind</th>
              <th scope="col">Client</th>
              <th scope="col" className={s.num}>
                Amount
              </th>
              <th scope="col">Owner</th>
              <th scope="col">Opened</th>
              <th scope="col">Source</th>
              <th scope="col">Act</th>
              <th scope="col">State</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id}>
                <td>
                  <Link href={`/admin/finance/exceptions/${e.id}`} className={s.rowLink}>
                    {e.title}
                  </Link>
                  {e.severity === "urgent" ? (
                    <span className={f.sub}>
                      <span className={`${s.chip} ${s.chipDanger}`}>urgent</span>
                    </span>
                  ) : null}
                </td>
                <td>{EXCEPTION_KIND_LABEL[e.kind]}</td>
                <td>{e.tenantId ? <ClientLink id={e.tenantId} name={e.tenantName} /> : <span className={s.faint}>{e.tenantName}</span>}</td>
                <td className={s.num}>{e.amount ? <Amount value={e.amount} /> : <span className={s.faint}>—</span>}</td>
                <td className={s.muted}>{e.owner}</td>
                <td>
                  {fmtDate(e.openedAt)}
                  {e.resolvedAt ? <span className={f.sub}>resolved {fmtDate(e.resolvedAt)}</span> : null}
                </td>
                <td className={s.muted}>{e.source}</td>
                <td>
                  <Link href={e.action.href} className={s.rowLink}>
                    {e.action.label}
                  </Link>
                </td>
                <td>
                  <ExceptionStateChip state={e.state} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
