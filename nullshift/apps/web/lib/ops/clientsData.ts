/**
 * Real-data loaders for the redesigned /admin/clients list and the client
 * workspace (/admin/clients/[id]). Service-role reads only — the admin layout
 * has already gated the request — folded from a handful of bulk queries on
 * top of lib/hub/load.ts. Never a query per client.
 *
 * The view-model shapes mirror the fixture module the prototype rendered
 * (lib/next/fixtures.ts) so the page edits stay small, but every value here
 * is derived from production rows. Where a table cannot say something (for
 * example an "independent" route election, which nothing records yet) the
 * facet says so instead of guessing.
 */
import { createServiceClient } from "@nullshift/db";
import { clientRef } from "@nullshift/ui/format";
import { carePlan } from "@/lib/carePlans";
import { loadClientBlock, loadClientBlocks } from "@/lib/hub/load";
import type { Block } from "@/lib/hub/rules";
import { OPEN_STATUSES } from "@/lib/ops/issues";

type Service = ReturnType<typeof createServiceClient>;

// ---------------------------------------------------------------------------
// View-model types (same shape the prototype pages consume)
// ---------------------------------------------------------------------------

export type Relationship = "prospect" | "active" | "paused" | "offboarded";
export type Agreement =
  | "draft"
  | "awaiting acceptance"
  | "accepted"
  | "superseded"
  | "declined"
  | "none";
export type Billing =
  | "setup pending"
  | "current"
  | "overdue"
  | "exception"
  | "not applicable";
export type Delivery =
  | "no project"
  | "discovery"
  | "onboarding"
  | "building"
  | "review"
  | "launch prep"
  | "live"
  | "accepted";
export type Route = "managed" | "independent" | "unresolved";
export type Health = "healthy" | "attention" | "incident" | "unknown";

export type Facets = {
  relationship: Relationship;
  agreement: { state: Agreement; evidence: string };
  billing: { state: Billing; evidence: string };
  delivery: { state: Delivery; evidence: string };
  route: { state: Route; evidence: string };
  health: { state: Health; evidence: string; freshness: string };
};

export type TaskState =
  | "not started"
  | "in progress"
  | "awaiting client"
  | "blocked"
  | "complete"
  | "not applicable"
  | "waived";

export type Task = {
  label: string;
  owner: "Nullshift" | "Client";
  state: TaskState;
  source: string;
  evidence?: string;
  due?: string;
};

export type MilestoneState =
  | "paid"
  | "part paid"
  | "issued"
  | "overdue"
  | "scheduled"
  | "waived"
  | "draft"
  | "void";

export type RunState =
  | "package pending"
  | "accepted, future start"
  | "active"
  | "collection failed"
  | "exception"
  | "not applicable"
  | "legacy"
  | "setup pending"
  | "cancelled";

export type NextAction = { text: string; owner: string; due: string; consequence: string };

export type Client = {
  id: string;
  legalName: string;
  tradingName?: string;
  ref: string;
  owner: string;
  model: "new" | "legacy";
  facets: Facets;
  nextAction: NextAction;
  build: {
    priceGbp: number;
    milestones: {
      label: string;
      amountGbp: number;
      paidGbp: number;
      state: MilestoneState;
      due: string;
    }[];
  };
  run: {
    state: RunState;
    packageName?: string;
    monthlyGbp?: number;
    contractualStart?: string;
    mandate?: "authorised" | "none" | "cancelled" | "pending";
    providerCollectionDate?: string;
    provider?: string;
    termsVersion?: string;
    note?: string;
  };
  handover?: { feeGbp: number; tasks: Task[] };
  systems: { name: string; arrangement: string }[];
  checklist: Task[];
  contacts: { name: string; role: string; email: string }[];
  history: { at: string; text: string }[];
  flags?: string[];
};

export type AttentionKind =
  | "incident"
  | "finance"
  | "contract"
  | "overdue"
  | "deadline"
  | "routine";

export type Attention = {
  clientId: string;
  client: string;
  problem: string;
  consequence: string;
  owner: string;
  due: string;
  /** ISO date when one is known — used for ordering and the week list. */
  dueAt: string | null;
  action: string;
  href: string;
  kind: AttentionKind;
  /** Lower sorts first (brief §5.1). */
  priority: number;
};

// ---------------------------------------------------------------------------
// Row shapes for the extra reads on top of the hub block
// ---------------------------------------------------------------------------

export type NextActionRow = {
  id: string;
  tenant_id: string;
  project_id: string | null;
  text: string;
  owner: string;
  due_at: string | null;
  state: string;
  source: string;
  created_at: string;
};

export type IssueDetailRow = {
  id: string;
  tenant_id: string;
  title: string;
  status: string;
  severity: string | null;
  billing: string | null;
  classification: string | null;
  client_visible: boolean;
  source: string | null;
  due_at: string | null;
  created_at: string;
};

export type InvoiceDetailRow = {
  id: string;
  tenant_id: string;
  project_id: string | null;
  type: string;
  amount: number | string;
  status: string;
  due_at: string | null;
  paid_at: string | null;
  xero_invoice_id: string | null;
  created_at: string;
};

export type SubscriptionDetailRow = {
  id: string;
  tenant_id: string;
  plan: string | null;
  status: string;
  provider: string | null;
  mrr: number | string | null;
  started_at: string | null;
  gc_billing_request_id: string | null;
  gc_mandate_id: string | null;
  gc_subscription_id: string | null;
  terms_version: string | null;
  terms_accepted_at: string | null;
  created_at: string;
};

export type OrderFormDetailRow = {
  id: string;
  tenant_id: string;
  reference: string;
  status: string;
  plan: string | null;
  monthly_fee: number | string | null;
  project_fee: number | string | null;
  sent_at: string | null;
  accepted_at: string | null;
  reviewed_by: string | null;
  created_at: string;
};

export type ComplianceRow = { tenant_id: string; kind: string; recorded_at: string };
export type AcceptanceRow = {
  tenant_id: string;
  order_form_id: string;
  accepted_by_name: string;
  accepted_by_title: string;
  accepted_at: string;
  msa_version: string;
  dpa_version: string | null;
};
export type AuditDetailRow = {
  tenant_id: string | null;
  action: string;
  target: string | null;
  created_at: string;
};
export type ContactRow = { role: string; email: string | null; name: string | null };

/** Everything the list and the workspace derive from, keyed by tenant. */
export type OpsSignals = {
  now: Date;
  nextActions: Map<string, NextActionRow>;
  /** True when client_next_actions answered (migration 0058 applied). */
  nextActionsAvailable: boolean;
  issues: IssueDetailRow[];
  invoices: InvoiceDetailRow[];
  subscriptions: SubscriptionDetailRow[];
  orderForms: OrderFormDetailRow[];
  /** projects.build_fee by project id (the hub block does not carry it). */
  buildFees: Map<string, number>;
};

const LEGACY_PLAN_IDS = new Set(["hosting", "hosting_api", "build_3", "build_10"]);
const LEGACY_CUTOFF = Date.parse("2026-09-01T00:00:00Z");
const CONTRACTED_STATUSES = new Set(["active", "trialing", "past_due"]);
const DAY = 86_400_000;

const ISSUE_DETAIL_COLUMNS =
  "id, tenant_id, title, status, severity, billing, classification, client_visible, source, due_at, created_at";
const INVOICE_DETAIL_COLUMNS =
  "id, tenant_id, project_id, type, amount, status, due_at, paid_at, xero_invoice_id, created_at";
const SUB_DETAIL_COLUMNS =
  "id, tenant_id, plan, status, provider, mrr, started_at, gc_billing_request_id, gc_mandate_id, gc_subscription_id, terms_version, terms_accepted_at, created_at";
const ORDER_FORM_DETAIL_COLUMNS =
  "id, tenant_id, reference, status, plan, monthly_fee, project_fee, sent_at, accepted_at, reviewed_by, created_at";
const NEXT_ACTION_COLUMNS =
  "id, tenant_id, project_id, text, owner, due_at, state, source, created_at";

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export const gbp = (n: number): string =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(n);

export const num = (v: number | string | null | undefined): number =>
  v === null || v === undefined || v === "" ? 0 : Number(v);

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/London",
});
const shortFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "Europe/London",
});
const timeFmt = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/London",
});

export const fmtDate = (iso: string | null | undefined): string =>
  iso ? dateFmt.format(new Date(iso)) : "—";
export const fmtShort = (iso: string | null | undefined): string =>
  iso ? shortFmt.format(new Date(iso)) : "—";
export const fmtTime = (d: Date): string => timeFmt.format(d);

const daysAgo = (iso: string, now: Date): number =>
  Math.floor((now.getTime() - new Date(iso).getTime()) / DAY);

/** "billing.dd_setup_sent" → "Billing dd setup sent". */
export const humaniseAction = (action: string): string => {
  const text = action.replace(/[._]+/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
};

// ---------------------------------------------------------------------------
// Bulk reads
// ---------------------------------------------------------------------------

export async function loadOpsSignals(
  service: Service,
  tenantIds: string[]
): Promise<OpsSignals> {
  const now = new Date();
  if (!tenantIds.length)
    return {
      now,
      nextActions: new Map(),
      nextActionsAvailable: true,
      issues: [],
      invoices: [],
      subscriptions: [],
      orderForms: [],
      buildFees: new Map(),
    };

  // client_next_actions (0058) may not be applied yet: read it defensively.
  const nextActionsPromise = (async () => {
    try {
      const { data, error } = await service
        .from("client_next_actions")
        .select(NEXT_ACTION_COLUMNS)
        .in("tenant_id", tenantIds)
        .eq("state", "open")
        .order("created_at", { ascending: false });
      if (error) return { rows: [] as NextActionRow[], available: false };
      return { rows: (data ?? []) as NextActionRow[], available: true };
    } catch {
      return { rows: [] as NextActionRow[], available: false };
    }
  })();

  const [nextActions, issuesRes, invoicesRes, subsRes, orderFormsRes, feesRes] =
    await Promise.all([
    nextActionsPromise,
    service
      .from("issues")
      .select(ISSUE_DETAIL_COLUMNS)
      .in("tenant_id", tenantIds)
      .in("status", OPEN_STATUSES)
      .order("created_at", { ascending: false })
      .limit(1000),
    service
      .from("invoices")
      .select(INVOICE_DETAIL_COLUMNS)
      .in("tenant_id", tenantIds)
      .in("status", ["draft", "open", "paid"])
      .order("created_at", { ascending: false })
      .limit(2000),
    service
      .from("subscriptions")
      .select(SUB_DETAIL_COLUMNS)
      .in("tenant_id", tenantIds)
      .order("created_at", { ascending: false }),
    service
      .from("order_forms")
      .select(ORDER_FORM_DETAIL_COLUMNS)
      .in("tenant_id", tenantIds)
      .order("created_at", { ascending: false }),
    service.from("projects").select("id, build_fee").in("tenant_id", tenantIds),
  ]);

  const nextMap = new Map<string, NextActionRow>();
  for (const r of nextActions.rows) if (!nextMap.has(r.tenant_id)) nextMap.set(r.tenant_id, r);

  return {
    now,
    nextActions: nextMap,
    nextActionsAvailable: nextActions.available,
    issues: (issuesRes.data ?? []) as IssueDetailRow[],
    invoices: (invoicesRes.data ?? []) as InvoiceDetailRow[],
    subscriptions: (subsRes.data ?? []) as SubscriptionDetailRow[],
    orderForms: (orderFormsRes.data ?? []) as OrderFormDetailRow[],
    buildFees: new Map(
      ((feesRes.data ?? []) as { id: string; build_fee: number | string | null }[])
        .filter((p) => p.build_fee !== null)
        .map((p) => [p.id, num(p.build_fee)])
    ),
  };
}

// ---------------------------------------------------------------------------
// Derivations
// ---------------------------------------------------------------------------

const ownerOf = (block: Block): string =>
  block.project?.owners.account?.trim() || "Unassigned";

const financeOwnerOf = (block: Block): string =>
  block.project?.owners.finance?.trim() || ownerOf(block);

/** The subscription row the business currently stands behind, if any. */
export function liveSubscription(
  rows: SubscriptionDetailRow[]
): SubscriptionDetailRow | null {
  const rank = (s: string) =>
    s === "active" || s === "trialing" ? 0 : s === "past_due" ? 1 : s === "incomplete" ? 2 : 3;
  return [...rows].sort((a, b) => rank(a.status) - rank(b.status))[0] ?? null;
}

/** The order form the business currently stands behind, if any. */
export function liveOrderForm(rows: OrderFormDetailRow[]): OrderFormDetailRow | null {
  const rank = (s: string) =>
    s === "accepted" ? 0 : s === "client_review" ? 1 : s === "draft" ? 2 : 3;
  return (
    [...rows]
      .filter((r) => r.status !== "withdrawn" && r.status !== "superseded")
      .sort((a, b) => rank(a.status) - rank(b.status))[0] ?? null
  );
}

export function isLegacy(block: Block, sub: SubscriptionDetailRow | null): boolean {
  if (sub?.plan && LEGACY_PLAN_IDS.has(sub.plan)) return true;
  if (block.tenant.carePlanChoice && LEGACY_PLAN_IDS.has(block.tenant.carePlanChoice))
    return true;
  const accepted = block.project?.acceptedAt;
  if (
    block.project?.proposalStatus === "accepted" &&
    accepted &&
    Date.parse(accepted) < LEGACY_CUTOFF
  )
    return true;
  return false;
}

const ENGAGED_STAGES = new Set(["build", "review", "launch_prep", "live", "care", "complete"]);

function relationshipOf(block: Block, orderForm: OrderFormDetailRow | null): Relationship {
  const status = block.tenant.status;
  if (status === "paused" || status === "offboarded") return status;
  if (status === "prospect") return "prospect";
  const accepted =
    block.project?.proposalStatus === "accepted" || orderForm?.status === "accepted";
  const engaged = !!block.project?.stage && ENGAGED_STAGES.has(block.project.stage);
  if (!accepted && !engaged) return "prospect";
  return "active";
}

function agreementOf(
  block: Block,
  orderForm: OrderFormDetailRow | null
): Facets["agreement"] {
  if (orderForm) {
    if (orderForm.status === "accepted")
      return {
        state: "accepted",
        evidence: `Order Form ${orderForm.reference} accepted ${fmtDate(orderForm.accepted_at)}`,
      };
    if (orderForm.status === "client_review")
      return {
        state: "awaiting acceptance",
        evidence: `Order Form ${orderForm.reference} sent ${fmtDate(orderForm.sent_at)} · not yet accepted`,
      };
    if (orderForm.status === "draft")
      return {
        state: "draft",
        evidence: orderForm.reviewed_by
          ? `Order Form ${orderForm.reference} draft · reviewed, not sent`
          : `Order Form ${orderForm.reference} draft · awaiting second-person review`,
      };
    if (orderForm.status === "rejected")
      return { state: "declined", evidence: `Order Form ${orderForm.reference} rejected` };
  }
  const ps = block.project?.proposalStatus ?? null;
  if (ps === "accepted")
    return {
      state: "accepted",
      evidence: `Proposal accepted ${fmtDate(block.project?.acceptedAt)} (legacy proposal flow)`,
    };
  if (ps === "sent")
    return {
      state: "awaiting acceptance",
      evidence: `Proposal sent ${fmtDate(block.project?.proposalSentAt)} · not yet accepted`,
    };
  if (ps === "declined") return { state: "declined", evidence: "Proposal declined" };
  if (block.project)
    return {
      state: "draft",
      evidence: block.project.proposalReviewedBy
        ? "Proposal draft · reviewed, not sent"
        : "Proposal draft · awaiting second-person review",
    };
  return { state: "none", evidence: "No proposal or Order Form on record" };
}

function billingOf(
  block: Block,
  sub: SubscriptionDetailRow | null,
  invoices: InvoiceDetailRow[],
  now: Date
): Facets["billing"] {
  const open = invoices.filter((i) => i.status === "open");
  const overdue = open.filter((i) => i.due_at && new Date(i.due_at) < now);
  if (overdue.length)
    return {
      state: "overdue",
      evidence: `${overdue.length} invoice${overdue.length === 1 ? "" : "s"} overdue · ${gbp(
        overdue.reduce((n, i) => n + num(i.amount), 0)
      )}`,
    };
  if (sub?.status === "past_due")
    return {
      state: "exception",
      evidence: `Subscription past due (${sub.provider ?? "provider unknown"}) · collection failing`,
    };
  if (sub && CONTRACTED_STATUSES.has(sub.status))
    return {
      state: "current",
      evidence: `${carePlan(sub.plan)?.label ?? sub.plan ?? "plan"} ${gbp(num(sub.mrr))}/mo via ${
        sub.provider ?? "unknown provider"
      }${open.length ? ` · ${open.length} open invoice${open.length === 1 ? "" : "s"}` : ""}`,
    };
  if (sub?.status === "incomplete")
    return {
      state: "setup pending",
      evidence:
        sub.provider === "gocardless"
          ? "Direct Debit link sent · mandate not authorised"
          : "Sign-up started · not completed",
    };
  if (open.length)
    return {
      state: "current",
      evidence: `${open.length} open invoice${open.length === 1 ? "" : "s"} · ${gbp(
        open.reduce((n, i) => n + num(i.amount), 0)
      )} not yet due`,
    };
  const choice = block.tenant.carePlanChoice;
  if (choice && choice !== "none")
    return {
      state: "setup pending",
      evidence: `Plan chosen (${carePlan(choice)?.label ?? choice}) · no subscription row yet`,
    };
  if (block.invoices.hasAny)
    return { state: "not applicable", evidence: "Nothing open · all invoices settled" };
  return { state: "not applicable", evidence: "No invoices or subscription on record" };
}

const DELIVERY_BY_STAGE: Record<string, Delivery> = {
  discovery: "discovery",
  onboarding: "onboarding",
  build: "building",
  review: "review",
  launch_prep: "launch prep",
  live: "live",
  care: "live",
  complete: "accepted",
};

function deliveryOf(block: Block): Facets["delivery"] {
  const p = block.project;
  if (!p) return { state: "no project", evidence: "No build project yet" };
  const state: Delivery = (p.stage ? DELIVERY_BY_STAGE[p.stage] : undefined) ?? "discovery";
  const bits = [`${p.name} · stage ${(p.stage ?? "unknown").replace(/_/g, " ")}`];
  if (p.liveUrl) bits.push(p.liveUrl.replace(/^https?:\/\//, ""));
  if (block.projects.length > 1) bits.push(`${block.projects.length} projects · newest shown`);
  return { state, evidence: bits.join(" · ") };
}

function routeOf(block: Block, sub: SubscriptionDetailRow | null): Facets["route"] {
  if (sub && (CONTRACTED_STATUSES.has(sub.status) || sub.status === "incomplete"))
    return {
      state: "managed",
      evidence: `Subscription ${sub.status} on ${carePlan(sub.plan)?.label ?? sub.plan ?? "plan"}`,
    };
  const choice = block.tenant.carePlanChoice;
  if (choice && choice !== "none")
    return {
      state: "managed",
      evidence: `Client chose ${carePlan(choice)?.label ?? choice} in the portal · not yet activated`,
    };
  if (choice === "none")
    return {
      state: "unresolved",
      evidence: "Client declined a care plan · no independent handover recorded",
    };
  return {
    state: "unresolved",
    evidence: "No service election recorded · independent is never inferred",
  };
}

const HEALTH_MAP: Record<string, Health> = {
  ok: "healthy",
  warning: "attention",
  down: "incident",
  unknown: "unknown",
};

function healthOf(block: Block, now: Date): Facets["health"] {
  const profile = block.project?.profile;
  const freshness = `Read ${fmtTime(now)} · monitoring not consulted`;
  if (!profile)
    return { state: "unknown", evidence: "No system profile on record", freshness };
  const state: Health = (profile.health ? HEALTH_MAP[profile.health] : undefined) ?? "unknown";
  return {
    state,
    evidence:
      state === "unknown"
        ? "System profile has no health reading"
        : `system_profiles.health = ${profile.health}`,
    freshness,
  };
}

/** Attention rows for one client, in brief §5.1 priority order. */
export function attentionFor(
  block: Block,
  s: OpsSignals,
  sub: SubscriptionDetailRow | null,
  orderForm: OrderFormDetailRow | null
): Attention[] {
  const id = block.tenant.id;
  const client = block.tenant.name;
  const now = s.now;
  const rows: Attention[] = [];
  const base = (path: string) => `/admin/clients/${id}/${path}`;
  const financeOwner = financeOwnerOf(block);
  const accountOwner = ownerOf(block);

  const invoices = s.invoices.filter((i) => i.tenant_id === id);
  const overdue = invoices.filter(
    (i) => i.status === "open" && i.due_at && new Date(i.due_at) < now
  );
  if (overdue.length) {
    const oldest = overdue.reduce((a, b) => (a.due_at! < b.due_at! ? a : b));
    rows.push({
      clientId: id,
      client,
      problem: `${overdue.length} overdue invoice${overdue.length === 1 ? "" : "s"} · ${gbp(
        overdue.reduce((n, i) => n + num(i.amount), 0)
      )}`,
      consequence: "Cash not collected · no automatic service change",
      owner: financeOwner,
      due: fmtDate(oldest.due_at),
      dueAt: oldest.due_at,
      action: "Open billing",
      href: base("billing"),
      kind: "finance",
      priority: 0,
    });
  }

  if (sub?.status === "past_due")
    rows.push({
      clientId: id,
      client,
      problem: `Subscription past due · ${carePlan(sub.plan)?.label ?? sub.plan ?? "plan"} ${gbp(
        num(sub.mrr)
      )}/mo`,
      consequence: "Recurring collection failing at the provider",
      owner: financeOwner,
      due: "now",
      dueAt: null,
      action: sub.provider === "gocardless" ? "Open Direct Debits" : "Open care plan",
      href: sub.provider === "gocardless" ? "/admin/billing/direct-debits" : base("care-plan"),
      kind: "finance",
      priority: 1,
    });

  if (sub?.status === "incomplete") {
    const sentDays = block.carePlan.ddLinkSentAt ? daysAgo(block.carePlan.ddLinkSentAt, now) : null;
    rows.push({
      clientId: id,
      client,
      problem:
        sub.provider === "gocardless"
          ? `Direct Debit link sent${sentDays !== null ? ` ${sentDays}d ago` : ""} · mandate not authorised`
          : "Subscription sign-up not completed",
      consequence: "Nothing can be collected until the mandate is authorised",
      owner: financeOwner,
      due: block.carePlan.ddLinkSentAt
        ? fmtDate(new Date(Date.parse(block.carePlan.ddLinkSentAt) + 7 * DAY).toISOString())
        : "—",
      dueAt: null,
      action: "Open Direct Debits",
      href: "/admin/billing/direct-debits",
      kind: "finance",
      priority: 2,
    });
  }

  if (orderForm?.status === "client_review" && orderForm.sent_at) {
    const age = daysAgo(orderForm.sent_at, now);
    if (age >= 7)
      rows.push({
        clientId: id,
        client,
        problem: `Order Form ${orderForm.reference} in client review for ${age} days`,
        consequence: "No build or billing can start without acceptance",
        owner: accountOwner,
        due: fmtDate(orderForm.sent_at),
        dueAt: orderForm.sent_at,
        action: "Open agreement",
        href: base("agreement"),
        kind: "contract",
        priority: 3,
      });
  }

  const draftsNeedingReview = s.orderForms.filter(
    (o) => o.tenant_id === id && o.status === "draft" && !o.reviewed_by
  );
  if (draftsNeedingReview.length || block.docs.awaitingApproval > draftsNeedingReview.length)
    rows.push({
      clientId: id,
      client,
      problem: draftsNeedingReview.length
        ? `Order Form ${draftsNeedingReview[0].reference} draft needs second-person review`
        : "Document draft needs second-person review",
      consequence: "Cannot be sent until a second staff member has reviewed it",
      owner: accountOwner,
      due: "—",
      dueAt: null,
      action: draftsNeedingReview.length ? "Open agreement" : "Open documents",
      href: draftsNeedingReview.length ? base("agreement") : base("docs"),
      kind: "contract",
      priority: 4,
    });

  const choice = block.tenant.carePlanChoice;
  if (choice && choice !== "none" && !block.tenant.carePlanTermsAcceptedAt && !sub?.terms_accepted_at)
    rows.push({
      clientId: id,
      client,
      problem: `Plan chosen (${carePlan(choice)?.label ?? choice}) · service terms not accepted`,
      consequence: "No recurring charge is possible without accepted terms",
      owner: accountOwner,
      due: "—",
      dueAt: null,
      action: "Open care plan",
      href: base("care-plan"),
      kind: "contract",
      priority: 5,
    });

  const unclassified = s.issues.filter(
    (i) =>
      i.tenant_id === id &&
      (i.classification === null || i.billing === "unclassified" || i.billing === null)
  );
  if (unclassified.length) {
    const overdueIssue = unclassified.find((i) => i.due_at && new Date(i.due_at) < now);
    rows.push({
      clientId: id,
      client,
      problem: `${unclassified.length} open issue${unclassified.length === 1 ? "" : "s"} unclassified · "${
        unclassified[0].title
      }"`,
      consequence: "Coverage and billing treatment undecided · work cannot be scheduled",
      owner: block.project?.owners.delivery?.trim() || accountOwner,
      due: overdueIssue ? fmtDate(overdueIssue.due_at) : fmtDate(unclassified[0].due_at),
      dueAt: overdueIssue?.due_at ?? unclassified[0].due_at,
      action: "Open issues",
      href: base("issues"),
      kind: overdueIssue ? "overdue" : "routine",
      priority: overdueIssue ? 6 : 8,
    });
  }

  const persisted = s.nextActions.get(id);
  if (persisted) {
    const late = persisted.due_at && new Date(persisted.due_at) < now;
    rows.push({
      clientId: id,
      client,
      problem: persisted.text,
      consequence: late ? "Next action overdue" : "Recorded next action",
      owner: persisted.owner,
      due: persisted.due_at ? fmtDate(persisted.due_at) : "no date",
      dueAt: persisted.due_at,
      action: "Open client",
      href: `/admin/clients/${id}`,
      kind: late ? "overdue" : "deadline",
      priority: late ? 6 : 7,
    });
  } else if (block.project?.nextAction) {
    rows.push({
      clientId: id,
      client,
      problem: block.project.nextAction,
      consequence: "Recorded on the project · no due date",
      owner: block.project.nextActionOwner ?? "Unassigned",
      due: "no date",
      dueAt: null,
      action: "Open hub",
      href: base("hub"),
      kind: "deadline",
      priority: 7,
    });
  }

  return rows.sort((a, b) => a.priority - b.priority);
}

function nextActionOf(block: Block, s: OpsSignals, attention: Attention[]): NextAction {
  const persisted = s.nextActions.get(block.tenant.id);
  if (persisted)
    return {
      text: persisted.text,
      owner: persisted.owner,
      due: persisted.due_at ? fmtDate(persisted.due_at) : "no date",
      consequence: persisted.source === "manual" ? "Set by staff" : `Source: ${persisted.source}`,
    };
  const p = block.project;
  if (p?.nextAction)
    return {
      text: p.nextAction,
      owner: p.nextActionOwner ?? "Unassigned",
      due: "no date",
      consequence: "From the project record (no due date field)",
    };
  const top = attention[0];
  if (top)
    return {
      text: top.problem,
      owner: top.owner,
      due: top.due,
      consequence: `Derived from the top attention row · ${top.consequence}`,
    };
  return {
    text: "Nothing recorded",
    owner: ownerOf(block),
    due: "—",
    consequence: "No next action set and no open signal",
  };
}

const MILESTONE_LABEL: Record<string, string> = {
  build_milestone: "Build milestone",
  one_off: "One-off invoice",
  care_plan: "Care plan invoice",
};

function milestonesOf(invoices: InvoiceDetailRow[], now: Date): Client["build"]["milestones"] {
  return invoices
    .filter((i) => i.type === "build_milestone" || i.type === "one_off")
    .sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
    .map((i) => {
      const amount = num(i.amount);
      const state: MilestoneState =
        i.status === "paid"
          ? "paid"
          : i.status === "void"
            ? "void"
            : i.status === "draft"
              ? "draft"
              : i.due_at && new Date(i.due_at) < now
                ? "overdue"
                : "issued";
      return {
        label: `${MILESTONE_LABEL[i.type] ?? i.type} · ${i.id.slice(0, 8)}`,
        amountGbp: amount,
        paidGbp: i.status === "paid" ? amount : 0,
        state,
        due: i.status === "paid" ? `paid ${fmtDate(i.paid_at)}` : fmtDate(i.due_at),
      };
    });
}

function runOf(block: Block, sub: SubscriptionDetailRow | null, legacy: boolean): Client["run"] {
  if (!sub) {
    const choice = block.tenant.carePlanChoice;
    if (choice && choice !== "none")
      return {
        state: "package pending",
        packageName: carePlan(choice)?.label ?? choice,
        note: "Plan chosen in the portal · no subscription row yet, so no monthly amount is contracted.",
      };
    return {
      state: "not applicable",
      note:
        choice === "none"
          ? "Client declined a care plan."
          : "No service arrangement recorded.",
    };
  }
  const plan = carePlan(sub.plan);
  const mandate: Client["run"]["mandate"] =
    sub.provider === "gocardless"
      ? sub.gc_mandate_id
        ? "authorised"
        : sub.gc_billing_request_id
          ? "pending"
          : "none"
      : undefined;
  const common = {
    packageName: plan?.label ?? sub.plan ?? undefined,
    monthlyGbp: num(sub.mrr),
    contractualStart: sub.started_at ? fmtDate(sub.started_at) : undefined,
    mandate,
    provider: sub.provider ?? undefined,
    termsVersion: sub.terms_version ?? undefined,
  };
  if (legacy && CONTRACTED_STATUSES.has(sub.status))
    return {
      state: "legacy",
      ...common,
      note: "Legacy plan · price and terms preserved as contracted; never repriced.",
    };
  if (sub.status === "past_due")
    return { state: "collection failed", ...common, note: "Provider reports the subscription past due." };
  if (sub.status === "active" || sub.status === "trialing")
    return {
      state: "active",
      ...common,
      note: "Collection dates are held by the provider and not read here.",
    };
  if (sub.status === "incomplete")
    return { state: "setup pending", ...common, note: "Sign-up started · mandate not authorised." };
  if (sub.status === "canceled") return { state: "cancelled", ...common };
  return { state: "exception", ...common, note: `Subscription status ${sub.status}` };
}

function systemsOf(block: Block, route: Facets["route"], run: Client["run"]): Client["systems"] {
  return block.projects.map((p, i) => ({
    name: p.name,
    arrangement:
      i === 0
        ? route.state === "managed"
          ? `Managed · ${run.packageName ?? "package pending"}`
          : "Route unresolved"
        : `Stage ${(p.stage ?? "unknown").replace(/_/g, " ")}`,
  }));
}

function buildClient(block: Block, s: OpsSignals): Client & { attention: Attention[] } {
  const id = block.tenant.id;
  const subs = s.subscriptions.filter((r) => r.tenant_id === id);
  const sub = liveSubscription(subs);
  const orderForm = liveOrderForm(s.orderForms.filter((r) => r.tenant_id === id));
  const invoices = s.invoices.filter((r) => r.tenant_id === id);
  const legacy = isLegacy(block, sub);
  const attention = attentionFor(block, s, sub, orderForm);
  const route = routeOf(block, sub);
  const run = runOf(block, sub, legacy);

  const facets: Facets = {
    relationship: relationshipOf(block, orderForm),
    agreement: agreementOf(block, orderForm),
    billing: billingOf(block, sub, invoices, s.now),
    delivery: deliveryOf(block),
    route,
    health: healthOf(block, s.now),
  };

  // projects.build_fee first, then the live Order Form's project fee.
  const buildPrice =
    (block.project ? (s.buildFees.get(block.project.id) ?? 0) : 0) ||
    num(orderForm?.project_fee);

  const flags: string[] = [];
  if (legacy) flags.push("Legacy agreement · read-only pricing");
  if (block.pricing.enterpriseReview) flags.push("Enterprise review required");
  if (block.issues.critHigh) flags.push(`${block.issues.critHigh} critical/high issue(s)`);
  if (block.portal.state === "none") flags.push("No portal user");

  return {
    id,
    legalName: block.tenant.name,
    tradingName: undefined,
    ref: clientRef(id),
    owner: ownerOf(block),
    model: legacy ? "legacy" : "new",
    facets,
    nextAction: nextActionOf(block, s, attention),
    build: { priceGbp: buildPrice, milestones: milestonesOf(invoices, s.now) },
    run,
    systems: systemsOf(block, route, run),
    checklist: [],
    contacts: block.tenant.contactName || block.tenant.contactEmail
      ? [
          {
            name: block.tenant.contactName ?? block.tenant.contactEmail ?? "Contact",
            role: "Primary contact",
            email: block.tenant.contactEmail ?? "",
          },
        ]
      : [],
    history: [],
    flags: flags.length ? flags : undefined,
    attention,
  };
}

// ---------------------------------------------------------------------------
// Public loaders
// ---------------------------------------------------------------------------

export type ClientsIndex = {
  clients: Client[];
  attention: Attention[];
  signals: OpsSignals;
  blocks: Block[];
  /** Rows beyond this count are not returned (paginated at 100). */
  truncated: boolean;
};

/** One aggregated load for the clients list and the Today page. */
export async function loadClientsIndex(limit = 100): Promise<ClientsIndex> {
  const service = createServiceClient();
  const { clients: allBlocks } = await loadClientBlocks();
  const blocks = allBlocks.slice(0, limit);
  const signals = await loadOpsSignals(
    service,
    blocks.map((b) => b.tenant.id)
  );
  const built = blocks.map((b) => buildClient(b, signals));
  const attention = built
    .flatMap((c) => c.attention)
    .sort((a, b) => a.priority - b.priority || a.client.localeCompare(b.client));
  return {
    clients: built.map(({ attention: _a, ...c }) => c),
    attention,
    signals,
    blocks,
    truncated: allBlocks.length > blocks.length,
  };
}

const CHECK_SOURCE = {
  dpa: "compliance_records / projects DPA",
  terms: "contract_acceptances / care plan terms",
  mandate: "subscriptions.gc_mandate_id",
  deposit: "invoices (build_milestone)",
  portal: "memberships",
};

/** The client workspace: the list row plus contacts, history and checklist. */
export async function loadClientWorkspace(
  tenantId: string
): Promise<(Client & { attention: Attention[] }) | null> {
  const block = await loadClientBlock(tenantId);
  if (!block) return null;
  const service = createServiceClient();

  const [signals, compliance, acceptances, audit, memberships] = await Promise.all([
    loadOpsSignals(service, [tenantId]),
    service
      .from("compliance_records")
      .select("tenant_id, kind, recorded_at")
      .eq("tenant_id", tenantId)
      .order("recorded_at", { ascending: false }),
    service
      .from("contract_acceptances")
      .select(
        "tenant_id, order_form_id, accepted_by_name, accepted_by_title, accepted_at, msa_version, dpa_version"
      )
      .eq("tenant_id", tenantId)
      .order("accepted_at", { ascending: false }),
    service
      .from("audit_log")
      .select("tenant_id, action, target, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(12),
    service.from("memberships").select("user_id, role").eq("tenant_id", tenantId),
  ]);

  const memberRows = (memberships.data ?? []) as { user_id: string; role: string }[];
  const { data: profilesRaw } = memberRows.length
    ? await service
        .from("profiles")
        .select("id, email, full_name")
        .in(
          "id",
          memberRows.map((m) => m.user_id)
        )
    : { data: [] as { id: string; email: string | null; full_name: string | null }[] };
  const profiles = new Map(
    ((profilesRaw ?? []) as { id: string; email: string | null; full_name: string | null }[]).map(
      (p) => [p.id, p]
    )
  );

  const client = buildClient(block, signals);
  const invoices = signals.invoices.filter((i) => i.tenant_id === tenantId);
  const sub = liveSubscription(signals.subscriptions.filter((r) => r.tenant_id === tenantId));

  // Contacts: tenant contact + portal members with profile rows.
  const roleLabel: Record<string, string> = {
    client_admin: "Portal admin",
    client_member: "Portal member",
    owner: "Nullshift owner",
    staff: "Nullshift staff",
  };
  const seen = new Set(client.contacts.map((c) => c.email.toLowerCase()));
  for (const m of memberRows) {
    const p = profiles.get(m.user_id);
    const email = (p?.email ?? "").toLowerCase();
    if (email && seen.has(email)) continue;
    seen.add(email);
    client.contacts.push({
      name: p?.full_name ?? p?.email ?? m.user_id.slice(0, 8),
      role: roleLabel[m.role] ?? m.role,
      email: p?.email ?? "",
    });
  }

  // History: last 12 audit rows.
  client.history = ((audit.data ?? []) as AuditDetailRow[]).map((a) => ({
    at: fmtDate(a.created_at),
    text: humaniseAction(a.action),
  }));

  // Checklist: real signals only.
  const complianceRows = (compliance.data ?? []) as ComplianceRow[];
  const acceptanceRows = (acceptances.data ?? []) as AcceptanceRow[];
  const dpa = complianceRows.find((c) => c.kind === "dpa_signed");
  const acceptance = acceptanceRows[0];
  const deposit = invoices.find((i) => i.type === "build_milestone");
  const chosenPlan = block.tenant.carePlanChoice && block.tenant.carePlanChoice !== "none";
  const termsAccepted = !!block.tenant.carePlanTermsAcceptedAt || !!sub?.terms_accepted_at;

  const checklist: Task[] = [
    {
      label: "Agreement accepted",
      owner: "Client",
      state: client.facets.agreement.state === "accepted" ? "complete" : "awaiting client",
      source: acceptance ? "contract_acceptances" : "order_forms / projects.proposal_status",
      evidence: acceptance
        ? `Accepted by ${acceptance.accepted_by_name} (${acceptance.accepted_by_title}) ${fmtDate(
            acceptance.accepted_at
          )} · MSA ${acceptance.msa_version}`
        : client.facets.agreement.evidence,
    },
    {
      label: "DPA signed",
      owner: "Client",
      state: dpa || acceptance?.dpa_version ? "complete" : "not started",
      source: CHECK_SOURCE.dpa,
      evidence: dpa
        ? `Recorded ${fmtDate(dpa.recorded_at)}`
        : acceptance?.dpa_version
          ? `DPA ${acceptance.dpa_version} accepted with the Order Form`
          : "No DPA record",
    },
    {
      label: "Initial payment",
      owner: "Client",
      state: !deposit
        ? "not started"
        : deposit.status === "paid"
          ? "complete"
          : deposit.status === "open"
            ? "awaiting client"
            : "in progress",
      source: CHECK_SOURCE.deposit,
      evidence: deposit
        ? `${gbp(num(deposit.amount))} · ${deposit.status}${
            deposit.paid_at ? ` ${fmtDate(deposit.paid_at)}` : deposit.due_at ? ` · due ${fmtDate(deposit.due_at)}` : ""
          }`
        : "No build milestone invoice",
    },
    {
      label: "Service terms accepted",
      owner: "Client",
      state: termsAccepted ? "complete" : chosenPlan || sub ? "awaiting client" : "not applicable",
      source: CHECK_SOURCE.terms,
      evidence: termsAccepted
        ? `Accepted ${fmtDate(block.tenant.carePlanTermsAcceptedAt ?? sub?.terms_accepted_at)}${
            sub?.terms_version ? ` · ${sub.terms_version}` : ""
          }`
        : chosenPlan || sub
          ? "Plan chosen · terms not accepted"
          : "No plan chosen",
    },
    {
      label: "Payment mandate",
      owner: "Client",
      state:
        sub?.provider === "gocardless"
          ? sub.gc_mandate_id
            ? "complete"
            : "awaiting client"
          : sub && CONTRACTED_STATUSES.has(sub.status)
            ? "complete"
            : sub
              ? "in progress"
              : "not applicable",
      source: CHECK_SOURCE.mandate,
      evidence:
        sub?.provider === "gocardless"
          ? sub.gc_mandate_id
            ? `Mandate ${sub.gc_mandate_id}`
            : sub.gc_billing_request_id
              ? "Billing request sent · mandate not authorised"
              : "No billing request"
          : sub
            ? `${sub.provider ?? "provider"} subscription ${sub.status}`
            : "No subscription",
    },
    {
      label: "Portal access",
      owner: "Nullshift",
      state:
        block.portal.state === "active"
          ? "complete"
          : block.portal.state === "invited"
            ? "awaiting client"
            : "not started",
      source: CHECK_SOURCE.portal,
      evidence:
        block.portal.state === "active"
          ? `Last sign-in ${fmtDate(block.portal.lastSignInAt)}`
          : block.portal.state === "invited"
            ? `Invited · ${block.portal.email ?? "no email"} has not signed in`
            : "No portal membership",
    },
  ];
  client.checklist = checklist;

  return client;
}
