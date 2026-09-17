import Link from "next/link";
import { flagOn } from "@/lib/flags";
import {
  COVERAGE_WORDING,
  DEFECT_DEFINITION,
  WORK_CLASS_META,
  coverageFor,
  suggestClassification,
  type CoverageDecision,
  type CoverageResult,
  type ClassificationSuggestion,
} from "@/lib/work/classify";
import {
  FIXTURE_TENANT_IDS,
  FIXTURE_TODAY,
  INTAKE_REQUESTS,
  MIXED_REQUEST,
  NEXT_ACTION_FIXTURES,
  assess,
  intakeRequestById,
  mixedPlan,
} from "@/lib/work/intakeFixtures";
import {
  ENT_BOOL_KEYS,
  ENT_LABELS,
  ENT_TEXT_KEYS,
  FACT_KEYS,
  FACT_LABELS,
  readIntakeQuery,
  type SearchParams,
} from "@/lib/work/intakeQuery";
import {
  isOverdue,
  isUuid,
  openActionFor,
  planSetNextAction,
  validateNextActionInput,
  type NextActionRow,
} from "@/lib/nextActions/model";
import { listNextActions } from "@/lib/nextActions/actions";
import type { RequestFacts } from "@/lib/work/classify";
import s from "../../next.module.css";
import o from "../../ops.module.css";
import c from "./intake.module.css";
import { Empty, Notice } from "../../sales/ops-ui";
import {
  NextActionForms,
  RecordClassificationForm,
  SplitRequestForm,
} from "./IntakeForms";

const INTAKE = "/admin/next/delivery/intake";

const wordingClass = (d: CoverageDecision): string =>
  d === "included_managed"
    ? c.wordingManaged
    : d === "included_warranty"
      ? c.wordingWarranty
      : d === "chargeable_grow"
        ? c.wordingGrow
        : c.wordingReview;

export default async function IntakePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const workIntake = flagOn("workIntake");
  const reqParam = Array.isArray(sp.req) ? sp.req[0] : sp.req;
  const fixture = intakeRequestById(reqParam ?? "") ?? INTAKE_REQUESTS[0];
  const q = readIntakeQuery(sp, fixture);

  const suggestion = suggestClassification({
    title: q.title,
    description: q.description,
    clientLabel: q.clientLabel,
    facts: q.facts,
  });
  const coverage = coverageFor(suggestion.workClass, q.entitlements);
  const split = mixedPlan();

  // Next-action strip: fixtures by default; live rows only with the flag on
  // and an explicit real tenant id in ?tenant=.
  const tenantParam = Array.isArray(sp.tenant) ? sp.tenant[0] : sp.tenant;
  const liveTenant = workIntake && isUuid(tenantParam) ? tenantParam : null;
  const fixtureTenant = FIXTURE_TENANT_IDS[fixture.clientId] ?? FIXTURE_TENANT_IDS.cedar;
  let stripRows: NextActionRow[] = NEXT_ACTION_FIXTURES.filter(
    (r) => r.tenant_id === fixtureTenant
  );
  let stripSource = `fixtures · ${fixture.client}`;
  let stripError: string | null = null;
  if (liveTenant) {
    const live = await listNextActions({ tenantId: liveTenant });
    if (live.ok) {
      stripRows = [...(live.open ? [live.open] : []), ...live.history];
      stripSource = `database · tenant ${liveTenant}`;
    } else {
      stripError = live.message;
    }
  }
  const stripTenant = liveTenant ?? fixtureTenant;
  const open = openActionFor(stripRows, stripTenant);
  const history = stripRows
    .filter((r) => r.state !== "open")
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  // What-if for "set next action" against the fixture/live rows (no write).
  const naValidation = q.nextAction.asked
    ? validateNextActionInput({
        tenantId: stripTenant,
        text: q.nextAction.text,
        owner: q.nextAction.owner,
        dueAt: q.nextAction.dueAt || null,
      })
    : null;
  const naPlan = naValidation?.ok ? planSetNextAction(open, naValidation.value) : null;

  return (
    <>
      <p className={s.mono}>
        <Link href="/admin/next/delivery?tab=queue">Delivery</Link> / Work queue / Intake
      </p>
      <div className={s.pageHead}>
        <div>
          <h1 className={s.h1}>Work intake</h1>
          <p className={s.lead}>
            A request is classified against accepted implemented scope, then coverage is
            decided from the agreements in force. Classification does not itself create an
            entitlement.
          </p>
        </div>
        <span className={`${s.chip} ${workIntake ? s.chipSuccess : ""}`}>
          workIntake {workIntake ? "on" : "off"}
        </span>
      </div>

      <Notice tone={workIntake ? "info" : "muted"}>
        {workIntake
          ? "Flag workIntake is on: the record, split and next-action forms below post to real server actions (staff only, audited; preview sessions are refused). The classifier and worked examples remain fixtures."
          : "Flag workIntake is off: everything on this page is fixtures and pure logic. The what-if forms use GET and write nothing; the record/split/next-action actions return flag_off without touching the database."}
      </Notice>

      {/* ── Classify a request ─────────────────────────────────────── */}
      <div className={s.grid12} style={{ marginTop: 24 }}>
        <section className={`${s.card} ${s.span8}`} aria-labelledby="classify">
          <div className={s.cardTitle}>
            <h2 className={s.h2} id="classify" style={{ margin: 0 }}>
              Classify a request
            </h2>
            <span className={s.mono}>
              {q.fromQuery ? "what-if from query" : `fixture ${fixture.id}`}
            </span>
          </div>
          <p className={s.queueMeta} style={{ marginBottom: 12 }}>
            <Link href={`/admin/next/clients/${fixture.clientId}`} className={s.rowLink}>
              {fixture.client}
            </Link>{" "}
            · received {fixture.receivedAt} via {fixture.via} · client called it &ldquo;
            {q.clientLabel || "—"}&rdquo;
          </p>

          <form method="get" action={INTAKE} className={c.form}>
            <input type="hidden" name="q" value="1" />
            <input type="hidden" name="req" value={fixture.id} />
            <div className={c.row2}>
              <div>
                <label className={c.label} htmlFor="title">
                  Request
                </label>
                <input
                  id="title"
                  name="title"
                  className={c.input}
                  defaultValue={q.title}
                  maxLength={200}
                />
              </div>
              <div>
                <label className={c.label} htmlFor="label">
                  Client called it
                </label>
                <input
                  id="label"
                  name="label"
                  className={c.input}
                  defaultValue={q.clientLabel}
                  maxLength={40}
                  placeholder="bug, change, question…"
                />
              </div>
            </div>
            <div>
              <label className={c.label} htmlFor="description">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                className={c.textarea}
                defaultValue={q.description}
                maxLength={1000}
              />
            </div>
            <div className={c.result}>
              <fieldset className={c.fieldset}>
                <legend className={c.legend}>Facts against accepted scope</legend>
                <div className={c.checks}>
                  {(Object.keys(FACT_KEYS) as (keyof RequestFacts)[]).map((k) => (
                    <label key={k} className={c.check}>
                      <input
                        type="checkbox"
                        name={FACT_KEYS[k]}
                        value="1"
                        defaultChecked={q.facts[k] === true}
                      />
                      <span>{FACT_LABELS[k]}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset className={c.fieldset}>
                <legend className={c.legend}>Entitlements in force</legend>
                <div className={c.checks}>
                  {(Object.keys(ENT_BOOL_KEYS) as (keyof typeof ENT_BOOL_KEYS)[]).map(
                    (k) => (
                      <label key={k} className={c.check}>
                        <input
                          type="checkbox"
                          name={ENT_BOOL_KEYS[k]}
                          value="1"
                          defaultChecked={q.entitlements[k] === true}
                        />
                        <span>{ENT_LABELS[k]}</span>
                      </label>
                    )
                  )}
                </div>
                <div className={c.form} style={{ marginTop: 12 }}>
                  <div>
                    <label className={c.label} htmlFor="e_managed_ref">
                      Run schedule reference
                    </label>
                    <input
                      id="e_managed_ref"
                      name={ENT_TEXT_KEYS.managedAgreement}
                      className={c.input}
                      defaultValue={q.entitlements.managedAgreement ?? ""}
                    />
                  </div>
                  <div>
                    <label className={c.label} htmlFor="e_warranty_ref">
                      Warranty reference
                    </label>
                    <input
                      id="e_warranty_ref"
                      name={ENT_TEXT_KEYS.warrantyAgreement}
                      className={c.input}
                      defaultValue={q.entitlements.warrantyAgreement ?? ""}
                    />
                  </div>
                  <div>
                    <label className={c.label} htmlFor="e_fee_ref">
                      Fee schedule reference
                    </label>
                    <input
                      id="e_fee_ref"
                      name={ENT_TEXT_KEYS.feeScheduleAgreement}
                      className={c.input}
                      defaultValue={q.entitlements.feeScheduleAgreement ?? ""}
                    />
                  </div>
                </div>
              </fieldset>
            </div>
            <div className={c.actions}>
              <button type="submit" className={s.btnPrimary}>
                Assess
              </button>
              <Link href={`${INTAKE}?req=${fixture.id}`} className={s.btn}>
                Reset to fixture
              </Link>
              <span className={s.queueMeta}>GET only — nothing is written.</span>
            </div>
          </form>

          <div className={c.result} style={{ marginTop: 20 }}>
            <SuggestionPanel suggestion={suggestion} />
            <CoveragePanel coverage={coverage} />
          </div>

          {workIntake ? (
            <div style={{ marginTop: 20 }}>
              <p className={c.panelTitle}>Record on a real issue</p>
              <RecordClassificationForm
                workClass={suggestion.workClass}
                coverage={coverage.decision}
                governing={coverage.governing}
                reasons={[...suggestion.reasons, ...coverage.reasons]}
                clientLabel={q.clientLabel}
              />
            </div>
          ) : null}
        </section>

        <div className={`${s.span4} ${s.stack}`}>
          <section className={s.card} aria-labelledby="examples">
            <div className={s.cardTitle}>
              <h2 className={s.h2} id="examples" style={{ margin: 0 }}>
                Worked examples
              </h2>
              <span className={s.mono}>{INTAKE_REQUESTS.length} fixtures</span>
            </div>
            {INTAKE_REQUESTS.length === 0 ? (
              <Empty
                title="No requests awaiting classification"
                body="Requests arrive from the portal, email or monitoring and appear here before work starts."
              />
            ) : (
              <ul className={c.examples}>
                {INTAKE_REQUESTS.map((r) => {
                  const a = assess(r);
                  const active = r.id === fixture.id;
                  return (
                    <li key={r.id}>
                      <Link
                        href={`${INTAKE}?req=${r.id}`}
                        className={`${c.example} ${active ? c.exampleActive : ""}`}
                        aria-current={active ? "true" : undefined}
                      >
                        <span className={c.exampleTitle}>{r.title}</span>
                        <span className={c.exampleFlow}>
                          {r.client} · &ldquo;{r.clientLabel}&rdquo;
                          <span className={c.arrow} aria-hidden="true">
                            →
                          </span>
                          {a.suggestion.workClass
                            ? WORK_CLASS_META[a.suggestion.workClass].label
                            : "no class"}
                          <span className={c.arrow} aria-hidden="true">
                            →
                          </span>
                          {COVERAGE_WORDING[a.coverage.decision]}
                        </span>
                        <span className={c.exampleFlow}>{r.lesson}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className={s.card} aria-labelledby="defn">
            <h2 className={s.h2} id="defn">
              Defect definition (proposed)
            </h2>
            <p className={s.muted} style={{ margin: 0, fontSize: 13 }}>
              {DEFECT_DEFINITION}
            </p>
            <p className={s.queueMeta} style={{ marginTop: 8 }}>
              Final legal wording requires review; already accepted wording is not
              rewritten.
            </p>
          </section>
        </div>
      </div>

      {/* ── Mixed request split ────────────────────────────────────── */}
      <section className={s.card} style={{ marginTop: 24 }} aria-labelledby="mixed">
        <div className={s.cardTitle}>
          <h2 className={s.h2} id="mixed" style={{ margin: 0 }}>
            Mixed request → linked items
          </h2>
          <span className={s.mono}>fixture {MIXED_REQUEST.id}</span>
        </div>
        <p className={s.queueMeta}>
          <Link
            href={`/admin/next/clients/${MIXED_REQUEST.clientId}`}
            className={s.rowLink}
          >
            {MIXED_REQUEST.client}
          </Link>{" "}
          · &ldquo;{MIXED_REQUEST.title}&rdquo; · client called it &ldquo;
          {MIXED_REQUEST.clientLabel}&rdquo;
        </p>
        <table className={s.table} style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <th>Linked item</th>
              <th>Class</th>
              <th>Coverage</th>
              <th>Gate</th>
            </tr>
          </thead>
          <tbody>
            {split.parts.map((p) => (
              <tr key={p.workClass}>
                <td>
                  <div className={c.split}>
                    <span style={{ fontWeight: 600 }}>{p.title}</span>
                    <div className={s.queueMeta}>{p.reason}</div>
                  </div>
                </td>
                <td>
                  <span className={o.classTag}>{WORK_CLASS_META[p.workClass].label}</span>
                </td>
                <td>
                  <span className={`${c.wording} ${wordingClass(p.coverage.decision)}`}>
                    {p.coverage.wording}
                  </span>
                </td>
                <td className={p.gate === "proceed" ? c.gateProceed : c.gateQuote}>
                  {p.gate === "proceed"
                    ? "proceeds now"
                    : "awaits Grow quote and payment gate"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className={s.queueMeta} style={{ marginTop: 12 }}>
          {split.note}
        </p>
        {workIntake ? (
          <div style={{ marginTop: 16 }}>
            <p className={c.panelTitle}>Split a real issue</p>
            <SplitRequestForm
              parts={split.parts.map((p) => ({
                title: p.title,
                workClass: p.workClass,
                coverage: p.coverage.decision,
                reason: p.reason,
              }))}
            />
          </div>
        ) : null}
      </section>

      {/* ── Next-action strip ──────────────────────────────────────── */}
      <section style={{ marginTop: 24 }} aria-labelledby="next-action">
        <div className={s.cardTitle}>
          <h2 className={s.h2} id="next-action" style={{ margin: 0 }}>
            Next action
          </h2>
          <span className={s.mono}>{stripSource}</span>
        </div>
        {stripError ? <Notice tone="warning">{stripError}</Notice> : null}

        {open ? (
          <div className={s.strip}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className={c.stripText}>{open.text}</div>
              <div className={c.stripMeta}>
                Owner {open.owner}
                {open.due_at ? ` · due ${open.due_at}` : " · no due date"} · source{" "}
                {open.source}
              </div>
            </div>
            {isOverdue(open, FIXTURE_TODAY) ? (
              <span className={`${s.chip} ${s.chipDanger}`}>overdue</span>
            ) : (
              <span className={`${s.chip} ${s.chipSuccess}`}>open</span>
            )}
            {open.owner === "Unassigned" ? (
              <span className={`${s.chip} ${s.chipWarning}`}>no owner</span>
            ) : null}
          </div>
        ) : (
          <div className={`${s.strip} ${c.stripEmpty}`}>
            <div>
              <div className={c.stripText}>No open next action</div>
              <div className={c.stripMeta}>
                Every active client should have exactly one owned next action. Set one
                below.
              </div>
            </div>
          </div>
        )}

        <div className={s.grid12}>
          <section className={`${s.card} ${s.span6}`} aria-labelledby="set-na">
            <h2 className={s.h2} id="set-na">
              Set next action
            </h2>
            <form method="get" action={INTAKE} className={c.form}>
              <input type="hidden" name="na" value="1" />
              <input type="hidden" name="req" value={fixture.id} />
              {liveTenant ? (
                <input type="hidden" name="tenant" value={liveTenant} />
              ) : null}
              <div>
                <label className={c.label} htmlFor="na_text">
                  Next action
                </label>
                <input
                  id="na_text"
                  name="na_text"
                  className={c.input}
                  defaultValue={q.nextAction.text || open?.text || ""}
                  maxLength={280}
                />
              </div>
              <div className={c.row2}>
                <div>
                  <label className={c.label} htmlFor="na_owner">
                    Owner
                  </label>
                  <input
                    id="na_owner"
                    name="na_owner"
                    className={c.input}
                    defaultValue={q.nextAction.owner || open?.owner || "Louis"}
                    maxLength={80}
                  />
                </div>
                <div>
                  <label className={c.label} htmlFor="na_due">
                    Due
                  </label>
                  <input
                    id="na_due"
                    name="na_due"
                    type="date"
                    className={c.input}
                    defaultValue={q.nextAction.dueAt || open?.due_at || ""}
                  />
                </div>
              </div>
              <div className={c.actions}>
                <button type="submit" className={s.btn}>
                  Preview what would happen
                </button>
                <span className={s.queueMeta}>GET only — nothing is written.</span>
              </div>
            </form>

            {naValidation && !naValidation.ok ? (
              <p className={`${c.status} ${c.statusFail}`} role="status">
                {naValidation.message}
              </p>
            ) : null}
            {naPlan ? (
              <div className={c.plan} role="status">
                <span className={c.planKind}>
                  {naPlan.kind === "noop"
                    ? "no change"
                    : naPlan.kind === "supersede"
                      ? "supersede + insert"
                      : "insert"}
                </span>
                <p style={{ margin: "6px 0 0" }}>
                  {naPlan.kind === "noop"
                    ? "The open next action already says exactly this. Nothing would be written and no duplicate created."
                    : naPlan.kind === "supersede"
                      ? `"${naPlan.supersede.text}" would be marked superseded (kept in history) and "${naPlan.insert.text}" inserted as the one open action.`
                      : `"${naPlan.insert.text}" would be inserted as the client's one open action.`}
                </p>
              </div>
            ) : null}

            {workIntake ? (
              <div style={{ marginTop: 16 }}>
                <p className={c.panelTitle}>Write (flag on)</p>
                <NextActionForms
                  tenantId={liveTenant ?? ""}
                  openId={liveTenant && open ? open.id : null}
                  defaults={{
                    text: q.nextAction.text || "",
                    owner: q.nextAction.owner || "Louis",
                    dueAt: q.nextAction.dueAt || "",
                  }}
                />
                {!liveTenant ? (
                  <p className={s.queueMeta} style={{ marginTop: 8 }}>
                    Add <code>?tenant=&lt;uuid&gt;</code> to read and write a real
                    client&rsquo;s next action; fixture ids are refused by the action.
                  </p>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className={`${s.card} ${s.span6}`} aria-labelledby="na-history">
            <div className={s.cardTitle}>
              <h2 className={s.h2} id="na-history" style={{ margin: 0 }}>
                History
              </h2>
              <span className={s.mono}>superseded, never edited</span>
            </div>
            {history.length === 0 ? (
              <p className={s.muted} style={{ margin: 0 }}>
                No previous next actions for this client.
              </p>
            ) : (
              <ul className={c.history}>
                {history.map((r) => (
                  <li key={r.id}>
                    <span
                      className={`${s.chip} ${r.state === "done" ? s.chipSuccess : ""}`}
                    >
                      {r.state}
                    </span>
                    <span>
                      {r.text}
                      <div className={s.queueMeta}>
                        {r.owner}
                        {r.due_at ? ` · due ${r.due_at}` : ""}
                        {r.completed_at ? ` · done ${r.completed_at.slice(0, 10)}` : ""}
                        {r.superseded_by_id ? ` · replaced by ${r.superseded_by_id}` : ""}
                      </div>
                    </span>
                    <span className={s.mono}>{r.created_at.slice(0, 10)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </section>
    </>
  );
}

function SuggestionPanel({ suggestion }: { suggestion: ClassificationSuggestion }) {
  const cls = suggestion.workClass;
  return (
    <div className={c.panel}>
      <p className={c.panelTitle}>Suggested class</p>
      <p className={c.classBig}>
        {suggestion.split
          ? "MIXED — split required"
          : cls
            ? WORK_CLASS_META[cls].label
            : "No class"}
      </p>
      <div className={s.chips}>
        <span className={s.chip}>confidence {suggestion.confidence}</span>
        <span
          className={`${s.chip} ${suggestion.lane === "incident" ? c.laneIncident : ""}`}
        >
          {suggestion.lane} lane
        </span>
        {suggestion.needsHumanReview ? (
          <span className={`${s.chip} ${s.chipWarning}`}>human review</span>
        ) : null}
      </div>
      {cls ? (
        <p className={s.queueMeta} style={{ marginTop: 8 }}>
          {WORK_CLASS_META[cls].handling}
        </p>
      ) : null}
      <ul className={c.reasons}>
        {suggestion.reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      {suggestion.labelMismatch ? (
        <p className={c.mismatch}>{suggestion.labelMismatch.note}</p>
      ) : null}
      {suggestion.split ? (
        <ul className={c.reasons}>
          {suggestion.split.map((p) => (
            <li key={p.workClass}>
              {WORK_CLASS_META[p.workClass].label}: {p.title} —{" "}
              {p.gate === "proceed" ? "proceeds" : "quote required"}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function CoveragePanel({ coverage }: { coverage: CoverageResult }) {
  return (
    <div className={c.panel}>
      <p className={c.panelTitle}>Coverage</p>
      <p className={`${c.wording} ${wordingClass(coverage.decision)}`}>
        {coverage.wording}
      </p>
      <div className={s.chips}>
        {coverage.quoteRequired ? (
          <span className={`${s.chip} ${s.chipInfo}`}>quote required</span>
        ) : null}
        {coverage.needsReview ? (
          <span className={`${s.chip} ${s.chipWarning}`}>needs review</span>
        ) : null}
        {coverage.governing ? (
          <span className={s.chip}>governing: {coverage.governing}</span>
        ) : (
          <span className={s.chip}>no governing agreement</span>
        )}
      </div>
      <ul className={c.reasons}>
        {coverage.reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
    </div>
  );
}
