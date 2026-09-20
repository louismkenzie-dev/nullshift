import Link from "next/link";
import { notFound } from "next/navigation";
import {
  buildStartGate,
  projectById,
  type CommercialGate,
} from "@/lib/next/fixtures-ops";
import s from "../../../shell.module.css";
import o from "../../../ops.module.css";
import { Notice, stateTone } from "../../../sales/ops-ui";
import { SampleDataNote } from "../../../SampleDataNote";

const gateMark = (g: CommercialGate["state"]): { cls: string; text: string } => {
  if (g === "pass") return { cls: o.gatePass, text: "✓" };
  if (g === "fail") return { cls: o.gateFail, text: "×" };
  if (g === "waived") return { cls: o.gateWaived, text: "W" };
  return { cls: o.gateNa, text: "–" };
};

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = projectById(id);
  if (!p) notFound();

  const gate = buildStartGate(p.buildStart);
  const criteria = p.deliverables.flatMap((d) => d.acceptance);
  const evidenced = criteria.filter(
    (c) => c.state === "evidenced" || c.state === "accepted"
  ).length;

  return (
    <>
      <SampleDataNote />
      <p className={s.mono}>
        <Link href="/admin/delivery?tab=projects">Delivery</Link> / Projects /{" "}
        {p.client}
      </p>
      <div className={s.pageHead}>
        <div>
          <h1 className={s.h1}>{p.name}</h1>
          <p className={s.lead}>
            <Link href={`/admin/clients/${p.clientId}`} className={s.rowLink}>
              {p.client}
            </Link>{" "}
            · agreed scope{" "}
            <Link href={p.scopeVersion.href} className={s.rowLink}>
              {p.scopeVersion.label}
            </Link>{" "}
            · {p.scopeVersion.acceptedAt}
          </p>
        </div>
        <div className={s.chips}>
          {p.owners.map((w) => (
            <span key={w.role} className={s.chip}>
              {w.role}: {w.name}
            </span>
          ))}
        </div>
      </div>

      <div className={s.grid12}>
        <div className={`${s.span8} ${s.stack}`}>
          <section className={s.card} aria-labelledby="milestones">
            <div className={s.cardTitle}>
              <h2 className={s.h2} id="milestones" style={{ margin: 0 }}>
                Milestones
              </h2>
              <span className={s.mono}>commercial link per milestone</span>
            </div>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Milestone</th>
                  <th>Due</th>
                  <th>State</th>
                  <th>Commercial</th>
                </tr>
              </thead>
              <tbody>
                {p.milestones.map((m) => (
                  <tr key={m.label}>
                    <td>{m.label}</td>
                    <td className={s.muted}>{m.due}</td>
                    <td>
                      <span className={`${s.chip} ${stateTone(m.state)}`}>{m.state}</span>
                    </td>
                    <td className={s.muted}>{m.commercial}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className={s.card} aria-labelledby="deliverables">
            <div className={s.cardTitle}>
              <h2 className={s.h2} id="deliverables" style={{ margin: 0 }}>
                Deliverables and acceptance evidence
              </h2>
              <span className={s.mono}>
                {evidenced} of {criteria.length} criteria evidenced
              </span>
            </div>
            {p.deliverables.length === 0 ? (
              <p className={s.muted}>
                No deliverables recorded against this scope version.
              </p>
            ) : (
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>Deliverable</th>
                    <th>Scope reference</th>
                    <th>Acceptance criterion</th>
                    <th>Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {p.deliverables.map((d) =>
                    d.acceptance.map((a, i) => (
                      <tr key={`${d.id}-${i}`}>
                        {i === 0 ? (
                          <td rowSpan={d.acceptance.length}>
                            <span style={{ fontWeight: 600 }}>{d.label}</span>
                            <div className={s.mono}>owner {d.owner}</div>
                          </td>
                        ) : null}
                        {i === 0 ? (
                          <td rowSpan={d.acceptance.length} className={s.muted}>
                            {d.scopeRef}
                          </td>
                        ) : null}
                        <td>{a.criterion}</td>
                        <td>
                          <span className={`${s.chip} ${stateTone(a.state)}`}>
                            {a.state}
                          </span>
                          {a.evidence ? (
                            <div className={s.queueMeta}>{a.evidence}</div>
                          ) : null}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
            <p className={s.queueMeta} style={{ marginTop: 12 }}>
              Partial, disputed and staged acceptance are recorded explicitly. Acceptance
              is never inferred from a page view or an unapproved silence rule.
            </p>
          </section>

          <section className={s.card} aria-labelledby="dependencies">
            <h2 className={s.h2} id="dependencies">
              Dependencies
            </h2>
            {p.dependencies.length === 0 ? (
              <p className={s.muted}>No dependencies recorded.</p>
            ) : (
              <ul className={s.list}>
                {p.dependencies.map((d) => (
                  <li key={d.label} className={s.listItem}>
                    <span>
                      {d.label}
                      <span className={s.mono}>
                        {" "}
                        · {d.owner}
                        {d.due ? ` · due ${d.due}` : ""}
                      </span>
                    </span>
                    <span className={`${s.chip} ${stateTone(d.state)}`}>{d.state}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className={`${s.span4} ${s.stack}`}>
          <section className={s.card} aria-labelledby="gates">
            <div className={s.cardTitle}>
              <h2 className={s.h2} id="gates" style={{ margin: 0 }}>
                Commercial gates
              </h2>
              <span
                className={`${s.chip} ${gate.satisfied ? (gate.waived ? s.chipWarning : s.chipSuccess) : s.chipDanger}`}
              >
                build start {gate.satisfied ? "satisfied" : "blocked"}
              </span>
            </div>
            <ul className={o.gates}>
              {p.gates.map((g) => {
                const m = gateMark(g.state);
                return (
                  <li key={g.id} className={o.gate}>
                    <span className={`${o.gateMark} ${m.cls}`} aria-label={g.state}>
                      {m.text}
                    </span>
                    <span>
                      <span style={{ fontWeight: 600 }}>{g.label}</span>
                      <div className={s.queueMeta}>{g.evidence}</div>
                      {g.waiver ? (
                        <div className={o.waiver}>
                          Waiver by {g.waiver.by} on {g.waiver.at}: {g.waiver.reason} ·
                          audit {g.waiver.auditRef}. Waiving the deposit gate does not
                          mark the invoice paid.
                        </div>
                      ) : null}
                    </span>
                    <span className={s.mono}>{g.state}</span>
                  </li>
                );
              })}
            </ul>
            {!gate.satisfied ? (
              <Notice tone="danger">
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {gate.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </Notice>
            ) : null}
            <p className={s.queueMeta} style={{ marginTop: 12 }}>
              Deposit invoice state as recorded:{" "}
              <strong>{gate.depositInvoiceState}</strong>
              {gate.waived ? " (unchanged by the waiver)" : ""}.
            </p>
          </section>

          <section className={s.card} aria-labelledby="blockers">
            <h2 className={s.h2} id="blockers">
              Blockers
            </h2>
            {p.blockers.length === 0 ? (
              <p className={s.muted}>No blockers.</p>
            ) : (
              <ul className={s.list}>
                {p.blockers.map((b) => (
                  <li
                    key={b.label}
                    className={s.listItem}
                    style={{ flexDirection: "column", gap: 2 }}
                  >
                    <span style={{ fontWeight: 600 }}>{b.label}</span>
                    <span className={s.queueMeta}>
                      owner {b.owner} · since {b.since}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
