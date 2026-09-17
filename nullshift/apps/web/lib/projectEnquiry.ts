export const PROJECT_BUDGETS = [
  "Not sure yet",
  "Under £5,000",
  "£5,000–£15,000",
  "£15,000–£50,000",
  "£50,000–£100,000",
  "£100,000+",
] as const;
export const PROJECT_TIMINGS = [
  "Exploring options",
  "As soon as practical",
  "Within 1–3 months",
  "Within 3–6 months",
  "Later this year",
] as const;
export type ProjectEnquiry = {
  name: string;
  email: string;
  business: string;
  challenge: string;
  budget: string;
  timing: string;
  preferredDate: string;
  preferredTime: string;
};
export type EnquiryField = keyof ProjectEnquiry;
export type EnquiryErrors = Partial<Record<EnquiryField, string>>;

export function londonToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function validateProjectEnquiry(
  input: unknown,
  now = new Date()
): { ok: true; data: ProjectEnquiry } | { ok: false; errors: EnquiryErrors } {
  const body =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const errors: EnquiryErrors = {};
  const text = (key: EnquiryField, min: number, max: number) => {
    const raw = body[key];
    if (raw !== undefined && typeof raw !== "string") errors[key] = "Please enter text.";
    const value = typeof raw === "string" ? raw.trim() : "";
    if (value.length < min) errors[key] = "Please complete this field.";
    if (value.length > max) errors[key] = `Please use no more than ${max} characters.`;
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))
      errors[key] = "Please remove unsupported characters.";
    return value;
  };
  const data = {
    name: text("name", 2, 100),
    email: text("email", 3, 254).toLowerCase(),
    business: text("business", 2, 160),
    challenge: text("challenge", 10, 4000),
    budget: text("budget", 0, 80),
    timing: text("timing", 0, 80),
    preferredDate: text("preferredDate", 0, 10),
    preferredTime: text("preferredTime", 0, 20),
  };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))
    errors.email = "Enter a valid email address.";
  if (data.budget && !(PROJECT_BUDGETS as readonly string[]).includes(data.budget))
    errors.budget = "Choose a budget from the list.";
  if (data.timing && !(PROJECT_TIMINGS as readonly string[]).includes(data.timing))
    errors.timing = "Choose a timeframe from the list.";
  if (data.preferredDate) {
    const parsed = new Date(data.preferredDate + "T12:00:00Z");
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(data.preferredDate) ||
      !Number.isFinite(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== data.preferredDate ||
      data.preferredDate < londonToday(now) ||
      parsed.getTime() > now.getTime() + 366 * 86400000
    )
      errors.preferredDate = "Choose a date within the next year.";
  }
  if (data.preferredTime && !["morning", "afternoon"].includes(data.preferredTime))
    errors.preferredTime = "Choose morning or afternoon.";
  if (data.preferredTime && !data.preferredDate)
    errors.preferredDate = "Choose a date, or leave both preferences blank.";
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, data };
}

/** Only a configured Cal.com event path, never an arbitrary redirect URL. */
export function projectCalendarUrl(value: string | undefined): string | null {
  const path = (value || "")
    .trim()
    .replace(/^https:\/\/cal\.com\//, "")
    .replace(/\/$/, "");
  return /^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)?$/.test(path)
    ? `https://cal.com/${path}`
    : null;
}

export function projectEnquiryLead(data: ProjectEnquiry) {
  return {
    name: data.name,
    email: data.email,
    source: "project_enquiry",
    status: "new" as const,
    // Keep existing funnel answers, generated plans, scores and lead status intact.
    quizAnswers: { projectEnquiry: data },
  };
}

/** Read new enquiries alongside legacy funnel payloads without rewriting either. */
export function readProjectEnquiry(value: unknown): ProjectEnquiry | null {
  if (!value || typeof value !== "object" || !("projectEnquiry" in value)) return null;
  const enquiry = value.projectEnquiry;
  if (!enquiry || typeof enquiry !== "object" || Array.isArray(enquiry)) return null;
  const keys: EnquiryField[] = [
    "name",
    "email",
    "business",
    "challenge",
    "budget",
    "timing",
    "preferredDate",
    "preferredTime",
  ];
  if (
    !keys.every(
      (key) =>
        key in enquiry && typeof (enquiry as Record<string, unknown>)[key] === "string"
    )
  )
    return null;
  return enquiry as ProjectEnquiry;
}
