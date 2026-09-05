/**
 * Dispatch a compiled fix batch to Claude Code via GitHub: create an issue on
 * the client system's repo containing the work order with an @claude mention,
 * which the claude-code-action installed on that repo picks up and turns into
 * a PR. Best-effort: returns null when GITHUB_DISPATCH_TOKEN is unset or the
 * API call fails, in which case the admin falls back to copy-and-paste.
 *
 * Setup per client repo (documented in docs/OPERATIONS.md):
 *   1. Install anthropics/claude-code-action@v1 as a workflow.
 *   2. Add ANTHROPIC_API_KEY to the repo's Actions secrets.
 *   3. GITHUB_DISPATCH_TOKEN (this app's env) needs issues:write on the repo.
 */
export async function createGithubFixIssue(opts: {
  repoFullName: string;
  title: string;
  body: string;
}): Promise<{ url: string } | null> {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) {
    console.warn(
      "[ops/githubDispatch] GITHUB_DISPATCH_TOKEN not set — skipping dispatch"
    );
    return null;
  }
  try {
    const res = await fetch(`https://api.github.com/repos/${opts.repoFullName}/issues`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: opts.title,
        body: `@claude ${opts.body}`,
      }),
    });
    if (!res.ok) {
      console.error(
        "[ops/githubDispatch] GitHub API error",
        res.status,
        await res.text()
      );
      return null;
    }
    const json = (await res.json()) as { html_url?: string };
    return json.html_url ? { url: json.html_url } : null;
  } catch (err) {
    console.error("[ops/githubDispatch] request failed", err);
    return null;
  }
}

/**
 * Read a pull request's description, so its "## Outcomes" block can be
 * drafted into the review desk. Best-effort: null when the token is unset,
 * the URL is not a GitHub PR, or the API refuses — staff then write the
 * outcomes by hand. Only ever reads.
 */
export async function fetchPullRequestBody(prUrl: string): Promise<string | null> {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) return null;
  const m = prUrl
    .trim()
    .match(/^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/pull\/(\d+)/i);
  if (!m) return null;
  const [, owner, repo, number] = m;
  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${number}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        signal: AbortSignal.timeout(15_000),
      }
    );
    if (!res.ok) {
      console.error("[ops/githubDispatch] PR read failed", res.status);
      return null;
    }
    const json = (await res.json()) as { body?: string | null };
    return json.body ?? "";
  } catch (err) {
    console.error("[ops/githubDispatch] PR read threw", err);
    return null;
  }
}
