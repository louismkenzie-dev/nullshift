/**
 * §7 work classification and coverage — pure logic, no I/O.
 *
 * Two separate questions, deliberately kept apart (brief §7):
 *
 *   1. WHAT is this request?            → suggestClassification()
 *   2. WHO pays for it, if anyone?      → coverageFor()
 *
 * Classification does not itself create an entitlement. A client without Run
 * may still have warranty coverage; an expired warranty is not infinite free
 * support. A request the client calls a "bug" can be a new feature, and one
 * they call a "change" can reveal a genuine defect. Everything is assessed
 * against accepted implemented scope, never against the label.
 *
 * The suggestion is a suggestion. A human records the decision; where the
 * facts are not established the answer is "needs review", not a guess.
 *
 * Enum values match supabase/migrations/0058_next_actions_work_class.sql.
 */

export const WORK_CLASS_IDS = [
  "defect",
  "support",
  "maintenance",
  "change_feature",
  "content_training",
  "data_integration_expansion",
  "transaction",
] as const;

export type WorkClassId = (typeof WORK_CLASS_IDS)[number];

export const COVERAGE_DECISIONS = [
  "included_managed",
  "included_warranty",
  "chargeable_grow",
  "needs_review",
] as const;

export type CoverageDecision = (typeof COVERAGE_DECISIONS)[number];

/** The §7 table, verbatim. */
export const WORK_CLASS_META: Record<
  WorkClassId,
  { label: string; handling: string; evidence: string }
> = {
  defect: {
    label: "DEFECT",
    handling: "Covered warranty and/or Run if applicable",
    evidence:
      "Reproduction, expected agreed behaviour, affected version; check coverage.",
  },
  support: {
    label: "SUPPORT",
    handling: "Included within applicable Run schedule",
    evidence: "Existing-system assistance; check limits and exclusions.",
  },
  maintenance: {
    label: "MAINTENANCE",
    handling: "Included routine Run work where covered",
    evidence: "Routine security/dependency/compatibility task.",
  },
  change_feature: {
    label: "CHANGE / FEATURE",
    handling: "Grow, quote required",
    evidence: "New or changed capability/scope.",
  },
  content_training: {
    label: "CONTENT / TRAINING",
    handling: "Grow unless expressly included",
    evidence: "Deliverable/format/audience/revision limits.",
  },
  data_integration_expansion: {
    label: "DATA / INTEGRATION / EXPANSION",
    handling: "Grow unless expressly included",
    evidence: "Migration, new connection, rollout or additional operational scope.",
  },
  transaction: {
    label: "TRANSACTION",
    handling: "Agreed percentage-fee model",
    evidence: "Accepted fee schedule and connected-account context.",
  },
};

/**
 * Exact UI wording from brief §7. Included decisions are shown "with governing
 * agreement" — use coverageWording() to append it.
 */
export const COVERAGE_WORDING: Record<CoverageDecision, string> = {
  included_managed: "Included — Managed Platform",
  included_warranty: "Included — build warranty",
  chargeable_grow: "Chargeable Grow request — quote required.",
  needs_review: "Coverage needs review",
};

export function coverageWording(
  decision: CoverageDecision,
  governing?: string | null
): string {
  const base = COVERAGE_WORDING[decision];
  if (
    (decision === "included_managed" || decision === "included_warranty") &&
    governing &&
    governing.trim()
  ) {
    return `${base} (${governing.trim()})`;
  }
  return base;
}

/** The defect definition proposed for new documents (§7); legal wording under review. */
export const DEFECT_DEFINITION =
  "A reproducible failure of an existing feature to materially perform functionality previously agreed and implemented.";

/* ────────────────────────────────────────────────────────────────────────────
 * 1. Classification
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Facts established at triage against accepted implemented scope. Every field
 * is optional: an unset fact is "not established", and nothing here is inferred
 * from the client's label. Free text only adds low-confidence hints.
 */
export type RequestFacts = {
  /** The request concerns a capability that is within accepted, implemented scope. */
  existingCapability?: boolean;
  /** That capability reproducibly fails to perform as agreed (defect definition). */
  reproducibleFailure?: boolean;
  /** The request asks for a new or materially changed capability or scope. */
  newCapability?: boolean;
  /** Assistance using the existing system within its design (how-to, configuration). */
  assistance?: boolean;
  /** Routine security, dependency or compatibility task. */
  routineMaintenance?: boolean;
  /** Work outside the software: content, training, consulting. */
  contentOrTraining?: boolean;
  /** Migration, new connection, rollout or additional operational scope. */
  dataOrIntegration?: boolean;
  /** Concerns the agreed percentage-fee model or connected-account context. */
  transaction?: boolean;
  /**
   * The thing being corrected is Nullshift's own contracted deliverable that
   * failed (a migration delivered wrong, content not as specified). Correcting
   * it is not automatically a new charge merely because the category is content
   * or migration (§7).
   */
  ownDeliverableFailure?: boolean;
  /** Service down or materially degraded now. */
  urgent?: boolean;
};

export type ClassificationInput = {
  title?: string;
  description?: string;
  /** What the client called it ("bug", "change", "question", …). Informational. */
  clientLabel?: string;
  facts: RequestFacts;
};

export type SplitPart = {
  workClass: WorkClassId;
  title: string;
  reason: string;
  /**
   * `proceed` — covered restoration, worked on now; `quote_required` — new
   * capability, waits for the Grow gate. The two never block each other.
   */
  gate: "proceed" | "quote_required";
};

export type ClassificationSuggestion = {
  /** Null when the facts do not support a class, or when the request is mixed. */
  workClass: WorkClassId | null;
  confidence: "high" | "medium" | "low";
  reasons: string[];
  /** Present for a mixed request: the linked items to raise (§7). */
  split?: SplitPart[];
  /** The client's own label disagreed with the assessment. */
  labelMismatch?: { clientLabel: string; note: string };
  needsHumanReview: boolean;
  /** Triage lane: incidents are triaged separately from routine changes (§7). */
  lane: "incident" | "routine";
};

const DEFECT_LABELS = new Set(["bug", "defect", "broken", "error", "fault", "incident"]);
const FEATURE_LABELS = new Set([
  "feature",
  "change",
  "enhancement",
  "request",
  "improvement",
]);

const HINTS: { re: RegExp; cls: WorkClassId; why: string }[] = [
  {
    re: /\b(error|broken|fails?|failing|crash|500|not working|stopped)\b/i,
    cls: "defect",
    why: "wording suggests an existing feature failing",
  },
  {
    re: /\b(how (do|to)|can you show|where is|which button)\b/i,
    cls: "support",
    why: "wording suggests assistance with the existing system",
  },
  {
    re: /\b(deprecat|upgrade|dependency|patch|compatib)/i,
    cls: "maintenance",
    why: "wording suggests routine compatibility work",
  },
  {
    re: /\b(add|new|build|integrate|another|extra)\b/i,
    cls: "change_feature",
    why: "wording suggests new or changed capability",
  },
  {
    re: /\b(train|walkthrough|video|copywrit|content|wording)\b/i,
    cls: "content_training",
    why: "wording suggests content or training",
  },
  {
    re: /\b(import|migrat|export to|connect(ion)? to|roll ?out|new (site|location))\b/i,
    cls: "data_integration_expansion",
    why: "wording suggests data, integration or expansion work",
  },
  {
    re: /\b(payout|application fee|percentage|connected account|stripe fee)\b/i,
    cls: "transaction",
    why: "wording suggests the agreed fee model",
  },
];

function normaliseLabel(label?: string): string {
  return (label ?? "").trim().toLowerCase();
}

function mismatchFor(
  clientLabel: string | undefined,
  suggested: WorkClassId
): ClassificationSuggestion["labelMismatch"] | undefined {
  const l = normaliseLabel(clientLabel);
  if (!l) return undefined;
  if (DEFECT_LABELS.has(l) && suggested !== "defect") {
    return {
      clientLabel: l,
      note: `Client called it "${l}"; against accepted implemented scope it is ${WORK_CLASS_META[suggested].label}. The label does not decide coverage.`,
    };
  }
  if (FEATURE_LABELS.has(l) && suggested === "defect") {
    return {
      clientLabel: l,
      note: `Client called it "${l}"; the agreed capability reproducibly fails, so it is a DEFECT. The label does not remove coverage.`,
    };
  }
  return undefined;
}

/**
 * Suggest a §7 class from established facts. Deterministic and explainable:
 * every reason is a sentence a human can check. Facts win over labels; labels
 * never decide; free text only produces low-confidence hints.
 */
export function suggestClassification(
  input: ClassificationInput
): ClassificationSuggestion {
  const f = input.facts ?? {};
  const reasons: string[] = [];
  const lane: ClassificationSuggestion["lane"] = f.urgent ? "incident" : "routine";
  if (f.urgent) {
    reasons.push(
      "Marked urgent: triaged in the incident lane, separately from routine changes."
    );
  }

  const isDefect = f.existingCapability === true && f.reproducibleFailure === true;
  const isNew = f.newCapability === true;

  // Mixed request: covered restoration plus new capability → linked items.
  if (isDefect && isNew) {
    const restoreTitle = input.title
      ? `Restore agreed behaviour: ${input.title}`
      : "Restore agreed behaviour";
    const newTitle = input.title ? `New capability: ${input.title}` : "New capability";
    reasons.push(
      "Mixed request: an agreed capability reproducibly fails AND a new capability is asked for. Split into linked items (§7)."
    );
    reasons.push(
      "Covered restoration proceeds now; the enhancement waits for its Grow quote. Neither delays the other."
    );
    return {
      workClass: null,
      confidence: "high",
      reasons,
      split: [
        {
          workClass: "defect",
          title: restoreTitle,
          reason:
            "Existing agreed capability failing to perform — assess coverage under warranty/Run.",
          gate: "proceed",
        },
        {
          workClass: "change_feature",
          title: newTitle,
          reason: "New or changed capability — Grow, quote required.",
          gate: "quote_required",
        },
      ],
      labelMismatch: undefined,
      needsHumanReview: true,
      lane,
    };
  }

  let cls: WorkClassId | null = null;
  let confidence: ClassificationSuggestion["confidence"] = "high";

  if (isDefect) {
    cls = "defect";
    reasons.push(
      "An existing, accepted and implemented capability reproducibly fails to perform as agreed (defect definition)."
    );
  } else if (isNew) {
    cls = "change_feature";
    reasons.push("New or materially changed capability or scope — not a restoration.");
  } else if (f.ownDeliverableFailure === true) {
    // Category follows the deliverable; coverage handles the "not a new charge" rule.
    cls = f.dataOrIntegration ? "data_integration_expansion" : "content_training";
    reasons.push(
      "Correcting Nullshift's own failed contracted deliverable. Category follows the deliverable; coverage is assessed under the agreement that contracted it, not as a new charge."
    );
  } else if (f.transaction === true) {
    cls = "transaction";
    reasons.push(
      "Concerns the agreed percentage-fee model or connected-account context."
    );
  } else if (f.routineMaintenance === true) {
    cls = "maintenance";
    reasons.push("Routine security, dependency or compatibility task.");
  } else if (f.assistance === true) {
    cls = "support";
    reasons.push("Assistance using the existing system within its design.");
  } else if (f.contentOrTraining === true) {
    cls = "content_training";
    reasons.push("Work outside the software: content, training or consulting.");
  } else if (f.dataOrIntegration === true) {
    cls = "data_integration_expansion";
    reasons.push("Migration, new connection, rollout or additional operational scope.");
  } else if (f.existingCapability === true && f.reproducibleFailure === false) {
    cls = "support";
    confidence = "medium";
    reasons.push(
      "Concerns an existing capability that is not shown to be failing — treated as assistance/configuration; confirm no change to scope is being asked for."
    );
  }

  if (cls === null) {
    // Nothing established. Offer at most one low-confidence hint from the text.
    const text = `${input.title ?? ""} ${input.description ?? ""}`;
    const hint = HINTS.find((h) => h.re.test(text));
    if (hint) {
      reasons.push(
        `No facts established; ${hint.why} (${WORK_CLASS_META[hint.cls].label}). A hint, not a decision.`
      );
      return {
        workClass: hint.cls,
        confidence: "low",
        reasons,
        needsHumanReview: true,
        lane,
        labelMismatch: mismatchFor(input.clientLabel, hint.cls),
      };
    }
    reasons.push(
      "No facts established against accepted implemented scope. Needs human review before any coverage decision."
    );
    return { workClass: null, confidence: "low", reasons, needsHumanReview: true, lane };
  }

  const labelMismatch = mismatchFor(input.clientLabel, cls);
  if (labelMismatch) reasons.push(labelMismatch.note);

  return {
    workClass: cls,
    confidence,
    reasons,
    labelMismatch,
    needsHumanReview: confidence !== "high",
    lane,
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * 2. Coverage
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * What the client is actually entitled to, from accepted agreements. This is
 * the ONLY input that can make work "included"; the class never does.
 */
export type Entitlements = {
  /** An accepted Run / Managed Platform schedule governs the affected system. */
  managedActive: boolean;
  /** Reference shown as the governing agreement, e.g. "Service schedule v1 · Core". */
  managedAgreement?: string | null;
  /** Build warranty is in force for the affected version. */
  warrantyActive: boolean;
  /** Reference, e.g. "Order Form v1 · warranty to 9 Nov 2026". */
  warrantyAgreement?: string | null;
  /** There was a warranty and it has lapsed (distinct from never having one). */
  warrantyExpired?: boolean;
  /** The governing agreement expressly includes this class of work (content/data). */
  expresslyIncluded?: boolean;
  /** Reproduction / agreed behaviour / affected version are sufficient to decide. */
  evidenceSufficient: boolean;
  /** The work corrects Nullshift's own failed contracted deliverable (§7). */
  ownDeliverableFailure?: boolean;
  /** For TRANSACTION: an accepted fee schedule exists for this connected account. */
  feeScheduleAccepted?: boolean;
  feeScheduleAgreement?: string | null;
};

export type CoverageResult = {
  decision: CoverageDecision;
  /** Exact §7 wording, with the governing agreement where included. */
  wording: string;
  governing: string | null;
  reasons: string[];
  /** True when work may not start without an accepted Grow quote. */
  quoteRequired: boolean;
  /** True when a human must decide before any commercial handling. */
  needsReview: boolean;
};

function result(
  decision: CoverageDecision,
  governing: string | null,
  reasons: string[]
): CoverageResult {
  return {
    decision,
    wording: coverageWording(decision, governing),
    governing,
    reasons,
    quoteRequired: decision === "chargeable_grow",
    needsReview: decision === "needs_review",
  };
}

/**
 * Coverage for a classified request against the client's entitlements.
 *
 * Invariants (tested):
 *  - Classification never creates an entitlement: with no agreement in force
 *    nothing is "included".
 *  - Warranty can apply without Run.
 *  - An expired warranty is not free support.
 *  - Feature/design work is quoted on every tier.
 *  - Correcting Nullshift's own failed deliverable is not a new charge.
 *  - Insufficient evidence always needs review.
 */
export function coverageFor(
  classification: WorkClassId | null,
  e: Entitlements
): CoverageResult {
  if (classification === null) {
    return result("needs_review", null, [
      "No classification recorded; coverage cannot be decided.",
    ]);
  }
  if (!e.evidenceSufficient) {
    return result("needs_review", null, [
      `Evidence insufficient for ${WORK_CLASS_META[classification].label}: ${WORK_CLASS_META[classification].evidence}`,
    ]);
  }

  const managed = e.managedActive
    ? (e.managedAgreement ?? "Managed Platform schedule")
    : null;
  const warranty = e.warrantyActive ? (e.warrantyAgreement ?? "build warranty") : null;

  switch (classification) {
    case "defect": {
      if (warranty) {
        return result("included_warranty", warranty, [
          "Reproducible failure of an agreed, implemented capability within the warranty period.",
          e.managedActive
            ? "Run is also in force; warranty governs restoration of the build."
            : "No Run schedule is needed: warranty coverage stands on its own.",
        ]);
      }
      if (managed) {
        return result("included_managed", managed, [
          "Reproducible failure of an agreed capability; restoration is included under the Managed Platform schedule.",
        ]);
      }
      const reasons = [
        "No Run schedule and no warranty in force for the affected version.",
      ];
      reasons.push(
        e.warrantyExpired
          ? "The build warranty has expired: an expired warranty is not free support. Decide under Run (if taken) or quote the restoration."
          : "Classification does not create an entitlement; decide whether any agreement covers this restoration."
      );
      return result("needs_review", null, reasons);
    }

    case "support":
    case "maintenance": {
      if (managed) {
        return result("included_managed", managed, [
          classification === "support"
            ? "Existing-system assistance within the applicable Run schedule; check limits and exclusions."
            : "Routine security/dependency/compatibility work included under the Run schedule.",
        ]);
      }
      const reasons = ["No accepted Run schedule governs this system."];
      reasons.push(
        e.warrantyActive
          ? "Build warranty covers defects in the delivered build, not assistance or routine maintenance."
          : e.warrantyExpired
            ? "The build warranty has expired and never covered assistance; an expired warranty is not free support."
            : "Nothing in force includes this work; agree an interim arrangement or quote it."
      );
      return result("needs_review", null, reasons);
    }

    case "change_feature":
      return result("chargeable_grow", null, [
        "New or changed capability. Every tier quotes feature/design work; no tier implies a free feature allowance.",
        ...(e.managedActive
          ? ["An active Run schedule does not include new capability."]
          : []),
      ]);

    case "content_training":
    case "data_integration_expansion": {
      if (e.ownDeliverableFailure) {
        if (warranty) {
          return result("included_warranty", warranty, [
            "Correcting Nullshift's own failed contracted deliverable is not a new charge merely because the category is content or migration.",
          ]);
        }
        return result("needs_review", null, [
          "Correcting Nullshift's own failed contracted deliverable is not automatically a new charge; confirm the contracting agreement and its acceptance state before deciding.",
        ]);
      }
      if (e.expresslyIncluded) {
        if (managed) {
          return result("included_managed", managed, [
            "Expressly included by the governing Run schedule; check deliverable, format, audience and revision limits.",
          ]);
        }
        if (warranty) {
          return result("included_warranty", warranty, [
            "Expressly included by the governing build agreement; check deliverable and revision limits.",
          ]);
        }
        return result("needs_review", null, [
          "Marked expressly included but no agreement is in force to include it under.",
        ]);
      }
      return result("chargeable_grow", null, [
        "Work outside the software (training, content, consulting, migration, onboarding, integrations, rollout) is chargeable unless explicitly included.",
      ]);
    }

    case "transaction": {
      if (e.feeScheduleAccepted) {
        return result("needs_review", null, [
          `Handled under the accepted percentage-fee schedule (${e.feeScheduleAgreement ?? "accepted fee schedule"}) with connected-account context — not a Run/Grow coverage question. Finance to review.`,
        ]);
      }
      return result("needs_review", null, [
        "No accepted fee schedule for this connected account; nothing can be charged or credited until one exists.",
      ]);
    }
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * 3. Linked items and lanes
 * ──────────────────────────────────────────────────────────────────────────── */

export type LinkedItemPlan = {
  parentTitle: string;
  parts: (SplitPart & { coverage: CoverageResult })[];
  /** True when the covered part is urgent and must not wait on the other part. */
  incidentProceeds: boolean;
  note: string;
};

/**
 * Turn a mixed suggestion into linked items with coverage per part. The covered
 * restoration is never gated on the enhancement's quote (§7).
 */
export function planLinkedItems(
  parentTitle: string,
  suggestion: ClassificationSuggestion,
  entitlements: Entitlements
): LinkedItemPlan | null {
  if (!suggestion.split || suggestion.split.length === 0) return null;
  const parts = suggestion.split.map((p) => ({
    ...p,
    coverage: coverageFor(p.workClass, entitlements),
  }));
  const covered = parts.find((p) => p.gate === "proceed");
  const incidentProceeds = suggestion.lane === "incident" && !!covered;
  return {
    parentTitle,
    parts,
    incidentProceeds,
    note: incidentProceeds
      ? "Urgent covered restoration proceeds now; the enhancement waits for its quote. Do not delay incident response because an optional enhancement is awaiting approval."
      : "Restoration and new capability are tracked as linked items with separate coverage; approval of one never depends on the other.",
  };
}

/** Parse a form/query value into a WorkClassId, or null. */
export function parseWorkClass(v: unknown): WorkClassId | null {
  return typeof v === "string" && (WORK_CLASS_IDS as readonly string[]).includes(v)
    ? (v as WorkClassId)
    : null;
}

export function parseCoverageDecision(v: unknown): CoverageDecision | null {
  return typeof v === "string" && (COVERAGE_DECISIONS as readonly string[]).includes(v)
    ? (v as CoverageDecision)
    : null;
}
