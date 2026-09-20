import Link from "next/link";
import { notFound } from "next/navigation";
import { gbp, loadClientWorkspace, type Task } from "@/lib/ops/clientsData";
import s from "../../shell.module.css";

export const dynamic = "force-dynamic";

/** Workspace tabs — each one is a real route under /admin/clients/[id]. */
const TABS: { label: string; path: string }[] = [
  { label: "Overview", path: "" },
  { label: "Hub", path: "hub" },
  { label: "Agreements", path: "agreement" },
  { label: "Billing", path: "billing" },
  { label: "Care plan", path: "care-plan" },
  { label: "Pricing", path: "pricing" },
  { label: "Documents", path: "docs" },
  { label: "Issues", path: "issues" },
  { label: "Account", path: "account" },
];

const tone = (state: string): string => {
  if (["accepted", "current", "live", "healthy", "active", "complete"].includes(state))
    return s.chipSuccess;
  if (["exception", "overdue", "incident", "blocked"].includes(state))
    return s.chipDanger;
  if (
    [
      "awaiting acceptance",
      "setup pending",
      "attention",
      "review",
      "awaiting client",
      "in progress",
    ].includes(state)
  )
    return s.chipWarning;
  if (["unresolved", "unknown", "prospect"].includes(state)) return s.chipInfo;
  return "";
};

export default async function ClientWorkspace({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const c = await loadClientWorkspace(id);
  if (!c) notFound();

  const paid = c.build.milestones.reduce((n, m) => n + m.paidGbp, 0);
  const tasks: Task[] = c.handover ? c.handover.tasks : c.checklist;

  return (
    <>
      <p className={s.mono}>
        <Link href="/admin/clients">Clients</Link> / {c.ref}
      </p>
      <div className={s.pageHead}>
        <div>
          <h1 className={s.h1}>{c.legalName}</h1>
          <p className={s.lead}>
            {c.tradingName ? `Trading as ${c.tradingName} · ` : ""}
            {c.ref} · Account owner {c.owner} ·{" "}
            <span className={c.model === "legacy" ? s.chipWarning : ""}>
              {c.model === "legacy" ? "Legacy agreement — read-only" : "New model"}
            </span>
          </p>
        </div>
        <div className={s.chips}>
          <Link href={`/admin/clients/${id}/issues`} className={s.btn}>
            Add work
          </Link>
          <Link href={`/admin/clients/${id}/account`} className={s.btn}>
            Contact
          </Link>
          <Link href={`/admin/clients/${id}/preview`} className={s.btn}>
            Preview client view
          </Link>
        </div>
      </div>

      <div className={s.strip}>
        <span className={s.mono}>Next action</span>
        <strong>{c.nextAction.text}</strong>
        <span className={s.muted}>
          {c.nextAction.owner} · due {c.nextAction.due}
        </span>
        <span className={`${s.muted}`} style={{ marginLeft: "auto" }}>
          {c.nextAction.consequence}
        </span>
      </div>

      <div className={s.facets}>
        <Facet
          label="Relationship"
          value={c.facets.relationship}
          note="tenants.status, else prospect until an accepted agreement or a live project"
        />
        <Facet
          label="Agreement"
          value={c.facets.agreement.state}
          note={c.facets.agreement.evidence}
        />
        <Facet
          label="Billing"
          value={c.facets.billing.state}
          note={c.facets.billing.evidence}
        />
        <Facet
          label="Delivery"
          value={c.facets.delivery.state}
          note={c.facets.delivery.evidence}
        />
        <Facet
          label="Service route"
          value={c.facets.route.state}
          note={c.facets.route.evidence}
        />
        <Facet
          label="Service health"
          value={c.facets.health.state}
          note={`${c.facets.health.evidence} · ${c.facets.health.freshness}`}
        />
      </div>

      <nav className={s.tabs} aria-label="Client workspace">
        {TABS.map((t) => {
          const href = t.path ? `/admin/clients/${id}/${t.path}` : `/admin/clients/${id}`;
          const current = t.path === "";
          return (
            <Link
              key={t.label}
              href={href}
              className={`${s.tab} ${current ? s.tabActive : ""}`}
              aria-current={current ? "page" : undefined}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      {c.flags?.length ? (
        <div className={s.chips} style={{ marginBottom: 24 }}>
          {c.flags.map((f) => (
            <span key={f} className={`${s.chip} ${s.chipWarning}`}>
              {f}
            </span>
          ))}
        </div>
      ) : null}

      <div className={s.grid12}>
        <section className={`${s.card} ${s.span8}`} aria-labelledby="checklist">
          <div className={s.cardTitle}>
            <h2 className={s.h2} id="checklist" style={{ margin: 0 }}>
              {c.handover
                ? `Independent handover checklist · ${gbp(c.handover.feeGbp)} once`
                : "Stage checklist"}
            </h2>
            <span className={s.mono}>owner · state · evidence (source)</span>
          </div>
          {tasks.length === 0 ? (
            <p className={s.muted}>Nothing outstanding for this stage.</p>
          ) : (
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Owner</th>
                  <th>State</th>
                  <th>Evidence / due</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t.label}>
                    <td>
                      {t.label}
                      <div className={s.mono}>{t.source}</div>
                    </td>
                    <td>{t.owner}</td>
                    <td>
                      <span className={`${s.chip} ${tone(t.state)}`}>{t.state}</span>
                    </td>
                    <td className={s.muted}>{t.evidence ?? t.due ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <div className={`${s.span4} ${s.stack}`}>
          <section className={s.card} aria-labelledby="commercial">
            <h2 className={s.h2} id="commercial">
              Commercial summary
            </h2>
            <dl className={s.kv}>
              <dt>Build price (accepted)</dt>
              <dd>{c.build.priceGbp ? gbp(c.build.priceGbp) : "Not quoted"}</dd>
              <dt>Paid to date</dt>
              <dd>{gbp(paid)}</dd>
              <dt>Run</dt>
              <dd style={{ textTransform: "capitalize" }}>{c.run.state}</dd>
              {c.run.packageName ? (
                <>
                  <dt>Package</dt>
                  <dd>{c.run.packageName}</dd>
                </>
              ) : null}
              {typeof c.run.monthlyGbp === "number" ? (
                <>
                  <dt>Accepted monthly</dt>
                  <dd>{gbp(c.run.monthlyGbp)}</dd>
                </>
              ) : null}
              {c.run.contractualStart ? (
                <>
                  <dt>Contractual start</dt>
                  <dd>{c.run.contractualStart}</dd>
                </>
              ) : null}
              {c.run.provider ? (
                <>
                  <dt>Provider</dt>
                  <dd>{c.run.provider}</dd>
                </>
              ) : null}
              {c.run.mandate ? (
                <>
                  <dt>Mandate</dt>
                  <dd>{c.run.mandate}</dd>
                </>
              ) : null}
              {c.run.termsVersion ? (
                <>
                  <dt>Terms version</dt>
                  <dd>{c.run.termsVersion}</dd>
                </>
              ) : null}
              {c.run.providerCollectionDate ? (
                <>
                  <dt>Provider collection</dt>
                  <dd>{c.run.providerCollectionDate}</dd>
                </>
              ) : null}
            </dl>
            {c.run.note ? (
              <p className={s.muted} style={{ marginTop: 12, fontSize: 13 }}>
                {c.run.note}
              </p>
            ) : null}
          </section>

          <section className={s.card} aria-labelledby="milestones">
            <h2 className={s.h2} id="milestones">
              Build milestones
            </h2>
            {c.build.milestones.length === 0 ? (
              <p className={s.muted}>No build or one-off invoice yet.</p>
            ) : (
              <table className={s.table}>
                <tbody>
                  {c.build.milestones.map((m) => (
                    <tr key={m.label}>
                      <td>
                        {m.label}
                        <div className={s.mono}>{m.due}</div>
                      </td>
                      <td className={s.num}>
                        {gbp(m.amountGbp)}
                        {m.state === "part paid" ? (
                          <div className={s.mono}>paid {gbp(m.paidGbp)}</div>
                        ) : null}
                      </td>
                      <td>
                        <span
                          className={`${s.chip} ${m.state === "paid" ? s.chipSuccess : m.state === "overdue" ? s.chipDanger : m.state === "part paid" ? s.chipWarning : ""}`}
                        >
                          {m.state}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className={s.card} aria-labelledby="people">
            <h2 className={s.h2} id="people">
              Contacts and owners
            </h2>
            <dl className={s.kv}>
              <dt>Account owner</dt>
              <dd>{c.owner}</dd>
              {c.contacts.map((p, i) => (
                <span key={`${p.email}-${i}`} style={{ display: "contents" }}>
                  <dt>{p.role}</dt>
                  <dd>{p.name}</dd>
                </span>
              ))}
            </dl>
          </section>
        </div>

        <section className={`${s.card} ${s.span6}`} aria-labelledby="systems">
          <h2 className={s.h2} id="systems">
            Systems and service arrangements
          </h2>
          {c.systems.length === 0 ? (
            <p className={s.muted}>No system yet.</p>
          ) : (
            <ul className={s.list}>
              {c.systems.map((sys) => (
                <li key={sys.name} className={s.listItem}>
                  <span>{sys.name}</span>
                  <span className={s.muted}>{sys.arrangement}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={`${s.card} ${s.span6}`} aria-labelledby="history">
          <h2 className={s.h2} id="history">
            History
          </h2>
          {c.history.length === 0 ? (
            <p className={s.muted}>No audit rows for this client.</p>
          ) : (
            <ul className={s.list}>
              {c.history.map((h, i) => (
                <li key={`${h.at}-${h.text}-${i}`} className={s.listItem}>
                  <span>{h.text}</span>
                  <span className={s.mono}>{h.at}</span>
                </li>
              ))}
            </ul>
          )}
          <p className={`${s.faint} ${s.mono}`} style={{ marginTop: 8 }}>
            audit_log · last 12
          </p>
        </section>
      </div>
    </>
  );
}

function Facet({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className={s.facet}>
      <span className={s.mono}>{label}</span>
      <div className={s.facetValue}>
        <span className={`${s.chip} ${tone(value)}`}>{value}</span>
      </div>
      <div className={s.facetNote}>{note}</div>
    </div>
  );
}
