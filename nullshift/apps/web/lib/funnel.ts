/** Lead-qualification quiz funnel — single source of truth.
 *
 *  Shared between the public /start funnel (`app/start/*`), the lead-sink
 *  endpoint (`app/api/funnel/route.ts`), and the admin viewer. Edit the funnel
 *  here — questions, options, score weights, thresholds, recommendation copy —
 *  without touching component logic. Mirrors the convention of `lib/brief.ts`.
 */

/* ── Types ──────────────────────────────────────────────────────── */

export type Stage = 1 | 2; // 1 = hook (start simple) · 2 = filter / qualify

export type FunnelOption = {
  id: string;
  label: string;
  desc?: string;
  /** Lead-scoring weight. Omitted/0 = unscored (hook + trust questions). */
  score?: number;
  /** Selecting reveals a free-text input (stored at `<stepId>_other`). */
  other?: boolean;
};

export type FunnelStep = {
  /** Answer key — stable id used in `answers`, the URL, and storage. */
  id: string;
  stage: Stage;
  question: string;
  help?: string;
  /** Trust / personalisation questions can be skipped and carry no score. */
  optional?: boolean;
  /** Conditional questions only appear when this predicate passes. */
  showIf?: (a: Answers) => boolean;
  options: FunnelOption[];
};

export type Answers = Record<string, string>;
export type Segment = "qualified" | "nurture";

export type Recommendation = {
  /** Human service phrase, e.g. "a brand-new website". */
  service: string;
  /** Budget band label, e.g. "£3k–£8k". */
  budgetBand: string;
  /** Timeline label, e.g. "as soon as possible". */
  timeline: string;
  /** Suggested next product/plan in plain language. */
  planSuggestion: string;
  /** Personalised result headline + body (segment-aware). */
  headline: string;
  body: string;
};

/* ── Funnel content (the only thing you usually edit) ───────────── */

export const STEPS: FunnelStep[] = [
  // ── Stage 1 — the hook (near-impossible to refuse, unscored) ──
  {
    id: "has_site",
    stage: 1,
    question: "Do you currently have a website for your business?",
    help: "No wrong answer — this just helps us tailor things.",
    options: [
      { id: "yes", label: "Yes, I have one" },
      { id: "no", label: "Not yet" },
    ],
  },

  // ── Personalisation (unscored — makes it feel bespoke) ──
  {
    id: "industry",
    stage: 2,
    question: "What kind of business are you?",
    help: "Pick the closest — we tailor everything to your world.",
    options: [
      { id: "trades", label: "Trades", desc: "Builder, plumber, electrician…" },
      { id: "salon", label: "Salon & beauty", desc: "Hair, nails, aesthetics" },
      { id: "wellness", label: "Health & wellness", desc: "Gym, coach, nutrition" },
      { id: "therapy", label: "Therapy / clinic", desc: "Therapist, physio, dental" },
      { id: "hospitality", label: "Hospitality", desc: "Café, restaurant, venue" },
      { id: "professional", label: "Professional services", desc: "Legal, finance, consulting" },
      { id: "retail", label: "Retail / e-commerce", desc: "A shop or online store" },
      { id: "other", label: "Something else", other: true },
    ],
  },

  // ── Conditional context — only if they already have a site (unscored) ──
  {
    id: "provider",
    stage: 2,
    showIf: (a) => a.has_site === "yes",
    question: "Who's your current site with?",
    help: "Helps us see exactly what we'd be working with.",
    options: [
      { id: "wix", label: "Wix" },
      { id: "squarespace", label: "Squarespace" },
      { id: "wordpress", label: "WordPress" },
      { id: "shopify", label: "Shopify" },
      { id: "godaddy", label: "GoDaddy" },
      { id: "agency", label: "A freelancer or agency" },
      { id: "unsure", label: "Not sure" },
      { id: "other", label: "Other", other: true },
    ],
  },
  {
    id: "build",
    stage: 2,
    showIf: (a) => a.has_site === "yes",
    question: "How was it built?",
    options: [
      { id: "self", label: "I built it myself" },
      { id: "agency", label: "A freelancer or agency built it" },
      { id: "template", label: "A template or page-builder" },
      { id: "bundled", label: "It came with my booking tool" },
      { id: "unsure", label: "Not sure" },
    ],
  },
  {
    id: "costs",
    stage: 2,
    showIf: (a) => a.has_site === "yes",
    question: "What do you pay to keep it running?",
    help: "A rough idea is fine — it helps us compare like for like.",
    options: [
      { id: "monthly", label: "A monthly subscription" },
      { id: "commission", label: "Commission or per-booking fees" },
      { id: "annual", label: "Annual hosting + domain" },
      { id: "developer", label: "I pay a developer ongoing" },
      { id: "nothing", label: "Nothing / not sure" },
    ],
  },

  // ── Stage 2 — filter / qualify (scored) ──
  {
    id: "need",
    stage: 2,
    question: "What do you need most right now?",
    options: [
      { id: "new", label: "A new website", desc: "Build from scratch", score: 2 },
      { id: "redesign", label: "A redesign", desc: "Refresh what I have", score: 2 },
      { id: "branding", label: "Branding", desc: "Logo, identity, guidelines", score: 1 },
      { id: "ongoing", label: "Ongoing dev support", desc: "Build & run it for me", score: 3 },
    ],
  },
  {
    id: "budget",
    stage: 2,
    question: "Roughly what budget are you working with?",
    help: "A ballpark is fine — it helps us scope the right solution.",
    options: [
      { id: "under1k", label: "Under £1k", score: 0 },
      { id: "1to3k", label: "£1k – £3k", score: 2 },
      { id: "3to8k", label: "£3k – £8k", score: 4 },
      { id: "8kplus", label: "£8k+", score: 5 },
    ],
  },
  {
    id: "timeline",
    stage: 2,
    question: "When are you looking to start?",
    options: [
      { id: "asap", label: "As soon as possible", score: 3 },
      { id: "1to3mo", label: "In 1 – 3 months", score: 2 },
      { id: "exploring", label: "Just exploring", score: 0 },
    ],
  },
  // Trust / personalisation — unscored, skippable.
  {
    id: "blocker",
    stage: 2,
    question: "What's holding you back the most?",
    help: "Optional — tell us where it hurts and we'll speak to it.",
    optional: true,
    options: [
      { id: "outdated", label: "It looks outdated" },
      { id: "noleads", label: "It doesn't bring in leads" },
      { id: "hardupdate", label: "It's hard to update" },
      { id: "nothing", label: "Nothing — starting fresh" },
    ],
  },
];

/* ── Scoring thresholds (tune here) ─────────────────────────────── */

/** Minimum total score to be routed to the qualified (booking) path. */
export const QUALIFY_THRESHOLD = 6;
/** Budgets that hard-route to nurture regardless of score. */
export const NURTURE_BUDGETS = ["under1k"];

/* ── Helpers ────────────────────────────────────────────────────── */

/** Human label for an option id within a step, falling back to the id. */
export function optionLabel(stepId: string, optionId: string | undefined): string {
  if (!optionId) return "";
  const step = STEPS.find((s) => s.id === stepId);
  return step?.options.find((o) => o.id === optionId)?.label ?? optionId;
}

/** The steps shown for a given answer set (conditional questions resolved). */
export function visibleSteps(a: Answers): FunnelStep[] {
  return STEPS.filter((s) => !s.showIf || s.showIf(a));
}

/** Steps that must be answered before a lead can reach the result. */
export function requiredSteps(a: Answers): FunnelStep[] {
  return visibleSteps(a).filter((s) => !s.optional);
}

/** Display value for an answer — uses the typed free-text for "Other". */
export function answerLabel(answers: Answers, stepId: string): string {
  const v = answers[stepId];
  if (v === "other" && answers[`${stepId}_other`]) return answers[`${stepId}_other`];
  return optionLabel(stepId, v);
}

const STEP_TITLES: Record<string, string> = {
  has_site: "Has a website",
  industry: "Industry",
  provider: "Current platform",
  build: "Built by",
  costs: "Ongoing costs",
  need: "What they need",
  budget: "Budget",
  timeline: "Timeline",
  blocker: "Biggest blocker",
};

/** A tailored, human-readable summary of everything the lead told us —
 *  used in the result page and the branded emails. */
export function answeredSummary(answers: Answers): { label: string; value: string }[] {
  return visibleSteps(answers)
    .filter((s) => answers[s.id])
    .map((s) => ({ label: STEP_TITLES[s.id] ?? s.id, value: answerLabel(answers, s.id) }));
}

/* ── Recommendation builder ─────────────────────────────────────── */

const SERVICE_PHRASE: Record<string, string> = {
  new: "a brand-new website",
  redesign: "a redesign of your site",
  branding: "a fresh brand identity",
  ongoing: "a build-and-run partnership",
};

const PLAN_QUALIFIED: Record<string, string> = {
  new: "a Foundation build plus a Growth plan to bring the work in",
  redesign: "a rebuild plus a Growth plan that keeps it converting",
  branding: "a brand sprint, with a website to put it to work",
  ongoing: "a monthly care plan — we build it and run it for you",
};

/** Free lead-magnet resource matched to what the visitor needs. */
const RESOURCE_NAME: Record<string, string> = {
  new: "Website Launch Kit",
  redesign: "Website Redesign Checklist",
  branding: "Brand Starter Kit",
  ongoing: "Systems & Automation Playbook",
};

/** The free resource we offer for a given answer set. */
export function resourceName(answers: Answers): string {
  return RESOURCE_NAME[answers.need] ?? "Growth Starter Kit";
}

function recommendationFor(answers: Answers, segment: Segment): Recommendation {
  const service = SERVICE_PHRASE[answers.need] ?? "a bespoke website";
  const budgetBand = optionLabel("budget", answers.budget) || "your budget";
  const timeline = optionLabel("timeline", answers.timeline).toLowerCase() || "your timeline";

  if (segment === "qualified") {
    return {
      service,
      budgetBand,
      timeline,
      planSuggestion: PLAN_QUALIFIED[answers.need] ?? "a bespoke build plus a Growth plan",
      headline: "You're a great fit.",
      body: `Based on your answers, we'd recommend ${service} — most likely ${
        PLAN_QUALIFIED[answers.need] ?? "a bespoke build plus a Growth plan"
      }. Let's get you on a quick discovery call to map it out.`,
    };
  }

  return {
    service,
    budgetBand,
    timeline,
    planSuggestion: "a free starter resource to move things forward today",
    headline: "Here's a smart first step.",
    body: `Whether you're early or weighing options, you don't have to wait. We've put together a free resource to help you get ${service} moving — grab it below and we'll keep useful tips coming.`,
  };
}

/* ── The scoring + routing function (pure, testable) ────────────── */

export function scoreLead(answers: Answers): {
  score: number;
  segment: Segment;
  recommendation: Recommendation;
} {
  let score = 0;
  for (const step of STEPS) {
    const opt = step.options.find((o) => o.id === answers[step.id]);
    if (opt?.score) score += opt.score;
  }

  const qualified =
    score >= QUALIFY_THRESHOLD && !NURTURE_BUDGETS.includes(answers.budget);
  const segment: Segment = qualified ? "qualified" : "nurture";

  return { score, segment, recommendation: recommendationFor(answers, segment) };
}
