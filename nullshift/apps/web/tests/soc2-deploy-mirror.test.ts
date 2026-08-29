import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import {
  extractSessionUrl,
  mirrorFromWebhook,
  verifyVercelSignature,
} from "@/lib/soc2/deployMirror";

/**
 * The deploy mirror: every production deployment in the Vercel team becomes a
 * change record, with the Claude Code session trailer as its ticket ref, so
 * the change register mirrors what actually shipped.
 */

const sign = (body: string, secret: string) =>
  createHmac("sha1", secret).update(body, "utf8").digest("hex");

describe("webhook signature", () => {
  it("accepts a correctly signed body and nothing else", () => {
    const body = JSON.stringify({ type: "deployment.succeeded" });
    expect(verifyVercelSignature(body, sign(body, "s3cret"), "s3cret")).toBe(true);
    expect(verifyVercelSignature(body, sign(body, "wrong"), "s3cret")).toBe(false);
    expect(verifyVercelSignature(body + " ", sign(body, "s3cret"), "s3cret")).toBe(false);
    expect(verifyVercelSignature(body, null, "s3cret")).toBe(false);
    expect(verifyVercelSignature(body, "", "s3cret")).toBe(false);
  });
});

describe("Claude-Session trailer", () => {
  it("finds the session URL in a commit message", () => {
    const msg =
      "fix(portal): something\n\nBody.\n\nCo-Authored-By: Claude <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_018Y83dq";
    expect(extractSessionUrl(msg)).toBe("https://claude.ai/code/session_018Y83dq");
    expect(extractSessionUrl("no trailer here")).toBeNull();
    expect(extractSessionUrl(null)).toBeNull();
  });
});

describe("payload mapping", () => {
  const event = {
    type: "deployment.succeeded",
    createdAt: 1787416464700,
    payload: {
      target: "production",
      deployment: {
        id: "dpl_abc123",
        name: "nullshift",
        meta: {
          githubCommitSha: "889d778",
          githubCommitOrg: "louismkenzie-dev",
          githubCommitRepo: "nullshift",
          githubCommitRef: "main",
          githubCommitAuthorEmail: "noreply@anthropic.com",
          githubCommitMessage:
            "fix(portal): staff land in Mission Control\n\nDetail.\n\nClaude-Session: https://claude.ai/code/session_018Y",
        },
      },
    },
  };

  it("maps a production deployment to a change record", () => {
    const m = mirrorFromWebhook(event);
    expect(m).not.toBeNull();
    expect(m!.deployRef).toBe("dpl_abc123");
    expect(m!.title).toBe("[nullshift] fix(portal): staff land in Mission Control");
    expect(m!.changeRef).toBe(
      "https://github.com/louismkenzie-dev/nullshift/commit/889d778"
    );
    expect(m!.ticketRef).toBe("https://claude.ai/code/session_018Y");
    expect(m!.requestedBy).toBe("noreply@anthropic.com");
    expect(m!.commitRef).toBe("main");
  });

  it("covers client-system projects in the same team, labelled by project", () => {
    const client = structuredClone(event);
    client.payload.deployment.name = "the-dance-exclusive";
    client.payload.deployment.id = "dpl_client1";
    expect(mirrorFromWebhook(client)!.title).toContain("[the-dance-exclusive]");
  });

  it("ignores previews and other events — they are not production changes", () => {
    const preview = structuredClone(event);
    preview.payload.target = "";
    expect(mirrorFromWebhook(preview)).toBeNull();

    const other = structuredClone(event);
    other.type = "deployment.created";
    expect(mirrorFromWebhook(other)).toBeNull();

    expect(mirrorFromWebhook({ type: "deployment.succeeded", payload: {} })).toBeNull();
  });

  it("survives a payload without commit metadata", () => {
    const bare = {
      type: "deployment.succeeded",
      payload: { target: "production", deployment: { id: "dpl_bare", name: "nullshift" } },
    };
    const m = mirrorFromWebhook(bare);
    expect(m).not.toBeNull();
    expect(m!.title).toBe("[nullshift] Production deployment");
    expect(m!.changeRef).toBeNull();
    expect(m!.ticketRef).toBeNull();
  });
});

describe("GitHub Actions transport", () => {
  /**
   * Vercel's team webhooks are paid-plan only, so the free transport is a
   * workflow that builds this same payload and signs it with the shared
   * secret (.github/scripts/mirror-deployment.mjs). The endpoint authenticates
   * the signature, not the sender — these tests pin the contract between the
   * two, since a shape drift would silently stop mirroring production changes.
   */
  const fromActions = {
    type: "deployment.succeeded",
    createdAt: 1787419018377,
    payload: {
      target: "production",
      deployment: {
        // The Actions transport keys a deployment by its hostname; only Vercel
        // itself knows the dpl_ id.
        id: "nullshift-4ggz4gyin-louis-mckenzies-projects.vercel.app",
        name: "nullshift",
        meta: {
          githubCommitMessage:
            "feat(soc2): work order\n\nBody.\n\nClaude-Session: https://claude.ai/code/session_018Y83dq",
          githubCommitSha: "151a131f6c3e3a6103caa7a082cf290df3f40270",
          githubCommitOrg: "louismkenzie-dev",
          githubCommitRepo: "nullshift",
          githubCommitRef: "main",
          githubCommitAuthorEmail: "noreply@anthropic.com",
          githubCommitAuthorLogin: "claude",
        },
      },
    },
  };

  it("mirrors a workflow-sent deployment exactly like a Vercel-sent one", () => {
    const m = mirrorFromWebhook(fromActions);
    expect(m).not.toBeNull();
    expect(m!.deployRef).toBe("nullshift-4ggz4gyin-louis-mckenzies-projects.vercel.app");
    expect(m!.title).toBe("[nullshift] feat(soc2): work order");
    expect(m!.changeRef).toBe(
      "https://github.com/louismkenzie-dev/nullshift/commit/151a131f6c3e3a6103caa7a082cf290df3f40270"
    );
    expect(m!.ticketRef).toBe("https://claude.ai/code/session_018Y83dq");
    expect(m!.requestedBy).toBe("noreply@anthropic.com");
    expect(m!.commitRef).toBe("main");
    expect(m!.deployedAt).toBe(new Date(1787419018377).toISOString());
  });

  it("signs with the same scheme the endpoint verifies", () => {
    const body = JSON.stringify(fromActions);
    expect(verifyVercelSignature(body, sign(body, "shared"), "shared")).toBe(true);
  });

  it("falls back to the commit author login when no email is exposed", () => {
    const noEmail = structuredClone(fromActions);
    noEmail.payload.deployment.meta.githubCommitAuthorEmail = null as unknown as string;
    expect(mirrorFromWebhook(noEmail)!.requestedBy).toBe("claude");
  });
});
