import Link from "next/link";
import { notFound } from "next/navigation";
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABEL,
  loadApplication,
} from "@/lib/ops/outreachData";
import s from "../../../shell.module.css";
import o from "../../../ops.module.css";
import { Notice, first } from "../../../sales/ops-ui";
import {
  convertApplicationFromForm,
  markApplicationReviewedFromForm,
  setApplicationNotesFromForm,
  setApplicationStatusFromForm,
} from "../../actions";
import { ApplicationStatusChip, noticeFor } from "../../outreach-ui";

export const dynamic = "force-dynamic";

export default async function ApplicationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const a = await loadApplication(id);
  if (!a) notFound();
  const notice = noticeFor(first(sp.notice));
  const hidden = <input type="hidden" name="id" value={a.id} />;

  return (
    <>
      <p className={s.mono}>
        <Link href="/admin/outreach?tab=applications">Outreach</Link> / Applications /{" "}
        {a.agency}
      </p>
      <div className={s.pageHead}>
        <div>
          <h1 className={s.h1}>{a.agency}</h1>
          <p className={s.lead}>
            {a.agencyTypeLabel} · {a.country} · team {a.teamSize} ·{" "}
            <ApplicationStatusChip status={a.status} /> · {a.modelInterestLabel} ·
            submitted {a.submittedAt}
            {a.reviewedAt ? ` · reviewed ${a.reviewedAt}` : " · not reviewed"}
          </p>
        </div>
        <Link href="/admin/outreach?tab=applications" className={s.btn}>
          Back to applications
        </Link>
      </div>

      {notice ? (
        <div style={{ marginBottom: 16 }}>
          <Notice tone={notice.tone}>{notice.text}</Notice>
        </div>
      ) : null}

      <div className={o.drawer}>
        <div className={s.card}>
          <div className={o.section}>
            <p className={o.sectionTitle}>Contact</p>
            <dl className={s.kv}>
              <dt>Name</dt>
              <dd>{a.contactName}</dd>
              <dt>Role</dt>
              <dd>{a.role ?? <span className={s.faint}>not given</span>}</dd>
              <dt>Email</dt>
              <dd>
                <a href={`mailto:${a.email}`} className={s.rowLink}>
                  {a.email}
                </a>
              </dd>
              <dt>Website</dt>
              <dd>
                {a.website ? (
                  <a
                    href={a.website}
                    target="_blank"
                    rel="noreferrer"
                    className={s.rowLink}
                  >
                    {a.website.replace(/^https?:\/\/(www\.)?/, "")}
                  </a>
                ) : (
                  <span className={s.faint}>not given</span>
                )}
              </dd>
            </dl>
          </div>

          <div className={o.section}>
            <p className={o.sectionTitle}>What they told us</p>
            <dl className={s.kv}>
              <dt>Model interest</dt>
              <dd>{a.modelInterestLabel}</dd>
              <dt>Agency type</dt>
              <dd>{a.agencyTypeLabel}</dd>
              <dt>Team size</dt>
              <dd>{a.teamSize}</dd>
              <dt>Client types</dt>
              <dd>{a.clientTypes ?? <span className={s.faint}>not given</span>}</dd>
            </dl>
            <p className={o.sectionTitle} style={{ marginTop: 12 }}>
              Message
            </p>
            {a.message ? (
              <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{a.message}</p>
            ) : (
              <p className={s.faint} style={{ margin: 0 }}>
                No message.
              </p>
            )}
          </div>

          <div className={o.section}>
            <p className={o.sectionTitle}>Triage notes</p>
            <form action={setApplicationNotesFromForm}>
              {hidden}
              <textarea
                name="notes"
                rows={5}
                className={s.search}
                style={{ maxWidth: "none", height: "auto", padding: 10 }}
                defaultValue={a.notes ?? ""}
                placeholder="Fit, concerns, what we replied…"
                aria-label="Triage notes"
              />
              <div className={s.chips} style={{ marginTop: 8 }}>
                <button type="submit" className={s.btn}>
                  Save notes
                </button>
              </div>
            </form>
          </div>
        </div>

        <aside className={o.aside} aria-label="Decision">
          <section className={s.card}>
            <p className={o.sectionTitle}>Convert to prospect</p>
            {a.prospectId ? (
              <>
                <p style={{ margin: "0 0 8px" }}>
                  Linked to{" "}
                  <Link href={`/admin/outreach/${a.prospectId}`} className={s.rowLink}>
                    {a.prospectCompany ?? "prospect"}
                  </Link>{" "}
                  in the pipeline.
                </p>
                <Link
                  href={`/admin/outreach/${a.prospectId}`}
                  className={`${s.btnPrimary} ${s.btnSmall}`}
                >
                  Open prospect
                </Link>
              </>
            ) : (
              <form action={convertApplicationFromForm}>
                {hidden}
                <button type="submit" className={s.btnPrimary}>
                  Convert to prospect
                </button>
                <p className={s.queueMeta}>
                  Creates a pipeline row at <em>replied</em> with a follow-up due
                  tomorrow, logs this application as an inbound note, and links the two.
                  If a prospect with this email already exists it is reused.
                </p>
              </form>
            )}
          </section>

          <section className={s.card}>
            <p className={o.sectionTitle}>Status</p>
            <div className={s.chips}>
              {!a.reviewedAt ? (
                <form action={markApplicationReviewedFromForm}>
                  {hidden}
                  <button type="submit" className={`${s.btnPrimary} ${s.btnSmall}`}>
                    Mark reviewed
                  </button>
                </form>
              ) : null}
              {APPLICATION_STATUSES.filter((st) => st !== a.status).map((st) => (
                <form key={st} action={setApplicationStatusFromForm}>
                  {hidden}
                  <input type="hidden" name="status" value={st} />
                  <button type="submit" className={`${s.btn} ${s.btnSmall}`}>
                    {APPLICATION_STATUS_LABEL[st]}
                  </button>
                </form>
              ))}
            </div>
            <p className={s.queueMeta}>
              New → Reviewing → Accepted / Declined / Archived. Accepting here records the
              decision only; the partner agreement is set up separately.
            </p>
          </section>

          <section className={s.card}>
            <p className={o.sectionTitle}>Record</p>
            <dl className={s.kv}>
              <dt>Submitted</dt>
              <dd>{a.submittedAt}</dd>
              <dt>Reviewed</dt>
              <dd>{a.reviewedAt ?? "no"}</dd>
              <dt>Id</dt>
              <dd className={s.mono}>{a.id.slice(0, 8)}</dd>
            </dl>
          </section>
        </aside>
      </div>
    </>
  );
}
