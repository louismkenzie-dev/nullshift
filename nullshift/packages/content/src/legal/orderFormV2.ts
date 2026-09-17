/**
 * Order Form v2 — the versioned representation the brief asks for (§3.3 #1,
 * §8.1, §9 item 2), added ALONGSIDE the v1 `OrderForm` in ./acceptance.ts,
 * which is untouched and still governs every existing signed form.
 *
 * What v2 changes: the Order Form elects a service route (Managed by
 * Nullshift | Independent handover | unresolved) and records the contractual
 * billing-start arrangement; it does NOT require a plan or a monthly fee.
 * "Managed selected, tier pending" is a first-class, valid state. The package,
 * exact price, currency, cadence, start and terms are a separately accepted
 * service schedule (brief §2.1 "Consent matters"), and the £600 independent
 * handover fee is a separately accepted handover schedule.
 *
 * Nothing here is an approved price list. Any package referenced from a v2
 * form carries `catalogueStatus: "draft_sandbox"` until decision 18.1; the
 * handover fee's tax basis is "pending" until decision 18.3 (brief §6.5).
 *
 * Money: integer minor units with an explicit currency. Pure types + pure
 * validation; no I/O.
 */

import type { OrderForm } from "./acceptance";

export const ORDER_FORM_V2_VERSION = "v2" as const;

export type ServiceRouteElection = "managed" | "independent" | "unresolved";
export type BillingStartArrangementV2 =
  | "exact_date"
  | "conditional_wording"
  | "unresolved";
export type TaxBasisV2 = "pending" | "standard_vat" | "exempt" | "zero_rated";
export type CadenceV2 = "monthly" | "quarterly" | "annual";
export type ApplicationFeeDisposition = "pending" | "continue" | "stop";

export type MoneyV2 = { amountMinor: number; currency: string };

/** A managed package as referenced on a v2 form — optional, and never a price commitment on its own. */
export type OrderFormV2Package = {
  code: string;
  label: string;
  /** Draft catalogue origin (brief §6.5). Always sandbox until 18.1 is decided. */
  catalogueStatus: "draft_sandbox";
  catalogueRef?: string;
  amount?: MoneyV2;
  cadence?: CadenceV2;
  taxBasis?: TaxBasisV2;
};

export type BuildMilestoneV2 = {
  label: string;
  /** Exactly one of pct / amount. Percent of the build price, or an exact amount. */
  pct?: number;
  amount?: MoneyV2;
  /** What triggers the invoice — a delivery event, never "on signature by default". */
  trigger: string;
};

export type BuildTermsV2 = {
  price: MoneyV2;
  taxBasis: TaxBasisV2;
  milestones: BuildMilestoneV2[];
  /** Warranty is per governing agreement (18.6 open) — recorded as wording ref, not assumed. */
  warrantyRef?: string;
};

export type ManagedElectionV2 = {
  /** The client may defer the package until after build acceptance (§2.1). */
  packageSelection: "deferred" | "selected";
  package?: OrderFormV2Package;
  /** How the later schedule will be accepted — always a separate document. */
  scheduleAcceptance: "separate_service_schedule";
  billingStart: {
    arrangement: BillingStartArrangementV2;
    /** YYYY-MM-DD; required with exact_date. */
    date?: string;
    /** Approved (solicitor-reviewed) wording reference; required with conditional_wording. */
    approvedWordingRef?: string;
  };
};

export type IndependentElectionV2 = {
  /** The £600 decision (brief §2.1). Recorded here as elected; accepted on the handover schedule. */
  handoverFee: MoneyV2;
  taxBasis: TaxBasisV2;
  includedWork: string[];
  dependencies: string[];
  /** Who pays which third-party service after handover. Third-party services are not free. */
  costResponsibility: Record<string, string>;
  /** No ongoing Nullshift management service. Fixed. */
  ongoingManagement: "none";
  /** Stripe Connect application fee after handover (decision 18.4). */
  applicationFeeDisposition: ApplicationFeeDisposition;
};

export type ServiceArrangementReference = {
  /** The service_arrangements row this form's election is (or will be) recorded on. */
  arrangementId?: string;
  election: ServiceRouteElection;
  managed?: ManagedElectionV2;
  independent?: IndependentElectionV2;
};

/**
 * The v2 Order Form. Client identity, scope, technical, compliance and
 * portfolio fields are the same shape as v1 (reused by type, not by copy)
 * so the existing blocker checks in ./acceptance.ts can run on them.
 */
export type OrderFormV2 = Pick<
  OrderForm,
  | "id"
  | "client"
  | "scope"
  | "technical"
  | "compliance"
  | "portfolioUse"
  | "applicableScheduleVersions"
> & {
  commercialVersion: typeof ORDER_FORM_V2_VERSION;
  templateVersion: string;
  /** The quote version that produced the build price, for explainability. */
  quoteVersionRef?: string;
  build: BuildTermsV2;
  serviceRoute: ServiceArrangementReference;
  applicationFee?: { enabled: boolean; percent?: number };
  /** Legal entity + authorised signatory as at drafting (§8.1). */
  signatory?: { name: string; title: string; email: string };
};

export const isOrderFormV2 = (
  form: { commercialVersion?: string } | null | undefined
): form is OrderFormV2 => !!form && form.commercialVersion === ORDER_FORM_V2_VERSION;

export type OrderFormV2Blocker = {
  code:
    | "ROUTE_UNRESOLVED"
    | "MANAGED_ELECTION_MISSING"
    | "INDEPENDENT_ELECTION_MISSING"
    | "PACKAGE_AMOUNT_INEXACT"
    | "BILLING_START_DATE_REQUIRED"
    | "BILLING_START_WORDING_REQUIRED"
    | "HANDOVER_FEE_DEVIATES"
    | "HANDOVER_TAX_BASIS_PENDING"
    | "APPLICATION_FEE_DISPOSITION_PENDING"
    | "BUILD_PRICE_INVALID"
    | "MILESTONES_INCOMPLETE"
    | "SIGNATORY_REQUIRED";
  /** Blocks issue to the client outright, or is a warning to show staff. */
  blocksIssue: boolean;
  detail: string;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CURRENCY_RE = /^[A-Z]{3}$/;
const validMoney = (m: MoneyV2 | undefined): m is MoneyV2 =>
  !!m &&
  Number.isInteger(m.amountMinor) &&
  m.amountMinor >= 0 &&
  CURRENCY_RE.test(m.currency);

/** The £600 decision; a v2 form that elects independent with a different fee is flagged. */
export const HANDOVER_FEE_V2: MoneyV2 = { amountMinor: 60000, currency: "GBP" };

/**
 * Why this v2 form cannot be issued (or what staff must see before it is).
 * Returns every reason, not the first. "Managed, tier pending, billing start
 * unresolved" produces NO blocker: it is a valid contract state.
 */
export function orderFormV2Blockers(form: OrderFormV2): OrderFormV2Blocker[] {
  const b: OrderFormV2Blocker[] = [];
  const { build, serviceRoute } = form;

  if (!validMoney(build?.price))
    b.push({
      code: "BUILD_PRICE_INVALID",
      blocksIssue: true,
      detail:
        "The build price must be a whole number of minor units with an ISO currency.",
    });
  const pctTotal = (build?.milestones ?? []).reduce((sum, m) => sum + (m.pct ?? 0), 0);
  const amountTotal = (build?.milestones ?? []).reduce(
    (sum, m) => sum + (m.amount?.amountMinor ?? 0),
    0
  );
  const milestonesOk =
    (build?.milestones?.length ?? 0) > 0 &&
    build.milestones.every(
      (m) => m.trigger?.trim() && (m.pct !== undefined) !== (m.amount !== undefined)
    ) &&
    (pctTotal === 100 ||
      (pctTotal === 0 &&
        validMoney(build.price) &&
        amountTotal === build.price.amountMinor));
  if (!milestonesOk)
    b.push({
      code: "MILESTONES_INCOMPLETE",
      blocksIssue: true,
      detail:
        "Billing milestones must each have a trigger and either a percentage (summing to 100) or exact amounts (summing to the build price).",
    });

  if (!form.signatory?.name?.trim() || !form.signatory?.email?.trim())
    b.push({
      code: "SIGNATORY_REQUIRED",
      blocksIssue: true,
      detail: "Record the client's authorised signatory (§8.1).",
    });

  switch (serviceRoute?.election) {
    case "managed": {
      const m = serviceRoute.managed;
      if (!m) {
        b.push({
          code: "MANAGED_ELECTION_MISSING",
          blocksIssue: true,
          detail:
            "The Managed election must record how the service schedule will be accepted and the billing-start arrangement.",
        });
        break;
      }
      if (m.packageSelection === "selected") {
        const p = m.package;
        if (
          !p ||
          !validMoney(p.amount) ||
          !p.cadence ||
          !p.taxBasis ||
          p.taxBasis === "pending"
        )
          b.push({
            code: "PACKAGE_AMOUNT_INEXACT",
            blocksIssue: true,
            detail:
              "A selected package must state exact amount, currency, cadence and an approved tax basis — or defer the selection to the service schedule.",
          });
      }
      if (
        m.billingStart.arrangement === "exact_date" &&
        !(m.billingStart.date && DATE_RE.test(m.billingStart.date))
      )
        b.push({
          code: "BILLING_START_DATE_REQUIRED",
          blocksIssue: true,
          detail: "An exact-date billing start needs the date.",
        });
      if (
        m.billingStart.arrangement === "conditional_wording" &&
        !m.billingStart.approvedWordingRef?.trim()
      )
        b.push({
          code: "BILLING_START_WORDING_REQUIRED",
          blocksIssue: true,
          detail:
            "Conditional billing-start wording must reference approved wording; no date is invented.",
        });
      break;
    }
    case "independent": {
      const i = serviceRoute.independent;
      if (!i) {
        b.push({
          code: "INDEPENDENT_ELECTION_MISSING",
          blocksIssue: true,
          detail:
            "The Independent election must record the handover fee, included work, dependencies and cost responsibility.",
        });
        break;
      }
      if (
        !validMoney(i.handoverFee) ||
        i.handoverFee.amountMinor !== HANDOVER_FEE_V2.amountMinor ||
        i.handoverFee.currency !== HANDOVER_FEE_V2.currency
      )
        b.push({
          code: "HANDOVER_FEE_DEVIATES",
          blocksIssue: false,
          detail:
            "The handover fee differs from the confirmed £600 decision; an approved policy is needed for other scenarios (§8.5).",
        });
      if (i.taxBasis === "pending")
        b.push({
          code: "HANDOVER_TAX_BASIS_PENDING",
          blocksIssue: true,
          detail:
            "The £600 tax basis is pending decision 18.3; the form cannot be issued with it unresolved.",
        });
      if (form.applicationFee?.enabled && i.applicationFeeDisposition === "pending")
        b.push({
          code: "APPLICATION_FEE_DISPOSITION_PENDING",
          blocksIssue: true,
          detail:
            "An application fee is agreed but its disposition after handover is unresolved; 'no ongoing Nullshift charges' would conflict with a retained fee (§8.1).",
        });
      break;
    }
    default:
      b.push({
        code: "ROUTE_UNRESOLVED",
        blocksIssue: true,
        detail:
          "The client must choose Managed by Nullshift or Independent handover before the form is issued (§2.1).",
      });
  }
  return b;
}

export const canIssueOrderFormV2 = (form: OrderFormV2): boolean =>
  !orderFormV2Blockers(form).some((x) => x.blocksIssue);

/**
 * The commercial content to freeze at issue/acceptance (what the snapshot
 * hash covers). Excludes nothing the client saw; includes nothing internal.
 */
export function orderFormV2CommercialContent(form: OrderFormV2): {
  commercialVersion: "v2";
  templateVersion: string;
  client: OrderForm["client"];
  scope: OrderForm["scope"];
  build: BuildTermsV2;
  serviceRoute: ServiceArrangementReference;
  applicationFee: { enabled: boolean; percent?: number } | null;
  applicableScheduleVersions: Record<string, string>;
} {
  return {
    commercialVersion: form.commercialVersion,
    templateVersion: form.templateVersion,
    client: form.client,
    scope: form.scope,
    build: form.build,
    serviceRoute: form.serviceRoute,
    applicationFee: form.applicationFee ?? null,
    applicableScheduleVersions: form.applicableScheduleVersions,
  };
}
