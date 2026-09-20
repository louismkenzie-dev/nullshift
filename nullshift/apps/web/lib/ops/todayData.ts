/**
 * Real-data loader for /admin (Today). One aggregated load — the clients
 * index (hub blocks + ops signals) — folded into the metrics, the attention
 * queue, the week list and the approvals / exceptions panel. Metrics are
 * definitions over rows, never health claims (brief §5.1):
 *
 *   Contracted monthly service fees  sum(subscriptions.mrr) where status in
 *                                    (active, trialing, past_due); split by
 *                                    legacy plan id vs new-model rows
 *   Outstanding invoice balance      sum(invoices.amount) where status = open;
 *                                    overdue subset = due_at < now
 *   Scheduled collections · 30 days  mrr of active GoCardless subscriptions —
 *                                    the provider schedule is NOT read here
 *   Projects needing action          distinct tenants with an attention row
 */
import { carePlan } from "@/lib/carePlans";
import {
  fmtShort,
  fmtTime,
  gbp,
  loadClientsIndex,
  num,
  type Attention,
  type ClientsIndex,
} from "./clientsData";

export type Metrics = {
  contractedMonthlyGbp: number;
  contractedLegacyGbp: number;
  contractedNewGbp: number;
  outstandingGbp: number;
  overdueGbp: number;
  scheduledNext30Gbp: number;
  /** Incomplete subscriptions (link sent, mandate not authorised). */
  awaitingMandateGbp: number;
  projectsNeedingAction: number;
};

export type WeekKind = "finance" | "contract" | "deadline" | "collection" | "milestone";

export type WeekItem = {
  when: string;
  at: string;
  what: string;
  kind: WeekKind;
  href: string;
};

export type ExceptionItem = {
  text: string;
  tone: "approval" | "exception";
  href: string;
};

export type TodayData = {
  asOf: string;
  freshness: string;
  metrics: Metrics;
  attention: Attention[];
  week: WeekItem[];
  exceptions: ExceptionItem[];
  clientCount: number;
  truncated: boolean;
};

const LEGACY_PLAN_IDS = new Set(["hosting", "hosting_api", "build_3", "build_10"]);
const CONTRACTED = new Set(["active", "trialing", "past_due"]);
const DAY = 86_400_000;

/** The next monthly anniversary of `startIso` on or after `now`. */
function nextAnniversary(startIso: string, now: Date): Date | null {
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return null;
  const d = new Date(start);
  d.setUTCFullYear(now.getUTCFullYear(), now.getUTCMonth(), start.getUTCDate());
  if (d < now) d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
}

export function deriveToday(index: ClientsIndex): TodayData {
  const { signals, blocks, attention } = index;
  const now = signals.now;
  const nameOf = new Map(blocks.map((b) => [b.tenant.id, b.tenant.name]));

  // Metrics ----------------------------------------------------------------
  let contractedLegacy = 0;
  let contractedNew = 0;
  let scheduled = 0;
  let awaitingMandate = 0;
  for (const sub of signals.subscriptions) {
    const mrr = num(sub.mrr);
    if (CONTRACTED.has(sub.status)) {
      if (sub.plan && LEGACY_PLAN_IDS.has(sub.plan)) contractedLegacy += mrr;
      else contractedNew += mrr;
      if (sub.status === "active" && sub.provider === "gocardless") scheduled += mrr;
    } else if (sub.status === "incomplete") awaitingMandate += mrr;
  }
  let outstanding = 0;
  let overdue = 0;
  for (const inv of signals.invoices) {
    if (inv.status !== "open") continue;
    const amount = num(inv.amount);
    outstanding += amount;
    if (inv.due_at && new Date(inv.due_at) < now) overdue += amount;
  }
  const metrics: Metrics = {
    contractedMonthlyGbp: contractedLegacy + contractedNew,
    contractedLegacyGbp: contractedLegacy,
    contractedNewGbp: contractedNew,
    outstandingGbp: outstanding,
    overdueGbp: overdue,
    scheduledNext30Gbp: scheduled,
    awaitingMandateGbp: awaitingMandate,
    projectsNeedingAction: new Set(attention.map((a) => a.clientId)).size,
  };

  // This week --------------------------------------------------------------
  const horizon = new Date(now.getTime() + 7 * DAY);
  const week: WeekItem[] = [];
  const inWindow = (d: Date) => d <= horizon && d >= new Date(now.getTime() - 7 * DAY);

  for (const [tenantId, na] of signals.nextActions) {
    if (!na.due_at) continue;
    const d = new Date(na.due_at);
    if (!inWindow(d)) continue;
    week.push({
      when: fmtShort(na.due_at),
      at: d.toISOString(),
      what: `${nameOf.get(tenantId) ?? "Client"} — ${na.text}`,
      kind: "deadline",
      href: `/admin/clients/${tenantId}`,
    });
  }
  for (const inv of signals.invoices) {
    if (inv.status !== "open" || !inv.due_at) continue;
    const d = new Date(inv.due_at);
    if (!inWindow(d)) continue;
    week.push({
      when: fmtShort(inv.due_at),
      at: d.toISOString(),
      what: `${nameOf.get(inv.tenant_id) ?? "Client"} — invoice ${gbp(num(inv.amount))} due${
        d < now ? " (overdue)" : ""
      }`,
      kind: inv.type === "build_milestone" ? "milestone" : "finance",
      href: `/admin/clients/${inv.tenant_id}/billing`,
    });
  }
  for (const sub of signals.subscriptions) {
    if (sub.status !== "active" || !sub.started_at) continue;
    const d = nextAnniversary(sub.started_at, now);
    if (!d || d > horizon) continue;
    week.push({
      when: fmtShort(d.toISOString()),
      at: d.toISOString(),
      what: `${nameOf.get(sub.tenant_id) ?? "Client"} — ${
        carePlan(sub.plan)?.label ?? sub.plan ?? "plan"
      } anniversary ${gbp(num(sub.mrr))} (expected, provider not consulted)`,
      kind: "collection",
      href: `/admin/clients/${sub.tenant_id}/care-plan`,
    });
  }
  for (const of of signals.orderForms) {
    if (of.status !== "client_review" || !of.sent_at) continue;
    const d = new Date(Date.parse(of.sent_at) + 7 * DAY);
    if (!inWindow(d)) continue;
    week.push({
      when: fmtShort(d.toISOString()),
      at: d.toISOString(),
      what: `${nameOf.get(of.tenant_id) ?? "Client"} — Order Form ${of.reference} 7-day chase`,
      kind: "contract",
      href: `/admin/clients/${of.tenant_id}/agreement`,
    });
  }
  week.sort((a, b) => a.at.localeCompare(b.at));

  // Approvals and integration exceptions --------------------------------------
  const exceptions: ExceptionItem[] = [];
  for (const of of signals.orderForms) {
    if (of.status === "draft" && !of.reviewed_by)
      exceptions.push({
        text: `${nameOf.get(of.tenant_id) ?? "Client"} — Order Form ${of.reference} awaits second-person review`,
        tone: "approval",
        href: `/admin/clients/${of.tenant_id}/agreement`,
      });
  }
  for (const b of blocks) {
    if (b.pricing.enterpriseReview)
      exceptions.push({
        text: `${b.tenant.name} — enterprise pricing review required before any price is offered`,
        tone: "approval",
        href: `/admin/clients/${b.tenant.id}/pricing`,
      });
  }
  for (const inv of signals.invoices) {
    if (inv.status === "open" && !inv.xero_invoice_id)
      exceptions.push({
        text: `${nameOf.get(inv.tenant_id) ?? "Client"} — open invoice ${gbp(
          num(inv.amount)
        )} has no Xero record`,
        tone: "exception",
        href: `/admin/clients/${inv.tenant_id}/billing`,
      });
  }
  for (const sub of signals.subscriptions) {
    if (sub.status === "past_due")
      exceptions.push({
        text: `${nameOf.get(sub.tenant_id) ?? "Client"} — ${sub.provider ?? "provider"} subscription past due`,
        tone: "exception",
        href:
          sub.provider === "gocardless"
            ? "/admin/billing/direct-debits"
            : `/admin/clients/${sub.tenant_id}/care-plan`,
      });
  }

  const dateLine = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(now);

  return {
    asOf: dateLine,
    freshness: `Database read ${fmtTime(now)} · GoCardless, Stripe and Xero not consulted${
      signals.nextActionsAvailable ? "" : " · client_next_actions not available yet"
    }`,
    metrics,
    attention: attention.slice(0, 100),
    week: week.slice(0, 20),
    exceptions: exceptions.slice(0, 12),
    clientCount: blocks.length,
    truncated: index.truncated,
  };
}

export async function loadToday(): Promise<TodayData> {
  return deriveToday(await loadClientsIndex());
}
