import { describe, it, expect } from "vitest";
import {
  REDACTED,
  TOOL_IMPACT,
  classifyImpact,
  redactSecrets,
  requiresConfirmation,
} from "@/lib/ai/impact";

/**
 * §13 and its §21 cases: "high-impact action requires confirmation" and
 * "secrets are redacted from AI action logs".
 */

describe("action impact (§13)", () => {
  it("treats read-only lookups as low impact", () => {
    expect(classifyImpact("search")).toBe("low");
    expect(classifyImpact("read_record")).toBe("low");
    expect(requiresConfirmation("search")).toBe(false);
  });

  it("treats reversible internal writes as medium", () => {
    expect(classifyImpact("create_task")).toBe("medium");
    expect(requiresConfirmation("create_task")).toBe(false);
  });

  it("requires confirmation for anything that leaves the building", () => {
    for (const tool of ["send_email", "send_sms", "post_message"]) {
      expect(classifyImpact(tool)).toBe("high");
      expect(requiresConfirmation(tool)).toBe(true);
    }
  });

  it("requires confirmation for anything that moves money", () => {
    for (const tool of ["create_invoice", "issue_refund", "charge_card"])
      expect(requiresConfirmation(tool)).toBe(true);
  });

  it("requires confirmation for anything irreversible or access-changing", () => {
    for (const tool of ["delete_record", "grant_access", "revoke_access", "deploy", "run_sql"])
      expect(requiresConfirmation(tool)).toBe(true);
  });

  it("treats an unknown tool as high impact — silence is not a low-risk signal", () => {
    expect(classifyImpact("some_tool_nobody_classified")).toBe("high");
    expect(requiresConfirmation("some_tool_nobody_classified")).toBe(true);
  });

  it("only skips confirmation when a workflow deliberately pre-authorises it", () => {
    expect(requiresConfirmation("send_email", { preAuthorised: true })).toBe(false);
    expect(requiresConfirmation("send_email", {})).toBe(true);
    expect(requiresConfirmation("send_email", { preAuthorised: false })).toBe(true);
  });

  it("classifies every tool it lists as one of the three tiers", () => {
    for (const [tool, impact] of Object.entries(TOOL_IMPACT)) {
      expect(["low", "medium", "high"]).toContain(impact);
      expect(classifyImpact(tool)).toBe(impact);
    }
  });
});

describe("log redaction (§13)", () => {
  it("redacts by key name", () => {
    const out = redactSecrets({
      to: "client@example.com",
      password: "hunter2",
      api_key: "abcdef",
      authorization: "Basic abc",
    }) as Record<string, unknown>;
    expect(out.to).toBe("client@example.com");
    expect(out.password).toBe(REDACTED);
    expect(out.api_key).toBe(REDACTED);
    expect(out.authorization).toBe(REDACTED);
  });

  it("redacts a secret pasted into an innocently-named field", () => {
    const out = redactSecrets({
      note: "use sk_live_51HxxxxxxxxxxxxxxABCD to test",
    }) as Record<string, string>;
    expect(out.note).not.toContain("sk_live_");
    expect(out.note).toContain(REDACTED);
  });

  it("never lets a card number through, whatever the field is called", () => {
    const out = redactSecrets({
      customer_reference: "4242 4242 4242 4242",
      cvv: "123",
    }) as Record<string, string>;
    expect(out.customer_reference).toBe(REDACTED);
    expect(out.cvv).toBe(REDACTED);
  });

  it("redacts bearer tokens and JWTs", () => {
    const out = redactSecrets(
      "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk"
    ) as string;
    expect(out).toContain(REDACTED);
    expect(out).not.toContain("eyJhbGciOiJIUzI1NiJ9");
  });

  it("goes all the way down a nested object", () => {
    const out = redactSecrets({
      request: { headers: { cookie: "session=abc" }, body: { ok: true } },
    }) as { request: { headers: Record<string, string>; body: Record<string, boolean> } };
    expect(out.request.headers.cookie).toBe(REDACTED);
    expect(out.request.body.ok).toBe(true);
  });

  it("does not choke on a cyclic argument object", () => {
    const a: Record<string, unknown> = { name: "loop" };
    a.self = a;
    expect(() => redactSecrets(a)).not.toThrow();
  });

  it("leaves ordinary values alone", () => {
    expect(redactSecrets({ count: 3, live: true, name: "Amie" })).toEqual({
      count: 3,
      live: true,
      name: "Amie",
    });
  });
});
