import Link from "next/link";
import { flagOn } from "@/lib/flags";
import {
  APPROVALS,
  AUTOMATIONS,
  EXCEPTIONS,
  GLOBAL_PAUSE,
  RUN_HISTORY,
  automationById,
  dryRun,
  type Automation,
} from "@/lib/next/fixtures-ops";
import s from "../next.module.css";
import o from "../ops.module.css";
import { Empty, Notice, SubTabs, first, stateTone } from "../sales/ops-ui";

const TABS = [
  { id: "workflows", label: "Workflows", count: AUTOMATIONS.length },
  {
    id: "approvals",
    label: "Approvals",
    count: APPROVALS.filter((a) => a.state === "pending").length,
  },
  { id: "runs", label: "Run history", count: RUN_HISTORY.length },
  {
    id: "exceptions",
    label: "Exceptions",
    count: EXCEPTIONS.filter((e) => e.state === "open").length,
  },
];

const modeTone = (m: Automation["mode"]): string =>
  m === "Enabled"
    ? s.chipSuccess
    : m === "Paused"
      ? s.chipDanger
      : m === "Sandbox"
        ? s.chipInfo
        : "";

export default async function AutomationsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const tab = first(sp.tab) ?? "workflows";
  const previewId = first(sp.preview);
  const preview = previewId ? automationById(previewId) : undefined;
  const workers = flagOn("integrationWorkers");

  return (
    <>
      <div className={s.pageHead}>
        <div>
          <p className={s.mono}>
            Automations · worker:{" "}
            {workers
              ? "flag integrationWorkers on — durable worker not wired in this slice"
              : "integrationWorkers off — nothing runs; catalogue is read-only"}
          </p>
          <h1 className={s.h1}>Automations</h1>
          <p className={s.lead}>
            A readable catalogue of workflows, not a code builder. Every card states its
            trigger, conditions, action, owner, approval requirement, mode, last run and
            failure state.
          </p>
        </div>
      </div>

      <GlobalPause />

      <SubTabs
        base="/admin/next/automations"
        current={tab}
        tabs={TABS}
        keep={{ preview: previewId }}
      />

      {preview ? <DryRunPanel a={preview} tab={tab} /> : null}

      {tab === "workflows" ? <Workflows tab={tab} /> : null}
      {tab === "approvals" ? <Approvals /> : null}
      {tab === "runs" ? <Runs /> : null}
      {tab === "exceptions" ? <Exceptions /> : null}
    </>
  );
}

function GlobalPause() {
  return (
    <section className={o.pause} aria-labelledby="pause">
      <div>
        <p className={o.pauseTitle} id="pause">
          {GLOBAL_PAUSE.label}{" "}
          <span
            className={`${s.chip} ${GLOBAL_PAUSE.active ? s.chipDanger : s.chipSuccess}`}
          >
            {GLOBAL_PAUSE.active ? "paused" : "not paused"}
          </span>
        </p>
        <p className={o.pauseCopy}>{GLOBAL_PAUSE.scope}</p>
        <p className={o.pauseCopy} style={{ marginTop: 6 }}>
          <strong>{GLOBAL_PAUSE.unaffected}</strong>
        </p>
        <p className={o.pauseCopy} style={{ marginTop: 6 }}>
          {GLOBAL_PAUSE.preserved}
        </p>
      </div>
      <button
        type="button"
        className={s.btn}
        disabled
        title="Requires the integrationWorkers flag, a pause register and Finance permission — not wired in this slice"
      >
        {GLOBAL_PAUSE.active
          ? "Resume outbound operations"
          : "Pause new outbound operations"}
      </button>
    </section>
  );
}

function DryRunPanel({ a, tab }: { a: Automation; tab: string }) {
  const r = dryRun(a);
  return (
    <section className={o.dryRun} aria-labelledby="dryrun">
      <div className={s.cardTitle}>
        <h2 className={s.h2} id="dryrun" style={{ margin: 0 }}>
          Dry-run preview · {a.trigger}
        </h2>
        <Link
          href={`/admin/next/automations?tab=${tab}`}
          className={`${s.btn} ${s.btnSmall}`}
        >
          Close preview
        </Link>
      </div>
      <p className={s.muted} style={{ margin: "0 0 12px" }}>
        {r.verdict}. No outbound operation is performed by a preview.
      </p>
      <div className={o.dryStep} style={{ fontWeight: 600 }}>
        <span className={s.mono}>Step</span>
        <span className={s.mono}>Would</span>
        <span className={s.mono}>Guard</span>
        <span className={s.mono}>Effect</span>
      </div>
      {r.steps.map((st) => (
        <div key={st.step} className={o.dryStep}>
          <span>{st.step}</span>
          <span>{st.would}</span>
          <span className={s.muted}>{st.guard}</span>
          <span className={`${s.chip} ${s.chipInfo}`}>{st.effect}</span>
        </div>
      ))}
      <div className={s.chips} style={{ marginTop: 12 }}>
        <button
          type="button"
          className={s.btnPrimary}
          disabled
          title="Enabling requires review of this preview and a policy — not wired in this slice"
        >
          Enable after review
        </button>
      </div>
    </section>
  );
}

function Workflows({ tab }: { tab: string }) {
  if (AUTOMATIONS.length === 0)
    return (
      <Empty title="No workflows" body="The §11 catalogue seeds here once approved." />
    );
  return (
    <div className={o.autoGrid}>
      {AUTOMATIONS.map((a) => (
        <article key={a.id} className={o.autoCard} aria-labelledby={a.id}>
          <div className={o.autoHead}>
            <span className={o.autoTrigger} id={a.id}>
              {a.trigger}
            </span>
            <span className={`${s.chip} ${modeTone(a.mode)}`}>{a.mode}</span>
          </div>
          <dl style={{ margin: 0, display: "grid", gap: 6 }}>
            <div className={o.autoRow}>
              <dt>Conditions</dt>
              <dd>{a.conditions}</dd>
            </div>
            <div className={o.autoRow}>
              <dt>Action</dt>
              <dd>{a.action}</dd>
            </div>
            <div className={o.autoRow}>
              <dt>Owner</dt>
              <dd>{a.owner}</dd>
            </div>
            <div className={o.autoRow}>
              <dt>Approval</dt>
              <dd>{a.approval}</dd>
            </div>
          </dl>
          {a.failureState ? <Notice tone="danger">{a.failureState}</Notice> : null}
          <div className={o.autoFoot}>
            <span>
              {a.lastRun ? (
                <>
                  last run {a.lastRun.at} ·{" "}
                  <span className={`${s.chip} ${stateTone(a.lastRun.outcome)}`}>
                    {a.lastRun.outcome}
                  </span>
                </>
              ) : (
                "never run"
              )}
              {a.outbound ? <span className={o.stamp}>outbound</span> : null}
              {a.highImpact ? <span className={o.stamp}>high impact</span> : null}
            </span>
            <Link
              href={`/admin/next/automations?tab=${tab}&preview=${a.id}`}
              className={`${s.btn} ${s.btnSmall}`}
            >
              Dry run
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}

function Approvals() {
  const pending = APPROVALS.filter((a) => a.state === "pending");
  if (pending.length === 0)
    return (
      <Empty
        title="Nothing awaiting approval"
        body="Approvals raised by workflows appear here with what they require."
      />
    );
  return (
    <div className={s.card} style={{ padding: 0 }}>
      <table className={s.table}>
        <thead>
          <tr>
            <th>Approval</th>
            <th>Client</th>
            <th>Requested by</th>
            <th>Requires</th>
            <th>Impact</th>
            <th>State</th>
          </tr>
        </thead>
        <tbody>
          {pending.map((a) => (
            <tr key={a.id}>
              <td style={{ fontWeight: 600 }}>{a.what}</td>
              <td>
                <Link href={`/admin/next/clients/${a.clientId}`} className={s.rowLink}>
                  {a.client}
                </Link>
              </td>
              <td className={s.mono}>{a.requestedBy}</td>
              <td className={s.muted}>{a.requires}</td>
              <td>
                <span className={`${s.chip} ${a.impact === "high" ? s.chipWarning : ""}`}>
                  {a.impact}
                </span>
              </td>
              <td>
                <span className={`${s.chip} ${stateTone(a.state)}`}>{a.state}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Runs() {
  if (RUN_HISTORY.length === 0)
    return (
      <Empty
        title="No runs yet"
        body="Runs are recorded with subject, outcome and detail."
      />
    );
  return (
    <div className={s.card} style={{ padding: 0 }}>
      <table className={s.table}>
        <thead>
          <tr>
            <th>When</th>
            <th>Workflow</th>
            <th>Subject</th>
            <th>Outcome</th>
            <th>Detail</th>
          </tr>
        </thead>
        <tbody>
          {RUN_HISTORY.map((r) => (
            <tr key={r.id}>
              <td className={s.mono}>{r.at}</td>
              <td>{automationById(r.automationId)?.trigger ?? r.automationId}</td>
              <td>{r.subject}</td>
              <td>
                <span className={`${s.chip} ${stateTone(r.outcome)}`}>{r.outcome}</span>
              </td>
              <td className={s.muted}>{r.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Exceptions() {
  const open = EXCEPTIONS.filter((e) => e.state === "open");
  if (open.length === 0)
    return (
      <Empty
        title="No open exceptions"
        body="Owned exceptions with attempt history and a safe retry appear here."
      />
    );
  return (
    <div className={s.card} style={{ padding: 0 }}>
      <table className={s.table}>
        <thead>
          <tr>
            <th>Exception</th>
            <th>Client</th>
            <th>Owner</th>
            <th>Attempts</th>
            <th>Safe retry</th>
          </tr>
        </thead>
        <tbody>
          {open.map((e) => (
            <tr key={e.id}>
              <td style={{ fontWeight: 600 }}>{e.kind}</td>
              <td>
                {e.clientId === "kestrel" ? (
                  e.client
                ) : (
                  <Link href={`/admin/next/clients/${e.clientId}`} className={s.rowLink}>
                    {e.client}
                  </Link>
                )}
              </td>
              <td className={e.owner === "Unassigned" ? s.faint : ""}>{e.owner}</td>
              <td className={s.muted}>{e.attempts}</td>
              <td className={s.muted}>{e.safeRetry}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
