/**
 * FICTIONAL DEMO DATA for the client-portal prototype at /admin/next/portal
 * (brief §5.10, §8.2–8.6, §13). Nothing here is a real client, a real price or
 * an approved price list; the £600 independent handover fee carries the tax
 * basis "pending decision" (decision register 18.3). The prototype renders from
 * this module only — no database reads, no provider calls, no writes.
 *
 * Client names and ids are shared with `./fixtures` so the staff workspace and
 * the portal preview describe the same fictional people. That module is never
 * edited from here.
 */

import { clientById, type TaskState } from "./fixtures";

/* ── Roles ─────────────────────────────────────────────── */

/** Brief §5.10: signatory, project contact and billing administrator are separate. */
export type PortalRole = "signatory" | "project" | "billing";

export const PORTAL_ROLES: {
  id: PortalRole;
  label: string;
  can: string;
  cannot: string;
}[] = [
  {
    id: "signatory",
    label: "Signatory",
    can: "Accept agreements, service schedules and the build; see everything.",
    cannot: "Nothing is hidden. Bank details are still never typed into Nullshift.",
  },
  {
    id: "project",
    label: "Project contact",
    can: "Provide assets and access, review the build and raise requests.",
    cannot: "Cannot accept agreements, choose a package or set up payment.",
  },
  {
    id: "billing",
    label: "Billing admin",
    can: "See invoices, pay milestones and set up Direct Debit.",
    cannot: "Cannot vary the contract: no agreement, schedule or package acceptance.",
  },
];

export const isPortalRole = (v: unknown): v is PortalRole =>
  v === "signatory" || v === "project" || v === "billing";

/** Only the signatory may accept or vary a contract (brief §5.10). */
export const canVaryContract = (role: PortalRole): boolean => role === "signatory";

/* ── Checklist items ───────────────────────────────────── */

/** Who is expected to complete the item, in client-facing terms. */
export type ItemOwner = "signatory" | "project" | "billing" | "nullshift";

export type ItemState = TaskState;

export type ChecklistItem = {
  id: string;
  label: string;
  /** Why the item is required — always shown (brief §5.10). */
  why: string;
  /** Requirement source, shown in the step screen (brief §8.6). */
  source: string;
  owner: ItemOwner;
  state: ItemState;
  evidence?: string;
  due?: string;
  /** Save-and-return: a partially completed form the client can come back to. */
  draft?: { savedAt: string; fieldsDone: number; fieldsTotal: number };
  /** What the client does on this step. */
  steps: string[];
  /** Direct Debit and card details are entered in the provider-hosted flow only. */
  hostedFlow?: boolean;
  /** Extra note shown in the step screen (blocked reasons, warranty notes…). */
  note?: string;
};

export type Phase = "initial" | "later";

export type UpcomingDate = {
  label: string;
  date: string;
  /** Explains what the date IS, so a contractual date is never read as a charge date. */
  meaning: string;
};

export type PortalInvoice = {
  ref: string;
  label: string;
  amountMinor: number;
  currency: "GBP";
  state: "paid" | "issued" | "scheduled" | "overdue";
  due: string;
  /** Invoices are issued by the accounting system; the portal only mirrors them. */
  issuer: "Xero (fixture)";
};

export type PaymentSetup = {
  route: "managed" | "independent";
  package?: {
    name: string;
    monthlyMinor: number;
    currency: "GBP";
    cadence: "monthly";
    scheduleVersion: string;
    acceptedOn?: string;
  };
  /** The commercial date in the accepted schedule. Never moved by a provider. */
  contractualStart?: string;
  mandate: "authorised" | "none" | "not applicable";
  /** What the provider has actually confirmed. Distinct from contractualStart. */
  providerCollectionDate?: string;
  handoverFee?: {
    amountMinor: number;
    currency: "GBP";
    taxBasis: "pending decision";
    state: "paid" | "issued";
  };
};

export type PortalException = {
  title: string;
  opened: string;
  owner: string;
  /** What the client sees: options, never a default plan or indicative charge. */
  options: string[];
  preserved: string;
};

export type PortalClient = {
  id: string;
  name: string;
  ref: string;
  people: Partial<Record<PortalRole, string>>;
  phase: Phase;
  headline: string;
  intro: string;
  initial: ChecklistItem[];
  later: ChecklistItem[];
  dates: UpcomingDate[];
  invoices: PortalInvoice[];
  payment: PaymentSetup;
  exception?: PortalException;
  help: { owner: string; email: string; hours: string; phone?: string };
};

/* ── Money and labels ──────────────────────────────────── */

export const money = (minor: number, currency: "GBP" = "GBP"): string =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: minor % 100 === 0 ? 0 : 2,
  }).format(minor / 100);

export const STATE_LABEL: Record<ItemState, string> = {
  "not started": "To do",
  "in progress": "In progress",
  "awaiting client": "Waiting for you",
  blocked: "Blocked",
  complete: "Done",
  "not applicable": "Not needed",
  waived: "Waived",
};

export const OWNER_LABEL: Record<ItemOwner, string> = {
  signatory: "Your signatory",
  project: "Your project contact",
  billing: "Your billing admin",
  nullshift: "Nullshift",
};

/** Client-facing owner label, personalised when the viewer is the owner. */
export const ownerLabel = (owner: ItemOwner, viewer: PortalRole): string =>
  owner === viewer ? "You" : OWNER_LABEL[owner];

/* ── Pure derivations (unit-testable) ──────────────────── */

/** An item counts as complete only with real completion; a waiver is not evidence (§8.6). */
export const isComplete = (i: ChecklistItem): boolean => i.state === "complete";

/** Items that are required of someone (not-applicable and waived are excluded from the total). */
export const isRequired = (i: ChecklistItem): boolean =>
  i.state !== "not applicable" && i.state !== "waived";

export type Completion = { done: number; total: number; label: string };

/** "3 of 5 done" — required items only, so the count is meaningful (brief §5.10). */
export function completion(items: ChecklistItem[]): Completion {
  const req = items.filter(isRequired);
  const done = req.filter(isComplete).length;
  return { done, total: req.length, label: `${done} of ${req.length} done` };
}

/** The viewer may act on an item they own that still needs doing. */
export const canAct = (item: ChecklistItem, viewer: PortalRole): boolean =>
  item.owner === viewer && !isComplete(item) && item.state !== "blocked";

/**
 * The ONE next step for this viewer: the first open item they own, else the
 * first open item anyone owns (so the client always sees who is holding things).
 */
export function nextStep(
  items: ChecklistItem[],
  viewer: PortalRole
): { item: ChecklistItem; mine: boolean } | null {
  const open = items.filter((i) => isRequired(i) && !isComplete(i));
  const mine = open.find((i) => canAct(i, viewer));
  if (mine) return { item: mine, mine: true };
  const any = open[0];
  return any ? { item: any, mine: false } : null;
}

/** The checklist the dashboard focuses on. */
export const activeItems = (c: PortalClient): ChecklistItem[] =>
  c.phase === "initial" ? c.initial : c.later;

/* ── Clients ───────────────────────────────────────────── */

const help = {
  owner: "Louis (Nullshift)",
  email: "hello@nullshift.example",
  hours: "Mon–Fri, 09:00–17:30 UK",
};

function named(id: string): { name: string; ref: string } {
  const c = clientById(id);
  return { name: c?.legalName ?? id, ref: c?.ref ?? "NS-0000" };
}

const INITIAL_DONE: ChecklistItem[] = [
  {
    id: "company",
    label: "Company and billing details",
    why: "We need the legal entity, registered address and invoice contact before anything can be issued to you.",
    source: "Onboarding gate",
    owner: "billing",
    state: "complete",
    evidence: "Submitted 1 Sep",
    steps: [
      "Legal name and company number",
      "Registered address",
      "Invoice email and VAT status",
    ],
  },
  {
    id: "agreement",
    label: "Agreement",
    why: "The Order Form fixes what is being built, the price and the route after launch. Work does not start without it.",
    source: "Order Form v1",
    owner: "signatory",
    state: "complete",
    evidence: "Accepted 2 Sep",
    steps: [
      "Read the Order Form and its schedules",
      "Confirm you are authorised to sign",
      "Accept",
    ],
  },
  {
    id: "initial-payment",
    label: "Initial payment",
    why: "The deposit milestone in the Order Form is due before build work is scheduled.",
    source: "Milestone 1 · Order Form v1",
    owner: "billing",
    state: "complete",
    evidence: "Paid 3 Sep · INV-FX-0101",
    steps: ["Open the invoice", "Pay by bank transfer or the hosted payment page"],
    hostedFlow: true,
  },
  {
    id: "assets",
    label: "Assets and access",
    why: "Logos, copy, domain access and any existing accounts are needed to build against real content, not placeholders.",
    source: "Files & access",
    owner: "project",
    state: "complete",
    evidence: "Granted 5 Sep",
    steps: [
      "Upload brand assets",
      "Grant domain registrar access",
      "Share existing accounts to migrate",
    ],
  },
  {
    id: "kickoff",
    label: "Kickoff readiness",
    why: "Confirms who your day-to-day contact is, how you want updates and when you are available for review.",
    source: "Kickoff",
    owner: "project",
    state: "complete",
    evidence: "Confirmed 5 Sep",
    steps: [
      "Confirm your project contact",
      "Choose update cadence",
      "Book the kickoff call",
    ],
  },
];

export const PORTAL_CLIENTS: PortalClient[] = [
  {
    id: "brightwell",
    ...named("brightwell"),
    people: { signatory: "Sam Whitlock", project: "Sam Whitlock", billing: "Dee Anand" },
    phase: "initial",
    headline: "Let's get your project ready",
    intro:
      "Five things unlock the build. Two are done. You can save any step and come back.",
    initial: [
      {
        id: "company",
        label: "Company and billing details",
        why: "We need the legal entity, registered address and invoice contact before anything can be issued to you.",
        source: "Onboarding gate",
        owner: "billing",
        state: "in progress",
        draft: { savedAt: "Yesterday, 16:12", fieldsDone: 4, fieldsTotal: 7 },
        steps: [
          "Legal name and company number",
          "Registered address",
          "Invoice email and VAT status",
        ],
        note: "Your progress is saved. Nothing is sent to Nullshift until you press Submit.",
      },
      {
        id: "agreement",
        label: "Agreement",
        why: "The Order Form fixes what is being built, the price and the route after launch. Work does not start without it.",
        source: "Order Form v1 (draft — not yet issued)",
        owner: "signatory",
        state: "blocked",
        steps: [
          "Read the Order Form and its schedules",
          "Confirm you are authorised to sign",
          "Accept",
        ],
        note: "Nullshift is finishing the legal review of the data schedule. You will be emailed when the Order Form is issued.",
      },
      {
        id: "initial-payment",
        label: "Initial payment",
        why: "The deposit milestone in the Order Form is due before build work is scheduled.",
        source: "Milestone 1 · Order Form v1",
        owner: "billing",
        state: "not started",
        steps: ["Open the invoice", "Pay by bank transfer or the hosted payment page"],
        hostedFlow: true,
        note: "Available once the agreement is accepted. The invoice is issued from our accounting system.",
      },
      {
        id: "assets",
        label: "Assets and access",
        why: "Logos, copy, domain access and any existing accounts are needed to build against real content, not placeholders.",
        source: "Files & access",
        owner: "project",
        state: "complete",
        evidence: "Uploaded 12 Sep",
        steps: [
          "Upload brand assets",
          "Grant domain registrar access",
          "Share existing accounts to migrate",
        ],
      },
      {
        id: "kickoff",
        label: "Kickoff readiness",
        why: "Confirms who your day-to-day contact is, how you want updates and when you are available for review.",
        source: "Kickoff",
        owner: "project",
        state: "complete",
        evidence: "Discovery workshop held 12 Sep",
        steps: [
          "Confirm your project contact",
          "Choose update cadence",
          "Book the kickoff call",
        ],
      },
    ],
    later: [],
    dates: [
      {
        label: "Order Form expected",
        date: "19 Sep 2026",
        meaning: "When Nullshift expects to issue the agreement for signature",
      },
    ],
    invoices: [],
    payment: { route: "managed", mandate: "not applicable" },
    help,
  },
  {
    id: "northline",
    ...named("northline"),
    people: { signatory: "Jide Okafor", project: "Mira Lang", billing: "Jide Okafor" },
    phase: "later",
    headline: "Let's get your project ready",
    intro:
      "Onboarding is complete and the build is under way. The next steps take you from review to launch.",
    initial: INITIAL_DONE,
    later: [
      {
        id: "build-review",
        label: "Build review",
        why: "You see the finished build against the accepted scope with evidence per deliverable, before you are asked to accept anything.",
        source: "Delivery · acceptance gate",
        owner: "nullshift",
        state: "in progress",
        due: "24 Sep 2026",
        steps: [
          "Nullshift shares the review link and evidence",
          "You test against the scope",
          "Defects are logged, not argued",
        ],
      },
      {
        id: "acceptance",
        label: "Build acceptance",
        why: "Acceptance starts the warranty period under your agreement and releases the final build milestone.",
        source: "Order Form v1 · acceptance clause",
        owner: "signatory",
        state: "not started",
        steps: ["Review outstanding defects", "Accept, or accept with listed exceptions"],
        note: "You can accept the build without choosing a managed package. Warranty follows the agreement, not the package.",
      },
      {
        id: "package",
        label: "Managed package selection",
        why: "The Order Form elected the managed route; the package, price, start date and cancellation terms are agreed in a separate service schedule.",
        source: "Managed route · service schedule",
        owner: "signatory",
        state: "not started",
        steps: [
          "Nullshift recommends a package from your actual operating needs",
          "You see scope, exclusions, usage policy, price, tax, cadence, start date and cancellation terms",
          "Your signatory accepts the schedule",
        ],
        note: "No package is pre-selected and nothing is charged until a schedule is accepted.",
      },
      {
        id: "direct-debit",
        label: "Direct Debit setup",
        why: "Recurring service fees are collected by Direct Debit under the accepted schedule.",
        source: "Service schedule · provider-hosted flow",
        owner: "billing",
        state: "blocked",
        steps: [
          "Open the provider-hosted setup page",
          "Enter bank details there",
          "Return here to see the confirmation",
        ],
        hostedFlow: true,
        note: "Available after a service schedule is accepted. Setting up a mandate does not start collection.",
      },
      {
        id: "activation",
        label: "Activation",
        why: "Nullshift confirms every gate (accepted schedule, agreed start, valid mandate, notice period) before the first collection is scheduled.",
        source: "Activation gates",
        owner: "nullshift",
        state: "not started",
        steps: [
          "Gates checked",
          "Collection scheduled with the provider",
          "You see the provider-confirmed date",
        ],
      },
    ],
    dates: [
      {
        label: "Build review",
        date: "24 Sep 2026",
        meaning: "Nullshift presents the build with evidence — not a deadline for you",
      },
      {
        label: "Build milestone invoice",
        date: "On build review",
        meaning: "Milestone 2 is issued when the review is shared",
      },
    ],
    invoices: [
      {
        ref: "INV-FX-0101",
        label: "Deposit (example 50%)",
        amountMinor: 740000,
        currency: "GBP",
        state: "paid",
        due: "3 Sep 2026",
        issuer: "Xero (fixture)",
      },
      {
        ref: "—",
        label: "Build complete (example 25%)",
        amountMinor: 370000,
        currency: "GBP",
        state: "scheduled",
        due: "On build review",
        issuer: "Xero (fixture)",
      },
      {
        ref: "—",
        label: "Acceptance (example 25%)",
        amountMinor: 370000,
        currency: "GBP",
        state: "scheduled",
        due: "On acceptance",
        issuer: "Xero (fixture)",
      },
    ],
    payment: { route: "managed", mandate: "none" },
    help,
  },
  {
    id: "harbour",
    ...named("harbour"),
    people: { signatory: "Priya Nair", project: "Ben Castle", billing: "Priya Nair" },
    phase: "later",
    headline: "Your build is accepted",
    intro:
      "Your managed service starts on 1 October. Nothing is left for you to do right now.",
    initial: INITIAL_DONE,
    later: [
      {
        id: "acceptance",
        label: "Build review and acceptance",
        why: "Acceptance starts the warranty period under your agreement and releases the final build milestone.",
        source: "Acceptance gate",
        owner: "signatory",
        state: "complete",
        evidence: "Accepted 10 Sep with evidence per deliverable",
        steps: ["Review outstanding defects", "Accept, or accept with listed exceptions"],
      },
      {
        id: "package",
        label: "Managed package and service schedule",
        why: "The schedule fixes scope, price, tax, cadence, start date and cancellation terms.",
        source: "Service schedule v1",
        owner: "signatory",
        state: "complete",
        evidence: "Pro (fixture) accepted 12 Sep · £245/month · starts 1 Oct 2026",
        steps: ["Read the schedule", "Accept"],
      },
      {
        id: "direct-debit",
        label: "Direct Debit setup",
        why: "Recurring service fees are collected by Direct Debit under the accepted schedule.",
        source: "Provider-hosted flow",
        owner: "billing",
        state: "complete",
        evidence: "Mandate authorised 12 Sep (provider confirmation)",
        steps: [
          "Open the provider-hosted setup page",
          "Enter bank details there",
          "Return here to see the confirmation",
        ],
        hostedFlow: true,
        note: "A mandate authorises collection; it does not start it. Your first collection date is confirmed separately.",
      },
      {
        id: "activation",
        label: "Activation",
        why: "Nullshift confirms every gate before the first collection is scheduled, respecting the Direct Debit notice period.",
        source: "Activation gates",
        owner: "nullshift",
        state: "in progress",
        due: "26 Sep 2026",
        steps: [
          "Internal approval",
          "Collection scheduled with the provider",
          "You see the provider-confirmed date",
        ],
        note: "You will see the provider-confirmed collection date here once it exists. It may fall after 1 October; the contractual start does not move.",
      },
    ],
    dates: [
      {
        label: "Service starts (contractual)",
        date: "1 Oct 2026",
        meaning:
          "The date your managed service and billing period begin under schedule v1",
      },
      {
        label: "First collection (provider)",
        date: "Not yet scheduled",
        meaning:
          "The date money actually leaves your account, confirmed by the Direct Debit provider — you will get notice first",
      },
    ],
    invoices: [
      {
        ref: "INV-FX-0090",
        label: "Deposit",
        amountMinor: 480000,
        currency: "GBP",
        state: "paid",
        due: "12 Aug 2026",
        issuer: "Xero (fixture)",
      },
      {
        ref: "INV-FX-0097",
        label: "Build complete",
        amountMinor: 240000,
        currency: "GBP",
        state: "paid",
        due: "4 Sep 2026",
        issuer: "Xero (fixture)",
      },
      {
        ref: "INV-FX-0104",
        label: "Acceptance",
        amountMinor: 240000,
        currency: "GBP",
        state: "paid",
        due: "11 Sep 2026",
        issuer: "Xero (fixture)",
      },
    ],
    payment: {
      route: "managed",
      package: {
        name: "Pro (fixture)",
        monthlyMinor: 24500,
        currency: "GBP",
        cadence: "monthly",
        scheduleVersion: "Service schedule v1",
        acceptedOn: "12 Sep 2026",
      },
      contractualStart: "1 Oct 2026",
      mandate: "authorised",
      providerCollectionDate: undefined,
    },
    help,
  },
  {
    id: "orbit",
    ...named("orbit"),
    people: { signatory: "Ana Petrova", project: "Leo Marsh", billing: "Ana Petrova" },
    phase: "later",
    headline: "Let's finish your handover",
    intro:
      "You chose the independent route. Once the transfer gates are met, you run the system and Nullshift steps back.",
    initial: INITIAL_DONE,
    later: [
      {
        id: "acceptance",
        label: "Build review and acceptance",
        why: "Acceptance starts the warranty period under your agreement and releases the final build milestone.",
        source: "Acceptance gate",
        owner: "signatory",
        state: "complete",
        evidence: "Accepted 28 Aug",
        steps: ["Review outstanding defects", "Accept"],
      },
      {
        id: "handover-plan",
        label: "Receiving owner and transfer plan",
        why: "We need to know who takes over hosting, data and accounts before anything is transferred.",
        source: "Independent handover schedule",
        owner: "signatory",
        state: "complete",
        evidence: "Confirmed 1 Sep",
        steps: ["Name the receiving owner or provider", "Agree the transfer plan"],
      },
      {
        id: "accounts",
        label: "Your own hosting, database and domain accounts",
        why: "Everything is transferred into accounts you own and pay for directly. Nullshift does not host for you on this route.",
        source: "Independent handover schedule",
        owner: "project",
        state: "complete",
        evidence: "Verified 9 Sep",
        steps: ["Create the accounts", "Grant Nullshift temporary transfer access"],
      },
      {
        id: "transfer",
        label: "Repository, deployment and data transfer",
        why: "Ownership moves to you with a tested restore, documentation and a secrets-rotation plan.",
        source: "Independent handover schedule",
        owner: "nullshift",
        state: "in progress",
        steps: [
          "Transfer ownership",
          "Restore test",
          "Continuity checks for DNS, email and webhooks",
        ],
      },
      {
        id: "walkthrough",
        label: "Walkthrough and acknowledgement",
        why: "You confirm you have the documentation and can operate the system before Nullshift access is revoked.",
        source: "Independent handover schedule",
        owner: "project",
        state: "not started",
        due: "19 Sep 2026",
        steps: ["Attend the walkthrough", "Acknowledge the documentation"],
      },
      {
        id: "completion",
        label: "Transfer completion",
        why: "Nullshift access is revoked only after every agreed gate; the support and warranty boundary is recorded.",
        source: "Independent handover schedule",
        owner: "nullshift",
        state: "not started",
        steps: ["Gates verified", "Access revoked", "Completion record shared with you"],
        note: "No ongoing Nullshift management subscription is created. Third-party costs are paid by you directly.",
      },
    ],
    dates: [
      {
        label: "Walkthrough",
        date: "19 Sep 2026",
        meaning: "Your acknowledgement is needed before access can be revoked",
      },
    ],
    invoices: [
      {
        ref: "INV-FX-0071",
        label: "Deposit",
        amountMinor: 560000,
        currency: "GBP",
        state: "paid",
        due: "22 Jul 2026",
        issuer: "Xero (fixture)",
      },
      {
        ref: "INV-FX-0088",
        label: "Acceptance",
        amountMinor: 560000,
        currency: "GBP",
        state: "paid",
        due: "29 Aug 2026",
        issuer: "Xero (fixture)",
      },
      {
        ref: "INV-FX-0089",
        label: "Independent handover fee",
        amountMinor: 60000,
        currency: "GBP",
        state: "paid",
        due: "5 Sep 2026",
        issuer: "Xero (fixture)",
      },
    ],
    payment: {
      route: "independent",
      mandate: "not applicable",
      handoverFee: {
        amountMinor: 60000,
        currency: "GBP",
        taxBasis: "pending decision",
        state: "paid",
      },
    },
    help,
  },
  {
    id: "cedar",
    ...named("cedar"),
    people: { signatory: "Tom Reyes", project: "Tom Reyes", billing: "Ruth Ellery" },
    phase: "later",
    headline: "One decision is needed before 22 September",
    intro:
      "Your system is live under an approved interim arrangement. Your managed package has not been accepted, and the agreed start date is close.",
    initial: INITIAL_DONE,
    later: [
      {
        id: "acceptance",
        label: "Build review and acceptance",
        why: "Acceptance starts the warranty period under your agreement.",
        source: "Acceptance gate",
        owner: "signatory",
        state: "complete",
        evidence: "Accepted 8 Sep",
        steps: ["Review outstanding defects", "Accept"],
      },
      {
        id: "package",
        label: "Managed package selection",
        why: "The Order Form elected the managed route with a start of 22 September, but no package has been accepted, so nothing can be billed.",
        source: "Managed route · service schedule",
        owner: "signatory",
        state: "awaiting client",
        due: "22 Sep 2026",
        steps: [
          "Review the recommended package and its schedule",
          "Accept it, or ask for an amendment",
        ],
        note: "No package has been chosen for you and nothing will be charged at an indicative price. The original date is preserved while this is resolved.",
      },
      {
        id: "schedule",
        label: "Service schedule acceptance",
        why: "The schedule is the document you accept; it fixes price, tax, cadence, start and cancellation terms.",
        source: "Consent rule",
        owner: "signatory",
        state: "blocked",
        steps: ["Read the schedule", "Accept"],
        note: "Depends on the package above.",
      },
      {
        id: "direct-debit",
        label: "Direct Debit setup",
        why: "Recurring service fees are collected by Direct Debit under the accepted schedule.",
        source: "Provider-hosted flow",
        owner: "billing",
        state: "not started",
        steps: [
          "Open the provider-hosted setup page",
          "Enter bank details there",
          "Return here to see the confirmation",
        ],
        hostedFlow: true,
        note: "Can be set up early with the correct consent wording; it never starts collection on its own.",
      },
      {
        id: "activation",
        label: "Activation",
        why: "Nullshift confirms every gate before the first collection is scheduled.",
        source: "Activation gates",
        owner: "nullshift",
        state: "blocked",
        steps: ["Gates checked", "Collection scheduled with the provider"],
        note: "Blocked until a schedule is accepted.",
      },
    ],
    dates: [
      {
        label: "Agreed service start",
        date: "22 Sep 2026",
        meaning:
          "The start date in your Order Form. It is preserved; it will not be moved or backdated without an accepted amendment",
      },
      {
        label: "First collection",
        date: "Cannot be scheduled",
        meaning:
          "No accepted schedule and no mandate — nothing is charged until both exist",
      },
    ],
    invoices: [
      {
        ref: "INV-FX-0060",
        label: "Deposit",
        amountMinor: 360000,
        currency: "GBP",
        state: "paid",
        due: "6 Aug 2026",
        issuer: "Xero (fixture)",
      },
      {
        ref: "INV-FX-0087",
        label: "Acceptance",
        amountMinor: 360000,
        currency: "GBP",
        state: "paid",
        due: "8 Sep 2026",
        issuer: "Xero (fixture)",
      },
    ],
    payment: {
      route: "managed",
      contractualStart: "22 Sep 2026",
      mandate: "none",
    },
    exception: {
      title: "Managed package not accepted before the agreed start",
      opened: "15 Sep 2026",
      owner: "Louis (Nullshift finance)",
      options: [
        "Accept the recommended package and schedule before 22 September",
        "Ask for an amendment to the start date or package (needs your signatory)",
        "Continue the approved interim arrangement while a decision is made — costs during the gap are recorded, not assumed",
      ],
      preserved:
        "Nullshift will not pick a plan for you, charge an indicative price, backdate a charge, move the date quietly, switch you to independent handover or shut down your service.",
    },
    help,
  },
];

export const DEFAULT_PORTAL_CLIENT = "northline";

export const portalClientById = (id: string | undefined): PortalClient | undefined =>
  PORTAL_CLIENTS.find((c) => c.id === (id ?? DEFAULT_PORTAL_CLIENT));

export const portalItemById = (
  c: PortalClient,
  id: string
): { item: ChecklistItem; phase: Phase } | undefined => {
  const i = c.initial.find((x) => x.id === id);
  if (i) return { item: i, phase: "initial" };
  const l = c.later.find((x) => x.id === id);
  return l ? { item: l, phase: "later" } : undefined;
};
