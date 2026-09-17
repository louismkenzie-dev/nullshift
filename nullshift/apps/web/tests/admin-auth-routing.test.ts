import { describe, expect, it } from "vitest";
import { adminAccessDecision } from "@nullshift/auth/admin";

describe("admin auth routing", () => {
  it("does not send a non-staff account into the MFA route", () => {
    expect(
      adminAccessDecision({
        authorised: false,
        currentLevel: "aal1",
        nextLevel: "aal2",
      })
    ).toBe("forbidden");
  });

  it("requires step-up only for authorised staff with a pending factor", () => {
    expect(
      adminAccessDecision({
        authorised: true,
        currentLevel: "aal1",
        nextLevel: "aal2",
      })
    ).toBe("mfa");
    expect(
      adminAccessDecision({
        authorised: true,
        currentLevel: "aal2",
        nextLevel: "aal2",
      })
    ).toBe("allow");
  });
});
