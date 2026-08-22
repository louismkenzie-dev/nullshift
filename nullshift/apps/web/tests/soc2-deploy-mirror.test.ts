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
