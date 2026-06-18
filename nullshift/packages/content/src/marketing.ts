/**
 * Marketing strategy data — single source for the clinic-niche positioning.
 *
 * The site is now focused on allied-health clinics: the CLINIC config drives the
 * homepage + pricing. TRADES/WELLNESS are retained only as legacy data (their
 * pages now redirect to the clinic homepage) and are no longer surfaced in nav.
 * Brand line: "Own your system. Cut the bill."
 */

export interface CarePlan {
  tier: "Foundation" | "Growth" | "Pro";
  setup: string;
  monthly: string;
  highlighted: boolean;
  inside: string[];
}

export interface CalcSlider {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  unit?: "gbp" | "pct" | "num";
}

export interface VerticalConfig {
  slug: "trades" | "wellness" | "clinics";
  nav: string; // short nav label
  offer: string; // "Never Miss a Job"
  eyebrow: string;
  headline: [string, string]; // two lines, 2nd is the emerald glow line
  sub: string;
  /** the killer stat hook */
  hook: { stat: string; claim: string };
  /** what it does, in pounds/outcomes */
  outcomes: { title: string; body: string }[];
  plans: CarePlan[];
  calc: {
    variant: "missed-call" | "no-show" | "saas-bill";
    eyebrow: string;
    title: string;
    sub: string;
    sliders: CalcSlider[];
    /** copy under the result */
    pitch: string;
  };
  faqs: { q: string; a: string }[];
  /** What the monthly report covers (plans footnote). */
  reportLine?: string;
  /** The closing-CTA question (after "Ready to "). */
  ctaQuestion?: string;
}

export const PROOF_PILLARS = [
  {
    n: "01",
    title: "Speed",
    body: "Live in 2–4 weeks, not 2–4 months. Bespoke, never templated.",
  },
  {
    n: "02",
    title: "Ownership",
    body: "You own the code and every account — hosting, domain, booking, AI. Cancel anytime and keep everything. No monthly ransom.",
  },
  {
    n: "03",
    title: "Results",
    body: "We don't hand over a site and vanish — we run the system that recovers revenue, and show you the £ recovered every month.",
  },
] as const;

export const BRAND_LINE = "Own your system. Subscribe to results.";

export const TRADES: VerticalConfig = {
  slug: "trades",
  nav: "For Trades",
  offer: "Never Miss a Job",
  eyebrow: "For trades & home services",
  headline: ["Stop losing jobs to", "missed calls."],
  sub: "Plumbers, electricians, builders, heating engineers — you're up a ladder, the phone rings, and the caller dials the next firm on Google. We build you a fast bespoke site and run the system that catches every lead, so you never miss another job.",
  hook: {
    stat: "£24,000 a year",
    claim:
      "is what the average UK trade loses to missed calls. 85% of callers won't leave a voicemail — they ring the next result within 30 minutes.",
  },
  outcomes: [
    {
      title: "Missed-call text-back",
      body: 'Miss a call and the caller instantly gets a text — "Sorry we missed you, what do you need?" The job stays yours instead of going to the next plumber.',
    },
    {
      title: "24/7 AI receptionist",
      body: "An AI chat answers questions, qualifies the job and books it in — day or night, while you're on the tools.",
    },
    {
      title: "Instant quote follow-up",
      body: "Every quote form triggers an automatic follow-up so warm leads don't go cold while you're busy.",
    },
    {
      title: "Reviews on autopilot",
      body: "Automated review requests after every job build your Google ranking and win the next customer for you.",
    },
  ],
  plans: [
    {
      tier: "Foundation",
      setup: "£499",
      monthly: "£149",
      highlighted: false,
      inside: [
        "Bespoke fast website",
        "Missed-call text-back",
        "Automated review engine",
        "Google Business Profile optimisation",
        'Monthly "jobs recovered" report',
      ],
    },
    {
      tier: "Growth",
      setup: "£799",
      monthly: "£249",
      highlighted: true,
      inside: [
        "Everything in Foundation",
        "24/7 AI receptionist / chat",
        "Instant quote-form follow-up",
        "Lead pipeline / CRM lite",
      ],
    },
    {
      tier: "Pro",
      setup: "£1,199",
      monthly: "£399",
      highlighted: false,
      inside: [
        "Everything in Growth",
        "Full CRM",
        "Quote → invoice automation",
        "Multi-channel automations",
        "Priority support + quarterly strategy call",
      ],
    },
  ],
  calc: {
    variant: "missed-call",
    eyebrow: "The £24,000 phone call",
    title: "How much are missed calls costing you?",
    sub: "Drag the sliders. This is the entire sales conversation — in your own numbers.",
    sliders: [
      {
        id: "miss",
        label: "Missed calls per week",
        min: 1,
        max: 40,
        step: 1,
        value: 7,
        unit: "num",
      },
      {
        id: "conv",
        label: "% that are real jobs",
        min: 5,
        max: 90,
        step: 5,
        value: 40,
        unit: "pct",
      },
      {
        id: "job",
        label: "Average job value",
        min: 50,
        max: 2000,
        step: 25,
        value: 300,
        unit: "gbp",
      },
    ],
    pitch:
      'A "Never Miss a Job" plan from £149/mo that catches even a fraction of these pays for itself many times over — and you own everything.',
  },
  faqs: [
    {
      q: "I already have a website.",
      a: "Great — but does it answer the phone when you're up a ladder? We're not selling you a site, we're selling you the jobs you're currently missing.",
    },
    {
      q: "Why monthly? I thought you let me own it.",
      a: "You do. You own the code and every account, and can cancel and keep it all anytime. The monthly isn't rent on the website — it's us running the machine that brings you customers. No hostage situation, no rebilled-tool markups.",
    },
    {
      q: "Too expensive — I'll just use Wix.",
      a: "Wix is ~£30/mo forever and you never own it. One missed job a month costs you more than our plan — and we recover that for you, while you own the asset.",
    },
    {
      q: "I don't trust tech people, the last one vanished.",
      a: "We're a UK Ltd, founder-led, with a 24-hour response. And you can click around our live Systems Lab right now to see exactly what you'll get.",
    },
  ],
};

export const WELLNESS: VerticalConfig = {
  slug: "wellness",
  nav: "For Salons",
  offer: "Zero No-Show",
  eyebrow: "For salons, clinics & wellness",
  headline: ["Fill your calendar.", "Cut no-shows."],
  sub: "Salons, barbers, clinics, physios, gyms — every empty chair and last-minute no-show is money gone. We build you a beautiful booking site and run the system that takes deposits, sends reminders and fills cancellations automatically.",
  hook: {
    stat: "£1.6bn a year",
    claim:
      "is lost to no-shows across UK salons — up to 20% of revenue. Deposits and automated reminders cut no-shows by 70–85%.",
  },
  outcomes: [
    {
      title: "Online booking, 24/7",
      body: "70% of clients prefer to book online and 40% book after hours — capture the bookings you're currently sending to voicemail.",
    },
    {
      title: "Deposits & reminders",
      body: "Take a deposit at booking and send automatic SMS + email reminders — the proven combination that cuts no-shows up to 85%.",
    },
    {
      title: "Waitlist auto-fill",
      body: "A cancellation instantly offers the slot to your waitlist, so empty chairs fill themselves.",
    },
    {
      title: "Rebooking & reviews",
      body: "Automatic rebooking nudges and post-visit review requests keep clients coming back and your ranking climbing.",
    },
  ],
  plans: [
    {
      tier: "Foundation",
      setup: "£399",
      monthly: "£129",
      highlighted: false,
      inside: [
        "Bespoke booking website",
        "Deposits / prepayment",
        "Automated SMS + email reminders",
        "Post-visit review requests",
      ],
    },
    {
      tier: "Growth",
      setup: "£699",
      monthly: "£229",
      highlighted: true,
      inside: [
        "Everything in Foundation",
        "Waitlist auto-fill",
        "Rebooking nudges",
        "Memberships / packages",
        "No-show analytics",
      ],
    },
    {
      tier: "Pro",
      setup: "£999",
      monthly: "£349",
      highlighted: false,
      inside: [
        "Everything in Growth",
        "Full client CRM",
        "Marketing automation",
        "Loyalty / retention flows",
      ],
    },
  ],
  calc: {
    variant: "no-show",
    eyebrow: "Your empty chair",
    title: "What are no-shows costing you?",
    sub: "Drag the sliders to see the revenue walking out the door — then how much of it you'd get back.",
    sliders: [
      {
        id: "noshows",
        label: "No-shows per week",
        min: 1,
        max: 50,
        step: 1,
        value: 8,
        unit: "num",
      },
      {
        id: "value",
        label: "Average booking value",
        min: 10,
        max: 500,
        step: 5,
        value: 45,
        unit: "gbp",
      },
      {
        id: "recover",
        label: "% recovered with deposits + reminders",
        min: 50,
        max: 85,
        step: 5,
        value: 75,
        unit: "pct",
      },
    ],
    pitch:
      'A "Zero No-Show" plan from £129/mo recovers most of this automatically — booking site, deposits and reminders included. And it\'s yours to keep.',
  },
  faqs: [
    {
      q: "My clients like booking by phone / DM.",
      a: "Some will — and they still can. But 40% of bookings happen after hours when no one's there to answer. Online booking captures those without changing how your regulars reach you.",
    },
    {
      q: "Will deposits put clients off?",
      a: "The data says no — they reduce no-shows by 70–85% while serious clients happily pay. We set the deposit level with you so it protects your time without scaring off bookings.",
    },
    {
      q: "Why monthly?",
      a: "You own the booking site and every account, and can cancel anytime. The monthly is us running the reminders, waitlist and rebooking automations that keep your calendar full — and reporting the no-shows we prevented.",
    },
    {
      q: "I'm not techy.",
      a: "You don't need to be. We build and run it; you just see a fuller calendar. Click around our live Systems Lab to see the booking system in action before you decide.",
    },
  ],
};

export const CLINIC: VerticalConfig = {
  slug: "clinics",
  nav: "For Clinics",
  offer: "Own Your Practice",
  eyebrow: "For physio, osteo, chiro & private therapy clinics",
  headline: ["Stop renting your", "practice software."],
  sub: "Physio, osteo, chiro and private-therapy clinics pay per practitioner, every month, for booking, reminders, records and payments — a bill that grows every time you hire. We build you the system once, you own it outright, and you take patient payments at a fraction of the usual cut.",
  hook: {
    stat: "£3,600+ a year",
    claim:
      "is what a typical four-practitioner clinic rents in per-seat booking + records software — and it climbs with every new hire. Own the system once and that line on your P&L stops growing.",
  },
  outcomes: [
    {
      title: "Kill the per-practitioner bill",
      body: "Booking, reminders, records and your site become one system you own — not a stack of subscriptions that charges more every time your team grows. Cancel the rented tools and keep the asset.",
    },
    {
      title: "Take payments at a fraction",
      body: "Patients pay through your own Stripe account. You keep the merchant relationship and pay a small flat platform fee — not 2–3% skimmed by an incumbent booking tool.",
    },
    {
      title: "Patient records you actually own",
      body: "Notes, intake forms and history live in your system, GDPR-compliant, UK-hosted, and exportable any time. Your data never becomes a vendor's hostage.",
    },
    {
      title: "Booking, deposits & reminders built in",
      body: "Online booking with deposits and automatic SMS + email reminders cut no-shows — included in the build, not bolted on as another monthly add-on.",
    },
  ],
  plans: [
    {
      tier: "Foundation",
      setup: "£2,950",
      monthly: "£49",
      highlighted: false,
      inside: [
        "Bespoke booking + records system you own",
        "Deposits & automated reminders",
        "Your Stripe — patient payments at a fraction",
        "GDPR data-processing + DPA",
        "Care plan: hosting, backups, updates",
      ],
    },
    {
      tier: "Growth",
      setup: "£3,950",
      monthly: "£99",
      highlighted: true,
      inside: [
        "Everything in Foundation",
        "Patient records, notes & intake forms",
        "Waitlist auto-fill & rebooking",
        "Multi-practitioner calendars",
        "Monthly savings + revenue report",
      ],
    },
    {
      tier: "Pro",
      setup: "£4,950",
      monthly: "£149",
      highlighted: false,
      inside: [
        "Everything in Growth",
        "Custom automations & integrations",
        "Patient portal & document e-sign",
        "Priority support + quarterly review",
        "Transaction plan option (2% of payments)",
      ],
    },
  ],
  calc: {
    variant: "saas-bill",
    eyebrow: "The rented-software bill",
    title: "What is your practice software costing you?",
    sub: "Most clinic tools charge per practitioner. Drag the sliders to see the bill you're renting — and what stops when you own it.",
    sliders: [
      {
        id: "perSeat",
        label: "Software cost per practitioner / month",
        min: 20,
        max: 200,
        step: 5,
        value: 60,
        unit: "gbp",
      },
      {
        id: "seats",
        label: "Practitioners",
        min: 1,
        max: 20,
        step: 1,
        value: 4,
        unit: "num",
      },
      {
        id: "keep",
        label: "% of the bill you stop renting by owning",
        min: 50,
        max: 90,
        step: 5,
        value: 70,
        unit: "pct",
      },
    ],
    pitch:
      "Own the system once — booking, records, reminders, payments — and the recurring per-practitioner bill stops growing every time you hire. The build pays for itself, then it's yours.",
  },
  faqs: [
    {
      q: "Is patient data safe and GDPR-compliant?",
      a: "Yes. We act as your data processor under a signed DPA, host in the UK/EU, encrypt in transit and at rest, and keep an audit trail. Your data is yours — exportable any time, and we never sell it or lock it in.",
    },
    {
      q: "What about my existing booking system and records?",
      a: "We migrate them. You keep running your current tools until the new system is live and tested, then we move your data across and you cancel the subscriptions you no longer need.",
    },
    {
      q: "Why a monthly care plan if I own it?",
      a: "You own the code, the data and every account, and can cancel anytime and keep it all. The care plan is hosting, backups, security updates and us running it — typically £49–£149/mo, a fraction of the per-seat stack it replaces. No rebilled-tool markups.",
    },
    {
      q: "We're a small clinic — is this overkill?",
      a: "It scales down. A solo or two-practitioner clinic owns a clean booking-and-payments system for less than it rents three or four SaaS tools. The savings only get bigger as you add practitioners.",
    },
  ],
  reportLine: "savings and revenue",
  ctaQuestion: "own your practice software?",
};

export const VERTICALS = [TRADES, WELLNESS, CLINIC];
export const getVertical = (slug: string) => VERTICALS.find((v) => v.slug === slug);
