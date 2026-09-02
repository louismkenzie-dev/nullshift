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
