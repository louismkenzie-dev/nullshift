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

export async function fireRoutine(opts: {
  fireUrl: string;
  token: string;
  text: string;
}): Promise<RoutineFireResult | null> {
  try {
    const res = await fetch(opts.fireUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.token}`,
        "anthropic-beta": "experimental-cc-routine-2026-04-01",
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: opts.text }),
    });
    if (!res.ok) {
      console.error("[ops/routineDispatch] fire failed", res.status, await res.text());
      return null;
    }
    const json = (await res.json()) as {
      claude_code_session_id?: string;
      claude_code_session_url?: string;
    };
    return {
      sessionId: json.claude_code_session_id ?? null,
      sessionUrl: json.claude_code_session_url ?? null,
    };
  } catch (err) {
    console.error("[ops/routineDispatch] request failed", err);
    return null;
  }
}
