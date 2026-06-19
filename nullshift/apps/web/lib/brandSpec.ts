/**
 * BrandSpec — the structured "homepage concept" for a prospect's business, used
 * to render a tailored, branded homepage MOCK in the Build Blueprint. Generated
 * by AI from their 2-sentence description (see app/api/brand-preview), with a
 * deterministic per-vertical fallback so the section still renders before an
 * AI key is configured. It is a visual concept only — nothing is wired to data.
 */

export type BrandPalette = {
  primary: string;
  bg: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
};

export type BrandSpec = {
  businessName: string;
  tagline: string;
  heroHeadline: string;
  heroSub: string;
  ctaLabel: string;
  sections: { title: string; blurb: string }[];
  palette: BrandPalette;
  vibe: string;
  /** True when written by the AI; false for the deterministic fallback. */
  aiGenerated: boolean;
};

/** Light, real-website-feeling palettes per vertical (distinct from Nullshift's
 *  dark UI, so it clearly reads as THEIR site, not ours). */
const VERTICAL_PALETTES: Record<string, BrandPalette> = {
  clinic: {
    primary: "#0EA5A0",
    bg: "#F5FBFA",
    surface: "#FFFFFF",
    text: "#0E2A2A",
    muted: "#5E7A77",
    accent: "#0EA5A0",
  },
  wellness: {
    primary: "#5E8B53",
    bg: "#F7FAF4",
    surface: "#FFFFFF",
    text: "#1E2C19",
    muted: "#6E7E66",
    accent: "#86B179",
  },
  salon: {
    primary: "#C0698F",
    bg: "#FBF6F8",
    surface: "#FFFFFF",
    text: "#2A1620",
    muted: "#876570",
    accent: "#D49AB3",
  },
  trades: {
    primary: "#E08A2B",
    bg: "#FAF7F2",
    surface: "#FFFFFF",
    text: "#241B10",
    muted: "#7C6B53",
    accent: "#1F2937",
  },
  hospitality: {
    primary: "#C75A3F",
    bg: "#FBF6F3",
    surface: "#FFFFFF",
    text: "#2A150E",
    muted: "#856056",
    accent: "#E08A2B",
  },
  professional: {
    primary: "#3F6FB0",
    bg: "#F5F8FC",
    surface: "#FFFFFF",
    text: "#13202E",
    muted: "#5E6E7E",
    accent: "#3F6FB0",
  },
  retail: {
    primary: "#5B5BD6",
    bg: "#F7F7FD",
    surface: "#FFFFFF",
    text: "#171633",
    muted: "#65647E",
    accent: "#8B8BE0",
  },
  default: {
    primary: "#0EA5A0",
    bg: "#F6F8FB",
    surface: "#FFFFFF",
    text: "#11151C",
    muted: "#5C6675",
    accent: "#3DA0A0",
  },
};

const VERTICAL_NOUN: Record<string, { who: string; cta: string }> = {
  clinic: { who: "clinic", cta: "Book an appointment" },
  wellness: { who: "studio", cta: "Book a session" },
  salon: { who: "salon", cta: "Book now" },
  trades: { who: "team", cta: "Get a quote" },
  hospitality: { who: "venue", cta: "Reserve a table" },
  professional: { who: "practice", cta: "Get in touch" },
  retail: { who: "shop", cta: "Shop now" },
  default: { who: "business", cta: "Get started" },
};

const isHex = (s: unknown): s is string =>
  typeof s === "string" && /^#[0-9a-fA-F]{6}$/.test(s.trim());

const clamp = (s: unknown, max: number, fallback: string): string => {
  const v = typeof s === "string" ? s.trim() : "";
  if (!v) return fallback;
  return v.length > max ? v.slice(0, max).trim() : v;
};

/** Deterministic concept from the answers — no AI required. */
export function fallbackBrandSpec(input: {
  businessName?: string | null;
  vertical?: string | null;
  description?: string | null;
}): BrandSpec {
  const vertical = input.vertical || "default";
  const palette = VERTICAL_PALETTES[vertical] ?? VERTICAL_PALETTES.default;
  const noun = VERTICAL_NOUN[vertical] ?? VERTICAL_NOUN.default;
  const name = (input.businessName || "Your business").trim();

  return {
    businessName: name,
    tagline: `Your ${noun.who}, online`,
    heroHeadline: `${name} — booked in seconds.`,
    heroSub: `A fast, beautiful site your customers love — online booking, payments and reminders built in, all owned by you.`,
    ctaLabel: noun.cta,
    sections: [
      {
        title: "Book online, 24/7",
        blurb: "Customers book and pay a deposit any time — your diary fills itself.",
      },
      {
        title: "Everything in one place",
        blurb: "Bookings, records and payments in a single system you own.",
      },
      {
        title: "Fewer no-shows",
        blurb: "Automatic reminders and rebooking keep your calendar full.",
      },
    ],
    palette,
    vibe: "clean, trustworthy, modern",
    aiGenerated: false,
  };
}

/** Validate + normalise a raw AI object into a safe BrandSpec, falling back to
 *  the deterministic concept for any missing/invalid field. */
export function normalizeBrandSpec(raw: unknown, base: BrandSpec): BrandSpec {
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;
  const rp = (r.palette ?? {}) as Record<string, unknown>;

  const palette: BrandPalette = {
    primary: isHex(rp.primary) ? rp.primary : base.palette.primary,
    bg: isHex(rp.bg) ? rp.bg : base.palette.bg,
    surface: isHex(rp.surface) ? rp.surface : base.palette.surface,
    text: isHex(rp.text) ? rp.text : base.palette.text,
    muted: isHex(rp.muted) ? rp.muted : base.palette.muted,
    accent: isHex(rp.accent) ? rp.accent : base.palette.accent,
  };

  let sections = Array.isArray(r.sections)
    ? (r.sections as unknown[])
        .filter((x) => x && typeof x === "object")
        .slice(0, 3)
        .map((x, i) => {
          const sx = x as Record<string, unknown>;
          return {
            title: clamp(sx.title, 40, base.sections[i]?.title ?? "Built for you"),
            blurb: clamp(sx.blurb, 140, base.sections[i]?.blurb ?? ""),
          };
        })
    : base.sections;
  if (sections.length < 3) sections = base.sections;

  return {
    businessName: clamp(r.businessName, 60, base.businessName),
    tagline: clamp(r.tagline, 60, base.tagline),
    heroHeadline: clamp(r.heroHeadline, 80, base.heroHeadline),
    heroSub: clamp(r.heroSub, 200, base.heroSub),
    ctaLabel: clamp(r.ctaLabel, 28, base.ctaLabel),
    sections,
    palette,
    vibe: clamp(r.vibe, 60, base.vibe),
    aiGenerated: true,
  };
}
