// Shared formatting + business defaults.
// Nullshift is a London-based company: all currency is GBP and all call
// times are treated as London (Europe/London) wall-clock time.

export const LONDON_TZ = "Europe/London";

/** A human-friendly proposal reference derived from its UUID, e.g. "NS-6B16CD56".
 *  Stable for a given proposal — used for invoicing and on the proposal document. */
export const proposalRef = (id: string) => `NS-${id.slice(0, 8).toUpperCase()}`;

/** Format a number as GBP, e.g. £1,000.00 */
export const money = (n: number, currency = "GBP") =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(n);

/** Format a "YYYY-MM-DD" date string in UK style, e.g. "Mon 9 Jun 2026". */
export function formatCallDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  }).format(dt);
}

/** A "HH:MM" 24h time string shown with a London label, e.g. "14:30 (London)". */
export function formatCallTime(time: string): string {
  return `${time} (London)`;
}

/**
 * Default line items for a standard website build proposal.
 * Recommended price level — totals exactly £1,000 before any extras.
 */
export const WEBSITE_BUILD_ITEMS: { label: string; qty: number; unit_price: number }[] = [
  { label: "Up to 12 pages", qty: 1, unit_price: 250 },
  { label: "Advanced UI/UX design", qty: 1, unit_price: 200 },
  { label: "CMS integration (blog, products)", qty: 1, unit_price: 150 },
  { label: "Contact & booking forms", qty: 1, unit_price: 80 },
  { label: "Advanced SEO & performance", qty: 1, unit_price: 120 },
  { label: "Analytics setup", qty: 1, unit_price: 50 },
  { label: "3 rounds of revisions", qty: 1, unit_price: 80 },
  { label: "60-day post-launch support", qty: 1, unit_price: 70 },
];
