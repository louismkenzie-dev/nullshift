import Link from "next/link";
import {
  EXCEPTION_KIND_LABEL,
  fmtDate,
  formatMoney,
  loadFinanceOverview,
} from "@/lib/ops/financeData";
import { Amount, ExceptionStateChip, SourceNote } from "./ui";
import s from "../shell.module.css";
import f from "./finance.module.css";

/**
 * Finance › Overview (brief §5.6). Six figures, each with currency, range,
 * definition, freshness and a drill-down, computed from the same rows the
 * detail tabs read so they cannot disagree.
 */
export default async function FinanceOverview() {
  const { metrics, openExceptions, asAt } = await loadFinanceOverview();

  return (
    <>
      <SourceNote asAt={asAt} />

      <div className={f.metrics}>
        {metrics.map((m) => (
          <section
            key={m.key}
            className={`${f.metric} ${m.tone === "danger" ? f.metricDanger : m.tone === "warning" ? f.metricWarning : ""}`}
            aria-labelledby={`metric-${m.key}`}
          >
            <div className={f.metricHead}>
              <span id={`metric-${m.key}`} className={s.mono}>
                {m.label}
              </span>
              <span className={s.faint} style={{ fontSize: 12 }}>
                {m.value ? m.value.currency : "n/a"}
                {typeof m.count === "number" ? ` · ${m.count}` : ""}
              </span>
            </div>
            {m.value ? (
              <div className={s.metricValue}>{formatMoney(m.value)}</div>
            ) : (
              <div className={s.metricValue} style={{ fontSize: 16 }}>
                Not recorded
              </div>
            )}
            <span className={f.metricRange}>{m.range}</span>
            <details className={f.metricDef}>
              <summary />
              <p style={{ margin: "6px 0 0" }}>{m.definition}</p>
            </details>
            {m.unavailable ? <div className={f.metricAside}>{m.unavailable}</div> : null}
            {m.aside ? <div className={f.metricAside}>{m.aside}</div> : null}
            <div className={f.metricFoot}>
              <span>{m.freshness}</span>
              <Link href={m.href} className={f.drill}>
                Drill down →
              </Link>
            </div>
          </section>
        ))}
      </div>

      <div className={f.boundary}>
        <strong>Boundary.</strong> Every figure above is Nullshift&apos;s own sales and
        receipts. Client payment volume processed through connected accounts is excluded
        from all totals; only the application fee Nullshift earns on it is shown, and only
        from the live-mode fee ledger.
      </div>

      <div className={s.grid12}>
        <section className={`${s.card} ${s.span8}`} aria-labelledby="open-exceptions">
          <div className={s.cardTitle}>
            <h2 id="open-exceptions" className={s.h2}>
              Open exceptions
            </h2>
            <Link href="/admin/finance/exceptions" className={f.drill}>
              All exceptions →
            </Link>
          </div>
          {openExceptions.length === 0 ? (
            <p className={s.muted}>No open exceptions.</p>
          ) : (
            <div className={s.queue}>
              {openExceptions.map((e) => (
                <div key={e.id} className={s.queueRow}>
                  <div>
                    <Link href={`/admin/finance/exceptions/${e.id}`} className={s.rowLink}>
                      {e.title}
                    </Link>
                    <span className={f.sub}>
                      {EXCEPTION_KIND_LABEL[e.kind]} · {e.tenantName} ·{" "}
                      {e.source === "derived" ? "derived from live rows" : "recorded"}
                    </span>
                  </div>
                  <span className={s.queueMeta}>{e.action.label}</span>
                  <span className={s.queueMeta}>
                    {e.owner} · opened {fmtDate(e.openedAt)}
                    {e.amount ? (
                      <>
                        {" · "}
                        <Amount value={e.amount} />
                      </>
                    ) : null}
                  </span>
                  <ExceptionStateChip state={e.state} />
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={`${s.card} ${s.span4}`} aria-labelledby="how-to-read">
          <h2 id="how-to-read" className={s.h2}>
            How to read these figures
          </h2>
          <ul className={f.evidence}>
            <li>
              Contracted value is a monthly run-rate from subscription rows; receivables
              and overdue are open invoice amounts as at the read time.
            </li>
            <li>
              Scheduled collections are GoCardless subscriptions that exist at the
              provider. Charge dates live at GoCardless and are not stored here, so a
              &quot;link sent, no mandate&quot; row is never counted as scheduled.
            </li>
            <li>
              Payouts and bank receipts are not synced: there is no bank feed and no
              payout record in this database, so &quot;collected, not yet paid out&quot;
              cannot be stated.
            </li>
            <li>
              Derived exceptions are recomputed on every read from subscriptions and
              invoices; recorded exceptions come from finance_exceptions once that table
              exists.
            </li>
          </ul>
        </section>
      </div>
    </>
  );
}
