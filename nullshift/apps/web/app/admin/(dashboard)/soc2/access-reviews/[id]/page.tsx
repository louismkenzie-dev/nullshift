import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@nullshift/db";
import { T } from "@nullshift/ui/tokens";
import { PageHeader, Panel, StatusChip } from "@/components/app/AppKit";
import { Reveal } from "@/components/kyma";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { requireSoc2, WRITE_ROLES } from "@/lib/soc2/guard";
import { logSoc2Event } from "@/lib/soc2/events";
import type { ChipTone } from "@/lib/soc2/ui";
import { toDateOnly } from "@/lib/soc2/schedule";
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
} from "../../shared";

/**
 * Access review detail — one review's account roster and the decisions on it.
 * Every account on the covered systems gets a retain/modify/revoke/investigate
 * decision by a named person; modify/revoke decisions must additionally record
 * when the change was actually made. The database refuses completion while any
 * account is undecided or any modify/revoke is unactioned, and a successful
 * completion files a confidential evidence item against control IAM-05.
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
  summary: string | null;
};
type Privilege = "standard" | "privileged" | "admin" | "service" | "break_glass";
type MfaStatus = "enabled" | "disabled" | "unknown" | "not_supported";
type Decision = "pending" | "retain" | "modify" | "revoke" | "investigate";
type ItemRow = {
  id: string;
  review_id: string;
  asset_id: string | null;
  system_label: string;
  account_identifier: string;
  person: string | null;
  privilege: Privilege;
  is_shared: boolean;
  mfa_status: MfaStatus;
  decision: Decision;
  decision_note: string | null;
  decided_by: string | null;
  decided_at: string | null;
  action_completed_at: string | null;
};

const REVIEW_STATUS_TONE: Record<ReviewStatus, ChipTone> = {
  open: "warning",
  in_progress: "accent",
  complete: "success",
};

const PRIVILEGES: Privilege[] = ["standard", "privileged", "admin", "service", "break_glass"];
const MFA_STATUSES: MfaStatus[] = ["enabled", "disabled", "unknown", "not_supported"];
const DECISIONS: Exclude<Decision, "pending">[] = ["retain", "modify", "revoke", "investigate"];

const PRIVILEGE_TONE: Record<Privilege, ChipTone> = {
  standard: "muted",
  privileged: "warning",
  admin: "warning",
  service: "muted",
  break_glass: "danger",
};

const MFA_TONE: Record<MfaStatus, ChipTone> = {
  enabled: "success",
  disabled: "danger",
  unknown: "warning",
  not_supported: "muted",
};

const DECISION_TONE: Record<Decision, ChipTone> = {
  pending: "warning",
  retain: "success",
  modify: "accent",
  revoke: "danger",
  investigate: "warning",
};

const pagePath = (id: string) => `/admin/soc2/access-reviews/${id}`;

// ── server actions ─────────────────────────────────────────────

async function addItem(formData: FormData) {
  "use server";
  const guard = await requireSoc2(...WRITE_ROLES);
  if (!guard.ok) return;
  const reviewId = String(formData.get("review_id") || "");
  const systemLabel = String(formData.get("system_label") || "").trim();
  const accountIdentifier = String(formData.get("account_identifier") || "").trim();
  const person = String(formData.get("person") || "").trim();
  const privilege = String(formData.get("privilege") || "");
  const mfaStatus = String(formData.get("mfa_status") || "");
  const isShared = formData.get("is_shared") === "on";
  if (!reviewId || !systemLabel || !accountIdentifier) return;
  if (!(PRIVILEGES as string[]).includes(privilege)) return;
  if (!(MFA_STATUSES as string[]).includes(mfaStatus)) return;

  const db = createServiceClient();
  const { data: review } = await db
    .from("soc2_access_reviews")
    .select("id, ref, status")
    .eq("id", reviewId)
    .maybeSingle();
  if (!review || review.status === "complete") return;
  const { error } = await db.from("soc2_access_review_items").insert({
    review_id: reviewId,
    system_label: systemLabel,
    account_identifier: accountIdentifier,
    person: person || null,
    privilege,
    is_shared: isShared,
    mfa_status: mfaStatus,
  });
  if (error) redirect(`${pagePath(reviewId)}?err=${encodeURIComponent(error.message)}`);
  await logSoc2Event({
    recordType: "access_review",
    recordId: reviewId,
    type: "item.added",
    summary: `${review.ref}: ${privilege.replace(/_/g, " ")} account added under ${systemLabel}.`,
    actor: guard.email,
  });
  revalidatePath(pagePath(reviewId));
}

async function decideItem(formData: FormData) {
  "use server";
  const guard = await requireSoc2(...WRITE_ROLES);
  if (!guard.ok) return;
  const itemId = String(formData.get("item_id") || "");
  const reviewId = String(formData.get("review_id") || "");
  const decision = String(formData.get("decision") || "");
  const note = String(formData.get("decision_note") || "").trim();
  if (!itemId || !reviewId || !(DECISIONS as string[]).includes(decision)) return;

  const db = createServiceClient();
  const [{ data: review }, { data: item }] = await Promise.all([
    db.from("soc2_access_reviews").select("id, ref, status").eq("id", reviewId).maybeSingle(),
    db
      .from("soc2_access_review_items")
      .select("id, review_id, system_label")
      .eq("id", itemId)
      .maybeSingle(),
  ]);
  if (!review || review.status === "complete") return;
  if (!item || item.review_id !== reviewId) return;
  const { error } = await db
    .from("soc2_access_review_items")
    .update({
      decision,
      decision_note: note || null,
      decided_by: guard.email,
      decided_at: new Date().toISOString(),
    })
    .eq("id", itemId);
  if (error) redirect(`${pagePath(reviewId)}?err=${encodeURIComponent(error.message)}`);
  if (review.status === "open") {
    await db.from("soc2_access_reviews").update({ status: "in_progress" }).eq("id", reviewId);
  }
  await logSoc2Event({
    recordType: "access_review",
    recordId: reviewId,
    type: "item.decided",
    summary: `${review.ref}: ${decision} decision recorded for an account on ${item.system_label} by ${guard.email}.`,
    actor: guard.email,
  });
  revalidatePath(pagePath(reviewId));
}

async function markActioned(formData: FormData) {
  "use server";
  const guard = await requireSoc2(...WRITE_ROLES);
  if (!guard.ok) return;
  const itemId = String(formData.get("item_id") || "");
  const reviewId = String(formData.get("review_id") || "");
  if (!itemId || !reviewId) return;

  const db = createServiceClient();
  const [{ data: review }, { data: item }] = await Promise.all([
    db.from("soc2_access_reviews").select("id, ref, status").eq("id", reviewId).maybeSingle(),
    db
      .from("soc2_access_review_items")
      .select("id, review_id, system_label, decision, action_completed_at")
      .eq("id", itemId)
      .maybeSingle(),
  ]);
  if (!review || review.status === "complete") return;
  if (!item || item.review_id !== reviewId) return;
  if (item.decision !== "modify" && item.decision !== "revoke") return;
  if (item.action_completed_at) return;
  const { error } = await db
    .from("soc2_access_review_items")
    .update({ action_completed_at: new Date().toISOString() })
    .eq("id", itemId);
  if (error) redirect(`${pagePath(reviewId)}?err=${encodeURIComponent(error.message)}`);
  await logSoc2Event({
    recordType: "access_review",
    recordId: reviewId,
    type: "item.actioned",
    summary: `${review.ref}: ${item.decision} completed for an account on ${item.system_label}.`,
    actor: guard.email,
  });
  revalidatePath(pagePath(reviewId));
}

async function completeReview(formData: FormData) {
  "use server";
  const guard = await requireSoc2(...WRITE_ROLES);
  if (!guard.ok) return;
  const id = String(formData.get("id") || "");
  const summary = String(formData.get("summary") || "").trim();
  const confirm = String(formData.get("confirm") || "");
  if (!id || !summary || confirm !== "COMPLETE") return;

  const db = createServiceClient();
  const { data: review } = await db
    .from("soc2_access_reviews")
    .select("id, ref, status")
    .eq("id", id)
    .maybeSingle();
  if (!review || review.status === "complete") return;
  const { error } = await db
    .from("soc2_access_reviews")
    .update({
      status: "complete",
      summary,
      reviewer_email: guard.email,
      completed_at: new Date().toISOString(),
    })
    .eq("id", id);
  // The DB refuses completion with undecided or unactioned items — show why.
  if (error) redirect(`${pagePath(id)}?err=${encodeURIComponent(error.message)}`);

  // File the completion record as evidence against IAM-05 (skip silently if
  // the control library has not been seeded yet).
  const { data: ctl } = await db
    .from("soc2_controls")
    .select("id")
    .eq("key", "IAM-05")
    .maybeSingle();
  if (ctl) {
    const { data: evidence } = await db
      .from("soc2_evidence_items")
      .insert({
        control_id: ctl.id,
        title: `Access review ${review.ref} completed`,
        source: "access_review",
        source_ref: `soc2_access_reviews:${id}`,
        collected_by: guard.email,
        classification: "confidential",
      })
      .select("id")
      .single();
    if (evidence) {
      await logSoc2Event({
        recordType: "evidence",
        recordId: evidence.id,
        type: "created",
        summary: `Evidence collected against IAM-05: access review ${review.ref} completion record.`,
        actor: guard.email,
      });
    }
  }
  await logSoc2Event({
    recordType: "access_review",
    recordId: id,
    type: "completed",
    summary: `${review.ref} completed by ${guard.email}; every account decided and every change actioned.`,
    actor: guard.email,
  });
  revalidatePath(pagePath(id));
  revalidatePath("/admin/soc2/access-reviews");
}

// ── page ───────────────────────────────────────────────────────

const ITEM_GRID = "1.1fr 1.4fr 1fr 110px 170px 150px";

export default async function AccessReviewDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ err?: string }>;
}) {
  const { id } = await params;
  const { err } = await searchParams;
  const supabase = await createClient();
  const [{ data: row }, { data: items }] = await Promise.all([
    supabase.from("soc2_access_reviews").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("soc2_access_review_items")
      .select("*")
      .eq("review_id", id)
      .order("system_label")
      .order("account_identifier"),
  ]);
  if (!row) notFound();
  const r = row as ReviewRow;
  const itemList = (items ?? []) as ItemRow[];
  const today = toDateOnly(new Date());
  const complete = r.status === "complete";
  const isOverdue = !complete && r.due_at < today;
  const decided = itemList.filter((it) => it.decision !== "pending").length;
  const unactioned = itemList.filter(
    (it) => (it.decision === "modify" || it.decision === "revoke") && !it.action_completed_at
  ).length;

  return (
    <div>
      <PageHeader
        index="12"
        label="SOC 2"
        title={r.ref}
        lead={r.title}
        actions={
          <div className="flex items-center gap-2">
            <StatusChip tone={REVIEW_STATUS_TONE[r.status]}>{r.status.replace(/_/g, " ")}</StatusChip>
            {isOverdue && <StatusChip tone="danger">overdue</StatusChip>}
          </div>
        }
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
        <div style={{ marginTop: 22 }}>
          <Panel label="// SCOPE & PROGRESS">
            <div className="flex flex-col gap-2.5">
              <p style={bodyText}>
                {r.scope_note ?? "No scope note recorded — say which providers this review covers."}
              </p>
              <p style={faintMono}>
                started by {r.started_by ?? "—"} · due{" "}
                <span style={{ color: isOverdue ? T.danger : undefined }}>{shortDate(r.due_at)}</span>{" "}
                · {decided}/{itemList.length} decided
                {unactioned > 0 ? ` · ${unactioned} change(s) awaiting action` : ""}
                {r.reviewer_email ? ` · reviewer ${r.reviewer_email}` : ""}
                {r.completed_at ? ` · completed ${shortDate(r.completed_at)}` : ""}
              </p>
              {complete && r.summary && (
                <p style={bodyText}>
                  <span style={monoLabel}>outcome · </span>
                  {r.summary}
                </p>
              )}
              {complete && (
                <p style={faintMono}>
                  Completion filed a confidential evidence item against control IAM-05.
                </p>
              )}
            </div>
          </Panel>
        </div>
      </Reveal>

      <Reveal delay={0.06}>
        <div style={{ marginTop: 18 }}>
          <Panel label="// ACCOUNTS UNDER REVIEW" pad={false}>
            {itemList.length === 0 ? (
              <EmptyRow>
                No accounts added yet. List every account on the covered systems below —
                including service accounts and anything shared.
              </EmptyRow>
            ) : (
              <div className="flex flex-col">
                <HeaderRow
                  grid={ITEM_GRID}
                  cols={["system", "account", "person", "privilege", "mfa / shared", "decision"]}
                />
                {itemList.map((it, i) => {
                  const needsAction =
                    (it.decision === "modify" || it.decision === "revoke") && !it.action_completed_at;
                  return (
                    <details key={it.id}>
                      <summary
                        className="grid md:grid gap-3 items-center px-4 py-2.5"
                        style={{
                          gridTemplateColumns: ITEM_GRID,
                          borderTop: i ? "1px solid var(--k-border)" : "none",
                          cursor: "pointer",
                          listStyle: "none",
                        }}
                      >
                        <span
                          className="min-w-0"
                          style={{ ...faintMono, overflow: "hidden", textOverflow: "ellipsis" }}
                          title={it.system_label}
                        >
                          {it.system_label}
                        </span>
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
                          title={it.account_identifier}
                        >
                          {it.account_identifier}
                        </span>
                        <span
                          className="min-w-0"
                          style={{ ...faintMono, overflow: "hidden", textOverflow: "ellipsis" }}
                          title={it.person ?? undefined}
                        >
                          {it.person ?? "unknown / service"}
                        </span>
                        <span>
                          <StatusChip tone={PRIVILEGE_TONE[it.privilege]}>
                            {it.privilege.replace(/_/g, " ")}
                          </StatusChip>
                        </span>
                        <span className="flex flex-wrap items-center gap-1.5">
                          <StatusChip tone={MFA_TONE[it.mfa_status]}>
                            mfa {it.mfa_status.replace(/_/g, " ")}
                          </StatusChip>
                          {it.is_shared && <StatusChip tone="warning">shared</StatusChip>}
                        </span>
                        <span className="flex flex-wrap items-center gap-1.5">
                          <StatusChip tone={DECISION_TONE[it.decision]}>{it.decision}</StatusChip>
                          {needsAction && <StatusChip tone="warning">awaiting action</StatusChip>}
                          {it.action_completed_at && <StatusChip tone="success">actioned</StatusChip>}
                        </span>
                      </summary>

                      <div
                        className="flex flex-col gap-3 px-4 py-4"
                        style={{ borderTop: "1px dashed var(--k-border)", background: "var(--k-bg)" }}
                      >
                        {it.decision !== "pending" && (
                          <p style={bodyText}>
                            <span style={monoLabel}>decision · </span>
                            {it.decision}
                            {it.decision_note ? ` — ${it.decision_note}` : ""} ({it.decided_by},{" "}
                            {shortDate(it.decided_at)})
                            {it.action_completed_at
                              ? ` · actioned ${shortDate(it.action_completed_at)}`
                              : ""}
                          </p>
                        )}
                        {!complete && (
                          <form action={decideItem} className="flex flex-wrap items-end gap-3">
                            <input type="hidden" name="item_id" value={it.id} />
                            <input type="hidden" name="review_id" value={r.id} />
                            <Field label="Decision">
                              <select
                                name="decision"
                                style={inp}
                                defaultValue={it.decision === "pending" ? "retain" : it.decision}
                              >
                                {DECISIONS.map((d) => (
                                  <option key={d} value={d}>
                                    {d}
                                  </option>
                                ))}
                              </select>
                            </Field>
                            <Field label="Decision note" grow>
                              <input
                                name="decision_note"
                                style={inp}
                                maxLength={500}
                                defaultValue={it.decision_note ?? ""}
                              />
                            </Field>
                            <SubmitButton style={primaryBtn}>Record decision</SubmitButton>
                          </form>
                        )}
                        {!complete && needsAction && (
                          <form action={markActioned}>
                            <input type="hidden" name="item_id" value={it.id} />
                            <input type="hidden" name="review_id" value={r.id} />
                            <SubmitButton style={actionBtn}>
                              Mark {it.decision} actioned (done on the provider)
                            </SubmitButton>
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

      {!complete && (
        <Reveal delay={0.08}>
          <div style={{ marginTop: 18 }}>
            <Panel label="// ADD ACCOUNT" title="Add an account to the roster">
              <form action={addItem} className="flex flex-col gap-3">
                <input type="hidden" name="review_id" value={r.id} />
                <div className="flex flex-wrap gap-3">
                  <Field label="System" grow>
                    <input
                      name="system_label"
                      style={inp}
                      required
                      maxLength={200}
                      placeholder="e.g. Supabase (prod)"
                    />
                  </Field>
                  <Field label="Account identifier" grow>
                    <input
                      name="account_identifier"
                      style={inp}
                      required
                      maxLength={200}
                      placeholder="the login/email under review"
                    />
                  </Field>
                  <Field label="Person" grow>
                    <input
                      name="person"
                      style={inp}
                      maxLength={200}
                      placeholder="blank = unknown / service"
                    />
                  </Field>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <Field label="Privilege">
                    <select name="privilege" style={inp} defaultValue="standard">
                      {PRIVILEGES.map((p) => (
                        <option key={p} value={p}>
                          {p.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="MFA">
                    <select name="mfa_status" style={inp} defaultValue="unknown">
                      {MFA_STATUSES.map((m) => (
                        <option key={m} value={m}>
                          {m.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <label className="flex items-center gap-2" style={{ height: 36 }}>
                    <input type="checkbox" name="is_shared" />
                    <span style={monoLabel}>shared credential</span>
                  </label>
                  <SubmitButton style={primaryBtn}>Add account</SubmitButton>
                </div>
                <p style={faintMono}>
                  Marking a credential shared is a declaration — the rules engine raises an
                  exception for it unless an approved exception already covers it.
                </p>
              </form>
            </Panel>
          </div>
        </Reveal>
      )}

      {!complete && (
        <Reveal delay={0.1}>
          <div style={{ marginTop: 18 }}>
            <Panel label="// COMPLETE REVIEW" title="Close out with a named reviewer">
              <form action={completeReview} className="flex flex-col gap-3">
                <input type="hidden" name="id" value={r.id} />
                <Field label="Summary (what was reviewed, what changed, anything escalated)">
                  <textarea name="summary" style={textarea} required maxLength={2000} />
                </Field>
                <p style={faintMono}>
                  The database refuses completion while any account is undecided or any
                  modify/revoke is not actioned. Completing files the review as evidence
                  against IAM-05.
                </p>
                <div className="flex items-center gap-3">
                  <input name="confirm" style={{ ...inp, width: 130 }} placeholder="COMPLETE" autoComplete="off" />
                  <SubmitButton style={primaryBtn}>Complete review</SubmitButton>
                </div>
              </form>
            </Panel>
          </div>
        </Reveal>
      )}
    </div>
  );
}
