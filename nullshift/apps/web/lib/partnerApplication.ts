/**
 * Partner programme application — field list, option sets and validation.
 *
 * Shared by the /partners form (client) and /api/partner-application (server)
 * so both sides agree on what a valid application is. Pure: no DOM, no DB.
 * Figures and terms come from docs/partners/PROGRAMME-BRIEF-2026-10-09.md.
 */

export const AGENCY_TYPES = [
  { value: "growth_consultancy", label: "Growth or business consultancy" },
  { value: "marketing_seo_ppc", label: "Marketing, SEO or PPC agency" },
  { value: "design_brand", label: "Design or brand studio" },
  { value: "social", label: "Social media management" },
  { value: "accountancy", label: "Accountancy or bookkeeping" },
  { value: "other", label: "Something else" },
] as const;

export const TEAM_SIZES = [
  { value: "1", label: "Just me" },
  { value: "2-5", label: "2–5 people" },
  { value: "6-20", label: "6–20 people" },
  { value: "21+", label: "21 or more" },
] as const;

export const MODEL_INTERESTS = [
  { value: "referral", label: "Referral — introduce clients, earn 10% of the build fee" },
  { value: "white_label", label: "White-label — sell under your brand at 25% off list" },
  { value: "both", label: "Both, or not sure yet" },
] as const;

export type AgencyType = (typeof AGENCY_TYPES)[number]["value"];
export type TeamSize = (typeof TEAM_SIZES)[number]["value"];
export type ModelInterest = (typeof MODEL_INTERESTS)[number]["value"];

export type PartnerApplication = {
  agencyName: string;
  website: string;
  country: string;
  contactName: string;
  role: string;
  email: string;
  agencyType: string;
  teamSize: string;
  modelInterest: string;
  clientTypes: string;
  message: string;
};
export type PartnerField = keyof PartnerApplication;
export type PartnerErrors = Partial<Record<PartnerField, string>>;

export const EMPTY_PARTNER_APPLICATION: PartnerApplication = {
  agencyName: "",
  website: "",
  country: "",
  contactName: "",
  role: "",
  email: "",
  agencyType: "",
  teamSize: "",
  modelInterest: "",
  clientTypes: "",
  message: "",
};

const PARTNER_FIELDS: PartnerField[] = Object.keys(
  EMPTY_PARTNER_APPLICATION
) as PartnerField[];

const inList = (list: readonly { value: string }[], value: string) =>
  list.some((o) => o.value === value);

/** Accepts "example.com", "www.example.com" or a full http(s) URL; returns a
 *  normalised https URL. Anything with another scheme or no dot is rejected. */
export function normaliseWebsite(raw: string): string | null {
  const value = raw.trim();
  if (!value) return "";
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) && !/^https?:\/\//i.test(value)) return null;
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    if (!/^https?:$/.test(url.protocol)) return null;
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(url.hostname)) return null;
    if (url.username || url.password) return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function validatePartnerApplication(
  input: unknown
): { ok: true; data: PartnerApplication } | { ok: false; errors: PartnerErrors } {
  const body =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const errors: PartnerErrors = {};
  const text = (key: PartnerField, min: number, max: number) => {
    const raw = body[key];
    if (raw !== undefined && typeof raw !== "string") errors[key] = "Please enter text.";
    const value = typeof raw === "string" ? raw.trim() : "";
    if (value.length < min) errors[key] = "Please complete this field.";
    if (value.length > max) errors[key] = `Please use no more than ${max} characters.`;
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))
      errors[key] = "Please remove unsupported characters.";
    return value;
  };

  const data: PartnerApplication = {
    agencyName: text("agencyName", 2, 160),
    website: text("website", 0, 254),
    country: text("country", 2, 80),
    contactName: text("contactName", 2, 100),
    role: text("role", 0, 100),
    email: text("email", 3, 254).toLowerCase(),
    agencyType: text("agencyType", 1, 40),
    teamSize: text("teamSize", 1, 10),
    modelInterest: text("modelInterest", 1, 20),
    clientTypes: text("clientTypes", 0, 500),
    message: text("message", 0, 4000),
  };

  if (!errors.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))
    errors.email = "Enter a valid email address.";
  if (!errors.website) {
    const site = normaliseWebsite(data.website);
    if (site === null) errors.website = "Enter a website address like agency.com.";
    else data.website = site;
  }
  if (!errors.agencyType && !inList(AGENCY_TYPES, data.agencyType))
    errors.agencyType = "Choose the closest match from the list.";
  if (!errors.teamSize && !inList(TEAM_SIZES, data.teamSize))
    errors.teamSize = "Choose a team size from the list.";
  if (!errors.modelInterest && !inList(MODEL_INTERESTS, data.modelInterest))
    errors.modelInterest = "Choose referral, white-label or both.";

  // Unknown keys are dropped silently; the record only ever carries our fields.
  for (const key of Object.keys(data) as PartnerField[])
    if (!PARTNER_FIELDS.includes(key)) delete (data as Record<string, unknown>)[key];

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, data };
}

/** Human labels for the notification email and admin views. */
export function partnerApplicationLabels(data: PartnerApplication) {
  const label = (list: readonly { value: string; label: string }[], v: string) =>
    list.find((o) => o.value === v)?.label ?? v;
  return {
    agencyType: label(AGENCY_TYPES, data.agencyType),
    teamSize: label(TEAM_SIZES, data.teamSize),
    modelInterest: label(MODEL_INTERESTS, data.modelInterest),
  };
}

/** Column mapping for the `partner_applications` table (migration 0069). */
export function partnerApplicationRow(data: PartnerApplication, ip: string | null) {
  return {
    agency_name: data.agencyName,
    website: data.website || null,
    country: data.country,
    contact_name: data.contactName,
    role: data.role || null,
    email: data.email,
    agency_type: data.agencyType,
    team_size: data.teamSize,
    model_interest: data.modelInterest,
    client_types: data.clientTypes || null,
    message: data.message || null,
    status: "new" as const,
    created_ip: ip,
  };
}
