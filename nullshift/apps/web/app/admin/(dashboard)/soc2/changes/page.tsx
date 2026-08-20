import type { ReactNode } from "react";
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
import {
  inp,
  textarea,
  primaryBtn,
  dangerBtn,
  actionBtn,
  Field,
  shortDate,
  EmptyRow,
  HeaderRow,
  monoLabel,
  faintMono,
  bodyText,
} from "../shared";

/**
 * Change & release controls — the record that every production change carried
 * its review, approval, test evidence and rollback plan before it shipped.
 * Deployed changes missing any of that trail are flagged high-severity by the
 * daily sweep; self-approved changes stay visible as such — for a small team
 * they are a fact to manage with the documented compensating control, not a
 * fact to hide. Every material transition is written to the domain trail.
 */

export const dynamic = "force-dynamic";

const PAGE = "/admin/soc2/changes";

type ChangeStatus = "draft" | "approved" | "deployed" | "rolled_back";

const CHANGE_STATUS_TONE: Record<ChangeStatus, ChipTone> = {
  draft: "muted",
  approved: "accent",
  deployed: "success",
  rolled_back: "danger",
};

type ChangeRow = {
  id: string;
  ref: string;
  title: string;
  asset_id: string | null;
  project_id: string | null;
  change_ref: string | null;
  ticket_ref: string | null;
  requested_by: string | null;
  reviewed_by: string | null;
  approved_by: string | null;
  test_evidence: string | null;
  rollback_plan: string | null;
  deployed_at: string | null;
  deploy_ref: string | null;
  status: ChangeStatus;
  created_at: string;
};

/** What a deployed change is missing from its trail (empty = complete). */
function missingTrail(r: ChangeRow): string[] {
  const gaps: string[] = [];
  if (!r.reviewed_by) gaps.push("review");
  if (!r.approved_by) gaps.push("approval");
  if (!r.test_evidence) gaps.push("test evidence");
  if (!r.rollback_plan) gaps.push("rollback plan");
  if (!r.ticket_ref) gaps.push("ticket");
  return gaps;
}

const isSelfApproved = (r: ChangeRow): boolean =>
  r.approved_by !== null && r.requested_by !== null && r.approved_by === r.requested_by;

// ── server actions ─────────────────────────────────────────────

async function createChange(formData: FormData) {
  "use server";
  const guard = await requireSoc2(...WRITE_ROLES);
  if (!guard.ok) return;

  const title = String(formData.get("title") || "").trim();
  const changeRef = String(formData.get("change_ref") || "").trim();
  const ticketRef = String(formData.get("ticket_ref") || "").trim();
  const testEvidence = String(formData.get("test_evidence") || "").trim();
  const rollbackPlan = String(formData.get("rollback_plan") || "").trim();
  if (!title) return;

  const db = createServiceClient();
  const { data: ref } = await db.rpc("next_soc2_change_ref");
  if (!ref) return;

  const { data: created, error } = await db
    .from("soc2_change_records")
    .insert({
      ref,
      title,
      change_ref: changeRef || null,
      ticket_ref: ticketRef || null,
      test_evidence: testEvidence || null,
      rollback_plan: rollbackPlan || null,
      requested_by: guard.email,
      status: "draft",
    })
    .select("id, ref")
    .single();
  if (error) redirect(`${PAGE}?err=${encodeURIComponent(error.message)}`);
  if (!created) return;

  await logSoc2Event({
    recordType: "change_record",
    recordId: created.id,
    type: "created",
    summary: `${created.ref} drafted by ${guard.email}: ${title.slice(0, 120)}`,
    detail: {
      change_ref: changeRef || null,
      ticket_ref: ticketRef || null,
      has_test_evidence: !!testEvidence,
      has_rollback_plan: !!rollbackPlan,
    },
    actor: guard.email,
  });
  revalidatePath(PAGE);
}

async function reviewChange(formData: FormData) {
  "use server";
  const guard = await requireSoc2(...WRITE_ROLES);
  if (!guard.ok) return;

  const id = String(formData.get("id") || "").trim();
  if (!id) return;

  const db = createServiceClient();
  const { data: change } = await db
    .from("soc2_change_records")
    .select("id, ref, status, requested_by")
    .eq("id", id)
    .maybeSingle();
  if (!change) return;
  if (change.status !== "draft" && change.status !== "approved") return;

  // Self-review is allowed — it stays visible in the trail rather than hidden.
  const selfReview = change.requested_by === guard.email;

  const { error } = await db
    .from("soc2_change_records")
    .update({ reviewed_by: guard.email })
    .eq("id", id)
    .in("status", ["draft", "approved"]);
  if (error) redirect(`${PAGE}?err=${encodeURIComponent(error.message)}`);

  await logSoc2Event({
    recordType: "change_record",
    recordId: id,
    type: "reviewed",
    summary: selfReview
      ? `${change.ref} review recorded by ${guard.email} (self-review: reviewer is the requester).`
      : `${change.ref} review recorded by ${guard.email}.`,
    detail: { self_review: selfReview, requested_by: change.requested_by },
    actor: guard.email,
  });
  revalidatePath(PAGE);
}

async function approveChange(formData: FormData) {
  "use server";
  const guard = await requireSoc2(...WRITE_ROLES);
  if (!guard.ok) return;

  const id = String(formData.get("id") || "").trim();
  const confirm = String(formData.get("confirm") || "").trim();
  if (!id || confirm !== "APPROVE") return;

  const db = createServiceClient();
  const { data: change } = await db
    .from("soc2_change_records")
    .select("id, ref, status, requested_by")
    .eq("id", id)
    .maybeSingle();
  if (!change || change.status !== "draft") return;

  // Self-approval is recorded, not blocked: it stays visible as a fact to
  // manage with the documented compensating control.
  const selfApproved = change.requested_by === guard.email;

  const { error } = await db
    .from("soc2_change_records")
    .update({ approved_by: guard.email, status: "approved" })
    .eq("id", id)
    .eq("status", "draft");
  if (error) redirect(`${PAGE}?err=${encodeURIComponent(error.message)}`);

  await logSoc2Event({
    recordType: "change_record",
    recordId: id,
    type: "approved",
    summary: selfApproved
      ? `${change.ref} approved by ${guard.email} (self-approved: approver is the requester).`
      : `${change.ref} approved by ${guard.email}.`,
    detail: { self_approved: selfApproved, requested_by: change.requested_by },
    actor: guard.email,
  });
  revalidatePath(PAGE);
}

async function markDeployed(formData: FormData) {
  "use server";
  const guard = await requireSoc2(...WRITE_ROLES);
  if (!guard.ok) return;

  const id = String(formData.get("id") || "").trim();
  const deployRef = String(formData.get("deploy_ref") || "").trim();
  if (!id || !deployRef) return;

  const db = createServiceClient();
  const { data: change } = await db
    .from("soc2_change_records")
    .select("id, ref, status, reviewed_by, approved_by, test_evidence, rollback_plan, ticket_ref, requested_by")
    .eq("id", id)
    .maybeSingle();
  if (!change || change.status !== "approved") return;

  const { error } = await db
    .from("soc2_change_records")
    .update({
      status: "deployed",
      deploy_ref: deployRef,
      deployed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "approved");
  if (error) redirect(`${PAGE}?err=${encodeURIComponent(error.message)}`);

  await logSoc2Event({
    recordType: "change_record",
    recordId: id,
    type: "deployed",
    summary: `${change.ref} marked deployed by ${guard.email} (${deployRef.slice(0, 120)}).`,
    detail: {
      deploy_ref: deployRef,
      has_review: !!change.reviewed_by,
      has_test_evidence: !!change.test_evidence,
      has_rollback_plan: !!change.rollback_plan,
      has_ticket: !!change.ticket_ref,
    },
    actor: guard.email,
  });
  revalidatePath(PAGE);
}

async function rollBack(formData: FormData) {
  "use server";
  const guard = await requireSoc2(...WRITE_ROLES);
  if (!guard.ok) return;

  const id = String(formData.get("id") || "").trim();
  const reason = String(formData.get("reason") || "").trim();
  const confirm = String(formData.get("confirm") || "").trim();
  if (!id || !reason || confirm !== "ROLLBACK") return;

  const db = createServiceClient();
  const { data: change } = await db
    .from("soc2_change_records")
    .select("id, ref, status, rollback_plan, deploy_ref")
    .eq("id", id)
    .maybeSingle();
  if (!change || change.status !== "deployed") return;

  const note = `Rolled back: ${reason}`;
  const plan = change.rollback_plan ? `${change.rollback_plan}\n\n${note}` : note;

  const { error } = await db
    .from("soc2_change_records")
    .update({ status: "rolled_back", rollback_plan: plan })
    .eq("id", id)
    .eq("status", "deployed");
  if (error) redirect(`${PAGE}?err=${encodeURIComponent(error.message)}`);

  await logSoc2Event({
    recordType: "change_record",
    recordId: id,
    type: "rolled_back",
    summary: `${change.ref} rolled back by ${guard.email}; reason recorded on the rollback plan.`,
    detail: { deploy_ref: change.deploy_ref },
    actor: guard.email,
  });
  revalidatePath(PAGE);
}

async function updateChange(formData: FormData) {
  "use server";
  const guard = await requireSoc2(...WRITE_ROLES);
  if (!guard.ok) return;

  const id = String(formData.get("id") || "").trim();
  const changeRef = String(formData.get("change_ref") || "").trim();
  const ticketRef = String(formData.get("ticket_ref") || "").trim();
  const testEvidence = String(formData.get("test_evidence") || "").trim();
  const rollbackPlan = String(formData.get("rollback_plan") || "").trim();
  if (!id) return;

  const db = createServiceClient();
  const { data: change } = await db
    .from("soc2_change_records")
    .select("id, ref, status")
    .eq("id", id)
    .maybeSingle();
  if (!change) return;
  if (change.status !== "draft" && change.status !== "approved") return;

  const { error } = await db
    .from("soc2_change_records")
    .update({
      change_ref: changeRef || null,
      ticket_ref: ticketRef || null,
      test_evidence: testEvidence || null,
      rollback_plan: rollbackPlan || null,
    })
    .eq("id", id)
    .in("status", ["draft", "approved"]);
  if (error) redirect(`${PAGE}?err=${encodeURIComponent(error.message)}`);

  await logSoc2Event({
    recordType: "change_record",
    recordId: id,
    type: "updated",
    summary: `${change.ref} record updated by ${guard.email} while ${change.status}.`,
    detail: {
      status: change.status,
      change_ref: changeRef || null,
      ticket_ref: ticketRef || null,
      has_test_evidence: !!testEvidence,
      has_rollback_plan: !!rollbackPlan,
    },
    actor: guard.email,
  });
  revalidatePath(PAGE);
}

// ── page ───────────────────────────────────────────────────────

const GRID = "90px 1.6fr 130px 170px 190px 110px";

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <span style={monoLabel}>{label}</span>
      <span style={{ ...bodyText, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
        {children}
      </span>
    </div>
  );
}

/** A stored reference — rendered as a link when it is a URL. */
function RefValue({ value }: { value: string | null }) {
  if (!value) return <>—</>;
  if (value.startsWith("http")) {
    return (
      <a
        href={value}
        target="_blank"
        rel="noreferrer"
        style={{
          fontFamily: T.mono,
          fontSize: "11px",
          letterSpacing: "0.04em",
          color: "var(--k-accent)",
          overflowWrap: "anywhere",
        }}
      >
        {value}
      </a>
    );
  }
  return (
    <span style={{ fontFamily: T.mono, fontSize: "11px", letterSpacing: "0.04em" }}>{value}</span>
  );
}

export default async function ChangesPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>;
}) {
  const { err } = await searchParams;

  const supabase = await createClient();
  const [{ data: changeRows }] = await Promise.all([
    supabase
      .from("soc2_change_records")
      .select(
        "id, ref, title, asset_id, project_id, change_ref, ticket_ref, requested_by, reviewed_by, approved_by, test_evidence, rollback_plan, deployed_at, deploy_ref, status, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(400),
  ]);
  const changes = (changeRows ?? []) as ChangeRow[];

  const monthKey = new Date().toISOString().slice(0, 7);
  const deployedThisMonth = changes.filter(
    (r) => r.deployed_at !== null && r.deployed_at.slice(0, 7) === monthKey
  );
  const drafts = changes.filter((r) => r.status === "draft");
  const selfApprovedDeployed = changes.filter(
    (r) => r.status === "deployed" && isSelfApproved(r)
  );
  const flaggedIncomplete = changes.filter(
    (r) => r.status === "deployed" && missingTrail(r).length > 0
  );

  return (
    <div>
      <PageHeader
        index="12"
        label="SOC 2"
        title="Change & release controls"
        lead="Every production change carries its review, approval, test evidence and rollback plan — deployed changes missing any of it are flagged high-severity by the daily sweep, and self-approved changes stay visible as a fact to manage with the documented compensating control, not to hide."
      />

      {err && (
        <p
          style={{
            fontFamily: T.mono,
            fontSize: "11px",
            letterSpacing: "0.05em",
            color: T.danger,
            border: `1px solid ${T.danger}55`,
            padding: "10px 14px",
            marginTop: 20,
          }}
        >
          ERR: {err}
        </p>
      )}

      <Reveal delay={0.04}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3" style={{ marginTop: 22 }}>
          <StatCard value={String(deployedThisMonth.length)} label="Deployed this month" />
          <StatCard value={String(drafts.length)} label="Drafts" />
          <StatCard
            value={String(selfApprovedDeployed.length)}
            label="Self-approved deployed"
            sub={
              selfApprovedDeployed.length
                ? "Requester and approver are the same person — covered by the documented compensating control."
                : undefined
            }
          />
          <StatCard
            value={String(flaggedIncomplete.length)}
            label="Flagged incomplete"
            sub={
              flaggedIncomplete.length
                ? "Deployed with review, approval, test evidence, rollback plan or ticket missing — the daily sweep raises these high-severity."
                : undefined
            }
          />
        </div>
      </Reveal>

      <Reveal delay={0.08}>
        <div style={{ marginTop: 18 }}>
          <Panel label="// CHANGE RECORDS" pad={false}>
            {changes.length === 0 ? (
              <EmptyRow>
                No change records yet — record the first production change below with its PR,
                ticket, test evidence and rollback plan.
              </EmptyRow>
            ) : (
              <div className="flex flex-col">
                <HeaderRow
                  grid={GRID}
                  cols={["ref", "title", "status", "requested by", "approved by", "deployed"]}
                />
                {changes.map((r, i) => {
                  const gaps = r.status === "deployed" ? missingTrail(r) : [];
                  const selfApproved = isSelfApproved(r);
                  return (
                    <details key={r.id}>
                      <summary
                        className="grid md:grid gap-3 items-center px-4 py-2.5"
                        style={{
                          gridTemplateColumns: GRID,
                          borderTop: i ? "1px solid var(--k-border)" : "none",
                          cursor: "pointer",
                          listStyle: "none",
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
                        <span className="flex flex-col items-start gap-1">
                          <StatusChip tone={CHANGE_STATUS_TONE[r.status]}>
                            {r.status.replace(/_/g, " ")}
                          </StatusChip>
                          {gaps.length > 0 && (
                            <StatusChip tone="warning">trail incomplete</StatusChip>
                          )}
                        </span>
                        <span
                          className="min-w-0"
                          style={{ ...faintMono, overflow: "hidden", textOverflow: "ellipsis" }}
                          title={r.requested_by ?? undefined}
                        >
                          {r.requested_by ?? "—"}
                        </span>
                        <span className="flex flex-wrap items-center gap-1.5 min-w-0">
                          <span
                            className="min-w-0"
                            style={{ ...faintMono, overflow: "hidden", textOverflow: "ellipsis" }}
                            title={r.approved_by ?? undefined}
                          >
                            {r.approved_by ?? "—"}
                          </span>
                          {selfApproved && <StatusChip tone="warning">self-approved</StatusChip>}
                        </span>
                        <span style={faintMono}>
                          {r.deployed_at ? shortDate(r.deployed_at) : "—"}
                        </span>
                      </summary>

                      <div
                        className="grid md:grid-cols-2 gap-x-6 gap-y-3 px-4 py-4"
                        style={{ borderTop: "1px dashed var(--k-border)", background: "var(--k-bg)" }}
                      >
                        <Meta label="Change ref (PR / commit range)">
                          <RefValue value={r.change_ref} />
                        </Meta>
                        <Meta label="Ticket ref">
                          <RefValue value={r.ticket_ref} />
                        </Meta>
                        <Meta label="Test evidence">{r.test_evidence || "—"}</Meta>
                        <Meta label="Rollback plan">{r.rollback_plan || "—"}</Meta>
                        <Meta label="Deploy ref">
                          <RefValue value={r.deploy_ref} />
                        </Meta>
                        <Meta label="Reviewed by">
                          {r.reviewed_by
                            ? r.reviewed_by === r.requested_by
                              ? `${r.reviewed_by} (self-review)`
                              : r.reviewed_by
                            : "—"}
                        </Meta>
                        <Meta label="Recorded">{shortDate(r.created_at)}</Meta>
                        {r.deployed_at && (
                          <Meta label="Deployed at">{shortDate(r.deployed_at)}</Meta>
                        )}
                        {gaps.length > 0 && (
                          <p className="md:col-span-2" style={{ ...faintMono, color: T.warning }}>
                            Deployed with missing trail: {gaps.join(", ")}.
                          </p>
                        )}
                      </div>

                      {/* Edit refs / evidence / rollback plan while draft or approved */}
                      {(r.status === "draft" || r.status === "approved") && (
                        <form
                          action={updateChange}
                          className="flex flex-wrap items-end gap-3 px-4 py-4"
                          style={{ borderTop: "1px dashed var(--k-border)", background: "var(--k-bg)" }}
                        >
                          <input type="hidden" name="id" value={r.id} />
                          <Field label="Change ref (PR URL)" grow>
                            <input
                              name="change_ref"
                              style={inp}
                              maxLength={500}
                              defaultValue={r.change_ref ?? ""}
                              placeholder="https://github.com/…/pull/123"
                            />
                          </Field>
                          <Field label="Ticket ref" grow>
                            <input
                              name="ticket_ref"
                              style={inp}
                              maxLength={500}
                              defaultValue={r.ticket_ref ?? ""}
                              placeholder="issues:<id> / change_orders:<id>"
                            />
                          </Field>
                          <Field label="Test evidence (what was run and its outcome — references, not log dumps)" grow>
                            <textarea
                              name="test_evidence"
                              style={textarea}
                              maxLength={4000}
                              defaultValue={r.test_evidence ?? ""}
                            />
                          </Field>
                          <Field label="Rollback plan" grow>
                            <textarea
                              name="rollback_plan"
                              style={textarea}
                              maxLength={4000}
                              defaultValue={r.rollback_plan ?? ""}
                            />
                          </Field>
                          <SubmitButton style={primaryBtn}>Save changes</SubmitButton>
                        </form>
                      )}

                      {/* Review — allowed for the requester too; recorded as self-review */}
                      {(r.status === "draft" || r.status === "approved") && (
                        <form
                          action={reviewChange}
                          className="flex flex-wrap items-center gap-3 px-4 py-4"
                          style={{ borderTop: "1px dashed var(--k-border)", background: "var(--k-bg)" }}
                        >
                          <input type="hidden" name="id" value={r.id} />
                          <SubmitButton style={actionBtn}>Record my review</SubmitButton>
                          <p style={faintMono}>
                            Sets you as reviewer. A self-review is allowed and recorded as such in
                            the trail.
                          </p>
                        </form>
                      )}

                      {/* Approve — only from draft; typed confirmation */}
                      {r.status === "draft" && (
                        <form
                          action={approveChange}
                          className="flex flex-wrap items-center gap-3 px-4 py-4"
                          style={{ borderTop: "1px dashed var(--k-border)", background: "var(--k-bg)" }}
                        >
                          <input type="hidden" name="id" value={r.id} />
                          <input
                            name="confirm"
                            placeholder="type APPROVE"
                            autoComplete="off"
                            style={{ ...inp, fontFamily: T.mono, width: 140 }}
                          />
                          <SubmitButton style={primaryBtn}>Approve change</SubmitButton>
                          <p style={faintMono}>
                            Sets you as approver. Approving your own request stays visible as
                            self-approved.
                          </p>
                        </form>
                      )}

                      {/* Deploy — only from approved */}
                      {r.status === "approved" && (
                        <form
                          action={markDeployed}
                          className="flex flex-wrap items-end gap-3 px-4 py-4"
                          style={{ borderTop: "1px dashed var(--k-border)", background: "var(--k-bg)" }}
                        >
                          <input type="hidden" name="id" value={r.id} />
                          <Field label="Deploy ref (Vercel deployment / release tag)" grow>
                            <input
                              name="deploy_ref"
                              style={inp}
                              required
                              maxLength={500}
                              placeholder="dpl_… / v2026.08.20"
                            />
                          </Field>
                          <SubmitButton style={primaryBtn}>Mark deployed</SubmitButton>
                        </form>
                      )}

                      {/* Roll back — only from deployed; typed confirmation */}
                      {r.status === "deployed" && (
                        <form
                          action={rollBack}
                          className="flex flex-col gap-3 px-4 py-4"
                          style={{ borderTop: "1px dashed var(--k-border)", background: "var(--k-bg)" }}
                        >
                          <input type="hidden" name="id" value={r.id} />
                          <Field label="Rollback reason (appended to the rollback plan)" grow>
                            <textarea
                              name="reason"
                              style={textarea}
                              required
                              maxLength={2000}
                              placeholder="What went wrong and what was restored."
                            />
                          </Field>
                          <div className="flex flex-wrap items-center gap-3">
                            <input
                              name="confirm"
                              placeholder="type ROLLBACK"
                              autoComplete="off"
                              style={{ ...inp, fontFamily: T.mono, width: 150 }}
                            />
                            <SubmitButton style={dangerBtn}>Roll back</SubmitButton>
                          </div>
                        </form>
                      )}
                    </details>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>
      </Reveal>

      {/* Record a change */}
      <Reveal delay={0.12}>
        <div style={{ marginTop: 18 }}>
          <Panel label="// RECORD A CHANGE" title="Shipping something to production?">
            <form action={createChange} className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-3">
                <Field label="Title" grow>
                  <input
                    name="title"
                    style={inp}
                    required
                    maxLength={200}
                    placeholder="What is changing, in one sentence"
                  />
                </Field>
                <Field label="Change ref (PR URL)" grow>
                  <input
                    name="change_ref"
                    style={inp}
                    maxLength={500}
                    placeholder="https://github.com/…/pull/123"
                  />
                </Field>
                <Field label="Ticket ref" grow>
                  <input
                    name="ticket_ref"
                    style={inp}
                    maxLength={500}
                    placeholder="issues:<id> / change_orders:<id>"
                  />
                </Field>
              </div>
              <Field label="Test evidence (what was run and its outcome — references, not log dumps)">
                <textarea name="test_evidence" style={textarea} maxLength={4000} />
              </Field>
              <Field label="Rollback plan">
                <textarea
                  name="rollback_plan"
                  style={textarea}
                  maxLength={4000}
                  placeholder="How this change is reversed if it goes wrong."
                />
              </Field>
              <div className="flex flex-wrap items-center gap-3">
                <SubmitButton style={primaryBtn}>Record change</SubmitButton>
                <p style={faintMono}>
                  You are recorded as the requester. Review and approval come next — a change
                  deployed without them is flagged by the daily sweep.
                </p>
              </div>
            </form>
          </Panel>
        </div>
      </Reveal>
    </div>
  );
}
