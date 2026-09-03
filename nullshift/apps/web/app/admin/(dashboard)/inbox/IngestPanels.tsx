import { SubmitButton } from "@/components/admin/SubmitButton";
import { T } from "@nullshift/ui/tokens";
import { StatusChip } from "@/components/app/AppKit";
import { Reveal } from "@/components/kyma";
import {
  KIND_LABEL,
  SEVERITY_META,
  SOURCE_LABEL,
  type IssueRow,
} from "@/lib/ops/issues";
import { PASTE_SOURCES } from "@/lib/ops/issueForm";
import { confirmIssue, confirmPrivate, discardIssue, ingestSource } from "./actions";

/**
 * The ingest inbox's two panels as reusable pieces: the paste form (project
 * fixed on a client tile, chosen on the global inbox) and the awaiting-review
 * draft list with confirm / keep private / discard. Server components.
 */

export function IngestForm({
  projectOptions,
}: {
  projectOptions: { id: string; label: string }[];
}) {
  const aiConfigured = Boolean(process.env.ANTHROPIC_API_KEY);
  return (
    <form action={ingestSource} className="flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        {projectOptions.length === 1 ? (
          <input type="hidden" name="project_id" value={projectOptions[0].id} />
        ) : (
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
        )}
        <select
          name="source"
          defaultValue="whatsapp"
          className="max-md:w-full"
          style={{ ...inp, maxWidth: "100%" }}
        >
          {PASTE_SOURCES.map((s) => (
            <option key={s} value={s}>
              {SOURCE_LABEL[s]}
            </option>
          ))}
        </select>
      </div>
      <textarea
        name="text"
        required
        rows={7}
        placeholder="Paste the chat export or transcript here…"
        className="w-full"
        style={{
          maxWidth: "100%",
          ...inp,
          height: "auto",
          padding: 12,
          resize: "vertical" as const,
          lineHeight: 1.6,
        }}
      />
      <div className="flex items-center gap-3 flex-wrap">
        <SubmitButton
          style={btn("var(--k-accent)", "var(--k-on-accent)")}
          pendingLabel="Parsing…"
        >
          Ingest
        </SubmitButton>
        {!aiConfigured && (
          <span style={{ fontFamily: T.sans, fontSize: "0.82rem", color: "var(--k-faint)" }}>
            Add ANTHROPIC_API_KEY to enable AI parsing — pasting currently files the raw text
            as a single issue.
          </span>
        )}
      </div>
    </form>
  );
}

export function DraftList({
  drafts,
  subline,
}: {
  drafts: IssueRow[];
  /** Mono line per draft — "client · source" on the inbox, "system · source" on a tile. */
  subline: (d: IssueRow) => string;
}) {
  if (drafts.length === 0)
    return (
      <p
        className="text-center py-7"
        style={{ fontFamily: T.sans, fontSize: "0.85rem", color: "var(--k-muted)" }}
      >
        Nothing awaiting review — paste a source above to create drafts.
      </p>
    );
  return (
    <>
      {drafts.map((d, i) => (
        <Reveal key={d.id} delay={Math.min(i, 8) * 0.04}>
          <div
            className="flex flex-col gap-2"
            style={{
              padding: "13px 18px",
              borderTop: i ? "1px solid var(--k-border)" : "none",
            }}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="min-w-0 max-md:w-full"
                style={{
                  fontFamily: T.sans,
                  fontWeight: 600,
                  fontSize: "0.88rem",
                  color: "var(--k-fg)",
                }}
              >
                {d.title}
              </span>
              <StatusChip tone="muted">{KIND_LABEL[d.kind]}</StatusChip>
              <StatusChip tone={SEVERITY_META[d.severity].tone}>
                {SEVERITY_META[d.severity].label}
              </StatusChip>
              {d.promised_at && <StatusChip tone="warning">promised</StatusChip>}
              <span
                className="ml-auto"
                style={{ fontFamily: T.mono, fontSize: "10px", color: "var(--k-faint)" }}
              >
                {subline(d)}
              </span>
            </div>
            {d.source_quote && (
              <p
                className="line-clamp-2 break-words"
                style={{
                  fontFamily: T.mono,
                  fontSize: "11px",
                  lineHeight: 1.6,
                  color: "var(--k-faint)",
                  margin: 0,
                  maxWidth: "80ch",
                }}
              >
                {d.source_quote}
              </p>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <form action={confirmIssue}>
                <input type="hidden" name="id" value={d.id} />
                <input type="hidden" name="tenant_id" value={d.tenant_id} />
                <SubmitButton style={btnSm("var(--k-accent)", "var(--k-on-accent)")}>
                  Confirm
                </SubmitButton>
              </form>
              <form action={confirmPrivate}>
                <input type="hidden" name="id" value={d.id} />
                <input type="hidden" name="tenant_id" value={d.tenant_id} />
                <SubmitButton style={btnSm("var(--k-surface)", "var(--k-fg)", true)}>
                  Confirm private
                </SubmitButton>
              </form>
              <form action={discardIssue}>
                <input type="hidden" name="id" value={d.id} />
                <input type="hidden" name="tenant_id" value={d.tenant_id} />
                <SubmitButton style={btnSm("transparent", "var(--k-muted)", true)}>
                  Discard
                </SubmitButton>
              </form>
            </div>
          </div>
        </Reveal>
      ))}
    </>
  );
}

const inp = {
  fontFamily: T.sans,
  fontSize: "0.85rem",
  height: 36,
  padding: "0 11px",
  background: "var(--k-surface)",
  color: "var(--k-fg)",
  border: "1px solid var(--k-border)",
  borderRadius: 0,
} as const;
const btn = (bg: string, fg: string, outline = false) => ({
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
const btnSm = (bg: string, fg: string, outline = false) => ({
  ...btn(bg, fg, outline),
  fontSize: "10px",
  height: 30,
  paddingInline: 11,
});
