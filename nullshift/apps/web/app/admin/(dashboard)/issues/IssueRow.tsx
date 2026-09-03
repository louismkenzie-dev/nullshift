import Link from "next/link";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { T } from "@nullshift/ui/tokens";
import { StatusChip } from "@/components/app/AppKit";
import {
  BILLING_LABEL,
  BILLING_TONE,
  KIND_LABEL,
  OPEN_STATUSES,
  SEVERITY_META,
  SOURCE_LABEL,
  STATUS_TONE,
  type IssueRow as Issue,
} from "@/lib/ops/issues";
import {
  CLASSIFIER_RULE,
  WORK_CLASSIFICATIONS,
  requiresChangeOrder,
} from "@nullshift/content/legal/work";
import { ALL_STATUSES, BILLINGS, KINDS, SEVERITIES, SOURCES } from "@/lib/ops/issueForm";
import { createChangeOrder } from "../clients/[id]/actions";
import {
  closeIssue,
  createIssue,
  draftImpact,
  queueIssue,
  sendQuote,
  triageIssue,
} from "./actions";

/**
 * One issue row — the summary line plus the inline triage editor — and the
 * quick-add form. Rendered by the global issue bank and by every client's
 * Issues and Bugs tile, so the triage vocabulary, the §8 change-order gate
 * and the quote flow are one component, not two copies. Server component
 * (no hooks): every write goes through the shared actions.
 */

export const GRID = "1.9fr 90px 100px 130px 160px 130px";

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export type ChangeOrderTarget = {
  tenantId: string;
  /** The live Order Form the Change Order hangs off; null = none drafted yet. */
  orderFormId: string | null;
};

export function IssueRowHeader({ hasRows }: { hasRows: boolean }) {
  return (
    <div
      className="max-md:hidden md:grid gap-3 items-center px-4 py-2.5"
      style={{
        gridTemplateColumns: GRID,
        background: "var(--k-surface)",
        borderBottom: hasRows ? "1px solid var(--k-border)" : "none",
        fontFamily: T.mono,
        fontSize: "10px",
        fontWeight: 500,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "var(--k-faint)",
      }}
    >
      <span>Title</span>
      <span>Kind</span>
      <span>Severity</span>
      <span>Billing</span>
      <span>Status</span>
      <span>Age / due</span>
    </div>
  );
}

export function IssueRow({
  issue,
  subline,
  first,
  nowMs,
  changeOrder,
  open,
}: {
  /** Render expanded (a deep link landed on this issue). */
  open?: boolean;
  issue: Issue;
  /** Mono line under the title — "client · source" on the bank, "system · source" on a tile. */
  subline: string;
  first: boolean;
  nowMs: number;
  /** When set, a "Needs Change Order" row carries a Raise Change Order form. */
  changeOrder?: ChangeOrderTarget | null;
}) {
  const overdue =
    Boolean(issue.due_at) &&
    OPEN_STATUSES.includes(issue.status) &&
    new Date(issue.due_at as string).getTime() < nowMs;
  const ageDays = Math.max(
    0,
    Math.floor((nowMs - new Date(issue.created_at).getTime()) / 864e5)
  );
  const ai = issue.ai as {
    kind?: string;
    severity?: string;
    billing?: string;
    rationale?: string;
  } | null;
  const needsCo = requiresChangeOrder(issue.classification) && !issue.change_order_id;
  const questions = (issue.ai as Record<string, unknown> | null)?.cr_questions;

  return (
    <details
      open={open}
      id={`issue-${issue.id}`}
      style={{ borderTop: first ? "none" : "1px solid var(--k-border)" }}
    >
      <summary
        className="max-md:flex max-md:flex-wrap max-md:items-center max-md:gap-x-2 max-md:gap-y-1.5 md:grid md:gap-3 items-center px-4 py-3 list-none hover:bg-[var(--k-surface)] transition-colors"
        style={{ gridTemplateColumns: GRID, cursor: "pointer" }}
      >
        <span className="min-w-0 max-md:w-full">
          <span
            className="block truncate"
            style={{
              fontFamily: T.sans,
              fontWeight: 600,
              fontSize: "0.88rem",
              color: "var(--k-fg)",
            }}
          >
            {issue.title}
          </span>
          <span
            className="block"
            style={{
              fontFamily: T.mono,
              fontSize: "10px",
              letterSpacing: "0.04em",
              color: "var(--k-faint)",
              marginTop: 3,
            }}
          >
            {subline}
            {issue.client_visible ? "" : " · internal"}
            {issue.promised_at ? ` · promised ${shortDate(issue.promised_at)}` : ""}
          </span>
          {ai && issue.billing === "unclassified" && (
            <span
              className="block max-md:break-words md:truncate"
              style={{
                fontFamily: T.mono,
                fontSize: "10px",
                color: "var(--k-faint)",
                marginTop: 3,
              }}
            >
              AI: {String(ai.kind ?? "?")}/{String(ai.severity ?? "?")}/
              {String(ai.billing ?? "?")}
              {ai.rationale ? ` — ${String(ai.rationale)}` : ""}
            </span>
          )}
        </span>
        <span
          style={{
            fontFamily: T.mono,
            fontSize: "10px",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--k-muted)",
          }}
        >
          {KIND_LABEL[issue.kind]}
        </span>
        <span>
          <StatusChip tone={SEVERITY_META[issue.severity].tone}>
            {SEVERITY_META[issue.severity].label}
          </StatusChip>
        </span>
        <span className="flex items-center gap-2 flex-wrap">
          <StatusChip tone={BILLING_TONE[issue.billing]}>
            {BILLING_LABEL[issue.billing]}
          </StatusChip>
          {/* §8: the ticket that cannot be scheduled yet, said out loud on
              the row rather than discovered on save. */}
          {needsCo && <StatusChip tone="warning">Needs Change Order</StatusChip>}
          {issue.billing === "out_of_scope" &&
            issue.status === "awaiting_client" &&
            !issue.quote_accepted_at && (
              <StatusChip tone="warning">Quote sent</StatusChip>
            )}
        </span>
        <span>
          <StatusChip tone={STATUS_TONE[issue.status]}>
            {issue.status.replace(/_/g, " ")}
          </StatusChip>
        </span>
        <span className="flex items-center gap-2 flex-wrap">
          <span style={{ fontFamily: T.mono, fontSize: "10px", color: "var(--k-muted)" }}>
            {ageDays}d{issue.due_at ? ` · due ${shortDate(issue.due_at)}` : ""}
          </span>
          {overdue && <StatusChip tone="danger">overdue</StatusChip>}
        </span>
      </summary>

      {/* ── Inline triage ─────────────────────────── */}
      <div
        style={{
          borderTop: "1px solid var(--k-border)",
          background: "var(--k-surface)",
          padding: "14px 16px",
        }}
      >
        {issue.description && (
          <p
            style={{
              fontFamily: T.sans,
              fontSize: "0.85rem",
              lineHeight: 1.6,
              color: "var(--k-muted)",
              whiteSpace: "pre-wrap",
              maxWidth: "72ch",
              marginBottom: 12,
            }}
          >
            {issue.description}
          </p>
        )}

        {/* §8 hand-off: raise the Change Order from the ticket itself. The
            document is drafted, approved and sent on Docs and Legal. */}
        {needsCo && changeOrder && OPEN_STATUSES.includes(issue.status) && (
          <div
            className="flex flex-wrap items-center gap-3"
            style={{
              marginBottom: 12,
              padding: "10px 12px",
              border: `1px solid color-mix(in oklab, ${T.warning} 40%, transparent)`,
              background: `color-mix(in oklab, ${T.warning} 6%, transparent)`,
            }}
          >
            <span
              style={{ fontFamily: T.sans, fontSize: "0.84rem", color: "var(--k-muted)" }}
            >
              Additional development — cannot be scheduled until the client signs a Change
              Order.
            </span>
            {changeOrder.orderFormId ? (
              <form action={createChangeOrder} className="flex items-center gap-2">
                <input type="hidden" name="tenant_id" value={changeOrder.tenantId} />
                <input
                  type="hidden"
                  name="order_form_id"
                  value={changeOrder.orderFormId}
                />
                <input type="hidden" name="issue_id" value={issue.id} />
                <input type="hidden" name="description" value={issue.title} />
                <input type="hidden" name="business_outcome" value="" />
                <SubmitButton
                  style={btn("var(--k-bg)", T.warning, true)}
                  pendingLabel="…"
                >
                  Raise Change Order
                </SubmitButton>
              </form>
            ) : (
              <Link
                href={`/admin/clients/${changeOrder.tenantId}/agreement`}
                style={{ ...btn("var(--k-bg)", T.warning, true), textDecoration: "none" }}
                className="inline-flex items-center"
              >
                Draft an Order Form first →
              </Link>
            )}
          </div>
        )}

        <form action={triageIssue} className="flex items-end gap-2 flex-wrap">
          <input type="hidden" name="id" value={issue.id} />
          <input type="hidden" name="tenant_id" value={issue.tenant_id} />
          <Field label="Kind">
            <select
              name="kind"
              defaultValue={issue.kind}
              className="max-md:w-full"
              style={inp}
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Severity">
            <select
              name="severity"
              defaultValue={issue.severity}
              className="max-md:w-full"
              style={inp}
            >
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {SEVERITY_META[s].label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Billing">
            <select
              name="billing"
              defaultValue={issue.billing}
              className="max-md:w-full"
              style={inp}
            >
              {BILLINGS.map((b) => (
                <option key={b} value={b}>
                  {BILLING_LABEL[b]}
                </option>
              ))}
            </select>
          </Field>
          <Field label={CLASSIFIER_RULE}>
            <select
              name="classification"
              defaultValue={issue.classification ?? ""}
              className="max-md:w-full"
              style={inp}
            >
              <option value="">Unclassified</option>
              {WORK_CLASSIFICATIONS.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Why this classification">
            <input
              name="classification_note"
              defaultValue={issue.classification_note ?? ""}
              placeholder="One line, for the client's benefit and ours"
              className="w-full md:w-[240px]"
              style={inp}
            />
          </Field>
          <Field label="Status">
            <select
              name="status"
              defaultValue={issue.status}
              className="max-md:w-full"
              style={inp}
            >
              {ALL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Build items">
            <input
              name="build_items"
              type="number"
              step="0.5"
              min="0"
              defaultValue={issue.build_items ?? ""}
              className="w-full md:w-[80px]"
              style={inp}
            />
          </Field>
          <Field label="Quoted £">
            <input
              name="quoted_price"
              type="number"
              step="0.01"
              min="0"
              defaultValue={issue.quoted_price ?? ""}
              className="w-full md:w-[100px]"
              style={inp}
            />
          </Field>
          <Field label="Impact statement (what the client reads with the quote)">
            <div className="flex items-center gap-1 w-full">
              <input
                name="quote_note"
                defaultValue={issue.quote_note ?? ""}
                placeholder="What we'd build, what it costs, how long, what it affects"
                className="w-full md:w-[280px]"
                style={inp}
              />
              <SubmitButton
                formAction={draftImpact}
                formNoValidate
                title="AI-drafts the impact statement into this field — you edit, then Send quote"
                style={{
                  ...btn("transparent", "var(--k-accent)", true),
                  height: 32,
                  paddingInline: 8,
                }}
              >
                ✦
              </SubmitButton>
            </div>
            {Array.isArray(questions) && questions.length > 0 && (
              <span
                style={{
                  fontFamily: T.mono,
                  fontSize: 9,
                  color: "var(--k-faint)",
                  marginTop: 3,
                }}
              >
                AI: settle first — {(questions as string[]).join(" · ")}
              </span>
            )}
          </Field>
          <Field label="Due">
            <input
              name="due_at"
              type="date"
              defaultValue={issue.due_at ? issue.due_at.slice(0, 10) : ""}
              className="max-md:w-full"
              style={{ ...inp, maxWidth: "100%" }}
            />
          </Field>
          <Field label="Owner">
            <input
              name="assignee"
              defaultValue={issue.assignee ?? ""}
              placeholder="Who owns it"
              className="w-full md:w-[110px]"
              style={inp}
            />
          </Field>
          <label className="flex items-center gap-2" style={{ ...check, height: 36 }}>
            <input type="checkbox" name="promised" defaultChecked={!!issue.promised_at} />
            Promised
          </label>
          <Field label="Promised note">
            <input
              name="promised_note"
              defaultValue={issue.promised_note ?? ""}
              placeholder="What was promised"
              className="w-full md:w-[190px]"
              style={inp}
            />
          </Field>
          <label className="flex items-center gap-2" style={{ ...check, height: 36 }}>
            <input
              type="checkbox"
              name="client_visible"
              defaultChecked={issue.client_visible}
            />
            Client visible
          </label>
          <Field label="Resolution note">
            <input
              name="resolution_note"
              defaultValue={issue.resolution_note ?? ""}
              placeholder="Plain-English fix summary"
              className="w-full md:w-[240px]"
              style={inp}
            />
          </Field>
          <SubmitButton style={btn("var(--k-accent)", "var(--k-on-accent)")}>
            Save
          </SubmitButton>
          <SubmitButton
            formAction={sendQuote}
            title="Requires a price and an impact statement — puts the quote in front of the client on the portal with Accept / Decline"
            style={btn("var(--k-bg)", T.warning, true)}
          >
            {issue.quote_accepted_at
              ? "Quote accepted ✓"
              : issue.quote_declined_at
                ? "Re-send quote"
                : issue.status === "awaiting_client" && issue.quoted_price
                  ? "Quote with client…"
                  : "Send quote"}
          </SubmitButton>
        </form>
        {OPEN_STATUSES.includes(issue.status) && (
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {issue.status !== "queued" && issue.status !== "batched" && (
              <form action={queueIssue}>
                <input type="hidden" name="id" value={issue.id} />
                <input type="hidden" name="tenant_id" value={issue.tenant_id} />
                <SubmitButton style={btn("var(--k-bg)", "var(--k-accent)", true)}>
                  Queue
                </SubmitButton>
              </form>
            )}
            <form action={closeIssue}>
              <input type="hidden" name="id" value={issue.id} />
              <input type="hidden" name="tenant_id" value={issue.tenant_id} />
              <SubmitButton style={btn("var(--k-bg)", "var(--k-muted)", true)}>
                Close
              </SubmitButton>
            </form>
          </div>
        )}
      </div>
    </details>
  );
}

/**
 * The // LOG ISSUE quick-add. On the bank every project is offered; on a
 * client tile only that client's systems are — and a single system is a
 * hidden field, not a one-option select.
 */
export function IssueQuickAdd({
  projectOptions,
}: {
  projectOptions: { id: string; label: string }[];
}) {
  return (
    <form action={createIssue} className="flex items-end gap-2 flex-wrap">
      {projectOptions.length === 1 ? (
        <input type="hidden" name="project_id" value={projectOptions[0].id} />
      ) : (
        <Field label="System">
          <select
            name="project_id"
            required
            defaultValue=""
            className="max-md:w-full"
            style={{ ...inp, maxWidth: "100%" }}
          >
            <option value="" disabled>
              Client — project…
            </option>
            {projectOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label="Title">
        <input
          name="title"
          required
          placeholder="What happened?"
          className="w-full md:w-[240px]"
          style={inp}
        />
      </Field>
      <Field label="Description">
        <input
          name="description"
          placeholder="Detail (optional)"
          className="w-full md:w-[260px]"
          style={inp}
        />
      </Field>
      <Field label="Kind">
        <select name="kind" defaultValue="bug" className="max-md:w-full" style={inp}>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Severity">
        <select
          name="severity"
          defaultValue="normal"
          className="max-md:w-full"
          style={inp}
        >
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {SEVERITY_META[s].label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Source">
        <select
          name="source"
          defaultValue="internal"
          className="max-md:w-full"
          style={inp}
        >
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {SOURCE_LABEL[s]}
            </option>
          ))}
        </select>
      </Field>
      <label className="flex items-center gap-2" style={{ ...check, height: 36 }}>
        <input type="checkbox" name="client_visible" defaultChecked />
        Client visible
      </label>
      <SubmitButton style={btn("var(--k-accent)", "var(--k-on-accent)")}>
        Log issue
      </SubmitButton>
    </form>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 min-w-0 max-md:w-full">
      <span
        style={{
          fontFamily: T.mono,
          fontSize: "10px",
          fontWeight: 500,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--k-faint)",
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

/** Status filter chip (a link that patches the query string). */
export const chip = (active: boolean) =>
  ({
    fontFamily: T.mono,
    fontSize: "10px",
    fontWeight: 500,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    padding: "7px 12px",
    background: active ? "var(--k-accent)" : "transparent",
    color: active ? "var(--k-on-accent)" : "var(--k-muted)",
    border: `1px solid ${active ? "var(--k-accent)" : "var(--k-border)"}`,
    borderRadius: 0,
    textDecoration: "none",
  }) as const;

export const check = {
  fontFamily: T.mono,
  fontSize: "10px",
  fontWeight: 500,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  color: "var(--k-muted)",
  cursor: "pointer",
};

export const inp = {
  fontFamily: T.sans,
  fontSize: "0.85rem",
  height: 36,
  padding: "0 11px",
  background: "var(--k-surface)",
  color: "var(--k-fg)",
  border: "1px solid var(--k-border)",
  borderRadius: 0,
} as const;

export const btn = (bg: string, fg: string, outline = false) => ({
  fontFamily: T.mono,
  fontSize: "11px",
  fontWeight: 500,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  height: 36,
  paddingInline: 14,
  background: bg,
  color: fg,
  border: outline ? "1px solid var(--k-border)" : "1px solid transparent",
  borderRadius: 0,
  cursor: "pointer",
});
