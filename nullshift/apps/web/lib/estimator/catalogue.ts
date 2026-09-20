/**
 * Candidate catalogue (brief §6.5).
 *
 * PUBLISHED (owner decision, 20 Sep 2026): the three managed tiers — Core,
 * Pro and Max — at the NSI_v2 from-prices (£149 / £249 / £399 per month,
 * scaled by the client's band). Everything else remains `state: "draft"` and
 * `chargeable: false`; a UI that lists those must label them as draft
 * suggestions. A "from" amount is a small-catalogue minimum, not a guarantee
 * that every request of that type costs that amount.
 *
 * The £600 independent handover is a confirmed commercial decision and is kept
 * separate (HANDOVER_FEE). Its tax basis is decided — invoiced inclusive, no
 * VAT line — while payment timing and scope are pending, so it still cannot be
 * issued.
 */
import { RUN_PACKAGE_BASE_MINOR } from "./policy";

export type CatalogueBasis =
  | "one_off"
  | "recurring"
  | "usage"
  | "recurring_plus_usage"
  | "percentage"
  | "custom";
export type CatalogueFamily = "build" | "run" | "grow" | "transact";
export type CatalogueState = "draft" | "published";

export type CatalogueItem = {
  readonly id: string;
  readonly name: string;
  readonly family: CatalogueFamily;
  readonly basis: CatalogueBasis;
  /** Minor units. Null when custom-quoted. */
  readonly fromMinor: number | null;
  /** Upper bound of a stated range; null when "from" only or custom. */
  readonly toMinor: number | null;
  readonly currency: "GBP";
  readonly state: CatalogueState;
  /** True only for a published item — a draft can never back an offer. */
  readonly chargeable: boolean;
  readonly version: string;
  readonly effectiveDate: string;
  readonly scope: string;
  readonly note?: string;
};

const CATALOGUE_VERSION = "CATALOGUE_2026_09_DRAFT";
const EFFECTIVE = "2026-09-17";
/** The published managed tiers carry their own version and date. */
export const CATALOGUE_PUBLISHED_VERSION = "CATALOGUE_2026_09_v1";
export const CATALOGUE_PUBLISHED_EFFECTIVE = "2026-09-20";

const item = (
  id: string,
  name: string,
  family: CatalogueFamily,
  basis: CatalogueBasis,
  fromMinor: number | null,
  toMinor: number | null,
  scope: string,
  note?: string
): CatalogueItem =>
  Object.freeze({
    id,
    name,
    family,
    basis,
    fromMinor,
    toMinor,
    currency: "GBP",
    state: "draft",
    chargeable: false,
    version: CATALOGUE_VERSION,
    effectiveDate: EFFECTIVE,
    scope,
    ...(note ? { note } : {}),
  });

/** A published, chargeable item: the three managed tiers only. */
const published = (
  id: string,
  name: string,
  family: CatalogueFamily,
  basis: CatalogueBasis,
  fromMinor: number,
  scope: string,
  note?: string
): CatalogueItem =>
  Object.freeze({
    id,
    name,
    family,
    basis,
    fromMinor,
    toMinor: null,
    currency: "GBP",
    state: "published",
    chargeable: true,
    version: CATALOGUE_PUBLISHED_VERSION,
    effectiveDate: CATALOGUE_PUBLISHED_EFFECTIVE,
    scope,
    ...(note ? { note } : {}),
  });

/** §6.5 rows. Three published tiers; the rest are draft suggestions. No near-duplicate products (one launch family, one video pack). */
export const CATALOGUE: readonly CatalogueItem[] = Object.freeze([
  item(
    "paid-discovery",
    "Paid Discovery",
    "build",
    "one_off",
    35_000,
    75_000,
    "Scoping, workflow mapping and a reviewed estimate before a fixed Build price"
  ),
  published(
    "managed-core",
    "Managed Core",
    "run",
    "recurring",
    RUN_PACKAGE_BASE_MINOR.core,
    "Hosting stewardship, backups, monitoring, routine maintenance, covered defects and support",
    "From-price for the Standard band; the client's NSI band scales it. Feature/design work is Quoted"
  ),
  published(
    "managed-pro",
    "Managed Pro",
    "run",
    "recurring",
    RUN_PACKAGE_BASE_MINOR.pro,
    "Core plus transactional email infrastructure, payment-integration maintenance, proactive health checks and priority support",
    "From-price for the Standard band; the client's NSI band scales it. Feature/design work is Quoted"
  ),
  published(
    "managed-max",
    "Managed Max",
    "run",
    "recurring",
    RUN_PACKAGE_BASE_MINOR.max,
    "Highest incident priority, direct priority support, platform reviews, priority development queue",
    "From-price for the Standard band; the client's NSI band scales it. Initial response is not a resolution guarantee"
  ),
  item(
    "small-platform-change",
    "Small platform change",
    "grow",
    "one_off",
    12_500,
    null,
    "Small configuration or behaviour change with no new workflow"
  ),
  item(
    "ui-design-change",
    "UI / design change",
    "grow",
    "one_off",
    15_000,
    null,
    "Visual or layout change within existing screens"
  ),
  item(
    "small-feature",
    "Small feature",
    "grow",
    "one_off",
    25_000,
    null,
    "One contained feature inside an existing module"
  ),
  item(
    "substantial-feature",
    "Substantial feature",
    "grow",
    "one_off",
    50_000,
    null,
    "Feature spanning several screens or roles"
  ),
  item(
    "new-module",
    "New module / workflow",
    "grow",
    "one_off",
    75_000,
    null,
    "A new end-to-end workflow or module"
  ),
  item(
    "major-extension",
    "Major extension",
    "grow",
    "custom",
    null,
    null,
    "Custom quote through the full estimator"
  ),
  item(
    "third-party-integration",
    "Third-party integration",
    "grow",
    "one_off",
    40_000,
    null,
    "One external system connected and tested"
  ),
  item(
    "automated-email-workflow",
    "Automated email / workflow",
    "grow",
    "one_off",
    17_500,
    null,
    "One automated message or workflow rule"
  ),
  item(
    "reporting-dashboard",
    "Reporting / dashboard",
    "grow",
    "one_off",
    35_000,
    null,
    "One report or dashboard against existing data"
  ),
  item(
    "data-import-migration",
    "Data import / migration",
    "grow",
    "one_off",
    25_000,
    null,
    "Import of a checked dataset; volume and quality assessed first"
  ),
  item(
    "admin-onboarding",
    "Admin onboarding",
    "grow",
    "one_off",
    19_500,
    null,
    "Onboarding session for the client's administrators"
  ),
  item(
    "team-training",
    "Team training",
    "grow",
    "one_off",
    29_500,
    null,
    "Training session for the wider team"
  ),
  item(
    "explainer-video",
    "Branded explainer video",
    "grow",
    "one_off",
    9_500,
    null,
    "One branded walkthrough video"
  ),
  item(
    "video-pack-five",
    "Five-video pack",
    "grow",
    "one_off",
    39_500,
    null,
    "Five branded walkthrough videos only — no documentation or launch copy",
    "Distinct from the Platform Launch Pack, which adds copy, voiceover, revision round and help documentation"
  ),
  item(
    "platform-launch-pack",
    "Platform Launch Pack",
    "grow",
    "one_off",
    49_500,
    null,
    "Up to five branded walkthrough videos, script/copy, AI voiceover, branded screen demonstrations, final exports, one defined revision round and basic launch/help documentation"
  ),
  item(
    "launch-pack-plus",
    "Launch Pack Plus",
    "grow",
    "one_off",
    79_500,
    null,
    "Platform Launch Pack plus additional deliverables to be approved",
    "Exact additional deliverables to approve; consolidates the former 'full launch/adoption pack'"
  ),
  item(
    "additional-location",
    "Additional location / business unit setup",
    "grow",
    "one_off",
    50_000,
    null,
    "Setup of one further location or business unit"
  ),
  item(
    "white-label-rollout",
    "White-label / custom-brand rollout",
    "grow",
    "one_off",
    75_000,
    null,
    "A separately branded deployment of the same platform"
  ),
  item(
    "ai-assistant",
    "AI Assistant",
    "grow",
    "recurring_plus_usage",
    9_900,
    null,
    "Assistant feature, monthly plus metered usage"
  ),
  item(
    "ai-automation",
    "AI Automation",
    "grow",
    "recurring_plus_usage",
    14_900,
    null,
    "Automation feature, monthly plus metered usage"
  ),
  item(
    "custom-ai-workflow-setup",
    "Custom AI Workflow setup",
    "grow",
    "one_off",
    50_000,
    null,
    "Design and setup of a bespoke AI workflow"
  ),
  item(
    "extra-venue",
    "Extra venue",
    "run",
    "recurring",
    5_000,
    null,
    "Illustrative monthly uplift for one more venue"
  ),
  item(
    "extra-brand-or-unit",
    "Extra brand or business unit",
    "run",
    "recurring",
    7_500,
    null,
    "Illustrative monthly uplift for one more brand or unit"
  ),
  item(
    "extra-production-environment",
    "Extra production environment",
    "run",
    "recurring",
    10_000,
    null,
    "Illustrative monthly uplift for one more production environment"
  ),
  item(
    "complex-integration-management",
    "Complex integration management",
    "run",
    "recurring",
    5_000,
    15_000,
    "Illustrative monthly uplift for managing a complex third-party integration"
  ),
  item(
    "application-fee",
    "Application fee",
    "transact",
    "percentage",
    150,
    null,
    "Discussion default around 1.5% (150 bps); processor fees are separate and never derived from this",
    "Basis points, not minor units. Separately agreed per client; never applied by default"
  ),
]);

export const catalogueById = (id: string): CatalogueItem | undefined =>
  CATALOGUE.find((c) => c.id === id);

/**
 * How a one-off fee is invoiced for tax. "inclusive_no_vat": the figure is
 * the whole amount — one line, no VAT added on top and no VAT line shown.
 */
export type HandoverTaxBasis = "pending" | "inclusive_no_vat";

/**
 * Independent handover: £600 confirmed by the owner as a commercial decision.
 * Tax basis decided 20 Sep 2026 — invoiced inclusive with no VAT line
 * (decision 18.3). Payment timing and scope are still pending, so it remains
 * blocked from issuance (brief §6.5).
 */
export const HANDOVER_FEE = Object.freeze({
  id: "independent-handover",
  name: "Independent handover",
  minor: 60_000,
  currency: "GBP" as const,
  decision: "confirmed" as const,
  taxBasis: "inclusive_no_vat" as HandoverTaxBasis,
  paymentTiming: "pending" as const,
  scope: "pending" as const,
  issuable: false as const,
  note: "Kept separate from the add-on catalogue; invoiced as one inclusive figure with no VAT line — payment timing and scope still to confirm",
});

export const basisLabel = (basis: CatalogueBasis): string =>
  ({
    one_off: "one-off",
    recurring: "recurring, per month",
    usage: "usage-based",
    recurring_plus_usage: "recurring, per month, plus usage",
    percentage: "percentage of transaction value",
    custom: "custom quote",
  })[basis];
