/**
 * Finance loaders for /admin/finance (brief §5.6). Server-only: every function
 * reads production rows through the service-role client and never writes.
 *
 * What is read, and what is honestly NOT known locally:
 *   - subscriptions (contracted value, collections, subscriptions tabs)
 *   - invoices + invoice_items (receivables, overdue, invoice detail)
 *   - connect_application_fees (the only ledger we hold — Stripe Connect fees)
 *   - billing_obligations / payment_allocations / finance_exceptions when the
 *     0062 / 0065 tables exist; every read of those is wrapped so an
 *     unapplied migration degrades to "not recorded" instead of an error
 *   - projects.finance_owner for exception ownership
 *
 * There is no payout, bank-feed or provider charge-date record in this
 * database, so those figures are returned as `unavailable` with the reason,
 * never as an invented number. Money is integer minor units (pence).
 */
import { createServiceClient } from "@nullshift/db";
import { isXeroPrimary } from "@nullshift/billing/xero";
import { carePlan } from "@/lib/carePlans";
import {
  breakdownByTenant,
  testModeCount,
  totalFees,
  type FeeRow,
  type FeeTotals,
  type TenantFeeBreakdown,
} from "@/lib/billing/connectFees";

/* ── Money and dates ─────────────────────────────────────── */

export type Money = { amountMinor: number; currency: "GBP" };

export const gbpMinor = (amountMinor: number): Money => ({ amountMinor, currency: "GBP" });

/** numeric(10,2) from PostgREST arrives as a number or string; keep integer maths. */
export const toMinor = (v: number | string | null | undefined): number =>
  v === null || v === undefined ? 0 : Math.round(Number(v) * 100);

export function formatMoney(m: Money, opts: { signed?: boolean } = {}): string {
  const negative = m.amountMinor < 0;
  const abs = Math.abs(m.amountMinor);
  const major = Math.floor(abs / 100);
  const minor = abs % 100;
  const body = `£${major.toLocaleString("en-GB")}.${minor.toString().padStart(2, "0")}`;
  if (negative) return `−${body}`;
  return opts.signed && m.amountMinor > 0 ? `+${body}` : body;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** UK-order date from an ISO date or timestamp; "—" when absent. */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1] ?? m[2]} ${m[1]}`;
}

export function fmtStamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  return `${iso.replace("T", " ").slice(0, 16)} UTC`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: string): boolean => UUID_RE.test(v);

const DAY_MS = 86_400_000;

/* ── Row shapes (hand-typed: generated Database types predate these columns) ── */

type TenantRow = { id: string; name: string; care_plan_choice: string | null };

type SubscriptionRow = {
  id: string;
  tenant_id: string;
  plan: string | null;
  mrr: number | string;
  status: string;
  provider: string | null;
  stripe_subscription_id: string | null;
  gc_billing_request_id: string | null;
  gc_mandate_id: string | null;
  gc_subscription_id: string | null;
  terms_version: string | null;
  terms_accepted_at: string | null;
  started_at: string | null;
  created_at: string;
  updated_at: string;
};

type InvoiceRow = {
  id: string;
  tenant_id: string;
  project_id: string | null;
  type: string;
  amount: number | string;
  status: string;
  stripe_invoice_id: string | null;
  xero_invoice_id: string | null;
  gc_payment_id: string | null;
  hosted_invoice_url: string | null;
  due_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  obligation_id?: string | null;
};

type InvoiceItemRow = {
  id: string;
  name: string;
  amount: number | string;
  quantity: number;
};

type ProjectRow = {
  id: string;
  tenant_id: string;
  name: string;
  finance_owner: string | null;
  created_at: string;
};

type ObligationRow = {
  id: string;
  kind: string;
  label: string | null;
  milestone_key: string | null;
  period_start: string | null;
  period_end: string | null;
  amount_net_minor: number;
  tax_minor: number;
  amount_gross_minor: number;
  currency: string;
  tax_code_ref: string;
  orchestrator: string;
  collection_policy: string;
  state: string;
  source_kind: string | null;
  source_id: string | null;
};

type AllocationRow = {
  id: string;
  provider: string;
  provider_payment_id: string;
  kind: string;
  amount_minor: number;
  currency: string;
  allocated_at: string;
  evidence: Record<string, unknown> | null;
};

type FinanceExceptionRow = {
  id: string;
  tenant_id: string | null;
  kind: string;
  severity: string;
  obligation_id: string | null;
  invoice_id: string | null;
  subscription_id: string | null;
  external_ref: string | null;
  title: string;
  detail: string | null;
  owner: string | null;
  state: string;
  attempts: unknown;
  safe_retry_op: string | null;
  safe_retry_summary: string | null;
  resolution_evidence: unknown;
  opened_at: string;
  resolved_at: string | null;
};

/* ── Shared reads ────────────────────────────────────────── */

type Db = ReturnType<typeof createServiceClient>;

/** A read of a table that may not exist yet (0062 / 0065 in flight). */
async function optional<T>(run: () => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<{ rows: T[]; available: boolean }> {
  try {
    const { data, error } = await run();
    if (error) return { rows: [], available: false };
    return { rows: (data ?? []) as T[], available: true };
  } catch {
    return { rows: [], available: false };
  }
}

async function readTenants(db: Db): Promise<Map<string, TenantRow>> {
  const { data, error } = await db.from("tenants").select("id, name, care_plan_choice").eq("type", "client");
  if (error) throw new Error(`tenants read failed: ${error.message}`);
  return new Map(((data ?? []) as TenantRow[]).map((t) => [t.id, t]));
}

async function readSubscriptions(db: Db): Promise<SubscriptionRow[]> {
  const { data, error } = await db
    .from("subscriptions")
    .select(
      "id, tenant_id, plan, mrr, status, provider, stripe_subscription_id, gc_billing_request_id, gc_mandate_id, gc_subscription_id, terms_version, terms_accepted_at, started_at, created_at, updated_at"
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`subscriptions read failed: ${error.message}`);
  return (data ?? []) as SubscriptionRow[];
}

const INVOICE_COLS =
  "id, tenant_id, project_id, type, amount, status, stripe_invoice_id, xero_invoice_id, gc_payment_id, hosted_invoice_url, due_at, paid_at, created_at, updated_at";

async function readInvoices(db: Db, limit = 100): Promise<InvoiceRow[]> {
  const { data, error } = await db
    .from("invoices")
    .select(INVOICE_COLS)
    .neq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`invoices read failed: ${error.message}`);
  return (data ?? []) as InvoiceRow[];
}

async function readProjects(db: Db): Promise<ProjectRow[]> {
  const { data, error } = await db
    .from("projects")
    .select("id, tenant_id, name, finance_owner, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`projects read failed: ${error.message}`);
  return (data ?? []) as ProjectRow[];
}

async function readFees(db: Db): Promise<FeeRow[]> {
  const { data, error } = await db
    .from("connect_application_fees")
    .select("id, tenant_id, stripe_account_id, amount, amount_refunded, currency, livemode, stripe_created_at, stripe_account_name")
    .order("stripe_created_at", { ascending: false })
    .limit(1000);
  if (error) throw new Error(`connect_application_fees read failed: ${error.message}`);
  return (data ?? []) as FeeRow[];
}

/** Finance owner per tenant: the newest project's finance_owner, else "Unassigned". */
function ownerMap(projects: ProjectRow[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const p of projects) {
    if (out.has(p.tenant_id)) continue;
    if (p.finance_owner && p.finance_owner.trim()) out.set(p.tenant_id, p.finance_owner.trim());
  }
  return out;
}

const ownerFor = (owners: Map<string, string>, tenantId: string | null): string =>
  (tenantId && owners.get(tenantId)) || "Unassigned";

const tenantName = (tenants: Map<string, TenantRow>, id: string | null): string =>
  (id && tenants.get(id)?.name) || "Unknown client";

/* ── Subscriptions and collections ──────────────────────── */

export const LEGACY_PLANS = new Set(["hosting", "hosting_api", "build_3", "build_10"]);

export const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

export function planLabel(plan: string | null): string {
  if (!plan) return "No plan";
  return carePlan(plan)?.label ?? plan;
}

export type CollectionStatus = "link_sent" | "mandate_active" | "collection_failed" | "trialing" | "cancelled";

export const COLLECTION_STATUS_LABEL: Record<CollectionStatus, string> = {
  link_sent: "Link sent, no mandate",
  mandate_active: "Mandate active",
  collection_failed: "Collection failed",
  trialing: "Trialing",
  cancelled: "Cancelled",
};

export function collectionStatus(status: string): CollectionStatus {
  switch (status) {
    case "incomplete":
      return "link_sent";
    case "active":
      return "mandate_active";
    case "past_due":
      return "collection_failed";
    case "trialing":
      return "trialing";
    default:
      return "cancelled";
  }
}

export type SubscriptionView = {
  id: string;
  tenantId: string;
  tenantName: string;
  plan: string | null;
  planLabel: string;
  legacy: boolean;
  mrr: Money;
  status: string;
  provider: string;
  stripeSubscriptionId: string | null;
  gcBillingRequestId: string | null;
  gcMandateId: string | null;
  gcSubscriptionId: string | null;
  termsVersion: string | null;
  termsAcceptedAt: string | null;
  startedAt: string | null;
  createdAt: string;
  updatedAt: string;
  collection: CollectionStatus;
  /** True when a GoCardless subscription exists at the provider. */
  scheduledAtProvider: boolean;
  owner: string;
};

function toSubscriptionView(
  s: SubscriptionRow,
  tenants: Map<string, TenantRow>,
  owners: Map<string, string>
): SubscriptionView {
  return {
    id: s.id,
    tenantId: s.tenant_id,
    tenantName: tenantName(tenants, s.tenant_id),
    plan: s.plan,
    planLabel: planLabel(s.plan),
    legacy: !!s.plan && LEGACY_PLANS.has(s.plan),
    mrr: gbpMinor(toMinor(s.mrr)),
    status: s.status,
    provider: s.provider ?? "stripe",
    stripeSubscriptionId: s.stripe_subscription_id,
    gcBillingRequestId: s.gc_billing_request_id,
    gcMandateId: s.gc_mandate_id,
    gcSubscriptionId: s.gc_subscription_id,
    termsVersion: s.terms_version,
    termsAcceptedAt: s.terms_accepted_at,
    startedAt: s.started_at,
    createdAt: s.created_at,
    updatedAt: s.updated_at,
    collection: collectionStatus(s.status),
    scheduledAtProvider: !!s.gc_subscription_id && ACTIVE_STATUSES.has(s.status),
    owner: ownerFor(owners, s.tenant_id),
  };
}

const isDirectDebit = (s: SubscriptionRow): boolean =>
  s.provider === "gocardless" || !!s.gc_billing_request_id || !!s.gc_mandate_id || !!s.gc_subscription_id;

export type SubscriptionsData = {
  rows: SubscriptionView[];
  /** Clients with a plan election in the portal but no subscription row. */
  electedWithoutRow: { tenantId: string; tenantName: string; choice: string }[];
};

export async function loadSubscriptions(): Promise<SubscriptionsData> {
  const db = createServiceClient();
  const [tenants, subs, projects] = await Promise.all([readTenants(db), readSubscriptions(db), readProjects(db)]);
  const owners = ownerMap(projects);
  const rows = subs.map((s) => toSubscriptionView(s, tenants, owners));
  const withRow = new Set(subs.filter((s) => s.status !== "canceled").map((s) => s.tenant_id));
  const electedWithoutRow = [...tenants.values()]
    .filter((t) => t.care_plan_choice && t.care_plan_choice !== "none" && !withRow.has(t.id))
    .map((t) => ({ tenantId: t.id, tenantName: t.name, choice: planLabel(t.care_plan_choice) }));
  return { rows, electedWithoutRow };
}

export type CollectionsData = { rows: SubscriptionView[] };

export async function loadCollections(): Promise<CollectionsData> {
  const db = createServiceClient();
  const [tenants, subs, projects] = await Promise.all([readTenants(db), readSubscriptions(db), readProjects(db)]);
  const owners = ownerMap(projects);
  return { rows: subs.filter(isDirectDebit).map((s) => toSubscriptionView(s, tenants, owners)) };
}

export type CollectionDetail = {
  row: SubscriptionView;
  /** care_plan invoices minted from GoCardless payments for this tenant. */
  collectedInvoices: InvoiceView[];
  exceptions: DerivedException[];
};

export async function loadCollection(id: string): Promise<CollectionDetail | null> {
  if (!isUuid(id)) return null;
  const db = createServiceClient();
  const [tenants, subs, projects, invoices, ex] = await Promise.all([
    readTenants(db),
    readSubscriptions(db),
    readProjects(db),
    readInvoices(db),
    optional<FinanceExceptionRow>(() => db.from("finance_exceptions").select("*").eq("subscription_id", id)),
  ]);
  const s = subs.find((x) => x.id === id);
  if (!s) return null;
  const owners = ownerMap(projects);
  const row = toSubscriptionView(s, tenants, owners);
  const collectedInvoices = invoices
    .filter((i) => i.tenant_id === s.tenant_id && i.type === "care_plan")
    .map((i) => toInvoiceView(i, tenants, owners));
  const derived = deriveExceptions({ subs: [s], invoices: [], tenants, owners });
  const stored = ex.rows.map((r) => toStoredException(r, tenants, owners));
  return { row, collectedInvoices, exceptions: [...stored, ...derived] };
}

/* ── Invoices ────────────────────────────────────────────── */

export type InvoiceState = "open" | "overdue" | "paid" | "void" | "uncollectible";

export const INVOICE_TYPE_LABEL: Record<string, string> = {
  build_milestone: "Build milestone",
  one_off: "One-off",
  care_plan: "Care plan period",
};

export type InvoiceView = {
  id: string;
  tenantId: string;
  tenantName: string;
  projectId: string | null;
  type: string;
  typeLabel: string;
  amount: Money;
  status: string;
  state: InvoiceState;
  createdAt: string;
  dueAt: string | null;
  paidAt: string | null;
  xeroInvoiceId: string | null;
  stripeInvoiceId: string | null;
  gcPaymentId: string | null;
  hostedInvoiceUrl: string | null;
  obligationId: string | null;
  owner: string;
  /** Xero is the rail but this open invoice has no Xero id. */
  missingXero: boolean;
};

export const isOverdue = (i: { status: string; due_at: string | null }, now = Date.now()): boolean =>
  i.status === "open" && !!i.due_at && Date.parse(i.due_at) < now;

function invoiceState(i: InvoiceRow): InvoiceState {
  if (isOverdue(i)) return "overdue";
  if (i.status === "open" || i.status === "paid" || i.status === "void" || i.status === "uncollectible") return i.status;
  return "open";
}

function toInvoiceView(i: InvoiceRow, tenants: Map<string, TenantRow>, owners: Map<string, string>): InvoiceView {
  return {
    id: i.id,
    tenantId: i.tenant_id,
    tenantName: tenantName(tenants, i.tenant_id),
    projectId: i.project_id,
    type: i.type,
    typeLabel: INVOICE_TYPE_LABEL[i.type] ?? i.type,
    amount: gbpMinor(toMinor(i.amount)),
    status: i.status,
    state: invoiceState(i),
    createdAt: i.created_at,
    dueAt: i.due_at,
    paidAt: i.paid_at,
    xeroInvoiceId: i.xero_invoice_id,
    stripeInvoiceId: i.stripe_invoice_id,
    gcPaymentId: i.gc_payment_id,
    hostedInvoiceUrl: i.hosted_invoice_url,
    obligationId: i.obligation_id ?? null,
    owner: ownerFor(owners, i.tenant_id),
    missingXero: isXeroPrimary() && i.status === "open" && !i.xero_invoice_id,
  };
}

/** Provider deep links for the ids we store. */
export const providerLinks = {
  xero: (id: string) => `https://go.xero.com/AccountsReceivable/View.aspx?InvoiceID=${encodeURIComponent(id)}`,
  stripeInvoice: (id: string) => `https://dashboard.stripe.com/invoices/${encodeURIComponent(id)}`,
  stripeSubscription: (id: string) => `https://dashboard.stripe.com/subscriptions/${encodeURIComponent(id)}`,
  gcPayment: (id: string) => `https://manage.gocardless.com/payments/${encodeURIComponent(id)}`,
  gcMandate: (id: string) => `https://manage.gocardless.com/mandates/${encodeURIComponent(id)}`,
  gcSubscription: (id: string) => `https://manage.gocardless.com/subscriptions/${encodeURIComponent(id)}`,
};

export type InvoiceFilter = "all" | "open" | "overdue" | "paid" | "unsynced";

export type InvoicesData = { rows: InvoiceView[]; total: number; xeroPrimary: boolean };

export async function loadInvoices(filter: InvoiceFilter): Promise<InvoicesData> {
  const db = createServiceClient();
  const [tenants, invoices, projects] = await Promise.all([readTenants(db), readInvoices(db), readProjects(db)]);
  const owners = ownerMap(projects);
  const all = invoices.map((i) => toInvoiceView(i, tenants, owners));
  const rows = all.filter((i) => {
    switch (filter) {
      case "open":
        return i.status === "open";
      case "overdue":
        return i.state === "overdue";
      case "paid":
        return i.status === "paid";
      case "unsynced":
        return i.missingXero;
      default:
        return true;
    }
  });
  return { rows, total: all.length, xeroPrimary: isXeroPrimary() };
}

export type InvoiceDetail = {
  invoice: InvoiceView;
  items: { id: string; name: string; quantity: number; amount: Money; lineTotal: Money }[];
  itemsTotal: Money;
  obligation: { available: boolean; row: ObligationRow | null };
  allocations: { available: boolean; rows: AllocationRow[]; totalMinor: number };
  exceptions: DerivedException[];
  projectName: string | null;
};

export async function loadInvoice(id: string): Promise<InvoiceDetail | null> {
  if (!isUuid(id)) return null;
  const db = createServiceClient();
  const [tenants, projects, inv, items, alloc, ex] = await Promise.all([
    readTenants(db),
    readProjects(db),
    db.from("invoices").select(INVOICE_COLS).eq("id", id).maybeSingle(),
    db.from("invoice_items").select("id, name, amount, quantity").eq("invoice_id", id).order("created_at"),
    optional<AllocationRow>(() =>
      db
        .from("payment_allocations")
        .select("id, provider, provider_payment_id, kind, amount_minor, currency, allocated_at, evidence")
        .eq("invoice_id", id)
        .order("allocated_at")
    ),
    optional<FinanceExceptionRow>(() => db.from("finance_exceptions").select("*").eq("invoice_id", id)),
  ]);
  if (inv.error) throw new Error(`invoice read failed: ${inv.error.message}`);
  if (!inv.data) return null;
  const row = inv.data as InvoiceRow;

  // obligation_id only exists once 0062 is applied; read it separately so the
  // main select never fails on a missing column.
  let obligation: InvoiceDetail["obligation"] = { available: false, row: null };
  const obl = await optional<{ obligation_id: string | null }>(() =>
    db.from("invoices").select("obligation_id").eq("id", id)
  );
  if (obl.available) {
    const oid = obl.rows[0]?.obligation_id ?? null;
    row.obligation_id = oid;
    if (oid) {
      const o = await optional<ObligationRow>(() => db.from("billing_obligations").select("*").eq("id", oid));
      obligation = { available: o.available, row: o.rows[0] ?? null };
    } else obligation = { available: true, row: null };
  }

  const owners = ownerMap(projects);
  const invoice = toInvoiceView(row, tenants, owners);
  const lineItems = ((items.data ?? []) as InvoiceItemRow[]).map((it) => {
    const unit = toMinor(it.amount);
    return { id: it.id, name: it.name, quantity: it.quantity, amount: gbpMinor(unit), lineTotal: gbpMinor(unit * it.quantity) };
  });
  const allocations = {
    available: alloc.available,
    rows: alloc.rows,
    totalMinor: alloc.rows.reduce((n, a) => n + (a.kind === "payment" ? a.amount_minor : -a.amount_minor), 0),
  };
  const derived = deriveExceptions({ subs: [], invoices: [row], tenants, owners });
  const stored = ex.rows.map((r) => toStoredException(r, tenants, owners));
  return {
    invoice,
    items: lineItems,
    itemsTotal: gbpMinor(lineItems.reduce((n, l) => n + l.lineTotal.amountMinor, 0)),
    obligation,
    allocations,
    exceptions: [...stored, ...derived],
    projectName: projects.find((p) => p.id === row.project_id)?.name ?? null,
  };
}

/* ── Exceptions ──────────────────────────────────────────── */

export type ExceptionKind =
  | "missing_consent"
  | "cancelled_mandate"
  | "failed_collection"
  | "xero_outage"
  | "duplicate_warning"
  | "balance_mismatch"
  | "link_closure_failed"
  | "unmatched_payout"
  | "missing_activation_gate"
  | "overdue_invoice"
  | "other";

export const EXCEPTION_KIND_LABEL: Record<ExceptionKind, string> = {
  missing_consent: "Missing consent",
  cancelled_mandate: "Cancelled mandate",
  failed_collection: "Failed collection",
  xero_outage: "Xero record missing",
  duplicate_warning: "Duplicate warning",
  balance_mismatch: "Balance mismatch",
  link_closure_failed: "Link closure failed",
  unmatched_payout: "Unmatched payout",
  missing_activation_gate: "Missing activation gate",
  overdue_invoice: "Overdue invoice",
  other: "Other",
};

export type ExceptionState = "open" | "in_progress" | "resolved";

export const EXCEPTION_STATE_LABEL: Record<ExceptionState, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
};

export type ExceptionAttempt = { at: string; by: string; action: string; outcome: string; note?: string };

export type DerivedException = {
  id: string;
  /** "derived" = computed from live rows on this request; "recorded" = finance_exceptions row. */
  source: "derived" | "recorded";
  kind: ExceptionKind;
  severity: "normal" | "urgent";
  tenantId: string | null;
  tenantName: string;
  title: string;
  detail: string;
  owner: string;
  state: ExceptionState;
  openedAt: string;
  resolvedAt: string | null;
  amount: Money | null;
  attempts: ExceptionAttempt[];
  safeRetry: { op: string; summary: string } | null;
  resolutionEvidence: unknown[];
  links: { invoiceId?: string; subscriptionId?: string; obligationId?: string; externalRef?: string };
  /** The legacy page that can act on this. */
  action: { href: string; label: string };
};

const DD_BOARD = { href: "/admin/billing/direct-debits", label: "Open the Direct Debits board" };

function deriveExceptions(input: {
  subs: SubscriptionRow[];
  invoices: InvoiceRow[];
  tenants: Map<string, TenantRow>;
  owners: Map<string, string>;
  now?: number;
}): DerivedException[] {
  const now = input.now ?? Date.now();
  const out: DerivedException[] = [];
  const xero = isXeroPrimary();

  for (const s of input.subs) {
    const name = tenantName(input.tenants, s.tenant_id);
    const owner = ownerFor(input.owners, s.tenant_id);
    if (s.status === "past_due") {
      out.push({
        id: `d-sub-${s.id}`,
        source: "derived",
        kind: "failed_collection",
        severity: "urgent",
        tenantId: s.tenant_id,
        tenantName: name,
        title: `Collection failed — ${name}`,
        detail: `Subscription ${s.id} is past_due at ${s.provider ?? "stripe"}. The provider reported a failed collection; the obligation stays open. Any retry is a new, approved attempt from the provider dashboard.`,
        owner,
        state: "open",
        openedAt: s.updated_at,
        resolvedAt: null,
        amount: gbpMinor(toMinor(s.mrr)),
        attempts: [],
        safeRetry: null,
        resolutionEvidence: [],
        links: { subscriptionId: s.id },
        action: DD_BOARD,
      });
    }
    if (s.status === "incomplete" && isDirectDebit(s) && now - Date.parse(s.created_at) > 3 * DAY_MS) {
      const days = Math.floor((now - Date.parse(s.created_at)) / DAY_MS);
      out.push({
        id: `d-dd-${s.id}`,
        source: "derived",
        kind: "missing_consent",
        severity: "normal",
        tenantId: s.tenant_id,
        tenantName: name,
        title: `Direct Debit link sent, no mandate — ${name}`,
        detail: `A GoCardless billing request (${s.gc_billing_request_id ?? "id not stored"}) was created ${days} days ago and no mandate has been authorised. Nothing can be collected until the client completes it.`,
        owner,
        state: "open",
        openedAt: s.created_at,
        resolvedAt: null,
        amount: gbpMinor(toMinor(s.mrr)),
        attempts: [],
        safeRetry: null,
        resolutionEvidence: [],
        links: { subscriptionId: s.id },
        action: DD_BOARD,
      });
    }
  }

  for (const i of input.invoices) {
    const name = tenantName(input.tenants, i.tenant_id);
    const owner = ownerFor(input.owners, i.tenant_id);
    if (xero && i.status === "open" && !i.xero_invoice_id) {
      out.push({
        id: `d-inv-xero-${i.id}`,
        source: "derived",
        kind: "xero_outage",
        severity: "normal",
        tenantId: i.tenant_id,
        tenantName: name,
        title: `Open invoice with no Xero record — ${name}`,
        detail: `Xero is the invoice rail but invoice ${i.id} has no xero_invoice_id. Either the Xero create failed at issue or the invoice was raised locally only; the accounting projection is missing.`,
        owner,
        state: "open",
        openedAt: i.created_at,
        resolvedAt: null,
        amount: gbpMinor(toMinor(i.amount)),
        attempts: [],
        safeRetry: null,
        resolutionEvidence: [],
        links: { invoiceId: i.id },
        action: { href: `/admin/clients/${i.tenant_id}/billing`, label: "Open the client's billing page" },
      });
    }
    if (isOverdue(i, now)) {
      const days = Math.floor((now - Date.parse(i.due_at!)) / DAY_MS);
      out.push({
        id: `d-inv-due-${i.id}`,
        source: "derived",
        kind: "overdue_invoice",
        severity: days > 14 ? "urgent" : "normal",
        tenantId: i.tenant_id,
        tenantName: name,
        title: `Invoice overdue by ${days} day${days === 1 ? "" : "s"} — ${name}`,
        detail: `Invoice ${i.id} (${INVOICE_TYPE_LABEL[i.type] ?? i.type}) was due ${fmtDate(i.due_at)} and is still open.`,
        owner,
        state: "open",
        openedAt: i.due_at!,
        resolvedAt: null,
        amount: gbpMinor(toMinor(i.amount)),
        attempts: [],
        safeRetry: null,
        resolutionEvidence: [],
        links: { invoiceId: i.id },
        action: { href: `/admin/clients/${i.tenant_id}/billing`, label: "Open the client's billing page" },
      });
    }
  }
  return out;
}

const KNOWN_KINDS = new Set<string>(Object.keys(EXCEPTION_KIND_LABEL));

function toStoredException(
  r: FinanceExceptionRow,
  tenants: Map<string, TenantRow>,
  owners: Map<string, string>
): DerivedException {
  const state: ExceptionState = r.state === "resolved" ? "resolved" : r.state === "in_progress" ? "in_progress" : "open";
  const action = r.subscription_id
    ? DD_BOARD
    : r.tenant_id
      ? { href: `/admin/clients/${r.tenant_id}/billing`, label: "Open the client's billing page" }
      : { href: "/admin/billing", label: "Open legacy billing" };
  return {
    id: r.id,
    source: "recorded",
    kind: (KNOWN_KINDS.has(r.kind) ? r.kind : "other") as ExceptionKind,
    severity: r.severity === "urgent" ? "urgent" : "normal",
    tenantId: r.tenant_id,
    tenantName: r.tenant_id ? tenantName(tenants, r.tenant_id) : "Not attributed",
    title: r.title,
    detail: r.detail ?? "",
    owner: r.owner?.trim() || ownerFor(owners, r.tenant_id),
    state,
    openedAt: r.opened_at,
    resolvedAt: r.resolved_at,
    amount: null,
    attempts: Array.isArray(r.attempts) ? (r.attempts as ExceptionAttempt[]) : [],
    safeRetry: r.safe_retry_op ? { op: r.safe_retry_op, summary: r.safe_retry_summary ?? "" } : null,
    resolutionEvidence: Array.isArray(r.resolution_evidence) ? (r.resolution_evidence as unknown[]) : [],
    links: {
      invoiceId: r.invoice_id ?? undefined,
      subscriptionId: r.subscription_id ?? undefined,
      obligationId: r.obligation_id ?? undefined,
      externalRef: r.external_ref ?? undefined,
    },
    action,
  };
}

export type ExceptionsData = {
  rows: DerivedException[];
  /** finance_exceptions table reachable (0065 applied). */
  recordedAvailable: boolean;
  openCount: number;
};

async function loadAllExceptions(db: Db): Promise<ExceptionsData> {
  const [tenants, subs, invoices, projects, stored] = await Promise.all([
    readTenants(db),
    readSubscriptions(db),
    readInvoices(db),
    readProjects(db),
    optional<FinanceExceptionRow>(() =>
      db.from("finance_exceptions").select("*").order("opened_at", { ascending: false }).limit(100)
    ),
  ]);
  const owners = ownerMap(projects);
  const recorded = stored.rows.map((r) => toStoredException(r, tenants, owners));
  const derived = deriveExceptions({ subs, invoices, tenants, owners });
  const rows = [...recorded, ...derived].sort((a, b) => (a.openedAt < b.openedAt ? 1 : -1));
  return {
    rows,
    recordedAvailable: stored.available,
    openCount: rows.filter((e) => e.state !== "resolved").length,
  };
}

export type ExceptionFilter = "open" | "all" | "resolved" | ExceptionKind;

export async function loadExceptions(filter: ExceptionFilter): Promise<ExceptionsData> {
  const all = await loadAllExceptions(createServiceClient());
  const rows = all.rows.filter((e) => {
    if (filter === "all") return true;
    if (filter === "open") return e.state !== "resolved";
    if (filter === "resolved") return e.state === "resolved";
    return e.kind === filter;
  });
  return { ...all, rows };
}

export async function loadException(id: string): Promise<DerivedException | null> {
  const all = await loadAllExceptions(createServiceClient());
  return all.rows.find((e) => e.id === id) ?? null;
}

export async function openExceptionCount(): Promise<number> {
  try {
    return (await loadAllExceptions(createServiceClient())).openCount;
  } catch {
    return 0;
  }
}

/* ── Reconciliation ──────────────────────────────────────── */

export type ReconciliationData = {
  fees: {
    live: FeeTotals;
    thisMonth: FeeTotals;
    testModeRows: number;
    byClient: TenantFeeBreakdown[];
    lastSyncedAt: string | null;
  };
  /** payment_allocations reachable (0062 applied) and how many rows exist. */
  allocations: { available: boolean; count: number };
};

export async function loadReconciliation(): Promise<ReconciliationData> {
  const db = createServiceClient();
  const [tenants, fees, alloc] = await Promise.all([
    readTenants(db),
    readFees(db),
    optional<{ id: string }>(() => db.from("payment_allocations").select("id").limit(100)),
  ]);
  const names = new Map([...tenants.values()].map((t) => [t.id, t.name]));
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  return {
    fees: {
      live: totalFees(fees),
      thisMonth: totalFees(fees, { since: monthStart }),
      testModeRows: testModeCount(fees),
      byClient: breakdownByTenant(fees, names),
      lastSyncedAt: fees[0]?.stripe_created_at ?? null,
    },
    allocations: { available: alloc.available, count: alloc.rows.length },
  };
}

/* ── Overview ────────────────────────────────────────────── */

export type Metric = {
  key: string;
  label: string;
  value: Money | null;
  /** Why there is no figure, when value is null. */
  unavailable?: string;
  count?: number;
  range: string;
  definition: string;
  freshness: string;
  href: string;
  tone?: "neutral" | "warning" | "danger";
  aside?: string;
};

export type OverviewData = {
  metrics: Metric[];
  openExceptions: DerivedException[];
  asAt: string;
};

export async function loadFinanceOverview(): Promise<OverviewData> {
  const db = createServiceClient();
  const [tenants, subs, invoices, projects, fees, stored] = await Promise.all([
    readTenants(db),
    readSubscriptions(db),
    readInvoices(db),
    readProjects(db),
    readFees(db),
    optional<FinanceExceptionRow>(() =>
      db.from("finance_exceptions").select("*").neq("state", "resolved").order("opened_at", { ascending: false }).limit(50)
    ),
  ]);
  const owners = ownerMap(projects);
  const now = Date.now();
  const asAt = new Date(now).toISOString();
  const freshness = `Live · read ${fmtStamp(asAt)}`;

  const contracted = subs.filter((s) => ACTIVE_STATUSES.has(s.status));
  const contractedMinor = contracted.reduce((n, s) => n + toMinor(s.mrr), 0);

  const open = invoices.filter((i) => i.status === "open");
  const openMinor = open.reduce((n, i) => n + toMinor(i.amount), 0);
  const overdue = open.filter((i) => isOverdue(i, now));
  const overdueMinor = overdue.reduce((n, i) => n + toMinor(i.amount), 0);

  const scheduled = subs.filter((s) => !!s.gc_subscription_id && ACTIVE_STATUSES.has(s.status));
  const scheduledMinor = scheduled.reduce((n, s) => n + toMinor(s.mrr), 0);
  const authorisedNotScheduled = subs.filter((s) => isDirectDebit(s) && s.status === "incomplete").length;

  const liveFees = totalFees(fees);

  const metrics: Metric[] = [
    {
      key: "contracted",
      label: "Contracted service value",
      value: gbpMinor(contractedMinor),
      count: contracted.length,
      range: "Monthly run-rate",
      definition: "Sum of subscriptions.mrr where status is active, trialing or past_due. Legacy plans are included and marked on the Subscriptions tab.",
      freshness,
      href: "/admin/finance/subscriptions",
    },
    {
      key: "receivables",
      label: "Invoiced receivables",
      value: gbpMinor(openMinor),
      count: open.length,
      range: "Open invoices, as at now",
      definition: "Sum of invoices.amount where status = open. Drafts and voids are excluded; part-payments are not recorded on the legacy invoice row, so this is the issued amount.",
      freshness,
      href: "/admin/finance/invoices?filter=open",
    },
    {
      key: "overdue",
      label: "Overdue",
      value: gbpMinor(overdueMinor),
      count: overdue.length,
      range: "Open invoices past due_at",
      definition: "Open invoices whose due_at is in the past.",
      freshness,
      href: "/admin/finance/invoices?filter=overdue",
      tone: overdueMinor > 0 ? "danger" : "neutral",
    },
    {
      key: "scheduled",
      label: "Scheduled collections",
      value: gbpMinor(scheduledMinor),
      count: scheduled.length,
      range: "Per month · active GoCardless subscriptions",
      definition: "Subscriptions with a gc_subscription_id and an active status. GoCardless holds the charge dates; they are not stored locally, so this is the monthly amount the provider will attempt, not a dated schedule.",
      freshness,
      href: "/admin/finance/collections",
      aside: authorisedNotScheduled > 0 ? `${authorisedNotScheduled} Direct Debit link${authorisedNotScheduled === 1 ? "" : "s"} sent with no mandate yet — never counted as scheduled.` : undefined,
      tone: authorisedNotScheduled > 0 ? "warning" : "neutral",
    },
    {
      key: "collected",
      label: "Collected, not yet paid out",
      value: null,
      unavailable: "No payout record exists locally. GoCardless and Stripe payouts are not synced; there is no bank feed connected.",
      range: "—",
      definition: "Would be gross collections confirmed by the provider that have not yet reached the bank. Requires a payout feed, which this system does not have.",
      freshness,
      href: "/admin/finance/reconciliation",
    },
    {
      key: "fees",
      label: "Connect application fees (live)",
      value: gbpMinor(liveFees.netPence),
      count: liveFees.count,
      range: "All time · net of refunds",
      definition: "Net application fees Nullshift earned on clients' Stripe Connect volume, from connect_application_fees (live mode only). The only ledger this database holds; client payment volume itself is never counted.",
      freshness,
      href: "/admin/finance/reconciliation",
    },
  ];

  const recorded = stored.rows.map((r) => toStoredException(r, tenants, owners));
  const derived = deriveExceptions({ subs, invoices, tenants, owners, now });
  const openExceptions = [...recorded, ...derived].filter((e) => e.state !== "resolved");

  return { metrics, openExceptions, asAt };
}
