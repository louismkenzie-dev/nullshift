/**
 * The project lifecycle, in order (migration 0024).
 *
 * Kept in one place so the admin stage control and the portal's accept flow
 * cannot disagree about which way is forward.
 */
export const PROJECT_STAGES = [
  "discovery",
  "onboarding",
  "build",
  "review",
  "launch_prep",
  "live",
  "care",
  "complete",
] as const;

export type ProjectStage = (typeof PROJECT_STAGES)[number];

export const stageIndex = (s: string | null | undefined): number =>
  PROJECT_STAGES.indexOf(s as ProjectStage);

/**
 * Move a project forward to `target`, never backwards.
 *
 * Signing a proposal opens onboarding — but a client who was delivered and is
 * already on `care` can still sign retrospectively (an agreement reached by
 * email before the portal existed, say), and slamming their stage back to
 * `onboarding` would tell both of us their live system is a fresh build.
 *
 * Returns the stage to write, or null when the project is already at or past
 * the target and should be left alone.
 */
export function advanceOnly(
  current: string | null | undefined,
  target: ProjectStage
): ProjectStage | null {
  const from = stageIndex(current);
  const to = stageIndex(target);
  // An unknown current stage is not evidence of progress — set the target.
  if (from < 0) return target;
  return from < to ? target : null;
}
