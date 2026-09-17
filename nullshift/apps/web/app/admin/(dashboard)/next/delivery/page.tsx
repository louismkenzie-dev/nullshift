import Link from "next/link";
import { flagOn } from "@/lib/flags";
import { realDataEnabled } from "@/lib/next/live-data";
import { LiveDelivery } from "../LiveViews";
import {
  CAPACITY,
  COVERAGE_LABEL,
  HANDOVER_ORBIT,
  INCIDENTS,
  PROJECTS,
  RELEASES,
  WORK_CLASSES,
  WORK_CLASS_HANDLING,
  WORK_QUEUE,
  buildStartGate,
  capacityWeek,
  formatMoney,
  growExecutionAllowed,
  type WorkItem,
} from "@/lib/next/fixtures-ops";
import s from "../next.module.css";
import o from "../ops.module.css";
import { Empty, Notice, SubTabs, first, stateTone } from "../sales/ops-ui";

const TABS = [
  { id: "projects", label: "Projects", count: PROJECTS.length },
  { id: "queue", label: "Work queue", count: WORK_QUEUE.length },
  { id: "releases", label: "Releases", count: RELEASES.length },
  { id: "handover", label: "Handover", count: 1 },
  { id: "capacity", label: "Capacity" },
];

export default async function DeliveryPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  if (realDataEnabled()) return <LiveDelivery />;
  const tab = first(sp.tab) ?? "projects";

  return (
    <>
      <div className={s.pageHead}>
        <div>
          <p className={s.mono}>Delivery · fixtures</p>
          <h1 className={s.h1}>Delivery</h1>
          <p className={s.lead}>
            Every item links back to accepted scope or an approved change. Acceptance is
            recorded with evidence per deliverable, never inferred from a page view or
            silence.
          </p>
        </div>
      </div>

      <SubTabs base="/admin/next/delivery" current={tab} tabs={TABS} />

      {tab === "projects" ? <Projects /> : null}
      {tab === "queue" ? <Queue /> : null}
      {tab === "releases" ? <Releases /> : null}
      {tab === "handover" ? <Handover /> : null}
      {tab === "capacity" ? <Capacity /> : null}
    </>
  );
}

/* ── Projects ─────────────────────────────────────────── */

function Projects() {
  const acceptanceGate = flagOn("acceptanceGate");
  if (PROJECTS.length === 0)
    return (
      <Empty
        title="No projects"
        body="Projects appear when an agreement is accepted and a scope version exists."
      />
    );
  return (
    <>
      <p className={s.mono} style={{ marginBottom: 12 }}>
        Build-start gate source:{" "}
        {acceptanceGate
          ? "flag acceptanceGate on — explicit acceptance records (not wired in this slice; fixtures shown)"
          : "fixtures (acceptanceGate off — production still reads stage labels)"}
      </p>
      <div className={s.card} style={{ padding: 0 }}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>Project</th>
              <th>Agreed scope version</th>
              <th>Milestones</th>
              <th>Build start</th>
              <th>Blockers</th>
              <th>Delivery lead</th>
            </tr>
          </thead>
          <tbody>
            {PROJECTS.map((p) => {
              const gate = buildStartGate(p.buildStart);
              const done = p.milestones.filter((m) => m.state === "complete").length;
              return (
                <tr key={p.id}>
                  <td>
                    <Link
                      href={`/admin/next/delivery/projects/${p.id}`}
                      className={s.rowLink}
                    >
                      {p.name}
                    </Link>
                    <div className={s.mono}>
                      <Link href={`/admin/next/clients/${p.clientId}`}>{p.client}</Link>
                    </div>
                  </td>
                  <td>
                    {p.scopeVersion.label}
                    <div className={s.queueMeta}>{p.scopeVersion.acceptedAt}</div>
                  </td>
                  <td className={s.num}>
                    {done} / {p.milestones.length}
                  </td>
                  <td>
                    <span
                      className={`${s.chip} ${gate.satisfied ? (gate.waived ? s.chipWarning : s.chipSuccess) : s.chipDanger}`}
                    >
                      {gate.satisfied
                        ? gate.waived
                          ? "satisfied · waiver"
                          : "satisfied"
                        : "blocked"}
                    </span>
                    {gate.waived ? (
                      <div className={s.queueMeta}>
                        deposit invoice: {gate.depositInvoiceState}
                      </div>
                    ) : null}
                  </td>
                  <td className={p.blockers.length ? s.chipDanger : s.faint}>
                    {p.blockers.length || "none"}
                  </td>
                  <td>
                    {p.owners.find((w) => w.role === "Delivery lead")?.name ??
                      "Unassigned"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ── Work queue (§7) ──────────────────────────────────── */

function coverageTone(c: WorkItem["coverage"]): string {
  if (c === "managed" || c === "warranty") return s.chipSuccess;
  if (c === "grow") return s.chipInfo;
  return s.chipWarning;
}

function Queue() {
  const workIntake = flagOn("workIntake");
  const parents = WORK_QUEUE.filter((w) => !w.splitFrom);
  const children = (id: string) => WORK_QUEUE.filter((w) => w.splitFrom === id);

  return (
    <>
      <p className={s.mono} style={{ marginBottom: 12 }}>
        Classification source:{" "}
        {workIntake
          ? "flag workIntake on — issue classification not wired in this slice; fixtures shown"
          : "fixtures (workIntake off — production issues keep their existing vocabulary)"}
      </p>

      <div className={s.grid12} style={{ marginBottom: 24 }}>
        <section
          className={`${s.card} ${s.span8}`}
          style={{ padding: 0 }}
          aria-labelledby="queue"
        >
          <div style={{ padding: "16px 20px 0" }}>
            <div className={s.cardTitle}>
              <h2 className={s.h2} id="queue" style={{ margin: 0 }}>
                Requests
              </h2>
              <span className={s.mono}>
                classification does not itself create an entitlement
              </span>
            </div>
          </div>
          {parents.length === 0 ? (
            <div style={{ padding: 20 }}>
              <Empty
                title="No open requests"
                body="Requests arrive from the portal or email and are classified before work starts."
              />
            </div>
          ) : (
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Class</th>
                  <th>Coverage</th>
                  <th>Owner</th>
                  <th>State</th>
                </tr>
              </thead>
              <tbody>
                {parents.map((w) => (
                  <QueueRows key={w.id} item={w} kids={children(w.id)} />
                ))}
              </tbody>
            </table>
          )}
        </section>

        <div className={`${s.span4} ${s.stack}`}>
          <section className={s.card} aria-labelledby="incidents">
            <div className={s.cardTitle}>
              <h2 className={s.h2} id="incidents" style={{ margin: 0 }}>
                Incidents
              </h2>
              <span className={s.mono}>triaged separately</span>
            </div>
            {INCIDENTS.length === 0 ? (
              <p className={s.muted}>No incidents open.</p>
            ) : (
              <ul className={s.list}>
                {INCIDENTS.map((i) => (
                  <li
                    key={i.id}
                    className={s.listItem}
                    style={{ flexDirection: "column", gap: 4 }}
                  >
                    <span>
                      <span
                        className={`${s.chip} ${i.severity === "S1" ? s.chipDanger : i.severity === "S2" ? s.chipWarning : ""}`}
                      >
                        {i.severity}
                      </span>{" "}
                      <span className={`${s.chip} ${stateTone(i.state)}`}>{i.state}</span>
                    </span>
                    <span style={{ fontWeight: 600 }}>
                      <Link
                        href={`/admin/next/clients/${i.clientId}`}
                        className={s.rowLink}
                      >
                        {i.client}
                      </Link>{" "}
                      · {i.title}
                    </span>
                    <span className={s.queueMeta}>
                      {COVERAGE_LABEL[i.coverage]} · owner {i.owner} · since {i.since}
                    </span>
                    <span className={s.queueMeta}>{i.note}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={s.card} aria-labelledby="classes">
            <h2 className={s.h2} id="classes">
              Seven classes (§7)
            </h2>
            <dl className={s.kv}>
              {WORK_CLASSES.map((c) => (
                <div key={c} style={{ display: "contents" }}>
                  <dt className={o.classTag}>{c}</dt>
                  <dd className={s.muted} style={{ textAlign: "left" }}>
                    {WORK_CLASS_HANDLING[c].handling}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </div>
    </>
  );
}

function QueueRows({ item, kids }: { item: WorkItem; kids: WorkItem[] }) {
  return (
    <>
      <QueueRow item={item} />
      {kids.map((k) => (
        <QueueRow key={k.id} item={k} child />
      ))}
    </>
  );
}

function QueueRow({ item: w, child }: { item: WorkItem; child?: boolean }) {
  const grow = w.growGate ? growExecutionAllowed(w.growGate) : null;
  return (
    <tr>
      <td>
        <div className={child ? o.split : undefined}>
          <span style={{ fontWeight: 600 }}>{w.title}</span>
          <div className={s.mono}>
            {w.id} · <Link href={`/admin/next/clients/${w.clientId}`}>{w.client}</Link> ·
            client called it &ldquo;
            {w.clientCalledIt}&rdquo;
          </div>
          <div className={s.queueMeta}>Governing: {w.governing}</div>
          {w.linkedTo ? <div className={o.linked}>Linked item: {w.linkedTo}</div> : null}
          {w.suggestion ? (
            <div className={s.queueMeta}>
              Suggestion ({w.suggestion.source}): {w.suggestion.note}
            </div>
          ) : null}
          {grow ? (
            <div
              className={`${s.queueMeta} ${grow.allowed ? "" : s.chipDanger}`}
              style={{ border: 0, padding: 0 }}
            >
              Grow execution: {grow.allowed ? "allowed" : "blocked"} — {grow.reason}
            </div>
          ) : null}
        </div>
      </td>
      <td>
        <span className={o.classTag}>{w.workClass}</span>
        <div className={s.queueMeta}>{WORK_CLASS_HANDLING[w.workClass].evidence}</div>
      </td>
      <td>
        <span className={`${s.chip} ${coverageTone(w.coverage)}`}>
          {COVERAGE_LABEL[w.coverage]}
        </span>
      </td>
      <td className={w.owner === "Unassigned" ? s.faint : ""}>{w.owner}</td>
      <td>
        <span className={`${s.chip} ${stateTone(w.state)}`}>{w.state}</span>
        {w.due ? <div className={s.mono}>due {w.due}</div> : null}
      </td>
    </tr>
  );
}

/* ── Releases ─────────────────────────────────────────── */

function Releases() {
  if (RELEASES.length === 0)
    return (
      <Empty
        title="No releases"
        body="Staged and released builds appear here with their acceptance state."
      />
    );
  return (
    <div className={s.card} style={{ padding: 0 }}>
      <table className={s.table}>
        <thead>
          <tr>
            <th>Release</th>
            <th>State</th>
            <th>When</th>
            <th>Linked to</th>
            <th>Acceptance</th>
          </tr>
        </thead>
        <tbody>
          {RELEASES.map((r) => (
            <tr key={r.id}>
              <td>
                <span style={{ fontWeight: 600 }}>{r.label}</span>
                <div className={s.mono}>
                  <Link href={`/admin/next/clients/${r.clientId}`}>{r.client}</Link>
                </div>
                {r.note ? <div className={s.queueMeta}>{r.note}</div> : null}
              </td>
              <td>
                <span className={`${s.chip} ${stateTone(r.state)}`}>{r.state}</span>
              </td>
              <td className={s.muted}>{r.when}</td>
              <td className={s.muted}>{r.linkedTo}</td>
              <td>
                <span className={`${s.chip} ${stateTone(r.acceptance)}`}>
                  {r.acceptance}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Handover (§8.5) ──────────────────────────────────── */

function Handover() {
  const h = HANDOVER_ORBIT;
  const done = h.items.filter((i) => i.state === "complete").length;
  return (
    <div className={s.grid12}>
      <section className={`${s.card} ${s.span8}`} aria-labelledby="handover">
        <div className={s.cardTitle}>
          <h2 className={s.h2} id="handover" style={{ margin: 0 }}>
            <Link href={`/admin/next/clients/${h.clientId}`} className={s.rowLink}>
              {h.client}
            </Link>{" "}
            · independent handover
          </h2>
          <span className={s.mono}>
            {done} of {h.items.length} complete
          </span>
        </div>
        <table className={s.table}>
          <thead>
            <tr>
              <th>#</th>
              <th>Item</th>
              <th>Owner</th>
              <th>State</th>
              <th>Evidence</th>
            </tr>
          </thead>
          <tbody>
            {h.items.map((i) => (
              <tr key={i.n}>
                <td className={s.num}>{i.n}</td>
                <td>{i.label}</td>
                <td>{i.owner}</td>
                <td>
                  <span className={`${s.chip} ${stateTone(i.state)}`}>{i.state}</span>
                </td>
                <td className={s.muted}>{i.evidence ?? i.blockedOn ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <div className={`${s.span4} ${s.stack}`}>
        <section className={s.card}>
          <h2 className={s.h2}>Commercial</h2>
          <dl className={s.kv}>
            <dt>Fee</dt>
            <dd>{formatMoney(h.fee.amount)} once</dd>
            <dt>Status</dt>
            <dd>{h.fee.status}</dd>
            <dt>Tax basis</dt>
            <dd>{h.fee.taxBasis}</dd>
            <dt>Invoice</dt>
            <dd style={{ textAlign: "left" }}>{h.feeInvoice}</dd>
            <dt>Schedule</dt>
            <dd style={{ textAlign: "left" }}>{h.scheduleRef}</dd>
          </dl>
        </section>
        <Notice tone="warning">{h.accessRevocation}</Notice>
        <Notice>
          No ongoing Nullshift management subscription is created. Client-paid third-party
          costs stay separate. Complex migrations, later offboarding and route changes
          need an approved policy; the £600 does not apply to every scenario forever.
        </Notice>
      </div>
    </div>
  );
}

/* ── Capacity ─────────────────────────────────────────── */

function Capacity() {
  return (
    <>
      <Notice tone="info">
        Capacity uses explicit effort and availability assumptions. Nothing here is
        measured time; figures are ranges from quote estimates against stated
        availability.
      </Notice>
      <div className={s.grid12} style={{ marginTop: 16 }}>
        <section className={`${s.card} ${s.span4}`} aria-labelledby="assumptions">
          <h2 className={s.h2} id="assumptions">
            Assumptions
          </h2>
          <ul className={s.list}>
            {CAPACITY.assumptions.map((a) => (
              <li
                key={a.label}
                className={s.listItem}
                style={{ flexDirection: "column", gap: 2 }}
              >
                <span>
                  {a.label}: <strong>{a.value}</strong>
                </span>
                <span className={s.queueMeta}>{a.source}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className={`${s.card} ${s.span8}`} aria-labelledby="weeks">
          <h2 className={s.h2} id="weeks">
            Committed effort by week (hours, low / base / high)
          </h2>
          <div className={o.capGrid}>
            {CAPACITY.weeks.map((w, i) => {
              const c = capacityWeek(i);
              const pct = Math.min(100, Math.round((c.base / c.available) * 100));
              const over = c.high > c.available;
              return (
                <div key={w} className={`${o.capWeek} ${over ? o.capOver : ""}`}>
                  <span className={s.mono}>{w}</span>
                  <div style={{ fontWeight: 700, marginTop: 4 }}>
                    {c.low} / {c.base} / {c.high}
                  </div>
                  <div className={o.capBar} aria-hidden="true">
                    <div className={o.capFill} style={{ width: `${pct}%` }} />
                  </div>
                  <div className={s.queueMeta}>
                    of {c.available} assumed available
                    {over ? " · high case exceeds availability" : ""}
                  </div>
                </div>
              );
            })}
          </div>
          <table className={s.table} style={{ marginTop: 16 }}>
            <thead>
              <tr>
                <th>Commitment</th>
                <th className={s.num}>Low</th>
                <th className={s.num}>Base</th>
                <th className={s.num}>High</th>
                <th>Weeks</th>
              </tr>
            </thead>
            <tbody>
              {CAPACITY.commitments.map((c) => (
                <tr key={c.label}>
                  <td>{c.label}</td>
                  <td className={s.num}>{c.hours.low}</td>
                  <td className={s.num}>{c.hours.base}</td>
                  <td className={s.num}>{c.hours.high}</td>
                  <td className={s.mono}>
                    {c.weeks
                      .map((on, i) => (on ? CAPACITY.weeks[i].replace("w/c ", "") : null))
                      .filter(Boolean)
                      .join(" · ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}
