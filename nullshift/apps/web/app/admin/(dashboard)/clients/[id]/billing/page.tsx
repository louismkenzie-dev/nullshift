import Link from "next/link";
import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { createClient, createServiceClient } from "@nullshift/db";
import { requireStaff } from "@nullshift/auth/guards";
import { T } from "@nullshift/ui/tokens";
import { carePlan } from "@/lib/carePlans";
import { isXeroConfigured } from "@nullshift/billing/xero";
import { reconcileXeroInvoices } from "@/lib/xeroSync";
import { tenantBalance } from "@/lib/billing/balance";
import { Panel, StatusChip } from "@/components/app/AppKit";
import { Reveal } from "@/components/kyma";
import {
  generateInvoice,
  generateInvoiceOffline,
  markInvoicePaid,
  pushInvoiceToXero,
  regenerateInvoiceLive,
  syncInvoiceStatus,
} from "../actions";
// Tile-owned: the money cockpit's issueInvoice with this client fixed.
import { issueInvoice } from "./actions";
import {
  Badge,
  TilePage,
  btn,
  card,
  gbp,
  h2,
  inp,
  loadTenantAndProjects,
  monoLink,
  type Invoice,
  type Item,
  type Sub,
} from "../_shared";

/**
 * Billing and Payment tile — invoices (generate / send / sync / mark paid /
 * push to Xero), the build modules that make up the invoice lines, the
 * balance and deposit position, and the client's subscription rows
 * READ-ONLY (the plan is the client's choice; staff start or re-send it from
 * the Care Plan tile, never pick one here).
 */
export const dynamic = "force-dynamic";

export default async function ClientBillingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: tenantId } = await params;
  if (!(await requireStaff()).ok) notFound();
  const { tenant: t, project } = await loadTenantAndProjects(tenantId);
  const projectId = project?.id ?? null;
  const supabase = await createClient();
  // Payments taken in Xero flow back before this client's invoices load.
  await reconcileXeroInvoices(createServiceClient(), { tenantId, limit: 10 });

  const noRows = Promise.resolve({ data: [] as Record<string, unknown>[] });
  const [{ data: items }, { data: invs }, { data: subs }, { data: orderForms }] =
    await Promise.all([
      projectId
        ? supabase
            .from("project_items")
            .select("id, name, amount, status")
            .eq("project_id", projectId)
            .order("created_at")
        : noRows,
      // Every invoice on the client — the build invoice(s) on the primary
      // project plus ad-hoc one-offs raised against the tenant.
      supabase
        .from("invoices")
        .select(
          "id, project_id, amount, status, type, hosted_invoice_url, project_item_count, created_at, paid_at, xero_invoice_id"
        )
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false }),
      supabase
        .from("subscriptions")
        .select("id, plan, mrr, status, provider")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false }),
      // The contracted schedule: the live Order Form's billing fields, edited
      // on Docs and Legal (/agreement) and mirrored read-only here.
      supabase
        .from("order_forms")
        .select(
          "id, reference, status, client_billing_email, monthly_fee, project_fee, mobilisation_fee, billing_date_rule, invoice_schedule, vat_treatment, pricing_version, accepted_at, sent_at"
        )
        .eq("tenant_id", tenantId)
        .not("status", "in", "(withdrawn,superseded)")
        .order("created_at", { ascending: false }),
    ]);

  const itemList = (items ?? []) as Item[];
  const invoiceList = (invs ?? []) as Invoice[];
  const subList = (subs ?? []) as Sub[];
  type OrderFormBilling = {
    id: string;
    reference: string;
    status: string;
    client_billing_email: string;
    monthly_fee: number;
    project_fee: number | null;
    mobilisation_fee: number | null;
    billing_date_rule: string;
    invoice_schedule: unknown;
    vat_treatment: string;
    pricing_version: string;
    accepted_at: string | null;
    sent_at: string | null;
  };
  const orderFormList = (orderForms ?? []) as OrderFormBilling[];
  const rank = (st: string) =>
    st === "accepted" ? 0 : st === "client_review" ? 1 : st === "draft" ? 2 : 3;
  const liveOrderForm =
    [...orderFormList].sort((a, b) => rank(a.status) - rank(b.status))[0] ?? null;
  const VAT_LABEL: Record<string, string> = {
    plus_vat: "plus VAT",
    vat_included: "VAT included",
    not_vat_registered: "not VAT registered",
  };
  const scheduleLines: string[] = Array.isArray(liveOrderForm?.invoice_schedule)
    ? (liveOrderForm!.invoice_schedule as unknown[]).map((line) => {
        if (typeof line === "string") return line;
        if (line && typeof line === "object") {
          const o = line as Record<string, unknown>;
          const label = [o.label, o.milestone, o.description, o.name].find(
            (v) => typeof v === "string" && v
          ) as string | undefined;
          const amount = [o.amount, o.fee, o.value].find((v) => typeof v === "number") as
            | number
            | undefined;
          const pct = typeof o.percent === "number" ? `${o.percent}%` : null;
          return [label ?? "Instalment", pct, amount !== undefined ? gbp(amount) : null]
            .filter(Boolean)
            .join(" · ");
        }
        return String(line);
      })
    : [];
  // Account rollup over the build invoice(s): invested = paid, outstanding =
  // still open. (Recurring care-plan fees are tracked separately via the
  // subscription status, not folded into the one-off build investment.)
  const invested = invoiceList
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + Number(i.amount), 0);
  const outstanding = invoiceList
    .filter((i) => i.status === "open")
    .reduce((s, i) => s + Number(i.amount), 0);
  const hasStripeInvoice = invoiceList.some((i) => i.status !== "draft");
  const total = itemList.reduce((s, i) => s + Number(i.amount), 0);
  const mrr = subList
    .filter((s) => s.status === "active")
    .reduce((s, x) => s + Number(x.mrr), 0);

  const modulesComplete = itemList.length > 0;
  const isAccepted = project?.proposal_status === "accepted";
  // What the client actually owes, agreed-but-unbilled included. The portal
  // shows the same figure from the same helper, so the two screens cannot
  // disagree about whether a client owes anything.
  const balance = tenantBalance(
    project ? [{ id: project.id, proposal_status: project.proposal_status }] : [],
    itemList.map((i) => ({
      project_id: projectId,
      amount: i.amount,
      status: i.status,
    })),
    invoiceList.map((i) => ({
      project_id: i.project_id ?? null,
      amount: i.amount,
      status: i.status,
      type: i.type,
    }))
  );
  // The active BUILD invoice (ignore voided) + its lifecycle state, so the
  // button/card reads: generate → sent, awaiting payment → paid.
  //
  // Type-scoped deliberately: a paid deposit or an accepted-quote invoice is
  // also a live invoice on this project, and matching "any invoice" made the
  // panel report the build as settled while the balance had never been billed
  // at all — an unbilled balance hidden behind a green "Paid ✓".
  const primaryInvoice =
    invoiceList.find(
      (i) =>
        i.type === "build_milestone" && i.status !== "void" && i.project_id === projectId
    ) ?? null;
  const invoicePaid = primaryInvoice?.status === "paid";
  const invoiceSent = !!primaryInvoice && !invoicePaid;
  // Everything else already billed on this project (deposits, accepted quotes).
  const otherInvoices = invoiceList.filter(
    (i) => i.id !== primaryInvoice?.id && i.status !== "void"
  );
  const depositPaid = otherInvoices
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + Number(i.amount), 0);

  const headerTone = balance.unbilledTotal > 0 || outstanding > 0 ? "warning" : "success";
  const headerChip =
    balance.unbilledTotal > 0
      ? `${gbp(balance.unbilledTotal)} not invoiced`
      : outstanding > 0
        ? `${gbp(outstanding)} outstanding`
        : invoiceList.length > 0
          ? "Settled"
          : "No invoices";

  const htid = <input type="hidden" name="tenant_id" value={tenantId} />;
  const hpid = projectId ? (
    <input type="hidden" name="project_id" value={projectId} />
  ) : null;

  return (
    <TilePage
      tenantId={tenantId}
      tenantName={t.name}
      index="02"
      label="Billing and Payment"
      title={t.name}
      lead={
        project
          ? `Build invoices, agreed modules and the recurring plan for ${project.name}.`
          : "No build project yet — start one from the Passport tile to invoice this client."
      }
      actions={
        <>
          <StatusChip
            tone={
              invoiceList.length === 0 && !balance.unbilledTotal ? "muted" : headerTone
            }
          >
            {headerChip}
          </StatusChip>
          <Link href="/admin/billing" style={monoLink}>
            Money cockpit →
          </Link>
        </>
      }
    >
      {/* Money the client owes that nobody has billed. This used to be a dashed
          form buried inside the invoice panel, and the result was a client
          sitting at "£0 outstanding — all settled" with a thousand pounds of
          built work never invoiced. An un-raised bill is the loudest thing on
          the page now. */}
      {balance.unbilledTotal > 0 && project && (
        <Reveal>
          <section
            style={{
              ...card,
              borderColor: `color-mix(in oklab, ${T.warning} 45%, transparent)`,
              background: `color-mix(in oklab, ${T.warning} 6%, var(--k-surface))`,
            }}
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 style={h2}>{gbp(balance.unbilledTotal)} agreed but not invoiced</h2>
              <span
                style={{
                  fontFamily: T.mono,
                  fontSize: 10,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: T.warning,
                  border: `1px solid color-mix(in oklab, ${T.warning} 32%, transparent)`,
                  padding: "3px 8px",
                }}
              >
                CLIENT CANNOT PAY THIS YET
              </span>
            </div>
            <p
              style={{
                fontFamily: T.sans,
                fontSize: "0.88rem",
                lineHeight: 1.65,
                color: "var(--k-muted)",
                marginTop: 8,
                maxWidth: "70ch",
              }}
            >
              The portal shows this as outstanding, but there is no invoice behind it — so
              there is no card link and no due date. Raising it creates the Stripe hosted
              invoice, emails {t.contact_name ?? "the client"} a payment link and bank
              details, and mirrors it to Xero.
              {!isAccepted &&
                " This project has no portal signature, so a reason is recorded against the override."}
            </p>
            <form
              action={isAccepted ? generateInvoice : generateInvoiceOffline}
              className="flex flex-wrap items-center gap-2"
              style={{ marginTop: 12 }}
            >
              {htid}
              {hpid}
              {!isAccepted && (
                <input
                  name="reason"
                  required
                  placeholder="Why (recorded) — e.g. agreed and signed by email before the portal existed"
                  style={{ ...inp, height: 32, flex: "1 1 320px" }}
                />
              )}
              <SubmitButton
                style={btn("var(--k-accent)", "var(--k-on-accent)")}
                pendingLabel="Raising…"
              >
                Raise &amp; send {gbp(balance.unbilledTotal)} invoice
              </SubmitButton>
            </form>
          </section>
        </Reveal>
      )}

      {project && (
        <>
          {/* Invoice */}
          <Reveal>
            <section style={card}>
              <div className="flex items-center justify-between">
                <h2 style={{ ...h2, marginBottom: 0 }}>Invoice</h2>
                {invoicePaid ? (
                  <span
                    style={{
                      fontFamily: T.mono,
                      fontSize: 11,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      color: T.success,
                      background:
                        "color-mix(in oklab, " + T.success + " 12%, transparent)",
                      border:
                        "1px solid color-mix(in oklab, " +
                        T.success +
                        " 40%, transparent)",
                      borderRadius: 0,
                      padding: "7px 14px",
                    }}
                  >
                    Paid ✓
                  </span>
                ) : invoiceSent ? (
                  <span
                    style={{
                      fontFamily: T.mono,
                      fontSize: 11,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      color: T.warning,
                      background:
                        "color-mix(in oklab, " + T.warning + " 12%, transparent)",
                      border:
                        "1px solid color-mix(in oklab, " +
                        T.warning +
                        " 40%, transparent)",
                      borderRadius: 0,
                      padding: "7px 14px",
                    }}
                  >
                    Invoice sent — awaiting payment
                  </span>
                ) : (
                  <form action={generateInvoice}>
                    {htid}
                    {hpid}
                    <SubmitButton
                      disabled={!isAccepted}
                      style={{
                        ...btn(
                          isAccepted ? "var(--k-accent)" : "var(--k-surface)",
                          isAccepted ? "var(--k-on-accent)" : "var(--k-faint)"
                        ),
                        border: isAccepted ? "none" : "1px solid var(--k-border)",
                        cursor: isAccepted ? "pointer" : "not-allowed",
                        opacity: isAccepted ? 1 : 0.7,
                      }}
                    >
                      Generate &amp; send itemised invoice
                    </SubmitButton>
                  </form>
                )}
              </div>
              <p
                style={{
                  fontFamily: T.sans,
                  fontSize: "0.8rem",
                  color: "var(--k-faint)",
                  margin: "6px 0 12px",
                }}
              >
                {invoicePaid
                  ? "The client has paid the build invoice — it's recorded against their account below."
                  : invoiceSent
                    ? "Sent to the client — they've been emailed a Stripe payment link. This flips to Paid automatically once the payment goes through."
                    : isAccepted
                      ? "Compiles the build modules below into an itemised Stripe invoice and emails the client a payment link."
                      : "The build invoice is drafted automatically when the client signs in the portal. Agreed offline instead? Raise it below."}
              </p>

              {/* Money already taken on this project that ISN'T the build
                  invoice — a deposit or an accepted quote. Stated plainly so a
                  paid deposit is never read as "the build is settled". */}
              {depositPaid > 0 && !invoicePaid && (
                <p
                  style={{
                    fontFamily: T.sans,
                    fontSize: "0.8rem",
                    color: "var(--k-muted)",
                    margin: "0 0 12px",
                  }}
                >
                  {gbp(depositPaid)} already paid on this project (deposit / quotes). The
                  build modules below net {gbp(total)}
                  {total > 0 ? " — that is what the invoice will ask for." : "."}
                </p>
              )}

              {/* Agreed outside the portal — the only way to bill a project
                  that will never get a portal signature. Reason is required
                  and recorded. */}
              {!isAccepted && !invoicePaid && !invoiceSent && modulesComplete && (
                <form
                  action={generateInvoiceOffline}
                  className="flex flex-wrap items-center gap-2"
                  style={{
                    margin: "0 0 12px",
                    padding: "12px 14px",
                    border: "1px dashed var(--k-border)",
                  }}
                >
                  {htid}
                  {hpid}
                  <span
                    style={{
                      fontFamily: T.mono,
                      fontSize: 10,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--k-muted)",
                      width: "100%",
                    }}
                  >
                    Agreed offline — raise the invoice without a portal signature
                  </span>
                  <input
                    name="reason"
                    required
                    placeholder="Why (recorded) — e.g. signed by email before the portal existed"
                    style={{ ...inp, height: 30, flex: "1 1 260px" }}
                  />
                  <SubmitButton style={btn("var(--k-surface)", "var(--k-fg)")}>
                    Raise &amp; send invoice
                  </SubmitButton>
                </form>
              )}
              {invoiceList.length > 0 && (
                <div
                  className="flex items-center justify-between flex-wrap gap-2"
                  style={{
                    marginBottom: 12,
                    padding: "10px 12px",
                    background: "var(--k-bg)",
                    border: "1px solid var(--k-border)",
                    borderRadius: 0,
                  }}
                >
                  <div className="flex items-center gap-4 flex-wrap">
                    <span
                      style={{
                        fontFamily: T.sans,
                        fontSize: "0.85rem",
                        color: "var(--k-muted)",
                      }}
                    >
                      Invested{" "}
                      <strong style={{ color: "var(--k-accent)", fontFamily: T.mono }}>
                        {gbp(invested)}
                      </strong>
                    </span>
                    {outstanding > 0 && (
                      <span
                        style={{
                          fontFamily: T.sans,
                          fontSize: "0.85rem",
                          color: "var(--k-muted)",
                        }}
                      >
                        Outstanding{" "}
                        <strong style={{ color: T.warning, fontFamily: T.mono }}>
                          {gbp(outstanding)}
                        </strong>
                      </span>
                    )}
                  </div>
                  {hasStripeInvoice && (
                    <form action={syncInvoiceStatus}>
                      {htid}
                      <SubmitButton
                        title="Re-pull payment status from Stripe (fallback if a webhook was missed)"
                        style={{
                          fontFamily: T.mono,
                          fontSize: 10,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          color: "var(--k-muted)",
                          background: "transparent",
                          border: "1px solid var(--k-border)",
                          borderRadius: 0,
                          padding: "5px 10px",
                          cursor: "pointer",
                        }}
                      >
                        Sync from Stripe
                      </SubmitButton>
                    </form>
                  )}
                </div>
              )}
              {invoiceList.length === 0 ? (
                <p
                  style={{
                    fontFamily: T.sans,
                    fontSize: "0.85rem",
                    color: "var(--k-faint)",
                  }}
                >
                  No invoices yet.
                </p>
              ) : (
                invoiceList.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex flex-wrap items-center justify-between gap-y-2"
                    style={{ padding: "8px 0", borderTop: "1px solid var(--k-border)" }}
                  >
                    <span
                      style={{
                        fontFamily: T.sans,
                        fontSize: "0.88rem",
                        color: "var(--k-fg)",
                      }}
                    >
                      {gbp(Number(inv.amount))}{" "}
                      <span
                        style={{
                          color: "var(--k-faint)",
                          fontFamily: T.mono,
                          fontSize: 11,
                        }}
                      >
                        · {(inv.type ?? "build_milestone").replace(/_/g, " ")}
                        {inv.project_item_count
                          ? ` · ${inv.project_item_count} items`
                          : ""}
                        {inv.project_id && inv.project_id !== projectId
                          ? " · other system"
                          : ""}
                      </span>
                    </span>
                    <div className="flex flex-wrap items-center gap-3 gap-y-2">
                      {inv.status === "paid" && inv.paid_at && (
                        <span
                          style={{ fontFamily: T.mono, fontSize: 10, color: T.success }}
                        >
                          paid {new Date(inv.paid_at).toLocaleDateString("en-GB")}
                        </span>
                      )}
                      <Badge s={inv.status} />
                      {inv.hosted_invoice_url && (
                        <a
                          href={inv.hosted_invoice_url}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            fontFamily: T.mono,
                            fontSize: 10,
                            color: "var(--k-accent)",
                            textDecoration: "none",
                          }}
                        >
                          payment link ↗
                        </a>
                      )}
                      {isXeroConfigured() &&
                        (inv.xero_invoice_id ? (
                          <span
                            title="Synced to Xero"
                            style={{
                              fontFamily: T.mono,
                              fontSize: 10,
                              letterSpacing: "0.04em",
                              textTransform: "uppercase",
                              color: "var(--k-faint)",
                            }}
                          >
                            xero ✓
                          </span>
                        ) : (
                          <form action={pushInvoiceToXero}>
                            {htid}
                            <input type="hidden" name="invoice_id" value={inv.id} />
                            <SubmitButton
                              pendingLabel="Pushing…"
                              title="Create this invoice in Xero (records the payment too if already paid)"
                              style={{
                                fontFamily: T.mono,
                                fontSize: 10,
                                letterSpacing: "0.04em",
                                textTransform: "uppercase",
                                color: "var(--k-muted)",
                                background: "transparent",
                                border: "1px solid var(--k-border)",
                                borderRadius: 0,
                                padding: "5px 9px",
                                cursor: "pointer",
                              }}
                            >
                              → Xero
                            </SubmitButton>
                          </form>
                        ))}
                      {inv.status !== "paid" &&
                        (inv.hosted_invoice_url ?? "").includes("/test") && (
                          <span
                            style={{
                              fontFamily: T.mono,
                              fontSize: 10,
                              letterSpacing: "0.04em",
                              textTransform: "uppercase",
                              color: T.warning,
                            }}
                            title="This Pay-now link is a Stripe TEST link — regenerate it as live."
                          >
                            ⚠ test link
                          </span>
                        )}
                      {inv.status !== "paid" && (
                        <form action={regenerateInvoiceLive}>
                          {htid}
                          {hpid}
                          <input type="hidden" name="invoice_id" value={inv.id} />
                          <SubmitButton
                            pendingLabel="Regenerating…"
                            style={{
                              fontFamily: T.mono,
                              fontSize: 10,
                              letterSpacing: "0.04em",
                              textTransform: "uppercase",
                              color: "var(--k-fg)",
                              background: "transparent",
                              border: "1px solid var(--k-border)",
                              borderRadius: 0,
                              padding: "5px 9px",
                              cursor: "pointer",
                            }}
                            title="Void this invoice and create a fresh LIVE one (new Pay-now link), then re-email the client"
                          >
                            Regenerate live
                          </SubmitButton>
                        </form>
                      )}
                      {inv.status !== "paid" && inv.status !== "void" && (
                        <form action={markInvoicePaid}>
                          {htid}
                          <input type="hidden" name="invoice_id" value={inv.id} />
                          <SubmitButton
                            pendingLabel="Marking…"
                            style={{
                              fontFamily: T.mono,
                              fontSize: 10,
                              letterSpacing: "0.04em",
                              textTransform: "uppercase",
                              color: "var(--k-accent)",
                              background: "transparent",
                              border: "1px solid var(--k-accent)",
                              borderRadius: 0,
                              padding: "5px 9px",
                              cursor: "pointer",
                            }}
                            title="Bank transfer received — mark this invoice paid (also marks the Stripe invoice paid out-of-band so its card link closes)"
                          >
                            Mark paid — transfer
                          </SubmitButton>
                        </form>
                      )}
                    </div>
                  </div>
                ))
              )}
            </section>
          </Reveal>

          {/* Build modules — the invoice lines. Editing the scope itself
              (add / remove modules) is the proposal drafter's job on the
              Docs and Legal tile; here they are read as what gets billed. */}
          <Reveal>
            <section style={card}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 style={h2}>Build modules &amp; invoice lines</h2>
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
                  No modules yet — the proposal drafter on the Docs and Legal tile adds
                  them.
                </p>
              )}
              <div className="flex flex-col gap-1.5">
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
                      <Badge s={it.status} />
                      <span
                        style={{
                          fontFamily: T.mono,
                          fontSize: "0.85rem",
                          color: "var(--k-muted)",
                        }}
                      >
                        {gbp(Number(it.amount))}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div
                className="flex items-center justify-between flex-wrap gap-2"
                style={{
                  marginTop: 12,
                  paddingTop: 12,
                  borderTop: "1px solid var(--k-border)",
                  fontFamily: T.mono,
                  fontSize: 11,
                  color: "var(--k-muted)",
                }}
              >
                <span>
                  Balance: paid {gbp(balance.paidTotal)} · unbilled{" "}
                  {gbp(balance.unbilledTotal)}
                  {depositPaid > 0 ? ` · deposit / quotes paid ${gbp(depositPaid)}` : ""}
                </span>
                <Link href={`/admin/clients/${tenantId}/docs`} style={monoLink}>
                  Edit the proposal scope →
                </Link>
              </div>
            </section>
          </Reveal>
        </>
      )}

      {/* Raise an invoice by hand — a build milestone or a one-off, due in
          14 days (the money cockpit's form with the client fixed). */}
      <Reveal>
        <section style={card}>
          <h2 style={h2}>Raise an invoice</h2>
          <p
            style={{
              fontFamily: T.sans,
              fontSize: "0.8rem",
              color: "var(--k-faint)",
              margin: "6px 0 12px",
            }}
          >
            A plain invoice row, due in 14 days — a milestone payment or a one-off. It
            appears in the list above; push it to Xero or mark it paid from there.
          </p>
          <form action={issueInvoice} className="flex items-center gap-2 flex-wrap">
            {htid}
            {hpid}
            <select
              name="type"
              defaultValue="build_milestone"
              style={{ ...inp, width: 160 }}
            >
              <option value="build_milestone">Build milestone</option>
              <option value="one_off">One-off</option>
            </select>
            <input
              name="amount"
              type="number"
              min="1"
              step="1"
              placeholder="£ amount"
              required
              style={{ ...inp, width: 120 }}
            />
            <SubmitButton style={btn("var(--k-surface)", "var(--k-fg)")}>
              Issue invoice
            </SubmitButton>
          </form>
        </section>
      </Reveal>

      {/* Contracted schedule — the live Order Form's billing terms, read-only
          (they are part of the signed document, edited on Docs and Legal). */}
      <Reveal>
        <Panel
          label="// CONTRACTED SCHEDULE"
          title="Contracted schedule"
          style={{ marginBottom: 16 }}
          actions={
            <Link href={`/admin/clients/${tenantId}/agreement`} style={monoLink}>
              {liveOrderForm
                ? `Edit on Order Form ${liveOrderForm.reference} →`
                : "Draft an Order Form →"}
            </Link>
          }
        >
          {!liveOrderForm ? (
            <p
              style={{
                fontFamily: T.sans,
                fontSize: "0.85rem",
                color: "var(--k-faint)",
                margin: 0,
              }}
            >
              No Order Form yet — the monthly fee, project fee and invoice schedule are
              contracted there.
            </p>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge s={liveOrderForm.status} />
                <span
                  style={{ fontFamily: T.mono, fontSize: 11, color: "var(--k-faint)" }}
                >
                  {liveOrderForm.accepted_at
                    ? `signed ${new Date(liveOrderForm.accepted_at).toLocaleDateString("en-GB")}`
                    : liveOrderForm.sent_at
                      ? `sent ${new Date(liveOrderForm.sent_at).toLocaleDateString("en-GB")} — not yet signed`
                      : "draft — not yet sent"}
                  {" · pricing "}
                  {liveOrderForm.pricing_version}
                </span>
              </div>
              <dl
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "10px 18px",
                  marginTop: 12,
                }}
              >
                {[
                  ["Monthly fee", `${gbp(Number(liveOrderForm.monthly_fee))}/mo`],
                  [
                    "Project fee",
                    liveOrderForm.project_fee != null
                      ? gbp(Number(liveOrderForm.project_fee))
                      : "—",
                  ],
                  [
                    "Mobilisation fee",
                    liveOrderForm.mobilisation_fee != null
                      ? gbp(Number(liveOrderForm.mobilisation_fee))
                      : "—",
                  ],
                  ["Billing date", liveOrderForm.billing_date_rule],
                  [
                    "VAT",
                    VAT_LABEL[liveOrderForm.vat_treatment] ?? liveOrderForm.vat_treatment,
                  ],
                  ["Billing email", liveOrderForm.client_billing_email],
                ].map(([label, value]) => (
                  <div key={label} className="flex flex-col gap-0.5">
                    <dt
                      style={{
                        fontFamily: T.mono,
                        fontSize: 9,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: "var(--k-faint)",
                      }}
                    >
                      {label}
                    </dt>
                    <dd
                      style={{
                        fontFamily: T.sans,
                        fontSize: "0.88rem",
                        color: "var(--k-fg)",
                        margin: 0,
                        overflowWrap: "anywhere",
                      }}
                    >
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
              {scheduleLines.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div
                    style={{
                      fontFamily: T.mono,
                      fontSize: 9,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "var(--k-faint)",
                      marginBottom: 4,
                    }}
                  >
                    Invoice schedule
                  </div>
                  {scheduleLines.map((line, i) => (
                    <div
                      key={i}
                      style={{
                        fontFamily: T.sans,
                        fontSize: "0.86rem",
                        color: "var(--k-muted)",
                        padding: "3px 0",
                      }}
                    >
                      {line}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </Panel>
      </Reveal>

      {/* Subscriptions — read-only. The plan is the client's choice (portal);
          starting, re-sending or cancelling it lives on the Care Plan tile. */}
      <Reveal>
        <section style={card}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 style={{ ...h2, marginBottom: 0 }}>Subscriptions &amp; retainer</h2>
            <div className="flex items-center gap-3">
              {mrr > 0 && (
                <span
                  style={{ fontFamily: T.mono, fontSize: 12, color: "var(--k-accent)" }}
                >
                  {gbp(mrr)}/mo MRR
                </span>
              )}
              <Link href={`/admin/clients/${tenantId}/care-plan`} style={monoLink}>
                Care Plan tile →
              </Link>
            </div>
          </div>
          <p
            style={{
              fontFamily: T.sans,
              fontSize: "0.8rem",
              color: "var(--k-faint)",
              margin: "6px 0 12px",
            }}
          >
            The client picks their plan in the portal — staff never choose one for them.
            Direct Debit links, Enterprise set-up and cancellations are on the Care Plan
            tile.
          </p>
          {subList.length === 0 ? (
            <p
              style={{ fontFamily: T.sans, fontSize: "0.85rem", color: "var(--k-faint)" }}
            >
              No subscription rows yet
              {t.care_plan_choice
                ? ` — client chose ${
                    t.care_plan_choice === "none"
                      ? "no care plan"
                      : (carePlan(t.care_plan_choice)?.label ?? t.care_plan_choice)
                  }.`
                : "."}
            </p>
          ) : (
            subList.map((s) => (
              <div
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2"
                style={{ padding: "8px 0", borderTop: "1px solid var(--k-border)" }}
              >
                <span
                  style={{ fontFamily: T.sans, fontSize: "0.9rem", color: "var(--k-fg)" }}
                >
                  {carePlan(s.plan)?.label ?? s.plan}{" "}
                  <span
                    style={{ color: "var(--k-muted)", fontFamily: T.mono, fontSize: 11 }}
                  >
                    {gbp(Number(s.mrr))}/mo
                    {s.provider ? ` · ${s.provider}` : ""}
                  </span>
                </span>
                <Badge s={s.status} />
              </div>
            ))
          )}
        </section>
      </Reveal>
    </TilePage>
  );
}
