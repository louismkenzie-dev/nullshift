/* Ported verbatim from The Dance Exclusive — src/lib/bookingBreakdown.ts (main @
   99614da, read 2026-09-11). Do not edit here; re-port when the client ships a change. */

/**
 * Reconstructs, for the admin bookings page, how a booking's amount was
 * arrived at — base plan price, then any discount — so the studio can see at
 * a glance what a family paid for and why.
 *
 * Bookings only store the final amount, so the derivation re-runs the pricing
 * engine and checks the stored amount against it. A line item is only ever
 * asserted when the numbers reconcile EXACTLY; anything else gets an honest
 * "doesn't match today's standard price" note instead of an invented
 * discount. (Coupons, price changes since booking, and £110-cap top-ups all
 * legitimately produce amounts the engine can't reproduce today.)
 */
import {
  additionalMonthlyPrice,
  additionalYearlyPrice,
  monthlyPrice,
  round2,
  sessionPrice,
  SIBLING_DISCOUNT,
  termPrice,
  trialPrice,
  yearlyPrice,
  type PricedClass,
} from "./pricing";

export interface PriceLine {
  label: string;
  /** Positive for charges, negative for discounts, null for notes. */
  amount: number | null;
  kind: "base" | "discount" | "note" | "total";
}

export interface PriceBreakdown {
  lines: PriceLine[];
  /** True when the stored amount is fully explained by the lines above. */
  reconciled: boolean;
}

/** The Stripe payment reference inside a booking's notes, if any. */
export const paymentRefOf = (notes: string | null | undefined): string | null =>
  notes?.match(/pi_[A-Za-z0-9]+/)?.[0] ?? null;

/** The session date a dated (trial / pay-as-you-go) booking is for. */
export const sessionDateOf = (notes: string | null | undefined): string | null =>
  notes?.match(/session (\d{4}-\d{2}-\d{2})/)?.[1] ?? null;

/** "£refunded £12.00" markers the refund flow appends to notes. */
export const refundNoteOf = (notes: string | null | undefined): string | null =>
  notes?.match(/refunded £[\d.]+[^|]*/)?.[0]?.trim() ?? null;

const eq = (a: number, b: number) => Math.abs(a - b) < 0.005;

interface BaseCandidate {
  label: string;
  price: number;
}

/** Every base price the engine could have charged for this plan. */
const baseCandidates = (
  plan: string,
  cls: PricedClass,
  sessionCount: number
): BaseCandidate[] => {
  switch (plan) {
    case "trial":
      return [{ label: "Trial class", price: trialPrice(cls) }];
    case "session":
      return [{ label: "Single class (pay as you go)", price: sessionPrice(cls) }];
    case "term": {
      const set = cls.price_per_term != null && Number(cls.price_per_term) > 0;
      const price = termPrice(cls, sessionCount);
      return price != null
        ? [
            {
              label: set
                ? "Termly price (set by the studio)"
                : `Termly: £${sessionPrice(cls).toFixed(2)} × ${sessionCount} sessions, less 5%`,
              price,
            },
          ]
        : [];
    }
    case "yearly":
      return [
        { label: "Yearly price (10% off)", price: yearlyPrice(cls) },
        { label: "Yearly, additional-class rate", price: additionalYearlyPrice(cls) },
      ];
    case "monthly":
      return [
        { label: "Monthly membership", price: monthlyPrice(cls) },
        { label: "Monthly, additional-class rate", price: additionalMonthlyPrice(cls) },
      ];
    default:
      return [];
  }
};

export const derivePriceBreakdown = (
  plan: string,
  amountPaid: number,
  cls: PricedClass | null,
  sessionCount: number
): PriceBreakdown => {
  const paid = round2(Number(amountPaid) || 0);

  // A £0 monthly membership means the child hit the £110 Unlimited cap —
  // the class is included, nothing extra is charged.
  if (plan === "monthly" && paid === 0) {
    return {
      reconciled: true,
      lines: [
        {
          label: "Included under £110 Unlimited — child's memberships already at the cap",
          amount: 0,
          kind: "base",
        },
        { label: "Paid", amount: 0, kind: "total" },
      ],
    };
  }

  if (!cls) {
    return {
      reconciled: false,
      lines: [{ label: "Paid", amount: paid, kind: "total" }],
    };
  }

  for (const base of baseCandidates(plan, cls, sessionCount)) {
    const b = round2(base.price);
    if (eq(paid, b)) {
      return {
        reconciled: true,
        lines: [
          { label: base.label, amount: b, kind: "base" },
          { label: "No discount applied", amount: null, kind: "note" },
          { label: "Paid", amount: paid, kind: "total" },
        ],
      };
    }
    if (eq(paid, round2(b * (1 - SIBLING_DISCOUNT)))) {
      return {
        reconciled: true,
        lines: [
          { label: base.label, amount: b, kind: "base" },
          { label: "Sibling discount (10%)", amount: round2(paid - b), kind: "discount" },
          { label: "Paid", amount: paid, kind: "total" },
        ],
      };
    }
  }

  return {
    reconciled: false,
    lines: [
      { label: "Paid", amount: paid, kind: "total" },
      {
        label:
          "Doesn't match today's standard price for this plan — the class price may have " +
          "changed since booking, or a coupon / £110-cap adjustment applied.",
        amount: null,
        kind: "note",
      },
    ],
  };
};
