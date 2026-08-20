import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { createClient, createServiceClient } from "@nullshift/db";
import { T } from "@nullshift/ui/tokens";
import { PageHeader, Panel, StatusChip } from "@/components/app/AppKit";
import { Reveal } from "@/components/kyma";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { requireSoc2, WRITE_ROLES } from "@/lib/soc2/guard";
import { logSoc2Event } from "@/lib/soc2/events";
import { addDays } from "@/lib/soc2/schedule";
import { POLICY_STATUS_TONE, SCOPE_STATUS_TONE } from "@/lib/soc2/ui";
import {
  EmptyRow,
  Field,
  HeaderRow,
  bodyText,
  faintMono,
  inp,
  monoLabel,
  primaryBtn,
  shortDate,
  textarea,
} from "../../shared";

/**
 * Policy detail — one policy's working record: its current approved text, its
 * full version history, and who has acknowledged the text in force. Versions
 * carry the words; the policy row is the stable identity. Approval is a named
 * human's decision (Programme Owner, typed confirmation, DB-enforced named
 * approver) — the system never approves a policy. A new draft never changes
 * the live policy: the previous approved version stays in force until the
 * draft is itself approved.
 */

export const dynamic = "force-dynamic";

type PolicyRow = {
  id: string;
  key: string;
  title: string;
  owner_email: string | null;
  approver_email: string | null;
  status: "draft" | "in_review" | "approved" | "retired";
  current_version: number;
  effective_date: string | null;
  review_due_at: string | null;
  requires_acknowledgement: boolean;
  acknowledgement_audience: string;
  legal_review_required: boolean;
};

type VersionRow = {
  id: string;
  policy_id: string;
  version: number;
  body_md: string;
  changelog: string | null;
  status: "draft" | "approved" | "superseded";
  approved_by: string | null;
  approved_at: string | null;
  created_by: string | null;
  created_at: string;
};

type AckRow = {
  id: string;
  policy_version_id: string;
  user_email: string;
  acknowledged_at: string;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const VERSION_GRID = "60px 110px 1.5fr 1fr 1.2fr";
const ACK_GRID = "1.6fr 170px";

// ── server actions ─────────────────────────────────────────────

async function updateMeta(formData: FormData) {
  "use server";
  const guard = await requireSoc2(...WRITE_ROLES);
  if (!guard.ok) return;
  const id = String(formData.get("id") || "").trim();
  if (!id) return;
  const ownerEmail = String(formData.get("owner_email") || "").trim().toLowerCase() || null;
  if (ownerEmail && !ownerEmail.includes("@")) return;
  const approverEmail =
    String(formData.get("approver_email") || "").trim().toLowerCase() || null;
  if (approverEmail && !approverEmail.includes("@")) return;
  const reviewDueAt = String(formData.get("review_due_at") || "").trim() || null;
  if (reviewDueAt && !DATE_RE.test(reviewDueAt)) return;

  const db = createServiceClient();
  const { data: policyData } = await db
    .from("soc2_policies")
    .select("id, key")
    .eq("id", id)
    .maybeSingle();
  const policy = policyData as { id: string; key: string } | null;
  if (!policy) return;

  const { error } = await db
    .from("soc2_policies")
    .update({
      owner_email: ownerEmail,
      approver_email: approverEmail,
      review_due_at: reviewDueAt,
    })
    .eq("id", id);
  if (error)
    redirect(`/admin/soc2/policies/${policy.key}?err=${encodeURIComponent(error.message)}`);

  await logSoc2Event({
    recordType: "policy",
    recordId: id,
    type: "meta.updated",
    summary: `Policy ${policy.key} register entry updated (owner, approver or review date).`,
    detail: { owner_email: ownerEmail, approver_email: approverEmail, review_due_at: reviewDueAt },
    actor: guard.email,
  });
  revalidatePath(`/admin/soc2/policies/${policy.key}`);
  revalidatePath("/admin/soc2/policies");
}

async function approvePolicyVersion(formData: FormData) {
  "use server";
  const guard = await requireSoc2("programme_owner");
  if (!guard.ok) return;
  const versionId = String(formData.get("version_id") || "").trim();
  const confirm = String(formData.get("confirm") || "").trim();
  if (!versionId || confirm !== "APPROVE") return;

  const db = createServiceClient();
  const { data: versionData } = await db
    .from("soc2_policy_versions")
    .select("id, policy_id, version, status, created_by")
    .eq("id", versionId)
    .maybeSingle();
  const version = versionData as
    | { id: string; policy_id: string; version: number; status: string; created_by: string | null }
    | null;
  if (!version || version.status !== "draft") return;
  const { data: policyData } = await db
    .from("soc2_policies")
    .select("id, key")
    .eq("id", version.policy_id)
    .maybeSingle();
  const policy = policyData as { id: string; key: string } | null;
  if (!policy) return;

  // Named approver + time — the DB trigger refuses an approval without them.
  const { error } = await db
    .from("soc2_policy_versions")
    .update({
      status: "approved",
      approved_by: guard.email,
      approved_at: new Date().toISOString(),
    })
    .eq("id", versionId);
  if (error)
    redirect(`/admin/soc2/policies/${policy.key}?err=${encodeURIComponent(error.message)}`);

  // Supersede any older approved versions: exactly one version is in force.
  const { error: supersedeError } = await db
    .from("soc2_policy_versions")
    .update({ status: "superseded" })
    .eq("policy_id", policy.id)
    .eq("status", "approved")
    .neq("id", versionId);
  if (supersedeError)
    redirect(
      `/admin/soc2/policies/${policy.key}?err=${encodeURIComponent(supersedeError.message)}`
    );

  const today = new Date().toISOString().slice(0, 10);
  const reviewDueAt = addDays(today, 366);
  const { error: policyError } = await db
    .from("soc2_policies")
    .update({
      status: "approved",
      current_version: version.version,
      effective_date: today,
      review_due_at: reviewDueAt,
    })
    .eq("id", policy.id);
  if (policyError)
    redirect(
      `/admin/soc2/policies/${policy.key}?err=${encodeURIComponent(policyError.message)}`
    );

  // Small-team reality, recorded honestly: a self-approval is allowed but the
  // trail says so in plain terms.
  const selfApproved =
    !!version.created_by &&
    version.created_by.toLowerCase() === guard.email.toLowerCase();
  await logSoc2Event({
    recordType: "policy_version",
    recordId: versionId,
    type: "version.approved",
    summary: `Policy ${policy.key} v${version.version} approved by ${guard.email}; effective ${today}, review due ${reviewDueAt}.${
      selfApproved ? " Approver is also the draft's author (self-approval recorded)." : ""
    }`,
    detail: {
      version: version.version,
      effective_date: today,
      review_due_at: reviewDueAt,
      self_approved: selfApproved,
      created_by: version.created_by,
    },
    actor: guard.email,
  });
  revalidatePath(`/admin/soc2/policies/${policy.key}`);
  revalidatePath("/admin/soc2/policies");
}

async function createNewVersion(formData: FormData) {
  "use server";
  const guard = await requireSoc2(...WRITE_ROLES);
  if (!guard.ok) return;
  const policyId = String(formData.get("policy_id") || "").trim();
  const bodyMd = String(formData.get("body_md") || "").trim();
  const changelog = String(formData.get("changelog") || "").trim();
  if (!policyId || !bodyMd) return;

  const db = createServiceClient();
  const { data: policyData } = await db
    .from("soc2_policies")
    .select("id, key")
    .eq("id", policyId)
    .maybeSingle();
  const policy = policyData as { id: string; key: string } | null;
  if (!policy) return;

  const { data: latestData } = await db
    .from("soc2_policy_versions")
    .select("version")
    .eq("policy_id", policyId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const latest = latestData as { version: number } | null;
  const nextVersion = (latest?.version ?? 0) + 1;

  const { data: created, error } = await db
    .from("soc2_policy_versions")
    .insert({
      policy_id: policyId,
      version: nextVersion,
      body_md: bodyMd,
      changelog: changelog || null,
      status: "draft",
      created_by: guard.email,
    })
    .select("id")
    .single();
  if (error || !created)
    redirect(
      `/admin/soc2/policies/${policy.key}?err=${encodeURIComponent(
        error?.message ?? "Version could not be created."
      )}`
    );

  await logSoc2Event({
    recordType: "policy_version",
    recordId: (created as { id: string }).id,
    type: "version.created",
    summary: `Policy ${policy.key} v${nextVersion} drafted by ${guard.email}; awaiting human review and approval.`,
    detail: { version: nextVersion, has_changelog: !!changelog },
    actor: guard.email,
  });
  revalidatePath(`/admin/soc2/policies/${policy.key}`);
  revalidatePath("/admin/soc2/policies");
}

async function acknowledgePolicy(formData: FormData) {
  "use server";
  // Any live programme role may acknowledge — including plain staff — except
  // auditors, who are read-only.
  const guard = await requireSoc2();
  if (!guard.ok) return;
  if (guard.roles.length > 0 && guard.roles.every((r) => r === "auditor")) return;
  const versionId = String(formData.get("version_id") || "").trim();
  if (!versionId) return;

  const db = createServiceClient();
  const { data: versionData } = await db
    .from("soc2_policy_versions")
    .select("id, policy_id, version, status")
    .eq("id", versionId)
    .maybeSingle();
  const version = versionData as
    | { id: string; policy_id: string; version: number; status: string }
    | null;
  if (!version || version.status !== "approved") return;
  const { data: policyData } = await db
    .from("soc2_policies")
    .select("id, key, status, current_version, requires_acknowledgement")
    .eq("id", version.policy_id)
    .maybeSingle();
  const policy = policyData as
    | {
        id: string;
        key: string;
        status: string;
        current_version: number;
        requires_acknowledgement: boolean;
      }
    | null;
  if (
    !policy ||
    policy.status !== "approved" ||
    !policy.requires_acknowledgement ||
    policy.current_version !== version.version
  )
    return;

  const { data: inserted, error } = await db
    .from("soc2_policy_acknowledgements")
    .upsert(
      { policy_version_id: versionId, user_email: guard.email.toLowerCase() },
      { onConflict: "policy_version_id,user_email", ignoreDuplicates: true }
    )
    .select("id");
  if (error)
    redirect(`/admin/soc2/policies/${policy.key}?err=${encodeURIComponent(error.message)}`);
  if (!inserted || inserted.length === 0) return; // already acknowledged

  await logSoc2Event({
    recordType: "policy_version",
    recordId: versionId,
    type: "acknowledged",
    summary: `Policy ${policy.key} v${version.version} acknowledged by ${guard.email}.`,
    detail: { version: version.version },
    actor: guard.email,
  });
  revalidatePath(`/admin/soc2/policies/${policy.key}`);
  revalidatePath("/admin/soc2/policies");
}

// ── page ───────────────────────────────────────────────────────

export default async function Soc2PolicyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ err?: string }>;
}) {
  const { key } = await params;
  const sp = await searchParams;
  const err = sp.err || null;

  const supabase = await createClient();
  // The viewer's identity decides whether the acknowledge button shows.
  const [viewer, { data: policyRow }] = await Promise.all([
    requireSoc2(),
    supabase
      .from("soc2_policies")
      .select(
        "id, key, title, owner_email, approver_email, status, current_version, effective_date, review_due_at, requires_acknowledgement, acknowledgement_audience, legal_review_required"
      )
      .eq("key", key)
      .maybeSingle(),
  ]);
  if (!policyRow) notFound();
  const policy = policyRow as PolicyRow;

  const { data: versionRows } = await supabase
    .from("soc2_policy_versions")
    .select(
      "id, policy_id, version, body_md, changelog, status, approved_by, approved_at, created_by, created_at"
    )
    .eq("policy_id", policy.id)
    .order("version", { ascending: false });
  const versions = (versionRows ?? []) as VersionRow[];
  const currentVersion =
    versions.find((v) => v.version === policy.current_version) ?? null;

  const { data: ackRows } = currentVersion
    ? await supabase
        .from("soc2_policy_acknowledgements")
        .select("id, policy_version_id, user_email, acknowledged_at")
        .eq("policy_version_id", currentVersion.id)
        .order("acknowledged_at", { ascending: false })
    : { data: null };
  const acks = (ackRows ?? []) as AckRow[];

  const today = new Date().toISOString().slice(0, 10);
  const reviewOverdue = policy.review_due_at !== null && policy.review_due_at < today;

  const viewerEmail = viewer.ok ? viewer.email.toLowerCase() : null;
  const viewerIsAuditorOnly =
    viewer.ok && viewer.roles.length > 0 && viewer.roles.every((r) => r === "auditor");
  const viewerAck = viewerEmail
    ? acks.find((a) => a.user_email.toLowerCase() === viewerEmail) ?? null
    : null;

  const showAcknowledgements =
    policy.status === "approved" && policy.requires_acknowledgement;

  return (
    <div>
      <PageHeader
        index="12"
        label="SOC 2"
        title={policy.title}
        lead="One policy's working record: the text in force, its version history and approval trail, and who has acknowledged the current version."
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusChip tone={POLICY_STATUS_TONE[policy.status] ?? "muted"}>
              {policy.status.replace(/_/g, " ")}
            </StatusChip>
            {policy.legal_review_required && (
              <StatusChip tone="warning">legal review required</StatusChip>
            )}
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
            border: `1px solid ${T.danger}55`,
            padding: "10px 14px",
            marginTop: 20,
          }}
        >
          {err}
        </p>
      )}

      <div className="flex flex-col gap-5" style={{ marginTop: 28 }}>
        <Reveal delay={0.05}>
          <Panel label="// STATUS">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-1.5">
                <StatusChip tone={POLICY_STATUS_TONE[policy.status] ?? "muted"}>
                  {policy.status.replace(/_/g, " ")}
                </StatusChip>
                {!policy.owner_email && <StatusChip tone="warning">unowned</StatusChip>}
                {policy.legal_review_required && (
                  <StatusChip tone="warning">legal review required</StatusChip>
                )}
                {policy.requires_acknowledgement ? (
                  <StatusChip tone="accent">
                    ack required: {policy.acknowledgement_audience.replace(/_/g, " ")}
                  </StatusChip>
                ) : (
                  <StatusChip tone="muted">no acknowledgement required</StatusChip>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <span style={faintMono}>key: {policy.key}</span>
                <span style={faintMono}>current version: v{policy.current_version}</span>
                <span style={faintMono}>effective: {shortDate(policy.effective_date)}</span>
                <span style={{ ...faintMono, color: reviewOverdue ? T.danger : undefined }}>
                  review due: {shortDate(policy.review_due_at)}
                  {reviewOverdue ? " · overdue" : ""}
                </span>
                <span style={faintMono}>owner: {policy.owner_email ?? "unowned"}</span>
                <span style={faintMono}>approver: {policy.approver_email ?? "—"}</span>
              </div>
              <form
                action={updateMeta}
                className="flex flex-wrap items-end gap-3"
                style={{ paddingTop: 12, borderTop: "1px solid var(--k-border)" }}
              >
                <input type="hidden" name="id" value={policy.id} />
                <Field label="Owner email" grow>
                  <input
                    name="owner_email"
                    defaultValue={policy.owner_email ?? ""}
                    placeholder="owner@nullshift.co"
                    autoComplete="off"
                    style={inp}
                  />
                </Field>
                <Field label="Approver email" grow>
                  <input
                    name="approver_email"
                    defaultValue={policy.approver_email ?? ""}
                    placeholder="approver@nullshift.co"
                    autoComplete="off"
                    style={inp}
                  />
                </Field>
                <Field label="Review due">
                  <input
                    type="date"
                    name="review_due_at"
                    defaultValue={policy.review_due_at ?? ""}
                    style={{ ...inp, width: 160 }}
                  />
                </Field>
                <SubmitButton style={primaryBtn}>Save</SubmitButton>
              </form>
            </div>
          </Panel>
        </Reveal>

        <Reveal delay={0.1}>
          <Panel label={`// CURRENT VERSION — V${policy.current_version}`}>
            {currentVersion ? (
              <div className="flex flex-col gap-3">
                {currentVersion.status === "draft" && (
                  <div className="flex flex-col gap-2">
                    <div>
                      <StatusChip tone="warning">DRAFT — not yet approved</StatusChip>
                    </div>
                    {policy.legal_review_required && (
                      <p style={{ ...bodyText, color: T.danger }}>
                        Legal review required before approval.
                      </p>
                    )}
                  </div>
                )}
                <div
                  style={{
                    fontFamily: T.sans,
                    fontSize: "0.85rem",
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                    color: "var(--k-fg)",
                  }}
                >
                  {currentVersion.body_md}
                </div>
                <div
                  className="flex flex-wrap items-center gap-x-6 gap-y-2"
                  style={{ paddingTop: 10, borderTop: "1px solid var(--k-border)" }}
                >
                  <span style={faintMono}>
                    drafted by {currentVersion.created_by ?? "—"} ·{" "}
                    {shortDate(currentVersion.created_at)}
                  </span>
                  {currentVersion.approved_by ? (
                    <span style={faintMono}>
                      approved by {currentVersion.approved_by} ·{" "}
                      {shortDate(currentVersion.approved_at)}
                    </span>
                  ) : (
                    <span style={faintMono}>not approved</span>
                  )}
                </div>
              </div>
            ) : (
              <EmptyRow>
                No version row matches the register&apos;s current version pointer. Draft
                a new version below to restore the text.
              </EmptyRow>
            )}
          </Panel>
        </Reveal>

        <Reveal delay={0.15}>
          <Panel label="// VERSIONS & APPROVAL" pad={false}>
            <HeaderRow
              grid={VERSION_GRID}
              cols={["Ver", "Status", "Changelog", "Drafted by", "Approved"]}
            />
            {versions.length === 0 && (
              <EmptyRow>
                No versions recorded yet. Draft the first version below — a named human
                then reviews and approves it.
              </EmptyRow>
            )}
            {versions.map((v, i) => (
              <div key={v.id} style={{ borderTop: i ? "1px solid var(--k-border)" : "none" }}>
                <div
                  className="grid md:grid gap-3 items-center px-4 py-2.5"
                  style={{ gridTemplateColumns: VERSION_GRID }}
                >
                  <span style={{ fontFamily: T.mono, fontSize: "0.75rem", color: "var(--k-fg)" }}>
                    v{v.version}
                  </span>
                  <span>
                    {/* Version statuses share the draft/approved/superseded shape. */}
                    <StatusChip tone={SCOPE_STATUS_TONE[v.status] ?? "muted"}>
                      {v.status.replace(/_/g, " ")}
                    </StatusChip>
                  </span>
                  <span
                    className="min-w-0"
                    style={{ fontFamily: T.sans, fontSize: "0.8rem", color: "var(--k-muted)" }}
                  >
                    {v.changelog ?? "—"}
                  </span>
                  <span
                    className="min-w-0 truncate"
                    style={{ fontFamily: T.mono, fontSize: "0.72rem", color: "var(--k-muted)" }}
                  >
                    {v.created_by ?? "—"}
                  </span>
                  <span style={faintMono}>
                    {v.approved_by ? `${v.approved_by} · ${shortDate(v.approved_at)}` : "—"}
                  </span>
                </div>
                {v.status === "draft" && (
                  <details className="px-4 pb-3">
                    <summary
                      style={{ ...faintMono, cursor: "pointer", color: "var(--k-accent)" }}
                    >
                      Approve v{v.version}
                    </summary>
                    <form
                      action={approvePolicyVersion}
                      className="flex flex-col gap-2"
                      style={{ marginTop: 10 }}
                    >
                      <input type="hidden" name="version_id" value={v.id} />
                      <div className="flex flex-wrap items-end gap-3">
                        <Field label={'Type "APPROVE" to confirm'}>
                          <input
                            name="confirm"
                            placeholder="APPROVE"
                            autoComplete="off"
                            style={{ ...inp, width: 130 }}
                          />
                        </Field>
                        <SubmitButton style={primaryBtn}>Approve version</SubmitButton>
                      </div>
                      <p style={faintMono}>
                        Programme Owner only. Approval names you as approver, supersedes
                        the previous approved version, and sets the policy effective today
                        with review due in 12 months.
                        {policy.legal_review_required &&
                          " Legal review is required before approving this policy."}
                        {v.created_by &&
                          viewerEmail === v.created_by.toLowerCase() &&
                          " You also wrote this draft — the approval will be recorded as a self-approval."}
                      </p>
                    </form>
                  </details>
                )}
              </div>
            ))}
          </Panel>
        </Reveal>

        <Reveal delay={0.2}>
          <Panel label="// NEW VERSION">
            <form action={createNewVersion} className="flex flex-col gap-3">
              <input type="hidden" name="policy_id" value={policy.id} />
              <Field label="Policy text (markdown)">
                <textarea
                  name="body_md"
                  defaultValue={currentVersion?.body_md ?? ""}
                  placeholder="The full policy text for the new version"
                  style={{ ...textarea, minHeight: 220 }}
                />
              </Field>
              <Field label="Changelog">
                <input
                  name="changelog"
                  placeholder="What changed in this version and why"
                  autoComplete="off"
                  style={inp}
                />
              </Field>
              <div className="flex flex-wrap items-center gap-3">
                <SubmitButton style={primaryBtn}>Create draft version</SubmitButton>
                <span style={faintMono}>
                  Saves as a draft (v{(versions[0]?.version ?? 0) + 1}). The approved
                  version stays in force until this draft is approved.
                </span>
              </div>
            </form>
          </Panel>
        </Reveal>

        {showAcknowledgements && (
          <Reveal delay={0.25}>
            <Panel
              label="// ACKNOWLEDGEMENTS"
              pad={false}
              actions={
                viewer.ok && !viewerIsAuditorOnly && currentVersion ? (
                  viewerAck ? (
                    <StatusChip tone="success">
                      you acknowledged · {shortDate(viewerAck.acknowledged_at)}
                    </StatusChip>
                  ) : (
                    <form action={acknowledgePolicy}>
                      <input type="hidden" name="version_id" value={currentVersion.id} />
                      <SubmitButton style={primaryBtn}>Acknowledge this policy</SubmitButton>
                    </form>
                  )
                ) : undefined
              }
            >
              <div className="px-4 pt-3" style={{ paddingBottom: 6 }}>
                <span style={monoLabel}>
                  audience: {policy.acknowledgement_audience.replace(/_/g, " ")} · v
                  {policy.current_version}
                </span>
              </div>
              <HeaderRow grid={ACK_GRID} cols={["Acknowledged by", "When"]} />
              {acks.length === 0 && (
                <EmptyRow>
                  No one has acknowledged the current version yet. Each staff member
                  records their own acknowledgement here.
                </EmptyRow>
              )}
              {acks.map((a, i) => (
                <div
                  key={a.id}
                  className="grid md:grid gap-3 items-center px-4 py-2.5"
                  style={{
                    gridTemplateColumns: ACK_GRID,
                    borderTop: i ? "1px solid var(--k-border)" : "none",
                  }}
                >
                  <span
                    className="min-w-0 truncate"
                    style={{ fontFamily: T.mono, fontSize: "0.72rem", color: "var(--k-fg)" }}
                  >
                    {a.user_email}
                  </span>
                  <span style={faintMono}>{shortDate(a.acknowledged_at)}</span>
                </div>
              ))}
            </Panel>
          </Reveal>
        )}
      </div>
    </div>
  );
}
