import Link from "next/link";
import { notFound } from "next/navigation";
import {
  OUTREACH_SEQUENCE,
  PARK_DAYS,
  PROSPECT_STATUSES,
  STATUS_LABEL,
  TOUCH_CHANNELS,
  loadProspect,
  type ProspectStatus,
} from "@/lib/ops/outreachData";
import s from "../../shell.module.css";
import o from "../../ops.module.css";
import { Notice, first } from "../../sales/ops-ui";
import {
  logTouchFromForm,
  markVerifiedFromForm,
  parkFromForm,
  setNextTouchFromForm,
  setStatusFromForm,
  updateProspectFromForm,
} from "../actions";
import { AgencyTypeOptions, StatusChip, dateInputValue, noticeFor } from "../outreach-ui";

export const dynamic = "force-dynamic";

/** Status buttons offered on the detail page, in the order they are shown. */
const QUICK_STATUSES: ProspectStatus[] = [
  "verified",
  "queued",
  "contacted",
  "replied",
  "call_booked",
  "agreed",
  "declined",
  "unsubscribed",
];

export default async function ProspectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const p = await loadProspect(id);
  if (!p) notFound();
  const notice = noticeFor(first(sp.notice));
  const hidden = <input type="hidden" name="id" value={p.id} />;

  return (
    <>
      <p className={s.mono}>
        <Link href="/admin/outreach">Outreach</Link> / {p.company}
      </p>
      <div className={s.pageHead}>
        <div>
          <h1 className={s.h1}>{p.company}</h1>
          <p className={s.lead}>
            {p.agencyTypeLabel}
            {p.country ? ` · ${p.country}` : ""}
            {p.region ? ` (${p.region})` : ""} · <StatusChip status={p.status} /> · owner{" "}
            <span className={p.owner === "Unassigned" ? s.faint : ""}>{p.owner}</span> ·{" "}
            {p.sequence}
            {p.verifiedAt ? ` · verified ${p.verifiedAt}` : " · not verified"}
          </p>
        </div>
        <Link href="/admin/outreach?tab=board" className={s.btn}>
          Back to board
        </Link>
      </div>

      {notice ? (
        <div style={{ marginBottom: 16 }}>
          <Notice tone={notice.tone}>{notice.text}</Notice>
        </div>
      ) : null}

      <div className={o.drawer}>
        <div className={s.card}>
          {/* ── Log a touch ─────────────────────────────── */}
          <div className={o.section}>
            <p className={o.sectionTitle}>Log a touch</p>
            {p.nextStep ? (
              <p className={s.queueMeta} style={{ marginTop: 0 }}>
                Suggested next: <strong>{p.nextStep.label}</strong> ({p.nextStep.channel},
                day {p.nextStep.day} of the sequence)
                {p.nextTouchAt ? ` · due ${p.nextTouchAt}` : ""}.
              </p>
            ) : p.status === "replied" || p.status === "call_booked" ? (
              <p className={s.queueMeta} style={{ marginTop: 0 }}>
                In conversation — log replies and what we send; the sequence no longer
                applies.
              </p>
            ) : null}
            <form action={logTouchFromForm}>
              <input type="hidden" name="prospect_id" value={p.id} />
              <div className={s.grid12}>
                <div className={s.span4}>
                  <label className={s.field}>
                    <span className={s.fieldLabel}>Channel</span>
                    <select
                      name="channel"
                      className={s.search}
                      style={{ maxWidth: "none" }}
                      defaultValue={p.nextStep?.channel ?? "email"}
                    >
                      {TOUCH_CHANNELS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className={s.span4}>
                  <label className={s.field}>
                    <span className={s.fieldLabel}>Direction</span>
                    <select
                      name="direction"
                      className={s.search}
                      style={{ maxWidth: "none" }}
                    >
                      <option value="outbound">outbound (we sent)</option>
                      <option value="inbound">inbound (they replied)</option>
                    </select>
                  </label>
                </div>
                <div className={s.span4}>
                  <label className={s.field}>
                    <span className={s.fieldLabel}>Sent at</span>
                    <input
                      type="date"
                      name="sent_at"
                      className={s.search}
                      style={{ maxWidth: "none" }}
                      aria-label="Sent at (defaults to now)"
                    />
                  </label>
                </div>
              </div>
              <label className={s.field}>
                <span className={s.fieldLabel}>Subject</span>
                <input name="subject" className={s.search} style={{ maxWidth: "none" }} />
              </label>
              <label className={s.field}>
                <span className={s.fieldLabel}>Body / summary</span>
                <textarea
                  name="body"
                  rows={4}
                  className={s.search}
                  style={{ maxWidth: "none", height: "auto", padding: 10 }}
                />
              </label>
              <div className={s.chips}>
                <input
                  name="outcome"
                  className={s.search}
                  style={{ maxWidth: 260 }}
                  placeholder="Outcome (no reply, interested, bounced…)"
                  aria-label="Outcome"
                />
                <button type="submit" className={s.btnPrimary}>
                  Log touch
                </button>
              </div>
            </form>
          </div>

          {/* ── Timeline ────────────────────────────────── */}
          <div className={o.section}>
            <p className={o.sectionTitle}>Timeline · {p.touches.length}</p>
            {p.touches.length === 0 ? (
              <p className={s.faint} style={{ margin: 0 }}>
                No touches yet.
              </p>
            ) : (
              <ul className={o.timeline}>
                {p.touches.map((t) => (
                  <li key={t.id}>
                    <span className={s.mono}>{t.sentAt}</span>
                    <span>
                      <span
                        className={`${s.chip} ${t.direction === "inbound" ? s.chipSuccess : t.channel === "note" ? "" : s.chipInfo}`}
                      >
                        {t.direction} {t.channel}
                      </span>
                      {t.subject ? <strong> {t.subject}</strong> : null}
                      {t.outcome ? <span className={s.mono}> · {t.outcome}</span> : null}
                      {t.body ? (
                        <div className={s.queueMeta} style={{ whiteSpace: "pre-wrap" }}>
                          {t.body}
                        </div>
                      ) : null}
                      {t.createdBy ? (
                        <div className={s.mono}>by {t.createdBy}</div>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ── Edit ────────────────────────────────────── */}
          <div className={o.section}>
            <p className={o.sectionTitle}>Details</p>
            <form action={updateProspectFromForm}>
              {hidden}
              <div className={s.grid12}>
                <div className={s.span6}>
                  <F label="Company" name="company" value={p.company} required />
                </div>
                <div className={s.span6}>
                  <F label="Website" name="website" value={p.website} />
                </div>
                <div className={s.span4}>
                  <F label="Country" name="country" value={p.country} />
                </div>
                <div className={s.span4}>
                  <F label="Region / city" name="region" value={p.region} />
                </div>
                <div className={s.span4}>
                  <F label="Staff band" name="staff_band" value={p.staffBand} />
                </div>
                <div className={s.span6}>
                  <label className={s.field}>
                    <span className={s.fieldLabel}>Agency type</span>
                    <select
                      name="agency_type"
                      className={s.search}
                      style={{ maxWidth: "none" }}
                      defaultValue={p.agencyType ?? ""}
                    >
                      <AgencyTypeOptions />
                    </select>
                  </label>
                </div>
                <div className={s.span6}>
                  <F
                    label="Owner"
                    name="owner"
                    value={p.owner === "Unassigned" ? "" : p.owner}
                  />
                </div>
                <div className={s.span6}>
                  <F label="Contact name" name="contact_name" value={p.contactName} />
                </div>
                <div className={s.span6}>
                  <F label="Role" name="contact_role" value={p.contactRole} />
                </div>
                <div className={s.span6}>
                  <F label="Email" name="email" type="email" value={p.email} />
                </div>
                <div className={s.span6}>
                  <F label="Phone" name="phone" value={p.phone} />
                </div>
                <div className={s.span6}>
                  <F label="LinkedIn URL" name="linkedin_url" value={p.linkedinUrl} />
                </div>
                <div className={s.span6}>
                  <F
                    label="Instagram handle"
                    name="instagram_handle"
                    value={p.instagramHandle}
                  />
                </div>
                <div className={s.span6}>
                  <F label="Source" name="source" value={p.source} />
                </div>
                <div className={s.span6}>
                  <F
                    label="Tags (comma separated)"
                    name="tags"
                    value={p.tags.join(", ")}
                  />
                </div>
              </div>
              <label className={s.field}>
                <span className={s.fieldLabel}>Fit notes</span>
                <textarea
                  name="fit_notes"
                  rows={4}
                  className={s.search}
                  style={{ maxWidth: "none", height: "auto", padding: 10 }}
                  defaultValue={p.fitNotes ?? ""}
                />
              </label>
              <button type="submit" className={s.btn}>
                Save details
              </button>
            </form>
          </div>
        </div>

        <aside className={o.aside} aria-label="Status and scheduling">
          <section className={s.card}>
            <p className={o.sectionTitle}>Next touch</p>
            <p style={{ margin: "0 0 4px", fontWeight: 600 }}>
              {p.nextTouchAt ? (
                <span className={p.due ? s.danger : ""}>
                  {p.nextTouchAt}
                  {p.due ? " · due" : ""}
                  {p.overdueDays > 0 ? ` (${p.overdueDays}d overdue)` : ""}
                </span>
              ) : (
                <span className={s.faint}>Not scheduled</span>
              )}
            </p>
            <p className={s.mono} style={{ margin: "0 0 12px" }}>
              {p.nextStep
                ? p.nextStep.label
                : p.status === "parked"
                  ? `parked until ${p.parkedUntil ?? "—"}`
                  : p.sequence}
            </p>
            <form action={setNextTouchFromForm} className={s.chips}>
              {hidden}
              <input
                type="date"
                name="next_touch_at"
                className={s.search}
                style={{ maxWidth: 170 }}
                defaultValue={dateInputValue(p.nextTouchIso)}
                aria-label="Next touch date"
              />
              <button type="submit" className={`${s.btn} ${s.btnSmall}`}>
                Set date
              </button>
            </form>
            <p className={s.queueMeta}>
              Sequence:{" "}
              {OUTREACH_SEQUENCE.map((st) => `day ${st.day} ${st.channel}`).join(" → ")}.
              Logging an outbound touch moves the date automatically.
            </p>
          </section>

          <section className={s.card}>
            <p className={o.sectionTitle}>Status</p>
            <div className={s.chips}>
              {!p.verifiedAt ? (
                <form action={markVerifiedFromForm}>
                  {hidden}
                  <button type="submit" className={`${s.btnPrimary} ${s.btnSmall}`}>
                    Mark verified
                  </button>
                </form>
              ) : null}
              {QUICK_STATUSES.filter((st) => st !== p.status).map((st) => (
                <form key={st} action={setStatusFromForm}>
                  {hidden}
                  <input type="hidden" name="status" value={st} />
                  <button
                    type="submit"
                    className={`${s.btn} ${s.btnSmall}`}
                    title={
                      st === "queued"
                        ? "Start the sequence: step 1 due now"
                        : `Set status to ${STATUS_LABEL[st]}`
                    }
                  >
                    {STATUS_LABEL[st]}
                  </button>
                </form>
              ))}
            </div>
            <p className={s.queueMeta}>
              {PROSPECT_STATUSES.map((st) => STATUS_LABEL[st]).join(" → ")}. Agreed,
              declined and unsubscribed clear the next touch.
            </p>
          </section>

          <section className={s.card}>
            <p className={o.sectionTitle}>Park</p>
            <form action={parkFromForm} className={s.chips}>
              {hidden}
              <input
                type="number"
                name="days"
                min={1}
                max={365}
                defaultValue={PARK_DAYS}
                className={s.search}
                style={{ maxWidth: 90 }}
                aria-label="Days to park"
              />
              <button type="submit" className={`${s.btn} ${s.btnSmall}`}>
                Park
              </button>
            </form>
            <p className={s.queueMeta}>
              {p.status === "parked"
                ? `Parked until ${p.parkedUntil ?? "—"}; it returns to Due today then.`
                : `Sets status to parked and the next touch ${PARK_DAYS} days out (or the number given).`}
            </p>
          </section>

          <section className={s.card}>
            <p className={o.sectionTitle}>Record</p>
            <dl className={s.kv}>
              <dt>Created</dt>
              <dd>{p.createdAt}</dd>
              <dt>Updated</dt>
              <dd>{p.updatedAt}</dd>
              <dt>Verified</dt>
              <dd>
                {p.verifiedAt
                  ? `${p.verifiedAt}${p.verifiedBy ? ` by ${p.verifiedBy}` : ""}`
                  : "no"}
              </dd>
              <dt>Outbound sent</dt>
              <dd>{p.outboundCount}</dd>
              {p.website ? (
                <>
                  <dt>Website</dt>
                  <dd>
                    <a
                      href={p.website}
                      target="_blank"
                      rel="noreferrer"
                      className={s.rowLink}
                    >
                      {p.website.replace(/^https?:\/\/(www\.)?/, "")}
                    </a>
                  </dd>
                </>
              ) : null}
              {p.linkedinUrl ? (
                <>
                  <dt>LinkedIn</dt>
                  <dd>
                    <a
                      href={p.linkedinUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={s.rowLink}
                    >
                      profile
                    </a>
                  </dd>
                </>
              ) : null}
              {p.instagramHandle ? (
                <>
                  <dt>Instagram</dt>
                  <dd>@{p.instagramHandle}</dd>
                </>
              ) : null}
              {p.tags.length ? (
                <>
                  <dt>Tags</dt>
                  <dd>
                    <span className={s.chips}>
                      {p.tags.map((t) => (
                        <span key={t} className={s.chip}>
                          {t}
                        </span>
                      ))}
                    </span>
                  </dd>
                </>
              ) : null}
            </dl>
          </section>
        </aside>
      </div>
    </>
  );
}

function F({
  label,
  name,
  value,
  type = "text",
  required,
}: {
  label: string;
  name: string;
  value: string | null | undefined;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className={s.field}>
      <span className={s.fieldLabel}>{label}</span>
      <input
        className={s.search}
        style={{ maxWidth: "none" }}
        type={type}
        name={name}
        defaultValue={value ?? ""}
        required={required}
      />
    </label>
  );
}
