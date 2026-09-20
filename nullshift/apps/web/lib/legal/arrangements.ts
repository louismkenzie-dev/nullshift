/**
 * Service arrangements, service schedules and handover schedules — the pure
 * state machines behind migration 0059 (brief §2.1, §3.3 #1, §8.1, §8.3,
 * §8.4, §9, §17.1 rows 1, 4, 6, 7, 8).
 *
 * No I/O. Every rule the server actions, the database constraints and the
 * tests share is defined once here:
 *
 *  - Selecting the Managed route is not consent to an amount. An arrangement
 *    with route 'managed' and package_state 'pending' is a valid contract
 *    state with no price, no plan and no subscription.
 *  - A schedule is chargeable only when it is `accepted` AND states an exact
 *    amount, currency, cadence and start date with an approved tax basis, and
 *    its frozen snapshot still verifies.
 *  - A route change after signature is a new variation that supersedes the
 *    old arrangement; the old row and its evidence are preserved.
 *  - `activationPreconditions` returns every missing §8.3 gate; nothing here
 *    ever says "charge".
 *  - `missingDateExceptionPlan` encodes §8.4: an owned exception with
 *    resolution options, and an explicit list of what must NOT happen.
 *
 * Money is integer minor units with an explicit currency. Dates are ISO
 * `YYYY-MM-DD` strings compared lexically (valid for that format).
 */

/* ── Vocabulary (mirrors 0059 CHECK constraints) ─────────────────────────── */

export const SERVICE_ROUTES = ["managed", "independent", "unresolved"] as const;
export type ServiceRoute = (typeof SERVICE_ROUTES)[number];

export const PACKAGE_STATES = ["pending", "accepted", "not_applicable"] as const;
export type PackageState = (typeof PACKAGE_STATES)[number];

export const BILLING_START_ARRANGEMENTS = [
  "exact_date",
  "conditional_wording",
  "unresolved",
] as const;
export type BillingStartArrangement = (typeof BILLING_START_ARRANGEMENTS)[number];

export const ARRANGEMENT_STATES = ["active", "superseded"] as const;
export type ArrangementState = (typeof ARRANGEMENT_STATES)[number];

export const SCHEDULE_STATUSES = ["draft", "issued", "accepted", "superseded"] as const;
export type ScheduleStatus = (typeof SCHEDULE_STATUSES)[number];

export const CADENCES = ["monthly", "quarterly", "annual"] as const;
export type Cadence = (typeof CADENCES)[number];

export const TAX_BASES = ["pending", "standard_vat", "exempt", "zero_rated", "inclusive_no_vat"] as const;
export type TaxBasis = (typeof TAX_BASES)[number];

export const FEE_DISPOSITIONS = ["pending", "continue", "stop"] as const;
export type FeeDisposition = (typeof FEE_DISPOSITIONS)[number];

export const ACCEPTANCE_METHODS = ["esign", "clickwrap", "manual_upload"] as const;
export type AcceptanceMethod = (typeof ACCEPTANCE_METHODS)[number];

/** Roles that may bind the client (mirrors is_tenant_admin() in 0001). */
export const SIGNATORY_ROLES = ["owner", "client_admin"] as const;
export type SignatoryRole = (typeof SIGNATORY_ROLES)[number];

/**
 * The independent handover fee: a confirmed commercial decision (brief §2.1).
 * Its tax basis is NOT decided (18.3) — hence `pending`, which blocks issue.
 */
export const HANDOVER_FEE_MINOR = 60000;
export const HANDOVER_FEE_CURRENCY = "GBP";
export const HANDOVER_FEE_TAX_BASIS: TaxBasis = "inclusive_no_vat";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CURRENCY_RE = /^[A-Z]{3}$/;

/* ── Shapes (camelCase views over the 0059 rows) ─────────────────────────── */

export type Arrangement = {
  id: string;
  tenantId: string;
  projectId: string | null;
  orderFormId: string | null;
  route: ServiceRoute;
  packageState: PackageState;
  billingStartArrangement: BillingStartArrangement;
  billingStartDate: string | null;
  approvedWordingRef: string | null;
  state: ArrangementState;
  supersedesId: string | null;
  supersededBy: string | null;
  variationReason: string | null;
};

export type ScheduleContent = {
  packageCode: string;
  catalogueRef: string | null;
  inclusions: string[];
  exclusions: string[];
  usagePolicy: Record<string, unknown>;
  amountMinor: number | null;
  currency: string;
  taxBasis: TaxBasis;
  cadence: Cadence | null;
  startDate: string | null;
  noticeDays: number | null;
  cancellationTermsRef: string | null;
  responseTargets: Record<string, unknown>;
};

export type AcceptanceEvidence = {
  acceptedAt: string | null;
  acceptedByUser: string | null;
  acceptedByName: string | null;
  acceptedRole: string | null;
  acceptanceMethod: AcceptanceMethod | null;
};

export type ReviewTrail = {
  createdBy: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  issuedBy: string | null;
  issuedAt: string | null;
};

export type ServiceSchedule = ScheduleContent &
  AcceptanceEvidence &
  ReviewTrail & {
    id: string;
    arrangementId: string;
    versionNo: number;
    status: ScheduleStatus;
    documentHash: string | null;
    supersededBy: string | null;
  };

export type HandoverContent = {
  feeMinor: number;
  currency: string;
  taxBasis: TaxBasis;
  includedWork: string[];
  dependencies: string[];
  costResponsibility: Record<string, unknown>;
  feeDisposition: FeeDisposition;
};

export type HandoverSchedule = HandoverContent &
  AcceptanceEvidence &
  ReviewTrail & {
    id: string;
    arrangementId: string;
    versionNo: number;
    status: ScheduleStatus;
    documentHash: string | null;
    supersededBy: string | null;
  };

export type Problem = { code: string; detail: string };
export type Decision = { ok: true } | { ok: false; problems: Problem[] };

const decide = (problems: Problem[]): Decision =>
  problems.length ? { ok: false, problems } : { ok: true };

/* ── Arrangement guards ──────────────────────────────────────────────────── */

export type ArrangementDraft = Pick<
  Arrangement,
  | "route"
  | "packageState"
  | "billingStartArrangement"
  | "billingStartDate"
  | "approvedWordingRef"
>;

/** The package state a freshly elected route must carry. */
export const packageStateForRoute = (route: ServiceRoute): PackageState =>
  route === "independent" ? "not_applicable" : "pending";

/**
 * Is this a valid arrangement? "Managed, package pending, billing start
 * unresolved" IS valid (§17.1 row 1) — it is an explicit, owned open term,
 * not a defect. Invalid: contradictions the database also refuses.
 */
export function validateArrangement(a: ArrangementDraft): Decision {
  const problems: Problem[] = [];
  if (!SERVICE_ROUTES.includes(a.route))
    problems.push({ code: "route_unknown", detail: `Unknown route "${a.route}".` });
  if (!PACKAGE_STATES.includes(a.packageState))
    problems.push({ code: "package_state_unknown", detail: `Unknown package state.` });
  if (!BILLING_START_ARRANGEMENTS.includes(a.billingStartArrangement))
    problems.push({
      code: "billing_start_unknown",
      detail: `Unknown billing-start arrangement.`,
    });

  if ((a.route === "independent") !== (a.packageState === "not_applicable"))
    problems.push({
      code: "route_package_inconsistent",
      detail:
        a.route === "independent"
          ? "An independent handover has no managed package; package state must be not_applicable."
          : "Only an independent handover can have package state not_applicable.",
    });
  if (a.billingStartArrangement === "exact_date") {
    if (!a.billingStartDate || !DATE_RE.test(a.billingStartDate))
      problems.push({
        code: "billing_start_date_required",
        detail: "An exact-date billing start needs the date (YYYY-MM-DD).",
      });
  } else if (a.billingStartDate) {
    problems.push({
      code: "billing_start_date_unexpected",
      detail: "A billing-start date is only recorded with an exact_date arrangement.",
    });
  }
  if (
    a.billingStartArrangement === "conditional_wording" &&
    !a.approvedWordingRef?.trim()
  )
    problems.push({
      code: "approved_wording_required",
      detail:
        "Conditional billing-start wording must reference approved (solicitor-reviewed) wording; nothing is invented here.",
    });
  if (a.route === "independent" && a.billingStartArrangement !== "unresolved")
    problems.push({
      code: "independent_has_no_billing_start",
      detail:
        "An independent handover has no managed billing start; leave the arrangement unresolved.",
    });
  return decide(problems);
}

/**
 * Selecting Managed records the route and nothing else: no amount, no plan,
 * no subscription. Returns the fields to write for a fresh election.
 */
export function electRoute(route: ServiceRoute): ArrangementDraft {
  return {
    route,
    packageState: packageStateForRoute(route),
    billingStartArrangement: "unresolved",
    billingStartDate: null,
    approvedWordingRef: null,
  };
}

/** Does choosing Managed imply consent to any amount? Never. */
export function impliedConsentToAmount(a: Pick<Arrangement, "route" | "packageState">): {
  consented: false;
  amountMinor: null;
  reason: string;
} {
  void a;
  return {
    consented: false,
    amountMinor: null,
    reason:
      "Route election is not consent to an amount. The package, price, currency, cadence, start and terms are a separately accepted service schedule (brief §2.1).",
  };
}

export type RouteChangeDecision =
  | { ok: true; mode: "in_place"; next: ArrangementDraft }
  | { ok: true; mode: "variation"; supersedes: string; next: ArrangementDraft }
  | { ok: false; problems: Problem[] };

/**
 * Change the route. Before signature the arrangement may be edited in place;
 * after signature (the linked Order Form was accepted) a change is a new
 * variation that supersedes this one and preserves it. A superseded
 * arrangement is never edited.
 */
export function changeRoute(
  current: Pick<Arrangement, "id" | "route" | "state">,
  next: ServiceRoute,
  ctx: { signed: boolean; asVariation: boolean; reason?: string | null }
): RouteChangeDecision {
  if (current.state === "superseded")
    return {
      ok: false,
      problems: [
        {
          code: "superseded",
          detail: "This arrangement has been superseded; edit its successor.",
        },
      ],
    };
  if (current.route === next)
    return {
      ok: false,
      problems: [{ code: "no_change", detail: "The route is already set." }],
    };
  const draft = electRoute(next);
  if (!ctx.signed) return { ok: true, mode: "in_place", next: draft };
  if (!ctx.asVariation)
    return {
      ok: false,
      problems: [
        {
          code: "variation_required",
          detail:
            "The governing Order Form has been accepted. A route change needs a new approved variation; the signed arrangement is preserved.",
        },
      ],
    };
  if (!ctx.reason?.trim())
    return {
      ok: false,
      problems: [
        {
          code: "reason_required",
          detail: "A variation must say why the route changed.",
        },
      ],
    };
  return { ok: true, mode: "variation", supersedes: current.id, next: draft };
}

/**
 * The two rows a variation writes: the old one marked superseded (nothing
 * else on it changes) and the new active one linked back.
 */
export function buildVariation(
  old: Arrangement,
  next: ArrangementDraft,
  newId: string,
  reason: string
): { superseded: Arrangement; successor: Arrangement } {
  return {
    superseded: { ...old, state: "superseded", supersededBy: newId },
    successor: {
      ...old,
      ...next,
      id: newId,
      state: "active",
      supersedesId: old.id,
      supersededBy: null,
      variationReason: reason,
    },
  };
}

/* ── Schedule machines ───────────────────────────────────────────────────── */

const SCHEDULE_TRANSITIONS: Record<ScheduleStatus, readonly ScheduleStatus[]> = {
  draft: ["issued", "superseded"],
  issued: ["accepted", "superseded"],
  accepted: ["superseded"],
  superseded: [],
};

export const canTransitionSchedule = (
  from: ScheduleStatus,
  to: ScheduleStatus
): boolean => SCHEDULE_TRANSITIONS[from]?.includes(to) ?? false;

/** Content may be edited only while a schedule is a draft (the 0059 trigger). */
export const isScheduleEditable = (status: ScheduleStatus): boolean => status === "draft";

export const nextVersionNo = (existing: readonly { versionNo: number }[]): number =>
  existing.reduce((max, s) => Math.max(max, s.versionNo), 0) + 1;

/** The exactness a chargeable schedule must have (§2.1, §8.3). */
export function exactnessProblems(c: ScheduleContent): Problem[] {
  const problems: Problem[] = [];
  if (!c.packageCode?.trim())
    problems.push({ code: "package_required", detail: "Name the package." });
  if (c.amountMinor === null || !Number.isInteger(c.amountMinor) || c.amountMinor < 0)
    problems.push({
      code: "amount_required",
      detail:
        "State the exact amount in minor units (an indicative price is not an amount).",
    });
  if (!CURRENCY_RE.test(c.currency ?? ""))
    problems.push({ code: "currency_required", detail: "State the ISO currency." });
  if (!c.cadence || !CADENCES.includes(c.cadence))
    problems.push({ code: "cadence_required", detail: "State the billing cadence." });
  if (!c.startDate || !DATE_RE.test(c.startDate))
    problems.push({
      code: "start_date_required",
      detail: "State the exact service start date.",
    });
  if (c.noticeDays === null || !Number.isInteger(c.noticeDays) || c.noticeDays < 0)
    problems.push({
      code: "notice_required",
      detail: "State the notice period in days.",
    });
  if (c.taxBasis === "pending")
    problems.push({
      code: "tax_basis_pending",
      detail:
        "The tax basis is pending decision; the schedule cannot be issued until it is approved.",
    });
  if (!c.cancellationTermsRef?.trim())
    problems.push({
      code: "cancellation_terms_required",
      detail: "Reference the cancellation terms.",
    });
  return problems;
}

export type IssueContext = {
  /** The staff member issuing now. */
  issuerId: string;
  /** Who drafted it (created_by). */
  authorId: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
};

/** May `reviewerId` review this draft? Never its author. */
export function canReviewSchedule(
  s: Pick<ServiceSchedule, "status" | "createdBy">,
  reviewerId: string
): Decision {
  const problems: Problem[] = [];
  if (s.status !== "draft")
    problems.push({ code: "not_draft", detail: "Only a draft can be reviewed." });
  if (s.createdBy && s.createdBy === reviewerId)
    problems.push({
      code: "reviewer_is_author",
      detail: "You drafted this schedule; a different staff member must review it.",
    });
  return decide(problems);
}

/**
 * Draft → issued. Second-person review (reviewer ≠ issuer, reviewer ≠ author
 * when known) and complete, exact content. Mirrors the 0059 CHECKs.
 */
export function canIssueServiceSchedule(
  s: Pick<ServiceSchedule, "status" | "createdBy" | "reviewedBy" | "reviewedAt"> &
    ScheduleContent,
  issuerId: string
): Decision {
  const problems: Problem[] = [];
  if (!canTransitionSchedule(s.status, "issued"))
    problems.push({
      code: "invalid_transition",
      detail: `Cannot issue from ${s.status}.`,
    });
  problems.push(...reviewProblems(s, issuerId));
  problems.push(...exactnessProblems(s));
  return decide(problems);
}

function reviewProblems(
  s: Pick<ServiceSchedule, "createdBy" | "reviewedBy" | "reviewedAt">,
  issuerId: string
): Problem[] {
  const problems: Problem[] = [];
  if (!s.reviewedBy || !s.reviewedAt)
    problems.push({
      code: "review_required",
      detail:
        "A staff member other than the author must review the schedule before it is issued.",
    });
  else {
    if (s.reviewedBy === issuerId)
      problems.push({
        code: "reviewer_is_issuer",
        detail: "The reviewer cannot also be the issuer.",
      });
    if (s.createdBy && s.reviewedBy === s.createdBy)
      problems.push({
        code: "reviewer_is_author",
        detail: "The author cannot review their own schedule.",
      });
  }
  return problems;
}

/** Draft → issued for a handover schedule (tax basis and fee disposition decided). */
export function canIssueHandoverSchedule(
  h: Pick<HandoverSchedule, "status" | "createdBy" | "reviewedBy" | "reviewedAt"> &
    HandoverContent,
  issuerId: string
): Decision {
  const problems: Problem[] = [];
  if (!canTransitionSchedule(h.status, "issued"))
    problems.push({
      code: "invalid_transition",
      detail: `Cannot issue from ${h.status}.`,
    });
  problems.push(...reviewProblems(h, issuerId));
  problems.push(...handoverBlockers(h));
  return decide(problems);
}

/** Why a handover schedule cannot go out yet (brief §6.5, §8.1, §8.5). */
export function handoverBlockers(h: HandoverContent): Problem[] {
  const problems: Problem[] = [];
  if (!Number.isInteger(h.feeMinor) || h.feeMinor < 0)
    problems.push({
      code: "fee_invalid",
      detail: "The handover fee must be a whole number of minor units.",
    });
  if (!CURRENCY_RE.test(h.currency ?? ""))
    problems.push({ code: "currency_required", detail: "State the ISO currency." });
  if (h.taxBasis === "pending")
    problems.push({
      code: "tax_basis_pending",
      detail:
        "The £600 tax basis is pending decision 18.3; issuance is blocked until it is approved.",
    });
  if (h.feeDisposition === "pending")
    problems.push({
      code: "fee_disposition_pending",
      detail:
        "Resolve whether the Stripe Connect application fee continues or stops after handover (decision 18.4) before issuing.",
    });
  if (!h.includedWork?.length)
    problems.push({
      code: "included_work_required",
      detail: "List the included transfer work.",
    });
  return problems;
}

export type Signatory = {
  userId: string;
  /** Membership role on the arrangement's tenant, or null when not a member. */
  membershipRole: string | null;
  membershipTenantId: string | null;
  name: string;
  authorityConfirmed: boolean;
};

/**
 * Issued → accepted by the client's authorised signatory. Membership on the
 * arrangement's tenant with a signatory role, a confirmed authority, an
 * intact snapshot. Staff cannot accept on the client's behalf through this
 * path (a staff-recorded acceptance is `manual_upload`, a different action).
 */
export function canAcceptSchedule(
  s: { status: ScheduleStatus; documentHash: string | null; snapshotVerified: boolean },
  tenantId: string,
  signatory: Signatory
): Decision {
  const problems: Problem[] = [];
  if (!canTransitionSchedule(s.status, "accepted"))
    problems.push({
      code: "not_issued",
      detail:
        s.status === "accepted"
          ? "Already accepted."
          : "Only an issued schedule can be accepted.",
    });
  if (!s.documentHash || !s.snapshotVerified)
    problems.push({
      code: "snapshot_invalid",
      detail: "The issued document's snapshot does not verify; it cannot be accepted.",
    });
  if (!signatory.membershipTenantId || signatory.membershipTenantId !== tenantId)
    problems.push({
      code: "not_member",
      detail: "The signer is not a member of this client.",
    });
  else if (
    !signatory.membershipRole ||
    !(SIGNATORY_ROLES as readonly string[]).includes(signatory.membershipRole)
  )
    problems.push({
      code: "not_signatory",
      detail: "Only a client admin or owner may accept on behalf of the client.",
    });
  if (!signatory.authorityConfirmed)
    problems.push({
      code: "authority_unconfirmed",
      detail: "Confirm authority to bind the client.",
    });
  if (!signatory.name?.trim())
    problems.push({ code: "name_required", detail: "The signer's name is required." });
  return decide(problems);
}

/** Which prior versions become superseded when `successor` is issued or accepted. */
export function supersededBy(
  versions: readonly Pick<ServiceSchedule, "id" | "status" | "versionNo">[],
  successor: Pick<ServiceSchedule, "id" | "status" | "versionNo">
): string[] {
  const losing: ScheduleStatus[] =
    successor.status === "accepted" ? ["issued", "accepted"] : ["issued"];
  return versions
    .filter(
      (v) =>
        v.id !== successor.id &&
        v.versionNo < successor.versionNo &&
        losing.includes(v.status)
    )
    .map((v) => v.id);
}

/* ── Chargeability (§2.1, §17.1 row 8) ───────────────────────────────────── */

export type Chargeability =
  | {
      chargeable: true;
      amountMinor: number;
      currency: string;
      cadence: Cadence;
      startDate: string;
      taxBasis: Exclude<TaxBasis, "pending">;
    }
  | { chargeable: false; missing: Problem[] };

/**
 * A schedule is chargeable only when it is accepted, states exact terms and
 * its snapshot verifies. `accepted` is the frozen content read from the
 * snapshot (acceptanceSnapshot.acceptedContent), never the live catalogue;
 * pass null when the snapshot failed to verify.
 */
export function chargeability(
  s: Pick<ServiceSchedule, "status" | "documentHash">,
  accepted: ScheduleContent | null
): Chargeability {
  const missing: Problem[] = [];
  if (s.status !== "accepted")
    missing.push({
      code: "not_accepted",
      detail: `Schedule is ${s.status}, not accepted.`,
    });
  if (!s.documentHash)
    missing.push({ code: "hash_missing", detail: "No document hash." });
  if (!accepted) {
    missing.push({
      code: "snapshot_invalid",
      detail: "The accepted snapshot is missing or fails verification.",
    });
    return { chargeable: false, missing };
  }
  missing.push(
    ...exactnessProblems(accepted).filter((p) => p.code !== "cancellation_terms_required")
  );
  if (missing.length) return { chargeable: false, missing };
  return {
    chargeable: true,
    amountMinor: accepted.amountMinor as number,
    currency: accepted.currency,
    cadence: accepted.cadence as Cadence,
    startDate: accepted.startDate as string,
    taxBasis: accepted.taxBasis as Exclude<TaxBasis, "pending">,
  };
}

/* ── Mandate, approval and activation gates (§8.3) ───────────────────────── */

export type MandateStatus =
  | "none"
  | "pending"
  | "authorised"
  | "active"
  | "cancelled"
  | "expired"
  | "failed";

export type Mandate = {
  status: MandateStatus;
  /** Provider reference (e.g. GoCardless mandate id). */
  reference: string | null;
  /** Provider lead time between submission and first possible collection. */
  providerLeadDays: number;
  /** Any other active collection rail already bound to this obligation. */
  otherActiveRails: number;
};

export type InternalApproval = {
  approvedBy: string | null;
  approvedAt: string | null;
};

export const ACTIVATION_GATES = [
  "route_managed",
  "arrangement_active",
  "schedule_accepted",
  "schedule_current",
  "exact_amount",
  "agreed_start",
  "start_date_reached_or_future",
  "collection_authority",
  "notice_period",
  "service_identity",
  "no_duplicate_rail",
  "internal_approval",
] as const;
export type ActivationGate = (typeof ACTIVATION_GATES)[number];

export type MissingGate = { gate: ActivationGate; detail: string };

export type ActivationInput = {
  arrangement: Arrangement;
  schedule: ServiceSchedule | null;
  /** Frozen content read from the schedule snapshot, null if unverified. */
  accepted: ScheduleContent | null;
  mandate: Mandate | null;
  approval: InternalApproval | null;
  /** YYYY-MM-DD "today" for notice arithmetic. */
  asOf: string;
};

/**
 * Every §8.3 gate that is still missing. Empty = activation MAY be reserved
 * (by code behind `billingActivation`, not here). This function never
 * charges, schedules or reserves anything.
 */
export function activationPreconditions(input: ActivationInput): MissingGate[] {
  const { arrangement, schedule, accepted, mandate, approval, asOf } = input;
  const missing: MissingGate[] = [];

  if (arrangement.route !== "managed")
    missing.push({
      gate: "route_managed",
      detail:
        arrangement.route === "independent"
          ? "Independent handover: there is no managed service to activate."
          : "The service route is unresolved.",
    });
  if (arrangement.state !== "active")
    missing.push({
      gate: "arrangement_active",
      detail: "The arrangement has been superseded.",
    });

  if (!schedule || schedule.status !== "accepted")
    missing.push({
      gate: "schedule_accepted",
      detail: schedule
        ? `The service schedule is ${schedule.status}.`
        : "No service schedule has been accepted.",
    });
  else if (schedule.supersededBy)
    missing.push({
      gate: "schedule_current",
      detail: "The accepted schedule has been superseded.",
    });
  else if (schedule.arrangementId !== arrangement.id)
    missing.push({
      gate: "schedule_current",
      detail: "The schedule belongs to a different arrangement.",
    });

  const charge = schedule ? chargeability(schedule, accepted) : null;
  if (!charge || !charge.chargeable)
    missing.push({
      gate: "exact_amount",
      detail: charge
        ? charge.missing.map((p) => p.detail).join(" ")
        : "No accepted schedule with an exact amount, currency, cadence and start.",
    });

  const startDate =
    arrangement.billingStartArrangement === "exact_date"
      ? arrangement.billingStartDate
      : null;
  if (!startDate)
    missing.push({
      gate: "agreed_start",
      detail:
        arrangement.billingStartArrangement === "conditional_wording"
          ? "The billing start is conditional wording; the exact date must be agreed and recorded before activation."
          : "The billing start date is unresolved.",
    });
  else if (charge && charge.chargeable && charge.startDate !== startDate)
    missing.push({
      gate: "agreed_start",
      detail: `The schedule start (${charge.startDate}) differs from the contractual billing start (${startDate}).`,
    });

  if (!mandate || !(mandate.status === "authorised" || mandate.status === "active"))
    missing.push({
      gate: "collection_authority",
      detail: mandate
        ? `Collection authority is ${mandate.status}.`
        : "No collection authority (Direct Debit mandate) has been recorded.",
    });

  // Advance notice of collection (provider lead time / Direct Debit advance
  // notice), not the contractual cancellation notice. Only bites ahead of the
  // start date: once the date has arrived the provider simply collects later,
  // which collectionTiming() reports separately without moving the commercial
  // date.
  if (startDate && mandate && DATE_RE.test(asOf)) {
    const remaining = daysBetween(asOf, startDate);
    const lead = Math.max(0, mandate.providerLeadDays);
    if (remaining > 0 && remaining < lead)
      missing.push({
        gate: "notice_period",
        detail: `Only ${remaining} day(s) remain before ${startDate} but the provider needs ${lead}; it cannot collect on the contractual date. Do not shift the commercial date silently — record the actual collection date separately.`,
      });
  }

  if (!arrangement.projectId)
    missing.push({
      gate: "service_identity",
      detail:
        "The arrangement is not bound to a system/project (billing unit undecided, 18.7).",
    });

  if (mandate && mandate.otherActiveRails > 0)
    missing.push({
      gate: "no_duplicate_rail",
      detail: `${mandate.otherActiveRails} other active collection rail(s) already bound to this obligation.`,
    });

  if (!approval?.approvedBy || !approval.approvedAt)
    missing.push({
      gate: "internal_approval",
      detail: "Internal activation approval is missing.",
    });
  else if (schedule && approval.approvedBy === schedule.issuedBy)
    missing.push({
      gate: "internal_approval",
      detail: "The activation approver must differ from the schedule's issuer.",
    });

  return missing;
}

export const canActivate = (input: ActivationInput): boolean =>
  activationPreconditions(input).length === 0;

/**
 * What happens when a mandate is authorised (§17.1 row 3, Phase 0 §8 #2):
 * the mandate is recorded. Nothing is collected and nothing activates
 * solely because of that event.
 */
export function onMandateAuthorised(
  input: Omit<ActivationInput, "mandate"> & { mandate: Mandate }
): {
  recordMandate: true;
  activate: false;
  collect: false;
  createSubscription: false;
  remainingGates: MissingGate[];
} {
  return {
    recordMandate: true,
    activate: false,
    collect: false,
    createSubscription: false,
    remainingGates: activationPreconditions(input).filter(
      (g) => g.gate !== "collection_authority"
    ),
  };
}

/* ── Contractual start vs provider collection (§8.3, §17.1 row 4) ────────── */

export type CollectionTiming = {
  /** The agreed commercial start; never moved by provider timing. */
  contractualStartDate: string;
  /** Earliest date the provider can collect given its lead time from `asOf`. */
  earliestProviderCollectionDate: string;
  /** True when the provider will collect after the contractual date. */
  providerLater: boolean;
  /** Never charge before the contractual date. */
  chargeBeforeStart: false;
  /** The date to show the client as "collection expected" — provider, not contract. */
  displayCollectionDate: string;
};

export function collectionTiming(
  contractualStartDate: string,
  asOf: string,
  providerLeadDays: number
): CollectionTiming {
  const earliest = addDays(asOf, Math.max(0, providerLeadDays));
  const providerLater = earliest > contractualStartDate;
  return {
    contractualStartDate,
    earliestProviderCollectionDate: earliest,
    providerLater,
    chargeBeforeStart: false,
    displayCollectionDate: providerLater ? earliest : contractualStartDate,
  };
}

/** Should anything be collected on `asOf`? Only on/after the contractual start and only if chargeable. */
export const shouldCollectOn = (charge: Chargeability, asOf: string): boolean =>
  charge.chargeable && DATE_RE.test(asOf) && asOf >= charge.startDate;

/* ── §8.4 — the start date arrives and something is missing ──────────────── */

export const EXCEPTION_RESOLUTIONS = [
  "accepted_amendment",
  "approved_interim_arrangement",
  "explicit_instruction",
] as const;
export type ExceptionResolution = (typeof EXCEPTION_RESOLUTIONS)[number];

export type MissingDateException = {
  kind: "exception";
  priority: "high";
  /** The exception must be owned; the owner is assigned by staff, never defaulted. */
  ownerRequired: true;
  arrangementId: string;
  /** Preserved verbatim — never shifted. */
  originalStartDate: string | null;
  missing: MissingGate[];
  resolutionOptions: readonly ExceptionResolution[];
  /** What the system must NOT do (§8.4). All false, by construction. */
  forbidden: {
    defaultPlan: false;
    indicativeCharge: false;
    backdate: false;
    silentDateChange: false;
    forcedRouteChange: false;
    automaticShutdown: false;
  };
  /** Gap responsibility must be recorded as part of the resolution. */
  recordGapResponsibility: true;
  /** Resulting plan/amount decided here: none. */
  plan: null;
  amountMinor: null;
};

/**
 * When the contractual start date has arrived (or passed) and activation
 * gates are still missing, the only output is an owned exception. Returns
 * null when the date has not arrived or nothing is missing.
 */
export function missingDateExceptionPlan(
  input: ActivationInput
): MissingDateException | null {
  const { arrangement, asOf } = input;
  const startDate =
    arrangement.billingStartArrangement === "exact_date"
      ? arrangement.billingStartDate
      : null;
  const missing = activationPreconditions(input);
  const dateArrived = startDate ? DATE_RE.test(asOf) && asOf >= startDate : false;
  // An unresolved/conditional start with a managed route is itself an owned
  // open term; it becomes an exception once the schedule's own start passes.
  const scheduleStart = input.accepted?.startDate ?? null;
  const scheduleArrived = scheduleStart ? asOf >= scheduleStart : false;
  if (!(dateArrived || scheduleArrived)) return null;
  if (missing.length === 0) return null;
  return {
    kind: "exception",
    priority: "high",
    ownerRequired: true,
    arrangementId: arrangement.id,
    originalStartDate: startDate ?? scheduleStart,
    missing,
    resolutionOptions: EXCEPTION_RESOLUTIONS,
    forbidden: {
      defaultPlan: false,
      indicativeCharge: false,
      backdate: false,
      silentDateChange: false,
      forcedRouteChange: false,
      automaticShutdown: false,
    },
    recordGapResponsibility: true,
    plan: null,
    amountMinor: null,
  };
}

/* ── Independent handover (§17.1 row 6) ──────────────────────────────────── */

export type HandoverLine = {
  label: "Independent handover / migration fee";
  amountMinor: number;
  currency: string;
  taxBasis: TaxBasis;
  /** Appears once, on the handover schedule; never recurring. */
  cadence: "one_off";
  occurrences: 1;
  /** Blocked while the tax basis or fee disposition is pending. */
  issuable: boolean;
  blockers: Problem[];
  /** No Run subscription is ever created from an independent handover. */
  runSubscription: null;
  /** Client-paid third-party costs stay explicit and separate. */
  thirdPartyCosts: Record<string, unknown>;
  applicationFeeDisposition: FeeDisposition;
};

export function handoverFeeLine(h: HandoverContent): HandoverLine {
  const blockers = handoverBlockers(h);
  return {
    label: "Independent handover / migration fee",
    amountMinor: h.feeMinor,
    currency: h.currency,
    taxBasis: h.taxBasis,
    cadence: "one_off",
    occurrences: 1,
    issuable: blockers.length === 0,
    blockers,
    runSubscription: null,
    thirdPartyCosts: h.costResponsibility,
    applicationFeeDisposition: h.feeDisposition,
  };
}

/** The defaults a new handover schedule is drafted with (the £600 decision, tax pending). */
export function defaultHandoverContent(): HandoverContent {
  return {
    feeMinor: HANDOVER_FEE_MINOR,
    currency: HANDOVER_FEE_CURRENCY,
    taxBasis: HANDOVER_FEE_TAX_BASIS,
    includedWork: [],
    dependencies: [],
    costResponsibility: {},
    feeDisposition: "pending",
  };
}

/* ── Date helpers (ISO YYYY-MM-DD, UTC) ──────────────────────────────────── */

export function daysBetween(from: string, to: string): number {
  const a = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  const b = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

export function addDays(date: string, days: number): string {
  const t =
    Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)) +
    days * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/* ── Row mappers (0059 snake_case → the shapes above) ────────────────────── */

export type ArrangementRow = {
  id: string;
  tenant_id: string;
  project_id: string | null;
  order_form_id: string | null;
  route: ServiceRoute;
  package_state: PackageState;
  billing_start_arrangement: BillingStartArrangement;
  billing_start_date: string | null;
  approved_wording_ref: string | null;
  state: ArrangementState;
  supersedes_id: string | null;
  superseded_by: string | null;
  variation_reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ServiceScheduleRow = {
  id: string;
  arrangement_id: string;
  version_no: number;
  package_code: string;
  catalogue_ref: string | null;
  inclusions: unknown;
  exclusions: unknown;
  usage_policy: unknown;
  amount_minor: number | null;
  currency: string;
  tax_basis: TaxBasis;
  cadence: Cadence | null;
  start_date: string | null;
  notice_days: number | null;
  cancellation_terms_ref: string | null;
  response_targets: unknown;
  status: ScheduleStatus;
  created_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  issued_by: string | null;
  issued_at: string | null;
  accepted_at: string | null;
  accepted_by_user: string | null;
  accepted_by_name: string | null;
  accepted_role: string | null;
  acceptance_method: AcceptanceMethod | null;
  document_snapshot: unknown;
  document_hash: string | null;
  superseded_by: string | null;
  created_at: string;
  updated_at: string;
};

export type HandoverScheduleRow = {
  id: string;
  arrangement_id: string;
  version_no: number;
  fee_minor: number;
  currency: string;
  tax_basis: TaxBasis;
  included_work: unknown;
  dependencies: unknown;
  cost_responsibility: unknown;
  fee_disposition: FeeDisposition;
  status: ScheduleStatus;
  created_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  issued_by: string | null;
  issued_at: string | null;
  accepted_at: string | null;
  accepted_by_user: string | null;
  accepted_by_name: string | null;
  accepted_role: string | null;
  acceptance_method: AcceptanceMethod | null;
  document_snapshot: unknown;
  document_hash: string | null;
  superseded_by: string | null;
  created_at: string;
  updated_at: string;
};

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
const record = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

export function arrangementFromRow(r: ArrangementRow): Arrangement {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    projectId: r.project_id,
    orderFormId: r.order_form_id,
    route: r.route,
    packageState: r.package_state,
    billingStartArrangement: r.billing_start_arrangement,
    billingStartDate: r.billing_start_date,
    approvedWordingRef: r.approved_wording_ref,
    state: r.state,
    supersedesId: r.supersedes_id,
    supersededBy: r.superseded_by,
    variationReason: r.variation_reason,
  };
}

export function scheduleContentFromRow(r: ServiceScheduleRow): ScheduleContent {
  return {
    packageCode: r.package_code,
    catalogueRef: r.catalogue_ref,
    inclusions: strings(r.inclusions),
    exclusions: strings(r.exclusions),
    usagePolicy: record(r.usage_policy),
    amountMinor: r.amount_minor,
    currency: r.currency,
    taxBasis: r.tax_basis,
    cadence: r.cadence,
    startDate: r.start_date,
    noticeDays: r.notice_days,
    cancellationTermsRef: r.cancellation_terms_ref,
    responseTargets: record(r.response_targets),
  };
}

export function serviceScheduleFromRow(r: ServiceScheduleRow): ServiceSchedule {
  return {
    ...scheduleContentFromRow(r),
    id: r.id,
    arrangementId: r.arrangement_id,
    versionNo: r.version_no,
    status: r.status,
    createdBy: r.created_by,
    reviewedBy: r.reviewed_by,
    reviewedAt: r.reviewed_at,
    issuedBy: r.issued_by,
    issuedAt: r.issued_at,
    acceptedAt: r.accepted_at,
    acceptedByUser: r.accepted_by_user,
    acceptedByName: r.accepted_by_name,
    acceptedRole: r.accepted_role,
    acceptanceMethod: r.acceptance_method,
    documentHash: r.document_hash,
    supersededBy: r.superseded_by,
  };
}

export function handoverContentFromRow(r: HandoverScheduleRow): HandoverContent {
  return {
    feeMinor: r.fee_minor,
    currency: r.currency,
    taxBasis: r.tax_basis,
    includedWork: strings(r.included_work),
    dependencies: strings(r.dependencies),
    costResponsibility: record(r.cost_responsibility),
    feeDisposition: r.fee_disposition,
  };
}

export function handoverScheduleFromRow(r: HandoverScheduleRow): HandoverSchedule {
  return {
    ...handoverContentFromRow(r),
    id: r.id,
    arrangementId: r.arrangement_id,
    versionNo: r.version_no,
    status: r.status,
    createdBy: r.created_by,
    reviewedBy: r.reviewed_by,
    reviewedAt: r.reviewed_at,
    issuedBy: r.issued_by,
    issuedAt: r.issued_at,
    acceptedAt: r.accepted_at,
    acceptedByUser: r.accepted_by_user,
    acceptedByName: r.accepted_by_name,
    acceptedRole: r.accepted_role,
    acceptanceMethod: r.acceptance_method,
    documentHash: r.document_hash,
    supersededBy: r.superseded_by,
  };
}

/** Parse a snapshot's `content` back into ScheduleContent, or null when it is not one. */
export function scheduleContentFromSnapshot(content: unknown): ScheduleContent | null {
  const c = record(content);
  if (typeof c.packageCode !== "string" || typeof c.currency !== "string") return null;
  return {
    packageCode: c.packageCode,
    catalogueRef: typeof c.catalogueRef === "string" ? c.catalogueRef : null,
    inclusions: strings(c.inclusions),
    exclusions: strings(c.exclusions),
    usagePolicy: record(c.usagePolicy),
    amountMinor: typeof c.amountMinor === "number" ? c.amountMinor : null,
    currency: c.currency,
    taxBasis: (TAX_BASES as readonly string[]).includes(c.taxBasis as string)
      ? (c.taxBasis as TaxBasis)
      : "pending",
    cadence: (CADENCES as readonly string[]).includes(c.cadence as string)
      ? (c.cadence as Cadence)
      : null,
    startDate: typeof c.startDate === "string" ? c.startDate : null,
    noticeDays: typeof c.noticeDays === "number" ? c.noticeDays : null,
    cancellationTermsRef:
      typeof c.cancellationTermsRef === "string" ? c.cancellationTermsRef : null,
    responseTargets: record(c.responseTargets),
  };
}
