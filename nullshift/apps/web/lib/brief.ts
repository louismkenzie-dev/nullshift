/** Shared between the public /brief form, the /api/briefs endpoint, and the
 *  admin viewer so labels and validation stay consistent.
 */

export type BriefData = {
  clientName: string;
  clientEmail: string;
  companyName: string;
  pages: string[];
  customPage: string;
  designStyle: string;
  hasLogo: string;
  logoNotes: string;
  websitePurpose: string;
  purposeDetail: string;
  budget: number;
  timeline: string;
  additionalNotes: string;
};

export const PAGE_OPTIONS = [
  { id: "home", label: "Homepage" },
  { id: "about", label: "About" },
  { id: "services", label: "Services" },
  { id: "portfolio", label: "Portfolio / Work" },
  { id: "blog", label: "Blog" },
  { id: "contact", label: "Contact" },
  { id: "faq", label: "FAQ" },
  { id: "pricing", label: "Pricing" },
  { id: "team", label: "Team" },
  { id: "testimonials", label: "Testimonials" },
] as const;

export const DESIGN_STYLES = [
  { id: "minimal", label: "Minimal", desc: "Clean, lots of whitespace, understated" },
  { id: "bold", label: "Bold & Modern", desc: "Strong typography, high contrast, impactful" },
  { id: "editorial", label: "Editorial", desc: "Magazine-feel, content-forward, refined" },
  { id: "corporate", label: "Corporate", desc: "Professional, trustworthy, traditional" },
  { id: "creative", label: "Creative / Expressive", desc: "Experimental, unique, artistic" },
  { id: "dark", label: "Dark & Tech", desc: "Dark ground, neon accents, futuristic" },
] as const;

export const PURPOSES = [
  { id: "brand", label: "Brand Presence", desc: "Establish credibility and awareness" },
  { id: "leads", label: "Lead Generation", desc: "Capture enquiries and convert visitors" },
  { id: "ecommerce", label: "Sell Products / Services", desc: "Direct sales or bookings" },
  { id: "portfolio", label: "Showcase Work", desc: "Display projects, case studies, or creative work" },
  { id: "community", label: "Community / Content", desc: "Blog, forum, or membership platform" },
  { id: "app", label: "Web Application", desc: "Interactive tool or SaaS product" },
] as const;

export const TIMELINES = [
  { id: "asap", label: "As soon as possible" },
  { id: "1mo", label: "Within 1 month" },
  { id: "3mo", label: "1 – 3 months" },
  { id: "6mo", label: "3 – 6 months" },
  { id: "flexible", label: "Flexible" },
] as const;

export const LOGO_STATES = [
  { id: "yes", label: "Yes, ready" },
  { id: "wip", label: "In progress" },
  { id: "no", label: "Not yet" },
] as const;

export const BUDGET_MIN = 500;
export const BUDGET_MAX = 10000;
export const BUDGET_STEP = 100;

export function formatBudget(val: number): string {
  if (val >= BUDGET_MAX) return "£10,000+";
  if (val < 1000) return `£${val}`;
  // Show one decimal only when it isn't a clean round of £100s above £1k.
  const k = val / 1000;
  return `£${(k).toFixed(k % 1 === 0 ? 0 : 1)}k`;
}

/** Look up the human label for any option id, falling back to the raw id. */
export function labelFor<T extends { id: string; label: string }>(opts: readonly T[], id: string): string {
  return opts.find(o => o.id === id)?.label ?? id;
}

export function emptyBrief(): BriefData {
  return {
    clientName: "", clientEmail: "", companyName: "",
    pages: [], customPage: "",
    designStyle: "", hasLogo: "", logoNotes: "",
    websitePurpose: "", purposeDetail: "",
    budget: 0, timeline: "", additionalNotes: "",
  };
}
