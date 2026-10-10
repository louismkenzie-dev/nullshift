import { createServiceClient } from "@nullshift/db";
import { logAuditAsService } from "@nullshift/db/audit";
import { cancelBillingRequest } from "@nullshift/billing/gocardless";
import { invoiceRef } from "@nullshift/ui/format";
import { carePlan } from "@/lib/carePlans";
import { carePlanInvoiceEmail, carePlanInvoiceReminderEmail } from "@/lib/clientEmails";
import { sendEmail } from "@/lib/sendEmail";
import { portalReplyTo } from "@/lib/portalAccess";
import { siteUrl } from "@/lib/portalLinks";
import { reconcileXeroInvoices, syncInvoiceToXero } from "@/lib/xeroSync";
import {
  INVOICE_TERMS_DEFAULT_DAYS,
  MAX_INVOICE_REMINDERS,
  carePlanPeriodLine,
  decideInvoiceChase,
  invoiceDueAt,
  isoDate,
  monthlyPeriodsDue,
  parseIsoDate,
  periodLabel,
  subscriptionStatusFromInvoices,
  type Period,
} from "./invoicedPlans";

/**
 * Invoiced care plans — the run (migration 0072). One pass over every plan
 * billed by monthly invoice (or one tenant's), doing in order:
 *
 *   1. RAISE   each period whose start has arrived and has no invoice: an
 *              `invoices` row (type care_plan, open, due after the terms) with
 *              its line item, pushed to Xero as an authorised sales invoice
 *              whose online link becomes the client's hosted_invoice_url, and
 *              emailed to the client. The unique index on (subscription,
 *              period) makes this idempotent: cron, page load and a button can
 *              all run it and October is raised once.
 *   2. RECONCILE  open invoices with a Xero id are flipped to paid when Xero
 *              says PAID (the bookkeeper reconciled the transfer there, or the
 *              client paid online) — the existing reconcileXeroInvoices.
 *   3. CHASE   overdue invoices get up to three reminders (3, 10, 17 days
 *              after due), counted from the audit trail; after that it is
 *              recorded once as escalated and left to staff.
 *   4. STATUS  the plan goes past_due when an invoice is 14 days overdue and
 *              back to active when nothing is, so Today, the client's
 *              attention queue and the Finance exceptions all light up through
 *              the rules they already have.
 *
 * Designed to run without the cron: the care-plan page runs it for its
 * tenant on load, bounded, because Vercel's scheduler has not been firing on
 * this project. Every write is idempotent or audited.
 */

type Service = ReturnType<typeof createServiceClient>;

export type TickResult = {
  subscriptions: number;
  raised: number;
  reconciled: number;
  reminded: number;
  escalated: number;
  statusChanges: number;
  errors: string[];
};

type SubRow = {
  id: string;
  tenant_id: string;
  plan: string;
  mrr: number | string;
  status: string;
  invoicing: string;
  invoiced_from: string | null;
  invoice_terms_days: number | null;
};

type InvRow = {
  id: string;
  status: string;
  amount: number | string;
  due_at: string | null;
  period_start: string | null;
  hosted_invoice_url: string | null;
  xero_invoice_id: string | null;
};

type TenantRow = { name: string; contact_name: string | null; contact_email: string | null };

const portalPaymentsUrl = () => `${siteUrl()}/portal/login?next=${encodeURIComponent("/portal/payments")}`;

const dateGB = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" }).format(new Date(iso));

export async function tickInvoicedPlans(
  service: Service,
  opts: { tenantId?: string; now?: Date } = {}
): Promise<TickResult> {
  const now = opts.now ?? new Date();
  const result: TickResult = { subscriptions: 0, raised: 0, reconciled: 0, reminded: 0, escalated: 0, statusChanges: 0, errors: [] };

  let q = service
    .from("subscriptions")
    .select("id, tenant_id, plan, mrr, status, invoicing, invoiced_from, invoice_terms_days")
    .eq("invoicing", "monthly")
    .in("status", ["active", "past_due"]);
  if (opts.tenantId) q = q.eq("tenant_id", opts.tenantId);
  const { data: subs, error } = await q;
  if (error) {
    result.errors.push(`subscriptions: ${error.message}`);
    return result;
  }
  const rows = (subs ?? []) as SubRow[];
  result.subscriptions = rows.length;

  for (const sub of rows) {
    try {
      await tickOne(service, sub, now, result);
    } catch (e) {
      result.errors.push(`${sub.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return result;
}

async function tickOne(service: Service, sub: SubRow, now: Date, result: TickResult): Promise<void> {
  if (!sub.invoiced_from || !parseIsoDate(sub.invoiced_from)) return;
  const terms = sub.invoice_terms_days ?? INVOICE_TERMS_DEFAULT_DAYS;
  const plan = carePlan(sub.plan);
  const planLabel = plan?.label ?? sub.plan;
  const amount = Number(sub.mrr);

  const { data: tenantRow } = await service
    .from("tenants")
    .select("name, contact_name, contact_email")
    .eq("id", sub.tenant_id)
    .maybeSingle();
  const tenant = (tenantRow ?? { name: "", contact_name: null, contact_email: null }) as TenantRow;

  // 1. Raise ----------------------------------------------------------------
  const existing = await loadPlanInvoices(service, sub.id);
  const due = monthlyPeriodsDue({
    invoicedFrom: sub.invoiced_from,
    today: isoDate(now),
    existing: existing.map((i) => i.period_start).filter((p): p is string => !!p),
  });
  for (const period of due) {
    const raised = await raiseInvoice(service, { sub, tenant, planLabel, amount, terms, period, now });
    if (raised) result.raised += 1;
  }

  // 2. Reconcile ------------------------------------------------------------
  const rec = await reconcileXeroInvoices(service, { tenantId: sub.tenant_id, limit: 12 });
  result.reconciled += rec.paid;

  // 3. Chase ----------------------------------------------------------------
  const open = (await loadPlanInvoices(service, sub.id)).filter((i) => i.status === "open");
  for (const inv of open) {
    const { count } = await service
      .from("audit_log")
      .select("id", { count: "exact", head: true })
      .eq("action", "care_plan.invoice_reminder_sent")
      .eq("target", `invoice:${inv.id}`);
    const decision = decideInvoiceChase({ dueAt: inv.due_at, now, remindersSent: count ?? 0 });
    if (decision.action === "wait") continue;

    if (decision.action === "escalate") {
      // Said once, when the client reminders run out.
      if ((count ?? 0) === MAX_INVOICE_REMINDERS) {
        const { count: already } = await service
          .from("audit_log")
          .select("id", { count: "exact", head: true })
          .eq("action", "care_plan.invoice_reminder_escalated")
          .eq("target", `invoice:${inv.id}`);
        if ((already ?? 0) === 0) {
          await logAuditAsService({
            action: "care_plan.invoice_reminder_escalated",
            target: `invoice:${inv.id}`,
            tenantId: sub.tenant_id,
            metadata: { plan: sub.plan, amount: Number(inv.amount), daysOverdue: decision.daysOverdue, period_start: inv.period_start },
          });
          result.escalated += 1;
        }
      }
      continue;
    }

    if (!tenant.contact_email) continue;
    const mail = carePlanInvoiceReminderEmail({
      name: tenant.contact_name ?? tenant.name,
      planLabel,
      periodLabel: inv.period_start ? periodLabel(inv.period_start) : "this period",
      amount: Number(inv.amount),
      dueOn: inv.due_at ? dateGB(inv.due_at) : "the due date",
      daysOverdue: decision.daysOverdue,
      reference: invoiceRef(sub.tenant_id, inv.id),
      url: inv.hosted_invoice_url ?? portalPaymentsUrl(),
      tone: decision.tone,
    });
    const sent = await sendEmail({
      purpose: "transactional",
      to: tenant.contact_email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      replyTo: portalReplyTo(),
    });
    await logAuditAsService({
      action: sent ? "care_plan.invoice_reminder_sent" : "care_plan.invoice_reminder_failed",
      target: `invoice:${inv.id}`,
      tenantId: sub.tenant_id,
      metadata: { plan: sub.plan, amount: Number(inv.amount), nth: decision.nth, tone: decision.tone, daysOverdue: decision.daysOverdue, email: tenant.contact_email, period_start: inv.period_start },
    });
    if (sent) result.reminded += 1;
  }

  // 4. Status ---------------------------------------------------------------
  const next = subscriptionStatusFromInvoices({ status: sub.status, openDueAts: open.map((i) => i.due_at), now });
  if (next) {
    const { data: flipped } = await service
      .from("subscriptions")
      .update({ status: next })
      .eq("id", sub.id)
      .eq("status", sub.status)
      .select("id");
    if (flipped?.length) {
      result.statusChanges += 1;
      await logAuditAsService({
        action: next === "past_due" ? "care_plan.invoice_past_due" : "care_plan.invoice_recovered",
        target: `subscription:${sub.id}`,
        tenantId: sub.tenant_id,
        metadata: { plan: sub.plan, mrr: amount, openInvoices: open.length },
      });
    }
  }
}

async function loadPlanInvoices(service: Service, subscriptionId: string): Promise<InvRow[]> {
  const { data } = await service
    .from("invoices")
    .select("id, status, amount, due_at, period_start, hosted_invoice_url, xero_invoice_id")
    .eq("subscription_id", subscriptionId)
    .neq("status", "void")
    .order("period_start", { ascending: false });
  return (data ?? []) as InvRow[];
}

async function raiseInvoice(
  service: Service,
  input: { sub: SubRow; tenant: TenantRow; planLabel: string; amount: number; terms: number; period: Period; now: Date }
): Promise<boolean> {
  const { sub, tenant, planLabel, amount, terms, period } = input;
  if (!(amount > 0)) return false;
  const dueAt = invoiceDueAt(period.start, terms);

  const { data: inserted, error } = await service
    .from("invoices")
    .insert({
      tenant_id: sub.tenant_id,
      project_id: null,
      type: "care_plan",
      amount,
      status: "open",
      due_at: dueAt,
      project_item_count: 1,
      subscription_id: sub.id,
      period_start: period.start,
      period_end: period.end,
    })
    .select("id")
    .single();
  if (error || !inserted) {
    // 23505: another run raised this period first. Not an error.
    if (error?.code !== "23505") throw new Error(`raise ${period.start}: ${error?.message ?? "insert failed"}`);
    return false;
  }
  const invoiceId = inserted.id as string;

  await service.from("invoice_items").insert({
    invoice_id: invoiceId,
    tenant_id: sub.tenant_id,
    name: carePlanPeriodLine(planLabel, period),
    amount,
    quantity: 1,
  });

  const xero = await syncInvoiceToXero(service, invoiceId);
  const { data: fresh } = await service
    .from("invoices")
    .select("hosted_invoice_url")
    .eq("id", invoiceId)
    .maybeSingle();
  const url = (fresh?.hosted_invoice_url as string | null) ?? null;

  let emailed = false;
  if (tenant.contact_email) {
    const mail = carePlanInvoiceEmail({
      name: tenant.contact_name ?? tenant.name,
      planLabel,
      periodLabel: period.label,
      amount,
      dueOn: dateGB(dueAt),
      reference: invoiceRef(sub.tenant_id, invoiceId),
      url: url ?? portalPaymentsUrl(),
    });
    emailed = await sendEmail({
      purpose: "transactional",
      to: tenant.contact_email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      replyTo: portalReplyTo(),
    });
  }

  await logAuditAsService({
    action: "care_plan.invoice_raised",
    target: `invoice:${invoiceId}`,
    tenantId: sub.tenant_id,
    metadata: {
      subscription: sub.id,
      plan: sub.plan,
      amount,
      period_start: period.start,
      period_end: period.end,
      due_at: dueAt,
      xero: xero.ok ? (xero.xeroInvoiceId ?? true) : false,
      emailed,
      email: tenant.contact_email,
    },
  });
  return true;
}

/* ── Switching a plan to monthly invoicing ──────────────────────────────── */

export type EnableInvoicingInput = {
  tenantId: string;
  planId: string;
  mrr: number;
  invoicedFrom: string;
  termsDays: number;
  note: string | null;
  actorEmail: string;
};

export type EnableInvoicingResult =
  | { ok: true; subscriptionId: string; tick: TickResult }
  | { ok: false; error: string };

/**
 * Put a tenant's care plan on the monthly-invoice route. Reuses the pending
 * (incomplete) row the Direct Debit attempt left behind, so the history stays
 * on one subscription; otherwise reuses an existing manual row, or inserts.
 * Refuses while a provider-collected plan is live, because two rails on one
 * plan is how a client gets charged twice. Then runs the tick for the tenant,
 * so a start date already reached raises its invoice straight away.
 */
export async function enableMonthlyInvoicing(
  service: Service,
  input: EnableInvoicingInput
): Promise<EnableInvoicingResult> {
  const plan = carePlan(input.planId);
  if (!plan) return { ok: false, error: "Unknown plan." };
  if (!(input.mrr > 0)) return { ok: false, error: "The monthly amount must be more than zero." };
  if (!parseIsoDate(input.invoicedFrom)) return { ok: false, error: "The first period needs a date." };
  const terms = Math.max(0, Math.min(90, Math.round(input.termsDays)));

  const { data: subs } = await service
    .from("subscriptions")
    .select("id, status, provider, gc_billing_request_id, gc_subscription_id, stripe_subscription_id")
    .eq("tenant_id", input.tenantId)
    .neq("status", "canceled")
    .order("created_at", { ascending: false });
  const rows = (subs ?? []) as {
    id: string;
    status: string;
    provider: string;
    gc_billing_request_id: string | null;
    gc_subscription_id: string | null;
    stripe_subscription_id: string | null;
  }[];

  const live = rows.find(
    (r) => ["active", "trialing", "past_due"].includes(r.status) && (r.gc_subscription_id || r.stripe_subscription_id)
  );
  if (live)
    return {
      ok: false,
      error: "A provider-collected plan is live on this client. Cancel it first so they are not billed twice.",
    };

  const reuse = rows.find((r) => r.status === "incomplete") ?? rows.find((r) => r.provider === "manual") ?? null;
  const fields = {
    plan: plan.id,
    mrr: input.mrr,
    status: "active",
    provider: "manual",
    started_at: `${input.invoicedFrom}T00:00:00.000Z`,
    invoicing: "monthly",
    invoiced_from: input.invoicedFrom,
    invoice_terms_days: terms,
    invoice_note: input.note,
    gc_billing_request_id: null,
    gc_mandate_id: null,
    gc_subscription_id: null,
    stripe_subscription_id: null,
  };

  let subscriptionId: string;
  if (reuse) {
    if (reuse.gc_billing_request_id) {
      // The pending Direct Debit link is dead now; tell GoCardless, best-effort.
      try {
        await cancelBillingRequest(reuse.gc_billing_request_id);
      } catch (e) {
        console.warn("enableMonthlyInvoicing: billing request cancel failed", e);
      }
    }
    const { error } = await service.from("subscriptions").update(fields).eq("id", reuse.id);
    if (error) return { ok: false, error: error.message };
    subscriptionId = reuse.id;
  } else {
    const { data, error } = await service
      .from("subscriptions")
      .insert({ tenant_id: input.tenantId, ...fields })
      .select("id")
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "insert failed" };
    subscriptionId = data.id as string;
  }

  await logAuditAsService({
    action: "care_plan.invoicing_enabled",
    target: `subscription:${subscriptionId}`,
    tenantId: input.tenantId,
    metadata: {
      plan: plan.id,
      mrr: input.mrr,
      invoiced_from: input.invoicedFrom,
      terms_days: terms,
      note: input.note,
      actor_email: input.actorEmail,
      reused_pending: !!reuse,
    },
  });

  const tick = await tickInvoicedPlans(service, { tenantId: input.tenantId });
  return { ok: true, subscriptionId, tick };
}
