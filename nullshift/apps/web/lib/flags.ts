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

function parse(): Set<OpsV2Flag> {
  const raw = process.env.OPS_V2_FLAGS ?? "";
  const set = new Set<OpsV2Flag>();
  for (const part of raw.split(",")) {
    const key = part.trim() as OpsV2Flag;
    if ((OPS_V2_FLAG_KEYS as readonly string[]).includes(key)) set.add(key);
  }
  return set;
}

export function flagOn(flag: OpsV2Flag): boolean {
  return parse().has(flag);
}

export function activeFlags(): OpsV2Flag[] {
  return [...parse()];
}
