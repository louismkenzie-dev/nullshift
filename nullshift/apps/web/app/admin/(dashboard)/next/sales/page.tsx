import Link from "next/link";
import { flagOn } from "@/lib/flags";
import {
  CATALOGUE,
  CATALOGUE_VERSION,
  DISCOVERY,
  HANDOVER_FEE_DECISION,
  OPPORTUNITIES,
  PIPELINE_STAGES,
  QUOTE_ROWS,
  QUOTE_STATES,
  editableInPlace,
  formatMoney,
  weightedPipeline,
  type Opportunity,
  type PipelineStage,
} from "@/lib/next/fixtures-ops";
import s from "../next.module.css";
import o from "../ops.module.css";
import { Empty, Notice, SubTabs, first, stateTone } from "./ops-ui";

const TABS = [
  {
    id: "pipeline",
    label: "Pipeline",
    count: OPPORTUNITIES.filter((x) => !x.closed).length,
  },
  { id: "quotes", label: "Quotes", count: QUOTE_ROWS.length },
  { id: "discovery", label: "Discovery", count: DISCOVERY.length },
  { id: "catalogue", label: "Pricing catalogue", count: CATALOGUE.length },
];

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const tab = first(sp.tab) ?? "pipeline";
  const view = first(sp.view) === "board" ? "board" : "list";
  const commercialV2 = flagOn("commercialV2");

  return (
    <>
      <div className={s.pageHead}>
        <div>
          <p className={s.mono}>
            Sales &amp; Quotes · source:{" "}
            {commercialV2
              ? "flag commercialV2 on — database read not wired in this slice; fixtures shown"
              : "fixtures (commercialV2 off)"}
          </p>
          <h1 className={s.h1}>Sales &amp; Quotes</h1>
          <p className={s.lead}>
            Pipeline stages are proposed names, separate from delivery and billing.
            Proposal value is never counted as contracted revenue.
          </p>
        </div>
        <Link href="/admin/next/quotes/q-atlas-v1" className={s.btnPrimary}>
          Open a draft quote
        </Link>
      </div>

      <SubTabs base="/admin/next/sales" current={tab} tabs={TABS} />

      {tab === "pipeline" ? <Pipeline view={view} /> : null}
      {tab === "quotes" ? <Quotes /> : null}
      {tab === "discovery" ? <Discovery /> : null}
      {tab === "catalogue" ? <Catalogue /> : null}
    </>
  );
}

/* ── Pipeline ─────────────────────────────────────────── */

function Pipeline({ view }: { view: "list" | "board" }) {
  const weighted = weightedPipeline(OPPORTUNITIES);
  const open = OPPORTUNITIES.filter((x) => !x.closed);

  return (
    <>
      <div className={s.grid12} style={{ marginBottom: 24 }}>
        <div className={`${s.card} ${s.span4}`}>
          <span className={s.mono}>Open opportunities</span>
          <div className={s.metricValue}>{open.length}</div>
          <div className={s.metricNote}>
            {open.filter((x) => x.owner === "Unassigned").length} unassigned · shown
            visibly, never hidden
          </div>
        </div>
        <div className={`${s.card} ${s.span4}`}>
          <span className={s.mono}>Weighted pipeline</span>
          <div className={s.metricValue}>
            {weighted.configured ? formatMoney(weighted.total) : "Not configured"}
          </div>
          <div className={s.metricNote}>
            {weighted.configured ? "Explicit probabilities configured" : weighted.reason}
          </div>
        </div>
        <div className={`${s.card} ${s.span4}`}>
          <span className={s.mono}>Proposal value on open quotes</span>
          <div className={s.metricValue}>
            {weighted.configured ? "—" : formatMoney(weighted.unweightedOpen)}
          </div>
          <div className={s.metricNote}>
            Sum of issued or in-review proposal values · not contracted revenue
          </div>
        </div>
      </div>

      <div className={s.cardTitle}>
        <h2 className={s.h2} style={{ margin: 0 }}>
          {view === "board" ? "Board" : "List"}
        </h2>
        <div className={o.toggle} role="group" aria-label="View">
          <Link
            href="/admin/next/sales?tab=pipeline&view=list"
            className={`${o.toggleLink} ${view === "list" ? o.toggleLinkActive : ""}`}
            aria-current={view === "list" ? "page" : undefined}
          >
            List
          </Link>
          <Link
            href="/admin/next/sales?tab=pipeline&view=board"
            className={`${o.toggleLink} ${view === "board" ? o.toggleLinkActive : ""}`}
            aria-current={view === "board" ? "page" : undefined}
          >
            Board
          </Link>
        </div>
      </div>

      {view === "board" ? <Board /> : <ListView />}
    </>
  );
}

function OppCells({ x }: { x: Opportunity }) {
  return (
    <>
      <td>
        <Link href={`/admin/next/sales/opportunities/${x.id}`} className={s.rowLink}>
          {x.company}
        </Link>
        <div className={s.mono}>{x.clientId ? "existing client" : "prospect"}</div>
      </td>
      <td>{x.opportunity}</td>
      <td>
        <span className={`${s.chip} ${stateTone(x.stage)}`}>{x.stage}</span>
      </td>
      <td className={x.owner === "Unassigned" ? s.faint : ""}>{x.owner}</td>
      <td>
        {x.nextAction.text}
        <div className={s.mono}>due {x.nextAction.due}</div>
      </td>
      <td>
        <span
          className={`${s.chip} ${x.confidence === "low" ? s.chipWarning : x.confidence === "high" ? s.chipSuccess : ""}`}
        >
          {x.confidence}
        </span>
      </td>
      <td className={s.num}>{x.proposalValue ? formatMoney(x.proposalValue) : "—"}</td>
    </>
  );
}

function ListView() {
  if (OPPORTUNITIES.length === 0)
    return (
      <Empty
        title="No opportunities"
        body="New enquiries appear here with an owner or a visible Unassigned marker."
      />
    );
  return (
    <div className={s.card} style={{ padding: 0 }}>
      <table className={s.table}>
        <thead>
          <tr>
            <th>Company</th>
            <th>Opportunity</th>
            <th>Stage</th>
            <th>Owner</th>
            <th>Next action</th>
            <th>Confidence</th>
            <th className={s.num}>Proposal value</th>
          </tr>
        </thead>
        <tbody>
          {OPPORTUNITIES.map((x) => (
            <tr key={x.id}>
              <OppCells x={x} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Board() {
  const byStage = (stage: PipelineStage) =>
    OPPORTUNITIES.filter((x) => x.stage === stage);
  return (
    <div className={o.board} aria-label="Pipeline board">
      {PIPELINE_STAGES.map((stage) => {
        const items = byStage(stage);
        return (
          <section key={stage} className={o.column} aria-label={stage}>
            <div className={o.columnHead}>
              <span className={s.mono}>{stage}</span>
              <span className={s.faint}>{items.length}</span>
            </div>
            <div className={o.columnBody}>
              {items.length === 0 ? (
                <div className={o.columnEmpty}>Nothing at this stage</div>
              ) : (
                items.map((x) => (
                  <Link
                    key={x.id}
                    href={`/admin/next/sales/opportunities/${x.id}`}
                    className={o.oppCard}
                  >
                    <div className={o.oppCompany}>{x.company}</div>
                    <div>{x.opportunity}</div>
                    <div className={o.oppMeta}>
                      {x.owner === "Unassigned" ? (
                        <span className={s.faint}>Unassigned</span>
                      ) : (
                        x.owner
                      )}{" "}
                      · due {x.nextAction.due}
                    </div>
                    <div className={o.oppMeta}>{x.nextAction.text}</div>
                    <div className={o.oppMeta}>
                      confidence {x.confidence} ·{" "}
                      {x.proposalValue ? formatMoney(x.proposalValue) : "no value"}
                    </div>
                  </Link>
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/* ── Quotes ───────────────────────────────────────────── */

function Quotes() {
  return (
    <>
      <div className={s.chips} style={{ marginBottom: 16 }} aria-label="Quote states">
        {QUOTE_STATES.map((st) => (
          <span key={st} className={`${s.chip} ${stateTone(st)}`}>
            {st} · {QUOTE_ROWS.filter((q) => q.state === st).length}
          </span>
        ))}
      </div>
      <Notice>
        Draft → Internal review → Approved to issue → Issued → Accepted / Declined /
        Expired / Superseded / Withdrawn. Changes after issue create a new version; a
        client-visible offer is never silently mutated.
      </Notice>
      <div className={s.card} style={{ padding: 0, marginTop: 16 }}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>Quote</th>
              <th>Client</th>
              <th>Version</th>
              <th>State</th>
              <th className={s.num}>Value</th>
              <th>Saved / issued</th>
              <th>Editable</th>
            </tr>
          </thead>
          <tbody>
            {QUOTE_ROWS.map((q) => (
              <tr key={q.id}>
                <td>
                  {q.studioHref ? (
                    <Link href={q.studioHref} className={s.rowLink}>
                      {q.project}
                    </Link>
                  ) : (
                    <span title="Quote Studio fixture not in this slice">
                      {q.project}
                    </span>
                  )}
                  <div className={s.mono}>{q.id}</div>
                  {q.note ? <div className={s.queueMeta}>{q.note}</div> : null}
                </td>
                <td>
                  <Link href={`/admin/next/clients/${q.clientId}`} className={s.rowLink}>
                    {q.client}
                  </Link>
                </td>
                <td>
                  {q.version}
                  {q.supersededBy ? (
                    <div className={s.mono}>→ {q.supersededBy}</div>
                  ) : null}
                </td>
                <td>
                  <span className={`${s.chip} ${stateTone(q.state)}`}>{q.state}</span>
                </td>
                <td className={s.num}>{q.value ? formatMoney(q.value) : "—"}</td>
                <td className={s.muted}>{q.savedAt}</td>
                <td className={s.muted}>
                  {editableInPlace(q.state) ? "In place" : "New version only"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ── Discovery ────────────────────────────────────────── */

function Discovery() {
  if (DISCOVERY.length === 0)
    return (
      <Empty
        title="No discovery engagements"
        body="Low-confidence estimates create a discovery engagement before pricing."
      />
    );
  return (
    <div className={s.grid12}>
      {DISCOVERY.map((d) => {
        const done = d.checklist.filter((c) => c.done).length;
        return (
          <section key={d.id} className={`${s.card} ${s.span6}`} aria-labelledby={d.id}>
            <div className={s.cardTitle}>
              <h2 className={s.h2} id={d.id} style={{ margin: 0 }}>
                <Link
                  href={`/admin/next/sales/opportunities/${d.opportunityId}`}
                  className={s.rowLink}
                >
                  {d.company}
                </Link>
              </h2>
              <span className={`${s.chip} ${stateTone(d.state)}`}>{d.state}</span>
            </div>
            <dl className={s.kv}>
              <dt>Kind</dt>
              <dd>{d.kind}</dd>
              <dt>Price</dt>
              <dd>{d.price.text}</dd>
              <dt>Basis</dt>
              <dd>{d.price.basis}</dd>
              <dt>Owner</dt>
              <dd className={d.owner === "Unassigned" ? s.faint : ""}>{d.owner}</dd>
              <dt>Due</dt>
              <dd>{d.due}</dd>
            </dl>
            <p className={s.mono} style={{ marginTop: 12 }}>
              Checklist · {done} of {d.checklist.length}
            </p>
            <ul className={s.list}>
              {d.checklist.map((c) => (
                <li key={c.label} className={s.listItem}>
                  <span>{c.label}</span>
                  <span className={`${s.chip} ${c.done ? s.chipSuccess : ""}`}>
                    {c.done ? "done" : "open"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/* ── Pricing catalogue (§6.5) ─────────────────────────── */

function Catalogue() {
  const families = [...new Set(CATALOGUE.map((c) => c.family))];
  return (
    <>
      <div className={o.marker} style={{ marginBottom: 16 }}>
        Draft / Sandbox · {CATALOGUE_VERSION.marker}
      </div>

      <div className={s.grid12}>
        <section
          className={`${s.card} ${s.span8}`}
          style={{ padding: 0 }}
          aria-labelledby="catalogue"
        >
          <div style={{ padding: "16px 20px 0" }}>
            <div className={s.cardTitle}>
              <h2 className={s.h2} id="catalogue" style={{ margin: 0 }}>
                Candidate catalogue for review
              </h2>
              <span className={s.mono}>
                {CATALOGUE_VERSION.id} · {CATALOGUE_VERSION.status} · effective:{" "}
                {CATALOGUE_VERSION.effectiveFrom}
              </span>
            </div>
          </div>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Item</th>
                <th>Family</th>
                <th>Earlier suggested starting point</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {families.map((fam) =>
                CATALOGUE.filter((c) => c.family === fam).map((c) => (
                  <tr key={c.id}>
                    <td>
                      {c.item}
                      <span className={o.stamp}>sandbox</span>
                      {c.note ? <div className={s.queueMeta}>{c.note}</div> : null}
                    </td>
                    <td className={s.muted}>{c.family}</td>
                    <td>{c.suggested}</td>
                    <td>
                      <span className={`${s.chip} ${s.chipWarning}`}>
                        draft · not chargeable
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <div className={`${s.span4} ${s.stack}`}>
          <section className={s.card} aria-labelledby="handover-fee">
            <div className={s.cardTitle}>
              <h2 className={s.h2} id="handover-fee" style={{ margin: 0 }}>
                {HANDOVER_FEE_DECISION.label}
              </h2>
              <span className={`${s.chip} ${s.chipSuccess}`}>confirmed decision</span>
            </div>
            <div className={s.metricValue}>
              {formatMoney(HANDOVER_FEE_DECISION.amount)}
            </div>
            <div className={s.metricNote}>
              Once per independent handover · tax basis:{" "}
              <strong>{HANDOVER_FEE_DECISION.taxBasis}</strong>
            </div>
            <Notice tone="warning">
              Shown separately from the unapproved catalogue. Real issuance is blocked
              until:
              <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                {HANDOVER_FEE_DECISION.blockedOn.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </Notice>
          </section>
          <section className={s.card}>
            <h2 className={s.h2}>Rules applied</h2>
            <ul className={s.list}>
              <li className={s.listItem}>
                A new catalogue version changes new assessments only.
              </li>
              <li className={s.listItem}>
                Accepted agreements resolve from immutable snapshots.
              </li>
              <li className={s.listItem}>
                A catalogue price change never edits a subscription row.
              </li>
              <li className={s.listItem}>
                Publishing requires the Owner&apos;s pricing-change permission.
              </li>
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
