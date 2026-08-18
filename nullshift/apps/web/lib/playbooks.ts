/**
 * Playbooks — the repeatable operations the brief (§10) asks for, as code-
 * defined checklist templates. A playbook becomes real work when it's
 * instantiated into a `checklists` row (migration 0028) for one project;
 * items are toggled by NAME, never by index. Templates are deliberately
 * short: only what protects delivery, nothing bureaucratic.
 *
 * Not every §10 playbook is a checklist: lead qualification runs as funnel
 * scoring + agent enrichment, weekly updates run as the Friday pulse, and
 * change-request assessment runs as issue triage + the quote flow.
 */

export type PlaybookKind =
  | "onboarding"
  | "discovery_call"
  | "proposal_review"
  | "launch"
  | "handover"
  | "close_retro";

export type Playbook = {
  kind: PlaybookKind;
  title: string;
  /** Stages this playbook is offered on (never forced). */
  stages: string[];
  items: string[];
};

export const PLAYBOOKS: Record<PlaybookKind, Playbook> = {
  onboarding: {
    kind: "onboarding",
    title: "Client onboarding",
    stages: ["onboarding"],
    items: [
      "Contacts + decision-maker confirmed",
      "Goals + success measures written down",
      "Brand assets + content received",
      "Access to existing systems granted",
      "Integrations to connect listed",
      "Data / migration sources identified",
      "Timeline agreed with the client",
      "Communication cadence agreed",
      "Kickoff call booked",
    ],
  },
  discovery_call: {
    kind: "discovery_call",
    title: "Discovery call",
    stages: ["discovery"],
    items: [
      "Reviewed funnel answers + agent research before the call",
      "Current systems + biggest pain confirmed in their words",
      "Desired outcome + success measure agreed",
      "Budget + timeline sense-checked",
      "Decision-maker identified",
      "Next step promised with a date",
      "Call notes captured on the client hub",
    ],
  },
  proposal_review: {
    kind: "proposal_review",
    title: "Proposal review (before sending)",
    stages: ["discovery", "onboarding"],
    items: [
      "Modules match what was actually discussed",
      "Price checked against the work, not the template",
      "Payment terms match what we intend to enforce",
      "Care plan recommendation fits their scale",
      "Client's DPA declaration complete",
      "Read once as the client would read it",
    ],
  },
  launch: {
    kind: "launch",
    title: "Launch",
    stages: ["launch_prep"],
    items: [
      "Domain + DNS pointed and verified",
      "Backups confirmed working",
      "Monitoring / uptime check in place",
      "DPA signed and logged (go-live gate)",
      "Client walkthrough done + sign-off recorded",
      "live_url set on the project",
      "Post-launch support expectations agreed",
    ],
  },
  handover: {
    kind: "handover",
    title: "Project handover",
    stages: ["build", "review", "launch_prep", "live", "care"],
    items: [
      "System passport: repo / hosting / database references filled",
      "Runbook covers deploys, env vars, and known quirks",
      "Agreed scope (accepted snapshot) reviewed",
      "Open decisions + risks written into their registers",
      "Client preferences recorded on the passport",
      "Next actions have named owners",
    ],
  },
  close_retro: {
    kind: "close_retro",
    title: "Project close + retrospective",
    stages: ["complete"],
    items: [
      "Final invoice settled",
      "All deliverables handed over",
      "Client access to everything they own confirmed",
      "Credentials we held rotated or handed back",
      "What went well / what didn't captured",
      "Testimonial or case-study ask made",
    ],
  },
};

/** Playbooks worth offering when a project sits at `stage` (never forced). */
export function playbooksForStage(stage: string): Playbook[] {
  return Object.values(PLAYBOOKS).filter((p) => p.stages.includes(stage));
}

export type ChecklistItem = { name: string; done: boolean };

/** Fresh items array for instantiating a playbook into a checklists row. */
export function instantiate(kind: PlaybookKind): ChecklistItem[] {
  return PLAYBOOKS[kind].items.map((name) => ({ name, done: false }));
}

/** Toggle one item BY NAME (index toggling drifts when lists change). */
export function toggleItem(items: ChecklistItem[], name: string): ChecklistItem[] {
  return items.map((i) => (i.name === name ? { ...i, done: !i.done } : i));
}
