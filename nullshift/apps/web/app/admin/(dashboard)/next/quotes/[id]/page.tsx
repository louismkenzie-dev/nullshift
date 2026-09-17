import Link from "next/link";
import { notFound } from "next/navigation";
import { flagOn } from "@/lib/flags";
import { loadQuoteForStudio } from "@/lib/commercial/quotes";
import { gbp, quoteById, type Quote } from "@/lib/next/fixtures";
import {
  POLICY_2026_09_DRAFT,
  calculateEstimate,
  estimateInputFromQuote,
  hasBlockers,
  isKnown,
  toClientView,
  validateEstimate,
  type Scenario,
  type Severity,
} from "@/lib/estimator";
import s from "../../next.module.css";
import st from "./studio.module.css";

type Source = "database" | "fixture";

/**
 * Behind both flags the persisted quote version is tried first; otherwise, and
 * whenever nothing is persisted, the fixture is used. With the flags off this
 * never touches the data layer.
 */
async function loadQuote(id: string): Promise<{ q: Quote; source: Source } | null> {
  if (flagOn("calculator") && flagOn("commercialV2")) {
    const persisted = await loadQuoteForStudio(id);
    if (persisted) return { q: persisted, source: "database" };
  }
  const q = quoteById(id);
  return q ? { q, source: "fixture" } : null;
}

const minor = (n: number | null | undefined): string =>
  n === null || n === undefined
    ? "—"
    : new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: "GBP",
        minimumFractionDigits: n % 100 === 0 ? 0 : 2,
        maximumFractionDigits: 2,
      }).format(n / 100);

const pct = (p: number | null): string => (p === null ? "undefined" : `${p}%`);

/** Fixture checks the estimator now computes itself are not repeated as manual items. */
const COMPUTED_CHECK = /floor|low ≤ base|override|unknown, not zero|threshold/i;

export default async function QuoteStudio({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const loaded = await loadQuote(id);
  if (!loaded) notFound();
  const { q, source } = loaded;

  const policy = POLICY_2026_09_DRAFT;
  const input = estimateInputFromQuote(q, policy);
  const result = calculateEstimate(input, policy);
  const issues = validateEstimate(input, policy, result);
  const client = toClientView(result, input);
  const manualChecks = q.checks.filter((c) => !COMPUTED_CHECK.test(c.label));
  const blocked = hasBlockers(issues) || manualChecks.some((c) => !c.ok);
  const build = result.build;
  const run = result.run;
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
            expires {q.expires} · <span className={s.mono}>{q.savedAt}</span> ·{" "}
            <span className={s.mono}>source: {source}</span>
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
              blocked
                ? "Blocked: a commercial check fails (see Review & approval)"
                : "Requires issue permission"
            }
          >
            Issue
          </button>
        </div>
      </div>

      <p className={s.banner}>
        Sandbox estimator · {policy.id} ({policy.state}) · draft catalogue · hypothetical
        rates · nothing here is an approved price
      </p>

      <div className={s.studio}>
        <nav className={s.steps} aria-label="Quote steps">
          {q.steps.map((step, i) => (
            <div
              key={step.name}
              className={`${s.step} ${step.state === "current" ? s.stepCurrent : step.state === "complete" ? s.stepDone : ""}`}
              aria-current={step.state === "current" ? "step" : undefined}
            >
              <span>
                {i + 1}. {step.name}
              </span>
              <span className={s.mono}>
                {step.state === "complete"
                  ? "done"
                  : step.state === "current"
                    ? "now"
                    : ""}
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
                className={`${s.chip} ${result.confidence === "insufficient" || result.confidence === "low" ? s.chipWarning : s.chipSuccess}`}
              >
                {result.confidence}
              </span>
              {result.discoveryRequired ? (
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
                    reserve {gbp(q.estimate.warrantyReserveGbp)} (counted once)
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
              {client.build.priced
                ? minor(client.build.priceMinor)
                : client.build.statement}
            </Field>
            <Field label="Milestone schedule (example, not policy)">
              {client.build.milestones.length
                ? client.build.milestones
                    .map((m) => `${m.label} ${m.pct}% · ${minor(m.minor)}`)
                    .join(" · ")
                : q.commercial.milestones.length
                  ? q.commercial.milestones.map((m) => `${m.label} ${m.pct}%`).join(" · ")
                  : "—"}
            </Field>
            <Field label="Service route">
              <span className={s.chip}>{run.route}</span>{" "}
              <span className={s.mono}>{run.stage.replace("_", " ")}</span>
            </Field>
            <Field label="RUN statement">{run.statement}</Field>
            <Field label="GROW options (draft catalogue, non-chargeable)">
              {client.grow.length
                ? client.grow
                    .map((g) => `${g.name} — from ${minor(g.fromMinor)} (${g.basis})`)
                    .join(" · ")
                : "None proposed"}
            </Field>
            <Field label="TRANSACT">{result.transact.statement}</Field>
          </section>

          <section className={`${s.card} ${s.internal}`} aria-labelledby="review">
            <div className={s.cardTitle}>
              <h2 className={s.h2} id="review" style={{ margin: 0 }}>
                5 · Review &amp; approval
              </h2>
              <span className={s.mono} style={{ color: "var(--ns-warning)" }}>
                internal — never in client preview
              </span>
            </div>
            <p className={st.policyLine}>
              <span>
                Policy <strong>{result.policy.id}</strong>
              </span>
              <span className={`${s.chip} ${s.chipWarning}`}>{result.policy.state}</span>
              <span>effective {result.policy.effectiveDate}</span>
              <span>
                build margin {result.policy.minMarginPct}–{result.policy.targetMarginPct}%
              </span>
              <span>
                run margin {result.policy.minRunMarginPct}–
                {result.policy.targetRunMarginPct}%
              </span>
              <span>rounds up to {minor(result.policy.roundingIncrementMinor)}</span>
              <span>
                review above {minor(result.policy.approvalThresholdMinor)} · no cap
              </span>
            </p>

            {build.state === "priced" ? (
              <>
                <dl className={s.kv}>
                  <dt>Internal estimate (base risk-adjusted delivery cost)</dt>
                  <dd>{minor(build.internalEstimateMinor)}</dd>
                  <dt>
                    Floor ({result.policy.minMarginPct}% minimum margin, rounded up)
                  </dt>
                  <dd>{minor(build.floorMinor)}</dd>
                  <dt>
                    Target ({result.policy.targetMarginPct}% target margin, rounded up)
                  </dt>
                  <dd>{minor(build.targetMinor)}</dd>
                  <dt>Recommended price</dt>
                  <dd>{minor(build.recommendedMinor)}</dd>
                  <dt>Approved net selling price</dt>
                  <dd>{minor(build.approvedNetMinor)}</dd>
                  <dt>Forecast contribution</dt>
                  <dd>
                    {build.contribution
                      ? minor(build.contribution.contributionMinor)
                      : "—"}
                  </dd>
                  <dt>Forecast contribution margin</dt>
                  <dd>{build.contribution ? pct(build.contribution.marginPct) : "—"}</dd>
                  {build.contribution && build.contribution.discountsMinor > 0 ? (
                    <>
                      <dt>Before discounts</dt>
                      <dd>
                        {minor(build.contribution.beforeDiscounts.contributionMinor)} ·{" "}
                        {pct(build.contribution.beforeDiscounts.marginPct)}
                      </dd>
                    </>
                  ) : null}
                  <dt>Approver</dt>
                  <dd>{input.selling.approvedBy ?? "—"}</dd>
                  <dt>Escalation</dt>
                  <dd>
                    {build.escalation.required ? "Review required" : "Not required"}
                  </dd>
                </dl>

                <h3 className={st.subhead}>Scenarios (internal)</h3>
                <table className={st.scenarios}>
                  <thead>
                    <tr>
                      <th scope="col">Line</th>
                      <th scope="col">Low</th>
                      <th scope="col" className={st.baseCol}>
                        Base
                      </th>
                      <th scope="col">High</th>
                    </tr>
                  </thead>
                  <tbody>
                    <ScenarioRow
                      label="Hours"
                      pick={(sc) => `${sc.hours}`}
                      sc={build.scenarios}
                    />
                    <ScenarioRow
                      label="Labour at loaded rates"
                      pick={(sc) => minor(sc.labourMinor)}
                      sc={build.scenarios}
                    />
                    <ScenarioRow
                      label="External, contractors, project costs"
                      pick={(sc) =>
                        minor(
                          sc.externalMinor +
                            sc.contractorsMinor +
                            sc.attributableProjectCostsMinor
                        )
                      }
                      sc={build.scenarios}
                    />
                    <ScenarioRow
                      label="Base delivery cost"
                      pick={(sc) => minor(sc.baseDeliveryCostMinor)}
                      sc={build.scenarios}
                    />
                    <ScenarioRow
                      label={`Contingency ${input.contingencyPct}%`}
                      pick={(sc) => minor(sc.contingencyMinor)}
                      sc={build.scenarios}
                    />
                    <ScenarioRow
                      label="Warranty reserve"
                      pick={(sc) => minor(sc.warrantyReserveMinor)}
                      sc={build.scenarios}
                    />
                    <ScenarioRow
                      label="Risk-adjusted delivery cost"
                      pick={(sc) => minor(sc.riskAdjustedDeliveryCostMinor)}
                      sc={build.scenarios}
                      total
                    />
                    <ScenarioRow
                      label="Floor"
                      pick={(sc) => minor(sc.floorMinor)}
                      sc={build.scenarios}
                    />
                    <ScenarioRow
                      label="Target"
                      pick={(sc) => minor(sc.targetMinor)}
                      sc={build.scenarios}
                    />
                  </tbody>
                </table>
                <p className={s.metricNote}>
                  Spread (high − low) / base: {build.spreadPct}% · limit{" "}
                  {policy.maxSpreadPct}%
                </p>

                <h3 className={st.subhead}>Cost drivers (base scenario)</h3>
                <ul className={st.drivers}>
                  {build.drivers.map((d) => (
                    <li key={`${d.kind}-${d.label}`} className={st.driver}>
                      <span>{d.label}</span>
                      <span className={s.num}>
                        {minor(d.minor)} · {d.sharePct}%
                      </span>
                      <span className={st.driverBar} aria-hidden="true">
                        <span style={{ width: `${Math.min(100, d.sharePct)}%` }} />
                      </span>
                      <span className={st.driverNote}>{d.explanation}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <div className={st.unknowns} role="status">
                <strong>No Build price: insufficient confidence.</strong>{" "}
                {build.requirement}. Unknown inputs are not treated as zero:
                <ul>
                  {build.unknowns.map((u) => (
                    <li key={u.label}>
                      {u.label} — <span className={s.muted}>{u.reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <h3 className={st.subhead}>RUN — cost-to-serve (internal)</h3>
            {run.lines.length === 0 ? (
              <p className={st.empty}>
                {run.route === "managed"
                  ? "No cost-to-serve lines yet — recurring costs are missing, not zero."
                  : "No recurring cost-to-serve for this route."}
              </p>
            ) : (
              <dl className={s.kv}>
                <dt>Fixed (Nullshift pays)</dt>
                <dd>{minor(run.fixedMinor)}</dd>
                <dt>Usage-sensitive (Nullshift pays)</dt>
                <dd>{minor(run.usageSensitiveMinor)}</dd>
                <dt>Client pays provider directly (listed, not costed)</dt>
                <dd>{minor(run.clientDirectMinor)}</dd>
                <dt>Monthly cost-to-serve</dt>
                <dd>{minor(run.monthlyCostToServeMinor)}</dd>
                <dt>Run floor ({result.policy.minRunMarginPct}% minimum run margin)</dt>
                <dd>{minor(run.floorMinor)}/month</dd>
                <dt>
                  Run target ({result.policy.targetRunMarginPct}% target run margin)
                </dt>
                <dd>{minor(run.targetMinor)}/month</dd>
                <dt>Package</dt>
                <dd>
                  {isKnown(run.packageChoice) ? run.packageChoice.value : "deferred"}
                </dd>
              </dl>
            )}

            <h3 className={st.subhead}>Validation ({issues.length})</h3>
            <ul className={st.issues}>
              {issues.map((i, idx) => (
                <li key={`${i.code}-${idx}`} className={st.issue}>
                  <span>{i.message}</span>
                  <SeverityChip severity={i.severity} />
                  {i.effect ? <span className={st.issueEffect}>{i.effect}</span> : null}
                </li>
              ))}
            </ul>

            {manualChecks.length ? (
              <>
                <h3 className={st.subhead}>Manual review items</h3>
                <ul className={s.list}>
                  {manualChecks.map((c) => (
                    <li key={c.label} className={s.listItem}>
                      <span>{c.label}</span>
                      <span
                        className={`${s.chip} ${c.ok ? s.chipSuccess : s.chipDanger}`}
                      >
                        {c.ok ? "pass" : "blocks issue"}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
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
            <dl className={s.kv}>
              <dt>One-off</dt>
              <dd>{minor(client.totals.oneOffMinor)}</dd>
              <dt>Recurring</dt>
              <dd>
                {client.totals.recurringMonthlyMinor === null
                  ? "Not set — from an issued schedule only"
                  : minor(client.totals.recurringMonthlyMinor)}
              </dd>
              <dt>Usage</dt>
              <dd>
                {client.totals.usageBasis.length
                  ? client.totals.usageBasis.join(" · ")
                  : "None"}
              </dd>
              <dt>Percentage fees</dt>
              <dd>
                {client.totals.percentageFeesBps.length
                  ? client.totals.percentageFeesBps.map((b) => `${b} bps`).join(" · ")
                  : "None"}
              </dd>
              <dt>Tax</dt>
              <dd>{client.totals.taxNote}</dd>
            </dl>
          </section>
        </div>

        <aside className={`${s.card} ${s.summary}`} aria-label="Commercial summary">
          <div className={s.summaryBlock}>
            <span className={s.mono}>Build</span>
            <div className={s.metricValue}>
              {client.build.priced ? minor(client.build.priceMinor) : "—"}
            </div>
            <div className={s.metricNote}>
              {client.build.priced
                ? "Approved net price · ex tax (tax basis: decision pending)"
                : client.build.statement}
            </div>
          </div>
          <div className={s.summaryBlock}>
            <span className={s.mono}>Run</span>
            <div style={{ fontWeight: 700, margin: "6px 0" }}>
              {run.route === "managed"
                ? "Managed route selected"
                : run.route === "independent"
                  ? "Independent handover"
                  : "Route unresolved"}
            </div>
            <div className={s.metricNote}>{q.commercial.runState}</div>
          </div>
          <div className={s.summaryBlock}>
            <span className={s.mono}>Grow</span>
            {client.grow.length ? (
              <ul className={s.list}>
                {client.grow.map((g) => (
                  <li key={g.name} className={s.listItem}>
                    <span>{g.name}</span>
                    <span className={s.num}>from {minor(g.fromMinor)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className={s.metricNote}>None</div>
            )}
          </div>
          <div className={s.summaryBlock}>
            <span className={s.mono}>Transact</span>
            <div className={s.metricNote}>{result.transact.statement}</div>
          </div>
          <div className={s.summaryBlock}>
            <span className={s.mono}>Policy</span>
            <div className={s.metricNote}>
              {result.policy.id} · {result.policy.state} · snapshot frozen with this
              version; a later policy never rewrites it
            </div>
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

function ScenarioRow({
  label,
  pick,
  sc,
  total,
}: {
  label: string;
  pick: (sc: Scenario) => string;
  sc: Readonly<Record<"low" | "base" | "high", Scenario>>;
  total?: boolean;
}) {
  return (
    <tr className={total ? st.total : undefined}>
      <td>{label}</td>
      <td>{pick(sc.low)}</td>
      <td className={st.baseCol}>{pick(sc.base)}</td>
      <td>{pick(sc.high)}</td>
    </tr>
  );
}

function SeverityChip({ severity }: { severity: Severity }) {
  const cls =
    severity === "block"
      ? s.chipDanger
      : severity === "review"
        ? s.chipWarning
        : s.chipInfo;
  const text =
    severity === "block" ? "blocks issue" : severity === "review" ? "review" : "info";
  return <span className={`${s.chip} ${cls}`}>{text}</span>;
}
