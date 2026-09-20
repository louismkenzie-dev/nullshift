/**
 * Guided estimator — plain-English inputs in, a build price and a monthly
 * price out. Pure: no database, no provider, safe to import from a client
 * component. Every number it produces comes from the two engines that already
 * exist, so nothing here is a second pricing model:
 *
 *   build   → mapToEstimate() turns selections into work packages with
 *             low/base/high hours, then calculateEstimate() with the current
 *             CommercialPolicy prices them cost-plus-margin (§6.2).
 *   monthly → mapToScale() turns company size and complexity into a ScaleInput,
 *             then calculateScalePricing() (NSI v2) gives the band, multiplier
 *             and the Core / Pro / Max monthly.
 *
 * The MAPPING TABLE lives in FEATURES, ALWAYS_ON, MIGRATION_HOURS and
 * INTEGRATION_HOURS below. Hours are the working assumptions of 20 Sep 2026
 * and are the first thing an owner should tune; each row says why it costs
 * what it costs, and that reason is surfaced to the user as a "driver".
 *
 * Unknowns are never zero: a migration or integration whose size we do not
 * know gets a WIDE range and lifts contingency, and the result says discovery
 * is recommended. Nothing is capped; large estimates are flagged for review.
 */
import type { CommercialPolicy } from "./policy";
import { CURRENT_POLICY } from "./policy";
import { calculateEstimate } from "./calculate";
import type { EstimateInput, EstimateResult, HourRange, WorkPackage } from "./types";
import { known, money, unknown } from "./types";
import {
  EMPTY_SCALE_INPUT,
  PRICING_VERSION,
  SCALE_BAND_LABEL,
  calculateScalePricing,
  type PlanId,
  type PlatformRole,
  type ScaleBand,
  type ScaleInput,
  type ScaleResult,
} from "../pricing/nsi";

/* ── Input ──────────────────────────────────────────────────────────────── */

export const FEATURE_KEYS = [
  "booking",
  "payments",
  "customer_portal",
  "staff_dashboard",
  "quoting_invoicing",
  "crm",
  "automated_messaging",
  "reporting",
  "documents_esign",
  "memberships",
  "inventory",
  "multi_location",
  "ai_assistant",
  "website",
] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

export const TURNOVER_BANDS = [
  "under_250k",
  "250k_750k",
  "750k_2m",
  "2m_5m",
  "5m_20m",
  "over_20m",
] as const;
export type TurnoverBand = (typeof TURNOVER_BANDS)[number];
/** Build-scale contribution by turnover band (owner decision 2026-09-20). */
const TURNOVER_SCALE: Record<TurnoverBand, number> = {
  under_250k: 0,
  "250k_750k": 0.1,
  "750k_2m": 0.2,
  "2m_5m": 0.3,
  "5m_20m": 0.4,
  over_20m: 0.5,
};

export const TURNOVER_BAND_LABEL: Record<TurnoverBand, string> = {
  under_250k: "Under £250k",
  "250k_750k": "£250k – £750k",
  "750k_2m": "£750k – £2m",
  "2m_5m": "£2m – £5m",
  "5m_20m": "£5m – £20m",
  over_20m: "Over £20m",
};

/** A representative turnover for each band, fed to the NSI organisation-scale table. */
const TURNOVER_BAND_GBP: Record<TurnoverBand, number> = {
  under_250k: 100_000,
  "250k_750k": 400_000,
  "750k_2m": 1_000_000,
  "2m_5m": 3_000_000,
  "5m_20m": 8_000_000,
  over_20m: 25_000_000,
};

export type Urgency = "flexible" | "normal" | "tight";
export const URGENCY_LABEL: Record<Urgency, string> = {
  flexible: "Flexible — no fixed date",
  normal: "Normal — a date in mind, some room",
  tight: "Tight — fixed date, little room",
};

export type GuidedInput = {
  client: {
    /** Existing client (tenants.id) or null for a prospect. */
    tenantId: string | null;
    /** Trading name of the client or prospect. Required to save. */
    name: string;
    sector: string;
  };
  size: {
    staffCount: number | null;
    sites: number | null;
    /** Customers, bookings or orders handled in a typical month. */
    customersPerMonth: number | null;
    turnoverBand: TurnoverBand | null;
  };
  features: FeatureKey[];
  /** Light quantities for features that scale (see FeatureDef.perUnit). */
  quantities: Partial<Record<FeatureKey, number>>;
  migration: {
    needed: boolean;
    /** Rough record count; null = not known yet (wide range, discovery). */
    recordCount: number | null;
    source: string;
  };
  integrations: {
    accounting: boolean;
    payments: boolean;
    calendar: boolean;
    email: boolean;
    /** Other named systems; null = "some, not sure how many" (wide range). */
    otherCount: number | null;
    otherNames: string;
  };
  constraints: {
    urgency: Urgency;
    /** Regulated, medical, financial or otherwise sensitive personal data. */
    sensitiveData: boolean;
    /** Everything set up in the client's own hosting/payment/email accounts. */
    clientOwnAccounts: boolean;
  };
};

export const EMPTY_GUIDED_INPUT: GuidedInput = Object.freeze({
  client: { tenantId: null, name: "", sector: "" },
  size: { staffCount: null, sites: null, customersPerMonth: null, turnoverBand: null },
  features: [],
  quantities: {},
  migration: { needed: false, recordCount: null, source: "" },
  integrations: {
    accounting: false,
    payments: false,
    calendar: false,
    email: false,
    otherCount: 0,
    otherNames: "",
  },
  constraints: { urgency: "normal", sensitiveData: false, clientOwnAccounts: false },
}) as GuidedInput;

/* ── Mapping table ──────────────────────────────────────────────────────── */

/** Role labels match the Studio fixture adapter (ROLE_BY_FIXTURE) so a saved quote re-prices identically. */
export type GuidedRole = "Lead" | "Engineer" | "Designer";
const ROLE_ID: Record<GuidedRole, string> = { Lead: "lead", Engineer: "engineer", Designer: "designer" };

export type FeatureDef = {
  key: FeatureKey;
  label: string;
  /** One line shown under the checkbox. */
  hint: string;
  role: GuidedRole;
  /** Hours for the first unit / the feature as a whole. */
  hours: HourRange;
  /** Optional scaling: extra hours per unit above `included`. */
  perUnit?: { label: string; included: number; hours: HourRange; max: number };
  /** Why it costs this — shown to the owner as the driver reason. */
  reason: string;
  /** Attributable monthly vendor cost (GBP) this feature adds — feeds the NSI cost floor. */
  vendorGbp: number;
  /** Does a customer of the client use it (drives MAU = customers, not staff)? */
  customerFacing: boolean;
};

/**
 * THE MAPPING TABLE. Hours are internal delivery hours (never sold as hours);
 * low/base/high are the scenario spread — known work sits at roughly 0.8× to
 * 1.35× base, which keeps a fully-specified project under the policy's 60%
 * spread limit; only the "not known" rows are deliberately wider. Tune the
 * numbers here, not in the UI.
 */
export const FEATURES: readonly FeatureDef[] = Object.freeze([
  {
    key: "booking",
    label: "Online booking or scheduling",
    hint: "Customers pick a slot; the system holds availability.",
    role: "Engineer",
    hours: { low: 14, base: 18, high: 24 },
    perUnit: { label: "booking types", included: 1, hours: { low: 1, base: 2, high: 3 }, max: 30 },
    reason: "availability rules, booking flow, confirmations, reschedule and cancel",
    vendorGbp: 2,
    customerFacing: true,
  },
  {
    key: "payments",
    label: "Online payments or deposits",
    hint: "Card payments, deposits, refunds and receipts.",
    role: "Engineer",
    hours: { low: 6, base: 8, high: 10 },
    reason: "Stripe checkout, deposits, refunds, receipts and reconciliation",
    vendorGbp: 0,
    customerFacing: true,
  },
  {
    key: "customer_portal",
    label: "Customer accounts or portal",
    hint: "Customers sign in to see their history and documents.",
    role: "Engineer",
    hours: { low: 10, base: 12, high: 16 },
    reason: "sign-in, password reset, account pages and data visibility rules",
    vendorGbp: 3,
    customerFacing: true,
  },
  {
    key: "staff_dashboard",
    label: "Staff or admin dashboard",
    hint: "The team's view: queues, records, actions.",
    role: "Engineer",
    hours: { low: 12, base: 15, high: 21 },
    perUnit: { label: "staff roles", included: 1, hours: { low: 2, base: 2, high: 4 }, max: 12 },
    reason: "record views, filters, day-to-day actions and permissions per role",
    vendorGbp: 0,
    customerFacing: false,
  },
  {
    key: "quoting_invoicing",
    label: "Quoting or invoicing",
    hint: "Build quotes, send invoices, track what is paid.",
    role: "Engineer",
    hours: { low: 9, base: 11, high: 15 },
    reason: "line items, PDF output, numbering, status tracking and reminders",
    vendorGbp: 2,
    customerFacing: false,
  },
  {
    key: "crm",
    label: "CRM or lead capture",
    hint: "Enquiries land in one place with a next action.",
    role: "Engineer",
    hours: { low: 6, base: 8, high: 10 },
    reason: "enquiry forms, pipeline stages, notes and follow-up tracking",
    vendorGbp: 0,
    customerFacing: true,
  },
  {
    key: "automated_messaging",
    label: "Automated emails or SMS",
    hint: "Confirmations, reminders and follow-ups sent for them.",
    role: "Engineer",
    hours: { low: 6, base: 7, high: 9 },
    perUnit: { label: "message types", included: 2, hours: { low: 1, base: 1, high: 2 }, max: 40 },
    reason: "templates, triggers, delivery provider set-up and opt-out handling",
    vendorGbp: 5,
    customerFacing: false,
  },
  {
    key: "reporting",
    label: "Reporting",
    hint: "Numbers the owner checks weekly or monthly.",
    role: "Engineer",
    hours: { low: 6, base: 7, high: 9 },
    perUnit: { label: "reports", included: 2, hours: { low: 1, base: 1, high: 2 }, max: 30 },
    reason: "queries, charts, date ranges and export",
    vendorGbp: 0,
    customerFacing: false,
  },
  {
    key: "documents_esign",
    label: "Documents or e-signature",
    hint: "Generated documents the customer signs online.",
    role: "Engineer",
    hours: { low: 7, base: 9, high: 12 },
    reason: "document templates, signing flow, storage and audit trail",
    vendorGbp: 10,
    customerFacing: true,
  },
  {
    key: "memberships",
    label: "Memberships or subscriptions",
    hint: "Recurring plans, renewals and failed-payment handling.",
    role: "Engineer",
    hours: { low: 9, base: 11, high: 15 },
    reason: "plans, recurring billing, renewals, cancellations and dunning",
    vendorGbp: 0,
    customerFacing: true,
  },
  {
    key: "inventory",
    label: "Inventory or stock",
    hint: "What is in stock, where, and when to reorder.",
    role: "Engineer",
    hours: { low: 9, base: 11, high: 15 },
    reason: "stock levels, movements, low-stock alerts and adjustments",
    vendorGbp: 0,
    customerFacing: false,
  },
  {
    key: "multi_location",
    label: "Multiple locations or branches",
    hint: "Each site sees its own data; head office sees all.",
    role: "Engineer",
    hours: { low: 6, base: 8, high: 10 },
    reason: "site scoping on every record, per-site settings and roll-up views",
    vendorGbp: 0,
    customerFacing: false,
  },
  {
    key: "ai_assistant",
    label: "Custom AI assistant or automation",
    hint: "An agent that answers, drafts or decides inside a workflow.",
    role: "Engineer",
    hours: { low: 13, base: 16, high: 22 },
    perUnit: { label: "workflows", included: 1, hours: { low: 2, base: 4, high: 6 }, max: 20 },
    reason: "prompt and tool design, guardrails, evaluation and human review points",
    vendorGbp: 30,
    customerFacing: false,
  },
  {
    key: "website",
    label: "Website or marketing pages",
    hint: "Public pages: home, services, contact and the like.",
    role: "Designer",
    hours: { low: 7, base: 9, high: 12 },
    perUnit: { label: "pages", included: 4, hours: { low: 1, base: 1, high: 2 }, max: 60 },
    reason: "design, copy layout, responsive build, SEO basics and forms",
    vendorGbp: 0,
    customerFacing: true,
  },
]);

export const featureByKey = (key: FeatureKey): FeatureDef =>
  FEATURES.find((f) => f.key === key)!;

/** Packages every build carries regardless of selections. */
const ALWAYS_ON = {
  /** Discovery and design: a fixed core plus a slice per feature. */
  discovery: {
    fixed: { low: 3, base: 4, high: 6 },
    perFeature: { low: 0.25, base: 0.5, high: 0.75 },
    reason: "workshop, data model, screens and the acceptance criteria per feature",
  },
  /** Foundation: hosting, auth, data model, deployment, backups. Every build. */
  foundation: {
    hours: { low: 8, base: 10, high: 14 },
    reason: "hosting, sign-in, database, deployment pipeline and backups",
  },
  /** Testing, launch and handover: a share of feature hours with a floor. */
  launch: { pct: 10, minHours: { low: 4, base: 6, high: 8 }, reason: "testing, go-live, training and handover notes" },
} as const;

/** Data migration hours by rough record count. Unknown count → the WIDE row. */
const MIGRATION_HOURS: readonly { upTo: number; hours: HourRange; label: string }[] = [
  { upTo: 1_000, hours: { low: 6, base: 8, high: 11 }, label: "under 1,000 records" },
  { upTo: 10_000, hours: { low: 11, base: 14, high: 19 }, label: "1,000 – 10,000 records" },
  { upTo: 100_000, hours: { low: 19, base: 24, high: 32 }, label: "10,000 – 100,000 records" },
  { upTo: Number.POSITIVE_INFINITY, hours: { low: 32, base: 40, high: 54 }, label: "over 100,000 records" },
];
const MIGRATION_UNKNOWN: HourRange = { low: 8, base: 16, high: 32 };

/** Per-integration hours. A known system is narrower than "some others". */
const INTEGRATION_HOURS = {
  accounting: { label: "Accounting (Xero, QuickBooks, Sage)", hours: { low: 6, base: 8, high: 11 } },
  payments: { label: "Payments provider account", hours: { low: 5, base: 6, high: 8 } },
  calendar: { label: "Calendar (Google, Outlook)", hours: { low: 6, base: 7, high: 9 } },
  email: { label: "Email or marketing platform", hours: { low: 5, base: 6, high: 8 } },
  other: { hours: { low: 10, base: 12, high: 16 } },
  otherUnknown: { hours: { low: 8, base: 16, high: 32 } },
} as const;

/** Constraint packages. */
const CONSTRAINTS = {
  security: {
    hours: { low: 10, base: 12, high: 16 },
    reason: "access controls, data retention, encryption at rest, audit log and a privacy check",
  },
  ownAccounts: {
    hours: { low: 3, base: 4, high: 5 },
    reason: "creating and configuring hosting, payment and email accounts in the client's name",
  },
  /** Tight deadline: extra coordination as a share of all other base hours. */
  tightPct: 15,
} as const;

/** Contingency: a base plus a step for each material unknown. Never below the base. */
const CONTINGENCY = { basePct: 10, perUnknownPct: 5, tightPct: 5 } as const;

/** Warranty reserve as a share of base labour cost (30-day defect cover), rounded up to £10. */
const WARRANTY_PCT = 5;

/** Vendor cost that every hosted build carries (hosting, database, monitoring). */
const VENDOR_BASE_GBP = 8;
/** Usage-sensitive vendor cost per 1,000 customers a month (email, storage, bandwidth). */
const VENDOR_PER_1000_CUSTOMERS_GBP = 5;

/* ── Drivers and packages ───────────────────────────────────────────────── */

export type GuidedDriver = {
  id: string;
  label: string;
  role: GuidedRole;
  hours: HourRange;
  /** Plain-English reason for the hours — shown to the owner, never to the client. */
  reason: string;
  /** True when the range was widened because a count was not known. */
  uncertain: boolean;
};

const scale = (r: HourRange, k: number): HourRange => ({
  low: Math.round(r.low * k),
  base: Math.round(r.base * k),
  high: Math.round(r.high * k),
});
const add = (a: HourRange, b: HourRange): HourRange => ({
  low: a.low + b.low,
  base: a.base + b.base,
  high: a.high + b.high,
});
const atLeast = (r: HourRange, min: HourRange): HourRange => ({
  low: Math.max(r.low, min.low),
  base: Math.max(r.base, min.base),
  high: Math.max(r.high, min.high),
});
const round = (r: HourRange): HourRange => ({
  low: Math.round(r.low),
  base: Math.round(r.base),
  high: Math.round(r.high),
});

const clampInt = (n: number | null | undefined, min: number, max: number): number | null => {
  if (n === null || n === undefined || !Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, Math.round(n)));
};

const selected = (input: GuidedInput): FeatureDef[] => {
  const seen = new Set<FeatureKey>();
  const out: FeatureDef[] = [];
  for (const key of FEATURE_KEYS) {
    if (input.features.includes(key) && !seen.has(key)) {
      seen.add(key);
      out.push(featureByKey(key));
    }
  }
  return out;
};

/** Number of named external integrations plus "others" (unknown counts as 1 for risk). */
function integrationCount(input: GuidedInput): number {
  const i = input.integrations;
  const named = [i.accounting, i.payments, i.calendar, i.email].filter(Boolean).length;
  const other = i.otherCount === null ? 1 : clampInt(i.otherCount, 0, 50) ?? 0;
  return named + other;
}

/**
 * Selections → drivers (work packages with low/base/high hours). Deterministic:
 * the same input always yields the same list in the same order.
 */
/**
 * Firm-size scale (owner decision 2026-09-20): the feature list sets the
 * shape of the build, and the size of the firm scales it. Each dimension adds
 * to a multiplier that starts at 1.0 for a one-site micro business.
 */
export function firmSizeScale(size: GuidedInput["size"]): { factor: number; reason: string } {
  const parts: string[] = [];
  let factor = 1;
  const sites = size.sites ?? 1;
  if (sites > 1) {
    const add = Math.min(sites - 1, 5) * 0.1;
    factor += add;
    parts.push(`${sites} sites`);
  }
  const staff = size.staffCount;
  if (staff !== null) {
    const add = staff > 50 ? 0.5 : staff > 15 ? 0.3 : staff > 5 ? 0.15 : 0;
    if (add) { factor += add; parts.push(`${staff} staff`); }
  }
  const customers = size.customersPerMonth;
  if (customers !== null) {
    const add = customers > 2000 ? 0.3 : customers > 300 ? 0.15 : 0;
    if (add) { factor += add; parts.push(`${customers.toLocaleString("en-GB")} customers a month`); }
  }
  const band = size.turnoverBand;
  const turnoverAdd = band === null ? 0 : TURNOVER_SCALE[band] ?? 0;
  if (turnoverAdd) { factor += turnoverAdd; parts.push(`turnover ${band}`); }
  factor = Math.min(Math.round(factor * 100) / 100, 2.2);
  return { factor, reason: parts.length ? `×${factor} for firm size (${parts.join(", ")})` : "×1 — one-site micro business" };
}

export function mapToDrivers(input: GuidedInput): GuidedDriver[] {
  const raw = mapToDriversUnscaled(input);
  const { factor } = firmSizeScale(input.size);
  if (factor === 1) return raw;
  return raw.map((d) =>
    d.id === "foundation" || d.id === "migration" || d.id.startsWith("integration") || FEATURES.some((f) => f.key === d.id)
      ? { ...d, hours: round(scale(d.hours, factor)) }
      : d
  );
}

function mapToDriversUnscaled(input: GuidedInput): GuidedDriver[] {
  const drivers: GuidedDriver[] = [];
  const features = selected(input);

  // 1. Discovery and design — grows with the number of features.
  drivers.push({
    id: "discovery",
    label: "Discovery and design",
    role: "Lead",
    hours: round(add(ALWAYS_ON.discovery.fixed, scale(ALWAYS_ON.discovery.perFeature, features.length))),
    reason: ALWAYS_ON.discovery.reason,
    uncertain: false,
  });

  // 2. Foundation — every build.
  drivers.push({
    id: "foundation",
    label: "Foundation: hosting, sign-in and data",
    role: "Engineer",
    hours: ALWAYS_ON.foundation.hours,
    reason: ALWAYS_ON.foundation.reason,
    uncertain: false,
  });

  // 3. One package per selected feature, plus per-unit hours above what is included.
  for (const f of features) {
    let hours = f.hours;
    let reason = f.reason;
    if (f.perUnit) {
      const qty = clampInt(input.quantities[f.key], 1, f.perUnit.max) ?? f.perUnit.included;
      const extra = Math.max(0, qty - f.perUnit.included);
      if (extra > 0) {
        hours = add(hours, scale(f.perUnit.hours, extra));
        reason = `${reason}; ${qty} ${f.perUnit.label}`;
      }
    }
    drivers.push({ id: f.key, label: f.label, role: f.role, hours, reason, uncertain: false });
  }

  // 4. Data migration — by record count, or a wide range when not known.
  if (input.migration.needed) {
    const count = clampInt(input.migration.recordCount, 0, 100_000_000);
    const from = input.migration.source.trim() ? ` from ${input.migration.source.trim()}` : "";
    if (count === null) {
      drivers.push({
        id: "migration",
        label: "Data migration",
        role: "Engineer",
        hours: MIGRATION_UNKNOWN,
        reason: `record count not yet confirmed${from} — wide range until it is`,
        uncertain: true,
      });
    } else {
      const band = MIGRATION_HOURS.find((b) => count <= b.upTo)!;
      drivers.push({
        id: "migration",
        label: "Data migration",
        role: "Engineer",
        hours: band.hours,
        reason: `${band.label}${from}: mapping, cleaning, import and a reconciliation check`,
        uncertain: false,
      });
    }
  }

  // 5. Integrations — one package per named system; "others" by count or wide.
  const i = input.integrations;
  for (const key of ["accounting", "payments", "calendar", "email"] as const) {
    if (!i[key]) continue;
    const def = INTEGRATION_HOURS[key];
    drivers.push({
      id: `integration_${key}`,
      label: `Integration: ${def.label}`,
      role: "Engineer",
      hours: def.hours,
      reason: "API connection, field mapping, sync rules and failure handling",
      uncertain: false,
    });
  }
  const otherNames = i.otherNames.trim();
  if (i.otherCount === null) {
    drivers.push({
      id: "integration_other",
      label: "Other integrations",
      role: "Engineer",
      hours: INTEGRATION_HOURS.otherUnknown.hours,
      reason: `number of systems not yet confirmed${otherNames ? ` (${otherNames})` : ""} — wide range until it is`,
      uncertain: true,
    });
  } else {
    const n = clampInt(i.otherCount, 0, 50) ?? 0;
    if (n > 0)
      drivers.push({
        id: "integration_other",
        label: `Other integrations (${n})`,
        role: "Engineer",
        hours: scale(INTEGRATION_HOURS.other.hours, n),
        reason: `${n} further system${n === 1 ? "" : "s"}${otherNames ? ` (${otherNames})` : ""}: connection, mapping and failure handling each`,
        uncertain: false,
      });
  }

  // 6. Constraints.
  if (input.constraints.sensitiveData)
    drivers.push({
      id: "security",
      label: "Security and compliance hardening",
      role: "Lead",
      hours: CONSTRAINTS.security.hours,
      reason: CONSTRAINTS.security.reason,
      uncertain: false,
    });
  if (input.constraints.clientOwnAccounts)
    drivers.push({
      id: "own_accounts",
      label: "Set up on the client's own accounts",
      role: "Lead",
      hours: CONSTRAINTS.ownAccounts.hours,
      reason: CONSTRAINTS.ownAccounts.reason,
      uncertain: false,
    });

  // 7. Testing, launch and handover — a share of everything above, with a floor.
  const subtotal = drivers.reduce((acc, d) => add(acc, d.hours), { low: 0, base: 0, high: 0 });
  drivers.push({
    id: "launch",
    label: "Testing, launch and handover",
    role: "Lead",
    hours: atLeast(round(scale(subtotal, ALWAYS_ON.launch.pct / 100)), ALWAYS_ON.launch.minHours),
    reason: ALWAYS_ON.launch.reason,
    uncertain: false,
  });

  // 8. Tight deadline — coordination overhead on the whole plan.
  if (input.constraints.urgency === "tight") {
    const all = drivers.reduce((acc, d) => add(acc, d.hours), { low: 0, base: 0, high: 0 });
    drivers.push({
      id: "tight_deadline",
      label: "Compressed timeline",
      role: "Lead",
      hours: round(scale(all, CONSTRAINTS.tightPct / 100)),
      reason: `fixed date with little room: ${CONSTRAINTS.tightPct}% for parallel work, daily coordination and rework risk`,
      uncertain: false,
    });
  }

  return drivers;
}

/** How many material counts are missing — each widens contingency and lowers confidence. */
function unknownCount(input: GuidedInput): number {
  let n = 0;
  if (input.migration.needed && input.migration.recordCount === null) n += 1;
  if (input.integrations.otherCount === null) n += 1;
  return n;
}

export function contingencyPctFor(input: GuidedInput): number {
  return (
    CONTINGENCY.basePct +
    unknownCount(input) * CONTINGENCY.perUnknownPct +
    (input.constraints.urgency === "tight" ? CONTINGENCY.tightPct : 0)
  );
}

/** Base-scenario labour cost in minor units, for the warranty reserve. */
function baseLabourMinor(drivers: readonly GuidedDriver[], policy: CommercialPolicy): number {
  return drivers.reduce((n, d) => {
    const rate = policy.roleRates.find((r) => r.id === ROLE_ID[d.role])?.loadedMinorPerHour ?? 0;
    return n + Math.round(d.hours.base * rate);
  }, 0);
}

export function warrantyReserveMinorFor(drivers: readonly GuidedDriver[], policy: CommercialPolicy): number {
  const raw = Math.ceil((baseLabourMinor(drivers, policy) * WARRANTY_PCT) / 100);
  return Math.ceil(raw / 1_000) * 1_000; // up to the next £10
}

const confidenceOf = (input: GuidedInput): "low" | "medium" | "high" => {
  const unknowns = unknownCount(input);
  const sizeKnown = input.size.staffCount !== null || input.size.customersPerMonth !== null;
  if (unknowns > 0 || !sizeKnown) return "low";
  if (input.features.length > 6 || input.constraints.urgency === "tight" || input.constraints.sensitiveData)
    return "medium";
  return "high";
};

/** Selections → the estimator's EstimateInput, priced under `policy`. */
export function mapToEstimate(
  input: GuidedInput,
  policy: CommercialPolicy = CURRENT_POLICY
): { estimateInput: EstimateInput; drivers: GuidedDriver[] } {
  const drivers = mapToDrivers(input);
  const confidence = confidenceOf(input);
  const packages: WorkPackage[] = drivers.map((d) => ({
    id: d.id,
    name: d.label,
    roleId: ROLE_ID[d.role],
    owner: d.role,
    hours: known(d.hours),
    externalCosts: money(0),
    assumptions: [d.reason],
    source: "Guided estimator",
    confidence: d.uncertain ? "low" : confidence,
  }));
  const estimateInput: EstimateInput = {
    id: "guided",
    currency: "GBP",
    policyId: policy.id,
    facts: [
      {
        key: "users",
        label: "Users and volumes",
        value: known(usersLine(input)),
        material: true,
      },
    ],
    packages,
    contractors: known(money(0)),
    attributableProjectCosts: known(money(0)),
    contingencyPct: contingencyPctFor(input),
    warrantyReserve: money(warrantyReserveMinorFor(drivers, policy)),
    build: {
      milestones: DEFAULT_MILESTONES,
      validityDays: policy.quoteValidityDays,
      exclusions: [],
      assumptions: drivers.map((d) => `${d.label}: ${d.reason}`),
      acceptanceCriteria: [],
    },
    selling: { listPrice: unknown("Not yet proposed"), discounts: [] },
    run: {
      route: "managed",
      stage: "recommendation",
      packageChoice: unknown("Package to be agreed after build acceptance"),
      costToServe: [],
      usageLimits: [],
    },
    grow: [],
    transact: {
      applicable: known(input.features.includes("payments") || input.features.includes("memberships")),
      feeBps: unknown("Not agreed"),
      processorFeesSeparate: true,
      volumeScenarios: [],
    },
  };
  return { estimateInput, drivers };
}

export const DEFAULT_MILESTONES = Object.freeze([
  { label: "Project commencement", pct: 50 },
  { label: "Agreed build milestone", pct: 25 },
  { label: "Before production handover", pct: 25 },
]) as readonly { label: string; pct: number }[];

/* ── Monthly (NSI v2) ───────────────────────────────────────────────────── */

const TRANSACTIONAL: readonly FeatureKey[] = ["booking", "payments", "memberships", "inventory", "quoting_invoicing"];
const OPERATIONAL: readonly FeatureKey[] = [
  "staff_dashboard",
  "customer_portal",
  "automated_messaging",
  "reporting",
  "documents_esign",
  "ai_assistant",
  "multi_location",
];

function platformRoleFor(input: GuidedInput): PlatformRole {
  const has = (keys: readonly FeatureKey[]) => keys.some((k) => input.features.includes(k));
  if (has(TRANSACTIONAL)) return "transaction_critical";
  if (has(OPERATIONAL)) return "operational";
  if (input.features.includes("crm") || input.features.includes("website")) return "lead_gen";
  return "informational";
}

/** Attributable monthly vendor cost (GBP): base hosting + per-feature + per-1,000 customers. */
export function vendorCostGbpFor(input: GuidedInput): number {
  const perFeature = selected(input).reduce((n, f) => n + f.vendorGbp, 0);
  const customers = clampInt(input.size.customersPerMonth, 0, 100_000_000) ?? 0;
  const usage = Math.ceil(customers / 1_000) * VENDOR_PER_1000_CUSTOMERS_GBP;
  return VENDOR_BASE_GBP + perFeature + usage;
}

/** Size and complexity → the NSI ScaleInput. `plan` is set per call by guidedEstimate. */
export function mapToScale(input: GuidedInput, plan: PlanId = "core"): ScaleInput {
  const has = (k: FeatureKey) => input.features.includes(k);
  const customerFacing = selected(input).some((f) => f.customerFacing);
  const staff = clampInt(input.size.staffCount, 0, 1_000_000);
  const customers = clampInt(input.size.customersPerMonth, 0, 100_000_000);
  const staffRoles = clampInt(input.quantities.staff_dashboard, 1, 12) ?? 1;
  const vendor = vendorCostGbpFor(input);
  return {
    ...EMPTY_SCALE_INPUT,
    plan,
    // Audience: the client's customers when they touch the system, else the team.
    monthlyActiveUsers: customerFacing ? (customers ?? staff) : (staff ?? customers),
    monthlySessions: null,
    platformRole: platformRoleFor(input),
    annualTurnoverGbp: input.size.turnoverBand ? TURNOVER_BAND_GBP[input.size.turnoverBand] : null,
    employeeCount: staff,
    directMonthlyVendorCostGbp: vendor,
    internalActiveUsers: staff,
    locationsOrUnits: clampInt(input.size.sites, 1, 100_000),
    riskFlags: {
      payments: has("payments") || has("booking") || has("memberships") || has("inventory"),
      authenticatedPii: has("customer_portal") || has("memberships") || has("crm") || input.constraints.sensitiveData,
      threePlusIntegrations: integrationCount(input) >= 3,
      operationalAi: has("ai_assistant"),
      complexAdminWorkflows: (has("staff_dashboard") && staffRoles >= 2) || (has("staff_dashboard") && has("quoting_invoicing")),
    },
    enterpriseFlags: {
      ...EMPTY_SCALE_INPUT.enterpriseFlags,
      highVendorCost: vendor >= 500,
    },
  };
}

function recommendPlan(input: GuidedInput): { plan: Exclude<PlanId, "enterprise">; reason: string } {
  const has = (k: FeatureKey) => input.features.includes(k);
  const sites = clampInt(input.size.sites, 1, 100_000) ?? 1;
  if (has("ai_assistant"))
    return { plan: "max", reason: "an AI assistant needs monitoring and prompt upkeep every month" };
  if (input.features.length >= 8 || (has("multi_location") && sites >= 3))
    return { plan: "max", reason: "a large system across several areas needs the most support time" };
  if (has("payments") || has("booking") || has("memberships") || has("customer_portal"))
    return { plan: "pro", reason: "customers rely on it directly, so it needs faster response and closer watch" };
  if (input.features.length >= 4)
    return { plan: "pro", reason: "several connected features need more support time than a single tool" };
  return { plan: "core", reason: "a small internal tool with light support needs" };
}

/* ── Result ─────────────────────────────────────────────────────────────── */

export type GuidedBuild = {
  /** Target price in each scenario — the range shown to the owner. */
  lowMinor: number;
  baseMinor: number;
  highMinor: number;
  /** Base-scenario target: the price to put on the quote. */
  recommendedMinor: number;
  /** Base-scenario floor at the policy's minimum margin. */
  floorMinor: number;
  marginPct: number;
  hours: HourRange;
  contingencyPct: number;
  warrantyReserveMinor: number;
  /** Target above the policy's review threshold — flagged, never capped. */
  reviewRequired: boolean;
  drivers: GuidedDriver[];
};

export type GuidedMonthly = {
  pricingVersion: string;
  nsi: number;
  band: ScaleBand | null;
  bandLabel: string;
  multiplier: number | null;
  /** Monthly prices in minor units; null when the NSI engine demands an Enterprise review. */
  coreMinor: number | null;
  proMinor: number | null;
  maxMinor: number | null;
  recommendedPlan: Exclude<PlanId, "enterprise">;
  recommendedMinor: number | null;
  reason: string;
  enterpriseReview: boolean;
  reviewFlags: string[];
};

export type GuidedResult = {
  build: GuidedBuild;
  monthly: GuidedMonthly;
  confidence: "low" | "medium" | "high";
  discoveryRecommended: boolean;
  notes: string[];
  /** Firm-size multiplier applied to the build drivers, with its reason. */
  sizeScale: { factor: number; reason: string };
  /** The exact inputs handed to the two engines, for audit and tests. */
  estimateInput: EstimateInput;
  estimateResult: EstimateResult;
  scaleInput: ScaleInput;
  scaleResults: Record<Exclude<PlanId, "enterprise">, ScaleResult>;
};

const toMinor = (gbp: number | null): number | null => (gbp === null ? null : Math.round(gbp * 100));

export function guidedEstimate(
  input: GuidedInput,
  policy: CommercialPolicy = CURRENT_POLICY
): GuidedResult {
  const { estimateInput, drivers } = mapToEstimate(input, policy);
  const estimateResult = calculateEstimate(estimateInput, policy);
  if (estimateResult.build.state !== "priced")
    // Every package has known hours and a loaded rate, so this cannot happen
    // unless the policy loses a role; fail loudly rather than show zero.
    throw new Error("guided estimate could not be priced: " + JSON.stringify(estimateResult.build.unknowns));
  const b = estimateResult.build;

  const scaleInput = mapToScale(input, "core");
  const scaleResults = {
    core: calculateScalePricing({ ...scaleInput, plan: "core" }, { pricingVersion: PRICING_VERSION }),
    pro: calculateScalePricing({ ...scaleInput, plan: "pro" }, { pricingVersion: PRICING_VERSION }),
    max: calculateScalePricing({ ...scaleInput, plan: "max" }, { pricingVersion: PRICING_VERSION }),
  };
  const nsi = scaleResults.core;
  const rec = recommendPlan(input);
  const monthly: GuidedMonthly = {
    pricingVersion: nsi.pricingVersion,
    nsi: nsi.nsi,
    band: nsi.scaleBand,
    bandLabel: nsi.scaleBand ? SCALE_BAND_LABEL[nsi.scaleBand] : "Enterprise review",
    multiplier: nsi.multiplier,
    coreMinor: toMinor(scaleResults.core.recommendedMrr),
    proMinor: toMinor(scaleResults.pro.recommendedMrr),
    maxMinor: toMinor(scaleResults.max.recommendedMrr),
    recommendedPlan: rec.plan,
    recommendedMinor: toMinor(scaleResults[rec.plan].recommendedMrr),
    reason: rec.reason,
    enterpriseReview: nsi.enterpriseReviewRequired,
    reviewFlags: nsi.reviewFlags,
  };

  const confidence = confidenceOf(input);
  const sizeScale = firmSizeScale(input.size);
  const notes: string[] = [];
  if (sizeScale.factor !== 1) notes.push(`Build hours scaled ${sizeScale.reason}.`);
  if (input.migration.needed && input.migration.recordCount === null)
    notes.push("Migration size is not known, so its range is wide and contingency is higher. Ask for a rough record count.");
  if (input.integrations.otherCount === null)
    notes.push("The number of other integrations is not known, so their range is wide. Name them to narrow it.");
  if (input.size.staffCount === null && input.size.customersPerMonth === null)
    notes.push("No company size given, so the monthly is priced at the smallest band. Add staff or customers a month.");
  if (input.constraints.sensitiveData)
    notes.push("Sensitive data: the monthly may need an Enterprise review if regulators or security questionnaires are involved.");
  if (monthly.enterpriseReview)
    notes.push("The NSI engine asks for a manual Enterprise review of the monthly; no automatic price is shown.");
  if (b.escalation.required)
    notes.push("The build is above the review threshold. It is not capped; a second person reviews it before issue.");
  const discoveryRecommended =
    confidence === "low" || estimateResult.discoveryRequired || b.scenarios.base.hours >= 250;
  if (discoveryRecommended)
    notes.push("Discovery is recommended before quoting a fixed price: the range is wide or the project is large.");

  return {
    build: {
      lowMinor: b.scenarios.low.targetMinor,
      baseMinor: b.scenarios.base.targetMinor,
      highMinor: b.scenarios.high.targetMinor,
      recommendedMinor: b.recommendedMinor,
      floorMinor: b.floorMinor,
      marginPct: policy.targetMarginPct,
      hours: { low: b.scenarios.low.hours, base: b.scenarios.base.hours, high: b.scenarios.high.hours },
      contingencyPct: estimateInput.contingencyPct,
      warrantyReserveMinor: estimateInput.warrantyReserve.minor,
      reviewRequired: b.escalation.required,
      drivers,
    },
    monthly,
    confidence,
    discoveryRecommended,
    notes,
    sizeScale,
    estimateInput,
    estimateResult,
    scaleInput,
    scaleResults,
  };
}

/* ── Text helpers (pure, shared by UI and server action) ────────────────── */

export const PLAN_LABEL: Record<Exclude<PlanId, "enterprise">, string> = { core: "Core", pro: "Pro", max: "Max" };

export function formatGbpMinor(minor: number | null | undefined): string {
  if (minor === null || minor === undefined) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(minor / 100));
}

/** "Users and volumes" for the brief — a known material fact for the estimator. */
export function usersLine(input: GuidedInput): string {
  const parts: string[] = [];
  if (input.size.staffCount !== null) parts.push(`${input.size.staffCount} staff`);
  if (input.size.sites !== null) parts.push(`${input.size.sites} site${input.size.sites === 1 ? "" : "s"}`);
  if (input.size.customersPerMonth !== null)
    parts.push(`about ${input.size.customersPerMonth.toLocaleString("en-GB")} customers a month`);
  if (input.size.turnoverBand) parts.push(`turnover ${TURNOVER_BAND_LABEL[input.size.turnoverBand]}`);
  return parts.length ? parts.join(", ") : "Company size not yet given";
}

/** Plain lines for scope.included — what the client gets, in their words. */
export function includedLines(input: GuidedInput): string[] {
  const out = selected(input).map((f) => {
    const qty = f.perUnit ? clampInt(input.quantities[f.key], 1, f.perUnit.max) : null;
    return qty && f.perUnit && qty > f.perUnit.included ? `${f.label} (${qty} ${f.perUnit.label})` : f.label;
  });
  if (input.migration.needed)
    out.push(
      input.migration.recordCount !== null
        ? `Data migration of about ${input.migration.recordCount.toLocaleString("en-GB")} records${input.migration.source.trim() ? ` from ${input.migration.source.trim()}` : ""}`
        : `Data migration${input.migration.source.trim() ? ` from ${input.migration.source.trim()}` : ""} (size to be confirmed)`
    );
  const i = input.integrations;
  const named = [
    i.accounting ? "accounting" : null,
    i.payments ? "payments provider" : null,
    i.calendar ? "calendar" : null,
    i.email ? "email platform" : null,
  ].filter((x): x is string => x !== null);
  if (i.otherCount === null) named.push(i.otherNames.trim() || "other systems (to be confirmed)");
  else if ((i.otherCount ?? 0) > 0) named.push(i.otherNames.trim() || `${i.otherCount} other system${i.otherCount === 1 ? "" : "s"}`);
  if (named.length) out.push(`Integrations: ${named.join(", ")}`);
  if (input.constraints.sensitiveData) out.push("Security and compliance hardening for sensitive data");
  if (input.constraints.clientOwnAccounts) out.push("Everything set up in the client's own accounts");
  return out;
}

export function constraintsLine(input: GuidedInput): string {
  const parts = [URGENCY_LABEL[input.constraints.urgency]];
  if (input.constraints.sensitiveData) parts.push("sensitive data");
  if (input.constraints.clientOwnAccounts) parts.push("client's own accounts");
  if (input.migration.needed && input.migration.recordCount === null) parts.push("migration size to be confirmed");
  if (input.integrations.otherCount === null) parts.push("integration count to be confirmed");
  return parts.join("; ");
}

/** A short project label for the quote, e.g. "Booking, payments and portal build". */
export function projectLabelFor(input: GuidedInput): string {
  const short: Partial<Record<FeatureKey, string>> = {
    booking: "booking",
    payments: "payments",
    customer_portal: "customer portal",
    staff_dashboard: "staff dashboard",
    quoting_invoicing: "quoting",
    crm: "CRM",
    automated_messaging: "messaging",
    reporting: "reporting",
    documents_esign: "e-signature",
    memberships: "memberships",
    inventory: "inventory",
    multi_location: "multi-site",
    ai_assistant: "AI assistant",
    website: "website",
  };
  const names = selected(input).map((f) => short[f.key] ?? f.label.toLowerCase()).slice(0, 3);
  if (names.length === 0) return "Bespoke system build";
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  const label = `${list.charAt(0).toUpperCase()}${list.slice(1)} build`;
  return input.features.length > 3 ? label.replace(" build", " and more — build") : label;
}

/** RUN statement for the quote: managed route, package after acceptance, plan indicative. */
export function runStateFor(result: GuidedResult): string {
  const m = result.monthly;
  const price = m.recommendedMinor === null ? "price on Enterprise review" : `${formatGbpMinor(m.recommendedMinor)} a month`;
  return `Managed route — package to be agreed after build acceptance. Indicative: ${PLAN_LABEL[m.recommendedPlan]} at ${price} (${m.bandLabel} band, NSI ${m.nsi}).`;
}

/**
 * Client-safe summary: what they get, the build guide price and range, the
 * monthly options. No hours, costs, rates, margins or internal notes.
 */
export function clientSummary(input: GuidedInput, result: GuidedResult): string {
  const name = input.client.name.trim() || "Your business";
  const lines: string[] = [];
  lines.push(`${name} — indicative estimate from Nullshift`);
  lines.push("");
  lines.push("What is included");
  for (const l of includedLines(input)) lines.push(`- ${l}`);
  if (includedLines(input).length === 0) lines.push("- To be agreed");
  lines.push("");
  lines.push(
    `Build (one-off): guide price ${formatGbpMinor(result.build.recommendedMinor)}, expected range ${formatGbpMinor(result.build.lowMinor)} to ${formatGbpMinor(result.build.highMinor)}.`
  );
  const m = result.monthly;
  if (m.coreMinor !== null && m.proMinor !== null && m.maxMinor !== null) {
    lines.push(
      `Monthly (run and support): Core ${formatGbpMinor(m.coreMinor)}, Pro ${formatGbpMinor(m.proMinor)}, Max ${formatGbpMinor(m.maxMinor)} a month. We suggest ${PLAN_LABEL[m.recommendedPlan]}: ${m.reason}.`
    );
  } else {
    lines.push("Monthly (run and support): to be confirmed after a short review of your set-up.");
  }
  lines.push("");
  lines.push(
    result.discoveryRecommended
      ? "This is an early guide. A short discovery session will narrow the range before we fix the price."
      : "This is a guide, not a fixed quote. A fixed price follows once scope is confirmed."
  );
  lines.push("Prices exclude VAT. You own the code, data and every account.");
  return lines.join("\n");
}

/* ── Validation (pure; the server action calls it before saving) ───────── */

const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0;
const isIntOrNull = (v: unknown): v is number | null | undefined => v === null || v === undefined || isInt(v);

/** Returns a normalised GuidedInput or a list of problems. Never throws. */
export function parseGuidedInput(raw: unknown): { ok: true; value: GuidedInput } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const r = (raw ?? {}) as Record<string, Record<string, unknown>> & { features?: unknown };
  const client = r.client ?? {};
  const size = r.size ?? {};
  const migration = r.migration ?? {};
  const integrations = r.integrations ?? {};
  const constraints = r.constraints ?? {};
  const quantitiesRaw = (r.quantities ?? {}) as Record<string, unknown>;

  const name = typeof client.name === "string" ? client.name.trim() : "";
  if (!name) errors.push("Client or prospect name is required.");
  const tenantId = typeof client.tenantId === "string" && client.tenantId ? client.tenantId : null;
  const sector = typeof client.sector === "string" ? client.sector.trim().slice(0, 80) : "";

  for (const k of ["staffCount", "sites", "customersPerMonth"] as const)
    if (!isIntOrNull(size[k])) errors.push(`${k} must be a whole number or blank.`);
  const turnoverBand = TURNOVER_BANDS.includes(size.turnoverBand as TurnoverBand)
    ? (size.turnoverBand as TurnoverBand)
    : null;

  const features = Array.isArray(r.features)
    ? FEATURE_KEYS.filter((k) => (r.features as unknown[]).includes(k))
    : [];
  const quantities: Partial<Record<FeatureKey, number>> = {};
  for (const k of FEATURE_KEYS) {
    const q = quantitiesRaw[k];
    if (q === undefined || q === null) continue;
    if (!isInt(q)) errors.push(`Quantity for ${k} must be a whole number.`);
    else quantities[k] = q;
  }

  if (!isIntOrNull(migration.recordCount)) errors.push("Migration record count must be a whole number or blank.");
  if (!isIntOrNull(integrations.otherCount)) errors.push("Other integration count must be a whole number or blank.");
  const urgency = (["flexible", "normal", "tight"] as const).includes(constraints.urgency as Urgency)
    ? (constraints.urgency as Urgency)
    : "normal";

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      client: { tenantId, name, sector },
      size: {
        staffCount: (size.staffCount as number | null | undefined) ?? null,
        sites: (size.sites as number | null | undefined) ?? null,
        customersPerMonth: (size.customersPerMonth as number | null | undefined) ?? null,
        turnoverBand,
      },
      features,
      quantities,
      migration: {
        needed: migration.needed === true,
        recordCount: (migration.recordCount as number | null | undefined) ?? null,
        source: typeof migration.source === "string" ? migration.source.trim().slice(0, 120) : "",
      },
      integrations: {
        accounting: integrations.accounting === true,
        payments: integrations.payments === true,
        calendar: integrations.calendar === true,
        email: integrations.email === true,
        otherCount: (integrations.otherCount as number | null | undefined) ?? null,
        otherNames: typeof integrations.otherNames === "string" ? integrations.otherNames.trim().slice(0, 200) : "",
      },
      constraints: {
        urgency,
        sensitiveData: constraints.sensitiveData === true,
        clientOwnAccounts: constraints.clientOwnAccounts === true,
      },
    },
  };
}
