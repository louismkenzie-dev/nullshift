/**
 * FICTIONAL FINANCE FIXTURES for the admin redesign prototype (brief §5.6,
 * §10.1, §12.3, §16 fixtures 2, 3, 5, 6, 8, 10).
 *
 * Nothing here is a real client, a real payment, a real provider identifier or
 * an approved price. Every page under /admin/next/finance renders from this
 * module only — no database reads, no provider calls, no writes. All payment
 * states are simulated. Provider identifiers use sandbox-style prefixes and
 * Xero identifiers are invented.
 *
 * Money is stored as integer minor units (pence) with an explicit currency, so
 * the arithmetic helpers below never touch floating point (brief §12.3).
 *
 * Client ids and refs are shared with `./fixtures.ts` so drill-downs to the
 * client workspace resolve. That module is not edited from here.
 */

import { CLIENTS, type Client } from "./fixtures";

/* ── Money ─────────────────────────────────────────────── */

export type Currency = "GBP";

export type Money = { amountMinor: number; currency: Currency };

export const gbpMinor = (amountMinor: number): Money => ({
  amountMinor,
  currency: "GBP",
});

/** Format minor units without floating point: pounds and pence split by integer maths. */
export function formatMoney(m: Money, opts: { signed?: boolean } = {}): string {
  const negative = m.amountMinor < 0;
  const abs = Math.abs(m.amountMinor);
  const major = Math.floor(abs / 100);
  const minor = abs % 100;
  const majorText = major.toLocaleString("en-GB");
  const symbol = m.currency === "GBP" ? "£" : `${m.currency} `;
  const body = `${symbol}${majorText}.${minor.toString().padStart(2, "0")}`;
  if (negative) return `−${body}`;
  return opts.signed && m.amountMinor > 0 ? `+${body}` : body;
}

export function sumMinor(values: readonly number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}

/* ── Dates ─────────────────────────────────────────────── */

/** The prototype's frozen "now" — every freshness stamp derives from this. */
export const AS_AT = "2026-09-17T09:00:00Z";

export const FRESHNESS = "Fixture · as at 17 Sep 2026 09:00 UTC · no live sync";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** Format an ISO date (YYYY-MM-DD) or timestamp for display in UK order. Pure string maths. */
export function fmtDate(iso: string | undefined | null): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const day = Number(m[3]);
  const month = MONTHS[Number(m[2]) - 1] ?? m[2];
  return `${day} ${month} ${m[1]}`;
}

/* ── Shared client lookup ──────────────────────────────── */

export type ClientRef = {
  id: string;
  legalName: string;
  ref: string;
  model: Client["model"];
};

export function clientRef(id: string): ClientRef {
  const c = CLIENTS.find((x) => x.id === id);
  if (!c) {
    // Fixture drift guard: a finance row must always point at a fixture client.
    return { id, legalName: `Unknown fixture (${id})`, ref: "—", model: "new" };
  }
  return { id: c.id, legalName: c.legalName, ref: c.ref, model: c.model };
}

/* ── Invoices ──────────────────────────────────────────── */

export type InvoiceKind = "build_milestone" | "service_period" | "handover_fee";

export type InvoiceState = "draft" | "issued" | "part_paid" | "paid" | "overdue" | "void";

export type XeroSync =
  | { state: "synced"; xeroInvoiceId: string; lastSyncedAt: string }
  | { state: "create_failed"; attempts: number; lastError: string; exceptionId: string }
  | {
      state: "payment_sync_failed";
      xeroInvoiceId: string;
      lastError: string;
      exceptionId: string;
    }
  | { state: "not_required"; reason: string };

export type TaxBasis = {
  /** Snapshot taken at issue; never recomputed from a live catalogue. */
  code: string;
  ratePct: number;
  basis: string;
  decisionRef?: string;
};

export type IssuedLine = {
  description: string;
  quantity: number;
  unitNetMinor: number;
  netMinor: number;
  taxMinor: number;
  grossMinor: number;
};

export type Allocation = {
  paymentId: string;
  source: "gocardless_collection" | "bank_transfer" | "credit_note";
  amountMinor: number;
  at: string;
  note?: string;
};

export type Credit = {
  id: string;
  kind: "credit_note" | "refund";
  amountMinor: number;
  reason: string;
  at: string;
  issuedBy: string;
};

export type EventRow = { at: string; actor: string; text: string };

export type Invoice = {
  id: string;
  clientId: string;
  kind: InvoiceKind;
  obligation: { id: string; label: string; source: string };
  currency: Currency;
  issuedAt: string;
  dueAt: string;
  state: InvoiceState;
  lines: readonly IssuedLine[];
  tax: TaxBasis;
  netMinor: number;
  taxMinor: number;
  grossMinor: number;
  xero: XeroSync;
  allocations: Allocation[];
  credits: Credit[];
  /** Collection attempt ids (GoCardless) that target this obligation. */
  collectionIds: string[];
  events: EventRow[];
  /** Ids of open exceptions that reference this invoice. */
  exceptionIds: string[];
};

const noTax: TaxBasis = {
  code: "NONE (fixture)",
  ratePct: 0,
  basis:
    "No tax applied in fixtures — Xero tax code and clearing mappings to be approved with the accountant",
  decisionRef: "18.8",
};

const line = (description: string, netMinor: number, tax = noTax): IssuedLine => {
  const taxMinor = Math.round((netMinor * tax.ratePct) / 100);
  return {
    description,
    quantity: 1,
    unitNetMinor: netMinor,
    netMinor,
    taxMinor,
    grossMinor: netMinor + taxMinor,
  };
};

type InvoiceSeed = Omit<Invoice, "netMinor" | "taxMinor" | "grossMinor" | "currency">;

const invoice = (seed: InvoiceSeed): Invoice => {
  const netMinor = sumMinor(seed.lines.map((l) => l.netMinor));
  const taxMinor = sumMinor(seed.lines.map((l) => l.taxMinor));
  return {
    ...seed,
    currency: "GBP",
    netMinor,
    taxMinor,
    grossMinor: netMinor + taxMinor,
  };
};

export const INVOICES: Invoice[] = [
  // Fixture 1 — Northline deposit (paid in two transfers: a split transfer)
  invoice({
    id: "INV-1041-01",
    clientId: "northline",
    kind: "build_milestone",
    obligation: {
      id: "OBL-1041-M1",
      label: "Milestone 1 — Deposit (example 50%)",
      source: "Order Form v1",
    },
    issuedAt: "2026-09-02",
    dueAt: "2026-09-03",
    state: "paid",
    lines: [line("Build deposit — Studio bookings platform (milestone 1 of 3)", 740000)],
    tax: noTax,
    xero: {
      state: "synced",
      xeroInvoiceId: "XI-FIX-2b7c41",
      lastSyncedAt: "2026-09-02T10:14:00Z",
    },
    allocations: [
      {
        paymentId: "BANK-0902-A",
        source: "bank_transfer",
        amountMinor: 500000,
        at: "2026-09-02",
        note: "First of two transfers",
      },
      {
        paymentId: "BANK-0903-B",
        source: "bank_transfer",
        amountMinor: 240000,
        at: "2026-09-03",
        note: "Second transfer — split payment",
      },
    ],
    credits: [],
    collectionIds: [],
    events: [
      {
        at: "2026-09-02T09:58:00Z",
        actor: "system",
        text: "Invoice issued from accepted snapshot (Order Form v1, milestone 1)",
      },
      {
        at: "2026-09-02T10:14:00Z",
        actor: "system",
        text: "Xero invoice record created (XI-FIX-2b7c41)",
      },
      {
        at: "2026-09-02T15:40:00Z",
        actor: "Louis",
        text: "Bank transfer £5,000.00 matched and allocated",
      },
      {
        at: "2026-09-03T11:05:00Z",
        actor: "Louis",
        text: "Bank transfer £2,400.00 matched and allocated — invoice paid",
      },
    ],
    exceptionIds: [],
  }),
  // Fixture 2 — Harbour: three paid milestones
  invoice({
    id: "INV-1037-01",
    clientId: "harbour",
    kind: "build_milestone",
    obligation: {
      id: "OBL-1037-M1",
      label: "Milestone 1 — Deposit",
      source: "Order Form v1",
    },
    issuedAt: "2026-08-11",
    dueAt: "2026-08-12",
    state: "paid",
    lines: [line("Build deposit — Activity booking and waivers", 480000)],
    tax: noTax,
    xero: {
      state: "synced",
      xeroInvoiceId: "XI-FIX-9a01d3",
      lastSyncedAt: "2026-08-11T08:30:00Z",
    },
    allocations: [
      {
        paymentId: "BANK-0812-C",
        source: "bank_transfer",
        amountMinor: 480000,
        at: "2026-08-12",
      },
    ],
    credits: [],
    collectionIds: [],
    events: [
      { at: "2026-08-11T08:20:00Z", actor: "system", text: "Invoice issued" },
      {
        at: "2026-08-12T12:00:00Z",
        actor: "Louis",
        text: "Bank transfer matched — paid",
      },
    ],
    exceptionIds: [],
  }),
  invoice({
    id: "INV-1037-02",
    clientId: "harbour",
    kind: "build_milestone",
    obligation: {
      id: "OBL-1037-M2",
      label: "Milestone 2 — Build complete",
      source: "Order Form v1",
    },
    issuedAt: "2026-09-03",
    dueAt: "2026-09-04",
    state: "paid",
    lines: [line("Build complete — Activity booking and waivers", 240000)],
    tax: noTax,
    xero: {
      state: "synced",
      xeroInvoiceId: "XI-FIX-9a01d4",
      lastSyncedAt: "2026-09-03T08:30:00Z",
    },
    allocations: [
      {
        paymentId: "BANK-0904-D",
        source: "bank_transfer",
        amountMinor: 240000,
        at: "2026-09-04",
      },
    ],
    credits: [],
    collectionIds: [],
    events: [
      {
        at: "2026-09-03T08:20:00Z",
        actor: "system",
        text: "Invoice issued on build review",
      },
      {
        at: "2026-09-04T09:10:00Z",
        actor: "Louis",
        text: "Bank transfer matched — paid",
      },
    ],
    exceptionIds: [],
  }),
  invoice({
    id: "INV-1037-03",
    clientId: "harbour",
    kind: "build_milestone",
    obligation: {
      id: "OBL-1037-M3",
      label: "Milestone 3 — Acceptance",
      source: "Order Form v1",
    },
    issuedAt: "2026-09-10",
    dueAt: "2026-09-11",
    state: "paid",
    lines: [line("Acceptance — Activity booking and waivers", 240000)],
    tax: noTax,
    xero: {
      state: "synced",
      xeroInvoiceId: "XI-FIX-9a01d5",
      lastSyncedAt: "2026-09-10T08:30:00Z",
    },
    allocations: [
      {
        paymentId: "BANK-0911-E",
        source: "bank_transfer",
        amountMinor: 240000,
        at: "2026-09-11",
      },
    ],
    credits: [],
    collectionIds: [],
    events: [
      {
        at: "2026-09-10T08:20:00Z",
        actor: "system",
        text: "Invoice issued on acceptance evidence",
      },
      {
        at: "2026-09-11T14:22:00Z",
        actor: "Louis",
        text: "Bank transfer matched — paid",
      },
    ],
    exceptionIds: [],
  }),
  // Fixture 3 — Cedar: two invoices settled by one transfer
  invoice({
    id: "INV-1029-01",
    clientId: "cedar",
    kind: "build_milestone",
    obligation: {
      id: "OBL-1029-M1",
      label: "Milestone 1 — Deposit",
      source: "Order Form v1",
    },
    issuedAt: "2026-07-01",
    dueAt: "2026-07-02",
    state: "paid",
    lines: [line("Build deposit — Workshop scheduling", 360000)],
    tax: noTax,
    xero: {
      state: "synced",
      xeroInvoiceId: "XI-FIX-4c22e0",
      lastSyncedAt: "2026-07-01T09:00:00Z",
    },
    allocations: [
      {
        paymentId: "BANK-0820-F",
        source: "bank_transfer",
        amountMinor: 360000,
        at: "2026-08-20",
        note: "One transfer of £7,200.00 split across INV-1029-01 and INV-1029-02",
      },
    ],
    credits: [],
    collectionIds: [],
    events: [
      { at: "2026-07-01T09:00:00Z", actor: "system", text: "Invoice issued" },
      {
        at: "2026-08-20T10:30:00Z",
        actor: "Louis",
        text: "£3,600.00 of the £7,200.00 transfer allocated here",
      },
    ],
    exceptionIds: [],
  }),
  invoice({
    id: "INV-1029-02",
    clientId: "cedar",
    kind: "build_milestone",
    obligation: {
      id: "OBL-1029-M2",
      label: "Milestone 2 — Acceptance",
      source: "Order Form v1",
    },
    issuedAt: "2026-08-18",
    dueAt: "2026-08-25",
    state: "paid",
    lines: [line("Acceptance — Workshop scheduling", 360000)],
    tax: noTax,
    xero: {
      state: "synced",
      xeroInvoiceId: "XI-FIX-4c22e1",
      lastSyncedAt: "2026-08-18T09:00:00Z",
    },
    allocations: [
      {
        paymentId: "BANK-0820-F",
        source: "bank_transfer",
        amountMinor: 360000,
        at: "2026-08-20",
        note: "Remainder of the £7,200.00 transfer",
      },
    ],
    credits: [],
    collectionIds: [],
    events: [
      {
        at: "2026-08-18T09:00:00Z",
        actor: "system",
        text: "Invoice issued on acceptance",
      },
      {
        at: "2026-08-20T10:30:00Z",
        actor: "Louis",
        text: "£3,600.00 of the £7,200.00 transfer allocated here — paid",
      },
    ],
    exceptionIds: [],
  }),
  // Fixture 4 — Orbit: independent £600 handover fee, tax basis pending
  invoice({
    id: "INV-1022-H1",
    clientId: "orbit",
    kind: "handover_fee",
    obligation: {
      id: "OBL-1022-H1",
      label: "Independent handover fee",
      source: "Order Form v1 · independent route",
    },
    issuedAt: "2026-09-10",
    dueAt: "2026-09-24",
    state: "issued",
    lines: [
      line(
        "Independent handover — transfer of hosting, repository and data (fixture)",
        60000
      ),
    ],
    tax: {
      code: "PENDING",
      ratePct: 0,
      basis:
        "Tax basis pending decision — the £600 handover fee has no approved tax treatment, due date or scope yet",
      decisionRef: "18.3",
    },
    xero: {
      state: "synced",
      xeroInvoiceId: "XI-FIX-7d0aa9",
      lastSyncedAt: "2026-09-10T09:12:00Z",
    },
    allocations: [],
    credits: [],
    collectionIds: [],
    events: [
      {
        at: "2026-09-10T09:00:00Z",
        actor: "Louis",
        text: "Invoice issued — tax basis recorded as pending (decision 18.3)",
      },
      {
        at: "2026-09-10T09:12:00Z",
        actor: "system",
        text: "Xero invoice record created",
      },
    ],
    exceptionIds: ["EX-0007"],
  }),
  // Fixture 5 — Morrow: service period invoices for the managed bookings platform only
  invoice({
    id: "INV-1015-2026-08",
    clientId: "morrow",
    kind: "service_period",
    obligation: {
      id: "OBL-1015-P-2026-08",
      label: "Bookings platform · Core · August 2026",
      source: "Service schedule v1 (bookings)",
    },
    issuedAt: "2026-08-01",
    dueAt: "2026-08-01",
    state: "paid",
    lines: [
      line("Managed service — Bookings platform, Core (fixture) — 1–31 Aug 2026", 16500),
    ],
    tax: noTax,
    xero: {
      state: "synced",
      xeroInvoiceId: "XI-FIX-c18f22",
      lastSyncedAt: "2026-08-01T06:00:00Z",
    },
    allocations: [
      {
        paymentId: "COL-1015-2026-08",
        source: "gocardless_collection",
        amountMinor: 15000,
        at: "2026-08-03",
      },
      {
        paymentId: "CN-1015-01",
        source: "credit_note",
        amountMinor: 1500,
        at: "2026-07-30",
        note: "Service credit — typed credit note, not a price edit",
      },
    ],
    credits: [
      {
        id: "CN-1015-01",
        kind: "credit_note",
        amountMinor: 1500,
        reason: "Service credit for July booking-widget outage (goodwill)",
        at: "2026-07-30",
        issuedBy: "Louis",
      },
    ],
    collectionIds: ["COL-1015-2026-08"],
    events: [
      {
        at: "2026-07-30T16:00:00Z",
        actor: "Louis",
        text: "Credit note CN-1015-01 £15.00 issued against August period",
      },
      {
        at: "2026-08-01T06:00:00Z",
        actor: "system",
        text: "Period invoice issued; collection requested for £150.00 (net of credit)",
      },
      {
        at: "2026-08-03T07:00:00Z",
        actor: "system",
        text: "Collection confirmed and allocated — paid",
      },
    ],
    exceptionIds: [],
  }),
  invoice({
    id: "INV-1015-2026-09",
    clientId: "morrow",
    kind: "service_period",
    obligation: {
      id: "OBL-1015-P-2026-09",
      label: "Bookings platform · Core · September 2026",
      source: "Service schedule v1 (bookings)",
    },
    issuedAt: "2026-09-01",
    dueAt: "2026-09-01",
    state: "paid",
    lines: [
      line("Managed service — Bookings platform, Core (fixture) — 1–30 Sep 2026", 16500),
    ],
    tax: noTax,
    xero: {
      state: "synced",
      xeroInvoiceId: "XI-FIX-c18f23",
      lastSyncedAt: "2026-09-01T06:00:00Z",
    },
    allocations: [
      {
        paymentId: "COL-1015-2026-09",
        source: "gocardless_collection",
        amountMinor: 16500,
        at: "2026-09-03",
      },
    ],
    credits: [],
    collectionIds: ["COL-1015-2026-09"],
    events: [
      {
        at: "2026-09-01T06:00:00Z",
        actor: "system",
        text: "Period invoice issued; collection requested",
      },
      {
        at: "2026-09-03T07:00:00Z",
        actor: "system",
        text: "Collection confirmed and allocated — paid",
      },
      {
        at: "2026-09-03T07:00:04Z",
        actor: "system",
        text: "Duplicate provider event received and ignored (EX-0005)",
      },
    ],
    exceptionIds: [],
  }),
  // Fixture 6 — Fieldstone: August paid (late payout event), September failed
  invoice({
    id: "INV-1011-2026-08",
    clientId: "fieldstone",
    kind: "service_period",
    obligation: {
      id: "OBL-1011-P-2026-08",
      label: "Field service dispatch · Pro · August 2026",
      source: "Service schedule v1",
    },
    issuedAt: "2026-08-01",
    dueAt: "2026-08-01",
    state: "paid",
    lines: [
      line(
        "Managed service — Field service dispatch, Pro (fixture) — 1–31 Aug 2026",
        24500
      ),
    ],
    tax: noTax,
    xero: {
      state: "synced",
      xeroInvoiceId: "XI-FIX-e5b310",
      lastSyncedAt: "2026-08-01T06:00:00Z",
    },
    allocations: [
      {
        paymentId: "COL-1011-2026-08",
        source: "gocardless_collection",
        amountMinor: 24500,
        at: "2026-08-03",
      },
    ],
    credits: [],
    collectionIds: ["COL-1011-2026-08"],
    events: [
      {
        at: "2026-08-01T06:00:00Z",
        actor: "system",
        text: "Period invoice issued; collection requested",
      },
      {
        at: "2026-08-03T07:00:00Z",
        actor: "system",
        text: "Collection confirmed and allocated — paid",
      },
      {
        at: "2026-09-16T04:12:00Z",
        actor: "system",
        text: "Delayed provider payout event for August processed — no change to obligation state",
      },
    ],
    exceptionIds: [],
  }),
  invoice({
    id: "INV-1011-2026-09",
    clientId: "fieldstone",
    kind: "service_period",
    obligation: {
      id: "OBL-1011-P-2026-09",
      label: "Field service dispatch · Pro · September 2026",
      source: "Service schedule v1",
    },
    issuedAt: "2026-09-01",
    dueAt: "2026-09-01",
    state: "overdue",
    lines: [
      line(
        "Managed service — Field service dispatch, Pro (fixture) — 1–30 Sep 2026",
        24500
      ),
    ],
    tax: noTax,
    xero: {
      state: "synced",
      xeroInvoiceId: "XI-FIX-e5b311",
      lastSyncedAt: "2026-09-01T06:00:00Z",
    },
    allocations: [],
    credits: [],
    collectionIds: ["COL-1011-2026-09"],
    events: [
      {
        at: "2026-09-01T06:00:00Z",
        actor: "system",
        text: "Period invoice issued; collection requested",
      },
      {
        at: "2026-09-03T07:30:00Z",
        actor: "system",
        text: "Collection failed — insufficient funds (provider reason code, fixture) — EX-0003 opened",
      },
      {
        at: "2026-09-04T09:00:00Z",
        actor: "Louis",
        text: "Client contacted; retry proposal drafted, awaiting approval",
      },
    ],
    exceptionIds: ["EX-0003"],
  }),
  // Fixture 8 — Legacy Example Ltd: historical plan, read-only
  invoice({
    id: "INV-0007-2026-09",
    clientId: "legacy",
    kind: "service_period",
    obligation: {
      id: "OBL-0007-P-2026-09",
      label: "Hosting (historical plan) · September 2026",
      source: "Legacy proposal (signed Feb 2026) — read-only",
    },
    issuedAt: "2026-09-01",
    dueAt: "2026-09-01",
    state: "paid",
    lines: [line("Hosting — historical plan id (fixture) — 1–30 Sep 2026", 8000)],
    tax: noTax,
    xero: {
      state: "synced",
      xeroInvoiceId: "XI-FIX-00a7f1",
      lastSyncedAt: "2026-09-01T06:00:00Z",
    },
    allocations: [
      {
        paymentId: "COL-0007-2026-09",
        source: "gocardless_collection",
        amountMinor: 8000,
        at: "2026-09-03",
      },
    ],
    credits: [],
    collectionIds: ["COL-0007-2026-09"],
    events: [
      {
        at: "2026-09-01T06:00:00Z",
        actor: "system",
        text: "Period invoice issued under legacy plan; collection requested",
      },
      {
        at: "2026-09-03T07:00:00Z",
        actor: "system",
        text: "Collection confirmed — payout pending",
      },
    ],
    exceptionIds: [],
  }),
  // Fixture 10 — Westbridge: three milestones, partial payment, Xero outage, unmatched payout
  invoice({
    id: "INV-1033-01",
    clientId: "westbridge",
    kind: "build_milestone",
    obligation: {
      id: "OBL-1033-M1",
      label: "Milestone 1 — Discovery and design",
      source: "Order Form v1",
    },
    issuedAt: "2026-07-16",
    dueAt: "2026-07-20",
    state: "paid",
    lines: [line("Discovery and design — Event ticketing and check-in", 400000)],
    tax: noTax,
    xero: {
      state: "synced",
      xeroInvoiceId: "XI-FIX-b3d901",
      lastSyncedAt: "2026-07-16T09:00:00Z",
    },
    allocations: [
      {
        paymentId: "BANK-0720-G",
        source: "bank_transfer",
        amountMinor: 400000,
        at: "2026-07-20",
      },
    ],
    credits: [],
    collectionIds: [],
    events: [
      { at: "2026-07-16T09:00:00Z", actor: "system", text: "Invoice issued" },
      {
        at: "2026-07-20T11:00:00Z",
        actor: "Louis",
        text: "Bank transfer matched — paid",
      },
    ],
    exceptionIds: [],
  }),
  invoice({
    id: "INV-1033-02",
    clientId: "westbridge",
    kind: "build_milestone",
    obligation: {
      id: "OBL-1033-M2",
      label: "Milestone 2 — Core build",
      source: "Order Form v1",
    },
    issuedAt: "2026-08-25",
    dueAt: "2026-09-01",
    state: "part_paid",
    lines: [line("Core build — Event ticketing and check-in", 400000)],
    tax: noTax,
    xero: {
      state: "payment_sync_failed",
      xeroInvoiceId: "XI-FIX-b3d902",
      lastError:
        "Payment PUT timed out (fixture); Xero still shows £4,000.00 outstanding",
      exceptionId: "EX-0006",
    },
    allocations: [
      {
        paymentId: "BANK-0905-H",
        source: "bank_transfer",
        amountMinor: 250000,
        at: "2026-09-05",
        note: "Partial payment — client email 4 Sep confirms remainder to follow after review",
      },
    ],
    credits: [],
    collectionIds: [],
    events: [
      { at: "2026-08-25T09:00:00Z", actor: "system", text: "Invoice issued" },
      {
        at: "2026-09-05T10:45:00Z",
        actor: "Louis",
        text: "Bank transfer £2,500.00 allocated — part paid, £1,500.00 remaining",
      },
      {
        at: "2026-09-05T10:46:00Z",
        actor: "system",
        text: "Xero payment sync failed — EX-0006 opened; local allocation retained",
      },
      {
        at: "2026-09-02T00:00:00Z",
        actor: "system",
        text: "Invoice overdue (due 1 Sep)",
      },
    ],
    exceptionIds: ["EX-0006", "EX-0008"],
  }),
  invoice({
    id: "INV-1033-03",
    clientId: "westbridge",
    kind: "build_milestone",
    obligation: {
      id: "OBL-1033-M3",
      label: "Milestone 3 — Integrations and launch",
      source: "Order Form v1",
    },
    issuedAt: "2026-09-15",
    dueAt: "2026-09-23",
    state: "issued",
    lines: [line("Integrations and launch — Event ticketing and check-in", 400000)],
    tax: noTax,
    xero: {
      state: "create_failed",
      attempts: 2,
      lastError:
        "Xero API timeout after 30 s (fixture) — no remote id returned; lookup by reference found nothing",
      exceptionId: "EX-0004",
    },
    allocations: [],
    credits: [],
    collectionIds: [],
    events: [
      {
        at: "2026-09-15T09:00:00Z",
        actor: "system",
        text: "Invoice issued locally from accepted snapshot",
      },
      {
        at: "2026-09-15T09:00:31Z",
        actor: "system",
        text: "Xero create attempt 1 failed (timeout) — operation kept",
      },
      {
        at: "2026-09-15T09:15:33Z",
        actor: "system",
        text: "Xero create attempt 2 failed (timeout) — EX-0004 opened, retry held for a human",
      },
    ],
    exceptionIds: ["EX-0004"],
  }),
];

export const invoiceById = (id: string): Invoice | undefined =>
  INVOICES.find((i) => i.id === id);

/** Sum of payment allocations (not credits) against an invoice. */
export function paidMinor(inv: Invoice): number {
  return sumMinor(
    inv.allocations.filter((a) => a.source !== "credit_note").map((a) => a.amountMinor)
  );
}

/** Sum of typed credits and refunds applied to an invoice. */
export function creditedMinor(inv: Invoice): number {
  return sumMinor(
    inv.allocations.filter((a) => a.source === "credit_note").map((a) => a.amountMinor)
  );
}

/** Gross − payments − credits. Never negative; over-allocation is a defect surfaced by `overAllocated`. */
export function remainingMinor(inv: Invoice): number {
  return Math.max(0, inv.grossMinor - paidMinor(inv) - creditedMinor(inv));
}

/** Brief §12.3: one provider payment cannot be allocated beyond its available amount. */
export function overAllocated(inv: Invoice): boolean {
  return paidMinor(inv) + creditedMinor(inv) > inv.grossMinor;
}

export function isOverdue(inv: Invoice, asAt = AS_AT): boolean {
  return (
    remainingMinor(inv) > 0 &&
    inv.state !== "void" &&
    inv.state !== "draft" &&
    inv.dueAt < asAt.slice(0, 10)
  );
}

/* ── Collections ───────────────────────────────────────── */

export type MandateState = "authorised" | "pending_submission" | "cancelled" | "none";

export type CollectionState =
  | "authorised_not_scheduled"
  | "scheduled"
  | "submitted"
  | "confirmed"
  | "failed"
  | "cancelled";

export type PayoutState = "not_applicable" | "pending" | "paid_out" | "late_event";

export type BankMatchState = "not_yet" | "matched" | "unmatched" | "not_applicable";

export type Collection = {
  id: string;
  clientId: string;
  obligation: { id: string; label: string; invoiceId?: string };
  provider: "GoCardless (sandbox fixture)";
  providerIds: { mandate?: string; payment?: string; subscription?: string };
  mandate: MandateState;
  acceptedAmount: Money;
  contractualStart: string;
  requestedChargeDate?: string;
  actualChargeDate?: string;
  state: CollectionState;
  payout: PayoutState;
  payoutId?: string;
  bankMatch: BankMatchState;
  owner: string;
  note?: string;
  exceptionIds: string[];
};

export const COLLECTION_STATE_LABEL: Record<CollectionState, string> = {
  authorised_not_scheduled: "Authorised — not scheduled",
  scheduled: "Scheduled",
  submitted: "Submitted",
  confirmed: "Confirmed",
  failed: "Failed",
  cancelled: "Cancelled",
};

export const PAYOUT_STATE_LABEL: Record<PayoutState, string> = {
  not_applicable: "Not applicable",
  pending: "Pending",
  paid_out: "Paid out",
  late_event: "Paid out (late event)",
};

export const BANK_MATCH_LABEL: Record<BankMatchState, string> = {
  not_yet: "Not yet",
  matched: "Matched",
  unmatched: "Unmatched",
  not_applicable: "Not applicable",
};

export const MANDATE_LABEL: Record<MandateState, string> = {
  authorised: "Authorised",
  pending_submission: "Pending submission",
  cancelled: "Cancelled",
  none: "None",
};

export const COLLECTIONS: Collection[] = [
  {
    id: "COL-1037-2026-10",
    clientId: "harbour",
    obligation: {
      id: "OBL-1037-P-2026-10",
      label: "Activity booking and waivers · Pro · October 2026 (first period)",
    },
    provider: "GoCardless (sandbox fixture)",
    providerIds: { mandate: "MD_FIX_HARB0001" },
    mandate: "authorised",
    acceptedAmount: gbpMinor(24500),
    contractualStart: "2026-10-01",
    state: "authorised_not_scheduled",
    payout: "not_applicable",
    bankMatch: "not_applicable",
    owner: "Finance (Louis)",
    note: "Mandate authorised 12 Sep. No collection is requested until internal activation approval; the provider's banking-day lead time and notice period must be respected before 1 Oct.",
    exceptionIds: [],
  },
  {
    id: "COL-1015-2026-08",
    clientId: "morrow",
    obligation: {
      id: "OBL-1015-P-2026-08",
      label: "Bookings platform · Core · August 2026",
      invoiceId: "INV-1015-2026-08",
    },
    provider: "GoCardless (sandbox fixture)",
    providerIds: {
      mandate: "MD_FIX_MORR0001",
      payment: "PM_FIX_MORR0808",
      subscription: "SB_FIX_MORR0001",
    },
    mandate: "authorised",
    acceptedAmount: gbpMinor(15000),
    contractualStart: "2026-06-01",
    requestedChargeDate: "2026-08-01",
    actualChargeDate: "2026-08-03",
    state: "confirmed",
    payout: "paid_out",
    payoutId: "PO-FIX-0805",
    bankMatch: "matched",
    owner: "Finance (Louis)",
    note: "£150.00 collected: £165.00 period less £15.00 credit note CN-1015-01.",
    exceptionIds: [],
  },
  {
    id: "COL-1015-2026-09",
    clientId: "morrow",
    obligation: {
      id: "OBL-1015-P-2026-09",
      label: "Bookings platform · Core · September 2026",
      invoiceId: "INV-1015-2026-09",
    },
    provider: "GoCardless (sandbox fixture)",
    providerIds: {
      mandate: "MD_FIX_MORR0001",
      payment: "PM_FIX_MORR0909",
      subscription: "SB_FIX_MORR0001",
    },
    mandate: "authorised",
    acceptedAmount: gbpMinor(16500),
    contractualStart: "2026-06-01",
    requestedChargeDate: "2026-09-01",
    actualChargeDate: "2026-09-03",
    state: "confirmed",
    payout: "paid_out",
    payoutId: "PO-FIX-0905",
    bankMatch: "matched",
    owner: "Finance (Louis)",
    exceptionIds: ["EX-0005"],
  },
  {
    id: "COL-1015-2026-10",
    clientId: "morrow",
    obligation: {
      id: "OBL-1015-P-2026-10",
      label: "Bookings platform · Core · October 2026",
    },
    provider: "GoCardless (sandbox fixture)",
    providerIds: { mandate: "MD_FIX_MORR0001", subscription: "SB_FIX_MORR0001" },
    mandate: "authorised",
    acceptedAmount: gbpMinor(16500),
    contractualStart: "2026-06-01",
    requestedChargeDate: "2026-10-01",
    state: "scheduled",
    payout: "not_applicable",
    bankMatch: "not_yet",
    owner: "Finance (Louis)",
    note: "Provider-confirmed charge date 1 Oct 2026.",
    exceptionIds: [],
  },
  {
    id: "COL-1011-2026-08",
    clientId: "fieldstone",
    obligation: {
      id: "OBL-1011-P-2026-08",
      label: "Field service dispatch · Pro · August 2026",
      invoiceId: "INV-1011-2026-08",
    },
    provider: "GoCardless (sandbox fixture)",
    providerIds: {
      mandate: "MD_FIX_FLDS0001",
      payment: "PM_FIX_FLDS0808",
      subscription: "SB_FIX_FLDS0001",
    },
    mandate: "authorised",
    acceptedAmount: gbpMinor(24500),
    contractualStart: "2026-06-01",
    requestedChargeDate: "2026-08-01",
    actualChargeDate: "2026-08-03",
    state: "confirmed",
    payout: "late_event",
    payoutId: "PO-FIX-0805-B",
    bankMatch: "matched",
    owner: "Finance (Louis)",
    note: "The provider's payout event arrived on 16 Sep, after the September failure. The obligation state was already final; the late event changed nothing.",
    exceptionIds: [],
  },
  {
    id: "COL-1011-2026-09",
    clientId: "fieldstone",
    obligation: {
      id: "OBL-1011-P-2026-09",
      label: "Field service dispatch · Pro · September 2026",
      invoiceId: "INV-1011-2026-09",
    },
    provider: "GoCardless (sandbox fixture)",
    providerIds: {
      mandate: "MD_FIX_FLDS0001",
      payment: "PM_FIX_FLDS0909",
      subscription: "SB_FIX_FLDS0001",
    },
    mandate: "authorised",
    acceptedAmount: gbpMinor(24500),
    contractualStart: "2026-06-01",
    requestedChargeDate: "2026-09-01",
    actualChargeDate: "2026-09-03",
    state: "failed",
    payout: "not_applicable",
    bankMatch: "not_applicable",
    owner: "Finance (Louis)",
    note: "Failed: insufficient funds. Retry not scheduled — a retry is a new collection attempt and needs approval.",
    exceptionIds: ["EX-0003"],
  },
  {
    id: "COL-0007-2026-09",
    clientId: "legacy",
    obligation: {
      id: "OBL-0007-P-2026-09",
      label: "Hosting (historical plan) · September 2026",
      invoiceId: "INV-0007-2026-09",
    },
    provider: "GoCardless (sandbox fixture)",
    providerIds: {
      mandate: "MD_FIX_LEGX0001",
      payment: "PM_FIX_LEGX0909",
      subscription: "SB_FIX_LEGX0001",
    },
    mandate: "authorised",
    acceptedAmount: gbpMinor(8000),
    contractualStart: "2026-03-01",
    requestedChargeDate: "2026-09-01",
    actualChargeDate: "2026-09-03",
    state: "confirmed",
    payout: "pending",
    bankMatch: "not_yet",
    owner: "Finance (Louis)",
    note: "Collected but not yet paid out — provider payout expected 18 Sep (fixture).",
    exceptionIds: [],
  },
  {
    id: "COL-0007-2026-10",
    clientId: "legacy",
    obligation: {
      id: "OBL-0007-P-2026-10",
      label: "Hosting (historical plan) · October 2026",
    },
    provider: "GoCardless (sandbox fixture)",
    providerIds: { mandate: "MD_FIX_LEGX0001", subscription: "SB_FIX_LEGX0001" },
    mandate: "authorised",
    acceptedAmount: gbpMinor(8000),
    contractualStart: "2026-03-01",
    requestedChargeDate: "2026-10-01",
    state: "scheduled",
    payout: "not_applicable",
    bankMatch: "not_yet",
    owner: "Finance (Louis)",
    note: "Provider-confirmed charge date 1 Oct 2026. Legacy plan — read-only.",
    exceptionIds: [],
  },
  {
    id: "COL-1015-ROTA-2026-07",
    clientId: "morrow",
    obligation: {
      id: "OBL-1015-ROTA-P-2026-07",
      label: "Staff rota system · former managed arrangement · July 2026",
    },
    provider: "GoCardless (sandbox fixture)",
    providerIds: { mandate: "MD_FIX_MORR0002", subscription: "SB_FIX_MORR0002" },
    mandate: "cancelled",
    acceptedAmount: gbpMinor(0),
    contractualStart: "2026-04-01",
    requestedChargeDate: "2026-07-01",
    state: "cancelled",
    payout: "not_applicable",
    bankMatch: "not_applicable",
    owner: "Finance (Louis)",
    note: "Cancelled before submission: the rota system moved to the independent route and its separate mandate was cancelled at handover (14 Jul). No amount was due.",
    exceptionIds: ["EX-0002"],
  },
];

export const collectionById = (id: string): Collection | undefined =>
  COLLECTIONS.find((c) => c.id === id);

/* ── Subscriptions (one row per billable service) ──────── */

export type SubscriptionRow = {
  id: string;
  clientId: string;
  service: string;
  route: "managed" | "independent";
  legacy: boolean;
  readOnly: boolean;
  governingAcceptance: string;
  package?: string;
  agreedRate?: Money;
  start?: string;
  providerIds: { mandate?: string; subscription?: string };
  nextCollection: string;
  pauseState: "active" | "paused" | "cancelled" | "not started" | "not billable";
  upcomingReview?: string;
  note?: string;
};

export const SUBSCRIPTIONS: SubscriptionRow[] = [
  {
    id: "SUB-1015-BOOKINGS",
    clientId: "morrow",
    service: "Bookings platform",
    route: "managed",
    legacy: false,
    readOnly: false,
    governingAcceptance: "Service schedule v1 (bookings) — accepted 28 May 2026",
    package: "Core (fixture)",
    agreedRate: gbpMinor(16500),
    start: "2026-06-01",
    providerIds: { mandate: "MD_FIX_MORR0001", subscription: "SB_FIX_MORR0001" },
    nextCollection: "1 Oct 2026 (provider-confirmed)",
    pauseState: "active",
    upcomingReview: "2026-09-30",
  },
  {
    id: "SUB-1015-ROTA",
    clientId: "morrow",
    service: "Staff rota system",
    route: "independent",
    legacy: false,
    readOnly: false,
    governingAcceptance:
      "Handover schedule v1 — accepted 30 Jun 2026; handover complete 14 Jul",
    providerIds: {},
    nextCollection: "None — independent",
    pauseState: "not billable",
    note: "Same legal client as the bookings platform; a distinct service arrangement, not a duplicate customer identity. Former mandate cancelled at handover (EX-0002, resolved).",
  },
  {
    id: "SUB-1011-DISPATCH",
    clientId: "fieldstone",
    service: "Field service dispatch",
    route: "managed",
    legacy: false,
    readOnly: false,
    governingAcceptance: "Service schedule v1 — accepted 3 Jun 2026",
    package: "Pro (fixture)",
    agreedRate: gbpMinor(24500),
    start: "2026-06-01",
    providerIds: { mandate: "MD_FIX_FLDS0001", subscription: "SB_FIX_FLDS0001" },
    nextCollection: "Retry not scheduled · 1 Oct period pending",
    pauseState: "active",
    upcomingReview: "2026-12-01",
    note: "September collection failed (EX-0003). No automatic service change.",
  },
  {
    id: "SUB-1037-ACTIVITY",
    clientId: "harbour",
    service: "Activity booking and waivers",
    route: "managed",
    legacy: false,
    readOnly: false,
    governingAcceptance: "Managed service schedule v1 — accepted 12 Sep 2026",
    package: "Pro (fixture)",
    agreedRate: gbpMinor(24500),
    start: "2026-10-01",
    providerIds: { mandate: "MD_FIX_HARB0001" },
    nextCollection: "Authorised — not scheduled",
    pauseState: "not started",
    upcomingReview: "2027-01-01",
    note: "Accepted with a future start. No provider subscription exists yet; nothing is collected before activation approval.",
  },
  {
    id: "SUB-0007-HOSTING",
    clientId: "legacy",
    service: "Hosting (historical plan)",
    route: "managed",
    legacy: true,
    readOnly: true,
    governingAcceptance: "Legacy proposal signed 20 Feb 2026 — preserved, no re-signing",
    package: "hosting (historical id)",
    agreedRate: gbpMinor(8000),
    start: "2026-03-01",
    providerIds: { mandate: "MD_FIX_LEGX0001", subscription: "SB_FIX_LEGX0001" },
    nextCollection: "1 Oct 2026 (provider-confirmed)",
    pauseState: "active",
    upcomingReview: "2027-02-20",
    note: "Read-only. A catalogue price change never edits this row.",
  },
];

/** Clients whose Managed election has no billable row yet, with the reason (brief §5.6). */
export const SUBSCRIPTIONS_WITHOUT_ROW: {
  clientId: string;
  reason: string;
  exceptionId?: string;
}[] = [
  {
    clientId: "northline",
    reason:
      "Managed route elected; package, price and start to be agreed after build acceptance — no row until a service schedule is accepted.",
  },
  {
    clientId: "cedar",
    reason:
      "Contractual billing start 22 Sep with no package acceptance — no row can exist without an accepted schedule.",
    exceptionId: "EX-0001",
  },
  {
    clientId: "westbridge",
    reason: "Managed route elected; package pending build acceptance.",
  },
  {
    clientId: "orbit",
    reason: "Independent route — one-off handover fee only, no recurring subscription.",
  },
];

/* ── Reconciliation ────────────────────────────────────── */

export type PayoutLine = { label: string; amountMinor: number; ref?: string };

export type SuggestedMatch = {
  invoiceId: string;
  amountMinor: number;
  confidence: "high" | "ambiguous";
  evidence: string[];
  ambiguity?: string;
};

export type Payout = {
  id: string;
  source: "gocardless_payout" | "bank_receipt";
  clientId?: string;
  receivedAt: string;
  currency: Currency;
  grossMinor: number;
  refunds: PayoutLine[];
  fees: PayoutLine[];
  adjustments: PayoutLine[];
  /** The amount the provider or bank says landed. Compared against the computed net. */
  statedNetMinor: number;
  bankEvidence?: { statementLine: string; reference: string; at: string };
  matchState: "matched" | "unmatched" | "needs_review";
  allocations: { invoiceId: string; amountMinor: number }[];
  suggestedMatch?: SuggestedMatch;
  owner: string;
  exceptionIds: string[];
};

export const PAYOUTS: Payout[] = [
  {
    id: "PO-FIX-0905",
    source: "gocardless_payout",
    clientId: "morrow",
    receivedAt: "2026-09-05",
    currency: "GBP",
    grossMinor: 16500,
    refunds: [],
    fees: [{ label: "Provider fee (fixture: 1% + 20p)", amountMinor: 185 }],
    adjustments: [],
    statedNetMinor: 16315,
    bankEvidence: {
      statementLine: "GOCARDLESS PAYOUT PO-FIX-0905",
      reference: "PO-FIX-0905",
      at: "2026-09-05",
    },
    matchState: "matched",
    allocations: [{ invoiceId: "INV-1015-2026-09", amountMinor: 16500 }],
    owner: "Finance (Louis)",
    exceptionIds: [],
  },
  {
    id: "PO-FIX-0805-B",
    source: "gocardless_payout",
    clientId: "fieldstone",
    receivedAt: "2026-08-05",
    currency: "GBP",
    grossMinor: 24500,
    refunds: [],
    fees: [{ label: "Provider fee (fixture: 1% + 20p)", amountMinor: 265 }],
    adjustments: [],
    statedNetMinor: 24235,
    bankEvidence: {
      statementLine: "GOCARDLESS PAYOUT PO-FIX-0805-B",
      reference: "PO-FIX-0805-B",
      at: "2026-08-05",
    },
    matchState: "matched",
    allocations: [{ invoiceId: "INV-1011-2026-08", amountMinor: 24500 }],
    owner: "Finance (Louis)",
    exceptionIds: [],
  },
  {
    id: "PO-FIX-0805",
    source: "gocardless_payout",
    clientId: "morrow",
    receivedAt: "2026-08-05",
    currency: "GBP",
    grossMinor: 15000,
    refunds: [],
    fees: [{ label: "Provider fee (fixture: 1% + 20p)", amountMinor: 170 }],
    adjustments: [{ label: "Provider rounding adjustment (fixture)", amountMinor: 1 }],
    statedNetMinor: 14831,
    bankEvidence: {
      statementLine: "GOCARDLESS PAYOUT PO-FIX-0805",
      reference: "PO-FIX-0805",
      at: "2026-08-05",
    },
    matchState: "matched",
    allocations: [{ invoiceId: "INV-1015-2026-08", amountMinor: 15000 }],
    owner: "Finance (Louis)",
    exceptionIds: [],
  },
  {
    id: "BANK-0820-F",
    source: "bank_receipt",
    clientId: "cedar",
    receivedAt: "2026-08-20",
    currency: "GBP",
    grossMinor: 720000,
    refunds: [],
    fees: [],
    adjustments: [],
    statedNetMinor: 720000,
    bankEvidence: {
      statementLine: "CEDAR WORKS LTD INV 1029 01 02",
      reference: "INV 1029 01 02",
      at: "2026-08-20",
    },
    matchState: "matched",
    allocations: [
      { invoiceId: "INV-1029-01", amountMinor: 360000 },
      { invoiceId: "INV-1029-02", amountMinor: 360000 },
    ],
    owner: "Finance (Louis)",
    exceptionIds: [],
  },
  {
    id: "BANK-0905-H",
    source: "bank_receipt",
    clientId: "westbridge",
    receivedAt: "2026-09-05",
    currency: "GBP",
    grossMinor: 250000,
    refunds: [],
    fees: [],
    adjustments: [],
    statedNetMinor: 250000,
    bankEvidence: {
      statementLine: "WESTBRIDGE EVENTS M2 PART",
      reference: "M2 PART",
      at: "2026-09-05",
    },
    matchState: "matched",
    allocations: [{ invoiceId: "INV-1033-02", amountMinor: 250000 }],
    owner: "Finance (Louis)",
    exceptionIds: [],
  },
  {
    id: "BANK-0916-J",
    source: "bank_receipt",
    receivedAt: "2026-09-16",
    currency: "GBP",
    grossMinor: 250000,
    refunds: [],
    fees: [],
    adjustments: [],
    statedNetMinor: 250000,
    bankEvidence: {
      statementLine: "WESTBRIDGE EVENTS LTD",
      reference: "(no invoice reference)",
      at: "2026-09-16",
    },
    matchState: "needs_review",
    allocations: [],
    suggestedMatch: {
      invoiceId: "INV-1033-02",
      amountMinor: 150000,
      confidence: "ambiguous",
      evidence: [
        "Payer name matches the Westbridge Events legal name on the Order Form",
        "Amount £2,500.00 equals the 5 Sep part payment, not the £1,500.00 remaining on milestone 2",
        "Milestone 3 (£4,000.00) is also open and unsynced — the transfer could be an early part payment of that",
        "No invoice reference in the statement line; client email of 4 Sep mentioned only one further payment",
      ],
      ambiguity:
        "Amount fits neither open Westbridge invoice exactly. Possible duplicate of the 5 Sep transfer. A human must choose: allocate £1,500.00 to milestone 2 and £1,000.00 to milestone 3, hold, or refund.",
    },
    owner: "Finance (Louis)",
    exceptionIds: ["EX-0008"],
  },
];

export const payoutById = (id: string): Payout | undefined =>
  PAYOUTS.find((p) => p.id === id);

/** gross − refunds − fees ± adjustments = net (brief §5.6). Integer arithmetic only. */
export function netPayoutMinor(p: Payout): number {
  return (
    p.grossMinor -
    sumMinor(p.refunds.map((l) => l.amountMinor)) -
    sumMinor(p.fees.map((l) => l.amountMinor)) +
    sumMinor(p.adjustments.map((l) => l.amountMinor))
  );
}

export function payoutBalances(p: Payout): boolean {
  return netPayoutMinor(p) === p.statedNetMinor;
}

export function allocatedMinor(p: Payout): number {
  return sumMinor(p.allocations.map((a) => a.amountMinor));
}

/** A payout's allocations can never exceed its gross (brief §12.3). */
export function payoutOverAllocated(p: Payout): boolean {
  return allocatedMinor(p) > p.grossMinor;
}

/* ── Exceptions ────────────────────────────────────────── */

export type ExceptionKind =
  | "missing_consent"
  | "cancelled_mandate"
  | "failed_collection"
  | "xero_outage"
  | "duplicate_warning"
  | "balance_mismatch"
  | "link_closure_failure"
  | "unmatched_payout";

export const EXCEPTION_KIND_LABEL: Record<ExceptionKind, string> = {
  missing_consent: "Missing consent",
  cancelled_mandate: "Cancelled mandate",
  failed_collection: "Failed collection",
  xero_outage: "Xero outage",
  duplicate_warning: "Duplicate warning",
  balance_mismatch: "Balance mismatch",
  link_closure_failure: "Link-closure failure",
  unmatched_payout: "Unmatched payout",
};

export type ExceptionState =
  | "open"
  | "awaiting_approval"
  | "awaiting_client"
  | "resolved";

export type Attempt = { at: string; by: string; action: string; outcome: string };

export type SafeRetry = {
  /** Exactly what a retry will do — shown verbatim on the button's explanation. */
  does: string;
  /** Exactly what a retry will never do. */
  never: string;
  /** Why the retry is or is not available right now. */
  availability: "available" | "needs_approval" | "not_applicable";
  requiresSecondPerson: boolean;
};

export type FinanceException = {
  id: string;
  kind: ExceptionKind;
  clientId: string;
  title: string;
  state: ExceptionState;
  openedAt: string;
  resolvedAt?: string;
  owner: string;
  amount?: Money;
  links: {
    invoiceId?: string;
    collectionId?: string;
    payoutId?: string;
    subscriptionId?: string;
  };
  summary: string;
  attempts: Attempt[];
  retry: SafeRetry;
  resolution?: { evidence: string[]; by: string };
  nextStep: string;
};

export const EXCEPTIONS: FinanceException[] = [
  {
    id: "EX-0001",
    kind: "missing_consent",
    clientId: "cedar",
    title: "Contractual billing start 22 Sep with no package acceptance or mandate",
    state: "awaiting_client",
    openedAt: "2026-09-08",
    owner: "Finance (Louis)",
    links: {},
    summary:
      "Cedar Works elected the Managed route on Order Form v1 with a contractual billing start of 22 Sep 2026. No service schedule has been accepted and no mandate exists, so there is no consent to collect anything. The gap responsibility has been recorded; nothing can be scheduled until a schedule is accepted and a mandate is authorised.",
    attempts: [
      {
        at: "2026-09-08T10:00:00Z",
        by: "Louis",
        action: "Package options and service-schedule draft sent to signatory",
        outcome: "Awaiting client",
      },
      {
        at: "2026-09-15T09:30:00Z",
        by: "Louis",
        action: "Reminder with the 22 Sep date and gap-responsibility note",
        outcome: "Read receipt only",
      },
    ],
    retry: {
      does: "Re-sends the service-schedule acceptance request to the signatory and logs the send.",
      never:
        "It never creates a subscription, mandate, invoice or collection; consent cannot be inferred from silence.",
      availability: "available",
      requiresSecondPerson: false,
    },
    nextStep:
      "Call the signatory before 22 Sep; if no acceptance, record the post-launch gap arrangement explicitly.",
  },
  {
    id: "EX-0002",
    kind: "cancelled_mandate",
    clientId: "morrow",
    title: "Mandate for the staff rota arrangement cancelled at handover",
    state: "resolved",
    openedAt: "2026-07-14",
    resolvedAt: "2026-07-15",
    owner: "Finance (Louis)",
    links: { collectionId: "COL-1015-ROTA-2026-07", subscriptionId: "SUB-1015-ROTA" },
    summary:
      "The staff rota system moved from a managed arrangement to the independent route. Its own mandate (MD_FIX_MORR0002) was cancelled on 14 Jul. The bookings platform's mandate (MD_FIX_MORR0001) is a separate arrangement under the same legal client and was not affected.",
    attempts: [
      {
        at: "2026-07-14T16:02:00Z",
        by: "system",
        action: "Provider event mandates.cancelled received for MD_FIX_MORR0002",
        outcome: "Exception opened; July rota collection cancelled before submission",
      },
      {
        at: "2026-07-15T09:10:00Z",
        by: "Louis",
        action: "Checked open obligations for the rota arrangement",
        outcome: "None — handover schedule settles the arrangement",
      },
    ],
    retry: {
      does: "Nothing — a cancelled mandate is never re-created automatically.",
      never: "It never re-submits a mandate or charges the other arrangement's mandate.",
      availability: "not_applicable",
      requiresSecondPerson: false,
    },
    resolution: {
      evidence: [
        "Handover completion recorded 14 Jul with client acknowledgement",
        "No open obligation on OBL-1015-ROTA-*; July collection cancelled at £0.00",
        "Bookings mandate MD_FIX_MORR0001 verified active on 15 Jul",
      ],
      by: "Louis",
    },
    nextStep: "None — closed with evidence.",
  },
  {
    id: "EX-0003",
    kind: "failed_collection",
    clientId: "fieldstone",
    title: "September collection failed — insufficient funds",
    state: "awaiting_approval",
    openedAt: "2026-09-03",
    owner: "Finance (Louis)",
    amount: gbpMinor(24500),
    links: {
      invoiceId: "INV-1011-2026-09",
      collectionId: "COL-1011-2026-09",
      subscriptionId: "SUB-1011-DISPATCH",
    },
    summary:
      "The 1 Sep collection of £245.00 for the September service period failed. The obligation stays open and overdue. A delayed provider event for the August payout arrived on 16 Sep and was applied to August only; it did not alter the September state. Service continues unchanged until a decision is recorded.",
    attempts: [
      {
        at: "2026-09-03T07:30:00Z",
        by: "system",
        action: "Provider event payments.failed (insufficient funds)",
        outcome: "Exception opened; no automatic retry",
      },
      {
        at: "2026-09-04T09:00:00Z",
        by: "Louis",
        action: "Client contacted; retry proposal drafted for 22 Sep",
        outcome: "Awaiting second-person approval",
      },
      {
        at: "2026-09-16T04:12:00Z",
        by: "system",
        action: "Late payout event for August processed",
        outcome: "August only — no change here",
      },
    ],
    retry: {
      does: "Submits ONE new collection attempt of £245.00 against mandate MD_FIX_FLDS0001 for the September obligation on the chosen date, after notice.",
      never:
        "It never charges twice for the same period and never touches the accounting record until the provider confirms.",
      availability: "needs_approval",
      requiresSecondPerson: true,
    },
    nextStep: "Approve the retry date or agree a bank transfer with the client.",
  },
  {
    id: "EX-0004",
    kind: "xero_outage",
    clientId: "westbridge",
    title: "Xero invoice creation failed for milestone 3",
    state: "open",
    openedAt: "2026-09-15",
    owner: "Finance (Louis)",
    amount: gbpMinor(400000),
    links: { invoiceId: "INV-1033-03" },
    summary:
      "INV-1033-03 was issued locally from the accepted snapshot but the Xero create call timed out twice and returned no remote id. A lookup by reference found nothing in Xero, so a retry is safe. The local invoice is the obligation; Xero is a projection of it.",
    attempts: [
      {
        at: "2026-09-15T09:00:31Z",
        by: "system",
        action: "Xero create — attempt 1",
        outcome: "Timeout after 30 s",
      },
      {
        at: "2026-09-15T09:15:33Z",
        by: "system",
        action: "Xero create — attempt 2 (after lookup by reference: not found)",
        outcome: "Timeout after 30 s; held for a human",
      },
    ],
    retry: {
      does: "Retry creates the Xero invoice record only, after a fresh lookup by reference to avoid a duplicate.",
      never:
        "It never collects, never re-issues the invoice and never changes the amount due.",
      availability: "available",
      requiresSecondPerson: false,
    },
    nextStep:
      "Retry once the Xero status page is green; if a record now exists, link it instead of creating.",
  },
  {
    id: "EX-0005",
    kind: "duplicate_warning",
    clientId: "morrow",
    title: "Duplicate provider event for the September collection",
    state: "resolved",
    openedAt: "2026-09-03",
    resolvedAt: "2026-09-03",
    owner: "Finance (Louis)",
    amount: gbpMinor(16500),
    links: { invoiceId: "INV-1015-2026-09", collectionId: "COL-1015-2026-09" },
    summary:
      "The provider delivered payments.confirmed for PM_FIX_MORR0909 twice, four seconds apart. The second delivery matched an existing allocation of the full amount and was ignored. The invoice was not marked paid twice and no second allocation was written.",
    attempts: [
      {
        at: "2026-09-03T07:00:00Z",
        by: "system",
        action: "payments.confirmed (delivery 1)",
        outcome: "Allocated £165.00 to INV-1015-2026-09",
      },
      {
        at: "2026-09-03T07:00:04Z",
        by: "system",
        action: "payments.confirmed (delivery 2, same event id)",
        outcome: "Rejected: payment already fully allocated",
      },
    ],
    retry: {
      does: "Nothing — duplicate deliveries are discarded by event id.",
      never:
        "It never allocates the same provider payment twice beyond its available amount.",
      availability: "not_applicable",
      requiresSecondPerson: false,
    },
    resolution: {
      evidence: [
        "Event ids identical (EV_FIX_9f3a…)",
        "Allocation total £165.00 equals payment amount £165.00",
        "Xero shows one payment against XI-FIX-c18f23",
      ],
      by: "system",
    },
    nextStep: "None — closed automatically with evidence.",
  },
  {
    id: "EX-0006",
    kind: "balance_mismatch",
    clientId: "westbridge",
    title: "Milestone 2 balance differs between the ledger and Xero",
    state: "open",
    openedAt: "2026-09-05",
    owner: "Finance (Louis)",
    amount: gbpMinor(150000),
    links: { invoiceId: "INV-1033-02", payoutId: "BANK-0905-H" },
    summary:
      "The ledger shows £1,500.00 remaining on INV-1033-02 after a £2,500.00 bank transfer was allocated. Xero still shows £4,000.00 outstanding because the payment PUT timed out and was never retried (the legacy sync fires payments at most three times and does not retry).",
    attempts: [
      {
        at: "2026-09-05T10:46:00Z",
        by: "system",
        action: "Xero payment PUT £2,500.00 against XI-FIX-b3d902",
        outcome: "Timeout; local allocation kept",
      },
    ],
    retry: {
      does: "Retry posts the £2,500.00 payment record to Xero against XI-FIX-b3d902 after checking Xero's payments list for an existing one.",
      never: "It never collects from the client and never changes the ledger allocation.",
      availability: "available",
      requiresSecondPerson: false,
    },
    nextStep:
      "Retry the payment sync; if Xero already has the payment, mark the mismatch resolved with the Xero payment id.",
  },
  {
    id: "EX-0007",
    kind: "link_closure_failure",
    clientId: "orbit",
    title: "Connected-account link could not be closed at handover",
    state: "open",
    openedAt: "2026-09-12",
    owner: "Finance (Louis)",
    links: { invoiceId: "INV-1022-H1" },
    summary:
      "Orbit's independent handover requires closing the platform link to the client's connected payment account and settling the application-fee disposition. The provider rejected the closure because the fee disposition is unresolved (decision 18.4). Until it closes, the account still appears in Nullshift's platform lists and could attract fees.",
    attempts: [
      {
        at: "2026-09-12T11:00:00Z",
        by: "Louis",
        action: "Requested link closure via the provider dashboard (sandbox fixture)",
        outcome: "Rejected: outstanding application-fee disposition",
      },
    ],
    retry: {
      does: "Retry re-requests closure of the platform link for the connected account acct_fix_orbit only.",
      never:
        "It never moves funds, never refunds fees and never revokes the client's own account.",
      availability: "needs_approval",
      requiresSecondPerson: true,
    },
    nextStep:
      "Resolve the application-fee disposition (decision 18.4), then retry closure.",
  },
  {
    id: "EX-0008",
    kind: "unmatched_payout",
    clientId: "westbridge",
    title: "£2,500.00 bank receipt with no invoice reference",
    state: "open",
    openedAt: "2026-09-16",
    owner: "Finance (Louis)",
    amount: gbpMinor(250000),
    links: { payoutId: "BANK-0916-J", invoiceId: "INV-1033-02" },
    summary:
      "A £2,500.00 receipt from Westbridge Events arrived on 16 Sep with no reference. It equals the 5 Sep part payment rather than any open balance, so it may be a duplicate transfer or an early part payment of milestone 3. The suggested match is ambiguous and requires human review; nothing has been allocated.",
    attempts: [
      {
        at: "2026-09-16T06:00:00Z",
        by: "system",
        action: "Automatic match by amount and payer",
        outcome: "Ambiguous — two open invoices, neither equals £2,500.00",
      },
    ],
    retry: {
      does: "Re-runs the matching suggestion with the latest open invoices and statement text.",
      never: "It never allocates, never refunds and never contacts the client.",
      availability: "available",
      requiresSecondPerson: true,
    },
    nextStep:
      "Confirm intent with the client; then allocate (second person) or arrange a refund as a typed operation.",
  },
];

export const exceptionById = (id: string): FinanceException | undefined =>
  EXCEPTIONS.find((e) => e.id === id);

export const EXCEPTION_STATE_LABEL: Record<ExceptionState, string> = {
  open: "Open",
  awaiting_approval: "Awaiting approval",
  awaiting_client: "Awaiting client",
  resolved: "Resolved",
};

/* ── Overview metrics ──────────────────────────────────── */

export type Metric = {
  key: string;
  label: string;
  value: Money;
  count?: number;
  range: string;
  definition: string;
  freshness: string;
  href: string;
  tone?: "neutral" | "warning" | "danger";
  aside?: string;
};

/** Derived entirely from the fixtures above so the figures cannot drift from the detail pages. */
export function overviewMetrics(): Metric[] {
  const contracted = SUBSCRIPTIONS.filter(
    (s) => s.pauseState === "active" && s.agreedRate
  );
  const contractedMinor = sumMinor(contracted.map((s) => s.agreedRate?.amountMinor ?? 0));
  const futureStart = SUBSCRIPTIONS.filter(
    (s) => s.pauseState === "not started" && s.agreedRate
  );
  const futureStartMinor = sumMinor(
    futureStart.map((s) => s.agreedRate?.amountMinor ?? 0)
  );

  const open = INVOICES.filter(
    (i) => remainingMinor(i) > 0 && i.state !== "void" && i.state !== "draft"
  );
  const receivablesMinor = sumMinor(open.map(remainingMinor));
  const overdue = open.filter((i) => isOverdue(i));
  const overdueMinor = sumMinor(overdue.map(remainingMinor));

  const scheduled = COLLECTIONS.filter((c) => c.state === "scheduled");
  const scheduledMinor = sumMinor(scheduled.map((c) => c.acceptedAmount.amountMinor));
  const authorisedNotScheduled = COLLECTIONS.filter(
    (c) => c.state === "authorised_not_scheduled"
  );
  const authorisedMinor = sumMinor(
    authorisedNotScheduled.map((c) => c.acceptedAmount.amountMinor)
  );

  const collectedNotPaidOut = COLLECTIONS.filter(
    (c) => c.state === "confirmed" && c.payout === "pending"
  );
  const collectedNotPaidOutMinor = sumMinor(
    collectedNotPaidOut.map((c) => c.acceptedAmount.amountMinor)
  );

  const unmatched = PAYOUTS.filter((p) => p.matchState !== "matched");
  const unmatchedMinor = sumMinor(unmatched.map((p) => p.statedNetMinor));

  return [
    {
      key: "contracted",
      label: "Contracted service value",
      value: gbpMinor(contractedMinor),
      count: contracted.length,
      range: "Per month · active subscriptions as at 17 Sep 2026",
      definition:
        "Sum of agreed monthly rates on active billable services (managed route, accepted schedule, not paused or cancelled). Excludes accepted future starts, package-pending elections and one-off fees. Nullshift's own recurring sales only.",
      freshness: FRESHNESS,
      href: "/admin/next/finance/subscriptions",
      aside: `Accepted, future start: ${formatMoney(gbpMinor(futureStartMinor))} per month (${futureStart.length}) — not counted`,
    },
    {
      key: "receivables",
      label: "Invoiced receivables",
      value: gbpMinor(receivablesMinor),
      count: open.length,
      range: "Open issued invoices · 1 Jul – 17 Sep 2026 issue dates",
      definition:
        "Gross of issued, non-void invoices less payment allocations and typed credits. Includes not-yet-due balances. Excludes drafts and anything not issued.",
      freshness: FRESHNESS,
      href: "/admin/next/finance/invoices?filter=open",
    },
    {
      key: "overdue",
      label: "Overdue balances",
      value: gbpMinor(overdueMinor),
      count: overdue.length,
      range: "Due before 17 Sep 2026",
      definition:
        "Subset of invoiced receivables whose due date has passed. A failed collection keeps its obligation overdue until settled.",
      freshness: FRESHNESS,
      href: "/admin/next/finance/invoices?filter=overdue",
      tone: overdueMinor > 0 ? "danger" : "neutral",
    },
    {
      key: "scheduled",
      label: "Scheduled collections",
      value: gbpMinor(scheduledMinor),
      count: scheduled.length,
      range: "Provider-confirmed charge dates 17 Sep – 17 Oct 2026",
      definition:
        "Direct Debit collections the provider has confirmed a charge date for. Authorised mandates with no scheduled collection are shown separately and never counted here.",
      freshness: FRESHNESS,
      href: "/admin/next/finance/collections?filter=scheduled",
      aside: `Authorised — not scheduled: ${formatMoney(gbpMinor(authorisedMinor))} (${authorisedNotScheduled.length})`,
    },
    {
      key: "collected",
      label: "Collected, not yet paid out",
      value: gbpMinor(collectedNotPaidOutMinor),
      count: collectedNotPaidOut.length,
      range: "Confirmed collections awaiting provider payout as at 17 Sep 2026",
      definition:
        "Collections the provider has confirmed but not yet paid out to Nullshift's bank account. Gross amounts; provider fees are deducted at payout and shown in Reconciliation.",
      freshness: FRESHNESS,
      href: "/admin/next/finance/collections?filter=collected",
      tone: "warning",
    },
    {
      key: "unmatched",
      label: "Unmatched payouts and receipts",
      value: gbpMinor(unmatchedMinor),
      count: unmatched.length,
      range: "Bank movements without an accepted allocation as at 17 Sep 2026",
      definition:
        "Provider payouts or bank receipts not yet allocated to an obligation, including suggested matches awaiting human review.",
      freshness: FRESHNESS,
      href: "/admin/next/finance/reconciliation",
      tone: unmatched.length > 0 ? "danger" : "neutral",
    },
  ];
}

/* ── Cross-cutting helpers ─────────────────────────────── */

export function invoicesForClient(clientId: string): Invoice[] {
  return INVOICES.filter((i) => i.clientId === clientId);
}

export function exceptionsFor(link: {
  invoiceId?: string;
  collectionId?: string;
  payoutId?: string;
}): FinanceException[] {
  return EXCEPTIONS.filter(
    (e) =>
      (link.invoiceId && e.links.invoiceId === link.invoiceId) ||
      (link.collectionId && e.links.collectionId === link.collectionId) ||
      (link.payoutId && e.links.payoutId === link.payoutId)
  );
}

export function openExceptionCount(): number {
  return EXCEPTIONS.filter((e) => e.state !== "resolved").length;
}
