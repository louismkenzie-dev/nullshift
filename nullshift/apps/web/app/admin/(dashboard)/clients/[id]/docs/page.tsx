import Link from "next/link";
import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { createClient, createServiceClient } from "@nullshift/db";
import { requireStaff } from "@nullshift/auth/guards";
import { T } from "@nullshift/ui/tokens";
import { CATALOG } from "@nullshift/content/catalog";
import { carePlan } from "@/lib/carePlans";
import { dpaReadyToSend } from "@/lib/dpa";
import {
  DOCUMENT_TYPE_LABEL,
  documentReceipts,
  type DocumentType,
} from "@/lib/documentEvents";
import { reviewState, staffLabels } from "@/lib/legalReview";
import { ProposalDocsForm } from "@/components/admin/ProposalDocsForm";
import { ReviewBlockedNotice, ReviewGate } from "@/components/admin/ReviewGate";
import { StatusChip } from "@/components/app/AppKit";
import { Reveal } from "@/components/kyma";
import { addItem, recordDpa, removeItem, saveDocsAndSend, uploadDoc } from "../actions";
import {
  Badge,
  SignalChip,
  TilePage,
  btn,
  card,
  dateGB,
  dateTimeGB,
  gbp,
  h2,
  inp,
  loadTenantAndProjects,
  monoLink,
  type Doc,
  type Item,
} from "../_shared";

/**
 * Docs and Legal tile — everything the client signs, and where each one is:
 * the proposal drafter (modules + document, behind the second-person review
 * gate), the Order Form / agreement and Change Orders (drafted and signed on
 * /agreement), DPA status, care-plan terms, deliverable uploads, and the
 * read receipts — Sent / Viewed / Signed ticks per document, with who
 * approved it for sending.
 */
export const dynamic = "force-dynamic";

type OrderForm = {
  id: string;
  reference: string;
  status: string;
  sent_at: string | null;
  accepted_at: string | null;
  created_at: string;
};
type ChangeOrder = {
  id: string;
  reference: string;
  status: string;
  description: string | null;
  created_at: string;
};

const RECEIPT_ORDER: Record<string, number> = {
  proposal: 0,
  dpa: 1,
  order_form: 2,
  change_order: 3,
  care_plan_terms: 4,
  deliverable: 5,
};

/** WhatsApp-style tick: grey single tick when missing, double tick when done. */
function Tick({
  at,
  done,
  label,
}: {
  at: string | null;
  done: "sent" | "viewed" | "signed";
  label: string;
}) {
  const colour =
    at === null
      ? "var(--k-faint)"
      : done === "signed"
        ? T.success
        : done === "viewed"
          ? "var(--k-accent)"
          : "var(--k-muted)";
  return (
    <div
      className="flex flex-col gap-0.5"
      title={at ? `${label} ${dateTimeGB(at)}` : `Not ${label.toLowerCase()} yet`}
    >
      <span
        aria-hidden
        style={{
          fontFamily: T.mono,
          fontSize: 13,
          lineHeight: 1,
          color: colour,
          letterSpacing: at ? "-0.35em" : 0,
        }}
      >
        {at ? "✓✓" : "✓"}
      </span>
      <span
        style={{
          fontFamily: T.mono,
          fontSize: 10,
          color: at ? "var(--k-muted)" : "var(--k-faint)",
          whiteSpace: "nowrap",
        }}
      >
        {at ? dateTimeGB(at) : "—"}
      </span>
    </div>
  );
}

export default async function ClientDocsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    /** Review gate bounce: review | self_approval | not_draft. */
    blocked?: string;
  }>;
}) {
  const { id: tenantId } = await params;
  const { blocked: reviewBlocked } = await searchParams;
  const staff = await requireStaff();
  if (!staff.ok) notFound();
  const { tenant: t, project } = await loadTenantAndProjects(tenantId);
  const projectId = project?.id ?? null;
  const supabase = await createClient();
  const service = createServiceClient();

  const noRows = Promise.resolve({ data: [] as Record<string, unknown>[] });
  const [
    { data: items },
    { data: docs },
    { data: compliance },
    { data: orderForms },
    { data: changeOrders },
    receipts,
    { data: approvals },
    { data: subprocessorRows },
    { data: priceNoticeRows },
  ] = await Promise.all([
    projectId
      ? supabase
          .from("project_items")
          .select("id, name, amount, status")
          .eq("project_id", projectId)
          .order("created_at")
      : noRows,
    projectId
      ? supabase
          .from("documents")
          .select("id, kind, storage_path, version, created_at")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false })
      : noRows,
    supabase
      .from("compliance_records")
      .select("id, recorded_at")
      .eq("tenant_id", tenantId)
      .eq("kind", "dpa_signed")
      .limit(1),
    supabase
      .from("order_forms")
      .select("id, reference, status, sent_at, accepted_at, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
    supabase
      .from("change_orders")
      .select("id, reference, status, description, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
    documentReceipts(service, tenantId),
    service
      .from("document_events")
      .select("document_type, document_id, actor, at")
      .eq("tenant_id", tenantId)
      .eq("event", "approved")
      .order("at", { ascending: false }),
    // Notices the client has been served — read-only register rows. The
    // notices themselves are run from /admin/compliance (§12) and the
    // Scale and Risk tile (§7); here they sit in the document register.
    supabase
      .from("subprocessor_notice_deliveries")
      .select(
        "id, sent_to, channel, sent_at, objected_at, subprocessor_notices(provider_name, change_type, effective_from, status)"
      )
      .eq("tenant_id", tenantId)
      .order("sent_at", { ascending: false }),
    supabase
      .from("price_change_notices")
      .select(
        "id, reference, status, direction, old_mrr, new_mrr, notice_sent_at, notice_sent_to, notice_channel, effective_date"
      )
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
  ]);
  type SubprocessorDelivery = {
    id: string;
    sent_to: string;
    channel: string;
    sent_at: string;
    objected_at: string | null;
    subprocessor_notices: {
      provider_name: string;
      change_type: string;
      effective_from: string;
      status: string;
    } | null;
  };
  type PriceNotice = {
    id: string;
    reference: string;
    status: string;
    direction: string;
    old_mrr: number;
    new_mrr: number;
    notice_sent_at: string | null;
    notice_sent_to: string | null;
    notice_channel: string | null;
    effective_date: string | null;
  };
  const subprocessorNotices = (subprocessorRows ??
    []) as unknown as SubprocessorDelivery[];
  const priceNotices = (priceNoticeRows ?? []) as PriceNotice[];

  const itemList = (items ?? []) as Item[];
  const docList = (docs ?? []) as Doc[];
  const dpaSigned = (compliance ?? []).length > 0;
  const orderFormList = (orderForms ?? []) as OrderForm[];
  const changeOrderList = (changeOrders ?? []) as ChangeOrder[];
  const total = itemList.reduce((s, i) => s + Number(i.amount), 0);
  const modulesComplete = itemList.length > 0;
  // The care plan is chosen by the client after go-live, never in the proposal.
  const planSelected = true;
  const isAccepted = project?.proposal_status === "accepted";
  // The client provides their DPA details in the portal; the docs can't be sent
  // until they have (drives the form gate + a header badge).
  const clientDpaReady = !!project && dpaReadyToSend(project);
  const review = project
    ? reviewState({
        author: project.proposal_drafted_by,
        reviewedBy: project.proposal_reviewed_by,
        reviewedAt: project.proposal_reviewed_at,
      })
    : null;

  // Who approved each document for sending — the latest 'approved' ledger row
  // per document, resolved to a staff name.
  type ApprovalRow = {
    document_type: string;
    document_id: string;
    actor: string | null;
    at: string;
  };
  const approver = new Map<string, string | null>();
  for (const a of (approvals ?? []) as ApprovalRow[]) {
    const key = `${a.document_type}:${a.document_id}`;
    if (!approver.has(key)) approver.set(key, a.actor);
  }
  const labels = await staffLabels([...approver.values()]);
  const sortedReceipts = [...receipts].sort(
    (a, b) =>
      (RECEIPT_ORDER[a.documentType] ?? 9) - (RECEIPT_ORDER[b.documentType] ?? 9) ||
      (b.sentAt ?? "").localeCompare(a.sentAt ?? "")
  );
  const awaitingSignature = receipts.filter((r) => r.sentAt && !r.signedAt).length;
  const awaitingApproval = receipts.filter((r) => r.awaitingApproval).length;
  const signed = receipts.filter((r) => r.signedAt).length;
  const headerTone =
    project?.proposal_status === "declined" || (project && !clientDpaReady && !isAccepted)
      ? "danger"
      : awaitingSignature > 0 || awaitingApproval > 0
        ? "warning"
        : signed > 0
          ? "success"
          : "muted";
  const headerChip =
    project?.proposal_status === "declined"
      ? "Proposal declined"
      : awaitingApproval > 0
        ? `${awaitingApproval} awaiting approval`
        : awaitingSignature > 0
          ? `${awaitingSignature} awaiting signature`
          : signed > 0
            ? `${signed} signed`
            : "Nothing sent yet";

  const liveOrderForm =
    orderFormList.find((o) => o.status !== "superseded" && o.status !== "withdrawn") ??
    null;

  const htid = <input type="hidden" name="tenant_id" value={tenantId} />;
  const hpid = projectId ? (
    <input type="hidden" name="project_id" value={projectId} />
  ) : null;

  return (
    <TilePage
      tenantId={tenantId}
      tenantName={t.name}
      index="07"
      label="Docs and Legal"
      title={t.name}
      lead="Every document the client signs, who approved it for sending, and whether they have opened it."
      actions={
        <>
          <StatusChip tone={headerTone}>{headerChip}</StatusChip>
          {project && (
            <SignalChip color={clientDpaReady ? T.success : T.warning}>
              {clientDpaReady ? "DPA details ✓" : "DPA details awaited"}
            </SignalChip>
          )}
          <SignalChip color={dpaSigned ? T.success : T.danger}>
            {dpaSigned ? "DPA signed" : "DPA pending"}
          </SignalChip>
          {project && <Badge s={project.proposal_status} />}
        </>
      }
      maxWidth={960}
    >
      <ReviewBlockedNotice blocked={reviewBlocked} />

      {/* Read receipts — one row per signable document */}
      <Reveal>
        <section style={card}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 style={{ ...h2, marginBottom: 0 }}>Read receipts</h2>
            <span style={{ fontFamily: T.mono, fontSize: 10, color: "var(--k-faint)" }}>
              Viewed = first time the client opened it in the portal (staff previews
              excluded)
            </span>
          </div>
          {sortedReceipts.length === 0 ? (
            <p
              style={{
                fontFamily: T.sans,
                fontSize: "0.85rem",
                color: "var(--k-faint)",
                marginTop: 10,
              }}
            >
              Nothing has been sent to this client yet.
            </p>
          ) : (
            <div style={{ overflowX: "auto", marginTop: 10 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Document", "Sent", "Viewed", "Signed", "Approved by"].map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: "left",
                          fontFamily: T.mono,
                          fontSize: 9,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color: "var(--k-faint)",
                          padding: "6px 8px 6px 0",
                          borderBottom: "1px solid var(--k-border)",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedReceipts.map((r) => {
                    const who = approver.get(`${r.documentType}:${r.documentId}`);
                    const approvedBy =
                      who && labels[who]
                        ? labels[who]
                        : who
                          ? `staff ${who.slice(0, 8)}`
                          : null;
                    return (
                      <tr key={`${r.documentType}:${r.documentId}`}>
                        <td
                          style={{
                            padding: "8px 8px 8px 0",
                            borderBottom: "1px solid var(--k-border)",
                            verticalAlign: "top",
                          }}
                        >
                          <div
                            style={{
                              fontFamily: T.sans,
                              fontSize: "0.88rem",
                              color: "var(--k-fg)",
                            }}
                          >
                            {r.title}
                          </div>
                          <div
                            style={{
                              fontFamily: T.mono,
                              fontSize: 10,
                              color: "var(--k-faint)",
                              marginTop: 2,
                            }}
                          >
                            {DOCUMENT_TYPE_LABEL[r.documentType as DocumentType] ??
                              r.documentType}
                            {r.awaitingApproval ? " · awaiting approval" : ""}
                          </div>
                        </td>
                        {(
                          [
                            ["sent", r.sentAt, "Sent"],
                            ["viewed", r.viewedAt, "Viewed"],
                            ["signed", r.signedAt, "Signed"],
                          ] as const
                        ).map(([k, at, label]) => (
                          <td
                            key={k}
                            style={{
                              padding: "8px 8px 8px 0",
                              borderBottom: "1px solid var(--k-border)",
                              verticalAlign: "top",
                            }}
                          >
                            <Tick at={at} done={k} label={label} />
                          </td>
                        ))}
                        <td
                          style={{
                            padding: "8px 0",
                            borderBottom: "1px solid var(--k-border)",
                            verticalAlign: "top",
                            fontFamily: T.mono,
                            fontSize: 10,
                            color: r.approvedAt ? "var(--k-muted)" : "var(--k-faint)",
                          }}
                        >
                          {r.approvedAt ? (
                            <>
                              {approvedBy ?? "Approved"}
                              <div>{dateTimeGB(r.approvedAt)}</div>
                            </>
                          ) : r.awaitingApproval ? (
                            <span style={{ color: T.warning }}>Awaiting approval</span>
                          ) : r.sentAt ? (
                            "No approval recorded"
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </Reveal>

      {/* No project yet → nothing to draft */}
      {!project && (
        <Reveal>
          <section style={card}>
            <h2 style={{ ...h2, marginBottom: 6 }}>Proposal</h2>
            <p
              style={{ fontFamily: T.sans, fontSize: "0.85rem", color: "var(--k-faint)" }}
            >
              No build project yet — the proposal, DPA and deliverables unlock once one
              exists.{" "}
              <Link href={`/admin/clients/${tenantId}/passport`} style={monoLink}>
                Start build project →
              </Link>
            </p>
          </section>
        </Reveal>
      )}

      {project && (
        <>
          {/* Proposal / build modules */}
          <Reveal>
            <section style={card}>
              <div className="flex items-center justify-between">
                <h2 style={h2}>Proposal — build modules</h2>
                <span
                  style={{
                    fontFamily: T.display,
                    fontWeight: 700,
                    fontSize: "1.3rem",
                    color: "var(--k-fg)",
                  }}
                >
                  {gbp(total)}
                </span>
              </div>
              {itemList.length === 0 && (
                <p
                  style={{
                    fontFamily: T.sans,
                    fontSize: "0.85rem",
                    color: "var(--k-faint)",
                  }}
                >
                  No modules yet. Add what the client wants built.
                </p>
              )}
              <div className="flex flex-col gap-1.5" style={{ marginBottom: 12 }}>
                {itemList.map((it) => (
                  <div
                    key={it.id}
                    className="flex items-center justify-between"
                    style={{ padding: "7px 0", borderTop: "1px solid var(--k-border)" }}
                  >
                    <span
                      style={{
                        fontFamily: T.sans,
                        fontSize: "0.9rem",
                        color: "var(--k-fg)",
                      }}
                    >
                      {it.name}
                    </span>
                    <div className="flex items-center gap-3">
                      <span
                        style={{
                          fontFamily: T.mono,
                          fontSize: "0.85rem",
                          color: "var(--k-muted)",
                        }}
                      >
                        {gbp(Number(it.amount))}
                      </span>
                      {!isAccepted && (
                        <form action={removeItem}>
                          {htid}
                          <input type="hidden" name="id" value={it.id} />
                          <SubmitButton
                            style={{
                              ...btn("transparent", "var(--k-faint)"),
                              height: 24,
                              paddingInline: 8,
                            }}
                          >
                            ✕
                          </SubmitButton>
                        </form>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {isAccepted ? (
                <p
                  style={{
                    fontFamily: T.mono,
                    fontSize: 11,
                    color: "var(--k-faint)",
                    paddingTop: 12,
                    borderTop: "1px solid var(--k-border)",
                  }}
                >
                  SCOPE LOCKED — this is the signed baseline. Additions go through a
                  change request.
                </p>
              ) : (
                <>
                  <form
                    action={addItem}
                    className="flex items-center gap-2 flex-wrap"
                    style={{ paddingTop: 12, borderTop: "1px solid var(--k-border)" }}
                  >
                    {htid}
                    {hpid}
                    <input
                      name="name"
                      placeholder="Module (e.g. Booking system)"
                      required
                      style={{ ...inp, width: 220 }}
                    />
                    <input
                      name="amount"
                      type="number"
                      step="1"
                      placeholder="£"
                      required
                      style={{ ...inp, width: 90 }}
                    />
                    <SubmitButton style={btn("var(--k-surface)", "var(--k-fg)")}>
                      + Add
                    </SubmitButton>
                  </form>
                  <div className="flex flex-wrap gap-1.5" style={{ marginTop: 10 }}>
                    {CATALOG.map((m) => (
                      <form key={m.key} action={addItem}>
                        {htid}
                        {hpid}
                        <input type="hidden" name="name" value={m.name} />
                        <input type="hidden" name="amount" value={m.price} />
                        <SubmitButton
                          style={{
                            fontFamily: T.mono,
                            fontSize: 10,
                            height: 24,
                            paddingInline: 8,
                            background: "transparent",
                            color: "var(--k-muted)",
                            border: "1px solid var(--k-border)",
                            borderRadius: 0,
                            cursor: "pointer",
                          }}
                        >
                          + {m.name} {gbp(m.price)}
                        </SubmitButton>
                      </form>
                    ))}
                  </div>
                </>
              )}
              {/* Ongoing care plan — part of the proposal the client accepts. */}
              <div
                className="flex items-center gap-2 flex-wrap"
                style={{
                  marginTop: 14,
                  paddingTop: 14,
                  borderTop: "1px solid var(--k-border)",
                }}
              >
                <span
                  style={{
                    fontFamily: T.sans,
                    fontSize: "0.85rem",
                    color: "var(--k-fg)",
                  }}
                >
                  Ongoing care plan
                </span>
                {/* The client chooses their plan in the portal once the system
                    is live — staff never pick one on their behalf. The proposal
                    describes the levels; the choice comes after the build. */}
                <span
                  style={{ fontFamily: T.mono, fontSize: 11, color: "var(--k-muted)" }}
                >
                  Chosen by the client after go-live
                  {project.proposed_plan
                    ? ` · proposal mentions ${carePlan(project.proposed_plan)?.label}`
                    : ""}
                </span>
              </div>
              {project.proposal_status === "draft" && (
                <p
                  style={{
                    fontFamily: T.mono,
                    fontSize: 11,
                    color: "var(--k-faint)",
                    marginTop: 12,
                  }}
                >
                  Add modules (and optionally a care plan) here, then complete &amp; send
                  the documents below.
                </p>
              )}
              {project.proposal_status === "sent" && (
                <p
                  style={{
                    fontFamily: T.mono,
                    fontSize: 11,
                    color: T.warning,
                    marginTop: 12,
                  }}
                >
                  Sent — awaiting the client&apos;s acceptance + DPA in their portal.
                </p>
              )}
              {project.proposal_status === "accepted" && (
                <p
                  style={{
                    fontFamily: T.mono,
                    fontSize: 11,
                    color: "var(--k-accent)",
                    marginTop: 12,
                  }}
                >
                  Accepted by the client ✓
                </p>
              )}
            </section>
          </Reveal>

          {/* Proposal document + DPA details (authoring) */}
          <Reveal>
            <section style={card}>
              <div
                className="flex items-center justify-between flex-wrap gap-2"
                style={{ marginBottom: 4 }}
              >
                <h2 style={{ ...h2, marginBottom: 0 }}>
                  Proposal document &amp; DPA details
                </h2>
                <Link href={`/admin/clients/${tenantId}/documents`} style={monoLink}>
                  View / download documents →
                </Link>
              </div>
              <p
                style={{
                  fontFamily: T.sans,
                  fontSize: "0.82rem",
                  color: "var(--k-faint)",
                  marginTop: -6,
                  marginBottom: 14,
                }}
              >
                Author the proposal here. The DPA details are provided by the client in
                their portal (status below) — the document ports them on automatically.
                You can send once the modules, this doc and the client&apos;s DPA details
                are complete, and a staff member other than the author has approved the
                draft. A care plan is optional.
              </p>
              <div className="flex flex-col gap-3" style={{ marginBottom: 14 }}>
                <ReviewGate
                  kind="proposal"
                  id={project.id}
                  tenantId={tenantId}
                  author={project.proposal_drafted_by}
                  reviewedBy={project.proposal_reviewed_by}
                  reviewedAt={project.proposal_reviewed_at}
                  viewerId={staff.userId}
                  sendable={project.proposal_status === "draft"}
                  returnTo={`/admin/clients/${tenantId}/docs`}
                />
              </div>
              <ProposalDocsForm
                action={saveDocsAndSend}
                reviewApproved={review?.canSend ?? false}
                reviewReason={review?.reason}
                tenantId={tenantId}
                projectId={project.id}
                proposalStatus={project.proposal_status}
                modulesComplete={modulesComplete}
                planSelected={planSelected}
                clientDpaReady={clientDpaReady}
                clientSubmittedAt={project.dpa_client_submitted_at}
                entityType={project.client_entity_type}
                companyName={project.dpa_client_company_name}
                companyNumber={project.dpa_client_company_number}
                registeredAddress={project.dpa_client_registered_address}
                personalData={project.dpa_personal_data}
                specialCategory={project.dpa_special_category}
                specialCategoryDetail={project.dpa_special_category_detail}
                defaults={{
                  overview: project.overview ?? "",
                  paymentTerms: project.payment_terms ?? "",
                }}
              />
            </section>
          </Reveal>
        </>
      )}

      {/* Agreement — Order Form + Change Orders, drafted and signed on /agreement */}
      <Reveal>
        <section style={card}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 style={{ ...h2, marginBottom: 0 }}>Order Form &amp; Change Orders</h2>
            <Link href={`/admin/clients/${tenantId}/agreement`} style={monoLink}>
              {liveOrderForm ? "Open the agreement →" : "Draft an Order Form →"}
            </Link>
          </div>
          <p
            style={{
              fontFamily: T.sans,
              fontSize: "0.82rem",
              color: "var(--k-faint)",
              margin: "6px 0 12px",
            }}
          >
            The Order Form that governs the relationship (with its incorporated terms),
            the evidence of its acceptance, and every Change Order raised against it. Each
            one is drafted, approved by a second staff member and sent from the agreement
            page.
          </p>
          {orderFormList.length === 0 ? (
            <p
              style={{ fontFamily: T.sans, fontSize: "0.85rem", color: "var(--k-faint)" }}
            >
              No Order Form yet.
            </p>
          ) : (
            orderFormList.map((o) => (
              <div
                key={o.id}
                className="flex flex-wrap items-center justify-between gap-2"
                style={{ padding: "8px 0", borderTop: "1px solid var(--k-border)" }}
              >
                <span
                  style={{ fontFamily: T.sans, fontSize: "0.9rem", color: "var(--k-fg)" }}
                >
                  Order Form {o.reference}{" "}
                  <span
                    style={{ color: "var(--k-faint)", fontFamily: T.mono, fontSize: 11 }}
                  >
                    {o.accepted_at
                      ? `· signed ${dateGB(o.accepted_at)}`
                      : o.sent_at
                        ? `· sent ${dateGB(o.sent_at)}`
                        : `· drafted ${dateGB(o.created_at)}`}
                  </span>
                </span>
                <Badge s={o.status} />
              </div>
            ))
          )}
          {changeOrderList.length > 0 && (
            <div
              style={{
                marginTop: 12,
                paddingTop: 12,
                borderTop: "1px solid var(--k-border)",
              }}
            >
              <div
                style={{
                  fontFamily: T.mono,
                  fontSize: 9,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--k-faint)",
                  marginBottom: 4,
                }}
              >
                Change Orders
              </div>
              {changeOrderList.map((co) => (
                <div
                  key={co.id}
                  className="flex flex-wrap items-center justify-between gap-2"
                  style={{ padding: "6px 0" }}
                >
                  <span
                    style={{
                      fontFamily: T.sans,
                      fontSize: "0.88rem",
                      color: "var(--k-fg)",
                    }}
                  >
                    {co.reference}
                    {co.description ? (
                      <span style={{ color: "var(--k-muted)" }}>
                        {" "}
                        —{" "}
                        {co.description.length > 80
                          ? `${co.description.slice(0, 80)}…`
                          : co.description}
                      </span>
                    ) : null}
                  </span>
                  <Badge s={co.status} />
                </div>
              ))}
            </div>
          )}
        </section>
      </Reveal>

      {/* DPA / compliance */}
      <Reveal>
        <section style={card}>
          <h2 style={h2}>Data Processing Agreement</h2>
          <p
            style={{
              fontFamily: T.sans,
              fontSize: "0.85rem",
              color: "var(--k-muted)",
              lineHeight: 1.6,
              marginBottom: 12,
            }}
          >
            The client signs the DPA when they accept the proposal in their portal. Record
            it here if it was signed offline — a project cannot go <b>live</b> until a DPA
            is logged.
          </p>
          {dpaSigned ? (
            <span style={{ fontFamily: T.mono, fontSize: 12, color: T.success }}>
              ✓ DPA signed — logged for this client.
            </span>
          ) : (
            <form action={recordDpa}>
              {htid}
              <SubmitButton style={btn("var(--k-surface)", "var(--k-fg)")}>
                Record DPA as signed
              </SubmitButton>
            </form>
          )}
        </section>
      </Reveal>

      {/* Care-plan terms */}
      <Reveal>
        <section style={card}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 style={{ ...h2, marginBottom: 0 }}>Care-plan terms</h2>
            <Link href={`/admin/clients/${tenantId}/care-plan`} style={monoLink}>
              Care Plan tile →
            </Link>
          </div>
          <p
            style={{
              fontFamily: T.mono,
              fontSize: 12,
              color: t.care_plan_terms_accepted_at ? T.success : "var(--k-muted)",
              marginTop: 10,
            }}
          >
            {t.care_plan_terms_accepted_at
              ? `✓ Accepted ${dateGB(t.care_plan_terms_accepted_at)}${
                  t.care_plan_choice && t.care_plan_choice !== "none"
                    ? ` · ${carePlan(t.care_plan_choice)?.label ?? t.care_plan_choice}`
                    : ""
                }`
              : t.care_plan_choice === "none"
                ? "The client chose no care plan for now — no terms to accept."
                : "Not yet accepted — the client agrees the terms when they choose their plan in the portal."}
          </p>
        </section>
      </Reveal>

      {/* Notices served — subprocessor changes (§12) and price changes (§7) */}
      <Reveal>
        <section style={card}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 style={{ ...h2, marginBottom: 0 }}>Notices served</h2>
            <div className="flex items-center gap-3 flex-wrap">
              <Link href="/admin/compliance" style={monoLink}>
                §12 notices →
              </Link>
              <Link href={`/admin/clients/${tenantId}/pricing`} style={monoLink}>
                §7 re-band →
              </Link>
            </div>
          </div>
          <p
            style={{
              fontFamily: T.sans,
              fontSize: "0.82rem",
              color: "var(--k-faint)",
              margin: "6px 0 10px",
            }}
          >
            Documents the client receives rather than signs: each subprocessor change
            notice delivered to them, and each price-change notice with its effective
            date.
          </p>
          {subprocessorNotices.length === 0 && priceNotices.length === 0 ? (
            <p
              style={{ fontFamily: T.sans, fontSize: "0.85rem", color: "var(--k-faint)" }}
            >
              No notices served to this client yet.
            </p>
          ) : (
            <div className="flex flex-col">
              {subprocessorNotices.map((d, i) => {
                const n = d.subprocessor_notices;
                return (
                  <div
                    key={d.id}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1"
                    style={{
                      padding: "7px 0",
                      borderTop: i ? "1px solid var(--k-border)" : "none",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: T.sans,
                        fontSize: "0.88rem",
                        color: "var(--k-fg)",
                      }}
                    >
                      Subprocessor notice
                      {n
                        ? ` — ${n.provider_name} ${n.change_type.replace(/_/g, " ")}`
                        : ""}
                      <span
                        style={{
                          fontFamily: T.mono,
                          fontSize: 11,
                          color: "var(--k-faint)",
                          marginLeft: 8,
                        }}
                      >
                        sent {dateGB(d.sent_at)} · {d.channel} · {d.sent_to}
                        {n ? ` · effective ${dateGB(n.effective_from)}` : ""}
                      </span>
                    </span>
                    <div className="flex items-center gap-2">
                      {d.objected_at ? (
                        <StatusChip tone="danger">
                          objected {dateGB(d.objected_at)}
                        </StatusChip>
                      ) : n ? (
                        <Badge s={n.status} />
                      ) : null}
                    </div>
                  </div>
                );
              })}
              {priceNotices.map((n, i) => (
                <div
                  key={n.id}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1"
                  style={{
                    padding: "7px 0",
                    borderTop:
                      i || subprocessorNotices.length
                        ? "1px solid var(--k-border)"
                        : "none",
                  }}
                >
                  <span
                    style={{
                      fontFamily: T.sans,
                      fontSize: "0.88rem",
                      color: "var(--k-fg)",
                    }}
                  >
                    Price change notice {n.reference} — {gbp(Number(n.old_mrr))} →{" "}
                    {gbp(Number(n.new_mrr))}/mo
                    <span
                      style={{
                        fontFamily: T.mono,
                        fontSize: 11,
                        color: "var(--k-faint)",
                        marginLeft: 8,
                      }}
                    >
                      {n.notice_sent_at
                        ? `sent ${dateGB(n.notice_sent_at)}${n.notice_channel ? ` · ${n.notice_channel}` : ""}${n.notice_sent_to ? ` · ${n.notice_sent_to}` : ""}`
                        : "not yet sent"}
                      {n.effective_date ? ` · effective ${dateGB(n.effective_date)}` : ""}
                    </span>
                  </span>
                  <Badge s={n.status} />
                </div>
              ))}
            </div>
          )}
        </section>
      </Reveal>

      {/* Deliverables */}
      {project && (
        <Reveal>
          <section style={card}>
            <h2 style={h2}>Deliverables</h2>
            {docList.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-2"
                style={{
                  fontFamily: T.mono,
                  fontSize: 11,
                  color: "var(--k-muted)",
                  padding: "2px 0",
                }}
              >
                <span style={{ color: "var(--k-accent)" }}>v{d.version}</span>
                <span style={{ color: "var(--k-faint)" }}>{d.kind}</span>
                <span>{d.storage_path.split("/").pop()}</span>
              </div>
            ))}
            <form
              action={uploadDoc}
              className="flex items-center gap-2 flex-wrap"
              style={{ marginTop: 10 }}
            >
              {htid}
              {hpid}
              <select name="kind" defaultValue="asset" style={{ ...inp, width: 110 }}>
                <option value="asset">asset</option>
                <option value="brief">brief</option>
                <option value="contract">contract</option>
                <option value="consent">consent</option>
              </select>
              <input
                type="file"
                name="file"
                required
                style={{ fontFamily: T.mono, fontSize: 11, color: "var(--k-muted)" }}
              />
              <SubmitButton style={btn("var(--k-surface)", "var(--k-fg)")}>
                Upload
              </SubmitButton>
            </form>
          </section>
        </Reveal>
      )}
    </TilePage>
  );
}
