/**
 * Estimate a prospect's rented-software cost and what they'd stop paying by
 * owning the system — the supporting figure in the Build Blueprint. Mirrors the
 * `saas-bill` maths in `packages/ui/RevenueCalculator` (annual = monthly × 12;
 * kept = annual × keep%), but band-driven so it runs purely from funnel answers.
 * Figures are estimates and should always be labelled as such in the UI.
 */

/** Representative monthly spend (GBP) for each funnel software-spend band. */
const BAND_MONTHLY: Record<string, number> = {
  under50: 35,
  "50to150": 100,
  "150to400": 275,
  "400plus": 550,
  unsure: 0,
};

/** Representative practitioner count for each (clinic-only) band. */
const SEATS: Record<string, number> = {
  "1": 1,
  "2to3": 2,
  "4to6": 5,
  "7plus": 8,
};

/** Share of the rented bill that stops when you own the system outright. */
export const KEEP_PCT = 0.7;

export type Savings = {
  /** Estimated current monthly software spend, GBP. */
  monthlyRent: number;
  /** Estimated annual software spend, GBP. */
  annualRent: number;
  /** Annual amount that stops when they own the system, GBP. */
  kept: number;
  keepPct: number;
  /** Resolved practitioner count, when known (clinics). */
  seats?: number;
  /** Estimated monthly cost per practitioner, when seats known. */
  perSeat?: number;
  /** Always true — these are band-derived estimates. */
  estimated: true;
};

export function estimateSavings(opts: {
  spendBand?: string;
  practitionerBand?: string;
  isClinic?: boolean;
}): Savings {
  const seats = opts.practitionerBand ? SEATS[opts.practitionerBand] : undefined;

  let monthly = BAND_MONTHLY[opts.spendBand ?? ""] ?? 0;
  // "Not sure" / unset: infer from seats (≈£60/practitioner) or a vertical floor.
  if (!monthly && seats) monthly = seats * 60;
  if (!monthly) monthly = opts.isClinic ? 200 : 120;

  const annualRent = monthly * 12;
  const kept = Math.round(annualRent * KEEP_PCT);
  const perSeat = seats ? Math.round(monthly / seats) : undefined;

  return {
    monthlyRent: monthly,
    annualRent,
    kept,
    keepPct: KEEP_PCT,
    seats,
    perSeat,
    estimated: true,
  };
}
