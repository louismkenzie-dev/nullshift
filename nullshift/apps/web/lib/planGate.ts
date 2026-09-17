import { flagOn } from "@/lib/flags";
import { governingAcceptance } from "@/lib/delivery/acceptance";
import type { AcceptanceEvidence } from "@/lib/delivery/types";

/**
 * When may a client choose a care plan? Only once there is a system to look
 * after. The chooser, the "send plan options" email and every Direct Debit
 * start check this, so an admin onboarding a client can never pick a plan on
 * their behalf — the plan is chosen by the client, after the build.
 */
export const BUILT_STAGES = ["live", "care", "complete"] as const;

export function planChoiceOpen(stage: string | null | undefined): boolean {
  return !!stage && (BUILT_STAGES as readonly string[]).includes(stage);
}

/** Copy for the portal and the board when the chooser is still closed. */
export function planChoiceClosedReason(stage: string | null | undefined): string {
  switch (stage) {
    case "discovery":
    case "onboarding":
      return "Your care plan options open once your system is built and live.";
    case "build":
    case "review":
      return "Your system is being built — plan options open once it is live.";
    case "launch_prep":
      return "Nearly there: plan options open the moment your system goes live.";
    default:
      return "Your care plan options open once your system is live.";
  }
}

/* ── Explicit build acceptance (admin redesign, brief §3.3 #3, §8.2) ─────── */

export type PlanChoiceInputV2 = {
  /** projects.stage — the legacy signal, used only when the flag is off or `legacy` is set. */
  stage: string | null | undefined;
  /** The scope version the acceptance must be against (lib/delivery/scope.ts). */
  governingScopeVersionRef: string | null;
  /** build_acceptances rows for the project. */
  acceptances: AcceptanceEvidence[];
  /**
   * Per-tenant legacy bypass (Phase 0 §7): a client already on `care` under the
   * old model keeps the stage rule until `tenants.legacy_model` exists. Never
   * true for a new-model client.
   */
  legacy?: boolean;
  /** Whether a partial (accepted-with-exceptions) acceptance opens the chooser. Default false. */
  allowPartial?: boolean;
};

/**
 * Plan choice gate, v2. With `acceptanceGate` OFF this is exactly
 * `planChoiceOpen(stage)`, so nothing changes in production until the flag is
 * set. With the flag ON the chooser opens only on EVIDENCE: a non-disputed
 * build acceptance for the governing scope version (a clean one, or a partial
 * one only when the caller allows it). Stage labels are ignored — `live` is a
 * label, an acceptance row is a fact. A disputed acceptance never opens it.
 */
export function planChoiceOpenV2(input: PlanChoiceInputV2): boolean {
  if (!flagOn("acceptanceGate")) return planChoiceOpen(input.stage);
  if (input.legacy) return planChoiceOpen(input.stage);
  const governing = governingAcceptance(
    input.acceptances,
    input.governingScopeVersionRef
  );
  if (!governing) return false;
  if (governing.partial && !input.allowPartial) return false;
  return true;
}

/** Copy for the v2 gate when it is closed. */
export function planChoiceClosedReasonV2(input: PlanChoiceInputV2): string {
  if (!flagOn("acceptanceGate") || input.legacy)
    return planChoiceClosedReason(input.stage);
  if (!input.governingScopeVersionRef)
    return "Your care plan options open once your build is accepted against an agreed scope.";
  const latest = input.acceptances.find(
    (a) => a.scope_version_ref === input.governingScopeVersionRef
  );
  if (latest?.disputed)
    return "Your build acceptance is disputed; plan options open once it is resolved.";
  if (latest?.partial)
    return "Your build is accepted with exceptions; plan options open once those are closed.";
  return "Your care plan options open once you have accepted the build.";
}
