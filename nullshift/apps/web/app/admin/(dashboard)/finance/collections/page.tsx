import Link from "next/link";
import { fmtDate, loadCollections, providerLinks, type CollectionStatus } from "@/lib/ops/financeData";
import { Amount, ClientLink, CollectionStateChip, Empty, ProviderId, SourceNote } from "../ui";
import s from "../../shell.module.css";
import f from "../finance.module.css";

type Filter = "all" | "link_sent" | "mandate_active" | "collection_failed" | "cancelled";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "link_sent", label: "Link sent, no mandate" },
  { key: "mandate_active", label: "Mandate active" },
  { key: "collection_failed", label: "Collection failed" },
  { key: "cancelled", label: "Cancelled" },
];

const ORDER: Record<CollectionStatus, number> = {
  collection_failed: 0,
  link_sent: 1,
  trialing: 2,
  mandate_active: 3,
  cancelled: 4,
};

/**
 * Finance › Collections: one row per Direct Debit subscription. GoCardless is
 * the system of record for mandates and charge dates; the live board at
 * /admin/billing/direct-debits is where links are sent and mandates managed.
 */
export default async function CollectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string | string[] }>;
}) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.filter) ? sp.filter[0] : sp.filter;
  const filter: Filter = FILTERS.some((x) => x.key === raw) ? (raw as Filter) : "all";
  const { rows: all } = await loadCollections();
  const rows = all
    .filter((c) => filter === "all" || c.collection === filter)
    .sort((a, b) => ORDER[a.collection] - ORDER[b.collection]);

  return (
    <>
      <SourceNote extra="Charge dates and payout dates are held by GoCardless and are not stored locally." />

      <div className={s.strip} style={{ marginBottom: 16 }}>
        <span className={s.mono}>Action surface</span>
        <strong>Mandates are managed on the live Direct Debits board.</strong>
        <Link href="/admin/billing/direct-debits" className={s.btnPrimary}>
          Open Direct Debits board →
        </Link>
      </div>

      <nav className={f.filters} aria-label="Collection filters">
        {FILTERS.map((x) => (
          <Link
            key={x.key}
            href={x.key === "all" ? "/admin/finance/collections" : `/admin/finance/collections?filter=${x.key}`}
            className={`${f.filter} ${x.key === filter ? f.filterActive : ""}`}
            aria-current={x.key === filter ? "page" : undefined}
          >
            {x.label}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <Empty
          title="No Direct Debit subscriptions in this state"
          body={
            <>
              A row appears here once a GoCardless link has been sent from the{" "}
              <Link href="/admin/billing/direct-debits">Direct Debits board</Link>.
            </>
          }
        />
      ) : (
        <table className={s.table}>
          <thead>
            <tr>
              <th scope="col">Client</th>
              <th scope="col">Plan</th>
              <th scope="col">Status</th>
              <th scope="col" className={s.num}>
                Monthly
              </th>
              <th scope="col">Terms</th>
              <th scope="col">GoCardless ids</th>
              <th scope="col">Started</th>
              <th scope="col">Owner</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className={c.legacy ? f.legacy : undefined}>
                <td>
                  <Link href={`/admin/finance/collections/${c.id}`} className={s.rowLink}>
                    {c.tenantName}
                  </Link>
                  <span className={f.sub}>
                    <span className={s.mono}>{c.id.slice(0, 8)}</span> · {c.provider}
                  </span>
                </td>
                <td>
                  {c.planLabel}
                  {c.legacy ? <span className={f.sub}>legacy plan</span> : null}
                </td>
                <td>
                  <CollectionStateChip state={c.collection} />
                  {c.scheduledAtProvider ? (
                    <span className={f.sub}>subscription exists at provider</span>
                  ) : c.collection === "mandate_active" ? (
                    <span className={f.sub}>no provider subscription id</span>
                  ) : null}
                </td>
                <td className={s.num}>
                  <Amount value={c.mrr} />
                </td>
                <td>
                  {c.termsVersion ? (
                    <>
                      <span className={s.mono}>{c.termsVersion}</span>
                      <span className={f.sub}>accepted {fmtDate(c.termsAcceptedAt)}</span>
                    </>
                  ) : (
                    <span className={s.faint}>no terms recorded</span>
                  )}
                </td>
                <td>
                  <ProviderId id={c.gcBillingRequestId} missing="no billing request" />
                  <span className={f.sub}>
                    <ProviderId
                      id={c.gcMandateId}
                      href={c.gcMandateId ? providerLinks.gcMandate(c.gcMandateId) : undefined}
                      missing="no mandate"
                    />
                  </span>
                  <span className={f.sub}>
                    <ProviderId
                      id={c.gcSubscriptionId}
                      href={c.gcSubscriptionId ? providerLinks.gcSubscription(c.gcSubscriptionId) : undefined}
                      missing="no subscription"
                    />
                  </span>
                </td>
                <td>
                  {c.startedAt ? fmtDate(c.startedAt) : <span className={s.faint}>not started</span>}
                  <span className={f.sub}>created {fmtDate(c.createdAt)}</span>
                </td>
                <td className={s.muted}>{c.owner}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
