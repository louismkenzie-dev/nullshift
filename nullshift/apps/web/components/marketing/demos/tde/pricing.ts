/* Ported verbatim from The Dance Exclusive — src/lib/pricing.ts (main @ 99614da,
   read 2026-09-11). Do not edit here; re-port when the client ships a change.
   The numbers on the client-stories demo are computed by these functions. */

// Pricing engine for The Dance Exclusive, implementing the client's July 2026
// pricing document. This is the single client-side source of truth; the edge
// functions use the mirrored copy at supabase/functions/_shared/pricing.ts —
// KEEP THE TWO FILES IN SYNC.
//
// The structure (from the pricing document):
// - The year has 38 dance weeks (September–July). No payments in August.
// - Children: trial = price of one class; then Monthly Membership,
//   Pay Termly (5% off) or Pay Yearly (10% off — best deal). No drop-ins.
// - Adults: pay-as-you-go by duration, or multi-class passes. No sibling discount.
// - Additional weekly classes for the same child are charged at a lower rate.
// - Automatic 10% sibling discount for the second child onwards (children only).

export const DANCE_WEEKS_PER_YEAR = 38;
// Monthly membership = weekly price × 3.4, which reproduces the published
// prices exactly: £9/wk × 3.4 = £30.60 and £8/wk × 3.4 = £27.20.
export const MONTHLY_WEEKS_MULTIPLIER = 3.4;
export const YEARLY_UPFRONT_DISCOUNT = 0.1; // best deal
export const TERMLY_UPFRONT_DISCOUNT = 0.05; // second best deal
export const SIBLING_DISCOUNT = 0.1;
// "Unlimited £110 a month" — a per-child cap on combined monthly memberships.
export const UNLIMITED_MONTHLY_CAP = 110;

// Children's weekly class rate by duration (minutes).
const CHILD_WEEKLY_RATES: Record<number, number> = { 45: 8, 60: 9 };
// Rate for each additional weekly class for the same child.
const CHILD_ADDITIONAL_WEEKLY_RATES: Record<number, number> = { 45: 6.75, 60: 7.75 };
// Adult pay-as-you-go rate by duration (minutes).
const ADULT_SESSION_RATES: Record<number, number> = { 60: 10, 75: 12 };

export type AdultPassType = "week_2" | "pack_4" | "pack_6" | "pack_8";

export const ADULT_PASSES: Record<
  AdultPassType,
  {
    sessions: number;
    price: number;
    /** Validity window in days from purchase; null = same calendar week (Mon–Sun). */
    windowDays: number | null;
    label: string;
    description: string;
  }
> = {
  week_2: {
    sessions: 2,
    price: 20,
    windowDays: null,
    label: "2-Class Week Pass",
    description: "Any 2 classes in the same calendar week (Mon–Sun)",
  },
  pack_4: {
    sessions: 4,
    price: 40,
    windowDays: 42,
    label: "4-Class Pass",
    description: "Any 4 classes within 6 weeks of purchase",
  },
  pack_6: {
    sessions: 6,
    price: 55,
    windowDays: 42,
    label: "6-Class Pass",
    description: "Any 6 classes within 6 weeks of purchase",
  },
  pack_8: {
    sessions: 8,
    price: 70,
    windowDays: 42,
    label: "8-Class Pass",
    description: "Any 8 classes within 6 weeks of purchase",
  },
};

/** Days after an adult's birthday during which their free birthday class is valid. */
export const BIRTHDAY_CLASS_WINDOW_DAYS = 10;
/** Days BEFORE the birthday the offer opens — so the class in their actual
 *  birthday week qualifies even when it falls just before the day itself. */
export const BIRTHDAY_CLASS_EARLY_DAYS = 7;

export interface PricedClass {
  class_type: "children" | "adult";
  start_time: string | null;
  end_time: string | null;
  price_per_session: number | null;
  price_per_term: number | null;
  price_per_month: number | null;
  price_per_year: number | null;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

export const durationMinutes = (
  start: string | null,
  end: string | null
): number | null => {
  if (!start || !end) return null;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return null;
  const mins = eh * 60 + em - (sh * 60 + sm);
  return mins > 0 ? mins : null;
};

/** Pick the rate whose duration key is nearest to the class duration. */
const rateByDuration = (
  rates: Record<number, number>,
  duration: number | null
): number => {
  const entries = Object.entries(rates).map(([d, r]) => [Number(d), r] as const);
  if (duration == null) return entries[entries.length - 1][1];
  let best = entries[0];
  for (const entry of entries) {
    if (Math.abs(entry[0] - duration) < Math.abs(best[0] - duration)) best = entry;
  }
  return best[1];
};

/** The price of a single session/class, used for drop-ins (adults) and trials. */
export const sessionPrice = (cls: PricedClass): number => {
  if (cls.price_per_session != null && Number(cls.price_per_session) > 0) {
    return Number(cls.price_per_session);
  }
  const duration = durationMinutes(cls.start_time, cls.end_time);
  return cls.class_type === "adult"
    ? rateByDuration(ADULT_SESSION_RATES, duration)
    : rateByDuration(CHILD_WEEKLY_RATES, duration);
};

/** A trial class costs the price of one class. */
export const trialPrice = (cls: PricedClass): number => sessionPrice(cls);

/** Weekly rate when this is an ADDITIONAL class for a child already enrolled in one. */
export const childAdditionalWeeklyRate = (cls: PricedClass): number => {
  const duration = durationMinutes(cls.start_time, cls.end_time);
  return rateByDuration(CHILD_ADDITIONAL_WEEKLY_RATES, duration);
};

/** Monthly membership price for a child's first/only weekly class. */
export const monthlyPrice = (cls: PricedClass): number => {
  if (cls.price_per_month != null && Number(cls.price_per_month) > 0) {
    return Number(cls.price_per_month);
  }
  return round2(sessionPrice(cls) * MONTHLY_WEEKS_MULTIPLIER);
};

/** Monthly price when this is an additional weekly class for the same child. */
export const additionalMonthlyPrice = (cls: PricedClass): number =>
  round2(childAdditionalWeeklyRate(cls) * MONTHLY_WEEKS_MULTIPLIER);

/** Pay-yearly price when this is an ADDITIONAL weekly class for the same
 *  child — the additional-class weekly rate (e.g. £7.75/60-min) × 38 dance
 *  weeks, less the 10% yearly discount. Mirrors the monthly rule so paying
 *  yearly is never more expensive than monthly for multi-class children. */
export const additionalYearlyPrice = (cls: PricedClass): number =>
  round2(
    childAdditionalWeeklyRate(cls) * DANCE_WEEKS_PER_YEAR * (1 - YEARLY_UPFRONT_DISCOUNT)
  );

/** Pay-yearly upfront price — 38 weeks less the 10% yearly discount (best deal). */
export const yearlyPrice = (cls: PricedClass): number => {
  if (cls.price_per_year != null && Number(cls.price_per_year) > 0) {
    return Number(cls.price_per_year);
  }
  return round2(sessionPrice(cls) * DANCE_WEEKS_PER_YEAR * (1 - YEARLY_UPFRONT_DISCOUNT));
};

/** Pay-termly upfront price — the term's remaining sessions less 5% (second best deal). */
export const termPrice = (cls: PricedClass, remainingSessions: number): number | null => {
  if (cls.price_per_term != null && Number(cls.price_per_term) > 0) {
    return Number(cls.price_per_term);
  }
  if (!remainingSessions || remainingSessions <= 0) return null;
  return round2(sessionPrice(cls) * remainingSessions * (1 - TERMLY_UPFRONT_DISCOUNT));
};

export const yearlySavingsPercent = () => Math.round(YEARLY_UPFRONT_DISCOUNT * 100);
export const termlySavingsPercent = () => Math.round(TERMLY_UPFRONT_DISCOUNT * 100);

// ---------------------------------------------------------------------------
// Monthly membership composition — additional-class rates + the £110 cap.
// ---------------------------------------------------------------------------

export interface MonthlyItemInput {
  /** Cart item id — the key the result Map is keyed by (caller-specific). */
  id: string;
  /**
   * Stable per-(student, class) id used ONLY as the sort tie-break so client
   * and server order equal-priced memberships identically. The volatile cart
   * `id` must never drive ordering — it differs between the two sides and
   * would cause a per-item price_mismatch (409) at checkout.
   */
  classId: string;
  /** The child this membership is for. */
  studentId: string | null;
  /** Standard monthly price for the class (first-class rate). */
  fullMonthly: number;
  /** Monthly price at the additional-class rate. */
  additionalMonthly: number;
}

/** A child's memberships from PREVIOUS checkouts, counted so a class booked
 *  later still gets the additional-class rate and the £110 cap. */
export interface ExistingEnrolment {
  /** Live monthly memberships the child already holds. */
  count: number;
  /** Their combined monthly amount as billed (feeds the £110 cap). */
  monthlyTotal: number;
}

/**
 * Given every monthly-membership item in the basket, price each one: a child's
 * most expensive class is charged at the full rate and every further class at
 * the additional-class rate, with the combined total per child capped at the
 * £110 Unlimited price. Items for different children are independent.
 *
 * `existingByStudent` carries each child's LIVE memberships from previous
 * checkouts: if a child already holds one, every class in this basket is an
 * additional class, and the existing monthly total counts towards the £110
 * cap. Client and server both derive it from the same memberships rows, so
 * the two engines stay in lockstep.
 */
export const priceMonthlyItems = (
  items: MonthlyItemInput[],
  existingByStudent?: Map<string, ExistingEnrolment>
): Map<string, number> => {
  const result = new Map<string, number>();
  const byChild = new Map<string, MonthlyItemInput[]>();
  for (const item of items) {
    const key = item.studentId ?? `item:${item.id}`;
    const group = byChild.get(key) ?? [];
    group.push(item);
    byChild.set(key, group);
  }

  for (const group of byChild.values()) {
    // Most expensive class first — that one is full price. Tie-break on the
    // stable classId so both pricing engines agree on which item is "first".
    const sorted = [...group].sort(
      (a, b) => b.fullMonthly - a.fullMonthly || a.classId.localeCompare(b.classId)
    );
    const existing =
      (group[0].studentId && existingByStudent?.get(group[0].studentId)) || null;
    const rankOffset = existing?.count ?? 0;
    let total = round2(existing?.monthlyTotal ?? 0);
    sorted.forEach((item, index) => {
      let amount = index + rankOffset === 0 ? item.fullMonthly : item.additionalMonthly;
      // Cap the child's combined monthly total at the Unlimited price.
      if (total + amount > UNLIMITED_MONTHLY_CAP) {
        amount = round2(Math.max(0, UNLIMITED_MONTHLY_CAP - total));
      }
      total = round2(total + amount);
      result.set(item.id, amount);
    });
  }

  return result;
};

export interface YearlyItemInput {
  /** Cart item id — the key the result Map is keyed by (caller-specific). */
  id: string;
  /** Stable tie-break id so client and server order equal-priced items identically. */
  classId: string;
  /** The child this yearly booking is for. */
  studentId: string | null;
  /** Standard yearly price for the class (first-class rate). */
  fullYearly: number;
  /** Yearly price at the additional-class rate. */
  additionalYearly: number;
}

/**
 * Same additional-class rule as monthly, applied to pay-yearly items: per
 * child, the most expensive class is charged at the full yearly rate and
 * every further class at the additional-class yearly rate. (No Unlimited
 * cap — that is a monthly-membership product only.)
 *
 * `existingCountByStudent` counts the child's confirmed pay-yearly bookings
 * from earlier checkouts in the SAME dance year, so a later class still gets
 * the additional-class rate.
 */
export const priceYearlyItems = (
  items: YearlyItemInput[],
  existingCountByStudent?: Map<string, number>
): Map<string, number> => {
  const result = new Map<string, number>();
  const byChild = new Map<string, YearlyItemInput[]>();
  for (const item of items) {
    const key = item.studentId ?? `item:${item.id}`;
    const group = byChild.get(key) ?? [];
    group.push(item);
    byChild.set(key, group);
  }

  for (const group of byChild.values()) {
    const sorted = [...group].sort(
      (a, b) => b.fullYearly - a.fullYearly || a.classId.localeCompare(b.classId)
    );
    const rankOffset =
      (group[0].studentId && existingCountByStudent?.get(group[0].studentId)) || 0;
    sorted.forEach((item, index) => {
      result.set(
        item.id,
        index + rankOffset === 0 ? item.fullYearly : item.additionalYearly
      );
    });
  }

  return result;
};

// ---------------------------------------------------------------------------
// Automatic sibling discount — 10% for the second child onwards.
// ---------------------------------------------------------------------------

export interface SiblingItemInput {
  id: string;
  studentId: string | null;
  /** true when the attendee is the account holder's own (adult) profile. */
  isSelfStudent: boolean;
  classType: "children" | "adult";
  /** Whether the class/workshop has the sibling discount enabled (admin toggle). */
  siblingDiscountEnabled: boolean;
  totalPrice: number;
}

export interface SiblingDiscountResult {
  total: number;
  perItem: Map<string, number>;
  discountedChildIds: string[];
}

/**
 * 10% sibling discount on the second child and so forth, on all classes and
 * holiday workshops but never on adult bookings. The child with the highest
 * eligible spend in the basket is treated as the first child (full price);
 * every other child's eligible items get 10% off. If any OTHER child of the
 * family already has an active booking (`priorBookedChildIds` minus the
 * children in this basket), every child in the basket counts as a sibling.
 */
export const computeSiblingDiscount = (
  items: SiblingItemInput[],
  priorBookedChildIds: Iterable<string> = []
): SiblingDiscountResult => {
  const perItem = new Map<string, number>();
  const eligible = items.filter(
    (i) =>
      i.classType === "children" &&
      i.siblingDiscountEnabled &&
      i.studentId != null &&
      !i.isSelfStudent &&
      i.totalPrice > 0
  );

  const subtotals = new Map<string, number>();
  for (const item of eligible) {
    const key = item.studentId as string;
    subtotals.set(key, round2((subtotals.get(key) ?? 0) + item.totalPrice));
  }
  const cartChildIds = new Set(subtotals.keys());
  if (cartChildIds.size === 0) {
    return { total: 0, perItem, discountedChildIds: [] };
  }

  const hasPriorSibling = [...priorBookedChildIds].some((id) => !cartChildIds.has(id));

  // Highest-spending child first; deterministic tiebreak on id.
  const ranked = [...subtotals.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
  );
  const discounted = new Set(
    (hasPriorSibling ? ranked : ranked.slice(1)).map(([id]) => id)
  );

  let total = 0;
  for (const item of eligible) {
    if (!discounted.has(item.studentId as string)) continue;
    const discount = round2(item.totalPrice * SIBLING_DISCOUNT);
    perItem.set(item.id, discount);
    total = round2(total + discount);
  }

  return { total, perItem, discountedChildIds: [...discounted] };
};

// ---------------------------------------------------------------------------
// Copy shared across the booking UI.
// ---------------------------------------------------------------------------

export const MONTHLY_MEMBERSHIP_NOTICE =
  "By signing up for our monthly membership, you agree that if you wish to cancel, " +
  "we require one month's written notice. Cancellation requests must be sent by email to " +
  "hello@thedanceexclusive.co.uk before your membership can be cancelled.";

export const MONTHLY_PAYMENT_INFO =
  "Your first month is paid when you join, then payments come out on the 5th of each month. " +
  "You pay 11 months a year — your 12th month is free (for September starters that's August). " +
  "Join during August and you pay nothing until 5 September.";

export const UNLIMITED_CAP_INFO =
  "£110 Unlimited: once a child's monthly memberships reach £110 a month, that's the cap — " +
  "every extra class for them is included at no extra charge.";

export const ADULT_CANCELLATION_INFO =
  "Adult classes are non-refundable, but you can move your booking to another date " +
  "up to 24 hours before the class start time.";
