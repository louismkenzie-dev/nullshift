#!/usr/bin/env node
/**
 * SOC 2 change mirror — GitHub Actions transport.
 *
 * Vercel's own team webhooks are a paid-plan feature. The Ops endpoint
 * (/api/vercel/deploy-hook) does not care WHO sends the event, only that the
 * body carries a valid HMAC-SHA1 signature under the shared secret — so this
 * script sends the same `deployment.succeeded` payload from GitHub Actions,
 * which is free on a public repo.
 *
 * Two modes, one script:
 *  - deployment_status event → mirror that one production deployment, seconds
 *    after Vercel reports it succeeded.
 *  - schedule / workflow_dispatch → replay the last N production deployments.
 *    The endpoint is idempotent, so replays are cheap and the register
 *    self-heals if an event was ever missed or the site was down.
 *
 * Fails loudly rather than silently: an unmirrored production change is the
 * exact gap this control exists to close.
 */

import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";

const endpoint = process.env.MIRROR_ENDPOINT || "";
const secret = process.env.MIRROR_SECRET || "";
const token = process.env.GITHUB_TOKEN || "";
const repoFull = process.env.GITHUB_REPOSITORY || "";
const eventName = process.env.GITHUB_EVENT_NAME || "";
const eventPath = process.env.GITHUB_EVENT_PATH || "";
const lookback = Math.min(Math.max(Number(process.env.LOOKBACK || 20) || 20, 1), 100);

const die = (msg) => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};

if (!secret) {
  die(
    "MIRROR_SECRET is empty. Add a repository secret SOC2_DEPLOY_HOOK_SECRET " +
      "holding the same value as VERCEL_DEPLOY_HOOK_SECRET in the Vercel project."
  );
}
if (!endpoint) die("MIRROR_ENDPOINT is empty.");
const [owner, repo] = repoFull.split("/");
if (!owner || !repo) die(`GITHUB_REPOSITORY looks wrong: "${repoFull}"`);

async function gh(path) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "user-agent": "nullshift-soc2-change-mirror",
    },
  });
  if (!res.ok) throw new Error(`GitHub API ${path} → ${res.status} ${await res.text()}`);
  return res.json();
}

/** Vercel labels its GitHub deployments "Production" / "Preview – <branch>". */
const isProduction = (environment) =>
  String(environment || "").trim().toLowerCase().startsWith("production");

/**
 * The Vercel deployment URL uniquely identifies the deployment and, unlike a
 * dpl_ id, a human can paste it into a browser. It is the dedupe key here;
 * the endpoint additionally dedupes on the commit, so a deployment already
 * mirrored by a real Vercel webhook is never recorded twice.
 */
const deployRefFrom = (targetUrl) => {
  try {
    return new URL(targetUrl).host;
  } catch {
    return null;
  }
};

/** Collect the production deployments this run should mirror. */
async function collect() {
  if (eventName === "deployment_status") {
    const event = JSON.parse(await readFile(eventPath, "utf8"));
    const status = event.deployment_status ?? {};
    const deployment = event.deployment ?? {};
    const environment = deployment.environment ?? status.environment;
    if (status.state !== "success" || !isProduction(environment)) {
      // Say WHY, with the real values: if Vercel ever labelled production
      // deployments differently, a silent "nothing to do" would hide a gap in
      // the register. The nightly replay is the backstop, this is the hint.
      console.log(`· skipped — state "${status.state}", environment "${environment}"`);
      return [];
    }
    return [
      {
        sha: deployment.sha,
        ref: deployment.ref,
        targetUrl: status.target_url,
        at: status.created_at ?? status.updated_at,
      },
    ];
  }

  // Scheduled catch-up: recent deployments, newest first. The environment is
  // filtered here rather than in the query so the label's exact casing is not
  // a silent dependency — and so the labels actually seen can be reported.
  const deployments = await gh(`/repos/${owner}/${repo}/deployments?per_page=${lookback * 3}`);
  const seen = new Set();
  const out = [];
  for (const d of deployments) {
    seen.add(String(d.environment));
    if (!isProduction(d.environment)) continue;
    const statuses = await gh(`/repos/${owner}/${repo}/deployments/${d.id}/statuses?per_page=10`);
    const ok = statuses.find((s) => s.state === "success");
    if (!ok) continue;
    out.push({ sha: d.sha, ref: d.ref, targetUrl: ok.target_url, at: ok.created_at });
    if (out.length >= lookback) break;
  }
  if (out.length === 0) {
    die(
      "No successful production deployments found via the GitHub Deployments API " +
        `(environments seen: ${[...seen].join(", ") || "none"}). If Vercel is not ` +
        "creating GitHub deployment records for this repo, this transport cannot " +
        "see production releases and the change register would be incomplete — " +
        "check Vercel → Project → Settings → Git, or configure the Vercel team " +
        "webhook instead."
    );
  }
  return out;
}

/** Build the exact payload shape mirrorFromWebhook() expects. */
async function toEvent(d) {
  const commit = await gh(`/repos/${owner}/${repo}/commits/${d.sha}`);
  return {
    type: "deployment.succeeded",
    createdAt: new Date(d.at ?? Date.now()).getTime(),
    payload: {
      target: "production",
      deployment: {
        id: deployRefFrom(d.targetUrl) ?? `${repo}-${d.sha.slice(0, 12)}`,
        name: repo,
        meta: {
          githubCommitMessage: commit.commit?.message ?? "",
          githubCommitSha: d.sha,
          githubCommitOrg: owner,
          githubCommitRepo: repo,
          githubCommitRef: d.ref,
          githubCommitAuthorEmail: commit.commit?.author?.email ?? null,
          githubCommitAuthorLogin: commit.author?.login ?? null,
        },
      },
    },
  };
}

async function send(event) {
  const body = JSON.stringify(event);
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-vercel-signature": createHmac("sha1", secret).update(body, "utf8").digest("hex"),
      "user-agent": "nullshift-soc2-change-mirror",
    },
    body,
  });
  const text = await res.text();
  if (res.status === 503) {
    die(
      "The endpoint answered 503 (mirror not configured): VERCEL_DEPLOY_HOOK_SECRET " +
        "is not set on the Vercel project. Set it to the same value as the " +
        "SOC2_DEPLOY_HOOK_SECRET repository secret and redeploy."
    );
  }
  if (res.status === 401) {
    die(
      "The endpoint rejected the signature (401): SOC2_DEPLOY_HOOK_SECRET and " +
        "VERCEL_DEPLOY_HOOK_SECRET hold different values."
    );
  }
  if (!res.ok) throw new Error(`mirror endpoint → ${res.status} ${text}`);
  return JSON.parse(text);
}

const targets = await collect();
if (targets.length === 0) {
  console.log("· nothing to mirror (not a successful production deployment)");
  process.exit(0);
}

let mirrored = 0;
let duplicate = 0;
for (const d of targets) {
  const event = await toEvent(d);
  const result = await send(event);
  if (result.mirrored) {
    mirrored += 1;
    console.log(`✓ ${result.ref} ← ${d.sha.slice(0, 7)} (${d.targetUrl})`);
  } else {
    duplicate += 1;
    console.log(`· already registered: ${d.sha.slice(0, 7)}`);
  }
}
console.log(`\n${mirrored} mirrored, ${duplicate} already in the change register.`);
