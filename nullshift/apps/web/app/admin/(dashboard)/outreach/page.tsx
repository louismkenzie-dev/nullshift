import Link from "next/link";
import {
  OUTREACH_SEQUENCE,
  PARK_DAYS,
  PROSPECT_STATUSES,
  STATUS_LABEL,
  loadApplications,
  loadOutreach,
  matchesSearch,
  type Application,
  type Prospect,
  type ProspectStatus,
} from "@/lib/ops/outreachData";
import s from "../shell.module.css";
import o from "../ops.module.css";
import { Empty, Notice, SubTabs, first } from "../sales/ops-ui";
import { ApplicationStatusChip, StatusChip, noticeFor } from "./outreach-ui";

export const dynamic = "force-dynamic";

export default async function OutreachPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const tab = first(sp.tab) ?? "due";
  const q = (first(sp.q) ?? "").trim();
  const notice = noticeFor(first(sp.notice));
  const detail = first(sp.detail);
  const [data, apps] = await Promise.all([loadOutreach(), loadApplications()]);

  const filtered = q ? data.prospects.filter((p) => matchesSearch(p, q)) : data.prospects;
  const due = q ? data.dueToday.filter((p) => matchesSearch(p, q)) : data.dueToday;

  const TABS = [
    { id: "due", label: "Due today", count: data.dueToday.length },
    { id: "board", label: "Pipeline", count: data.open },
    { id: "all", label: "All", count: data.prospects.length },
    {
      id: "applications",
      label: "Applications",
      count: apps.counts.new + apps.counts.reviewing,
    },
  ];
  const applications = q
    ? apps.applications.filter((a) => matchesApplication(a, q))
    : apps.applications;

  return (
    <>
      <div className={s.pageHead}>
        <div>
          <p className={s.mono}>Partner outreach · {data.freshness}</p>
          <h1 className={s.h1}>Outreach</h1>
          <p className={s.lead}>
            Agencies we want as referral or white-label partners. Sequence:{" "}
            {OUTREACH_SEQUENCE.map((st) => `day ${st.day} ${st.channel}`).join(" → ")}; no
            reply after the last email parks the prospect for {PARK_DAYS} days. No cold
            calling. Outreach records are never a client or billing identity.
          </p>
        </div>
        <div className={s.chips}>
          <Link href="/admin/outreach/import" className={s.btn}>
            Import CSV
          </Link>
          <Link href="/admin/outreach/new" className={s.btnPrimary}>
            New prospect
          </Link>
        </div>
      </div>

      {notice ? (
        <div style={{ marginBottom: 16 }}>
          <Notice tone={notice.tone}>
            {notice.text}
            {detail ? (
              <pre
                className={s.mono}
                style={{ margin: "8px 0 0", whiteSpace: "pre-wrap" }}
              >
                {detail}
              </pre>
            ) : null}
          </Notice>
        </div>
      ) : null}

      {!data.available ? (
        <div style={{ marginBottom: 16 }}>
          <Notice tone="warning">
            Migration 0068 (partner_prospects / partner_touches) is not applied yet.
            Nothing can be read or written until it is.
          </Notice>
        </div>
      ) : null}

      <div className={s.cardTitle} style={{ marginBottom: 12 }}>
        <SubTabs base="/admin/outreach" current={tab} tabs={TABS} keep={{ q }} />
        <form method="get" action="/admin/outreach" className={s.chips} role="search">
          <input type="hidden" name="tab" value={tab} />
          <input
            className={s.search}
            name="q"
            defaultValue={q}
            placeholder="Search company, contact, email, country, type…"
            aria-label="Search prospects"
          />
          <button type="submit" className={`${s.btn} ${s.btnSmall}`}>
            Search
          </button>
          {q ? (
            <Link
              href={`/admin/outreach?tab=${tab}`}
              className={`${s.btn} ${s.btnSmall}`}
            >
              Clear
            </Link>
          ) : null}
        </form>
      </div>

      {tab === "due" ? <DueToday items={due} q={q} /> : null}
      {tab === "board" ? <Board items={filtered} counts={data.counts} /> : null}
      {tab === "all" ? <AllList items={filtered} q={q} /> : null}
      {tab === "applications" ? (
        <Applications
          items={applications}
          q={q}
          available={apps.available}
          note={apps.note}
        />
      ) : null}
    </>
  );
}

/* ── Rows ─────────────────────────────────────────────── */

function ProspectCells({ p }: { p: Prospect }) {
  return (
    <>
      <td>
        <Link href={`/admin/outreach/${p.id}`} className={s.rowLink}>
          {p.company}
        </Link>
        <div className={s.mono}>
          {p.website ? p.website.replace(/^https?:\/\/(www\.)?/, "") : "no website"}
          {p.verifiedAt ? " · verified" : ""}
        </div>
      </td>
      <td>{p.agencyTypeLabel}</td>
      <td>
        {p.country ?? <span className={s.faint}>—</span>}
        {p.region ? <div className={s.mono}>{p.region}</div> : null}
      </td>
      <td>
        {p.contactName ?? <span className={s.faint}>no contact</span>}
        <div className={s.mono}>{p.contactRole ?? p.email ?? ""}</div>
      </td>
      <td>
        <StatusChip status={p.status} />
      </td>
      <td>
        {p.nextTouchAt ? (
          <>
            <span className={p.due ? s.danger : ""}>{p.nextTouchAt}</span>
            <div className={s.mono}>
              {p.nextStep
                ? p.nextStep.label
                : p.status === "parked"
                  ? "parked"
                  : p.sequence}
              {p.overdueDays > 0 ? ` · ${p.overdueDays}d overdue` : ""}
            </div>
          </>
        ) : (
          <span className={s.faint}>—</span>
        )}
      </td>
      <td>
        {p.lastTouch ? (
          <>
            {p.lastTouch.sentAt}
            <div className={s.mono}>
              {p.lastTouch.direction} {p.lastTouch.channel}
            </div>
          </>
        ) : (
          <span className={s.faint}>never</span>
        )}
      </td>
    </>
  );
}

function ProspectTable({ items }: { items: Prospect[] }) {
  return (
    <div className={s.card} style={{ padding: 0 }}>
      <table className={s.table}>
        <thead>
          <tr>
            <th>Company</th>
            <th>Type</th>
            <th>Country</th>
            <th>Contact</th>
            <th>Status</th>
            <th>Next touch</th>
            <th>Last touch</th>
          </tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.id}>
              <ProspectCells p={p} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Due today ────────────────────────────────────────── */

function DueToday({ items, q }: { items: Prospect[]; q: string }) {
  if (items.length === 0)
    return (
      <Empty
        title={q ? "Nothing due matches that search" : "Nothing due today"}
        body="Prospects appear here when their next touch date has arrived. Queue a verified prospect to start its sequence."
      />
    );
  const overdue = items.filter((p) => p.overdueDays > 0).length;
  return (
    <>
      <div className={s.grid12} style={{ marginBottom: 24 }}>
        <div className={`${s.card} ${s.span4}`}>
          <span className={s.mono}>Due</span>
          <div className={s.metricValue}>{items.length}</div>
          <div className={s.metricNote}>{overdue} overdue · most overdue first</div>
        </div>
        <div className={`${s.card} ${s.span4}`}>
          <span className={s.mono}>Emails to send</span>
          <div className={s.metricValue}>
            {items.filter((p) => p.nextStep?.channel === "email").length}
          </div>
          <div className={s.metricNote}>Sequence steps on the email channel</div>
        </div>
        <div className={`${s.card} ${s.span4}`}>
          <span className={s.mono}>Replies to answer</span>
          <div className={s.metricValue}>
            {
              items.filter((p) => p.status === "replied" || p.status === "call_booked")
                .length
            }
          </div>
          <div className={s.metricNote}>Conversations waiting on us</div>
        </div>
      </div>
      <ProspectTable items={items} />
    </>
  );
}

/* ── Board ────────────────────────────────────────────── */

function Board({
  items,
  counts,
}: {
  items: Prospect[];
  counts: Record<ProspectStatus, number>;
}) {
  const byStatus = (st: ProspectStatus) => items.filter((p) => p.status === st);
  return (
    <>
      <div className={s.chips} style={{ marginBottom: 16 }} aria-label="Pipeline counts">
        {PROSPECT_STATUSES.map((st) => (
          <span key={st} className={s.chip}>
            {STATUS_LABEL[st]} · {counts[st]}
          </span>
        ))}
      </div>
      <div className={o.board} aria-label="Outreach board">
        {PROSPECT_STATUSES.map((st) => {
          const col = byStatus(st);
          return (
            <section key={st} className={o.column} aria-label={STATUS_LABEL[st]}>
              <div className={o.columnHead}>
                <span className={s.mono}>{STATUS_LABEL[st]}</span>
                <span className={s.faint}>{col.length}</span>
              </div>
              <div className={o.columnBody}>
                {col.length === 0 ? (
                  <div className={o.columnEmpty}>Nothing here</div>
                ) : (
                  col.slice(0, 50).map((p) => (
                    <Link
                      key={p.id}
                      href={`/admin/outreach/${p.id}`}
                      className={o.oppCard}
                    >
                      <div className={o.oppCompany}>{p.company}</div>
                      <div>
                        {p.agencyTypeLabel}
                        {p.country ? ` · ${p.country}` : ""}
                      </div>
                      <div className={o.oppMeta}>
                        {p.contactName ?? <span className={s.faint}>no contact</span>}
                        {p.contactRole ? ` · ${p.contactRole}` : ""}
                      </div>
                      <div className={o.oppMeta}>
                        {p.nextTouchAt
                          ? `next ${p.nextTouchAt}${p.due ? " (due)" : ""}`
                          : "no next touch"}
                        {" · "}
                        {p.sequence}
                      </div>
                    </Link>
                  ))
                )}
                {col.length > 50 ? (
                  <div className={o.columnEmpty}>+{col.length - 50} more · use All</div>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}

/* ── All ──────────────────────────────────────────────── */

function AllList({ items, q }: { items: Prospect[]; q: string }) {
  if (items.length === 0)
    return (
      <Empty
        title={q ? "No prospects match that search" : "No prospects yet"}
        body="Add one with New prospect or paste a list with Import CSV."
      />
    );
  return <ProspectTable items={items} />;
}

/* ── Applications (public /partners form, migration 0069) ─ */

function matchesApplication(a: Application, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return [
    a.agency,
    a.country,
    a.contactName,
    a.role,
    a.email,
    a.agencyTypeLabel,
    a.modelInterestLabel,
    a.website,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(needle);
}

function Applications({
  items,
  q,
  available,
  note,
}: {
  items: Application[];
  q: string;
  available: boolean;
  note: string;
}) {
  if (!available)
    return (
      <Notice tone="warning">
        Migration 0069 (partner_applications) is not applied yet: {note}.
      </Notice>
    );
  if (items.length === 0)
    return (
      <Empty
        title={q ? "No applications match that search" : "No applications yet"}
        body="Agencies that apply through the public /partners form appear here, newest first."
      />
    );
  return (
    <div className={s.card} style={{ padding: 0 }}>
      <table className={s.table}>
        <thead>
          <tr>
            <th>Agency</th>
            <th>Country</th>
            <th>Contact</th>
            <th>Model interest</th>
            <th>Submitted</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((a) => (
            <tr key={a.id}>
              <td>
                <Link href={`/admin/outreach/applications/${a.id}`} className={s.rowLink}>
                  {a.agency}
                </Link>
                <div className={s.mono}>
                  {a.agencyTypeLabel} · {a.teamSize}
                  {a.prospectId ? " · converted" : ""}
                </div>
              </td>
              <td>{a.country}</td>
              <td>
                {a.contactName}
                <div className={s.mono}>{a.role ?? a.email}</div>
              </td>
              <td>{a.modelInterestLabel}</td>
              <td className={s.muted}>{a.submittedAt}</td>
              <td>
                <ApplicationStatusChip status={a.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
