import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@nullshift/db";
import { T } from "@nullshift/ui/tokens";
import { PageHeader, Panel, StatCard, StatusChip } from "@/components/app/AppKit";
import { Reveal } from "@/components/kyma";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { requireSoc2, WRITE_ROLES } from "@/lib/soc2/guard";
import { logSoc2Event } from "@/lib/soc2/events";
import type { ChipTone } from "@/lib/soc2/ui";
import { addDays, toDateOnly } from "@/lib/soc2/schedule";
import {
  inp,
  textarea,
  primaryBtn,
  actionBtn,
  Field,
  shortDate,
  EmptyRow,
  HeaderRow,
  faintMono,
  bodyText,
  monoLabel,
} from "../shared";

/**
 * Access reviews — the periodic account-by-account check that every login on
 * every in-scope system still belongs to someone who needs it, plus the
 * running joiner/mover/leaver change log and the break-glass record. Reviews
 * collect accounts, force a retain/modify/revoke/investigate decision on each,
 * and the database refuses completion while anything is undecided or a
 * revoke/modify has not been actioned. Break-glass entries are the emergency
 * counterpart: different approver, 24-hour cap, mandatory post-use review —
 * all DB-enforced.
 */

export const dynamic = "force-dynamic";

type ReviewStatus = "open" | "in_progress" | "complete";
type ReviewRow = {
  id: string;
  ref: string;
  title: string;
  scope_note: string | null;
  status: ReviewStatus;
  due_at: string;
  started_by: string | null;
  reviewer_email: string | null;
  completed_at: string | null;
};
type ItemCountRow = { review_id: string; decision: string };
type ChangeRow = {
  id: string;
  person: string;
  system_label: string;
  change: "granted" | "modified" | "revoked" | "break_glass_used";
  privilege: string | null;
  reason: string | null;
  approved_by: string | null;
  occurred_at: string;
  source: string;
};
type BreakGlassRow = {
  id: string;
  system_label: string;
  used_by: string;
  approved_by: string;
  reason: string;
  started_at: string;
  expires_at: string;
  ended_at: string | null;
  review_due_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
};

const PAGE = "/admin/soc2/access-reviews";

const REVIEW_STATUS_TONE: Record<ReviewStatus, ChipTone> = {
  open: "warning",
  in_progress: "accent",
  complete: "success",
};

const CHANGE_KINDS = ["granted", "modified", "revoked", "break_glass_used"] as const;
const CHANGE_SOURCES = ["manual", "onboarding", "offboarding", "access_review", "break_glass"] as const;
const PRIVILEGES = ["standard", "privileged", "admin", "service", "break_glass"] as const;

const shortDateTime = (iso: string): string =>
  new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

// ── server actions ─────────────────────────────────────────────

async function createReview(formData: FormData) {
  "use server";
  const guard = await requireSoc2(...WRITE_ROLES);
  if (!guard.ok) return;
  const title = String(formData.get("title") || "").trim();
  const scopeNote = String(formData.get("scope_note") || "").trim();
  const dueAt = String(formData.get("due_at") || "");
  if (!title || !dueAt) return;

  const db = createServiceClient();
  const { data: ref } = await db.rpc("next_soc2_access_review_ref");
  if (!ref) return;
  const { data: created, error } = await db
    .from("soc2_access_reviews")
    .insert({
      ref,
      title,
      scope_note: scopeNote || null,
      due_at: dueAt,
      started_by: guard.email,
    })
    .select("id, ref")
    .single();
  if (error || !created) return;
  await logSoc2Event({
    recordType: "access_review",
    recordId: created.id,
    type: "created",
    summary: `${created.ref} opened by ${guard.email}: ${title.slice(0, 120)} (due ${dueAt}).`,
    actor: guard.email,
  });
  revalidatePath(PAGE);
}

async function recordAccessChange(formData: FormData) {
  "use server";
  const guard = await requireSoc2(...WRITE_ROLES);
  if (!guard.ok) return;
  const person = String(formData.get("person") || "").trim();
  const systemLabel = String(formData.get("system_label") || "").trim();
  const change = String(formData.get("change") || "");
  const privilege = String(formData.get("privilege") || "").trim();
  const reason = String(formData.get("reason") || "").trim();
  const approvedBy = String(formData.get("approved_by") || "").trim();
  const source = String(formData.get("source") || "");
  if (!person || !systemLabel) return;
  if (!(CHANGE_KINDS as readonly string[]).includes(change)) return;
  if (!(CHANGE_SOURCES as readonly string[]).includes(source)) return;

  const db = createServiceClient();
  const { data: created, error } = await db
    .from("soc2_access_changes")
    .insert({
      person,
      system_label: systemLabel,
      change,
      privilege: privilege || null,
      reason: reason || null,
      approved_by: approvedBy || null,
      source,
    })
    .select("id")
    .single();
  if (error || !created) return;
  await logSoc2Event({
    recordType: "access_change",
    recordId: created.id,
    type: "recorded",
    summary: `Access ${change.replace(/_/g, " ")} recorded on ${systemLabel} (source: ${source.replace(/_/g, " ")}).`,
    actor: guard.email,
  });
  revalidatePath(PAGE);
}

async function recordBreakGlass(formData: FormData) {
  "use server";
  const guard = await requireSoc2(...WRITE_ROLES);
  if (!guard.ok) return;
  const systemLabel = String(formData.get("system_label") || "").trim();
  const usedBy = String(formData.get("used_by") || "").trim() || guard.email;
  const approvedBy = String(formData.get("approved_by") || "").trim();
  const reason = String(formData.get("reason") || "").trim();
  const expiresRaw = String(formData.get("expires_at") || "");
  const reviewDueAt =
    String(formData.get("review_due_at") || "") || addDays(toDateOnly(new Date()), 3);
  if (!systemLabel || !approvedBy || !reason || !expiresRaw) return;
  const expires = new Date(expiresRaw);
  if (Number.isNaN(expires.getTime())) return;

  const db = createServiceClient();
  const { data: created, error } = await db
    .from("soc2_break_glass_events")
    .insert({
      system_label: systemLabel,
      used_by: usedBy,
      approved_by: approvedBy,
      reason,
      started_at: new Date().toISOString(),
      expires_at: expires.toISOString(),
      review_due_at: reviewDueAt,
    })
    .select("id")
    .single();
  // The DB refuses a window over 24h and self-approval — surface the refusal.
  if (error) redirect(`${PAGE}?err=${encodeURIComponent(error.message)}`);
  if (!created) return;
  await logSoc2Event({
    recordType: "break_glass",
    recordId: created.id,
    type: "recorded",
    summary: `Break-glass use recorded on ${systemLabel} by ${usedBy}, approved by ${approvedBy}; post-use review due ${reviewDueAt}.`,
    actor: guard.email,
  });
  revalidatePath(PAGE);
}

async function reviewBreakGlass(formData: FormData) {
  "use server";
  const guard = await requireSoc2(...WRITE_ROLES);
  if (!guard.ok) return;
  const id = String(formData.get("id") || "");
  const note = String(formData.get("review_note") || "").trim();
  if (!id || !note) return;

  const db = createServiceClient();
  const { data: row } = await db
    .from("soc2_break_glass_events")
    .select("id, system_label, ended_at, reviewed_at")
    .eq("id", id)
    .maybeSingle();
  if (!row || row.reviewed_at) return;
  const now = new Date().toISOString();
  const { error } = await db
    .from("soc2_break_glass_events")
    .update({
      reviewed_by: guard.email,
      reviewed_at: now,
      ended_at: row.ended_at ?? now,
      review_note: note,
    })
    .eq("id", id);
  if (error) redirect(`${PAGE}?err=${encodeURIComponent(error.message)}`);
  await logSoc2Event({
    recordType: "break_glass",
    recordId: id,
    type: "reviewed",
    summary: `Break-glass use on ${row.system_label} post-use reviewed by ${guard.email}.`,
    actor: guard.email,
  });
  revalidatePath(PAGE);
}

// ── page ───────────────────────────────────────────────────────

const REVIEW_GRID = "90px 1.5fr 120px 100px 110px 1fr 100px";
const CHANGE_GRID = "1fr 1fr 110px 95px 1.3fr 1fr 105px 95px";
const BG_GRID = "1.1fr 1fr 1fr 175px 105px 130px";

export default async function AccessReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>;
}) {
  const { err } = await searchParams;
  const supabase = await createClient();
  const [{ data: reviews }, { data: items }, { data: changes }, { data: bgEvents }] =
    await Promise.all([
      supabase
        .from("soc2_access_reviews")
        .select("id, ref, title, scope_note, status, due_at, started_by, reviewer_email, completed_at")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.from("soc2_access_review_items").select("review_id, decision"),
      supabase
        .from("soc2_access_changes")
        .select("id, person, system_label, change, privilege, reason, approved_by, occurred_at, source")
        .order("occurred_at", { ascending: false })
        .limit(20),
      supabase
        .from("soc2_break_glass_events")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(100),
    ]);

  const reviewList = (reviews ?? []) as ReviewRow[];
  const itemCounts = (items ?? []) as ItemCountRow[];
  const changeList = (changes ?? []) as ChangeRow[];
  const bgList = (bgEvents ?? []) as BreakGlassRow[];
  const today = toDateOnly(new Date());

  const countsByReview = new Map<string, { total: number; decided: number }>();
  for (const it of itemCounts) {
    const c = countsByReview.get(it.review_id) ?? { total: 0, decided: 0 };
    c.total += 1;
    if (it.decision !== "pending") c.decided += 1;
    countsByReview.set(it.review_id, c);
  }

  const openReviews = reviewList.filter((r) => r.status !== "complete");
  const overdueReviews = openReviews.filter((r) => r.due_at < today);
  const openReviewIds = new Set(openReviews.map((r) => r.id));
  const pendingDecisions = itemCounts.filter(
    (it) => it.decision === "pending" && openReviewIds.has(it.review_id)
  ).length;
  const unreviewedBg = bgList.filter((b) => !b.reviewed_at);

  return (
    <div>
      <PageHeader
        index="12"
        label="SOC 2"
        title="Access reviews"
        lead="Account-by-account reviews of who can log into what, the access-change log, and break-glass records. An overdue review raises an evidence-missing exception automatically and cannot be completed with undecided items — the database enforces it."
      />

      {err && (
        <p
          style={{
            fontFamily: T.mono,
            fontSize: "11px",
            letterSpacing: "0.04em",
            color: T.danger,
            border: `1px solid ${T.danger}40`,
            padding: "10px 14px",
            marginTop: 16,
          }}
        >
          {err}
        </p>
      )}

      <Reveal delay={0.04}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3" style={{ marginTop: 22 }}>
          <StatCard value={String(openReviews.length)} label="Open reviews" />
          <StatCard
            value={String(overdueReviews.length)}
            label="Past due"
            sub={overdueReviews.length ? "The sweep raises an exception per overdue review." : undefined}
          />
          <StatCard value={String(pendingDecisions)} label="Accounts undecided" />
          <StatCard
            value={String(unreviewedBg.length)}
            label="Break-glass unreviewed"
            sub={unreviewedBg.length ? "Post-use review outstanding." : undefined}
          />
        </div>
      </Reveal>

      {/* ── Reviews ─────────────────────────────────────────── */}
      <Reveal delay={0.06}>
        <div style={{ marginTop: 18 }}>
          <Panel label="// ACCESS REVIEWS" pad={false}>
            {reviewList.length === 0 ? (
              <EmptyRow>
                No access reviews yet. Open one below, add every account on the in-scope
                providers, and decide each one.
              </EmptyRow>
            ) : (
              <div className="flex flex-col">
                <HeaderRow
                  grid={REVIEW_GRID}
                  cols={["ref", "title", "status", "due", "decided", "reviewer", "completed"]}
                />
                {reviewList.map((r, i) => {
                  const counts = countsByReview.get(r.id) ?? { total: 0, decided: 0 };
                  const isOverdue = r.due_at < today && r.status !== "complete";
                  return (
                    <Link
                      key={r.id}
                      href={`${PAGE}/${r.id}`}
                      className="grid md:grid gap-3 items-center px-4 py-2.5 hover:bg-[var(--k-bg)]"
                      style={{
                        gridTemplateColumns: REVIEW_GRID,
                        borderTop: i ? "1px solid var(--k-border)" : "none",
                      }}
                    >
                      <span style={{ fontFamily: T.mono, fontSize: "10px", color: "var(--k-faint)" }}>
                        {r.ref}
                      </span>
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
                        title={r.title}
                      >
                        {r.title}
                      </span>
                      <span>
                        <StatusChip tone={REVIEW_STATUS_TONE[r.status]}>
                          {r.status.replace(/_/g, " ")}
                        </StatusChip>
                      </span>
                      <span style={{ ...faintMono, color: isOverdue ? T.danger : "var(--k-faint)" }}>
                        {shortDate(r.due_at)}
                      </span>
                      <span style={faintMono}>
                        {counts.decided}/{counts.total} decided
                      </span>
                      <span
                        className="min-w-0"
                        style={{ ...faintMono, overflow: "hidden", textOverflow: "ellipsis" }}
                        title={r.reviewer_email ?? undefined}
                      >
                        {r.reviewer_email ?? "—"}
                      </span>
                      <span style={faintMono}>{r.completed_at ? shortDate(r.completed_at) : "—"}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>
      </Reveal>

      <Reveal delay={0.08}>
        <div style={{ marginTop: 18 }}>
          <Panel label="// OPEN A REVIEW" title="Start an access review">
            <form action={createReview} className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-3">
                <Field label="Title" grow>
                  <input
                    name="title"
                    style={inp}
                    required
                    maxLength={200}
                    placeholder="e.g. Q3 quarterly access review"
                  />
                </Field>
                <Field label="Due">
                  <input type="date" name="due_at" style={inp} required defaultValue={addDays(today, 14)} />
                </Field>
              </div>
              <Field label="Scope (which providers/systems this review covers)">
                <textarea
                  name="scope_note"
                  style={textarea}
                  maxLength={2000}
                  placeholder="e.g. Supabase (prod), Vercel, GitHub org, Stripe, Google Workspace…"
                />
              </Field>
              <div>
                <SubmitButton style={primaryBtn}>Open review</SubmitButton>
              </div>
            </form>
          </Panel>
        </div>
      </Reveal>

      {/* ── Access changes ──────────────────────────────────── */}
      <Reveal delay={0.1}>
        <div style={{ marginTop: 18 }}>
          <Panel label="// ACCESS CHANGE LOG" title="Joiner / mover / leaver record">
            <p style={{ ...bodyText, marginBottom: 14 }}>
              Every grant, modification and revocation across in-scope systems, with who
              approved it and why. Most recent twenty shown.
            </p>
            <form action={recordAccessChange} className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-3">
                <Field label="Person" grow>
                  <input name="person" style={inp} required maxLength={200} placeholder="who the access belongs to" />
                </Field>
                <Field label="System" grow>
                  <input name="system_label" style={inp} required maxLength={200} placeholder="e.g. Supabase (prod)" />
                </Field>
                <Field label="Change">
                  <select name="change" style={inp} defaultValue="granted">
                    {CHANGE_KINDS.map((c) => (
                      <option key={c} value={c}>
                        {c.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Privilege">
                  <select name="privilege" style={inp} defaultValue="standard">
                    {PRIVILEGES.map((p) => (
                      <option key={p} value={p}>
                        {p.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="flex flex-wrap gap-3">
                <Field label="Reason" grow>
                  <input name="reason" style={inp} maxLength={300} />
                </Field>
                <Field label="Approved by" grow>
                  <input name="approved_by" style={inp} maxLength={200} />
                </Field>
                <Field label="Source">
                  <select name="source" style={inp} defaultValue="manual">
                    {CHANGE_SOURCES.map((s) => (
                      <option key={s} value={s}>
                        {s.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div>
                <SubmitButton style={primaryBtn}>Record change</SubmitButton>
              </div>
            </form>
          </Panel>
        </div>
      </Reveal>

      <Reveal delay={0.12}>
        <div style={{ marginTop: 14 }}>
          <Panel label="// RECENT CHANGES" pad={false}>
            {changeList.length === 0 ? (
              <EmptyRow>
                No access changes recorded yet. Log every grant, modification and revocation
                here as it happens.
              </EmptyRow>
            ) : (
              <div className="flex flex-col">
                <HeaderRow
                  grid={CHANGE_GRID}
                  cols={["person", "system", "change", "privilege", "reason", "approved by", "when", "source"]}
                />
                {changeList.map((c, i) => (
                  <div
                    key={c.id}
                    className="grid md:grid gap-3 items-center px-4 py-2.5"
                    style={{
                      gridTemplateColumns: CHANGE_GRID,
                      borderTop: i ? "1px solid var(--k-border)" : "none",
                    }}
                  >
                    <span
                      className="min-w-0"
                      style={{
                        fontFamily: T.sans,
                        fontSize: "0.84rem",
                        color: "var(--k-fg)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={c.person}
                    >
                      {c.person}
                    </span>
                    <span
                      className="min-w-0"
                      style={{ ...faintMono, overflow: "hidden", textOverflow: "ellipsis" }}
                      title={c.system_label}
                    >
                      {c.system_label}
                    </span>
                    <span>
                      <StatusChip
                        tone={
                          c.change === "revoked"
                            ? "muted"
                            : c.change === "break_glass_used"
                              ? "danger"
                              : c.change === "modified"
                                ? "accent"
                                : "success"
                        }
                      >
                        {c.change.replace(/_/g, " ")}
                      </StatusChip>
                    </span>
                    <span style={faintMono}>{c.privilege ? c.privilege.replace(/_/g, " ") : "—"}</span>
                    <span
                      className="min-w-0"
                      style={{ ...bodyText, fontSize: "0.8rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      title={c.reason ?? undefined}
                    >
                      {c.reason ?? "—"}
                    </span>
                    <span
                      className="min-w-0"
                      style={{ ...faintMono, overflow: "hidden", textOverflow: "ellipsis" }}
                      title={c.approved_by ?? undefined}
                    >
                      {c.approved_by ?? "—"}
                    </span>
                    <span style={faintMono}>{shortDate(c.occurred_at)}</span>
                    <span style={faintMono}>{c.source.replace(/_/g, " ")}</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </Reveal>

      {/* ── Break-glass ─────────────────────────────────────── */}
      <Reveal delay={0.14}>
        <div style={{ marginTop: 18 }}>
          <Panel label="// BREAK-GLASS" title="Emergency privileged access">
            <p style={{ ...bodyText, marginBottom: 14 }}>
              Emergency access needs a different approver, expires within 24 hours — the
              database refuses a longer window or a self-approval — and a post-use review.
              Record the use the moment it happens; review it within days, not weeks.
            </p>
            <form action={recordBreakGlass} className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-3">
                <Field label="System" grow>
                  <input name="system_label" style={inp} required maxLength={200} placeholder="e.g. Supabase (prod)" />
                </Field>
                <Field label="Used by" grow>
                  <input name="used_by" style={inp} maxLength={200} placeholder="defaults to you" />
                </Field>
                <Field label="Approved by" grow>
                  <input name="approved_by" style={inp} required maxLength={200} placeholder="must be a different person" />
                </Field>
              </div>
              <Field label="Reason (what emergency required it)">
                <textarea name="reason" style={textarea} required maxLength={1000} />
              </Field>
              <div className="flex flex-wrap gap-3">
                <Field label="Expires (within 24h)">
                  <input type="datetime-local" name="expires_at" style={inp} required />
                </Field>
                <Field label="Post-use review due">
                  <input type="date" name="review_due_at" style={inp} defaultValue={addDays(today, 3)} />
                </Field>
              </div>
              <div>
                <SubmitButton style={primaryBtn}>Record break-glass use</SubmitButton>
              </div>
            </form>
          </Panel>
        </div>
      </Reveal>

      <Reveal delay={0.16}>
        <div style={{ marginTop: 14 }}>
          <Panel label="// BREAK-GLASS EVENTS" pad={false}>
            {bgList.length === 0 ? (
              <EmptyRow>
                No break-glass events recorded. That is the expected state — this table only
                fills when emergency access is actually used.
              </EmptyRow>
            ) : (
              <div className="flex flex-col">
                <HeaderRow
                  grid={BG_GRID}
                  cols={["system", "used by", "approved by", "window", "review due", "state"]}
                />
                {bgList.map((b, i) => {
                  const reviewOverdue = !b.reviewed_at && b.review_due_at < today;
                  return (
                    <details key={b.id}>
                      <summary
                        className="grid md:grid gap-3 items-center px-4 py-2.5"
                        style={{
                          gridTemplateColumns: BG_GRID,
                          borderTop: i ? "1px solid var(--k-border)" : "none",
                          cursor: "pointer",
                          listStyle: "none",
                        }}
                      >
                        <span
                          className="min-w-0"
                          style={{
                            fontFamily: T.sans,
                            fontSize: "0.84rem",
                            color: "var(--k-fg)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={b.system_label}
                        >
                          {b.system_label}
                        </span>
                        <span
                          className="min-w-0"
                          style={{ ...faintMono, overflow: "hidden", textOverflow: "ellipsis" }}
                          title={b.used_by}
                        >
                          {b.used_by}
                        </span>
                        <span
                          className="min-w-0"
                          style={{ ...faintMono, overflow: "hidden", textOverflow: "ellipsis" }}
                          title={b.approved_by}
                        >
                          {b.approved_by}
                        </span>
                        <span style={faintMono}>
                          {shortDateTime(b.started_at)} → {shortDateTime(b.expires_at)}
                        </span>
                        <span style={{ ...faintMono, color: reviewOverdue ? T.danger : "var(--k-faint)" }}>
                          {shortDate(b.review_due_at)}
                        </span>
                        <span>
                          {b.reviewed_at ? (
                            <StatusChip tone="success">reviewed</StatusChip>
                          ) : reviewOverdue ? (
                            <StatusChip tone="danger">review overdue</StatusChip>
                          ) : (
                            <StatusChip tone="warning">review due</StatusChip>
                          )}
                        </span>
                      </summary>

                      <div
                        className="flex flex-col gap-3 px-4 py-4"
                        style={{ borderTop: "1px dashed var(--k-border)", background: "var(--k-bg)" }}
                      >
                        <p style={bodyText}>
                          <span style={monoLabel}>reason · </span>
                          {b.reason}
                        </p>
                        <p style={faintMono}>
                          ended {b.ended_at ? shortDateTime(b.ended_at) : "not recorded"}
                        </p>
                        {b.reviewed_at ? (
                          <p style={bodyText}>
                            <span style={monoLabel}>post-use review · </span>
                            {b.review_note ?? "—"} — {b.reviewed_by}, {shortDate(b.reviewed_at)}
                          </p>
                        ) : (
                          <form action={reviewBreakGlass} className="flex flex-wrap items-end gap-3">
                            <input type="hidden" name="id" value={b.id} />
                            <Field label="Post-use review note (was the access justified and properly scoped?)" grow>
                              <input name="review_note" style={inp} required maxLength={1000} />
                            </Field>
                            <SubmitButton style={actionBtn}>Record review</SubmitButton>
                          </form>
                        )}
                      </div>
                    </details>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>
      </Reveal>
    </div>
  );
}
