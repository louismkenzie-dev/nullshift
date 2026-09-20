/** Quote amounts are GBP pence. Internal costs never enter the client document. */
export type QuoteLine = { name: string; quantity: number; unitMinor: number };
export type QuoteDocument = {
  clientId: string;
  business: string;
  email: string;
  title: string;
  summary: string;
  included: string;
  excluded: string;
  acceptance: string;
  warrantyDays: number;
  lines: QuoteLine[];
  vatPct: number;
  route: "unresolved" | "managed" | "independent";
  handoverMinor: number;
  monthlyMinor: number | null;
  billingDate: string;
  transactPct: number | null;
  milestones: { label: string; pct: number }[];
  validUntil: string;
};
export type QuoteCosts = {
  deliveryMinor: number;
  externalMinor: number;
  reserveMinor: number;
  contingencyPct: number;
  targetMarginPct: number;
};
export type QuoteDraft = { document: QuoteDocument; costs: QuoteCosts };
export const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const gbp = (minor: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(
    minor / 100
  );
export function emptyQuote(): QuoteDraft {
  return {
    document: {
      clientId: "",
      business: "",
      email: "",
      title: "",
      summary: "",
      included: "",
      excluded: "",
      acceptance: "",
      warrantyDays: 30,
      lines: [{ name: "", quantity: 1, unitMinor: 0 }],
      vatPct: 0,
      route: "unresolved",
      handoverMinor: 60000,
      monthlyMinor: null,
      billingDate: "",
      transactPct: null,
      milestones: [
        { label: "Project commencement", pct: 50 },
        { label: "Agreed build milestone", pct: 25 },
        { label: "Before production handover", pct: 25 },
      ],
      validUntil: "",
    },
    costs: {
      deliveryMinor: 0,
      externalMinor: 0,
      reserveMinor: 0,
      contingencyPct: 10,
      targetMarginPct: 40,
    },
  };
}
export function quoteTotals(d: QuoteDocument, c: QuoteCosts) {
  const build = d.lines.reduce((n, l) => n + l.quantity * l.unitMinor, 0);
  const handover = d.route === "independent" ? d.handoverMinor : 0;
  const subtotal = build + handover;
  const vat = Math.round((subtotal * d.vatPct) / 100);
  const cost =
    Math.round((c.deliveryMinor + c.externalMinor) * (1 + c.contingencyPct / 100)) +
    c.reserveMinor;
  const suggested = Math.ceil(cost / (1 - c.targetMarginPct / 100) / 100) * 100;
  const marginPct = build ? ((build - cost) / build) * 100 : null;
  let allocated = 0;
  const milestones = d.milestones.map((m, i) => {
    const amount =
      i === d.milestones.length - 1
        ? build - allocated
        : Math.round((build * m.pct) / 100);
    allocated += amount;
    return { ...m, amount };
  });
  return {
    build,
    handover,
    subtotal,
    vat,
    total: subtotal + vat,
    cost,
    suggested,
    marginPct,
    milestones,
  };
}
const isObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown, max: number) => typeof v === "string" && v.length <= max;
const number = (v: unknown, max: number, integer = false): v is number =>
  typeof v === "number" &&
  Number.isFinite(v) &&
  v >= 0 &&
  v <= max &&
  (!integer || Number.isInteger(v));
const date = (v: unknown) =>
  v === "" ||
  (typeof v === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    !Number.isNaN(Date.parse(v)) &&
    new Date(v).toISOString().slice(0, 10) === v);
/** Strict runtime validation; no client-supplied totals, status, author or approval. */
export function parseQuote(
  raw: unknown
): { ok: true; value: QuoteDraft } | { ok: false; error: string } {
  const fail = (error: string) => ({ ok: false as const, error });
  if (!isObject(raw) || !isObject(raw.document) || !isObject(raw.costs))
    return fail("Check the quote details.");
  const d = raw.document,
    c = raw.costs;
  for (const field of ["business", "title", "email", "clientId"])
    if (!text(d[field], 250)) return fail("Check the client and project details.");
  if (!(d.business as string).trim() || !(d.title as string).trim())
    return fail("Business and project names are required.");
  if (d.clientId && !uuidPattern.test(d.clientId as string))
    return fail("Choose a valid client.");
  if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email as string))
    return fail("Enter a valid contact email.");
  for (const field of ["summary", "included", "excluded", "acceptance"])
    if (!text(d[field], 10000))
      return fail("Scope fields must be under 10,000 characters.");
  if (!(d.included as string).trim() || !(d.acceptance as string).trim())
    return fail("Add the included scope and acceptance criteria.");
  if (
    !Array.isArray(d.lines) ||
    d.lines.length < 1 ||
    d.lines.length > 50 ||
    !d.lines.every(
      (l) =>
        isObject(l) &&
        text(l.name, 300) &&
        (l.name as string).trim() &&
        number(l.quantity, 10000, true) &&
        l.quantity > 0 &&
        number(l.unitMinor, 100000000, true)
    )
  )
    return fail("Add 1–50 named line items with whole quantities and valid prices.");
  if (
    !number(d.vatPct, 100) ||
    !number(d.warrantyDays, 365, true) ||
    !number(d.handoverMinor, 100000000, true) ||
    (d.monthlyMinor !== null && !number(d.monthlyMinor, 100000000, true)) ||
    (d.transactPct !== null && !number(d.transactPct, 100))
  )
    return fail("Check the tax, warranty and service amounts.");
  if (!["managed", "independent", "unresolved"].includes(String(d.route)))
    return fail("Choose a service route.");
  if (!date(d.billingDate) || !date(d.validUntil)) return fail("Enter valid dates.");
  if (
    !Array.isArray(d.milestones) ||
    d.milestones.length < 1 ||
    d.milestones.length > 8 ||
    !d.milestones.every(
      (m) =>
        isObject(m) &&
        text(m.label, 200) &&
        (m.label as string).trim() &&
        number(m.pct, 100) &&
        m.pct > 0
    ) ||
    Math.abs(d.milestones.reduce((n, m) => n + m.pct, 0) - 100) > 0.001
  )
    return fail("Milestone percentages must total 100%.");
  for (const key of ["deliveryMinor", "externalMinor", "reserveMinor"])
    if (!number(c[key], 100000000, true)) return fail("Enter valid internal costs.");
  if (!number(c.contingencyPct, 100) || !number(c.targetMarginPct, 95))
    return fail("Contingency must be 0–100%; margin 0–95%.");
  // Pick fields explicitly, including nested values. Unknown keys cannot reach storage.
  const document: QuoteDocument = {
    clientId: d.clientId as string,
    business: (d.business as string).trim(),
    email: (d.email as string).trim(),
    title: (d.title as string).trim(),
    summary: (d.summary as string).trim(),
    included: (d.included as string).trim(),
    excluded: (d.excluded as string).trim(),
    acceptance: (d.acceptance as string).trim(),
    warrantyDays: d.warrantyDays,
    lines: d.lines.map((l) => ({
      name: l.name.trim(),
      quantity: l.quantity,
      unitMinor: l.unitMinor,
    })),
    vatPct: d.vatPct,
    route: d.route as QuoteDocument["route"],
    handoverMinor: d.handoverMinor,
    monthlyMinor: d.route === "managed" ? (d.monthlyMinor as number | null) : null,
    billingDate: d.route === "managed" ? (d.billingDate as string) : "",
    transactPct: d.transactPct as number | null,
    milestones: d.milestones.map((m) => ({ label: m.label.trim(), pct: m.pct })),
    validUntil: d.validUntil as string,
  };
  const costs: QuoteCosts = {
    deliveryMinor: c.deliveryMinor as number,
    externalMinor: c.externalMinor as number,
    reserveMinor: c.reserveMinor as number,
    contingencyPct: c.contingencyPct,
    targetMarginPct: c.targetMarginPct,
  };
  if (
    quoteTotals(document, costs).total > 1000000000 ||
    quoteTotals(document, costs).build <= 0
  )
    return fail("The build total must be above £0 and the quote at most £10 million.");
  return { ok: true, value: { document, costs } };
}
