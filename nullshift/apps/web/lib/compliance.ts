/**
 * UK compliance-review assistant (brief §"UK compliance-review assistant") —
 * an ISSUE-SPOTTING tool, not an AI lawyer. Pure logic: the structured intake,
 * the mandatory-escalation flag derivation, and the deterministic evidence-
 * linked review pack. Deliberately not AI-generated: the pack is assembled
 * from the answers so it can never hallucinate a legal conclusion.
 *
 * WORDING RULES (enforced here by construction): never "compliant", never
 * "legally safe", never "ready to sign". A finished review is "review
 * recorded", and escalation flags block that status until an Administrator
 * records a decision.
 */

export type ComplianceTrigger = "discovery" | "scope_change" | "pre_launch";

export const TRIGGER_LABEL: Record<ComplianceTrigger, string> = {
  discovery: "Discovery",
  scope_change: "Material scope change",
  pre_launch: "Pre-launch",
};

export type IntakeField = {
  key: string;
  label: string;
  type: "bool" | "text";
  /** bool fields that raise a mandatory-escalation flag when true */
  escalates?: string;
};

export type IntakeSection = { title: string; fields: IntakeField[] };

export const INTAKE_SECTIONS: IntakeSection[] = [
  {
    title: "Roles & data flows",
    fields: [
      {
        key: "roles_map",
        label: "Who is controller / processor / sub-processor for each flow?",
        type: "text",
      },
      {
        key: "data_flows",
        label: "Each data flow (source → system → destination)",
        type: "text",
      },
      {
        key: "unclear_roles",
        label: "Are any roles unclear or disputed?",
        type: "bool",
        escalates: "Unclear controller/processor roles",
      },
    ],
  },
  {
    title: "Data handled",
    fields: [
      {
        key: "data_categories",
        label: "Data collected, inferred, stored, shared (and retention/deletion)",
        type: "text",
      },
      {
        key: "international_transfers",
        label: "Is data transferred outside the UK?",
        type: "bool",
        escalates: "Cross-border transfers",
      },
      {
        key: "transfer_detail",
        label: "Where, and under what safeguards?",
        type: "text",
      },
    ],
  },
  {
    title: "Children",
    fields: [
      {
        key: "children_possible",
        label: "Is the service likely to be accessed by children?",
        type: "bool",
        escalates: "Children's data / likely child access",
      },
      { key: "children_detail", label: "How, and what age ranges?", type: "text" },
    ],
  },
  {
    title: "Sensitive data",
    fields: [
      {
        key: "special_category",
        label: "Special-category data (health, biometrics, beliefs, etc.)?",
        type: "bool",
        escalates: "Special-category data",
      },
      {
        key: "criminal_offence",
        label: "Criminal-offence data?",
        type: "bool",
        escalates: "Criminal-offence data",
      },
      {
        key: "sensitive_other",
        label: "Financial, precise location, images/audio/video — which and why?",
        type: "text",
      },
    ],
  },
  {
    title: "Automation & tracking",
    fields: [
      {
        key: "automated_decisions",
        label: "Automated decisions or profiling with significant effects?",
        type: "bool",
        escalates: "Significant automated decision-making",
      },
      {
        key: "ai_marketing_detail",
        label: "AI features, marketing, analytics, cookies, third-party integrations",
        type: "text",
      },
    ],
  },
  {
    title: "Security & operations",
    fields: [
      {
        key: "security_controls",
        label: "Access controls, incident response, retention/deletion, backups, audit",
        type: "text",
      },
      {
        key: "suspected_breach",
        label: "Any suspected breach or incident?",
        type: "bool",
        escalates: "Suspected breach",
      },
      {
        key: "safeguarding",
        label: "Any safeguarding concern?",
        type: "bool",
        escalates: "Safeguarding concern",
      },
    ],
  },
  {
    title: "Sector & advice",
    fields: [
      {
        key: "sector_requirements",
        label: "Sector-specific requirements + existing privacy documents",
        type: "text",
      },
      {
        key: "legal_assurance_requested",
        label: "Has the client asked for legal assurance or bespoke legal terms?",
        type: "bool",
        escalates: "Request for legal assurance / bespoke terms",
      },
      { key: "counsel_advice", label: "Any counsel advice already held", type: "text" },
    ],
  },
];

export type IntakeAnswers = Record<string, boolean | string>;

const boolOf = (v: unknown): boolean => v === true || v === "true" || v === "on";
const textOf = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** The brief's mandatory-escalation list, derived — never hand-waved. */
export function deriveFlags(answers: IntakeAnswers): string[] {
  const flags: string[] = [];
  for (const section of INTAKE_SECTIONS)
    for (const f of section.fields)
      if (f.escalates && boolOf(answers[f.key])) flags.push(f.escalates);
  // Likely-DPIA composite: large-scale sensitive processing signals together.
  if (
    (boolOf(answers.special_category) || boolOf(answers.children_possible)) &&
    boolOf(answers.automated_decisions)
  )
    flags.push("Likely high-risk processing — DPIA screening needed");
  return flags;
}

/** Intake questions still unanswered — the pack lists them honestly. */
export function missingAnswers(answers: IntakeAnswers): string[] {
  const missing: string[] = [];
  for (const section of INTAKE_SECTIONS)
    for (const f of section.fields)
      if (f.type === "text" && !textOf(answers[f.key])) missing.push(f.label);
  return missing;
}

/**
 * The evidence-linked draft review pack — deterministic markdown assembled
 * from the answers. Editable after generation; framed as issue-spotting.
 */
export function buildReviewPack(opts: {
  clientName: string;
  trigger: ComplianceTrigger;
  answers: IntakeAnswers;
  flags: string[];
}): string {
  const { clientName, trigger, answers, flags } = opts;
  const t = (k: string) => textOf(answers[k]) || "_(not captured yet)_";
  const missing = missingAnswers(answers);
  return [
    `# Compliance review pack — ${clientName} (${TRIGGER_LABEL[trigger]})`,
    ``,
    `> Issue-spotting working document. NOT legal advice, NOT a statement of compliance,`,
    `> NOT ready to sign. Material items route to an Administrator and, where needed, a`,
    `> qualified UK solicitor or specialist adviser.`,
    ``,
    `## System & data-flow summary`,
    `**Roles:** ${t("roles_map")}`,
    ``,
    `**Flows:** ${t("data_flows")}`,
    ``,
    `**Data handled:** ${t("data_categories")}`,
    ``,
    `**Transfers:** ${boolOf(answers.international_transfers) ? `Yes — ${t("transfer_detail")}` : "None declared"}`,
    ``,
    `**Automation / tracking:** ${t("ai_marketing_detail")}`,
    ``,
    `**Security posture:** ${t("security_controls")}`,
    ``,
    `## Issue register`,
    flags.length
      ? flags
          .map(
            (f) =>
              `- ⚑ ${f} — Administrator decision required; attach qualified advice where needed`
          )
          .join("\n")
      : `- No mandatory-escalation flags from this intake. Absence of flags is not a clearance.`,
    ``,
    `## Missing questions`,
    missing.length
      ? missing.map((m) => `- ${m}`).join("\n")
      : `- Intake complete on paper — verify against the running system.`,
    ``,
    `## Possible documents / decisions required`,
    [
      boolOf(answers.children_possible) &&
        `- Age-appropriate design assessment + children's-data checklist (seeded on the project)`,
      (boolOf(answers.special_category) || boolOf(answers.automated_decisions)) &&
        `- DPIA screening questions to a qualified adviser`,
      boolOf(answers.international_transfers) &&
        `- Transfer mechanism review (IDTA / addendum) — solicitor question`,
      boolOf(answers.legal_assurance_requested) &&
        `- Bespoke terms are a solicitor drafting job — never assembled here`,
      `- Privacy information + records-of-processing updates if flows changed`,
    ]
      .filter(Boolean)
      .join("\n"),
    ``,
    `## Technical action checklist`,
    `- Access controls match the stated posture above`,
    `- Retention/deletion actually implemented as described`,
    `- Backups verified restorable`,
    `- Audit trail covers material actions`,
    ``,
    `## Draft questions for the client / solicitor`,
    [
      `- Client: does the data-flow summary above match reality end-to-end?`,
      boolOf(answers.children_possible) &&
        `- Solicitor: age-assurance and high-privacy defaults for likely child users — what standard applies here?`,
      boolOf(answers.international_transfers) &&
        `- Solicitor: is the stated transfer safeguard adequate for these destinations?`,
      boolOf(answers.automated_decisions) &&
        `- Solicitor: do these automated decisions trigger Art. 22-style obligations?`,
      `- Client: who signs off data-protection decisions on your side?`,
    ]
      .filter(Boolean)
      .join("\n"),
    ``,
    `_Sources: this project's intake answers (recorded in the review), the DPA declaration,`,
    `and the system passport. Last assembled: ${new Date().toISOString().slice(0, 10)}. Where`,
    `anything is uncertain, escalate — do not infer._`,
  ].join("\n");
}

/** Form → answers object (booleans from checkboxes, trimmed text). */
export function answersFromForm(formData: FormData): IntakeAnswers {
  const answers: IntakeAnswers = {};
  for (const section of INTAKE_SECTIONS)
    for (const f of section.fields)
      answers[f.key] =
        f.type === "bool"
          ? formData.get(f.key) === "on"
          : String(formData.get(f.key) ?? "").trim();
  return answers;
}
