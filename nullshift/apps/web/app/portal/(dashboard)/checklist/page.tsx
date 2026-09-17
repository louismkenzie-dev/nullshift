import Link from "next/link";
import { loadPortalDelivery } from "@/lib/delivery/load";
import { updateChecklistTaskForm } from "@/lib/delivery/actions";
import {
  clientTransition,
  completion,
  isDone,
  nextStep,
  STATE_LABEL,
} from "@/lib/delivery";
import type { ChecklistTask, TaskState } from "@/lib/delivery";
import s from "@/lib/delivery/portal.module.css";

/**
 * Client portal — your checklist (brief §5.10, §8.6). The initial journey
 * (company details → agreement → initial payment → assets → kickoff) and the
 * later journey (build acceptance → managed package OR independent handover →
 * activation / transfer). Every item says why it is required and who owns it.
 *
 * Read-only unless `acceptanceGate` is on: with the flag off the list is
 * derived from the project records the portal already shows; with it on the
 * persisted tasks are read and the client may move their own items.
 */
export const dynamic = "force-dynamic";

const dateGB = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

function stateClass(state: TaskState): string {
  switch (state) {
    case "complete":
      return s.chipSuccess;
    case "in_progress":
    case "awaiting_client":
      return s.chipInfo;
    case "blocked":
      return s.chipWarning;
    case "waived":
    case "not_applicable":
      return s.chip;
    default:
      return s.chip;
  }
}

function TaskRow({ task, canEdit }: { task: ChecklistTask; canEdit: boolean }) {
  const editable = canEdit && !!task.id && clientTransition(task, "in_progress").ok;
  const due = dateGB(task.due_at);
  return (
    <li className={s.task}>
      <div className={s.taskHead}>
        <p className={s.taskLabel}>{task.label}</p>
        <span className={stateClass(task.state)}>{STATE_LABEL[task.state]}</span>
      </div>
      <p className={s.taskWhy}>{task.why}</p>
      <div className={s.taskMeta}>
        <span>{task.owner_kind === "client" ? "You" : "Nullshift"}</span>
        <span>Required by: {task.requirement_source}</span>
        {due && <span>Due {due}</span>}
        {task.completed_at && <span>Completed {dateGB(task.completed_at)}</span>}
      </div>
      {task.state === "waived" && (
        <p className={`${s.small} ${s.muted}`}>
          Waived: {task.waiver_reason ?? "reason recorded"}. A waiver is a recorded
          decision, not evidence that this was done; it does not mark anything paid or
          signed.
        </p>
      )}
      {task.evidence.length > 0 && (
        <ul className={s.evidence}>
          {task.evidence.map((e, i) => (
            <li key={i}>
              {e.note ?? e.ref ?? e.kind}
              {e.at ? ` (${dateGB(e.at)})` : ""}
            </li>
          ))}
        </ul>
      )}
      {editable && (
        <form action={updateChecklistTaskForm} className={s.field}>
          <input type="hidden" name="task_id" value={task.id} />
          <label className={s.fieldLabel} htmlFor={`note-${task.id}`}>
            Add a note or link as evidence
          </label>
          <input
            id={`note-${task.id}`}
            name="note"
            className={s.input}
            maxLength={1000}
            placeholder="What you did, or where to find it"
          />
          <div className={s.btnRow}>
            {task.state !== "in_progress" && (
              <button type="submit" name="state" value="in_progress" className={s.btn}>
                Mark in progress
              </button>
            )}
            {!isDone(task) && (
              <button
                type="submit"
                name="state"
                value="complete"
                className={s.btnPrimary}
              >
                Mark complete
              </button>
            )}
            {isDone(task) && (
              <button type="submit" name="state" value="in_progress" className={s.btn}>
                Reopen
              </button>
            )}
          </div>
        </form>
      )}
    </li>
  );
}

export default async function ChecklistPage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string; why?: string; key?: string }>;
}) {
  const [{ result, why }, d] = await Promise.all([searchParams, loadPortalDelivery()]);
  const project = d.facts.project;

  if (!project) {
    return (
      <div className={s.root}>
        <p className={s.eyebrow}>Your checklist</p>
        <h1 className={s.h1}>Nothing to do yet</h1>
        <p className={s.lead}>
          Your checklist appears once Nullshift has set up your project. If you were
          expecting one, reply to your welcome email and we will sort it.
        </p>
      </div>
    );
  }

  const initialDone = completion(d.initial).done === completion(d.initial).total;
  const active = initialDone && d.later.length > 0 ? d.later : d.initial;
  const total = completion(active);
  const next = nextStep(active);
  const canEdit = d.flag && d.persisted && !d.preview && !!d.userId;

  return (
    <div className={s.root}>
      <p className={s.eyebrow}>
        {initialDone ? "Next steps" : "Getting your project ready"}
      </p>
      <h1 className={s.h1}>
        {initialDone ? "From review to launch" : "Let's get your project ready"}
      </h1>
      <p className={s.lead}>
        {total.label} on the current list.{" "}
        {next
          ? next.mine
            ? `Your next step: ${next.task.label}.`
            : `Waiting on Nullshift: ${next.task.label}.`
          : "Everything on this list is done."}
      </p>

      {result === "updated" && (
        <div className={`${s.notice} ${s.noticeSuccess} ${s.stack}`} role="status">
          <p>Saved. Your update is recorded with the time it was made.</p>
        </div>
      )}
      {result && result !== "updated" && (
        <div className={`${s.notice} ${s.noticeWarning} ${s.stack}`} role="alert">
          <p>{why ? decodeURIComponent(why) : "That change was not saved."}</p>
        </div>
      )}

      <div className={s.stack}>
        {!d.flag && (
          <div className={s.notice}>
            <p>
              This checklist is derived from your project records and is read-only for
              now. Nothing on it is inferred from silence: an item is complete only when
              its record exists.
            </p>
          </div>
        )}
        {d.flag && !d.persisted && (
          <div className={s.notice}>
            <p>
              Nullshift has not published your checklist yet; this preview is derived from
              your records.
            </p>
          </div>
        )}
        {d.preview && (
          <div className={s.notice}>
            <p>
              Staff preview: read-only. The client sees the same list and can update their
              own items.
            </p>
          </div>
        )}

        {next && (
          <div className={s.next}>
            <p className={s.nextLabel}>
              {next.mine ? "Your next step" : "Waiting on Nullshift"}
            </p>
            <p className={s.h2} style={{ margin: 0 }}>
              {next.task.label}
            </p>
            <p className={`${s.small} ${s.muted}`} style={{ margin: 0 }}>
              {next.task.why}
            </p>
            {next.task.key === "build_acceptance" && next.mine && (
              <div className={s.btnRow}>
                <Link href="/portal/acceptance" className={s.btnPrimary}>
                  Review and accept the build
                </Link>
              </div>
            )}
          </div>
        )}

        <section className={s.card} aria-labelledby="initial-h">
          <div className={s.cardHead}>
            <h2 id="initial-h" className={s.h2}>
              Getting started
            </h2>
            <span className={s.mono}>{completion(d.initial).label}</span>
          </div>
          <ul className={s.tasks}>
            {d.initial.map((t) => (
              <TaskRow key={t.key} task={t} canEdit={canEdit} />
            ))}
          </ul>
        </section>

        <section className={s.card} aria-labelledby="later-h">
          <div className={s.cardHead}>
            <h2 id="later-h" className={s.h2}>
              After the build
            </h2>
            <span className={s.mono}>{completion(d.later).label}</span>
          </div>
          {d.later.length === 0 ? (
            <p className={s.empty}>These steps appear once your build is under way.</p>
          ) : (
            <ul className={s.tasks}>
              {d.later.map((t) => (
                <TaskRow key={t.key} task={t} canEdit={canEdit} />
              ))}
            </ul>
          )}
          <p className={`${s.small} ${s.muted}`} style={{ marginTop: 12 }}>
            {d.facts.route === "managed"
              ? "Your agreement elected the managed route. The package, price and start date are agreed in a separate service schedule after the build is accepted; nothing is charged until then."
              : d.facts.route === "independent"
                ? "Your agreement elected independent handover. No ongoing Nullshift management subscription is created."
                : "Your route after launch (managed by Nullshift, or handed over to you) is confirmed in your agreement. Accepting the build does not depend on it."}
          </p>
        </section>

        <nav className={s.links} aria-label="Related">
          <Link href="/portal/acceptance">Build acceptance</Link>
          <Link href="/portal/proposal">Agreement</Link>
          <Link href="/portal/payments">Payments</Link>
          <Link href="/portal">Home</Link>
        </nav>
      </div>
    </div>
  );
}
