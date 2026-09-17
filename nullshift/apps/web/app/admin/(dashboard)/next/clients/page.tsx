import Link from "next/link";
import { CLIENTS } from "@/lib/next/fixtures";
import s from "../next.module.css";
import { realDataEnabled } from "@/lib/next/live-data";
import { LiveClients } from "../LiveViews";

const tone = (state: string): string => {
  if (["accepted", "current", "live", "healthy", "active"].includes(state))
    return s.chipSuccess;
  if (["exception", "overdue", "incident"].includes(state)) return s.chipDanger;
  if (
    [
      "awaiting acceptance",
      "setup pending",
      "attention",
      "review",
      "awaiting client",
    ].includes(state)
  )
    return s.chipWarning;
  return "";
};

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  if (realDataEnabled()) return <LiveClients query={(await searchParams).q} />;
  return (
    <>
      <div className={s.pageHead}>
        <div>
          <p className={s.mono}>Clients · {CLIENTS.length} fictional</p>
          <h1 className={s.h1}>Clients</h1>
          <p className={s.lead}>
            One row per legal client. Facets are independent; none of them is derived from
            signature state alone.
          </p>
        </div>
        <div className={s.chips} aria-label="Filters">
          {[
            "Owner",
            "Lifecycle",
            "Legacy / new model",
            "Unresolved actions",
            "Overdue balance",
            "Service status",
          ].map((f) => (
            <span key={f} className={s.chip}>
              {f}
            </span>
          ))}
        </div>
      </div>
      <div className={s.card} style={{ padding: 0 }}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>Client</th>
              <th>Relationship</th>
              <th>Owner</th>
              <th>Projects</th>
              <th>Next action</th>
              <th>Agreement</th>
              <th>Billing</th>
              <th>Route</th>
            </tr>
          </thead>
          <tbody>
            {CLIENTS.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link href={`/admin/next/clients/${c.id}`} className={s.rowLink}>
                    {c.legalName}
                  </Link>
                  <div className={s.mono}>
                    {c.ref} · {c.model === "legacy" ? "legacy" : "new model"}
                  </div>
                </td>
                <td>
                  <span className={`${s.chip} ${tone(c.facets.relationship)}`}>
                    {c.facets.relationship}
                  </span>
                </td>
                <td>{c.owner}</td>
                <td className={s.num}>{c.systems.length}</td>
                <td>
                  <div>{c.nextAction.text}</div>
                  <div className={s.mono}>
                    {c.nextAction.owner} · {c.nextAction.due}
                  </div>
                </td>
                <td>
                  <span className={`${s.chip} ${tone(c.facets.agreement.state)}`}>
                    {c.facets.agreement.state}
                  </span>
                </td>
                <td>
                  <span className={`${s.chip} ${tone(c.facets.billing.state)}`}>
                    {c.facets.billing.state}
                  </span>
                </td>
                <td>
                  <span className={s.chip}>{c.facets.route.state}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
