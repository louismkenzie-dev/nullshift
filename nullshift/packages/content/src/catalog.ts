/**
 * The buildable module catalog — the single source of truth for what Nullshift
 * builds and what each module costs. Shared by the admin proposal builder
 * (`/admin/delivery/[id]`) and the public "free plan" Build Blueprint generator
 * (`blueprint.ts`), so the lead magnet and the real proposal can never drift on
 * scope or price. `asset` keys which on-screen panel represents the module in the
 * personalised system preview (`apps/web/components/funnel/SystemPreview.tsx`).
 */

export type AssetKey =
  | "site"
  | "booking"
  | "records"
  | "reminders"
  | "payments"
  | "portal"
  | "forms"
  | "recall"
  | "migration";

export type BuildModule = {
  /** Stable id used by the blueprint selector. */
  key: string;
  /** Display name (clinic-worded; the blueprint relabels for non-clinic). */
  name: string;
  /** One-off build price, GBP. */
  price: number;
  /** Which preview panel represents this module. */
  asset: AssetKey;
};

export const CATALOG: BuildModule[] = [
  { key: "site", name: "Website front-end", price: 300, asset: "site" },
  { key: "booking", name: "Online booking", price: 500, asset: "booking" },
  { key: "records", name: "Patient records", price: 500, asset: "records" },
  { key: "reminders", name: "Automated reminders", price: 300, asset: "reminders" },
  { key: "payments", name: "Patient payments (Stripe)", price: 400, asset: "payments" },
  { key: "portal", name: "Client portal", price: 400, asset: "portal" },
  { key: "forms", name: "Intake & consent forms", price: 250, asset: "forms" },
  { key: "recall", name: "Recall & follow-up", price: 250, asset: "recall" },
  { key: "migration", name: "Data migration", price: 350, asset: "migration" },
];

export const moduleByKey = (key: string): BuildModule | undefined =>
  CATALOG.find((m) => m.key === key);
