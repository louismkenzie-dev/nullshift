import Link from "next/link";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@nullshift/db";
import { getPortalClient, isClientPreview } from "@/lib/clientPreview";
import { logAudit } from "@nullshift/db/audit";
import { T } from "@nullshift/ui/tokens";
import { PageHeader, Panel, StatusChip } from "@/components/app/AppKit";
import {
  legalConfig,
  effectiveDateLabel,
  bindingAcceptanceEnabled,
} from "@nullshift/content/legal/config";
import { activeSubprocessors } from "@nullshift/content/legal/subprocessors";
import { SUPPORT_BOUNDARY } from "@nullshift/content/pricing";
import {
  CHANGE_ORDER_LABEL,
  type ChangeOrderStatus,
} from "@nullshift/content/legal/work";
import { SCALE_BAND_LABEL } from "@/lib/pricing/nsi";
import {
  PAYMENT_ARCHITECTURE_LABEL,
  incorporatedDocuments,
  type OrderFormRow,
} from "@/lib/legal/agreement";
import { AcceptOrderForm } from "@/components/portal/AcceptOrderForm";
import { recordClientViews, recordDocumentEvent } from "@/lib/documentEvents";

/**
 * The client's legal centre (spec §17), and the place they actually accept
 * things (§5, §9).
 *
 * Everything a client might need to answer "what did I agree to, what am I
 * paying, who holds my data and what happens if I leave" is on one page, with
 * links to the controlling full text rather than summaries pretending to be it.
 */
export const dynamic = "force-dynamic";

const gbp = (n: number | string | null | undefined) =>
  n === null || n === undefined
    ? "—"
    : "£" + Number(n).toLocaleString("en-GB", { maximumFractionDigits: 2 });
const dateGB = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "—";

const mono: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: "0.64rem",
  fontWeight: 500,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--k-muted)",
};
const body: React.CSSProperties = {
  fontFamily: T.sans,
  fontSize: "0.92rem",
  lineHeight: 1.7,
  color: "var(--k-muted)",
};

/* ── server actions ────────────────────────────────────────────── */

export type AcceptResult = { ok: boolean; error?: string };

/**
 * Record a binding acceptance (§5).
 *
 * Refuses on four independent grounds, in this order: a read-only staff
 * preview, an unreviewed legal pack, a missing confirmation, and an order that
 * is not actually out for review. The last one matters most — it is what stops
 * a stale form being replayed against a superseded agreement.
 */
async function acceptOrder(
  _prev: AcceptResult | null,
  formData: FormData
): Promise<AcceptResult> {
  "use server";
  if (await isClientPreview())
    return { ok: false, error: "Preview is view-only — nothing was signed." };

  if (!bindingAcceptanceEnabled())
    return {
      ok: false,
      error:
        "The agreement is not in force yet, so it cannot be accepted. Please contact us.",
    };

  const orderFormId = String(formData.get("order_form_id") || "");
  const name = String(formData.get("accepted_by_name") || "").trim();
  const title = String(formData.get("accepted_by_title") || "").trim();
  const email = String(formData.get("accepted_by_email") || "").trim();
  if (!orderFormId || !name || !title || !email)
    return { ok: false, error: "Please complete your name, role and email." };

  const authority = formData.get("authority") === "on";
  const businessPurpose = formData.get("business_purpose") === "on";
  const termsRead = formData.get("terms_read") === "on";
  if (!authority || !businessPurpose || !termsRead)
    return { ok: false, error: "All three confirmations are required." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in again." };

  // Read through RLS: a client can only see their own order, so this doubles
  // as the authorisation check.
  const { data: order } = await supabase
    .from("order_forms")
    .select("id, tenant_id, status")
    .eq("id", orderFormId)
    .maybeSingle();
  if (!order || order.status !== "client_review")
    return { ok: false, error: "This agreement is no longer awaiting acceptance." };

  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  const docs = incorporatedDocuments();

  const db = createServiceClient();
  const { error: insertError } = await db.from("contract_acceptances").insert({
    tenant_id: order.tenant_id,
    order_form_id: order.id,
    accepted_by_name: name,
    accepted_by_title: title,
    accepted_by_email: email,
    accepted_by_user: user.id,
    authority_confirmed: authority,
    business_purpose_confirmed: businessPurpose,
    terms_read_confirmed: termsRead,
    ...docs.versions,
    document_hashes: docs.hashes,
    ip_address: ip,
    user_agent: h.get("user-agent"),
    acceptance_method: "clickwrap",
  });
  if (insertError)
    return { ok: false, error: "We couldn't record that. Please try again." };

  await db
    .from("order_forms")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", order.id);

  await recordDocumentEvent(db, {
    tenantId: order.tenant_id,
    documentType: "order_form",
    documentId: order.id,
    event: "signed",
    actor: user.id,
    actorKind: "client",
    meta: { by: email, versions: docs.versions },
  });

  await logAudit({
    action: "order_form.accepted",
    target: `order_form:${order.id}`,
    tenantId: order.tenant_id,
    metadata: { by: email, versions: docs.versions },
  });

  revalidatePath("/portal/legal");
  return { ok: true };
}

/** Accept or reject a Change Order (§9). The client's decision, only. */
async function decideChangeOrder(formData: FormData) {
  "use server";
  if (await isClientPreview()) return;
  const id = String(formData.get("id") || "");
  const decision = String(formData.get("decision") || "");
  if (!id || !["accepted", "rejected"].includes(decision)) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: co } = await supabase
    .from("change_orders")
    .select("id, tenant_id, status")
    .eq("id", id)
    .maybeSingle();
  if (!co || co.status !== "client_review") return;

  const name = String(formData.get("accepted_by_name") || "").trim();
  if (decision === "accepted" && !name) return;

  const db = createServiceClient();
  await db
    .from("change_orders")
    .update(
      decision === "accepted"
        ? {
            status: "accepted",
            accepted_by_name: name,
            accepted_by_email: user.email ?? null,
            accepted_by_user: user.id,
            accepted_at: new Date().toISOString(),
            contract_version: legalConfig.legal.clientAgreementVersion,
          }
        : { status: "rejected" }
    )
    .eq("id", id);

  if (decision === "accepted")
    await recordDocumentEvent(db, {
      tenantId: co.tenant_id,
      documentType: "change_order",
      documentId: id,
      event: "signed",
      actor: user.id,
      actorKind: "client",
      meta: { by: user.email ?? null, name },
    });

  await logAudit({
    action: `change_order.${decision}`,
    target: `change_order:${id}`,
    tenantId: co.tenant_id,
    metadata: { by: user.email },
  });
  revalidatePath("/portal/legal");
}

/* ── page ──────────────────────────────────────────────────────── */

export default async function PortalLegalPage() {
  const { supabase, user, preview } = await getPortalClient();

  const [{ data: orders }, { data: changeOrders }, { data: subs }, { data: projects }] =
    await Promise.all([
      supabase.from("order_forms").select("*").order("created_at", { ascending: false }),
      supabase
        .from("change_orders")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("subscriptions")
        .select("plan, mrr, status, started_at")
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("projects")
        .select("id, name, dpa_client_submitted_at")
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

  const list = (orders ?? []) as OrderFormRow[];
  const active =
    list.find((o) => o.status === "accepted") ??
    list.find((o) => o.status === "client_review") ??
    null;
  const awaiting = active?.status === "client_review" ? active : null;
  const acceptance = active
    ? (
        await supabase
          .from("contract_acceptances")
          .select("*")
          .eq("order_form_id", active.id)
          .maybeSingle()
      ).data
    : null;

  const sub = subs?.[0];
  const project = projects?.[0];
  const docs = incorporatedDocuments();
  const pendingChanges = (changeOrders ?? []).filter((c) => c.status === "client_review");

  // Read receipts: the real client (never a staff preview) has now opened
  // every Order Form and Change Order that has been sent to them.
  if (user && !preview) {
    const sentOrders = list.filter((o) => o.status !== "draft");
    const sentChanges = (changeOrders ?? []).filter((c) => c.status !== "draft");
    const tenantId = sentOrders[0]?.tenant_id ?? sentChanges[0]?.tenant_id;
    if (tenantId)
      await recordClientViews(createServiceClient(), {
        tenantId,
        userId: user.id,
        documents: [
          ...sentOrders.map((o) => ({
            documentType: "order_form" as const,
            documentId: o.id,
          })),
          ...sentChanges.map((c) => ({
            documentType: "change_order" as const,
            documentId: c.id as string,
          })),
        ],
      });
  }

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        index="/08"
        label="Legal"
        title="Your agreement"
        lead="What you're on, what you pay, what we're allowed to do with your data, and how to leave."
      />

      {/* ── acceptance (§5) ────────────────────────────────── */}
      {awaiting && (
        <Panel label="Awaiting your acceptance" title={awaiting.reference}>
          <OrderSummary row={awaiting} />
          <div className="mt-6">
            <AcceptOrderForm
              action={acceptOrder}
              orderFormId={awaiting.id}
              clientLegalName={awaiting.client_legal_name}
              documents={docs.links}
              disabled={!!preview}
            />
          </div>
        </Panel>
      )}

      {/* ── the live agreement (§17) ───────────────────────── */}
      {active && active.status === "accepted" && (
        <Panel
          label={active.reference}
          title="Order Form"
          actions={<StatusChip tone="success">Accepted</StatusChip>}
        >
          <OrderSummary row={active} />
          {acceptance && (
            <p style={{ ...body, marginTop: 16 }}>
              Accepted by {acceptance.accepted_by_name} ({acceptance.accepted_by_title})
              on {dateGB(acceptance.accepted_at)}, against {acceptance.msa_version} and
              pricing version {acceptance.pricing_version}.
            </p>
          )}
        </Panel>
      )}

      {!active && (
        <Panel label="Agreement" title="Nothing to sign yet">
          <p style={body}>
            You don&apos;t have an Order Form waiting. Everything below still applies to
            how we work and how we handle your data.
          </p>
        </Panel>
      )}

      {/* ── billing (§17) ─────────────────────────────────── */}
      <Panel label="Billing" title="What you pay">
        <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
          <Row k="Plan" v={active ? active.plan : (sub?.plan ?? "—")} />
          <Row
            k="Scale band"
            v={
              active
                ? active.scale_band === "enterprise"
                  ? "Enterprise"
                  : SCALE_BAND_LABEL[active.scale_band as keyof typeof SCALE_BAND_LABEL]
                : "—"
            }
          />
          <Row
            k="Recurring fee"
            v={`${gbp(active?.monthly_fee ?? sub?.mrr)} per month`}
          />
          <Row k="Billing rule" v={active?.billing_date_rule ?? "—"} />
          <Row k="Pricing version" v={active?.pricing_version ?? "—"} />
          <Row
            k="VAT"
            v={
              active?.vat_treatment === "not_vat_registered"
                ? "Not VAT registered — no VAT is charged"
                : (active?.vat_treatment.replace(/_/g, " ") ?? "—")
            }
          />
        </dl>
        <p style={{ ...body, marginTop: 14 }}>
          Your fee never changes without your approval and written notice. If your usage
          moves enough to change your band, we tell you, show you the new figure and give
          you 30 days before anything is charged.
        </p>
      </Panel>

      {/* ── payments architecture (§14) ────────────────────── */}
      {active?.payment_architecture && (
        <Panel label="§14 Payments" title="Who holds your customers' money">
          <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
            <Row
              k="Architecture"
              v={PAYMENT_ARCHITECTURE_LABEL[active.payment_architecture]}
            />
            <Row k="Merchant of record" v={active.client_legal_name} />
            <Row k="Payout destination" v={`${active.client_legal_name}'s own account`} />
            <Row k="Refunds and chargebacks" v={active.client_legal_name} />
          </dl>
          <p style={{ ...body, marginTop: 14 }}>
            Nullshift is the technical integrator, not the merchant of record. Your
            customers&apos; money is never received into a Nullshift account, and we never
            store card numbers or security codes — payment details go straight to the
            payment provider.
          </p>
        </Panel>
      )}

      {/* ── change orders (§9) ─────────────────────────────── */}
      {(changeOrders ?? []).length > 0 && (
        <Panel
          label="§9 Changes"
          title={
            pendingChanges.length
              ? `${pendingChanges.length} waiting for you`
              : "Change Orders"
          }
        >
          <div className="flex flex-col gap-4">
            {(changeOrders ?? []).map((co) => (
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

                {co.business_outcome && (
                  <p style={{ ...body, marginTop: 10 }}>{co.business_outcome}</p>
                )}

                <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-3">
                  <Row k="One-off fee" v={gbp(co.project_fee)} />
                  <Row
                    k="Change to your monthly"
                    v={
                      co.recurring_fee_delta === null
                        ? "—"
                        : Number(co.recurring_fee_delta) === 0
                          ? "No change"
                          : `${Number(co.recurring_fee_delta) > 0 ? "+" : ""}${gbp(co.recurring_fee_delta)}`
                    }
                  />
                  <Row k="Delivery" v={co.delivery_impact ?? "—"} />
                </dl>

                {(co.acceptance_criteria ?? []).length > 0 && (
                  <>
                    <p style={{ ...mono, marginTop: 14 }}>Done means</p>
                    <ul
                      className="mt-2 flex flex-col gap-1"
                      style={{ margin: 0, paddingLeft: 18 }}
                    >
                      {(co.acceptance_criteria as string[]).map((a) => (
                        <li key={a} style={{ ...body, fontSize: "0.88rem" }}>
                          {a}
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {co.status === "client_review" && (
                  <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
                    <form
                      action={decideChangeOrder}
                      className="flex flex-wrap items-end gap-3"
                    >
                      <input type="hidden" name="id" value={co.id} />
                      <input type="hidden" name="decision" value="accepted" />
                      <label style={{ minWidth: 220 }}>
                        <span style={{ ...mono, display: "block", marginBottom: 6 }}>
                          Your name
                        </span>
                        <input
                          name="accepted_by_name"
                          required
                          style={{
                            fontFamily: T.sans,
                            fontSize: "0.9rem",
                            color: "var(--k-fg)",
                            background: "var(--k-bg)",
                            border: "1px solid var(--k-border)",
                            borderRadius: 0,
                            padding: "9px 11px",
                            width: "100%",
                          }}
                        />
                      </label>
                      <button
                        type="submit"
                        className="kb kb-primary kb-sm"
                        disabled={!!preview}
                      >
                        Approve this change
                      </button>
                    </form>
                    <form action={decideChangeOrder}>
                      <input type="hidden" name="id" value={co.id} />
                      <input type="hidden" name="decision" value="rejected" />
                      <button
                        type="submit"
                        className="kb kb-outline kb-sm"
                        disabled={!!preview}
                      >
                        Decline
                      </button>
                    </form>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* ── support scope (§17) ────────────────────────────── */}
      <Panel label="Support" title="What your plan covers">
        <p
          style={{
            fontFamily: T.sans,
            fontSize: "1rem",
            lineHeight: 1.7,
            color: "var(--k-fg)",
            paddingLeft: 14,
            borderLeft: "2px solid var(--k-accent)",
          }}
        >
          {SUPPORT_BOUNDARY.test}
        </p>
        <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {[SUPPORT_BOUNDARY.included, SUPPORT_BOUNDARY.quoted].map((col) => (
            <div key={col.title}>
              <span style={{ ...mono, color: "var(--k-fg)" }}>{col.title}</span>
              <ul
                className="mt-3 flex flex-col gap-2"
                style={{ margin: 0, paddingLeft: 18 }}
              >
                {col.items.map((i) => (
                  <li key={i} style={{ ...body, fontSize: "0.88rem" }}>
                    {i}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Panel>

      {/* ── documents (§17) ────────────────────────────────── */}
      <Panel label="Documents" title="The terms that apply">
        <p style={body}>
          In force since {effectiveDateLabel()}. These are the controlling documents —
          anything summarised elsewhere is a summary, and these win.
        </p>
        <ul
          className="mt-4 flex flex-col gap-2"
          style={{ listStyle: "none", margin: 0, padding: 0 }}
        >
          {docs.links.map((d) => (
            <li key={d.href}>
              <Link href={d.href} style={{ ...body, color: "var(--k-accent)" }}>
                {d.label} →
              </Link>
            </li>
          ))}
          {project && (
            <li>
              <Link
                href={`/api/documents/dpa/${project.id}`}
                style={{ ...body, color: "var(--k-accent)" }}
              >
                Your Data Processing Agreement (PDF) ↓
              </Link>
            </li>
          )}
          {project && (
            <li>
              <Link
                href={`/api/documents/terms/${project.id}`}
                style={{ ...body, color: "var(--k-accent)" }}
              >
                Your Service &amp; Support Terms (PDF) ↓
              </Link>
            </li>
          )}
        </ul>
      </Panel>

      {/* ── subprocessors (§12, §17) ───────────────────────── */}
      <Panel label="§12 Subprocessors" title="Who else touches your data">
        <ul
          className="flex flex-col gap-3"
          style={{ listStyle: "none", margin: 0, padding: 0 }}
        >
          {activeSubprocessors().map((s) => (
            <li key={s.id}>
              <span
                style={{ fontFamily: T.sans, fontSize: "0.95rem", color: "var(--k-fg)" }}
              >
                {s.tradingName ?? s.legalName}
              </span>
              <p style={{ ...body, fontSize: "0.86rem" }}>{s.purpose}</p>
            </li>
          ))}
        </ul>
        <p style={{ ...body, marginTop: 14 }}>
          We give you at least 14 days&apos; direct notice before adding a new
          subprocessor that touches your data, and you can object.{" "}
          <Link
            href={legalConfig.routes.subprocessors}
            style={{ color: "var(--k-accent)" }}
          >
            Full register →
          </Link>
        </p>
      </Panel>

      {/* ── leaving (§18) ─────────────────────────────────── */}
      <Panel label="§18 Leaving" title="Export your data, or end the agreement">
        <p style={body}>
          Your data is yours. You can request a standard export at any time, and you can
          start the process of ending the agreement without emailing anyone.
        </p>
        <Link
          href="/portal/legal/close"
          className="kb kb-outline kb-sm"
          style={{ display: "inline-flex", marginTop: 14 }}
        >
          Data export &amp; termination
          <span className="k-arrow" aria-hidden>
            →
          </span>
        </Link>
      </Panel>

      {/* ── contacts (§17) ────────────────────────────────── */}
      <Panel label="Contacts" title="Who to talk to">
        <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
          <Row k="Legal" v={legalConfig.contact.legal} />
          <Row k="Privacy" v={legalConfig.contact.privacy} />
          <Row
            k="Billing"
            v={legalConfig.contact.billing ?? legalConfig.contact.general}
          />
          <Row
            k="Support"
            v={legalConfig.contact.support ?? legalConfig.contact.general}
          />
        </dl>
        <p style={{ ...body, marginTop: 14 }}>
          To complain about how we&apos;ve handled personal information, use the{" "}
          <Link
            href={legalConfig.routes.dataComplaint}
            style={{ color: "var(--k-accent)" }}
          >
            complaint form
          </Link>
          . You can also go straight to the ICO.
        </p>
      </Panel>
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

function OrderSummary({ row }: { row: OrderFormRow }) {
  const scope = row.scope ?? {};
  return (
    <>
      <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
        <Row k="Client" v={row.client_legal_name} />
        <Row k="Plan" v={row.plan} />
        <Row k="Monthly fee" v={`${gbp(row.monthly_fee)} per month`} />
        <Row k="One-off project fee" v={gbp(row.project_fee)} />
      </dl>
      {scope.businessOutcome && (
        <p
          style={{
            fontFamily: T.sans,
            fontSize: "1rem",
            lineHeight: 1.7,
            color: "var(--k-fg)",
            marginTop: 16,
            paddingLeft: 14,
            borderLeft: "2px solid var(--k-accent)",
          }}
        >
          {scope.businessOutcome}
        </p>
      )}
      {(scope.included ?? []).length > 0 && (
        <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <span style={{ ...mono, color: "var(--k-fg)" }}>Included</span>
            <ul
              className="mt-3 flex flex-col gap-2"
              style={{ margin: 0, paddingLeft: 18 }}
            >
              {(scope.included ?? []).map((i) => (
                <li key={i} style={{ ...body, fontSize: "0.88rem" }}>
                  {i}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <span style={{ ...mono, color: "var(--k-fg)" }}>Not included</span>
            <ul
              className="mt-3 flex flex-col gap-2"
              style={{ margin: 0, paddingLeft: 18 }}
            >
              {(scope.excluded ?? []).map((i) => (
                <li key={i} style={{ ...body, fontSize: "0.88rem" }}>
                  {i}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
