/**
 * Client stories — the single source for `/client-stories` and the homepage
 * "Client stories" grid.
 *
 * Every number here is one we can stand behind: usage counts come from the
 * client's own database (read on 2026-09-11), dates from the ops DB. Nothing
 * else is claimed. Adding a client = one entry in CLIENT_STORIES plus a logo
 * under `apps/web/public/clients/`, a live demo component keyed by `demo`
 * (and, when it exists, a Mux playback id for the testimonial).
 *
 * Rendering helpers (status stamp, Mux URLs, validation) live in
 * `apps/web/lib/clientStories.ts`.
 */

export type Beat = { title: string; body: string; chips: string[] };

export type DemoKey = "tde-pricing" | "nft-reflections" | "suffolk-reports";

export type ClientLogo =
  | {
      kind: "image";
      /** Logo for light backgrounds. */
      src: string;
      /** Optional variant for dark backgrounds; falls back to `src`. */
      darkSrc?: string;
      /** Always sit the logo on a dark plate (for marks with white ink only). */
      plate?: "dark";
      /** Render multiplier on the shared logo height — for near-square marks
       *  with generous whitespace that read too small at the row height. */
      scale?: number;
      width: number;
      height: number;
      alt: string;
    }
  | { kind: "wordmark"; text: string; sub?: string; glyph?: "leaf" };

export interface ClientStory {
  slug: string;
  name: string;
  sector: string;
  contactFirstName: string;
  /** One plain sentence. */
  summary: string;
  liveUrl: string | null;
  displayUrl: string;
  /** Public marketing screenshot; no authenticated customer records. */
  screenshot?: {
    src: string;
    width: number;
    height: number;
    alt: string;
    capturedAt: string;
  };
  stage: "live" | "care";
  /** ISO month, e.g. "2026-06". */
  liveSince: string;
  /** ISO date the care plan started, when `stage === "care"`. */
  careSince?: string;
  logo: ClientLogo;
  /** Device-frame tint only — never used for type or backgrounds. */
  brand: { primary: string; accent?: string };
  beats: { had: Beat; built: Beat; runs: Beat };
  video: {
    muxPlaybackId: string | null;
    /** WebVTT captions track URL (Mux auto-generated subtitles). */
    captionsSrc?: string;
    speaker: string;
    role: string;
  };
  /** Which live demo (reproduced from the client's codebase) the story shows.
   *  The component map lives in apps/web/components/marketing/demos. */
  demo: DemoKey;
  proof: { ownership: string[]; dpaSigned: boolean; carePlan: boolean };
  /** ≤ 4 entries. */
  stats: { value: string; label: string }[];
  homeCard: { title: string; meta: string };
}

/** The line under the homepage grid — Nullshift eats its own cooking. */
export const OWN_SYSTEM_PROOF_LINE =
  "We run Nullshift on the systems we sell — onboarding, agreements, invoicing, Direct Debits and AI-dispatched fixes, end to end.";

export const CLIENT_STORIES: ClientStory[] = [
  {
    slug: "the-dance-exclusive",
    screenshot: {
      src: "/clients/the-dance-exclusive-site.png",
      width: 1440,
      height: 900,
      alt: "The Dance Exclusive public website",
      capturedAt: "2026-09-14",
    },
    name: "The Dance Exclusive",
    sector: "Dance school · Essex",
    contactFirstName: "Amie",
    summary:
      "A dance school across Essex, now booking, paying and keeping its registers on a system it owns.",
    liveUrl: "https://app.thedanceexclusive.co.uk",
    displayUrl: "app.thedanceexclusive.co.uk",
    stage: "care",
    liveSince: "2026-08",
    careSince: "2026-09-02",
    logo: {
      kind: "image",
      src: "/clients/the-dance-exclusive-logo.png",
      darkSrc: "/clients/the-dance-exclusive-logo-dark.png",
      scale: 1.9,
      width: 427,
      height: 448,
      alt: "The Dance Exclusive",
    },
    brand: { primary: "hsl(193 100% 44%)" },
    beats: {
      had: {
        title: "Multiple venues, run by hand",
        body: "Classes, holiday camps, workshops and parties across Essex venues — booked and tracked by hand, with staff chasing parents for payment and paperwork.",
        chips: ["Across Essex", "Camps · workshops · parties", "Booked by hand"],
      },
      built: {
        title: "Three portals, one database",
        body: "A parent portal, a staff portal for registers, schedules and documents, and an admin for classes, camps, workshops, parties, merchandise, venues, staff, customers, bookings and coupons — on their own Supabase, taking payment through the studio's own Stripe account.",
        chips: ["Parent portal", "Staff portal", "Admin", "Own Stripe account"],
      },
      runs: {
        title: "Parents book. Staff teach.",
        body: "Parents book and pay without a member of staff in the loop. Registers and schedules are live for every venue, and two scheduled jobs keep the data tidy overnight.",
        chips: ["Self-serve booking", "Live registers", "Scheduled housekeeping"],
      },
    },
    video: {
      muxPlaybackId: null,
      speaker: "Amie",
      role: "Founder, The Dance Exclusive",
    },
    demo: "tde-pricing",
    proof: {
      ownership: ["Their repo", "Their database", "Their Stripe account"],
      dpaSigned: true,
      carePlan: true,
    },
    stats: [
      { value: "139", label: "Active parents · 30 days" },
      { value: "235", label: "Bookings" },
      { value: "582", label: "Class sessions" },
      { value: "Essex", label: "Multiple venues" },
    ],
    homeCard: {
      title: "Across Essex. One booking system. Zero spreadsheets.",
      meta: "Client story",
    },
  },
  {
    slug: "newfuture-therapy",
    screenshot: {
      src: "/clients/newfuture-therapy-site.png",
      width: 1440,
      height: 900,
      alt: "NewFuture Therapy public website",
      capturedAt: "2026-09-14",
    },
    name: "NewFuture Therapy",
    sector: "Counselling practice · Wakefield & online",
    contactFirstName: "Laura",
    summary:
      "A two-therapist practice with a premium site, a publishing engine and an AI companion built to the therapists' own rules.",
    liveUrl: "https://www.newfuturetherapy.co.uk/",
    displayUrl: "newfuturetherapy.co.uk",
    stage: "live",
    liveSince: "2026-06",
    logo: {
      kind: "image",
      src: "/clients/newfuture-therapy-logo.png",
      darkSrc: "/clients/newfuture-therapy-logo-dark.png",
      width: 1000,
      height: 255,
      alt: "NewFuture Therapy",
    },
    brand: { primary: "#6B8C6F", accent: "#3A5A40" },
    beats: {
      had: {
        title: "A practice, not just a page",
        body: "NewFuture Therapy is Laura and Esther, counsellors in Wakefield. They needed a premium site, a safe way to publish and teach, and an AI companion that would follow their rules rather than a vendor's.",
        chips: ["Two-therapist practice", "Wakefield & online", "Their own rules"],
      },
      built: {
        title: "Calm surface, engineered underneath",
        body: "Brand and site, an articles engine, a resources library of printable PDFs, members' courses, an admin, enquiries encrypted before they leave the app, and “NewFuture Reflections” — an AI companion built to the therapists' own 17-section behavioural spec.",
        chips: [
          "17-section spec",
          "Encrypted enquiries",
          "Resources library",
          "Members' courses",
        ],
      },
      runs: {
        title: "Found, and useful, without us",
        body: "Articles and resources are managed by the therapists from their own back office. The companion's crisis screen is fixed in the architecture, not in a prompt, so no conversation can rewrite it.",
        chips: [
          "Self-managed content",
          "Safety by architecture",
          "9 weeks brief → production",
        ],
      },
    },
    video: {
      muxPlaybackId: "hevvtK01oksR8HWcs5fJAjbICgIoPCHlW3zY89ZywMRA",
      speaker: "Laura",
      role: "Co-founder, NewFuture Therapy",
    },
    demo: "nft-reflections",
    proof: {
      ownership: ["Their repo", "Their database", "Their domain"],
      dpaSigned: true,
      carePlan: false,
    },
    stats: [
      { value: "17", label: "Section behavioural spec" },
      { value: "9", label: "Weeks · brief → production" },
      { value: "Jun 2026", label: "Live since" },
    ],
    homeCard: {
      title: "A practice system its owners actually love.",
      meta: "Video testimonial",
    },
  },
  {
    slug: "suffolk-tennis",
    screenshot: {
      src: "/clients/suffolk-tennis-site.png",
      width: 1440,
      height: 900,
      alt: "Suffolk Tennis public website",
      capturedAt: "2026-09-14",
    },
    name: "Suffolk Tennis LTA",
    sector: "County tennis pathway · Suffolk",
    contactFirstName: "Ollie",
    summary:
      "The county's player pathway, moved off a hosted prototype onto a system the LTA controls.",
    liveUrl: "https://suffolktennis.online",
    displayUrl: "suffolktennis.online",
    stage: "live",
    liveSince: "2026-08",
    logo: {
      kind: "image",
      src: "/clients/suffolk-tennis-logo.png",
      plate: "dark",
      width: 720,
      height: 204,
      alt: "Suffolk Tennis LTA",
    },
    brand: { primary: "hsl(207 90% 38%)" },
    beats: {
      had: {
        title: "A prototype they didn't control",
        body: "A working prototype, hosted on a platform the county had no control over — no ownership of the code, the data or the roadmap.",
        chips: ["Hosted prototype", "No data ownership"],
      },
      built: {
        title: "The whole pathway, on their own stack",
        body: "Venues and coaches, news and events, a parent hub for children, schedules, goals and player reports, a coach app, QR ticketing and Stripe payments — migrated onto the LTA's own Supabase.",
        chips: ["Parent hub", "Coach app", "QR ticketing", "Stripe payments"],
      },
      runs: {
        title: "Sessions scheduled, tickets scanned",
        body: "1,340 sessions scheduled across 9 venues. Tickets are scanned at the gate, and payments go straight to the LTA.",
        chips: ["Own Supabase", "Gate scanning", "Payments to the LTA"],
      },
    },
    video: {
      muxPlaybackId: null,
      speaker: "Ollie",
      role: "Suffolk Tennis LTA",
    },
    demo: "suffolk-reports",
    proof: {
      ownership: ["Their repo", "Their database", "Their Stripe account"],
      dpaSigned: true,
      carePlan: false,
    },
    stats: [
      { value: "1,340", label: "Scheduled sessions" },
      { value: "9", label: "Venues" },
      { value: "6", label: "Staff" },
      { value: "24", label: "Registered parents" },
    ],
    homeCard: {
      title: "A county pathway, off the prototype and onto its own stack.",
      meta: "Client story",
    },
  },
];
