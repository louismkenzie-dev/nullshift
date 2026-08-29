/**
 * Service & Support Terms — the version marker and the acknowledgements the
 * client's signature binds them to.
 *
 * The rendered documents live in the web app (an on-screen template and a PDF).
 * What lives HERE is what has to survive: the version string and the exact list
 * of things the client confirmed they understood, both written into the
 * `service_terms_signed` compliance record at signature. When the terms are
 * revised, bump the version — historic records keep pointing at the wording
 * that was actually agreed.
 */

export const SERVICE_TERMS_VERSION = "service-terms-v1-2026-08";

/** The clause-by-clause acknowledgements, stored verbatim with each signature. */
export const SERVICE_TERMS_ACKNOWLEDGEMENTS = [
  "Published prices are “from” figures; the binding rate is the monthly figure stated in the proposal (clause 1).",
  "Support covers keeping existing capability working and configuring it within its original design; response targets are targets, not guaranteed resolution times (clause 2).",
  "No plan level includes development work; new capability is quoted and invoiced as a separate fixed-price project (clause 3).",
  "Without a plan, the client is responsible for hosting, maintenance, security and running costs, and Nullshift is not liable for what follows (clause 4).",
  "A plan is a separate agreement from the build; cancelling it does not affect what the client owns (clause 5).",
] as const;

/** One-line summaries used where the full document would be too much. */
export const SERVICE_TERMS_SUMMARY =
  "What your monthly fee covers, what counts as support, how new work is quoted, and what happens if you don't take a plan.";
