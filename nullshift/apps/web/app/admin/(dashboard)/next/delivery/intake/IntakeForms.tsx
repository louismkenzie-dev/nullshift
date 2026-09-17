"use client";

import { useActionState } from "react";
import {
  recordClassificationForm,
  splitRequestForm,
  type WorkActionResult,
} from "@/lib/work/actions";
import {
  completeNextActionForm,
  setNextActionForm,
  type NextActionResult,
} from "@/lib/nextActions/actions";
import {
  COVERAGE_DECISIONS,
  COVERAGE_WORDING,
  WORK_CLASS_IDS,
  WORK_CLASS_META,
  type CoverageDecision,
  type WorkClassId,
} from "@/lib/work/classify";
import s from "../../next.module.css";
import c from "./intake.module.css";

/**
 * The only client code on the intake page: three small forms that post to the
 * real server actions. They render ONLY when flagOn("workIntake") is true on
 * the server (the page decides); every action re-checks staff, flag and the
 * preview cookie itself, so rendering them is never an authority.
 */

function Status({ r }: { r: WorkActionResult | NextActionResult | null }) {
  if (!r) return null;
  return (
    <p className={`${c.status} ${r.ok ? c.statusOk : c.statusFail}`} role="status">
      {r.ok ? r.message : `${r.reason}: ${r.message}`}
    </p>
  );
}

function ClassSelect({ name, value }: { name: string; value: WorkClassId | null }) {
  return (
    <select name={name} className={c.select} defaultValue={value ?? ""}>
      <option value="">No class (needs review)</option>
      {WORK_CLASS_IDS.map((id) => (
        <option key={id} value={id}>
          {WORK_CLASS_META[id].label}
        </option>
      ))}
    </select>
  );
}

function CoverageSelect({ name, value }: { name: string; value: CoverageDecision }) {
  return (
    <select name={name} className={c.select} defaultValue={value}>
      {COVERAGE_DECISIONS.map((d) => (
        <option key={d} value={d}>
          {COVERAGE_WORDING[d]}
        </option>
      ))}
    </select>
  );
}

export function RecordClassificationForm({
  workClass,
  coverage,
  governing,
  reasons,
  clientLabel,
}: {
  workClass: WorkClassId | null;
  coverage: CoverageDecision;
  governing: string | null;
  reasons: string[];
  clientLabel: string;
}) {
  const [state, action, pending] = useActionState<WorkActionResult | null, FormData>(
    recordClassificationForm,
    null
  );
  return (
    <form action={action} className={c.form}>
      <input type="hidden" name="reasons" value={JSON.stringify(reasons)} />
      <input type="hidden" name="client_label" value={clientLabel} />
      <div className={c.row2}>
        <div>
          <label className={c.label} htmlFor="rc-issue">
            Issue id (uuid)
          </label>
          <input id="rc-issue" name="issue_id" className={c.input} required />
        </div>
        <div>
          <label className={c.label} htmlFor="rc-tenant">
            Client id (uuid)
          </label>
          <input id="rc-tenant" name="tenant_id" className={c.input} required />
        </div>
      </div>
      <div className={c.row2}>
        <div>
          <label className={c.label} htmlFor="rc-class">
            Work class
          </label>
          <ClassSelect name="work_class" value={workClass} />
        </div>
        <div>
          <label className={c.label} htmlFor="rc-cov">
            Coverage decision
          </label>
          <CoverageSelect name="coverage_decision" value={coverage} />
        </div>
      </div>
      <div>
        <label className={c.label} htmlFor="rc-gov">
          Governing agreement
        </label>
        <input
          id="rc-gov"
          name="governing"
          className={c.input}
          defaultValue={governing ?? ""}
        />
      </div>
      <div>
        <label className={c.label} htmlFor="rc-note">
          Note
        </label>
        <input id="rc-note" name="note" className={c.input} />
      </div>
      <div className={c.actions}>
        <button type="submit" className={s.btnPrimary} disabled={pending}>
          {pending ? "Recording…" : "Record classification"}
        </button>
        <span className={s.queueMeta}>
          Writes work_class, coverage_decision and coverage_evidence only; billing and the
          Change Order gate are untouched.
        </span>
      </div>
      <Status r={state} />
    </form>
  );
}

export function SplitRequestForm({
  parts,
}: {
  parts: {
    title: string;
    workClass: WorkClassId;
    coverage: CoverageDecision;
    reason: string;
  }[];
}) {
  const [state, action, pending] = useActionState<WorkActionResult | null, FormData>(
    splitRequestForm,
    null
  );
  return (
    <form action={action} className={c.form}>
      <div className={c.row2}>
        <div>
          <label className={c.label} htmlFor="sp-issue">
            Parent issue id (uuid)
          </label>
          <input id="sp-issue" name="issue_id" className={c.input} required />
        </div>
        <div>
          <label className={c.label} htmlFor="sp-tenant">
            Client id (uuid)
          </label>
          <input id="sp-tenant" name="tenant_id" className={c.input} required />
        </div>
      </div>
      {parts.slice(0, 2).map((p, i) => {
        const n = i + 1;
        return (
          <fieldset key={n} className={c.fieldset}>
            <legend className={c.legend}>Linked item {n}</legend>
            <div className={c.form}>
              <div>
                <label className={c.label} htmlFor={`sp-title-${n}`}>
                  Title
                </label>
                <input
                  id={`sp-title-${n}`}
                  name={`part${n}_title`}
                  className={c.input}
                  defaultValue={p.title}
                  required
                />
              </div>
              <div className={c.row2}>
                <div>
                  <label className={c.label}>Class</label>
                  <ClassSelect name={`part${n}_class`} value={p.workClass} />
                </div>
                <div>
                  <label className={c.label}>Coverage</label>
                  <CoverageSelect name={`part${n}_coverage`} value={p.coverage} />
                </div>
              </div>
              <input type="hidden" name={`part${n}_reason`} value={p.reason} />
            </div>
          </fieldset>
        );
      })}
      <div className={c.actions}>
        <button type="submit" className={s.btnPrimary} disabled={pending}>
          {pending ? "Splitting…" : "Raise linked items"}
        </button>
        <span className={s.queueMeta}>
          Creates child issues with split_from_issue_id; the parent is not modified.
        </span>
      </div>
      <Status r={state} />
    </form>
  );
}

export function NextActionForms({
  tenantId,
  openId,
  defaults,
}: {
  tenantId: string;
  openId: string | null;
  defaults: { text: string; owner: string; dueAt: string };
}) {
  const [setState, setAction, setPending] = useActionState<
    NextActionResult | null,
    FormData
  >(setNextActionForm, null);
  const [doneState, doneAction, donePending] = useActionState<
    NextActionResult | null,
    FormData
  >(completeNextActionForm, null);
  return (
    <div className={s.stack}>
      <form action={setAction} className={c.form}>
        <div>
          <label className={c.label} htmlFor="na-tenant">
            Client id (uuid)
          </label>
          <input
            id="na-tenant"
            name="tenant_id"
            className={c.input}
            defaultValue={tenantId}
            required
          />
        </div>
        <div>
          <label className={c.label} htmlFor="na-text">
            Next action
          </label>
          <input
            id="na-text"
            name="text"
            className={c.input}
            defaultValue={defaults.text}
            maxLength={280}
            required
          />
        </div>
        <div className={c.row2}>
          <div>
            <label className={c.label} htmlFor="na-owner">
              Owner
            </label>
            <input
              id="na-owner"
              name="owner"
              className={c.input}
              defaultValue={defaults.owner}
              required
            />
          </div>
          <div>
            <label className={c.label} htmlFor="na-due">
              Due
            </label>
            <input
              id="na-due"
              name="due_at"
              type="date"
              className={c.input}
              defaultValue={defaults.dueAt}
            />
          </div>
        </div>
        <div className={c.actions}>
          <button type="submit" className={s.btnPrimary} disabled={setPending}>
            {setPending ? "Saving…" : "Set next action"}
          </button>
          <span className={s.queueMeta}>
            Supersedes the open action; an identical action is not duplicated.
          </span>
        </div>
        <Status r={setState} />
      </form>
      {openId ? (
        <form action={doneAction} className={c.actions}>
          <input type="hidden" name="id" value={openId} />
          <input type="hidden" name="tenant_id" value={tenantId} />
          <button type="submit" className={s.btn} disabled={donePending}>
            {donePending ? "Completing…" : "Mark open action done"}
          </button>
          <Status r={doneState} />
        </form>
      ) : null}
    </div>
  );
}
