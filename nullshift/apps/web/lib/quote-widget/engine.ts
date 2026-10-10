/**
 * Nullshift Quote — the pricing engine behind the embeddable widget.
 *
 * Pure TypeScript, no I/O: the same function runs in the browser for the live
 * preview and on the server when a lead is recorded (the server result is the
 * one stored — a tampered client can never store its own price).
 *
 * A trade configures SERVICES (what they do, priced fixed / per unit / per
 * hour) and QUESTIONS (what changes the price: multipliers or add-ons). A
 * customer picks a service, answers the questions, and sees a LOW–HIGH range.
 * The range is the point: a widget that pretends to know the exact price loses
 * the trade money or the customer's trust. Margins are the trade's choice.
 */

export type PricingMode = "fixed" | "per_unit" | "hourly";

export type Service = {
  id: string;
  name: string;
  description?: string;
  mode: PricingMode;
  /** Pence. Fixed price, price per unit, or hourly rate. */
  pricePence: number;
  /** per_unit only. */
  unitLabel?: string;
  minQty?: number;
  maxQty?: number;
  /** hourly only: typical job length in hours. */
  minHours?: number;
  maxHours?: number;
  /** Which questions apply. Empty/undefined = all questions marked `all`. */
  questionIds?: string[];
};

export type QuestionOption = {
  id: string;
  label: string;
  /** Multiplies the running total (1 = no change). */
  multiplier?: number;
  /** Adds a flat amount in pence (can be negative). */
  addPence?: number;
};

export type Question = {
  id: string;
  label: string;
  help?: string;
  type: "choice" | "yesno";
  /** choice: pick one. yesno: options[0] is "Yes", options[1] is "No". */
  options: QuestionOption[];
  /** "all" or the list of service ids it applies to. */
  appliesTo: "all" | string[];
};

export type WidgetConfig = {
  version: 1;
  businessName: string;
  trade: string;
  intro: string;
  ctaLabel: string;
  brand: { colour: string; logoUrl?: string | null; dark: boolean };
  services: Service[];
  questions: Question[];
  /** Range width as a fraction of the base, e.g. 0.1 = ±10%. */
  margins: { lowPct: number; highPct: number };
  /** Flat call-out / attendance fee added to every job, pence. */
  calloutPence: number;
  vat: { registered: boolean; ratePct: number };
  contact: { askPhone: boolean; askPostcode: boolean; askMessage: boolean };
  /** Text shown under the price. */
  disclaimer: string;
};

export type EstimateInput = {
  serviceId: string;
  quantity?: number;
  /** questionId → optionId */
  answers: Record<string, string>;
};

export type EstimateLine = {
  label: string;
  pence: number;
  kind: "base" | "multiplier" | "add" | "callout" | "vat";
};

export type Estimate = {
  ok: true;
  service: Service;
  quantity: number;
  lowPence: number;
  basePence: number;
  highPence: number;
  lines: EstimateLine[];
  includesVat: boolean;
  /** Human summary of each answer, for the lead record and the email. */
  answerSummary: { question: string; answer: string }[];
};

export type EstimateError = { ok: false; error: string };

export const DEFAULT_CONFIG: WidgetConfig = {
  version: 1,
  businessName: "Your business",
  trade: "general",
  intro: "Answer a few quick questions and get a ballpark price straight away.",
  ctaLabel: "Get my price",
  brand: { colour: "#10b981", logoUrl: null, dark: true },
  services: [],
  questions: [],
  margins: { lowPct: 0.1, highPct: 0.15 },
  calloutPence: 0,
  vat: { registered: false, ratePct: 20 },
  contact: { askPhone: true, askPostcode: true, askMessage: false },
  disclaimer:
    "This is a guide price based on your answers, not a fixed quote. We confirm the final price after seeing the job.",
};

export const LIMITS = { services: 40, questions: 20, optionsPerQuestion: 8 };

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const round = (n: number) => Math.round(n);

/** Round a pence amount to a friendly figure: nearest £5 under £500, nearest £10 above. */
export function friendlyPence(pence: number): number {
  if (pence <= 0) return 0;
  const step = pence < 50_000 ? 500 : 1000;
  return Math.round(pence / step) * step;
}

export function questionsFor(config: WidgetConfig, service: Service): Question[] {
  return config.questions.filter((q) => {
    if (service.questionIds && service.questionIds.length > 0)
      return service.questionIds.includes(q.id);
    return (
      q.appliesTo === "all" ||
      (Array.isArray(q.appliesTo) && q.appliesTo.includes(service.id))
    );
  });
}

export function estimate(
  config: WidgetConfig,
  input: EstimateInput
): Estimate | EstimateError {
  const service = config.services.find((s) => s.id === input.serviceId);
  if (!service) return { ok: false, error: "Unknown service." };
  if (!Number.isFinite(service.pricePence) || service.pricePence < 0)
    return { ok: false, error: "Service is not priced." };

  const lines: EstimateLine[] = [];
  let quantity = 1;
  let lowBase: number;
  let highBase: number;

  switch (service.mode) {
    case "fixed": {
      lowBase = highBase = service.pricePence;
      lines.push({ label: service.name, pence: service.pricePence, kind: "base" });
      break;
    }
    case "per_unit": {
      const minQ = service.minQty ?? 1;
      const maxQ = service.maxQty ?? 1000;
      quantity = clamp(Math.floor(input.quantity ?? minQ), minQ, maxQ);
      lowBase = highBase = service.pricePence * quantity;
      lines.push({
        label: `${service.name} × ${quantity} ${service.unitLabel ?? "units"}`,
        pence: lowBase,
        kind: "base",
      });
      break;
    }
    case "hourly": {
      const minH = Math.max(0.5, service.minHours ?? 1);
      const maxH = Math.max(minH, service.maxHours ?? minH);
      lowBase = service.pricePence * minH;
      highBase = service.pricePence * maxH;
      lines.push({
        label: `${service.name} · ${minH}–${maxH} hrs`,
        pence: round((lowBase + highBase) / 2),
        kind: "base",
      });
      break;
    }
    default:
      return { ok: false, error: "Unknown pricing mode." };
  }

  let multiplier = 1;
  let adds = 0;
  const answerSummary: { question: string; answer: string }[] = [];
  for (const q of questionsFor(config, service)) {
    const optId = input.answers[q.id];
    const opt = q.options.find((o) => o.id === optId);
    if (!opt) continue; // unanswered questions contribute nothing
    answerSummary.push({ question: q.label, answer: opt.label });
    if (opt.multiplier && opt.multiplier !== 1) {
      multiplier *= opt.multiplier;
      lines.push({ label: `${q.label}: ${opt.label}`, pence: 0, kind: "multiplier" });
    }
    if (opt.addPence) {
      adds += opt.addPence;
      lines.push({ label: `${q.label}: ${opt.label}`, pence: opt.addPence, kind: "add" });
    }
  }

  let low = lowBase * multiplier + adds;
  let base = ((lowBase + highBase) / 2) * multiplier + adds;
  let high = highBase * multiplier + adds;

  if (config.calloutPence > 0) {
    low += config.calloutPence;
    base += config.calloutPence;
    high += config.calloutPence;
    lines.push({ label: "Call-out", pence: config.calloutPence, kind: "callout" });
  }

  const lowPct = clamp(config.margins.lowPct ?? 0, 0, 0.6);
  const highPct = clamp(config.margins.highPct ?? 0, 0, 1.5);
  low = low * (1 - lowPct);
  high = high * (1 + highPct);

  const includesVat = config.vat.registered && config.vat.ratePct > 0;
  if (includesVat) {
    const r = 1 + config.vat.ratePct / 100;
    lines.push({
      label: `VAT ${config.vat.ratePct}%`,
      pence: round(base * (r - 1)),
      kind: "vat",
    });
    low *= r;
    base *= r;
    high *= r;
  }

  return {
    ok: true,
    service,
    quantity,
    lowPence: friendlyPence(Math.max(0, low)),
    basePence: friendlyPence(Math.max(0, base)),
    highPence: Math.max(
      friendlyPence(Math.max(0, high)),
      friendlyPence(Math.max(0, low))
    ),
    lines,
    includesVat,
    answerSummary,
  };
}

export function gbp(pence: number): string {
  const pounds = pence / 100;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: pounds % 1 === 0 ? 0 : 2,
  }).format(pounds);
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Validation — the console saves whatever the trade typed; this is the gate. */

export type ValidationResult =
  | { ok: true; config: WidgetConfig }
  | { ok: false; errors: string[] };

const isHex = (s: unknown) => typeof s === "string" && /^#[0-9a-fA-F]{6}$/.test(s);
const str = (v: unknown, max: number, fallback = "") =>
  typeof v === "string" ? v.trim().slice(0, max) : fallback;
const num = (v: unknown, fallback: number) => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
};
const idOk = (s: unknown) => typeof s === "string" && /^[a-z0-9_-]{1,40}$/.test(s);

export function validateConfig(raw: unknown): ValidationResult {
  const errors: string[] = [];
  const r = (raw ?? {}) as Record<string, unknown>;
  const brandRaw = (r.brand ?? {}) as Record<string, unknown>;
  const marginsRaw = (r.margins ?? {}) as Record<string, unknown>;
  const vatRaw = (r.vat ?? {}) as Record<string, unknown>;
  const contactRaw = (r.contact ?? {}) as Record<string, unknown>;

  const services: Service[] = [];
  const rawServices = Array.isArray(r.services) ? r.services : [];
  if (rawServices.length > LIMITS.services)
    errors.push(`At most ${LIMITS.services} services.`);
  const seen = new Set<string>();
  rawServices.slice(0, LIMITS.services).forEach((s0, i) => {
    const s = (s0 ?? {}) as Record<string, unknown>;
    const id = idOk(s.id) ? (s.id as string) : `svc_${i + 1}`;
    if (seen.has(id)) errors.push(`Duplicate service id "${id}".`);
    seen.add(id);
    const name = str(s.name, 80);
    if (!name) errors.push(`Service ${i + 1} needs a name.`);
    const mode = (["fixed", "per_unit", "hourly"] as PricingMode[]).includes(
      s.mode as PricingMode
    )
      ? (s.mode as PricingMode)
      : "fixed";
    const pricePence = Math.round(num(s.pricePence, NaN));
    if (!Number.isFinite(pricePence) || pricePence < 0 || pricePence > 100_000_00)
      errors.push(`Service "${name || i + 1}" needs a price between £0 and £100,000.`);
    const svc: Service = {
      id,
      name,
      description: str(s.description, 240) || undefined,
      mode,
      pricePence: Number.isFinite(pricePence) ? pricePence : 0,
    };
    if (mode === "per_unit") {
      svc.unitLabel = str(s.unitLabel, 24) || "units";
      svc.minQty = clamp(Math.floor(num(s.minQty, 1)), 1, 100_000);
      svc.maxQty = clamp(Math.floor(num(s.maxQty, 100)), svc.minQty, 100_000);
    }
    if (mode === "hourly") {
      svc.minHours = clamp(num(s.minHours, 1), 0.5, 500);
      svc.maxHours = clamp(num(s.maxHours, svc.minHours), svc.minHours, 500);
    }
    if (Array.isArray(s.questionIds))
      svc.questionIds = (s.questionIds as unknown[]).filter(idOk) as string[];
    services.push(svc);
  });

  const questions: Question[] = [];
  const rawQuestions = Array.isArray(r.questions) ? r.questions : [];
  if (rawQuestions.length > LIMITS.questions)
    errors.push(`At most ${LIMITS.questions} questions.`);
  const seenQ = new Set<string>();
  rawQuestions.slice(0, LIMITS.questions).forEach((q0, i) => {
    const q = (q0 ?? {}) as Record<string, unknown>;
    const id = idOk(q.id) ? (q.id as string) : `q_${i + 1}`;
    if (seenQ.has(id)) errors.push(`Duplicate question id "${id}".`);
    seenQ.add(id);
    const label = str(q.label, 140);
    if (!label) errors.push(`Question ${i + 1} needs a label.`);
    const type = q.type === "yesno" ? "yesno" : "choice";
    const rawOpts = Array.isArray(q.options) ? q.options : [];
    const options: QuestionOption[] = rawOpts
      .slice(0, LIMITS.optionsPerQuestion)
      .map((o0, j) => {
        const o = (o0 ?? {}) as Record<string, unknown>;
        const mult = num(o.multiplier, 1);
        const add = Math.round(num(o.addPence, 0));
        return {
          id: idOk(o.id) ? (o.id as string) : `o_${j + 1}`,
          label: str(o.label, 80) || `Option ${j + 1}`,
          multiplier: clamp(mult, 0.1, 10),
          addPence: clamp(add, -100_000_00, 100_000_00),
        };
      });
    if (options.length < 2)
      errors.push(`Question "${label || i + 1}" needs at least two options.`);
    const appliesTo =
      q.appliesTo === "all" || !Array.isArray(q.appliesTo)
        ? "all"
        : ((q.appliesTo as unknown[]).filter(idOk) as string[]);
    questions.push({
      id,
      label,
      help: str(q.help, 200) || undefined,
      type,
      options,
      appliesTo,
    });
  });

  const config: WidgetConfig = {
    version: 1,
    businessName: str(r.businessName, 80) || DEFAULT_CONFIG.businessName,
    trade: str(r.trade, 40) || "general",
    intro: str(r.intro, 240) || DEFAULT_CONFIG.intro,
    ctaLabel: str(r.ctaLabel, 40) || DEFAULT_CONFIG.ctaLabel,
    brand: {
      colour: isHex(brandRaw.colour)
        ? (brandRaw.colour as string)
        : DEFAULT_CONFIG.brand.colour,
      logoUrl:
        typeof brandRaw.logoUrl === "string" && /^https:\/\//.test(brandRaw.logoUrl)
          ? brandRaw.logoUrl.slice(0, 400)
          : null,
      dark: brandRaw.dark !== false,
    },
    services,
    questions,
    margins: {
      lowPct: clamp(num(marginsRaw.lowPct, 0.1), 0, 0.6),
      highPct: clamp(num(marginsRaw.highPct, 0.15), 0, 1.5),
    },
    calloutPence: clamp(Math.round(num(r.calloutPence, 0)), 0, 100_000_00),
    vat: {
      registered: vatRaw.registered === true,
      ratePct: clamp(num(vatRaw.ratePct, 20), 0, 30),
    },
    contact: {
      askPhone: contactRaw.askPhone !== false,
      askPostcode: contactRaw.askPostcode !== false,
      askMessage: contactRaw.askMessage === true,
    },
    disclaimer: str(r.disclaimer, 300) || DEFAULT_CONFIG.disclaimer,
  };

  if (errors.length) return { ok: false, errors };
  return { ok: true, config };
}

/** Strip anything a public visitor must not see before sending config to the browser. */
export function publicConfig(config: WidgetConfig): WidgetConfig {
  return config;
}
