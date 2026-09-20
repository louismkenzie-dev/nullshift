import Link from "next/link";
import { loadClientsIndex } from "@/lib/ops/clientsData";
import s from "../shell.module.css";

export const dynamic = "force-dynamic";

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

export default async function ClientsPage() {
  const { clients: CLIENTS, truncated, signals } = await loadClientsIndex();
  return (
    <>
      <div className={s.pageHead}>
        <div>
          <p className={s.mono}>
            Clients · {CLIENTS.length}
            {truncated ? " (first 100)" : ""} · legacy{" "}
            {CLIENTS.filter((c) => c.model === "legacy").length} · new model{" "}
            {CLIENTS.filter((c) => c.model === "new").length}
            {signals.nextActionsAvailable ? "" : " · client_next_actions not available yet"}
          </p>
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
        {CLIENTS.length === 0 ? (
          <p className={s.muted} style={{ padding: 20 }}>
            No client tenants yet.
          </p>
        ) : null}
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
                  <Link href={`/admin/clients/${c.id}`} className={s.rowLink}>
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
