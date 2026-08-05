import { createServiceClient } from "@nullshift/db";
import { hasClaude } from "./claude";

/**
 * Managed Agents transport (beta) — spawn an Anthropic-hosted sandbox session
 * that mounts the system's repo, works through the compiled fix batch, and
 * pushes a branch. No runner timeouts; the session is watchable in the
 * Anthropic Console and its status is polled back onto the batch page.
 *
 * The agent + environment are persisted resources: created lazily on first
 * dispatch and stored in ops_settings (never re-created per run). Sessions
 * are per-batch.
 *
 * v1 pushes a `claude/fix-batch-*` branch and the admin opens the PR from
 * the compare link — PR creation via the GitHub MCP server + vault
 * credentials is the documented upgrade (see docs/OPERATIONS.md).
 *
 * Requires ANTHROPIC_API_KEY (session billing is API-metered) and
 * GITHUB_DISPATCH_TOKEN with Contents: Read and write on the repo.
 */

const SETTINGS_KEY = "managed_agents";
const AGENT_NAME = "NullShift Fix Batch Runner";
const ENV_NAME = "nullshift-ops";

const AGENT_SYSTEM = `You are NullShift's fix-batch runner. Each session mounts one client system's repository and gives you a work order listing issues to fix. Work through every issue: fix root causes with minimal, production-quality changes; run the project's typecheck/build before finishing; never commit secrets. Commit your work to the branch named in the work order and push it with git. If an issue cannot be fixed (needs a decision, missing access), leave it and say so plainly in your final summary, which should list each issue with a one-line plain-English outcome.`;

export function hasManagedAgentConfig(): boolean {
  return hasClaude() && Boolean(process.env.GITHUB_DISPATCH_TOKEN);
}

type AnthropicClient = InstanceType<(typeof import("@anthropic-ai/sdk"))["default"]>;

async function getClient(): Promise<AnthropicClient | null> {
  if (!hasClaude()) return null;
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  return new Anthropic();
}

/**
 * Find-or-create the persisted agent + environment, caching ids in
 * ops_settings. Never creates per run.
 */
async function ensureAgentAndEnv(
  client: AnthropicClient
): Promise<{ agentId: string; environmentId: string } | null> {
  const service = createServiceClient();
  const { data: row } = await service
    .from("ops_settings")
    .select("value")
    .eq("key", SETTINGS_KEY)
    .maybeSingle();
  const stored = (row?.value ?? {}) as { agent_id?: string; environment_id?: string };
  if (stored.agent_id && stored.environment_id) {
    return { agentId: stored.agent_id, environmentId: stored.environment_id };
  }

  try {
    let environmentId = stored.environment_id ?? null;
    if (!environmentId) {
      // Environment names are unique — reuse an existing one before creating.
      for await (const env of client.beta.environments.list()) {
        if (env.name === ENV_NAME) {
          environmentId = env.id;
          break;
        }
      }
      if (!environmentId) {
        const env = await client.beta.environments.create({
          name: ENV_NAME,
          config: { type: "cloud", networking: { type: "unrestricted" } },
        });
        environmentId = env.id;
      }
    }

    let agentId = stored.agent_id ?? null;
    if (!agentId) {
      const agent = await client.beta.agents.create({
        name: AGENT_NAME,
        model: "claude-opus-5",
        system: AGENT_SYSTEM,
        tools: [{ type: "agent_toolset_20260401" }],
      });
      agentId = agent.id;
    }

    await service.from("ops_settings").upsert({
      key: SETTINGS_KEY,
      value: { agent_id: agentId, environment_id: environmentId },
      updated_at: new Date().toISOString(),
    });
    return { agentId, environmentId };
  } catch (err) {
    console.error("[ops/managedAgents] ensureAgentAndEnv failed", err);
    return null;
  }
}

export async function dispatchBatchToManagedAgent(opts: {
  repoFullName: string;
  defaultBranch: string;
  workOrder: string;
  batchId: string;
}): Promise<{ sessionId: string; sessionUrl: string } | null> {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  const client = await getClient();
  if (!client || !token) {
    console.warn("[ops/managedAgents] missing ANTHROPIC_API_KEY or GITHUB_DISPATCH_TOKEN");
    return null;
  }
  const ids = await ensureAgentAndEnv(client);
  if (!ids) return null;

  const branch = `claude/fix-batch-${opts.batchId.slice(0, 8)}`;
  const kickoff = [
    opts.workOrder,
    "",
    "## Session transport notes",
    `- The repository is mounted at /workspace/${opts.repoFullName.split("/")[1]}.`,
    `- Commit to the branch \`${branch}\` and push it with git when done (pushes are authenticated automatically).`,
    `- Do NOT try to open a pull request from this session — pushing the branch is the deliverable; the PR is opened from the compare view.`,
  ].join("\n");

  try {
    const session = await client.beta.sessions.create({
      agent: ids.agentId,
      environment_id: ids.environmentId,
      title: `Fix batch ${opts.batchId.slice(0, 8)} — ${opts.repoFullName}`,
      resources: [
        {
          type: "github_repository",
          url: `https://github.com/${opts.repoFullName}`,
          authorization_token: token,
          checkout: { type: "branch", name: opts.defaultBranch },
        },
      ],
      initial_events: [
        { type: "user.message", content: [{ type: "text", text: kickoff }] },
      ],
    });
    return {
      sessionId: session.id,
      sessionUrl: `https://platform.claude.com/workspaces/default/sessions/${session.id}`,
    };
  } catch (err) {
    console.error("[ops/managedAgents] session create failed", err);
    return null;
  }
}

export type ManagedSessionStatus = {
  status: string;
  lastMessage: string | null;
};

/** Poll a session's status + last agent message for the batch page. */
export async function getManagedSessionStatus(
  sessionId: string
): Promise<ManagedSessionStatus | null> {
  const client = await getClient();
  if (!client) return null;
  try {
    const session = await client.beta.sessions.retrieve(sessionId);
    let lastMessage: string | null = null;
    const events = await client.beta.sessions.events.list(sessionId);
    for (const ev of events.data ?? []) {
      if (ev.type === "agent.message") {
        const text = (ev as { content?: { type: string; text?: string }[] }).content
          ?.filter((b) => b.type === "text")
          .map((b) => b.text ?? "")
          .join("");
        if (text) lastMessage = text;
      }
    }
    return { status: session.status, lastMessage };
  } catch (err) {
    console.error("[ops/managedAgents] status failed", err);
    return null;
  }
}
