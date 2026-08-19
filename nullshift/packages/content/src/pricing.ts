/**
 * Public pricing ladder — the four service levels shown on /pricing.
 *
 * The commercial model has two independent axes. The PLAN answers "what
 * service does this system need?" — that is what these tiers describe. The
 * client's SCALE BAND then multiplies the price (see apps/web/lib/pricing/nsi.ts,
 * which is internal): a small local business stays at the from-price, while a
 * larger or more business-critical organisation pays materially more for the
 * same service level. Hence "from £40 / £80 / £120" everywhere, never a flat
 * price, and the scaling note under the cards.
 *
 * Recurring fees buy the platform, service level and technical partnership.
 * New capabilities are ALWAYS separately quoted fixed-price projects — no tier
 * includes development. Never write "unlimited development", "unlimited
 * changes" or "developer on demand" into this file.
 *
 * `planId` ties each public tier to its billing plan in
 * apps/web/lib/carePlans.ts so the two can never drift apart silently.
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
  /** The one-word promise from the sales language. */
  tagline: string;
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
  /** Target for a first reply, shown as its own line on the card. */
  responseTarget: string;
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
    tagline: "Keep it live.",
    price: "£40",
    priceFrom: 40,
    cadence: "from / month",
    audience: "Simple, low-change systems",
    who: "Businesses with an already-built system that needs to stay online, secure and working as agreed.",
    summary:
      "Managed hosting, maintenance and support for a stable system that does not need advanced services.",
    responseTarget: "2 UK business days",
    planId: "hosting",
    features: [
      { text: "Managed hosting, domain, database & SSL", included: true },
      { text: "Monitoring, backups & platform upkeep", included: true },
      { text: "Bug fixes to agreed functionality", included: true },
      { text: "Guidance on using your existing system", included: true },
      { text: "AI agent / managed API capability", included: false },
      { text: "Transactional email infrastructure", included: false },
      { text: "Named technical owner & roadmap input", included: false },
    ],
    upgrade: {
      title: "What's inside Core",
      short: "What's inside",
      lead: "The floor: everything a live system needs to stay up, safe and yours.",
      points: [
        {
          title: "The running costs are ours",
          body: "Managed hosting and deployment, domain and DNS where we hold them, SSL and your production database — on our accounts and our bill, not five renewal dates on yours.",
        },
        {
          title: "Fixed when it breaks",
          body: "If existing functionality stops behaving the way it was signed off, we investigate and fix it under support. That is never billed as new work.",
        },
        {
          title: "Deliberately not developer-on-demand",
          body: "Core keeps an agreed system running. New workflows, pages, integrations or capabilities are quoted as separate fixed-price projects.",
        },
      ],
    },
    cta: { label: "Start with Core", href: "/start" },
  },
  {
    id: "pro",
    index: "02",
    name: "Pro",
    tagline: "Run it properly.",
    price: "£80",
    priceFrom: 80,
    cadence: "from / month",
    audience: "Operational systems using AI & email",
    who: "Businesses whose system actively sends, automates and interacts — and can't afford it quietly failing.",
    summary:
      "For operational systems using AI, APIs and transactional email, with faster technical support and enhanced monitoring.",
    responseTarget: "1 UK business day",
    planId: "hosting_api",
    features: [
      { text: "Everything in Core", included: true },
      { text: "Managed AI agent & API capability", included: true },
      { text: "Transactional email infrastructure", included: true },
      { text: "Enhanced monitoring of APIs, email & integrations", included: true },
      { text: "Configuration support for existing features", included: true },
      { text: "Named technical owner", included: false },
      { text: "Quarterly roadmap & monthly health review", included: false },
    ],
    upgrade: {
      title: "What Pro adds over Core",
      short: "What Pro adds",
      lead: "Core keeps the system online. Pro runs the live services it depends on.",
      points: [
        {
          title: "The infrastructure that makes it work",
          body: "Managed AI-agent and API capability, plus transactional email — confirmations, reminders, receipts — run on our accounts within your system's normal usage band.",
        },
        {
          title: "Watched where it actually fails",
          body: "Enhanced monitoring of API failures, email delivery problems and key operational integrations, with delivery diagnostics when something looks wrong.",
        },
        {
          title: "Faster when you need us",
          body: "Priority queue with a one-business-day response target, and configuration support for existing features where no new capability is being introduced.",
        },
        {
          title: "Advice before you commit",
          body: "Considering a change? We'll tell you whether it's support, configuration, or a separately quoted feature — before you spend anything.",
        },
      ],
    },
    cta: { label: "Start with Pro", href: "/start" },
  },
  {
    id: "max",
    index: "03",
    name: "Max",
    tagline: "Have a technical partner.",
    price: "£120",
    priceFrom: 120,
    cadence: "from / month",
    audience: "Businesses wanting an ongoing partner",
    who: "Growth-minded businesses who want a developer who knows their platform and helps shape what comes next.",
    summary:
      "For businesses that want a developer who knows the platform, helps shape the roadmap, spots issues proactively and prioritises future work.",
    responseTarget: "4 UK business hours",
    planId: "build_3",
    highlighted: true,
    features: [
      { text: "Everything in Pro", included: true },
      { text: "A named technical owner who knows your system", included: true },
      { text: "Quarterly roadmap review", included: true },
      { text: "Monthly platform health review", included: true },
      { text: "Feature discovery & scoping included", included: true },
      { text: "Priority scheduling for accepted projects", included: true },
      { text: "Contracted SLA & dedicated capacity", included: false },
    ],
    upgrade: {
      title: "What Max adds over Pro",
      short: "What Max adds",
      lead: "Pro runs the system you have. Max puts a person behind it who knows why it was built that way.",
      points: [
        {
          title: "A named technical owner",
          body: "One developer who holds your system's history, priorities and architecture in their head. No handover, no relearning your codebase on your time.",
        },
        {
          title: "Scoping conversations are free",
          body: "Bring an idea and get feasibility, dependencies, recommended approach and a fixed-price proposal — without paying a consultancy fee for the conversation.",
        },
        {
          title: "We look before you ask",
          body: "A monthly health review covering reliability, performance, integration health and operational risk, and a heads-up when we spot something worth acting on.",
        },
        {
          title: "First in the queue",
          body: "Four-business-hour response target, and accepted feature projects are scheduled ahead of standard one-off work.",
        },
      ],
    },
    cta: { label: "Start with Max", href: "/start" },
  },
  {
    id: "enterprise",
    index: "04",
    name: "Enterprise",
    tagline: "Make it business-critical.",
    price: "POA",
    priceFrom: null,
    cadence: "quoted individually",
    audience: "Large, complex or high-risk systems",
    who: "Large, multi-entity, regulated, high-volume or business-critical operations where the system is the business.",
    summary:
      "Custom service, infrastructure and commercial terms for large or high-risk organisations.",
    responseTarget: "Contracted SLA",
    planId: "build_10",
    features: [
      { text: "Everything in Max", included: true },
      { text: "Contracted uptime & response SLAs", included: true },
      { text: "Security reviews & procurement support", included: true },
      { text: "Dedicated environments & higher allowances", included: true },
      { text: "Custom service cadence & change management", included: true },
      { text: "Optional reserved development capacity", included: true },
    ],
    upgrade: {
      title: "What Enterprise adds over Max",
      short: "What Enterprise adds",
      lead: "Max gives you a partner. Enterprise gives you a contract, an architecture and reserved capacity.",
      points: [
        {
          title: "Commitments in writing",
          body: "Custom uptime commitments, contracted response SLAs and a defined escalation path — not best-effort targets.",
        },
        {
          title: "Built for procurement",
          body: "Security reviews, supplier questionnaires, change-management processes and the compliance work that large organisations require before they can sign.",
        },
        {
          title: "Architecture to match the load",
          body: "Dedicated environments, higher infrastructure allowances and custom architecture for multi-entity, multi-country or high-volume systems.",
        },
        {
          title: "Reserved capacity, priced honestly",
          body: "Where you want predictable ongoing delivery, we reserve development time and price it as reserved capacity — never hidden inside a monthly plan.",
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

/** The scaling note that must sit under the cards — required by the strategy. */
export const PRICING_SCALE_NOTE =
  "Recurring pricing scales with platform usage, complexity, organisation size and service requirements. Enterprise systems are quoted individually.";

/** The lowest monthly figure on the ladder — used in hero copy and metadata. */
export const PRICING_FROM = PRICING_TIERS[0].price;

/**
 * The support boundary, in the client's words. This is the single most
 * important thing a prospect can understand before signing: what the monthly
 * fee covers, and what is quoted separately.
 */
export const SUPPORT_BOUNDARY = {
  test: "If the request changes what your product can do, it's development. If it keeps an existing capability working — or configures it within its original design — it's support.",
  included: {
    title: "Included in your plan",
    items: [
      "Fixing something that stopped working against the signed-off behaviour",
      "Diagnosing outages, errors, integration failures and delivery problems",
      "Changing a setting, value, content item or rule the system already supports",
      "Helping you use, administer or understand what's already there",
      "Routine technical upkeep to keep the platform safe and reliable",
    ],
  },
  quoted: {
    title: "Quoted as a fixed-price project",
    items: [
      "Letting a user do something the system couldn't do before",
      "A new screen, workflow, automation, business rule or permission model",
      "Adding a third-party service, or substantially changing an integration",
      "New data structures, reporting, booking, payment or portal capability",
      "Materially redesigning part of the product rather than fixing a defect",
    ],
  },
};

/** Worked examples — the fastest way to make the boundary concrete. */
export const SUPPORT_EXAMPLES: {
  request: string;
  verdict: "support" | "feature";
  why: string;
}[] = [
  {
    request: "Booking confirmation emails stopped sending.",
    verdict: "support",
    why: "Restores existing agreed behaviour.",
  },
  {
    request: "Change the sender name on our confirmation email.",
    verdict: "support",
    why: "Configuring a capability that already exists.",
  },
  {
    request: "The payment page errors on mobile.",
    verdict: "support",
    why: "A bug in existing functionality.",
  },
  {
    request: "Show me how to refund a booking.",
    verdict: "support",
    why: "Guidance on a function you already have.",
  },
  {
    request: "Add SMS confirmations as well as email.",
    verdict: "feature",
    why: "A new communication channel and integration.",
  },
  {
    request: "Let customers choose their exact seats.",
    verdict: "feature",
    why: "New booking workflow, UI and allocation logic.",
  },
  {
    request: "Add partial refunds and refund reasons.",
    verdict: "feature",
    why: "New product capability and business logic.",
  },
  {
    request: "Build a multi-location opening-hours manager.",
    verdict: "feature",
    why: "A new admin surface and data model.",
  },
];

/** Pricing-specific questions, merged ahead of the general FAQ on /pricing. */
export const PRICING_FAQS = [
  {
    q: "Why is it “from” £40 rather than just £40?",
    a: "Because the plan and your scale are two different things. The plan sets the service your platform needs; what you pay for that service then scales with how much load, complexity and commercial importance sits on the system. A small local business genuinely pays the from-price. A multi-site operator whose revenue runs through the platform pays more for the same service level, because the responsibility is bigger. We tell you your rate before you commit to anything.",
  },
  {
    q: "What does the build itself cost?",
    a: "It's quoted to your scope, never off a price list — a one-page booking form and a multi-site operations platform are not the same job. You get a fixed price up front and it doesn't move unless you ask for something new. The monthly plan starts once your system is live.",
  },
  {
    q: "What counts as support, and what gets quoted separately?",
    a: "If the request changes what your product can do, it's development and we quote it as a fixed-price project. If it keeps an existing capability working, or configures that capability within its original design, it's support and it's in your plan. Fixing something we built that broke is always support, on every tier including Core.",
  },
  {
    q: "Does Max include development work?",
    a: "No — and we'd rather be straight about that than sell you an “unlimited changes” plan nobody can honour. Max buys continuity, context, priority and free scoping: a named developer who knows your system, a four-hour response target, monthly health reviews, and feature proposals without a consultancy fee. The builds themselves are quoted as fixed-price projects, with Max clients scheduled first.",
  },
  {
    q: "Can I move between tiers?",
    a: "Yes. Upgrades can take effect immediately or at your next billing date; downgrades take effect at the next billing cycle. The only limit is technical: if your live system depends on our managed AI/API or email infrastructure, Pro is the minimum until those dependencies change.",
  },
  {
    q: "Will my price go up?",
    a: "Only after a review, never as a surprise. We look at scale formally every six months, or after a material change to your system or organisation. A rise needs two consecutive months in the higher band and at least 30 days' notice. A fall needs three consecutive months lower, applied at the six-month review.",
  },
  {
    q: "Why is Enterprise price on application?",
    a: "Because it's reserved capacity, contracted response times and custom architecture rather than a fixed feature list — what it costs depends on what we're holding for you and what you need us to guarantee. Tell us the scale and we'll quote it.",
  },
  {
    q: "What happens if I cancel?",
    a: "You keep everything: the code, the data and every account, because they were always in your name. We hand over the running costs we were covering — hosting, database, email, AI keys — and help you move them onto your own accounts.",
  },
];
