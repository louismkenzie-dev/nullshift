import Link from "next/link";
import { notFound } from "next/navigation";
import { formatMoney, loadOpportunity } from "@/lib/ops/salesData";
import s from "../../../shell.module.css";
import o from "../../../ops.module.css";
import { Notice, stateTone } from "../../ops-ui";

export const dynamic = "force-dynamic";

export default async function OpportunityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const loaded = await loadOpportunity(id);
  if (!loaded) notFound();
  const x = loaded.opportunity;

  const d = x.detail;
  const linkedQuotes = d.linkedQuoteIds.map(
    (qid) => loaded.quotes.find((q) => q.id === qid) ?? { id: qid, missing: true as const }
  );
  const hasReuse = x.duplicateMatches.some(
    (m) => m.recommendation === "reuse existing record"
  );
  const needsReview = x.duplicateMatches.some(
    (m) => m.recommendation === "review before converting"
  );

  return (
    <>
      <p className={s.mono}>
        <Link href="/admin/sales?tab=pipeline">Sales &amp; Quotes</Link> / Pipeline /{" "}
        {x.company}
      </p>
      <div className={s.pageHead}>
        <div>
          <h1 className={s.h1}>{x.opportunity}</h1>
          <p className={s.lead}>
            {x.clientId ? (
              <Link href={`/admin/clients/${x.clientId}`} className={s.rowLink}>
                {x.company}
              </Link>
            ) : (
              x.company
            )}{" "}
            · <span className={`${s.chip} ${stateTone(x.stage)}`}>{x.stage}</span> · owner{" "}
            <span className={x.owner === "Unassigned" ? s.faint : ""}>{x.owner}</span> ·
            confidence {x.confidence}
            {x.proposalValue
              ? ` · proposal ${formatMoney(x.proposalValue)} (not contracted)`
              : ""}
            {x.source === "lead" ? " · funnel lead (not yet an opportunity row)" : ""}
          </p>
        </div>
        <Link href="/admin/sales?tab=pipeline&view=board" className={s.btn}>
          Back to board
        </Link>
      </div>

      <div className={o.drawer}>
        <div className={s.card}>
          <div className={o.section}>
            <p className={o.sectionTitle}>Problem and outcome</p>
            <p style={{ margin: "0 0 6px" }}>{d.problem}</p>
            <p className={s.muted} style={{ margin: 0 }}>
              Outcome: {d.outcome}
            </p>
          </div>

          <div className={o.section}>
            <p className={o.sectionTitle}>Stakeholders</p>
            <ul className={s.list}>
              {d.stakeholders.map((st) => (
                <li key={st.name} className={s.listItem}>
                  <span>{st.name}</span>
                  <span className={s.muted}>{st.role}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className={o.section}>
            <p className={o.sectionTitle}>Current process, timeline and budget</p>
            <dl className={s.kv}>
              <dt>Current process</dt>
              <dd>{d.currentProcess}</dd>
              <dt>Timeline</dt>
              <dd>{d.timeline}</dd>
              <dt>Budget signal</dt>
              <dd>{d.budgetSignal}</dd>
            </dl>
          </div>

          <div className={o.section}>
            <p className={o.sectionTitle}>Systems, integrations and data sensitivity</p>
            <div className={s.chips}>
              {d.systems.map((sys) => (
                <span key={sys} className={s.chip}>
                  {sys}
                </span>
              ))}
              <span
                className={`${s.chip} ${d.dataSensitivity === "special category" || d.dataSensitivity === "payment data" ? s.chipWarning : ""}`}
              >
                data: {d.dataSensitivity}
              </span>
            </div>
            {d.dataSensitivity === "special category" ? (
              <p className={s.queueMeta} style={{ marginTop: 8 }}>
                Extra contract review before any quote issues (legal review gate).
              </p>
            ) : null}
          </div>

          <div className={o.section}>
            <p className={o.sectionTitle}>Discovery notes</p>
            {d.discoveryNotes.length === 0 ? (
              <p className={s.faint} style={{ margin: 0 }}>
                No discovery notes yet.
              </p>
            ) : (
              <ul className={s.list}>
                {d.discoveryNotes.map((n) => (
                  <li key={n} className={s.listItem}>
                    {n}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={o.section}>
            <p className={o.sectionTitle}>Linked quote versions</p>
            {linkedQuotes.length === 0 ? (
              <p className={s.faint} style={{ margin: 0 }}>
                No quote versions yet.
              </p>
            ) : (
              <ul className={s.list}>
                {linkedQuotes.map((q) =>
                  "missing" in q ? (
                    <li key={q.id} className={s.listItem}>
                      <span className={s.mono}>{q.id.slice(0, 8)}</span>
                      <span className={s.faint}>version not readable</span>
                    </li>
                  ) : (
                    <li key={q.id} className={s.listItem}>
                      <span>
                        <Link href={q.studioHref} className={s.rowLink}>
                          {q.version} · {q.project}
                        </Link>
                        <span className={s.mono}> {q.id.slice(0, 8)}</span>
                      </span>
                      <span className={`${s.chip} ${stateTone(q.state)}`}>{q.state}</span>
                    </li>
                  )
                )}
              </ul>
            )}
          </div>

          <div className={o.section}>
            <p className={o.sectionTitle}>Activity</p>
            <ul className={o.timeline}>
              {d.activity.map((a, i) => (
                <li key={`${a.at}-${a.text}-${i}`}>
                  <span className={s.mono}>{a.at}</span>
                  <span>{a.text}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className={o.section}>
            <p className={o.sectionTitle}>Decision rationale</p>
            <p style={{ margin: 0 }}>{d.decisionRationale}</p>
            {x.closed ? (
              <p className={s.queueMeta} style={{ marginTop: 6 }}>
                Closed {x.closed.outcome} on {x.closed.at} — {x.closed.reason}
              </p>
            ) : null}
          </div>
        </div>

        <aside className={o.aside} aria-label="Next action and conversion">
          <section className={s.card}>
            <p className={o.sectionTitle}>Next action</p>
            <p style={{ margin: "0 0 4px", fontWeight: 600 }}>{x.nextAction.text}</p>
            <p className={s.mono} style={{ margin: 0 }}>
              owner {x.owner} · due {x.nextAction.due}
            </p>
          </section>

          <section className={s.card} aria-labelledby="convert">
            <div className={s.cardTitle}>
              <h2 className={s.h2} id="convert" style={{ margin: 0 }}>
                Convert to client / project
              </h2>
              {x.closed?.outcome === "won" ? (
                <span className={`${s.chip} ${s.chipSuccess}`}>converted</span>
              ) : null}
            </div>
            <p className={s.queueMeta} style={{ marginTop: 0 }}>
              Reuses existing legal-entity and contact records, retains source history,
              and requires review of duplicate matches. Winning another project for an
              existing client never creates another billing identity by default.
            </p>

            <p className={o.sectionTitle} style={{ marginTop: 12 }}>
              Duplicate-match review
            </p>
            {x.duplicateMatches.length === 0 ? (
              <Notice>
                No matching legal entity, contact or domain found. Conversion would create
                a new client record — confirm before proceeding.
              </Notice>
            ) : (
              <ul className={s.list}>
                {x.duplicateMatches.map((m) => (
                  <li
                    key={m.entity}
                    className={s.listItem}
                    style={{ flexDirection: "column", gap: 4 }}
                  >
                    <span>
                      <strong>{m.entity}</strong> <span className={s.mono}>{m.kind}</span>
                    </span>
                    <span className={s.queueMeta}>{m.evidence}</span>
                    <span
                      className={`${s.chip} ${m.recommendation === "reuse existing record" ? s.chipSuccess : m.recommendation === "review before converting" ? s.chipWarning : ""}`}
                    >
                      {m.recommendation}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <div className={s.chips} style={{ marginTop: 12 }}>
              <button
                type="button"
                className={s.btnPrimary}
                disabled
                title={
                  x.closed
                    ? "Already closed"
                    : needsReview
                      ? "Blocked: a duplicate match needs review"
                      : hasReuse
                        ? "Would reuse the matched record — conversion write not wired yet"
                        : "Would create a new client record — conversion write not wired yet"
                }
              >
                {hasReuse ? "Convert (reuse existing)" : "Convert (new client)"}
              </button>
              <button type="button" className={s.btn} disabled title="Not in this slice">
                Mark as duplicate
              </button>
            </div>
            <p className={s.faint} style={{ margin: "8px 0 0", fontSize: 12 }}>
              Duplicate matches are computed against live client tenants (name, contact
              email, email domain). Conversion is not wired: nothing here writes.
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}
