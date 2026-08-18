/**
 * Public pricing ladder — the four tiers shown on /pricing.
 *
 * This is the marketing-facing source of truth: the "from" prices a visitor
 * sees, who each tier is for, and — the bit the cards reveal on hover — exactly
 * what a tier adds over the one below it.
 *
 * It is deliberately separate from `apps/web/lib/carePlans.ts`, which is the
 * BILLING catalogue: plan ids stored on `subscriptions.plan`, and the standard
 * contracted amount we actually charge. The public numbers here are floors
 * ("from £30"), so a quoted plan is always at or above them. `planId` ties each
 * public tier back to its billing plan so the two can never drift apart
 * silently.
 */

export type PlanFeature = {
  text: string;
  /** false renders the row struck through with a ✕ — what this tier does NOT include. */
  included: boolean;
};

export type TierUpgrade = {
  /** Panel heading, e.g. "What Pro adds over Core". */
  title: string;
  /** Trigger label — kept short so it never wraps and the cards stay aligned. */
  short: string;
  /** One line framing the jump. */
  lead: string;
  points: { title: string; body: string }[];
};

export type PricingTier = {
  id: "core" | "pro" | "max" | "enterprise";
  /** Ladder position, rendered as the card's mono index. */
  index: string;
  name: string;
  /** Headline figure exactly as shown. */
  price: string;
  /** The figure as a number for structured data — null when price on application. */
  priceFrom: number | null;
  /** Qualifier under the figure. */
  cadence: string;
  /** Short audience tag, set in mono above the description. */
  audience: string;
  /** Who this tier is for — the first thing a visitor should match themselves to. */
  who: string;
  /** What the tier is, in one sentence. */
  summary: string;
  features: PlanFeature[];
  /** Revealed on hover / tap: what you get over the previous tier. */
  upgrade: TierUpgrade;
  cta: { label: string; href: string };
  highlighted?: boolean;
  /** Billing plan id in apps/web/lib/carePlans.ts. */
  planId: "hosting" | "hosting_api" | "build_3" | "build_10";
};

export const PRICING_TIERS: PricingTier[] = [
  {
    id: "core",
    index: "01",
    name: "Core",
    price: "£30",
    priceFrom: 30,
    cadence: "from / month",
    audience: "Start-ups & micro businesses",
    who: "Micro businesses and start-ups who just need their website or system live on the internet.",
    summary:
      "Hosting, backups and security handled. Your system online and looked after, nothing rented.",
    planId: "hosting",
    features: [
      { text: "Managed UK/EU hosting, domain & SSL", included: true },
      { text: "Dedicated production database", included: true },
      { text: "Daily backups & uptime monitoring", included: true },
      { text: "Security patches and fixes on what we built", included: true },
      { text: "Email & AI usage included", included: false },
      { text: "Monthly design & build revisions", included: false },
      { text: "Developers on standby", included: false },
    ],
    upgrade: {
      title: "What's inside Core",
      short: "What's inside",
      lead: "The floor: everything a live system needs to stay up, safe and yours.",
      points: [
        {
          title: "The running costs are ours",
          body: "Hosting, the production database, the domain and SSL all sit on our accounts and our bill. You are not juggling five vendors and five renewal dates.",
        },
        {
          title: "Patched, backed up, watched",
          body: "Daily backups, uptime monitoring, and security and dependency updates applied as they land. If something we built breaks, we fix it — that is not a revision.",
        },
        {
          title: "Still owned outright",
          body: "The code, the data and every account stay in your name. Cancel any month and all of it walks with you.",
        },
      ],
    },
    cta: { label: "Start with Core", href: "/start" },
  },
  {
    id: "pro",
    index: "02",
    name: "Pro",
    price: "£60",
    priceFrom: 60,
    cadence: "from / month",
    audience: "Growing businesses",
    who: "Growing businesses whose system does real work — sending, booking, replying, deciding.",
    summary:
      "Everything in Core, plus the email and AI your system burns through, covered inside the plan.",
    planId: "hosting_api",
    features: [
      { text: "Everything in Core", included: true },
      { text: "Transactional email included", included: true },
      { text: "AI usage inside your system included", included: true },
      { text: "Third-party keys held, rotated & monitored", included: true },
      { text: "Monthly usage report", included: true },
      { text: "Monthly design & build revisions", included: false },
      { text: "Developers on standby", included: false },
    ],
    upgrade: {
      title: "What Pro adds over Core",
      short: "What Pro adds",
      lead: "Core keeps the system online. Pro pays for what it consumes while it runs.",
      points: [
        {
          title: "Email that actually sends",
          body: "Confirmations, reminders, receipts and follow-ups go out on our sending account, at our cost, with deliverability monitored rather than assumed.",
        },
        {
          title: "AI usage included",
          body: "The AI steps inside your system — triage, drafting, summarising — run on our keys within a pre-agreed monthly usage. No metered API bill landing on you.",
        },
        {
          title: "Keys and quotas handled",
          body: "We hold, rotate and monitor the third-party keys your system depends on, and send you a monthly report of what it used.",
        },
      ],
    },
    cta: { label: "Start with Pro", href: "/start" },
  },
  {
    id: "max",
    index: "03",
    name: "Max",
    price: "£120",
    priceFrom: 120,
    cadence: "from / month",
    audience: "Systems that keep changing",
    who: "Businesses whose system keeps changing — new services, new flows, new ideas every month.",
    summary:
      "Everything in Pro, plus design and build revisions every month and the developers who built it on standby.",
    planId: "build_3",
    highlighted: true,
    features: [
      { text: "Everything in Pro", included: true },
      { text: "Design & build revisions every month", included: true },
      { text: "Priority turnaround on requests", included: true },
      { text: "The developers who built it, on standby", included: true },
      { text: "Improvements proposed from real usage", included: true },
      { text: "Contracted response times & dedicated capacity", included: false },
    ],
    upgrade: {
      title: "What Max adds over Pro",
      short: "What Max adds",
      lead: "Pro runs the system you have. Max keeps changing it.",
      points: [
        {
          title: "Revisions every month",
          body: "A standing monthly allowance of design and build items — new pages, new flows, copy and layout changes, small features — agreed with you and delivered, not quoted one at a time.",
        },
        {
          title: "Priority turnaround",
          body: "Your requests go to the front of the build queue instead of into a backlog behind new projects.",
        },
        {
          title: "The original developers",
          body: "The people who wrote your system pick the work up. No handover, no relearning your codebase on your time.",
        },
        {
          title: "Improvements we spot first",
          body: "We watch how the system is actually used and propose the changes worth making, rather than waiting for you to ask.",
        },
      ],
    },
    cta: { label: "Start with Max", href: "/start" },
  },
  {
    id: "enterprise",
    index: "04",
    name: "Enterprise",
    price: "POA",
    priceFrom: null,
    cadence: "priced to your scope",
    audience: "Multi-site, regulated & high volume",
    who: "Multi-site, regulated or high-volume operations where the system is the business.",
    summary:
      "Everything in Max, scoped to your scale — dedicated capacity, contracted response times and a roadmap we run to.",
    planId: "build_10",
    features: [
      { text: "Everything in Max", included: true },
      { text: "Dedicated build capacity, scoped to you", included: true },
      { text: "Contracted response times (SLA)", included: true },
      { text: "Direct line for urgent issues", included: true },
      { text: "Quarterly roadmap review", included: true },
      { text: "Multiple systems, sites or entities", included: true },
    ],
    upgrade: {
      title: "What Enterprise adds over Max",
      short: "What Enterprise adds",
      lead: "Max gives you an allowance. Enterprise gives you reserved capacity and a contract.",
      points: [
        {
          title: "Capacity, not a count",
          body: "We reserve development time for you every month and scope it against your roadmap, instead of counting build items.",
        },
        {
          title: "Response times in writing",
          body: "Contracted response and resolution targets, a defined escalation path, and a direct line for anything urgent.",
        },
        {
          title: "Several systems, one plan",
          body: "Multiple sites, brands or legal entities run under a single plan with one point of contact and one bill.",
        },
        {
          title: "A roadmap we run to",
          body: "A quarterly review sets what gets built next quarter, with security and compliance work planned in rather than bolted on.",
        },
      ],
    },
    cta: { label: "Talk to us", href: "/book" },
  },
];

/** Every plan includes these, whatever the tier — shown under the ladder. */
export const PRICING_CONSTANTS = [
  "You own the code, the data and every account",
  "Cancel any month and keep everything",
  "No per-seat or per-user fees, ever",
  "Payments run through your own Stripe",
];

/** The lowest monthly figure on the ladder — used in hero copy and metadata. */
export const PRICING_FROM = PRICING_TIERS[0].price;

/** Pricing-specific questions, merged ahead of the general FAQ on /pricing. */
export const PRICING_FAQS = [
  {
    q: "What does the build itself cost?",
    a: "It is quoted to your scope, never off a price list — a one-page booking system and a multi-site operations platform are not the same job. You get a fixed price up front and it does not move unless you ask for something new. The monthly tiers above start after the build is live.",
  },
  {
    q: "What counts as a design and build revision?",
    a: "A discrete piece of work: a new page or flow, a copy or layout change, a small feature, a new automation, an integration tweak. Fixing something we built that broke is never counted — that is covered on every tier, including Core.",
  },
  {
    q: "Can I move between tiers?",
    a: "Any month, in either direction. Move up when you have a run of changes coming, drop back down when things settle. Nothing is locked in and there is no exit fee.",
  },
  {
    q: "Why is Enterprise price on application?",
    a: "Because it is reserved capacity and contracted response times rather than a fixed list of features — what it costs depends on how much development time we hold for you and what you need us to guarantee. Tell us the scale and we will quote it.",
  },
  {
    q: "What happens if I cancel?",
    a: "You keep everything: the code, the data and every account, because they were always in your name. We hand over the running costs we were covering — hosting, database, email, AI keys — and help you move them onto your own accounts.",
  },
];
