import { createServiceClient } from "./server";

/**
 * Durable, cross-instance rate limiting backed by the rate_limits table
 * (migration 0026) — one atomic upsert per hit via the rate_limit_hit RPC.
 * The old in-memory Map reset on every serverless instance, so public
 * endpoints were effectively unmetered.
 *
 * Returns true when the request is ALLOWED. Fails OPEN on infrastructure
 * errors — a rate-limiter outage must never take down signup or the funnel —
 * but logs loudly so the failure is visible.
 */
export async function rateLimitAllow(
  scope: string,
  identity: string,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  try {
    const service = createServiceClient();
    const key = `${scope}:${identity.toLowerCase().slice(0, 200)}`;
    const { data, error } = await service.rpc("rate_limit_hit", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.error("rateLimitAllow rpc error (failing open):", error.message);
      return true;
    }
    return data === true;
  } catch (e) {
    console.error("rateLimitAllow failed (failing open):", e);
    return true;
  }
}

/** First client IP from the proxy chain — good enough as a limiter identity. */
export function requestIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
