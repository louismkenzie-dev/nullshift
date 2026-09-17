import Link from "next/link";
import {
  EXCEPTIONS,
  EXCEPTION_KIND_LABEL,
  clientRef,
  fmtDate,
  formatMoney,
  overviewMetrics,
} from "@/lib/next/fixtures-finance";
import { Amount, ExceptionStateChip, SourceNote } from "./ui";
import s from "../next.module.css";
import f from "./finance.module.css";
import { realDataEnabled } from "@/lib/next/live-data";
import { LiveFinance } from "../LiveViews";

/**
 * Finance › Overview (brief §5.6). Six distinct figures, each with currency,
 * date range, definition, freshness and a drill-down. Derived from the fixture
 * module so they cannot disagree with the detail pages.
 */
export default function FinanceOverview() {
  if (realDataEnabled()) return <LiveFinance />;
  const metrics = overviewMetrics();
  const openExceptions = EXCEPTIONS.filter((e) => e.state !== "resolved");

  return (
    <>
      <SourceNote />

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
                {m.value.currency}
                {typeof m.count === "number" ? ` · ${m.count}` : ""}
              </span>
            </div>
            <div className={s.metricValue}>{formatMoney(m.value)}</div>
            <span className={f.metricRange}>{m.range}</span>
            <details className={f.metricDef}>
              <summary />
              <p style={{ margin: "6px 0 0" }}>{m.definition}</p>
            </details>
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
        receipts. Client payment volume processed through connected accounts (the
        clients&apos; customers paying the clients) is excluded from all totals and is
        never shown on this page; only the application fee Nullshift earns on it could be
        a Nullshift figure, and that is not part of this slice.
      </div>

      <div className={s.grid12}>
        <section className={`${s.card} ${s.span8}`} aria-labelledby="open-exceptions">
          <div className={s.cardTitle}>
            <h2 id="open-exceptions" className={s.h2}>
              Open exceptions
            </h2>
            <Link href="/admin/next/finance/exceptions" className={f.drill}>
              All exceptions →
            </Link>
          </div>
          {openExceptions.length === 0 ? (
            <p className={s.muted}>No open exceptions.</p>
          ) : (
            <div className={s.queue}>
              {openExceptions.map((e) => {
                const c = clientRef(e.clientId);
                return (
                  <div key={e.id} className={s.queueRow}>
                    <div>
                      <Link
                        href={`/admin/next/finance/exceptions/${e.id}`}
                        className={s.rowLink}
                      >
                        {e.title}
                      </Link>
                      <span className={f.sub}>
                        {e.id} · {EXCEPTION_KIND_LABEL[e.kind]} · {c.legalName}
                      </span>
                    </div>
                    <span className={s.queueMeta}>{e.nextStep}</span>
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
                );
              })}
            </div>
          )}
        </section>

        <section className={`${s.card} ${s.span4}`} aria-labelledby="how-to-read">
          <h2 id="how-to-read" className={s.h2}>
            How to read these figures
          </h2>
          <ul className={f.evidence}>
            <li>
              Contracted value is a monthly run-rate; receivables and overdue are balances
              as at the freshness stamp.
            </li>
            <li>
              Scheduled collections need a provider-confirmed date. &quot;Authorised — not
              scheduled&quot; is a distinct state and is never counted as scheduled.
            </li>
            <li>
              Collected-but-not-paid-out money is gross; the provider deducts fees at
              payout, reconciled on the Reconciliation tab.
            </li>
            <li>
              An unmatched receipt is not income until a human accepts an allocation with
              evidence.
            </li>
            <li>
              Legacy Example Ltd&apos;s historical plan is included in contracted value
              but is read-only everywhere.
            </li>
          </ul>
        </section>
      </div>
    </>
  );
}
