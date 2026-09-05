import { SubmitButton } from "@/components/admin/SubmitButton";
import { T } from "@nullshift/ui/tokens";
import { StatusChip } from "@/components/app/AppKit";
import { OUTCOME_LABEL, OUTCOME_TONE, type OutcomeKind } from "@/lib/ops/outcomes";
import { KIND_LABEL, type IssueRow as Issue } from "@/lib/ops/issues";
import { draftOutcomes, releaseOutcomes, saveOutcome } from "../../../batches/actions";

/**
 * The review desk — one row per issue on a batch: what the Claude Code
 * session says it did, editable, with the verb the client will read
 * (Fixed / Answered / Not done). Nothing here reaches the client until a
 * person approves it and releases the batch, so a question is answered in
 * words rather than announced as "fixed".
 */

export type Outcome = {
  issue_id: string;
  outcome: OutcomeKind;
  note: string;
  source: string;
  approved_at: string | null;
  approved_by: string | null;
  published_at: string | null;
};

const KINDS: OutcomeKind[] = ["fixed", "answered", "not_done"];

export function OutcomeReview({
  batchId,
  batchStatus,
  hasPr,
  issues,
  outcomes,
  returnTo,
}: {
  batchId: string;
  batchStatus: string;
  hasPr: boolean;
  issues: Issue[];
  outcomes: Outcome[];
  returnTo: string;
}) {
  const byIssue = new Map(outcomes.map((o) => [o.issue_id, o]));
  const approved = outcomes.filter((o) => o.approved_at && !o.published_at).length;
  const published = outcomes.filter((o) => o.published_at).length;
  const waiting = issues.length - outcomes.filter((o) => o.approved_at).length;

  const label: React.CSSProperties = {
    fontFamily: T.mono,
    fontSize: 10,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--k-muted)",
  };
  const btn = (bg: string, fg: string): React.CSSProperties => ({
    fontFamily: T.mono,
    fontSize: 11,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    padding: "7px 12px",
    background: bg,
    color: fg,
    border: "1px solid var(--k-border)",
    borderRadius: 2,
    cursor: "pointer",
  });

  return (
    <div
      style={{
        gridColumn: "1 / -1",
        borderBottom: "1px solid var(--k-border)",
        background: "var(--k-surface)",
        padding: "10px 14px",
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span style={label}>
          Review desk · {published} released · {approved} approved, not released ·{" "}
          {waiting} to review
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <form action={draftOutcomes}>
            <input type="hidden" name="id" value={batchId} />
            <input type="hidden" name="return_to" value={returnTo} />
            <SubmitButton
              style={btn("transparent", "var(--k-fg)")}
              pendingLabel="Reading the PR…"
            >
              {outcomes.length ? "Re-read from the PR" : "Draft from the PR"}
            </SubmitButton>
          </form>
          <form action={releaseOutcomes}>
            <input type="hidden" name="id" value={batchId} />
            <input type="hidden" name="return_to" value={returnTo} />
            <SubmitButton
              style={btn(
                approved ? "var(--k-accent)" : "transparent",
                approved ? "var(--k-on-accent)" : "var(--k-muted)"
              )}
              disabled={approved === 0}
              pendingLabel="Releasing…"
            >
              Release {approved || ""} to the client
            </SubmitButton>
          </form>
        </div>
      </div>

      {!hasPr && outcomes.length === 0 && (
        <p
          style={{
            fontFamily: T.sans,
            fontSize: "0.8rem",
            color: "var(--k-faint)",
            margin: "8px 0 0",
          }}
        >
          No pull request recorded on this batch yet. Record it on the batch page and the
          outcomes draft themselves — or paste the summary below.
        </p>
      )}

      {/* Paste fallback: an older batch, or a session that skipped the format. */}
      <details style={{ marginTop: 8 }}>
        <summary style={{ ...label, cursor: "pointer" }}>
          Paste a PR summary instead
        </summary>
        <form action={draftOutcomes} style={{ marginTop: 8 }}>
          <input type="hidden" name="id" value={batchId} />
          <input type="hidden" name="return_to" value={returnTo} />
          <textarea
            name="pr_body"
            rows={5}
            placeholder="Paste the pull request description — its Outcomes block, or plain 'Fixed: …' / 'Answered: …' lines."
            style={{
              width: "100%",
              fontFamily: T.mono,
              fontSize: 11,
              padding: 8,
              background: "var(--k-bg)",
              color: "var(--k-fg)",
              border: "1px solid var(--k-border)",
              borderRadius: 2,
            }}
          />
          <SubmitButton style={{ ...btn("transparent", "var(--k-fg)"), marginTop: 6 }}>
            Draft from this
          </SubmitButton>
        </form>
      </details>

      {outcomes.length > 0 && (
        <div className="flex flex-col" style={{ marginTop: 10 }}>
          {issues.map((issue, i) => {
            const o = byIssue.get(issue.id);
            if (!o) return null;
            const done = !!o.published_at;
            return (
              <form
                key={issue.id}
                action={saveOutcome}
                style={{
                  borderTop: i ? "1px solid var(--k-border)" : "none",
                  padding: "10px 0",
                }}
              >
                <input type="hidden" name="batch_id" value={batchId} />
                <input type="hidden" name="issue_id" value={issue.id} />
                <input type="hidden" name="return_to" value={returnTo} />
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    style={{
                      fontFamily: T.sans,
                      fontSize: "0.85rem",
                      color: "var(--k-fg)",
                      flex: "1 1 220px",
                    }}
                  >
                    {issue.title}
                  </span>
                  <span style={label}>{KIND_LABEL[issue.kind]}</span>
                  {done ? (
                    <StatusChip tone="success">Released</StatusChip>
                  ) : o.approved_at ? (
                    <StatusChip tone={OUTCOME_TONE[o.outcome]}>
                      {OUTCOME_LABEL[o.outcome]} · approved
                    </StatusChip>
                  ) : (
                    <StatusChip tone="muted">
                      {o.source === "pr" ? "From the PR" : "Draft"}
                    </StatusChip>
                  )}
                </div>
                {done ? (
                  <p
                    style={{
                      fontFamily: T.sans,
                      fontSize: "0.82rem",
                      color: "var(--k-faint)",
                      margin: "6px 0 0",
                    }}
                  >
                    {OUTCOME_LABEL[o.outcome]}: {o.note}
                  </p>
                ) : (
                  <>
                    <div
                      className="flex flex-wrap items-center gap-2"
                      style={{ marginTop: 6 }}
                    >
                      {KINDS.map((k) => (
                        <label key={k} style={{ ...label, cursor: "pointer" }}>
                          <input
                            type="radio"
                            name="outcome"
                            value={k}
                            defaultChecked={o.outcome === k}
                            style={{ marginRight: 4 }}
                          />
                          {OUTCOME_LABEL[k]}
                        </label>
                      ))}
                    </div>
                    <textarea
                      name="note"
                      rows={2}
                      defaultValue={o.note}
                      placeholder={
                        issue.kind === "question"
                          ? "The answer, in the client's words."
                          : "One sentence the client will read."
                      }
                      style={{
                        width: "100%",
                        marginTop: 6,
                        fontFamily: T.sans,
                        fontSize: "0.85rem",
                        padding: 8,
                        background: "var(--k-bg)",
                        color: "var(--k-fg)",
                        border: "1px solid var(--k-border)",
                        borderRadius: 2,
                      }}
                    />
                    <div
                      className="flex flex-wrap items-center gap-2"
                      style={{ marginTop: 6 }}
                    >
                      <SubmitButton style={btn("transparent", "var(--k-muted)")}>
                        Save draft
                      </SubmitButton>
                      <SubmitButton
                        name="approve"
                        value="1"
                        style={btn("transparent", "var(--k-fg)")}
                      >
                        {o.approved_at ? "Re-approve" : "Approve"}
                      </SubmitButton>
                      {o.approved_by && (
                        <span style={label}>Approved by {o.approved_by}</span>
                      )}
                    </div>
                  </>
                )}
              </form>
            );
          })}
        </div>
      )}
      {batchStatus === "shipped" && approved > 0 && (
        <p
          style={{
            fontFamily: T.sans,
            fontSize: "0.8rem",
            color: "var(--k-warning)",
            margin: "8px 0 0",
          }}
        >
          This batch is shipped but {approved} approved outcome
          {approved === 1 ? " has" : "s have"} not reached the client — press Release.
        </p>
      )}
    </div>
  );
}
