import { requireStaff } from "@nullshift/auth/guards";
import { T } from "@nullshift/ui/tokens";
import { StatusChip } from "@/components/app/AppKit";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { approveDocument, legalReturnPath, staffLabels } from "@/lib/legalReview";
import {
  LEGAL_DOCUMENT_LABEL,
  blockedMessage,
  canApprove,
  reviewState,
  type LegalDocumentKind,
} from "@/lib/legal/review";

/**
 * The second-person review gate, rendered next to a legal document's Send
 * button: who drafted it, who approved it (and when), or — while it is still
 * waiting — an "Approve for sending" button that is disabled, with the
 * reason spelled out, for the person who drafted it.
 *
 * Server component. Pass `viewerId` when the page already ran requireStaff();
 * otherwise the gate resolves the viewer itself.
 */
export async function ReviewGate({
  kind,
  id,
  tenantId,
  author,
  reviewedBy,
  reviewedAt,
  viewerId,
  sendable = true,
  returnTo,
}: {
  kind: LegalDocumentKind;
  id: string;
  tenantId: string;
  author: string | null | undefined;
  reviewedBy: string | null | undefined;
  reviewedAt: string | null | undefined;
  /** The signed-in staff member; resolved via requireStaff() when omitted. */
  viewerId?: string | null;
  /** False once the document has gone out — the record is shown, no button. */
  sendable?: boolean;
  /** Admin path to land on after approving (defaults to the client hub / agreement page). */
  returnTo?: string;
}) {
  const state = reviewState({ author, reviewedBy, reviewedAt });
  let viewer = viewerId ?? null;
  if (!viewer) {
    const staff = await requireStaff();
    viewer = staff.ok ? staff.userId : null;
  }
  const labels = await staffLabels([author, reviewedBy]);
  const name = (uid: string | null) =>
    uid ? (labels[uid] ?? `staff ${uid.slice(0, 8)}`) : null;
  const authorLabel = name(state.author);
  const reviewerLabel = name(state.reviewedBy);
  const when = state.reviewedAt
    ? new Date(state.reviewedAt).toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  const gate = viewer
    ? canApprove(state, viewer)
    : { ok: false as const, reason: "Sign in as staff to approve." };
  const label = LEGAL_DOCUMENT_LABEL[kind];

  const tone = state.canSend
    ? "success"
    : state.reviewedBy
      ? "danger"
      : sendable
        ? "warning"
        : "muted";
  const chip = state.canSend
    ? "Approved"
    : state.reviewedBy
      ? "Self-approved"
      : sendable
        ? "Awaiting approval"
        : "No approval recorded";

  const line = state.canSend
    ? `Drafted by ${authorLabel ?? "unknown"} · Approved by ${reviewerLabel}${when ? ` on ${when}` : ""}`
    : state.reviewedBy
      ? `Drafted and approved by the same person (${reviewerLabel}). ${state.reason}`
      : sendable
        ? `Drafted by ${authorLabel ?? "unknown"} — awaiting approval by someone other than the author.`
        : `Drafted by ${authorLabel ?? "unknown"} · sent before the review gate existed.`;

  return (
    <div
      data-review-gate={kind}
      className="flex flex-wrap items-center justify-between gap-3"
      style={{
        border: "1px dashed var(--k-border-strong, var(--k-border))",
        padding: "10px 12px",
      }}
    >
      <div className="flex flex-wrap items-center gap-2" style={{ minWidth: 0 }}>
        <StatusChip tone={tone}>{chip}</StatusChip>
        <span
          style={{
            fontFamily: T.mono,
            fontSize: 11,
            letterSpacing: "0.02em",
            color: state.canSend ? "var(--k-fg)" : "var(--k-muted)",
          }}
        >
          {line}
        </span>
      </div>

      {sendable && !state.canSend && (
        <form action={approveDocument} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="tenant_id" value={tenantId} />
          <input
            type="hidden"
            name="return_to"
            value={returnTo ?? legalReturnPath(kind, tenantId)}
          />
          <SubmitButton
            className="kb kb-outline kb-sm"
            disabled={!gate.ok}
            pendingLabel="Approving…"
            title={gate.ok ? `Approve this ${label} for sending` : gate.reason}
          >
            Approve for sending
          </SubmitButton>
          {!gate.ok && (
            <span
              style={{
                fontFamily: T.sans,
                fontSize: "0.78rem",
                color: "var(--k-faint)",
              }}
            >
              {gate.reason}
            </span>
          )}
        </form>
      )}
    </div>
  );
}

/**
 * The banner a page shows after a send/approve action bounced back with
 * `?blocked=…`. Renders nothing for an unknown or missing code.
 */
export function ReviewBlockedNotice({ blocked }: { blocked: string | null | undefined }) {
  const message = blockedMessage(blocked);
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3"
      style={{
        border:
          "1px solid color-mix(in oklab, var(--k-danger, #ff3a5c) 45%, transparent)",
        background: "color-mix(in oklab, var(--k-danger, #ff3a5c) 8%, transparent)",
        padding: "12px 14px",
      }}
    >
      <StatusChip tone="danger">Blocked</StatusChip>
      <span style={{ fontFamily: T.sans, fontSize: "0.88rem", color: "var(--k-fg)" }}>
        {message}
      </span>
    </div>
  );
}
