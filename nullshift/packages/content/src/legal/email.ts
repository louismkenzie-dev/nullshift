/**
 * Email purpose classification (spec §15).
 *
 * Every send declares what it is. The distinction is not cosmetic: a
 * transactional message may be sent because someone asked for it, a
 * service-relationship message because there is a live contract, and a
 * marketing message only where a lawful permission exists and no suppression
 * applies.
 *
 * The most important rule here is the one that is easiest to break by
 * accident: marketing consent is NEVER inferred from the creation of a client
 * or user account. Someone signing a contract has not agreed to a newsletter.
 */

export type EmailPurpose = "transactional" | "service_relationship" | "marketing";

export const EMAIL_PURPOSES: {
  id: EmailPurpose;
  label: string;
  basis: string;
  examples: string[];
  /** Whether a recorded marketing permission is needed before sending. */
  needsMarketingPermission: boolean;
  /** Whether the message must carry an unsubscribe route. */
  needsUnsubscribe: boolean;
}[] = [
  {
    id: "transactional",
    label: "Transactional",
    basis:
      "Sent because the recipient did something that requires a reply — it completes an action they took.",
    examples: [
      "Account verification and password reset",
      "Booking or order confirmation",
      "Invoice, receipt and payment confirmation",
      "System alert about their own service",
    ],
    needsMarketingPermission: false,
    needsUnsubscribe: false,
  },
  {
    id: "service_relationship",
    label: "Service relationship",
    basis:
      "Sent because there is a live agreement and the recipient needs to know — not because we would like their attention.",
    examples: [
      "Price change notice",
      "Change Order awaiting their decision",
      "Subprocessor change notice",
      "Scheduled maintenance affecting their system",
      "Terms or policy update",
    ],
    needsMarketingPermission: false,
    needsUnsubscribe: false,
  },
  {
    id: "marketing",
    label: "Marketing",
    basis:
      "Sent to promote something. Needs a recorded lawful permission and an unsubscribe route, every time.",
    examples: [
      "Newsletters and updates",
      "Promotions and offers",
      "Cross-sell and upsell campaigns",
      "Event invitations",
    ],
    needsMarketingPermission: true,
    needsUnsubscribe: true,
  },
];

export const emailPurpose = (p: EmailPurpose) => EMAIL_PURPOSES.find((e) => e.id === p)!;

/**
 * The line staff get wrong most often, kept as one sentence so it can be shown
 * wherever a purpose is chosen.
 */
export const PURPOSE_RULE =
  "If the recipient would only want this because we want to sell them something, it is marketing — however useful it is. A contract or an account is not consent to be marketed to.";
