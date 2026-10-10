import { createServiceClient } from "@nullshift/db";
import { logAuditAsService } from "@nullshift/db/audit";
import {
  getMandate,
  getSubscription,
  gocardlessDashboardUrl,
  isGoCardlessConfigured,
  listMandatePayments,
} from "@nullshift/billing/gocardless";
import { sendEmail } from "@/lib/sendEmail";
import { siteUrl } from "@/lib/portalLinks";
import { openExceptionAsService, resolveExceptionsAsService } from "./exceptionsService";
import {
  classifyCollection,
  directDebitAlertEmail,
  directDebitFindings,
  gbpPence,
  type Collection,
  type Finding,
  type LiveDirectDebit,
  type PlanSubscription,
  type Verdict,
} from "./directDebit";

/**
 * Direct Debit guard rails — the run. Two entry points:
 *
 *   recordUnexpectedCollection  called by the webhook the moment a payment on
 *                               a client's mandate is not the plan (created,
 *                               or confirmed). Audit + urgent exception (one
 *                               per payment id) + one staff email.
 *   auditDirectDebits           read what GoCardless holds for every live
 *                               Direct Debit (or one client's) and compare it
 *                               with the plan: subscription amount, mandate
 *                               state, every recent payment. Opens the same
 *                               exceptions; resolves an amount-drift
 *                               exception once the amounts agree again. Runs
 *                               when the care-plan page opens, when Finance
 *                               opens (at most every 6 hours) and from the
 *                               daily cron — so a scheduler that never fires
 *                               still cannot hide a wrong amount.
 *
 * Nothing here moves money. Cancelling an off-plan payment is a separate,
 * staff-pressed action (care-plan page).
 */

type Service = ReturnType<typeof createServiceClient>;

export const DD_SWEEP_STALE_MS = 6 * 60 * 60 * 1000;

type SubRow = {
  id: string;
  tenant_id: string;
  plan: string | null;
  mrr: number | string | null;
  status: string;
  provider: string | null;
  gc_subscription_id: string | null;
  gc_mandate_id: string | null;
  tenants: { name: string | null; contact_email: string | null } | { name: string | null; contact_email: string | null }[] | null;
};

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

export function planSubscriptionFromRow(r: {
  id: string;
  tenant_id: string;
  plan: string | null;
  mrr: number | string | null;
  status: string;
  gc_subscription_id: string | null;
  gc_mandate_id: string | null;
}): PlanSubscription {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    plan: r.plan,
    mrr: Number(r.mrr ?? 0),
    status: r.status,
    gcSubscriptionId: r.gc_subscription_id,
    gcMandateId: r.gc_mandate_id,
  };
}

const staffAlertTo = () => process.env.ENQUIRY_NOTIFY_EMAIL || "louis@nullshift.co.uk";
const carePlanUrl = (tenantId: string) => `${siteUrl()}/admin/clients/${tenantId}/care-plan`;

/** What GoCardless holds for one plan: subscription, mandate, recent payments. */
export async function inspectDirectDebit(sub: PlanSubscription): Promise<LiveDirectDebit | null> {
  if (!isGoCardlessConfigured()) return null;
  if (!sub.gcSubscriptionId && !sub.gcMandateId) return null;
  const [subscription, mandate, payments] = await Promise.all([
    sub.gcSubscriptionId ? getSubscription(sub.gcSubscriptionId).catch(() => null) : Promise.resolve(null),
    sub.gcMandateId ? getMandate(sub.gcMandateId).catch(() => null) : Promise.resolve(null),
    sub.gcMandateId ? listMandatePayments(sub.gcMandateId, 12).catch(() => null) : Promise.resolve(null),
  ]);
  return {
    subscription: subscription
      ? { id: subscription.id, status: subscription.status, amountPence: subscription.amountPence, upcomingPayments: subscription.upcomingPayments }
      : null,
    mandate: mandate ? { id: mandate.id, status: mandate.status, nextPossibleChargeDate: mandate.nextPossibleChargeDate } : null,
    payments: (payments ?? []) as Collection[],
  };
}

async function alertStaff(opts: { tenantId: string; tenantName: string; findings: Finding[]; dashboardRef: string | null }): Promise<boolean> {
  const mail = directDebitAlertEmail({
    tenantName: opts.tenantName,
    findings: opts.findings,
    carePlanUrl: carePlanUrl(opts.tenantId),
    dashboardUrl: opts.dashboardRef ? gocardlessDashboardUrl(opts.dashboardRef) : null,
  });
  try {
    return await sendEmail({ purpose: "transactional", to: staffAlertTo(), subject: mail.subject, html: mail.html, text: mail.text });
  } catch (e) {
    console.error("direct debit alert email failed:", e);
    return false;
  }
}

/**
 * A payment on the client's mandate that is not the plan. Idempotent on the
 * payment id: the webhook's `created` and `confirmed` events and the sweep
 * all land on the same open exception; only the first opener emails.
 */
export async function recordUnexpectedCollection(
  service: Service,
  opts: {
    sub: PlanSubscription;
    tenantName: string;
    payment: Collection;
    verdict: Extract<Verdict, { kind: "off_plan" }>;
    source: string;
  }
): Promise<{ exceptionId: string | null; created: boolean; emailed: boolean }> {
  const { sub, payment, verdict } = opts;
  const findings = directDebitFindings({
    sub,
    live: { subscription: null, mandate: null, payments: [payment] },
    now: new Date(),
    lookbackDays: 3650,
  });
  const finding = findings[0] ?? null;
  await logAuditAsService({
    action: "care_plan.unexpected_collection",
    target: `tenant:${sub.tenantId}`,
    tenantId: sub.tenantId,
    metadata: {
      paymentId: payment.id,
      status: payment.status,
      amountPence: payment.amountPence,
      expectedPence: verdict.expectedPence,
      reason: verdict.reason,
      chargeDate: payment.chargeDate,
      description: payment.description ?? null,
      gcSubscriptionId: payment.subscriptionId,
      mandateId: payment.mandateId,
      source: opts.source,
    },
  });
  const opened = await openExceptionAsService(service, {
    tenantId: sub.tenantId,
    kind: "unexpected_collection",
    severity: "urgent",
    title: finding?.title ?? `Unexpected Direct Debit collection of ${gbpPence(payment.amountPence)}`,
    detail:
      (finding?.detail ?? `Payment ${payment.id} is not the plan (plan ${gbpPence(verdict.expectedPence)}).`) +
      ` Found via ${opts.source}.`,
    subscriptionId: sub.id,
    externalRef: payment.id,
  });
  if (!opened.ok) {
    console.error("unexpected_collection exception failed:", opened.error);
    return { exceptionId: null, created: false, emailed: false };
  }
  let emailed = false;
  if (opened.created && finding) {
    emailed = await alertStaff({ tenantId: sub.tenantId, tenantName: opts.tenantName, findings: [finding], dashboardRef: payment.id });
    await logAuditAsService({
      action: "care_plan.unexpected_collection_alerted",
      target: `finance_exception:${opened.id}`,
      tenantId: sub.tenantId,
      metadata: { paymentId: payment.id, emailed, to: staffAlertTo() },
    });
  }
  return { exceptionId: opened.id, created: opened.created, emailed };
}

/** The live subscription collects an amount other than the contracted MRR. */
export async function recordDirectDebitDrift(
  service: Service,
  opts: { sub: PlanSubscription; tenantName: string; finding: Finding; source: string }
): Promise<{ exceptionId: string | null; created: boolean; emailed: boolean }> {
  const { sub, finding } = opts;
  await logAuditAsService({
    action: "care_plan.dd_amount_drift",
    target: `tenant:${sub.tenantId}`,
    tenantId: sub.tenantId,
    metadata: {
      gcSubscriptionId: sub.gcSubscriptionId,
      amountPence: finding.amountPence ?? null,
      expectedPence: finding.expectedPence ?? null,
      source: opts.source,
    },
  });
  const opened = await openExceptionAsService(service, {
    tenantId: sub.tenantId,
    kind: "direct_debit_drift",
    severity: "urgent",
    title: finding.title,
    detail: `${finding.detail} Found via ${opts.source}.`,
    subscriptionId: sub.id,
    externalRef: sub.gcSubscriptionId,
  });
  if (!opened.ok) {
    console.error("direct_debit_drift exception failed:", opened.error);
    return { exceptionId: null, created: false, emailed: false };
  }
  let emailed = false;
  if (opened.created) {
    emailed = await alertStaff({ tenantId: sub.tenantId, tenantName: opts.tenantName, findings: [finding], dashboardRef: sub.gcSubscriptionId });
  }
  return { exceptionId: opened.id, created: opened.created, emailed };
}

export type DirectDebitCheck = {
  sub: PlanSubscription;
  tenantName: string;
  live: LiveDirectDebit | null;
  findings: Finding[];
};

export type DirectDebitAudit = {
  configured: boolean;
  checked: number;
  results: DirectDebitCheck[];
  opened: number;
  emailed: number;
  resolved: number;
  errors: string[];
};

/**
 * Compare every live Direct Debit (or one client's) with what GoCardless
 * holds. Opens/updates exceptions, alerts once per new one, resolves drift
 * that has gone away, and records a sweep stamp used to throttle page-open
 * runs. Returns the live snapshots so a page can render them without a
 * second round of API calls.
 */
export async function auditDirectDebits(
  service: Service,
  opts: { tenantId?: string; now?: Date; source?: string } = {}
): Promise<DirectDebitAudit> {
  const now = opts.now ?? new Date();
  const source = opts.source ?? (opts.tenantId ? "care-plan page" : "sweep");
  const out: DirectDebitAudit = { configured: isGoCardlessConfigured(), checked: 0, results: [], opened: 0, emailed: 0, resolved: 0, errors: [] };
  if (!out.configured) return out;

  let q = service
    .from("subscriptions")
    .select("id, tenant_id, plan, mrr, status, provider, gc_subscription_id, gc_mandate_id, tenants(name, contact_email)")
    .eq("provider", "gocardless")
    .in("status", ["active", "trialing", "past_due"])
    .not("gc_mandate_id", "is", null)
    .limit(200);
  if (opts.tenantId) q = q.eq("tenant_id", opts.tenantId);
  const { data, error } = await q;
  if (error) {
    out.errors.push(`subscriptions: ${error.message}`);
    return out;
  }

  for (const r of (data ?? []) as SubRow[]) {
    const sub = planSubscriptionFromRow(r);
    const tenantName = one(r.tenants)?.name ?? "Client";
    try {
      const live = await inspectDirectDebit(sub);
      if (!live) {
        out.results.push({ sub, tenantName, live: null, findings: [] });
        continue;
      }
      out.checked += 1;
      const findings = directDebitFindings({ sub, live, now });
      out.results.push({ sub, tenantName, live, findings });

      for (const f of findings) {
        if (f.code === "amount_drift") {
          const r2 = await recordDirectDebitDrift(service, { sub, tenantName, finding: f, source });
          if (r2.created) out.opened += 1;
          if (r2.emailed) out.emailed += 1;
        } else if (f.code.startsWith("off_plan") && f.paymentId) {
          const payment = live.payments.find((p) => p.id === f.paymentId);
          if (!payment) continue;
          const verdict = classifyCollection(payment, sub);
          if (verdict.kind !== "off_plan") continue;
          const r2 = await recordUnexpectedCollection(service, { sub, tenantName, payment, verdict, source });
          if (r2.created) out.opened += 1;
          if (r2.emailed) out.emailed += 1;
        } else if (f.code === "mandate_inactive") {
          const r2 = await openExceptionAsService(service, {
            tenantId: sub.tenantId,
            kind: "cancelled_mandate",
            severity: "normal",
            title: f.title,
            detail: `${f.detail} Found via ${source}.`,
            subscriptionId: sub.id,
            externalRef: sub.gcMandateId,
          });
          if (r2.ok && r2.created) out.opened += 1;
        }
      }

      if (!findings.some((f) => f.code === "amount_drift") && live.subscription && sub.gcSubscriptionId) {
        out.resolved += await resolveExceptionsAsService(service, {
          kind: "direct_debit_drift",
          subscriptionId: sub.id,
          evidence: {
            kind: "provider_read",
            ref: sub.gcSubscriptionId,
            note: `GoCardless subscription collects ${gbpPence(live.subscription.amountPence)}, matching the plan (${source}).`,
          },
        });
      }

      if (findings.length) {
        await logAuditAsService({
          action: "care_plan.dd_audited",
          target: `tenant:${sub.tenantId}`,
          tenantId: sub.tenantId,
          metadata: {
            source,
            findings: findings.map((f) => ({ code: f.code, paymentId: f.paymentId ?? null, amountPence: f.amountPence ?? null })),
            subscription: live.subscription ? { status: live.subscription.status, amountPence: live.subscription.amountPence } : null,
            mandate: live.mandate ? { status: live.mandate.status } : null,
          },
        });
      }
    } catch (e) {
      out.errors.push(`${tenantName}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (!opts.tenantId) {
    await logAuditAsService({
      action: "care_plan.dd_sweep",
      target: "gocardless",
      metadata: { source, checked: out.checked, findings: out.results.reduce((n, r) => n + r.findings.length, 0), opened: out.opened, errors: out.errors },
    });
  }
  return out;
}

/** When the last whole-book sweep ran (audit stamp), or null. */
export async function lastDirectDebitSweep(service: Service): Promise<Date | null> {
  const { data } = await service
    .from("audit_log")
    .select("created_at")
    .eq("action", "care_plan.dd_sweep")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const at = (data as { created_at?: string } | null)?.created_at;
  return at ? new Date(at) : null;
}

/**
 * Page-open sweep: runs the whole-book audit when the last one is older than
 * DD_SWEEP_STALE_MS, within a time budget so a slow GoCardless never holds a
 * page. Returns null when nothing ran.
 */
export async function sweepDirectDebitsIfStale(
  service: Service,
  opts: { budgetMs?: number; source?: string } = {}
): Promise<DirectDebitAudit | null> {
  if (!isGoCardlessConfigured()) return null;
  const last = await lastDirectDebitSweep(service);
  if (last && Date.now() - last.getTime() < DD_SWEEP_STALE_MS) return null;
  return Promise.race([
    auditDirectDebits(service, { source: opts.source ?? "page open" }).catch((e): DirectDebitAudit => ({
      configured: true,
      checked: 0,
      results: [],
      opened: 0,
      emailed: 0,
      resolved: 0,
      errors: [e instanceof Error ? e.message : String(e)],
    })),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), opts.budgetMs ?? 8000)),
  ]);
}
