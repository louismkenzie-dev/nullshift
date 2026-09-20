import Link from "next/link";
import { STATUS_LABEL, canCreateNextVersion, isBelowFloor, isContentEditable } from "@/lib/commercial/stateMachine";
import type { QuoteVersionListItem } from "@/lib/commercial/types";
import s from "../../shell.module.css";
import {
  approveFromStudio,
  issueFromStudio,
  nextVersionFromStudio,
  requestApprovalFromStudio,
  returnToDraftFromStudio,
  saveDraftFromStudio,
} from "../actions";

/**
 * Studio action bar and draft editor, server-rendered forms posting to the
 * real server actions. Every button the UI shows is also refused server-side
 * by the state machine when it does not apply, so nothing here is a gate.
 */
export function StudioActions({ ctx, blocked }: { ctx: QuoteVersionListItem; blocked: boolean }) {
  const v = ctx.version;
  const hidden = (
    <>
      <input type="hidden" name="version_id" value={v.id} />
      <input type="hidden" name="expected_updated_at" value={v.updated_at} />
    </>
  );
  const below = isBelowFloor(v.commercial, v.internal);

  return (
    <div className={s.chips}>
      {v.status === "draft" ? (
        <form action={requestApprovalFromStudio}>
          {hidden}
          <button type="submit" className={s.btn}>
            Request approval
          </button>
        </form>
      ) : null}
      {v.status === "internal_review" ? (
        <>
          <form action={approveFromStudio} className={s.chips}>
            {hidden}
            <input
              className={s.search}
              style={{ maxWidth: 220 }}
              name="reason"
              placeholder={below ? "Reason (required: below floor)" : "Reason (optional)"}
              aria-label="Approval reason"
              required={below}
            />
            <button type="submit" className={s.btn} title="Must be a staff member other than the author">
              Approve to issue
            </button>
          </form>
          <form action={returnToDraftFromStudio}>
            {hidden}
            <button type="submit" className={s.btn}>
              Return to draft
            </button>
          </form>
        </>
      ) : null}
      {v.status === "approved_to_issue" ? (
        <form action={issueFromStudio} className={s.chips}>
          {hidden}
          <input
            className={s.search}
            style={{ maxWidth: 160 }}
            type="date"
            name="expires_at"
            aria-label="Expiry date (defaults to 30 days)"
          />
          <button
            type="submit"
            className={s.btnPrimary}
            disabled={blocked}
            title={blocked ? "Blocked: a commercial check fails (see Review & approval)" : "Freezes this version and issues it"}
          >
            Issue
          </button>
        </form>
      ) : null}
      {canCreateNextVersion(v.status) ? (
        <form action={nextVersionFromStudio}>
          <input type="hidden" name="version_id" value={v.id} />
          <button type="submit" className={s.btn}>
            New version
          </button>
        </form>
      ) : null}
      <Link href="/admin/quotes" className={s.btn}>
        All quotes
      </Link>
      <span className={s.mono} title={STATUS_LABEL[v.status]}>
        {isContentEditable(v.status) ? "editable" : "content frozen"}
      </span>
    </div>
  );
}

const joinLines = (xs: string[] | undefined): string => (xs ?? []).join("\n");

/** Editable draft fields; saved as one guarded update against expected_updated_at. */
export function DraftEditor({ ctx }: { ctx: QuoteVersionListItem }) {
  const v = ctx.version;
  if (!isContentEditable(v.status)) return null;
  const area: React.CSSProperties = { width: "100%", minHeight: 72, fontFamily: "inherit" };
  return (
    <details className={s.card} open={!(v.brief.outcomes?.length)}>
      <summary className={s.h2} style={{ cursor: "pointer" }}>
        Edit draft (v{v.version_no})
      </summary>
      <form action={saveDraftFromStudio} className={s.stack}>
        <input type="hidden" name="version_id" value={v.id} />
        <input type="hidden" name="expected_updated_at" value={v.updated_at} />
        <label className={s.field}>
          <span className={`${s.mono} ${s.fieldLabel}`}>Desired outcomes (one per line)</span>
          <textarea name="outcomes" className={s.search} style={area} defaultValue={joinLines(v.brief.outcomes)} />
        </label>
        <label className={s.field}>
          <span className={`${s.mono} ${s.fieldLabel}`}>Users and volumes</span>
          <input name="users" className={s.search} defaultValue={v.brief.users ?? ""} />
        </label>
        <label className={s.field}>
          <span className={`${s.mono} ${s.fieldLabel}`}>Constraints</span>
          <input name="constraints" className={s.search} defaultValue={v.brief.constraints ?? ""} />
        </label>
        <label className={s.field}>
          <span className={`${s.mono} ${s.fieldLabel}`}>Estimate confidence</span>
          <select name="confidence" className={s.search} defaultValue={v.brief.confidence ?? "low"}>
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
          </select>
        </label>
        <label className={s.field}>
          <span className={`${s.mono} ${s.fieldLabel}`}>Included deliverables (one per line)</span>
          <textarea name="included" className={s.search} style={area} defaultValue={joinLines(v.scope.included)} />
        </label>
        <label className={s.field}>
          <span className={`${s.mono} ${s.fieldLabel}`}>Exclusions (one per line)</span>
          <textarea name="excluded" className={s.search} style={area} defaultValue={joinLines(v.scope.excluded)} />
        </label>
        <label className={s.field}>
          <span className={`${s.mono} ${s.fieldLabel}`}>Acceptance criteria (one per line)</span>
          <textarea name="acceptance" className={s.search} style={area} defaultValue={joinLines(v.scope.acceptance)} />
        </label>
        <label className={s.field}>
          <span className={`${s.mono} ${s.fieldLabel}`}>Build price (GBP, whole pounds, 0 = not priced)</span>
          <input
            name="build_price_gbp"
            type="number"
            min={0}
            step={1}
            className={s.search}
            defaultValue={Math.round((v.commercial.build_price_minor ?? 0) / 100)}
          />
        </label>
        <label className={s.field}>
          <span className={`${s.mono} ${s.fieldLabel}`}>Milestones (one per line, e.g. &quot;Deposit 50%&quot;)</span>
          <textarea
            name="milestones"
            className={s.search}
            style={area}
            defaultValue={(v.commercial.milestones ?? []).map((m) => `${m.label} ${m.pct}%`).join("\n")}
          />
        </label>
        <label className={s.field}>
          <span className={`${s.mono} ${s.fieldLabel}`}>Service route</span>
          <select name="route" className={s.search} defaultValue={v.commercial.route ?? "unresolved"}>
            <option value="unresolved">unresolved</option>
            <option value="managed">managed</option>
            <option value="independent">independent</option>
          </select>
        </label>
        <label className={s.field}>
          <span className={`${s.mono} ${s.fieldLabel}`}>RUN statement</span>
          <input name="run_state" className={s.search} defaultValue={v.commercial.run_state ?? "Not assessed"} />
        </label>
        <label className={s.field}>
          <span className={`${s.mono} ${s.fieldLabel}`}>TRANSACT</span>
          <input name="transact" className={s.search} defaultValue={v.commercial.transact ?? "Unknown"} />
        </label>
        <div className={s.chips}>
          <button type="submit" className={s.btnPrimary}>
            Save draft
          </button>
          <span className={s.faint}>
            Hours, internal margins and grow options are not edited here; the estimator recomputes
            floor and target from the saved inputs on every load.
          </span>
        </div>
      </form>
    </details>
  );
}
