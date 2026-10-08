import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { gbp } from "@/lib/ops/clientsData";
import type { TodayData } from "@/lib/ops/todayData";
import s from "./shell.module.css";

/**
 * The Today page, as a pure view over its data — the real page loads it from
 * the database, the design preview hands it fixtures. The first thing you see
 * is the question the page answers: what needs you, and the one action each.
 */

const kindChip: Record<string, string> = {
  incident: s.chipDanger,
  finance: s.chipDanger,
  contract: s.chipWarning,
  overdue: s.chipWarning,
  deadline: s.chipInfo,
  routine: "",
};

export function TodayView({ today }: { today: TodayData }) {
  const m = today.metrics;
  const kinds = ["finance", "contract", "overdue", "deadline", "routine"] as const;

  return (
    <>
      <div className={s.hero}>
        <div>
          <p className={s.mono}>
            {today.asOf} · {today.clientCount} clients
            {today.truncated ? " (first 100 shown)" : ""}
          </p>
          <h1 className={s.heroTitle}>Today</h1>
          <p className={s.lead}>
            What needs attention, why, who owns it and the one next action. Metrics are
            definitions over rows, not health claims.
          </p>
        </div>
        <div className={s.heroActions}>
          <Link href="/admin/clients" className={s.btn}>
            Clients
            <ArrowRight size={14} strokeWidth={1.8} aria-hidden />
          </Link>
          <Link href="/admin/quotes" className={s.btnPrimary}>
            <Plus size={14} strokeWidth={2} aria-hidden />
            Create quote
          </Link>
        </div>
      </div>

      <div className={s.grid12} style={{ marginBottom: 20 }}>
        <Metric
          accent
          label="Contracted monthly"
          value={gbp(m.contractedMonthlyGbp)}
          note={`Service fees on active, trialing and past-due subscriptions · legacy plans ${gbp(
            m.contractedLegacyGbp
          )} · new model ${gbp(m.contractedNewGbp)}`}
        />
        <Metric
          label="Outstanding invoices"
          value={gbp(m.outstandingGbp)}
          note={`Of which overdue ${gbp(m.overdueGbp)} · open invoices · GBP`}
        />
        <Metric
          label="Collections · next 30 days"
          value={gbp(m.scheduledNext30Gbp)}
          note={`Active Direct Debit fees — the provider schedule is not read here · awaiting mandate ${gbp(
            m.awaitingMandateGbp
          )}`}
        />
        <Metric
          label="Clients needing action"
          value={String(m.projectsNeedingAction)}
          note="Distinct clients with at least one attention row"
        />
      </div>

      <div className={s.grid12}>
        <section className={`${s.card} ${s.span8}`} aria-labelledby="attention">
          <div className={s.cardTitle}>
            <h2 className={s.h2} id="attention" style={{ margin: 0 }}>
              Needs attention
            </h2>
            <div className={s.chips} aria-label="Kinds">
              {kinds.map((f) => (
                <span key={f} className={`${s.chip} ${kindChip[f] ?? ""}`}>
                  {f} · {today.attention.filter((a) => a.kind === f).length}
                </span>
              ))}
            </div>
          </div>
          {today.attention.length === 0 ? (
            <p className={s.muted}>No open signal on any client. Nothing to do here.</p>
          ) : (
            <div className={s.queue}>
              {today.attention.map((a, i) => (
                <div key={`${a.clientId}-${a.priority}-${i}`} className={s.queueRow}>
                  <div>
                    <span className={`${s.chip} ${kindChip[a.kind] ?? ""}`}>{a.kind}</span>
                    <div className={s.queueProblem} style={{ marginTop: 8 }}>
                      <Link href={`/admin/clients/${a.clientId}`} className={s.rowLink}>
                        {a.client}
                      </Link>{" "}
                      <span className={s.muted}>·</span> {a.problem}
                    </div>
                  </div>
                  <div className={s.queueMeta}>{a.consequence}</div>
                  <div className={s.queueMeta}>
                    <div>{a.owner}</div>
                    <div className={s.mono}>due {a.due}</div>
                  </div>
                  <Link href={a.href} className={`${s.btn} ${s.btnSmall}`}>
                    {a.action}
                  </Link>
                </div>
              ))}
            </div>
          )}
          <p className={`${s.faint} ${s.mono}`} style={{ marginTop: 14 }}>
            Source freshness: {today.freshness}
          </p>
        </section>

        <div className={`${s.span4} ${s.stack}`}>
          <section className={s.card} aria-labelledby="week">
            <h2 className={s.h2} id="week">
              This week
            </h2>
            {today.week.length === 0 ? (
              <p className={s.muted}>No dated item in the next seven days.</p>
            ) : (
              <ul className={s.list}>
                {today.week.map((w) => (
                  <li key={`${w.at}-${w.what}`} className={s.listItem}>
                    <Link href={w.href} className={s.rowLink}>
                      {w.what}
                    </Link>
                    <span className={s.mono}>{w.when}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className={s.card} aria-labelledby="exceptions">
            <h2 className={s.h2} id="exceptions">
              Approvals and exceptions
            </h2>
            {today.exceptions.length === 0 ? (
              <p className={s.muted}>Nothing awaiting approval; no integration gap found.</p>
            ) : (
              <ul className={s.list}>
                {today.exceptions.map((e) => (
                  <li key={e.text} className={s.listItem}>
                    <Link href={e.href} className={s.rowLink}>
                      {e.text}
                    </Link>
                    <span
                      className={`${s.chip} ${e.tone === "exception" ? s.chipDanger : s.chipInfo}`}
                    >
                      {e.tone}
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

function Metric({
  label,
  value,
  note,
  accent,
}: {
  label: string;
  value: string;
  note: string;
  accent?: boolean;
}) {
  return (
    <div className={`${s.card} ${s.span3} ${accent ? s.metricAccent : ""}`}>
      <span className={s.mono}>{label}</span>
      <div className={s.metricValue}>{value}</div>
      <div className={s.metricNote}>{note}</div>
    </div>
  );
}
