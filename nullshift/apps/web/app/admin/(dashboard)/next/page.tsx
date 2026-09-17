import Link from "next/link";
import { ATTENTION, METRICS, WEEK, gbp } from "@/lib/next/fixtures";
import s from "./next.module.css";
import { realDataEnabled } from "@/lib/next/live-data";
import { LiveToday } from "./LiveViews";

const kindChip: Record<string, string> = {
  incident: s.chipDanger,
  finance: s.chipDanger,
  contract: s.chipWarning,
  overdue: s.chipWarning,
  deadline: s.chipInfo,
  routine: "",
};

export default function TodayPage() {
  if (realDataEnabled()) return <LiveToday />;
  return (
    <>
      <div className={s.pageHead}>
        <div>
          <p className={s.mono}>Wednesday 17 September 2026 · Mine</p>
          <h1 className={s.h1}>Today</h1>
          <p className={s.lead}>
            What needs attention, why, who owns it and the one next action. Metrics are
            definitions, not health claims.
          </p>
        </div>
        <Link href="/admin/next/quotes/q-northline-v2" className={s.btnPrimary}>
          Create quote
        </Link>
      </div>

      <div className={s.grid12} style={{ marginBottom: 24 }}>
        <Metric
          label="Contracted monthly service fees"
          value={gbp(METRICS.contractedMonthlyGbp)}
          note={`Accepted and activated recurring value · pending future starts ${gbp(METRICS.pendingFutureStartsGbp)} shown separately`}
        />
        <Metric
          label="Outstanding invoice balance"
          value={gbp(METRICS.outstandingGbp)}
          note={`Of which overdue ${gbp(METRICS.overdueGbp)} · GBP · issued to date`}
        />
        <Metric
          label="Scheduled collections · next 30 days"
          value={gbp(METRICS.scheduledNext30Gbp)}
          note={`Provider-confirmed schedules only — not collected cash · authorised but not scheduled ${gbp(METRICS.authorisedNotScheduledGbp)}`}
        />
        <Metric
          label="Projects needing action"
          value={String(METRICS.projectsNeedingAction)}
          note="Distinct clients with an unresolved required action"
        />
      </div>

      <div className={s.grid12}>
        <section className={`${s.card} ${s.span8}`} aria-labelledby="attention">
          <div className={s.cardTitle}>
            <h2 className={s.h2} id="attention" style={{ margin: 0 }}>
              Needs attention
            </h2>
            <div className={s.chips} aria-label="Filters">
              {[
                "Overdue",
                "Due soon",
                "Awaiting client",
                "Blocked",
                "Approvals",
                "Finance",
              ].map((f) => (
                <span key={f} className={s.chip}>
                  {f}
                </span>
              ))}
            </div>
          </div>
          <div className={s.queue}>
            {ATTENTION.map((a, i) => (
              <div key={i} className={s.queueRow}>
                <div>
                  <span className={`${s.chip} ${kindChip[a.kind] ?? ""}`}>{a.kind}</span>
                  <div className={s.queueProblem} style={{ marginTop: 6 }}>
                    <Link
                      href={`/admin/next/clients/${a.clientId}`}
                      className={s.rowLink}
                    >
                      {a.client}
                    </Link>{" "}
                    · {a.problem}
                  </div>
                </div>
                <div className={s.queueMeta}>{a.consequence}</div>
                <div className={s.queueMeta}>
                  <div>{a.owner}</div>
                  <div className={s.mono}>due {a.due}</div>
                </div>
                <Link
                  href={`/admin/next/clients/${a.clientId}`}
                  className={`${s.btn} ${s.btnSmall}`}
                >
                  {a.action}
                </Link>
              </div>
            ))}
          </div>
          <p className={`${s.faint} ${s.mono}`} style={{ marginTop: 12 }}>
            Source freshness: fixture · integrations not consulted
          </p>
        </section>

        <div className={`${s.span4} ${s.stack}`}>
          <section className={s.card} aria-labelledby="week">
            <h2 className={s.h2} id="week">
              This week
            </h2>
            <ul className={s.list}>
              {WEEK.map((w) => (
                <li key={w.what} className={s.listItem}>
                  <span>{w.what}</span>
                  <span className={s.mono}>{w.when}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className={s.card} aria-labelledby="exceptions">
            <h2 className={s.h2} id="exceptions">
              Approvals and integration exceptions
            </h2>
            <ul className={s.list}>
              <li className={s.listItem}>
                <span>Harbour — activation approval (all other gates pass)</span>
                <span className={`${s.chip} ${s.chipInfo}`}>approval</span>
              </li>
              <li className={s.listItem}>
                <span>
                  Westbridge — Xero invoice create failed (retry is accounting-only)
                </span>
                <span className={`${s.chip} ${s.chipDanger}`}>exception</span>
              </li>
              <li className={s.listItem}>
                <span>Fieldstone — collection retry proposal</span>
                <span className={`${s.chip} ${s.chipWarning}`}>approval</span>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className={`${s.card} ${s.span3}`}>
      <span className={s.mono}>{label}</span>
      <div className={s.metricValue}>{value}</div>
      <div className={s.metricNote}>{note}</div>
    </div>
  );
}
