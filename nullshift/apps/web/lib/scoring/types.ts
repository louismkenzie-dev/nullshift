import type { ScaleInput } from "@/lib/pricing/nsi";

/**
 * Auto-scoring — the evidence a built system gives up about itself.
 *
 * Two collectors read a client's system: the repository (dependencies,
 * integrations, routes, roles, scheduled jobs) and the production database
 * (active users, tables, PII, payments, staff, locations). Their findings are
 * pure data; lib/scoring/derive.ts turns them into Scale Index inputs and says
 * which fields still need a person. Everything here is serialisable — it is
 * stored verbatim on scale_evidence.
 */

export type IntegrationCategory =
  | "payments"
  | "auth"
  | "database"
  | "email"
  | "ai"
  | "sms"
  | "maps"
  | "analytics"
  | "monitoring"
  | "storage"
  | "calendar"
  | "accounting"
  | "cms"
  | "search"
  | "automation";

export type IntegrationHit = {
  /** Stable id, e.g. "stripe". */
  key: string;
  label: string;
  category: IntegrationCategory;
  /** Where it was seen: "pkg:stripe", "fn:payments-webhook", "path:src/lib/stripe.ts". */
  via: string[];
};

export type RepoEvidence = {
  fullName: string;
  defaultBranch: string | null;
  framework: string | null;
  language: string | null;
  sizeKb: number | null;
  pushedAt: string | null;
  /** Unique runtime dependency names across every package.json found. */
  dependencyCount: number;
  devDependencyCount: number;
  dependencies: string[];
  packageJsonPaths: string[];
  integrations: IntegrationHit[];
  hasAuth: boolean;
  hasRoleModel: boolean;
  routeCount: number;
  adminRouteCount: number;
  edgeFunctionCount: number;
  migrationCount: number;
  scheduledJobs: number;
  hasTests: boolean;
  hasCi: boolean;
  /** The recursive tree listing was cut off by the API — counts are a floor. */
  treeTruncated: boolean;
};

export type DbTable = { name: string; rows: number | null; columns: string[] };

export type DatabaseEvidence = {
  ref: string;
  usersTotal: number;
  /** Users who signed in during the last 30 days. */
  mau30: number;
  newUsers30: number;
  publicTables: number;
  dbSizeMb: number | null;
  cronJobs: number;
  storageBuckets: number;
  extensions: string[];
  roleModel: {
    /** Where roles live: "user_roles.role" / "profiles.role" / "staff" — null when none. */
    source: string | null;
    staffTotal: number | null;
    staffActive30: number | null;
  };
  locations: { table: string; count: number } | null;
  piiColumns: number;
  specialCategoryColumns: number;
  paymentTables: { name: string; rows: number | null }[];
  operationalTables: { name: string; rows: number | null }[];
  leadTables: { name: string; rows: number | null }[];
  /** Tables carrying a status column — a proxy for multi-stage workflows. */
  statusTables: number;
};

export type SourceOutcome = { ok: boolean; ref: string | null; error: string | null };

export type Evidence = {
  collectedAt: string;
  repo: RepoEvidence | null;
  database: DatabaseEvidence | null;
  sources: { repo: SourceOutcome; database: SourceOutcome };
};

/** auto: read off the system. estimated: proposed, a person confirms. human: only a person knows. */
export type FieldState = "auto" | "estimated" | "human";

export type FieldKey =
  | "monthlyActiveUsers"
  | "monthlySessions"
  | "platformRole"
  | "annualTurnoverGbp"
  | "employeeCount"
  | "directMonthlyVendorCostGbp"
  | "internalActiveUsers"
  | "locationsOrUnits"
  | `risk.${keyof ScaleInput["riskFlags"]}`
  | `enterprise.${keyof ScaleInput["enterpriseFlags"]}`;

export type FieldStates = Partial<Record<FieldKey, FieldState>>;

export type VendorCostLine = { item: string; monthlyGbp: number; basis: string };

export type Derivation = {
  inputs: ScaleInput;
  fieldStates: FieldStates;
  /** Plain-English evidence lines shown next to the score. */
  notes: string[];
  vendorCost: VendorCostLine[];
};

export const FIELD_LABEL: Record<FieldKey, string> = {
  monthlyActiveUsers: "Monthly active users",
  monthlySessions: "Monthly sessions",
  platformRole: "Platform role",
  annualTurnoverGbp: "Annual turnover",
  employeeCount: "Employees",
  directMonthlyVendorCostGbp: "Vendor cost / month",
  internalActiveUsers: "Internal users",
  locationsOrUnits: "Locations / units",
  "risk.payments": "Takes payments",
  "risk.authenticatedPii": "Auth + PII",
  "risk.threePlusIntegrations": "3+ integrations",
  "risk.operationalAi": "Operational AI",
  "risk.complexAdminWorkflows": "Complex admin workflows",
  "enterprise.highMau": "100k+ MAU",
  "enterprise.highVendorCost": "£500+ vendor cost",
  "enterprise.specialSla": "Special SLA",
  "enterprise.regulatedSecurity": "Regulated / security review",
  "enterprise.multiEntity": "Multi-entity",
  "enterprise.reservedCapacity": "Reserved capacity",
  "enterprise.exceptionalExposure": "Exceptional exposure",
};
