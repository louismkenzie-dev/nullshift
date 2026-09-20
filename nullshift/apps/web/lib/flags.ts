/**
 * Feature flags for the admin redesign (brief §14.2). Every new-model behaviour
 * is off by default; production keeps today's behaviour until a flag is set.
 *
 * Set OPS_V2_FLAGS as a comma-separated list, e.g. "newShell,calculator".
 * Flags are read server-side only; never trust a client-supplied value.
 */
export const OPS_V2_FLAG_KEYS = [
  "newShell", // new dark shell replaces the legacy admin chrome
  "commercialV2", // opportunities, quote versions, service arrangements read from the database
  "calculator", // deterministic estimator drives Quote Studio
  "workIntake", // §7 work classification on issues
  "acceptanceGate", // plan gate reads explicit build acceptance, not stage labels
  "integrationWorkers", // inbox/outbox durable operations and the ops worker
  "billingActivation", // activation gates schedule collections (never charges without them)
] as const;

export type OpsV2Flag = (typeof OPS_V2_FLAG_KEYS)[number];

/**
 * Live defaults (owner decision 2026-09-20): commercial model, calculator,
 * work intake and the acceptance gate are ON; the integration worker and
 * automatic collection scheduling stay OFF until sandbox rehearsal.
 * OPS_V2_FLAGS adds flags; a "-name" entry removes one (e.g. "-calculator").
 */
export const DEFAULT_FLAGS: readonly OpsV2Flag[] = [
  "newShell",
  "commercialV2",
  "calculator",
  "workIntake",
  "acceptanceGate",
];

function parse(): Set<OpsV2Flag> {
  const raw = process.env.OPS_V2_FLAGS ?? "";
  const set = new Set<OpsV2Flag>(DEFAULT_FLAGS);
  for (const part of raw.split(",")) {
    const token = part.trim();
    const off = token.startsWith("-");
    const key = (off ? token.slice(1) : token) as OpsV2Flag;
    if (!(OPS_V2_FLAG_KEYS as readonly string[]).includes(key)) continue;
    if (off) set.delete(key);
    else set.add(key);
  }
  return set;
}

export function flagOn(flag: OpsV2Flag): boolean {
  return parse().has(flag);
}

export function activeFlags(): OpsV2Flag[] {
  return [...parse()];
}
