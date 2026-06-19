/**
 * buildBlueprint — the "Get my free plan" lead magnet, generated deterministically
 * from the funnel answers with zero human input. Produces a personalised, itemised,
 * priced build (the hero), a supporting savings estimate, payback + timeline, and
 * pain-specific quick wins. It is effectively a self-serve first draft of the real
 * itemised proposal (admin `/delivery/[id]`), so it pre-sells.
 *
 * Pure + app-agnostic: takes a plain answers record (no dependency on the web app's
 * funnel types) so it can run on the server (persist + email) and the client
 * (instant on-screen render) from the same source.
 */
import { CATALOG, type BuildModule } from "./catalog";
import { estimateSavings, KEEP_PCT, type Savings } from "./savings";
import { CLINIC } from "./marketing";

export type BlueprintAnswers = Record<string, string>;
export type Segment = "qualified" | "nurture";

export type BlueprintModule = {
  name: string;
  price: number;
  why: string;
  asset: string;
};
export type BlueprintTier = {
  tier: string;
  setup: string;
  monthly: string;
  why: string;
};

export type Blueprint = {
  vertical: string;
  isClinic: boolean;
  /** What to call the prospect's business in copy ("Your clinic" / their name). */
  businessLabel: string;
  modules: BlueprintModule[];
  oneOffTotal: number;
  tier: BlueprintTier;
  savings: Savings;
  /** Months for the build to pay for itself vs the rent saved (null if unknown). */
  paybackMonths: number | null;
  timelineWeeks: string;
  quickWins: string[];
  segment: Segment;
};

const CLINIC_VERTICALS = new Set(["clinic"]);

/** Short "why this for you" line per module. */
const WHY: Record<string, string> = {
  site: "A fast, bespoke booking site you own — built to turn visitors into booked appointments.",
  booking:
    "24/7 online booking with deposits, synced to your calendar — your diary fills itself.",
  records:
    "Notes, history and intake in one place — GDPR-safe, UK-hosted, and yours to export.",
  reminders:
    "Automatic SMS + email reminders and rebooking nudges — the proven way to cut no-shows.",
  payments:
    "Take deposits and balances through your own Stripe — at a fraction of the usual cut.",
  portal: "A branded portal where clients log in, rebook and manage their details.",
  forms: "Digital intake and consent, signed before they arrive — no paper, no admin.",
  recall:
    "Automated recall and follow-up brings clients back on time, without you chasing.",
  migration:
    "We move your data and bookings across from your current tools — with no downtime.",
};

/** Pain-keyed quick wins (2–3 concrete, specific). */
const QUICK_WINS: Record<string, string[]> = {
  noshows: [
    "Deposits at booking plus SMS reminders typically cut no-shows by 50–70%.",
    "Waitlist auto-fill quietly rebooks cancellations before the slot goes cold.",
  ],
  reminders: [
    "Automatic reminders and rebooking nudges replace the manual chase entirely.",
    "Recall brings clients back on schedule without you lifting a finger.",
  ],
  tools: [
    "Replace 4–5 subscriptions with one system you own — one login, one bill that stops growing.",
    "Booking, records and payments talk to each other — no more copy-paste between tools.",
  ],
  payments: [
    "Take deposits and balances on your own Stripe at a fraction of the usual cut.",
    "Automated payment chasing means fewer awkward conversations and faster cash.",
  ],
  records: [
    "Digital intake and consent, signed before they arrive — paperless and GDPR-safe.",
    "Notes, history and forms in one owned, exportable place.",
  ],
};

const DEFAULT_WINS = [
  "One system you own outright — no per-practitioner fees that grow as you hire.",
  "Your data and accounts stay yours, exportable any time — never a vendor's hostage.",
];

/** Deterministic module selection from the answers. */
function selectModuleKeys(a: BlueprintAnswers, isClinic: boolean): string[] {
  const keys = new Set<string>(["site", "booking"]); // base for everyone

  switch (a.admin_pain) {
    case "noshows":
    case "reminders":
      keys.add("reminders").add("payments");
      break;
    case "payments":
      keys.add("payments");
      break;
    case "records":
      keys.add("records").add("forms");
      break;
    case "tools":
      keys.add("records").add("portal");
      break;
  }

  if (a.need === "ongoing") keys.add("reminders").add("recall");
  if (isClinic) keys.add("records").add("recall");
  else keys.add("portal");
  if (a.has_site === "yes") keys.add("migration");

  // Keep catalog order so the build reads top-to-bottom the way we'd build it.
  return CATALOG.filter((m) => keys.has(m.key)).map((m) => m.key);
}

/** Clinic-worded names soften to "Client …" for non-clinic verticals. */
function moduleName(m: BuildModule, isClinic: boolean): string {
  if (isClinic) return m.name;
  return m.name.replace("Patient", "Client");
}

function pickTier(a: BlueprintAnswers): BlueprintTier {
  const plans = CLINIC.plans;
  let idx = 0; // Foundation
  if (a.budget === "8kplus") idx = 2;
  else if (a.budget === "3to8k") idx = 1;
  if (a.need === "ongoing" && idx < 1) idx = 1; // run-it-for-me wants the report tier
  const p = plans[Math.min(idx, plans.length - 1)];
  const why =
    p.tier === "Pro"
      ? "Matches your budget and adds custom automations, a client portal and a quarterly review."
      : p.tier === "Growth"
        ? "The sweet spot for your scope — records, rebooking and your monthly savings report."
        : "A lean start you own outright, with hosting, backups and updates handled.";
  return { tier: p.tier, setup: p.setup, monthly: p.monthly, why };
}

const TIMELINE_WEEKS: Record<string, string> = {
  asap: "2–4 weeks",
  "1to3mo": "3–5 weeks",
  exploring: "4–6 weeks",
};

/** Parse "£99" → 99. */
function poundsToNumber(s: string): number {
  const n = Number(String(s).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function buildBlueprint(
  a: BlueprintAnswers,
  opts: { segment: Segment; businessName?: string }
): Blueprint {
  const vertical = a.industry || "business";
  const isClinic = CLINIC_VERTICALS.has(vertical);
  const businessLabel =
    opts.businessName?.trim() || (isClinic ? "Your clinic" : "Your business");

  const modules: BlueprintModule[] = selectModuleKeys(a, isClinic).map((key) => {
    const m = CATALOG.find((x) => x.key === key)!;
    return {
      name: moduleName(m, isClinic),
      price: m.price,
      why: WHY[key],
      asset: m.asset,
    };
  });
  const oneOffTotal = modules.reduce((s, m) => s + m.price, 0);

  const tier = pickTier(a);
  const savings = estimateSavings({
    spendBand: a.software_spend,
    practitionerBand: a.practitioners,
    isClinic,
  });

  // Payback vs the gross annual rent they stop paying by owning (care plan shown
  // separately). Null when there's nothing meaningful to recover.
  const monthlySaved = savings.kept / 12;
  const paybackMonths =
    monthlySaved > 0 ? Math.max(1, Math.ceil(oneOffTotal / monthlySaved)) : null;

  const quickWins = (QUICK_WINS[a.admin_pain] ?? DEFAULT_WINS).slice(0, 3);
  // Keep the care monthly referenced so unused-var linters stay quiet and the
  // figure is available to callers that want net payback later.
  void poundsToNumber(tier.monthly);
  void KEEP_PCT;

  return {
    vertical,
    isClinic,
    businessLabel,
    modules,
    oneOffTotal,
    tier,
    savings,
    paybackMonths,
    timelineWeeks: TIMELINE_WEEKS[a.timeline] ?? "2–4 weeks",
    quickWins,
    segment: opts.segment,
  };
}
