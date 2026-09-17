import Link from "next/link";
import { loadPortalDelivery } from "@/lib/delivery/load";
import { recordBuildAcceptanceForm } from "@/lib/delivery/actions";
import { acceptanceOutcome, OUTCOME_LABEL } from "@/lib/delivery";
import type { BuildAcceptance } from "@/lib/delivery";
import s from "@/lib/delivery/portal.module.css";

/**
 * Client portal — build acceptance (brief §5.5, §8.2, §17.1 row 2). The
 * signatory reviews each deliverable against its acceptance criterion, records
 * evidence and comments, lists outstanding defects, and accepts — cleanly,
 * with exceptions, or disputes. Accepting never chooses a package, marks an
 * invoice paid or signs anything; the managed package (if any) is a separate
 * later step. Read-only unless `acceptanceGate` is on.
 */
export const dynamic = "force-dynamic";

const dateGB = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

function outcomeClass(a: BuildAcceptance): string {
  const o = acceptanceOutcome(a);
  return o === "accepted"
    ? s.chipSuccess
    : o === "disputed"
      ? s.chipDanger
      : s.chipWarning;
}

function AcceptanceRecord({ a }: { a: BuildAcceptance }) {
  const met = a.evidence.filter((d) => d.met).length;
  return (
    <li className={s.task}>
      <div className={s.taskHead}>
        <p className={s.taskLabel}>{dateGB(a.accepted_at)}</p>
        <span className={outcomeClass(a)}>{OUTCOME_LABEL[acceptanceOutcome(a)]}</span>
      </div>
      <div className={s.taskMeta}>
        <span>
          {a.accepted_role === "staff"
            ? `Recorded by Nullshift (${a.method.replace("_", " ")})`
            : a.accepted_by_name}
        </span>
        <span>
          {met} of {a.evidence.length} deliverables met
        </span>
        <span>
          Against{" "}
          {a.scope_version_ref
            .replace("order_form:", "Order Form ")
            .replace(/^proposal:.*$/, "accepted proposal")}
        </span>
      </div>
      {a.defects_outstanding.length > 0 && (
        <ul className={s.evidence}>
          {a.defects_outstanding.map((d) => (
            <li key={d.ref}>
              {d.ref}: {d.summary}
            </li>
          ))}
        </ul>
      )}
      {a.notes && <p className={`${s.small} ${s.muted}`}>{a.notes}</p>}
    </li>
  );
}

const RESULT_COPY: Record<string, { tone: string; text: string }> = {
  accepted: {
    tone: "success",
    text: "Build accepted. This did not choose a package, mark a payment or sign anything.",
  },
  accepted_with_exceptions: {
    tone: "success",
    text: "Build accepted with the exceptions you listed. They stay open until resolved.",
  },
  disputed: {
    tone: "warning",
    text: "Your dispute is recorded. Nullshift will respond with the next step.",
  },
  preview: { tone: "warning", text: "Staff preview is read-only; nothing was recorded." },
  flag_off: {
    tone: "warning",
    text: "Acceptance recording is not enabled for your portal yet; nothing was recorded.",
  },
};

export default async function AcceptancePage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string; why?: string }>;
}) {
  const [{ result, why }, d] = await Promise.all([searchParams, loadPortalDelivery()]);
  const project = d.facts.project;
  const scope = d.facts.scope;
  const clean = d.governing && !d.governing.partial ? d.governing : null;
  const canAccept = d.flag && !d.preview && d.isSignatory && !!scope && !clean;

  if (!project) {
    return (
      <div className={s.root}>
        <p className={s.eyebrow}>Build acceptance</p>
        <h1 className={s.h1}>Nothing to accept yet</h1>
        <p className={s.lead}>
          Build acceptance opens once your project has an agreed scope and a build to
          review.
        </p>
      </div>
    );
  }

  const notice = result ? RESULT_COPY[result] : null;

  return (
    <div className={s.root}>
      <p className={s.eyebrow}>Build acceptance</p>
      <h1 className={s.h1}>
        {clean ? "Your build is accepted" : "Review and accept your build"}
      </h1>
      <p className={s.lead}>
        You accept against the agreed scope, deliverable by deliverable, with your own
        evidence and comments. Accepting does not choose a managed package, mark an
        invoice paid or sign anything. Warranty follows your agreement, not whether you
        pay for ongoing management.
      </p>

      {notice && (
        <div
          className={`${s.notice} ${notice.tone === "success" ? s.noticeSuccess : s.noticeWarning} ${s.stack}`}
          role="status"
        >
          <p>{notice.text}</p>
        </div>
      )}
      {result && !notice && (
        <div className={`${s.notice} ${s.noticeWarning} ${s.stack}`} role="alert">
          <p>{why ? decodeURIComponent(why) : "That was not recorded."}</p>
        </div>
      )}

      <div className={s.stack}>
        {!scope && (
          <div className={s.notice}>
            <p>
              There is no accepted scope to accept against yet. Once your agreement is
              accepted, its deliverables and acceptance criteria appear here.
            </p>
            <p>
              <Link href="/portal/proposal">Go to your agreement</Link>
            </p>
          </div>
        )}

        {scope && (
          <section className={s.card} aria-labelledby="scope-h">
            <div className={s.cardHead}>
              <h2 id="scope-h" className={s.h2}>
                Agreed scope
              </h2>
              <span className={s.mono}>{scope.label}</span>
            </div>
            <ul className={s.tasks}>
              {scope.deliverables.map((dl, i) => (
                <li key={i} className={s.task}>
                  <p className={s.taskLabel}>{dl.deliverable}</p>
                  <p className={s.criteria}>Acceptance criterion: {dl.criteria}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {d.flag && d.acceptances.length > 0 && (
          <section className={s.card} aria-labelledby="records-h">
            <div className={s.cardHead}>
              <h2 id="records-h" className={s.h2}>
                Acceptance record
              </h2>
            </div>
            <ul className={s.tasks}>
              {d.acceptances.map((a) => (
                <AcceptanceRecord key={a.id ?? a.accepted_at} a={a} />
              ))}
            </ul>
          </section>
        )}

        {!d.flag && scope && (
          <div className={s.notice}>
            <p>
              Acceptance recording is not enabled for your portal yet. When it is, your
              signatory will accept here; until then Nullshift records acceptance from
              your written confirmation.
            </p>
          </div>
        )}
        {d.flag && d.preview && (
          <div className={s.notice}>
            <p>
              Staff preview: read-only. The signatory for the client sees the acceptance
              form here.
            </p>
          </div>
        )}
        {d.flag && !d.preview && scope && !d.isSignatory && !clean && (
          <div className={s.notice}>
            <p>
              Only the signatory for your organisation can accept the build. If that is
              you and this is wrong, reply to any email from Nullshift.
            </p>
          </div>
        )}

        {canAccept && scope && (
          <form
            action={recordBuildAcceptanceForm}
            className={s.card}
            aria-labelledby="form-h"
          >
            <div className={s.cardHead}>
              <h2 id="form-h" className={s.h2}>
                Your review
              </h2>
            </div>
            <input type="hidden" name="tenant_id" value={d.facts.tenant?.id ?? ""} />
            <input type="hidden" name="project_id" value={project.id} />
            <input type="hidden" name="scope_version_ref" value={scope.ref} />
            <input type="hidden" name="d_count" value={scope.deliverables.length} />

            {scope.deliverables.map((dl, i) => (
              <div key={i} className={s.deliverable}>
                <p className={s.taskLabel}>{dl.deliverable}</p>
                <p className={s.criteria}>{dl.criteria}</p>
                <input type="hidden" name={`d_${i}_label`} value={dl.deliverable} />
                <input type="hidden" name={`d_${i}_criteria`} value={dl.criteria} />
                <div
                  className={s.radioRow}
                  role="radiogroup"
                  aria-label={`Is "${dl.deliverable}" as agreed?`}
                >
                  <label>
                    <input type="radio" name={`d_${i}_met`} value="yes" defaultChecked />{" "}
                    Meets the criterion
                  </label>
                  <label>
                    <input type="radio" name={`d_${i}_met`} value="no" /> Does not yet
                  </label>
                </div>
                <div className={s.field}>
                  <label className={s.fieldLabel} htmlFor={`d_${i}_evidence`}>
                    Evidence (what you tested, or a link)
                  </label>
                  <input
                    id={`d_${i}_evidence`}
                    name={`d_${i}_evidence`}
                    className={s.input}
                    maxLength={1000}
                  />
                </div>
                <div className={s.field}>
                  <label className={s.fieldLabel} htmlFor={`d_${i}_comment`}>
                    Your comment (optional)
                  </label>
                  <input
                    id={`d_${i}_comment`}
                    name={`d_${i}_comment`}
                    className={s.input}
                    maxLength={1000}
                  />
                </div>
              </div>
            ))}

            <div className={s.field}>
              <label className={s.fieldLabel} htmlFor="defects">
                Outstanding defects, one per line (optional)
              </label>
              <textarea
                id="defects"
                name="defects"
                className={s.textarea}
                maxLength={4000}
              />
              <p className={`${s.small} ${s.muted}`} style={{ margin: 0 }}>
                Listing a defect, or marking a deliverable as not yet met, records an
                acceptance with exceptions. The exceptions stay open until Nullshift
                resolves them.
              </p>
            </div>

            <div className={s.field}>
              <label className={s.check}>
                <input type="checkbox" name="disputed" /> I dispute this build. Do not
                treat this as acceptance.
              </label>
            </div>

            <div className={s.field}>
              <label className={s.fieldLabel} htmlFor="accepted_by_name">
                Your full name
              </label>
              <input
                id="accepted_by_name"
                name="accepted_by_name"
                className={s.input}
                required
                maxLength={200}
                autoComplete="name"
              />
            </div>

            <div className={s.field}>
              <label className={s.fieldLabel} htmlFor="notes">
                Notes (optional)
              </label>
              <textarea id="notes" name="notes" className={s.textarea} maxLength={2000} />
            </div>

            <div className={s.field}>
              <label className={s.check}>
                <input type="checkbox" name="authorised" required /> I am authorised to
                accept this build on behalf of {d.facts.tenant?.name ?? "my organisation"}
                . I understand this does not select a package, mark any invoice paid or
                sign any agreement.
              </label>
            </div>

            <div className={s.btnRow}>
              <button type="submit" className={s.btnPrimary}>
                Record my review
              </button>
              <Link href="/portal/checklist" className={s.btn}>
                Back to checklist
              </Link>
            </div>
          </form>
        )}

        {clean && (
          <div className={`${s.notice} ${s.noticeSuccess}`}>
            <p>
              Accepted on {dateGB(clean.accepted_at)} against{" "}
              {scope?.label ?? "the agreed scope"}. Your next step is on your checklist.
            </p>
          </div>
        )}

        <nav className={s.links} aria-label="Related">
          <Link href="/portal/checklist">Checklist</Link>
          <Link href="/portal/proposal">Agreement</Link>
          <Link href="/portal">Home</Link>
        </nav>
      </div>
    </div>
  );
}
