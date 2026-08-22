import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Deployment mirror — pure helpers for /api/vercel/deploy-hook.
 *
 * The problem this solves: most production change at Null Shift flows through
 * Claude Code → GitHub → Vercel, and none of it used to reach the change
 * register unless a human typed it in. The webhook turns every production
 * deployment in the Vercel team (Ops platform AND hosted client systems) into
 * a soc2_change_records row automatically, so the register mirrors what
 * actually shipped rather than what someone remembered to log.
 *
 * What gets captured per deployment: the commit (sha → change_ref URL), the
 * first line of its message (title), its author, the Vercel deployment id
 * (deploy_ref — the dedupe key), the project it deployed, and — when the
 * commit was made by a Claude Code session — the `Claude-Session:` trailer,
 * stored as ticket_ref. That trailer is the pull-it-apart link: it opens the
 * full session transcript showing every command and edit behind the commit.
 *
 * What deliberately stays human: reviewer, approver, and test evidence. The
 * sweep flags any mirrored deployment still missing them after the annotation
 * grace window — an unreviewed production change surfacing as a high-severity
 * exception is the control working, not noise.
 */

/** Vercel signs webhooks with HMAC-SHA1 of the raw body, hex in x-vercel-signature. */
export function verifyVercelSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): boolean {
  if (!signatureHeader) return false;
  const expected = createHmac("sha1", secret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signatureHeader.trim().toLowerCase(), "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The `Claude-Session: <url>` trailer a Claude Code commit carries. */
export function extractSessionUrl(commitMessage: string | null | undefined): string | null {
  if (!commitMessage) return null;
  const m = commitMessage.match(/Claude-Session:\s*(https:\/\/\S+)/);
  return m ? m[1] : null;
}

export type MirroredDeployment = {
  deployRef: string; // Vercel deployment id — the dedupe key
  title: string;
  projectName: string;
  changeRef: string | null; // commit URL
  ticketRef: string | null; // Claude-Session URL when present
  requestedBy: string | null; // commit author email
  deployedAt: string; // ISO
  commitRef: string | null; // branch
};

/**
 * Map a Vercel `deployment.succeeded` webhook payload to a change record.
 * Returns null for anything that is not a production deployment — preview
 * builds are not production changes and must not pollute the register.
 * Defensive on shape: Vercel's payload nests deployment/meta slightly
 * differently across event versions.
 */
export function mirrorFromWebhook(event: {
  type?: string;
  createdAt?: number;
  payload?: {
    target?: string | null;
    deployment?: {
      id?: string;
      name?: string;
      target?: string | null;
      meta?: Record<string, string | undefined>;
    };
    name?: string;
    project?: { id?: string };
  };
}): MirroredDeployment | null {
  if (event.type !== "deployment.succeeded") return null;
  const p = event.payload ?? {};
  const d = p.deployment ?? {};
  const target = p.target ?? d.target ?? null;
  if (target !== "production") return null;
  if (!d.id) return null;

  const meta = d.meta ?? {};
  const message = meta.githubCommitMessage ?? "";
  const firstLine = message.split("\n")[0]?.trim() || "Production deployment";
  const projectName = d.name ?? p.name ?? "unknown-project";
  const sha = meta.githubCommitSha;
  const org = meta.githubCommitOrg ?? meta.githubOrg;
  const repo = meta.githubCommitRepo ?? meta.githubRepo;
  const changeRef =
    sha && org && repo ? `https://github.com/${org}/${repo}/commit/${sha}` : null;

  return {
    deployRef: d.id,
    title: `[${projectName}] ${firstLine}`.slice(0, 200),
    projectName,
    changeRef,
    ticketRef: extractSessionUrl(message),
    requestedBy: meta.githubCommitAuthorEmail ?? meta.githubCommitAuthorLogin ?? null,
    deployedAt: new Date(event.createdAt ?? Date.now()).toISOString(),
    commitRef: meta.githubCommitRef ?? null,
  };
}
