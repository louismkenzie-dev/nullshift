/**
 * Mandate records — the pure fold behind migration 0064's `mandates` table
 * (brief §3.3 #2, §8.3 step 4, §10.2 "separate objects/states", "orphan
 * mandate", §12.3 "test and live records cannot mix").
 *
 * The rule this module exists to enforce: a mandate being authorised is NOT
 * payment, NOT commercial approval and NOT activation. `recordMandateFromEvent`
 * turns provider-confirmed resource state into ONE write plan for the
 * `mandates` table and nothing else. It never creates a subscription, never
 * creates or schedules an activation and never collects. The legacy webhook
 * (`app/api/gocardless/webhook/route.ts`) keeps doing what it does today;
 * this fold is only consulted when OPS_V2_FLAGS contains `billingActivation`,
 * and even then only produces a plan the caller persists.
 *
 * Inputs are provider-confirmed: the caller fetches the mandate / billing
 * request resource after signature verification and passes the fetched
 * state, never the event body alone (§10.2: a successful redirect or a single
 * event is not authoritative). Ordering uses the fetch time against
 * `last_provider_sync_at`, so a duplicate or out-of-order delivery is a no-op
 * rather than a regression.
 *
 * Holds. A mandate is HELD FOR REVIEW — usable by nothing — when
 *   - no client (tenant) can be tied to it from our own records (orphan),
 *   - the consent evidence (terms version + acceptance reference captured at
 *     setup) is missing (§10.2 "do not reconstruct permission to charge from
 *     current catalogue prices or metadata that lacks the original consent
 *     snapshot"), or
 *   - the provider reports a status this code does not recognise.
 * Releasing a hold is a staff decision with recorded evidence
 * (`releaseMandateHold`), never automatic.
 *
 * Nothing here performs I/O.
 */

import { flagOn } from "@/lib/flags";
import {
  isMandateUsable,
  type Environment,
  type MandateProvider,
  type MandateRecord,
  type MandateStatus,
} from "@/lib/billing/activation";

/* ── Provider-confirmed input ────────────────────────────────────────────── */

/**
 * The state of the provider's mandate resource as FETCHED after the event,
 * not as described by the event body.
 */
export type ProviderMandateResource = {
  provider: MandateProvider;
  environment: Environment;
  /** Provider mandate id. Null while only a setup request exists. */
  mandateRef: string | null;
  /** Provider setup-request id (GoCardless billing request). */
  billingRequestRef: string | null;
  customerRef: string | null;
  /** The provider's own status string (e.g. GoCardless `pending_submission`). */
  rawStatus: string;
  /** ISO instant of the resource fetch (orders duplicates and out-of-order events). */
  fetchedAt: string;
  /** Provider's successor mandate id when this one has been replaced. */
  replacedByMandateRef: string | null;
};

/** Consent captured at setup: the wording shown and the acceptance it was bound to. */
export type ConsentEvidence = {
  termsVersion: string | null;
  acceptanceRef: string | null;
};

export type MandateEventInput = {
  /** Provider event id — recorded for traceability; dedup lives in the inbox. */
  eventId: string;
  resource: ProviderMandateResource;
  /**
   * The client this mandate belongs to, resolved by the caller from OUR
   * records (a `mandates` row with the same billing request, a pending
   * subscription's `gc_billing_request_id`), never from provider metadata
   * alone. Null = orphan.
   */
  tenantId: string | null;
  consent: ConsentEvidence | null;
  /** Existing row for this (provider, environment, mandateRef) or billing request; null if none. */
  existing: MandateRecord | null;
  /** Existing row for `resource.replacedByMandateRef`, when we already hold it. */
  successor: MandateRecord | null;
};

/* ── Provider status vocabulary ──────────────────────────────────────────── */

/**
 * GoCardless mandate statuses → 0064 statuses. "authorised" means the
 * customer has completed the hosted flow (billing request fulfilled, mandate
 * exists) but the bank has not yet confirmed it; "active" is the bank's
 * confirmation. Neither is payment.
 */
export const GOCARDLESS_MANDATE_STATUS: Readonly<Record<string, MandateStatus>> = {
  pending_customer_approval: "pending",
  pending_submission: "authorised",
  submitted: "authorised",
  active: "active",
  suspended_by_payer: "cancelled",
  failed: "failed",
  blocked: "failed",
  cancelled: "cancelled",
  expired: "cancelled",
  consumed: "cancelled",
};

/** Stripe payment-method mandate statuses (BACS/SEPA) → 0064 statuses. */
export const STRIPE_MANDATE_STATUS: Readonly<Record<string, MandateStatus>> = {
  pending: "pending",
  active: "active",
  inactive: "cancelled",
};

export function mapProviderStatus(
  provider: MandateProvider,
  rawStatus: string
): MandateStatus | null {
  const table =
    provider === "gocardless" ? GOCARDLESS_MANDATE_STATUS : STRIPE_MANDATE_STATUS;
  return table[rawStatus.trim().toLowerCase()] ?? null;
}

/** Terminal states never regress from a later-fetched non-terminal state. */
const TERMINAL: readonly MandateStatus[] = ["cancelled", "failed", "replaced"];
export const isTerminalMandateStatus = (s: MandateStatus): boolean =>
  TERMINAL.includes(s);

/* ── Write plan ──────────────────────────────────────────────────────────── */

/** Columns of a `mandates` row this fold may write (camelCase view of 0064). */
export type MandateUpsert = Omit<MandateRecord, "id"> & { id: string | null };

export type MandateAudit = {
  action: string;
  target: string | null;
  tenantId: string | null;
  metadata: Record<string, unknown>;
};

/** What this fold can never do, stated in the type so a caller cannot be misled. */
export type MandateNever = {
  createSubscription: false;
  createActivation: false;
  scheduleCollection: false;
  collect: false;
};

export type MandateWritePlan =
  | {
      ok: true;
      op: "insert" | "update" | "noop";
      row: MandateUpsert;
      heldForReview: boolean;
      holdReason: string | null;
      /** When the resource says "replaced" but we do not hold the successor yet. */
      followUp: string | null;
      audit: MandateAudit;
      never: MandateNever;
    }
  | { ok: false; reason: "flag_off"; never: MandateNever }
  | { ok: false; reason: "environment_mismatch"; detail: string; never: MandateNever }
  | { ok: false; reason: "identity_missing"; detail: string; never: MandateNever }
  | { ok: false; reason: "provider_mismatch"; detail: string; never: MandateNever };

const NEVER: MandateNever = {
  createSubscription: false,
  createActivation: false,
  scheduleCollection: false,
  collect: false,
};

const hasConsent = (
  c: ConsentEvidence | null
): c is Required<ConsentEvidence> & {
  termsVersion: string;
  acceptanceRef: string;
} => !!c && !!c.termsVersion && !!c.acceptanceRef;

/**
 * Store or update a mandate from provider-confirmed resource state. Returns
 * the single `mandates` write (or a no-op for a stale/duplicate delivery)
 * plus the audit entry. NEVER creates a subscription or an activation: the
 * `never` block is part of the result so the caller cannot mistake this for
 * an activation path.
 */
export function recordMandateFromEvent(input: MandateEventInput): MandateWritePlan {
  if (!flagOn("billingActivation"))
    return { ok: false, reason: "flag_off", never: NEVER };

  const { resource, existing } = input;

  if (!resource.mandateRef && !resource.billingRequestRef)
    return {
      ok: false,
      reason: "identity_missing",
      detail:
        "The provider resource carries neither a mandate reference nor a setup-request reference.",
      never: NEVER,
    };

  if (existing && existing.environment !== resource.environment)
    return {
      ok: false,
      reason: "environment_mismatch",
      detail: `Existing ${existing.environment} mandate cannot be updated from a ${resource.environment} resource; test and live records never mix (brief §12.3).`,
      never: NEVER,
    };
  if (existing && existing.provider !== resource.provider)
    return {
      ok: false,
      reason: "provider_mismatch",
      detail: `Existing ${existing.provider} mandate cannot be updated from a ${resource.provider} resource.`,
      never: NEVER,
    };
  if (
    existing &&
    existing.mandateRef &&
    resource.mandateRef &&
    existing.mandateRef !== resource.mandateRef
  )
    return {
      ok: false,
      reason: "identity_missing",
      detail: `Resource mandate ${resource.mandateRef} does not match the existing row's mandate ${existing.mandateRef}.`,
      never: NEVER,
    };

  // Out-of-order or duplicate delivery: the resource we fetched is older than
  // the state we already hold. Record nothing; the newer state stands.
  if (existing?.lastProviderSyncAt && resource.fetchedAt < existing.lastProviderSyncAt)
    return {
      ok: true,
      op: "noop",
      row: { ...existing },
      heldForReview: existing.heldForReview,
      holdReason: existing.holdReason,
      followUp: null,
      audit: {
        action: "billing.mandate_event_stale",
        target: mandateTarget(existing.id, resource),
        tenantId: existing.tenantId,
        metadata: {
          eventId: input.eventId,
          fetchedAt: resource.fetchedAt,
          lastProviderSyncAt: existing.lastProviderSyncAt,
        },
      },
      never: NEVER,
    };

  // Tenant: our records decide, never the provider's metadata. Once bound,
  // a mandate stays bound; a later event cannot re-home it.
  const tenantId = existing?.tenantId ?? input.tenantId ?? null;

  // Consent: keep what was captured at setup; a later event cannot erase it.
  const consent: ConsentEvidence = {
    termsVersion: existing?.consentTermsVersion ?? input.consent?.termsVersion ?? null,
    acceptanceRef: existing?.consentAcceptanceRef ?? input.consent?.acceptanceRef ?? null,
  };

  const mapped = mapProviderStatus(resource.provider, resource.rawStatus);
  let status: MandateStatus;
  let followUp: string | null = null;
  let replacedBy: string | null = existing?.replacedBy ?? null;

  if (resource.replacedByMandateRef) {
    if (input.successor && input.successor.id) {
      status = "replaced";
      replacedBy = input.successor.id;
    } else {
      // 0064 requires replaced_by for status 'replaced'; until the successor
      // is recorded (its own event), the old mandate is simply no longer
      // usable.
      status = "cancelled";
      followUp = `Provider reports replacement by ${resource.replacedByMandateRef}; record the successor mandate from its own resource state, then mark this row replaced.`;
    }
  } else if (mapped) {
    status = mapped;
  } else {
    status = "pending";
  }

  // Terminal states are sticky against a non-terminal fetch of equal age.
  if (
    existing &&
    isTerminalMandateStatus(existing.status) &&
    !isTerminalMandateStatus(status)
  )
    status = existing.status;

  // Hold reasons, in order of severity. Any one of them makes the mandate
  // unusable as collection authority.
  const holdReasons: string[] = [];
  if (!tenantId)
    holdReasons.push("orphan: no client could be tied to this mandate from our records");
  if (!hasConsent(consent))
    holdReasons.push(
      "no consent evidence: terms version and acceptance reference were not captured at setup"
    );
  if (!mapped && !resource.replacedByMandateRef)
    holdReasons.push(`unrecognised provider status "${resource.rawStatus}"`);
  // A previously held row stays held until staff release it, even if the
  // missing evidence has since appeared.
  if (existing?.heldForReview && existing.holdReason && !holdReasons.length)
    holdReasons.push(`${existing.holdReason} (release requires staff review)`);

  const heldForReview = holdReasons.length > 0;
  const holdReason = heldForReview ? holdReasons.join("; ") : null;

  const nowAuthorised = status === "authorised" || status === "active";
  const authorisedAt =
    existing?.authorisedAt ?? (nowAuthorised ? resource.fetchedAt : null);
  const cancelledAt =
    existing?.cancelledAt ??
    (status === "cancelled" || status === "replaced" || status === "failed"
      ? resource.fetchedAt
      : null);

  const row: MandateUpsert = {
    id: existing?.id ?? null,
    tenantId,
    provider: resource.provider,
    environment: resource.environment,
    customerRef: resource.customerRef ?? existing?.customerRef ?? null,
    billingRequestRef: resource.billingRequestRef ?? existing?.billingRequestRef ?? null,
    mandateRef: resource.mandateRef ?? existing?.mandateRef ?? null,
    status,
    consentTermsVersion: consent.termsVersion,
    consentAcceptanceRef: consent.acceptanceRef,
    heldForReview,
    holdReason,
    authorisedAt,
    cancelledAt,
    replacedBy,
    rawStatus: resource.rawStatus,
    lastProviderSyncAt: resource.fetchedAt,
  };

  // 0064 `mandates_usable_has_ref`: authorised/active needs a mandate ref.
  if ((row.status === "authorised" || row.status === "active") && !row.mandateRef) {
    row.status = "pending";
  }

  const op = existing ? "update" : "insert";
  return {
    ok: true,
    op,
    row,
    heldForReview,
    holdReason,
    followUp,
    audit: {
      action: heldForReview
        ? "billing.mandate_held_for_review"
        : `billing.mandate_${row.status}`,
      target: mandateTarget(existing?.id ?? null, resource),
      tenantId,
      metadata: {
        eventId: input.eventId,
        provider: resource.provider,
        environment: resource.environment,
        rawStatus: resource.rawStatus,
        status: row.status,
        op,
        holdReason,
        ...(followUp ? { followUp } : {}),
        // Stated explicitly in the audit row too.
        createdSubscription: false,
        createdActivation: false,
      },
    },
    never: NEVER,
  };
}

function mandateTarget(id: string | null, r: ProviderMandateResource): string {
  if (id) return `mandate:${id}`;
  return `mandate:${r.provider}:${r.environment}:${r.mandateRef ?? r.billingRequestRef ?? "unknown"}`;
}

/* ── Releasing a hold (staff decision, recorded evidence) ────────────────── */

export type HoldReleaseEvidence = {
  tenantId: string;
  consent: ConsentEvidence;
  /** Free-text reason recorded in the audit row. */
  reason: string;
  releasedBy: string;
  releasedAt: string;
};

export type HoldReleasePlan =
  | { ok: true; row: MandateUpsert; audit: MandateAudit; never: MandateNever }
  | {
      ok: false;
      reason: "flag_off" | "not_held" | "evidence_missing";
      detail: string;
      never: MandateNever;
    };

/**
 * Release a held mandate. Requires the tenant AND full consent evidence AND a
 * reason; there is no automatic path. The result is still only a mandate
 * row: releasing the hold makes the mandate eligible for the §8.3 gates, it
 * does not pass them.
 */
export function releaseMandateHold(
  existing: MandateRecord,
  evidence: HoldReleaseEvidence
): HoldReleasePlan {
  if (!flagOn("billingActivation"))
    return {
      ok: false,
      reason: "flag_off",
      detail: "billingActivation is off.",
      never: NEVER,
    };
  if (!existing.heldForReview)
    return {
      ok: false,
      reason: "not_held",
      detail: "The mandate is not held.",
      never: NEVER,
    };
  if (
    !evidence.tenantId ||
    !hasConsent(evidence.consent) ||
    !evidence.reason.trim() ||
    !evidence.releasedBy
  )
    return {
      ok: false,
      reason: "evidence_missing",
      detail:
        "Releasing a hold needs the client, the consent terms version, the acceptance reference, a reason and the releasing staff member.",
      never: NEVER,
    };
  // A previously bound mandate cannot be re-homed by the release.
  if (existing.tenantId && existing.tenantId !== evidence.tenantId)
    return {
      ok: false,
      reason: "evidence_missing",
      detail: "The mandate is already bound to a different client.",
      never: NEVER,
    };
  const row: MandateUpsert = {
    ...existing,
    tenantId: evidence.tenantId,
    consentTermsVersion: evidence.consent.termsVersion,
    consentAcceptanceRef: evidence.consent.acceptanceRef,
    heldForReview: false,
    holdReason: null,
  };
  return {
    ok: true,
    row,
    audit: {
      action: "billing.mandate_hold_released",
      target: `mandate:${existing.id}`,
      tenantId: evidence.tenantId,
      metadata: {
        releasedBy: evidence.releasedBy,
        releasedAt: evidence.releasedAt,
        reason: evidence.reason,
        previousHoldReason: existing.holdReason,
        usableAfterRelease: isMandateUsable(row),
        createdSubscription: false,
        createdActivation: false,
      },
    },
    never: NEVER,
  };
}
