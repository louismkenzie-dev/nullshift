import type { RepoSnapshot } from "../repoAnalysis";

/**
 * Read a client repository through the GitHub REST API: metadata, the
 * recursive tree, every package.json near the root, and vercel.json. Uses
 * GITHUB_DISPATCH_TOKEN when set (the same token "Dispatch to Claude" uses —
 * it needs contents:read on the client repos); public repositories work
 * without one. Throws with a readable message; the orchestrator records it.
 */

const API = "https://api.github.com";
const TIMEOUT_MS = 15_000;

function headers(): Record<string, string> {
  const token = process.env.GITHUB_DISPATCH_TOKEN || process.env.GITHUB_TOKEN;
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "nullshift-ops-auto-score",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function gh<T>(path: string): Promise<T | null> {
  const res = await fetch(`${API}${path}`, {
    headers: headers(),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 200);
    throw new Error(`GitHub ${path} → ${res.status}${detail ? `: ${detail}` : ""}`);
  }
  return (await res.json()) as T;
}

type RepoMeta = {
  default_branch?: string;
  size?: number;
  language?: string | null;
  pushed_at?: string | null;
};
type Tree = { truncated?: boolean; tree?: { path: string; type: string }[] };
type Contents = { content?: string; encoding?: string };

async function fileJson(fullName: string, path: string, ref: string): Promise<unknown> {
  const c = await gh<Contents>(
    `/repos/${fullName}/contents/${path}?ref=${encodeURIComponent(ref)}`
  );
  if (!c?.content) return null;
  try {
    const text = Buffer.from(
      c.content,
      c.encoding === "base64" ? "base64" : "utf8"
    ).toString("utf8");
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Root + one level of apps/packages — enough for a monorepo, cheap for a SPA. */
function packageJsonCandidates(paths: string[]): string[] {
  return paths
    .filter((p) => /(^|\/)package\.json$/.test(p) && !/(^|\/)node_modules\//.test(p))
    .filter((p) => p.split("/").length <= 3)
    .sort((a, b) => a.split("/").length - b.split("/").length)
    .slice(0, 8);
}

export async function fetchRepoSnapshot(
  fullName: string,
  opts: { branch?: string | null } = {}
): Promise<RepoSnapshot> {
  const meta = await gh<RepoMeta>(`/repos/${fullName}`);
  if (!meta)
    throw new Error(
      `Repository ${fullName} not found — private repos need GITHUB_DISPATCH_TOKEN with contents:read`
    );
  const branch = opts.branch || meta.default_branch || "main";
  const tree = await gh<Tree>(
    `/repos/${fullName}/git/trees/${encodeURIComponent(branch)}?recursive=1`
  );
  if (!tree?.tree)
    throw new Error(`Branch ${branch} of ${fullName} has no readable tree`);
  const paths = tree.tree.filter((e) => e.type === "blob").map((e) => e.path);

  const pkgPaths = packageJsonCandidates(paths);
  const [packageJsons, vercelJson] = await Promise.all([
    Promise.all(
      pkgPaths.map(async (path) => ({
        path,
        json: await fileJson(fullName, path, branch),
      }))
    ),
    paths.includes("vercel.json")
      ? fileJson(fullName, "vercel.json", branch)
      : Promise.resolve(null),
  ]);

  return {
    fullName,
    defaultBranch: branch,
    paths,
    treeTruncated: !!tree.truncated,
    packageJsons: packageJsons.filter((p) => p.json !== null),
    vercelJson,
    meta: {
      sizeKb: meta.size ?? null,
      language: meta.language ?? null,
      pushedAt: meta.pushed_at ?? null,
    },
  };
}
