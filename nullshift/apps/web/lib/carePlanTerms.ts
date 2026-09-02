/**
 * Care-plan subscription terms — what the client agrees to before a Direct
 * Debit is set up. A summary the client reads on the confirm step, governed by
 * the Client Services framework at /legal/client-services (MSA + schedules).
 *
 * Versioned like every other legal artefact: the version accepted is stored on
 * the tenant and on the subscription, with the time and the user, so a
 * dispute can be answered with "this wording, this person, this moment".
 * Change the wording → bump the version; never edit a version in place.
 */
export const CARE_PLAN_TERMS_VERSION = "CARE_TERMS_2026_09_v1";

export const CARE_PLAN_TERMS_URL = "/legal/client-services";

export const CARE_PLAN_TERMS_POINTS: readonly string[] = [
  "A rolling monthly service. The monthly amount shown is what you pay, collected by Direct Debit around the same date each month.",
  "Your plan covers the service level described for it — hosting, maintenance, support and the technical partnership — not new feature development, which is always quoted separately.",
  "Your price is set from the scale of your system. If that scale changes materially we tell you in writing before any change to your monthly amount takes effect.",
  "You can cancel at any time from your portal or by emailing us; your plan runs to the end of the period already paid for and no further collections are taken.",
  "Direct Debits are protected by the Direct Debit Guarantee: if an error is made in the payment of your Direct Debit you are entitled to a full and immediate refund from your bank or building society.",
  "The Client Services framework (Master Services Agreement, Managed Services Schedule and Payments Schedule) governs the plan; this summary does not replace it.",
];

export const CARE_PLAN_TERMS_STATEMENT =
  "I have read the summary above and agree to the care plan terms and the Client Services framework on behalf of my organisation.";

/** The server accepts nothing but the current version — an old confirm page must re-agree. */
export function termsAcceptanceValid(input: {
  accepted: unknown;
  version: unknown;
}): boolean {
  return (
    (input.accepted === "on" || input.accepted === true) &&
    input.version === CARE_PLAN_TERMS_VERSION
  );
}
