import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createHash, randomUUID } from "node:crypto";
import { createClient, createServiceClient } from "@nullshift/db";
import { T } from "@nullshift/ui/tokens";
import { PageHeader, Panel, StatCard, StatusChip } from "@/components/app/AppKit";
import { Reveal } from "@/components/kyma";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { requireSoc2, WRITE_ROLES } from "@/lib/soc2/guard";
import { logSoc2Event } from "@/lib/soc2/events";
import { redactSecrets } from "@/lib/ai/impact";
import { addDays, toDateOnly } from "@/lib/soc2/schedule";
import type { ChipTone } from "@/lib/soc2/ui";
import {
  inp,
  textarea,
  primaryBtn,
  Field,
  shortDate,
  EmptyRow,
  HeaderRow,
  monoLabel,
  faintMono,
  bodyText,
} from "../shared";

/**
 * Evidence register — every item the programme has collected: what it shows,
 * who collected it, and whether an independent reviewer has accepted it.
 * Files land in the private soc2-evidence bucket and are only ever handed out
 * through short-lived signed URLs; text fields hold references, never secrets
 * (a secret-shaped value is refused and raises an exception instead of being
 * stored). Once a reviewer accepts an item its substance is frozen by the
 * database — corrections are new items, not edits.
 */

export const dynamic = "force-dynamic";

type EvidenceItem = {
  id: string;
  control_id: string | null;
  control_run_id: string | null;
  exception_id: string | null;
  title: string;
  source: string;
  source_ref: string | null;
  capture_date: string;
  period_start: string | null;
  period_end: string | null;
  collected_by: string | null;
  reviewer_email: string | null;
  reviewed_at: string | null;
  review_result: "accepted" | "returned" | null;
  review_note: string | null;
  classification: "internal" | "confidential" | "restricted";
  retention_until: string | null;
  file_path: string | null;
  file_bytes: number | null;
  file_mime: string | null;
  content_sha256: string | null;
  notes: string | null;
};
type ControlRef = { id: string; key: string; name: string };
type OpenRun = { id: string; control_id: string; due_at: string; status: string };

const SOURCES = [
  "manual_upload",
  "system_record",
  "integration",
  "acknowledgement",
  "access_review",
  "deployment_record",
  "repository_record",
  "backup_report",
  "restore_test",
  "vendor_review",
  "incident_review",
  "training",
  "attestation",
] as const;

const CLASSIFICATIONS = ["internal", "confidential", "restricted"] as const;

const CLASSIFICATION_TONE: Record<EvidenceItem["classification"], ChipTone> = {
  internal: "muted",
  confidential: "warning",
  restricted: "danger",
};

const ALLOWED_MIME = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "text/plain",
  "text/csv",
  "application/json",
  "text/markdown",
];
// Server actions carry an 8mb body limit (next.config.ts serverActions
// bodySizeLimit); 7 MB leaves room for the multipart envelope + form fields.
const MAX_FILE_BYTES = 7 * 1024 * 1024;

/** File types whose CONTENT can be meaningfully scanned for secrets. */
const TEXT_MIME = ["text/plain", "text/csv", "application/json", "text/markdown"];

const PAGE_PATH = "/admin/soc2/evidence";

const errRedirect = (message: string): never =>
  redirect(`${PAGE_PATH}?err=${encodeURIComponent(message)}`);

// ── server actions ─────────────────────────────────────────────

async function createEvidence(formData: FormData) {
  "use server";
  const guard = await requireSoc2(...WRITE_ROLES);
  if (!guard.ok) return;

  const title = String(formData.get("title") || "").trim();
  const controlId = String(formData.get("control_id") || "");
  const runId = String(formData.get("control_run_id") || "");
  const source = String(formData.get("source") || "manual_upload");
  const sourceRef = String(formData.get("source_ref") || "").trim();
  const captureDate =
    String(formData.get("capture_date") || "") || toDateOnly(new Date());
  const periodStart = String(formData.get("period_start") || "");
  const periodEnd = String(formData.get("period_end") || "");
  const classification = String(formData.get("classification") || "internal");
  const retentionUntil = String(formData.get("retention_until") || "");
  const notes = String(formData.get("notes") || "").trim();
  if (
    !title ||
    !(SOURCES as readonly string[]).includes(source) ||
    !(CLASSIFICATIONS as readonly string[]).includes(classification)
  )
    return;

  const candidate = formData.get("file") as File | null;
  const file = candidate && candidate.size > 0 && candidate.name ? candidate : null;
  if (file && (!ALLOWED_MIME.includes(file.type) || file.size > MAX_FILE_BYTES)) {
    errRedirect("File type or size not allowed");
  }

  const db = createServiceClient();

  // Secret gate — before any upload or insert. Credential-shaped content is
  // refused outright: nothing is stored, and an exception is raised so the
  // near-miss itself gets reviewed. The exception NEVER echoes the content.
  // Text-typed FILE CONTENT goes through the same detector as the metadata —
  // a .txt full of keys is the likeliest way a credential reaches evidence.
  // Binary formats (pdf/png/jpeg) cannot be meaningfully scanned; the policy
  // makes their contents the uploader's responsibility.
  const fileBuf = file ? Buffer.from(await file.arrayBuffer()) : null;
  const scannableFileText =
    file && fileBuf && TEXT_MIME.includes(file.type) ? fileBuf.toString("utf8") : "";
  const textFields = [title, sourceRef, notes, scannableFileText].join("\n");
  if (JSON.stringify(redactSecrets(textFields)) !== JSON.stringify(textFields)) {
    const { data: ref } = await db.rpc("next_soc2_exception_ref");
    if (ref) {
      const today = toDateOnly(new Date());
      const { data: exc } = await db
        .from("soc2_exceptions")
        .insert({
          ref,
          rule_key: "iam.secret_in_evidence",
          severity: "critical",
          status: "triage_required",
          title: "Secret-shaped content blocked in an evidence submission",
          detail:
            "An evidence submission was refused because a field or text-file body matched a secret pattern. The content was not stored.",
          severity_rationale: "Credential material must never enter evidence records.",
          source: "manual",
          owner_email: guard.email,
          due_at: addDays(today, 2),
          recommended_action:
            "Rotate the credential if it was real; re-submit evidence with references only.",
        })
        .select("id, ref")
        .single();
      if (exc) {
        await logSoc2Event({
          recordType: "exception",
          recordId: exc.id,
          type: "detected",
          summary: `${exc.ref} raised: secret-shaped content was blocked in an evidence submission (nothing stored)`,
          actor: guard.email,
        });
      }
    }
    errRedirect(
      "Blocked: a field or text file matched a secret pattern. Store references, never credentials."
    );
  }

  // Upload the file (if any) only after the gate has passed.
  let filePath: string | null = null;
  let fileBytes: number | null = null;
  let fileMime: string | null = null;
  let sha256: string | null = null;
  if (file && fileBuf) {
    sha256 = createHash("sha256").update(fileBuf).digest("hex");
    filePath = `evidence/${randomUUID()}-${file.name
      .replace(/[^a-zA-Z0-9._-]+/g, "_")
      .slice(0, 80)}`;
    const { error: uploadError } = await db.storage
      .from("soc2-evidence")
      .upload(filePath, fileBuf, { contentType: file.type });
    if (uploadError) errRedirect(uploadError.message);
    fileBytes = file.size;
    fileMime = file.type;
  }

  // A chosen run must belong to the chosen control, else it is ignored.
  let controlRunId: string | null = null;
  if (runId) {
    const { data: run } = await db
      .from("soc2_control_runs")
      .select("id, control_id, status")
      .eq("id", runId)
      .maybeSingle();
    if (
      run &&
      controlId &&
      run.control_id === controlId &&
      ["scheduled", "in_progress"].includes(run.status)
    ) {
      controlRunId = run.id;
    }
  }

  const { data: created, error } = await db
    .from("soc2_evidence_items")
    .insert({
      control_id: controlId || null,
      control_run_id: controlRunId,
      title,
      source,
      source_ref: sourceRef || null,
      capture_date: captureDate,
      period_start: periodStart || null,
      period_end: periodEnd || null,
      collected_by: guard.email,
      classification,
      retention_until: retentionUntil || null,
      file_path: filePath,
      file_bytes: fileBytes,
      file_mime: fileMime,
      content_sha256: sha256,
      notes: notes || null,
    })
    .select("id")
    .single();
  if (error || !created) {
    errRedirect(error?.message ?? "Evidence could not be saved");
    return;
  }

  await logSoc2Event({
    recordType: "evidence",
    recordId: created.id,
    type: "collected",
    summary: `Evidence collected: ${title.slice(0, 120)}${filePath ? " (file attached)" : ""}`,
    detail: { source, classification, has_file: !!filePath },
    actor: guard.email,
  });
  revalidatePath(PAGE_PATH);
}

async function reviewEvidence(formData: FormData) {
  "use server";
  const guard = await requireSoc2(...WRITE_ROLES);
  if (!guard.ok) return;

  const id = String(formData.get("id") || "");
  const result = String(formData.get("review_result") || "");
  const note = String(formData.get("review_note") || "").trim();
  if (!id || !["accepted", "returned"].includes(result)) return;

  const db = createServiceClient();
  const { data: item } = await db
    .from("soc2_evidence_items")
    .select("id, title, collected_by")
    .eq("id", id)
    .maybeSingle();
  if (!item) return;
  if ((item.collected_by ?? "").toLowerCase() === guard.email.toLowerCase()) {
    errRedirect("Evidence must be reviewed by someone other than its collector");
  }

  const { error } = await db
    .from("soc2_evidence_items")
    .update({
      review_result: result,
      review_note: note || null,
      reviewer_email: guard.email,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) errRedirect(error.message);

  await logSoc2Event({
    recordType: "evidence",
    recordId: item.id,
    type: "reviewed",
    summary: `Evidence "${item.title.slice(0, 100)}" reviewed: ${result}`,
    actor: guard.email,
  });
  revalidatePath(PAGE_PATH);
}

// ── page ───────────────────────────────────────────────────────

const GRID = "90px 1.5fr 80px 120px 110px 1.1fr 110px 130px";

const kb = (n: number | null): number => (n ? Math.max(1, Math.round(n / 1024)) : 0);
const mimeShort = (mime: string | null): string => mime?.split("/").pop() ?? "file";

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <span style={monoLabel}>{label}</span>
      <span style={{ ...bodyText, overflowWrap: "anywhere" }}>{children}</span>
    </div>
  );
}

export default async function EvidencePage({
  searchParams,
}: {
  searchParams: Promise<{ control?: string; review?: string; err?: string }>;
}) {
  const sp = await searchParams;
  const err = sp.err || null;
  const controlFilter = sp.control || null;
  const reviewFilter = ["pending", "accepted", "returned"].includes(sp.review ?? "")
    ? (sp.review as "pending" | "accepted" | "returned")
    : null;

  const supabase = await createClient();
  const [{ data: evidenceRows }, { data: controlRows }, { data: runRows }] =
    await Promise.all([
      supabase
        .from("soc2_evidence_items")
        .select(
          "id, control_id, control_run_id, exception_id, title, source, source_ref, capture_date, period_start, period_end, collected_by, reviewer_email, reviewed_at, review_result, review_note, classification, retention_until, file_path, file_bytes, file_mime, content_sha256, notes"
        )
        .order("capture_date", { ascending: false })
        .limit(500),
      supabase.from("soc2_controls").select("id, key, name").order("key"),
      supabase
        .from("soc2_control_runs")
        .select("id, control_id, due_at, status")
        .in("status", ["scheduled", "in_progress"])
        .order("due_at"),
    ]);
  const items = (evidenceRows ?? []) as EvidenceItem[];
  const controls = (controlRows ?? []) as ControlRef[];
  const openRuns = (runRows ?? []) as OpenRun[];
  const controlById = new Map(controls.map((c) => [c.id, c]));

  let list = items;
  if (controlFilter) list = list.filter((e) => e.control_id === controlFilter);
  if (reviewFilter === "pending") list = list.filter((e) => !e.review_result);
  else if (reviewFilter) list = list.filter((e) => e.review_result === reviewFilter);

  const pending = items.filter((e) => !e.review_result);
  const accepted = items.filter((e) => e.review_result === "accepted");
  const withFile = items.filter((e) => e.file_path);

  const evidencedControlIds = new Set(
    items.map((e) => e.control_id).filter((id): id is string => !!id)
  );
  if (controlFilter) evidencedControlIds.add(controlFilter);
  const chipControls = controls.filter((c) => evidencedControlIds.has(c.id));

  const qs = (patch: { control?: string | null; review?: string | null }) => {
    const q = new URLSearchParams();
    const control = patch.control === undefined ? controlFilter : patch.control;
    const review = patch.review === undefined ? reviewFilter : patch.review;
    if (control) q.set("control", control);
    if (review) q.set("review", review);
    const s = q.toString();
    return s ? `${PAGE_PATH}?${s}` : PAGE_PATH;
  };

  const chip = (active: boolean): CSSProperties => ({
    fontFamily: T.mono,
    fontSize: "10px",
    fontWeight: 500,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    padding: "5px 9px",
    border: `1px solid ${active ? "var(--k-accent)" : "var(--k-border)"}`,
    color: active ? "var(--k-accent)" : "var(--k-muted)",
    background: active ? "rgba(16,185,129,0.08)" : "var(--k-surface)",
    whiteSpace: "nowrap",
    textDecoration: "none",
  });

  return (
    <div>
      <PageHeader
        index="12"
        label="SOC 2"
        title="Evidence register"
        lead="Every item the programme has collected: what it shows, who collected it, and whether an independent reviewer has accepted it."
      />

      {err && (
        <p
          style={{
            fontFamily: T.mono,
            fontSize: "11px",
            letterSpacing: "0.04em",
            color: T.danger,
            border: `1px solid ${T.danger}55`,
            padding: "10px 14px",
            marginTop: 20,
          }}
        >
          {err}
        </p>
      )}

      <Reveal delay={0.04}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3" style={{ marginTop: 24 }}>
          <StatCard value={String(items.length)} label="Evidence items" />
          <StatCard
            value={String(pending.length)}
            label="Pending review"
            sub={pending.length ? "Awaiting a reviewer other than the collector." : undefined}
          />
          <StatCard value={String(accepted.length)} label="Accepted" />
          <StatCard value={String(withFile.length)} label="With file attached" />
        </div>
      </Reveal>

      {/* Filters — live in the URL */}
      <Reveal delay={0.06}>
        <div className="flex flex-col gap-2" style={{ marginTop: 20 }}>
          <div className="flex flex-wrap items-center gap-1.5">
            <span style={{ ...monoLabel, marginRight: 4 }}>Review</span>
            <Link href={qs({ review: null })} style={chip(!reviewFilter)}>
              All
            </Link>
            {(["pending", "accepted", "returned"] as const).map((r) => (
              <Link key={r} href={qs({ review: r })} style={chip(reviewFilter === r)}>
                {r}
              </Link>
            ))}
          </div>
          {chipControls.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span style={{ ...monoLabel, marginRight: 4 }}>Control</span>
              <Link href={qs({ control: null })} style={chip(!controlFilter)}>
                All
              </Link>
              {chipControls.map((c) => (
                <Link key={c.id} href={qs({ control: c.id })} style={chip(controlFilter === c.id)}>
                  {c.key}
                </Link>
              ))}
            </div>
          )}
        </div>
      </Reveal>

      {/* Register */}
      <Reveal delay={0.08}>
        <div style={{ marginTop: 18 }}>
          <Panel label="// EVIDENCE REGISTER" pad={false}>
            <HeaderRow
              grid={GRID}
              cols={[
                "Captured",
                "Title",
                "Control",
                "Source",
                "Classification",
                "Collected by",
                "Review",
                "File",
              ]}
            />
            {list.length === 0 && (
              <EmptyRow>
                {items.length === 0
                  ? "No evidence collected yet — use the form below; files go to the private evidence bucket."
                  : "No evidence matches the current filters."}
              </EmptyRow>
            )}
            {list.map((e, i) => {
              const control = e.control_id ? controlById.get(e.control_id) : undefined;
              const reviewTone: ChipTone = !e.review_result
                ? "warning"
                : e.review_result === "accepted"
                  ? "success"
                  : "danger";
              return (
                <details key={e.id}>
                  <summary
                    className="grid md:grid gap-3 items-center px-4 py-2.5"
                    style={{
                      gridTemplateColumns: GRID,
                      borderTop: i ? "1px solid var(--k-border)" : "none",
                      cursor: "pointer",
                      listStyle: "none",
                    }}
                  >
                    <span style={faintMono}>{shortDate(e.capture_date)}</span>
                    <span
                      className="min-w-0"
                      style={{
                        fontFamily: T.sans,
                        fontSize: "0.85rem",
                        color: "var(--k-fg)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={e.title}
                    >
                      {e.title}
                    </span>
                    <span style={{ fontFamily: T.mono, fontSize: "10px", color: "var(--k-muted)" }}>
                      {control?.key ?? "—"}
                    </span>
                    <span style={faintMono}>{e.source.replace(/_/g, " ")}</span>
                    <span>
                      <StatusChip tone={CLASSIFICATION_TONE[e.classification]}>
                        {e.classification}
                      </StatusChip>
                    </span>
                    <span
                      className="min-w-0"
                      style={{ ...faintMono, overflow: "hidden", textOverflow: "ellipsis" }}
                    >
                      {e.collected_by ?? "—"}
                    </span>
                    <span>
                      <StatusChip tone={reviewTone}>
                        {e.review_result ?? "pending"}
                      </StatusChip>
                    </span>
                    {e.file_path ? (
                      <a
                        href={`${PAGE_PATH}/${e.id}/download`}
                        style={{ ...faintMono, color: "var(--k-accent)", textDecoration: "none" }}
                      >
                        ↓ {mimeShort(e.file_mime)} · {kb(e.file_bytes)} KB
                      </a>
                    ) : (
                      <span style={faintMono}>—</span>
                    )}
                  </summary>

                  <div
                    className="grid md:grid-cols-2 gap-x-6 gap-y-3 px-4 py-4"
                    style={{ borderTop: "1px dashed var(--k-border)", background: "var(--k-bg)" }}
                  >
                    <Meta label="Source ref">{e.source_ref ?? "—"}</Meta>
                    <Meta label="Period">
                      {e.period_start || e.period_end
                        ? `${shortDate(e.period_start)} → ${shortDate(e.period_end)}`
                        : "—"}
                    </Meta>
                    <Meta label="Notes">{e.notes ?? "—"}</Meta>
                    <Meta label="Review note">{e.review_note ?? "—"}</Meta>
                    <Meta label="SHA-256">
                      {e.content_sha256 ? (
                        <span
                          style={{ fontFamily: T.mono, fontSize: "0.72rem", color: "var(--k-muted)" }}
                          title={e.content_sha256}
                        >
                          {e.content_sha256.slice(0, 20)}…
                        </span>
                      ) : (
                        "—"
                      )}
                    </Meta>
                    <Meta label="Retention until">{shortDate(e.retention_until)}</Meta>
                    {e.reviewer_email && (
                      <Meta label="Reviewed by">
                        {e.reviewer_email} · {shortDate(e.reviewed_at)}
                      </Meta>
                    )}
                  </div>

                  <form
                    action={reviewEvidence}
                    className="flex flex-wrap items-end gap-3 px-4 py-4"
                    style={{ borderTop: "1px dashed var(--k-border)", background: "var(--k-bg)" }}
                  >
                    <input type="hidden" name="id" value={e.id} />
                    <Field label="Review result">
                      <select
                        name="review_result"
                        style={inp}
                        defaultValue={e.review_result ?? "accepted"}
                      >
                        <option value="accepted">accepted</option>
                        <option value="returned">returned</option>
                      </select>
                    </Field>
                    <Field label="Review note" grow>
                      <input
                        name="review_note"
                        style={inp}
                        maxLength={500}
                        defaultValue={e.review_note ?? ""}
                        placeholder="What the reviewer checked, or why it is returned"
                      />
                    </Field>
                    <SubmitButton style={primaryBtn}>Record review</SubmitButton>
                    <p className="w-full" style={faintMono}>
                      Review must come from someone other than the collector. Once accepted, the
                      item&apos;s substance is frozen — supersede it with a new item instead of
                      editing.
                    </p>
                  </form>
                </details>
              );
            })}
          </Panel>
        </div>
      </Reveal>

      {/* Collect evidence */}
      <Reveal delay={0.12}>
        <div style={{ marginTop: 18 }}>
          <Panel
            label="// COLLECT EVIDENCE"
            title="Add an item to the register"
          >
            <form
              action={createEvidence}
              className="flex flex-col gap-3"
            >
              <div className="flex flex-wrap gap-3">
                <Field label="Title" grow>
                  <input
                    name="title"
                    style={inp}
                    required
                    maxLength={200}
                    placeholder="What this item evidences"
                  />
                </Field>
                <Field label="Control">
                  <select name="control_id" style={inp} defaultValue="">
                    <option value="">— none —</option>
                    {controls.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.key} — {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Open run (optional)">
                  <select name="control_run_id" style={inp} defaultValue="">
                    <option value="">— none —</option>
                    {openRuns.map((r) => (
                      <option key={r.id} value={r.id}>
                        {controlById.get(r.control_id)?.key ?? "?"} · due {shortDate(r.due_at)}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="flex flex-wrap gap-3">
                <Field label="Source">
                  <select name="source" style={inp} defaultValue="manual_upload">
                    {SOURCES.map((s) => (
                      <option key={s} value={s}>
                        {s.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Source ref (reference only)" grow>
                  <input
                    name="source_ref"
                    style={inp}
                    maxLength={300}
                    placeholder="audit_log:<id>, a PR URL, a report reference…"
                  />
                </Field>
                <Field label="Capture date">
                  <input
                    type="date"
                    name="capture_date"
                    style={inp}
                    defaultValue={toDateOnly(new Date())}
                  />
                </Field>
              </div>

              <div className="flex flex-wrap gap-3">
                <Field label="Period start">
                  <input type="date" name="period_start" style={inp} />
                </Field>
                <Field label="Period end">
                  <input type="date" name="period_end" style={inp} />
                </Field>
                <Field label="Classification">
                  <select name="classification" style={inp} defaultValue="internal">
                    {CLASSIFICATIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Retention until">
                  <input type="date" name="retention_until" style={inp} />
                </Field>
              </div>

              <Field label="Notes (references and descriptions — never secrets or client personal data)">
                <textarea name="notes" style={textarea} maxLength={2000} />
              </Field>

              <Field label="File (pdf, png, jpeg, txt, csv, json, md · max 7 MB)">
                <input
                  type="file"
                  name="file"
                  accept=".pdf,.png,.jpg,.jpeg,.txt,.csv,.json,.md,application/pdf,image/png,image/jpeg,text/plain,text/csv,application/json,text/markdown"
                  style={{ ...inp, height: "auto", padding: "7px 11px" }}
                />
              </Field>

              <div className="flex items-center gap-3 flex-wrap">
                <SubmitButton style={primaryBtn}>Collect evidence</SubmitButton>
                <span style={faintMono}>
                  Uploads go to the private evidence bucket; a SHA-256 is recorded at upload time.
                  A field that looks like a credential is refused and raises an exception.
                </span>
              </div>
            </form>
          </Panel>
        </div>
      </Reveal>
    </div>
  );
}
