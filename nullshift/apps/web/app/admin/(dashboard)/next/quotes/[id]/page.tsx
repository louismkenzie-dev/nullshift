import Link from "next/link";
import { notFound } from "next/navigation";
import { floorPrice, gbp, marginPct, quoteById, targetPrice } from "@/lib/next/fixtures";
import s from "../../next.module.css";

export default async function QuoteStudio({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const q = quoteById(id);
  if (!q) notFound();

  const cost = q.internal.riskAdjustedCostGbp;
  const floor = cost ? floorPrice(cost, q.internal.minMarginPct) : 0;
  const target = cost ? targetPrice(cost, q.internal.targetMarginPct) : 0;
  const approved = q.internal.approvedPriceGbp;
  const allChecksPass = q.checks.every((c) => c.ok);
  const baseHours = q.estimate.packages.reduce((n, p) => n + p.base, 0);

  return (
    <>
      <p className={s.mono}>
        Sales &amp; Quotes / {q.client} / {q.project}
      </p>
      <div className={s.pageHead}>
        <div>
          <h1 className={s.h1}>Quote Studio</h1>
          <p className={s.lead}>
            <Link href={`/admin/next/clients/${q.clientId}`} className={s.rowLink}>
              {q.client}
            </Link>{" "}
            · {q.project} · {q.version} · <span className={s.chip}>{q.status}</span> ·
            expires {q.expires} · <span className={s.mono}>{q.savedAt}</span>
          </p>
        </div>
        <div className={s.chips}>
          <button className={s.btn} type="button" disabled title="Not in this slice">
            Save draft
          </button>
          <button className={s.btn} type="button" disabled title="Not in this slice">
            Request approval
          </button>
          <button className={s.btn} type="button" disabled title="Not in this slice">
            Preview
          </button>
          <button
            className={s.btnPrimary}
            type="button"
            disabled
            title={
              allChecksPass
                ? "Requires issue permission"
                : "Blocked: a commercial check fails (see Review & approval)"
            }
          >
            Issue
          </button>
        </div>
      </div>

      <div className={s.studio}>
        <nav className={s.steps} aria-label="Quote steps">
          {q.steps.map((st, i) => (
            <div
              key={st.name}
              className={`${s.step} ${st.state === "current" ? s.stepCurrent : st.state === "complete" ? s.stepDone : ""}`}
              aria-current={st.state === "current" ? "step" : undefined}
            >
              <span>
                {i + 1}. {st.name}
              </span>
              <span className={s.mono}>
                {st.state === "complete" ? "✓" : st.state === "current" ? "now" : ""}
              </span>
            </div>
          ))}
        </nav>

        <div className={s.stack}>
          <section className={s.card} aria-labelledby="brief">
            <h2 className={s.h2} id="brief">
              1 · Brief
            </h2>
            <Field label="Desired outcomes">{q.brief.outcomes.join(" · ")}</Field>
            <Field label="Users and volumes">{q.brief.users}</Field>
            <Field label="Constraints">{q.brief.constraints}</Field>
            <Field label="Estimate confidence">
              <span
                className={`${s.chip} ${q.brief.confidence === "low" ? s.chipWarning : s.chipSuccess}`}
              >
                {q.brief.confidence}
              </span>
              {q.brief.confidence === "low" ? (
                <span className={s.muted}>
                  {" "}
                  — paid discovery or a reviewed provisional estimate required before
                  pricing
                </span>
              ) : null}
            </Field>
          </section>

          <section className={s.card} aria-labelledby="scope">
            <h2 className={s.h2} id="scope">
              2 · Scope
            </h2>
            <Field label="Included deliverables">
              {q.scope.included.join(" · ") || "—"}
            </Field>
            <Field label="Exclusions">{q.scope.excluded.join(" · ") || "—"}</Field>
            <Field label="Acceptance criteria">
              {q.scope.acceptance.join(" · ") || "To be defined"}
            </Field>
          </section>

          <section className={s.card} aria-labelledby="estimate">
            <div className={s.cardTitle}>
              <h2 className={s.h2} id="estimate" style={{ margin: 0 }}>
                3 · Delivery estimate
              </h2>
              <span className={s.mono}>internal · hours, not sold</span>
            </div>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Work package</th>
                  <th>Role</th>
                  <th className={s.num}>Low</th>
                  <th className={s.num}>Base</th>
                  <th className={s.num}>High</th>
                </tr>
              </thead>
              <tbody>
                {q.estimate.packages.map((p) => (
                  <tr key={p.name}>
                    <td>{p.name}</td>
                    <td className={s.muted}>{p.role}</td>
                    <td className={s.num}>{p.low}</td>
                    <td className={s.num}>{p.base}</td>
                    <td className={s.num}>{p.high}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={3} className={s.muted}>
                    Base total · contingency {q.estimate.contingencyPct}% · warranty
                    reserve {gbp(q.estimate.warrantyReserveGbp)} (not double-counted)
                  </td>
                  <td className={s.num}>{baseHours}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </section>

          <section className={s.card} aria-labelledby="commercial">
            <h2 className={s.h2} id="commercial">
              4 · Commercial model
            </h2>
            <Field label="BUILD — fixed scoped price">
              {q.commercial.buildPriceGbp
                ? gbp(q.commercial.buildPriceGbp)
                : "Not priced — confidence too low"}
            </Field>
            <Field label="Milestone schedule (example, not policy)">
              {q.commercial.milestones.length
                ? q.commercial.milestones.map((m) => `${m.label} ${m.pct}%`).join(" · ")
                : "—"}
            </Field>
            <Field label="Service route">
              <span className={s.chip}>{q.commercial.route}</span>
            </Field>
            <Field label="RUN state">{q.commercial.runState}</Field>
            <Field label="GROW options">
              {q.commercial.growOptions.length
                ? q.commercial.growOptions
                    .map((g) => `${g.name} — from ${gbp(g.fromGbp)} (${g.basis})`)
                    .join(" · ")
                : "None proposed"}
            </Field>
            <Field label="TRANSACT">{q.commercial.transact}</Field>
          </section>

          <section className={`${s.card} ${s.internal}`} aria-labelledby="review">
            <div className={s.cardTitle}>
              <h2 className={s.h2} id="review" style={{ margin: 0 }}>
                5 · Review &amp; approval
              </h2>
              <span className={`${s.mono}`} style={{ color: "var(--ns-warning)" }}>
                internal — never in client preview
              </span>
            </div>
            <dl className={s.kv}>
              <dt>Risk-adjusted delivery cost</dt>
              <dd>{cost ? gbp(cost) : "Unknown"}</dd>
              <dt>
                Floor ({q.internal.minMarginPct}% minimum margin, rounded up to £100)
              </dt>
              <dd>{floor ? gbp(floor) : "—"}</dd>
              <dt>Target ({q.internal.targetMarginPct}% target margin)</dt>
              <dd>{target ? gbp(target) : "—"}</dd>
              <dt>Approved net selling price</dt>
              <dd>{approved ? gbp(approved) : "—"}</dd>
              <dt>Forecast contribution margin</dt>
              <dd>{approved ? `${marginPct(approved, cost)}%` : "—"}</dd>
              <dt>Approver</dt>
              <dd>{q.internal.approver}</dd>
            </dl>
            <ul className={s.list} style={{ marginTop: 12 }}>
              {q.checks.map((c) => (
                <li key={c.label} className={s.listItem}>
                  <span>{c.label}</span>
                  <span className={`${s.chip} ${c.ok ? s.chipSuccess : s.chipDanger}`}>
                    {c.ok ? "pass" : "blocks issue"}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className={s.card} aria-labelledby="preview">
            <h2 className={s.h2} id="preview">
              6 · Client preview
            </h2>
            <p className={s.muted}>
              Exactly what the client receives: scope, exclusions, acceptance criteria,
              Build price and milestones, the service-route statement, optional Grow items
              with their basis, validity date. No hours, rates, costs, margins or internal
              notes.
            </p>
          </section>
        </div>

        <aside className={`${s.card} ${s.summary}`} aria-label="Commercial summary">
          <div className={s.summaryBlock}>
            <span className={s.mono}>Build</span>
            <div className={s.metricValue}>
              {q.commercial.buildPriceGbp ? gbp(q.commercial.buildPriceGbp) : "—"}
            </div>
            <div className={s.metricNote}>
              Fixed scoped price · ex VAT (tax basis: decision pending)
            </div>
          </div>
          <div className={s.summaryBlock}>
            <span className={s.mono}>Run</span>
            <div style={{ fontWeight: 700, margin: "6px 0" }}>
              {q.commercial.route === "managed"
                ? "Managed route selected"
                : q.commercial.route === "independent"
                  ? "Independent handover"
                  : "Route unresolved"}
            </div>
            <div className={s.metricNote}>{q.commercial.runState}</div>
          </div>
          <div className={s.summaryBlock}>
            <span className={s.mono}>Grow</span>
            {q.commercial.growOptions.length ? (
              <ul className={s.list}>
                {q.commercial.growOptions.map((g) => (
                  <li key={g.name} className={s.listItem}>
                    <span>{g.name}</span>
                    <span className={s.num}>from {gbp(g.fromGbp)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className={s.metricNote}>None</div>
            )}
          </div>
          <div className={s.summaryBlock}>
            <span className={s.mono}>Transact</span>
            <div className={s.metricNote}>{q.commercial.transact}</div>
          </div>
          <div className={s.summaryBlock}>
            <span className={s.mono}>Version</span>
            <div className={s.metricNote}>
              {q.version} · changes after issue create a new version · a stale tab cannot
              accept or issue a superseded version
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={s.field}>
      <span className={`${s.mono} ${s.fieldLabel}`}>{label}</span>
      <div className={s.fieldValue}>{children}</div>
    </div>
  );
}
