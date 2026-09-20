import Link from "next/link";
import {
  PIPELINE_STAGES,
  QUOTE_STATES,
  editableInPlace,
  formatMoney,
  loadSales,
  weightedPipeline,
  type DiscoveryEngagement,
  type Opportunity,
  type PipelineStage,
  type QuoteVersionListRow,
} from "@/lib/ops/salesData";
import s from "../shell.module.css";
import o from "../ops.module.css";
import { Empty, Notice, SubTabs, first, stateTone } from "./ops-ui";

export const dynamic = "force-dynamic";

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const tab = first(sp.tab) ?? "pipeline";
  const view = first(sp.view) === "board" ? "board" : "list";
  const sales = await loadSales();
  const OPPORTUNITIES = sales.opportunities;

  const TABS = [
    {
      id: "pipeline",
      label: "Pipeline",
      count: OPPORTUNITIES.filter((x) => !x.closed).length,
    },
    { id: "quotes", label: "Quotes", count: sales.quotes.length },
    { id: "discovery", label: "Discovery", count: sales.discovery.length },
  ];

  return (
    <>
      <div className={s.pageHead}>
        <div>
          <p className={s.mono}>Sales &amp; Quotes · {sales.freshness}</p>
          <h1 className={s.h1}>Sales &amp; Quotes</h1>
          <p className={s.lead}>
            Pipeline stages are separate from delivery and billing. Proposal value is
            never counted as contracted revenue. Funnel leads that have not been opened
            as an opportunity appear with their lead status mapped to a stage.
          </p>
        </div>
        <Link href="/admin/quotes" className={s.btnPrimary}>
          Quotes
        </Link>
      </div>

      <SubTabs base="/admin/sales" current={tab} tabs={TABS} />

      {tab === "pipeline" ? <Pipeline view={view} opportunities={OPPORTUNITIES} /> : null}
      {tab === "quotes" ? <Quotes rows={sales.quotes} /> : null}
      {tab === "discovery" ? <Discovery items={sales.discovery} /> : null}
    </>
  );
}

/* ── Pipeline ─────────────────────────────────────────── */

function Pipeline({
  view,
  opportunities: OPPORTUNITIES,
}: {
  view: "list" | "board";
  opportunities: Opportunity[];
}) {
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
            href="/admin/sales?tab=pipeline&view=list"
            className={`${o.toggleLink} ${view === "list" ? o.toggleLinkActive : ""}`}
            aria-current={view === "list" ? "page" : undefined}
          >
            List
          </Link>
          <Link
            href="/admin/sales?tab=pipeline&view=board"
            className={`${o.toggleLink} ${view === "board" ? o.toggleLinkActive : ""}`}
            aria-current={view === "board" ? "page" : undefined}
          >
            Board
          </Link>
        </div>
      </div>

      {view === "board" ? (
        <Board opportunities={OPPORTUNITIES} />
      ) : (
        <ListView opportunities={OPPORTUNITIES} />
      )}
    </>
  );
}

function OppCells({ x }: { x: Opportunity }) {
  return (
    <>
      <td>
        <Link href={`/admin/sales/opportunities/${x.id}`} className={s.rowLink}>
          {x.company}
        </Link>
        <div className={s.mono}>
          {x.clientId ? "existing client" : "prospect"}
          {x.source === "lead" ? " · funnel lead" : ""}
        </div>
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

function ListView({ opportunities: OPPORTUNITIES }: { opportunities: Opportunity[] }) {
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

function Board({ opportunities: OPPORTUNITIES }: { opportunities: Opportunity[] }) {
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
                    href={`/admin/sales/opportunities/${x.id}`}
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

function Quotes({ rows: QUOTE_ROWS }: { rows: QuoteVersionListRow[] }) {
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
              <th>Open</th>
            </tr>
          </thead>
          <tbody>
            {QUOTE_ROWS.length === 0 ? (
              <tr>
                <td colSpan={7} className={s.muted}>
                  No quote versions recorded yet.
                </td>
              </tr>
            ) : null}
            {QUOTE_ROWS.map((q) => (
              <tr key={q.id}>
                <td>
                  <Link href={q.studioHref} className={s.rowLink}>
                    {q.project}
                  </Link>
                  <div className={s.mono}>{q.id.slice(0, 8)}</div>
                  {q.note ? <div className={s.queueMeta}>{q.note}</div> : null}
                </td>
                <td>
                  {q.clientId ? (
                    <Link href={`/admin/clients/${q.clientId}`} className={s.rowLink}>
                      {q.client}
                    </Link>
                  ) : (
                    <Link
                      href={`/admin/sales/opportunities/${q.opportunityId}`}
                      className={s.rowLink}
                    >
                      {q.client}
                    </Link>
                  )}
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
                <td>
                  <Link
                    href={q.studioHref}
                    className={`${s.btn} ${s.btnSmall}`}
                    title={editableInPlace(q.state) ? "Edit this draft in the Studio" : "Open; changes create a new version"}
                  >
                    {editableInPlace(q.state) ? "Edit draft" : "Open"}
                  </Link>
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

function Discovery({ items: DISCOVERY }: { items: DiscoveryEngagement[] }) {
  if (DISCOVERY.length === 0)
    return (
      <Empty
        title="No discovery engagements"
        body="Opportunities at the Discovery stage appear here. There is no discovery-engagement table yet, so the checklist is derived from the opportunity record."
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
                  href={`/admin/sales/opportunities/${d.opportunityId}`}
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
