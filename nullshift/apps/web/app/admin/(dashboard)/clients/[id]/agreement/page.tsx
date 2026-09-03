import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { createServiceClient } from "@nullshift/db";
import { requireStaff } from "@nullshift/auth/guards";
import { logAudit } from "@nullshift/db/audit";
import { T } from "@nullshift/ui/tokens";
import { PageHeader, Panel, StatusChip } from "@/components/app/AppKit";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { ReviewBlockedNotice, ReviewGate } from "@/components/admin/ReviewGate";
import { assertSendable, reviewState } from "@/lib/legalReview";
import { createChangeOrder } from "../actions";
import { legalConfig } from "@nullshift/content/legal/config";
import {
  CHANGE_ORDER_LABEL,
  changeOrderReadiness,
  staffTransitions,
  canTransition,
  type ChangeOrderStatus,
} from "@nullshift/content/legal/work";
import { PRICING_VERSION, SCALE_BAND_LABEL } from "@/lib/pricing/nsi";
import { recordDocumentEvent } from "@/lib/documentEvents";
import {
  PAYMENT_ARCHITECTURE_LABEL,
  releaseState,
  type OrderFormRow,
} from "@/lib/legal/agreement";

/**
 * The agreement hub for one client: the Order Form that governs the
 * relationship, the evidence of its acceptance, and every Change Order raised
 * against it (spec §5, §6, §9, §14).
 *
 * Two things this screen refuses to let staff do. It will not send an Order
 * Form for self-serve acceptance while a hard blocker stands — special-category
 * data, a significant automated decision, an unclassified payment integration,
 * an Enterprise order. And it will not let a Change Order out to a client
 * without a recurring-fee answer, because "we'll work that out later" is how
 * clients get surprise monthly charges.
 */
export const dynamic = "force-dynamic";

const gbp = (n: number | string | null | undefined) =>
  n === null || n === undefined
    ? "—"
    : "£" + Number(n).toLocaleString("en-GB", { maximumFractionDigits: 2 });
const dateGB = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";
const lines = (v: FormDataEntryValue | null): string[] =>
  String(v ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
const numOrNull = (v: FormDataEntryValue | null): number | null => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s.replace(/[£,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
};

const mono: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: "0.66rem",
  fontWeight: 500,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--k-muted)",
};
const field: React.CSSProperties = {
  fontFamily: T.sans,
  fontSize: "0.9rem",
  color: "var(--k-fg)",
  background: "var(--k-bg)",
  border: "1px solid var(--k-border)",
  borderRadius: 0,
  padding: "9px 11px",
  width: "100%",
};

// ── server actions ─────────────────────────────────────────────

/** Draft an Order Form from what we already know, for staff to finish. */
async function createOrderForm(formData: FormData) {
  "use server";
  const staff = await requireStaff();
  if (!staff.ok) return;
  const tenantId = String(formData.get("tenant_id") || "");
  if (!tenantId) return;

  const db = createServiceClient();
  const { data: tenant } = await db
    .from("tenants")
    .select("id, name")
    .eq("id", tenantId)
    .maybeSingle();
  if (!tenant) return;

  const { data: assessment } = await db
    .from("scale_assessments")
    .select("id, plan, scale_band, agreed_mrr, override_mrr, recommended_mrr")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: project } = await db
    .from("projects")
    .select("id")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: ref } = await db.rpc("next_order_form_ref");

  const fee =
    assessment?.agreed_mrr ??
    assessment?.override_mrr ??
    assessment?.recommended_mrr ??
    0;

  const { data: created, error } = await db
    .from("order_forms")
    .insert({
      tenant_id: tenantId,
      project_id: project?.id ?? null,
      reference: ref ?? `OF-${Date.now()}`,
      status: "draft",
      // Prefilled from the operational record so staff have somewhere to start.
      // The legal identity still has to be checked before it goes out — the
      // tenant name is a trading name as often as not.
      client_legal_name: tenant.name,
      client_address: "",
      client_billing_email: String(formData.get("billing_email") || ""),
      client_legal_email: String(formData.get("billing_email") || ""),
      plan: assessment?.plan ?? "core",
      scale_band: assessment?.scale_band ?? "standard",
      pricing_version: PRICING_VERSION,
      monthly_fee: Number(fee) || 0,
      vat_treatment: "not_vat_registered",
      billing_date_rule: "Monthly in advance, on the anniversary of the start date.",
      scale_assessment_id: assessment?.id ?? null,
      created_by: staff.userId,
    })
    .select("id, reference")
    .single();

  if (error || !created) return;
  await logAudit({
    action: "order_form.drafted",
    target: `order_form:${created.id}`,
    tenantId,
    metadata: { reference: created.reference },
  });
  revalidatePath(`/admin/clients/${tenantId}/agreement`);
}

/** Save the draft. Only a draft is editable — anything else is superseded. */
async function saveOrderForm(formData: FormData) {
  "use server";
  const staff = await requireStaff();
  if (!staff.ok) return;
  const id = String(formData.get("id") || "");
  const tenantId = String(formData.get("tenant_id") || "");
  if (!id || !tenantId) return;

  const db = createServiceClient();
  const architecture = String(formData.get("payment_architecture") || "").trim();

  const { error } = await db
    .from("order_forms")
    .update({
      client_legal_name: String(formData.get("client_legal_name") || "").trim(),
      client_company_number:
        String(formData.get("client_company_number") || "").trim() || null,
      client_address: String(formData.get("client_address") || "").trim(),
      client_billing_email: String(formData.get("client_billing_email") || "").trim(),
      client_legal_email: String(formData.get("client_legal_email") || "").trim(),
      plan: String(formData.get("plan") || "core"),
      scale_band: String(formData.get("scale_band") || "standard"),
      monthly_fee: numOrNull(formData.get("monthly_fee")) ?? 0,
      billing_date_rule: String(formData.get("billing_date_rule") || "").trim(),
      project_fee: numOrNull(formData.get("project_fee")),
      mobilisation_fee: numOrNull(formData.get("mobilisation_fee")),
      invoice_schedule: lines(formData.get("invoice_schedule")),
      scope: {
        businessOutcome: String(formData.get("business_outcome") || "").trim(),
        deliverables: lines(formData.get("deliverables")),
        included: lines(formData.get("included")),
        excluded: lines(formData.get("excluded")),
        acceptanceCriteria: lines(formData.get("acceptance_criteria")),
        clientDependencies: lines(formData.get("client_dependencies")),
        targetWindow: String(formData.get("target_window") || "").trim() || undefined,
      },
      technical: {
        hostingProvider:
          String(formData.get("hosting_provider") || "").trim() || undefined,
        databaseProvider:
          String(formData.get("database_provider") || "").trim() || undefined,
        paymentProvider:
          String(formData.get("payment_provider") || "").trim() || undefined,
        backupPolicyId:
          String(formData.get("backup_policy_id") || "").trim() || undefined,
      },
      payment_architecture: architecture || null,
      compliance: {
        personalData: formData.get("personal_data") === "on",
        specialCategoryData: formData.get("special_category") === "on",
        childrenLikely: formData.get("children_likely") === "on",
        territories: lines(formData.get("territories")),
        aiFeature: formData.get("ai_feature") === "on",
        significantAutomatedDecision: formData.get("significant_decision") === "on",
        paymentIntegration: formData.get("payment_integration") === "on",
      },
      portfolio_use: formData.get("portfolio_use") === "on",
      // Review gate: an edited draft is re-approved before it can be sent.
      reviewed_by: null,
      reviewed_at: null,
    })
    .eq("id", id)
    .eq("status", "draft");

  if (!error)
    await logAudit({
      action: "order_form.updated",
      target: `order_form:${id}`,
      tenantId,
    });
  revalidatePath(`/admin/clients/${tenantId}/agreement`);
}

/**
 * Send for client acceptance. Re-checks the blockers server-side: the button
 * being enabled is not the authority for anything.
 */
async function sendOrderForm(formData: FormData) {
  "use server";
  const staff = await requireStaff();
  if (!staff.ok) return;
  const id = String(formData.get("id") || "");
  const tenantId = String(formData.get("tenant_id") || "");
  if (!id || !tenantId) return;

  const db = createServiceClient();
  const { data: row } = await db.from("order_forms").select("*").eq("id", id).single();
  if (!row) return;

  const state = releaseState(row as OrderFormRow);
  if (!state.selfServe) {
    await logAudit({
      action: "order_form.send_blocked",
      target: `order_form:${id}`,
      tenantId,
      metadata: { blockers: state.hardBlockers.map((b) => b.code) },
    });
    return;
  }

  // Second-person review: refuses (and redirects back with ?blocked=review)
  // unless a staff member other than the author approved this draft.
  const form = row as OrderFormRow;
  await assertSendable({
    kind: "order_form",
    id,
    tenantId,
    reference: form.reference,
    review: {
      author: form.created_by,
      reviewedBy: form.reviewed_by,
      reviewedAt: form.reviewed_at,
    },
  });

  await db
    .from("order_forms")
    .update({ status: "client_review", sent_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "draft");
  await recordDocumentEvent(db, {
    tenantId,
    documentType: "order_form",
    documentId: id,
    event: "sent",
    actor: staff.userId,
    actorKind: "staff",
    meta: { reference: (row as OrderFormRow).reference },
  });
  await logAudit({
    action: "order_form.sent_for_acceptance",
    target: `order_form:${id}`,
    tenantId,
  });
  revalidatePath(`/admin/clients/${tenantId}/agreement`);
}

/**
 * §14: attach the regulatory-legal approval that unblocks a custody payment
 * architecture. A reference to a real review, or nothing at all.
 */
async function attachPaymentReview(formData: FormData) {
  "use server";
  const staff = await requireStaff();
  if (!staff.ok) return;
  const id = String(formData.get("id") || "");
  const tenantId = String(formData.get("tenant_id") || "");
  const ref = String(formData.get("payment_review_ref") || "").trim();
  if (!id || !tenantId || !ref) return;

  const db = createServiceClient();
  await db
    .from("order_forms")
    .update({
      payment_review_ref: ref,
      payment_reviewed_by: staff.userId,
      payment_reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);
  await logAudit({
    action: "order_form.payment_review_attached",
    target: `order_form:${id}`,
    tenantId,
    metadata: { ref },
  });
  revalidatePath(`/admin/clients/${tenantId}/agreement`);
}

async function saveChangeOrder(formData: FormData) {
  "use server";
  const staff = await requireStaff();
  if (!staff.ok) return;
  const id = String(formData.get("id") || "");
  const tenantId = String(formData.get("tenant_id") || "");
  if (!id || !tenantId) return;

  const db = createServiceClient();
  await db
    .from("change_orders")
    .update({
      description: String(formData.get("description") || "").trim(),
      business_outcome: String(formData.get("business_outcome") || "").trim(),
      included: lines(formData.get("included")),
      excluded: lines(formData.get("excluded")),
      acceptance_criteria: lines(formData.get("acceptance_criteria")),
      dependencies: lines(formData.get("dependencies")),
      project_fee: numOrNull(formData.get("project_fee")) ?? 0,
      recurring_fee_delta: numOrNull(formData.get("recurring_fee_delta")),
      new_scale_band: String(formData.get("new_scale_band") || "") || null,
      delivery_impact: String(formData.get("delivery_impact") || "").trim() || null,
      flags: {
        security: formData.get("flag_security") === "on",
        personalData: formData.get("flag_personal_data") === "on",
        ai: formData.get("flag_ai") === "on",
        payments: formData.get("flag_payments") === "on",
      },
    })
    .eq("id", id)
    .in("status", ["draft", "client_review"]);
  // Review gate: an edited DRAFT is re-approved before it can go out. An edit
  // while in client review keeps the approval record of what was sent.
  await db
    .from("change_orders")
    .update({ reviewed_by: null, reviewed_at: null })
    .eq("id", id)
    .eq("status", "draft");

  await logAudit({
    action: "change_order.updated",
    target: `change_order:${id}`,
    tenantId,
  });
  revalidatePath(`/admin/clients/${tenantId}/agreement`);
}

/** Move a Change Order along. The state machine, and only the state machine. */
async function advanceChangeOrder(formData: FormData) {
  "use server";
  const staff = await requireStaff();
  if (!staff.ok) return;
  const id = String(formData.get("id") || "");
  const tenantId = String(formData.get("tenant_id") || "");
  const to = String(formData.get("to") || "") as ChangeOrderStatus;
  if (!id || !tenantId || !to) return;

  const db = createServiceClient();
  const { data: co } = await db.from("change_orders").select("*").eq("id", id).single();
  if (!co) return;

  const from = co.status as ChangeOrderStatus;
  if (!canTransition(from, to)) return;
  // Acceptance is the client's to give. Staff moving a change to "accepted"
  // would be signing on their behalf.
  if (to === "accepted" || to === "rejected") return;

  if (to === "client_review") {
    const missing = changeOrderReadiness({
      description: co.description,
      businessOutcome: co.business_outcome,
      acceptanceCriteria: co.acceptance_criteria ?? [],
      recurringFeeDelta: co.recurring_fee_delta,
    });
    if (missing.length) return;
    // Second-person review: refuses (and redirects back with ?blocked=review)
    // unless a staff member other than the author approved this draft.
    await assertSendable({
      kind: "change_order",
      id,
      tenantId,
      reference: co.reference as string,
      review: {
        author: co.created_by as string | null,
        reviewedBy: co.reviewed_by as string | null,
        reviewedAt: co.reviewed_at as string | null,
      },
    });
  }

  const patch: Record<string, unknown> = { status: to };
  if (to === "delivered") patch.delivered_at = new Date().toISOString();
  if (to === "accepted_complete") patch.completed_at = new Date().toISOString();

  await db.from("change_orders").update(patch).eq("id", id);
  if (to === "client_review")
    await recordDocumentEvent(db, {
      tenantId,
      documentType: "change_order",
      documentId: id,
      event: "sent",
      actor: staff.userId,
      actorKind: "staff",
      meta: { reference: co.reference as string },
    });
  await logAudit({
    action: `change_order.${to}`,
    target: `change_order:${id}`,
    tenantId,
    metadata: { from },
  });
  revalidatePath(`/admin/clients/${tenantId}/agreement`);
}

// ── page ───────────────────────────────────────────────────────

export default async function AgreementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  /** Review gate bounce: ?blocked=review | self_approval | not_draft. */
  searchParams: Promise<{ blocked?: string }>;
}) {
  const staff = await requireStaff();
  if (!staff.ok) notFound();
  const { id: tenantId } = await params;
  const { blocked } = await searchParams;

  const db = createServiceClient();
  const [
    { data: tenant },
    { data: orderRows },
    { data: changeOrders },
    { data: unlinked },
  ] = await Promise.all([
    db.from("tenants").select("id, name").eq("id", tenantId).maybeSingle(),
    db
      .from("order_forms")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
    db
      .from("change_orders")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
    db
      .from("issues")
      .select("id, title, classification, change_order_id, status")
      .eq("tenant_id", tenantId)
      .in("classification", ["additional_development", "mixed"])
      .is("change_order_id", null),
  ]);

  if (!tenant) notFound();

  const orders = (orderRows ?? []) as OrderFormRow[];
  const live =
    orders.find((o) => o.status === "accepted") ??
    orders.find((o) => o.status === "client_review") ??
    orders.find((o) => o.status === "draft") ??
    null;

  const acceptance = live
    ? (
        await db
          .from("contract_acceptances")
          .select("*")
          .eq("order_form_id", live.id)
          .maybeSingle()
      ).data
    : null;

  const state = live ? releaseState(live) : null;
  const liveReview = live
    ? reviewState({
        author: live.created_by,
        reviewedBy: live.reviewed_by,
        reviewedAt: live.reviewed_at,
      })
    : null;

  return (
    <div className="flex flex-col gap-7">
      <ReviewBlockedNotice blocked={blocked} />
      <PageHeader
        index="/06"
        label="Agreement"
        title={tenant.name}
        lead="The Order Form that governs this relationship, the evidence of its acceptance, and every change raised against it."
        actions={
          <>
            <Link href={`/admin/clients/${tenantId}`} className="kb kb-outline kb-sm">
              ← Client
            </Link>
            <Link
              href={`/admin/clients/${tenantId}/pricing`}
              className="kb kb-outline kb-sm"
            >
              Scale &amp; pricing
            </Link>
          </>
        }
      />

      {!live && (
        <Panel label="No agreement" title="Draft an Order Form">
          <p
            style={{
              fontFamily: T.sans,
              fontSize: "0.92rem",
              lineHeight: 1.7,
              color: "var(--k-muted)",
            }}
          >
            This client has no Order Form. Drafting one prefills the plan, band and fee
            from their latest scale assessment — the legal identity still needs checking
            against Companies House before it goes out.
          </p>
          <form action={createOrderForm} className="mt-4 flex flex-wrap items-end gap-3">
            <input type="hidden" name="tenant_id" value={tenantId} />
            <label style={{ minWidth: 260 }}>
              <span style={{ ...mono, display: "block", marginBottom: 6 }}>
                Billing email
              </span>
              <input name="billing_email" type="email" style={field} />
            </label>
            <SubmitButton className="kb kb-primary kb-sm" pendingLabel="Drafting…">
              Draft Order Form
            </SubmitButton>
          </form>
        </Panel>
      )}

      {live && state && (
        <>
          {/* ── blockers ─────────────────────────────────────── */}
          {state.blockers.length > 0 && (
            <Panel
              label="Compliance"
              title="Before this can be accepted"
              style={{
                borderColor: state.hardBlockers.length
                  ? "color-mix(in oklab, var(--k-danger, #ff3a5c) 45%, transparent)"
                  : undefined,
              }}
            >
              <ul
                className="flex flex-col gap-3"
                style={{ margin: 0, padding: 0, listStyle: "none" }}
              >
                {state.blockers.map((b) => (
                  <li key={b.code + b.detail} className="flex items-start gap-3">
                    <StatusChip tone={b.blocksSelfServe ? "danger" : "warning"}>
                      {b.blocksSelfServe ? "Blocks" : "Flag"}
                    </StatusChip>
                    <div style={{ minWidth: 0 }}>
                      <span style={{ ...mono, color: "var(--k-fg)", display: "block" }}>
                        {b.code}
                      </span>
                      <p
                        style={{
                          fontFamily: T.sans,
                          fontSize: "0.88rem",
                          lineHeight: 1.65,
                          color: "var(--k-muted)",
                          marginTop: 5,
                        }}
                      >
                        {b.detail}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {state.productionBlocked && (
            <Panel label="§14 Payments" title="Production release blocked">
              <p
                style={{
                  fontFamily: T.sans,
                  fontSize: "0.92rem",
                  lineHeight: 1.7,
                  color: "var(--k-fg)",
                }}
              >
                {state.productionBlockReason}
              </p>
              <form
                action={attachPaymentReview}
                className="mt-4 flex flex-wrap items-end gap-3"
              >
                <input type="hidden" name="tenant_id" value={tenantId} />
                <input type="hidden" name="id" value={live.id} />
                <label style={{ minWidth: 300 }}>
                  <span style={{ ...mono, display: "block", marginBottom: 6 }}>
                    Regulatory-legal approval reference
                  </span>
                  <input
                    name="payment_review_ref"
                    required
                    placeholder="e.g. counsel opinion ref / FCA position note"
                    style={field}
                  />
                </label>
                <SubmitButton className="kb kb-outline kb-sm" pendingLabel="Attaching…">
                  Attach approval
                </SubmitButton>
              </form>
            </Panel>
          )}

          {/* ── the order form ───────────────────────────────── */}
          <Panel
            label={live.reference}
            title="Order Form"
            actions={
              <>
                <StatusChip
                  tone={
                    live.status === "accepted"
                      ? "success"
                      : live.status === "client_review"
                        ? "accent"
                        : "muted"
                  }
                >
                  {live.status.replace("_", " ")}
                </StatusChip>
                {live.status === "draft" && (
                  <form action={sendOrderForm}>
                    <input type="hidden" name="tenant_id" value={tenantId} />
                    <input type="hidden" name="id" value={live.id} />
                    <SubmitButton
                      className="kb kb-primary kb-sm"
                      disabled={!state.selfServe || !liveReview?.canSend}
                      title={
                        liveReview && !liveReview.canSend ? liveReview.reason : undefined
                      }
                      pendingLabel="Sending…"
                    >
                      Send for acceptance
                    </SubmitButton>
                  </form>
                )}
              </>
            }
          >
            <div style={{ marginBottom: 16 }}>
              <ReviewGate
                kind="order_form"
                id={live.id}
                tenantId={tenantId}
                author={live.created_by}
                reviewedBy={live.reviewed_by}
                reviewedAt={live.reviewed_at}
                viewerId={staff.userId}
                sendable={live.status === "draft"}
              />
            </div>
            {live.status === "draft" ? (
              <OrderFormEditor row={live} tenantId={tenantId} />
            ) : (
              <OrderFormSummary row={live} />
            )}
            {live.status === "draft" &&
              state.selfServe &&
              liveReview &&
              !liveReview.canSend && (
                <p
                  style={{
                    ...mono,
                    color: "var(--k-faint)",
                    marginTop: 14,
                    textTransform: "none",
                    letterSpacing: "0.02em",
                    fontSize: "0.72rem",
                  }}
                >
                  Send is disabled: {liveReview.reason}
                </p>
              )}
            {live.status === "draft" && !state.selfServe && (
              <p
                style={{
                  ...mono,
                  color: "var(--k-faint)",
                  marginTop: 14,
                  textTransform: "none",
                  letterSpacing: "0.02em",
                  fontSize: "0.72rem",
                }}
              >
                Self-serve acceptance is blocked by the items above. Complete the review,
                then either clear the flag or record a manual acceptance against the
                signed artifact.
              </p>
            )}
          </Panel>

          {/* ── acceptance evidence ──────────────────────────── */}
          {acceptance && (
            <Panel label="§5 Evidence" title="Acceptance record">
              <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
                <Row
                  k="Accepted by"
                  v={`${acceptance.accepted_by_name} — ${acceptance.accepted_by_title}`}
                />
                <Row k="Email" v={acceptance.accepted_by_email} />
                <Row
                  k="When"
                  v={new Date(acceptance.accepted_at).toLocaleString("en-GB")}
                />
                <Row k="Method" v={acceptance.acceptance_method} />
                <Row k="Agreement version" v={acceptance.msa_version} />
                <Row k="Pricing version" v={acceptance.pricing_version} />
              </dl>
              <p style={{ ...mono, marginTop: 16, color: "var(--k-muted)" }}>
                Document hashes
              </p>
              <ul
                className="mt-2 flex flex-col gap-1"
                style={{ margin: 0, padding: 0, listStyle: "none" }}
              >
                {Object.entries(
                  (acceptance.document_hashes ?? {}) as Record<string, string>
                ).map(([k, v]) => (
                  <li
                    key={k}
                    style={{
                      fontFamily: T.mono,
                      fontSize: "0.66rem",
                      color: "var(--k-faint)",
                      wordBreak: "break-all",
                    }}
                  >
                    {k}: {v}
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {/* ── change orders ────────────────────────────────── */}
          <Panel label="§9 Change Orders" title={`${(changeOrders ?? []).length} raised`}>
            {(unlinked ?? []).length > 0 && (
              <div
                style={{
                  border: "1px dashed var(--k-border-strong)",
                  padding: "14px 16px",
                  marginBottom: 18,
                }}
              >
                <span style={{ ...mono, color: "var(--k-fg)" }}>
                  Tickets waiting for a Change Order
                </span>
                <p
                  style={{
                    fontFamily: T.sans,
                    fontSize: "0.86rem",
                    lineHeight: 1.65,
                    color: "var(--k-muted)",
                    marginTop: 6,
                  }}
                >
                  These are classified as additional development. They cannot be scheduled
                  until a Change Order is raised and the client accepts it.
                </p>
                <ul
                  className="mt-3 flex flex-col gap-2"
                  style={{ listStyle: "none", margin: 0, padding: 0 }}
                >
                  {(unlinked ?? []).map((i) => (
                    <li key={i.id}>
                      <form
                        action={createChangeOrder}
                        className="flex flex-wrap items-center gap-2"
                      >
                        <input type="hidden" name="tenant_id" value={tenantId} />
                        <input type="hidden" name="order_form_id" value={live.id} />
                        <input type="hidden" name="issue_id" value={i.id} />
                        <input type="hidden" name="description" value={i.title} />
                        <input type="hidden" name="business_outcome" value="" />
                        <span
                          style={{
                            fontFamily: T.sans,
                            fontSize: "0.9rem",
                            color: "var(--k-fg)",
                          }}
                        >
                          {i.title}
                        </span>
                        <SubmitButton className="kb kb-outline kb-sm" pendingLabel="…">
                          Raise Change Order
                        </SubmitButton>
                      </form>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <form action={createChangeOrder} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="tenant_id" value={tenantId} />
              <input type="hidden" name="order_form_id" value={live.id} />
              <label style={{ flex: "1 1 320px" }}>
                <span style={{ ...mono, display: "block", marginBottom: 6 }}>
                  New Change Order — what is changing?
                </span>
                <input name="description" required style={field} />
              </label>
              <SubmitButton className="kb kb-primary kb-sm" pendingLabel="Creating…">
                Create draft
              </SubmitButton>
            </form>

            <div className="mt-6 flex flex-col gap-4">
              {(changeOrders ?? []).map((co) => {
                const missing = changeOrderReadiness({
                  description: co.description,
                  businessOutcome: co.business_outcome,
                  acceptanceCriteria: co.acceptance_criteria ?? [],
                  recurringFeeDelta: co.recurring_fee_delta,
                });
                const next = staffTransitions(co.status as ChangeOrderStatus);
                const coReview = reviewState({
                  author: co.created_by as string | null,
                  reviewedBy: co.reviewed_by as string | null,
                  reviewedAt: co.reviewed_at as string | null,
                });
                return (
                  <div
                    key={co.id}
                    style={{ border: "1px solid var(--k-border)", padding: "16px 18px" }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <span style={{ ...mono, color: "var(--k-accent)" }}>
                          {co.reference}
                        </span>
                        <p
                          style={{
                            fontFamily: T.sans,
                            fontSize: "1rem",
                            fontWeight: 600,
                            color: "var(--k-fg)",
                            marginTop: 4,
                          }}
                        >
                          {co.description}
                        </p>
                      </div>
                      <StatusChip
                        tone={
                          co.status === "accepted_complete"
                            ? "success"
                            : co.status === "rejected"
                              ? "danger"
                              : co.status === "client_review"
                                ? "accent"
                                : "muted"
                        }
                      >
                        {CHANGE_ORDER_LABEL[co.status as ChangeOrderStatus]}
                      </StatusChip>
                    </div>

                    {["draft", "client_review"].includes(co.status) ? (
                      <ChangeOrderEditor co={co} tenantId={tenantId} />
                    ) : (
                      <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
                        <Row k="Fixed fee" v={gbp(co.project_fee)} />
                        <Row
                          k="Recurring impact"
                          v={
                            co.recurring_fee_delta === null
                              ? "not assessed"
                              : `${Number(co.recurring_fee_delta) >= 0 ? "+" : ""}${gbp(co.recurring_fee_delta)}/mo`
                          }
                        />
                        <Row k="Accepted by" v={co.accepted_by_name ?? "—"} />
                        <Row k="Accepted" v={dateGB(co.accepted_at)} />
                      </dl>
                    )}

                    {missing.length > 0 && co.status === "draft" && (
                      <ul
                        className="mt-3 flex flex-col gap-1"
                        style={{ listStyle: "none", margin: 0, padding: 0 }}
                      >
                        {missing.map((m) => (
                          <li
                            key={m}
                            style={{
                              fontFamily: T.sans,
                              fontSize: "0.82rem",
                              color: "var(--k-faint)",
                            }}
                          >
                            · {m}
                          </li>
                        ))}
                      </ul>
                    )}

                    {!["withdrawn", "superseded", "rejected"].includes(co.status) && (
                      <div className="mt-4">
                        <ReviewGate
                          kind="change_order"
                          id={co.id}
                          tenantId={tenantId}
                          author={co.created_by as string | null}
                          reviewedBy={co.reviewed_by as string | null}
                          reviewedAt={co.reviewed_at as string | null}
                          viewerId={staff.userId}
                          sendable={co.status === "draft"}
                        />
                      </div>
                    )}

                    {next.length > 0 && (
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        {next.map((to) => (
                          <form key={to} action={advanceChangeOrder}>
                            <input type="hidden" name="tenant_id" value={tenantId} />
                            <input type="hidden" name="id" value={co.id} />
                            <input type="hidden" name="to" value={to} />
                            <SubmitButton
                              className="kb kb-outline kb-sm"
                              disabled={
                                to === "client_review" &&
                                (missing.length > 0 || !coReview.canSend)
                              }
                              title={
                                to === "client_review" && !coReview.canSend
                                  ? coReview.reason
                                  : undefined
                              }
                              pendingLabel="…"
                            >
                              {CHANGE_ORDER_LABEL[to]}
                            </SubmitButton>
                          </form>
                        ))}
                        {next.includes("client_review") &&
                          missing.length === 0 &&
                          !coReview.canSend && (
                            <span
                              style={{
                                fontFamily: T.sans,
                                fontSize: "0.78rem",
                                color: "var(--k-faint)",
                              }}
                            >
                              Send is disabled: {coReview.reason}
                            </span>
                          )}
                      </div>
                    )}
                  </div>
                );
              })}
              {(changeOrders ?? []).length === 0 && (
                <p
                  style={{
                    fontFamily: T.sans,
                    fontSize: "0.9rem",
                    color: "var(--k-faint)",
                  }}
                >
                  No changes raised against this agreement.
                </p>
              )}
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <dt style={mono}>{k}</dt>
      <dd
        style={{
          fontFamily: T.sans,
          fontSize: "0.92rem",
          color: "var(--k-fg)",
          marginTop: 3,
        }}
      >
        {v}
      </dd>
    </div>
  );
}

function OrderFormSummary({ row }: { row: OrderFormRow }) {
  const scope = row.scope ?? {};
  return (
    <>
      <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
        <Row k="Client legal name" v={row.client_legal_name} />
        <Row k="Company number" v={row.client_company_number ?? "—"} />
        <Row k="Plan" v={row.plan} />
        <Row
          k="Scale band"
          v={
            row.scale_band === "enterprise"
              ? "Enterprise"
              : SCALE_BAND_LABEL[row.scale_band as keyof typeof SCALE_BAND_LABEL]
          }
        />
        <Row k="Monthly fee" v={`${gbp(row.monthly_fee)}/mo`} />
        <Row k="VAT" v={row.vat_treatment.replace(/_/g, " ")} />
        <Row k="Billing rule" v={row.billing_date_rule} />
        <Row k="Pricing version" v={row.pricing_version} />
        <Row
          k="Payment architecture"
          v={
            row.payment_architecture
              ? PAYMENT_ARCHITECTURE_LABEL[row.payment_architecture]
              : "not classified"
          }
        />
        <Row k="Sent" v={dateGB(row.sent_at)} />
      </dl>
      {scope.businessOutcome && (
        <p
          style={{
            fontFamily: T.sans,
            fontSize: "0.92rem",
            lineHeight: 1.7,
            color: "var(--k-muted)",
            marginTop: 16,
            paddingLeft: 14,
            borderLeft: "2px solid var(--k-accent)",
          }}
        >
          {scope.businessOutcome}
        </p>
      )}
    </>
  );
}

function OrderFormEditor({ row, tenantId }: { row: OrderFormRow; tenantId: string }) {
  const scope = row.scope ?? {};
  const tech = row.technical ?? {};
  const comp = row.compliance ?? {};
  const list = (a?: string[]) => (a ?? []).join("\n");

  const Text = ({
    name,
    label,
    defaultValue,
    rows = 3,
    hint,
  }: {
    name: string;
    label: string;
    defaultValue?: string;
    rows?: number;
    hint?: string;
  }) => (
    <label style={{ display: "block" }}>
      <span style={{ ...mono, display: "block", marginBottom: 6 }}>{label}</span>
      <textarea
        name={name}
        rows={rows}
        defaultValue={defaultValue}
        style={{ ...field, resize: "vertical", lineHeight: 1.6 }}
      />
      {hint && (
        <span
          style={{
            fontFamily: T.sans,
            fontSize: "0.76rem",
            color: "var(--k-faint)",
            display: "block",
            marginTop: 4,
          }}
        >
          {hint}
        </span>
      )}
    </label>
  );

  const Check = ({ name, label, on }: { name: string; label: string; on?: boolean }) => (
    <label className="flex items-center gap-2" style={{ cursor: "pointer" }}>
      <input type="checkbox" name={name} defaultChecked={on} />
      <span style={{ fontFamily: T.sans, fontSize: "0.86rem", color: "var(--k-fg)" }}>
        {label}
      </span>
    </label>
  );

  return (
    <form action={saveOrderForm} className="flex flex-col gap-5">
      <input type="hidden" name="tenant_id" value={tenantId} />
      <input type="hidden" name="id" value={row.id} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label>
          <span style={{ ...mono, display: "block", marginBottom: 6 }}>
            Client legal name
          </span>
          <input
            name="client_legal_name"
            defaultValue={row.client_legal_name}
            required
            style={field}
          />
        </label>
        <label>
          <span style={{ ...mono, display: "block", marginBottom: 6 }}>
            Company number
          </span>
          <input
            name="client_company_number"
            defaultValue={row.client_company_number ?? ""}
            style={field}
          />
        </label>
        <label>
          <span style={{ ...mono, display: "block", marginBottom: 6 }}>
            Billing email
          </span>
          <input
            name="client_billing_email"
            type="email"
            defaultValue={row.client_billing_email}
            required
            style={field}
          />
        </label>
        <label>
          <span style={{ ...mono, display: "block", marginBottom: 6 }}>Legal email</span>
          <input
            name="client_legal_email"
            type="email"
            defaultValue={row.client_legal_email}
            required
            style={field}
          />
        </label>
      </div>

      <Text
        name="client_address"
        label="Registered address"
        defaultValue={row.client_address}
        rows={2}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <label>
          <span style={{ ...mono, display: "block", marginBottom: 6 }}>Plan</span>
          <select name="plan" defaultValue={row.plan} style={{ ...field, height: 40 }}>
            {["core", "pro", "max", "enterprise"].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span style={{ ...mono, display: "block", marginBottom: 6 }}>Scale band</span>
          <select
            name="scale_band"
            defaultValue={row.scale_band}
            style={{ ...field, height: 40 }}
          >
            {["standard", "growth", "established", "scale", "critical", "enterprise"].map(
              (b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              )
            )}
          </select>
        </label>
        <label>
          <span style={{ ...mono, display: "block", marginBottom: 6 }}>Monthly £</span>
          <input
            name="monthly_fee"
            defaultValue={String(row.monthly_fee)}
            style={field}
          />
        </label>
        <label>
          <span style={{ ...mono, display: "block", marginBottom: 6 }}>Project £</span>
          <input
            name="project_fee"
            defaultValue={row.project_fee === null ? "" : String(row.project_fee)}
            style={field}
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label>
          <span style={{ ...mono, display: "block", marginBottom: 6 }}>Billing rule</span>
          <input
            name="billing_date_rule"
            defaultValue={row.billing_date_rule}
            style={field}
          />
        </label>
        <label>
          <span style={{ ...mono, display: "block", marginBottom: 6 }}>
            Mobilisation £
          </span>
          <input
            name="mobilisation_fee"
            defaultValue={
              row.mobilisation_fee === null ? "" : String(row.mobilisation_fee)
            }
            style={field}
          />
        </label>
      </div>

      <Text
        name="business_outcome"
        label="Business outcome"
        defaultValue={scope.businessOutcome}
        hint="What the client actually gets out of this, in their language."
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Text
          name="deliverables"
          label="Deliverables (one per line)"
          defaultValue={list(scope.deliverables)}
        />
        <Text
          name="acceptance_criteria"
          label="Acceptance criteria (one per line)"
          defaultValue={list(scope.acceptanceCriteria)}
        />
        <Text
          name="included"
          label="Included (one per line)"
          defaultValue={list(scope.included)}
        />
        <Text
          name="excluded"
          label="Excluded (one per line)"
          defaultValue={list(scope.excluded)}
          hint="The list that prevents an argument later. Be specific."
        />
        <Text
          name="client_dependencies"
          label="Client dependencies (one per line)"
          defaultValue={list(scope.clientDependencies)}
        />
        <Text
          name="invoice_schedule"
          label="Invoice schedule (one per line)"
          defaultValue={list(row.invoice_schedule ?? [])}
        />
      </div>

      <label>
        <span style={{ ...mono, display: "block", marginBottom: 6 }}>Target window</span>
        <input
          name="target_window"
          defaultValue={scope.targetWindow ?? ""}
          style={field}
        />
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <label>
          <span style={{ ...mono, display: "block", marginBottom: 6 }}>Hosting</span>
          <input
            name="hosting_provider"
            defaultValue={tech.hostingProvider ?? ""}
            style={field}
          />
        </label>
        <label>
          <span style={{ ...mono, display: "block", marginBottom: 6 }}>Database</span>
          <input
            name="database_provider"
            defaultValue={tech.databaseProvider ?? ""}
            style={field}
          />
        </label>
        <label>
          <span style={{ ...mono, display: "block", marginBottom: 6 }}>Payments</span>
          <input
            name="payment_provider"
            defaultValue={tech.paymentProvider ?? ""}
            style={field}
          />
        </label>
        <label>
          <span style={{ ...mono, display: "block", marginBottom: 6 }}>
            Backup policy
          </span>
          <input
            name="backup_policy_id"
            defaultValue={tech.backupPolicyId ?? ""}
            style={field}
          />
        </label>
      </div>

      <label>
        <span style={{ ...mono, display: "block", marginBottom: 6 }}>
          Payment architecture (§14)
        </span>
        <select
          name="payment_architecture"
          defaultValue={row.payment_architecture ?? ""}
          style={{ ...field, height: 40 }}
        >
          <option value="">Not classified</option>
          {(
            Object.keys(
              PAYMENT_ARCHITECTURE_LABEL
            ) as (keyof typeof PAYMENT_ARCHITECTURE_LABEL)[]
          ).map((k) => (
            <option key={k} value={k}>
              {PAYMENT_ARCHITECTURE_LABEL[k]}
            </option>
          ))}
        </select>
      </label>

      <Text
        name="territories"
        label="Territories (ISO codes, one per line)"
        defaultValue={list(comp.territories)}
        rows={2}
        hint="An EU/EEA code with an AI feature raises the Article 50 transparency flag."
      />

      <div className="flex flex-wrap gap-x-6 gap-y-3">
        <Check name="personal_data" label="Stores personal data" on={comp.personalData} />
        <Check
          name="special_category"
          label="Special-category data"
          on={comp.specialCategoryData}
        />
        <Check
          name="children_likely"
          label="Children likely to use it"
          on={comp.childrenLikely}
        />
        <Check name="ai_feature" label="AI feature" on={comp.aiFeature} />
        <Check
          name="significant_decision"
          label="Significant automated decisions"
          on={comp.significantAutomatedDecision}
        />
        <Check
          name="payment_integration"
          label="Payment integration"
          on={comp.paymentIntegration}
        />
        <Check
          name="portfolio_use"
          label="Portfolio use permitted"
          on={row.portfolio_use}
        />
      </div>

      <div>
        <SubmitButton className="kb kb-primary kb-sm" pendingLabel="Saving…">
          Save draft
        </SubmitButton>
        <span
          style={{
            fontFamily: T.sans,
            fontSize: "0.8rem",
            color: "var(--k-faint)",
            marginLeft: 12,
          }}
        >
          Incorporated terms:{" "}
          <Link
            href={legalConfig.routes.clientServices}
            style={{ color: "var(--k-accent)" }}
          >
            {legalConfig.legal.clientAgreementVersion}
          </Link>
        </span>
      </div>
    </form>
  );
}

function ChangeOrderEditor({
  co,
  tenantId,
}: {
  co: Record<string, unknown>;
  tenantId: string;
}) {
  const arr = (v: unknown) => ((v as string[]) ?? []).join("\n");
  const flags = (co.flags ?? {}) as Record<string, boolean>;
  return (
    <form action={saveChangeOrder} className="mt-4 flex flex-col gap-4">
      <input type="hidden" name="tenant_id" value={tenantId} />
      <input type="hidden" name="id" value={String(co.id)} />

      <label>
        <span style={{ ...mono, display: "block", marginBottom: 6 }}>Change</span>
        <input
          name="description"
          defaultValue={String(co.description ?? "")}
          style={field}
        />
      </label>
      <label>
        <span style={{ ...mono, display: "block", marginBottom: 6 }}>
          Business outcome
        </span>
        <textarea
          name="business_outcome"
          rows={2}
          defaultValue={String(co.business_outcome ?? "")}
          style={{ ...field, resize: "vertical", lineHeight: 1.6 }}
        />
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label>
          <span style={{ ...mono, display: "block", marginBottom: 6 }}>
            Included (one per line)
          </span>
          <textarea
            name="included"
            rows={3}
            defaultValue={arr(co.included)}
            style={{ ...field, resize: "vertical" }}
          />
        </label>
        <label>
          <span style={{ ...mono, display: "block", marginBottom: 6 }}>
            Excluded (one per line)
          </span>
          <textarea
            name="excluded"
            rows={3}
            defaultValue={arr(co.excluded)}
            style={{ ...field, resize: "vertical" }}
          />
        </label>
        <label>
          <span style={{ ...mono, display: "block", marginBottom: 6 }}>
            Acceptance criteria (one per line)
          </span>
          <textarea
            name="acceptance_criteria"
            rows={3}
            defaultValue={arr(co.acceptance_criteria)}
            style={{ ...field, resize: "vertical" }}
          />
        </label>
        <label>
          <span style={{ ...mono, display: "block", marginBottom: 6 }}>
            Dependencies (one per line)
          </span>
          <textarea
            name="dependencies"
            rows={3}
            defaultValue={arr(co.dependencies)}
            style={{ ...field, resize: "vertical" }}
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <label>
          <span style={{ ...mono, display: "block", marginBottom: 6 }}>Fixed fee £</span>
          <input
            name="project_fee"
            defaultValue={String(co.project_fee ?? "0")}
            style={field}
          />
        </label>
        <label>
          <span style={{ ...mono, display: "block", marginBottom: 6 }}>
            Recurring ± £/mo
          </span>
          <input
            name="recurring_fee_delta"
            defaultValue={
              co.recurring_fee_delta === null ? "" : String(co.recurring_fee_delta)
            }
            placeholder="0"
            style={field}
          />
        </label>
        <label>
          <span style={{ ...mono, display: "block", marginBottom: 6 }}>New band</span>
          <select
            name="new_scale_band"
            defaultValue={String(co.new_scale_band ?? "")}
            style={{ ...field, height: 40 }}
          >
            <option value="">unchanged</option>
            {["standard", "growth", "established", "scale", "critical", "enterprise"].map(
              (b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              )
            )}
          </select>
        </label>
        <label>
          <span style={{ ...mono, display: "block", marginBottom: 6 }}>
            Delivery impact
          </span>
          <input
            name="delivery_impact"
            defaultValue={String(co.delivery_impact ?? "")}
            style={field}
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-3">
        {(
          [
            ["flag_security", "Security", flags.security],
            ["flag_personal_data", "Personal data", flags.personalData],
            ["flag_ai", "AI", flags.ai],
            ["flag_payments", "Payments", flags.payments],
          ] as const
        ).map(([name, label, on]) => (
          <label
            key={name}
            className="flex items-center gap-2"
            style={{ cursor: "pointer" }}
          >
            <input type="checkbox" name={name} defaultChecked={!!on} />
            <span
              style={{ fontFamily: T.sans, fontSize: "0.86rem", color: "var(--k-fg)" }}
            >
              {label}
            </span>
          </label>
        ))}
      </div>

      <div>
        <SubmitButton className="kb kb-outline kb-sm" pendingLabel="Saving…">
          Save
        </SubmitButton>
      </div>
    </form>
  );
}
