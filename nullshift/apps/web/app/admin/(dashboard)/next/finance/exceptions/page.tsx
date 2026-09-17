import Link from "next/link";
import {
  EXCEPTIONS,
  EXCEPTION_KIND_LABEL,
  clientRef,
  fmtDate,
  type ExceptionKind,
  type FinanceException,
} from "@/lib/next/fixtures-finance";
import { Amount, ClientLink, Empty, ExceptionStateChip, SourceNote } from "../ui";
import s from "../../next.module.css";
import f from "../finance.module.css";

type Filter = "open" | "all" | "resolved" | ExceptionKind;

const KINDS = Object.keys(EXCEPTION_KIND_LABEL) as ExceptionKind[];

const FILTERS: { key: Filter; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "all", label: "All" },
  { key: "resolved", label: "Resolved" },
  ...KINDS.map((k) => ({ key: k as Filter, label: EXCEPTION_KIND_LABEL[k] })),
];

function applyFilter(list: FinanceException[], filter: Filter): FinanceException[] {
  if (filter === "all") return list;
  if (filter === "open") return list.filter((e) => e.state !== "resolved");
  if (filter === "resolved") return list.filter((e) => e.state === "resolved");
  return list.filter((e) => e.kind === filter);
}

export default async function ExceptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string | string[] }>;
}) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.filter) ? sp.filter[0] : sp.filter;
  const filter: Filter = FILTERS.some((x) => x.key === raw) ? (raw as Filter) : "open";
  const rows = applyFilter(EXCEPTIONS, filter).sort((a, b) =>
    a.openedAt < b.openedAt ? 1 : -1
  );

  return (
    <>
      <SourceNote />
      <nav className={f.filters} aria-label="Exception filters">
        {FILTERS.map((x) => (
          <Link
            key={x.key}
            href={
              x.key === "open"
                ? "/admin/next/finance/exceptions"
                : `/admin/next/finance/exceptions?filter=${x.key}`
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
          title="No exceptions of this kind"
          body="Exceptions open from provider events, sync failures and reconciliation checks. Each one has an owner, an attempt history and a safe retry that says what it will do."
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
              <th scope="col">Attempts</th>
              <th scope="col">Retry</th>
              <th scope="col">State</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => {
              const c = clientRef(e.clientId);
              return (
                <tr key={e.id}>
                  <td>
                    <Link
                      href={`/admin/next/finance/exceptions/${e.id}`}
                      className={s.rowLink}
                    >
                      {e.id}
                    </Link>
                    <span className={f.sub}>{e.title}</span>
                  </td>
                  <td>{EXCEPTION_KIND_LABEL[e.kind]}</td>
                  <td>
                    <ClientLink
                      id={c.id}
                      name={c.legalName}
                      legacy={c.model === "legacy"}
                    />
                  </td>
                  <td className={s.num}>
                    {e.amount ? (
                      <Amount value={e.amount} />
                    ) : (
                      <span className={s.faint}>—</span>
                    )}
                  </td>
                  <td className={s.muted}>{e.owner}</td>
                  <td>
                    {fmtDate(e.openedAt)}
                    {e.resolvedAt ? (
                      <span className={f.sub}>resolved {fmtDate(e.resolvedAt)}</span>
                    ) : null}
                  </td>
                  <td className={s.num}>{e.attempts.length}</td>
                  <td className={s.muted} style={{ maxWidth: 280 }}>
                    {e.retry.availability === "not_applicable" ? (
                      <span className={s.faint}>none</span>
                    ) : (
                      <>
                        {e.retry.does}
                        {e.retry.requiresSecondPerson ? (
                          <span className={f.sub}>second person required</span>
                        ) : null}
                      </>
                    )}
                  </td>
                  <td>
                    <ExceptionStateChip state={e.state} />
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
