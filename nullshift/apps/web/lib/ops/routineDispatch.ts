/**
 * Claude Code Routines transport (research preview) — fire a pre-configured
 * routine's HTTP endpoint with the compiled work order attached as the run's
 * text payload. The routine runs as a full Claude Code cloud session on
 * Anthropic infrastructure and returns a session URL to watch live.
 *
 * Setup (per system, once, at claude.ai/code/routines):
 *   1. Create a routine with the system's repo attached and an API trigger.
 *   2. Saved prompt MUST opt in to acting on fire text, e.g.:
 *      "Work through the fix batch described in the routine-fire-payload
 *       block: fix every issue, then push a branch and open a PR."
 *      (Fire text arrives wrapped as untrusted data; the saved prompt is
 *       what authorises acting on it.)
 *   3. Copy the fire URL + generated bearer token into the system passport
 *      (/admin/systems/[id] → Facts).
 *
 * The /fire endpoint ships under the experimental-cc-routine-2026-04-01 beta
 * header and may change while in research preview.
 */

export type RoutineFireResult = {
  sessionId: string | null;
  sessionUrl: string | null;
};

/** The fire endpoint lives on Anthropic's API host only — never send the
 *  bearer token anywhere else, whatever ends up in the passport field. */
export function isValidFireUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname === "api.anthropic.com";
  } catch {
    return false;
  }
}

/**
 * Returns null when the routine was definitely NOT fired (bad URL, network
 * error, non-2xx) — safe to release the batch for another attempt. A 2xx
 * always returns a result, even if the response body couldn't be parsed:
 * the run has started, so the batch must stay dispatched.
 */
export async function fireRoutine(opts: {
  fireUrl: string;
  token: string;
  text: string;
}): Promise<RoutineFireResult | null> {
  if (!isValidFireUrl(opts.fireUrl)) {
    console.error("[ops/routineDispatch] refusing non-Anthropic fire URL");
    return null;
  }
  let res: Response;
  try {
    res = await fetch(opts.fireUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.token}`,
        "anthropic-beta": "experimental-cc-routine-2026-04-01",
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: opts.text }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (err) {
    console.error("[ops/routineDispatch] request failed", err);
    return null;
  }
  if (!res.ok) {
    console.error("[ops/routineDispatch] fire failed", res.status, await res.text());
    return null;
  }
  try {
    const json = (await res.json()) as {
      claude_code_session_id?: string;
      claude_code_session_url?: string;
    };
    const sessionUrl = json.claude_code_session_url ?? null;
    return {
      sessionId: json.claude_code_session_id ?? null,
      // Only ever link back to claude.ai — don't store whatever came back.
      sessionUrl: sessionUrl?.startsWith("https://claude.ai/") ? sessionUrl : null,
    };
  } catch {
    // Fired (2xx) but unparseable body — report success without a link.
    return { sessionId: null, sessionUrl: null };
  }
}
