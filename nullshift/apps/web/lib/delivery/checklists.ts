/**
 * Checklist generators (brief §5.10, §8.5, §8.6). Pure: no database, no
 * clock, no flags. Each generator returns unsaved `ChecklistTask` /
 * `HandoverTask` records with the requirement source on every item, so the
 * portal can show WHY an item is required and WHO owns it, and a staff action
 * can persist them with `insert … on conflict do nothing`.
 *
 * Rules carried in code rather than comments:
 *  - a waiver is never completion evidence (`isDone` excludes `waived`);
 *  - the later journey branches on the service route — the client never sees
 *    the managed and the independent branches side by side;
 *  - nothing here marks a payment or a signature: the generators only READ
 *    facts passed in (`agreementAccepted`, `depositPaid`, …) and never invent
 *    them.
 */

import type {
  ChecklistTask,
  HandoverTask,
  Journey,
  ServiceRoute,
  TaskEvidence,
  TaskState,
} from "./types";
import {
  CLIENT_LOCKED_STATES,
  CLIENT_SETTABLE_STATES,
  type ClientSettableState,
} from "./types";

/* ── State helpers ─────────────────────────────────────── */

export const STATE_LABEL: Record<TaskState, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  awaiting_client: "Waiting on you",
  blocked: "Blocked",
  complete: "Complete",
  not_applicable: "Not applicable",
  waived: "Waived",
};

/** Done means complete. Waived is a recorded decision, not evidence of completion. */
export const isDone = (t: { state: TaskState }): boolean => t.state === "complete";

/** Required for the completion count: waived and not-applicable items are excluded. */
export const isRequired = (t: { state: TaskState }): boolean =>
  t.state !== "waived" && t.state !== "not_applicable";

export type Completion = { done: number; total: number; label: string };

/** "3 of 5 done" — required items only, so the number means something (§5.10). */
export function completion(tasks: { state: TaskState }[]): Completion {
  const required = tasks.filter(isRequired);
  const done = required.filter(isDone).length;
  return { done, total: required.length, label: `${done} of ${required.length} done` };
}

/** The ONE next step: the first open client-owned task, else the first open task. */
export function nextStep<
  T extends { state: TaskState; owner_kind: "nullshift" | "client" },
>(tasks: T[]): { task: T; mine: boolean } | null {
  const open = tasks.filter((t) => isRequired(t) && !isDone(t));
  const mine = open.find((t) => t.owner_kind === "client" && t.state !== "blocked");
  if (mine) return { task: mine, mine: true };
  return open[0] ? { task: open[0], mine: false } : null;
}

/**
 * Whether — and to what — a client may move a task. Mirrors
 * `portal_update_checklist_task()` in migration 0060 exactly, so the UI never
 * offers a change the database will refuse.
 */
export function clientTransition(
  task: { owner_kind: "nullshift" | "client"; state: TaskState },
  to: string
): { ok: true; state: ClientSettableState } | { ok: false; reason: string } {
  if (task.owner_kind !== "client")
    return { ok: false, reason: "This item is owned by Nullshift." };
  if ((CLIENT_LOCKED_STATES as readonly string[]).includes(task.state))
    return {
      ok: false,
      reason: `This item is ${STATE_LABEL[task.state].toLowerCase()}; Nullshift decides it.`,
    };
  if (!(CLIENT_SETTABLE_STATES as readonly string[]).includes(to))
    return { ok: false, reason: "That state is not available to you." };
  return { ok: true, state: to as ClientSettableState };
}

/**
 * Apply a client update to a task in memory, with the same rules as the SQL
 * function: state and evidence only, evidence appended, completing needs
 * evidence, completed_at set only on complete and cleared otherwise.
 */
export function applyClientUpdate<T extends ChecklistTask | HandoverTask>(
  task: T,
  to: string,
  evidence: TaskEvidence[] | null,
  now: string
): { ok: true; task: T } | { ok: false; reason: string } {
  const tr = clientTransition(task, to);
  if (!tr.ok) return tr;
  const appended =
    evidence && evidence.length ? [...task.evidence, ...evidence] : task.evidence;
  if (tr.state === "complete" && appended.length === 0)
    return {
      ok: false,
      reason: "Completing an item needs evidence: a note, a link or a document.",
    };
  return {
    ok: true,
    task: {
      ...task,
      state: tr.state,
      evidence: appended,
      completed_at: tr.state === "complete" ? (task.completed_at ?? now) : null,
    },
  };
}

/* ── Facts the generators read ─────────────────────────── */

/** Facts about the initial journey. Every boolean is EVIDENCE the caller has, never inferred. */
export type InitialFacts = {
  projectId: string | null;
  tenantId?: string;
  /** Legal entity / billing details submitted (projects.dpa_client_submitted_at). */
  companyDetailsSubmitted: boolean;
  /** An Order Form or proposal is accepted (order_forms.accepted_at / proposals). */
  agreementAccepted: boolean;
  /** The deposit milestone invoice is PAID — from the invoice record, never assumed. */
  depositPaid: boolean;
  /** Assets and access were provided (staff-confirmed). */
  assetsProvided: boolean;
  /** Kickoff readiness confirmed (staff-confirmed). */
  kickoffConfirmed: boolean;
  /** Configured gate waivers, each with its reason and approver. */
  waivers?: Partial<
    Record<InitialKey, { reason: string; approver: string; by?: string }>
  >;
};

export type InitialKey =
  | "company"
  | "agreement"
  | "initial_payment"
  | "assets"
  | "kickoff";

export type LaterFacts = {
  projectId: string | null;
  tenantId?: string;
  arrangementId?: string | null;
  route: ServiceRoute;
  /** A clean (non-disputed) acceptance exists for the governing scope version. */
  buildAccepted: boolean;
  /** Acceptance exists but is partial (accepted with listed exceptions). */
  buildAcceptedPartial?: boolean;
  /** The latest acceptance is disputed. */
  buildDisputed?: boolean;
  /** Managed: a service schedule has been accepted by the signatory. */
  scheduleAccepted?: boolean;
  /** Managed: a mandate is authorised (authorisation only — not collection). */
  mandateAuthorised?: boolean;
  /** Managed: activation is provider-confirmed. */
  activated?: boolean;
  /** Independent: the handover checklist is complete. */
  handoverComplete?: boolean;
};

/* ── Builders ──────────────────────────────────────────── */

const state = (done: boolean, otherwise: TaskState = "not_started"): TaskState =>
  done ? "complete" : otherwise;

function task(
  base: { projectId: string | null; tenantId?: string; arrangementId?: string | null },
  journey: Journey,
  t: Omit<
    ChecklistTask,
    "journey" | "project_id" | "tenant_id" | "arrangement_id" | "evidence"
  > & {
    evidence?: TaskEvidence[];
  }
): ChecklistTask {
  return {
    ...(base.tenantId ? { tenant_id: base.tenantId } : {}),
    project_id: base.projectId,
    arrangement_id: base.arrangementId ?? null,
    journey,
    evidence: t.evidence ?? [],
    completed_at: t.state === "complete" ? (t.completed_at ?? null) : null,
    ...t,
  };
}

/**
 * Initial checklist (§5.10): Company/billing details → Agreement → Initial
 * payment → Assets/access → Kickoff readiness. A configured waiver turns the
 * gate into `waived` with reason and approver — the deposit invoice is NOT
 * marked paid by a waiver, and the completion count does not count it.
 */
export function generateInitialChecklist(f: InitialFacts): ChecklistTask[] {
  const w = f.waivers ?? {};
  const withWaiver = (key: InitialKey, t: ChecklistTask): ChecklistTask => {
    const waiver = w[key];
    if (!waiver || t.state === "complete") return t;
    return {
      ...t,
      state: "waived",
      waiver_reason: waiver.reason,
      waiver_approver: waiver.approver,
      waived_by: waiver.by ?? waiver.approver,
      completed_at: null,
    };
  };
  const base = { projectId: f.projectId, tenantId: f.tenantId };
  return [
    withWaiver(
      "company",
      task(base, "initial", {
        key: "company",
        label: "Company and billing details",
        why: "We need the legal entity, registered address and invoice contact before anything can be issued to you.",
        owner_kind: "client",
        state: state(f.companyDetailsSubmitted),
        requirement_source: "Onboarding gate · DPA details",
      })
    ),
    withWaiver(
      "agreement",
      task(base, "initial", {
        key: "agreement",
        label: "Agreement",
        why: "The Order Form fixes what is being built, the price and the route after launch. Work does not start without it.",
        owner_kind: "client",
        state: state(
          f.agreementAccepted,
          f.companyDetailsSubmitted ? "not_started" : "blocked"
        ),
        requirement_source: "Order Form · acceptance",
      })
    ),
    withWaiver(
      "initial_payment",
      task(base, "initial", {
        key: "initial_payment",
        label: "Initial payment",
        why: "The deposit milestone in the Order Form is due before build work is scheduled.",
        owner_kind: "client",
        state: state(f.depositPaid, f.agreementAccepted ? "not_started" : "blocked"),
        requirement_source: "Order Form · deposit milestone invoice",
      })
    ),
    withWaiver(
      "assets",
      task(base, "initial", {
        key: "assets",
        label: "Assets and access",
        why: "Logos, copy, domain access and any existing accounts are needed to build against real content, not placeholders.",
        owner_kind: "client",
        state: state(f.assetsProvided),
        requirement_source: "Files & access",
      })
    ),
    withWaiver(
      "kickoff",
      task(base, "initial", {
        key: "kickoff",
        label: "Kickoff readiness",
        why: "Confirms who your day-to-day contact is, how you want updates and when you are available for review.",
        owner_kind: "client",
        state: state(f.kickoffConfirmed),
        requirement_source: "Kickoff readiness gate",
      })
    ),
  ];
}

/**
 * Later checklist (§5.10, §8.2–8.5): Build review/acceptance → then EITHER
 * Managed package selection + service-schedule acceptance → Direct Debit →
 * activation, OR independent handover → transfer completion. An unresolved
 * route shows acceptance plus a single "route to be confirmed" item, because
 * acceptance can occur without choosing a package (§8.2).
 */
export function generateLaterChecklist(f: LaterFacts): ChecklistTask[] {
  const base = {
    projectId: f.projectId,
    tenantId: f.tenantId,
    arrangementId: f.arrangementId,
  };
  const accepted = f.buildAccepted;
  const acceptance = task(base, "later", {
    key: "build_acceptance",
    label: "Build review and acceptance",
    why: "You see the finished build against the accepted scope with evidence per deliverable. Acceptance starts the warranty under your agreement and releases the final build milestone. You can accept without choosing a package.",
    owner_kind: "client",
    state: accepted
      ? "complete"
      : f.buildDisputed
        ? "blocked"
        : f.buildAcceptedPartial
          ? "in_progress"
          : "not_started",
    requirement_source: "Order Form · acceptance clause (brief §8.2)",
  });

  if (f.route === "managed") {
    return [
      acceptance,
      task(base, "later", {
        key: "package_schedule",
        label: "Managed package and service schedule",
        why: "The Order Form elected the managed route; the package, price, tax, cadence, start date and cancellation terms are agreed in a separate service schedule. No package is pre-selected and nothing is charged until a schedule is accepted.",
        owner_kind: "client",
        state: state(!!f.scheduleAccepted, accepted ? "not_started" : "blocked"),
        requirement_source: "Managed route · service schedule (brief §8.3)",
      }),
      task(base, "later", {
        key: "direct_debit",
        label: "Direct Debit setup",
        why: "Recurring service fees are collected by Direct Debit under the accepted schedule. Bank details are entered in the provider-hosted flow only. A mandate authorises collection; it does not start it.",
        owner_kind: "client",
        state: state(
          !!f.mandateAuthorised,
          f.scheduleAccepted ? "not_started" : "blocked"
        ),
        requirement_source:
          "Service schedule · provider-hosted mandate (brief §8.3 step 4)",
      }),
      task(base, "later", {
        key: "activation",
        label: "Activation",
        why: "Nullshift confirms every gate — accepted schedule, exact amount, agreed start, valid mandate, notice period — before the first collection is scheduled, and shows you the provider-confirmed date.",
        owner_kind: "nullshift",
        state: state(
          !!f.activated,
          f.mandateAuthorised && f.scheduleAccepted ? "not_started" : "blocked"
        ),
        requirement_source: "Activation gates (brief §8.3 steps 5–7)",
      }),
    ];
  }

  if (f.route === "independent") {
    return [
      acceptance,
      task(base, "later", {
        key: "independent_handover",
        label: "Independent handover",
        why: "You run the system after transfer. The £600 handover covers the transfer deliverables in the schedule; its tax basis is pending decision. No ongoing Nullshift management subscription is created.",
        owner_kind: "nullshift",
        state: state(!!f.handoverComplete, accepted ? "not_started" : "blocked"),
        requirement_source: "Independent handover schedule (brief §8.5)",
      }),
      task(base, "later", {
        key: "transfer_completion",
        label: "Transfer completion",
        why: "Nullshift access is revoked only after every agreed transfer gate; the support and warranty boundary is recorded with evidence.",
        owner_kind: "nullshift",
        state: state(!!f.handoverComplete, "blocked"),
        requirement_source: "Independent handover schedule · completion (brief §8.5)",
      }),
    ];
  }

  return [
    acceptance,
    task(base, "later", {
      key: "route_election",
      label: "Service route to be confirmed",
      why: "Your agreement has not yet recorded whether Nullshift manages the system after launch or hands it over. Acceptance does not depend on this; the next steps do.",
      owner_kind: "nullshift",
      state: "awaiting_client",
      requirement_source: "Order Form · service-route election (brief §5.10)",
    }),
  ];
}

/* ── Independent handover (§8.5) ───────────────────────── */

export type HandoverFacts = {
  tenantId?: string;
  arrangementId: string | null;
  /** Whether any Stripe Connect / application-fee arrangement exists to resolve. */
  hasApplicationFee?: boolean;
};

const HANDOVER_SOURCE = "Independent handover schedule (brief §8.5)";

/**
 * The §8.5 transfer checklist, one task per bullet, with requirement sources.
 * The application-fee item is always present: it must be resolved EXPLICITLY
 * even when the answer is "none" (§8.5, decision 18.4).
 */
export function generateHandoverChecklist(f: HandoverFacts): HandoverTask[] {
  const mk = (
    t: Omit<
      HandoverTask,
      "tenant_id" | "arrangement_id" | "evidence" | "state" | "requirement_source"
    > & {
      requirement_source?: string;
      state?: TaskState;
    }
  ): HandoverTask => ({
    ...(f.tenantId ? { tenant_id: f.tenantId } : {}),
    arrangement_id: f.arrangementId,
    evidence: [],
    state: t.state ?? "not_started",
    requirement_source: t.requirement_source ?? HANDOVER_SOURCE,
    completed_at: null,
    ...t,
  });
  return [
    mk({
      key: "receiving_owner",
      label: "Confirm receiving owner or provider and transfer plan",
      why: "We need to know who takes over hosting, data and accounts before anything is transferred.",
      owner_kind: "client",
    }),
    mk({
      key: "obligations_resolved",
      label: "Resolve outstanding accepted obligations and authorised exceptions",
      why: "Accepted invoices and any recorded exceptions are settled or explicitly carried before transfer.",
      owner_kind: "nullshift",
      requirement_source: "Order Form · accepted obligations; exception register",
    }),
    mk({
      key: "client_accounts",
      label:
        "Create or confirm client-owned hosting, database, domain, communications and payment accounts",
      why: "Everything is transferred into accounts you own and pay for directly. Nullshift does not host for you on this route.",
      owner_kind: "client",
    }),
    mk({
      key: "ownership_transfer",
      label:
        "Transfer repository, deployment ownership, environment inventory, configuration and operating instructions securely",
      why: "Ownership moves to you with an inventory of every environment and the instructions to run it.",
      owner_kind: "nullshift",
    }),
    mk({
      key: "data_transfer",
      label:
        "Transfer data by an approved, tested method; verify backups, restoration and data-processing responsibilities",
      why: "A restore is tested before Nullshift steps back, and who processes what is written down.",
      owner_kind: "nullshift",
      requirement_source: `${HANDOVER_SOURCE}; Data Processing Agreement`,
    }),
    mk({
      key: "licences_secrets",
      label: "Record licence and third-party restrictions and the secrets-rotation plan",
      why: "You know what you may and may not do with third-party components, and every secret Nullshift held is rotated.",
      owner_kind: "nullshift",
    }),
    mk({
      key: "continuity_checks",
      label:
        "Confirm DNS, payment, webhook and email continuity with agreed validation checks",
      why: "Nothing that reaches your customers breaks on the day of transfer.",
      owner_kind: "nullshift",
    }),
    mk({
      key: "application_fee",
      label: "Resolve Stripe Connect / application-fee disposition explicitly",
      why: f.hasApplicationFee
        ? "Your agreement carries an application fee through Stripe Connect. What happens to it after handover is decided and recorded, never left implicit."
        : "Even where no fee applies, the answer is recorded so 'no ongoing Nullshift charges' is true on paper.",
      owner_kind: "nullshift",
      requirement_source: `${HANDOVER_SOURCE}; Order Form application-fee clause; decision 18.4`,
    }),
    mk({
      key: "walkthrough",
      label:
        "Provide the agreed walkthrough and documentation; record client acknowledgement",
      why: "You confirm you have the documentation and can operate the system before Nullshift access is revoked.",
      owner_kind: "client",
    }),
    mk({
      key: "access_revoked",
      label:
        "Revoke Nullshift access after the agreed transfer gates; retain only authorised access and records",
      why: "Access is removed only once the gates above are met, and what Nullshift keeps (records, warranty access) is listed.",
      owner_kind: "nullshift",
      state: "blocked",
    }),
    mk({
      key: "handover_complete",
      label:
        "Mark handover complete with evidence and future support and warranty boundaries",
      why: "The completion record shows the evidence for each gate and where Nullshift's responsibility ends.",
      owner_kind: "nullshift",
      state: "blocked",
    }),
  ];
}

/**
 * Handover completion gate (§17.1 row 12): complete only when every required
 * task is complete (waived is not complete) and the application-fee item
 * carries evidence.
 */
export function handoverCanComplete(
  tasks: HandoverTask[]
): { ok: true } | { ok: false; missing: string[] } {
  const missing = tasks
    .filter((t) => t.key !== "handover_complete")
    .filter((t) => isRequired(t) && !isDone(t))
    .map((t) => t.key);
  const fee = tasks.find((t) => t.key === "application_fee");
  if (fee && fee.evidence.length === 0 && !missing.includes("application_fee"))
    missing.push("application_fee");
  return missing.length ? { ok: false, missing } : { ok: true };
}
