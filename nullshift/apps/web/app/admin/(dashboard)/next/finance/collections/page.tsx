import Link from "next/link";
import {
  COLLECTIONS,
  clientRef,
  fmtDate,
  type Collection,
} from "@/lib/next/fixtures-finance";
import {
  Amount,
  BankMatchChip,
  ClientLink,
  CollectionStateChip,
  Empty,
  MandateChip,
  PayoutStateChip,
  SourceNote,
} from "../ui";
import s from "../../next.module.css";
import f from "../finance.module.css";

type Filter = "all" | "authorised" | "scheduled" | "collected" | "failed";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "authorised", label: "Authorised — not scheduled" },
  { key: "scheduled", label: "Scheduled" },
  { key: "collected", label: "Collected, awaiting payout" },
  { key: "failed", label: "Failed or cancelled" },
];

function applyFilter(list: Collection[], filter: Filter): Collection[] {
  switch (filter) {
    case "authorised":
      return list.filter((c) => c.state === "authorised_not_scheduled");
    case "scheduled":
      return list.filter((c) => c.state === "scheduled");
    case "collected":
      return list.filter((c) => c.state === "confirmed" && c.payout === "pending");
    case "failed":
      return list.filter((c) => c.state === "failed" || c.state === "cancelled");
    default:
      return list;
  }
}

const ORDER: Record<Collection["state"], number> = {
  authorised_not_scheduled: 0,
  failed: 1,
  scheduled: 2,
  submitted: 3,
  confirmed: 4,
  cancelled: 5,
};

export default async function CollectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string | string[] }>;
}) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.filter) ? sp.filter[0] : sp.filter;
  const filter: Filter = FILTERS.some((x) => x.key === raw) ? (raw as Filter) : "all";
  const rows = applyFilter(COLLECTIONS, filter).sort(
    (a, b) => ORDER[a.state] - ORDER[b.state]
  );

  return (
    <>
      <SourceNote />
      <nav className={f.filters} aria-label="Collection filters">
        {FILTERS.map((x) => (
          <Link
            key={x.key}
            href={
              x.key === "all"
                ? "/admin/next/finance/collections"
                : `/admin/next/finance/collections?filter=${x.key}`
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
          title="No collections in this state"
          body="A collection appears here once a mandate is authorised for an accepted obligation. Authorised mandates with nothing scheduled are listed under their own state, never as scheduled."
        />
      ) : (
        <table className={s.table}>
          <thead>
            <tr>
              <th scope="col">Collection</th>
              <th scope="col">Client · obligation</th>
              <th scope="col">Mandate</th>
              <th scope="col" className={s.num}>
                Accepted amount
              </th>
              <th scope="col">Contractual start</th>
              <th scope="col">Charge date</th>
              <th scope="col">Collection</th>
              <th scope="col">Payout</th>
              <th scope="col">Bank match</th>
              <th scope="col">Owner</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((col) => {
              const c = clientRef(col.clientId);
              return (
                <tr key={col.id} className={c.model === "legacy" ? f.legacy : undefined}>
                  <td>
                    <Link
                      href={`/admin/next/finance/collections/${col.id}`}
                      className={s.rowLink}
                    >
                      {col.id}
                    </Link>
                    <span className={f.sub}>{col.provider}</span>
                  </td>
                  <td>
                    <ClientLink
                      id={c.id}
                      name={c.legalName}
                      legacy={c.model === "legacy"}
                    />
                    <span className={f.sub}>{col.obligation.label}</span>
                  </td>
                  <td>
                    <MandateChip state={col.mandate} />
                  </td>
                  <td className={s.num}>
                    <Amount value={col.acceptedAmount} />
                  </td>
                  <td>{fmtDate(col.contractualStart)}</td>
                  <td>
                    {col.actualChargeDate ? (
                      <>
                        {fmtDate(col.actualChargeDate)}
                        <span className={f.sub}>
                          requested {fmtDate(col.requestedChargeDate)}
                        </span>
                      </>
                    ) : col.requestedChargeDate ? (
                      <>
                        {fmtDate(col.requestedChargeDate)}
                        <span className={f.sub}>requested · not yet charged</span>
                      </>
                    ) : (
                      <span className={s.faint}>none requested</span>
                    )}
                  </td>
                  <td>
                    <CollectionStateChip state={col.state} />
                  </td>
                  <td>
                    <PayoutStateChip state={col.payout} />
                  </td>
                  <td>
                    <BankMatchChip state={col.bankMatch} />
                  </td>
                  <td className={s.muted}>{col.owner}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
